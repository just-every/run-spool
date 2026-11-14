# Focused repair plan

1. Start from current origin/main, read AGENTS.md and available testing guidance (there is no root TESTING.md).
2. Keep SDK-006 behavior and all existing assertions. Replace forwarding based on the inbound request URL with a destination constructed from the fixture's validated HTTP/127.0.0.1 origin and project DSN. Refuse foreign origins and unexpected paths.
3. Run the existing Sentry SDK journey and Sentry HTTP journey, typecheck, and four isolated before/after destination probes. Regenerate sources.lock.json last; check the lock and contract views. Do not change clauses, views, versions, or other alerts.
4. Create one plain fleet-authored commit. Retrieve current Base scanner source through read-only gh api after local checks pass. Compare all runtime files with the supported pinned rer package and use its packaged entry point when identical, preserving valid version metadata without modifying scanner code. Run the full-history scanner once and require COMPLETE/PASS before a single guarded product push.
5. Verify the advertised remote product head. Follow the brief's explicit no-PR/no-Verify-polling rule; CI and exact-SHA landing remain the fleet's responsibility. Publish actual non-secret report and receipts on the separate evidence ref.
