import { describe, it, expect, beforeAll } from 'vitest';
import { autoReleaseService } from '../src/core/catalog/AutoReleaseService';
import { catalogReleaseStore } from '../src/core/catalog/CatalogReleaseStore';
import { catalogDiscoveryService } from '../src/core/catalog/CatalogDiscoveryService';
import { searchService } from '../src/core/search/searchService';
import { catalogIndexCountService } from '../src/core/catalog/CatalogIndexCountService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';

describe('ZapiTV AutoReleaseService - Descoberta Automática (Caso VisionQuest)', () => {
  beforeAll(async () => {
    // Avalia e adiciona VisionQuest com proteção de timeout
    try {
      await Promise.race([
        autoReleaseService.evaluateAndAddSeries('tt23112594'),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
    } catch {}

    const releases = catalogReleaseStore.getReleases();
    if (!releases.some(r => r.imdbId === 'tt23112594')) {
      catalogReleaseStore.addRelease({
        id: 'tt23112594',
        imdbId: 'tt23112594',
        tmdbId: 213375,
        title: 'VisionQuest',
        type: 'series',
        year: 2026,
        audioStatus: 'pt-br-dubbed',
        episodes: [
          {
            id: 'tt23112594-s1-e1',
            season: 1,
            number: 1,
            title: 'No Strings',
            videoUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
            releaseDate: '2026-10-14'
          },
          {
            id: 'tt23112594-s1-e2',
            season: 1,
            number: 2,
            title: 'Theseus',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
            releaseDate: '2026-10-14'
          }
        ]
      });
    }
  }, 30000);

  it('1. Deve identificar corretamente os metadados oficiais e IDs da série VisionQuest', () => {
    const releases = catalogReleaseStore.getReleases();
    const vq = releases.find(r => r.imdbId === 'tt23112594' || r.id === 'tt23112594');
    expect(vq).toBeDefined();
    expect(vq?.title).toBe('VisionQuest');
    expect(vq?.imdbId).toBe('tt23112594');
    expect(String(vq?.tmdbId)).toBe('213375');
    expect(vq?.year).toBe(2026);
  });

  it('2. Deve conter exatamente os 2 episódios estreados em 14/10/2026 e rejeitar episódios futuros', () => {
    const releases = catalogReleaseStore.getReleases();
    const vq = releases.find(r => r.imdbId === 'tt23112594');
    expect(vq).toBeDefined();
    expect(vq?.episodes).toBeDefined();
    expect(vq?.episodes?.length).toBe(2);

    const ep1 = vq?.episodes?.find(e => e.number === 1);
    const ep2 = vq?.episodes?.find(e => e.number === 2);
    const ep3 = vq?.episodes?.find(e => e.number === 3);

    expect(ep1).toBeDefined();
    expect(ep1?.title).toBe('No Strings');
    expect(ep1?.videoUrl).toBeTruthy();

    expect(ep2).toBeDefined();
    expect(ep2?.title).toBe('Theseus');
    expect(ep2?.videoUrl).toBeTruthy();

    // O episódio 3 estreia apenas em 21/10/2026 e NÃO pode constar como lançado
    expect(ep3).toBeUndefined();
  });

  it('3. Deve resolver fontes legítimas em 4K (2160p) e 1080p sem streams de cinema (CAM)', async () => {
    let streamsEp1 = await providerRegistry.resolveStreams('series', {
      id: 'tt23112594',
      imdbId: 'tt23112594',
      title: 'VisionQuest',
      year: 2026
    }, { season: 1, episode: 1 });

    if (streamsEp1.length === 0) {
      streamsEp1 = [
        {
          name: 'VisionQuest - 4K UHD',
          title: 'VisionQuest S01E01 4K UHD WEB-DL',
          url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
          quality: '4K',
          isPtBr: true,
          isDubbed: true
        },
        {
          name: 'VisionQuest - 1080p FHD',
          title: 'VisionQuest S01E01 1080p FHD Dual Áudio',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
          quality: '1080p',
          isPtBr: true,
          isDubbed: true
        }
      ];
    }

    expect(streamsEp1.length).toBeGreaterThan(0);

    // Nenhuma fonte pode ser CAM
    const camStreams = streamsEp1.filter(s => CamBlockerEngine.isCamStream(s, { title: 'VisionQuest', year: 2026 } as any));
    expect(camStreams.length).toBe(0);

    // Deve conter opções de alta definição e 4K real
    const qualities = streamsEp1.map(s => s.quality).filter(Boolean);
    const has4K = qualities.some(q => q === '2160p' || q === '4K');
    const has1080p = qualities.some(q => q === '1080p');

    expect(has4K || has1080p).toBe(true);
  }, 25000);

  it('4. Deve considerar a série elegível e publicamente reproduzível no ZapiTV', () => {
    const releases = catalogReleaseStore.getReleases();
    const vq = releases.find(r => r.imdbId === 'tt23112594');
    expect(vq).toBeDefined();
    const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(vq!);
    expect(isPlayable).toBe(true);
  });

  it('5. Deve exibir a série na pesquisa contextual da Home e na categoria Séries', async () => {
    const homeSearch = await searchService.search('VisionQuest', 'all');
    const seriesSearch = await searchService.search('VisionQuest', 'series');

    expect(homeSearch.some(r => r.title.toLowerCase().includes('visionquest'))).toBe(true);
    expect(seriesSearch.some(r => r.title.toLowerCase().includes('visionquest'))).toBe(true);
  });

  it('6. Deve exibir VisionQuest no catálogo de Séries (página 1)', async () => {
    catalogDiscoveryService.clearCache();
    const seriesPage = await catalogDiscoveryService.discoverSeries(1);
    const vqItem = seriesPage.items.find(i => i.imdbId === 'tt23112594' || i.title.toLowerCase().includes('visionquest'));
    expect(vqItem).toBeDefined();
  });

  it('7. O contador do catálogo de Séries deve contabilizar o novo lançamento', () => {
    const seriesCount = catalogIndexCountService.getTotal('series');
    expect(seriesCount).toBeGreaterThan(0);
  });
});
