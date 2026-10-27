import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { ContentItem } from '../../../types';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';
import { animeEditorialService } from '../../core/anime/animeEditorialService';
import { searchService } from '../../core/search/searchService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvAnimeViewProps {
  items: ContentItem[];
  allContent?: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onPlayItem: (item: ContentItem) => void;
  suspended?: boolean;
  upFocusKey?: string;
  onLoadMore?: () => void;
}

export const TvAnimeView: React.FC<TvAnimeViewProps> = memo(({
  items,
  allContent,
  onSelectItem,
  onPlayItem,
  suspended = false,
  upFocusKey,
  onLoadMore
}) => {
  // Unifica e valida todos os animes elegíveis disponíveis no catálogo da ZapiTV
  const availableAnimes = useMemo(() => {
    const pool = [
      ...(items || []),
      ...(allContent || []).filter(item => searchService.isAnimeItem(item))
    ];
    return deduplicateContentItems(pool);
  }, [items, allContent]);

  // Carrosséis editoriais organizados no padrão Crunchyroll Brasil
  const editorialCategories = useMemo(() => {
    return animeEditorialService.getEditorialCategories(availableAnimes);
  }, [availableAnimes]);
  const hasUnlistedItems = useMemo(() => {
    const listed = new Set(editorialCategories.flatMap(category => category.items.map(item => item.id)));
    return availableAnimes.some(item => !listed.has(item.id));
  }, [availableAnimes, editorialCategories]);

  // Destaques principais para o Hero Banner automático (top 6 títulos da curadoria)
  const heroSlides = useMemo(() => {
    if (editorialCategories.length > 0 && editorialCategories[0].items.length > 0) {
      // Prioriza simulcasts da temporada ou animes mais populares
      const topPicks = [
        ...editorialCategories[0].items,
        ...(editorialCategories[1]?.items || [])
      ];
      return deduplicateContentItems(topPicks).slice(0, 6);
    }
    return availableAnimes.slice(0, 6);
  }, [editorialCategories, availableAnimes]);

  const firstRowKey = editorialCategories.length > 0
    ? `row-${editorialCategories[0].id}`
    : 'row-anime-all-fallback';

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
      {/* Banner Principal da Categoria Anime com rotação automática e crossfade */}
      {heroSlides.length > 0 && (
        <TvHeroBanner
          items={heroSlides}
          onPlay={onPlayItem}
          onOpenDetails={onSelectItem}
          onDownPress={handleHeroDownPress}
          suspended={suspended}
          upFocusKey={upFocusKey || 'tv-nav-animes'}
        />
      )}

      {/* Fileiras de Animes inspiradas na Crunchyroll Brasil */}
      <div className="relative z-10 pt-8 sm:pt-12 pb-28 space-y-6 sm:space-y-10">
        {editorialCategories.map((category, idx) => (
          <TvContentRow
            key={category.id}
            title={category.title}
            rowId={category.id}
            items={category.items}
            onNearEnd={onLoadMore}
            onItemClick={onSelectItem}
            onRowUp={idx === 0 ? handleFirstRowUpPress : undefined}
          />
        ))}

        {(editorialCategories.length === 0 || hasUnlistedItems) && availableAnimes.length > 0 && (
          <TvContentRow
            title="Todos os Animes Populares"
            rowId="anime-all-fallback"
            items={availableAnimes}
            onNearEnd={onLoadMore}
            onItemClick={onSelectItem}
            onRowUp={editorialCategories.length === 0 ? handleFirstRowUpPress : undefined}
          />
        )}
      </div>
    </div>
  );
});

TvAnimeView.displayName = 'TvAnimeView';
