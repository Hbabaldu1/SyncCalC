
# SyncCalc — GitHub Copilot Instructions

You are assisting with SyncCalc, a Flutter/Dart
cross-platform calculator owned by Tumbuleke Hub.

Follow AGENTS.md as the main engineering reference.

## Technical stack
- Flutter
- Dart
- Riverpod
- GoRouter
- SQLite/Drift
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime

## Engineering standards
- Maintain existing architecture.
- Use null-safe Dart.
- Prefer small, readable, testable functions.
- Avoid unnecessary abstractions.
- Separate UI, domain and data layers.
- Keep calculation logic independent of widgets.
- Preserve offline functionality.
- Never expose service-role credentials.
- Use tests for important logic.
- Do not add packages without explaining why.

## Agent behaviour
- Inspect code before suggesting changes.
- Avoid modifying unrelated files.
- Do not invent APIs or package methods.
- Check current package documentation when necessary.
- Explain important changes.
- Report tests actually executed.
- Ask before changing locked product decisions.

## Product priorities
Correctness > Reliability > Security >
Maintainability > Visual polish.
