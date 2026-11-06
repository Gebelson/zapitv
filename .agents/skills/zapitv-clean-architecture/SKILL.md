---
name: zapitv-clean-architecture
description: Maintain ZapiTV playback, provider and cross-device contracts during incremental architectural changes and incident recovery.
---
# ZapiTV architecture

Read repository AGENTS.md and the current Git diff. Characterize the changed public contract before extracting implementation.

While playback P0 is open, keep ZapiPlayer, providerRegistry and sourceVerificationService structurally intact. Limit edits there to demonstrated diagnostic or behavioral defects. Never replace an unavailable title with another video.

Use existing canonical identity, episode, outbox and profile-scope services. Preserve account isolation, offline conflicts, audio, subtitles, intro and Watch Party. Do not expose provider credentials in browser bundles or diagnostic URLs.

Extract one responsibility per tested commit, retain compatibility at existing imports, and remove the replaced implementation after consumers pass. Domain code must not import React UI. Run architecture checks; never expand baselines merely to pass CI.

Use typed outcomes and retain rejection reasons. A network failure is inconclusive; downloaded bytes are not playback confirmation. Browser tests must observe decoded frames and advancing video time without assigning currentTime to simulate playback. Label controlled media separately from real-title validation and Chromium separately from physical TVs.

Measure before claiming performance improvement. Do not delete Knip findings automatically. Do not publish unvalidated changes or mutate user data during architecture work.
