# What Spool does

Spool records JavaScript, Python and Go exception locations. JavaScript source maps can locate original source; Python and Go retain reported source coordinates, with optional Go repository path mappings. It runs on your own computer, it is free and open source under the MIT licence, and it has one owner: you.

## How it works

1. **Caught.** Your application sends its errors to Spool with Spool's own SDK and a project key, from the browser, a Node server or a Cloudflare Worker. Spool groups repeats of the same error into one issue.
2. **Mapped.** You upload the source maps from your build. Spool turns each minified stack frame back into your original file, line and column.
3. **Ready.** Each issue has an evidence packet: its latest occurrences, scrubbed stack frames and capture receipts, ready to download or to hand to your coding agent.

## What you get

- **Issues** that put new errors and returning ones first.
- **Releases** so Spool knows which build an error came from, and reopens a resolved issue if it comes back in a later release.
- **Read-only agent keys**, so a coding agent can read one project's issues and evidence packets without being able to change anything.
- **Scrubbing** of common secrets, such as tokens, passwords, emails and card numbers, before anything is saved.
- **One-file export** of everything, which you can restore into a fresh copy of Spool.

## Where to start

- [Run it on your computer](install.md) takes you from a fresh checkout to your first project.
- [Connect your app](capture.md) adds capture to your application and uploads source maps.
- [Investigating an issue](triage.md) walks through the Issues list and an issue's stack trace.
- [Hand it to your coding agent](agents.md) sets up a read-only agent key.

See [supported languages](SUPPORTED-LANGUAGES.md) for the exact native/Sentry Python and Go grammars, limits, repository path mapping, privacy and unavailable symbolication.
