set -euo pipefail
if [[ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]]; then oidc=yes; else oidc=no; fi
{
  echo "### npm trusted publishing for @just-every/spool"
  echo
  echo "- OIDC available to this run (id-token permission granted): **$oidc**"
  echo "- The package's configured Trusted Publisher cannot be read from CI; only the owner's npmjs.com session can show or change it."
  echo "- The publish job holds no npm token. If the Trusted Publisher below is missing or does not match, npm refuses the publish with its own 401 or 403."
  echo
  echo "Owner steps, once (the package's only maintainer is the owner's npm account):"
  echo
  echo "1. Open https://www.npmjs.com/package/@just-every/spool/access and sign in as the owner."
  echo "2. Under Trusted Publisher choose GitHub Actions."
  echo "3. Organization or user: \`just-every\`. Repository: \`run-spool\`. Workflow filename: \`sdk-release.yml\`. Environment name: leave empty."
  echo "4. Save. Then push the \`sdk-v<version>\` tag again, or re-run the failed Release SDK run; no secret is involved."
} >> "$GITHUB_STEP_SUMMARY"
cat "$GITHUB_STEP_SUMMARY"
if [[ "$oidc" == no ]]; then echo "::warning::This run cannot request an OIDC token, so a publish from it could not use trusted publishing."; fi
