import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Star, Play } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { storageService, PlaybackContinuityInfo } from '../../core/storage/storageService';
import { posterRecoveryService, isCorruptedPosterUrl } from '../../core/catalog/PosterRecoveryService';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface MobileCardProps {
  item: ContentItem;
  onItemClick: (item: ContentItem) => void;
  showProgress?: boolean;
  rankNumber?: number;
  variant?: 'carousel' | 'grid';
  className?: string;
}

export const MobileCard: React.FC<MobileCardProps> = memo(({
  item,
  onItemClick,
  showProgress = true,
  rankNumber,
  variant = 'grid',
  className = ''
}) => {
  const getInitialPoster = (targetItem: ContentItem): string => {
    if (!targetItem) return '';
    const cached = posterRecoveryService.getCachedPoster(targetItem);
    if (cached && !isCorruptedPosterUrl(cached)) return cached;
    const direct = targetItem.image || targetItem.poster || targetItem.backdrop || '';
    if (direct && !isCorruptedPosterUrl(direct)) return direct;
    return '';
  };

  const initialPoster = getInitialPoster(item);
  const [prevItemId, setPrevItemId] = useState(item.id);
  const [imgSrc, setImgSrc] = useState<string>(initialPoster);
  const [hasError, setHasError] = useState<boolean>(!initialPoster);

  const isMountedRef = useRef(true);
  const currentItemIdRef = useRef(item.id);
  currentItemIdRef.current = item.id;
  const isRecoveringRef = useRef(false);
  const generationRef = useRef(0);
  const recoveryAttemptsRef = useRef(0);
  const failedUrlsRef = useRef<Set<string>>(new Set());

  // Sincronização síncrona no render na reciclagem ou troca de item
  if (prevItemId !== item.id) {
    setPrevItemId(item.id);
    generationRef.current++;
    recoveryAttemptsRef.current = 0;
    failedUrlsRef.current.clear();
    isRecoveringRef.current = false;
    const nextPoster = getInitialPoster(item);
    setImgSrc(nextPoster);
    setHasError(!nextPoster);
  }

  // Progresso de reprodução síncrono
  const continuity: PlaybackContinuityInfo = showProgress
    ? storageService.getPlaybackContinuity(item)
    : { hasStarted: false, isCompleted: false, percentage: 0 } as any;

  const handleClick = () => {
    uiSoundService.play('click');
    onItemClick(item);
  };

  // Acionamento central de recuperação de poster via posterRecoveryService
  const triggerRecovery = useCallback(async () => {
    if (isRecoveringRef.current || !item) return;

    // Limite de segurança de 3 tentativas por ciclo de vida do item para evitar loops
    if (recoveryAttemptsRef.current >= 3) {
      setHasError(true);
      return;
    }

    const activeId = item.id;
    const activeGen = generationRef.current;
    recoveryAttemptsRef.current++;
    isRecoveringRef.current = true;

    try {
      const recovered = await posterRecoveryService.recoverPoster(item);
      if (!isMountedRef.current || currentItemIdRef.current !== activeId || generationRef.current !== activeGen) {
        return;
      }

      if (recovered && !isCorruptedPosterUrl(recovered) && !failedUrlsRef.current.has(recovered)) {
        setImgSrc(recovered);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch {
      if (isMountedRef.current && currentItemIdRef.current === activeId && generationRef.current === activeGen) {
        setHasError(true);
      }
    } finally {
      isRecoveringRef.current = false;
    }
  }, [item]);

  // Recuperação proativa se o card iniciar sem imagem
  useEffect(() => {
    isMountedRef.current = true;
    if (hasError && !isRecoveringRef.current && recoveryAttemptsRef.current === 0) {
      triggerRecovery();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [hasError, item.id, triggerRecovery]);

  // Listener para sincronizar assim que uma capa for descoberta em segundo plano
  useEffect(() => {
    const unsubscribe = posterRecoveryService.subscribe((recoveredItemId, newUrl) => {
      if (!isMountedRef.current || currentItemIdRef.current !== item.id) return;
      const isMatch = recoveredItemId === item.id || (item.imdbId && recoveredItemId === item.imdbId);
      if (isMatch && newUrl && !isCorruptedPosterUrl(newUrl) && !failedUrlsRef.current.has(newUrl)) {
        setImgSrc(newUrl);
        setHasError(false);
      }
    });
    return unsubscribe;
  }, [item.id, item.imdbId]);

  // Tratamento de falha de carregamento de imagem: reporta falha, tenta alternativas locais e dispara recuperação
  const handleImgError = (e?: React.SyntheticEvent<HTMLImageElement>) => {
    if (e?.currentTarget && e.currentTarget.getAttribute('data-item-id') !== String(item.id)) {
      return;
    }

    if (imgSrc) {
      failedUrlsRef.current.add(imgSrc);
      posterRecoveryService.reportImageFailure(item, imgSrc);
    }

    const cached = posterRecoveryService.getCachedPoster(item);
    const candidates = [
      cached || '',
      item.poster || '',
      item.backdrop || '',
      ...(Array.isArray(item.images) ? item.images : []),
      ...(Array.isArray(item.backdrops) ? item.backdrops : [])
    ].filter((url): url is string => Boolean(url && typeof url === 'string' && url.startsWith('http') && !isCorruptedPosterUrl(url)));

    const nextCandidate = candidates.find(url => url !== imgSrc && !failedUrlsRef.current.has(url));

    if (nextCandidate) {
      setImgSrc(nextCandidate);
      setHasError(false);
    } else {
      setHasError(true);
      triggerRecovery();
    }
  };

  const isAnime = item.type === ContentType.ANIME || item.genres?.includes('Anime');
  const typeBadge = isAnime ? 'Anime' : item.type === ContentType.SERIES ? 'Série' : 'Filme';

  const sizeClasses = variant === 'carousel'
    ? 'shrink-0 w-[122px] xs:w-[132px]'
    : 'w-full min-w-0 max-w-full';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${item.title} (${item.year})`}
      className={`group relative flex flex-col select-none cursor-pointer active:scale-95 transition-transform duration-150 focus:outline-none ${sizeClasses} ${className}`}
    >
      {/* Pôster com proporção 2:3 */}
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-white/10 shadow-md">
        {!hasError && imgSrc ? (
          <img
            key={`${item.id}-${imgSrc}`}
            data-item-id={item.id}
            src={imgSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={handleImgError}
          />
        ) : (
          /* Placeholder Neutro e Elegante com Identidade ZapiTV (Sem capas genéricas externas) */
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#090d16] to-[#030712] p-3 text-center">
            <div className="w-10 h-10 rounded-full bg-[#007df7]/15 border border-[#007df7]/30 flex items-center justify-center mb-2 shadow-inner">
              <Play className="w-4 h-4 text-[#007df7] fill-[#007df7] ml-0.5" />
            </div>
            <span className="text-[11px] font-bold text-slate-200 line-clamp-2 px-1 leading-tight tracking-tight">
              {item.title}
            </span>
          </div>
        )}

        {/* Gradiente inferior para profundidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />

        {/* Badge de tipo no topo esquerdo */}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white/90 border border-white/10 pointer-events-none">
          {typeBadge}
        </span>

        {/* Avaliação no topo direito se houver */}
        {item.rating > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-white/10 pointer-events-none">
            <Star className="w-2.5 h-2.5 fill-amber-400" />
            <span>{item.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Barra de progresso para Continuar Assistindo */}
        {continuity.hasStarted && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-[#007df7] transition-all"
              style={{ width: `${Math.min(100, Math.max(5, continuity.percentage))}%` }}
            />
          </div>
        )}
      </div>

      {/* Rótulo inferior com título e metadados */}
      <div className="mt-1.5 px-0.5 flex flex-col w-full min-w-0">
        <h4 className="text-xs font-semibold text-slate-100 line-clamp-1 leading-snug group-hover:text-[#007df7] transition-colors">
          {item.title}
        </h4>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
          <span>{item.year}</span>
          {continuity.hasStarted && continuity.label && (
            <span className="text-[#007df7] font-semibold truncate">• {continuity.label}</span>
          )}
        </div>
      </div>
    </div>
  );
});

MobileCard.displayName = 'MobileCard';
