/**
 * ZapiTV Subtitle Translation Service
 * 
 * Traduz legendas externas (ex: inglês para português brasileiro) preservando:
 * 1. Timestamps exatos de início e término dos cues.
 * 2. Ordem estrita dos blocos e quebras de linha.
 * 3. Validação linguística: garante que o resultado é comprovadamente PT-BR.
 * 4. NUNCA retorna o texto original em inglês como fallback com rótulo PT-BR.
 */

import { detectSubtitleLanguage, validateSubtitleContentMatch } from './subtitleLanguageDetector';

export interface CueItem {
  start: number;
  end: number;
  text: string;
}

export interface TranslationResult {
  success: boolean;
  translatedCues: CueItem[];
  translatedSrt: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;
  error?: string;
}

class SubtitleTranslationService {
  private translationCache = new Map<string, { cues: CueItem[]; srt: string; timestamp: number }>();
  private static CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  /**
   * Converte cues em formato SRT padronizado.
   */
  public cuesToSrt(cues: CueItem[]): string {
    return cues.map((cue, idx) => {
      const startStr = this.formatTime(cue.start);
      const endStr = this.formatTime(cue.end);
      return `${idx + 1}\n${startStr} --> ${endStr}\n${cue.text}\n`;
    }).join('\n');
  }

  private formatTime(seconds: number): string {
    const s = Math.max(0, isNaN(seconds) ? 0 : seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);

    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
  }

  /**
   * Traduz um lote de textos via API gratuita com fallback.
   */
  private async translateBatch(texts: string[], targetLang = 'pt'): Promise<string[]> {
    if (texts.length === 0) return [];

    // Junta textos usando delimitador seguro que não seja alterado pelo tradutor
    const DELIMITER = ' |||| ';
    const joined = texts.join(DELIMITER);

    // Tentativa 1: Endpoint Google Translate (gtx)
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(joined)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedFull = data[0].map((item: any) => item[0]).join('');
          const split = translatedFull.split(/\s*\|\|\|\|\s*/);
          if (split.length === texts.length) {
            return split.map(t => t.trim());
          }
        }
      }
    } catch {}

    // Tentativa 2: Tradução individual rápida em paralelo caso o lote falhe
    try {
      const promises = texts.map(async (text) => {
        if (!text || text.trim().length <= 1) return text;
        try {
          const singleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
          const singleRes = await fetch(singleUrl, { signal: AbortSignal.timeout(4000) });
          if (singleRes.ok) {
            const singleData = await singleRes.json();
            if (Array.isArray(singleData) && Array.isArray(singleData[0])) {
              return singleData[0].map((item: any) => item[0]).join('').trim();
            }
          }
        } catch {}
        return text;
      });

      return await Promise.all(promises);
    } catch {}

    return texts;
  }

  /**
   * Traduz legendas completas para Português (Brasil) com verificação rigorosa.
   */
  public async translateCuesToPtBr(
    cues: CueItem[],
    cacheKey: string
  ): Promise<TranslationResult> {
    if (!cues || cues.length === 0) {
      return {
        success: false,
        translatedCues: [],
        translatedSrt: '',
        sourceLang: 'und',
        targetLang: 'pt-BR',
        confidence: 0,
        error: 'Nenhuma fala disponível para traduzir'
      };
    }

    // 1. Verifica cache existente
    const cached = this.translationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SubtitleTranslationService.CACHE_TTL_MS) {
      return {
        success: true,
        translatedCues: cached.cues,
        translatedSrt: cached.srt,
        sourceLang: 'auto',
        targetLang: 'pt-BR',
        confidence: 0.95
      };
    }

    // 2. Analisa idioma original
    const originDetection = detectSubtitleLanguage(cues);
    if (originDetection.isPortuguese && originDetection.confidence >= 0.6) {
      // Já está em português! Retorna as cues diretamente
      const srt = this.cuesToSrt(cues);
      return {
        success: true,
        translatedCues: cues,
        translatedSrt: srt,
        sourceLang: 'pt-BR',
        targetLang: 'pt-BR',
        confidence: originDetection.confidence
      };
    }

    // 3. Processa tradução em blocos de 25 falas para respeitar limites de payload
    const CHUNK_SIZE = 25;
    const translatedCues: CueItem[] = [];

    try {
      for (let i = 0; i < cues.length; i += CHUNK_SIZE) {
        const chunk = cues.slice(i, i + CHUNK_SIZE);
        const originalTexts = chunk.map(c => c.text);
        const translatedTexts = await this.translateBatch(originalTexts, 'pt');

        for (let j = 0; j < chunk.length; j++) {
          translatedCues.push({
            start: chunk[j].start,
            end: chunk[j].end,
            text: translatedTexts[j] || chunk[j].text
          });
        }
      }

      // 4. VALIDAÇÃO OBRIGATÓRIA: O resultado gerado é realmente em Português?
      const validation = validateSubtitleContentMatch(translatedCues, 'pob');
      if (!validation.isValid || !validation.isConsistent) {
        // A tradução falhou ou retornou texto em inglês!
        // REGRA DE OURO: NÃO ENVIAR O TEXTO ORIGINAL COM RÓTULO PT-BR!
        console.warn('[ZapiTranslate] Falha na validação linguística da tradução:', validation.reason);
        return {
          success: false,
          translatedCues: [],
          translatedSrt: '',
          sourceLang: originDetection.detectedLang,
          targetLang: 'pt-BR',
          confidence: 0,
          error: 'A tradução automática não produziu texto válido em português brasileiro'
        };
      }

      const translatedSrt = this.cuesToSrt(translatedCues);
      this.translationCache.set(cacheKey, {
        cues: translatedCues,
        srt: translatedSrt,
        timestamp: Date.now()
      });

      return {
        success: true,
        translatedCues,
        translatedSrt,
        sourceLang: originDetection.detectedLang,
        targetLang: 'pt-BR',
        confidence: validation.confidence
      };
    } catch (err: any) {
      console.warn('[ZapiTranslate] Erro durante o pipeline de tradução:', err);
      return {
        success: false,
        translatedCues: [],
        translatedSrt: '',
        sourceLang: originDetection.detectedLang,
        targetLang: 'pt-BR',
        confidence: 0,
        error: err.message || 'Falha ao traduzir legendas'
      };
    }
  }

  /**
   * Invalida registros de cache de legendas incorretas.
   */
  public invalidateCache(cacheKey?: string): void {
    if (cacheKey) {
      this.translationCache.delete(cacheKey);
    } else {
      this.translationCache.clear();
    }
  }
}

export const subtitleTranslationService = new SubtitleTranslationService();
