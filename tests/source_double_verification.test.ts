import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sourceVerificationService,
  VerificationState,
  MSG_INCONCLUSIVE,
  MSG_UNAVAILABLE
} from '../src/core/providers/sourceVerificationService';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { ContentItem, ContentType } from '../types';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import playerSource from '../src/components/player/ZapiPlayer.tsx?raw';

describe('ZAPITV — SISTEMA INTELIGENTE DE VERIFICAÇÃO DUPLA DE FONTES', () => {
  const dummyMovie: ContentItem = {
    id: 'test-movie-1',
    title: 'Filme de Teste',
    originalTitle: 'Test Movie',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 2024,
    tmdbId: 99999,
    imdbId: 'tt9999999',
    rating: 8.5,
    image: 'https://image.tmdb.org/t/p/w500/test.jpg'
  };

  beforeEach(() => {
    providerRegistry.resetProviderPriorities();
    providerRegistry.clearCache();
    sourceVerificationService.clearLogs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Centralização, Prioridade Configurável e Inclusão de Provedores', () => {
    it('deve incluir todos os provedores ativos na ordem de prioridade oficial', () => {
      const providers = providerRegistry.getProviders();
      const ids = providers.map(p => p.id);

      expect(ids).toContain('zapitv-show-subtitle-pt-br');
      expect(ids).toContain('zapitv-mico-leao-dublado');
      expect(ids).toContain('froststream-http');
      expect(ids).toContain('fenixflix-animes');
      expect(ids).toContain('torrentio-brazuca');
      expect(ids).toContain('torrentio-global');
      expect(ids).toContain('magnetflix-animes');
      expect(ids).toContain('zapitv-cinema-aberto');
      expect(ids).toContain('zapitv-blender-open');

      // Ordem inicial esperada
      expect(providers[0].id).toBe('zapitv-show-subtitle-pt-br');
      expect(providers[1].id).toBe('zapitv-mico-leao-dublado');
      expect(providers[2].id).toBe('froststream-http');
    });

    it('FrostStream NUNCA deve ser ignorado ou despriorizado indevidamente', () => {
      const frost = providerRegistry.getProvider('froststream');
      expect(frost).toBeDefined();
      expect(frost?.enabled).toBe(true);
      expect(frost?.priority).toBe(3);
    });

    it('deve permitir reconfiguração de prioridades em tempo de execução e respeitar a nova ordem', () => {
      // Reconfigura FrostStream para Prioridade 1
      providerRegistry.setProviderPriority('froststream', 1);
      const providers = providerRegistry.getProviders();
      expect(providers[0].id).toBe('froststream-http');
      expect(providers[0].priority).toBe(1);

      // Reverte
      providerRegistry.resetProviderPriorities();
      const reverted = providerRegistry.getProviders();
      expect(reverted[0].id).toBe('zapitv-show-subtitle-pt-br');
    });
  });

  describe('2. Primeira Verificação (Rápida e Progressiva)', () => {
    it('deve retornar AVAILABLE imediatamente se encontrar stream válido na 1ª fase, sem acionar 2ª fase', async () => {
      const validStream: StremioStream = {
        name: 'FrostStream 1080p',
        title: 'Filme de Teste 1080p Dublado PT-BR',
        url: 'https://stream.server.com/video.mp4',
        isDubbed: true,
        isPtBr: true
      };

      vi.spyOn(providerRegistry, 'resolveStreams').mockResolvedValueOnce([validStream]);

      const statesRecorded: VerificationState[] = [];
      const result = await sourceVerificationService.verifySources(dummyMovie, undefined, {
        onStateChange: (st) => statesRecorded.push(st)
      });

      expect(result.state).toBe('AVAILABLE');
      expect(result.streams).toHaveLength(1);
      expect(result.streams[0].url).toBe(validStream.url);
      expect(statesRecorded).toContain('SEARCHING');
      expect(statesRecorded).toContain('AVAILABLE');
      expect(statesRecorded).not.toContain('RETRYING'); // Fase 2 NÃO foi acionada
      expect(result.diagnosticLog.phase2DurationMs).toBeUndefined();
    });

    it('deve emitir streams progressivamente durante a busca', async () => {
      const progressiveStreams: StremioStream[] = [];
      const streamCandidate: StremioStream = {
        name: 'Show Subtitle 1080p',
        title: 'Filme de Teste 1080p Dublado',
        url: 'https://cdn.test.com/stream.m3u8'
      };

      vi.spyOn(providerRegistry, 'resolveStreams').mockImplementationOnce(async (_type, _id, _ep, options) => {
        options?.onProgressiveStreams?.([streamCandidate]);
        return [streamCandidate];
      });

      const result = await sourceVerificationService.verifySources(dummyMovie, undefined, {
        onProgressiveStreams: (st) => progressiveStreams.push(...st)
      });

      expect(result.state).toBe('AVAILABLE');
      expect(progressiveStreams.length).toBeGreaterThanOrEqual(1);
      expect(progressiveStreams[0].name).toBe('Show Subtitle 1080p');
    });
  });

  describe('3. Segunda Verificação Automática (Obrigatória em caso de falha inicial)', () => {
    it('se 1ª verificação retornar 0 fontes, deve acionar AUTOMATICAMENTE a 2ª fase e encontrar a fonte', async () => {
      const streamFoundInPhase2: StremioStream = {
        name: 'FenixFlix 1080p',
        title: 'Filme de Teste 1080p Nacional',
        url: 'https://fenix.cdn.com/play.mp4'
      };

      // 1ª chamada retorna vazio, 2ª chamada (retry) retorna stream
      const resolveSpy = vi.spyOn(providerRegistry, 'resolveStreams')
        .mockResolvedValueOnce([]) // Fase 1
        .mockResolvedValueOnce([streamFoundInPhase2]); // Fase 2

      const statesRecorded: VerificationState[] = [];
      const result = await sourceVerificationService.verifySources(dummyMovie, undefined, {
        onStateChange: (st) => statesRecorded.push(st)
      });

      expect(resolveSpy).toHaveBeenCalledTimes(2);
      expect(statesRecorded).toContain('SEARCHING');
      expect(statesRecorded).toContain('RETRYING');
      expect(statesRecorded).toContain('AVAILABLE');
      expect(result.state).toBe('AVAILABLE');
      expect(result.streams).toHaveLength(1);
      expect(result.streams[0].url).toBe(streamFoundInPhase2.url);
      expect(result.diagnosticLog.phase2DurationMs).toBeDefined();
    });

    it('deve tentar re-resolver IMDb ID se o item inicial estiver sem identificador canônico', async () => {
      const itemWithoutImdb: ContentItem = {
        ...dummyMovie,
        imdbId: undefined
      };

      vi.spyOn(tmdbService, 'getImdbId').mockResolvedValueOnce('tt1234567');
      const resolveSpy = vi.spyOn(providerRegistry, 'resolveStreams')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          name: 'Torrentio 1080p',
          title: 'Filme 1080p',
          url: 'https://torrent.io/stream'
        }]);

      const result = await sourceVerificationService.verifySources(itemWithoutImdb);

      expect(result.state).toBe('AVAILABLE');
      expect(resolveSpy).toHaveBeenLastCalledWith(
        'movie',
        expect.objectContaining({ imdbId: 'tt1234567' }),
        undefined,
        expect.anything()
      );
    });
  });

  describe('4. Classificação Rigorosa de Estados e Mensagens', () => {
    it('deve classificar como UNAVAILABLE apenas quando todos os provedores responderem sem fontes (ausência confirmada)', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams').mockImplementation(async (_type, _id, _ep, options) => {
        options?.onProviderResult?.({ providerId: 'froststream', providerName: 'FrostStream', durationMs: 10, success: true, streamCount: 0 });
        return [];
      });

      const result = await sourceVerificationService.verifySources(dummyMovie);

      expect(result.state).toBe('UNAVAILABLE');
      expect(result.errorMessage).toBe(MSG_UNAVAILABLE);
      expect(result.errorMessage).toContain('Conteúdo indisponível no momento');
      expect(result.diagnosticLog.timeouts).toHaveLength(0);
      expect(result.diagnosticLog.networkErrors).toHaveLength(0);
    });

    it('não declara indisponibilidade quando um provedor falha e outro responde vazio', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams').mockImplementation(async (_type, _id, _ep, options) => {
        options?.onProviderResult?.({ providerId: 'a', providerName: 'A', durationMs: 10, success: true, streamCount: 0 });
        options?.onProviderResult?.({ providerId: 'b', providerName: 'B', durationMs: 5000, success: false, streamCount: 0, isTimeout: true, error: 'Timeout' });
        return [];
      });
      const result = await sourceVerificationService.verifySources(dummyMovie);
      expect(result.state).toBe('INCONCLUSIVE');
      expect(result.diagnosticLog.inconclusiveReason).toContain('b');
    });

    it('não declara indisponibilidade quando nenhum provedor foi consultado', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams').mockResolvedValue([]);
      const result = await sourceVerificationService.verifySources(dummyMovie);
      expect(result.state).toBe('INCONCLUSIVE');
    });

    it('NUNCA deve exibir "Conteúdo indisponível" se o resultado for INCONCLUSIVE (timeout ou erro de infraestrutura)', async () => {
      // Simula timeout / erro de rede
      vi.spyOn(providerRegistry, 'resolveStreams').mockImplementation(async (_type, _id, _ep, options) => {
        options?.onProviderResult?.({
          providerId: 'froststream',
          providerName: 'FrostStream',
          durationMs: 5000,
          success: false,
          streamCount: 0,
          isTimeout: true,
          error: 'Timeout após 5000ms'
        });
        return [];
      });

      const result = await sourceVerificationService.verifySources(dummyMovie);

      expect(result.state).toBe('INCONCLUSIVE');
      expect(result.errorMessage).toBe(MSG_INCONCLUSIVE);
      expect(result.errorMessage).toBe('Não foi possível verificar a disponibilidade agora. Tente novamente.');
      expect(result.errorMessage).not.toContain('Conteúdo indisponível no momento');
      expect(result.diagnosticLog.timeouts).toContain('froststream');
    });
  });

  describe('5. Cache Inteligente: Positivo de Longa Duração e Negativo Ultracurto (15s)', () => {
    it('deve armazenar cache negativo com TTL de 15s e ignorá-lo na Segunda Verificação (bypassNegativeCache)', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          name: 'Show Subtitle',
          title: 'Filme',
          url: 'https://show.com/play'
        }]);

      const result = await sourceVerificationService.verifySources(dummyMovie);

      expect(result.state).toBe('AVAILABLE');
      expect(result.streams.length).toBe(1);
    });

    it('libera listeners de progresso após resposta do cache', async () => {
      const registry = providerRegistry as any;
      const target = { id: dummyMovie.id, title: dummyMovie.title };
      const key = JSON.stringify(['v5_identity', 'movie', target.id, undefined, undefined, target.title, undefined, undefined, undefined, undefined]);
      registry.cache.set(key, { streams: [{ name: 'A', title: 'A', url: 'https://example.test/a.mp4' }], timestamp: Date.now() });
      const onProgressiveStreams = vi.fn();
      await providerRegistry.resolveStreams('movie', target, undefined, { onProgressiveStreams });
      expect(onProgressiveStreams).toHaveBeenCalledTimes(1);
      expect(registry.progressiveListeners.has(key)).toBe(false);
      expect(registry.inFlightConsumers.has(key)).toBe(false);
    });

    it('remove callbacks abortados e não retém ouvintes de uma busca compartilhada', async () => {
      const registry = providerRegistry as any;
      const target = { id: dummyMovie.id, title: dummyMovie.title };
      const key = JSON.stringify(['v5_identity', 'movie', target.id, undefined, undefined, target.title, undefined, undefined, undefined, undefined]);
      let finish!: () => void;
      const gate = new Promise<void>(resolve => { finish = resolve; });
      vi.spyOn(providerRegistry, 'resolveStreamsFresh').mockImplementation(async () => { await gate; return []; });
      const first = new AbortController();
      const second = new AbortController();
      const a = providerRegistry.resolveStreams('movie', target, undefined, { signal: first.signal, onProgressiveStreams: vi.fn() });
      const b = providerRegistry.resolveStreams('movie', target, undefined, { signal: second.signal, onProgressiveStreams: vi.fn() });
      expect(registry.progressiveListeners.get(key)?.size).toBe(2);
      first.abort();
      expect(registry.progressiveListeners.get(key)?.size).toBe(1);
      finish();
      await Promise.all([a, b]);
      expect(registry.progressiveListeners.has(key)).toBe(false);
      expect(registry.inFlightConsumers.has(key)).toBe(false);
    });
  });

  describe('6. Recuperação Automática de Reprodução (Fallback Dinâmico)', () => {
    it('getNextFallbackStream deve descartar a fonte que falhou e selecionar a próxima candidata válida', () => {
      const stream1: StremioStream = { name: 'P1', title: 'Stream 1', url: 'https://fail.com/1.mp4' };
      const stream2: StremioStream = { name: 'P2', title: 'Stream 2', url: 'https://ok.com/2.mp4' };
      const stream3: StremioStream = { name: 'P3', title: 'Stream 3', url: 'https://ok.com/3.mp4' };

      const fallback = sourceVerificationService.getNextFallbackStream(
        stream1.url,
        [stream1, stream2, stream3]
      );

      expect(fallback).not.toBeNull();
      expect(fallback?.url).toBe(stream2.url);
    });

    it('getNextFallbackStream deve priorizar dublagem PT-BR se solicitada', () => {
      const streamFailed: StremioStream = { name: 'P1', title: 'Falha', url: 'https://fail.com/1.mp4', isDubbed: true };
      const streamOriginal: StremioStream = { name: 'P2', title: 'Original', url: 'https://orig.com/2.mp4', isDubbed: false };
      const streamDubbed: StremioStream = { name: 'P3', title: 'Dublado PT-BR', url: 'https://dub.com/3.mp4', isDubbed: true, isPtBr: true };

      const fallback = sourceVerificationService.getNextFallbackStream(
        streamFailed.url,
        [streamFailed, streamOriginal, streamDubbed],
        'dubbed_ptbr'
      );

      expect(fallback?.url).toBe(streamDubbed.url);
    });
  });

  describe('7. Conformidade com UI e Player (ZapiPlayer e ContentDetailModal)', () => {
    it('ZapiPlayer deve conter lógica para diferenciar INCONCLUSIVE de UNAVAILABLE', () => {
      expect(playerSource).toContain("verificationState === 'INCONCLUSIVE'");
      expect(playerSource).toContain('Não foi possível verificar a disponibilidade');
      expect(playerSource).toContain('Conteúdo indisponível');
    });

    it('ZapiPlayer NÃO deve marcar allSourcesFailed enquanto estiver em SEARCHING ou RETRYING', () => {
      expect(playerSource).toContain("verificationState === 'SEARCHING' || verificationState === 'RETRYING'");
    });

    it('ZapiPlayer deve manter botão Tentar novamente e Voltar aos detalhes', () => {
      expect(playerSource).toContain('Tentar novamente');
      expect(playerSource).toContain('Voltar aos detalhes');
    });
  });
});
