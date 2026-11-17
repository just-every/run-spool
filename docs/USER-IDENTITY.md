# User identity policy

Choose which details about your users your project keeps. New projects keep the user ID, email, username and IP address your app sends. Existing and restored projects keep their saved choices.

## Change the policy

1. Open your project’s **Settings → Privacy & filtering**.
2. Under **User identity policy**, choose **drop**, **hash** or **keep** for each user detail.
3. Choose **Preview identity policy** and review how many records will change.
4. Choose **Save identity policy** to apply your choices to existing records and future errors. You cannot recover details you previously dropped or hashed by choosing keep later.

## Erase one retained user

Open **Settings → Privacy & filtering → End-user erasure**. Choose the identity field and action, enter the exact value, then choose **Preview matching records**. Review the counts and limitations; as the installation owner, type `ERASE USER DATA` and choose **Confirm user erasure**. Downloaded copies and future errors remain outside this action.

<details>
<summary>Details</summary>

**Keep** stores the selected detail in your installation and private archives. **Hash** stores a project-specific code so matching values can count as one user without keeping the original. **Drop** discards that detail. Your scrubbing rules still apply before these choices.

Spool uses the user ID, email, username or IP address your app sends to count affected users, in that order. If no usable detail is retained, the affected-user count is unavailable. It does not mean zero users. Spool does not detect an IP address automatically.

</details>
