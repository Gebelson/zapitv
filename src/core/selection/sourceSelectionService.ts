import { StremioStream } from '../stremio/stremioTypes';
import { audioPreferenceService, AudioTier, AudioAnalysisResult } from '../audio/audioPreferenceService';
import { audioCodecService, StreamCodecInfo } from '../audio/audioCodecService';
import { subtitlePreferenceService, SubtitleFormat, SubtitleAnalysisResult } from '../subtitles/subtitlePreferenceService';
import { CanonicalMediaIdentity } from '../identity/canonicalIdentity';
import { sourceConfidenceEngine, SourceConfidence } from '../identity/sourceConfidenceEngine';
import { playbackOptimizerService } from '../playback/PlaybackOptimizerService';

export interface SourceScoringResult {
  score: number;
  priority: 1 | 2 | 3 | 4 | 5 | 6;
  confidence: SourceConfidence;
  audioTier: AudioTier;
  subtitleFormat: SubtitleFormat;
  audioAnalysis: AudioAnalysisResult;
  subtitleAnalysis: SubtitleAnalysisResult;
  codecInfo?: StreamCodecInfo;
  explanation: string;
}

export interface SourceSelectionOptions {
  hasExternalPtSub: boolean;
  preferDubbed?: boolean;
  preferredQuality?: string;
  cacheKey?: string;
  identity?: CanonicalMediaIdentity;
}

const QUALITY_SCORES: Record<string, number> = {
  '4K': 50,
  '2160p': 50,
  '1080p': 40,
  '720p': 30,
  '480p': 10,
  'HD': 25,
  'SD': 5
};

// Cache interno em memória
const selectionCache = new Map<string, { streams: StremioStream[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export class SourceSelectionService {
  /**
   * Avalia individualmente um stream e calcula sua pontuação de acordo com
   * a hierarquia obrigatória do ZapiTV, onde Áudio Dublado PT-BR tem prioridade absoluta.
   */
  public evaluateStream(
    stream: StremioStream,
    options: { hasExternalPtSub: boolean; identity?: CanonicalMediaIdentity }
  ): SourceScoringResult {
    // 0. AVALIAÇÃO DE CONFIANÇA E IDENTIDADE DA OBRA
    let confidence: SourceConfidence = 'PROVISIONAL';
    let confidenceBonus = 0;
    let confidenceExplanation = '';

    if (options.identity) {
      const confEval = sourceConfidenceEngine.evaluate(stream, options.identity);
      confidence = confEval.confidence;

      if (confEval.confidence === 'QUARANTINED') {
        return {
          score: -1000000,
          priority: 6,
          confidence: 'QUARANTINED',
          audioTier: 'foreign',
          subtitleFormat: 'unknown',
          audioAnalysis: { tier: 'foreign', isDubbed: false, isPtBr: false, isDualAudio: false, language: 'unknown', confidence: 0, reason: confEval.reasons.join(', ') },
          subtitleAnalysis: { format: 'unknown', isHardsub: false, isClean: false, isSoftsub: false, hasPtSubtitle: false, confidence: 0, details: confEval.reasons.join(', ') },
          explanation: `🚨 QUARENTENA: ${confEval.reasons.join(' • ')}`
        };
      }

      if (confEval.confidence === 'REJECTED') {
        return {
          score: -500000,
          priority: 6,
          confidence: 'REJECTED',
          audioTier: 'foreign',
          subtitleFormat: 'unknown',
          audioAnalysis: { tier: 'foreign', isDubbed: false, isPtBr: false, isDualAudio: false, language: 'unknown', confidence: 0, reason: confEval.reasons.join(', ') },
          subtitleAnalysis: { format: 'unknown', isHardsub: false, isClean: false, isSoftsub: false, hasPtSubtitle: false, confidence: 0, details: confEval.reasons.join(', ') },
          explanation: `❌ REJEITADO: ${confEval.reasons.join(' • ')}`
        };
      }

      // Regra conservadora para obras infantis: rejeita fontes suspeitas ou não confirmadas
      if (options.identity.isChildFriendly && confEval.confidence !== 'VERIFIED' && confEval.confidence !== 'PROVISIONAL') {
        return {
          score: -300000,
          priority: 6,
          confidence: confEval.confidence,
          audioTier: 'foreign',
          subtitleFormat: 'unknown',
          audioAnalysis: { tier: 'foreign', isDubbed: false, isPtBr: false, isDualAudio: false, language: 'unknown', confidence: 0, reason: 'Conteúdo infantil restrito a fontes verificadas' },
          subtitleAnalysis: { format: 'unknown', isHardsub: false, isClean: false, isSoftsub: false, hasPtSubtitle: false, confidence: 0, details: 'Conteúdo infantil restrito a fontes verificadas' },
          explanation: `🛡️ BLOQUEIO INFANTIL: Fonte não verificada para "${options.identity.title}"`
        };
      }

      if (confEval.confidence === 'VERIFIED') {
        confidenceBonus = 20000;
        confidenceExplanation = ' (Fonte Canônica Verificada)';
      } else if (confEval.confidence === 'SUSPICIOUS') {
        confidenceBonus = -40000;
        confidenceExplanation = ' (Metadados Suspeitos)';
      }
    }

    const audio = audioPreferenceService.analyzeAudio(stream);
    const sub = subtitlePreferenceService.analyzeSubtitles(stream, options.hasExternalPtSub);
    const codecInfo = audioCodecService.inspectStreamCodecs(stream);
    const codecEval = audioCodecService.getAudioCodecScore(stream);
    const codecBonus = codecEval.bonus;
    const codecExplanation = ` • ${codecEval.explanation}`;

    // 0.1 Desempenho e velocidade histórica do provedor da fonte
    const providerId = stream.providerId;
    let providerBonus = 0;
    let providerExplanation = '';
    if (providerId) {
      providerBonus = playbackOptimizerService.getProviderScore(providerId);
      if (providerBonus > 0) providerExplanation = ' • Provedor Rápido';
      else if (providerBonus < 0) providerExplanation = ' • Provedor Instável';
    }

    // 0.2 Adaptação inteligente à velocidade da conexão (3G / 2G / Slow Wi-Fi vs Alta Velocidade)
    const netProfile = playbackOptimizerService.getNetworkProfile();
    let networkBonus = 0;
    let networkExplanation = '';

    const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();

    // Extrair bônus de qualidade (0 a 50 pontos)
    let qualityBonus = 20;
    for (const [qKey, qScore] of Object.entries(QUALITY_SCORES)) {
      if (
        combined.includes(qKey.toLowerCase()) || 
        (stream.quality && stream.quality.toLowerCase().includes(qKey.toLowerCase()))
      ) {
        qualityBonus = qScore;
        break;
      }
    }

    if (netProfile.isSlowConnection) {
      // Conexão lenta: penaliza 4K/2160p (bitrate elevado que inevitavelmente causará buffering contínuo)
      if (qualityBonus >= 50) {
        networkBonus -= 25000;
        networkExplanation = ' • 4K evitado em rede lenta';
      }
      // Favorece fontes HLS (com ABR nativo) e resoluções leves (720p/480p)
      if (stream.sourceType === 'hls' || (stream.url && stream.url.includes('.m3u8'))) {
        networkBonus += 8000;
        networkExplanation = ' • HLS ABR Priorizado';
      } else if (qualityBonus <= 30) {
        networkBonus += 4000;
      }
    }

    // Penalidade para transmissões que requerem motor externo (ex: torrents sem motor local ativo)
    // Garante que qualquer transmissão web direta reproduzível seja priorizada quando o motor local estiver offline
    const isNotWebReady = stream.behaviorHints?.notWebReady === true;
    const webReadyPenalty = isNotWebReady ? -20000 : 0;
    const webReadyExplanation = isNotWebReady ? ' (Requer motor externo)' : '';

    const performanceModifiers = providerBonus + networkBonus;

    // =========================================================================
    // PRIORIDADE 1: ÁUDIO DUBLADO PT-BR (Base: 100.000 pontos)
    // A presença de hardsub ou formato desconhecido NUNCA fará o stream perder
    // para um stream com áudio original legendado!
    // =========================================================================
    if (audio.tier === 'dubbed_ptbr') {
      let subTierBonus = 2000; // Padrão: desconhecido
      let subExplanation = 'estado de legendas desconhecido';

      if (sub.format === 'clean_confirmed') {
        subTierBonus = 4000; // 1. Dublagem PT-BR com vídeo limpo
        subExplanation = 'vídeo limpo';
      } else if (sub.format === 'softsub') {
        subTierBonus = 3000; // 2. Dublagem PT-BR com legendas internas
        subExplanation = 'softsub';
      } else if (sub.format === 'hardsub_ptbr') {
        subTierBonus = 1000; // 3. Dublagem PT-BR com legendas gravadas
        subExplanation = 'hardsub PT-BR';
      } else if (sub.format === 'hardsub_foreign') {
        subTierBonus = 500;  // Dublagem PT-BR com placas em outro idioma
        subExplanation = 'placas em outro idioma';
      }

      const score = 100000 + subTierBonus + qualityBonus + confidenceBonus + webReadyPenalty + codecBonus + performanceModifiers;
      return {
        score,
        priority: 1,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        codecInfo,
        explanation: `Prioridade 1: Áudio Dublado PT-BR (${subExplanation}, score: ${score})${confidenceExplanation}${webReadyExplanation}${codecExplanation}${providerExplanation}${networkExplanation}`
      };
    }

    // =========================================================================
    // PRIORIDADE 2: DUAL AUDIO (Base: 90.000 pontos)
    // Contém áudio original + dublado PT-BR selecionável no container.
    // =========================================================================
    if (audio.tier === 'dual_audio') {
      let subTierBonus = 2000;
      if (sub.format === 'clean_confirmed') subTierBonus = 4000;
      else if (sub.format === 'softsub') subTierBonus = 3000;
      else if (sub.format === 'hardsub_ptbr') subTierBonus = 1000;
      else if (sub.format === 'hardsub_foreign') subTierBonus = 500;

      const score = 90000 + subTierBonus + qualityBonus + confidenceBonus + webReadyPenalty + codecBonus + performanceModifiers;
      return {
        score,
        priority: 2,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        codecInfo,
        explanation: `Prioridade 2: Dual Áudio PT-BR (score: ${score})${confidenceExplanation}${webReadyExplanation}${codecExplanation}${providerExplanation}${networkExplanation}`
      };
    }

    // =========================================================================
    // PRIORIDADE 3: ÁUDIO ORIGINAL + VÍDEO LIMPO + LEGENDA PT-BR EXTERNA (Base: 50.000 pontos)
    // Aplicado quando NÃO houver dublagem brasileira disponível.
    // =========================================================================
    if (options.hasExternalPtSub && (sub.format === 'clean_confirmed' || sub.format === 'softsub' || sub.format === 'unknown')) {
      let subBonus = 1000;
      if (sub.format === 'clean_confirmed') subBonus = 4000;
      else if (sub.format === 'softsub') subBonus = 3000;

      const score = 50000 + subBonus + qualityBonus + confidenceBonus + webReadyPenalty + codecBonus + performanceModifiers;
      return {
        score,
        priority: 3,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        codecInfo,
        explanation: `Prioridade 3: Áudio Original + Vídeo Limpo + Legenda PT-BR externa (score: ${score})${confidenceExplanation}${webReadyExplanation}${codecExplanation}${providerExplanation}${networkExplanation}`
      };
    }

    // =========================================================================
    // PRIORIDADE 4: ÁUDIO ORIGINAL + SOFTSUB PT-BR (Base: 40.000 pontos)
    // =========================================================================
    if (sub.format === 'softsub' && sub.hasPtSubtitle) {
      const score = 40000 + 3000 + qualityBonus + confidenceBonus + webReadyPenalty + codecBonus + performanceModifiers;
      return {
        score,
        priority: 4,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        codecInfo,
        explanation: `Prioridade 4: Áudio Original + Softsub PT-BR interno (score: ${score})${confidenceExplanation}${webReadyExplanation}${codecExplanation}${providerExplanation}${networkExplanation}`
      };
    }

    // =========================================================================
    // PRIORIDADE 5: ÁUDIO ORIGINAL + HARDSUB PT-BR (Base: 30.000 ou 20.000 pontos)
    // Fallback importante quando NÃO há legenda externa PT-BR disponível.
    // =========================================================================
    if (sub.format === 'hardsub_ptbr') {
      const base = options.hasExternalPtSub ? 20000 : 30000;
      const score = base + qualityBonus + confidenceBonus + webReadyPenalty + codecBonus + performanceModifiers;
      return {
        score,
        priority: 5,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        codecInfo,
        explanation: `Prioridade 5: Áudio Original + Hardsub PT-BR (score: ${score})${confidenceExplanation}${webReadyExplanation}${codecExplanation}${providerExplanation}${networkExplanation}`
      };
    }

    // =========================================================================
    // PRIORIDADE 6: OUTROS IDIOMAS / HARDSUB ESTRANGEIRO SEM PT-BR
    // Penalizado para nunca ser escolhido quando houver opção em português.
    // =========================================================================
    const isForeignHardsub = sub.format === 'hardsub_foreign';
    const baseScore = isForeignHardsub ? 1000 : 5000;
    const rawScore = baseScore + qualityBonus + confidenceBonus + webReadyPenalty + codecBonus + performanceModifiers;
    const score = Math.max(100, rawScore);

    return {
      score,
      priority: 6,
      confidence,
      audioTier: audio.tier,
      subtitleFormat: sub.format,
      audioAnalysis: audio,
      subtitleAnalysis: sub,
      codecInfo,
      explanation: `Prioridade 6: Idioma estrangeiro / Hardsub estrangeiro (score: ${score})${confidenceExplanation}${webReadyExplanation}${codecExplanation}${providerExplanation}${networkExplanation}`
    };
  }

  /**
   * Ordena a lista de streams aplicando a hierarquia estrita:
   * 1. Confirmação obrigatória de identidade (rejeita e quarentena excluídos)
   * 2. Dublagem PT-BR
   * 3. Dual Audio
   * 4. Áudio Original + Limpo + Legenda externa
   * 5. Softsub PT-BR
   * 6. Hardsub PT-BR
   * 7. Outros
   */
  public rankStreams(
    streams: StremioStream[],
    options: SourceSelectionOptions
  ): StremioStream[] {
    if (!streams || streams.length === 0) return [];

    // Isolamento de cache por dispositivo/codec para evitar que navegadores sem Dolby recebam fontes mudas de outro dispositivo
    const deviceKey = audioCodecService.getDeviceCacheKey();
    const effectiveCacheKey = options.cacheKey ? `${options.cacheKey}_${deviceKey}` : undefined;

    // Cache hit (apenas se contiver streams válidos)
    if (effectiveCacheKey) {
      const cached = selectionCache.get(effectiveCacheKey);
      if (cached && cached.streams.length > 0 && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.streams;
      }
    }

    const scored = streams.map(stream => {
      const evaluation = this.evaluateStream(stream, {
        hasExternalPtSub: options.hasExternalPtSub,
        identity: options.identity
      });

      return {
        stream,
        evaluation
      };
    });

    // 1. Filtrar terminantemente qualquer stream com score negativo (Quarentena, Rejeitado, Bloqueio Infantil)
    const validScored = scored.filter(item => item.evaluation.score >= 0);

    // 2. Ordenar de forma estritamente decrescente por score
    validScored.sort((a, b) => b.evaluation.score - a.evaluation.score);

    const rankedStreams = validScored.map(item => ({
      ...item.stream,
      _smartScore: item.evaluation.score,
      _smartPriority: item.evaluation.priority,
      _confidence: item.evaluation.confidence,
      _audioTier: item.evaluation.audioTier,
      _subtitleFormat: item.evaluation.subtitleFormat,
      _codecInfo: item.evaluation.codecInfo,
      _scoreExplanation: item.evaluation.explanation
    }));

    if (effectiveCacheKey && rankedStreams.length > 0) {
      selectionCache.set(effectiveCacheKey, {
        streams: rankedStreams,
        timestamp: Date.now()
      });
    }

    return rankedStreams;
  }

  /**
   * Invalida qualquer cache de seleção armazenado em memória.
   */
  public clearRankingCache(): void {
    selectionCache.clear();
  }
}

export const sourceSelectionService = new SourceSelectionService();
