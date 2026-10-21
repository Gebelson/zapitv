import React, { memo, useMemo, useCallback } from 'react';
import { ContentItem } from '../../../types';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvCategoryViewProps {
  categoryTitle: string;
  items: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onPlayItem: (item: ContentItem) => void;
}

export const TvCategoryView: React.FC<TvCategoryViewProps> = memo(({
  categoryTitle,
  items,
  onSelectItem,
  onPlayItem
}) => {
  const heroItem = useMemo(() => items[0] || null, [items]);

  // Agrupa os itens por gêneros populares dentro da categoria
  const genreRows = useMemo(() => {
    if (!items || items.length === 0) return [];

    const genresMap = new Map<string, ContentItem[]>();
    items.forEach(item => {
      const gList = item.genres || [];
      gList.forEach(genre => {
        if (!genresMap.has(genre)) {
          genresMap.set(genre, []);
        }
        genresMap.get(genre)!.push(item);
      });
    });

    const list: { genre: string; items: ContentItem[] }[] = [];
    genresMap.forEach((genreItems, genre) => {
      if (genreItems.length >= 3) {
        list.push({ genre, items: genreItems });
      }
    });

    return list.sort((a, b) => b.items.length - a.items.length).slice(0, 8);
  }, [items]);

  const firstCardKey = useMemo(() => {
    if (items.length > 0) {
      return `card-all-${categoryTitle.toLowerCase()}-${items[0].id}`;
    }
    return '';
  }, [items, categoryTitle]);

  const handleHeroDownPress = useCallback(() => {
    if (firstCardKey) {
      setFocus(firstCardKey);
    } else {
      setFocus(`row-all-${categoryTitle.toLowerCase()}`);
    }
  }, [firstCardKey, categoryTitle]);

  const handleFirstRowUpPress = useCallback(() => {
    setFocus('tv-hero-play');
  }, []);

  return (
    <div className="w-full min-h-screen pb-24 overflow-x-hidden">
      {/* Banner Principal da Categoria */}
      {heroItem && (
        <TvHeroBanner
          item={heroItem}
          onPlay={onPlayItem}
          onOpenDetails={onSelectItem}
          onDownPress={handleHeroDownPress}
        />
      )}

      {/* Fileiras de Conteúdos da Categoria com Capas Verticais 2:3 */}
      <div className="relative z-10 -mt-14 sm:-mt-18 space-y-4">
        {/* Todos os Títulos Mais Populares */}
        <TvContentRow
          title={`Todos os ${categoryTitle} Populares`}
          rowId={`all-${categoryTitle.toLowerCase()}`}
          items={items.slice(0, 20)}
          onItemClick={onSelectItem}
          onRowUp={handleFirstRowUpPress}
        />

        {/* Linhas Agrupadas por Gênero */}
        {genreRows.map(({ genre, items: gItems }) => (
          <TvContentRow
            key={`genre-${genre}`}
            title={`${categoryTitle} de ${genre}`}
            rowId={`genre-${genre.toLowerCase()}`}
            items={gItems}
            onItemClick={onSelectItem}
          />
        ))}
      </div>
    </div>
  );
});

TvCategoryView.displayName = 'TvCategoryView';
