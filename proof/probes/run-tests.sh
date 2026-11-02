#!/bin/bash
# One remote job: build the app once, then run the touched runners in order.
cd /Users/zemaj/www/rer-consolidation/work/uip-spool-s3-settings/repo || exit 1
python3 -I /Users/zemaj/www/rer-consolidation/.tools/heavy-slot.py --wait-min 90 -- bash -c 'pnpm build:app && for t in sentry-http sdk-package old-archive triage-journey; do echo "=== TEST $t"; node tests/$t.mjs && echo "=== PASS $t" || echo "=== FAIL $t"; done' > ../private/t-batch.log 2>&1
echo "exit=$?" >> ../private/t-batch.log
