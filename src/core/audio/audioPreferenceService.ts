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
  /\b(dual[-_]?audio|dual[-_]?áudio|multi[-_]?audio|multi[-_]?áudio)\b/i,
  /\[dual[-_]?audio\]/i,
  /\[dual\]/i,
  /\bdual\b(?!\s*[-_]?sub)/i,
  /\bdual\s*latino\b/i // latino can be foreign if not PT, handled below
];

const DUBBED_PTBR_PATTERNS = [
  /\b(dublado|dublada|dublados|audio\s*pt|áudio\s*pt|audio\s*pt[-_]?br|áudio\s*pt[-_]?br|brazuca|nacional)\b/i,
  /\[dublado\]/i,
  /\[dub\]/i,
  /\b(dub\b|\/dub\/)/i,
  /\b(fhd[-_]?dub|hd[-_]?dub|web[-_]?dl[-_]?dub)\b/i,
  /🇧🇷\s*dublado/i,
  /\b(comando|bludv|mico[-_]?le[aã]o|lapumia|rede[-_]?canais|redecanais|wolverdon)\b/i
];

const PTBR_GENERAL_PATTERNS = [
  /\b(pt[-_]?br|portugu[eê]s[-_]?br|portugu[eê]s)\b/i,
  /\[pt[-_]?br\]/i,
  /\b(pob|por)\b/i
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
    const providerName = (stream.providerName || '').toLowerCase();
    const providerId = (stream.providerId || '').toLowerCase();

    // 1. Verificar marcadores expressos de Dual Audio
    const isDualAudio = DUAL_PATTERNS.some(p => p.test(combinedText));

    // 2. Verificar se o stream é de provedor reconhecido de conteúdo dublado brasileiro
    const isVerifiedBrazilianProvider = 
      providerId === 'zapitv-verified' ||
      providerName.includes('zapitv verificado') ||
      providerName.includes('acervo zapitv') ||
      providerName.includes('cinema aberto') ||
      providerName.includes('mico-leão') ||
      providerName.includes('micoleao');

    // 3. Verificar marcadores de dublagem PT-BR
    const hasDubbedPattern = DUBBED_PTBR_PATTERNS.some(p => p.test(combinedText));
    const hasPtBrGeneral = PTBR_GENERAL_PATTERNS.some(p => p.test(combinedText));
    const isExplicitlySubtitledOnly = SUBTITLED_ONLY_PATTERNS.some(p => p.test(combinedText)) && 
                                     !hasDubbedPattern && 
                                     !isDualAudio;

    // Se o stream já vier com flags pré-definidas
    const declaredDubbed = Boolean(stream.isDubbed);
    const declaredPtBr = Boolean(stream.isPtBr);

    // Avaliação: DUAL AUDIO (contém PT-BR)
    if (isDualAudio && (hasPtBrGeneral || hasDubbedPattern || declaredPtBr || declaredDubbed || isVerifiedBrazilianProvider || !isExplicitlySubtitledOnly)) {
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

    // Avaliação: DUBLADO PT-BR DEDICADO
    if (
      declaredDubbed ||
      hasDubbedPattern ||
      isVerifiedBrazilianProvider ||
      (declaredPtBr && !isExplicitlySubtitledOnly) ||
      (hasPtBrGeneral && !isExplicitlySubtitledOnly)
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
