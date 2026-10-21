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
        className="w-full mb-6 sm:mb-8 pl-8 sm:pl-12 md:pl-16 pr-6 overflow-visible focus:outline-none"
        aria-label={title}
      >
        {/* Título da Fileira */}
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide drop-shadow">
            {title}
          </h2>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {badge}
            </span>
          )}
          <span className="text-xs font-medium text-gray-500 ml-auto mr-8">
            {items.length} títulos
          </span>
        </div>

        {/* Trilho Horizontal com 16:9 Cards */}
        <div 
          className="flex items-center gap-4 sm:gap-5 overflow-x-auto overflow-y-visible no-scrollbar py-3 scroll-smooth"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {items.map((item, idx) => (
            <div 
              key={`${rowId}-${item.id}-${idx}`}
              className="flex-none w-[240px] sm:w-[280px] md:w-[320px] lg:w-[350px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <TvCard16x9
                item={item}
                onClick={onItemClick}
                showProgress={showProgress}
                focusKeyPrefix={`card-${rowId}`}
                priority={idx < 5}
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
