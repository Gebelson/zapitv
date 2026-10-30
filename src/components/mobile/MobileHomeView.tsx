import React, { useMemo } from 'react';
import { ContentItem } from '../../../types';
import { MobileHero } from './MobileHero';
import { MobileContentRow } from './MobileContentRow';
import { useProfileContinuity } from '../../core/storage/useProfileContinuity';

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
  const continuity = useProfileContinuity(allContent);
  const consolidatedContinueWatching = continuity.continueWatching;

  return (
    <div className="pb-28" aria-busy={continuity.loading}>
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
