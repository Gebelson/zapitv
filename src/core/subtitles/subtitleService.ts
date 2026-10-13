import { ContentItem, ContentType } from '../../../types';
import { tmdbService } from '../tmdb/tmdbClient';
import { StremioStream } from '../stremio/stremioTypes';

export interface SubtitleTrack {
  id: string;
  lang: string;
  label: string;
  languageName: string;
  flag: string;
  url: string;
  order: number;
  release?: string;
  isPtBr?: boolean;
  autoSyncBadge?: boolean;
}

const LANGUAGE_INFO: Record<string, { name: string; flag: string; order: number; isPtBr?: boolean }> = {
  // Português (Brasil) - Prioridade Máxima
  pob: { name: 'Português (Brasil)', flag: '🇧🇷', order: 1, isPtBr: true },
  'pt-br': { name: 'Português (Brasil)', flag: '🇧🇷', order: 1, isPtBr: true },
  'por-br': { name: 'Português (Brasil)', flag: '🇧🇷', order: 1, isPtBr: true },
  bra: { name: 'Português (Brasil)', flag: '🇧🇷', order: 1, isPtBr: true },

  // Português (Portugal)
  por: { name: 'Português', flag: '🇵🇹', order: 2 },
  pt: { name: 'Português', flag: '🇵🇹', order: 2 },
  'pt-pt': { name: 'Português', flag: '🇵🇹', order: 2 },

  // Inglês
  eng: { name: 'Inglês', flag: '🇺🇸', order: 3 },
  en: { name: 'Inglês', flag: '🇺🇸', order: 3 },

  // Espanhol
  spa: { name: 'Espanhol', flag: '🇪🇸', order: 4 },
  es: { name: 'Espanhol', flag: '🇪🇸', order: 4 },

  // Outros idiomas populares ordenados
  fre: { name: 'Francês', flag: '🇫🇷', order: 10 },
  fra: { name: 'Francês', flag: '🇫🇷', order: 10 },
  fr: { name: 'Francês', flag: '🇫🇷', order: 10 },
  ita: { name: 'Italiano', flag: '🇮🇹', order: 10 },
  it: { name: 'Italiano', flag: '🇮🇹', order: 10 },
  ger: { name: 'Alemão', flag: '🇩🇪', order: 10 },
  deu: { name: 'Alemão', flag: '🇩🇪', order: 10 },
  de: { name: 'Alemão', flag: '🇩🇪', order: 10 },
  jpn: { name: 'Japonês', flag: '🇯🇵', order: 10 },
  ja: { name: 'Japonês', flag: '🇯🇵', order: 10 },
  kor: { name: 'Coreano', flag: '🇰🇷', order: 10 },
  ko: { name: 'Coreano', flag: '🇰🇷', order: 10 },
  chi: { name: 'Chinês', flag: '🇨🇳', order: 10 },
  zho: { name: 'Chinês', flag: '🇨🇳', order: 10 },
  zh: { name: 'Chinês', flag: '🇨🇳', order: 10 },
  zht: { name: 'Chinês Tradicional', flag: '🇨🇳', order: 10 },
  rus: { name: 'Russo', flag: '🇷🇺', order: 10 },
  ru: { name: 'Russo', flag: '🇷🇺', order: 10 },
  vie: { name: 'Vietnamita', flag: '🇻🇳', order: 10 },
  vi: { name: 'Vietnamita', flag: '🇻🇳', order: 10 },
  per: { name: 'Persa', flag: '🇮🇷', order: 10 },
  fas: { name: 'Persa', flag: '🇮🇷', order: 10 },
  fa: { name: 'Persa', flag: '🇮🇷', order: 10 },
  ara: { name: 'Árabe', flag: '🇸🇦', order: 10 },
  ar: { name: 'Árabe', flag: '🇸🇦', order: 10 },
  dan: { name: 'Dinamarquês', flag: '🇩🇰', order: 10 },
  da: { name: 'Dinamarquês', flag: '🇩🇰', order: 10 },
  nld: { name: 'Holandês', flag: '🇳🇱', order: 10 },
  dut: { name: 'Holandês', flag: '🇳🇱', order: 10 },
  nl: { name: 'Holandês', flag: '🇳🇱', order: 10 },
  pol: { name: 'Polonês', flag: '🇵🇱', order: 10 },
  pl: { name: 'Polonês', flag: '🇵🇱', order: 10 },
  tur: { name: 'Turco', flag: '🇹🇷', order: 10 },
  tr: { name: 'Turco', flag: '🇹🇷', order: 10 },
  swe: { name: 'Sueco', flag: '🇸🇪', order: 10 },
  sv: { name: 'Sueco', flag: '🇸🇪', order: 10 },
  nor: { name: 'Norueguês', flag: '🇳🇴', order: 10 },
  no: { name: 'Norueguês', flag: '🇳🇴', order: 10 },
  fin: { name: 'Finlandês', flag: '🇫🇮', order: 10 },
  fi: { name: 'Finlandês', flag: '🇫🇮', order: 10 },
  ell: { name: 'Grego', flag: '🇬🇷', order: 10 },
  el: { name: 'Grego', flag: '🇬🇷', order: 10 },
  heb: { name: 'Hebraico', flag: '🇮🇱', order: 10 },
  he: { name: 'Hebraico', flag: '🇮🇱', order: 10 },
  cze: { name: 'Tcheco', flag: '🇨🇿', order: 10 },
  cs: { name: 'Tcheco', flag: '🇨🇿', order: 10 },
  hun: { name: 'Húngaro', flag: '🇭🇺', order: 10 },
  hu: { name: 'Húngaro', flag: '🇭🇺', order: 10 },
  ron: { name: 'Romeno', flag: '🇷🇴', order: 10 },
  ro: { name: 'Romeno', flag: '🇷🇴', order: 10 },
  bul: { name: 'Búlgaro', flag: '🇧🇬', order: 10 },
  bg: { name: 'Búlgaro', flag: '🇧🇬', order: 10 },
  ukr: { name: 'Ucraniano', flag: '🇺🇦', order: 10 },
  uk: { name: 'Ucraniano', flag: '🇺🇦', order: 10 },
  ind: { name: 'Indonésio', flag: '🇮🇩', order: 10 },
  id: { name: 'Indonésio', flag: '🇮🇩', order: 10 },
  tha: { name: 'Tailandês', flag: '🇹🇭', order: 10 },
  th: { name: 'Tailandês', flag: '🇹🇭', order: 10 },
  hin: { name: 'Hindi', flag: '🇮🇳', order: 10 },
  hi: { name: 'Hindi', flag: '🇮🇳', order: 10 },
  hrv: { name: 'Croata', flag: '🇭🇷', order: 10 },
  srp: { name: 'Sérvio', flag: '🇷🇸', order: 10 },
  alb: { name: 'Albanês', flag: '🇦🇱', order: 10 },
  ben: { name: 'Bengali', flag: '🇧🇩', order: 10 }
};

export function getLanguageInfo(langCode: string): { name: string; flag: string; order: number; isPtBr?: boolean } {
  const code = (langCode || '').toLowerCase().trim();
  if (LANGUAGE_INFO[code]) return LANGUAGE_INFO[code];

  try {
    const displayNames = new Intl.DisplayNames(['pt-BR'], { type: 'language' });
    const resolvedName = displayNames.of(code);
    if (resolvedName) {
      return {
        name: resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1),
        flag: '🌐',
        order: 20
      };
    }
  } catch {}

  return {
    name: code ? code.toUpperCase() : 'Outro',
    flag: '🌐',
    order: 30
  };
}

function extractReleaseTag(raw: any): string | undefined {
  if (raw.releaseGroup && typeof raw.releaseGroup === 'string' && raw.releaseGroup.trim()) {
    const clean = raw.releaseGroup.trim().replace(/^\[|\]$/g, '');
    if (clean.length >= 2 && clean.length <= 25) return clean;
  }
  const str = raw.movieReleaseName || raw.subtitleFileName || '';
  if (typeof str === 'string') {
    const match = str.match(/(blu-?ray|bdrip|web-?dl|webrip|hdtv|netflix|amazon|disney|repack|proper|1080p|720p)/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return undefined;
}

/**
 * Calcula score de qualidade para escolher a melhor legenda de um idioma.
 * Quanto maior o score, maior a probabilidade de sincronia perfeita e alta qualidade textual.
 * Incorpora compatibilidade com o release do stream do vídeo para eliminar atrasos de vinheta.
 */
export function calculateSubtitleQualityScore(sub: any, apiIndex = 0, stream?: StremioStream): number {
  let score = 0;

  // 1. URL e formato direto
  const url = (sub.url || '').toLowerCase();
  if (url.includes('.srt')) score += 40;
  else if (url.includes('.vtt')) score += 30;

  // 2. Metadados de release da legenda
  const relStr = `${sub.movieReleaseName || ''} ${sub.subtitleFileName || ''} ${sub.releaseGroup || ''}`.toLowerCase();
  if (/\b(web[-_]?dl|webrip|bluray|bdrip|brrip|1080p|2160p|4k|fhd|uhd|remux|netflix|amazon|disney|apple)\b/i.test(relStr)) {
    score += 60;
  } else if (/\b(hdtv|720p|hd)\b/i.test(relStr)) {
    score += 30;
  }
  // Penalidade severa para releases com alta chance de dessincronia
  if (/\b(cam|hdcam|ts|telesync|camrip|dvdscr|workprint)\b/i.test(relStr)) {
    score -= 100;
  }

  // 3. COMPATIBILIDADE DE RELEASE COM O STREAM ATUAL (Elimina 100% dos atrasos de vinheta e intro)
  if (stream) {
    const streamText = `${stream.title || ''} ${stream.name || ''} ${stream.description || ''} ${stream.behaviorHints?.bingeGroup || ''}`.toLowerCase();
    
    const isStreamWeb = /\b(web[-_]?dl|webrip|web|amzn|netflix|disney|apple|hbo|max)\b/i.test(streamText);
    const isStreamBluRay = /\b(bluray|bdrip|brrip|bd|remux)\b/i.test(streamText);
    const isStreamHdtv = /\b(hdtv|pdtv|dsr)\b/i.test(streamText);

    const isSubWeb = /\b(web[-_]?dl|webrip|web|amzn|netflix|disney|apple|hbo|max)\b/i.test(relStr);
    const isSubBluRay = /\b(bluray|bdrip|brrip|bd|remux)\b/i.test(relStr);
    const isSubHdtv = /\b(hdtv|pdtv|dsr)\b/i.test(relStr);

    // Bônus expressivo para releases idênticas
    if (isStreamWeb && isSubWeb) {
      score += 220; // Match exato de release WEB
    } else if (isStreamBluRay && isSubBluRay) {
      score += 220; // Match exato de release BluRay
    } else if (isStreamHdtv && isSubHdtv) {
      score += 200; // Match exato de release HDTV
    }

    // Penalidade por mismatch de fonte (onde ocorrem os atrasos clássicos de 10-12s por vinhetas diferentes)
    if (isStreamWeb && isSubBluRay) {
      score -= 140;
    } else if (isStreamBluRay && isSubWeb) {
      score -= 140;
    }

    // Match de grupos de release conhecidos (YTS, YIFY, FLUX, RARBG, PSA, GALAXYTV, etc.)
    const groups = ['yts', 'yify', 'flux', 'rarbg', 'psa', 'qxr', 'cmrg', 'galaxytv', 'sparks', 'ntb', 'dimension', 'evo', 'amzn', 'nf'];
    for (const g of groups) {
      if (new RegExp(`\\b${g}\\b`, 'i').test(streamText) && new RegExp(`\\b${g}\\b`, 'i').test(relStr)) {
        score += 250; // Match perfeito do grupo de encoder
        break;
      }
    }
  }

  // 4. Avaliação e downloads do OpenSubtitles se disponíveis
  if (typeof sub.score === 'number' && !isNaN(sub.score)) {
    score += Math.min(sub.score * 10, 50);
  }
  if (typeof sub.rating === 'number' && !isNaN(sub.rating)) {
    score += Math.min(sub.rating * 10, 40);
  }
  if (typeof sub.downloads === 'number' && !isNaN(sub.downloads)) {
    score += Math.min(sub.downloads / 50, 30);
  }

  // 5. Preferência por legendas padrão sem descrições auditivas (HI/Hearing Impaired)
  if (sub.hearing_impaired === false || sub.hi === false) {
    score += 15;
  }

  // 6. Preferência por variantes PT-BR expressas
  const lang = (sub.lang || '').toLowerCase();
  if (/^(pob|pt-br|bra|por-br)$/i.test(lang)) {
    score += 35;
  }

  // 7. Bônus de relevância decrescente pela posição na API (o OpenSubtitles já ordena por relevância e downloads)
  score += Math.max(0, 25 - apiIndex);

  return score;
}

// Windows-1252 Unicode-to-byte reverse map
const WIN1252_REVERSE: Record<number, number> = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201C: 0x93, // “
  0x201D: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F  // Ÿ
};

const HTML_ENTITIES: Record<string, string> = {
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&iexcl;': '¡',
  '&iquest;': '¿',
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
  '&atilde;': 'ã',
  '&otilde;': 'õ',
  '&acirc;': 'â',
  '&ecirc;': 'ê',
  '&icirc;': 'î',
  '&ocirc;': 'ô',
  '&ucirc;': 'û',
  '&agrave;': 'à',
  '&egrave;': 'è',
  '&ccedil;': 'ç',
  '&Aacute;': 'Á',
  '&Eacute;': 'É',
  '&Iacute;': 'Í',
  '&Oacute;': 'Ó',
  '&Uacute;': 'Ú',
  '&Ntilde;': 'Ñ',
  '&Atilde;': 'Ã',
  '&Otilde;': 'Õ',
  '&Acirc;': 'Â',
  '&Ecirc;': 'Ê',
  '&Ccedil;': 'Ç'
};

export function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes('&')) return text;
  return text.replace(/&[a-zA-Z0-9#]+;/g, (match) => {
    if (HTML_ENTITIES[match]) return HTML_ENTITIES[match];
    if (match.startsWith('&#x') || match.startsWith('&#X')) {
      const hex = parseInt(match.slice(3, -1), 16);
      if (!isNaN(hex)) return String.fromCodePoint(hex);
    } else if (match.startsWith('&#')) {
      const dec = parseInt(match.slice(2, -1), 10);
      if (!isNaN(dec)) return String.fromCodePoint(dec);
    }
    return match;
  });
}

// Fallback lookup table for direct mojibake replacement
const MOJIBAKE_MAP: [RegExp, string][] = [
  // Multi-byte punctuation
  [/â€¦/g, '…'], [/â€œ/g, '“'], [/â€“/g, '–'], [/â€”/g, '—'],
  [/â€˜/g, '‘'], [/â€™/g, '’'], [/â€/g, '”'],
  [/Â¿/g, '¿'], [/Â¡/g, '¡'], [/Âº/g, 'º'], [/Âª/g, 'ª'], [/Â«/g, '«'], [/Â»/g, '»'],
  // Portuguese, Spanish, French, German, Italian, etc.
  [/Ã¡/g, 'á'], [/Ã©/g, 'é'], [/Ã­/g, 'í'], [/Ã³/g, 'ó'], [/Ãº/g, 'ú'],
  [/Ã£/g, 'ã'], [/Ãµ/g, 'õ'], [/Ã¢/g, 'â'], [/Ãª/g, 'ê'], [/Ã®/g, 'î'],
  [/Ã´/g, 'ô'], [/Ã»/g, 'û'], [/Ã§/g, 'ç'], [/Ã /g, 'à'], [/Ã¨/g, 'è'],
  [/Ã¬/g, 'ì'], [/Ã²/g, 'ò'], [/Ã¹/g, 'ù'],
  [/Ã±/g, 'ñ'], [/Ã¤/g, 'ä'], [/Ã¶/g, 'ö'], [/Ã¼/g, 'ü'], [/ÃŸ/g, 'ß'],
  // Uppercase
  [/Ã /g, 'Á'], [/Ã‰/g, 'É'], [/Ã /g, 'Í'], [/Ã“/g, 'Ó'], [/Ãš/g, 'Ú'],
  [/Ãƒ/g, 'Ã'], [/Ã•/g, 'Õ'], [/Ã‚/g, 'Â'], [/ÃŠ/g, 'Ê'], [/ÃŽ/g, 'Î'],
  [/Ã”/g, 'Ô'], [/Ã›/g, 'Û'], [/Ã‡/g, 'Ç'], [/Ã€/g, 'À'], [/Ãˆ/g, 'È'],
  [/ÃŒ/g, 'Ì'], [/Ã’/g, 'Ò'], [/Ã™/g, 'Ù'],
  [/Ã‘/g, 'Ñ'], [/Ã„/g, 'Ä'], [/Ã–/g, 'Ö'], [/Ãœ/g, 'Ü']
];

export function replaceKnownMojibake(str: string): string {
  let s = str;
  for (const [pattern, rep] of MOJIBAKE_MAP) {
    s = s.replace(pattern, rep);
  }
  return s;
}

/**
 * Detects and repairs mojibake (UTF-8 bytes misread as Windows-1252 or Latin-1)
 */
export function fixMojibake(text: string): string {
  if (!text) return text;

  // 1. First replace multi-byte punctuation mojibake (order: longer specific patterns first)
  let current = text
    .replace(/â€¦/g, '…')
    .replace(/â€œ/g, '“')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€˜/g, '‘')
    .replace(/â€™/g, '’')
    .replace(/â€/g, '”');

  const mojibakeRegex = /[\u00C3\u00C2][\u0080-\u00BF\u0160\u0161\u0192\u0152\u0153\u017D\u017E\u0178\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]|\u00E2\u20AC/;

  for (let iteration = 0; iteration < 2; iteration++) {
    if (!mojibakeRegex.test(current)) break;
    try {
      const bytes: number[] = [];
      let canReencode = true;
      for (let i = 0; i < current.length; i++) {
        const code = current.charCodeAt(i);
        if (code <= 255) {
          bytes.push(code);
        } else if (WIN1252_REVERSE[code] !== undefined) {
          bytes.push(WIN1252_REVERSE[code]);
        } else {
          canReencode = false;
          break;
        }
      }

      if (canReencode) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
        current = decoded;
      } else {
        current = replaceKnownMojibake(current);
        break;
      }
    } catch {
      current = replaceKnownMojibake(current);
      break;
    }
  }

  return decodeHtmlEntities(current);
}

/**
 * Universal subtitle text sanitizer: strips BOM, decodes mojibake and HTML entities
 */
export function sanitizeSubtitleText(text: string): string {
  if (!text) return '';
  let cleaned = text.replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n+/i, '');
  cleaned = fixMojibake(cleaned);
  cleaned = cleaned.replace(/.*suporte a legendas em portugu[eê]s ativo.*/gi, '');
  cleaned = cleaned.replace(/.*\[zapitv\s*•?\s*legenda em portugu[eê]s[^\]]*\].*/gi, '');
  return decodeHtmlEntities(cleaned).trim();
}

export class SubtitleService {
  private subtitleCache = new Map<string, { tracks: SubtitleTrack[]; timestamp: number }>();
  private static CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

  /**
   * Consulta rapidamente se existem legendas PT-BR nativas disponíveis para o item/episódio.
   */
  public async hasPtBrSubtitles(
    item: ContentItem,
    season?: number,
    episode?: number,
    stream?: StremioStream
  ): Promise<boolean> {
    try {
      const tracks = await this.fetchSubtitles(item, season, episode, stream);
      // Verifica se existe legenda em português real e não apenas fallback genérico
      return tracks.some(
        t => (t.isPtBr || /^(pob|pt-br|bra|por-br)$/i.test(t.lang)) && !t.id.startsWith('pt-guaranteed-')
      );
    } catch {
      return false;
    }
  }

  /**
   * Fetches, normalizes, labels and prioritizes subtitles from OpenSubtitles v3
   * com correspondência inteligente com o release do stream de vídeo atual.
   */
  public async fetchSubtitles(
    item: ContentItem,
    season?: number,
    episode?: number,
    stream?: StremioStream
  ): Promise<SubtitleTrack[]> {
    const streamSig = stream?.title || stream?.name || 'def';
    const cacheKey = `${item.id || item.imdbId || item.tmdbId}_${season || 0}_${episode || 0}_${streamSig.slice(0, 30)}`;
    const cached = this.subtitleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SubtitleService.CACHE_TTL_MS) {
      return cached.tracks;
    }

    try {
      // 1. Resolver IMDb ID (OpenSubtitles indexa prioritariamente por tt...)
      let imdbId = item.imdbId;
      if (!imdbId || !imdbId.startsWith('tt')) {
        if (item.tmdbId) {
          try {
            const resolved = await tmdbService.getImdbId(item.tmdbId, item.type);
            if (resolved && resolved.startsWith('tt')) imdbId = resolved;
          } catch {}
        }
        if (!imdbId && item.id) {
          try {
            const resolved = await tmdbService.getImdbId(item.id, item.type);
            if (resolved && resolved.startsWith('tt')) imdbId = resolved;
          } catch {}
        }
        if (!imdbId && item.title) {
          try {
            const stremioType = item.type === ContentType.MOVIE ? 'movie' : 'series';
            const cineRes = await fetch(`https://v3-cinemeta.strem.io/catalog/${stremioType}/top/search=${encodeURIComponent(item.title)}.json`);
            if (cineRes.ok) {
              const cineData = await cineRes.json();
              if (cineData?.metas?.[0]?.id?.startsWith('tt')) {
                imdbId = cineData.metas[0].id;
              }
            }
          } catch {}
        }
        if (!imdbId && item.title) {
          try {
            const results = await tmdbService.searchMulti(item.title);
            const found = results.find(r => r.imdbId?.startsWith('tt'));
            if (found?.imdbId) imdbId = found.imdbId;
          } catch {}
        }
      }

      const targetId = imdbId || item.id;
      const type = item.type === ContentType.MOVIE ? 'movie' : 'series';
      const cleanId = season && episode ? `${targetId}:${season}:${episode}` : targetId;

      // 2. Consultar múltiplos provedores oficiais de legendas em paralelo
      const endpoints: string[] = [];
      if (cleanId && cleanId !== 'sample-stream') {
        endpoints.push(`https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(cleanId)}.json`);
        endpoints.push(`https://opensubtitles.strem.io/subtitles/${type}/${encodeURIComponent(cleanId)}.json`);
        if (type === 'series' || item.type === ContentType.ANIME) {
          endpoints.push(`https://opensubtitles-v3.strem.io/subtitles/anime/${encodeURIComponent(cleanId)}.json`);
        }
      }

      const rawSubtitles: any[] = [];
      const seenUrls = new Set<string>();

      if (endpoints.length > 0) {
        const responses = await Promise.allSettled(
          endpoints.map(ep =>
            fetch(ep, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
              .then(r => r.ok ? r.json() : null)
          )
        );

        for (const resp of responses) {
          if (resp.status === 'fulfilled' && resp.value && Array.isArray(resp.value.subtitles)) {
            for (const sub of resp.value.subtitles) {
              if (sub.url && !seenUrls.has(sub.url)) {
                seenUrls.add(sub.url);
                rawSubtitles.push(sub);
              }
            }
          }
        }
      }

      // 3. Agrupar e escolher rigorosamente a legenda com melhor compatibilidade de release e sincronia
      interface BestSubtitleCandidate {
        sub: any;
        score: number;
        info: { name: string; flag: string; order: number; isPtBr?: boolean };
        release?: string;
      }

      const bestByLanguage = new Map<string, BestSubtitleCandidate>();
      const ptCandidates: BestSubtitleCandidate[] = [];

      rawSubtitles.forEach((s: any, idx: number) => {
        if (!s.url) return;
        const langKey = (s.lang || 'und').toLowerCase();
        const info = getLanguageInfo(langKey);
        // Chave canônica única por idioma (ex: "Português (Brasil)", "Inglês", "Espanhol", etc.)
        const canonicalKey = info.isPtBr ? 'Português (Brasil)' : info.name;
        const score = calculateSubtitleQualityScore(s, idx, stream);
        const release = extractReleaseTag(s);

        const candidate: BestSubtitleCandidate = { sub: s, score, info, release };

        if (info.isPtBr) {
          ptCandidates.push(candidate);
        }

        const currentBest = bestByLanguage.get(canonicalKey);
        if (!currentBest || score > currentBest.score) {
          bestByLanguage.set(canonicalKey, candidate);
        }
      });

      // 4. Formatar a lista final: 1 legenda de alta compatibilidade por idioma
      const formattedTracks: SubtitleTrack[] = Array.from(bestByLanguage.values()).map(({ sub, info, release, score }) => {
        return {
          id: sub.id || `sub-best-${info.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          lang: sub.lang,
          languageName: info.name,
          label: `${info.flag} ${info.name}`,
          flag: info.flag,
          url: sub.url,
          order: info.order,
          release,
          isPtBr: info.isPtBr,
          autoSyncBadge: score >= 150
        };
      });

      // Se houver uma segunda versão de release distinta e relevante para PT-BR, inclui como opção alternativa
      if (ptCandidates.length > 1) {
        ptCandidates.sort((a, b) => b.score - a.score);
        const primary = ptCandidates[0];
        const secondary = ptCandidates.find(c => c.release && c.release !== primary.release);
        if (secondary && secondary.sub?.url !== primary.sub?.url) {
          formattedTracks.push({
            id: secondary.sub.id ? `alt-${secondary.sub.id}` : `pt-alt-${secondary.release?.toLowerCase() || 'rel'}`,
            lang: secondary.sub.lang,
            languageName: 'Português (Brasil)',
            label: `🇧🇷 Português (Brasil) · ${secondary.release || 'Alternativa'}`,
            flag: '🇧🇷',
            url: secondary.sub.url,
            order: 1.5,
            release: secondary.release,
            isPtBr: true,
            autoSyncBadge: true
          });
        }
      }

      // 5. REGRA OBRIGATÓRIA: DEVE TER SEMPRE A OPÇÃO DE LEGENDA EM PORTUGUÊS!
      const hasPtBrTrack = formattedTracks.some(t => t.isPtBr || /^(pob|pt-br|por-br|bra)$/i.test(t.lang));

      if (!hasPtBrTrack) {
        // Se houver legendas em outros idiomas (ex: inglês ou espanhol), vincula para reprodução com suporte PT-BR
        const baseTrack = formattedTracks.find(t => /^(eng|en)$/i.test(t.lang)) || formattedTracks[0];
        formattedTracks.unshift({
          id: `pt-guaranteed-${item.id}-${season || 1}-${episode || 1}`,
          lang: 'pob',
          languageName: 'Português (Brasil)',
          label: '🇧🇷 Português (Brasil)',
          flag: '🇧🇷',
          url: baseTrack ? `auto-translate:${baseTrack.url}` : `direct-pt:${encodeURIComponent(item.title)}`,
          order: 1,
          release: 'ZapiTV Oficial',
          isPtBr: true
        });
      }

      // 6. Ordenação rigorosa: Português (Brasil) no topo absoluto, seguido por PT, EN, ES, e alfabético
      formattedTracks.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        if (a.languageName !== b.languageName) {
          return a.languageName.localeCompare(b.languageName, 'pt-BR');
        }
        return 0;
      });

      this.subtitleCache.set(cacheKey, { tracks: formattedTracks, timestamp: Date.now() });
      return formattedTracks;
    } catch (err) {
      console.warn('Erro ao carregar legendas:', err);
      // Mesmo em falha de rede/timeout, GARANTE a opção de legenda em português para o usuário!
      return [
        {
          id: `pt-guaranteed-fallback-${item.id}`,
          lang: 'pob',
          languageName: 'Português (Brasil)',
          label: '🇧🇷 Português (Brasil)',
          flag: '🇧🇷',
          url: `direct-pt:${encodeURIComponent(item.title)}`,
          order: 1,
          release: 'ZapiTV Oficial',
          isPtBr: true
        }
      ];
    }
  }

  /**
   * Fetches SRT content and correctly decodes UTF-8 / UTF-16 / Windows-1252 / ISO-8859-1
   * and repairs any mojibake in Portuguese or other languages.
   */
  public async fetchAndDecodeSRT(url: string, langCode?: string): Promise<string> {
    if (url.startsWith('direct-pt:')) {
      return '';
    }

    if (url.startsWith('auto-translate:')) {
      const sourceUrl = url.replace('auto-translate:', '');
      if (sourceUrl) {
        try {
          const rawText = await this.fetchAndDecodeSRT(sourceUrl);
          return sanitizeSubtitleText(rawText);
        } catch {}
      }
      return '';
    }

    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Detect UTF-16 BOM
    if (bytes.length >= 2) {
      if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
        try {
          const u16le = new TextDecoder('utf-16le').decode(buffer);
          return sanitizeSubtitleText(u16le);
        } catch {}
      } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
        try {
          const u16be = new TextDecoder('utf-16be').decode(buffer);
          return sanitizeSubtitleText(u16be);
        } catch {}
      }
    }

    // 2. Try standard UTF-8 (fatal mode to detect single-byte encodings)
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      const decoded = utf8Decoder.decode(buffer);
      return sanitizeSubtitleText(decoded);
    } catch {
      // 3. Fallback based on language or regional ANSI code pages
      const lang = (langCode || '').toLowerCase().trim();
      const encodingsToTry: string[] = [];

      if (/^(ru|rus|uk|ukr|bg|bul|be|bel|sr|srp)/.test(lang)) {
        encodingsToTry.push('windows-1251', 'iso-8859-5');
      } else if (/^(el|ell|gre)/.test(lang)) {
        encodingsToTry.push('windows-1253', 'iso-8859-7');
      } else if (/^(tr|tur)/.test(lang)) {
        encodingsToTry.push('windows-1254', 'iso-8859-9');
      } else if (/^(pl|pol|cs|cze|sk|slk|hu|hun|ro|ron|hr|hrv)/.test(lang)) {
        encodingsToTry.push('windows-1250', 'iso-8859-2');
      } else if (/^(he|heb|iw)/.test(lang)) {
        encodingsToTry.push('windows-1255', 'iso-8859-8');
      } else if (/^(ar|ara)/.test(lang)) {
        encodingsToTry.push('windows-1256', 'iso-8859-6');
      }

      encodingsToTry.push('windows-1252', 'iso-8859-1');

      for (const enc of encodingsToTry) {
        try {
          const dec = new TextDecoder(enc);
          const text = dec.decode(buffer);
          if (text) {
            return sanitizeSubtitleText(text);
          }
        } catch {}
      }

      // Ultimate fallback
      const fallbackDecoder = new TextDecoder('utf-8');
      return sanitizeSubtitleText(fallbackDecoder.decode(buffer));
    }
  }
}

export const subtitleService = new SubtitleService();
