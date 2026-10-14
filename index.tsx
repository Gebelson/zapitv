
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initializeDatabase, db as localDb } from './db';
import { updateMovies } from './updateMovies';
import { MOCK_USERS } from './constants';
import { db as firestoreDb, auth } from './firebase';
import { collection, getDocs, setDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import './index.css';

const RootComponent = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState<any>(null);

  useEffect(() => {
    async function load() {
      // 1. Initialize local DB first to get the base catalog
      await initializeDatabase();
      await updateMovies();
      
      const localContent = await localDb.content.toArray();
      const localCustomSections = await localDb.customSections.toArray();
      
      const getKv = async (key: string, def: any) => {
        const item = await localDb.keyValueStore.get(key);
        return item ? item.value : def;
      };

      const theme = await getKv('zapitv_theme', true);
      const lastEmail = await getKv('zapitv_last_email', '');

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

      const savedFavs = (await localDb.keyValueStore.get('zapitv_local_favorites'))?.value || [];
      const savedList = (await localDb.keyValueStore.get('zapitv_local_mylist'))?.value || [];

      setInitialState({
        users: [defaultUser],
        content: localContent,
        notifications: [],
        customSections: localCustomSections,
        auth: true, // ZERO LOGIN - SEM CADASTRO
        currentUser: defaultUser,
        activeProfile: defaultProfile,
        theme,
        sectionTitles,
        myList: savedList,
        favorites: savedFavs,
        lastEmail: defaultUser.email
      });
      setIsReady(true);
    }
    
    load().catch(err => {
      console.error("Failed to initialize database", err);
      // Even if local DB fails, we should try to load auth state
      setIsReady(true);
    });
  }, []);

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
        <svg className="loader-svg" viewBox="0 0 374.87 315.93" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feFlood floodColor="#00e5ff" floodOpacity="0.8" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="glow"/>
                    <feMerge>
                        <feMergeNode in="glow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <path className="outline" d="M217.84,315.93c-20.71-.34-41.38-.68-62-1.01-25.86.33-51.86.66-78,1l-58.67-.27c-8.71-.05-16.27-6.38-17.35-14.45-.89-6.67.79-11.65,4.8-16.59l42.96-52.9,34.5-41.58,46.93-57.01c4.73-5.74,8.53-12.04,14.93-16.09,4.47-2.83,11.02-1.13,15.32,1.5l29.66,18.14c5.5,3.37,12.16,1.15,15.73-4l16.82-24.22,47.74-74.06c.21-.33.37-.67.48-1.02,1.14-3.55-2.09-6.98-5.78-6.4-2.82.44-5.47,1.54-8.49,2.82l-128.58,54.14L9.09,134.06c-2.46,1.03-5.17.89-6.68-.21C1.28,133.02,0,130.3,0,128.19L.2,21.58C.23,9.78,8.11,0,20.12,0l335.27.02c5.38,0,11.72,3.13,14.46,6.66,6.08,7.82,3.13,17.81-2.26,24.85-5.81,7.6-11.51,14.36-17.53,21.64l-24.48,29.57-56.42,68.45-33.94,42.01c-5,6.19-12.76,9.24-19.74,5.04l-28.69-17.27c-3.83-2.31-10.24-5.82-14.33-3.45-5.92,3.43-8.84,10.15-12.43,15.62l-33.7,51.33-27.21,42.72c-.76,1.19-.35,3.03.15,3.78,1.9,2.87,9.6-.54,12.85-1.93l116.86-49.98,138.78-59.06c1.63-.7,3.99-.15,4.9.39s2.21,2,2.21,3.81l-.4,109.09c-.04,12.22-8.55,22.45-20.82,22.46l-135.81.19Z"/>
        </svg>
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
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <RootComponent />
    </BrowserRouter>
  </React.StrictMode>
);
