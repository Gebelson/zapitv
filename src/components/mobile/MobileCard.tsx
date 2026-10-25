import React, { memo, useState } from 'react';
import { Star, Play } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { storageService, PlaybackContinuityInfo } from '../../core/storage/storageService';
import { posterRecoveryService } from '../../core/catalog/PosterRecoveryService';
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
  const [imgSrc, setImgSrc] = useState<string>(() => {
    return posterRecoveryService.getCachedPoster(item) || item.image || item.backdrop || '';
  });
  const [hasError, setHasError] = useState(false);

  // Progresso de reprodução síncrono
  const continuity: PlaybackContinuityInfo = showProgress
    ? storageService.getPlaybackContinuity(item)
    : { hasStarted: false, isCompleted: false, percentage: 0 } as any;

  const handleClick = () => {
    uiSoundService.play('click');
    onItemClick(item);
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
        <img
          src={hasError ? 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300' : imgSrc}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => {
            if (!hasError && item.backdrop && imgSrc !== item.backdrop) {
              setImgSrc(item.backdrop);
            } else {
              setHasError(true);
            }
          }}
        />

        {/* Gradiente inferior para profundidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

        {/* Badge de tipo no topo esquerdo */}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white/90 border border-white/10">
          {typeBadge}
        </span>

        {/* Avaliação no topo direito se houver */}
        {item.rating > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-white/10">
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
