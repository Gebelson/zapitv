import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { TvHeader } from '../../src/components/tv/TvHeader';
import { tvNavigationManager } from '../../src/core/tv/tvNavigationManager';
import { tvModeService } from '../../src/core/tv/tvModeService';
import '../../index.css';

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const mockDeviceFamily = params.get('deviceFamily');
if (typeof window !== 'undefined') {
  tvModeService.setTvMode(true);
  if (mockDeviceFamily) {
    (window as any).__MOCK_DEVICE_FAMILY__ = mockDeviceFamily;
  }
}

const HeaderProfilePreviewApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'home' | 'movies' | 'series' | 'animes' | 'featured'>('home');
  const bannerType = params.get('banner') || 'dark';

  useEffect(() => {
    tvNavigationManager.init();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070a] select-none">
      {/* 1. Cenário de Fundo (Hero Banner Cinematográfico) */}
      <div className="absolute inset-0 z-0">
        {bannerType === 'bright' ? (
          /* Banner Claro: Luzes de estádio, céu aberto e tons claros vibrantes */
          <div className="w-full h-full relative">
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{
                background: 'radial-gradient(ellipse at 70% 30%, #e0f2fe 0%, #bae6fd 30%, #7dd3fc 60%, #0284c7 100%)'
              }}
            />
            {/* Elementos visuais claros para teste de contraste e transparência */}
            <div className="absolute top-16 left-1/4 w-96 h-96 rounded-full bg-white/60 blur-3xl" />
            <div className="absolute top-8 right-1/3 w-80 h-80 rounded-full bg-cyan-200/50 blur-2xl" />
            
            <div className="absolute bottom-28 left-16 z-10 max-w-xl">
              <span className="inline-block px-3 py-1 rounded-md bg-blue-600/80 text-white font-bold text-xs uppercase tracking-wider mb-3">
                Destaque da Semana
              </span>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 drop-shadow-md mb-2">
                A Jornada das Estrelas
              </h1>
              <p className="text-slate-800 text-sm sm:text-base font-medium drop-shadow-sm max-w-md">
                Uma aventura espetacular através de cenários iluminados e horizontes sem fim.
              </p>
            </div>
          </div>
        ) : (
          /* Banner Escuro: Mistério, suspense e tons profundos */
          <div className="w-full h-full relative">
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{
                background: 'radial-gradient(ellipse at 80% 20%, #1e293b 0%, #0f172a 40%, #090e17 80%, #05070a 100%)'
              }}
            />
            {/* Detalhes de luz cinematográfica sutil */}
            <div className="absolute top-12 right-20 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
            <div className="absolute top-24 left-1/3 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            
            <div className="absolute bottom-28 left-16 z-10 max-w-xl">
              <span className="inline-block px-3 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-bold text-xs uppercase tracking-wider mb-3">
                Original ZapiTV
              </span>
              <h1 className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg mb-2">
                Verdade Oculta
              </h1>
              <p className="text-slate-300 text-sm sm:text-base font-normal drop-shadow max-w-md">
                Nas sombras de uma metrópole futurista, segredos enterrados ameaçam mudar o destino de todos.
              </p>
            </div>
          </div>
        )}

        {/* Gradiente inferior para simular a transição para os carrosséis */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05070a] to-transparent pointer-events-none" />
      </div>

      {/* 2. Cabeçalho Oficial TvHeader com Glassmorphism e Dropdown de Perfil */}
      <TvHeader
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSearch={() => console.log('Open search')}
        onNavigateProfileMenu={(view) => console.log('Navigate to:', view)}
        userName="Gebelson"
        accountPlan="Premium"
      />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<HeaderProfilePreviewApp />);
