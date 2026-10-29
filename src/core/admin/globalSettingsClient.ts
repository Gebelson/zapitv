import type { ContentItem } from '../../../types';

export interface HeroCarouselResponse {
  configured: boolean;
  items: ContentItem[] | null;
  version: number;
}

export async function fetchHeroCarousel(signal?: AbortSignal): Promise<HeroCarouselResponse> {
  const response = await fetch('/api/db/global-settings/hero-carousel', {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível sincronizar o carrossel.');
  return response.json();
}

export async function saveHeroCarousel(items: ContentItem[], expectedVersion: number): Promise<HeroCarouselResponse> {
  const { auth } = await import('../../../firebase');
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);

  const response = await fetch('/api/db/global-settings/hero-carousel', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
    body: JSON.stringify({ items, expectedVersion }),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Não foi possível salvar o carrossel.');
  return { configured: true, items: body.items, version: body.version };
}

export interface SectionTitlesResponse {
  configured: boolean;
  titles: Record<string, string> | null;
  version: number;
}

export async function fetchSectionTitles(signal?: AbortSignal): Promise<SectionTitlesResponse> {
  const response = await fetch('/api/db/global-settings/section-titles', {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível sincronizar os títulos das seções.');
  return response.json();
}

export async function saveSectionTitles(titles: Record<string, string>, expectedVersion: number): Promise<SectionTitlesResponse> {
  const { auth } = await import('../../../firebase');
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  const response = await fetch('/api/db/global-settings/section-titles', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
    body: JSON.stringify({ titles, expectedVersion }),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Não foi possível salvar os títulos das seções.');
  return { configured: true, titles: body.titles, version: body.version };
}
