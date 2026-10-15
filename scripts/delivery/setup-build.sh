#!/usr/bin/env bash
set -euo pipefail
# Trusted project builds start on Node 26. Install this seed's tools locally;
# this prepares source verification and never creates an application owner.
spool_build_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$spool_build_root"
npm install --prefix "$spool_build_root/.rer-tools" --no-save --package-lock=false \
  --no-audit --no-fund node@22.20.0 pnpm@10.12.4
export PATH="$spool_build_root/.rer-tools/node_modules/.bin:$PATH"
pnpm install --frozen-lockfile
