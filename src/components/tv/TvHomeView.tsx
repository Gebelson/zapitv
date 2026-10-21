import React, { memo, useMemo } from 'react';
import { ContentItem } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';

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

  return (
    <div className="w-full min-h-screen pb-24 overflow-x-hidden">
      {/* Banner Principal Cinematográfico */}
      {heroItem && (
        <TvHeroBanner
          item={heroItem}
          onPlay={onPlayItem}
          onOpenDetails={onSelectItem}
        />
      )}

      {/* Fileiras de Conteúdos Horizontais 16:9 */}
      <div className="relative z-10 -mt-8 sm:-mt-12 space-y-2 sm:space-y-4">
        {/* Continuar Assistindo (Se houver progresso real) */}
        {continueWatchingItems.length > 0 && (
          <TvContentRow
            title="Continuar assistindo"
            rowId="continue-watching"
            items={continueWatchingItems}
            onItemClick={onSelectItem}
            showProgress
            badge="Seu Progresso"
          />
        )}

        {/* Em Alta */}
        {trendingItems.length > 0 && (
          <TvContentRow
            title="Em Alta no ZapiTV"
            rowId="trending"
            items={trendingItems}
            onItemClick={onSelectItem}
            badge="Top Semanal"
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
