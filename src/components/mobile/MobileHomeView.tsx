import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { ContentItem } from '../../../types';
import { MobileHero } from './MobileHero';
import { MobileContentRow } from './MobileContentRow';
import { MobileRankedRow } from './MobileRankedRow';
import { storageService, WatchProgress } from '../../core/storage/storageService';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';

interface MobileHomeViewProps {
  heroItems: ContentItem[];
  allContent: ContentItem[];
  trendingItems: ContentItem[];
  personalizedRows: Array<{ id: string; title: string; subtitle?: string; items: ContentItem[] }>;
  featuredSelection?: any;
  myList: string[];
  favorites: string[];
  onSelectContent: (item: ContentItem) => void;
  onPlayClick?: (item: ContentItem) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  onSelectCategoryFilter?: (category: 'all' | 'movies' | 'series' | 'animes' | 'featured') => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  heroItems,
  allContent,
  trendingItems,
  personalizedRows,
  featuredSelection,
  myList,
  favorites,
  onSelectContent,
  onPlayClick,
  onToggleList,
  onSelectCategoryFilter
}) => {
  const [continueWatchingItems, setContinueWatchingItems] = useState<ContentItem[]>([]);

  // Carrega e assina atualizações de Continuar Assistindo
  useEffect(() => {
    let isMounted = true;

    const loadProgress = async () => {
      try {
        const progressList = await storageService.getContinueWatching();
        if (!isMounted) return;

        const inProgress = progressList
          .filter(p => p.percentage < 95 && p.currentTime > 5)
          .map(p => p.item)
          .filter(item => item && item.id);

        const eligible = catalogEligibilityService.filterEligibleItemsSync(
          deduplicateContentItems(inProgress)
        );

        setContinueWatchingItems(eligible);
      } catch {}
    };

    loadProgress();

    // Event listener para atualizações de progresso
    const handleProgressUpdate = () => {
      loadProgress();
    };

    window.addEventListener('zapitv_progress_updated', handleProgressUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('zapitv_progress_updated', handleProgressUpdate);
    };
  }, []);

  // Top 10 Filmes do Mês para o carrossel de ranking na Home
  const top10Movies = (featuredSelection?.featuredMovies || trendingItems.slice(0, 10))
    .slice(0, 10)
    .map((item: ContentItem, idx: number) => ({ item, rank: idx + 1 }));

  return (
    <div className="pb-28">
      {/* 1. Banner Principal Mobile (Começa no topo absoluto da viewport sob o header) */}
      <MobileHero
        featuredItems={heroItems}
        myList={myList}
        onPlayClick={onPlayClick}
        onActionClick={onSelectContent}
        onToggleList={onToggleList}
      />

      {/* 2. Continuar Assistindo (quando houver histórico) */}
      {continueWatchingItems.length > 0 && (
        <MobileContentRow
          title="Continuar Assistindo"
          items={continueWatchingItems}
          onItemClick={onSelectContent}
          showProgress={true}
        />
      )}

      {/* 5. Em Alta (Trending) */}
      {trendingItems.length > 0 && (
        <MobileContentRow
          title="Em Alta Agora"
          items={trendingItems.slice(0, 15)}
          onItemClick={onSelectContent}
        />
      )}

      {/* 6. Top 10 do Mês (com números gigantes) */}
      {top10Movies.length > 0 && (
        <MobileRankedRow
          title="Top 10 do Mês"
          items={top10Movies}
          onItemClick={onSelectContent}
          icon={Flame}
        />
      )}

      {/* 7. Recomendados para Você & 8. Demais Carrosséis Relevantes */}
      {personalizedRows.map(row => (
        <MobileContentRow
          key={`mobile-rec-${row.id}`}
          title={row.title}
          items={row.items}
          onItemClick={onSelectContent}
        />
      ))}
    </div>
  );
};
