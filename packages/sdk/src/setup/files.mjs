// The project files spool-setup reads and writes: only inside the canonical project root, and never through a link.
//
// Node has no openat(), so each folder on a path is pinned instead: opened without following a link (O_DIRECTORY |
// O_NOFOLLOW) and held open, made the working directory, and checked to be that same folder (device and inode). Every
// read and write is then one name in the pinned folder, so a path swapped meanwhile is never resolved. Nothing is
// written in place: a change goes to a new temporary file (O_EXCL) that is renamed over its target once the target is
// checked against the plan (absent for a new file; the same single-link file with the planned bytes for an append).
// Around each change the pinned folders are checked to still be the root's entries of their planned names, and the
// target to be the new file; otherwise it is undone where it is, with every earlier change. What remains is the
// rename itself: a change landing between the last check and that one system call is replaced, as with `git apply`.
import { randomBytes } from 'node:crypto';
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmdirSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import { changeOf } from './patch.mjs';

const { O_RDONLY, O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW, O_NONBLOCK, O_DIRECTORY } = constants;
const quiet = { bigint: true, throwIfNoEntry: false };
const same = (a, b) => a !== undefined && b !== undefined && a.dev === b.dev && a.ino === b.ino;
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const changed = label => `${label} changed while spool-setup was running`;

/** A refusal; its message is the reason. */
class Refused extends Error {}
const refuse = reason => { throw new Refused(reason); };

// A planned path is relative and '/'-separated, and every part a plain name: no '.', '..', drive, backslash or control character.
function split(path) {
  const parts = path.split('/');
  if (!parts.every(part => /^[\w.-]+$/.test(part) && part !== '.' && part !== '..')) refuse(`${JSON.stringify(path)} is not a plain relative path inside the project`);
  return { dirs: parts.slice(0, -1), name: parts.at(-1) };
}

/** The canonical project root: `dir` with every link resolved, identified by its device and inode. */
export function projectRoot(dir) {
  const path = (() => { try { return realpathSync(resolve(dir)); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined; throw error; } })();
  const id = path && lstatSync(path, { bigint: true });
  if (!id?.isDirectory()) throw new Error(`--dir ${dir} is not a folder`);
  return { path, id };
}

/** Pins the root, then each folder of `folders` below it, as the working directory; each is held open in `held`. */
function pin(root, folders, held) {
  if (O_NOFOLLOW === undefined || O_DIRECTORY === undefined) refuse('this platform offers no no-follow opens (O_NOFOLLOW, O_DIRECTORY); run spool-setup on macOS, Linux or WSL2');
  process.chdir(root.path);
  enter(held, '.', root.id, 'the project folder');
  for (const folder of folders) enter(held, folder.name, folder.id, labelOf(held, folder.name));
}
const labelOf = (held, name) => [...held.slice(1).map(entry => entry.name), name].join('/');

/** Makes folder `name` of the working directory the working directory, without following a link; `id` is the one expected. */
function enter(held, name, id, label) {
  let fd;
  try { fd = openSync(name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW); } catch (error) {
    if (error.code === 'ENOENT') refuse(changed(label));
    if (error.code === 'ELOOP' || error.code === 'ENOTDIR') refuse(`${label} ${lstatSync(name, quiet)?.isSymbolicLink() ? 'is a link; spool-setup does not follow links' : 'is not a folder'}`);
    throw error;
  }
  const stat = fstatSync(fd, { bigint: true });
  held.push({ name, id: stat, fd });
  if (!same(stat, id)) refuse(changed(label));
  if (name !== '.') process.chdir(name);
  // A swap between the open and the change of directory lands somewhere else, which this catches before any write.
  if (!same(statSync('.', { bigint: true }), stat)) refuse(changed(label));
}
const release = held => { for (const { fd } of held.splice(0)) closeSync(fd); };

/** Whether the pinned folders are still the root's entries of their planned names and the root is still at its path. */
function placed(root, held) {
  const depth = held.length - 1;
  for (let level = depth; level > 0; level--) if (!same(lstatSync('../'.repeat(depth - level + 1) + held[level].name, quiet), held[level].id)) return false;
  return same(statSync(depth ? '../'.repeat(depth) : '.', quiet), root.id) && same(statSync(root.path, quiet), root.id);
}

/** File `name` in the pinned folder: undefined when absent; refuses a link or anything but a regular file. */
function read(name, label) {
  const stat = lstatSync(name, quiet);
  if (!stat) return undefined;
  if (stat.isSymbolicLink()) refuse(`${label} is a link; spool-setup does not follow links`);
  if (!stat.isFile()) refuse(`${label} is not a regular file`);
  let fd;
  try { fd = openSync(name, O_RDONLY | O_NOFOLLOW | O_NONBLOCK); } catch (error) { if (['ENOENT', 'ELOOP'].includes(error.code)) refuse(changed(label)); throw error; }
  try {
    const id = fstatSync(fd, { bigint: true }), chunks = [];
    if (!same(id, stat) || !id.isFile()) refuse(changed(label));
    for (let chunk = Buffer.alloc(65536), size; (size = readSync(fd, chunk)) > 0; chunk = Buffer.alloc(65536)) chunks.push(chunk.subarray(0, size));
    return { id, bytes: Buffer.concat(chunks) };
  } finally { closeSync(fd); }
}

/** Refuses unless the target in the pinned folder is as planned: absent, or the same single-link file with the planned bytes. */
function current(change) {
  const now = read(change.name, change.path);
  const planned = change.kind === 'create' ? now === undefined : now !== undefined && same(now.id, change.target.id) && now.id.nlink === 1n && now.bytes.equals(change.target.bytes);
  if (!planned) refuse(changed(change.path));
}

/**
 * Each planned file's change, from the project as it is now. Refuses, before anything is sent or written, a path that
 * is not plain, a link anywhere on a path, anything but a folder or a regular file, a file to change that shares its
 * data with another hard link, and a file that is not UTF-8 text (the printed patch could not show it).
 */
export function planChanges(root, files) {
  const home = process.cwd(), held = [];
  try {
    return files.map(file => {
      const { dirs, name } = split(file.path), folders = [];
      pin(root, [], held);
      let target;
      for (const [index, dir] of dirs.entries()) {
        const stat = lstatSync(dir, quiet);
        if (!stat) { folders.push(...dirs.slice(index).map(missing => ({ name: missing }))); break; }
        enter(held, dir, stat, labelOf(held, dir));
        folders.push({ name: dir, id: held.at(-1).id });
      }
      if (folders.every(folder => folder.id)) target = read(name, file.path);
      release(held);
      let old;
      if (target) try { old = utf8.decode(target.bytes); } catch { refuse(`${file.path} is not UTF-8 text`); }
      const change = changeOf(file, old);
      if (change.kind === 'append' && target.id.nlink > 1n) refuse(`${file.path} shares its data with another file (a hard link); spool-setup does not change it`);
      return { ...change, folders, name, target };
    });
  } catch (error) { throw error instanceof Refused ? new Error(`${error.message}. Nothing was written.`) : error; }
  finally { release(held); process.chdir(home); }
}

/** Writes every create and append in `changes` exactly as planned, or nothing: see the header. */
export function writeChanges(root, changes) {
  const writes = changes.filter(change => change.kind === 'create' || change.kind === 'append');
  const home = process.cwd(), made = new Map(), log = [];
  try {
    for (const change of writes) check(root, change);
    for (const change of writes) stage(root, change, made, log);
    for (const entry of log.filter(entry => entry.change)) swap(root, entry);
  } catch (error) {
    const kept = undo(root, log);
    throw new Error(`${error.message}. ${kept.length ? `Not undone, because it moved or changed meanwhile: ${kept.join('; ')}.` : 'Nothing was written.'}`);
  } finally { process.chdir(home); }
}

/** Refuses unless the project still matches the plan for `change`: its folders, and its target absent or unchanged. */
function check(root, change) {
  const held = [], existing = change.folders.filter(folder => folder.id);
  try {
    pin(root, existing, held);
    const missing = change.folders[existing.length];
    if (missing) { if (lstatSync(missing.name, quiet)) refuse(changed(labelOf(held, missing.name))); return; }
    current(change);
  } finally { release(held); }
}

/** Creates the change's missing folders, then writes its new content to a temporary file in the target's folder. */
function stage(root, change, made, log) {
  const held = [], folders = [], moved = () => refuse(`the folders of ${change.path} moved while spool-setup was writing`);
  try {
    pin(root, [], held);
    for (const folder of change.folders) {
      const label = labelOf(held, folder.name);
      let id = folder.id ?? made.get(label);
      if (!id) {
        if (!placed(root, held)) moved();
        try { mkdirSync(folder.name); } catch (error) { if (error.code === 'EEXIST') refuse(changed(label)); throw error; }
        const entry = { folders: [...folders], name: folder.name, id: lstatSync(folder.name, { bigint: true }), label: `${label}, a folder it created` };
        log.push(entry); made.set(label, id = entry.id);
        if (!placed(root, held)) { attempt(entry); moved(); }
      }
      enter(held, folder.name, id, label);
      folders.push({ name: folder.name, id: held.at(-1).id });
    }
    if (!placed(root, held)) moved();
    const temp = `.${change.name}.spool-setup-${randomBytes(8).toString('hex')}`, fd = openSync(temp, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, change.target ? 0o600 : 0o666);
    const entry = { folders, name: temp, id: fstatSync(fd, { bigint: true }), label: `the temporary file for ${change.path}`, change };
    log.push(entry);
    try {
      const bytes = Buffer.from(change.next);
      for (let offset = 0; offset < bytes.length;) offset += writeSync(fd, bytes, offset);
      if (change.target) fchmodSync(fd, Number(change.target.id.mode & 0o777n));
      fsyncSync(fd);
    } finally { closeSync(fd); }
    if (!placed(root, held)) { attempt(entry); moved(); }
  } finally { release(held); }
}

/** Renames a staged file over its target once the target and every pinned folder check out, and checks them after. */
function swap(root, entry) {
  const { change } = entry, held = [];
  try {
    pin(root, entry.folders, held);
    try {
      current(change);
      if (!same(lstatSync(entry.name, quiet), entry.id) || !placed(root, held)) refuse(`${change.path} moved or changed while spool-setup was writing`);
      renameSync(entry.name, change.name);
      Object.assign(entry, { name: change.name, label: change.path, renamed: true });
      if (!same(lstatSync(change.name, quiet), entry.id) || !placed(root, held)) refuse(`${change.path} moved or changed while spool-setup was writing`);
    } catch (error) { attempt(entry); throw error; }
  } finally { release(held); }
}

/** Undoes the log newest first, each step only where its folder and entry are still the ones written; returns the rest. */
function undo(root, log) {
  const kept = [];
  for (const entry of log.reverse()) {
    if (entry.undone) continue;
    const held = [];
    try { pin(root, entry.folders, held); undoHere(entry); } catch { kept.push(entry.label); } finally { release(held); }
  }
  return kept;
}

/** Undoes one step in its pinned folder: removes a created folder or file, or puts back the planned bytes of an append. */
function undoHere(entry) {
  if (entry.undone) return;
  if (!same(lstatSync(entry.name, quiet), entry.id)) throw new Error(`${entry.label} is no longer the one written`);
  if (!entry.change) rmdirSync(entry.name);
  else if (!entry.renamed || !entry.change.target) unlinkSync(entry.name);
  else {
    const { target } = entry.change, temp = `.${entry.name}.spool-setup-${randomBytes(8).toString('hex')}`, fd = openSync(temp, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
    try {
      for (let offset = 0; offset < target.bytes.length;) offset += writeSync(fd, target.bytes, offset);
      fchmodSync(fd, Number(target.id.mode & 0o777n));
      fsyncSync(fd);
    } catch (error) { closeSync(fd); unlinkSync(temp); throw error; }
    closeSync(fd);
    renameSync(temp, entry.name);
  }
  entry.undone = true;
}
// Undoes a step where it is, before the refusal that follows; if that fails, the final undo tries again and reports it.
const attempt = entry => { try { undoHere(entry); } catch { /* left for undo(), which names it if it still fails */ } };
