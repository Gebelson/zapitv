import React, { memo, useMemo, useCallback } from 'react';
import { ContentItem } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvHomeViewProps {
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
  featuredItems,
  trendingItems,
  popularMovies,
  popularSeries,
  animeItems,
  allContent,
  onSelectItem,
  onPlayItem
}) => {
  // Item do Banner Principal (1º destaque configurado ou 1º em alta)
  const heroItem = useMemo(() => {
    return featuredItems[0] || trendingItems[0] || allContent[0];
  }, [featuredItems, trendingItems, allContent]);

  // Continuar Assistindo: extrai itens reais em andamento
  const continueWatchingItems = useMemo(() => {
    if (!allContent || allContent.length === 0) return [];
    return allContent.filter(item => {
      const cont = storageService.getPlaybackContinuity(item);
      return cont.hasStarted && !cont.isCompleted && cont.percentage > 2 && cont.percentage < 95;
    }).slice(0, 15);
  }, [allContent]);

  // Identificador da primeira fileira navegável
  const firstRowKey = useMemo(() => {
    if (continueWatchingItems.length > 0) {
      return 'row-continue-watching';
    }
    if (trendingItems.length > 0) {
      return 'row-trending';
    }
    if (popularMovies.length > 0) {
      return 'row-popular-movies';
    }
    if (popularSeries.length > 0) {
      return 'row-popular-series';
    }
    if (animeItems.length > 0) {
      return 'row-popular-animes';
    }
    if (featuredItems.length > 1) {
      return 'row-featured-all';
    }
    return '';
  }, [continueWatchingItems, trendingItems, popularMovies, popularSeries, animeItems, featuredItems]);

  const handleHeroDownPress = useCallback(() => {
    if (firstRowKey) {
      setFocus(firstRowKey);
      const el = document.getElementById(firstRowKey) || document.querySelector(`[data-focus-key="${firstRowKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [firstRowKey]);

  const handleFirstRowUpPress = useCallback(() => {
    setFocus('tv-hero-play');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const hasContinue = continueWatchingItems.length > 0;

  return (
    <div className="w-full min-h-screen pb-24 overflow-x-hidden">
      {/* Banner Principal Cinematográfico (100% da primeira viewport) */}
      {heroItem && (
        <TvHeroBanner
          item={heroItem}
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
            onRowUp={handleFirstRowUpPress}
          />
        )}

        {/* Em Alta */}
        {trendingItems.length > 0 && (
          <TvContentRow
            title="Em Alta no ZapiTV"
            rowId="trending"
            items={trendingItems}
            onItemClick={onSelectItem}
            onRowUp={!hasContinue ? handleFirstRowUpPress : undefined}
          />
        )}

        {/* Filmes Populares */}
        {popularMovies.length > 0 && (
          <TvContentRow
            title="Filmes em Destaque"
            rowId="popular-movies"
            items={popularMovies}
            onItemClick={onSelectItem}
          />
        )}

        {/* Séries Populares */}
        {popularSeries.length > 0 && (
          <TvContentRow
            title="Séries Populares"
            rowId="popular-series"
            items={popularSeries}
            onItemClick={onSelectItem}
          />
        )}

        {/* Animes */}
        {animeItems.length > 0 && (
          <TvContentRow
            title="Animes em Alta"
            rowId="popular-animes"
            items={animeItems}
            onItemClick={onSelectItem}
          />
        )}

        {/* Destaques Gerais */}
        {featuredItems.length > 1 && (
          <TvContentRow
            title="Seleção Editorial ZapiTV"
            rowId="featured-all"
            items={featuredItems.slice(1)}
            onItemClick={onSelectItem}
          />
        )}
      </div>
    </div>
  );
});

TvHomeView.displayName = 'TvHomeView';
