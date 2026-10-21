import React, { memo, useRef, useCallback } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { ContentItem } from '../../../types';
import { TvCard16x9 } from './TvCard16x9';

interface TvContentRowProps {
  title: string;
  items: ContentItem[];
  rowId: string;
  onItemClick: (item: ContentItem) => void;
  showProgress?: boolean;
  badge?: string;
  onRowUp?: () => void;
}

export const TvContentRow: React.FC<TvContentRowProps> = memo(({
  title,
  items,
  rowId,
  onItemClick,
  showProgress = false,
  badge,
  onRowUp
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: `row-${rowId}`,
    trackChildren: true,
    saveLastFocusedChild: true
  });

  const setRowRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as any).current = node;
    (noriginRef as any).current = node;
  }, [noriginRef]);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <section 
        ref={setRowRef}
        className="w-full mb-8 sm:mb-10 pl-14 sm:pl-16 pr-14 sm:pr-16 overflow-visible focus:outline-none"
        aria-label={title}
      >
        {/* Título da Fileira (Sem contadores de quantidade de títulos, estritamente limpo) */}
        <div className="flex items-center gap-3.5 mb-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow">
            {title}
          </h2>
          {badge && (
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {badge}
            </span>
          )}
        </div>

        {/* Trilho Horizontal com Capas Grandes Verticais 2:3 (5 a 6 capas visíveis na tela) */}
        <div 
          className="flex items-center gap-6 overflow-x-auto overflow-y-visible no-scrollbar py-6 sm:py-8 scroll-smooth"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {items.map((item, idx) => (
            <div 
              key={`${rowId}-${item.id}-${idx}`}
              className="flex-none w-[230px] sm:w-[255px] md:w-[270px] lg:w-[280px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <TvCard16x9
                item={item}
                onClick={onItemClick}
                showProgress={showProgress}
                focusKeyPrefix={`card-${rowId}`}
                priority={idx < 6}
                onUpPress={onRowUp}
              />
            </div>
          ))}
        </div>
      </section>
    </FocusContext.Provider>
  );
});

TvContentRow.displayName = 'TvContentRow';
