
# AGENTS.md — SyncCalc

## Project identity
Product: SyncCalc
Owner: Tumbuleke Hub
Purpose: Free cross-platform calculator with automatic
cloud-synchronised calculation history.

## Locked product decisions
- Android and iOS.
- Flutter and Dart.
- Free application.
- Automatic real-time cloud synchronisation.
- Supabase backend.
- PostgreSQL cloud database.
- SQLite/Drift local persistence.
- Supabase Auth.
- Riverpod state management.

## Architecture rules
1. Use feature-based modular architecture.
2. Keep calculation logic independent of UI.
3. Implement local-first functionality.
4. Never require internet for basic calculations.
5. Persist calculations locally before cloud upload.
6. Use a durable outbox for pending operations.
7. Use UUIDs for calculation identifiers.
8. Make upload operations idempotent.
9. Use tombstones for synchronised deletions.
10. Reconcile missed realtime events.

## Security rules
- Enable RLS on user-owned tables.
- Never expose Supabase service-role credentials.
- Never log calculation expressions or results unnecessarily.
- Validate ownership of all cloud records.
- Do not store passwords locally.

## Development rules
- Read existing code before modifying it.
- Do not rewrite working modules unnecessarily.
- Do not introduce dependencies without justification.
- Write tests for new business logic.
- Run relevant tests after changes.
- Do not silently change product requirements.
- Do not claim a test passed unless it was executed.
- Do not commit secrets or environment files.

## Working procedure
For every task:
1. Inspect relevant files.
2. Explain the proposed implementation.
3. Identify affected files.
4. Implement the smallest complete change.
5. Add or update tests.
6. Run formatting, analysis and tests.
7. Report files changed and test results.
8. Identify outstanding risks.

## Scope control
Build the MVP first:
- Standard calculator.
- Local history.
- Authentication.
- Cloud history.
- Realtime synchronisation.
- Offline reconciliation.

Do not implement scientific mode or monetisation
without an approved product decision.
