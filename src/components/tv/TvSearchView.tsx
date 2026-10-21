import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { ContentItem } from '../../../types';
import { TvCard16x9 } from './TvCard16x9';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvSearchViewProps {
  allContent: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onClose: () => void;
}

export const TvSearchView: React.FC<TvSearchViewProps> = ({
  allContent,
  onSelectItem,
  onClose
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-search-screen',
    trackChildren: true
  });

  const { ref: inputFocusRef, focused: isInputFocused } = useTvFocusable({
    focusKey: 'tv-search-input',
    onEnterPress: () => {
      inputRef.current?.focus();
    }
  });

  // Registra manipulador do botão Voltar (Prioridade 100)
  useEffect(() => {
    const unregister = tvNavigationManager.registerBackHandler('tv-search-screen', 100, () => {
      onClose();
      return true;
    });

    const timer = setTimeout(() => {
      setFocus('tv-search-input');
    }, 100);

    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [onClose]);

  // Filtragem de resultados em tempo real
  const searchResults = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];

    return allContent.filter(item => {
      const matchTitle = item.title?.toLowerCase().includes(clean);
      const matchOriginal = item.originalTitle?.toLowerCase().includes(clean);
      const matchGenre = item.genres?.some(g => g.toLowerCase().includes(clean));
      return matchTitle || matchOriginal || matchGenre;
    }).slice(0, 30);
  }, [query, allContent]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div 
        ref={noriginRef as any}
        className="w-full min-h-screen pt-28 px-14 sm:px-16 pb-24 select-none"
      >
        {/* Barra de Pesquisa */}
        <div className="max-w-3xl mx-auto mb-10">
          <div
            ref={inputFocusRef}
            data-focus-key="tv-search-input"
            data-tv-focused={isInputFocused ? "true" : undefined}
            className={`flex items-center gap-4 bg-[#0d1422] px-7 py-4.5 rounded-2xl border transition-all duration-200 ${
              isInputFocused
                ? 'border-2 border-cyan-400 shadow-[0_0_25px_rgba(0,229,255,0.5)] scale-102'
                : 'border-2 border-white/15'
            }`}
          >
            <Search className={`w-7 h-7 ${isInputFocused ? 'text-cyan-400' : 'text-gray-400'}`} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o título, gênero ou palavra-chave..."
              className="flex-1 bg-transparent border-none outline-none text-white text-lg sm:text-xl placeholder-gray-500 font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Resultados da Busca (Sem contadores de quantidade nos cabeçalhos) */}
        {query.trim() ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-200">
                Resultados para "{query}"
              </h2>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {searchResults.map((item, idx) => (
                  <TvCard16x9
                    key={`search-${item.id}-${idx}`}
                    item={item}
                    onClick={onSelectItem}
                    focusKeyPrefix="search-res"
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-gray-500">
                <p className="text-base font-semibold">Nenhum título encontrado para "{query}".</p>
                <p className="text-xs text-gray-600 mt-1">Tente pesquisar com palavras diferentes.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 text-center text-gray-500">
            <p className="text-base font-semibold">Utilize o controle remoto ou teclado para buscar.</p>
            <p className="text-xs text-gray-600 mt-1">Busque filmes, séries, animes ou gêneros.</p>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
};
