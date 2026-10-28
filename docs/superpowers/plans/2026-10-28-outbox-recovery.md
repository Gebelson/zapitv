# Outbox partial acknowledgement and recovery

Spec: P4.B.3 user request, current branch, base 61472e2.
Use existing queue/client, storage scope and TV focus. No Turso/WSL activity.

- [x] Reproduce partial acknowledgements with the real queue and client.
- [x] Persist conflicts in the existing scoped outbox, preserving UUID/timestamp/data.
- [x] Bound retries, protect in-flight account/profile changes and newer mutations.
- [x] Add scoped notice and read-only remote comparison; preservation never writes remote.
- [x] Run focused/browser coverage, P3.D/P4.A, TypeScript and final build once; commit.

No automatic conflict replay/retimestamping. A new remote change requires a new
explicit action through the existing interface after reviewing current state.
