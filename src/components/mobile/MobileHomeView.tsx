import React, { useState, useEffect, useMemo } from 'react';
import { ContentItem } from '../../../types';
import { MobileHero } from './MobileHero';
import { MobileContentRow } from './MobileContentRow';
import { storageService } from '../../core/storage/storageService';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { resolveContinueWatchingItems } from '../../core/storage/watchState';

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
    let request = 0;
    let visibleScope = storageService.getScope();

    const loadProgress = async () => {
      const currentRequest = ++request;
      const scope = storageService.getScope();
      if (scope !== visibleScope) {
        visibleScope = scope;
        setContinueWatchingItems([]);
      }
      try {
        const progressList = await storageService.getContinueWatching();
        if (!isMounted || currentRequest !== request || storageService.getScope() !== scope) return;

        // updatedAt replaces legacy lastWatched ordering. Recommendation rows only supply metadata.
        const catalog = [...allContent, ...(personalizedRows || []).flatMap(row => row.items)];
        const inProgress = resolveContinueWatchingItems(progressList || [], catalog);

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
  }, [allContent, personalizedRows]);

  // Recomendações antigas não podem inserir itens de outro perfil nesta fileira.
  const consolidatedContinueWatching = useMemo(() => {
    const deduped = deduplicateContentItems(continueWatchingItems);
    return catalogEligibilityService.filterEligibleItemsSync(deduped);
  }, [continueWatchingItems]);

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
