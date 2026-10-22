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
  const heroSlides = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.slice(0, 6);
  }, [items]);

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

  const firstRowKey = `row-all-${categoryTitle.toLowerCase()}`;

  const handleHeroDownPress = useCallback(() => {
    setFocus(firstRowKey);
    const el = document.getElementById(firstRowKey) || document.querySelector(`[data-focus-key="${firstRowKey}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [firstRowKey]);

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

  return (
    <div className="w-full min-h-screen pb-24 overflow-x-hidden">
      {/* Banner Principal da Categoria (100% da primeira viewport com multi-destaques) */}
      {heroSlides.length > 0 && (
        <TvHeroBanner
          items={heroSlides}
          onPlay={onPlayItem}
          onOpenDetails={onSelectItem}
          onDownPress={handleHeroDownPress}
        />
      )}

      {/* Fileiras de Conteúdos da Categoria: Exclusivamente abaixo da primeira viewport */}
      <div className="relative z-10 pt-8 sm:pt-12 pb-28 space-y-6 sm:space-y-10">
        {/* Todos os Títulos Mais Populares */}
        <TvContentRow
          title={`Todos os ${categoryTitle} Populares`}
          rowId={`all-${categoryTitle.toLowerCase()}`}
          items={items}
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
