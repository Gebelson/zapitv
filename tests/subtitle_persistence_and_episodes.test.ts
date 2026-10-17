import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage para ambiente de testes Node/Vitest
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = String(value); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (index: number) => Object.keys(store)[index] || null,
  get length() { return Object.keys(store).length; }
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

if (typeof window === 'undefined') {
  (global as any).window = {
    localStorage: mockLocalStorage,
    dispatchEvent: vi.fn()
  };
} else {
  (window as any).localStorage = mockLocalStorage;
}

import {
  subtitlePreferenceService,
  SubtitlePreferenceService,
  STORAGE_KEY_SUBTITLE_PREFERENCE
} from '../src/core/subtitles/subtitlePreferenceService';
import { SubtitleTrack, subtitleService } from '../src/core/subtitles/subtitleService';
import { analyzeStreamSubtitleFormat } from '../src/core/subtitles/streamSubtitleDetector';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { ContentItem, ContentType } from '../types';

describe('ZapiTV — Manutenção de Preferências de Legendas entre Episódios', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    // Reseta preferência para o padrão
    subtitlePreferenceService.setSubtitlesEnabled(true);
    subtitlePreferenceService.setPreferredLanguage('pt-BR');
  });

  it('1. Salva preferência de legendas de forma persistente no localStorage', () => {
    // Desativa legendas
    subtitlePreferenceService.setSubtitlesEnabled(false);
    expect(subtitlePreferenceService.isSubtitlesEnabled()).toBe(false);

    // Verifica gravação física no localStorage
    const savedRaw = mockLocalStorage.getItem(STORAGE_KEY_SUBTITLE_PREFERENCE);
    expect(savedRaw).not.toBeNull();
    const parsed = JSON.parse(savedRaw!);
    expect(parsed.enabled).toBe(false);
    expect(parsed.hasExplicitChoice).toBe(true);

    // Nova instância do serviço deve ler exatamente a preferência salva (simulando F5 ou retorno ao site)
    const newService = new SubtitlePreferenceService();
    expect(newService.isSubtitlesEnabled()).toBe(false);
  });

  it('2. Se o usuário selecionar "Sem legenda", mantém desativada no próximo episódio (Requisito 2)', () => {
    // Usuário desativa legendas no episódio 1
    subtitlePreferenceService.setSubtitlesEnabled(false);

    // Simula faixas de legenda encontradas para o episódio 2
    const episode2Tracks: SubtitleTrack[] = [
      { id: 'ep2_sub_pt', lang: 'pt-BR', languageName: 'Português (Brasil)', url: 'https://subs.test/ep2_pt.vtt', isPtBr: true },
      { id: 'ep2_sub_en', lang: 'en', languageName: 'English', url: 'https://subs.test/ep2_en.vtt', isPtBr: false }
    ];

    const streamClean: StremioStream = {
      name: 'Fonte Episódio 2 1080p',
      title: 'Breaking.Bad.S01E02.1080p.WEB-DL.x264',
      url: 'https://stream.test/ep2.mp4'
    };

    // Resolução da legenda para o episódio 2
    const desired = subtitlePreferenceService.resolveDesiredSubtitleTrack(episode2Tracks, streamClean, false);
    expect(desired.track).toBeNull();
    expect(desired.reason).toContain('Sem legenda');
  });

  it('3. Preserva o idioma escolhido quando as legendas estiverem ativadas (Requisito 3)', () => {
    // Usuário ativa legendas e escolhe Português (Brasil)
    subtitlePreferenceService.setPreferredLanguage('pt-BR');

    const episode1Tracks: SubtitleTrack[] = [
      { id: 'ep1_sub_en', lang: 'en', languageName: 'English', url: 'https://subs.test/ep1_en.vtt' },
      { id: 'ep1_sub_pt', lang: 'pt-BR', languageName: 'Português (Brasil)', url: 'https://subs.test/ep1_pt.vtt', isPtBr: true }
    ];

    const desiredEp1 = subtitlePreferenceService.resolveDesiredSubtitleTrack(episode1Tracks);
    expect(desiredEp1.track?.id).toBe('ep1_sub_pt');

    // Avança para o episódio 2: faixas com IDs diferentes, mesmo idioma
    const episode2Tracks: SubtitleTrack[] = [
      { id: 'ep2_sub_en', lang: 'en', languageName: 'English', url: 'https://subs.test/ep2_en.vtt' },
      { id: 'ep2_sub_pt', lang: 'pt-BR', languageName: 'Português (Brasil)', url: 'https://subs.test/ep2_pt.vtt', isPtBr: true }
    ];

    const desiredEp2 = subtitlePreferenceService.resolveDesiredSubtitleTrack(episode2Tracks);
    expect(desiredEp2.track?.id).toBe('ep2_sub_pt');
    expect(desiredEp2.track?.lang).toBe('pt-BR');
  });

  it('4. Preserva preferências durante troca de temporada, autoplay e botão Próximo Episódio (Requisito 5)', () => {
    // Usuário desativa legendas na Temporada 1 Episódio 10
    subtitlePreferenceService.setSubtitlesEnabled(false);

    // Transição automática para Temporada 2 Episódio 1
    const season2Episode1Tracks: SubtitleTrack[] = [
      { id: 's2e1_sub_pt', lang: 'pt-BR', languageName: 'Português (Brasil)', url: 'https://subs.test/s2e1.vtt', isPtBr: true }
    ];

    const streamS2E1: StremioStream = {
      name: 'Fonte S02E01',
      title: 'Serie.S02E01.1080p',
      url: 'https://stream.test/s2e1.mp4'
    };

    const resolution = subtitlePreferenceService.resolveDesiredSubtitleTrack(season2Episode1Tracks, streamS2E1, false);
    expect(resolution.track).toBeNull();
    expect(subtitlePreferenceService.isSubtitlesEnabled()).toBe(false);
  });

  it('5. Mantém preferência ao trocar de fonte/stream no mesmo episódio (Requisito 5)', () => {
    subtitlePreferenceService.setSubtitlesEnabled(false);

    const streamA: StremioStream = { name: 'Fonte 1', title: 'Video 1', url: 'https://stream.test/1.mp4' };
    const streamB: StremioStream = { name: 'Fonte 2', title: 'Video 2 (Backup)', url: 'https://stream.test/2.mp4' };

    const tracks: SubtitleTrack[] = [
      { id: 'sub_pt', lang: 'pt-BR', languageName: 'Português (Brasil)', url: 'https://subs.test/pt.vtt', isPtBr: true }
    ];

    expect(subtitlePreferenceService.resolveDesiredSubtitleTrack(tracks, streamA, false).track).toBeNull();
    expect(subtitlePreferenceService.resolveDesiredSubtitleTrack(tracks, streamB, false).track).toBeNull();
  });

  it('6. Fallback de idioma apenas quando legendas estão ativadas; NUNCA ativa se escolheu "Sem legenda" (Requisito 9)', () => {
    const tracksOnlyEnglish: SubtitleTrack[] = [
      { id: 'sub_en', lang: 'en', languageName: 'English', url: 'https://subs.test/en.vtt', isPtBr: false }
    ];

    // Caso A: Legendas ativadas, preferência pt-BR, mas só existe Inglês -> Fallback para Inglês
    subtitlePreferenceService.setSubtitlesEnabled(true);
    subtitlePreferenceService.setPreferredLanguage('pt-BR');
    const resA = subtitlePreferenceService.resolveDesiredSubtitleTrack(tracksOnlyEnglish, undefined, false);
    expect(resA.track?.id).toBe('sub_en');

    // Caso B: Usuário escolheu "Sem legenda" -> NUNCA faz fallback para ativar nada
    subtitlePreferenceService.setSubtitlesEnabled(false);
    const resB = subtitlePreferenceService.resolveDesiredSubtitleTrack(tracksOnlyEnglish, undefined, false);
    expect(resB.track).toBeNull();
  });

  it('7. Diferenciação rigorosa de Hardsub: não sobrepõe legendas externas duplicadas (Requisito 10)', () => {
    subtitlePreferenceService.setSubtitlesEnabled(true);

    const hardsubStream: StremioStream = {
      name: 'Anime Fansub',
      title: 'Anime.Ep01.1080p.Hardsub.PT-BR.mp4',
      url: 'https://stream.test/anime_hardsub.mp4'
    };

    const analysis = analyzeStreamSubtitleFormat(hardsubStream);
    expect(analysis.isHardsub).toBe(true);
    expect(analysis.format).toBe('hardsub_ptbr');

    const externalTracks: SubtitleTrack[] = [
      { id: 'sub_ext_pt', lang: 'pt-BR', languageName: 'Português (Brasil)', url: 'https://subs.test/ext_pt.vtt', isPtBr: true }
    ];

    // resolveDesiredSubtitleTrack deve bloquear a exibição de legenda externa sobreposta
    const resolution = subtitlePreferenceService.resolveDesiredSubtitleTrack(externalTracks, hardsubStream, false);
    expect(resolution.track).toBeNull();
    expect(resolution.format).toBe('hardsub_ptbr');
    expect(resolution.reason).toContain('Hardsub');
  });

  it('8. Identifica Hardsub estrangeiro para alertar usuário sem confundir com legendas desligáveis (Requisito 10)', () => {
    const hardsubForeignStream: StremioStream = {
      name: 'Stream Foreign',
      title: 'Movie.2024.1080p.English.Hardsub.mp4',
      url: 'https://stream.test/foreign.mp4'
    };

    const analysis = analyzeStreamSubtitleFormat(hardsubForeignStream);
    expect(analysis.isHardsub).toBe(true);
    expect(analysis.format).toBe('hardsub_foreign');
  });

  it('9. Recuperação instantânea de legendas em cache sem atraso para evitar flicker (Requisito 4)', () => {
    const mockItem: ContentItem = {
      id: 'tt0903747',
      title: 'Breaking Bad',
      type: ContentType.SERIES,
      year: 2008
    };

    // Pré-popula cache do subtitleService
    const fakeTracks: SubtitleTrack[] = [
      { id: 'cached_sub_1', lang: 'pt-BR', languageName: 'Português (Brasil)', url: 'https://subs.test/cached.vtt', isPtBr: true }
    ];

    // Injeta no cache privado de subtitleService
    (subtitleService as any).subtitleCache.set('tt0903747_1_2_def', {
      tracks: fakeTracks,
      timestamp: Date.now()
    });

    // Recupera sincronicamente
    const retrieved = subtitleService.getCachedSubtitles(mockItem, 1, 2);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.length).toBe(1);
    expect(retrieved?.[0].id).toBe('cached_sub_1');
  });

  it('10. Assinatura e propagação de eventos quando a preferência muda (Requisito 1 & 8)', () => {
    let capturedEnabled: boolean | null = null;
    const unsubscribe = subtitlePreferenceService.subscribe((pref) => {
      capturedEnabled = pref.enabled;
    });

    subtitlePreferenceService.setSubtitlesEnabled(false);
    expect(capturedEnabled).toBe(false);

    subtitlePreferenceService.setSubtitlesEnabled(true);
    expect(capturedEnabled).toBe(true);

    unsubscribe();
  });
});
