import React, { useRef, useEffect } from 'react';
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
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const start = (event: TouchEvent) => {
      if (event.touches.length === 1) gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, moved: false };
    };
    const move = (event: TouchEvent) => {
      const point = event.touches[0], current = gesture.current;
      if (point && current && Math.hypot(point.clientX - current.x, point.clientY - current.y) > 8) current.moved = true;
    };
    const end = (event: TouchEvent) => {
      const point = event.changedTouches[0], current = gesture.current;
      if (point && current?.moved && Math.abs(point.clientX - current.x) > 50) uiSoundService.play('slide');
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
    };
  }, []);

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

      {/* Trilho de Cards com Scroll Horizontal Táctil e Bloqueio Direcional */}
      <div
        ref={rowRef}
        onClickCapture={event => {
          if (gesture.current?.moved) {
            event.preventDefault(); event.stopPropagation(); gesture.current = null;
          }
        }}
        className="flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-4 py-1"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'auto'
        }}
      >
        {items.map((item, idx) => (
          <MobileCard
            key={`mobile-row-${item.id}-${idx}`}
            item={item}
            onItemClick={onItemClick}
            showProgress={showProgress}
            variant="carousel"
          />
        ))}
      </div>
    </section>
  );
};
