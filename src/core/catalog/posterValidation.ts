export const CORRUPTED_POSTER_FRAGMENTS = [
  'iigTJJskR1PcjjXqxdyJwVB3BoU', // Death Note poster associado indevidamente
  'z8IPicmEKXUO4I2UDdMEqw7RqOE', // Death Note backdrop associado indevidamente
  'bnTXjwOwdUz8MKFyQCNf0hG4fdL', // The Glory / A Lição poster associado indevidamente
  'AjwoDj77HLlqcpwEGqsnvMXm5my', // The Glory / A Lição backdrop associado indevidamente
  'dqZENchTd7lp5zht7BdlqM7RBPd', // Spider-Man poster associado indevidamente a Frieren
  '4HodYYKEIsGOdinkGi2Ucz6X9i0', // Spider-Man backdrop associado indevidamente a Frieren
  'bx114446',                   // Higurashi poster associado indevidamente a Bleach TYBW
  '114446-H6uxjVi8wBoo',        // Higurashi poster fragment associado indevidamente a Bleach
  '114446-DTd4xfGx7DJB',        // Higurashi banner fragment associado indevidamente a Bleach
  'photo-1489599849927-2ee91cede3ba', // Foto genérica de sala de cinema Unsplash
  'unsplash.com'                // Qualquer imagem de fallback genérico do Unsplash
];

export function isCorruptedPosterUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('unsplash.com') || url.includes('photo-1489599849927')) return true;
  return CORRUPTED_POSTER_FRAGMENTS.some(frag => url.includes(frag));
}

