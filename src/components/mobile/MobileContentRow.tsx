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
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const scrollStartX = useRef<number>(0);
  const lockDirection = useRef<'horizontal' | 'vertical' | null>(null);

  // Gerenciamento táctil com bloqueio direcional estrito (Directional Lock)
  // - Gestos horizontais: movem exclusivamente o carrossel, bloqueando saltos verticais da página
  // - Gestos verticais: deixam a rolagem vertical da página fluir normalmente
  // - Início do gesto sobre capas: nunca bloqueia a rolagem vertical da página
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      scrollStartX.current = el.scrollLeft;
      lockDirection.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      const dx = curX - touchStartX.current;
      const dy = curY - touchStartY.current;

      // Limiar inicial de 6px para detecção confiável de intenção direcional
      if (lockDirection.current === null) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          lockDirection.current = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
        }
      }

      if (lockDirection.current === 'horizontal') {
        // Bloqueia qualquer salto ou rolagem vertical indesejada durante o gesto horizontal
        if (e.cancelable) {
          e.preventDefault();
        }
        el.scrollLeft = scrollStartX.current - dx;
      }
      // Se lockDirection for 'vertical', deixa o scroll vertical nativo fluir livremente
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current !== null && lockDirection.current === 'horizontal') {
        const diff = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
        if (diff > 50) {
          uiSoundService.play('slide');
        }
      }
      touchStartX.current = null;
      touchStartY.current = null;
      lockDirection.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
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
        className="flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-4 py-1 will-change-scroll"
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
