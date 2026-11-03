import React from 'react';
import { createRoot } from 'react-dom/client';
import { ZapiPlayer } from '../../src/components/player/ZapiPlayer';
import { ContentItem, ContentType } from '../../types';
import { StremioStream } from '../../src/core/stremio/stremioTypes';

const authorizedItem: ContentItem = {
  id: 'authorized-sample-video',
  title: 'Anime Sample 480p',
  originalTitle: 'Anime Sample',
  type: ContentType.ANIME,
  year: 2024,
  category: 'Animes',
  audioStatus: 'pt-br-dubbed',
  imdbId: 'tt1234567',
  tmdbId: '12345',
  image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'
};

const videoUrl = typeof window !== 'undefined'
  ? `${window.location.origin}/test-videos/anime_480p_sample.mp4`
  : '/test-videos/anime_480p_sample.mp4';

const authorizedStreams: StremioStream[] = [
  {
    name: 'ZapiTV Acervo Local MP4',
    title: '[DUBLADO PT-BR] Anime Sample - 480p MP4',
    url: videoUrl,
    sourceType: 'mp4',
    isPtBr: true,
    isDubbed: true,
    quality: '480p',
    providerName: 'ZapiTV Acervo Local'
  }
];

function HarnessApp() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ZapiPlayer
        item={authorizedItem}
        streams={authorizedStreams}
        verificationState="AVAILABLE"
        initialPlayIntro={false}
        onClose={() => console.log('Player closed')}
      />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<HarnessApp />);
}
