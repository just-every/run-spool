set -u
. /tmp/rer-cloud-toolchain.sh
export PATH="$HOME/.rer/toolchain/node-22.20.0/node_modules/node/bin:$PATH"
export RER_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
node --version
for iteration in 1 2 3; do
 cloud_run python3 /tmp/spool-check-runner.py "triage-qualified-$iteration" node tests/triage-journey.mjs || exit $?
done
for suite in agent-handoff audit-history owner-claim sentry-http sentry-sdk alerts-ui project-erasure rollbar-import; do
 cloud_run python3 /tmp/spool-check-runner.py "$suite" node "tests/$suite.mjs"
done
