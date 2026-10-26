import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Info, Star } from 'lucide-react';
import { ContentItem } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { tvPerformanceService } from '../../core/tv/tvPerformanceService';
import { useTvViewport, TvScaleCategory } from '../../core/tv/tvViewportService';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvHeroBannerProps {
  item?: ContentItem;
  items?: ContentItem[];
  onPlay: (item: ContentItem) => void;
  onOpenDetails: (item: ContentItem) => void;
  onDownPress?: () => void;
  autoRotateInterval?: number; // Padrão de 8 segundos (8000ms)
  suspended?: boolean;
  upFocusKey?: string;
}

function getActiveHeaderNavFocusKey(): string {
  if (typeof document !== 'undefined') {
    const activeBtn = document.querySelector<HTMLElement>('button[data-focus-key^="tv-nav-"][data-tv-active="true"]');
    if (activeBtn) {
      const key = activeBtn.getAttribute('data-focus-key');
      if (key) return key;
    }
  }
  return 'tv-nav-home';
}

const TvHeroButton: React.FC<{
  focusKey: string;
  onClick: () => void;
  isPrimary?: boolean;
  icon: React.ReactNode;
  label: string;
  onDownPress?: () => void;
  upFocusKey?: string;
  scaleCategory?: TvScaleCategory;
}> = ({ focusKey, onClick, isPrimary = false, icon, label, onDownPress, upFocusKey, scaleCategory = 'expanded' }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        const target = upFocusKey || getActiveHeaderNavFocusKey();
        if (target) {
          setFocus(target);
        } else {
          setFocus('tv-nav-home');
        }
        return false;
      }
      if (direction === 'down' && onDownPress) {
        onDownPress();
        return false;
      }
      return true;
    },
    autoScroll: false
  });

  let btnStyle = '';
  if (scaleCategory === 'compact') {
    if (isPrimary) {
      btnStyle = focused
        ? 'px-5 py-2.5 rounded-xl font-bold text-sm border-0 overflow-hidden bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 text-white scale-105 shadow-[0_0_20px_rgba(0,229,255,0.75)]'
        : 'px-5 py-2.5 rounded-xl font-bold text-sm border-0 overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/25 hover:scale-102';
    } else {
      btnStyle = focused
        ? 'px-4 py-2.5 rounded-xl font-bold text-sm bg-white/25 text-white scale-105 border-2 border-white shadow-[0_0_16px_rgba(255,255,255,0.5)]'
        : 'px-4 py-2.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-gray-200 border border-white/20 hover:scale-102';
    }
  } else if (scaleCategory === 'standard') {
    if (isPrimary) {
      btnStyle = focused
        ? 'px-7 py-3 rounded-xl font-black text-base border-0 overflow-hidden bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 text-white scale-105 shadow-[0_0_24px_rgba(0,229,255,0.75)]'
        : 'px-7 py-3 rounded-xl font-black text-base border-0 overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 text-white shadow-xl shadow-cyan-500/25 hover:scale-102';
    } else {
      btnStyle = focused
        ? 'px-6 py-3 rounded-xl font-black text-base bg-white/25 text-white scale-105 border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]'
        : 'px-6 py-3 rounded-xl font-black text-base bg-white/10 hover:bg-white/15 text-gray-200 border-2 border-white/20 hover:scale-102';
    }
  } else {
    if (isPrimary) {
      btnStyle = focused
        ? 'px-[38px] py-[18px] rounded-2xl font-black text-base sm:text-lg border-0 overflow-hidden bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 text-white scale-105 shadow-[0_0_30px_rgba(0,229,255,0.75)]'
        : 'px-[38px] py-[18px] rounded-2xl font-black text-base sm:text-lg border-0 overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 text-white shadow-xl shadow-cyan-500/25 hover:scale-102';
    } else {
      btnStyle = focused
        ? 'px-9 py-4 rounded-2xl font-black text-base sm:text-lg bg-white/25 text-white scale-105 border-2 border-white shadow-[0_0_24px_rgba(255,255,255,0.5)]'
        : 'px-9 py-4 rounded-2xl font-black text-base sm:text-lg bg-white/10 hover:bg-white/15 text-gray-200 border-2 border-white/20 hover:scale-102';
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={onClick}
      className={`zapi-tv-hero-btn tracking-wide inline-flex items-center justify-center gap-2.5 transition-all duration-200 outline-none select-none cursor-pointer ${btnStyle}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const preloadBannerImage = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }
    }, 2500);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(true);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(false);
      }
    };
    img.src = url;
  });
};

export const TvHeroBanner: React.FC<TvHeroBannerProps> = memo(({
  item,
  items,
  onPlay,
  onOpenDetails,
  onDownPress,
  suspended = false,
  autoRotateInterval = 8000,
  upFocusKey
}) => {
  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-hero',
    trackChildren: true,
    saveLastFocusedChild: true
  });

  // Lista de destaques configurados (suporta qualquer quantidade de banners)
  const slides = useMemo(() => {
    if (items && items.length > 0) return items;
    if (item) return [item];
    return [];
  }, [items, item]);

  const viewport = useTvViewport();
  const isFireTvOrEco = tvPerformanceService.isFireTv() || tvPerformanceService.getHardwareProfile() === 'eco';

  // Diagnóstico temporário: ?tvbanner=original|gradients|full (sem persistência).
  // Tizen/MSX/FireTV usa gradientes por padrão: máscaras e filtros de blur travam o compositor gráfico.
  const { bannerMode, isDiagnostic } = useMemo(() => {
    if (typeof window === 'undefined') return { bannerMode: 'gradients' as const, isDiagnostic: false };
    const requestedMode = new URLSearchParams(window.location.search).get('tvbanner');
    if (requestedMode === 'original' || requestedMode === 'gradients' || requestedMode === 'full') {
      return { bannerMode: requestedMode, isDiagnostic: true };
    }
    const isTvEnvironment = isFireTvOrEco || /Tizen|Maple|Samsung.*(?:TV|SmartTV)|Media\s*Station\s*X|MediaStationX|Amazon|Silk|FireTV|Fire\s*OS|AFT[A-Z0-9]+/i.test(navigator.userAgent);
    return { bannerMode: isTvEnvironment ? 'gradients' as const : 'full' as const, isDiagnostic: false };
  }, [isFireTvOrEco]);

  // Estados do carrossel cinematográfico
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [textOpacity, setTextOpacity] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  const isTransitioningRef = useRef(false);
  const isMountedRef = useRef(true);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Item ativo no momento
  const currentItem = slides[currentIndex] || slides[0] || null;
  const outgoingItem = outgoingIndex !== null ? slides[outgoingIndex] : null;

  const [resolvedImages, setResolvedImages] = useState<Record<string, { url: string; portrait: boolean }>>({});

  // Alguns destaques têm pôster vertical no campo backdrop; verifica a imagem real antes de ampliá-la.
  const resolveBannerImage = useCallback(async (slide: ContentItem) => {
    const candidates = [...new Set([slide.backdrop, slide.image, slide.poster].filter((url): url is string => Boolean(url)))];
    let bestLandscape: { url: string; portrait: boolean; width: number } | null = null;
    let bestPortrait: { url: string; portrait: boolean } | null = null;
    for (const url of candidates) {
      const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => {
          img.onload = null;
          img.onerror = null;
          img.src = '';
          resolve(null);
        }, 3500);
        img.onload = () => {
          clearTimeout(timer);
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        img.src = url;
      });
      if (!size) continue;
      if (size.width / size.height >= 1.3) {
        if (!bestLandscape || size.width > bestLandscape.width) bestLandscape = { url, portrait: false, width: size.width };
        if (size.width >= 1280) break;
      } else if (!bestPortrait) {
        bestPortrait = { url, portrait: true };
      }
    }
    return bestLandscape || bestPortrait || { url: candidates[0] || '', portrait: false };
  }, []);

  useEffect(() => {
    if (!currentItem) return;
    const key = currentItem.backdrop || currentItem.image || currentItem.poster || '';
    if (!key || resolvedImages[key]) return;
    let active = true;
    resolveBannerImage(currentItem).then(choice => {
      if (active) setResolvedImages(previous => ({ ...previous, [key]: choice }));
    });
    return () => { active = false; };
  }, [currentItem, resolvedImages, resolveBannerImage]);

  // Pré-decodificação assíncrona inteligente do próximo destaque em background
  useEffect(() => {
    if (slides.length <= 1) return;
    const nextIdx = (currentIndex + 1) % slides.length;
    const nextSlide = slides[nextIdx];
    if (!nextSlide) return;
    const key = nextSlide.backdrop || nextSlide.image || nextSlide.poster || '';
    if (key && !resolvedImages[key]) {
      let active = true;
      resolveBannerImage(nextSlide).then(choice => {
        if (active && isMountedRef.current) {
          setResolvedImages(previous => ({ ...previous, [key]: choice }));
        }
      });
      return () => { active = false; };
    }
  }, [currentIndex, slides, resolvedImages, resolveBannerImage]);

  // Transição sincronizada suave entre destaques (Crossfade + Fade de Textos)
  const goToSlide = useCallback(async (targetIndex: number) => {
    if (slides.length <= 1 || isTransitioningRef.current) return;
    const normalizedTarget = (targetIndex + slides.length) % slides.length;
    if (normalizedTarget === currentIndex) return;

    const nextItem = slides[normalizedTarget];
    if (!nextItem) return;

    isTransitioningRef.current = true;

    // 1. Resolve e pré-carrega a imagem do próximo slide ANTES de iniciar a transição visual
    const nextBackdrop = nextItem.backdrop || nextItem.image || nextItem.poster || '';
    let choice = resolvedImages[nextBackdrop];
    if (!choice && nextBackdrop) {
      choice = await resolveBannerImage(nextItem);
      if (!isMountedRef.current) {
        isTransitioningRef.current = false;
        return;
      }
      setResolvedImages(previous => ({ ...previous, [nextBackdrop]: choice }));
    }

    const targetUrl = choice?.url || nextBackdrop;
    if (targetUrl) {
      await preloadBannerImage(targetUrl);
      if (!isMountedRef.current) {
        isTransitioningRef.current = false;
        return;
      }
    }

    setIsCrossfading(true);
    setOutgoingIndex(currentIndex);

    // 2. Suave fade out dos textos (250ms)
    setTextOpacity(0);

    // 3. Atualiza o conteúdo do texto na metade da transição de crossfade e inicia fade in
    textTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentIndex(normalizedTarget);
      setTextOpacity(1);
    }, 250);

    // 4. Finaliza o crossfade completo das imagens aos 700ms
    transitionTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setOutgoingIndex(null);
      setIsCrossfading(false);
      isTransitioningRef.current = false;
    }, 700);
  }, [slides, currentIndex, resolvedImages, resolveBannerImage]);

  const goToNextSlide = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [goToSlide, currentIndex]);

  // Reinicia o timer de rotação automática
  const resetTimer = useCallback(() => {
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    if (slides.length <= 1 || isPaused || isDiagnostic || suspended) return;

    autoPlayTimerRef.current = setInterval(() => {
      goToNextSlide();
    }, autoRotateInterval);
  }, [slides.length, isPaused, isDiagnostic, suspended, autoRotateInterval, goToNextSlide]);

  // Gerenciamento da rotação automática com pause e resume inteligentes
  useEffect(() => {
    resetTimer();
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [resetTimer]);

  // Pausa a rotação quando a aba/página estiver oculta ou o banner for rolado para fora da tela
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      } else {
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const isOffscreen = (window.scrollY || 0) > 450;
          setIsPaused(prev => prev !== isOffscreen ? isOffscreen : prev);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [resetTimer]);

  // Limpeza de timers na desmontagem
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
    };
  }, []);

  if (!currentItem) {
    return null;
  }

  const currentImageKey = currentItem.backdrop || currentItem.image || currentItem.poster || '';
  const outgoingImageKey = outgoingItem ? (outgoingItem.backdrop || outgoingItem.image || outgoingItem.poster || '') : '';
  const currentBackdropUrl = resolvedImages[currentImageKey]?.url || currentImageKey;
  const outgoingBackdropUrl = resolvedImages[outgoingImageKey]?.url || outgoingImageKey;
  const genresText = currentItem.genres?.slice(0, 3).join(' • ') || (currentItem.type === 'FILME' ? 'Filme' : 'Série');

  // Verifica continuidade de reprodução para exibir "Continuar" ou "Assistir"
  const continuity = storageService.getPlaybackContinuity(currentItem);
  const hasProgress = continuity.hasStarted && !continuity.isCompleted && continuity.percentage > 2;

  return (
    <FocusContext.Provider value={focusKey}>
      <section 
        ref={noriginRef as any}
        id="tv-hero-banner"
        className="relative w-full h-screen min-h-[100vh] select-none overflow-hidden"
        aria-label={`Destaque: ${currentItem.title}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => { setIsPaused(false); resetTimer(); }}
      >
        {/* Camada 0: imagens originais nítidas com crossfade */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Slide Anterior (Saindo com fade out suave de 700ms) */}
          {outgoingItem && outgoingBackdropUrl && (
            <div 
              key={`hero-outgoing-${outgoingItem.id}`}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out z-0"
              style={{ opacity: isCrossfading ? 0 : 1 }}
            >
              {/* Imagem Nítida Base Fullscreen (Inicia em top: 0, 100% da viewport) */}
              {resolvedImages[outgoingImageKey]?.portrait && (
                <img src={outgoingBackdropUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center opacity-40" />
              )}
              <img
                src={outgoingBackdropUrl}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 w-full h-full object-center ${resolvedImages[outgoingImageKey]?.portrait ? 'object-contain' : 'object-cover'}`}
              />
            </div>
          )}

          {/* Slide Atual (Entrando com fade in suave de 700ms) */}
          {currentBackdropUrl && (
            <div 
              key={`hero-current-${currentItem.id}`}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out z-[1]"
              style={{ opacity: outgoingItem ? (isCrossfading ? 1 : 0) : 1 }}
            >
              {/* Imagem Nítida Base Fullscreen (Inicia em top: 0, 100% da viewport) */}
              {resolvedImages[currentImageKey]?.portrait && (
                <img src={currentBackdropUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center opacity-40" />
              )}
              <img
                src={currentBackdropUrl}
                alt={currentItem.title}
                loading="eager"
                decoding="async"
                className={`absolute inset-0 w-full h-full object-center ${resolvedImages[currentImageKey]?.portrait ? 'object-contain' : 'object-cover'}`}
                onError={(e) => {
                  const imgEl = e.currentTarget as HTMLImageElement;
                  if (imgEl.dataset.fallbackRetried === 'true') return;
                  imgEl.dataset.fallbackRetried = 'true';
                  const fallback = currentItem.image || currentItem.poster;
                  if (fallback && imgEl.src !== fallback) {
                    imgEl.src = fallback;
                  }
                }}
              />
            </div>
          )}

          {bannerMode === 'full' ? (
            <>
              {/* Mesmo sem máscara, cada faixa cobre apenas uma extremidade, nunca o centro. */}
              <div
                className="absolute top-0 inset-x-0 h-[12%] pointer-events-none z-[2]"
                style={{
                  backdropFilter: 'blur(5px)',
                  WebkitBackdropFilter: 'blur(5px)',
                  maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
                }}
              />
            </>
          ) : null}

          {/* No Tizen, o gradiente inferior substitui esta máscara de blur. */}
          {bannerMode === 'full' ? (
            <div
              className="absolute bottom-0 inset-x-0 h-[22%] pointer-events-none z-[2]"
              style={{
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.75) 38%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.75) 38%, transparent 100%)'
              }}
            />
          ) : null}

          {bannerMode !== 'original' ? (
            <>
              {/* Gradiente Escuro Superior Cinematográfico (Garante legibilidade dos links sem faixa preta sólida) */}
              <div
                className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-[#05070a] pointer-events-none z-[2]"
                style={{
                  background: 'linear-gradient(to bottom, rgba(5,7,10,0.80) 0%, rgba(5,7,10,0.55) 8%, rgba(5,7,10,0.25) 18%, rgba(5,7,10,0.06) 28%, transparent 42%)'
                }}
              />

              {/* Gradiente Lateral Esquerdo (Contraste cinematográfico para o texto e botões à esquerda) */}
              <div
                className="absolute inset-0 pointer-events-none z-[2]"
                style={{
                  background: 'linear-gradient(to right, rgba(5,7,10,0.88) 0%, rgba(5,7,10,0.70) 24%, rgba(5,7,10,0.35) 46%, transparent 72%)'
                }}
              />

              {/* Gradiente Inferior Progressivo (Dissolve suavemente no fundo da página sem linha divisória) */}
              <div
                className="absolute bottom-0 inset-x-0 h-[45%] pointer-events-none z-[2]"
                style={{
                  background: 'linear-gradient(to top, rgba(5,7,10,1) 0%, rgba(5,7,10,0.85) 12%, rgba(5,7,10,0.45) 26%, rgba(5,7,10,0.12) 40%, transparent 58%)'
                }}
              />
            </>
          ) : null}

          {/* Efeito Glow Ambiente do Destaque (Cores atmosféricas do ZapiTV) */}
          {bannerMode === 'full' && !isDiagnostic ? (
            <div
              className="absolute top-1/3 left-14 w-[500px] h-[380px] rounded-full pointer-events-none opacity-25 blur-3xl z-[2]"
              style={{
                background: 'radial-gradient(circle, rgba(0, 125, 247, 0.45) 0%, rgba(0, 229, 255, 0.25) 45%, transparent 75%)'
              }}
            />
          ) : null}
        </div>

        {/* Indicadores de Paginação Discretos e Estilizados (Apenas Exibição Visual, Sem Seleção Manual) */}
        {slides.length > 1 && (
          <div 
            className={`absolute z-30 flex items-center gap-2 select-none pointer-events-none ${
              viewport.scaleCategory === 'compact' ? 'bottom-16 sm:bottom-20' : 'bottom-24 sm:bottom-28'
            }`}
            style={{ right: `${viewport.safeMarginX}px` }}
            aria-hidden="true"
          >
            {slides.map((slide, idx) => (
              <div
                key={`hero-dot-${slide.id}-${idx}`}
                className={`transition-all duration-300 rounded-full p-0 ${
                  idx === currentIndex
                    ? 'w-8 h-2.5 bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_12px_#00e5ff]'
                    : 'w-2.5 h-2.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        )}

        {/* Informações do Destaque Posicionadas no Terço Inferior Esquerdo com Transição Sincronizada */}
        <div 
          className="relative z-10 h-full flex flex-col justify-end transition-all duration-300 transform-gpu"
          style={{
            paddingLeft: `${viewport.safeMarginX}px`,
            paddingRight: `${viewport.safeMarginX}px`,
            paddingBottom: viewport.scaleCategory === 'compact' ? '28px' : viewport.scaleCategory === 'standard' ? '44px' : '64px',
            maxWidth: viewport.scaleCategory === 'compact' ? '540px' : viewport.scaleCategory === 'standard' ? '680px' : '820px',
            opacity: textOpacity,
            transform: textOpacity === 1 ? 'translate3d(0, 0, 0)' : 'translate3d(0, 8px, 0)'
          }}
        >
          {/* Metadados: Ano, Classificação, Gêneros, Nota */}
          <div className={`flex flex-wrap items-center font-bold text-gray-300 drop-shadow ${
            viewport.scaleCategory === 'compact' ? 'gap-2 mb-2 text-xs' : 'gap-3 mb-3 text-sm'
          }`}>
            {currentItem.rating ? (
              <span className="flex items-center gap-1.5 text-amber-400 bg-black/60 px-2 py-0.5 rounded-lg border border-amber-400/30">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {currentItem.rating.toFixed(1)}
              </span>
            ) : null}

            {currentItem.year ? <span>{currentItem.year}</span> : null}

            {currentItem.ageRating && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/15 border border-white/20 text-[11px] text-white">
                {currentItem.ageRating}
              </span>
            )}

            <span>•</span>
            <span className="text-cyan-300 font-semibold">{genresText}</span>
          </div>

          {/* Título Principal em Tipografia Imponente e Fluida */}
          <h1 
            style={{
              fontSize: viewport.scaleCategory === 'compact'
                ? 'clamp(1.5rem, 3.2vw, 2rem)'
                : viewport.scaleCategory === 'standard'
                ? 'clamp(2rem, 3.8vw, 2.75rem)'
                : 'clamp(2.5rem, 4.5vw, 3.75rem)'
            }}
            className={`font-black text-white tracking-tight leading-tight line-clamp-2 drop-shadow-2xl ${
              viewport.scaleCategory === 'compact' ? 'mb-2' : viewport.scaleCategory === 'standard' ? 'mb-3' : 'mb-4'
            }`}
          >
            {currentItem.title}
          </h1>

          {/* Sinopse Curta */}
          <p 
            className={`text-gray-300/95 leading-relaxed drop-shadow ${
              viewport.scaleCategory === 'compact'
                ? 'text-xs sm:text-sm line-clamp-2 mb-4 max-w-md'
                : viewport.scaleCategory === 'standard'
                ? 'text-sm sm:text-base line-clamp-3 mb-6 max-w-lg'
                : 'text-base sm:text-lg line-clamp-3 mb-8 max-w-xl'
            }`}
          >
            {currentItem.description || currentItem.overview || 'Acompanhe esta incrível produção agora no ZapiTV com a máxima qualidade e sem interrupções.'}
          </p>

          {/* Botões Grandes de Ação Proporcionais ao Viewport */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <TvHeroButton
              focusKey="tv-hero-play"
              onClick={() => {
                uiSoundService.play('watch');
                onPlay(currentItem);
              }}
              isPrimary
              scaleCategory={viewport.scaleCategory}
              icon={<Play className={viewport.scaleCategory === 'compact' ? "w-4 h-4 fill-white" : viewport.scaleCategory === 'standard' ? "w-5 h-5 fill-white" : "w-6 h-6 fill-white"} />}
              label={hasProgress ? "Continuar" : "Assistir"}
              onDownPress={onDownPress}
              upFocusKey={upFocusKey}
            />

            <TvHeroButton
              focusKey="tv-hero-details"
              onClick={() => {
                uiSoundService.play('detailOpen');
                onOpenDetails(currentItem);
              }}
              isPrimary={false}
              scaleCategory={viewport.scaleCategory}
              icon={<Info className={viewport.scaleCategory === 'compact' ? "w-4 h-4" : viewport.scaleCategory === 'standard' ? "w-5 h-5" : "w-6 h-6"} />}
              label="Mais detalhes"
              onDownPress={onDownPress}
              upFocusKey={upFocusKey}
            />
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  );
});

TvHeroBanner.displayName = 'TvHeroBanner';
