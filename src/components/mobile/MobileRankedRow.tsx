import React, { useRef } from 'react';
import { Flame, Star } from 'lucide-react';
import { ContentItem } from '../../../types';
import { posterRecoveryService } from '../../core/catalog/PosterRecoveryService';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface MobileRankedRowProps {
  title: string;
  subtitle?: string;
  items: Array<{ item: ContentItem; rank: number } | ContentItem>;
  onItemClick: (item: ContentItem) => void;
  icon?: React.ComponentType<{ className?: string }>;
}

export const MobileRankedRow: React.FC<MobileRankedRowProps> = ({
  title,
  subtitle,
  items,
  onItemClick,
  icon: Icon = Flame
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  // Normaliza lista para { item, rank }
  const normalized = items.slice(0, 10).map((entry, idx) => {
    if ('rank' in entry && 'item' in entry) {
      return entry as { item: ContentItem; rank: number };
    }
    return { item: entry as ContentItem, rank: idx + 1 };
  });

  return (
    <section className="my-5 select-none" aria-label={title}>
      <div className="px-4 mb-2 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Icon className="w-4 h-4 text-[#007df7]" />
            <h3
              className="text-base sm:text-lg font-black text-white tracking-tight"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-4 overflow-x-auto no-scrollbar px-4 py-2 scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {normalized.map(({ item, rank }) => {
          const imgSrc = posterRecoveryService.getCachedPoster(item) || item.image || item.backdrop;
          const isTwoDigits = rank >= 10;

          return (
            <div
              key={`ranked-${item.id}-${rank}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                uiSoundService.play('click');
                onItemClick(item);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  uiSoundService.play('click');
                  onItemClick(item);
                }
              }}
              aria-label={`Posição ${rank}: ${item.title}`}
              className="relative flex items-end shrink-0 cursor-pointer active:scale-95 transition-transform group focus:outline-none"
              style={{ width: isTwoDigits ? '160px' : '150px' }}
            >
              {/* Número Gigante Estilizado Monumental Atrás da Capa */}
              <div
                className="select-none pointer-events-none font-black italic text-transparent absolute left-0 bottom-[-8px] z-0 leading-none"
                style={{
                  fontFamily: "'Sora', 'Impact', sans-serif",
                  fontSize: isTwoDigits ? '92px' : '106px',
                  WebkitTextStroke: '2px rgba(255, 255, 255, 0.4)',
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))'
                }}
              >
                {rank}
              </div>

              {/* Capa do Conteúdo Sobreposta */}
              <div
                className="relative z-10 w-[114px] xs:w-[124px] aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-white/10 shadow-xl ml-auto"
              >
                <img
                  src={imgSrc}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300';
                  }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                {item.rating > 0 && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-white/10">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    <span>{item.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
