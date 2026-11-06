# Incremental stabilization plan

Base: main 70b509d; isolated branch refactor/clean-architecture-20261105. No production promotion authorized for this refactoring.

- [x] Inspect Git and repository instructions; preserve clean starting tree.
- [x] Capture dependency graph, public boundaries and existing violations.
- [x] Install development-only tooling and block new architectural violations in CI.
- [x] Characterize temporal discovery, cancellation and actual player decoding.
- [ ] Identify first failing boundary in a real unavailable-title attempt.
- [ ] Correct demonstrated P0 defect and repeat identical browser attempt.
- [ ] Gate: only after P0 validation, extract provider transport/configuration/outcomes one contract at a time.
- [ ] Gate: then extract player monitoring/recovery hooks and screen responsibilities.
- [ ] Run regression, independent review and isolated Preview with staging-only bindings.

Each extraction needs a failing regression/characterization test, compatible facade, focused verification and separate commit. Rollback uses a reviewed revert of that phase; never reset unrelated work or migrate production data. Tooling is independently useful while playback investigation is blocked.
