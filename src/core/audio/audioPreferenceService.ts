import { StremioStream } from '../stremio/stremioTypes';

export type AudioTier =
  | 'dubbed_ptbr'   // Prioridade 1: Dublagem brasileira confirmada / dedicada
  | 'dual_audio'    // Prioridade 2: Dual Audio (contém áudio PT-BR e original)
  | 'original'      // Prioridade 3-5: Áudio original da obra
  | 'foreign';      // Prioridade 6: Áudio em outro idioma (sem PT-BR)

export interface AudioAnalysisResult {
  tier: AudioTier;
  isPtBr: boolean;
  isDubbed: boolean;
  isDualAudio: boolean;
  language: 'pt-BR' | 'dual' | 'ja' | 'en' | 'es' | 'pt-PT' | 'original' | 'unknown' | 'foreign';
  confidence: number;
  reason: string;
}

const DUAL_PATTERNS = [
  /\b(dual[-_\s]?audio|dual[-_\s]?áudio|multi[-_\s]?audio|multi[-_\s]?áudio)\b/i,
  /\[dual[-_\s]?audio\]/i,
  /\[dual\]/i,
  /\bdual\b(?!\s*[-_]?sub)/i,
  /\bdual\s*latino\b/i // latino can be foreign if not PT, handled below
];

const EXPLICIT_DUBBED_PATTERNS = [
  /\b(dublado|dublada|dublados|dublagem|dublagem\s*brasileira)\b/i,
  /\[dublado\]/i,
  /\[dub\]/i,
  /\b(fhd[-_]?dublado|hd[-_]?dublado|web[-_]?dl[-_]?dublado|pt[-_]?br\s*dub|fhd[-_]?dub|hd[-_]?dub)\b/i,
  /\b(audio|áudio)\s*(?:pt[-_]?br|portugu[eê]s|nacional|brasil|brasileiro)\b/i,
  /\b(?:pt[-_]?br|portugu[eê]s)\s*(?:audio|áudio)\b/i,
  /\b(brazuca|nacional)\b/i,
  /🇧🇷\s*(?:dublado|dual|áudio|audio|dub\b)/i,
  /🇧🇷.*?(?:dublado|dual|áudio|audio)/i
];

const DUBBED_PTBR_PATTERNS = [
  ...EXPLICIT_DUBBED_PATTERNS,
  /🌎\s*portugu[eê]s/i,
  /🌎\s*pt[-_]?br/i
];

const PTBR_GENERAL_PATTERNS = [
  /\b(pt[-_]?br|portugu[eê]s[-_]?br|portugu[eê]s)\b/i,
  /\[pt[-_]?br\]/i,
  /\b(pob|por)\b/i,
  /🇧🇷/,
  /🌎\s*portugu[eê]s/i,
  /🌎\s*pt[-_]?br/i
];

const SUBTITLED_ONLY_PATTERNS = [
  /\b(legendado|legendada|leg\b|subs?|softsubs?|hardsubs?|hardcoded|legenda[-_]?fixa|legenda[-_]?embutida|legenda[-_]?gravada)\b/i,
  /\[leg\]/i,
  /\[legendado\]/i,
  /\[hardsub\]/i,
  /\[hardsub[-_]?pt[-_]?br\]/i,
  /\bapenas\s*legendado\b/i,
  /🇯🇵\s*legendado/i
];

const FOREIGN_LANGUAGE_PATTERNS = [
  { regex: /\b(jap|ja\b|jpn|japanese|japon[eê]s)\b/i, lang: 'ja' as const },
  { regex: /\b(eng|en\b|english|ingl[eê]s)\b/i, lang: 'en' as const },
  { regex: /\b(esp|es\b|spanish|espanhol|castellano|latino)\b/i, lang: 'es' as const },
  { regex: /\b(pt[-_]?pt|portugu[eê]s[-_]?pt)\b/i, lang: 'pt-PT' as const }
];

export class AudioPreferenceService {
  /**
   * Avalia com precisão o idioma do áudio do stream.
   * Identifica se é dublado PT-BR, dual áudio, áudio original ou outro idioma.
   */
  public analyzeAudio(stream: StremioStream): AudioAnalysisResult {
    const combinedText = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();

    // 1. Verificar marcadores expressos de Dual Audio
    const isDualAudio = DUAL_PATTERNS.some(p => p.test(combinedText));

    // Nome do provedor, resolução e flags derivadas por addons não comprovam a faixa de áudio.
    const hasExplicitDubbed = EXPLICIT_DUBBED_PATTERNS.some(p => p.test(combinedText));
    const hasDubbedPattern = DUBBED_PTBR_PATTERNS.some(p => p.test(combinedText));
    const hasPtBrGeneral = PTBR_GENERAL_PATTERNS.some(p => p.test(combinedText));
    const hasSubtitledOnlyPattern = SUBTITLED_ONLY_PATTERNS.some(p => p.test(combinedText));
    const hasExplicitBrazilianAudio = hasPtBrGeneral ||
      /\b(audio|áudio)\s*pt(?:[-_]?br)?\b|\bdublagem\s*brasileira\b|\bbrazuca\b/i.test(combinedText);
    // "Dublado" sozinho não identifica o idioma: "Áudio Latino Dublado"
    // continua sendo espanhol, mesmo que o addon tenha marcado isPtBr.
    const isExplicitSpanishAudio = /\b(latino|espa[nñ]ol|espanhol|castellano)\b/i.test(combinedText) &&
      !hasExplicitBrazilianAudio;
    if (isExplicitSpanishAudio) {
      return {
        tier: 'foreign', isPtBr: false, isDubbed: false, isDualAudio: false,
        language: 'es', confidence: 0.9,
        reason: 'Áudio espanhol indicado explicitamente pela fonte'
      };
    }

    // Se a fonte contiver palavras explícitas de legenda/hardsub e não possuir marcadores expressos de dublagem ou dual áudio:
    const isExplicitlySubtitledOnly = hasSubtitledOnlyPattern && 
                                     !hasExplicitDubbed && 
                                     !isDualAudio;

    // Se o stream já vier com flags pré-definidas ou marcadores brasileiros
    const explicitlyBrazilian = hasExplicitDubbed || (!hasSubtitledOnlyPattern && (hasDubbedPattern || hasPtBrGeneral || stream.isDubbed === true || stream.isPtBr === true || /\b(pt[-_]?br|pob|por[-_]?br|brazilian)\b/i.test(combinedText)));

    // Avaliação: DUAL AUDIO (contém PT-BR)
    if (isDualAudio && explicitlyBrazilian && !isExplicitlySubtitledOnly) {
      return {
        tier: 'dual_audio',
        isPtBr: true,
        isDubbed: true,
        isDualAudio: true,
        language: 'dual',
        confidence: 0.95,
        reason: 'Dual Áudio com faixa PT-BR detectada'
      };
    }

    // Avaliação: DUBLADO PT-BR DEDICADO / ÁUDIO PT-BR
    const isForeignOnly = /\b(latino|espa[nñ]ol|espanhol|castellano)\b/i.test(combinedText) && !hasExplicitDubbed && !hasPtBrGeneral && !stream.isDubbed && !stream.isPtBr;
    const isPtPtOnly = /\b(pt[-_]?pt|portugu[eê]s[-_]?pt)\b/i.test(combinedText) && !/\b(pt[-_]?br|dublado|brazuca)\b/i.test(combinedText) && !/🇧🇷/.test(combinedText);

    if (
      !isExplicitlySubtitledOnly &&
      !isForeignOnly &&
      !isPtPtOnly &&
      (hasExplicitDubbed || (!hasSubtitledOnlyPattern && (hasDubbedPattern || explicitlyBrazilian || stream.isDubbed === true)))
    ) {
      return {
        tier: 'dubbed_ptbr',
        isPtBr: true,
        isDubbed: true,
        isDualAudio: false,
        language: 'pt-BR',
        confidence: 0.95,
        reason: 'Áudio dublado em português brasileiro'
      };
    }

    // Se possui PT-BR mas é expressamente apenas legendado
    if (hasPtBrGeneral && isExplicitlySubtitledOnly) {
      // Verificar idioma original da faixa de áudio
      for (const foreign of FOREIGN_LANGUAGE_PATTERNS) {
        if (foreign.regex.test(combinedText)) {
          return {
            tier: 'original',
            isPtBr: false,
            isDubbed: false,
            isDualAudio: false,
            language: foreign.lang,
            confidence: 0.85,
            reason: `Áudio original (${foreign.lang}) com indicação de legenda PT-BR`
          };
        }
      }

      return {
        tier: 'original',
        isPtBr: false,
        isDubbed: false,
        isDualAudio: false,
        language: 'original',
        confidence: 0.8,
        reason: 'Áudio original com legenda PT-BR'
      };
    }

    // Verificar se é idioma estrangeiro sem menção a português
    for (const foreign of FOREIGN_LANGUAGE_PATTERNS) {
      if (foreign.regex.test(combinedText)) {
        return {
          tier: 'foreign',
          isPtBr: false,
          isDubbed: false,
          isDualAudio: false,
          language: foreign.lang,
          confidence: 0.75,
          reason: `Áudio em outro idioma (${foreign.lang})`
        };
      }
    }

    // Formato desconhecido / neutro
    return {
      tier: 'original',
      isPtBr: false,
      isDubbed: false,
      isDualAudio: false,
      language: 'unknown',
      confidence: 0.5,
      reason: 'Idioma de áudio não declarado (padrão original)'
    };
  }
}

export const audioPreferenceService = new AudioPreferenceService();
