import React, { useRef } from 'react';
import { ContentItem } from '../../../types';
import { MobileCard } from './MobileCard';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface MobileContentRowProps {
  title: string;
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
  showProgress?: boolean;
}

export const MobileContentRow: React.FC<MobileContentRowProps> = ({
  title,
  items,
  onItemClick,
  showProgress = false
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <section className="my-4 sm:my-6 select-none" aria-label={title}>
      {/* Cabeçalho da Linha */}
      <div className="px-4 mb-2 flex items-center justify-between">
        <h3
          className="text-base sm:text-lg font-black text-white tracking-tight"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          {title}
        </h3>
      </div>

      {/* Trilho de Cards com Scroll Horizontal Táctil */}
      <div
        ref={rowRef}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current !== null) {
            const diff = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
            if (diff > 50) {
              uiSoundService.play('slide');
            }
          }
          touchStartX.current = null;
        }}
        className="flex gap-3 overflow-x-auto no-scrollbar px-4 py-1 scroll-smooth will-change-scroll"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, idx) => (
          <MobileCard
            key={`mobile-row-${item.id}-${idx}`}
            item={item}
            onItemClick={onItemClick}
            showProgress={showProgress}
          />
        ))}
      </div>
    </section>
  );
};
