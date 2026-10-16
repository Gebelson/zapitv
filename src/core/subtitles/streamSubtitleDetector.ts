import { StremioStream } from '../stremio/stremioTypes';
import { sourceSelectionService } from '../selection/sourceSelectionService';

export type SubtitleFormat =
  | 'clean_confirmed'    // Vídeo limpo confirmado (RAW, Clean, No Subs, Unsubbed)
  | 'softsub'            // Legenda interna selecionável (Softsub, MKV, Multi-sub)
  | 'hardsub_ptbr'       // Legenda gravada na imagem em português (Hardsub PT-BR)
  | 'hardsub_foreign'    // Legenda gravada na imagem em outro idioma (ENG, ESP, etc.)
  | 'unknown';           // Tipo de legenda desconhecido ou não especificado

export interface StreamSubtitleAnalysis {
  format: SubtitleFormat;
  isHardsub: boolean;
  isClean: boolean;
  isSoftsub: boolean;
  language?: string;
  confidence: number;
  details: string;
}

export interface SmartRankingOptions {
  hasExternalPtSub: boolean;
  preferDubbed?: boolean;
  preferredQuality?: '4K' | '1080p' | '720p' | '480p' | 'HD';
  cacheKey?: string;
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
  /\b(?:spanish|espa[nñ]ol|espanhol|castellano|latino|spa|esp|es)[-_\s]*(?:hard[-_\s]?subs?|burned[-_\s]?in|legendas?[-_\s]?(?:fixas?|embutidas?))\b/i,
  /\b(?:hard[-_\s]?subs?|hardcoded[-_\s]*subs?|legendas?[-_\s]?(?:fixas?|embutidas?))[-_\s]*(?:spanish|espa[nñ]ol|espanhol|castellano|latino|spa|esp|es)\b/i,
  /\b(eng(?:lish)?[-_\s]*hardsubs?|hardsubs?[-_\s]*eng(?:lish)?|hardcoded[-_\s]*(?:eng|english|spa|spanish|esp|fre|french|ita|italian))\b/i,
  /\b(hardsub\s*\[(?:eng|en|es|spa|fre|ita)\]|subbed\s*\[(?:eng|en|es|spa|fre|ita)\])\b/i,
  /\b(subs?\s*burned\s*in\s*eng(?:lish)?|burned[-_\s]*in\s*eng(?:lish)?)\b/i,
  /\b(legendado\s*em\s*(?:ingl[eê]s|espanhol|franc[eê]s))\b/i,
  /\[(?:eng|en|spa|es|english|spanish)\s*hardsubs?\]/i,
  /\[hardcoded\s*subs?\]/i
];

const HARDSUB_PTBR_PATTERNS = [
  /\b(hardsub[-_]?pt[-_]?br|pt[-_]?br[-_]?hardsub|hardsub\s*\[pt[-_]?br\]|hardsub\s*pt|hardsub[-_]?br)\b/i,
  /\b(?:legendas?[-_\s]?(?:fixas?|embutidas?|gravadas?)|burned[-_\s]?in[-_\s]?subs?)[-_\s]*(?:pt[-_]?br|portugu[eê]s(?:[-_\s]*brasileiro)?)\b/i
];

const QUALITY_SCORES: Record<string, number> = {
  '4K': 50,
  '2160p': 50,
  '1080p': 40,
  '720p': 30,
  '480p': 10,
  'HD': 25,
  'SD': 5
};

/**
 * Cache em memória para ranking inteligente e classificação de streams
 */
const smartRankingCache = new Map<string, { streams: StremioStream[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Analisa os metadados do stream e classifica o tipo de legenda presente.
 */
export function analyzeStreamSubtitleFormat(stream: StremioStream): StreamSubtitleAnalysis {
  const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();
  const url = (stream.url || '').toLowerCase();

  // 1. Identificar hardsub estrangeiro com máxima prioridade de detecção
  if (HARDSUB_FOREIGN_PATTERNS.some(p => p.test(combined))) {
    return {
      format: 'hardsub_foreign',
      isHardsub: true,
      isClean: false,
      isSoftsub: false,
      language: 'foreign',
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

  // Priorização de decisão com base nos termos:
  if (hasHardsubPtBrKeyword && !hasSoftsubKeyword && !hasCleanKeyword) {
    return {
      format: 'hardsub_ptbr',
      isHardsub: true,
      isClean: false,
      isSoftsub: false,
      language: 'pt-BR',
      confidence: 0.9,
      details: 'Legenda gravada PT-BR detectada'
    };
  }

  if (hasCleanKeyword && !hasHardsubPtBrKeyword) {
    return {
      format: 'clean_confirmed',
      isHardsub: false,
      isClean: true,
      isSoftsub: false,
      confidence: 0.95,
      details: 'Vídeo limpo confirmado (RAW / No Subs)'
    };
  }

  if (hasSoftsubKeyword && !hasHardsubPtBrKeyword) {
    return {
      format: 'softsub',
      isHardsub: false,
      isClean: true,
      isSoftsub: true,
      confidence: 0.85,
      details: 'Legenda interna selecionável (Softsub)'
    };
  }

  if (hasCleanKeyword && hasSoftsubKeyword) {
    return {
      format: 'softsub',
      isHardsub: false,
      isClean: true,
      isSoftsub: true,
      confidence: 0.85,
      details: 'Softsub selecionável em release RAW'
    };
  }

  // Um hardsub sem idioma declarado não pode ser tratado como legenda PT-BR,
  // mesmo quando a fonte também anuncia áudio dublado.
  if (/\b(hard[-_]?subs?|hardcoded|legendas?[-_\s]?(?:fixas?|embutidas?|gravadas?))\b/i.test(combined) && !hasCleanKeyword && !hasSoftsubKeyword) {
    return {
      format: 'unknown',
      isHardsub: true,
      isClean: false,
      isSoftsub: false,
      confidence: 0.5,
      details: 'Legenda gravada com idioma não confirmado'
    };
  }

  // Release expressamente dublado em português sem menção a hardsub
  const isDubbed = Boolean(
    stream.isDubbed ||
    /\b(dublado|dual[-_]?audio|dual|brazuca)\b/i.test(combined)
  );

  if (isDubbed && !hasHardsubPtBrKeyword) {
    return {
      format: 'clean_confirmed',
      isHardsub: false,
      isClean: true,
      isSoftsub: false,
      confidence: 0.9,
      details: 'Áudio dublado sem legendas gravadas'
    };
  }

  return {
    format: 'unknown',
    isHardsub: false,
    isClean: false,
    isSoftsub: false,
    confidence: 0.5,
    details: 'Tipo de legenda desconhecido'
  };
}

/**
 * Calcula a pontuação de hierarquia do stream considerando:
 * Prioridade 1: Dublagem brasileira limpa
 * Prioridade 2: Áudio original + vídeo limpo + legenda PT-BR externa
 * Prioridade 3: Áudio original + softsub
 * Prioridade 4: Hardsub PT-BR (quando nenhuma versão limpa com legenda PT-BR externa estiver disponível)
 * Prioridade 5: Outras versões (Hardsub estrangeiro penalizado)
 */
export function calculateSmartStreamScore(
  stream: StremioStream,
  options: { hasExternalPtSub: boolean; preferDubbed?: boolean }
): { score: number; priority: 1 | 2 | 3 | 4 | 5 | 6; format: SubtitleFormat } {
  const result = sourceSelectionService.evaluateStream(stream, {
    hasExternalPtSub: options.hasExternalPtSub
  });

  return {
    score: result.score,
    priority: result.priority,
    format: result.subtitleFormat
  };
}

/**
 * Ordena streams de forma inteligente com base na hierarquia estrita de legendas e dublagens.
 */
export function smartRankStreams(
  streams: StremioStream[],
  options: SmartRankingOptions
): StremioStream[] {
  return sourceSelectionService.rankStreams(streams, {
    hasExternalPtSub: options.hasExternalPtSub,
    preferDubbed: options.preferDubbed !== false,
    preferredQuality: options.preferredQuality,
    cacheKey: options.cacheKey
  });
}

/**
 * Invalida o cache de ranking inteligente.
 */
export function invalidateSmartRankingCache(): void {
  smartRankingCache.clear();
  sourceSelectionService.clearRankingCache();
}
