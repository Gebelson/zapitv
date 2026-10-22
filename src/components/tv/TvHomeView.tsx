import React, { memo, useState, useEffect, useMemo, useCallback } from 'react';
import { ContentItem } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { heroCarouselStore, HERO_CAROUSEL_STORAGE_KEY } from '../../core/catalog/heroCarouselStore';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';
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
    if (!allContent || allContent.length === 0) return [];
    return allContent.filter(item => {
      const cont = storageService.getPlaybackContinuity(item);
      return cont.hasStarted && !cont.isCompleted && cont.percentage > 2 && cont.percentage < 95;
    }).slice(0, 15);
  }, [allContent]);

  // Identificador da primeira fileira navegável
  const firstActiveRowId = useMemo(() => {
    if (continueWatchingItems.length > 0) return 'continue-watching';
    if (trendingItems.length > 0) return 'trending';
    if (popularMovies.length > 0) return 'popular-movies';
    if (popularSeries.length > 0) return 'popular-series';
    if (animeItems.length > 0) return 'popular-animes';
    if (featuredItems.length > 1) return 'featured-all';
    return '';
  }, [continueWatchingItems, trendingItems, popularMovies, popularSeries, animeItems, featuredItems]);

  const handleHeroDownPress = useCallback(() => {
    if (firstActiveRowId) {
      const rowKey = `row-${firstActiveRowId}`;
      setFocus(rowKey);
      const el = document.getElementById(rowKey) || document.querySelector(`[data-focus-key="${rowKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [firstActiveRowId]);

  const handleFirstRowUpPress = useCallback(() => {
    // 1. Rola a viewport e o documento de volta ao topo absoluto da página
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    const heroEl = document.getElementById('tv-hero-banner');
    if (heroEl) {
      try {
        heroEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {}
    }

    // 2. Transfere o foco de forma coordenada para o botão Assistir do Hero
    setFocus('tv-hero-play');
  }, []);

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
        />
      )}

      {/* Fileiras de Conteúdos: Exclusivamente abaixo da primeira viewport (Sem margem negativa) */}
      <div className="relative z-10 pt-8 sm:pt-12 pb-28 space-y-6 sm:space-y-10">
        {/* Continuar Assistindo (Se houver progresso real) */}
        {hasContinue && (
          <TvContentRow
            title="Continuar assistindo"
            rowId="continue-watching"
            items={continueWatchingItems}
            onItemClick={onSelectItem}
            showProgress
            onRowUp={firstActiveRowId === 'continue-watching' ? handleFirstRowUpPress : undefined}
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
          />
        )}

        {/* Destaques Gerais */}
        {featuredItems.length > 1 && (
          <TvContentRow
            title="Seleção Editorial ZapiTV"
            rowId="featured-all"
            items={featuredItems.slice(1)}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'featured-all' ? handleFirstRowUpPress : undefined}
          />
        )}
      </div>
    </div>
  );
});

TvHomeView.displayName = 'TvHomeView';
