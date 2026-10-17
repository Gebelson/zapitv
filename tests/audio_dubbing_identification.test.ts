import { test, expect, describe } from 'vitest';
import { audioPreferenceService } from '../src/core/audio/audioPreferenceService';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { classifyStream } from '../src/core/audio/audioDetector';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';
import { StremioStream } from '../src/core/stremio/stremioTypes';

describe('Identificação e Sincronização de Dublagem PT-BR no ZapiTV', () => {
  describe('Caso de Teste Principal: Forrest Gump (tt0109830) e Obras Estrangeiras', () => {
    const forrestFrostStream: StremioStream = {
      name: 'FrostStream 720p',
      title: '🎬 Forrest Gump O Contador de Histórias (1994)\n🌊 Astra\n🌎 Português',
      url: 'https://froststream.cloutteam.com/movie/v1._O4LhnNbX41QOR__5aeb3SmLf5B',
      behaviorHints: {
        bingeGroup: 'cloutstream-cs:movie:forrest-gump-o-contador-de-historias-1994',
        notWebReady: true
      }
    };

    test('1. Deve reconhecer stream com "🌎 Português" como áudio dublado em PT-BR (Prioridade 1)', () => {
      const audioAnalysis = audioPreferenceService.analyzeAudio(forrestFrostStream);
      expect(audioAnalysis.isDubbed).toBe(true);
      expect(audioAnalysis.isPtBr).toBe(true);
      expect(audioAnalysis.tier).toBe('dubbed_ptbr');
      expect(audioAnalysis.language).toBe('pt-BR');

      const evaluation = sourceSelectionService.evaluateStream(forrestFrostStream, { hasExternalPtSub: false });
      expect(evaluation.priority).toBe(1);
      expect(evaluation.audioTier).toBe('dubbed_ptbr');
      expect(evaluation.score).toBeGreaterThan(80000);

      const classification = classifyStream(forrestFrostStream);
      expect(classification.isDubbed).toBe(true);
      expect(classification.isPtBr).toBe(true);
      expect(classification.badge).toBe('🔊');
      expect(classification.badgeLabel).toBe('Áudio Dublado PT-BR');
    });

    test('2. Deve priorizar a fonte dublada PT-BR acima de releases estrangeiros em alta resolução', () => {
      const torrentioYify: StremioStream = {
        name: '💬 Torrentio 720p',
        title: 'Forrest Gump (1994) 720p BrRip x264 - 850MB - YIFY',
        url: 'http://127.0.0.1:11470/9bfb78f3cdd5e7cfc3fd2a5cdddb1e86da43d345/0'
      };
      const torrentio4kForeign: StremioStream = {
        name: 'Torrentio 4K',
        title: 'Forrest.Gump.1994.2160p.BluRay.REMUX 🇬🇧 / 🇷🇺',
        url: 'http://127.0.0.1:11470/ef29b63348871b5707574bccfa602dcf96f32c58/0'
      };

      const ranked = sourceSelectionService.rankStreams([torrentio4kForeign, torrentioYify, forrestFrostStream], {
        hasExternalPtSub: false
      });

      expect(ranked[0].name).toContain('FrostStream');
      expect((ranked[0] as any)._smartPriority).toBe(1);
      expect((ranked[0] as any)._smartScore).toBeGreaterThan((ranked[1] as any)._smartScore);
    });

    test('3. Áudio único em português não deve exigir dual audio para ser considerado dublado', () => {
      const singleAudioPt: StremioStream = {
        name: 'Servidor CDN',
        title: 'Forrest Gump 1080p Português',
        url: 'https://cdn.example.com/forrest.mp4'
      };

      const analysis = audioPreferenceService.analyzeAudio(singleAudioPt);
      expect(analysis.isDubbed).toBe(true);
      expect(analysis.isDualAudio).toBe(false);
      expect(analysis.tier).toBe('dubbed_ptbr');
    });

    test('4. Deve gerar opção de áudio PT-BR correta no menu com selo Dublado para fontes HTTP', () => {
      const options = audioSelectionManager.buildAudioOptions({
        item: { title: 'Forrest Gump', originalLanguage: 'en' },
        streams: [forrestFrostStream],
        hlsTracks: [],
        currentStreamIndex: 0,
        activeAudioId: null
      });

      expect(options.length).toBe(1);
      expect(options[0].langCode).toBe('pt-BR');
      expect(options[0].flag).toBe('🇧🇷');
      expect(options[0].label).toBe('Português (Brasil)');
      expect(options[0].badge).toBe('Dublado');
    });
  });

  describe('Diferenciação Estrita dos 3 Estados de Áudio (Requisitos 5 e 6)', () => {
    test('Estado 1: PT-BR Confirmado (Dublado dedicado ou Dual Audio)', () => {
      const dubbedStream: StremioStream = {
        name: 'Stream 1080p',
        title: 'Filme Ação 1080p Dublado',
        url: 'https://example.com/movie.mp4'
      };
      const cls = classifyStream(dubbedStream);
      expect(cls.isDubbed).toBe(true);
      expect(cls.isPtBr).toBe(true);
      expect(cls.language).toBe('pt-BR');
      expect(cls.badge).toBe('🔊');

      const dualStream: StremioStream = {
        name: 'Stream 1080p',
        title: 'Filme Ação 1080p Dublado [Dual-Audio]',
        url: 'https://example.com/movie.mp4'
      };
      const clsDual = classifyStream(dualStream);
      expect(clsDual.isDubbed).toBe(true);
      expect(clsDual.isPtBr).toBe(true);
      expect(clsDual.language).toBe('dual');
      expect(clsDual.badge).toBe('🔊');
    });

    test('Estado 2: Idioma Desconhecido (Não declarar "Sem PT-BR" precipitadamente)', () => {
      const unknownStream: StremioStream = {
        name: 'Direct Stream HD',
        title: 'Action Movie (2024) 1080p WEB-DL x264',
        url: 'https://example.com/action.mp4'
      };
      const cls = classifyStream(unknownStream);
      expect(cls.isDubbed).toBe(false);
      expect(cls.isPtBr).toBe(false);
      expect(cls.language).toBe('unknown');
      expect(cls.badgeLabel).toBe('Idioma não declarado');
    });

    test('Estado 3: PT-BR Indisponível (Fontes expressamente em idiomas estrangeiros sem PT-BR)', () => {
      const foreignStream: StremioStream = {
        name: 'Torrentio 1080p',
        title: 'Action Movie 1994 1080p BluRay AC3 5.1 ITA.ENG sub ita.eng',
        url: 'http://127.0.0.1:11470/hash/0'
      };
      const cls = classifyStream(foreignStream);
      expect(cls.isDubbed).toBe(false);
      expect(cls.isPtBr).toBe(false);
      expect(cls.language).toBe('en');
      expect(cls.badgeLabel).toBe('Sem PT-BR');
    });
  });

  describe('Suporte Global a Séries e Animes com Dublagem PT-BR', () => {
    test('Anime com dublagem brasileira deve ser classificado com Prioridade 1', () => {
      const animeStream: StremioStream = {
        name: 'FenixFlix FHD',
        title: 'Attack on Titan S01E01 1080p Dublado PT-BR',
        url: 'https://cdn.fenixhub.online/aot_ep1.mp4'
      };

      const analysis = audioPreferenceService.analyzeAudio(animeStream);
      expect(analysis.isDubbed).toBe(true);
      expect(analysis.tier).toBe('dubbed_ptbr');

      const evaluation = sourceSelectionService.evaluateStream(animeStream, { hasExternalPtSub: false });
      expect(evaluation.priority).toBe(1);
    });

    test('Série internacional com áudio em português é classificada como dublada', () => {
      const seriesStream: StremioStream = {
        name: 'FrostStream 1080p',
        title: 'Breaking Bad S01E01\n🌊 Astra\n🌎 Português',
        url: 'https://froststream.cloutteam.com/series/bb1'
      };

      const analysis = audioPreferenceService.analyzeAudio(seriesStream);
      expect(analysis.isDubbed).toBe(true);
      expect(analysis.tier).toBe('dubbed_ptbr');
      expect(analysis.language).toBe('pt-BR');
    });
  });
});
