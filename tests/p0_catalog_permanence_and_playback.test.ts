import { describe, it, expect } from 'vitest';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { mediaAvailabilityIndex } from '../src/core/catalog/MediaAvailabilityIndex';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { ContentType } from '../types';

describe('ZAPITV — P0: Catálogo Permanente e Resiliência de Reprodução', () => {
  it('1. Frieren e conteúdos lançados permanecem SEMPRE visíveis no catálogo mesmo se provedores falharem', () => {
    const frieren = {
      id: 'tmdb-209867',
      tmdbId: '209867',
      title: 'Frieren e a Jornada para o Além',
      originalTitle: '葬送のフリーレン',
      type: ContentType.ANIME,
      mediaFormat: 'series' as any,
      year: 2023,
      releaseDate: '2023-09-29'
    };

    // Marca como UNAVAILABLE_CONFIRMED no índice de disponibilidade
    mediaAvailabilityIndex.markUnavailableConfirmed(frieren.id, 'anime', ['Teste Provedores Offline'], frieren.title);

    // O catálogo DEVE continuar considerando o item elegível para exibição
    const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(frieren);
    expect(isPlayable).toBe(true);

    const filtered = catalogEligibilityService.filterEligibleItemsSync([frieren]);
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Frieren e a Jornada para o Além');
  });

  it('2. In-flight request de reprodução não é cancelada se prefetch for abortado', async () => {
    const prefetchAbort = new AbortController();
    const item = {
      id: 'tmdb-209867',
      tmdbId: '209867',
      title: 'Frieren e a Jornada para o Além',
      originalTitle: '葬送のフリーレン',
      year: 2023
    };

    // Prefetch inicia busca
    const p1 = providerRegistry.resolveStreams('anime', item, { season: 1, episode: 1 }, { signal: prefetchAbort.signal });

    // Usuário clica em Assistir imediatamente, cancelando o prefetch
    prefetchAbort.abort();

    // Player inicia busca ativa
    const playAbort = new AbortController();
    const p2 = providerRegistry.resolveStreams('anime', item, { season: 1, episode: 1 }, { signal: playAbort.signal });

    const [res1, res2] = await Promise.all([p1, p2]);
    // A busca ativa deve receber as fontes sem ser morta pelo abort do prefetch
    expect(res2.length).toBeGreaterThan(0);
  }, 20000);
});
