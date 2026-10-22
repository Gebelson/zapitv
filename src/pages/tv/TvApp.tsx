import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ContentItem, User, Profile } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { tvModeService } from '../../core/tv/tvModeService';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { canonicalCatalogMaster } from '../../core/catalog/CanonicalCatalogMaster';
import { catalogReleaseStore } from '../../core/catalog/CatalogReleaseStore';
import { TvHeader, TvTab } from '../../components/tv/TvHeader';
import { TvHomeView } from '../../components/tv/TvHomeView';
import { TvCategoryView } from '../../components/tv/TvCategoryView';
import { TvSearchView } from '../../components/tv/TvSearchView';
import { TvListView } from '../../components/tv/TvListView';
import { TvDetailsModal } from '../../components/tv/TvDetailsModal';
import { TvRemoteDiagnosticOverlay } from '../../components/tv/TvRemoteDiagnosticOverlay';
import { ZapiLoader } from '../../components/common/ZapiLoader';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

// Lazy load do orquestrador de reprodução para máxima performance inicial na TV
const ContentDetailModal = lazy(() => import('../../../components/ContentDetailModal'));

interface TvAppProps {
  content: ContentItem[];
  trendingItems: ContentItem[];
  popularMovies: ContentItem[];
  popularSeries: ContentItem[];
  animeItems: ContentItem[];
  featuredItems: ContentItem[];
  myList: string[];
  favorites: string[];
  onToggleList: (e: any, id: string) => void;
  onToggleFavorite: (e: any, id: string) => void;
  currentUser?: User;
  activeProfile?: Profile | null;
}

export const TvApp: React.FC<TvAppProps> = ({
  content,
  trendingItems,
  popularMovies,
  popularSeries,
  animeItems,
  featuredItems,
  myList,
  favorites,
  onToggleList,
  onToggleFavorite,
  currentUser,
  activeProfile
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Inicializa navegação espacial e define o foco inicial no botão Assistir do Hero
  useEffect(() => {
    tvNavigationManager.init();
    tvNavigationManager.resume();
    tvModeService.setTvMode(true);
    document.body.classList.add('tv-mode');

    const timer = setTimeout(() => {
      try {
        setFocus('tv-hero-play');
      } catch {}
    }, 150);

    return () => {
      clearTimeout(timer);
      tvNavigationManager.pause();
      tvModeService.setTvMode(false);
      document.body.classList.remove('tv-mode');
    };
  }, []);

  // Aba ativa na navegação superior
  const [currentTab, setCurrentTab] = useState<TvTab>(() => {
    const path = location.pathname;
    if (path.includes('/filmes')) return 'movies';
    if (path.includes('/series')) return 'series';
    if (path.includes('/animes')) return 'animes';
    if (path.includes('/em-destaque')) return 'featured';
    return 'home';
  });

  // Visões especiais além das abas
  const [specialView, setSpecialView] = useState<'search' | 'mylist' | 'history' | 'settings' | null>(() => {
    const path = location.pathname;
    if (path.includes('/busca')) return 'search';
    if (path.includes('/minha-lista')) return 'mylist';
    if (path.includes('/historico')) return 'history';
    return null;
  });

  // Item selecionado para detalhes ou reprodução
  const [selectedDetailItem, setSelectedDetailItem] = useState<ContentItem | null>(null);
  const [selectedDetailSeason, setSelectedDetailSeason] = useState<number | undefined>();
  const [playingItem, setPlayingItem] = useState<{
    item: ContentItem;
    season?: number;
    episode?: number;
  } | null>(null);

  const handleOpenDetailModal = useCallback((item: ContentItem) => {
    tvNavigationManager.saveFocusSnapshot();
    setSelectedDetailSeason(undefined);
    setSelectedDetailItem(item);
  }, []);

  // Pilha de navegação Voltar da TV (prioridade 10 - Root)
  useEffect(() => {
    return tvNavigationManager.registerBackHandler('tv-app-root', 10, () => {
      // Se estiver em uma tela especial (busca, minha lista, etc.), volta para a Home
      if (specialView !== null) {
        setSpecialView(null);
        setCurrentTab('home');
        setTimeout(() => setFocus('tv-nav-home'), 50);
        return true;
      }

      // Se estiver em uma aba que não seja a Home, volta para a Home
      if (currentTab !== 'home') {
        setCurrentTab('home');
        setTimeout(() => setFocus('tv-nav-home'), 50);
        return true;
      }

      // Se já estiver na Home e o foco não estiver no header, foca no header
      setFocus('tv-nav-home');
      return true;
    });
  }, [specialView, currentTab]);

  // Catálogo completo unificado e elegível para a busca e detalhes da Smart TV
  const fullTvCatalog = useMemo(() => {
    const combined = [
      ...(content || []),
      ...(popularMovies || []),
      ...(popularSeries || []),
      ...(animeItems || []),
      ...(trendingItems || []),
      ...(featuredItems || []),
      ...catalogReleaseStore.getReleases(),
      ...storageService.getCachedCatalog('top_rated'),
      ...canonicalCatalogMaster.getPublicCatalog('movies'),
      ...canonicalCatalogMaster.getPublicCatalog('series'),
      ...canonicalCatalogMaster.getPublicCatalog('animes'),
    ];
    return catalogEligibilityService.filterEligibleItemsSync(deduplicateContentItems(combined));
  }, [content, popularMovies, popularSeries, animeItems, trendingItems, featuredItems]);

  // Itens da Minha Lista reais
  const myListItems = useMemo(() => {
    if (!content || !myList) return [];
    const listSet = new Set(myList);
    return content.filter(it => listSet.has(it.id));
  }, [content, myList]);

  // Itens do Histórico reais
  const historyItems = useMemo(() => {
    if (!content) return [];
    return content.filter(it => {
      const cont = storageService.getPlaybackContinuity(it);
      return cont.hasStarted;
    });
  }, [content]);

  // Execução de reprodução
  const handleStartPlay = useCallback((item: ContentItem, season?: number, episode?: number) => {
    if (!selectedDetailItem) tvNavigationManager.saveFocusSnapshot();
    setSelectedDetailItem(item);
    setSelectedDetailSeason(season ?? storageService.getPlaybackContinuity(item).season);
    setPlayingItem({ item, season, episode });
  }, [selectedDetailItem]);

  const handleClosePlayer = useCallback(() => {
    if (playingItem) {
      setSelectedDetailSeason(storageService.getPlaybackContinuity(playingItem.item).season || playingItem.season);
    }
    setPlayingItem(null);
  }, [playingItem]);

  return (
    <div className="zapi-tv-root relative min-h-screen bg-[#05070a] text-white overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Diagnóstico em tempo real na TV (?tvdiag=1) */}
      <TvRemoteDiagnosticOverlay />

      {/* Cabeçalho Fixo Minimalista Cinematográfico */}
      {!playingItem && specialView !== 'search' && (
        <TvHeader
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setSpecialView(null);
            setCurrentTab(tab);
            setTimeout(() => {
              setFocus('tv-hero-play');
            }, 100);
          }}
          onOpenSearch={() => setSpecialView('search')}
          onNavigateProfileMenu={(target) => {
            if (target === 'mylist') setSpecialView('mylist');
            else if (target === 'history') setSpecialView('history');
            else if (target === 'settings') setSpecialView('settings');
          }}
          userName={activeProfile?.name || currentUser?.name || 'ZapiTV'}
          avatarUrl={activeProfile?.avatar}
          accountPlan={currentUser?.status === 'Ativo' ? currentUser.plan?.trim() : undefined}
        />
      )}

      {/* Visão Ativa */}
      <main className={`relative z-10 w-full min-h-screen ${specialView && specialView !== 'search' ? 'pt-24' : 'pt-0'}`}>
        {specialView === 'search' ? (
          <TvSearchView
            allContent={fullTvCatalog}
            onSelectItem={handleOpenDetailModal}
            onClose={() => {
              setSpecialView(null);
              setTimeout(() => setFocus('tv-nav-search'), 50);
            }}
          />
        ) : specialView === 'mylist' ? (
          <TvListView
            title="Minha Lista"
            type="mylist"
            items={myListItems}
            onSelectItem={handleOpenDetailModal}
            onBack={() => setSpecialView(null)}
          />
        ) : specialView === 'history' ? (
          <TvListView
            title="Histórico de Reprodução"
            type="history"
            items={historyItems}
            onSelectItem={handleOpenDetailModal}
            onBack={() => setSpecialView(null)}
          />
        ) : specialView === 'settings' ? (
          <div className="pt-24 px-12 text-center text-gray-400">
            <h2 className="text-xl font-bold text-white mb-2">Configurações da Smart TV</h2>
            <p className="text-sm">Preferências de áudio dublado em Português e qualidade automática ativadas.</p>
            <button
              onClick={() => setSpecialView(null)}
              className="mt-6 px-6 py-2.5 rounded-xl bg-cyan-500 text-black font-bold"
            >
              Voltar
            </button>
          </div>
        ) : currentTab === 'home' ? (
          <TvHomeView
            featuredItems={featuredItems}
            trendingItems={trendingItems}
            popularMovies={popularMovies}
            popularSeries={popularSeries}
            animeItems={animeItems}
            allContent={content}
            onSelectItem={handleOpenDetailModal}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : currentTab === 'movies' ? (
          <TvCategoryView
            categoryTitle="Filmes"
            items={popularMovies}
            onSelectItem={handleOpenDetailModal}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : currentTab === 'series' ? (
          <TvCategoryView
            categoryTitle="Séries"
            items={popularSeries}
            onSelectItem={handleOpenDetailModal}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : currentTab === 'animes' ? (
          <TvCategoryView
            categoryTitle="Animes"
            items={animeItems}
            onSelectItem={handleOpenDetailModal}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : (
          <TvCategoryView
            categoryTitle="Em Destaque"
            items={featuredItems}
            onSelectItem={handleOpenDetailModal}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        )}
      </main>

      {/* Modal de Detalhes Cinematográfico */}
      {selectedDetailItem && !playingItem && (
        <TvDetailsModal
          item={selectedDetailItem}
          initialSeason={selectedDetailSeason}
          allContent={fullTvCatalog}
          myList={myList}
          favorites={favorites}
          onToggleList={onToggleList}
          onToggleFavorite={onToggleFavorite}
          onClose={() => {
            setSelectedDetailItem(null);
            tvNavigationManager.restoreFocusSnapshot('tv-hero-play');
          }}
          onPlay={(it, s, e) => {
            handleStartPlay(it, s, e);
          }}
        />
      )}

      {/* Player de Reprodução em Tela Cheia via ContentDetailModal com autoPlay */}
      {playingItem && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center">
            <ZapiLoader size="xl" />
          </div>
        }>
          <ContentDetailModal
            item={playingItem.item}
            onClose={handleClosePlayer}
            isDarkMode={true}
            myList={myList}
            favorites={favorites}
            onToggleList={onToggleList}
            onToggleFavorite={onToggleFavorite}
            allContent={content}
            initialSeason={playingItem.season}
            initialEpisode={playingItem.episode}
            autoPlayInitialEpisode={true}
            playerOnly={true}
          />
        </Suspense>
      )}
    </div>
  );
};
