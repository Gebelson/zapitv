import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, X, Check } from 'lucide-react';
import { ContentItem } from '../../../types';
import { MobileCard } from './MobileCard';
import { ZapiLoader } from '../common/ZapiLoader';
import { searchService } from '../../core/search/searchService';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { uiSoundService } from '../../core/audio/uiSoundService';

export type ExploreCategory = 'movies' | 'series' | 'animes' | 'live' | 'all' | 'featured';

interface MobileExploreViewProps {
  initialCategory?: ExploreCategory;
  allContent: ContentItem[];
  featuredSelection?: any;
  onSelectContent: (item: ContentItem) => void;
  availableGenres?: string[];
  isGenreMenuOpen?: boolean;
  onToggleGenreMenu?: (isOpen: boolean) => void;
  onLoadMore?: (category: 'movies' | 'series' | 'animes') => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  selectedGenreProp?: string;
  onSelectGenre?: (genre: string) => void;
  onCategoryChange?: (category: 'movies' | 'series' | 'animes') => void;
}

export const MobileExploreView: React.FC<MobileExploreViewProps> = ({
  initialCategory = 'movies',
  allContent,
  onSelectContent,
  isGenreMenuOpen: controlledGenreMenuOpen,
  onToggleGenreMenu,
  onLoadMore,
  hasMore = true,
  isLoadingMore = false,
  selectedGenreProp,
  onSelectGenre,
  onCategoryChange
}) => {
  const navigate = useNavigate();

  // Mapeia categorias legadas ('all', 'featured') para a categoria padrão 'movies'
  const resolveCategory = (cat: ExploreCategory): 'movies' | 'series' | 'animes' => {
    if (cat === 'series') return 'series';
    if (cat === 'animes') return 'animes';
    return 'movies';
  };

  const [selectedCategory, setSelectedCategory] = useState<'movies' | 'series' | 'animes'>(
    resolveCategory(initialCategory)
  );
  const [selectedGenre, setSelectedGenre] = useState<string>(
    selectedGenreProp || 'Todos os gêneros'
  );
  const [internalGenreMenuOpen, setInternalGenreMenuOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sincroniza gênero externo se modificado no app
  useEffect(() => {
    if (selectedGenreProp) {
      setSelectedGenre(selectedGenreProp === 'Todos' ? 'Todos os gêneros' : selectedGenreProp);
    }
  }, [selectedGenreProp]);

  // Infinite Scroll Observer para o fim do catálogo mobile
  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;
    const target = sentinelRef.current;
    if (!target) return;

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore(selectedCategory);
        }
      }, { rootMargin: '600px', threshold: 0.01 });

      observer.observe(target);
      return () => observer.disconnect();
    }
  }, [hasMore, isLoadingMore, onLoadMore, selectedCategory]);

  const isMenuOpen = controlledGenreMenuOpen !== undefined ? controlledGenreMenuOpen : internalGenreMenuOpen;

  // Sincroniza categoria inicial vinda de rota
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(resolveCategory(initialCategory));
    }
  }, [initialCategory]);

  // Lista dos 4 quadros fixos de navegação (Grid 2x2)
  const exploreCards = [
    { id: 'movies' as const, label: 'Filmes' },
    { id: 'series' as const, label: 'Séries' },
    { id: 'animes' as const, label: 'Animes' },
    { id: 'live' as const, label: 'TV ao vivo' }
  ];

  // Gêneros disponíveis calculados dinamicamente com base nos itens da categoria atual
  const categoryGenres = useMemo(() => {
    let items = allContent;
    if (selectedCategory === 'movies') {
      items = items.filter(it => searchService.isMovieItem(it));
    } else if (selectedCategory === 'series') {
      items = items.filter(it => searchService.isSeriesItem(it) && !searchService.isAnimeItem(it));
    } else if (selectedCategory === 'animes') {
      items = items.filter(it => searchService.isAnimeItem(it));
    }

    const genreSet = new Set<string>();
    items.forEach(it => {
      it.genres?.forEach(g => {
        const clean = g?.trim();
        if (clean && clean.toLowerCase() !== 'todos' && clean.toLowerCase() !== 'all') {
          genreSet.add(clean);
        }
      });
    });

    const sorted = Array.from(genreSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const fallbackList = [
      'Ação', 'Animação', 'Aventura', 'Comédia', 'Crime',
      'Documentários', 'Drama', 'Fantasia', 'Ficção Científica',
      'Mistério', 'Romance', 'Suspense', 'Terror'
    ];

    const list = sorted.length > 0 ? sorted : fallbackList;
    return ['Todos os gêneros', ...list];
  }, [allContent, selectedCategory]);

  // Gerenciamento de abertura/fechamento do menu de gêneros em tela cheia
  const setMenuState = useCallback((open: boolean) => {
    setInternalGenreMenuOpen(open);
    if (onToggleGenreMenu) {
      onToggleGenreMenu(open);
    }
    if (open) {
      document.body.style.overflow = 'hidden';
      // Registra entrada de histórico para suportar botão Voltar do dispositivo
      window.history.pushState({ genreMenuOpen: true }, '');
    } else {
      document.body.style.overflow = '';
    }
  }, [onToggleGenreMenu]);

  const handleOpenGenreMenu = () => {
    uiSoundService.play('click');
    setMenuState(true);
  };

  const handleCloseGenreMenu = useCallback((shouldPopHistory: boolean = true) => {
    uiSoundService.play('close');
    setMenuState(false);
    if (shouldPopHistory && window.history.state?.genreMenuOpen) {
      window.history.back();
    }
  }, [setMenuState]);

  // Suporte a teclado (Escape) e botão Voltar físico/navegador (popstate)
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseGenreMenu();
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      // Quando o usuário pressiona Voltar no Android, fecha o menu sem navegar
      handleCloseGenreMenu(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen, handleCloseGenreMenu]);

  // Seleção de um gênero pelo usuário
  const handleSelectGenre = (genre: string) => {
    uiSoundService.play('click');
    setSelectedGenre(genre);
    if (onSelectGenre) {
      onSelectGenre(genre === 'Todos os gêneros' ? 'Todos' : genre);
    }
    handleCloseGenreMenu();
  };

  // Troca de categoria com verificação de validade do gênero atual
  const handleSelectCategory = (catId: 'movies' | 'series' | 'animes' | 'live') => {
    uiSoundService.play('click');
    if (catId === 'live') {
      navigate('/programas');
      return;
    }

    setSelectedCategory(catId);
    if (onCategoryChange) {
      onCategoryChange(catId);
    }
    navigate(catId === 'movies' ? '/filmes' : catId === 'series' ? '/series' : '/animes', { replace: true });

    // Verifica se o gênero atual permanece válido na nova categoria selecionada
    if (selectedGenre && selectedGenre !== 'Todos os gêneros') {
      const nextCategoryItems = allContent.filter(it => {
        if (catId === 'movies') return searchService.isMovieItem(it);
        if (catId === 'series') return searchService.isSeriesItem(it) && !searchService.isAnimeItem(it);
        if (catId === 'animes') return searchService.isAnimeItem(it);
        return false;
      });

      const hasGenre = nextCategoryItems.some(it => it.genres?.includes(selectedGenre));
      if (!hasGenre) {
        setSelectedGenre('Todos os gêneros');
      }
    }
  };

  // Filtra itens com estrita separação de categorias e gêneros
  const filteredItems = useMemo(() => {
    let items = allContent;

    if (selectedCategory === 'movies') {
      items = items.filter(it => searchService.isMovieItem(it));
    } else if (selectedCategory === 'series') {
      items = items.filter(it => searchService.isSeriesItem(it) && !searchService.isAnimeItem(it));
    } else if (selectedCategory === 'animes') {
      items = items.filter(it => searchService.isAnimeItem(it));
    }

    if (selectedGenre && selectedGenre !== 'Todos os gêneros' && selectedGenre !== 'Todos') {
      items = items.filter(it => it.genres?.includes(selectedGenre));
    }

    return deduplicateContentItems(catalogEligibilityService.filterEligibleItemsSync(items));
  }, [allContent, selectedCategory, selectedGenre]);

  const currentCategoryLabel =
    selectedCategory === 'movies' ? 'Filmes' : selectedCategory === 'series' ? 'Séries' : 'Animes';

  return (
    <div className="pt-16 pb-28 px-4 w-full max-w-lg mx-auto select-none" data-testid="mobile-explore-view">
      {/* 1. Título da Seção (Apenas "Explorar" com borda fina horizontal, sem subtítulo) */}
      <div className="mb-4">
        <h1
          className="text-2xl font-black text-white tracking-tight pb-3 border-b border-white/10"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Explorar
        </h1>
      </div>

      {/* 2. Quatro Quadros Fixos de Navegação (Grade 2x2 Minimalista) */}
      <div
        data-testid="explore-categories-grid"
        className="grid grid-cols-2 gap-3 mb-4 w-full"
        style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
      >
        {exploreCards.map(card => {
          const isSelected = selectedCategory === card.id;

          return (
            <button
              key={card.id}
              type="button"
              data-testid={`explore-category-${card.id}`}
              onClick={() => handleSelectCategory(card.id)}
              className={`flex items-center justify-center p-3 sm:p-3.5 rounded-2xl transition-all duration-200 cursor-pointer select-none text-center min-h-[52px] ${
                isSelected
                  ? 'bg-gradient-to-br from-[#007df7]/20 to-[#007df7]/10 border-2 border-[#007df7] shadow-[0_0_20px_rgba(0,125,247,0.25)] text-white'
                  : 'bg-[#07090E]/90 border border-white/10 hover:border-white/20 text-slate-300 active:scale-[0.98]'
              }`}
            >
              <span
                className="text-sm sm:text-base font-bold tracking-tight"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                {card.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Barra de Seleção de Gêneros (Estilo Prime Video) */}
      <button
        type="button"
        data-testid="explore-genre-bar"
        onClick={handleOpenGenreMenu}
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        aria-label="Selecionar gênero"
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 transition-colors mb-5 cursor-pointer text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Gênero:</span>
          <span className="text-sm font-semibold text-white tracking-wide">
            {selectedGenre}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-white transition-colors">
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* 4. Grid de Conteúdos do Catálogo (Sem contadores de títulos) */}
      <div className="w-full" data-testid="explore-content-grid">
        <div
          className="w-full grid grid-cols-2 gap-3"
          style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
        >
          {filteredItems.map(item => (
            <MobileCard
              key={`explore-grid-${item.id}`}
              item={item}
              onItemClick={onSelectContent}
              variant="grid"
            />
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="py-20 text-center text-slate-400 text-sm">
            <p>Nenhum título encontrado para o gênero selecionado.</p>
          </div>
        )}

        {/* Sentinela de Rolagem Infinita e Indicador de Carregamento Mobile */}
        {hasMore && (
          <div ref={sentinelRef} className="col-span-2 flex justify-center py-6 min-h-[48px] select-none">
            {isLoadingMore && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-bold shadow-lg backdrop-blur-md">
                <ZapiLoader size="sm" />
                <span>Carregando mais conteúdos...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Menu de Gêneros em Tela Cheia (Renderizado via Portal em document.body) */}
      {isMenuOpen &&
        createPortal(
          <div
            data-testid="mobile-genre-fullscreen-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de seleção de gêneros"
            className="fixed inset-0 z-[999] bg-[#07090E] w-screen h-screen flex flex-col select-none overflow-hidden"
          >
            {/* Cabeçalho do Menu de Gêneros */}
            <div className="pt-[max(1.5rem,env(safe-area-inset-top,0px))] px-6 pb-4 border-b border-white/10 shrink-0">
              <span className="text-xs font-semibold text-[#007df7] uppercase tracking-wider block">
                {currentCategoryLabel}
              </span>
              <h2
                className="text-xl font-black text-white tracking-tight mt-0.5"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Selecione um gênero
              </h2>
            </div>

            {/* Lista Vertical de Gêneros */}
            <div
              data-testid="mobile-genre-list"
              className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-white/5 pb-28"
            >
              {categoryGenres.map(genre => {
                const isSelected = selectedGenre === genre;

                return (
                  <button
                    key={genre}
                    type="button"
                    data-testid={`genre-option-${genre}`}
                    onClick={() => handleSelectGenre(genre)}
                    className={`w-full py-4 px-3 flex items-center justify-between text-left rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? 'text-[#007df7] font-bold bg-[#007df7]/10'
                        : 'text-slate-200 hover:text-white font-medium hover:bg-white/5'
                    }`}
                  >
                    <span className="text-base tracking-tight">{genre}</span>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#007df7] flex items-center justify-center text-white shrink-0 shadow-sm">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Gradiente sutil inferior para contraste */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#07090E] via-[#07090E]/80 to-transparent z-20" />

            {/* Botão de Fechar Centralizado */}
            <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
              <button
                type="button"
                data-testid="close-genre-menu-btn"
                onClick={() => handleCloseGenreMenu()}
                aria-label="Fechar menu de gêneros"
                className="w-13 h-13 rounded-full bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center border border-white/20 shadow-2xl backdrop-blur-md cursor-pointer transition-all"
              >
                <X className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
