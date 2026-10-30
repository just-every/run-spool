import { changedFiles } from '../suspects/metadata';
import { scrubText } from '../scrub';
import { citations } from '../short-ids/format';

const fullSha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
export type CommitInput = { sha: string; message: string | null; author_name: string | null; author_email: string | null; files?: string[]; citations: { citation: string; id: string }[] };
function text(value: unknown, name: string, limit: number, lines = false) {
 if (value === undefined || value === null) return null;
 if (typeof value !== 'string' || !value || value.length > limit || (lines ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) throw new Error(`Commit ${name} must be text of at most ${limit} characters`);
 return value;
}
/** A bare full SHA (the earlier form, no citation) or `{sha, message, author: {name, email}}`.
 * Author name and email are kept as sent; the message passes the capture scrubber and
 * its citations are read from what is stored. */
export function commitInput(value: unknown): CommitInput {
 if (typeof value === 'string') {
  if (!fullSha.test(value)) throw new Error('Full commit SHA required');
  return { sha: value, message: null, author_name: null, author_email: null, citations: [] };
 }
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['sha', 'message', 'author', 'files'].includes(key))) throw new Error('Each commit is a full SHA or {sha, message, author, files}');
 const commit = value as any;
 if (typeof commit.sha !== 'string' || !fullSha.test(commit.sha)) throw new Error('Full commit SHA required');
 const author = commit.author ?? {};
 if (typeof author !== 'object' || Array.isArray(author) || Object.keys(author).some(key => !['name', 'email'].includes(key))) throw new Error('Commit author is {name, email}');
 const raw = text(commit.message, 'message', 8192, true), message = raw === null ? null : scrubText(raw, 8192);
 return { sha: commit.sha, files: changedFiles(commit.files), message, author_name: text(author.name, 'author name', 200), author_email: text(author.email, 'author email', 320), citations: message ? citations(message) : [] };
}
export function commitsInput(values: unknown) {
 if (values === undefined) return [];
 if (!Array.isArray(values) || values.length > 500) throw new Error('Supply at most 500 commits');
 const commits = values.map(commitInput);
 if (new Set(commits.map(commit => commit.sha)).size !== commits.length) throw new Error('Each commit appears once');
 return commits;
}
