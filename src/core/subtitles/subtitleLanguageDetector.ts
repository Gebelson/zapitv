/**
 * ZapiTV Subtitle Language Detector & Content Validator
 * 
 * Analisa rigorosamente o conteúdo textual real de arquivos SRT/WebVTT para:
 * 1. Identificar o idioma predominante com base em vocabulário e stopwords.
 * 2. Impedir que arquivos em inglês (ou outros idiomas) sejam rotulados falsamente como Português (Brasil).
 * 3. Validar se uma tradução automática realmente gerou texto em português brasileiro.
 */

export interface LanguageDetectionResult {
  detectedLang: string; // 'pt-BR' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'ja' | 'und'
  confidence: number;   // 0.0 a 1.0
  isPortuguese: boolean;
  isEnglish: boolean;
  sampleCount: number;
  wordCount: number;
  details: string;
}

export interface SubtitleValidationResult {
  isValid: boolean;
  detectedLang: string;
  confidence: number;
  reason: string;
  isConsistent: boolean;
}

// Stop words altamente representativas do Português
const PT_STOPWORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'nao',
  'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi',
  'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'quando', 'muito', 'nos',
  'já', 'ja', 'eu', 'também', 'tambem', 'só', 'so', 'pelo', 'pela', 'até', 'ate',
  'isso', 'ela', 'entre', 'depois', 'sem', 'mesmo', 'aos', 'seus', 'quem', 'nas',
  'me', 'esse', 'eles', 'você', 'voce', 'vocês', 'voces', 'está', 'esta', 'estava',
  'aqui', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha',
  'numa', 'pelos', 'elas', 'qual', 'nós', 'nos', 'lhe', 'deles', 'essas', 'esses',
  'pelas', 'este', 'dele', 'tu', 'te', 'vocês', 'onde', 'porque', 'porquê', 'estou',
  'estão', 'estao', 'fazer', 'vamos', 'agora', 'nada', 'coisa', 'tudo', 'senhor',
  'senhora', 'obrigado', 'obrigada', 'gente', 'tempo', 'vida', 'falar', 'olha',
  'cara', 'beleza', 'legal', 'então', 'entao', 'talvez', 'assim'
]);

// Stop words altamente representativas do Inglês
const EN_STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for',
  'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by',
  'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
  'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about',
  'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
  'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
  'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our',
  'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'nature', 'fire', 'water', 'light', 'darkness',
  'corresponding', 'something', 'nothing', 'someone', 'please', 'thank', 'where',
  'should', 'why', 'right', 'down', 'again', 'never', 'always', 'great', 'here'
]);

// Stop words do Espanhol
const ES_STOPWORDS = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por',
  'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'mas',
  'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'si', 'porque', 'esta', 'son',
  'entre', 'está', 'esta', 'cuando', 'muy', 'sin', 'sobre', 'también', 'tambien',
  'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante',
  'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'había', 'habia',
  'hola', 'gracias', 'vamos', 'amigo', 'bueno', 'señor', 'señora'
]);

// Stop words do Francês
const FR_STOPWORDS = new Set([
  'de', 'la', 'le', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est',
  'pour', 'qui', 'dans', 'a', 'par', 'plus', 'pas', 'au', 'sur', 'ne', 'se',
  'ce', 'il', 'sont', 'avec', 'tout', 'faire', 'son', 'mais', 'nous', 'sa',
  'comme', 'ou', 'si', 'leur', 'y', 'dire', 'elle', 'doit', 'ci', 'sans', 'bonjour'
]);

/**
 * Remove formatações, tags ASS/HTML, pontuação e divide em palavras limpas.
 */
export function extractCleanWords(text: string): string[] {
  if (!text) return [];

  // Remove timestamps SRT / VTT (00:01:23,456 --> 00:01:26,789)
  const noTimestamps = text.replace(/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/g, ' ');

  // Remove tags HTML/XML (<font>, <i>, <b>, <c>, etc.)
  const noTags = noTimestamps.replace(/<[^>]+>/g, ' ');

  // Remove formatação ASS/SSA ({\an8}, {\pos(x,y)}, etc.)
  const noAssTags = noTags.replace(/\{[^}]+\}/g, ' ');

  // Extrai palavras puras (somente caracteres alfabéticos acentuados e letras)
  const matches = noAssTags.toLowerCase().match(/[\p{L}']+/gu);
  if (!matches) return [];

  return matches
    .map(w => w.replace(/^'+|'+$/g, ''))
    .filter(w => w.length >= 2);
}

/**
 * Analisa uma amostra representativa de falas e determina o idioma do texto com score de confiança.
 */
export function detectSubtitleLanguage(
  sample: string | Array<{ text: string }>
): LanguageDetectionResult {
  let combinedText = '';

  if (Array.isArray(sample)) {
    // Amostra representativa: início, meio e fim
    const total = sample.length;
    if (total === 0) {
      return {
        detectedLang: 'und',
        confidence: 0,
        isPortuguese: false,
        isEnglish: false,
        sampleCount: 0,
        wordCount: 0,
        details: 'Nenhuma fala disponível para análise'
      };
    }

    const indices: number[] = [];
    const step = Math.max(1, Math.floor(total / 30));
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    // Garante que os primeiros e últimos sejam incluídos
    if (!indices.includes(0)) indices.unshift(0);
    if (!indices.includes(total - 1)) indices.push(total - 1);

    combinedText = indices.map(idx => sample[idx]?.text || '').join(' ');
  } else {
    combinedText = sample || '';
  }

  const words = extractCleanWords(combinedText);
  if (words.length < 5) {
    return {
      detectedLang: 'und',
      confidence: 0,
      isPortuguese: false,
      isEnglish: false,
      sampleCount: Array.isArray(sample) ? sample.length : 1,
      wordCount: words.length,
      details: 'Amostra insuficiente de palavras'
    };
  }

  let ptHits = 0;
  let enHits = 0;
  let esHits = 0;
  let frHits = 0;

  for (const word of words) {
    if (PT_STOPWORDS.has(word)) ptHits++;
    if (EN_STOPWORDS.has(word)) enHits++;
    if (ES_STOPWORDS.has(word)) esHits++;
    if (FR_STOPWORDS.has(word)) frHits++;
  }

  // Bônus especial para caracteres estritamente típicos do Português: ã, õ, ç
  const ptCharMatches = combinedText.match(/[ãõçÃÕÇ]/g);
  if (ptCharMatches) {
    ptHits += Math.min(ptCharMatches.length * 2, 25);
  }

  // Bônus especial para contrações típicas do Inglês: 'll, 've, 're, 'd, don't, won't, can't
  const enContractions = combinedText.match(/\b(don't|can't|won't|it's|i'm|you're|they're|didn't|doesn't|wouldn't|couldn't)\b/gi);
  if (enContractions) {
    enHits += Math.min(enContractions.length * 2, 25);
  }

  const totalHits = ptHits + enHits + esHits + frHits;
  if (totalHits === 0) {
    return {
      detectedLang: 'und',
      confidence: 0,
      isPortuguese: false,
      isEnglish: false,
      sampleCount: Array.isArray(sample) ? sample.length : 1,
      wordCount: words.length,
      details: 'Nenhuma correspondência linguística identificada'
    };
  }

  const ptScore = ptHits / totalHits;
  const enScore = enHits / totalHits;
  const esScore = esHits / totalHits;
  const frScore = frHits / totalHits;

  let detectedLang = 'und';
  let maxScore = 0;

  if (ptScore > maxScore) { maxScore = ptScore; detectedLang = 'pt-BR'; }
  if (enScore > maxScore) { maxScore = enScore; detectedLang = 'en'; }
  if (esScore > maxScore) { maxScore = esScore; detectedLang = 'es'; }
  if (frScore > maxScore) { maxScore = frScore; detectedLang = 'fr'; }

  // Nível de confiança proporcional à clareza da diferença entre o primeiro e segundo colocado
  const sortedScores = [ptScore, enScore, esScore, frScore].sort((a, b) => b - a);
  const margin = sortedScores[0] - (sortedScores[1] || 0);
  const confidence = Math.min(1.0, Math.max(0.2, sortedScores[0] * 0.7 + margin * 0.3));

  const isPortuguese = detectedLang === 'pt-BR' && ptScore >= 0.45;
  const isEnglish = detectedLang === 'en' && enScore >= 0.45;

  return {
    detectedLang,
    confidence: Number(confidence.toFixed(2)),
    isPortuguese,
    isEnglish,
    sampleCount: Array.isArray(sample) ? sample.length : 1,
    wordCount: words.length,
    details: `PT: ${(ptScore * 100).toFixed(0)}% (hits: ${ptHits}), EN: ${(enScore * 100).toFixed(0)}% (hits: ${enHits}), ES: ${(esScore * 100).toFixed(0)}% (hits: ${esHits})`
  };
}

/**
 * Valida se o conteúdo de uma legenda corresponde ao idioma esperado.
 * 
 * Regra de Ouro do ZapiTV:
 * Se o usuário solicitou Português (Brasil) e o conteúdo for predominantemente Inglês,
 * a validação FALHA rigorosamente para evitar a exibição de legendas enganosas.
 */
export function validateSubtitleContentMatch(
  contentOrCues: string | Array<{ text: string }>,
  expectedLanguageCode: string
): SubtitleValidationResult {
  const normExpected = (expectedLanguageCode || '').toLowerCase().trim();
  const isExpectingPtBr = /^(pob|pt-br|bra|por-br|pt|por)$/i.test(normExpected);
  const isExpectingEn = /^(eng|en)$/i.test(normExpected);

  const detection = detectSubtitleLanguage(contentOrCues);

  // Amostra muito curta para inferir (menos de 5 palavras)
  if (detection.wordCount < 5 || detection.detectedLang === 'und') {
    // Não temos dados suficientes para invalidar, mantém aceito porém com confiança baixa
    return {
      isValid: true,
      detectedLang: detection.detectedLang,
      confidence: detection.confidence,
      reason: 'Amostra de texto muito curta para validação estrita',
      isConsistent: true
    };
  }

  const expectedGroup = /^(pob|pt-br|bra|por-br|pt|por|pt-pt)$/i.test(normExpected) ? 'pt-BR'
    : /^(eng|en)$/i.test(normExpected) ? 'en'
    : /^(spa|es)$/i.test(normExpected) ? 'es'
    : /^(fre|fra|fr)$/i.test(normExpected) ? 'fr' : null;
  if (expectedGroup && detection.confidence >= 0.7 && detection.detectedLang !== expectedGroup) {
    return {
      isValid: false,
      detectedLang: detection.detectedLang,
      confidence: detection.confidence,
      reason: `Idioma detectado (${detection.detectedLang}) difere da legenda selecionada (${expectedLanguageCode})`,
      isConsistent: false
    };
  }

  // Caso 1: Esperava Português (Brasil), mas o texto é comprovadamente em Inglês
  if (isExpectingPtBr) {
    if (detection.isEnglish && !detection.isPortuguese && detection.confidence >= 0.4) {
      return {
        isValid: false,
        detectedLang: detection.detectedLang,
        confidence: detection.confidence,
        reason: `Inconsistência crítica: Texto é Inglês (${detection.details}), incompatível com Português (Brasil)`,
        isConsistent: false
      };
    }

    if (detection.detectedLang === 'es' && detection.confidence >= 0.7) {
      return {
        isValid: false,
        detectedLang: 'es',
        confidence: detection.confidence,
        reason: `Inconsistência: Texto é Espanhol (${detection.details}) e não Português`,
        isConsistent: false
      };
    }

    return {
      isValid: true,
      detectedLang: detection.detectedLang,
      confidence: detection.confidence,
      reason: detection.isPortuguese ? 'Texto validado como Português (Brasil)' : 'Compatível',
      isConsistent: true
    };
  }

  // Caso 2: Esperava Inglês, mas o texto é comprovadamente Português
  if (isExpectingEn) {
    if (detection.isPortuguese && !detection.isEnglish && detection.confidence >= 0.5) {
      return {
        isValid: false,
        detectedLang: detection.detectedLang,
        confidence: detection.confidence,
        reason: `Inconsistência: Texto é Português (${detection.details}), incompatível com Inglês`,
        isConsistent: false
      };
    }
    return {
      isValid: true,
      detectedLang: detection.detectedLang,
      confidence: detection.confidence,
      reason: 'Compatível com Inglês',
      isConsistent: true
    };
  }

  // Outros idiomas
  return {
    isValid: true,
    detectedLang: detection.detectedLang,
    confidence: detection.confidence,
    reason: 'Validação neutra para idioma secundário',
    isConsistent: true
  };
}
