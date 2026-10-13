import { TextDecoder } from 'util';

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
  if (!text.includes('&')) return text;
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
  // Minúsculas PT / ES / FR
  [/Ã¡/g, 'á'], [/Ã©/g, 'é'], [/Ã­/g, 'í'], [/Ã³/g, 'ó'], [/Ãº/g, 'ú'],
  [/Ã£/g, 'ã'], [/Ãµ/g, 'õ'], [/Ã¢/g, 'â'], [/Ãª/g, 'ê'], [/Ã®/g, 'î'],
  [/Ã´/g, 'ô'], [/Ã»/g, 'û'], [/Ã§/g, 'ç'], [/Ã /g, 'à'], [/Ã¨/g, 'è'],
  [/Ã±/g, 'ñ'], [/Ã¤/g, 'ä'], [/Ã¶/g, 'ö'], [/Ã¼/g, 'ü'],
  // Maiúsculas
  [/Ã /g, 'Á'], [/Ã‰/g, 'É'], [/Ã /g, 'Í'], [/Ã“/g, 'Ó'], [/Ãš/g, 'Ú'],
  [/Ãƒ/g, 'Ã'], [/Ã•/g, 'Õ'], [/Ã‚/g, 'Â'], [/ÃŠ/g, 'Ê'], [/ÃŽ/g, 'Î'],
  [/Ã”/g, 'Ô'], [/Ã›/g, 'Û'], [/Ã‡/g, 'Ç'], [/Ã€/g, 'À'], [/Ãˆ/g, 'È'],
  [/Ã‘/g, 'Ñ'], [/Ã„/g, 'Ä'], [/Ã–/g, 'Ö'], [/Ãœ/g, 'Ü'],
  // Símbolos / Pontuação
  [/â€¦/g, '…'], [/â€œ/g, '“'], [/â€“/g, '–'], [/â€”/g, '—'],
  [/â€˜/g, '‘'], [/â€™/g, '’'], [/â€ /g, '”'], [/â€/g, '”'],
  [/Â¿/g, '¿'], [/Â¡/g, '¡'], [/Âº/g, 'º'], [/Âª/g, 'ª'], [/Â«/g, '«'], [/Â»/g, '»']
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

// Complete test cases
const testCases = [
  { input: 's vocÃª Ã© pa', expected: 's você é pa' },
  { input: ', Ã©...?', expected: ', é...?' },
  { input: ', Ã© i...', expected: ', é i...' },
  { input: 'NÃ£o estÃ¡ lÃ¡, coraÃ§Ã£o!', expected: 'Não está lá, coração!' },
  { input: 'ATENÃ‡ÃƒO: VOCÃŠ NÃƒO SABE!', expected: 'ATENÇÃO: VOCÊ NÃO SABE!' },
  { input: 'Â¿CÃ³mo estÃ¡s, seÃ±or?', expected: '¿Cómo estás, señor?' },
  { input: 'OÃ¹ Ãªtes-vous?', expected: 'Où êtes-vous?' },
  { input: 'Ãœber die BrÃ¼cke', expected: 'Über die Brücke' },
  { input: 'â€œOlÃ¡â€¦â€ â€“ disse ele.', expected: '“Olá…” – disse ele.' },
  { input: 'voc&ecirc; &eacute; n&atilde;o', expected: 'você é não' }
];

console.log('Running subtitle decoding test cases:');
let passed = 0;
for (const tc of testCases) {
  const result = fixMojibake(tc.input);
  if (result === tc.expected) {
    console.log(`✅ PASS: "${tc.input}" -> "${result}"`);
    passed++;
  } else {
    console.error(`❌ FAIL: "${tc.input}"\n   Expected: "${tc.expected}"\n   Got:      "${result}"`);
  }
}

if (passed === testCases.length) {
  console.log(`\n🎉 ALL ${passed} SUBTITLE TEST CASES PASSED PERFECTLY!`);
} else {
  process.exit(1);
}
