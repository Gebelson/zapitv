import { StremioStream } from '../stremio/stremioTypes';
import { analyzeStreamSubtitleFormat, SubtitleFormat } from '../subtitles/streamSubtitleDetector';
import { sourceSelectionService } from '../selection/sourceSelectionService';

export interface AudioClassification {
  isPtBr: boolean;
  isDubbed: boolean;
  isSubtitled: boolean;
  hasPtSubtitle?: boolean;
  language: 'pt-BR' | 'pt-PT' | 'en' | 'ja' | 'es' | 'dual' | 'original' | 'unknown';
  quality: '4K' | '1080p' | '720p' | '480p' | 'HD' | 'SD';
  score: number; // Higher is better
  badge: '🔊💬' | '🔊' | '💬' | '❌';
  badgeLabel: string;
  subtitleFormat?: SubtitleFormat;
  isHardsub?: boolean;
}

const DUBBED_PATTERNS = [
  /\b(dublado|audio\s*pt|dual[-_]?audio|dual|multi|brazuca|nacional)\b/i,
  /\[dublado\]/i,
  /\[dual[-_]?audio\]/i,
  /\b(comando|bludv|mico[-_]?le[aã]o|lapumia|rede[-_]?canais|wolverdon)\b/i,
  /🇧🇷\s*dublado/i,
  /\b(dub\b|\/dub\/)/i
];

const PT_BR_GENERAL_PATTERNS = [
  /\b(pt[-_]?br|portugu[eê]s[-_]?br|portugu[eê]s)\b/i,
  /\[pt[-_]?br\]/i
];

const PT_PT_PATTERNS = [
  /\b(pt[-_]?pt|portugu[eê]s[-_]?pt)\b/i,
  /🇵🇹/i
];

const SUBTITLED_PATTERNS = [
  /\b(legendado|leg\b|subs?|legenda|softsubs)\b/i,
  /\[leg\]/i,
  /\[legendado\]/i,
  /🇯🇵\s*legendado/i
];

const QUALITY_PATTERNS: { regex: RegExp; quality: AudioClassification['quality']; score: number }[] = [
  { regex: /\b(4k|2160p|uhd)\b/i, quality: '4K', score: 50 },
  { regex: /\b(1080p|fhd|full\s*hd)\b/i, quality: '1080p', score: 40 },
  { regex: /\b(720p|hd)\b/i, quality: '720p', score: 30 },
  { regex: /\b(480p|sd)\b/i, quality: '480p', score: 10 }
];

/**
 * Consulta assíncrona ao OpenSubtitles v3 (padrão Stremio) para verificar presença de legendas em PT-BR.
 */
export async function checkOpenSubtitlesPtBr(type: string, id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const cleanId = id.replace(/\.json$/, '');
    const subUrl = `https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(cleanId)}.json`;
    const res = await fetch(subUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.subtitles)) {
        return data.subtitles.some((s: any) => s.lang === 'pob' || s.lang === 'por');
      }
    }
  } catch {
    // Falha silenciosa em caso de timeout
  }
  return false;
}

/**
 * Analisa metadados, títulos e descrição do stream para determinar idioma e qualidade,
 * aplicando a especificação visual do Show Subtitle PT-BR.
 */
export function classifyStream(stream: StremioStream, hasExternalPtSub = false): AudioClassification {
  const combinedText = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();

  // 1. Detectar Qualidade
  let quality: AudioClassification['quality'] = (stream.quality as any) || 'HD';
  for (const q of QUALITY_PATTERNS) {
    if (q.regex.test(combinedText) || (stream.quality && q.regex.test(stream.quality))) {
      quality = q.quality;
      break;
    }
  }

  // 2. Avaliação unificada com hierarquia absoluta de dublagem PT-BR
  const evaluation = sourceSelectionService.evaluateStream(stream, { hasExternalPtSub });

  const isPtBr = evaluation.audioAnalysis.isPtBr;
  const isDubbed = evaluation.audioAnalysis.isDubbed;
  const isSubtitled = evaluation.subtitleAnalysis.hasPtSubtitle;
  const subFormat = evaluation.subtitleFormat;
  const isHardsub = evaluation.subtitleAnalysis.isHardsub;
  const score = evaluation.score;

  // Idioma
  let language: AudioClassification['language'] = 'unknown';
  if (evaluation.audioAnalysis.tier === 'dual_audio') language = 'dual';
  else if (isDubbed) language = 'pt-BR';
  else if (evaluation.audioAnalysis.language === 'ja') language = 'ja';
  else if (evaluation.audioAnalysis.language === 'en') language = 'en';
  else if (evaluation.audioAnalysis.language === 'es') language = 'es';
  else if (evaluation.audioAnalysis.language === 'pt-PT') language = 'pt-PT';
  else if (isSubtitled) language = 'original';

  // 3. Determinar Selos / Badges do Show Subtitle PT-BR
  let badge: AudioClassification['badge'] = '❌';
  let badgeLabel = 'Sem PT-BR';

  if (isDubbed && (isSubtitled || hasExternalPtSub)) {
    badge = '🔊💬';
    badgeLabel = 'Dublado + Legenda PT-BR';
  } else if (isDubbed) {
    badge = '🔊';
    badgeLabel = 'Áudio Dublado PT-BR';
  } else if (isSubtitled || hasExternalPtSub) {
    badge = '💬';
    badgeLabel = subFormat === 'hardsub_ptbr' ? 'Hardsub PT-BR' : 'Legenda PT-BR';
  }

  return {
    isPtBr,
    isDubbed,
    isSubtitled,
    hasPtSubtitle: isSubtitled || hasExternalPtSub,
    language,
    quality,
    score,
    badge,
    badgeLabel,
    subtitleFormat: subFormat,
    isHardsub
  };
}

export interface StreamSortingOptions {
  preferDubbed?: boolean;
  allowSubtitled?: boolean;
  preferredQuality?: string;
  excludeYouTube?: boolean;
  excludeSubtitledOnly?: boolean;
}

/**
 * Filtra streams indesejados (vídeos do YouTube, embeds com propaganda).
 */
export function filterCleanNativeStreams(streams: StremioStream[]): StremioStream[] {
  return streams.filter(stream => {
    // Rejeitar vídeos do YouTube expressamente (ytId ou URLs do YouTube)
    if (stream.ytId) return false;
    const url = (stream.url || '').toLowerCase();
    if (url.includes('youtube.com') || url.includes('youtu.be')) return false;

    // Rejeitar embeds de terceiros com publicidade
    if (
      url.includes('embedplay') ||
      url.includes('playerflix') ||
      url.includes('videasy') ||
      url.includes('superflix') ||
      url.includes('parklogic')
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Ordena streams respeitando a hierarquia de prioridades solicitada:
 * 1. Áudio PT-BR Dublado confirmado/declarado (🔊 ou 🔊💬)
 * 2. Ausência de YouTube e anúncios
 * 3. Maior resolução/estabilidade
 */
export function sortStreamsByPtBrPriority(
  streams: StremioStream[],
  options: StreamSortingOptions = { preferDubbed: true, allowSubtitled: true, excludeYouTube: true }
): StremioStream[] {
  // 1. Filtrar YouTube e embeds
  const filtered = options.excludeYouTube !== false ? filterCleanNativeStreams(streams) : streams;

  // 2. Ordenar utilizando a hierarquia estrita do sourceSelectionService
  const ranked = sourceSelectionService.rankStreams(filtered, {
    hasExternalPtSub: false,
    preferDubbed: options.preferDubbed !== false,
    preferredQuality: options.preferredQuality
  });

  // 3. Adicionar badges visuais
  return ranked.map(stream => {
    const classification = classifyStream(stream);
    let formattedName = stream.name || 'Stream';
    if (!formattedName.includes('🔊') && !formattedName.includes('💬') && !formattedName.includes('❌')) {
      formattedName = `${classification.badge} ${formattedName}`;
    }

    return {
      ...stream,
      name: formattedName,
      isPtBr: classification.isPtBr,
      isDubbed: classification.isDubbed,
      isSubtitled: classification.isSubtitled,
      quality: classification.quality,
      badge: classification.badge,
      badgeLabel: classification.badgeLabel
    };
  });
}
