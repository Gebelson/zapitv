import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentItem } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvHeroBannerProps {
  item?: ContentItem;
  items?: ContentItem[];
  onPlay: (item: ContentItem) => void;
  onOpenDetails: (item: ContentItem) => void;
  onDownPress?: () => void;
  autoRotateInterval?: number; // Padrão de 8 segundos (8000ms)
}

const TvHeroButton: React.FC<{
  focusKey: string;
  onClick: () => void;
  isPrimary?: boolean;
  icon: React.ReactNode;
  label: string;
  onDownPress?: () => void;
  onLeftPress?: () => void;
  onRightPress?: () => void;
}> = ({ focusKey, onClick, isPrimary = false, icon, label, onDownPress, onLeftPress, onRightPress }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus('tv-nav-home');
        return false;
      }
      if (direction === 'down' && onDownPress) {
        onDownPress();
        return false;
      }
      if (direction === 'left' && onLeftPress) {
        onLeftPress();
        return false;
      }
      if (direction === 'right' && onRightPress) {
        onRightPress();
        return false;
      }
      return true;
    },
    autoScroll: true
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={onClick}
      className={`zapi-tv-hero-btn px-9 py-4 rounded-2xl font-black text-base sm:text-lg tracking-wide inline-flex items-center justify-center gap-3.5 transition-all duration-200 outline-none select-none cursor-pointer ${
        isPrimary
          ? focused
            ? 'bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 text-white scale-105 border-2 border-white shadow-[0_0_30px_rgba(0,229,255,0.75)]'
            : 'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 text-white shadow-xl shadow-cyan-500/25 border-2 border-transparent hover:scale-102'
          : focused
          ? 'bg-white/25 text-white scale-105 border-2 border-white shadow-[0_0_24px_rgba(255,255,255,0.5)]'
          : 'bg-white/10 hover:bg-white/15 text-gray-200 border-2 border-white/20 hover:scale-102'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const TvHeroIconButton: React.FC<{
  focusKey: string;
  onClick: () => void;
  icon: React.ReactNode;
  ariaLabel: string;
  onDownPress?: () => void;
  onRightPress?: () => void;
}> = ({ focusKey, onClick, icon, ariaLabel, onDownPress, onRightPress }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus('tv-nav-home');
        return false;
      }
      if (direction === 'down' && onDownPress) {
        onDownPress();
        return false;
      }
      if (direction === 'right' && onRightPress) {
        onRightPress();
        return false;
      }
      return true;
    }
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 outline-none select-none cursor-pointer ${
        focused
          ? 'bg-cyan-500/30 text-cyan-300 border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.7)]'
          : 'bg-white/10 hover:bg-white/20 text-gray-200 border-2 border-white/20 hover:scale-105'
      }`}
    >
      {icon}
    </button>
  );
};

export const TvHeroBanner: React.FC<TvHeroBannerProps> = memo(({
  item,
  items,
  onPlay,
  onOpenDetails,
  onDownPress,
  autoRotateInterval = 8000
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

  // Estados do carrossel cinematográfico
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [textOpacity, setTextOpacity] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  const isTransitioningRef = useRef(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Item ativo no momento
  const currentItem = slides[currentIndex] || slides[0] || null;
  const outgoingItem = outgoingIndex !== null ? slides[outgoingIndex] : null;

  // Pré-carregamento do próximo slide para evitar qualquer flash ou tela preta
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!url) return resolve();
      const img = new Image();
      img.src = url;
      if (img.complete) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      }
    });
  }, []);

  // Transição sincronizada suave entre destaques (Crossfade + Fade de Textos)
  const goToSlide = useCallback(async (targetIndex: number) => {
    if (slides.length <= 1 || isTransitioningRef.current) return;
    const normalizedTarget = (targetIndex + slides.length) % slides.length;
    if (normalizedTarget === currentIndex) return;

    isTransitioningRef.current = true;
    setIsCrossfading(true);
    setOutgoingIndex(currentIndex);

    const nextItem = slides[normalizedTarget];
    const nextBackdrop = nextItem.backdrop || nextItem.image || nextItem.poster || '';

    // Aguarda o pré-carregamento da imagem do próximo destaque
    if (nextBackdrop) {
      await preloadImage(nextBackdrop);
    }

    // 1. Suave fade out dos textos (250ms)
    setTextOpacity(0);

    // 2. Atualiza o conteúdo do texto na metade da transição de crossfade e inicia fade in
    textTimerRef.current = setTimeout(() => {
      setCurrentIndex(normalizedTarget);
      setTextOpacity(1);
    }, 250);

    // 3. Finaliza o crossfade completo das imagens aos 700ms
    transitionTimerRef.current = setTimeout(() => {
      setOutgoingIndex(null);
      setIsCrossfading(false);
      isTransitioningRef.current = false;
    }, 700);
  }, [slides, currentIndex, preloadImage]);

  const goToNextSlide = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [goToSlide, currentIndex]);

  const goToPrevSlide = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [goToSlide, currentIndex]);

  // Reinicia o timer de rotação automática
  const resetTimer = useCallback(() => {
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    if (slides.length <= 1 || isPaused) return;

    autoPlayTimerRef.current = setInterval(() => {
      goToNextSlide();
    }, autoRotateInterval);
  }, [slides.length, isPaused, autoRotateInterval, goToNextSlide]);

  // Gerenciamento da rotação automática com pause e resume inteligentes
  useEffect(() => {
    resetTimer();
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [resetTimer]);

  // Pausa a rotação quando a aba/página estiver oculta
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      } else {
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [resetTimer]);

  // Limpeza de timers na desmontagem
  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
    };
  }, []);

  if (!currentItem) {
    return null;
  }

  const currentBackdropUrl = currentItem.backdrop || currentItem.image || currentItem.poster || '';
  const outgoingBackdropUrl = outgoingItem ? (outgoingItem.backdrop || outgoingItem.image || outgoingItem.poster || '') : '';
  const genresText = currentItem.genres?.slice(0, 3).join(' • ') || (currentItem.type === 'FILME' ? 'Filme' : 'Série');

  // Verifica continuidade de reprodução para exibir "Continuar" ou "Assistir"
  const continuity = storageService.getPlaybackContinuity(currentItem);
  const hasProgress = continuity.hasStarted && !continuity.isCompleted && continuity.percentage > 2;

  return (
    <FocusContext.Provider value={focusKey}>
      <section 
        ref={noriginRef as any}
        className="relative w-full h-screen min-h-[100vh] select-none overflow-hidden"
        aria-label={`Destaque: ${currentItem.title}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => { setIsPaused(false); resetTimer(); }}
      >
        {/* Camada 0: Imagens com Crossfade e Blur Progressivo Integrado */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Slide Anterior (Saindo com fade out suave de 700ms) */}
          {outgoingItem && outgoingBackdropUrl && (
            <div 
              key={`hero-outgoing-${outgoingItem.id}`}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out z-0"
              style={{ opacity: isCrossfading ? 0 : 1 }}
            >
              {/* Imagem Nítida Base Fullscreen (Inicia em top: 0, 100% da viewport) */}
              <img
                src={outgoingBackdropUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />

              {/* Blur Progressivo Alinhado ao Backdrop (Desfoque suave no topo atrás do header e na base) */}
              <div 
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 6%, rgba(0,0,0,0.3) 14%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0.85) 92%, rgba(0,0,0,1) 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 6%, rgba(0,0,0,0.3) 14%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0.85) 92%, rgba(0,0,0,1) 100%)'
                }}
              >
                <img
                  src={outgoingBackdropUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover object-center filter blur-xl scale-105 transform-gpu"
                />
              </div>
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
              <img
                src={currentBackdropUrl}
                alt={currentItem.title}
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center"
                onError={(e) => {
                  if (currentItem.image && (e.currentTarget as HTMLImageElement).src !== currentItem.image) {
                    (e.currentTarget as HTMLImageElement).src = currentItem.image;
                  }
                }}
              />

              {/* Blur Progressivo Alinhado ao Backdrop (Desfoque suave no topo atrás do header e na base) */}
              <div 
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 6%, rgba(0,0,0,0.3) 14%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0.85) 92%, rgba(0,0,0,1) 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 6%, rgba(0,0,0,0.3) 14%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0.85) 92%, rgba(0,0,0,1) 100%)'
                }}
              >
                <img
                  src={currentBackdropUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover object-center filter blur-xl scale-105 transform-gpu"
                />
              </div>
            </div>
          )}

          {/* Gradiente Escuro Superior Cinematográfico (Garante legibilidade dos links sem faixa preta sólida) */}
          <div 
            className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-[#05070a] pointer-events-none z-[2]"
            style={{
              background: 'linear-gradient(to bottom, rgba(5,7,10,0.70) 0%, rgba(5,7,10,0.50) 8%, rgba(5,7,10,0.28) 16%, rgba(5,7,10,0.08) 28%, transparent 40%)'
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
              background: 'linear-gradient(to top, rgba(5,7,10,1) 0%, rgba(5,7,10,0.85) 12%, rgba(5,7,10,0.50) 26%, rgba(5,7,10,0.15) 40%, transparent 58%)'
            }}
          />

          {/* Efeito Glow Ambiente do Destaque (Cores atmosféricas do ZapiTV) */}
          <div 
            className="absolute top-1/3 left-14 w-[500px] h-[380px] rounded-full pointer-events-none opacity-25 blur-3xl z-[2]"
            style={{
              background: 'radial-gradient(circle, rgba(0, 125, 247, 0.45) 0%, rgba(0, 229, 255, 0.25) 45%, transparent 75%)'
            }}
          />
        </div>

        {/* Indicadores de Paginação Discretos e Estilizados */}
        {slides.length > 1 && (
          <div className="absolute bottom-24 sm:bottom-28 right-14 sm:right-16 z-30 flex items-center gap-2 select-none pointer-events-auto">
            {slides.map((slide, idx) => (
              <button
                key={`hero-dot-${slide.id}-${idx}`}
                type="button"
                onClick={() => { resetTimer(); goToSlide(idx); }}
                aria-label={`Ir para destaque ${idx + 1}: ${slide.title}`}
                className={`transition-all duration-300 rounded-full cursor-pointer outline-none border-none p-0 ${
                  idx === currentIndex
                    ? 'w-8 h-2.5 bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_12px_#00e5ff]'
                    : 'w-2.5 h-2.5 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* Informações do Destaque Posicionadas no Terço Inferior Esquerdo com Transição Sincronizada */}
        <div 
          className="relative z-10 h-full flex flex-col justify-end pb-24 sm:pb-28 lg:pb-32 pl-14 sm:pl-16 pr-8 max-w-2xl lg:max-w-3xl transition-all duration-300 transform-gpu"
          style={{
            opacity: textOpacity,
            transform: textOpacity === 1 ? 'translate3d(0, 0, 0)' : 'translate3d(0, 8px, 0)'
          }}
        >
          {/* Metadados: Ano, Classificação, Gêneros, Nota */}
          <div className="flex flex-wrap items-center gap-3 mb-3 text-sm font-bold text-gray-300 drop-shadow">
            {currentItem.rating ? (
              <span className="flex items-center gap-1.5 text-amber-400 bg-black/60 px-2.5 py-1 rounded-lg border border-amber-400/30">
                <Star className="w-4 h-4 fill-amber-400" />
                {currentItem.rating.toFixed(1)}
              </span>
            ) : null}

            {currentItem.year ? <span>{currentItem.year}</span> : null}

            {currentItem.ageRating && (
              <span className="px-2 py-0.5 rounded-md bg-white/15 border border-white/20 text-xs text-white">
                {currentItem.ageRating}
              </span>
            )}

            <span>•</span>
            <span className="text-cyan-300 font-semibold">{genresText}</span>
          </div>

          {/* Título Principal em Tipografia Imponente */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight mb-4 drop-shadow-2xl">
            {currentItem.title}
          </h1>

          {/* Sinopse Curta (2 a 3 linhas) */}
          <p className="text-base sm:text-lg text-gray-300/95 leading-relaxed line-clamp-3 mb-8 max-w-xl drop-shadow">
            {currentItem.description || currentItem.overview || 'Acompanhe esta incrível produção agora no ZapiTV com a máxima qualidade e sem interrupções.'}
          </p>

          {/* Botões Grandes de Ação e Navegação Manual */}
          <div className="flex items-center gap-4 flex-wrap">
            <TvHeroButton
              focusKey="tv-hero-play"
              onClick={() => onPlay(currentItem)}
              isPrimary
              icon={<Play className="w-6 h-6 fill-white" />}
              label={hasProgress ? "Continuar" : "Assistir"}
              onDownPress={onDownPress}
              onLeftPress={slides.length > 1 ? () => { resetTimer(); goToPrevSlide(); } : undefined}
            />

            <TvHeroButton
              focusKey="tv-hero-details"
              onClick={() => onOpenDetails(currentItem)}
              isPrimary={false}
              icon={<Info className="w-6 h-6" />}
              label="Mais detalhes"
              onDownPress={onDownPress}
              onRightPress={slides.length > 1 ? undefined : undefined}
            />

            {/* Controles discretos de navegação manual entre destaques com foco do controle remoto */}
            {slides.length > 1 && (
              <div className="flex items-center gap-2 ml-2">
                <TvHeroIconButton
                  focusKey="tv-hero-prev"
                  onClick={() => { resetTimer(); goToPrevSlide(); }}
                  icon={<ChevronLeft className="w-5 h-5" />}
                  ariaLabel="Destaque anterior"
                  onDownPress={onDownPress}
                />
                <TvHeroIconButton
                  focusKey="tv-hero-next"
                  onClick={() => { resetTimer(); goToNextSlide(); }}
                  icon={<ChevronRight className="w-5 h-5" />}
                  ariaLabel="Próximo destaque"
                  onDownPress={onDownPress}
                  onRightPress={() => { resetTimer(); goToNextSlide(); }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  );
});

TvHeroBanner.displayName = 'TvHeroBanner';
