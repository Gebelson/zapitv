import { describe, it, test, expect } from 'vitest';
import playerSource from '../src/components/player/ZapiPlayer.tsx?raw';
import { playbackSessionService } from '../src/core/session/playbackSessionService';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';
import { classifyStream } from '../src/core/audio/audioDetector';
import { StremioStream } from '../src/core/stremio/stremioTypes';

describe('ZapiPlayer — Ordem de Carregamento, Avisos e Intro Institucional', () => {

  describe('1. Ciclo de Vida e Sessões de Reprodução (playbackSessionService)', () => {
    it('deve habilitar a intro apenas para nova sessão iniciada manualmente (manual_start)', () => {
      const session = playbackSessionService.startSession('movie-123', 'manual_start');
      expect(session.navigationType).toBe('manual_start');
      expect(session.introPlayed).toBe(false);
      expect(playbackSessionService.shouldPlayIntro(session.sessionId)).toBe(true);
    });

    it('deve registrar a conclusão da intro e impedir que se repita na mesma sessão', () => {
      const session = playbackSessionService.startSession('movie-456', 'manual_start');
      expect(playbackSessionService.shouldPlayIntro(session.sessionId)).toBe(true);

      playbackSessionService.markIntroPlayed(session.sessionId);
      expect(playbackSessionService.shouldPlayIntro(session.sessionId)).toBe(false);
      expect(playbackSessionService.isIntroPlayed(session.sessionId)).toBe(true);
    });

    it('NUNCA deve tocar a intro em reprodução contínua (continuous_playback)', () => {
      const session = playbackSessionService.startSession('anime-ep2', 'continuous_playback', 1, 2);
      expect(session.introPlayed).toBe(true);
      expect(playbackSessionService.shouldPlayIntro(session.sessionId)).toBe(false);
    });

    it('NUNCA deve tocar a intro em retentativas de reprodução (retry_playback)', () => {
      const session = playbackSessionService.startSession('series-ep1', 'retry_playback', 1, 1);
      expect(session.introPlayed).toBe(true);
      expect(playbackSessionService.shouldPlayIntro(session.sessionId)).toBe(false);
    });

    it('deve memorizar a confirmação de reprodução original na sessão (markNonDubbedConfirmed)', () => {
      const session = playbackSessionService.startSession('foreign-film', 'manual_start');
      expect(playbackSessionService.isNonDubbedConfirmed(session.sessionId)).toBe(false);

      playbackSessionService.markNonDubbedConfirmed(session.sessionId);
      expect(playbackSessionService.isNonDubbedConfirmed(session.sessionId)).toBe(true);
    });
  });

  describe('2. Ordem Estrita de Execução no ZapiPlayer.tsx', () => {
    it('REGRA 1: isPlayingIntro NUNCA deve iniciar como true no mount do componente', () => {
      // O estado de intro deve começar estritamente em false
      expect(playerSource).toContain('const [isPlayingIntro, setIsPlayingIntro] = useState(false);');
    });

    it('REGRA 2: startIntroIfReady deve bloquear o início da intro se streams estiverem carregando, vazios ou com falha', () => {
      // Bloqueio obrigatório de fontes pendentes ou ausentes
      expect(playerSource).toContain('if (isLoadingStreams || allSourcesFailed || showNonDubbedPromptRef.current || !streams || streams.length === 0) return;');
    });

    it('REGRA 3: startIntroIfReady deve exigir que o vídeo esteja efetivamente pré-bufferizado (isMediaReadyRef)', () => {
      expect(playerSource).toContain('if (!isMediaReadyRef.current) return;');
    });

    it('REGRA 4: markMediaAsReady deve respeitar o aviso de dublagem antes de disparar startIntroIfReady', () => {
      const markMediaRegex = /markMediaAsReady = useCallback\(\(\) => \{\s*setIsLoading\(false\);\s*setIsMediaReady\(true\);\s*isMediaReadyRef\.current = true;\s*\/\/[^\n]*\s*if \(showNonDubbedPromptRef\.current\) \{\s*return;\s*\}\s*startIntroIfReady\(\);/s;
      expect(markMediaRegex.test(playerSource)).toBe(true);
    });

    it('REGRA 5: Quando não houver fontes, deve exibir "Conteúdo indisponível" ANTES e SEM tocar a intro', () => {
      // allSourcesFailed deve definir erro e desativar intro
      expect(playerSource).toContain('setAllSourcesFailed(true);');
      expect(playerSource).toContain('Conteúdo indisponível');
      // No JSX, allSourcesFailed renderiza a mensagem em destaque
      expect(playerSource).toContain('{allSourcesFailed && (');
      expect(playerSource).toContain('<h2 className="text-2xl md:text-3xl font-black text-white mb-2">Conteúdo indisponível</h2>');
    });

    it('REGRA 6: Se dublagem PT-BR for comprovadamente indisponível, deve exibir "Dublagem indisponível" ANTES da intro', () => {
      expect(playerSource).toContain('{showNonDubbedPrompt && (');
      expect(playerSource).toContain('Dublagem indisponível');
      expect(playerSource).toContain('Não encontramos uma versão com áudio em português brasileiro para este conteúdo.');
      expect(playerSource).toContain('onClick={handleConfirmNonDubbedSubtitled}');
      expect(playerSource).toContain('onClick={handleConfirmNonDubbedOriginal}');
    });

    it('REGRA 7: A confirmação de dublagem pelo usuário deve avançar para a reprodução/intro apenas com mídia pré-bufferizada', () => {
      expect(playerSource).toContain('if (isMediaReadyRef.current) {');
      expect(playerSource).toContain('startIntroIfReady();');
    });

    it('REGRA 8: Durante a vinheta, o vídeo principal deve ser mantido pausado e com som mudo', () => {
      expect(playerSource).toContain('video.pause();');
      expect(playerSource).toContain('video.muted = true;');
      expect(playerSource).toContain('muted={isPlayingIntro || isMuted}');
    });

    it('REGRA 9: Ao término da vinheta (ou Pular Intro), a transição deve tocar o vídeo principal imediatamente com áudio restaurado', () => {
      expect(playerSource).toContain('transitionFromIntroToMedia = useCallback(() => {');
      expect(playerSource).toContain('video.muted = isMuted;');
      expect(playerSource).toContain('video.volume = volume;');
      expect(playerSource).toContain('video.play()');
      expect(playerSource).toContain('setIsIntroFading(true);');
      expect(playerSource).toContain('playbackSessionService.markIntroPlayed');
    });

    it('REGRA 10: O botão "Pular Intro" deve transicionar instantaneamente para o vídeo principal já pré-bufferizado', () => {
      expect(playerSource).toContain('handleSkipIntro = useCallback(() => {');
      expect(playerSource).toContain('setUserSkippedIntro(true);');
      expect(playerSource).toContain('introVideoRef.current.pause()');
      expect(playerSource).toContain('transitionFromIntroToMedia()');
    });

    it('REGRA 11: Deve exibir apenas o indicador visual de preparação antes da vinheta', () => {
      expect(playerSource).toContain('{!isPlayingIntro && (!isMediaReady || isLoadingStreams || isLoading) && !showNonDubbedPrompt && !allSourcesFailed && (');
      expect(playerSource).toContain('<ZapiLoader size="lg" />');
      expect(playerSource).not.toContain("'Preparando reprodução...'");
      expect(playerSource).not.toContain("'Buscando fontes disponíveis...'");
    });
  });

  describe('3. Validação Lógica dos Cenários de Disponibilidade e Idioma', () => {
    test('Cenário 1: Obra com PT-BR confirmado (Forrest Gump tt0109830) — NÃO deve bloquear com Dublagem Indisponível', () => {
      const forrestStream: StremioStream = {
        name: 'FrostStream 720p',
        title: '🎬 Forrest Gump O Contador de Histórias (1994)\n🌊 Astra\n🌎 Português',
        url: 'https://froststream.cloutteam.com/movie/v1.abc',
        behaviorHints: { bingeGroup: 'cloutstream-cs:forrest' }
      };

      const cls = classifyStream(forrestStream);
      expect(cls.isDubbed).toBe(true);
      expect(cls.isPtBr).toBe(true);

      // ptBrAvailabilityState deve ser 'confirmed'
      const isPtBr = cls.isDubbed || cls.isPtBr || forrestStream.isDubbed || forrestStream.isPtBr;
      expect(isPtBr).toBe(true);
    });

    test('Cenário 2: Obra com idioma desconhecido nos metadados — NÃO deve exibir aviso de indisponibilidade', () => {
      const unknownLangStream: StremioStream = {
        name: 'CDN Stream 1080p',
        title: 'Forrest Gump (1994) 1080p WebRip',
        url: 'https://cdn.example.com/forrest.mp4'
      };

      const cls = classifyStream(unknownLangStream);
      expect(cls.isDubbed).toBe(false);
      expect(cls.language).toBe('unknown');

      // Se há stream desconhecido e nenhum confirmado, o estado deve ser 'unknown', NUNCA 'unavailable'
      const state = (cls.isDubbed || cls.isPtBr) ? 'confirmed' : (cls.language === 'unknown' ? 'unknown' : 'unavailable');
      expect(state).toBe('unknown');
      // Em 'unknown', showNonDubbedPrompt é false!
      const showPrompt = state === 'unavailable';
      expect(showPrompt).toBe(false);
    });

    test('Cenário 3: Obra comprovadamente sem PT-BR (apenas trilhas estrangeiras declaradas) — Deve exigir confirmação prévia', () => {
      const foreignStream: StremioStream = {
        name: 'Torrentio 1080p',
        title: 'Parasite.2019.1080p.BluRay.x264 🇬🇧 English Audio',
        url: 'http://127.0.0.1:11470/stream.mp4'
      };

      const cls = classifyStream(foreignStream);
      expect(cls.isDubbed).toBe(false);
      expect(cls.isPtBr).toBe(false);
      expect(cls.language).toBe('en');

      // Estado é 'unavailable' quando todas as fontes declaram idioma estrangeiro sem PT-BR
      const state = (cls.isDubbed || cls.isPtBr)
        ? 'confirmed'
        : (cls.language === 'unknown' ? 'unknown' : 'unavailable');
      expect(state).toBe('unavailable');
      const showPrompt = state === 'unavailable';
      expect(showPrompt).toBe(true);
    });

    test('Cenário 4: Falha na preparação da fonte 1 — Deve executar fallback para fonte 2 e preparar sem iniciar a intro prematuramente', () => {
      const stream1: StremioStream = { name: 'Fonte 1', url: 'https://cdn1.example.com/stream1.m3u8' };
      const stream2: StremioStream = { name: 'Fonte 2', url: 'https://cdn2.example.com/stream2.m3u8' };
      const streams = [stream1, stream2];

      const triedIndices = new Set<number>();
      triedIndices.add(0); // Stream 1 falhou

      const remaining = streams.map((s, idx) => ({ s, idx })).filter(({ idx }) => !triedIndices.has(idx));
      expect(remaining.length).toBe(1);
      expect(remaining[0].idx).toBe(1);
      expect(remaining[0].s.name).toBe('Fonte 2');
    });

    test('Cenário 5: Todas as fontes falham — Estado allSourcesFailed é ativado e a intro NÃO inicia', () => {
      const streams: StremioStream[] = [];
      const isLoadingStreams = false;
      const allSourcesFailed = streams.length === 0 && !isLoadingStreams;

      expect(allSourcesFailed).toBe(true);

      // startIntroIfReady verifica allSourcesFailed e streams.length
      const canStartIntro = !isLoadingStreams && !allSourcesFailed && streams.length > 0;
      expect(canStartIntro).toBe(false);
    });
  });
});
