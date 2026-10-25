import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, Trash2, User as UserIcon, Film, Tv, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ContentItem, ActorPerson, Profile } from '../../../types';
import { MobileCard } from './MobileCard';
import { searchService } from '../../core/search/searchService';
import { searchHistoryService } from '../../core/search/searchHistoryService';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface MobileSearchViewProps {
  allContent: ContentItem[];
  activeProfile?: Profile | null;
  onSelectContent: (item: ContentItem) => void;
}

export const MobileSearchView: React.FC<MobileSearchViewProps> = ({
  allContent,
  activeProfile,
  onSelectContent
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>(() => searchHistoryService.getHistory());
  const [localResults, setLocalResults] = useState<ContentItem[]>([]);
  const [remoteResults, setRemoteResults] = useState<ContentItem[]>([]);
  const [actors, setActors] = useState<ActorPerson[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [viewportBottomOffset, setViewportBottomOffset] = useState(0);

  // Foco automático do input ao abrir a tela
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Visual Viewport para compatibilidade estrita com Teclado Virtual no iOS e Android
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (!window.visualViewport) return;
      const windowHeight = window.innerHeight;
      const viewportHeight = window.visualViewport.height;
      const keyboardHeight = Math.max(0, windowHeight - viewportHeight);
      setViewportBottomOffset(keyboardHeight);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  // Busca instantânea local (< 1ms) e busca assíncrona desacoplada
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setLocalResults([]);
      setRemoteResults([]);
      setActors([]);
      setIsLoadingRemote(false);
      return;
    }

    // 1. Resposta local instantânea (0ms)
    const instant = searchService.searchLocalInstant(trimmed, 'all', allContent, activeProfile, 20);
    setLocalResults(instant);

    // 2. Consulta remota desacoplada em segundo plano
    let isCancelled = false;
    setIsLoadingRemote(true);

    const searchId = setTimeout(async () => {
      try {
        const res = await searchService.getSearchSuggestionsWithActors(
          trimmed,
          'all',
          12,
          allContent
        );
        if (!isCancelled) {
          setRemoteResults(res.items || []);
          setActors(res.actors || []);
          setIsLoadingRemote(false);
        }
      } catch {
        if (!isCancelled) setIsLoadingRemote(false);
      }
    }, 180);

    return () => {
      isCancelled = true;
      clearTimeout(searchId);
    };
  }, [query, allContent, activeProfile]);

  const handleClear = () => {
    uiSoundService.play('click');
    setQuery('');
    setLocalResults([]);
    setRemoteResults([]);
    setActors([]);
    inputRef.current?.focus();
  };

  const handleSelectHistoryItem = (term: string) => {
    uiSoundService.play('click');
    setQuery(term);
  };

  const handleClearHistory = () => {
    uiSoundService.play('click');
    searchHistoryService.clearHistory();
    setHistory([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      searchHistoryService.addSearch(trimmed);
      setHistory(searchHistoryService.getHistory());
      inputRef.current?.blur();
    }
  };

  // Consolida resultados locais com remotos sem duplicatas
  const displayItems = localResults.length > 0 ? localResults : remoteResults;

  return (
    <div
      data-testid="mobile-search-view"
      className="pt-16 pb-28 px-4 max-w-lg mx-auto flex flex-col min-h-screen"
      style={{ paddingBottom: `calc(7rem + ${viewportBottomOffset}px)` }}
    >
      {/* Barra de Pesquisa Fixa / Destaque */}
      <form onSubmit={handleSubmit} className="relative mb-4">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar filmes, séries, animes ou atores..."
            aria-label="Campo de pesquisa"
            className="w-full h-12 pl-10 pr-10 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-slate-400 text-sm font-medium focus:bg-white/15 focus:border-[#007df7] focus:outline-none transition-all shadow-inner"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpar texto da pesquisa"
              className="absolute right-3 p-1 rounded-full bg-white/10 text-slate-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Histórico Recente de Pesquisa (quando sem termo digitado) */}
      {query.trim().length < 2 && history.length > 0 && (
        <div className="mb-6 select-none animate-in fade-in">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-[#007df7]" />
              <span>Buscas Recentes</span>
            </div>
            <button
              type="button"
              onClick={handleClearHistory}
              aria-label="Limpar histórico de buscas"
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {history.map((term, idx) => (
              <button
                key={`hist-${term}-${idx}`}
                type="button"
                onClick={() => handleSelectHistoryItem(term)}
                className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/5 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <span>{term}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Artistas Encontrados */}
      {actors.length > 0 && (
        <div className="mb-6 animate-in fade-in">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#007df7] mb-3">
            <UserIcon className="w-3.5 h-3.5" />
            <span>Artistas ({actors.length})</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
            {actors.map(actor => (
              <button
                key={`actor-${actor.id}`}
                type="button"
                onClick={() => {
                  uiSoundService.play('click');
                  navigate(`/atores/${actor.id}`);
                }}
                className="flex flex-col items-center shrink-0 w-24 p-2 rounded-2xl bg-white/5 border border-white/5 active:scale-95 transition-transform"
              >
                <img
                  src={actor.image}
                  alt={actor.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#007df7]/40 ring-1 ring-white/10 mb-1.5 shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';
                  }}
                />
                <span className="text-[11px] font-bold text-white text-center line-clamp-1 w-full">
                  {actor.name}
                </span>
                <span className="text-[9px] text-slate-400 truncate w-full text-center">
                  {actor.knownForDepartment || 'Ator'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Produções Encontradas */}
      {displayItems.length > 0 && (
        <div className="flex-1 w-full animate-in fade-in">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
            <span>Resultados ({displayItems.length})</span>
            {isLoadingRemote && <span className="text-[#007df7] text-[10px] animate-pulse">Buscando mais...</span>}
          </div>

          <div
            className="w-full grid grid-cols-2 gap-3"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {displayItems.map((item, idx) => (
              <MobileCard
                key={`search-res-${item.id}-${idx}`}
                item={item}
                onItemClick={onSelectContent}
                variant="grid"
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado Vazio de Busca */}
      {query.trim().length >= 2 && displayItems.length === 0 && !isLoadingRemote && (
        <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
            <Search className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-white font-bold text-base mb-1">Nenhum resultado para "{query}"</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Verifique a ortografia ou tente pesquisar por outro título, ator ou gênero.
          </p>
        </div>
      )}
    </div>
  );
};
