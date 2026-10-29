import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ContentItem } from '../../../types';
import { storageService, type WatchProgress } from '../../core/storage/storageService';
import { resolveContinueWatchingItems } from '../../core/storage/watchState';
import { heroCarouselStore, HERO_CAROUSEL_STORAGE_KEY } from '../../core/catalog/heroCarouselStore';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';
import { streamingPlatformExclusivesService } from '../../core/platforms/StreamingPlatformExclusivesService';
import { tvPerformanceService } from '../../core/tv/tvPerformanceService';
import { tvScrollService } from '../../core/tv/tvScrollService';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvHomeViewProps {
  suspended?: boolean;
  featuredItems: ContentItem[];
  trendingItems: ContentItem[];
  popularMovies: ContentItem[];
  popularSeries: ContentItem[];
  animeItems: ContentItem[];
  allContent: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onPlayItem: (item: ContentItem) => void;
}

export const TvHomeView: React.FC<TvHomeViewProps> = memo(({
  suspended = false,
  featuredItems,
  trendingItems,
  popularMovies,
  popularSeries,
  animeItems,
  allContent,
  onSelectItem,
  onPlayItem
}) => {
  const [progressRevision, setProgressRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setProgressRevision(value => value + 1);
    window.addEventListener('zapitv_progress_updated', refresh);
    return () => window.removeEventListener('zapitv_progress_updated', refresh);
  }, []);
  // Lista de Destaques configurados no painel administrativo / heroCarouselStore
  const [liveFeatured, setLiveFeatured] = useState<ContentItem[]>(() => {
    // 1. Se houver itens personalizados salvos pelo admin no localStorage, respeita todos eles sem corte
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    // 2. Se a prop featuredItems foi fornecida, utiliza os itens de destaque configurados
    if (featuredItems && featuredItems.length > 0) {
      return heroCarouselStore.getDisplayItems(featuredItems, 6);
    }
    // 3. Fallback para sementes oficiais de destaque
    return heroCarouselStore.getDisplayItems(allContent, 6);
  });

  useEffect(() => {
    // Verifica se há configuração manual no storage
    let hasManual = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasManual = true;
            setLiveFeatured(parsed);
          }
        }
      } catch {}
    }
    if (!hasManual && featuredItems && featuredItems.length > 0) {
      setLiveFeatured(heroCarouselStore.getDisplayItems(featuredItems, 6));
    }
  }, [featuredItems]);

  useEffect(() => {
    return heroCarouselStore.subscribe((updatedItems) => {
      if (updatedItems && updatedItems.length > 0) {
        setLiveFeatured(updatedItems);
      }
    });
  }, []);

  // Lista cinematográfica de múltiplos destaques (suporta qualquer quantidade de banners configurados)
  const heroSlides = useMemo(() => {
    if (liveFeatured.length > 0) return liveFeatured;
    if (featuredItems.length > 0) return heroCarouselStore.getDisplayItems(featuredItems, 6);
    if (trendingItems.length > 0) return trendingItems.slice(0, 6);
    return allContent.slice(0, 6);
  }, [liveFeatured, featuredItems, trendingItems, allContent]);

  // Continuar Assistindo: extrai itens reais em andamento
  const continueWatchingItems = useMemo(() => {
    const progress = allContent.map(item => storageService.getSyncItemProgressRecord(item.id))
      .filter((value): value is WatchProgress => value !== null);
    return resolveContinueWatchingItems(progress, allContent).slice(0, 15);
  }, [allContent, progressRevision]);

  // Carrosséis de Exclusivos das Plataformas de Streaming para a Smart TV
  const platformRows = useMemo(() => {
    return {
      netflix: streamingPlatformExclusivesService.getPlatformRow(allContent, 'netflix'),
      prime: streamingPlatformExclusivesService.getPlatformRow(allContent, 'prime'),
      hbo: streamingPlatformExclusivesService.getPlatformRow(allContent, 'hbo'),
      apple: streamingPlatformExclusivesService.getPlatformRow(allContent, 'apple'),
      disney: streamingPlatformExclusivesService.getPlatformRow(allContent, 'disney'),
      paramount: streamingPlatformExclusivesService.getPlatformRow(allContent, 'paramount'),
      globoplay: streamingPlatformExclusivesService.getPlatformRow(allContent, 'globoplay'),
      crunchyroll: streamingPlatformExclusivesService.getPlatformRow(allContent, 'crunchyroll')
    };
  }, [allContent]);

  // Identificador da primeira fileira navegável
  const firstActiveRowId = useMemo(() => {
    if (continueWatchingItems.length > 0) return 'continue-watching';
    if (trendingItems.length > 0) return 'trending';
    if (platformRows.netflix) return 'exclusive-netflix';
    if (popularMovies.length > 0) return 'popular-movies';
    if (platformRows.prime) return 'exclusive-prime';
    if (platformRows.hbo) return 'exclusive-hbo';
    if (platformRows.apple) return 'exclusive-apple';
    if (popularSeries.length > 0) return 'popular-series';
    if (platformRows.disney) return 'exclusive-disney';
    if (platformRows.paramount) return 'exclusive-paramount';
    if (platformRows.globoplay) return 'exclusive-globoplay';
    if (animeItems.length > 0) return 'popular-animes';
    if (platformRows.crunchyroll) return 'exclusive-crunchyroll';
    if (featuredItems.length > 1) return 'featured-all';
    return '';
  }, [continueWatchingItems, trendingItems, platformRows, popularMovies, popularSeries, animeItems, featuredItems]);

  const [activeRowId, setActiveRowId] = useState<string>(firstActiveRowId);

  // Mapeamento ordenado de todas as fileiras ativas
  const orderedRowIds = useMemo(() => {
    const ids: string[] = [];
    if (continueWatchingItems.length > 0) ids.push('continue-watching');
    if (trendingItems.length > 0) ids.push('trending');
    if (platformRows.netflix) ids.push('exclusive-netflix');
    if (popularMovies.length > 0) ids.push('popular-movies');
    if (platformRows.prime) ids.push('exclusive-prime');
    if (platformRows.hbo) ids.push('exclusive-hbo');
    if (platformRows.apple) ids.push('exclusive-apple');
    if (popularSeries.length > 0) ids.push('popular-series');
    if (platformRows.disney) ids.push('exclusive-disney');
    if (platformRows.paramount) ids.push('exclusive-paramount');
    if (platformRows.globoplay) ids.push('exclusive-globoplay');
    if (animeItems.length > 0) ids.push('popular-animes');
    if (platformRows.crunchyroll) ids.push('exclusive-crunchyroll');
    if (featuredItems.length > 1) ids.push('featured-all');
    return ids;
  }, [continueWatchingItems.length, trendingItems.length, platformRows, popularMovies.length, popularSeries.length, animeItems.length, featuredItems.length]);

  const isFireTv = tvPerformanceService.isFireTv();

  // No Fire TV, monta os cards internos apenas para as primeiras 3 fileiras e janela de +/- 2 da fileira focada
  const isRowNear = useCallback((rowId: string) => {
    if (!isFireTv) return true;
    const rowIndex = orderedRowIds.indexOf(rowId);
    if (rowIndex === -1) return true;
    if (rowIndex < 3) return true;
    const activeIndex = activeRowId ? orderedRowIds.indexOf(activeRowId) : 0;
    if (activeIndex === -1) return rowIndex < 3;
    return Math.abs(rowIndex - activeIndex) <= 2;
  }, [isFireTv, orderedRowIds, activeRowId]);

  const handleHeroDownPress = useCallback(() => {
    if (firstActiveRowId) {
      const rowKey = `row-${firstActiveRowId}`;
      setFocus(rowKey);
    }
  }, [firstActiveRowId]);

  const handleFirstRowUpPress = useCallback(() => {
    tvScrollService.scrollToHero(() => {
      setFocus('tv-hero-play');
    });
  }, []);

  const editorialItems = useMemo(() => featuredItems.slice(1), [featuredItems]);
  const hasContinue = continueWatchingItems.length > 0;

  return (
    <div className="w-full min-h-screen pb-24 overflow-x-hidden">
      {/* Banner Principal Cinematográfico (100% da primeira viewport com carrossel multi-destaques) */}
      {heroSlides.length > 0 && (
        <TvHeroBanner
          items={heroSlides}
          suspended={suspended}
          onPlay={onPlayItem}
          onOpenDetails={onSelectItem}
          onDownPress={handleHeroDownPress}
          upFocusKey="tv-nav-home"
        />
      )}

      {/* Fileiras de Conteúdos: Exclusivamente abaixo da primeira viewport (Sem margem negativa) */}
      <div className="relative z-10 pt-4 sm:pt-8 lg:pt-12 pb-24 sm:pb-28 space-y-4 sm:space-y-6 lg:space-y-10">
        {/* Continuar Assistindo (Se houver progresso real) */}
        {hasContinue && (
          <TvContentRow
            title="Continuar assistindo"
            rowId="continue-watching"
            items={continueWatchingItems}
            onItemClick={onSelectItem}
            showProgress
            onRowUp={firstActiveRowId === 'continue-watching' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('continue-watching')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Em Alta */}
        {trendingItems.length > 0 && (
          <TvContentRow
            title="Em Alta no ZapiTV"
            rowId="trending"
            items={trendingItems}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'trending' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('trending')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos Netflix */}
        {platformRows.netflix && (
          <TvContentRow
            title={platformRows.netflix.title}
            rowId="exclusive-netflix"
            items={platformRows.netflix.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-netflix' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-netflix')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Filmes Populares */}
        {popularMovies.length > 0 && (
          <TvContentRow
            title="Filmes em Destaque"
            rowId="popular-movies"
            items={popularMovies}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'popular-movies' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('popular-movies')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos Prime Video */}
        {platformRows.prime && (
          <TvContentRow
            title={platformRows.prime.title}
            rowId="exclusive-prime"
            items={platformRows.prime.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-prime' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-prime')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos HBO Max */}
        {platformRows.hbo && (
          <TvContentRow
            title={platformRows.hbo.title}
            rowId="exclusive-hbo"
            items={platformRows.hbo.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-hbo' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-hbo')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos Apple TV+ */}
        {platformRows.apple && (
          <TvContentRow
            title={platformRows.apple.title}
            rowId="exclusive-apple"
            items={platformRows.apple.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-apple' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-apple')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Séries Populares */}
        {popularSeries.length > 0 && (
          <TvContentRow
            title="Séries Populares"
            rowId="popular-series"
            items={popularSeries}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'popular-series' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('popular-series')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos Disney+ */}
        {platformRows.disney && (
          <TvContentRow
            title={platformRows.disney.title}
            rowId="exclusive-disney"
            items={platformRows.disney.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-disney' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-disney')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos Paramount+ */}
        {platformRows.paramount && (
          <TvContentRow
            title={platformRows.paramount.title}
            rowId="exclusive-paramount"
            items={platformRows.paramount.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-paramount' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-paramount')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos Globoplay */}
        {platformRows.globoplay && (
          <TvContentRow
            title={platformRows.globoplay.title}
            rowId="exclusive-globoplay"
            items={platformRows.globoplay.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-globoplay' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-globoplay')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Animes */}
        {animeItems.length > 0 && (
          <TvContentRow
            title="Animes em Alta"
            rowId="popular-animes"
            items={animeItems}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'popular-animes' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('popular-animes')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Exclusivos Crunchyroll */}
        {platformRows.crunchyroll && (
          <TvContentRow
            title={platformRows.crunchyroll.title}
            rowId="exclusive-crunchyroll"
            items={platformRows.crunchyroll.items}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'exclusive-crunchyroll' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('exclusive-crunchyroll')}
            onRowFocus={setActiveRowId}
          />
        )}

        {/* Destaques Gerais */}
        {featuredItems.length > 1 && (
          <TvContentRow
            title="Seleção Editorial ZapiTV"
            rowId="featured-all"
            items={editorialItems}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'featured-all' ? handleFirstRowUpPress : undefined}
            isNearViewport={isRowNear('featured-all')}
            onRowFocus={setActiveRowId}
          />
        )}
      </div>
    </div>
  );
});

TvHomeView.displayName = 'TvHomeView';
