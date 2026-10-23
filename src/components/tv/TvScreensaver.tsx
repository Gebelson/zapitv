import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ContentItem, ContentType } from '../../../types';
import { ZapiAnimatedLogo } from '../common/ZapiAnimatedLogo';

export const TV_SCREENSAVER_SLIDE_MS = 15_000;

interface Slide {
  item: ContentItem;
  index: number;
  url: string;
}

export function getCategoryLabel(item: ContentItem): string {
  if (item.type === ContentType.ANIME || item.genres?.some(g => g.toLowerCase() === 'anime')) {
    return 'Anime';
  }
  if (item.type === ContentType.SERIES || (item.seasonsCount && item.seasonsCount > 0) || item.mediaFormat === 'series') {
    return 'Série';
  }
  if (item.type === ContentType.MOVIE || item.mediaFormat === 'movie') {
    return 'Filme';
  }
  return item.type ? String(item.type).toUpperCase() : 'Filme';
}

/** Exibe no máximo duas imagens durante o crossfade; mantém apenas a próxima pré-carregada. */
export const TvScreensaver: React.FC<{ items: ContentItem[] }> = ({ items }) => {
  const candidates = useMemo(() => items.filter(item => Boolean(item.backdrop)), [items]);
  const [current, setCurrent] = useState<Slide | null>(null);
  const [outgoing, setOutgoing] = useState<Slide | null>(null);
  const [noBackdrop, setNoBackdrop] = useState(false);
  const nextRef = useRef<Slide | null>(null);
  const currentRef = useRef<Slide | null>(null);

  // Resolução da logo oficial do conteúdo com fallback para o título
  const currentLogo = useMemo(() => {
    if (!current?.item) return null;
    const it = current.item;
    if (it.logo) return it.logo;
    const imdbId = it.imdbId || (it.id.startsWith('tt') ? it.id : undefined);
    if (imdbId) {
      return `https://images.metahub.space/logo/medium/${imdbId}/img`;
    }
    return null;
  }, [current?.item]);

  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [current?.item.id]);


  const hasLogo = Boolean(currentLogo && !logoFailed);

  useEffect(() => {
    let cancelled = false;
    const pendingCancels = new Set<() => void>();
    const checkImage = (url: string) => new Promise<boolean>(resolve => {
      const image = new Image();
      let finished = false;
      const finish = (valid: boolean) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        pendingCancels.delete(cancel);
        image.onload = null;
        image.onerror = null;
        resolve(valid);
      };
      const cancel = () => {
        finish(false);
        image.src = '';
      };
      pendingCancels.add(cancel);
      const timeout = setTimeout(() => finish(false), 5000);
      image.referrerPolicy = 'no-referrer';
      image.onload = () => finish(image.naturalWidth >= 1280 && image.naturalHeight > 0 && image.naturalWidth / image.naturalHeight >= 1.3);
      image.onerror = () => finish(false);
      image.src = url;
    });
    const findNext = async (start: number, exclude = -1): Promise<Slide | null> => {
      for (let offset = 0; offset < candidates.length && !cancelled; offset++) {
        const index = (start + offset) % candidates.length;
        if (index === exclude) continue;
        const item = candidates[index];
        const url = item.backdrop!;
        if (await checkImage(url)) return { item, index, url };
      }
      return null;
    };

    let interval: ReturnType<typeof setInterval> | null = null;
    const stopRotation = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    const startRotation = () => {
      if (interval || document.hidden || !currentRef.current || !nextRef.current) return;
      interval = setInterval(async () => {
        if (!nextRef.current) return;
        const next = nextRef.current;
        nextRef.current = null;
        setOutgoing(currentRef.current);
        currentRef.current = next;
        setCurrent(next);
        const prepared = await findNext(next.index + 1, next.index);
        if (!cancelled) {
          nextRef.current = prepared;
          if (!prepared) stopRotation();
        }
      }, TV_SCREENSAVER_SLIDE_MS);
    };
    const onVisibility = () => {
      if (document.hidden) stopRotation();
      else startRotation();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const start = async () => {
      const first = await findNext(0);
      if (cancelled) return;
      if (!first) {
        setNoBackdrop(true);
        return;
      }
      currentRef.current = first;
      setCurrent(first);
      if (candidates.length < 2) return;
      const prepared = await findNext(first.index + 1, first.index);
      if (cancelled) return;
      nextRef.current = prepared;
      startRotation();
    };
    void start();
    return () => {
      cancelled = true;
      pendingCancels.forEach(cancel => cancel());
      nextRef.current = null;
      currentRef.current = null;
      stopRotation();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [candidates]);

  return (
    <div data-tv-screensaver="true" aria-label="Descanso de tela ZapiTV" className="fixed inset-0 z-[1000] overflow-hidden bg-[#05070a] text-white pointer-events-auto">
      {current && (
        <>
          {outgoing && <img src={outgoing.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <img
            key={`${current.item.id}-${current.index}`}
            src={current.url}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover ${outgoing ? 'tv-screensaver-enter' : ''}`}
            onAnimationEnd={() => setOutgoing(null)}
          />

          {/* 1. Degradê Escuro Inferior Cinematográfico (Suaviza gradualmente de baixo para o centro, garantindo máxima legibilidade) */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(5,7,10,0.94) 0%, rgba(5,7,10,0.80) 16%, rgba(5,7,10,0.48) 34%, rgba(5,7,10,0.18) 52%, transparent 70%)'
            }}
          />

          {/* 2. Vinheta Superior Discreta para profundidade */}
          <div 
            className="absolute top-0 inset-x-0 h-[22%] pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(5,7,10,0.45) 0%, transparent 100%)'
            }}
          />

          {/* 3. Canto Inferior Esquerdo: Conjunto Fixo e Alinhado (Logo/Título + Categoria) */}
          <div
            data-testid="tv-screensaver-content-anchor"
            className="absolute bottom-[8%] left-[6%] w-[320px] sm:w-[420px] lg:w-[500px] max-w-[65vw] pointer-events-none flex flex-col justify-end"
          >
            {/* Área Superior com Altura e Largura Fixas para Logo ou Fallback de Texto */}
            <div
              key={current.item.id}
              data-testid="tv-screensaver-logo-area"
              className="h-[100px] sm:h-[120px] lg:h-[140px] w-full flex items-end justify-start overflow-hidden tv-screensaver-enter"
            >
              {hasLogo ? (
                <>
                  <h1 className="sr-only">{current.item.title}</h1>
                  <img
                    src={currentLogo!}
                    alt={current.item.title}
                    onError={() => setLogoFailed(true)}
                    className="max-h-full max-w-full object-contain object-left-bottom drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] filter"
                  />
                </>
              ) : (
                <h1 
                  className="w-full font-extrabold text-white tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] line-clamp-2 text-left"
                  style={{ fontSize: 'clamp(1.8rem, 2.8vw, 3.2rem)', lineHeight: 1.15 }}
                >
                  {current.item.title}
                </h1>
              )}
            </div>

            {/* Área Inferior com Espaçamento Fixo e Altura Constante para Categoria e Ano */}
            <div
              data-testid="tv-screensaver-category-area"
              className="mt-3 sm:mt-3.5 h-6 flex items-center gap-2 select-none"
            >
              <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-cyan-300 drop-shadow">
                {getCategoryLabel(current.item)}
              </span>
              {current.item.year ? (
                <>
                  <span className="text-gray-400 text-xs">•</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-300 drop-shadow">
                    {current.item.year}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* 4. Canto Inferior Direito: Logotipo Animado da ZapiTV (Absolutamente Estável) */}
      {!noBackdrop && (
        <div 
          data-testid="tv-screensaver-zapi-logo"
          className="absolute bottom-[8%] right-[6%] flex items-center gap-3 select-none pointer-events-none opacity-85"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center relative flex-shrink-0">
            <ZapiAnimatedLogo
              videoSrc="/zapi-icon.webm"
              muted
              playsInline
              className="w-full h-full object-contain pointer-events-none"
              alt="ZapiTV"
            />
          </div>
          <img
            src="/zapitv-text.png"
            alt="ZapiTV"
            className="h-6 sm:h-7 w-auto object-contain select-none drop-shadow-lg"
            style={{ transform: 'translateY(2px)' }}
            draggable={false}
          />
        </div>
      )}

      {/* Fallback sem backdrops disponíveis: logotipo ZapiTV centralizado */}
      {noBackdrop && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
            <ZapiAnimatedLogo
              videoSrc="/zapi-icon.webm"
              muted
              playsInline
              className="w-full h-full object-contain"
              alt="ZapiTV"
            />
          </div>
          <img
            src="/zapitv-text.png"
            alt="ZapiTV"
            className="h-9 sm:h-10 w-auto object-contain drop-shadow-xl"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
};
