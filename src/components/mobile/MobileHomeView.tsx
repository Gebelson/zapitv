import React, { useState, useEffect } from 'react';
import { Film, Tv, Flame, Sparkles, Layers } from 'lucide-react';
import { ContentItem } from '../../../types';
import { MobileHero } from './MobileHero';
import { MobileContentRow } from './MobileContentRow';
import { MobileRankedRow } from './MobileRankedRow';
import { storageService, WatchProgress } from '../../core/storage/storageService';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { uiSoundService } from '../../core/audio/uiSoundService';

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
  onSelectCategoryFilter: (category: 'all' | 'movies' | 'series' | 'animes' | 'featured') => void;
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

  const quickFilterChips: Array<{
    id: 'all' | 'movies' | 'series' | 'animes' | 'featured';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'all', label: 'Todos', icon: Layers },
    { id: 'movies', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Tv },
    { id: 'animes', label: 'Animes', icon: Sparkles },
    { id: 'featured', label: 'Em Destaque', icon: Flame }
  ];

  // Top 10 Filmes do Mês para o carrossel de ranking na Home
  const top10Movies = (featuredSelection?.featuredMovies || trendingItems.slice(0, 10))
    .slice(0, 10)
    .map((item: ContentItem, idx: number) => ({ item, rank: idx + 1 }));

  return (
    <div className="pb-28">
      {/* 2. Filtros rápidos de categoria no topo (Abaixo do header) */}
      <div className="pt-16 pb-2 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar select-none z-20 relative">
        {quickFilterChips.map(chip => (
          <button
            key={chip.id}
            type="button"
            onClick={() => {
              uiSoundService.play('click');
              onSelectCategoryFilter(chip.id);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 active:bg-[#007df7] active:text-white border border-white/10 text-slate-200 text-xs font-semibold shrink-0 transition-all cursor-pointer backdrop-blur-md"
          >
            <chip.icon className="w-3.5 h-3.5 text-[#007df7]" />
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* 3. Banner Principal Mobile */}
      <MobileHero
        featuredItems={heroItems}
        myList={myList}
        onPlayClick={onPlayClick}
        onActionClick={onSelectContent}
        onToggleList={onToggleList}
      />

      {/* 4. Continuar Assistindo (quando houver histórico) */}
      {continueWatchingItems.length > 0 && (
        <MobileContentRow
          title="Continuar Assistindo"
          subtitle="Retome de onde você parou"
          items={continueWatchingItems}
          onItemClick={onSelectContent}
          showProgress={true}
        />
      )}

      {/* 5. Em Alta (Trending) */}
      {trendingItems.length > 0 && (
        <MobileContentRow
          title="Em Alta Agora"
          subtitle="Os mais buscados e assistidos na ZapiTV"
          items={trendingItems.slice(0, 15)}
          onItemClick={onSelectContent}
        />
      )}

      {/* 6. Top 10 do Mês (com números gigantes) */}
      {top10Movies.length > 0 && (
        <MobileRankedRow
          title="Top 10 do Mês"
          subtitle="Classificação mensal consolidada"
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
          subtitle={row.subtitle}
          items={row.items}
          onItemClick={onSelectContent}
        />
      ))}
    </div>
  );
};
