import { describe, it, expect, beforeEach } from 'vitest';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { searchService } from '../src/core/search/searchService';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { storageService } from '../src/core/storage/storageService';
import { recommendationEngine } from '../src/core/recommendations/recommendationEngine';
import { similarTitlesService } from '../src/core/recommendations/similarTitlesService';
import { mediaAvailabilityIndex } from '../src/core/catalog/MediaAvailabilityIndex';
import { ContentItem, ContentType } from '../types';

describe('ZapiTV - Remoção Total e Bloqueio Permanente de Caminandes', () => {
  const dummyCaminandes: ContentItem = {
    id: 'open-caminandes-s1',
    title: 'Caminandes (Série de Animação)',
    type: ContentType.SERIES,
    rating: 8.4,
    year: 2016,
    genres: ['Animação', 'Comédia'],
    image: 'https://example.com/caminandes.png'
  };

  it('1. Não deve existir Caminandes em VERIFIED_OPEN_ITEMS', () => {
    const found = VERIFIED_OPEN_ITEMS.find(it => 
      /caminandes/i.test(it.id) || /caminandes/i.test(it.title)
    );
    expect(found).toBeUndefined();
  });

  it('2. CatalogEligibilityService deve rejeitar terminantemente Caminandes', () => {
    const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(dummyCaminandes);
    expect(isPlayable).toBe(false);

    const eligible = catalogEligibilityService.filterEligibleItemsSync([dummyCaminandes]);
    expect(eligible).toHaveLength(0);
  });

  it('3. ProviderRegistry não deve retornar nenhum stream para Caminandes', async () => {
    const streams = await providerRegistry.resolveStreams('series', dummyCaminandes, { season: 1, episode: 1 });
    expect(streams).toHaveLength(0);

    // Stream direto com nome ou url contendo caminandes também deve ser bloqueado
    const hasAnyCaminandes = streams.some(s => 
      /caminandes/i.test(s.url || '') || /caminandes/i.test(s.title || '') || /caminandes/i.test(s.name || '')
    );
    expect(hasAnyCaminandes).toBe(false);
  });

  it('4. SearchService não deve exibir Caminandes na busca', () => {
    const results = searchService.filterLocalCatalog('caminandes', 'all', [dummyCaminandes]);
    expect(results).toHaveLength(0);

    const seriesResults = searchService.filterLocalCatalog('caminandes', 'series', [dummyCaminandes]);
    expect(seriesResults).toHaveLength(0);
  });

  it('5. StorageService deve expurgar Caminandes de qualquer cache', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('zapitv_catalog_series', JSON.stringify([dummyCaminandes]));
      const cached = storageService.getCachedCatalog('series');
      expect(cached.some(it => /caminandes/i.test(it.id || it.title))).toBe(false);

      storageService.purgeBannedItemsFromStorage();
      const raw = localStorage.getItem('zapitv_catalog_series');
      if (raw) {
        expect(raw.includes('caminandes')).toBe(false);
      }
    }
  });

  it('6. RecommendationEngine e SimilarTitles não devem sugerir Caminandes', () => {
    const candidates = recommendationEngine.generateCandidates([dummyCaminandes], { category: 'all' });
    expect(candidates.some(it => /caminandes/i.test(it.id || it.title))).toBe(false);
  });

  it('7. MediaAvailabilityIndex não deve indexar ou considerar Caminandes disponível', () => {
    const isPlayable = mediaAvailabilityIndex.isPubliclyPlayable('open-caminandes-s1');
    expect(isPlayable).toBe(false);
  });
});
