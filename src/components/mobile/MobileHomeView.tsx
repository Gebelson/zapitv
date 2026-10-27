import React, { useState, useEffect, useMemo } from 'react';
import { ContentItem } from '../../../types';
import { MobileHero } from './MobileHero';
import { MobileContentRow } from './MobileContentRow';
import { storageService } from '../../core/storage/storageService';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';

interface MobileHomeViewProps {
  heroItems: ContentItem[];
  allContent: ContentItem[];
  trendingItems: ContentItem[];
  personalizedRows: Array<{ id: string; title: string; subtitle?: string; items: ContentItem[]; reasonType?: string }>;
  featuredSelection?: any;
  myList: string[];
  favorites: string[];
  onSelectContent: (item: ContentItem) => void;
  onPlayClick?: (item: ContentItem) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  onSelectCategoryFilter?: (category: 'all' | 'movies' | 'series' | 'animes' | 'featured') => void;
}

// Identifica se uma fileira representa "Continuar Assistindo"
const isContinueWatchingRow = (row: { id?: string; title?: string; reasonType?: string }): boolean => {
  const id = (row.id || '').toLowerCase().trim();
  const title = (row.title || '').toLowerCase().trim();
  const reason = (row.reasonType || '').toLowerCase().trim();
  return (
    id === 'continue_watching' ||
    id === 'continuar_assistindo' ||
    reason === 'continue_watching' ||
    title === 'continuar assistindo' ||
    title === 'continue watching'
  );
};

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

  // Carrega e assina atualizações de Continuar Assistindo do storageService
  useEffect(() => {
    let isMounted = true;

    const loadProgress = async () => {
      try {
        const progressList = await storageService.getContinueWatching();
        if (!isMounted) return;

        const getTimestamp = (p: any): number => {
          if (p?.updatedAt) {
            const time = new Date(p.updatedAt).getTime();
            if (!isNaN(time)) return time;
          }
          if (typeof p?.lastWatched === 'number') return p.lastWatched;
          return 0;
        };

        const inProgress = (progressList || [])
          .filter(p => p && p.item && p.item.id && (p.percentage === undefined || p.percentage < 95) && (p.currentTime === undefined || p.currentTime > 5))
          .sort((a, b) => getTimestamp(b) - getTimestamp(a))
          .map(p => p.item);

        const eligible = catalogEligibilityService.filterEligibleItemsSync(
          deduplicateContentItems(inProgress)
        );

        setContinueWatchingItems(eligible);
      } catch {}
    };

    loadProgress();

    // Event listener para atualizações assíncronas de progresso
    const handleProgressUpdate = () => {
      loadProgress();
    };

    window.addEventListener('zapitv_progress_updated', handleProgressUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('zapitv_progress_updated', handleProgressUpdate);
    };
  }, []);

  // Consolidação única dos itens de Continuar Assistindo:
  // Unifica os itens em andamento do storageService (com ordenação recente por atividade)
  // com eventuais itens em andamento recebidos via personalizedRows,
  // eliminando duplicações na origem e preservando o progresso e episódios.
  const consolidatedContinueWatching = useMemo(() => {
    const dynamicCwRow = (personalizedRows || []).find(isContinueWatchingRow);
    const dynamicItems = dynamicCwRow?.items || [];

    const combined = [...continueWatchingItems, ...dynamicItems];
    const deduped = deduplicateContentItems(combined);
    return catalogEligibilityService.filterEligibleItemsSync(deduped);
  }, [continueWatchingItems, personalizedRows]);

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

      {/* 2. Continuar Assistindo Único (Renderização única consolidada, com barras de progresso) */}
      {consolidatedContinueWatching.length > 0 && (
        <MobileContentRow
          title="Continuar Assistindo"
          items={consolidatedContinueWatching}
          onItemClick={onSelectContent}
          showProgress={true}
        />
      )}

      {/* 3. Em Alta (Trending) */}
      {trendingItems.length > 0 && (
        <MobileContentRow
          title="Em Alta Agora"
          items={trendingItems.slice(0, 15)}
          onItemClick={onSelectContent}
        />
      )}

      {/* 4. Carrosséis Personalizados e Editoriais (Sem duplicar Continuar Assistindo na origem) */}
      {personalizedRows.map(row => {
        if (isContinueWatchingRow(row)) return null;
        return (
          <MobileContentRow
            key={`mobile-rec-${row.id}`}
            title={row.title}
            items={row.items}
            onItemClick={onSelectContent}
          />
        );
      })}
    </div>
  );
};
