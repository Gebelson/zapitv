import { useEffect, useState } from 'react';
import type { ContentItem } from '../../../types';
import { storageService } from './storageService';
import { emptyContinuity, profileContinuityService, type ContinuitySnapshot } from './ProfileContinuityService';
import { scopedKey } from './watchState';
import { hasContentTitle } from './continuityMetadata';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import { adultContentService } from '../adult/AdultContentService';

/** One event-driven selector for desktop/mobile/TV; no catalog request and no new polling. */
export function useProfileContinuity(catalog: ContentItem[], enabled = true) {
  const [state, setState] = useState(() => ({ scope: storageService.getScope(), snapshot: emptyContinuity(), loading: true }));
  useEffect(() => {
    if (!enabled) return;
    let mounted = true, request = 0;
    const refresh = async () => {
      const revision = ++request, scope = storageService.getScope();
      const current = () => mounted && revision === request && storageService.getScope() === scope;
      setState(previous => previous.scope === scope ? previous : { scope, snapshot: emptyContinuity(), loading: true });
      try {
        const [progress, myList, favorites, metadata] = await Promise.all([storageService.getContinueWatching(), storageService.getMyList(), storageService.getFavorites(), storageService.getContinuityMetadata()]);
        if (!current()) return;
        const safe = (items: ContentItem[]) => items.filter(item => !bannedContentRegistry.isBanned(item) && !adultContentService.isAdultContent(item)).map(item=>hasContentTitle(item.title) ? item : { ...item, title: 'Carregando informações…' });
        const publish = (snapshot: ContinuitySnapshot) => { if (current()) setState({ scope, loading: storageService.getContinuitySyncState() === 'loading', snapshot: { ...snapshot,
          continueWatching: safe(snapshot.continueWatching), history: safe(snapshot.history), myList: safe(snapshot.myList), favorites: safe(snapshot.favorites) } }); };
        const snapshot = profileContinuityService.select(progress, catalog, myList, favorites, metadata);
        publish(snapshot);
        await profileContinuityService.enrich(snapshot, current, publish);
      } catch (error) { if (current()) { console.warn('[Continuity] Local data could not be read'); setState(previous=>({...previous, loading:false})); } }
    };
    void refresh();
    const crossTab = (event: StorageEvent) => {
      const scope = storageService.getScope();
      if (event.key && ['zapitv_watch_state_v2','zapitv_local_mylist_v2','zapitv_local_favorites_v2','zapitv_continuity_metadata_v1'].some(key=>event.key===scopedKey(key,scope))) void refresh();
    };
    window.addEventListener('storage', crossTab);
    window.addEventListener('zapitv_progress_updated', refresh);
    return () => { mounted = false; request++; window.removeEventListener('storage', crossTab); window.removeEventListener('zapitv_progress_updated', refresh); };
  }, [catalog, enabled]);
  return state.scope === storageService.getScope() ? { ...state.snapshot, loading: state.loading, syncState: storageService.getContinuitySyncState() } : { ...emptyContinuity(), loading: true, syncState: 'loading' as const };
}
