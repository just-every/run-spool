# Keys, invitations and backups

Name keys for the apps that use them and check their last use in Settings. A new key opens once where you create it; save it before closing the dialog. Revoking a key asks you to confirm the access that will stop. Local invitations show their private link immediately, while colleagues see the inviting person, organization and project access before joining. Alerts offers an email test followed by Turn on; the displayed test result distinguishes a local suppressed send from provider acceptance. Download a dated private backup before deleting a project, and review its project counts before typing the confirmation; the full erasure inventory remains in Details. Author: sd / Run Edit Run fleet, 2026-11-17.

The runtime prerequisite journey opens Alerts & integrations → Details before following the Slack integration guide. It keeps the visible-link, pinned source, anonymous documentation and recipe assertions.

Existing installations gain descriptive names and successful-use timestamps through `migrations/core/0111_key_names_and_use.sql`. The additive upgrade preserves each key’s authority and revocation state; older keys start with a blank name and unknown last use. Keep the existing database and grants when updating.

If a project changes while you review erasure, Spool refreshes the counts and clears the typed confirmation. Review the updated preview and type the project identifier again; a stale preview never deletes the project.
