import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ZapiPlayer } from '../../src/components/player/ZapiPlayer';
import { providerRegistry } from '../../src/core/providers/providerRegistry';
import { ContentItem, ContentType } from '../../types';
import { StremioStream } from '../../src/core/stremio/stremioTypes';

export const TEST_ITEM_A: ContentItem = {
  id: 'test-item-a-anime',
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

export const TEST_ITEM_F: ContentItem = {
  id: 'test-item-f-intro',
  title: 'Intro Showcase 360p',
  originalTitle: 'Intro Showcase',
  type: ContentType.MOVIE,
  year: 2024,
  category: 'Filmes',
  audioStatus: 'pt-br-dubbed',
  imdbId: 'tt7654321',
  tmdbId: '54321',
  image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'
};

const streamsMap: Record<string, StremioStream[]> = {
  'test-item-a-anime': [
    {
      name: 'Acervo Autorizado ZapiTV',
      title: '[DUBLADO PT-BR] Anime Sample - 480p MP4',
      url: '/test-videos/anime_480p_sample.mp4',
      sourceType: 'mp4',
      isPtBr: true,
      isDubbed: true,
      quality: '480p',
      providerName: 'Acervo Autorizado ZapiTV'
    }
  ],
  'test-item-f-intro': [
    {
      name: 'Acervo Autorizado ZapiTV',
      title: '[DUBLADO PT-BR] Intro Showcase - 360p MP4',
      url: '/test-videos/intro_360p.mp4',
      sourceType: 'mp4',
      isPtBr: true,
      isDubbed: true,
      quality: '360p',
      providerName: 'Acervo Autorizado ZapiTV'
    }
  ]
};

interface ActivePlaybackState {
  item: ContentItem;
  streams: StremioStream[];
  isTv: boolean;
}

function HarnessApp() {
  const [activePlayback, setActivePlayback] = useState<ActivePlaybackState | null>(null);

  useEffect(() => {
    (window as any).__sessionLifecycle = {
      startPlayback: (item: ContentItem, isTv = false) => {
        const streams = streamsMap[item.id] || [];
        setActivePlayback({ item, streams, isTv });
        return { started: true, itemId: item.id, streamCount: streams.length, isTv };
      },
      closePlayer: () => {
        setActivePlayback(null);
        return { closed: true };
      },
      simulateBrowsingAndPrefetches: async () => {
        const browseTargets = [
          { type: 'movie' as const, id: { id: 'browse-item-1', title: 'Browsing Movie 1', year: 2024 } },
          { type: 'series' as const, id: { id: 'browse-item-2', title: 'Browsing Series 2', year: 2023 }, ep: { season: 1, episode: 1 } },
          { type: 'anime' as const, id: { id: 'browse-item-3', title: 'Browsing Anime 3', year: 2024 }, ep: { season: 1, episode: 1 } },
          { type: 'movie' as const, id: { id: 'browse-item-4', title: 'Browsing Movie 4', year: 2022 } }
        ];

        const abortResults: Array<{ id: string; abortedPrematurely: boolean; durationMs: number }> = [];

        for (const target of browseTargets) {
          const controller = new AbortController();
          const start = Date.now();
          const promise = providerRegistry.resolveStreams(target.type, target.id, target.ep, {
            signal: controller.signal
          }).catch(() => []);

          // Simula usuário trocando de card após 25ms
          await new Promise(r => setTimeout(r, 25));
          controller.abort();
          await promise;
          abortResults.push({
            id: target.id.id,
            abortedPrematurely: true,
            durationMs: Date.now() - start
          });
        }

        return {
          browseCount: browseTargets.length,
          abortResults
        };
      },
      syncProviders: async () => {
        await providerRegistry.syncProvidersWithBackend();
        const providers = providerRegistry.getProviders();
        return {
          totalProviders: providers.length,
          enabledProviders: providers.filter(p => p.enabled).length,
          providers: providers.map(p => ({
            id: p.id,
            name: p.name,
            enabled: p.enabled,
            priority: p.priority,
            configKey: p.configKey
          }))
        };
      },
      getDiagnosticSnapshot: () => {
        const providers = providerRegistry.getProviders();
        const eligible = providerRegistry.getEligibleProviders();
        return {
          totalProviders: providers.length,
          enabledProviders: providers.filter(p => p.enabled).length,
          eligibleCount: eligible.length,
          providerList: providers.map(p => ({
            id: p.id,
            enabled: p.enabled,
            priority: p.priority
          }))
        };
      },
      getVideoDecodingMetrics: () => {
        const video = document.querySelector('video');
        if (!video) throw new Error('Elemento video não encontrado no DOM');

        video.muted = true;
        const events: string[] = [];

        if (video.readyState >= 1) {
          events.push(`initial-metadata (${video.videoWidth}x${video.videoHeight})`);
        }

        return new Promise<any>((resolve, reject) => {
          if (video.currentTime >= 0.5) {
            resolve({
              success: true,
              events: ['already-decoded', `currentTime:${video.currentTime.toFixed(2)}s`],
              currentTime: video.currentTime,
              duration: video.duration,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              paused: video.paused,
              error: null
            });
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error(`Timeout de 20s aguardando decodificação real: currentTime=${video.currentTime}, readyState=${video.readyState}, events=[${events.join(', ')}]`));
          }, 20000);

          video.addEventListener('loadedmetadata', () => {
            events.push(`loadedmetadata (${video.videoWidth}x${video.videoHeight})`);
          });

          video.addEventListener('play', () => events.push('play'));
          video.addEventListener('playing', () => events.push('playing'));
          video.addEventListener('timeupdate', () => {
            events.push(`timeupdate:${video.currentTime.toFixed(2)}s`);
            if (video.currentTime >= 0.5) {
              clearTimeout(timeout);
              resolve({
                success: true,
                events,
                currentTime: video.currentTime,
                duration: video.duration,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                paused: video.paused,
                error: null
              });
            }
          });

          video.addEventListener('error', () => {
            clearTimeout(timeout);
            reject(new Error(`Erro no vídeo: ${video.error?.message || 'Código ' + video.error?.code}`));
          });

          video.play().catch(e => events.push(`play-catch:${e?.message || e}`));
        });
      }
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
      {activePlayback ? (
        <ZapiPlayer
          key={`${activePlayback.item.id}-${activePlayback.isTv ? 'tv' : 'desktop'}`}
          item={activePlayback.item}
          streams={activePlayback.streams}
          verificationState="AVAILABLE"
          initialPlayIntro={false}
          onClose={() => setActivePlayback(null)}
        />
      ) : (
        <div style={{ padding: 40, color: '#fff' }}>
          <h1 id="harness-ready">ZapiTV — Session Stability Test Harness Ready</h1>
        </div>
      )}
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<HarnessApp />);
}
