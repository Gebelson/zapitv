import { StremioStream } from '../stremio/stremioTypes';

export type SubtitleFormat =
  | 'clean_confirmed'    // Vídeo limpo confirmado (RAW, Clean, No Subs, Unsubbed)
  | 'softsub'            // Legenda interna selecionável (Softsub, MKV, Multi-sub)
  | 'hardsub_ptbr'       // Legenda gravada na imagem em português (Hardsub PT-BR)
  | 'hardsub_foreign'    // Legenda gravada na imagem em outro idioma (ENG, ESP, etc.)
  | 'unknown';           // Tipo de legenda desconhecido ou não especificado

export interface SubtitleAnalysisResult {
  format: SubtitleFormat;
  isHardsub: boolean;
  isClean: boolean;
  isSoftsub: boolean;
  language?: string;
  hasPtSubtitle: boolean;
  confidence: number;
  details: string;
}

const CLEAN_PATTERNS = [
  /\b(raw|clean|no[-_]?subs?|unsubbed|sem[-_]?legendas?|sem[-_]?leg|clean[-_]?video|textless|ncop|nced)\b/i,
  /\b(bd[-_]?rip\s*raw|bdrip\s*raw|web[-_]?dl\s*raw|webrip\s*raw|dvd[-_]?raw)\b/i,
  /\b(audio\s*japones\s*sem\s*legenda|japones\s*puro|sem\s*legendas?\s*embutidas?)\b/i,
  /\[raw\]/i,
  /\braw\b/i
];

const SOFTSUB_PATTERNS = [
  /\b(soft[-_]?subs?|multi[-_]?subs?|embedded[-_]?subs?|switchable[-_]?subs?|selectable[-_]?subs?)\b/i,
  /\b(legendas?\s*selecion[aá]veis?|faixas?\s*de\s*legenda|legendas?\s*internas?)\b/i,
  /\[softsubs?\]/i,
  /\[multi[-_]?subs?\]/i
];

const HARDSUB_FOREIGN_PATTERNS = [
  /\b(eng(?:lish)?[-_\s]*hardsubs?|hardsubs?[-_\s]*eng(?:lish)?|hardcoded[-_\s]*(?:eng|english|spa|spanish|esp|fre|french|ita|italian))\b/i,
  /\b(hardsub\s*\[(?:eng|en|es|spa|fre|ita)\]|subbed\s*\[(?:eng|en|es|spa|fre|ita)\])\b/i,
  /\b(subs?\s*burned\s*in\s*eng(?:lish)?|burned[-_\s]*in\s*eng(?:lish)?)\b/i,
  /\b(legendado\s*em\s*(?:ingl[eê]s|espanhol|franc[eê]s))\b/i,
  /\[(?:eng|en|spa|es|english|spanish)\s*hardsubs?\]/i,
  /\[hardcoded\s*subs?\]/i
];

const HARDSUB_PTBR_PATTERNS = [
  /\b(hardsub[-_]?pt[-_]?br|pt[-_]?br[-_]?hardsub|hardsub\s*\[pt[-_]?br\]|hardsub\s*pt|hardsub[-_]?br)\b/i,
  /\b(hardsub|hard[-_]?sub|hardcoded|legenda[-_]?fixa|legendas[-_]?fixas|legenda[-_]?embutida)\b/i,
  /\b(legenda[-_]?gravada|gravada[-_]?na[-_]?imagem|burned[-_]?in[-_]?subs?)\b/i,
  /\b(anbient|animefire|otakupt|goyabu|animesvision|betteranime)\b/i
];

export class SubtitlePreferenceService {
  /**
   * Avalia as legendas disponíveis no stream e o tipo de vídeo (limpo, softsub, hardsub).
   */
  public analyzeSubtitles(stream: StremioStream, hasExternalPtSub = false): SubtitleAnalysisResult {
    const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();
    const url = (stream.url || '').toLowerCase();

    const hasPtBrIndication = /\b(pt[-_]?br|portugu[eê]s|legenda[-_]?pt|legendado)\b/i.test(combined);

    // 1. Identificar hardsub estrangeiro
    if (HARDSUB_FOREIGN_PATTERNS.some(p => p.test(combined)) && !hasPtBrIndication) {
      return {
        format: 'hardsub_foreign',
        isHardsub: true,
        isClean: false,
        isSoftsub: false,
        language: 'foreign',
        hasPtSubtitle: false,
        confidence: 0.95,
        details: 'Legenda gravada em outro idioma detectada'
      };
    }

    // 2. Avaliar indícios de Clean / RAW
    const hasCleanKeyword = CLEAN_PATTERNS.some(p => p.test(combined));

    // 3. Avaliar indícios de Softsub
    const hasSoftsubKeyword = SOFTSUB_PATTERNS.some(p => p.test(combined)) || url.endsWith('.mkv');

    // 4. Avaliar indícios de Hardsub PT-BR
    const hasHardsubPtBrKeyword = HARDSUB_PTBR_PATTERNS.some(p => p.test(combined));

    // Decisão da classificação
    if (hasCleanKeyword && !hasHardsubPtBrKeyword) {
      return {
        format: 'clean_confirmed',
        isHardsub: false,
        isClean: true,
        isSoftsub: false,
        hasPtSubtitle: hasExternalPtSub,
        confidence: 0.9,
        details: 'Vídeo original limpo (sem legendas gravadas na imagem)'
      };
    }

    if (hasSoftsubKeyword && !hasHardsubPtBrKeyword) {
      return {
        format: 'softsub',
        isHardsub: false,
        isClean: false,
        isSoftsub: true,
        hasPtSubtitle: hasPtBrIndication || hasExternalPtSub,
        confidence: 0.85,
        details: 'Legendas internas selecionáveis (Softsub)'
      };
    }

    if (hasHardsubPtBrKeyword || (hasPtBrIndication && (combined.includes('legendado') || combined.includes('[leg]')))) {
      return {
        format: 'hardsub_ptbr',
        isHardsub: true,
        isClean: false,
        isSoftsub: false,
        language: 'pt-BR',
        hasPtSubtitle: true,
        confidence: 0.85,
        details: 'Legenda gravada na imagem em PT-BR (Hardsub)'
      };
    }

    // Desconhecido
    return {
      format: 'unknown',
      isHardsub: false,
      isClean: false,
      isSoftsub: false,
      hasPtSubtitle: hasExternalPtSub,
      confidence: 0.5,
      details: 'Formato de legenda não identificado explicitamente nos metadados'
    };
  }
}

export const subtitlePreferenceService = new SubtitlePreferenceService();
