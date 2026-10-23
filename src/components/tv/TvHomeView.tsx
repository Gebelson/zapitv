import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ContentItem } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { heroCarouselStore, HERO_CAROUSEL_STORAGE_KEY } from '../../core/catalog/heroCarouselStore';
import { TvHeroBanner } from './TvHeroBanner';
import { TvContentRow } from './TvContentRow';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvHomeViewProps {
  suspended?: boolean;
  featuredItems: ContentItem[];
  trendingItems: ContentItem[];
  popularMovies: ContentItem[];
  popularSeries: ContentItem[];
  animeItems: ContentItem[];
  allContent: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onPlayItem: (item: ContentItem) => void;
}

export const TvHomeView: React.FC<TvHomeViewProps> = memo(({
  suspended = false,
  featuredItems,
  trendingItems,
  popularMovies,
  popularSeries,
  animeItems,
  allContent,
  onSelectItem,
  onPlayItem
}) => {
  // Lista de Destaques configurados no painel administrativo / heroCarouselStore
  const [liveFeatured, setLiveFeatured] = useState<ContentItem[]>(() => {
    // 1. Se houver itens personalizados salvos pelo admin no localStorage, respeita todos eles sem corte
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    // 2. Se a prop featuredItems foi fornecida, utiliza os itens de destaque configurados
    if (featuredItems && featuredItems.length > 0) {
      return heroCarouselStore.getDisplayItems(featuredItems, 6);
    }
    // 3. Fallback para sementes oficiais de destaque
    return heroCarouselStore.getDisplayItems(allContent, 6);
  });

  useEffect(() => {
    // Verifica se há configuração manual no storage
    let hasManual = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasManual = true;
            setLiveFeatured(parsed);
          }
        }
      } catch {}
    }
    if (!hasManual && featuredItems && featuredItems.length > 0) {
      setLiveFeatured(heroCarouselStore.getDisplayItems(featuredItems, 6));
    }
  }, [featuredItems]);

  useEffect(() => {
    return heroCarouselStore.subscribe((updatedItems) => {
      if (updatedItems && updatedItems.length > 0) {
        setLiveFeatured(updatedItems);
      }
    });
  }, []);

  // Lista cinematográfica de múltiplos destaques (suporta qualquer quantidade de banners configurados)
  const heroSlides = useMemo(() => {
    if (liveFeatured.length > 0) return liveFeatured;
    if (featuredItems.length > 0) return heroCarouselStore.getDisplayItems(featuredItems, 6);
    if (trendingItems.length > 0) return trendingItems.slice(0, 6);
    return allContent.slice(0, 6);
  }, [liveFeatured, featuredItems, trendingItems, allContent]);

  // Continuar Assistindo: extrai itens reais em andamento
  const continueWatchingItems = useMemo(() => {
    if (!allContent || allContent.length === 0) return [];
    return allContent.filter(item => {
      const cont = storageService.getPlaybackContinuity(item);
      return cont.hasStarted && !cont.isCompleted && cont.percentage > 2 && cont.percentage < 95;
    }).slice(0, 15);
  }, [allContent]);

  // Identificador da primeira fileira navegável
  const firstActiveRowId = useMemo(() => {
    if (continueWatchingItems.length > 0) return 'continue-watching';
    if (trendingItems.length > 0) return 'trending';
    if (popularMovies.length > 0) return 'popular-movies';
    if (popularSeries.length > 0) return 'popular-series';
    if (animeItems.length > 0) return 'popular-animes';
    if (featuredItems.length > 1) return 'featured-all';
    return '';
  }, [continueWatchingItems, trendingItems, popularMovies, popularSeries, animeItems, featuredItems]);

  const isScrollingToHeroRef = useRef(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Limpeza de timers ao desmontar
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
      isScrollingToHeroRef.current = false;
    };
  }, []);

  const handleHeroDownPress = useCallback(() => {
    if (firstActiveRowId) {
      const rowKey = `row-${firstActiveRowId}`;
      setFocus(rowKey);
      const el = document.getElementById(rowKey) || document.querySelector(`[data-focus-key="${rowKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [firstActiveRowId]);

  const handleFirstRowUpPress = useCallback(() => {
    // 7. Evita múltiplas animações simultâneas caso o usuário pressione repetidamente as setas
    if (isScrollingToHeroRef.current) return;

    if (typeof window === 'undefined') {
      setFocus('tv-hero-play');
      return;
    }

    const currentScrollY = window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;

    // Se já estiver no topo absoluto, apenas transfere o foco imediatamente
    if (currentScrollY <= 2) {
      setFocus('tv-hero-play');
      return;
    }

    isScrollingToHeroRef.current = true;

    // 1 & 2. Utiliza uma ÚNICA estratégia de rolagem suave nativa para retornar ao banner principal,
    // eliminando comandos concorrentes ou conflitantes de scrollTop/scrollIntoView
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }

    // 3, 4 & 5. Coordena a transferência de foco para 'tv-hero-play' com a conclusão da rolagem (~380ms),
    // preservando a curva de desaceleração suave (ease-out) e impedindo que o foco nativo provoque saltos
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

      // 8. Garante que o banner fique perfeitamente enquadrado ao final da rolagem
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }

      // Transfere o foco de forma suave para o botão Assistir do Hero já perfeitamente posicionado
      setFocus('tv-hero-play');
      isScrollingToHeroRef.current = false;
    };

    const handleScrollEnd = () => {
      finishTransition();
    };

    // Suporta evento nativo scrollend quando disponível
    window.addEventListener('scrollend', handleScrollEnd, { once: true });

    // Fallback coordenado com duração aproximada de 380ms (faixa ideal de 350-500ms)
    // para Smart TVs onde o evento scrollend não é emitido
    scrollTimerRef.current = setTimeout(finishTransition, 380);
  }, []);

  const hasContinue = continueWatchingItems.length > 0;

  return (
    <div className="w-full min-h-screen pb-24 overflow-x-hidden">
      {/* Banner Principal Cinematográfico (100% da primeira viewport com carrossel multi-destaques) */}
      {heroSlides.length > 0 && (
        <TvHeroBanner
          items={heroSlides}
          suspended={suspended}
          onPlay={onPlayItem}
          onOpenDetails={onSelectItem}
          onDownPress={handleHeroDownPress}
        />
      )}

      {/* Fileiras de Conteúdos: Exclusivamente abaixo da primeira viewport (Sem margem negativa) */}
      <div className="relative z-10 pt-8 sm:pt-12 pb-28 space-y-6 sm:space-y-10">
        {/* Continuar Assistindo (Se houver progresso real) */}
        {hasContinue && (
          <TvContentRow
            title="Continuar assistindo"
            rowId="continue-watching"
            items={continueWatchingItems}
            onItemClick={onSelectItem}
            showProgress
            onRowUp={firstActiveRowId === 'continue-watching' ? handleFirstRowUpPress : undefined}
          />
        )}

        {/* Em Alta */}
        {trendingItems.length > 0 && (
          <TvContentRow
            title="Em Alta no ZapiTV"
            rowId="trending"
            items={trendingItems}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'trending' ? handleFirstRowUpPress : undefined}
          />
        )}

        {/* Filmes Populares */}
        {popularMovies.length > 0 && (
          <TvContentRow
            title="Filmes em Destaque"
            rowId="popular-movies"
            items={popularMovies}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'popular-movies' ? handleFirstRowUpPress : undefined}
          />
        )}

        {/* Séries Populares */}
        {popularSeries.length > 0 && (
          <TvContentRow
            title="Séries Populares"
            rowId="popular-series"
            items={popularSeries}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'popular-series' ? handleFirstRowUpPress : undefined}
          />
        )}

        {/* Animes */}
        {animeItems.length > 0 && (
          <TvContentRow
            title="Animes em Alta"
            rowId="popular-animes"
            items={animeItems}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'popular-animes' ? handleFirstRowUpPress : undefined}
          />
        )}

        {/* Destaques Gerais */}
        {featuredItems.length > 1 && (
          <TvContentRow
            title="Seleção Editorial ZapiTV"
            rowId="featured-all"
            items={featuredItems.slice(1)}
            onItemClick={onSelectItem}
            onRowUp={firstActiveRowId === 'featured-all' ? handleFirstRowUpPress : undefined}
          />
        )}
      </div>
    </div>
  );
});

TvHomeView.displayName = 'TvHomeView';
