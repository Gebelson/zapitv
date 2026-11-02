import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { streamValidator } from '../src/core/providers/streamValidator';
import { sourceVerificationService, MSG_INCONCLUSIVE, MSG_UNAVAILABLE } from '../src/core/providers/sourceVerificationService';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { officialPlatformsService } from '../src/core/catalog/officialPlatformsService';
import { isSourcePlayableHere, isSourceTechnicallyPlayable } from '../src/core/providers/sourceReadiness';
import { ContentType, ContentItem } from '../types';
import { StremioStream } from '../src/core/stremio/stremioTypes';

describe('ZAPITV — Resolução de Disponibilidade e Fontes: Pursuit of Jade (2026)', () => {
  const pursuitOfJadeItem: ContentItem = {
    id: 'tmdb-279388',
    tmdbId: '279388',
    imdbId: 'tt35316225',
    title: 'Pursuit of Jade',
    originalTitle: '逐玉',
    alternateTitles: ['Em Busca de Jade', 'Zhu Yu', 'Em busca de Jade'],
    type: ContentType.SERIES,
    mediaFormat: 'series',
    rating: 8.1,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/g2CSCJuWm7IcpuRjxySQvZcJYnp.jpg',
    description: 'Drama histórico chinês com Fan Changyu e Xie Zheng.',
    genres: ['Drama', 'Ação', 'Romance'],
    networks: [{ name: 'iQiyi' }, { name: 'Tencent Video' }],
    homepage: 'https://www.iqiyi.com/a_km3isv5eh1.html'
  };

  const episode1 = { season: 1, episode: 1 };

  const validFenixFlixStream: StremioStream = {
    name: 'FenixFlix',
    title: '🐦‍🔥 Em Busca de Jade\n⏸️ T01 EP01\n🇧🇷 Dublado\n👾 Titans go',
    url: 'https://forks-doramas.madfirebox.shop/E/em-busca-de-jade-2026/01-temporada/01/stream.m3u8',
    providerName: 'FenixFlix',
    providerId: 'fenixflix-animes',
    sourceType: 'hls',
    isPtBr: true,
    isDubbed: true,
    quality: '1080p',
    behaviorHints: { notWebReady: false }
  };

  const validFrostStream: StremioStream = {
    name: 'FrostStream 1080p',
    title: '🎬 Em Busca de Jade\n🥏 T01·E01\n🌊 Azure\n🌎 Português',
    url: 'https://froststream.cloutteam.com/series/v1.WmvyU3Jx-YeRvQAozIcgkuoS',
    providerName: 'FrostStream',
    providerId: 'froststream-http',
    sourceType: 'hls',
    isPtBr: true,
    isDubbed: true,
    quality: '1080p',
    behaviorHints: { notWebReady: false }
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

  describe('1. Identidade Canônica e Títulos Alternativos', () => {
    it('deve construir identidade canônica preservando IMDb tt35316225 e TMDB 279388', () => {
      const identity = canonicalIdentityService.buildIdentity(pursuitOfJadeItem, episode1);
      expect(identity.imdbId).toBe('tt35316225');
      expect(identity.tmdbId).toBe('279388');
      expect(identity.season).toBe(1);
      expect(identity.episode).toBe(1);
      expect(identity.year).toBe(2026);
    });

    it('deve incluir variantes localizadas oficiais nos aliases conhecidos ("Em Busca de Jade", "Zhu Yu")', () => {
      const identity = canonicalIdentityService.buildIdentity(pursuitOfJadeItem, episode1);
      const normalizedAliases = identity.knownAliases.map(a => a.toLowerCase());
      expect(normalizedAliases).toContain('pursuit of jade');
      expect(normalizedAliases).toContain('逐玉');
      expect(normalizedAliases).toContain('em busca de jade');
      expect(normalizedAliases).toContain('zhu yu');
    });

    it('tmdbService.getAlternativeTitles deve buscar títulos alternativos via API do TMDB e armazenar em cache', async () => {
      vi.spyOn(tmdbService as any, 'request').mockResolvedValueOnce({
        id: 279388,
        alternative_titles: {
          results: [
            { iso_3166_1: 'BR', title: 'Em Busca de Jade' },
            { iso_3166_1: 'CN', title: 'Zhu Yu' }
          ]
        },
        translations: {
          translations: [
            { data: { name: 'Pursuit of Jade' } }
          ]
        }
      });

      const titles = await tmdbService.getAlternativeTitles('279388', 'series');
      expect(titles).toContain('Em Busca de Jade');
      expect(titles).toContain('Zhu Yu');
      expect(titles).toContain('Pursuit of Jade');
    });
  });

  describe('2. Validação Rigorosa de Correspondência e Rejeição de Falsos Positivos', () => {
    it('deve aprovar stream do FenixFlix declarado com o título em português "Em Busca de Jade"', () => {
      const identity = canonicalIdentityService.buildIdentity(pursuitOfJadeItem, episode1);
      const evaluation = sourceConfidenceEngine.evaluate(validFenixFlixStream, identity);

      expect(evaluation.isMatch).toBe(true);
      expect(evaluation.confidence).not.toBe('REJECTED');
      expect(evaluation.confidence).not.toBe('QUARANTINED');
    });

    it('deve aprovar stream do FrostStream com título "Em Busca de Jade"', () => {
      const identity = canonicalIdentityService.buildIdentity(pursuitOfJadeItem, episode1);
      const evaluation = sourceConfidenceEngine.evaluate(validFrostStream, identity);

      expect(evaluation.isMatch).toBe(true);
      expect(evaluation.confidence).not.toBe('REJECTED');
    });

    it('NÃO deve aceitar obras diferentes por similaridade frouxa de título (ex: Jade Dynasty, The Legend of Jade Sword)', () => {
      const identity = canonicalIdentityService.buildIdentity(pursuitOfJadeItem, episode1);

      const fakeStream1: StremioStream = {
        name: 'Outro Addon',
        title: '🎬 Jade Dynasty (O Império de Jade) - T01E01 - 1080p',
        url: 'https://wrong-stream.com/jade-dynasty/1.mp4'
      };

      const fakeStream2: StremioStream = {
        name: 'Outro Addon',
        title: '🎬 The Legend of Jade Sword - S01E01 - Dublado',
        url: 'https://wrong-stream.com/legend-jade-sword/1.mp4'
      };

      const fakeStream3: StremioStream = {
        name: 'Outro Addon',
        title: '🎬 Em Busca da Verdade - T01E01',
        url: 'https://wrong-stream.com/busca-verdade/1.mp4'
      };

      expect(sourceConfidenceEngine.evaluate(fakeStream1, identity).isMatch).toBe(false);
      expect(sourceConfidenceEngine.evaluate(fakeStream2, identity).isMatch).toBe(false);
      expect(sourceConfidenceEngine.evaluate(fakeStream3, identity).isMatch).toBe(false);
    });

    it('deve rejeitar stream com episódio divergente (ex: S01E02 oferecido para S01E01)', () => {
      const identity = canonicalIdentityService.buildIdentity(pursuitOfJadeItem, episode1);
      const wrongEpisodeStream: StremioStream = {
        name: 'FenixFlix',
        title: '🐦‍🔥 Em Busca de Jade\n⏸️ T01 EP02\n🇧🇷 Dublado',
        url: 'https://forks-doramas.madfirebox.shop/E/em-busca-de-jade-2026/01-temporada/02/stream.m3u8'
      };

      const evalResult = sourceConfidenceEngine.evaluate(wrongEpisodeStream, identity);
      expect(evalResult.isMatch).toBe(false);
      expect(evalResult.reasons).toContain('Temporada ou episódio diferente do solicitado');
    });
  });

  describe('3. Compatibilidade Técnica e Reprodutibilidade', () => {
    it('stream HLS direto da FenixFlix deve ser considerado reproduzível no navegador', () => {
      expect(isSourcePlayableHere(validFenixFlixStream)).toBe(true);
      expect(isSourceTechnicallyPlayable(validFenixFlixStream)).toBe(true);
    });

    it('stream HLS direto do FrostStream deve ser considerado reproduzível no navegador', () => {
      expect(isSourcePlayableHere(validFrostStream)).toBe(true);
      expect(isSourceTechnicallyPlayable(validFrostStream)).toBe(true);
    });

    it('torrents sem motor Stremio ativo devem ser identificados como não prontos para web', () => {
      const torrentStream: StremioStream = {
        name: 'Torrentio',
        title: 'Em Busca de Jade S01E01 1080p Torrent',
        url: 'http://127.0.0.1:11470/abcdef1234567890/0',
        isTorrent: true,
        behaviorHints: { notWebReady: true }
      };

      expect(isSourcePlayableHere(torrentStream)).toBe(false);
    });
  });

  describe('4. Verificação de Fontes com sourceVerificationService', () => {
    it('deve retornar AVAILABLE quando fontes verificadas são encontradas', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams').mockResolvedValueOnce([
        validFenixFlixStream,
        validFrostStream
      ]);

      const result = await sourceVerificationService.verifySources(pursuitOfJadeItem, episode1);

      expect(result.state).toBe('AVAILABLE');
      expect(result.streams).toHaveLength(2);
      expect(result.streams[0].url).toBe(validFenixFlixStream.url);
      expect(result.streams[1].url).toBe(validFrostStream.url);
      expect(result.errorMessage).toBeUndefined();
    });

    it('deve oferecer fallback dinâmico entre FenixFlix e FrostStream se uma falhar', () => {
      const allStreams = [validFenixFlixStream, validFrostStream];
      const fallback = sourceVerificationService.getNextFallbackStream(validFenixFlixStream.url, allStreams, 'dubbed_ptbr');

      expect(fallback).not.toBeNull();
      expect(fallback?.url).toBe(validFrostStream.url);
    });

    it('deve retornar UNAVAILABLE (e não INCONCLUSIVE) quando a busca conclui sem fontes autorizadas', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams').mockImplementation(async (_type, _id, _ep, options) => {
        options?.onProviderResult?.({ providerId: 'fenixflix-animes', providerName: 'FenixFlix', durationMs: 200, success: true, streamCount: 0 });
        options?.onProviderResult?.({ providerId: 'froststream-http', providerName: 'FrostStream', durationMs: 300, success: true, streamCount: 0 });
        return [];
      });

      const result = await sourceVerificationService.verifySources(pursuitOfJadeItem, episode1);

      expect(result.state).toBe('UNAVAILABLE');
      expect(result.errorMessage).toBe(MSG_UNAVAILABLE);
      expect(result.errorMessage).toContain('Conteúdo indisponível no momento');
      expect(result.errorMessage).not.toContain('Não foi possível verificar a disponibilidade agora');
    });

    it('deve retornar INCONCLUSIVE apenas em caso de falha de conexão / timeout geral dos provedores', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams').mockImplementation(async (_type, _id, _ep, options) => {
        options?.onProviderResult?.({
          providerId: 'froststream-http',
          providerName: 'FrostStream',
          durationMs: 5000,
          success: false,
          isTimeout: true,
          error: 'Timeout após 5000ms',
          streamCount: 0
        });
        return [];
      });

      const result = await sourceVerificationService.verifySources(pursuitOfJadeItem, episode1);

      expect(result.state).toBe('INCONCLUSIVE');
      expect(result.errorMessage).toBe(MSG_INCONCLUSIVE);
      expect(result.errorMessage).toBe('Não foi possível verificar a disponibilidade agora. Tente novamente.');
    });
  });

  describe('5. Plataformas Oficiais de Transmissão (C-Dramas e Pursuit of Jade)', () => {
    it('deve listar plataformas oficiais corretas para Pursuit of Jade (iQIYI, WeTV/Tencent, Viki, YouTube)', () => {
      const platforms = officialPlatformsService.getOfficialPlatforms(pursuitOfJadeItem);

      expect(platforms.length).toBeGreaterThanOrEqual(3);
      const names = platforms.map(p => p.name.toLowerCase());
      expect(names.some(n => n.includes('iqiyi'))).toBe(true);
      expect(names.some(n => n.includes('wetv') || n.includes('tencent'))).toBe(true);
      expect(names.some(n => n.includes('viki'))).toBe(true);
      expect(names.some(n => n.includes('youtube'))).toBe(true);
    });

    it('deve incluir o link direto da homepage oficial quando disponível', () => {
      const platforms = officialPlatformsService.getOfficialPlatforms(pursuitOfJadeItem);
      const direct = platforms.find(p => p.isDirectLink);

      expect(direct).toBeDefined();
      expect(direct?.url).toBe('https://www.iqiyi.com/a_km3isv5eh1.html');
    });

    it('sourceVerificationService deve incluir officialPlatforms no resultado da verificação', async () => {
      vi.spyOn(providerRegistry, 'resolveStreams').mockImplementation(async (_type, _id, _ep, options) => {
        options?.onProviderResult?.({ providerId: 'p1', providerName: 'P1', durationMs: 10, success: true, streamCount: 0 });
        return [];
      });

      const result = await sourceVerificationService.verifySources(pursuitOfJadeItem, episode1);
      expect(result.officialPlatforms).toBeDefined();
      expect(result.officialPlatforms?.length).toBeGreaterThan(0);
      expect(result.officialPlatforms?.some(p => p.name.includes('iQIYI') || p.name.includes('WeTV'))).toBe(true);
    });
  });
});
