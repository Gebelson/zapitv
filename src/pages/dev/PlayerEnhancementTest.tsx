import React, { useState } from 'react';
import { ZapiPlayer } from '../../components/player/ZapiPlayer';
import { ContentItem, ContentType } from '../../../types';
import { StremioStream } from '../../core/stremio/stremioTypes';

const TEST_ITEM: ContentItem = {
  id: 'open-night-living-dead-1968',
  title: 'A Noite dos Mortos-Vivos (1968)',
  type: ContentType.MOVIE,
  rating: 7.9,
  year: 1968,
  image: '/test-videos/intro_480p.mp4',
  description: 'Vídeo oficial de homologação da Melhoria de Imagem por IA Anime4K WebGPU.',
  genres: ['Terror', 'Ficção Científica'],
  availabilityStatus: 'verified',
  audioStatus: 'pt-br-dubbed'
};

const TEST_STREAMS: StremioStream[] = [
  {
    name: 'ZapiTV Core Local',
    title: '[DUBLADO PT-BR] A Noite dos Mortos-Vivos (1968) - 480p H.264',
    url: '/test-videos/anime_480p_sample.mp4',
    sourceType: 'mp4',
    quality: '480p',
    isDubbed: true,
    isPtBr: true,
    providerName: 'Laboratório ZapiTV'
  }
];

export const PlayerEnhancementTestPage: React.FC = () => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(true);

  if (!isPlayerOpen) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4">Player Teste Finalizado</h1>
        <button
          onClick={() => setIsPlayerOpen(true)}
          className="px-6 py-3 bg-[#007df7] hover:bg-[#0066cc] text-white font-bold rounded-xl transition-all shadow-lg"
        >
          Reabrir ZapiPlayer de Teste
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black z-[300]">
      <ZapiPlayer
        item={TEST_ITEM}
        streams={TEST_STREAMS}
        isLoadingStreams={false}
        initialPlayIntro={false}
        onClose={() => setIsPlayerOpen(false)}
      />
    </div>
  );
};
