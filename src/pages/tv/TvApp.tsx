import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ContentItem, User, Profile } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { tvModeService } from '../../core/tv/tvModeService';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { TvHeader, TvTab } from '../../components/tv/TvHeader';
import { TvHomeView } from '../../components/tv/TvHomeView';
import { TvCategoryView } from '../../components/tv/TvCategoryView';
import { TvSearchView } from '../../components/tv/TvSearchView';
import { TvListView } from '../../components/tv/TvListView';
import { TvDetailsModal } from '../../components/tv/TvDetailsModal';
import { TvRemoteDiagnosticOverlay } from '../../components/tv/TvRemoteDiagnosticOverlay';
import { ZapiLoader } from '../../components/common/ZapiLoader';
import { init as initSpatialNavigation, setFocus } from '@noriginmedia/norigin-spatial-navigation';

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
    initSpatialNavigation({
      debug: false,
      visualDebug: false
    });
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
  const [playingItem, setPlayingItem] = useState<{
    item: ContentItem;
    season?: number;
    episode?: number;
  } | null>(null);

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
    setPlayingItem({ item, season, episode });
  }, []);

  const handleClosePlayer = useCallback(() => {
    setPlayingItem(null);
  }, []);

  return (
    <div className="zapi-tv-root relative min-h-screen bg-[#05070a] text-white overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Diagnóstico em tempo real na TV (?tvdiag=1) */}
      <TvRemoteDiagnosticOverlay />

      {/* Cabeçalho Fixo Minimalista Cinematográfico */}
      {!playingItem && (
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
        />
      )}

      {/* Visão Ativa */}
      <main className={`relative z-10 w-full min-h-screen ${specialView ? 'pt-24' : 'pt-0'}`}>
        {specialView === 'search' ? (
          <TvSearchView
            allContent={content}
            onSelectItem={(it) => setSelectedDetailItem(it)}
            onClose={() => setSpecialView(null)}
          />
        ) : specialView === 'mylist' ? (
          <TvListView
            title="Minha Lista"
            type="mylist"
            items={myListItems}
            onSelectItem={(it) => setSelectedDetailItem(it)}
            onBack={() => setSpecialView(null)}
          />
        ) : specialView === 'history' ? (
          <TvListView
            title="Histórico de Reprodução"
            type="history"
            items={historyItems}
            onSelectItem={(it) => setSelectedDetailItem(it)}
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
            onSelectItem={(it) => setSelectedDetailItem(it)}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : currentTab === 'movies' ? (
          <TvCategoryView
            categoryTitle="Filmes"
            items={popularMovies}
            onSelectItem={(it) => setSelectedDetailItem(it)}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : currentTab === 'series' ? (
          <TvCategoryView
            categoryTitle="Séries"
            items={popularSeries}
            onSelectItem={(it) => setSelectedDetailItem(it)}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : currentTab === 'animes' ? (
          <TvCategoryView
            categoryTitle="Animes"
            items={animeItems}
            onSelectItem={(it) => setSelectedDetailItem(it)}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        ) : (
          <TvCategoryView
            categoryTitle="Em Destaque"
            items={featuredItems}
            onSelectItem={(it) => setSelectedDetailItem(it)}
            onPlayItem={(it) => handleStartPlay(it)}
          />
        )}
      </main>

      {/* Modal de Detalhes Cinematográfico */}
      {selectedDetailItem && (
        <TvDetailsModal
          item={selectedDetailItem}
          allContent={content}
          myList={myList}
          favorites={favorites}
          onToggleList={onToggleList}
          onToggleFavorite={onToggleFavorite}
          onClose={() => setSelectedDetailItem(null)}
          onPlay={(it, s, e) => {
            setSelectedDetailItem(null);
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
          />
        </Suspense>
      )}
    </div>
  );
};
