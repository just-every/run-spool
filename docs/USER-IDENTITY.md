# User identity policy

New projects drop Sentry user fields. Impact by user is unavailable while the policy drops identity; it is not a count of zero users. Creating a project does not opt you into storing personal identity.

## Change the policy

1. Create the project, then open **Settings** for that project.
2. Find **User identity policy**. Choose **drop**, **hash** or **keep** separately for User ID, User email, User username and User IP address.
3. Choose **Preview identity policy** and review the retained-event, identity-record and affected-user counts.
4. Choose **Save identity policy**. Later intake uses the saved policy. Existing retained values convert only toward stricter storage: keep to hash to drop. Keeping a field later cannot recover values already dropped.

**Keep** retains the selected value in this installation for permitted identity reads and private archives. **Hash** retains a keyed project hash, so equal values can count as one user without storing the original. **Drop** never stores that field. Other Sentry user fields remain dropped. Automatic IP detection is unavailable; Spool does not trust forwarded IP addresses. Session identifiers are stored as private project hashes.

The user key uses the first retained `id`, `email`, `username` or `ip_address`, in that order. A hash counts as itself and a dropped field is skipped. If the SDK sent no usable identity, the impact figure also stays unavailable. Agent packets and read-only grants receive counts only.

The project form links here before creation. Configuration remains under Settings, after the project exists. Changing this policy does not change the separate server scrubbing rules, and does not recover past identity or promise complete user search or end-user erasure.
