# Business import trust

Business imports use this installation's existing owner-claim trust. They need the trusted issuer, installation ID, app origin and public signing-key ring supplied by the Business that provisions the installation. The Settings page can enable the door and revoke trusted keys; it cannot issue keys or establish that trust itself.

## Local installation

Ask your provisioning Business administrator for the four values bound to this installation. Do not create an arbitrary signing key or copy another installation's configuration. The issuer and app origin must be exact origins, and the installation ID and owner must match the administrator's grant configuration.

1. Stop the Spool dev process with Ctrl+C in its foreground terminal, or stop the specific detached process you started.
2. In the Spool checkout's private `.dev.vars` file, preserve all existing settings and add the existing owner-claim bindings:

   ```text
   RER_OWNER_CLAIM_ISSUER='<trusted Business issuer origin>'
   RER_OWNER_CLAIM_INSTALLATION_ID='<this installation ID>'
   RER_OWNER_CLAIM_APP_ORIGIN='<this Spool origin>'
   RER_OWNER_CLAIM_PUBLIC_KEYS='<JSON object mapping key IDs to public JWKs>'
   ```

   The key ring is a nonempty JSON object. Each value must be a public EC P-256 JWK with `kty`, `crv`, `x` and `y`. If supplied, `kid` must match its object key, `alg` must be `ES256`, `use` must be `sig`, and `key_ops` must contain only `verify`. Never put a signing private key here. Keep `.dev.vars` private (mode `0600`) and out of Git.
3. Restart from that checkout with `rer dev` (or `~/.local/bin/rer dev` after the no-Node installer).
4. Open **Settings → Business imports → Details**. Check that the trust warning is gone and the expected key IDs appear. Choose **Enable business imports** only when you want that Business to import under its signed grants. Imports remain off until you enable them, except for the existing first-claim policy on a Business-provisioned installation.

If configuration is still required, have the administrator check the origins, owner email, installation ID and JWK ring together. There is no second owner or separate import-only trust model. **Revoke key** permanently revokes that key ID for this door; re-enabling imports does not undo revocation. Rotation needs a new key ID.

## Hosted installation

The shipped self-hosted `rer deploy` declaration does not expose these owner-claim bindings. There is no supported Settings or optional-secret route to add them on that deployment. A Business-provisioned installation receives them from its provisioning administrator. Ask that administrator to configure or repair the existing trust; do not change the Worker through the provider dashboard or invent deployment commands.

## Import as the owner without Business trust

You can still import a Sentry organization export through your owner session. From the Spool checkout, with the export file kept private and a current owner-session cookie supplied privately in `SPOOL_OWNER_SESSION`:

```sh
node scripts/sentry-import.mjs dry-run --endpoint http://localhost:5173 \
  --session-env SPOOL_OWNER_SESSION --organization <organization-slug> --file <private-export.json>
node scripts/sentry-import.mjs apply --endpoint http://localhost:5173 \
  --session-env SPOOL_OWNER_SESSION --organization <organization-slug> --plan <plan-id> --fingerprint <reviewed-fingerprint>
```

Replace the endpoint with your running Spool URL. Review the dry-run plan before applying; the fingerprint must be the one you reviewed. This route uses the same import pipeline and needs no Business signing key. Settings retains import history and guarded undo even while the Business door is off. The current Business screen does not upload or review bundles itself.
