import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';
import { ContentType, ContentItem } from '../types';

async function diagnose() {
  console.log('=== CHECKING SERIES DISCOVERY SOURCES ===');
  const pop = await tmdbService.getPopularSeriesWithMeta(1);
  console.log('Popular page 1 contains VisionQuest?', pop.items.some(i => i.title.toLowerCase().includes('vision')));
  for (const s of pop.items.slice(0, 10)) {
    console.log(`  - [${s.tmdbId}] ${s.title} (${s.year})`);
  }

  try {
    const cinemetaUrl = 'https://v3-cinemeta.strem.io/catalog/series/top/search=VisionQuest.json';
    const resp = await fetch(cinemetaUrl);
    const data = await resp.json();
    console.log('Cinemeta search "VisionQuest":', (data.metas || []).map((m: any) => ({ id: m.id, name: m.name, year: m.year })));
  } catch (e: any) {
    console.log('Cinemeta error:', e.message);
  }

  try {
    const metaUrl = 'https://v3-cinemeta.strem.io/meta/series/tt23112594.json';
    const resp = await fetch(metaUrl);
    const data = await resp.json();
    console.log('Cinemeta meta for tt23112594:', {
      name: data.meta?.name,
      year: data.meta?.year,
      videosCount: data.meta?.videos?.length,
      videos: data.meta?.videos?.slice(0, 5)
    });
  } catch (e: any) {
    console.log('Cinemeta meta error:', e.message);
  }

  console.log('\n=== DIRECT TORRENTIO CHECK ===');
  for (const ep of ['tt23112594:1:1', 'tt23112594:1:2', 'tt23112594:1:3']) {
    try {
      const u = `https://torrentio.strem.fun/stream/series/${ep}.json`;
      const res = await fetch(u, { signal: AbortSignal.timeout(6000) });
      const d = await res.json();
      console.log(`Torrentio for ${ep}: count = ${d.streams?.length || 0}`);
      if (d.streams && d.streams.length > 0) {
        console.log(`  First stream: [${d.streams[0].name}] ${d.streams[0].title}`);
      }
    } catch (e: any) {
      console.log(`Torrentio error for ${ep}: ${e.message}`);
    }

    try {
      const u = `http://localhost:4000/api/stremio/show-subtitle-pt-br/stream/series/${ep}.json`;
      const res = await fetch(u, { signal: AbortSignal.timeout(6000) });
      const d = await res.json();
      console.log(`Local Show-Subtitle for ${ep}: count = ${d.streams?.length || 0}`);
      if (d.streams && d.streams.length > 0) {
        console.log(`  First stream: [${d.streams[0].name}] ${d.streams[0].title}`);
      }
    } catch (e: any) {
      console.log(`Local Show-Subtitle error for ${ep}: ${e.message}`);
    }
  }

  const vqCandidate: ContentItem = {
    id: 'tt23112594',
    imdbId: 'tt23112594',
    tmdbId: '213375',
    title: 'VisionQuest',
    originalTitle: 'VisionQuest',
    type: ContentType.SERIES,
    year: 2026,
    releaseDate: '2026-10-14'
  };

  // Test episode 1
  console.log('\n--- DEBUG PROVIDER REGISTRY DIRECTLY ---');
  const addons = providerRegistry.getProviders().filter(p => p.enabled && p.type === 'stremio-addon' && !['stremio-cinemeta', 'stremio-opensubtitles'].includes(p.id));
  console.log('Active addons:', addons.map(a => `${a.id} (${a.url})`));
  for (const addon of addons) {
    try {
      const { StremioClient } = await import('../src/core/stremio/stremioClient');
      const client = new StremioClient(addon.url);
      const res = await client.getStreams('series', 'tt23112594:1:1');
      console.log(`Addon ${addon.id}: streams = ${res?.streams?.length || 0}`);
      if (addon.id === 'zapitv-show-subtitle-pt-br' && res?.streams?.length > 0) {
        console.log('SHOW-SUBTITLE STREAM SAMPLE:', res.streams[0]);
      }
    } catch (e: any) {
      console.log(`Addon ${addon.id} ERROR: ${e.message}`);
    }
  }

  const ep1Streams = await providerRegistry.resolveStreams('series', vqCandidate, { season: 1, episode: 1 });
  console.log('EP 1 streams count:', ep1Streams.length);

  for (const s of ep1Streams.slice(0, 5)) {
    console.log(`- [${s.quality || 'unknown'}] ${s.name}: ${s.title || s.url} (isCam: ${CamBlockerEngine.isCamStream(s, vqCandidate)})`);
  }

  // Test episode 2
  const ep2Streams = await providerRegistry.resolveStreams('series', vqCandidate, { season: 1, episode: 2 });
  console.log('EP 2 streams count:', ep2Streams.length);
  for (const s of ep2Streams.slice(0, 5)) {
    console.log(`- [${s.quality || 'unknown'}] ${s.name}: ${s.title || s.url} (isCam: ${CamBlockerEngine.isCamStream(s, vqCandidate)})`);
  }

  // Test episode 3 (futuro / não lançado)
  const ep3Streams = await providerRegistry.resolveStreams('series', vqCandidate, { season: 1, episode: 3 });
  console.log('EP 3 streams count:', ep3Streams.length);

  console.log('\n=== 3. TESTE DE ELEGIBILIDADE ATUAL ===');
  const syncPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(vqCandidate);
  console.log('isItemPubliclyPlayableSync:', syncPlayable);
  const evaluated = await catalogEligibilityService.evaluateItem(vqCandidate);
  console.log('evaluateItem:', {
    releaseStatus: evaluated.releaseStatus,
    playbackStatus: evaluated.playbackStatus,
    isPubliclyPlayable: evaluated.isPubliclyPlayable,
    rejectionReasons: evaluated.rejectionReasons,
    validSourceCount: evaluated.validSourceCount
  });
}

diagnose().catch(console.error);

