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

import { canonicalCatalogMaster } from './CanonicalCatalogMaster';
import { ContentType } from '../../../types';

/**
 * Extrai o conjunto completo de chaves canônicas de um item de catálogo
 * (IMDb ID, TMDb ID, AniList ID, Canonical ID mestre, ID local, título normalizado + ano + categoria).
 */
export function getCanonicalKeysForItem(item: ContentItem): string[] {
  if (!item) return [];
  const keys = new Set<string>();

  // 1. Chave Canônica Unificada via CanonicalCatalogMaster
  if (item.canonicalId) {
    keys.add(`canonical:${item.canonicalId.trim().toLowerCase()}`);
  }
  try {
    const resolved = canonicalCatalogMaster.resolveCanonicalId(item);
    if (resolved) {
      keys.add(`canonical:${resolved.trim().toLowerCase()}`);
    }
  } catch {}

  // 2. Chave IMDb primária (padrão ouro)
  if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
    keys.add(`imdb:${item.imdbId.trim().toLowerCase()}`);
  } else if (item.imdbId && /^\d{6,10}$/.test(item.imdbId.trim())) {
    keys.add(`imdb:tt${item.imdbId.trim()}`);
  }
  if (item.id && /^tt\d+$/i.test(item.id.trim())) {
    keys.add(`imdb:${item.id.trim().toLowerCase()}`);
  }
  const imdbInIdMatch = String(item.id || '').match(/^(?:movie|series|anime)[-_](?:tt)?(\d{6,10})$/i);
  if (imdbInIdMatch) {
    keys.add(`imdb:tt${imdbInIdMatch[1]}`);
  }

  // 3. Determinação Canônica e Precisa do Tipo de Mídia
  const isMovie = (
    item.type === ContentType.MOVIE ||
    (item.type as any) === 'movie' ||
    (item.type as any) === 'FILME' ||
    item.mediaFormat === 'movie'
  );
  const isSeries = (
    item.type === ContentType.SERIES ||
    (item.type as any) === 'series' ||
    (item.type as any) === 'tv' ||
    (item.type as any) === 'SÉRIE' ||
    item.mediaFormat === 'series'
  );
  const isAnime = (
    item.type === ContentType.ANIME ||
    (item.type as any) === 'anime' ||
    (item.type as any) === 'ANIME' ||
    Boolean(item.aniListId) ||
    Boolean(item.malId) ||
    item.genres?.some(g => g.toLowerCase() === 'anime')
  );

  const cat = isAnime ? 'anime' : (isMovie ? 'movie' : 'series');
  const tmdbMediaType = isMovie ? 'movie' : 'tv';

  // 4. Chave TMDb qualificada por tipo de mídia
  if (item.tmdbId) {
    keys.add(`tmdb:${tmdbMediaType}:${String(item.tmdbId).trim().toLowerCase()}`);
  }
  const tmdbMatch = String(item.id || '').match(/^tmdb-(?:movie-|tv-|anime-)?(\d+)/i);
  if (tmdbMatch) {
    keys.add(`tmdb:${tmdbMediaType}:${tmdbMatch[1]}`);
  }

  // 5. Chaves de Anime (AniList e MyAnimeList)
  if (item.aniListId) {
    keys.add(`anilist:${item.aniListId}`);
  }
  const aniMatch = String(item.id || '').match(/^anilist-(\d+)/i);
  if (aniMatch) {
    keys.add(`anilist:${aniMatch[1]}`);
  }
  if (item.malId) {
    keys.add(`mal:${item.malId}`);
  }

  // 6. Chave de ID local explícito
  if (item.id) {
    keys.add(`id:${tmdbMediaType}:${item.id.trim().toLowerCase()}`);
  }

  // 7. Chaves Fonéticas e Semânticas por Título + Ano + Categoria
  const year = Number(item.year) || 0;
  const titlesToProcess = [item.title, item.originalTitle].filter(Boolean) as string[];

  for (const rawTitle of titlesToProcess) {
    const norm = normalizeCatalogText(rawTitle);
    if (!norm) continue;

    if (year > 0) {
      keys.add(`title:${cat}:${norm}:${year}`);
      // Tolerância de ±1 ano para datas de estreia de festivais vs lançamento comercial
      keys.add(`title_bucket:${cat}:${norm}:${year}`);
      keys.add(`title_bucket:${cat}:${norm}:${year - 1}`);
    } else {
      keys.add(`title_only:${cat}:${norm}`);
    }

    // Se o título contiver subtítulo (separado por ':', '-', '–', '|'), indexa também o título principal
    const parts = rawTitle.split(/[:–—|-]/);
    if (parts.length > 1) {
      const primaryPart = parts[0].trim();
      const normPrimary = normalizeCatalogText(primaryPart);
      if (normPrimary && normPrimary.length >= 4 && normPrimary !== norm) {
        if (year > 0) {
          keys.add(`title:${cat}:${normPrimary}:${year}`);
          keys.add(`title_bucket:${cat}:${normPrimary}:${year}`);
          keys.add(`title_bucket:${cat}:${normPrimary}:${year - 1}`);
        }
      }
    }
  }

  return Array.from(keys);
}

/**
 * Deduplica estritamente uma lista de conteúdos em sua origem.
 * Garante que nenhuma mídia seja representada mais de uma vez no catálogo,
 * mesmo se originada de fontes ou chamadas diferentes (Cinemeta, TMDB, local, Firestore).
 * Enriquece o item existente com novos metadados recebidos.
 */
export function deduplicateContentItems(items: ContentItem[]): ContentItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const result: ContentItem[] = [];
  const seenCanonicalKeys = new Set<string>();
  const itemByIndex = new Map<string, ContentItem>();

  for (const item of items) {
    if (!item || (!item.id && !item.title)) continue;

    const keys = getCanonicalKeysForItem(item);
    
    // Procura se alguma chave já foi vista
    let matchedItem: ContentItem | undefined;
    for (const key of keys) {
      if (itemByIndex.has(key)) {
        matchedItem = itemByIndex.get(key);
        break;
      }
    }

    if (matchedItem) {
      // Reconcilia e enriquece o item já existente
      if (!matchedItem.imdbId && item.imdbId) matchedItem.imdbId = item.imdbId;
      if (!matchedItem.tmdbId && item.tmdbId) matchedItem.tmdbId = item.tmdbId;
      if (!matchedItem.aniListId && item.aniListId) matchedItem.aniListId = item.aniListId;
      if (!matchedItem.malId && item.malId) matchedItem.malId = item.malId;
      if (!matchedItem.canonicalId && item.canonicalId) matchedItem.canonicalId = item.canonicalId;
      if (!matchedItem.backdrop && item.backdrop) matchedItem.backdrop = item.backdrop;
      if (!matchedItem.image && item.image) matchedItem.image = item.image;
      if (!matchedItem.genres || matchedItem.genres.length === 0) {
        if (item.genres) matchedItem.genres = item.genres;
      } else if (item.genres && Array.isArray(item.genres)) {
        const merged = new Set(matchedItem.genres);
        for (const g of item.genres) {
          if (g && typeof g === 'string') merged.add(g);
        }
        matchedItem.genres = Array.from(merged);
      }
      if (!matchedItem.overview && item.overview) matchedItem.overview = item.overview;
      if (!matchedItem.description && item.description) matchedItem.description = item.description;
      if ((!matchedItem.episodes || matchedItem.episodes.length === 0) && item.episodes) matchedItem.episodes = item.episodes;
      
      // Indexa as novas chaves deste item no mapa para que futuros matches também o encontrem
      for (const key of keys) {
        seenCanonicalKeys.add(key);
        itemByIndex.set(key, matchedItem);
      }
      continue;
    }

    // Registra todas as chaves associadas a este item
    for (const key of keys) {
      seenCanonicalKeys.add(key);
      itemByIndex.set(key, item);
    }
    result.push(item);
  }

  return result;
}
