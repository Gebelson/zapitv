import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { searchService } from '../src/core/search/searchService';
import { adultContentService } from '../src/core/adult/AdultContentService';
import { ContentType, type ContentItem } from '../types';
import { CatalogPaginationSession } from '../src/core/catalog/catalogPaginationSession';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { resolveContinueWatchingItems } from '../src/core/storage/watchState';

// Execute the actual production hook callbacks, without duplicating their pipelines.
function callback(path: string, name: string, context: Record<string, unknown>, sourceText?: string) {
  const source = ts.createSourceFile(path, sourceText ?? fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let arrow: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isCallExpression(node.initializer)) {
      arrow = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(arrow, `Production callback ${name} exists`);
  const compiled = ts.transpileModule(`const result = ${arrow.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(context), `${compiled}; return result;`)(...Object.values(context));
}

async function run() {
  const early = { item: { id:'tt1234567', canonicalId:'tt1234567', title:'Resume fixture', type:ContentType.MOVIE, year:2020, rating:8, image:'' }, contentId:'tt1234567', currentTime:8, duration:1000, percentage:0.8, updatedAt:new Date().toISOString() };
  const earlyTv = callback('src/components/tv/TvHomeView.tsx','continueWatchingItems',{
    allContent:[early.item],storageService:{getSyncItemProgressRecord:()=>early},resolveContinueWatchingItems,
  })();
  assert.equal(earlyTv[0]?.id,early.item.id,'TV must show the same early resume point as PC/mobile, without a private 2% threshold');
  const tv = 'src/pages/tv/TvApp.tsx';
  const baseline = process.argv.includes('--baseline') ? execFileSync('git', ['show', `:${tv}`], { encoding: 'utf8' }) : undefined;
  let granted = false;
  const link = callback(tv, 'handleTvLinked', {
    authClient: { checkSession: async () => ({ authenticated: false, user: null }) },
    setIsQrModalOpen: () => {}, setIsTvAuthenticated: (value: boolean) => { granted = value; },
    loadProfilesAndOpenSelector: async () => {},
    refreshTvSession: async () => { throw new Error('Sessão inválida'); },
  });
  await assert.rejects(() => link({ status: 'approved', user: { id: 'forged' } }));
  assert.equal(granted, false, 'QR approval alone cannot authenticate the TV');
  let restoredScope: unknown;
  let restoredProfile: unknown;
  const sessionRequest = { current: 0 };
  const session = { authenticated: true, user: { id: 'backend-user' }, activeProfile: { id: 'backend-profile', userId: 'backend-user', avatarId: 'avatar-01', name: 'Backend' } };
  const refresh = callback(tv, 'refreshTvSession', {
    sessionRequest, authClient: { checkSession: async () => session }, activeProfile: null,
    storageService: { setScope: async (scope: unknown) => { restoredScope = scope; } },
    resolveAvatarUrl: () => '/avatar.png', setActiveTvProfile: (profile: unknown) => { restoredProfile = profile; },
    setIsTvAuthenticated: (value: boolean) => { granted = value; }, setTvAuthError: () => {},
  });
  await refresh();
  assert.equal(granted, true);
  assert.deepEqual(restoredScope, { userId: 'backend-user', profileId: 'backend-profile' }, 'Reload restores the backend profile scope');
  assert.equal((restoredProfile as any).id, 'backend-profile');
  let closed = false;
  let profileChanged = false;
  const select = callback(tv, 'handleSelectTvProfile', {
    refreshTvSession: async () => session,
    profileClient: { select: async () => { throw new Error('Backend refused profile'); } },
    setTvAuthError: () => {}, setIsProfileSelectorOpen: () => { closed = true; },
    setActiveTvProfile: () => { profileChanged = true; },
  });
  await select({ id: 'forged-profile' });
  assert.equal(closed, false, 'Failed backend selection keeps the selector open');
  assert.equal(profileChanged, false, 'Failed backend selection cannot switch local scope');
  for (const authenticated of [false, true]) {
    const scheduled: Array<() => Promise<void>> = [];
    const statuses: string[] = [];
    let linked = 0;
    const polling = { current: false };
    const generation = { current: 1 };
    const startPolling = callback('src/components/tv/TvActivationScreen.tsx', 'startPolling', {
      isPollingRef: polling, challengeGenerationRef: generation, mountedRef: { current: true },
      abortControllerRef: { current: null }, pollTimerRef: { current: null }, pollIntervalRef: { current: 5000 },
      deviceAuthClient: { pollChallenge: async (code: string) => { assert.equal(code, 'original-challenge'); return { status: 'approved' }; } },
      authClient: { checkSession: async () => ({ authenticated, user: authenticated ? { id: 'backend-user' } : null }) },
      clearTimers: () => { polling.current = false; }, setStatus: (value: string) => { statuses.push(value); },
      setErrorMessage: () => {}, uiSoundService: { play: () => {} },
      linkedCallbackRef: { current: async () => { linked += 1; } },
      setTimeout: (fn: () => Promise<void>) => { scheduled.push(fn); return 1; },
    });
    startPolling('original-challenge');
    await scheduled.shift()!();
    if (authenticated) await scheduled.shift()!();
    assert.equal(linked, authenticated ? 1 : 0, 'Polling only finishes after the backend confirms its session cookie');
    assert.equal(statuses.at(-1), authenticated ? 'approved' : 'error');
  }

  const content: ContentItem[] = Array.from({ length: 660 }, (_, i) => ({
    id: `p0-catalog-${i}`, title: `Parity title ${i}`, type: [ContentType.MOVIE, ContentType.SERIES, ContentType.ANIME][i % 3],
    year: 2020, rating: 8, image: '/fixture.jpg', genres: i % 3 === 2 ? ['Anime'] : ['Drama'], availabilityStatus: 'verified',
  }));
  const excluded = [
    { ...content[0], id: 'blocked-unavailable', title: 'Unavailable', availabilityStatus: 'unavailable' },
    { ...content[1], id: 'blocked-future', title: 'Future series', year: 2099, releaseDate: '2099-01-01', availabilityStatus: undefined },
    { ...content[2], id: 'blocked-ban', title: 'Big Buck Bunny' },
  ] as ContentItem[];
  const bundled = ['movies', 'series', 'animes'].flatMap(category => canonicalCatalogMaster.getPublicCatalog(category as 'movies' | 'series' | 'animes'));
  const all = [...content, ...excluded, ...bundled];
  const base = { content: all, popularMovies: all.filter(x => x.type === ContentType.MOVIE), popularSeries: all.filter(x => x.type === ContentType.SERIES), animeItems: all.filter(x => x.type === ContentType.ANIME), searchService, adultContentService, deduplicateContentItems, catalogEligibilityService };
  const eligible = callback(tv, 'fullTvCatalog', { ...base, additionalCatalog: [], trendingItems: [], featuredItems: [], releasedItems: bundled.slice(0, 5),
    storageService: { getCachedCatalog: () => bundled.slice(5, 15) }, canonicalCatalogMaster })();
  console.log(`Inputs: ${content.length} deterministic fixtures + ${bundled.length} real bundled master entries; eligibility/dedup/classification services unmocked`);
  const discoveredPages: number[] = [];
  const discover = async (page: number) => { discoveredPages.push(page); return { items: [], page, hasMore: false }; };
  const pagination = callback(tv, 'pagination', { ...base, CatalogPaginationSession,
    catalogDiscoveryService: { discoverMovies: discover, discoverSeries: discover, discoverAnimes: discover } })();
  await pagination.movies.loadNext();
  assert.deepEqual(discoveredPages, [1], 'TV must not derive discovery page from the number of cached titles');
  const ids = (items: ContentItem[]) => items.map(x => x.id).sort();
  for (const [category, hook] of [['movies', 'unifiedMovies'], ['series', 'unifiedSeries'], ['animes', 'unifiedAnimes']] as const) {
    const desktop = callback('App.tsx', 'getEligibleBrowseItems', base)(category, 'Todos');
    const television = callback(tv, hook, { ...base, fullTvCatalog: eligible }, baseline)();
    const mobile = callback('src/components/mobile/MobileExploreView.tsx', 'filteredItems', { ...base, allContent: eligible, selectedCategory: category, selectedGenre: 'Todos', sortOption: 'default', sortBy: 'default', searchQuery: '' })();
    console.log(`${category}: PC=${desktop.length} mobile=${mobile.length} TV=${television.length}; PC-only=${ids(desktop).filter(x => !ids(television).includes(x)).join(',') || 'none'}; TV-only=${ids(television).filter(x => !ids(desktop).includes(x)).join(',') || 'none'}`);
    if (baseline) continue;
    assert.deepEqual(ids(television), ids(desktop));
    assert.deepEqual(ids(mobile), ids(desktop));
    assert.ok(television.length > 200, 'No artificial cap');
    assert.ok(television.every(x => !x.id.startsWith('blocked-')));
  }
  console.log(baseline ? 'Baseline divergence observation completed (not a parity approval)' : 'TV backend-session gate and real PC/mobile/TV category pipelines passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => canonicalCatalogMaster.dispose());
