const sample1 = 's vocÃª Ã© pa';
const sample2 = ', Ã©...?';
const sample3 = ', Ã© i...';

function fixMojibake(text: string): string {
  // If text contains mojibake indicators like Ã followed by typical Latin-1 byte chars
  if (!/[\xC0-\xC3][\x80-\xBF]|\u00C3[\u00A0-\u00BF]|\u00C2[\u00A0-\u00BF]/.test(text)) {
    return text;
  }
  try {
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 256) {
        bytes.push(code);
      } else {
        // Can't represent as single byte, fallback or keep
        const encoded = new TextEncoder().encode(text[i]);
        bytes.push(...encoded);
      }
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    return decoded;
  } catch {
    return text;
  }
}

console.log('Sample 1 fixed:', fixMojibake(sample1));
console.log('Sample 2 fixed:', fixMojibake(sample2));
console.log('Sample 3 fixed:', fixMojibake(sample3));
