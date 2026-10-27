import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { TvLiveChannelOverlay } from '../../src/components/tv/live/TvLiveChannelOverlay';
import { LiveChannel, CurrentEpgState } from '../../src/core/livetv/types';
import '../../index.css';

const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const mockDeviceFamily = queryParams.get('deviceFamily');
if (typeof window !== 'undefined' && mockDeviceFamily) {
  (window as any).__MOCK_DEVICE_FAMILY__ = mockDeviceFamily;
}

const channelMaisUm: LiveChannel = {
  id: 'maisum-tv',
  name: '+MaisUm TV',
  category: 'variedades',
  categoryLabel: 'Variedades',
  logo: 'https://images.seeklogo.com/logo-png/43/2/mais-globo-sat-logo-png_seeklogo-434057.png',
  fallbackLogo: 'https://images.seeklogo.com/logo-png/43/2/mais-globo-sat-logo-png_seeklogo-434057.png',
  streamUrl: 'https://stream.example.com/maisum.m3u8',
  status: 'AVAILABLE',
  isOfficial: true,
  requiresExternalAccess: false
};

const channelCultura: LiveChannel = {
  id: 'tv-cultura',
  name: 'TV Cultura',
  category: 'cultura',
  categoryLabel: 'Cultura & Educação',
  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/TV_Cultura_logo_%282021%29.svg/512px-TV_Cultura_logo_%282021%29.svg.png',
  streamUrl: 'https://stream.example.com/cultura.m3u8',
  status: 'AVAILABLE',
  isOfficial: true,
  requiresExternalAccess: false
};

const epgMaisUm: CurrentEpgState = {
  currentProgram: {
    id: 'prg-1',
    title: 'Transmissão Ao Vivo Especial',
    startTime: '17:00',
    endTime: '19:00',
    startMinutes: 1020,
    endMinutes: 1140
  },
  progressPercent: 45,
  elapsedMinutes: 54,
  remainingMinutes: 66,
  formattedStartTime: '17:00',
  formattedEndTime: '19:00',
  hasVerifiedSchedule: true,
  nextProgram: {
    title: 'Cinema na TV',
    startTime: '19:00'
  }
};

const epgCultura: CurrentEpgState = {
  currentProgram: {
    id: 'prg-2',
    title: 'Jornal da Cultura (Ao Vivo)',
    startTime: '21:00',
    endTime: '22:15',
    startMinutes: 1260,
    endMinutes: 1335
  },
  progressPercent: 62,
  elapsedMinutes: 46,
  remainingMinutes: 29,
  formattedStartTime: '21:00',
  formattedEndTime: '22:15',
  hasVerifiedSchedule: true,
  nextProgram: {
    title: 'Roda Viva',
    startTime: '22:15'
  }
};

const scenes: Record<string, { bg: string; title: string; subtitle: string }> = {
  dark: {
    bg: 'radial-gradient(circle at 50% 35%, #182238 0%, #0c1220 50%, #050810 100%)',
    title: 'Cena Escura Noturna',
    subtitle: 'Simulação de filme de suspense / cena com pouca luz'
  },
  bright: {
    bg: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 35%, #94a3b8 100%)',
    title: 'Cena Clara de Alta Luminosidade',
    subtitle: 'Simulação de estúdio diurno de notícias / estádio ensolarado'
  },
  colorful: {
    bg: 'linear-gradient(125deg, #b91c1c 0%, #7c3aed 30%, #0284c7 70%, #d97706 100%)',
    title: 'Cena com Cores Vivas e Saturadas',
    subtitle: 'Simulação de anime vibrante / show musical cinematográfico'
  },
  motion: {
    bg: 'radial-gradient(ellipse at 80% 20%, #1d4ed8 0%, #047857 40%, #1e1b4b 80%)',
    title: 'Cena Dinâmica em Movimento',
    subtitle: 'Simulação de transmissão esportiva com alta movimentação'
  }
};

function App() {
  const params = new URLSearchParams(window.location.search);
  const sceneKey = params.get('scene') || 'dark';
  const chKey = params.get('channel') || 'maisum';
  const scene = scenes[sceneKey] || scenes.dark;
  const channel = chKey === 'cultura' ? channelCultura : channelMaisUm;
  const epg = chKey === 'cultura' ? epgCultura : epgMaisUm;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col justify-between select-none"
      style={{ background: scene.bg }}
    >
      {/* Elementos simulados de vídeo ao fundo para avaliar translucidez */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-amber-400/20 blur-3xl" />
      </div>

      {/* Header simulado minimalista para contexto de TV */}
      <div className="relative z-10 p-6 flex items-center justify-between opacity-70">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-white font-mono text-xs font-bold tracking-widest uppercase">
            ZapiTV Live • {scene.title}
          </span>
        </div>
        <span className="text-white/60 text-xs font-mono">
          {window.innerWidth} × {window.innerHeight}
        </span>
      </div>

      {/* Marca d'água de transmissão central para atestar transparência do vidro */}
      <div className="relative z-0 text-center my-auto opacity-20 pointer-events-none">
        <h1 className="text-white font-black text-4xl sm:text-6xl tracking-tight uppercase">
          {channel.name}
        </h1>
        <p className="text-white text-sm mt-1">{scene.subtitle}</p>
      </div>

      {/* HUD Ao Vivo em Glassmorphism Redesenhado */}
      <TvLiveChannelOverlay
        channel={channel}
        epg={epg}
        isVisible={true}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
