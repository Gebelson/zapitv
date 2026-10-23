import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { ContentItem } from '../../../types';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvCategoryViewProps {
  categoryTitle: string;
  items: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onPlayItem: (item: ContentItem) => void;
  suspended?: boolean;
  upFocusKey?: string;
}

export const TvCategoryView: React.FC<TvCategoryViewProps> = memo(({
  categoryTitle,
  items,
  onSelectItem,
  onPlayItem,
  suspended = false,
  upFocusKey
}) => {
  const resolvedUpFocusKey = upFocusKey || (
    categoryTitle === 'Filmes' ? 'tv-nav-movies' :
    categoryTitle === 'Séries' ? 'tv-nav-series' :
    categoryTitle === 'Em Destaque' ? 'tv-nav-featured' :
    'tv-nav-home'
  );
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
  }, [firstRowKey]);

  const isScrollingToHeroRef = useRef(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      isScrollingToHeroRef.current = false;
    };
  }, []);

  const handleFirstRowUpPress = useCallback(() => {
    if (isScrollingToHeroRef.current) return;
    if (typeof window === 'undefined') {
      setFocus('tv-hero-play');
      return;
    }
    const currentScrollY = window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
    if (currentScrollY <= 2) {
      setFocus('tv-hero-play');
      return;
    }

    isScrollingToHeroRef.current = true;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }

    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }

    let finished = false;
    const finishTransition = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('scrollend', handleScrollEnd);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      setFocus('tv-hero-play');
      isScrollingToHeroRef.current = false;
    };

    const handleScrollEnd = () => finishTransition();
    window.addEventListener('scrollend', handleScrollEnd, { once: true });
    scrollTimerRef.current = setTimeout(finishTransition, 380);
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
          suspended={suspended}
          upFocusKey={resolvedUpFocusKey}
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
