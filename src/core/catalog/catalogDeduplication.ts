import { ContentItem } from '../../../types';

/**
 * Normaliza uma string de texto removendo acentos e caracteres especiais para comparação fonética/textual segura
 */
export function normalizeCatalogText(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Extrai o conjunto completo de chaves canônicas de um item de catálogo
 * (IMDb ID, TMDb ID, ID local, título normalizado + ano + tipo).
 */
export function getCanonicalKeysForItem(item: ContentItem): string[] {
  if (!item) return [];
  const keys = new Set<string>();

  // 1. Chave IMDb primária (padrão ouro)
  if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
    keys.add(`imdb:${item.imdbId.trim().toLowerCase()}`);
  }
  if (item.id && /^tt\d+$/i.test(item.id.trim())) {
    keys.add(`imdb:${item.id.trim().toLowerCase()}`);
  }

  // 2. Chave TMDb qualificada por tipo de mídia para evitar colisão entre filmes e séries com mesmo ID numérico
  const mediaType = (item.mediaFormat === 'movie' || item.type === 'movie') ? 'movie' : 'tv';
  if (item.tmdbId) {
    keys.add(`tmdb:${mediaType}:${String(item.tmdbId).trim().toLowerCase()}`);
  }
  if (item.id && item.id.startsWith('tmdb-')) {
    keys.add(`tmdb:${mediaType}:${item.id.replace(/^tmdb-(movie-|tv-|anime-)?/, '').toLowerCase()}`);
  }

  // 3. Chave de ID local explícito
  if (item.id) {
    keys.add(`id:${item.id.trim().toLowerCase()}`);
  }

  // 4. Chave fonética por Título + Tipo + Ano (para reconciliar metadados de fontes distintas)
  const normTitle = normalizeCatalogText(item.title);
  if (normTitle) {
    const rawType = String(item.type || 'unknown').toLowerCase();
    const year = Number(item.year) || 0;
    keys.add(`title:${rawType}:${normTitle}:${year}`);
    // Se o ano for 0 ou próximo, indexa também pelo título e tipo
    keys.add(`title_only:${rawType}:${normTitle}`);
  }

  if (item.originalTitle) {
    const normOrig = normalizeCatalogText(item.originalTitle);
    if (normOrig && normOrig !== normTitle) {
      const rawType = String(item.type || 'unknown').toLowerCase();
      const year = Number(item.year) || 0;
      keys.add(`title:${rawType}:${normOrig}:${year}`);
      keys.add(`title_only:${rawType}:${normOrig}`);
    }
  }

  return Array.from(keys);
}

/**
 * Deduplica estritamente uma lista de conteúdos em sua origem.
 * Garante que nenhuma mídia seja representada mais de uma vez no catálogo,
 * mesmo se originada de fontes ou chamadas diferentes (Cinemeta, TMDB, local, Firestore).
 */
export function deduplicateContentItems(items: ContentItem[]): ContentItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const result: ContentItem[] = [];
  const seenCanonicalKeys = new Set<string>();

  for (const item of items) {
    if (!item || (!item.id && !item.title)) continue;

    const keys = getCanonicalKeysForItem(item);
    
    // Verifica se qualquer uma das chaves canônicas já foi registrada
    const hasDuplicateKey = keys.some(key => seenCanonicalKeys.has(key));
    if (hasDuplicateKey) {
      continue;
    }

    // Registra todas as chaves associadas a este item
    for (const key of keys) {
      seenCanonicalKeys.add(key);
    }
    result.push(item);
  }

  return result;
}
