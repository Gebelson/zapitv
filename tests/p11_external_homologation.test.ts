import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

// Opt-in integration check: real network, disposable browser data, no VOD playback.
// Not part of deterministic build/CI; external availability is reported, never mocked.
const origin = process.env.P11_ORIGIN || 'http://localhost:4000';
const evidencePath = process.env.P11_EVIDENCE || 'docs/p11-external-evidence.json';
const evidence: Record<string, unknown> = process.env.P11_SKIP_CATALOG === '1'
  ? JSON.parse(readFileSync(evidencePath, 'utf8')) : { startedAt: new Date().toISOString(), origin, vodPlayback: false };
async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // tsx/esbuild keepNames helper used by serialized callbacks, not application code.
    await page.addInitScript('window.__name = (target) => target;');
    await page.goto(`${origin}/tests/harness/storage_integrity.html`);
    if (process.env.P11_SKIP_CATALOG !== '1') evidence.catalog = await page.evaluate(async () => {
      const { catalogDiscoveryService: service } = await import('/src/core/catalog/CatalogDiscoveryService.ts' as string);
      const { deduplicateContentItems } = await import('/src/core/catalog/catalogDeduplication.ts' as string);
      const results = [];
      for (const [category, method] of [['movies', 'discoverMovies'], ['series', 'discoverSeries'], ['animes', 'discoverAnimes']]) {
        let accumulated: any[] = [];
        const pages = [];
        for (let number = 1; number <= 6; number++) {
          const start = performance.now();
          try {
            const result = await service[method](number);
            accumulated = deduplicateContentItems([...accumulated, ...result.items]);
            pages.push({ page: number, count: result.items.length, uniqueAccumulated: accumulated.length,
              partial: !!result.isPartial, hasMore: result.hasMore, durationMs: Math.round(performance.now() - start) });
            if (!result.hasMore) break;
          } catch { pages.push({ page: number, error: 'discovery_failed' }); break; }
        }
        let filtered: any;
        try {
          const result = await service[method](1, 'Drama');
          filtered = { count: result.items.length, partial: !!result.isPartial, sample: result.items.slice(0, 3).map((i: any) => ({ id: i.id, title: i.title })) };
        } catch { filtered = { error: 'discovery_failed' }; }
        results.push({ category, pages, filterDrama: filtered, eofVerified: pages.some(p => 'hasMore' in p && !p.hasMore) });
      }
      return results;
    });
    const titleResults = await page.evaluate(async (onlyTitle) => {
      const { tmdbService } = await import('/src/core/tmdb/tmdbClient.ts' as string);
      const { providerRegistry } = await import('/src/core/providers/providerRegistry.ts' as string);
      const { canonicalIdentityService } = await import('/src/core/identity/canonicalIdentity.ts' as string);
      const { sourceConfidenceEngine } = await import('/src/core/identity/sourceConfidenceEngine.ts' as string);
      const { deduplicateContentItems } = await import('/src/core/catalog/catalogDeduplication.ts' as string);
      const { catalogEligibilityService } = await import('/src/core/catalog/CatalogEligibilityService.ts' as string);
      const { ContentType } = await import('/types.ts' as string);
      const cases = [
        { title: 'Sussurros do Coração', query: 'Whisper of the Heart', year: 1995, kind: 'movie' },
        { title: 'Lupin', query: 'Lupin', year: 2021, kind: 'series' },
        { title: 'Jimihen!!', query: 'Jimihen!! Jimiko o Kae Chau Jun Isei Kouyuu', year: 2021, kind: 'anime' },
        { title: 'Chicago Typewriter', query: 'Chicago Typewriter', year: 2017, kind: 'series' },
        { title: 'Resident Evil (2026)', query: 'Resident Evil', year: 2026, kind: 'movie' },
        { title: 'Hope: O Primeiro Impacto', query: 'Hope: O Primeiro Impacto', year: 2026, kind: 'movie' },
        // Real TMDB search above returned both TMDB and IMDb aliases for this series.
        { title: 'Sword Art Online', query: 'Sword Art Online', year: 2012, kind: 'anime', tmdbId: '45782' },
        { title: 'Bleach: Thousand-Year Blood War', query: 'Bleach: Thousand-Year Blood War', year: 2022, kind: 'anime' }
      ];
      const output = [];
      for (const target of cases) {
        if (onlyTitle && target.title !== onlyTitle) continue;
        try {
          const candidates = deduplicateContentItems(await tmdbService.searchMulti(target.query));
          const normalize = (value: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const names = new Set([normalize(target.title), normalize(target.query)]);
          const safe = candidates.filter((item: any) => item.year === target.year &&
            (!target.tmdbId || String(item.tmdbId) === target.tmdbId) &&
            [item.title, item.originalTitle].some(name => names.has(normalize(name))) &&
            (target.kind === 'movie' ? item.type === ContentType.MOVIE || item.mediaFormat === 'movie' : item.type !== ContentType.MOVIE && item.mediaFormat !== 'movie'));
          if (safe.length !== 1) {
            output.push({ title: target.title, status: 'identity_unresolved', candidates: candidates.slice(0, 6).map((i: any) => ({ id: i.id, title: i.title, year: i.year, type: i.type })) });
            continue;
          }
          const item = safe[0];
          const details = item.id.startsWith('tt') && !item.tmdbId
            ? await tmdbService.getDetailsByImdb(item.id, item.type, item.mediaFormat)
            : await tmdbService.getDetails(item.tmdbId || item.id.replace(/^tmdb-/, ''), item.type, item.mediaFormat);
          const selected = { ...item, ...details.item };
          const episode = target.kind === 'movie' ? undefined : { season: 1, episode: 1 };
          if (!catalogEligibilityService.filterEligibleItemsSync([selected]).length) {
            output.push({ title: target.title, id: selected.id, imdbId: selected.imdbId, year: selected.year,
              type: selected.type, status: 'catalog_not_eligible', playback: 'not_started' }); continue;
          }
          const attempts: any[] = [];
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          try {
            const sources = await providerRegistry.resolveStreams(target.kind, selected, episode, {
              signal: controller.signal, onProviderResult: (detail: any) => attempts.push({ provider: detail.providerId,
                count: detail.streamCount, success: detail.success, timeout: !!detail.isTimeout, durationMs: detail.durationMs })
            });
            const identity = canonicalIdentityService.buildIdentity(selected, episode);
            output.push({ title: target.title, id: selected.id, imdbId: selected.imdbId, tmdbId: selected.tmdbId,
              resolvedTitle: selected.title, year: selected.year, type: selected.type, episode, attempts,
              sources: sources.map((source: any) => ({ provider: source.addonId || source.name?.replace(/https?:\/\/\S+/g, '[redacted]'),
                declaredTitle: source.title?.replace(/https?:\/\/\S+/g, '[redacted-url]').slice(0, 200),
                identityAccepted: sourceConfidenceEngine.evaluate(source, identity).isMatch, claimedPtBr: !!source.isPtBr,
                language: source.language || source.audioLanguage || 'undeclared', transport: source.infoHash ? 'torrent' : source.url ? 'url' : 'other' })),
              playback: 'not_started_identity_and_rights_not_confirmed' });
          } finally { clearTimeout(timeout); controller.abort(); }
        } catch (error) { output.push({ title: target.title, status: 'metadata_or_discovery_failed',
          error: String((error as Error).message).replace(/https?:\/\/\S+/g, '[redacted-url]').slice(0, 200) }); }
      }
      return output;
    }, process.env.P11_ONLY_TITLE || null);
    evidence.titles = process.env.P11_ONLY_TITLE
      ? [...((evidence.titles as any[]) || []).filter(item => item.title !== process.env.P11_ONLY_TITLE), ...titleResults]
      : titleResults;
    if (process.env.P11_SKIP_LIVE !== '1') evidence.live = await page.evaluate(async () => {
      const React = await import('/node_modules/.vite/deps/react.js' as string);
      const client = await import('/node_modules/.vite/deps/react-dom_client.js' as string);
      const createRoot = client.createRoot || client.default.createRoot;
      const { LiveTvPlayer } = await import('/src/components/livetv/LiveTvPlayer.tsx' as string);
      const { liveTvProviderRegistry } = await import('/src/core/livetv/LiveTVProviderRegistry.ts' as string);
      const container = document.createElement('div'); document.body.append(container);
      const root = createRoot(container);
      const result = [];
      for (const id of ['tv-camara', 'tv-senado']) {
        const channel = liveTvProviderRegistry.getChannelById(id);
        if (!channel || !channel.isOfficial || channel.requiresExternalAccess) { result.push({ id, status: 'not_eligible' }); continue; }
        root.render((React.createElement || React.default.createElement)(LiveTvPlayer, { channel, initialMuted: true }));
        await new Promise(resolve => setTimeout(resolve, 25000));
        const video = container.querySelector('video');
        if (!video) { result.push({ id, status: 'no_video' }); continue; }
        const start = video.currentTime;
        const initial = video.getVideoPlaybackQuality?.();
        await new Promise(resolve => setTimeout(resolve, 16000));
        const final = video.getVideoPlaybackQuality?.();
        result.push({ id, currentTime: video.currentTime, advancedSeconds: video.currentTime - start, width: video.videoWidth,
          height: video.videoHeight, readyState: video.readyState, error: video.error?.code ?? null,
          presentedFrames: final && initial ? final.totalVideoFrames - initial.totalVideoFrames : null,
          droppedFrames: final?.droppedVideoFrames ?? null, audioDecodedBytes: (video as any).webkitAudioDecodedByteCount ?? null,
          audioAuditioned: false });
      }
      root.unmount(); container.remove();
      return result;
    });
  } finally {
    evidence.completedAt = new Date().toISOString();
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    await browser.close();
  }
}
run().catch(error => { console.error(error.name, String(error.message).replace(/https?:\/\/\S+/g, '[redacted-url]').slice(0, 400)); process.exitCode = 1; });
