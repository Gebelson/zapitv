/**
 * ZapiTV — PÁGINA EXCLUSIVA DE ATOR / ATRIZ
 * 
 * Exibe a foto circular oficial do artista em destaque, seu nome alinhado ao lado,
 * biografia oficial e sua filmografia completa organizada em Filmes e Séries.
 * 
 * Regras:
 * 1. Utiliza os créditos oficiais do TMDB (person/{id}/combined_credits).
 * 2. Valida disponibilidade no catálogo do ZapiTV via CatalogEligibilityService (sem CAM, sem em cartaz 2026).
 * 3. Permite ordenação por relevância e por ano de lançamento.
 * 4. Carregamento progressivo para navegação fluida sem limites artificiais.
 * 5. Ao clicar no card, abre a janela de detalhes no próprio contexto.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Film, Tv, Star, Calendar, Sparkles, Filter, ChevronDown, User as UserIcon } from 'lucide-react';
import { ContentItem, ContentType, ActorPerson, Profile } from '../../types';
import { tmdbService } from '../core/tmdb/tmdbClient';
import { catalogEligibilityService } from '../core/catalog/CatalogEligibilityService';
import { theatricalFilterService } from '../core/catalog/theatricalFilterService';
import { deduplicateContentItems } from '../core/catalog/catalogDeduplication';
import { adultContentService } from '../core/adult/AdultContentService';
import ContentCard from '../../components/ContentCard';
import { ZapiLoader } from '../components/common/ZapiLoader';

interface ActorViewProps {
  actorId: string;
  isDarkMode: boolean;
  onSelectContent: (item: ContentItem) => void;
  favorites: string[];
  myList: string[];
  toggleFavorite: (e: React.MouseEvent, id: string) => void;
  toggleMyList: (e: React.MouseEvent, id: string) => void;
  activeProfile: Profile | null;
  onBack?: () => void;
}

type TabType = 'all' | 'movies' | 'series';
type SortType = 'relevant' | 'newest' | 'oldest';

const PAGE_CHUNK_SIZE = 24;

export const ActorView: React.FC<ActorViewProps> = ({
  actorId,
  isDarkMode,
  onSelectContent,
  favorites,
  myList,
  toggleFavorite,
  toggleMyList,
  activeProfile,
  onBack
}) => {
  const [actor, setActor] = useState<ActorPerson | null>(null);
  const [allCredits, setAllCredits] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de visualização
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [sortBy, setSortBy] = useState<SortType>('relevant');
  const [visibleCount, setVisibleCount] = useState(PAGE_CHUNK_SIZE);
  const [showFullBio, setShowFullBio] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchActorData = async () => {
      setIsLoading(true);
      setError(null);
      setVisibleCount(PAGE_CHUNK_SIZE);

      try {
        const cleanId = String(actorId).replace(/^tmdb-actor-?/i, '').trim();
        const [actorData, creditsData] = await Promise.all([
          tmdbService.getPersonDetails(cleanId),
          tmdbService.getPersonCombinedCredits(cleanId)
        ]);

        if (!isMounted) return;

        if (!actorData) {
          setError('Artista não encontrado ou indisponível.');
          setIsLoading(false);
          return;
        }

        setActor(actorData);

        // Validação e Elegibilidade de Catálogo:
        // Cruza as produções com os filtros de disponibilidade do ZapiTV
        const isChild = activeProfile?.isChild === true;
        const allowAdult = !isChild && adultContentService.isAgeConfirmed(activeProfile?.id);

        const eligible = catalogEligibilityService.filterEligibleItemsSync(creditsData.all, { allowAdult });
        const deduped = deduplicateContentItems(eligible);

        setAllCredits(deduped);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[ActorView] Erro ao carregar dados do ator:', err);
        setError('Ocorreu um erro ao carregar os dados do artista. Tente novamente.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchActorData();
    return () => {
      isMounted = false;
    };
  }, [actorId, activeProfile?.id, activeProfile?.isChild]);

  // Separação por Categoria (Filmes vs Séries/Animes)
  const moviesList = useMemo(() => {
    return allCredits.filter(it => it.mediaFormat === 'movie' || it.type === ContentType.MOVIE);
  }, [allCredits]);

  const seriesList = useMemo(() => {
    return allCredits.filter(it => it.mediaFormat !== 'movie' && it.type !== ContentType.MOVIE);
  }, [allCredits]);

  // Filtro da aba selecionada
  const tabFilteredItems = useMemo(() => {
    switch (activeTab) {
      case 'movies':
        return moviesList;
      case 'series':
        return seriesList;
      case 'all':
      default:
        return allCredits;
    }
  }, [activeTab, moviesList, seriesList, allCredits]);

  // Ordenação (Relevância, Mais Recentes, Mais Antigos)
  const sortedItems = useMemo(() => {
    const list = [...tabFilteredItems];
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => (b.year || 0) - (a.year || 0));
      case 'oldest':
        return list.sort((a, b) => (a.year || 0) - (b.year || 0));
      case 'relevant':
      default:
        // Relevância balanceada por nota média e ano
        return list.sort((a, b) => {
          const scoreA = (a.rating || 0) * 10 + (a.year ? (a.year - 1980) * 0.1 : 0);
          const scoreB = (b.rating || 0) * 10 + (b.year ? (b.year - 1980) * 0.1 : 0);
          return scoreB - scoreA;
        });
    }
  }, [tabFilteredItems, sortBy]);

  // Carregamento Progressivo (sem limites artificiais)
  const displayedItems = useMemo(() => {
    return sortedItems.slice(0, visibleCount);
  }, [sortedItems, visibleCount]);

  const hasMore = visibleCount < sortedItems.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + PAGE_CHUNK_SIZE);
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-24">
        <ZapiLoader size="lg" text="Carregando produções do artista..." />
      </div>
    );
  }

  if (error || !actor) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <UserIcon className="w-8 h-8 text-gray-400 opacity-60" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Artista Não Encontrado</h2>
        <p className="text-gray-400 text-sm max-w-md mb-6">{error || 'Não foi possível encontrar este ator.'}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl bg-[#007df7] text-white font-bold text-sm hover:bg-[#007df7]/80 transition-colors cursor-pointer"
          >
            Voltar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 fill-mode-both transform-gpu pb-28">
      {/* Botão Voltar (Opcional) */}
      {onBack && (
        <div className="px-3 sm:px-6 md:px-12 max-w-[2560px] mx-auto pt-4 pb-2">
          <button
            onClick={onBack}
            className={`flex items-center gap-2 text-sm font-bold transition-colors cursor-pointer ${
              isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>
        </div>
      )}

      {/* Header com Foto Oficial Circular e Nome Alinhado ao Lado (Identidade Visual ZapiTV) */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 sm:gap-6 md:gap-8 my-5 sm:my-8 md:my-10 px-3 sm:px-6 md:px-12 max-w-[2560px] mx-auto">
        {/* Foto Oficial Circular em Destaque */}
        <div className="relative shrink-0 self-center md:self-auto">
          <img
            src={actor.image}
            alt={actor.name}
            className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-[#007df7]/40 shadow-2xl ring-4 ring-black/40"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
            }}
          />
          <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-[#007df7] text-white shadow-lg border-2 border-[#0c0e14]">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Nome do Artista e Metadados Alinhados ao Lado */}
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#007df7]/20 text-[#007df7] mb-2 border border-[#007df7]/30">
            {actor.knownForDepartment || 'Ator / Atriz'}
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            {actor.name}
          </h1>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-xs md:text-sm text-gray-400 font-medium">
            <span className="text-emerald-400 font-bold">
              {allCredits.length} {allCredits.length === 1 ? 'produção disponível' : 'produções disponíveis'}
            </span>
            {actor.birthday && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  Nascimento: {new Date(actor.birthday).getFullYear()}
                </span>
              </>
            )}
            {actor.placeOfBirth && (
              <>
                <span>•</span>
                <span className="truncate max-w-[200px]">{actor.placeOfBirth}</span>
              </>
            )}
          </div>

          {/* Biografia Resumida */}
          {actor.biography && (
            <div className="mt-3 text-xs md:text-sm text-gray-300 leading-relaxed max-w-3xl">
              <p className={showFullBio ? '' : 'line-clamp-2'}>
                {actor.biography}
              </p>
              {actor.biography.length > 180 && (
                <button
                  onClick={() => setShowFullBio(!showFullBio)}
                  className="text-[#007df7] hover:text-[#007df7]/80 text-xs font-bold mt-1 inline-flex items-center gap-0.5 cursor-pointer"
                >
                  {showFullBio ? 'Mostrar menos' : 'Ler biografia completa'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Barra de Controles: Abas (Todas / Filmes / Séries) + Ordenação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-3 sm:px-6 md:px-12 max-w-[2560px] mx-auto mb-6 md:mb-8 border-b border-white/10 pb-4">
        {/* Abas */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => { setActiveTab('all'); setVisibleCount(PAGE_CHUNK_SIZE); }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
              activeTab === 'all'
                ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/30'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>Todas as Produções</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 font-mono">
              {allCredits.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('movies'); setVisibleCount(PAGE_CHUNK_SIZE); }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
              activeTab === 'movies'
                ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/30'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Filmes</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 font-mono">
              {moviesList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('series'); setVisibleCount(PAGE_CHUNK_SIZE); }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
              activeTab === 'series'
                ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/30'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Séries</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 font-mono">
              {seriesList.length}
            </span>
          </button>
        </div>

        {/* Seletor de Ordenação */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-gray-400 font-bold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#007df7]" />
            Ordenar por:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
            className={`text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer transition-colors ${
              isDarkMode
                ? 'bg-[#131722] border-white/10 text-white hover:border-white/20'
                : 'bg-white border-black/10 text-gray-900 hover:border-black/20'
            }`}
          >
            <option value="relevant">Mais Relevantes</option>
            <option value="newest">Mais Recentes</option>
            <option value="oldest">Mais Antigos</option>
          </select>
        </div>
      </div>

      {/* Grade de Produções Validadas */}
      <div className="px-3 sm:px-6 md:px-12 max-w-[2560px] mx-auto">
        {displayedItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              {displayedItems.map((item, idx) => (
                <ContentCard
                  key={`actor-work-${item.id}-${idx}`}
                  item={item}
                  isDarkMode={isDarkMode}
                  onItemClick={onSelectContent}
                  isFavorite={favorites.includes(item.id)}
                  isInList={myList.includes(item.id)}
                  onToggleFavorite={toggleFavorite}
                  onToggleList={toggleMyList}
                />
              ))}
            </div>

            {/* Carregamento Progressivo (Infinite Scroll / Ver Mais) */}
            {hasMore && (
              <div className="flex justify-center mt-12 mb-6">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg border border-white/10 hover:scale-105 active:scale-95"
                >
                  <span>Carregar mais produções ({sortedItems.length - visibleCount} restantes)</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <Film className="w-8 h-8 text-gray-500 opacity-60" />
            </div>
            <p className="text-xl font-bold text-white mb-2">Nenhuma produção disponível nesta categoria</p>
            <p className="text-sm text-gray-400 max-w-md">
              O artista não possui títulos validados para reprodução nesta categoria no momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActorView;
