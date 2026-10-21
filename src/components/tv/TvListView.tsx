import React, { useEffect, useMemo } from 'react';
import { Bookmark, Clock, ArrowLeft } from 'lucide-react';
import { ContentItem } from '../../../types';
import { TvCard16x9 } from './TvCard16x9';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTvFocusable } from '../../core/tv/useTvFocusable';

interface TvListViewProps {
  title: string;
  type: 'mylist' | 'history';
  items: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onBack: () => void;
}

export const TvListView: React.FC<TvListViewProps> = ({
  title,
  type,
  items,
  onSelectItem,
  onBack
}) => {
  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: `tv-list-${type}`,
    trackChildren: true
  });

  const { ref: backRef, focused: isBackFocused } = useTvFocusable({
    focusKey: 'tv-list-back',
    onEnterPress: onBack
  });

  useEffect(() => {
    const unregister = tvNavigationManager.registerBackHandler(`tv-list-${type}`, 100, () => {
      onBack();
      return true;
    });

    const timer = setTimeout(() => {
      if (items.length > 0) {
        setFocus(`card-list-${items[0].id}`);
      } else {
        setFocus('tv-list-back');
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [type, onBack, items]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div 
        ref={noriginRef as any}
        className="w-full min-h-screen pt-28 px-14 sm:px-16 pb-24 select-none"
      >
        {/* Cabeçalho da Lista (Sem contadores de quantidade de títulos) */}
        <div className="flex items-center gap-4 mb-8">
          <button
            ref={backRef}
            type="button"
            data-focus-key="tv-list-back"
            data-tv-focused={isBackFocused ? "true" : undefined}
            onClick={onBack}
            className={`p-3.5 rounded-2xl border transition-all duration-200 outline-none ${
              isBackFocused
                ? 'bg-cyan-500/25 text-cyan-300 border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.5)]'
                : 'bg-white/10 text-gray-200 border-2 border-white/15 hover:bg-white/15'
            }`}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {type === 'mylist' ? <Bookmark className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-wide">{title}</h1>
            </div>
          </div>
        </div>

        {/* Grade de Capas Verticais 2:3 */}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {items.map((item, idx) => (
              <TvCard16x9
                key={`list-${type}-${item.id}-${idx}`}
                item={item}
                onClick={onSelectItem}
                focusKeyPrefix="card-list"
                showProgress={type === 'history'}
              />
            ))}
          </div>
        ) : (
          <div className="py-28 text-center text-gray-500 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-gray-400">
              {type === 'mylist' ? <Bookmark className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
            </div>
            <p className="text-lg font-bold text-gray-300">
              {type === 'mylist' ? 'Sua lista está vazia' : 'Nenhum histórico recente'}
            </p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              {type === 'mylist'
                ? 'Explore o catálogo e adicione filmes ou séries para assistir mais tarde na sua TV.'
                : 'Os títulos que você reproduzir na Smart TV aparecerão aqui automaticamente.'}
            </p>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
};
