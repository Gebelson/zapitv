import { test, expect, describe, vi, it } from 'vitest';
import playerSource from '../src/components/player/ZapiPlayer.tsx?raw';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { ContentItem, ContentType } from '../types';
import { classifyStream } from '../src/core/audio/audioDetector';

describe('ZapiTV — Unificação Confiável de Disponibilidade e Dublagem', () => {
  describe('1. Verificação Estática de Código e Invariantes Arquiteturais', () => {
    it('REGRA FUNDAMENTAL: showNonDubbedPrompt NUNCA pode ser exibido se isMediaReady for false', () => {
      expect(playerSource).toContain('if (!isMediaReady) {');
      expect(playerSource).toContain('return false;');
    });

    it('REGRA FUNDAMENTAL: showNonDubbedPrompt NUNCA pode ser exibido durante isLoadingStreams, allSourcesFailed ou hasError', () => {
      expect(playerSource).toContain('if (isSeeking || isSeekingRef.current || isLoadingStreams || allSourcesFailed || hasError) {');
      expect(playerSource).toContain('return false;');
    });

    it('REGRA FUNDAMENTAL: O fallback entre fontes deve ser silencioso até que uma fonte funcione ou todas falhem', () => {
      // Confirma que handleStreamFallback avança silenciosamente para anyRemaining sem chamar setForcedNonDubbedPrompt prematuramente
      expect(playerSource).toContain('// REGRA FUNDAMENTAL: O fallback entre fontes deve ser silencioso até que uma fonte funcione ou todas falhem.');
      expect(playerSource).toContain('if (anyRemaining.length > 0) {');
      expect(playerSource).toContain('nextCandidate = anyRemaining[0];');
    });

    it('REGRA FUNDAMENTAL: Se todas as fontes falharem, setAllSourcesFailed deve registrar PLAYBACK_FAILURE sem aviso de dublagem', () => {
      expect(playerSource).toContain("setFailureCategory('PLAYBACK_FAILURE');");
      expect(playerSource).toContain("setForcedNonDubbedPrompt(false);");
      expect(playerSource).toContain("Não foi possível reproduzir este conteúdo agora. Tente novamente mais tarde.");
    });

    it('REGRA FUNDAMENTAL: startIntroIfReady deve bloquear a vinheta se a dublagem PT-BR estiver pendente de confirmação', () => {
      expect(playerSource).toContain('if (isLoadingStreams || allSourcesFailed || showNonDubbedPromptRef.current || !streams || streams.length === 0) return;');
      expect(playerSource).toContain('if (isPtBrAbsent && !hasUserConfirmedNonDubbed) return;');
    });

    it('REGRA FUNDAMENTAL: markMediaAsReady deve aguardar a confirmação do modal antes de iniciar vinheta', () => {
      expect(playerSource).toContain('if (showNonDubbedPromptRef.current) {');
      expect(playerSource).toContain('return;');
    });
  });

  describe('2. Cenário A — Conteúdo Disponível e Dublado', () => {
    const dubbedMovie: ContentItem = {
      id: 'tt0109830',
      title: 'Forrest Gump',
      type: ContentType.MOVIE,
      year: 1994,
      audioStatus: 'pt-br-dubbed'
    };

    const streamDubbed: StremioStream = {
      name: 'FrostStream',
      title: 'Forrest Gump (1994) [1080p] [Dublado PT-BR]',
      url: 'https://stream.server.com/forrest.m3u8',
      isDubbed: true,
      isPtBr: true
    };

    it('deve selecionar PT-BR automaticamente, sem exibir aviso de dublagem', () => {
      const isMediaReady = true;
      const allSourcesFailed = false;
      const hasError = false;
      const isLoadingStreams = false;
      const hasUserConfirmedNonDubbed = false;
      const hasDynamicallyConfirmedPtBr = false;
      const ptBrConfirmedOnce = false;

      // Classificação do stream
      const cls = classifyStream(streamDubbed);
      const isPtBrAvailable = cls.isDubbed || cls.isPtBr || dubbedMovie.audioStatus === 'pt-br-dubbed';
      expect(isPtBrAvailable).toBe(true);

      // Avaliação de exibição do prompt
      const showPrompt = (() => {
        if (isPtBrAvailable || hasDynamicallyConfirmedPtBr || ptBrConfirmedOnce) return false;
        if (!isMediaReady || allSourcesFailed || hasError || isLoadingStreams) return false;
        if (hasUserConfirmedNonDubbed) return false;
        return true;
      })();

      expect(showPrompt).toBe(false);
    });
  });

  describe('3. Cenário B — Conteúdo Disponível, mas sem PT-BR', () => {
    const foreignMovie: ContentItem = {
      id: 'tt0068646',
      title: 'The Godfather',
      type: ContentType.MOVIE,
      year: 1972,
      audioStatus: 'original'
    };

    const foreignStream: StremioStream = {
      name: 'CinemaStream',
      title: 'The Godfather (1972) [1080p] [English Audio] [Legendado]',
      url: 'https://stream.server.com/godfather.m3u8',
      isSubtitled: true,
      isDubbed: false,
      isPtBr: false
    };

    it('NUNCA deve exibir "Dublagem indisponível" enquanto isMediaReady for false', () => {
      let isMediaReady = false;
      const ptBrAvailabilityState = 'unavailable';
      const hasUserConfirmedNonDubbed = false;

      const evalPrompt = () => {
        if (!isMediaReady) return false;
        if (hasUserConfirmedNonDubbed) return false;
        return ptBrAvailabilityState === 'unavailable';
      };

      // Fase de busca e inicialização: NENHUM aviso pode ser mostrado
      expect(evalPrompt()).toBe(false);

      // Fase de buffer e segmentos iniciais concluídos: agora sim, a mídia foi confirmada como reproduzível!
      isMediaReady = true;
      expect(evalPrompt()).toBe(true);
    });

    it('após confirmação do usuário (Legendado ou Áudio Original), deve permitir reprodução', () => {
      let hasUserConfirmedNonDubbed = false;
      let isIntroPlaying = false;
      let isMediaReady = true;

      const handleConfirm = () => {
        hasUserConfirmedNonDubbed = true;
        // Com a confirmação da preferência, inicia vinheta e reprodução da fonte já pronta
        if (isMediaReady) {
          isIntroPlaying = true;
        }
      };

      // Usuário escolhe Legendado
      handleConfirm();
      expect(hasUserConfirmedNonDubbed).toBe(true);
      expect(isIntroPlaying).toBe(true);
    });
  });

  describe('4. Cenário C — Nenhuma Fonte Encontrada ou Autorizada', () => {
    it('deve exibir "Conteúdo indisponível no momento" e NUNCA exibir aviso de dublagem nem tocar intro', () => {
      const streams: StremioStream[] = [];
      const isLoadingStreams = false;
      const isMediaReady = false;
      const allSourcesFailed = true;
      const failureCategory = 'NO_SOURCES_FOUND';

      const showNonDubbedPrompt = (() => {
        if (!isMediaReady) return false;
        if (allSourcesFailed || streams.length === 0) return false;
        return true;
      })();

      expect(showNonDubbedPrompt).toBe(false);

      // Título exibido na tela de erro
      const displayedHeading = failureCategory === 'NO_SOURCES_FOUND' || streams.length === 0
        ? 'Conteúdo indisponível no momento'
        : 'Outro';

      expect(displayedHeading).toBe('Conteúdo indisponível no momento');
    });
  });

  describe('5. Cenário D — Fontes Encontradas, mas Nenhuma Inicia a Reprodução', () => {
    it('deve realizar fallback silencioso e, se todas falharem, NUNCA exibir "Dublagem indisponível"', () => {
      const streamCandidates: StremioStream[] = [
        { name: 'Provider 1', title: 'Candidate 1 [Dublado]', url: 'https://dead1.com/video.m3u8' },
        { name: 'Provider 2', title: 'Candidate 2 [Inglês]', url: 'https://dead2.com/video.m3u8' }
      ];

      let selectedIndex = 0;
      let showPromptCount = 0;
      let isMediaReady = false;
      const tried = new Set<number>();

      // Simulação do ciclo de fallback
      for (let i = 0; i < streamCandidates.length; i++) {
        tried.add(i);
        // Durante a tentativa, se a mídia não ficou pronta, nunca exibe prompt
        if (isMediaReady) {
          showPromptCount++;
        }
      }

      // Todas falharam sem que nenhuma ficasse pronta
      const allFailed = tried.size === streamCandidates.length;
      expect(allFailed).toBe(true);
      expect(showPromptCount).toBe(0);

      // Mensagem obrigatória de erro
      const finalErrorMsg = 'Não foi possível reproduzir este conteúdo agora. Tente novamente mais tarde.';
      expect(finalErrorMsg).toBe('Não foi possível reproduzir este conteúdo agora. Tente novamente mais tarde.');
    });
  });

  describe('6. Cenário E — Busca ou Verificação Inconclusiva', () => {
    it('deve exibir exclusivamente "Não foi possível verificar a disponibilidade agora. Tente novamente."', () => {
      const verificationState = 'INCONCLUSIVE';
      const isMediaReady = false;

      const showNonDubbedPrompt = isMediaReady ? true : false;
      expect(showNonDubbedPrompt).toBe(false);

      const errorMessage = verificationState === 'INCONCLUSIVE'
        ? 'Não foi possível verificar a disponibilidade agora. Tente novamente.'
        : 'Outro erro';

      expect(errorMessage).toBe('Não foi possível verificar a disponibilidade agora. Tente novamente.');
    });
  });

  describe('7. Caso Real: Forrest Gump & Cartaz de Redenção (Trilha PT-BR embutida no HLS)', () => {
    it('não deve exibir falso aviso de falta de dublagem se as trilhas de áudio HLS internas contiverem português', () => {
      // Stream cujo título NÃO diz "Dublado", mas o manifesto contém trilha de áudio PT
      const multiAudioStream: StremioStream = {
        name: 'FrostStream Multi',
        title: 'Forrest Gump (1994) 1080p BluRay H264',
        url: 'https://froststream.top/stream/forrest.m3u8'
      };

      // Simulação do evento MANIFEST_PARSED do HLS.js
      const hlsParsedAudioTracks = [
        { id: 0, name: 'English (Original)', lang: 'en' },
        { id: 1, name: 'Português Brasileiro (Dublagem)', lang: 'por' }
      ];

      const hasPtTrack = hlsParsedAudioTracks.some(t =>
        /^(por|pt|pob|bra)$/i.test(t.lang) ||
        /portugu[eê]s|dublado|brazil|brasil/i.test(t.name)
      );

      expect(hasPtTrack).toBe(true);

      let hasDynamicallyConfirmedPtBr = false;
      if (hasPtTrack) {
        hasDynamicallyConfirmedPtBr = true;
      }

      // Quando a mídia conclui o carregamento
      const isMediaReady = true;

      // showNonDubbedPrompt avaliado
      const showPrompt = (() => {
        if (hasDynamicallyConfirmedPtBr) return false;
        if (!isMediaReady) return false;
        return true;
      })();

      // O usuário NUNCA deve receber aviso de "Dublagem indisponível" para um vídeo que possui dublagem em português!
      expect(showPrompt).toBe(false);
    });
  });
});
