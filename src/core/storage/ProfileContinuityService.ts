import { ContentItem, ContentType } from '../../../types';
import { contentKey, sameContent, selectContinuityHistory, type WatchProgress } from './watchState';
import { contentPoster, hasContentTitle, mergeContinuityMetadata } from './continuityMetadata';

export interface ContinuitySnapshot { progress: WatchProgress[]; continueWatching: ContentItem[]; history: ContentItem[]; myList: ContentItem[]; favorites: ContentItem[] }
export const emptyContinuity = (): ContinuitySnapshot => ({ progress: [], continueWatching: [], history: [], myList: [], favorites: [] });
type Loader = (item: ContentItem) => Promise<ContentItem | null>;

async function loadExactMetadata(item: ContentItem): Promise<ContentItem | null> {
  const { canonicalCatalogMaster } = await import('../catalog/CanonicalCatalogMaster');
  const known = canonicalCatalogMaster.getAllItemsSync().find(candidate=>sameContent(candidate,item) && hasContentTitle(candidate.title) && contentPoster(candidate));
  if (known) return known;
  const { tmdbService } = await import('../tmdb/tmdbClient');
  const tmdb = item.tmdbId || item.id.match(/^tmdb-(\d+)$/)?.[1] || item.canonicalId?.match(/:tmdb:(\d+)$/)?.[1];
  if (tmdb) {
    try { return (await tmdbService.getDetails(tmdb, item.type, item.mediaFormat)).item; }
    catch { if (!item.imdbId && !/tt\d+/.test(item.id)) throw new Error('EXACT_METADATA_UNAVAILABLE'); }
  }
  const imdb = item.imdbId || item.id.match(/^tt\d+$/)?.[0] || item.canonicalId?.match(/(tt\d+)$/)?.[1];
  if (imdb) {
    if (!item.mediaFormat && item.title === 'Carregando informações…') {
      const exact = await tmdbService.findByImdb(imdb);
      if (!exact) return null;
      return (await tmdbService.getDetails(exact.tmdbId, exact.type, exact.mediaFormat)).item;
    }
    return (await tmdbService.getDetailsByImdb(imdb, item.type, item.mediaFormat)).item;
  }
  const anilist = item.aniListId || Number(item.id.match(/^anilist[-:](\d+)$/)?.[1] || item.canonicalId?.match(/:anilist:(\d+)$/)?.[1]);
  if (anilist) return (await (await import('../anilist/aniListClient')).aniListClient.getAnimeById(anilist));
  return null;
}

/** Public metadata cache only. Private list membership and progress never enter this cache. */
export class ProfileContinuityService {
  private cache = new Map<string, { value: ContentItem | null; expires: number }>();
  private pending = new Map<string, Promise<ContentItem | null>>();
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly loader: Loader = loadExactMetadata) {}
  private async recover(item: ContentItem): Promise<ContentItem | null> {
    const key = contentKey(item), cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const inflight = this.pending.get(key); if (inflight) return inflight;
    const job = (async () => {
      if (this.active >= 3) await new Promise<void>(resolve => this.waiting.push(resolve));
      this.active++;
      let value: ContentItem | null = null;
      try {
        const candidate = await this.loader(item);
        // Exact external IDs plus media kind, never title similarity. Category remains the stored category.
        if (candidate && sameContent({ ...candidate, type: item.type }, item)) value = item.mediaFormat ? { ...candidate, type: item.type } : candidate;
      } catch { /* Negative TTL retries an unavailable metadata provider without deleting progress. */ }
      finally { this.active--; this.waiting.shift()?.(); }
      const complete = value && hasContentTitle(value.title) && contentPoster(value);
      this.cache.set(key, { value, expires: Date.now() + (complete ? 6 * 3600_000 : 60_000) });
      if (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value!);
      return value;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, job); return job;
  }
  public select(progress: WatchProgress[], catalog: ContentItem[], myList: string[] = [], favorites: string[] = [], metadata: ContentItem[] = []): ContinuitySnapshot {
    const records = selectContinuityHistory(progress, [...catalog, ...metadata]);
    const known = [...records.map(p => p.item), ...metadata, ...catalog];
    const list = (ids: string[]) => ids.map(id => {
      const matches = known.filter(item => [item.id, item.canonicalId, item.imdbId, item.tmdbId && `tmdb-${item.tmdbId}`].includes(id));
      if (matches.length && matches.every(item => sameContent(item, matches[0]))) return matches.reduce((a,b)=>mergeContinuityMetadata(a,b));
      // Legacy lists persist IDs without media kind. Do not guess a TV/movie identity for an ambiguous TMDB ID.
      const type = id.startsWith('anime:') || id.startsWith('anilist-') ? ContentType.ANIME : id.startsWith('series:') ? ContentType.SERIES : ContentType.MOVIE;
      return { id, canonicalId: id, title: 'Carregando informações…', type, image: '', year: 0, rating: 0, availabilityStatus: 'unavailable' } as ContentItem;
    });
    const unique = (items: ContentItem[]) => items.filter((item,index)=>!items.slice(0,index).some(previous=>sameContent(previous,item)));
    return { progress: records, continueWatching: records.filter(p=>p.currentTime > 5 && p.percentage < 95).map(p=>p.item),
      history: unique([...records.map(p=>p.item), ...metadata]), myList: unique(list(myList)), favorites: unique(list(favorites)) };
  }
  public async enrich(snapshot: ContinuitySnapshot, isCurrent: () => boolean = () => true, onUpdate?: (snapshot: ContinuitySnapshot) => void): Promise<ContinuitySnapshot> {
    const updated = new Map<string, ContentItem>();
    const apply = (): ContinuitySnapshot => {
      const map = (items: ContentItem[]) => items.map(item => updated.get(contentKey(item)) || item);
      return { progress: snapshot.progress.map(p=>({...p,item:updated.get(contentKey(p.item)) || p.item})),
        continueWatching: map(snapshot.continueWatching), history: map(snapshot.history), myList: map(snapshot.myList), favorites: map(snapshot.favorites) };
    };
    const seen = new Set<string>();
    await Promise.all([...snapshot.history, ...snapshot.myList, ...snapshot.favorites].map(async item => {
      const key = contentKey(item); if (seen.has(key)) return; seen.add(key);
      if (!isCurrent() || (hasContentTitle(item.title) && contentPoster(item))) return;
      // Untyped, legacy TMDB list entries cannot safely choose /movie or /tv.
      if (item.title === 'Carregando informações…' && /^tmdb-/.test(item.id)) return;
      const metadata = await this.recover(item); if (!isCurrent()) return;
      const merged = mergeContinuityMetadata(!item.mediaFormat && metadata ? { ...item, type: metadata.type, mediaFormat: metadata.mediaFormat, availabilityStatus: metadata.availabilityStatus } : item, metadata || undefined);
      if (!hasContentTitle(merged.title)) merged.title = 'Carregando informações…';
      updated.set(key, merged); onUpdate?.(apply());
    }));
    return apply();
  }
}
export const profileContinuityService = new ProfileContinuityService();
