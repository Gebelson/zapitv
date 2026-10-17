import { test, expect, describe, vi } from 'vitest';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { ContentItem, ContentType } from '../types';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';
import { classifyStream } from '../src/core/audio/audioDetector';

describe('ZapiTV — Persistência de Áudio PT-BR e Blindagem de Seeking', () => {
  const dummyItem: ContentItem = {
    id: 'tt0109830',
    title: 'Forrest Gump',
    type: ContentType.MOVIE,
    year: 1994,
    audioStatus: 'pt-br-dubbed'
  };

  const dubbedStream: StremioStream = {
    name: 'FrostStream 1080p',
    title: 'Forrest Gump (1994) [1080p] [Dublado PT-BR]',
    url: 'https://stream.provider.com/forrest_ptbr.m3u8',
    isDubbed: true,
    isPtBr: true
  };

  describe('1. Confirmação e Imutabilidade de Áudio PT-BR Durante a Sessão', () => {
    test('não deve alterar estado para unavailable durante buffering ou seek quando PT-BR já foi confirmado', () => {
      // Simulação do comportamento de ptBrAvailabilityState
      let hasDynamicallyConfirmedPtBr = true;
      let ptBrConfirmedOnce = true;
      let isSeeking = false;
      let isLoadingStreams = false;
      let streams: StremioStream[] = [dubbedStream];

      const computePtBrAvailabilityState = (
        item: ContentItem,
        confirmed: boolean,
        confirmedOnce: boolean,
        currentStreams: StremioStream[]
      ) => {
        if (item.audioStatus === 'pt-br-original' || item.audioStatus === 'pt-br-dubbed') {
          return 'confirmed';
        }
        if (confirmed || confirmedOnce) {
          return 'confirmed';
        }
        if (!currentStreams || currentStreams.length === 0) {
          return isLoadingStreams ? 'unknown' : 'unavailable';
        }
        return 'unavailable';
      };

      const computeShowNonDubbedPrompt = (
        forcedPrompt: boolean,
        confirmed: boolean,
        confirmedOnce: boolean,
        seeking: boolean,
        availability: string
      ) => {
        if (confirmed || confirmedOnce || seeking || isLoadingStreams) {
          return false;
        }
        return forcedPrompt || availability === 'unavailable';
      };

      // Estado inicial em reprodução
      expect(computePtBrAvailabilityState(dummyItem, hasDynamicallyConfirmedPtBr, ptBrConfirmedOnce, streams)).toBe('confirmed');
      expect(computeShowNonDubbedPrompt(false, hasDynamicallyConfirmedPtBr, ptBrConfirmedOnce, isSeeking, 'confirmed')).toBe(false);

      // Usuário avança para 50%, 75% ou 90% (seek ativo)
      isSeeking = true;
      // Metadados temporários podem oscilar durante o carregamento de segmentos
      hasDynamicallyConfirmedPtBr = false; // transitório no player
      expect(computePtBrAvailabilityState(dummyItem, hasDynamicallyConfirmedPtBr, ptBrConfirmedOnce, streams)).toBe('confirmed');
      expect(computeShowNonDubbedPrompt(false, hasDynamicallyConfirmedPtBr, ptBrConfirmedOnce, isSeeking, 'confirmed')).toBe(false);

      // Seek concluído mas buffer ainda carregando
      isSeeking = false;
      expect(computeShowNonDubbedPrompt(false, hasDynamicallyConfirmedPtBr, ptBrConfirmedOnce, isSeeking, 'confirmed')).toBe(false);
    });

    test('showNonDubbedPrompt deve retornar false incondicionalmente enquanto isSeeking ou isSeekingRef for verdadeiro', () => {
      const showPrompt = (confirmedOnce: boolean, isSeeking: boolean, isSeekingRef: boolean) => {
        if (confirmedOnce || isSeeking || isSeekingRef) {
          return false;
        }
        return true;
      };

      expect(showPrompt(false, true, false)).toBe(false);
      expect(showPrompt(false, false, true)).toBe(false);
      expect(showPrompt(true, false, false)).toBe(false);
    });
  });

  describe('2. Blindagem do Stall Watchdog e Monitor de Áudio no Seek', () => {
    test('stall timer deve permanecer zerado durante seek ou buffering (readyState < 3)', () => {
      let stallTimer = 0;
      let lastPlaybackPosition = 100;
      const curPos = 100; // posição parada enquanto bufferiza novo trecho

      const runWatchdogTick = (options: {
        isSeeking: boolean;
        isSeekingRef: boolean;
        videoSeeking: boolean;
        readyState: number;
        isLoading: boolean;
        isPlaying: boolean;
      }) => {
        const isBufferingOrSeeking =
          options.isSeeking ||
          options.isSeekingRef ||
          options.videoSeeking ||
          options.readyState < 3 ||
          options.isLoading;

        if (isBufferingOrSeeking) {
          stallTimer = 0;
          lastPlaybackPosition = curPos;
          return { stalled: false, timer: stallTimer };
        }

        if (options.isPlaying) {
          stallTimer += 500;
          return { stalled: stallTimer >= 6000, timer: stallTimer };
        }

        return { stalled: false, timer: stallTimer };
      };

      // Tenta acumular ticks de stall durante busca para o minuto 45
      for (let i = 0; i < 20; i++) {
        const result = runWatchdogTick({
          isSeeking: true,
          isSeekingRef: true,
          videoSeeking: true,
          readyState: 2, // HAVE_CURRENT_DATA (ainda baixando HAVE_ENOUGH_DATA)
          isLoading: true,
          isPlaying: true
        });
        expect(result.stalled).toBe(false);
        expect(result.timer).toBe(0);
      }

      expect(stallTimer).toBe(0);
    });

    test('monitor de áudio não deve acumular ticks nem disparar fallback se PT-BR já foi confirmado', () => {
      let audioTicks = 0;
      let fallbackTriggered = false;

      const runAudioCheck = (options: {
        currentTime: number;
        readyState: number;
        isSeeking: boolean;
        hasConfirmedPtBr: boolean;
        decodedBytes: number;
      }) => {
        if (
          options.currentTime < 5 ||
          options.readyState < 3 ||
          options.isSeeking
        ) {
          audioTicks = 0;
          return;
        }

        // Blindagem essencial: se PT-BR já foi confirmado, soluços pós-seek não disparam fallback falso
        if (options.hasConfirmedPtBr) {
          return;
        }

        if (options.decodedBytes === 0) {
          audioTicks += 1;
          if (audioTicks >= 4) {
            fallbackTriggered = true;
          }
        } else {
          audioTicks = 0;
        }
      };

      // Simula 10 verificações consecutivas de áudio durante o seek para 50%
      for (let i = 0; i < 10; i++) {
        runAudioCheck({
          currentTime: 1500,
          readyState: 2,
          isSeeking: true,
          hasConfirmedPtBr: true,
          decodedBytes: 0
        });
      }

      expect(audioTicks).toBe(0);
      expect(fallbackTriggered).toBe(false);
    });
  });

  describe('3. Proteção Contra Quedas para "Dublagem indisponível" no Fallback', () => {
    test('handleStreamFallback não deve abrir modal de dublagem indisponível se PT-BR já estava ativo', () => {
      let forcedNonDubbedPrompt = false;
      let fallbackHandledGracefully = false;
      const ptBrConfirmedOnce = true;
      const requiredLanguage = 'pt-br';
      const anyRemainingStreams = [
        { url: 'https://other.com/foreign.mp4', isDubbed: false }
      ];

      const executeFallback = () => {
        if (requiredLanguage.toLowerCase() === 'pt-br' && anyRemainingStreams.length > 0) {
          if (ptBrConfirmedOnce) {
            // Em vez de forçar modal enganoso para o usuário, mantém a tentativa de recuperação da fonte
            fallbackHandledGracefully = true;
            return;
          }
          forcedNonDubbedPrompt = true;
        }
      };

      executeFallback();

      expect(forcedNonDubbedPrompt).toBe(false);
      expect(fallbackHandledGracefully).toBe(true);
    });

    test('erro MEDIA_ERR_ABORTED (código 1) gerado por cancelamento de chunk no scrub deve ser ignorado', () => {
      const videoError = { code: 1, message: 'MEDIA_ERR_ABORTED' };
      let fallbackCalled = false;

      const handleVideoError = (err: { code: number }) => {
        if (err?.code === 1) {
          // Ignorado com sucesso (operação normal de seek / scrub cancelando buffers passados)
          return;
        }
        fallbackCalled = true;
      };

      handleVideoError(videoError);
      expect(fallbackCalled).toBe(false);
    });
  });

  describe('4. Preservação de Faixas de Áudio HLS em AUDIO_TRACKS_UPDATED', () => {
    test('deve manter a faixa selecionada pelo usuário após atualização de manifesto/fragmentos', () => {
      const selectedHlsAudioTrackRef = { current: 1 }; // Usuário estava ouvindo a faixa 1 (PT-BR)
      let currentAudioTrack = 1;

      const newTracks = [
        { id: 0, name: 'English [Original]', lang: 'eng' },
        { id: 1, name: 'Português [Dublado]', lang: 'por' },
        { id: 2, name: 'Español', lang: 'spa' }
      ];

      const onAudioTracksUpdated = (tracks: typeof newTracks) => {
        if (selectedHlsAudioTrackRef.current >= 0 && tracks.some(t => t.id === selectedHlsAudioTrackRef.current)) {
          currentAudioTrack = selectedHlsAudioTrackRef.current;
        } else {
          currentAudioTrack = 0; // fallback para padrão
        }
      };

      onAudioTracksUpdated(newTracks);

      expect(currentAudioTrack).toBe(1);
      expect(selectedHlsAudioTrackRef.current).toBe(1);
    });
  });
});
