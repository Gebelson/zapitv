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
  language: 'pt-BR' | 'dual' | 'ja' | 'en' | 'es' | 'ko' | 'pt-PT' | 'fr' | 'de' | 'it' | 'original' | 'unknown' | 'foreign';
  confidence: number;
  reason: string;
}

const DUAL_PATTERNS = [
  /\b(dual[-_\s]?audio|dual[-_\s]?áudio|multi[-_\s]?audio|multi[-_\s]?áudio)\b/i,
  /\[dual[-_\s]?audio\]/i,
  /\[dual\]/i,
  /\bdual\b(?!\s*[-_]?sub)/i
];

const DUAL_PT_PATTERNS = [
  /\[(?:jap|jpn|eng|ita|fre|ger|esp|en|ja)[/+](?:por|pob|pt[-_]?br)\]/i,
  /\[(?:por|pob|pt[-_]?br)[/+](?:jap|jpn|eng|ita|fre|ger|esp|en|ja)\]/i,
  /\b(?:jap|jpn|eng|ita|fre|ger|esp|en|ja)[/+](?:por|pob|pt[-_]?br)\b/i,
  /\b(?:por|pob|pt[-_]?br)[/+](?:jap|jpn|eng|ita|fre|ger|esp|en|ja)\b/i,
  /\b(dual[-_\s]?audio|dual[-_\s]?áudio|multi[-_\s]?audio|multi[-_\s]?áudio)\b.*?\b(dublado|pt[-_]?br|portugu[eê]s|nacional|brazuca)\b/i,
  /\b(dublado|pt[-_]?br|portugu[eê]s|nacional|brazuca)\b.*?\b(dual[-_\s]?audio|dual[-_\s]?áudio|multi[-_\s]?audio|multi[-_\s]?áudio)\b/i,
  /\[dual[-_\s]?audio\]\s*\[(?:dublado|pt[-_]?br)\]/i,
  /\[(?:dublado|pt[-_]?br)\]\s*\[dual[-_\s]?audio\]/i,
  /🇧🇷\s*(?:dual[-_\s]?audio|dual[-_\s]?áudio)/i,
  /(?:dual[-_\s]?audio|dual[-_\s]?áudio)\s*🇧🇷/i
];

const EXPLICIT_FOREIGN_DUB_PATTERNS = [
  { regex: /\b(dublado\s*(?:em\s*)?latino|audio\s*latino|áudio\s*latino|dublado\s*latino|en\s*español|en\s*espanhol|dublado\s*(?:em\s*)?espanhol|spanish\s*dub|dual\s*latino)\b/i, lang: 'es' as const, name: 'latino/espanhol' },
  { regex: /\b(english\s*dub|eng\s*dub|dublado\s*(?:em\s*)?ingl[eê]s|dub\s*ingl[eê]s|audio\s*ingles|áudio\s*ingl[eê]s)\b/i, lang: 'en' as const, name: 'inglês' },
  { regex: /\b(dublado\s*(?:em\s*)?japon[eê]s|japanese\s*dub|audio\s*japones|áudio\s*japon[eê]s)\b/i, lang: 'ja' as const, name: 'japonês' },
  { regex: /\b(dublado\s*pt[-_]?pt|dublagem\s*portuguesa|vers[aã]o\s*portuguesa)\b/i, lang: 'pt-PT' as const, name: 'português de Portugal' }
];

const EXPLICIT_DUBBED_PATTERNS = [
  /\b(dublado|dublada|dublados|dublagem|dublagem\s*brasileira)\b/i,
  /\[dublado\]/i,
  /\b(fhd[-_]?dublado|hd[-_]?dublado|web[-_]?dl[-_]?dublado|pt[-_]?br\s*dub)\b/i,
  /\b(audio|áudio)\s*(?:pt[-_]?br|portugu[eê]s|nacional|brasil|brasileiro)\b/i,
  /\b(?:pt[-_]?br|portugu[eê]s)\s*(?:audio|áudio)\b/i,
  /\b(brazuca|nacional)\b/i,
  /🇧🇷\s*(?:dublado|dual|áudio|audio)/i,
  /🇧🇷.*?(?:dublado|dual|áudio|audio)/i,
  /🌎\s*(?:portugu[eê]s|pt[-_]?br)/i
];

const DUBBED_PTBR_PATTERNS = [
  ...EXPLICIT_DUBBED_PATTERNS
];

const PTBR_AUDIO_INDICATORS = [
  /\b(audio|áudio)\s*[:=-]?\s*(?:pt[-_]?br|portugu[eê]s|nacional|brasil|brasileiro)\b/i,
  /\b(?:pt[-_]?br|portugu[eê]s)\s*[:=-]?\s*(?:audio|áudio)\b/i,
  /\b(dublagem\s*brasileira|brazuca|nacional)\b/i,
  /🌎\s*(?:portugu[eê]s|pt[-_]?br)/i,
  /\[(?:por|pob)\]\s*(?:audio|áudio)/i
];

const SUBTITLED_ONLY_PATTERNS = [
  /\b(legendado|legendada|leg\b|subs?|softsubs?|hardsubs?|hardcoded|legenda[-_]?fixa|legenda[-_]?embutida|legenda[-_]?gravada)\b/i,
  /\[leg\]/i,
  /\[legendado\]/i,
  /\[hardsub\]/i,
  /\[hardsub[-_]?pt[-_]?br\]/i,
  /\bapenas\s*legendado\b/i,
  /🇯🇵\s*legendado/i,
  /🇰🇷\s*legendado/i
];

const FOREIGN_LANGUAGE_PATTERNS = [
  { regex: /\b(jap|ja\b|jpn|japanese|japon[eê]s)\b/i, lang: 'ja' as const },
  { regex: /\b(kor|ko\b|korean|coreano|kdrama|k[-_]?drama)\b/i, lang: 'ko' as const },
  { regex: /\b(eng|en\b|english|ingl[eê]s)\b/i, lang: 'en' as const },
  { regex: /\b(esp|es\b|spa|spanish|espanhol|castellano|latino)\b/i, lang: 'es' as const },
  { regex: /\b(pt[-_]?pt|portugu[eê]s[-_]?pt|lusitano)\b/i, lang: 'pt-PT' as const },
  { regex: /\b(fre|fr\b|french|franc[eê]s)\b/i, lang: 'fr' as const },
  { regex: /\b(ger|de\b|deu|german|alem[aã]o)\b/i, lang: 'de' as const },
  { regex: /\b(ita|it\b|italian|italiano)\b/i, lang: 'it' as const }
];

export class AudioPreferenceService {
  /**
   * Avalia com precisão o idioma do áudio do stream.
   * Identifica se é dublado PT-BR, dual áudio, áudio original ou outro idioma.
   */
  public analyzeAudio(stream: StremioStream): AudioAnalysisResult {
    const combinedText = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();

    // 1. Português de Portugal (pt-PT) nunca é dublagem brasileira
    const isPtPt = /\b(pt[-_]?pt|portugu[eê]s[-_]?pt|lusitano)\b/i.test(combinedText);
    const hasPtBrExplicit = /\b(pt[-_]?br|dublagem\s*brasileira|brazuca)\b/i.test(combinedText) || /🇧🇷/.test(combinedText);
    if (isPtPt && !hasPtBrExplicit) {
      return {
        tier: 'foreign',
        isPtBr: false,
        isDubbed: false,
        isDualAudio: false,
        language: 'pt-PT',
        confidence: 0.95,
        reason: 'Áudio em português de Portugal (pt-PT)'
      };
    }

    // 2. Dublagem / áudio estrangeiro explícito (Latino, Espanhol, Inglês, Japonês)
    const hasExplicitBrazilianAudio = PTBR_AUDIO_INDICATORS.some(p => p.test(combinedText)) ||
      /\b(?:dublado\s*pt[-_]?br|áudio\s*dublado\s*pt[-_]?br)\b/i.test(combinedText);

    for (const fed of EXPLICIT_FOREIGN_DUB_PATTERNS) {
      if (fed.regex.test(combinedText) && !hasExplicitBrazilianAudio) {
        return {
          tier: 'foreign',
          isPtBr: false,
          isDubbed: false,
          isDualAudio: false,
          language: fed.lang,
          confidence: 0.95,
          reason: `Áudio ${fed.name} indicado explicitamente pela fonte`
        };
      }
    }

    // 3. Separação categórica entre áudio e legenda:
    // Se a fonte contiver palavras explícitas de legenda/hardsub e não possuir marcadores expressos de áudio dublado PT-BR:
    const hasSubtitledOnlyPattern = SUBTITLED_ONLY_PATTERNS.some(p => p.test(combinedText));
    const isExplicitlySubtitledOnly = hasSubtitledOnlyPattern && !hasExplicitBrazilianAudio;

    if (isExplicitlySubtitledOnly) {
      // Verificar se há menção ao idioma original (japonês, coreano, inglês, espanhol, etc.)
      for (const foreign of FOREIGN_LANGUAGE_PATTERNS) {
        if (foreign.regex.test(combinedText)) {
          return {
            tier: 'original',
            isPtBr: false,
            isDubbed: false,
            isDualAudio: false,
            language: foreign.lang,
            confidence: 0.9,
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
        confidence: 0.85,
        reason: 'Áudio original com legenda PT-BR'
      };
    }

    // 4. Avaliação de Dual Audio
    // "Dual Audio" sozinho não comprova PT-BR (ex: Dual ENG/JAP ou Dual Latino)
    const isDualAudioMarker = DUAL_PATTERNS.some(p => p.test(combinedText));
    if (isDualAudioMarker) {
      const hasDualPtBr = DUAL_PT_PATTERNS.some(p => p.test(combinedText)) ||
        (hasExplicitBrazilianAudio && !isExplicitlySubtitledOnly);

      if (hasDualPtBr) {
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

      // Dual Audio sem português comprovado: verificar se declara idiomas estrangeiros
      for (const foreign of FOREIGN_LANGUAGE_PATTERNS) {
        if (foreign.regex.test(combinedText)) {
          return {
            tier: 'foreign',
            isPtBr: false,
            isDubbed: false,
            isDualAudio: true,
            language: foreign.lang,
            confidence: 0.8,
            reason: `Dual áudio com idioma estrangeiro (${foreign.lang}) sem comprovação de faixa PT-BR`
          };
        }
      }

      return {
        tier: 'original',
        isPtBr: false,
        isDubbed: false,
        isDualAudio: true,
        language: 'unknown',
        confidence: 0.5,
        reason: 'Dual áudio sem confirmação de faixa PT-BR'
      };
    }

    // 5. Avaliação: DUBLADO PT-BR DEDICADO / ÁUDIO PT-BR
    const hasExplicitDubbed = EXPLICIT_DUBBED_PATTERNS.some(p => p.test(combinedText));
    if (hasExplicitDubbed && !isExplicitlySubtitledOnly) {
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

    // Metadados explícitos da fonte confiáveis (apenas na ausência de contradições de legenda ou idioma)
    if (!combinedText.trim() && (stream.isDubbed === true || stream.isPtBr === true)) {
      return {
        tier: 'dubbed_ptbr',
        isPtBr: true,
        isDubbed: true,
        isDualAudio: false,
        language: 'pt-BR',
        confidence: 0.9,
        reason: 'Metadado explícito da fonte indica áudio PT-BR'
      };
    }

    // 6. Verificar se é idioma estrangeiro declarado
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

    // 7. Formato desconhecido / neutro (sem falsas promessas)
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
