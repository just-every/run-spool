const lines = content => content.length ? content.replace(/\n$/, '').split('\n') : [];

/** The change one file gets from its current text (undefined when absent): created, appended to when `append` is set, else left alone. */
export function changeOf(file, old) {
  if (old === undefined) return { ...file, old: '', next: file.content, kind: 'create' };
  if (old.includes(file.marker ?? file.content)) return { ...file, old, next: old, kind: 'present' };
  if (file.append) return { ...file, old, next: old + (old.endsWith('\n') || !old ? '' : '\n') + file.content, kind: 'append' };
  return { ...file, old, next: old, kind: 'exists' };
}

/** A `git apply`-compatible patch for the creations and appends in `changes`. */
export function patchOf(changes) {
  let patch = '';
  for (const change of changes) {
    if (change.kind === 'create') {
      const added = lines(change.next);
      patch += `diff --git a/${change.path} b/${change.path}\nnew file mode 100644\n--- /dev/null\n+++ b/${change.path}\n@@ -0,0 +1,${added.length} @@\n${added.map(line => '+' + line).join('\n')}\n`;
    } else if (change.kind === 'append') {
      const before = lines(change.old), added = lines(change.next).slice(before.length).map(line => '+' + line);
      // An unterminated last line is rewritten with its newline, as git does.
      const unterminated = change.old.length > 0 && !change.old.endsWith('\n');
      const keep = (unterminated ? before.slice(-3, -1) : before.slice(-3)).map(line => ' ' + line);
      const rewritten = unterminated ? [`-${before.at(-1)}`, '\\ No newline at end of file', `+${before.at(-1)}`] : [];
      const oldCount = keep.length + (unterminated ? 1 : 0), start = before.length - oldCount + 1;
      patch += `diff --git a/${change.path} b/${change.path}\n--- a/${change.path}\n+++ b/${change.path}\n@@ -${oldCount ? start : 0},${oldCount} +${oldCount ? start : 1},${oldCount + added.length} @@\n${[...keep, ...rewritten, ...added].join('\n')}\n`;
    }
  }
  return patch;
}

