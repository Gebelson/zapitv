import React, { useState, useMemo } from 'react';
import { Film, Tv, Flame, Sparkles, Layers, Filter } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { MobileCard } from './MobileCard';
import { MobileRankedRow } from './MobileRankedRow';
import { searchService } from '../../core/search/searchService';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { uiSoundService } from '../../core/audio/uiSoundService';

export type ExploreCategory = 'all' | 'movies' | 'series' | 'animes' | 'featured';

interface MobileExploreViewProps {
  initialCategory?: ExploreCategory;
  allContent: ContentItem[];
  featuredSelection?: any;
  onSelectContent: (item: ContentItem) => void;
  availableGenres?: string[];
}

export const MobileExploreView: React.FC<MobileExploreViewProps> = ({
  initialCategory = 'all',
  allContent,
  featuredSelection,
  onSelectContent,
  availableGenres = [
    'Todos', 'Ação', 'Animação', 'Aventura', 'Comédia', 'Crime',
    'Documentários', 'Drama', 'Fantasia', 'Ficção Científica',
    'Mistério', 'Romance', 'Suspense', 'Terror'
  ]
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ExploreCategory>(initialCategory);
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');

  const categories: Array<{ id: ExploreCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'all', label: 'Todos', icon: Layers },
    { id: 'movies', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Tv },
    { id: 'animes', label: 'Animes', icon: Sparkles },
    { id: 'featured', label: 'Em Destaque', icon: Flame }
  ];

  // Filtra itens com estrita separação de categorias
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'featured') {
      return []; // Exibido por rankings dedicados abaixo
    }

    let items = allContent;

    // Filtro por categoria
    if (selectedCategory === 'movies') {
      items = items.filter(it => searchService.isMovieItem(it));
    } else if (selectedCategory === 'series') {
      items = items.filter(it => searchService.isSeriesItem(it) && !searchService.isAnimeItem(it));
    } else if (selectedCategory === 'animes') {
      items = items.filter(it => searchService.isAnimeItem(it));
    }

    // Filtro por gênero
    if (selectedGenre && selectedGenre !== 'Todos') {
      items = items.filter(it => it.genres?.includes(selectedGenre));
    }

    return deduplicateContentItems(catalogEligibilityService.filterEligibleItemsSync(items));
  }, [allContent, selectedCategory, selectedGenre]);

  return (
    <div className="pt-16 pb-28 px-4 max-w-lg mx-auto select-none" data-testid="mobile-explore-view">
      {/* Título da Seção */}
      <div className="mb-3">
        <h2
          className="text-2xl font-black text-white tracking-tight"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Explorar
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Catálogo completo por tipo de mídia e gênero
        </p>
      </div>

      {/* Chips de Categoria Horizontal */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5 mb-2.5">
        {categories.map(cat => {
          const isActive = selectedCategory === cat.id;
          const Icon = cat.icon;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                uiSoundService.play('click');
                setSelectedCategory(cat.id);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/30 scale-[1.02]'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chips de Gênero Horizontal (se não for Em Destaque) */}
      {selectedCategory !== 'featured' && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-4">
          {availableGenres.map(genre => {
            const isGenreActive = selectedGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => {
                  uiSoundService.play('click');
                  setSelectedGenre(genre);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all cursor-pointer ${
                  isGenreActive
                    ? 'bg-white/20 text-white font-bold border border-white/30'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      )}

      {/* Exibição: Em Destaque (Rankings Mensais) */}
      {selectedCategory === 'featured' ? (
        <div className="space-y-6 pt-2">
          {featuredSelection?.featuredMovies && featuredSelection.featuredMovies.length > 0 && (
            <MobileRankedRow
              title="Top 10 Filmes do Mês"
              items={featuredSelection.featuredMovies.slice(0, 10)}
              onItemClick={onSelectContent}
              icon={Film}
            />
          )}

          {featuredSelection?.featuredSeries && featuredSelection.featuredSeries.length > 0 && (
            <MobileRankedRow
              title="Top 10 Séries do Mês"
              items={featuredSelection.featuredSeries.slice(0, 10)}
              onItemClick={onSelectContent}
              icon={Tv}
            />
          )}

          {featuredSelection?.featuredAnimes && featuredSelection.featuredAnimes.length > 0 && (
            <MobileRankedRow
              title="Top 10 Animes do Mês"
              items={featuredSelection.featuredAnimes.slice(0, 10)}
              onItemClick={onSelectContent}
              icon={Sparkles}
            />
          )}
        </div>
      ) : (
        /* Grid de Resultados do Catálogo */
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
            <span>{filteredItems.length} títulos encontrados</span>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
            {filteredItems.map(item => (
              <MobileCard
                key={`explore-grid-${item.id}`}
                item={item}
                onItemClick={onSelectContent}
              />
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="py-20 text-center text-slate-400 text-sm">
              <p>Nenhum título encontrado com os filtros selecionados.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
