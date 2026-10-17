import type { StremioStream } from '../stremio/stremioTypes';
import { audioPreferenceService } from '../audio/audioPreferenceService';

export interface SourceMemoryIdentity {
  canonicalId: string;
  mediaType: 'movie' | 'series' | 'anime';
  season: number;
  episode: number;
}

export interface RememberedSource {
  providerId: string;
  sourceRef: string;
  score: number;
  audioLanguage: string | null;
  quality: string | null;
  trusted: boolean;
}

const clean = (value: string | undefined) => (value || '')
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/(?:token|key|auth|signature|expires)\s*[:=]\s*\S+/gi, '')
  .normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 110);

// Intentionally excludes URLs and provider tokens. Match only fresh results from the same provider.
export function sourceReference(stream: StremioStream): string {
  return [clean(stream.name), clean(stream.title), clean(stream.sourceType || ''), clean(stream.quality || '')].join('|');
}

const memoryCache = new Map<string, { expires: number; promise: Promise<RememberedSource[]> }>();

export function getRememberedSources(identity: SourceMemoryIdentity): Promise<RememberedSource[]> {
  const key = JSON.stringify(identity);
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const params = new URLSearchParams({
    canonicalId: identity.canonicalId,
    mediaType: identity.mediaType,
    season: String(identity.season),
    episode: String(identity.episode),
  });
  const promise = fetch(`/api/db/source-memory?${params}`, { signal: AbortSignal.timeout(1200) })
    .then(async response => response.ok ? (await response.json()).sources as RememberedSource[] : [])
    .catch(() => [] as RememberedSource[]);
  memoryCache.set(key, { expires: Date.now() + 30_000, promise });
  return promise;
}

export function prioritizeRememberedSources(streams: StremioStream[], remembered: RememberedSource[]): StremioStream[] {
  if (remembered.length === 0 || streams.length < 2) return streams;
  const scores = new Map(remembered.map(row => [
    `${row.providerId}|${row.sourceRef}`,
    row.score * (row.trusted ? 1 : 0.2),
  ]));
  return streams.map((stream, index) => ({ stream, index })).sort((a, b) => {
    // Preserve the existing audio and subtitle tiers; collective history only breaks ties.
    const aTier = (a.stream as any)._smartPriority || ({ dubbed_ptbr: 1, dual_audio: 2, original: 3, foreign: 6 }[audioPreferenceService.analyzeAudio(a.stream).tier]);
    const bTier = (b.stream as any)._smartPriority || ({ dubbed_ptbr: 1, dual_audio: 2, original: 3, foreign: 6 }[audioPreferenceService.analyzeAudio(b.stream).tier]);
    if (aTier !== bTier) return aTier - bTier;
    const aScore = scores.get(`${a.stream.providerId}|${sourceReference(a.stream)}`) || 0;
    const bScore = scores.get(`${b.stream.providerId}|${sourceReference(b.stream)}`) || 0;
    return bScore - aScore || a.index - b.index;
  }).map(entry => entry.stream);
}

export async function startSourceEvidence(identity: SourceMemoryIdentity, stream: StremioStream): Promise<string | null> {
  if (!stream.providerId || !stream.url || stream.isTorrent) return null;
  try {
    const response = await fetch('/api/db/source-memory/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...identity, providerId: stream.providerId, sourceRef: sourceReference(stream), format: stream.sourceType || 'mp4' }),
      signal: AbortSignal.timeout(1800),
    });
    if (!response.ok) return null;
    return (await response.json()).ticket || null;
  } catch { return null; }
}

export function reportSourceEvidence(ticket: string, outcome: 'success' | 'startup_failure' | 'playback_failure', detail?: {
  startupMs?: number; audioLanguage?: string; quality?: string;
}): void {
  fetch('/api/db/source-memory/evidence', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, outcome, ...detail }),
    keepalive: true,
    signal: AbortSignal.timeout(1800),
  }).catch(() => {});
}
