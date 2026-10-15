/**
 * ZapiTV - CamBlockerEngine
 * Motor de detecção e rejeição rigorosa de gravações de cinema (CAM, HDCAM, TS, Telesync, etc.).
 * 
 * Regras:
 * 1. Análise profunda de metadados: Rejeita termos de gravação de sala de cinema.
 * 2. Janela cinematográfica e evidências temporais: Obras ainda em cartaz ou sem data digital confirmada
 *    são rejeitadas preventivamente, pois não há possibilidade física de haver fonte digital legítima.
 * 3. Detecção de incongruências: Resoluções falsas (ex.: 1080p CAM) e áudio de microfone ambiente (mic).
 * 4. Não confia apenas no nome do arquivo: cruza evidências de provedores e metadados oficiais.
 */

import { ContentItem } from '../../../types';
import { theatricalFilterService } from './theatricalFilterService';

export interface CamEvaluationResult {
  isCam: boolean;
  confidence: 'DEFINITIVE' | 'HIGH' | 'SUSPECT' | 'CLEAN';
  reason?: string;
  matchedSignatures: string[];
}

export class CamBlockerEngine {
  // Padrões canônicos de gravações de sala de cinema
  private static readonly CAM_PATTERNS = [
    /\bcam\b/i,
    /\bhd-?cam\b/i,
    /\bcam-?rip\b/i,
    /\bcamrip\b/i,
    /\btelesync\b/i,
    /\btele-?sync\b/i,
    /\bhd-?ts\b/i,
    /\bhdts\b/i,
    /\btele-?cine\b/i,
    /\btelecine\b/i,
    /\b\d+p\s*tc\b/i,
    /\b\d+p\s*ts\b/i,
    /\bdvdscr\b/i,
    /\bscreener\b/i,
    /\bdvd-?screener\b/i,
    /\bcinema-?rip\b/i,
    /\btheater-?rip\b/i,
    /\btheatre-?rip\b/i,
    /\bline-?audio\b/i,
    /\bmic-?audio\b/i,
    /\bdirect-?mic\b/i,
    /\bworkprint\b/i,
    /\bcinemax-?cam\b/i,
    /\bc1nem4\b/i,
    /\bhive-?cm8\b/i,
    /\bcam-?latino\b/i,
    /\bcam-?legendado\b/i,
    /\bcam-?dublado\b/i,
    /\bgravado-?no-?cinema\b/i,
    /\bfilme-?de-?cinema\b/i,
    /\bcinema\s*hd\b/i,
    /\bqualidade\s*cinema\b/i
  ];

  /**
   * Avalia uma fonte de vídeo contra evidências de gravação de cinema.
   */
  public static evaluateStream(stream: { name?: string; title?: string; url?: string; quality?: string }, targetItem?: ContentItem): CamEvaluationResult {
    const sName = stream.name || '';
    const sTitle = stream.title || '';
    const sUrl = stream.url || '';
    const combined = `${sName} ${sTitle} ${sUrl}`.toLowerCase();

    const matchedSignatures: string[] = [];

    // 1. CHECAGEM TEXTUAL DE ASSINATURAS DE CAM
    for (const pattern of this.CAM_PATTERNS) {
      if (pattern.test(combined)) {
        matchedSignatures.push(pattern.source);
      }
    }

    if (matchedSignatures.length > 0) {
      return {
        isCam: true,
        confidence: 'DEFINITIVE',
        reason: `Rejeitado: assinatura de gravação de cinema detectada (${matchedSignatures[0]})`,
        matchedSignatures
      };
    }

    // 2. CHECAGEM DE SINAIS DE ÁUDIO GRAVADO EM SALA (MIC / AMBIENTE)
    if (/\b(mic|line\s*in|audio\s*de\s*cinema|gravado\s*em\s*sala)\b/i.test(`${sTitle} ${sName}`)) {
      return {
        isCam: true,
        confidence: 'HIGH',
        reason: 'Rejeitado: áudio de microfone de cinema detectado',
        matchedSignatures: ['mic_audio']
      };
    }

    // 3. EVIDÊNCIA TEMPORAL E JANELA CINEMATOGRÁFICA (Crucial para filmes novos)
    if (targetItem) {
      const isRestricted = theatricalFilterService.isKnownUnreleasedOrTheatrical(targetItem) || !theatricalFilterService.isMovieAllowedSync(targetItem);
      if (isRestricted) {
        return {
          isCam: true,
          confidence: 'DEFINITIVE',
          reason: 'Rejeitado: filme em exibição exclusiva nos cinemas ou não lançado (qualquer fonte atual é gravação de sala)',
          matchedSignatures: ['theatrical_window_active']
        };
      }
    }

    return {
      isCam: false,
      confidence: 'CLEAN',
      matchedSignatures: []
    };
  }

  /**
   * Atalho booleano rápido para verificar se uma fonte é CAM.
   */
  public static isCamStream(stream: { name?: string; title?: string; url?: string; quality?: string }, targetItem?: ContentItem): boolean {
    return this.evaluateStream(stream, targetItem).isCam;
  }
}
