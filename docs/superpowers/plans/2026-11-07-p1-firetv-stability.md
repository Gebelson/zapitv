# P1 Fire TV Stability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, task by task, with a final whole-branch review.

**Goal:** Eliminate measured carousel remount churn and investigate retained memory without changing visual or navigation contracts.

**Architecture:** Keep the current finite/infinite carousel and animations. Retain item identity in the render window with a distinct key for simultaneous copies; exercise the real component in isolated Playwright fixtures. Measure DOM, React work and heap under the same conditions as baseline.

**Tech Stack:** React/TypeScript, Norigin, Vite, Playwright/Chromium; existing dependencies only.

**Spec:** `docs/superpowers/specs/2026-11-07-p1-firetv-stability-design.md`, approved by the owner on 2026-11-07.

## Global Constraints

- Work only in `fix/p1-firetv-stability-20261107`, based on integrated SHA aaea524.
- Preserve visuals, animation duration, authentication and original PRs #3/#4.
- No services, credentials, grants, Production, merge or Production deployment changes.
- External requests denied in local performance tests; no real session export.

## Review Focus

- Seven/eight-item windows contain duplicate logical items; React keys must still be unique.
- Left/right wrap must select the logical target even during an animation.
- Replacing/reordering the source must not show an earlier item's poster or progress.
- Unmounting must release subscriptions/timers and not leave a focused invisible control.
- Development heap growth must not be labeled a device leak without retention evidence.

## Task 1 — Identity regression and fix

- [x] Extend test-only row harness for list counts, replacement and unmounting.
- [x] Add real browser assertions for shared DOM retention, 1/6/7/8/40-item boundaries, wrap, direction reversal, Enter, focus visibility and no duplicate-key warnings.
- [x] Run red: shared images should be replaced on current implementation.
- [x] Change only render keys in TvContentRow, including source position and copy occurrence to distinguish duplicate source IDs/circular copies.
- [x] Run green and existing focused carousel/navigation checks.

## Task 2 — Memory and comparative measurements

- [x] Repeat the identical external baseline probe and 60-step soak after the change.
- [x] Compare heap/DOM counters across mount/unmount cycles; inspect retaining evidence if heap still grows.
- [x] Fix a leak only if a root cause is demonstrated; do not change unrelated player/catalog behavior.
- [x] Record both improvements and unresolved observations in p1-firetv-stability-report.md.

## Task 3 — Verification and review

- [x] Run typecheck/lint, real behavioral TV gate, auth-route compatibility, required build/stability checks.
- [x] Review complete diff, verify no secrets/config changes, obtain one fresh-context final review.
- [ ] Preserve evidence, update plan/results and commit identifiable changes on P1 branch.
- [ ] Open a separate Draft PR only after all required tests pass; no merge/deployment.
