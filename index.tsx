import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { FeatureErrorBoundary } from './src/components/common/FeatureErrorBoundary';
import { initializeDatabase, db as localDb } from './db';
import { storageService } from './src/core/storage/storageService';
import './index.css';

let bootstrapPromise: Promise<any> | null = null;
const ENRICHED_MOVIES_SYNC_KEY = 'zapitv_enriched_sync_v6';

async function loadInitialState() {
      // 1. Executa inicialização da base e leitura de configurações em paralelo
      const [baseContent, localCustomSections, kvEntries, localLists] = await Promise.all([
        initializeDatabase(),
        localDb.customSections.toArray(),
        localDb.keyValueStore.bulkGet([
          'zapitv_theme',
          'zapitv_last_email',
          'zapitv_local_favorites',
          'zapitv_local_mylist',
          'zapitv_section_titles',
          'zapitv_section_titles_manual_v1'
        ]),
        Promise.all([storageService.getFavorites(), storageService.getMyList()])
      ]);

      let localContent = baseContent;
      let alreadyEnriched = false;
      try {
        alreadyEnriched = localStorage.getItem(ENRICHED_MOVIES_SYNC_KEY) === '1';
      } catch {}

      if (!alreadyEnriched) {
        // Executa enriquecimento em segundo plano para inicialização instantânea (< 50ms) no primeiro boot
        setTimeout(async () => {
          try {
            const { updateMovies } = await import('./updateMovies');
            await updateMovies(baseContent);
            try {
              localStorage.setItem(ENRICHED_MOVIES_SYNC_KEY, '1');
            } catch {}
          } catch (e) {
            console.warn('Enriquecimento em background falhou:', e);
          }
        }, 1000);
      }

      const theme = kvEntries[0] ? kvEntries[0].value : true;
      const [savedFavs, savedList] = localLists;

      const defaultProfile = {
        id: 'p1',
        name: 'Zapi Principal',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        isChild: false
      };

      const defaultUser = {
        id: 'zapitv-master-user',
        name: 'Usuário ZapiTV',
        email: 'usuario@zapitv.com',
        role: 'admin' as const,
        devMode: true,
        memberSince: '2026',
        plan: 'VIP Vitalício',
        status: 'Ativo' as const,
        profiles: [defaultProfile]
      };

      const sectionTitles = {
        premium: "Novidades & Tendências",
        recent: "Filmes Populares",
        netflix: "Séries em Alta",
        prime: "Mais Bem Avaliados",
        hbo: "Animes & Animações"
      };

      return {
        users: [defaultUser],
        content: localContent,
        notifications: [],
        customSections: localCustomSections,
        auth: false, // Inicia anônimo por padrão; sessão real é validada via cookie HttpOnly em authClient.checkSession()
        currentUser: defaultUser,
        activeProfile: defaultProfile,
        theme,
        sectionTitles: kvEntries[5]?.value === true && kvEntries[4]?.value ? kvEntries[4].value : sectionTitles,
        myList: savedList,
        favorites: savedFavs,
        lastEmail: defaultUser.email
      };
}

const RootComponent = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState<any>(null);
  const [initializationError, setInitializationError] = useState(false);

  useEffect(() => {
    let active = true;
    bootstrapPromise ??= loadInitialState();
    
    let timer: ReturnType<typeof setTimeout>;
    Promise.race([
      bootstrapPromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tempo limite ao abrir o catálogo local')), 20000);
      })
    ]).then(state => {
      if (!active) return;
      setInitialState(state);
      setIsReady(true);
    }).catch(err => {
      if (!active) return;
      console.error("Failed to initialize database", err);
      setInitializationError(true);
    }).finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (initializationError && !initialState) {
    return (
      <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Não foi possível abrir o ZapiTV agora</h1>
        <p style={{ color: '#aaa', maxWidth: 440 }}>O catálogo local demorou para responder ou falhou. Seus dados continuam salvos neste navegador.</p>
        <button onClick={() => window.location.reload()} style={{ background: '#007df7', border: 0, borderRadius: 12, color: '#fff', padding: '12px 24px', fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
      </div>
    );
  }

  if (!isReady || !initialState) {
    return (
      <div style={{
        background: '#050505',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        margin: 0
      }}>
        <style>
          {`
            .loader-svg {
                width: 150px;
                height: auto;
            }

            .outline {
                stroke: #00e5ff; 
                stroke-width: 2.5;
                fill: none;
                stroke-linecap: round;
                stroke-linejoin: round;
                stroke-dasharray: 2500;
                stroke-dashoffset: 2500;
                animation: draw-glow 4s ease-in-out infinite;
                filter: url(#glow-filter);
            }

            @keyframes draw-glow {
                0% {
                    stroke-dashoffset: 2500;
                    opacity: 0.5;
                }
                50% {
                    stroke-dashoffset: 0;
                    opacity: 1;
                }
                100% {
                    stroke-dashoffset: -2500;
                    opacity: 0.5;
                }
            }
          `}
        </style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/zapi-icon.png" alt="ZapiTV" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <img src="/zapitv-text.png" alt="ZapiTV" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        </div>
      </div>
    );
  }

  return <App initialState={initialState} />;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FeatureErrorBoundary featureName="o ZapiTV">
          <RootComponent />
        </FeatureErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
