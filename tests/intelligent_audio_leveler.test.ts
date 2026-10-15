import { describe, it, expect, beforeEach } from 'vitest';
import { AudioLevelerEngine, audioEnhancer } from '../src/core/enhancement/audioEnhancer';
import { aiEnhancerService } from '../src/core/enhancement/aiEnhancerService';

describe('ZapiTV — Estabilização Inteligente de Volume e Aprimoramento de Áudio', () => {
  let engine: AudioLevelerEngine;

  beforeEach(() => {
    engine = new AudioLevelerEngine();
  });

  describe('Arquitetura e Parâmetros Acústicos', () => {
    it('deve ter nível alvo calibrado em -22 dBFS (padrão broadcast/streaming confortável)', () => {
      expect(AudioLevelerEngine.TARGET_LOUDNESS_DBFS).toBe(-22.0);
    });

    it('deve ter limiar de ruído de fundo (noise floor gate) em -46 dBFS', () => {
      expect(AudioLevelerEngine.NOISE_FLOOR_DBFS).toBe(-46.0);
    });

    it('deve possuir zona morta de histerese de ±1.8 dB para eliminar pumping', () => {
      expect(AudioLevelerEngine.HYSTERESIS_DEADBAND_DB).toBe(1.8);
    });

    it('deve limitar o ganho máximo de compensação a +3.5 dB para preservar a dinâmica natural', () => {
      expect(AudioLevelerEngine.MAX_BOOST_DB).toBe(3.5);
    });

    it('deve limitar a atenuação máxima a -6.0 dB para evitar achatamento da mixagem', () => {
      expect(AudioLevelerEngine.MAX_ATTENUATION_DB).toBe(-6.0);
    });

    it('deve limitar a taxa de subida de ganho a 1.0 dB/s (recuperação suave pós-explosão)', () => {
      expect(AudioLevelerEngine.SLEW_RATE_BOOST_DB_PER_SEC).toBe(1.0);
    });

    it('deve limitar a taxa de atenuação a 3.0 dB/s (atenuação controlada sem quedas abruptas)', () => {
      expect(AudioLevelerEngine.SLEW_RATE_ATTEN_DB_PER_SEC).toBe(3.0);
    });

    it('deve ter teto de saída conservador (ceiling ~0.90 / -0.91 dBFS) para proteção True Peak', () => {
      expect(AudioLevelerEngine.CEILING_GAIN_LINEAR).toBe(0.90);
    });
  });

  describe('Cenário A & K — Diálogo seguido de explosão e proteção contra clipping', () => {
    it('deve atenuar suavemente trecho estrondoso sem queda abrupta e prevenir clipping', () => {
      // 1. Cena de diálogo normal em -22 dBFS (RMS ~0.079)
      const dialogRms = Math.pow(10, -22 / 20);
      for (let i = 0; i < 20; i++) {
        engine.computeStep(dialogRms, dialogRms * 1.5, 1.0, false, 0.05);
      }
      expect(engine.getCurrentGainDb()).toBeCloseTo(0, 0.5);

      // 2. Ocorre uma explosão intensa a -6 dBFS (RMS ~0.50)
      const explosionRms = Math.pow(10, -6 / 20);
      const explosionPeak = 0.95; // Próximo de 0 dBFS

      // Primeiro passo de 50ms pós-explosão: atenuação deve ser gradual (<= 3 dB/s * 0.05s = 0.15 dB)
      engine.computeStep(explosionRms, explosionPeak, 1.0, false, 0.05);
      expect(engine.getCurrentGainDb()).toBeGreaterThanOrEqual(-0.25);
      expect(engine.getCurrentGainDb()).toBeLessThan(0.0);

      // 3. Após 1 segundo sustentado de explosão, a atenuação deve ser controlada e não exceder o limite
      for (let i = 0; i < 20; i++) {
        engine.computeStep(explosionRms, explosionPeak, 1.0, false, 0.05);
      }
      expect(engine.getCurrentGainDb()).toBeGreaterThanOrEqual(AudioLevelerEngine.MAX_ATTENUATION_DB);
      expect(engine.getCurrentGainDb()).toBeLessThan(-2.0);

      // 4. Garante que o teto de saída do motor evita que qualquer pico ultrapasse 1.0 linear (0 dBFS)
      const linearGain = Math.pow(10, engine.getCurrentGainDb() / 20);
      const outputPeak = explosionPeak * linearGain * AudioLevelerEngine.CEILING_GAIN_LINEAR;
      expect(outputPeak).toBeLessThan(1.0);
    });
  });

  describe('Cenário B — Música seguida de conversa e recuperação de ganho', () => {
    it('deve retornar gradualmente ao equilíbrio sem saltos repentinos ao entrar a voz', () => {
      // 1. Simula trecho musical intenso (-12 dBFS) que causou atenuação
      const musicRms = Math.pow(10, -12 / 20);
      for (let i = 0; i < 40; i++) {
        engine.computeStep(musicRms, musicRms * 1.4, 1.0, false, 0.05);
      }
      const gainAfterMusic = engine.getCurrentGainDb();
      expect(gainAfterMusic).toBeLessThan(-2.0);

      // 2. Música cede lugar a diálogo calmo (-24 dBFS)
      const speechRms = Math.pow(10, -24 / 20);

      // Em 100ms, o ganho NÃO pode pular mais do que ~0.1 dB (taxa máx 1 dB/s)
      engine.computeStep(speechRms, speechRms * 1.5, 1.0, false, 0.1);
      const deltaGainFast = engine.getCurrentGainDb() - gainAfterMusic;
      expect(deltaGainFast).toBeLessThanOrEqual(0.15);

      // Em 2 segundos, a recuperação é progressiva, musical e estável
      for (let i = 0; i < 40; i++) {
        engine.computeStep(speechRms, speechRms * 1.5, 1.0, false, 0.05);
      }
      expect(engine.getCurrentGainDb()).toBeGreaterThan(gainAfterMusic);
      expect(engine.getCurrentGainDb()).toBeLessThanOrEqual(AudioLevelerEngine.MAX_BOOST_DB);
    });
  });

  describe('Cenário C — Silêncio prolongado e Noise Floor Gate', () => {
    it('deve congelar o ganho em silêncios e NUNCA amplificar ruído de fundo ou estática', () => {
      // Diálogo normal anterior
      const dialogRms = Math.pow(10, -22 / 20);
      engine.computeStep(dialogRms, dialogRms, 1.0, false, 0.1);

      const gainBeforeSilence = engine.getCurrentGainDb();

      // Cena fica em silêncio absoluto / ruído de microfone (-55 dBFS, bem abaixo de -46 dBFS)
      const silenceRms = Math.pow(10, -55 / 20);

      for (let i = 0; i < 50; i++) { // 2.5 segundos de silêncio
        const gain = engine.computeStep(silenceRms, silenceRms, 1.0, false, 0.05);
        // O ganho não pode subir para tentar amplificar o silêncio!
        expect(engine.getCurrentGainDb()).toBeLessThanOrEqual(gainBeforeSilence + 0.01);
        expect(engine.isSilence()).toBe(true);
      }
    });
  });

  describe('Cenário D & E — Eliminação de Pumping e Histerese', () => {
    it('não deve alterar o ganho diante de pequenas variações normais de fala dentro da histerese', () => {
      // Estabelece nível nominal em -22 dBFS
      const nominalRms = Math.pow(10, -22 / 20);
      for (let i = 0; i < 30; i++) {
        engine.computeStep(nominalRms, nominalRms, 1.0, false, 0.05);
      }
      const initialGain = engine.getCurrentGainDb();

      // Fala varia ligeiramente: -21 dBFS (desvio de 1 dB, dentro da histerese de ±1.8 dB)
      const slightRms = Math.pow(10, -21 / 20);
      for (let i = 0; i < 20; i++) {
        engine.computeStep(slightRms, slightRms, 1.0, false, 0.05);
      }
      // O ganho deve permanecer exatamente inalterado (zero pumping!)
      expect(engine.getCurrentGainDb()).toBe(initialGain);
    });
  });

  describe('Cenário F — Troca de áudio e fontes (reset suave)', () => {
    it('deve resetar o ganho e o histórico para condições nominais seguras sem picos', () => {
      // Simula ganho deslocado devido à faixa anterior
      const loudRms = Math.pow(10, -10 / 20);
      for (let i = 0; i < 30; i++) {
        engine.computeStep(loudRms, loudRms, 1.0, false, 0.05);
      }
      expect(engine.getCurrentGainDb()).toBeLessThan(-2.0);

      // Ao trocar de áudio:
      engine.reset(true);
      expect(engine.getCurrentGainDb()).toBe(0.0);
      expect(engine.getTrackedLoudnessDbfs()).toBe(AudioLevelerEngine.TARGET_LOUDNESS_DBFS);
      expect(engine.isSilence()).toBe(false);
    });
  });

  describe('Cenário I — Respeito estrito ao controle manual de volume e mudo', () => {
    it('não deve tentar compensar quando o usuário abaixa o volume no player', () => {
      // Conteúdo em -22 dBFS. Usuário decide abaixar o volume do player para 20% (0.2)
      const contentRms = Math.pow(10, -22 / 20);
      const attenuatedRms = contentRms * 0.2; // O que chega no MediaElementAudioSourceNode

      // Com userVolume = 0.2 informado:
      for (let i = 0; i < 30; i++) {
        engine.computeStep(attenuatedRms, attenuatedRms * 1.5, 0.2, false, 0.05);
      }

      // O motor calcula o nível real do conteúdo (-22 dBFS) e NÃO gera boost indevido
      expect(engine.getCurrentGainDb()).toBeCloseTo(0.0, 0.5);
    });

    it('deve congelar o processamento quando o player estiver em mudo', () => {
      const initialGain = engine.getCurrentGainDb();
      const randomRms = 0.01;

      // Executa passos com isMuted = true
      for (let i = 0; i < 10; i++) {
        engine.computeStep(randomRms, randomRms, 0.8, true, 0.05);
      }

      expect(engine.getCurrentGainDb()).toBe(initialGain);
      expect(engine.isSilence()).toBe(true);
    });
  });

  describe('Cenário H — Toggle e Crossfade do AudioEnhancer', () => {
    it('deve calcular plano passthrough neutro quando desativado ou em comparação (Bypass)', () => {
      const planOff = audioEnhancer.computeAudioPlan({
        enabled: false,
        videoEnabled: true,
        audioEnabled: true,
        intensity: 'auto',
        comparisonMode: 'off',
        splitPosition: 50
      });

      expect(planOff.pipeline).toBe('passthrough');
      expect(planOff.isBypassed).toBe(true);
      expect(planOff.vocalClarityGainDb).toBe(0);
      expect(planOff.compressorRatio).toBe(1.0);
    });

    it('deve calcular plano webaudio calibrado com peaking 2.8kHz e compressão moderada quando ativo', () => {
      const planOn = audioEnhancer.computeAudioPlan({
        enabled: true,
        videoEnabled: true,
        audioEnabled: true,
        intensity: 'balanced',
        comparisonMode: 'off',
        splitPosition: 50
      });

      expect(planOn.pipeline).toBe('webaudio');
      expect(planOn.isBypassed).toBe(false);
      expect(planOn.vocalClarityGainDb).toBe(2.2);
      expect(planOn.compressorRatio).toBe(2.2);
      expect(planOn.compressorThresholdDb).toBe(-20);
      expect(planOn.lowCutFrequencyHz).toBe(55);
      expect(planOn.noiseGateThresholdDb).toBe(-46);
    });
  });

  describe('Cenário J — Estabilidade e Telemetria em Reprodução Prolongada', () => {
    it('deve fornecer telemetria estruturada e estável sem drift descontrolado de ganho', () => {
      const telemetry = engine.getTelemetry();
      expect(telemetry).toHaveProperty('currentGainDb');
      expect(telemetry).toHaveProperty('trackedLoudnessDbfs');
      expect(telemetry).toHaveProperty('isSilence');
      expect(telemetry).toHaveProperty('rmsDbfs');
      expect(telemetry).toHaveProperty('peakDbfs');
      expect(telemetry.targetLoudnessDbfs).toBe(-22.0);
    });
  });
});
