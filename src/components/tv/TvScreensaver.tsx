import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ContentItem } from '../../../types';

export const TV_SCREENSAVER_SLIDE_MS = 15_000;

interface Slide {
  item: ContentItem;
  index: number;
  url: string;
}

/** Exibe no máximo duas imagens durante o crossfade; mantém apenas a próxima pré-carregada. */
export const TvScreensaver: React.FC<{ items: ContentItem[] }> = ({ items }) => {
  const candidates = useMemo(() => items.filter(item => Boolean(item.backdrop)), [items]);
  const [current, setCurrent] = useState<Slide | null>(null);
  const [outgoing, setOutgoing] = useState<Slide | null>(null);
  const [noBackdrop, setNoBackdrop] = useState(false);
  const nextRef = useRef<Slide | null>(null);
  const currentRef = useRef<Slide | null>(null);

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

  const drift = current ? (current.index % 4) * 0.6 : 0;
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a]/80 via-transparent to-[#05070a]/35" />
          <div className="absolute bottom-[10%] left-[6%] max-w-[70vw]" style={{ transform: `translateX(${drift}vw)` }}>
            <h1 className="font-extrabold drop-shadow-lg line-clamp-2" style={{ fontSize: 'clamp(2.5rem, 3vw, 7rem)' }}>{current.item.title}</h1>
          </div>
        </>
      )}
      <img
        src="/zapitv-logo-full.svg"
        alt="ZapiTV"
        className={`absolute h-auto object-contain opacity-75 ${noBackdrop ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'top-[6%] left-[6%]'}`}
        style={noBackdrop ? { width: 'clamp(12rem, 14vw, 22rem)' } : { width: 'clamp(7rem, 8vw, 16rem)', transform: `translateX(${drift}vw)` }}
      />
    </div>
  );
};
