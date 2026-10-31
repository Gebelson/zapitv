import { sameContent } from '../../core/storage/watchState';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, ArrowLeft, Delete, Sparkles, Trash2 } from 'lucide-react';
import { ContentItem, Profile } from '../../../types';
import { TvCard16x9 } from './TvCard16x9';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager, isRemoteConfirmEvent } from '../../core/tv/tvNavigationManager';
import { searchService, SearchCategory } from '../../core/search/searchService';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { useTvViewport } from '../../core/tv/tvViewportService';
import { tvPerformanceService } from '../../core/tv/tvPerformanceService';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvSearchViewProps {
  activeProfile?: Profile | null;
  allContent: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onClose: () => void;
}

/**
 * Normaliza textos removendo acentuação e caracteres especiais para busca fonética e semântica segura
 */
export function normalizeSearchTerm(str?: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Teclado Virtual em Grid 6 Colunas (A-Z, 0-9)
 */
const KEYBOARD_GRID: string[][] = [
  ['a', 'b', 'c', 'd', 'e', 'f'],
  ['g', 'h', 'i', 'j', 'k', 'l'],
  ['m', 'n', 'o', 'p', 'q', 'r'],
  ['s', 't', 'u', 'v', 'w', 'x'],
  ['y', 'z', '1', '2', '3', '4'],
  ['5', '6', '7', '8', '9', '0']
];

/**
 * Categorias Canônicas de Filtro
 */
const CATEGORIES: { id: SearchCategory; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'movies', label: 'Filmes' },
  { id: 'series', label: 'Séries' },
  { id: 'animes', label: 'Animes' }
];

/**
 * Componente de Tecla Individual com Foco Espacial
 */
interface TvVirtualKeyProps {
  char: string;
  displayLabel?: React.ReactNode;
  onPress: (char: string) => void;
  className?: string;
  focusKey: string;
  style?: React.CSSProperties;
  isFireTv?: boolean;
  onArrowRightFromEdge?: () => void;
  ariaLabel?: string;
}

const TvVirtualKey: React.FC<TvVirtualKeyProps> = ({
  char,
  displayLabel,
  onPress,
  className = '',
  focusKey,
  style,
  isFireTv = false,
  onArrowRightFromEdge,
  ariaLabel
}) => {
  const lastPressTimeRef = useRef<number>(0);

  const handlePress = useCallback(() => {
    const now = performance.now();
    // Previne duplo acionamento acidental (onEnterPress + click do botão no mesmo instante)
    if (now - lastPressTimeRef.current < 150) return;
    lastPressTimeRef.current = now;
    onPress(char);
  }, [char, onPress]);

  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: handlePress,
    onArrowPress: (direction) => {
      if (direction === 'right' && onArrowRightFromEdge) {
        onArrowRightFromEdge();
        return false;
      }
      return true;
    }
  });

  return (
    <button
      ref={ref as any}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      aria-label={ariaLabel}
      onClick={handlePress}
      style={{ ...style, minHeight: style?.height }}
      className={`select-none ${isFireTv ? 'rounded-lg' : 'rounded-xl'} font-bold flex items-center justify-center transition-all duration-150 outline-none cursor-pointer ${
        focused
          ? 'border-2 border-cyan-400 bg-cyan-500/35 text-white shadow-[0_0_18px_rgba(0,229,255,0.7)] scale-105 z-20'
          : 'border border-white/10 bg-white/5 text-gray-200 hover:bg-white/15 hover:text-white'
      } ${className}`}
    >
      {displayLabel || char}
    </button>
  );
};

/**
 * Componente de Aba de Categoria com Foco Espacial
 */
interface TvFilterTabProps {
  id: SearchCategory;
  label: string;
  isActive: boolean;
  scaleCategory?: string;
  isFireTv?: boolean;
  onSelect: (id: SearchCategory) => void;
  onArrowLeftEdge?: () => void;
}

const TvFilterTab: React.FC<TvFilterTabProps> = ({
  id,
  label,
  isActive,
  scaleCategory,
  isFireTv = false,
  onSelect,
  onArrowLeftEdge
}) => {
  const { ref, focused } = useTvFocusable({
    focusKey: `tv-filter-${id}`,
    onEnterPress: () => onSelect(id),
    onArrowPress: (direction) => {
      if (direction === 'left' && onArrowLeftEdge) {
        onArrowLeftEdge();
        return false;
      }
      return true;
    }
  });

  const sizeClasses = isFireTv
    ? (scaleCategory === 'compact' ? 'px-2.5 py-1 text-[11px] rounded-lg' : scaleCategory === 'standard' ? 'px-3.5 py-1.5 text-xs rounded-lg' : 'px-4 py-1.5 text-sm rounded-lg')
    : (scaleCategory === 'compact' ? 'px-3 py-1.5 text-xs rounded-lg' : 'px-5 py-2 text-base rounded-xl');

  return (
    <button
      ref={ref as any}
      type="button"
      data-focus-key={`tv-filter-${id}`}
      data-tv-focused={focused ? "true" : undefined}
      data-tv-active={isActive ? "true" : undefined}
      onClick={() => onSelect(id)}
      className={`${sizeClasses} font-bold transition-all duration-150 outline-none cursor-pointer ${
        focused
          ? 'border-2 border-cyan-400 bg-cyan-500/35 text-white shadow-[0_0_20px_rgba(0,229,255,0.7)] scale-105 z-20'
          : isActive
          ? 'border border-cyan-400/70 bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.3)]'
          : 'border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
};

/**
 * Item de Sugestão de Pesquisa com Foco Espacial
 */
interface TvSearchSuggestionItemProps {
  text: string;
  index: number;
  isFireTv?: boolean;
  onSelect: (text: string) => void;
  onArrowRightEdge?: () => void;
}

const TvSearchSuggestionItem: React.FC<TvSearchSuggestionItemProps> = ({
  text,
  index,
  isFireTv = false,
  onSelect,
  onArrowRightEdge
}) => {
  const { ref, focused } = useTvFocusable({
    focusKey: `tv-suggest-${index}`,
    onEnterPress: () => onSelect(text),
    onArrowPress: (direction) => {
      if (direction === 'right' && onArrowRightEdge) {
        onArrowRightEdge();
        return false;
      }
      return true;
    }
  });

  return (
    <button
      ref={ref as any}
      type="button"
      data-focus-key={`tv-suggest-${index}`}
      data-tv-focused={focused ? "true" : undefined}
      onClick={() => onSelect(text)}
      className={`w-full text-left ${
        isFireTv ? 'px-2.5 py-1.5 rounded-lg text-xs' : 'px-3.5 py-2.5 rounded-xl text-sm'
      } transition-all duration-150 flex items-center justify-between outline-none cursor-pointer ${
        focused
          ? `border-2 border-cyan-400 bg-cyan-500/25 text-white font-bold shadow-[0_0_16px_rgba(0,229,255,0.5)] scale-102 ${isFireTv ? 'pl-3' : 'pl-4'} z-10`
          : 'border border-transparent text-gray-300 hover:text-white hover:bg-white/10'
      }`}
    >
      <span className="truncate">{text}</span>
      <span className={`${isFireTv ? 'text-[10px]' : 'text-xs'} ml-2 ${focused ? 'text-cyan-400 font-bold' : 'text-gray-500'}`}>➔</span>
    </button>
  );
};

let cachedContentRef: ContentItem[] | null = null;
let cachedSearchableIndex: any[] = [];

export const TvSearchView: React.FC<TvSearchViewProps> = ({
  activeProfile,
  allContent,
  onSelectItem,
  onClose
}) => {
  const viewport = useTvViewport();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const resultsSentinelRef = useRef<HTMLDivElement>(null);
  const isFireTv = viewport.isFireTv || tvPerformanceService.isFireTv();
  const initialBatch = isFireTv ? 18 : 48;
  const incrementBatch = isFireTv ? 12 : 48;
  const [visibleCount, setVisibleCount] = useState(initialBatch);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-search-screen',
    trackChildren: true
  });

  // Botão Voltar no topo da coluna esquerda
  const { ref: backRef, focused: isBackFocused } = useTvFocusable({
    focusKey: 'tv-search-back',
    onEnterPress: () => {
      uiSoundService.play('close');
      onClose();
    }
  });

  // Campo de exibição do termo digitado
  const { ref: inputFocusRef, focused: isInputFocused } = useTvFocusable({
    focusKey: 'tv-search-input',
    onEnterPress: () => {
      setFocus('tv-key-a');
    }
  });

  // Registra manipulador do botão Voltar da Smart TV (prioridade 100)
  useEffect(() => {
    const unregister = tvNavigationManager.registerBackHandler('tv-search-screen', 100, () => {
      uiSoundService.play('close');
      onClose();
      return true;
    });

    const timer = setTimeout(() => {
      setFocus('tv-key-a');
    }, 80);

    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [onClose]);

  // Manipulador de digitação física (teclado físico / controle remoto alfanumérico)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Eventos reais de confirmação do controle remoto (Enter/OK) não inserem texto
      if (isRemoteConfirmEvent(e)) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        uiSoundService.play('click');
        setQuery(prev => prev.slice(0, -1));
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        uiSoundService.play('close');
        onClose();
        return;
      }

      if (e.key.length === 1 && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) {
        uiSoundService.play('click');
        setQuery(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Teclado virtual: manipulação de teclas
  const lastVirtualKeyPressRef = useRef<number>(0);
  const handleVirtualKeyPress = useCallback((char: string) => {
    const now = performance.now();
    if (now - lastVirtualKeyPressRef.current < 100) return;
    lastVirtualKeyPressRef.current = now;

    if (char === 'BACKSPACE') {
      uiSoundService.play('click');
      setQuery(prev => prev.slice(0, -1));
    } else if (char === 'CLEAR') {
      uiSoundService.play('close');
      setQuery('');
    } else {
      uiSoundService.play('click');
      setQuery(prev => prev + char);
    }
  }, []);

  // Índice memoizado com cache em nível de módulo para abertura instantânea e 0ms de bloqueio
  const searchableIndex = useMemo(() => {
    if (cachedContentRef === allContent && cachedSearchableIndex.length > 0) {
      return cachedSearchableIndex;
    }
    cachedContentRef = allContent;
    cachedSearchableIndex = (allContent || []).map(item => {
      const titleNorm = normalizeSearchTerm(item.title);
      const originalTitleNorm = normalizeSearchTerm(item.originalTitle);
      const genresNorm = (item.genres || []).map(g => normalizeSearchTerm(g));
      const castNorm = (item.cast || (item as any).actors || []).map((a: any) =>
        normalizeSearchTerm(typeof a === 'string' ? a : a?.name)
      );
      const directorNorm = normalizeSearchTerm(item.director);
      const combinedBlob = `${titleNorm} ${originalTitleNorm} ${genresNorm.join(' ')} ${castNorm.join(' ')} ${directorNorm}`.trim();

      return {
        item,
        titleNorm,
        originalTitleNorm,
        genresNorm,
        castNorm,
        directorNorm,
        combinedBlob
      };
    });
    return cachedSearchableIndex;
  }, [allContent]);

  // Filtragem multi-campo, sem acento, case-insensitive, múltiplas palavras e por categoria
  const localResults = useMemo(() => {
    const normQuery = normalizeSearchTerm(query);
    const tokens = normQuery.split(' ').filter(Boolean);

    // Se nenhum termo estiver digitado, apresenta os títulos mais populares da categoria
    if (tokens.length === 0) {
      return (allContent || []).filter(item => {
        if (selectedCategory === 'movies') return searchService.isMovieItem(item);
        if (selectedCategory === 'series') return searchService.isSeriesItem(item);
        if (selectedCategory === 'animes') return searchService.isAnimeItem(item);
        return true;
      });
    }

    const scored: { item: ContentItem; score: number }[] = [];

    for (const entry of searchableIndex) {
      // Filtro canônico de categoria
      if (selectedCategory === 'movies' && !searchService.isMovieItem(entry.item)) continue;
      if (selectedCategory === 'series' && !searchService.isSeriesItem(entry.item)) continue;
      if (selectedCategory === 'animes' && !searchService.isAnimeItem(entry.item)) continue;

      // Todos os tokens digitados precisam casar em algum dos campos do item (título, original, gênero, elenco, diretor)
      const allTokensMatch = tokens.every(tok => entry.combinedBlob.includes(tok));
      if (!allTokensMatch) continue;

      let score = 0;

      // 1. Título principal
      if (entry.titleNorm === normQuery) {
        score += 1000;
      } else if (entry.titleNorm.startsWith(normQuery)) {
        score += 500;
      } else if (entry.titleNorm.includes(normQuery)) {
        score += 300;
      }

      // 2. Título original
      if (entry.originalTitleNorm === normQuery) {
        score += 400;
      } else if (entry.originalTitleNorm.startsWith(normQuery)) {
        score += 250;
      } else if (entry.originalTitleNorm.includes(normQuery)) {
        score += 150;
      }

      // 3. Gênero
      if (entry.genresNorm.some(g => g === normQuery)) {
        score += 200;
      } else if (entry.genresNorm.some(g => g.includes(normQuery))) {
        score += 100;
      }

      // 4. Elenco / Ator
      if (entry.castNorm.some(c => c === normQuery)) {
        score += 180;
      } else if (entry.castNorm.some(c => c.includes(normQuery))) {
        score += 90;
      }

      // 5. Peso de avaliação e popularidade
      score += (entry.item.rating || 0) * 5;
      if (entry.item.popularity) {
        score += Math.min(25, entry.item.popularity / 4);
      }

      scored.push({ item: entry.item, score });
    }

    // Ordenação sem truncamento por slice arbitrário
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
  }, [query, selectedCategory, allContent, searchableIndex]);

  const [remoteResults, setRemoteResults] = useState<{ query: string; category: SearchCategory; profileId?: string; items: ContentItem[] } | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) return;
      const publish = (items: ContentItem[]) => { if (active) setRemoteResults({ query, category: selectedCategory, profileId: activeProfile?.id, items }); };
      void searchService.search(query, selectedCategory, allContent, activeProfile, publish).then(publish);
    }, 300);
    return () => { active = false; clearTimeout(timer); searchService.cancelPageSearch(); };
  }, [query, selectedCategory, allContent, activeProfile]);
  const searchResults = useMemo(() => {
    if (!remoteResults || remoteResults.query !== query || remoteResults.category !== selectedCategory || remoteResults.profileId !== activeProfile?.id) return localResults;
    return [...localResults, ...remoteResults.items].filter((item,index,items)=>!items.slice(0,index).some(previous=>sameContent(previous,item)));
  }, [localResults, remoteResults, query, selectedCategory, activeProfile?.id]);

  useEffect(() => {
    setVisibleCount(initialBatch);
    if (resultsContainerRef.current) resultsContainerRef.current.scrollTop = 0;
  }, [query, selectedCategory, initialBatch]);

  useEffect(() => {
    const root = resultsContainerRef.current;
    const sentinel = resultsSentinelRef.current;
    if (!root || !sentinel || visibleCount >= searchResults.length) return;
    if (typeof IntersectionObserver === 'undefined') {
      const loadOnScroll = () => {
        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 600) {
          setVisibleCount(count => Math.min(searchResults.length, count + incrementBatch));
        }
      };
      root.addEventListener('scroll', loadOnScroll, { passive: true });
      return () => root.removeEventListener('scroll', loadOnScroll);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount(count => Math.min(searchResults.length, count + incrementBatch));
      }
    }, { root, rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, searchResults, incrementBatch]);

  const handleCardFocus = useCallback((index: number) => {
    const threshold = isFireTv ? 6 : 12;
    if (index >= visibleCount - threshold) {
      setVisibleCount(count => Math.min(searchResults.length, count + incrementBatch));
    }
  }, [visibleCount, searchResults.length, isFireTv, incrementBatch]);

  // Lista dinâmica de sugestões baseada no catálogo e termo digitado
  const suggestions = useMemo(() => {
    const normQuery = normalizeSearchTerm(query);
    if (!normQuery) {
      return [
        'Ação',
        'Comédia',
        'Ficção Científica',
        'Anime',
        'Terror',
        'Drama',
        'Aventura',
        'Romance'
      ];
    }

    const set = new Set<string>();

    // 1. Títulos que iniciam com o termo
    for (const entry of searchableIndex) {
      if (entry.titleNorm.startsWith(normQuery) && entry.item.title) {
        set.add(entry.item.title.trim());
        if (set.size >= 8) break;
      }
    }

    // 2. Atores que contêm o termo
    if (set.size < 8) {
      for (const entry of searchableIndex) {
        for (const rawCast of entry.item.cast || (entry.item as any).actors || []) {
          const actorName = typeof rawCast === 'string' ? rawCast : rawCast?.name;
          if (actorName && normalizeSearchTerm(actorName).includes(normQuery)) {
            set.add(actorName.trim());
            if (set.size >= 8) break;
          }
        }
        if (set.size >= 8) break;
      }
    }

    // 3. Gêneros que contêm o termo
    if (set.size < 8) {
      for (const entry of searchableIndex) {
        for (const genre of entry.item.genres || []) {
          if (genre && normalizeSearchTerm(genre).includes(normQuery)) {
            set.add(genre.trim());
            if (set.size >= 8) break;
          }
        }
        if (set.size >= 8) break;
      }
    }

    // 4. Títulos que contêm o termo em qualquer parte
    if (set.size < 8) {
      for (const entry of searchableIndex) {
        if (entry.titleNorm.includes(normQuery) && entry.item.title) {
          set.add(entry.item.title.trim());
          if (set.size >= 8) break;
        }
      }
    }

    return Array.from(set).slice(0, 8);
  }, [query, searchableIndex]);

  // Transição espacial da borda direita do teclado para o painel de resultados
  const handleJumpToResults = useCallback(() => {
    if (searchResults.length > 0) {
      setFocus(`tv-search-card-${searchResults[0].id}`);
    } else {
      setFocus(`tv-filter-${selectedCategory}`);
    }
  }, [searchResults, selectedCategory]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div 
        ref={noriginRef as any}
        className="w-full h-screen max-h-screen flex flex-row bg-[#05070a] text-white overflow-hidden select-none"
      >
        {/* ========================================================= */}
        {/* COLUNA ESQUERDA: Voltar, Input, Teclado Virtual, Sugestões */}
        {/* ========================================================= */}
        <div 
          style={{ width: `${viewport.searchSidebarWidth}px` }} 
          className={`flex-shrink-0 h-full flex flex-col border-r border-white/10 bg-[#070b13]/95 backdrop-blur-xl overflow-y-auto z-20 shadow-2xl ${
            isFireTv
              ? (viewport.scaleCategory === 'compact' ? 'p-2.5' : viewport.scaleCategory === 'standard' ? 'p-3.5' : 'p-4')
              : (viewport.scaleCategory === 'compact' ? 'p-3' : viewport.scaleCategory === 'standard' ? 'p-4 sm:p-5' : 'p-6 sm:p-7')
          }`}
        >
          {/* Botão Voltar da Tela de Busca */}
          <div className={isFireTv ? (viewport.scaleCategory === 'compact' ? 'mb-2' : 'mb-3') : (viewport.scaleCategory === 'compact' ? 'mb-2.5' : 'mb-4')}>
            <button
              ref={backRef as any}
              type="button"
              data-focus-key="tv-search-back"
              data-tv-focused={isBackFocused ? "true" : undefined}
              onClick={onClose}
              className={`w-full flex items-center justify-center gap-1.5 rounded-xl font-bold tracking-wide transition-all duration-150 outline-none cursor-pointer ${
                isFireTv
                  ? (viewport.scaleCategory === 'compact' ? 'px-2.5 py-1.5 text-[11px]' : viewport.scaleCategory === 'standard' ? 'px-3 py-2 text-xs' : 'px-3.5 py-2 text-sm')
                  : (viewport.scaleCategory === 'compact' ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-base')
              } ${
                isBackFocused
                  ? 'border-2 border-cyan-400 bg-cyan-500/30 text-white shadow-[0_0_20px_rgba(0,229,255,0.6)] scale-102 font-extrabold'
                  : 'border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ArrowLeft className={
                isFireTv
                  ? (viewport.scaleCategory === 'compact' ? "w-3 h-3 text-cyan-400" : "w-4 h-4 text-cyan-400")
                  : (viewport.scaleCategory === 'compact' ? "w-3.5 h-3.5 text-cyan-400" : "w-5 h-5 text-cyan-400")
              } />
              <span>Voltar</span>
            </button>
          </div>

          {/* Campo de Busca Visual com Texto Digitado */}
          <div className={isFireTv ? (viewport.scaleCategory === 'compact' ? 'mb-2.5' : 'mb-3.5') : (viewport.scaleCategory === 'compact' ? 'mb-3' : 'mb-5')}>
            <div
              ref={inputFocusRef}
              data-focus-key="tv-search-input"
              data-tv-focused={isInputFocused ? "true" : undefined}
              className={`flex items-center ${isFireTv ? 'gap-2' : 'gap-2.5'} bg-[#0d1422] rounded-xl border transition-all duration-200 ${
                isFireTv
                  ? (viewport.scaleCategory === 'compact' ? 'px-2.5 py-1.5' : viewport.scaleCategory === 'standard' ? 'px-3 py-2' : 'px-3.5 py-2')
                  : (viewport.scaleCategory === 'compact' ? 'px-3 py-2' : 'px-4 py-3')
              } ${
                isInputFocused
                  ? 'border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.45)] scale-101'
                  : 'border border-white/15'
              }`}
            >
              <Search className={`${
                isFireTv
                  ? (viewport.scaleCategory === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4')
                  : (viewport.scaleCategory === 'compact' ? 'w-4 h-4' : 'w-5 h-5')
              } flex-shrink-0 ${isInputFocused ? 'text-cyan-400' : 'text-gray-400'}`} />
              <div className={`flex-1 text-white font-semibold truncate flex items-center ${
                isFireTv
                  ? (viewport.scaleCategory === 'compact' ? 'text-[11px] min-h-[18px]' : 'text-xs min-h-[20px]')
                  : (viewport.scaleCategory === 'compact' ? 'text-xs min-h-[20px]' : 'text-base min-h-[24px]')
              }`}>
                {query ? (
                  <>
                    <span className="tracking-wide">{query}</span>
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 animate-pulse" />
                  </>
                ) : (
                  <span className="text-gray-500 font-normal">Digite para pesquisar...</span>
                )}
              </div>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className={isFireTv ? "w-3.5 h-3.5" : "w-4 h-4"} />
                </button>
              )}
            </div>
          </div>

          {/* Teclado Virtual Integrado */}
          <div className={isFireTv ? (viewport.scaleCategory === 'compact' ? 'mb-2.5' : 'mb-4') : (viewport.scaleCategory === 'compact' ? 'mb-3' : 'mb-6')}>
            <div className={`grid grid-cols-6 w-full ${isFireTv ? (viewport.scaleCategory === 'compact' ? 'gap-1' : 'gap-1.5') : (viewport.scaleCategory === 'compact' ? 'gap-1' : 'gap-2')}`}>
              {/* Linha de Utilidades: Espaço (3 cols), Apagar (2 cols), Limpar (1 col) */}
              <TvVirtualKey
                char=" "
                displayLabel={<span className="uppercase tracking-wider font-bold">ESPAÇO</span>}
                onPress={handleVirtualKeyPress}
                focusKey="tv-key-space"
                style={{ height: `${viewport.keyboardKeyHeight}px`, fontSize: `${Math.round(viewport.keyboardFontSize * 0.9)}px` }}
                className="col-span-3"
                isFireTv={isFireTv}
              />
              <TvVirtualKey
                char="BACKSPACE"
                displayLabel={<span className="uppercase tracking-wider font-bold">APAGAR</span>}
                onPress={handleVirtualKeyPress}
                focusKey="tv-key-backspace"
                style={{ height: `${viewport.keyboardKeyHeight}px`, fontSize: `${Math.round(viewport.keyboardFontSize * 0.9)}px` }}
                className="col-span-2"
                isFireTv={isFireTv}
              />
              <TvVirtualKey
                char="CLEAR"
                ariaLabel="Limpar pesquisa"
                displayLabel={
                  <Trash2 className={
                    isFireTv
                      ? (viewport.scaleCategory === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4')
                      : (viewport.scaleCategory === 'compact' ? 'w-4 h-4' : 'w-5 h-5')
                  } />
                }
                onPress={handleVirtualKeyPress}
                focusKey="tv-key-clear"
                style={{ height: `${viewport.keyboardKeyHeight}px`, fontSize: `${Math.round(viewport.keyboardFontSize * 0.9)}px` }}
                className="col-span-1"
                isFireTv={isFireTv}
                onArrowRightFromEdge={handleJumpToResults}
              />

              {/* Grid 6x6 de Teclas Alfanuméricas */}
              {KEYBOARD_GRID.map((row, rowIdx) =>
                row.map((k, colIdx) => {
                  const isRightEdge = colIdx === 5;
                  return (
                    <TvVirtualKey
                      key={`key-${k}`}
                      char={k}
                      onPress={handleVirtualKeyPress}
                      focusKey={`tv-key-${k}`}
                      style={{ height: `${viewport.keyboardKeyHeight}px`, fontSize: `${viewport.keyboardFontSize}px` }}
                      className="uppercase font-bold"
                      isFireTv={isFireTv}
                      onArrowRightFromEdge={isRightEdge ? handleJumpToResults : undefined}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Lista de Sugestões logo abaixo do teclado */}
          <div className={`mt-auto border-t border-white/10 ${isFireTv ? (viewport.scaleCategory === 'compact' ? 'pt-1.5' : 'pt-2') : (viewport.scaleCategory === 'compact' ? 'pt-2' : 'pt-3')}`}>
            <div className={`flex items-center gap-1.5 ${isFireTv ? 'mb-1.5 text-[10px]' : 'mb-2.5 text-xs'} font-semibold text-gray-400 uppercase tracking-wider`}>
              <Sparkles className={`${isFireTv ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-cyan-400`} />
              <span>{query ? 'Sugestões Relacionadas' : 'Categorias & Temas Populares'}</span>
            </div>
            <div className={`flex flex-col ${isFireTv ? 'gap-0.5' : 'gap-1'}`}>
              {suggestions.map((sug, idx) => (
                <TvSearchSuggestionItem
                  key={`sug-${sug}-${idx}`}
                  text={sug}
                  index={idx}
                  isFireTv={isFireTv}
                  onSelect={(text) => {
                    uiSoundService.play('click');
                    setQuery(text);
                    setFocus(`tv-filter-${selectedCategory}`);
                  }}
                  onArrowRightEdge={handleJumpToResults}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUNA DIREITA: Termo, Filtros de Categoria, Grade de Resultados */}
        {/* ========================================================= */}
        <div 
          ref={resultsContainerRef}
          className={`flex-1 h-full flex flex-col overflow-y-auto ${
            isFireTv
              ? (viewport.scaleCategory === 'compact' ? 'p-3' : viewport.scaleCategory === 'standard' ? 'p-4' : 'p-5')
              : (viewport.scaleCategory === 'compact' ? 'p-3.5 sm:p-4' : viewport.scaleCategory === 'standard' ? 'p-5 sm:p-6' : 'p-8 lg:p-10')
          }`}
        >
          {/* Cabeçalho da Direita: Termo Pesquisado e Abas de Categoria */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 ${
            isFireTv
              ? (viewport.scaleCategory === 'compact' ? 'mb-3 pb-2' : 'mb-4 pb-3')
              : (viewport.scaleCategory === 'compact' ? 'mb-4 pb-3' : 'mb-8 pb-5')
          }`}>
            <div>
              <h1 className={`font-extrabold tracking-tight text-white flex items-center gap-2 ${
                isFireTv
                  ? (viewport.scaleCategory === 'compact' ? 'text-sm' : viewport.scaleCategory === 'standard' ? 'text-base' : 'text-lg')
                  : (viewport.scaleCategory === 'compact' ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl')
              }`}>
                {query.trim() ? (
                  <>
                    <span>Resultados para</span>
                    <span className="text-cyan-400 underline decoration-cyan-500/50 underline-offset-4">
                      "{query}"
                    </span>
                  </>
                ) : (
                  <span>Títulos em Alta e Recomendados</span>
                )}
              </h1>
            </div>

            {/* Filtros de Categoria: Todos | Filmes | Séries | Animes */}
            <div className={`flex items-center ${isFireTv ? 'gap-1.5' : 'gap-2.5'} flex-wrap`}>
              {CATEGORIES.map((cat, idx) => (
                <TvFilterTab
                  key={`cat-${cat.id}`}
                  id={cat.id}
                  label={cat.label}
                  isActive={selectedCategory === cat.id}
                  scaleCategory={viewport.scaleCategory}
                  isFireTv={isFireTv}
                  onSelect={(id) => {
                    uiSoundService.play('toggle');
                    setSelectedCategory(id);
                  }}
                  onArrowLeftEdge={idx === 0 ? () => setFocus('tv-key-clear') : undefined}
                />
              ))}
            </div>
          </div>

          {/* Grade de Resultados Verticais 2:3 */}
          {searchResults.length > 0 ? (
            <>
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                  gap: isFireTv
                    ? (viewport.scaleCategory === 'compact' ? '8px' : viewport.scaleCategory === 'standard' ? '10px' : '12px')
                    : (viewport.scaleCategory === 'compact' ? '10px' : viewport.scaleCategory === 'standard' ? '14px' : '18px')
                }}
              >
                {searchResults.slice(0, visibleCount).map((item, idx) => (
                  <TvCard16x9
                    key={`search-${item.id}-${idx}`}
                    item={item}
                    onClick={(sel) => {
                      uiSoundService.play('detailOpen');
                      onSelectItem(sel);
                    }}
                    onFocus={() => handleCardFocus(idx)}
                    focusKeyPrefix="tv-search-card"
                  />
                ))}
              </div>
              <div ref={resultsSentinelRef} className="h-24" aria-hidden="true" />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
              <div className={`${isFireTv ? 'w-12 h-12' : 'w-16 h-16'} rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-gray-500`}>
                <Search className={`${isFireTv ? 'w-6 h-6' : 'w-8 h-8'} text-gray-400`} />
              </div>
              <h2 className={`${isFireTv ? 'text-base' : 'text-xl'} font-bold text-gray-200 mb-1`}>
                Nenhum título encontrado para "{query}".
              </h2>
              <p className={`${isFireTv ? 'text-xs' : 'text-sm'} text-gray-500 max-w-md`}>
                Tente pesquisar com palavras diferentes, títulos originais, atores ou alterne a categoria selecionada.
              </p>
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
};
