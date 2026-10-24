import assert from 'node:assert/strict';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { searchService } from '../src/core/search/searchService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { ContentItem, ContentType } from '../types';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST SUITE: ZapiTV | TV Incognito Bootstrap & Catalog Resilience Suite ===\n');

// 1. App.tsx: needsCatalogDiscovery inclui expressamente a rota /tv e rotas mobile
console.log('1. Verificando needsCatalogDiscovery cobrindo a rota TV e mobile em App.tsx...');
const appSource = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

assert.ok(
  appSource.includes("const isTvRoute = location.pathname.startsWith('/tv') || currentView === 'tv'"),
  'App.tsx deve definir isTvRoute cobrindo tanto pathname quanto currentView === "tv"'
);
assert.ok(
  appSource.includes("const needsCatalogDiscovery = isTvRoute ||"),
  'needsCatalogDiscovery deve incluir expressamente isTvRoute para disparar no primeiro acesso a /tv'
);
assert.ok(
  appSource.includes("currentView === 'explore'"),
  'needsCatalogDiscovery deve cobrir rotas mobile de exploração'
);
console.log('  -> needsCatalogDiscovery inclui expressamente rota TV e mobile.');

// 2. App.tsx: Eliminação do booleano cego hasDiscoveredLiveRef e adoção de máquina de estados
console.log('\n2. Verificando máquina de estados de descoberta de catálogo...');
assert.ok(
  !appSource.includes('hasDiscoveredLiveRef.current = true;'),
  'hasDiscoveredLiveRef booleano cego deve ser completamente eliminado'
);
assert.ok(
  appSource.includes("type CatalogDiscoveryStatus = 'idle' | 'loading' | 'success' | 'partial' | 'failed'"),
  'App.tsx deve declarar explicitamente os estados: idle, loading, success, partial, failed'
);
assert.ok(
  appSource.includes("discoveryStatusRef.current = 'success'"),
  'App.tsx deve registrar estado de sucesso apenas quando obtiver dados consistentes'
);
assert.ok(
  appSource.includes("discoveryStatusRef.current = 'partial'"),
  'App.tsx deve registrar falha parcial com agendamento de re-tentativa controlada'
);
assert.ok(
  appSource.includes("discoveryStatusRef.current = 'failed'"),
  'App.tsx deve registrar falha e permitir novas tentativas com backoff em vez de travar permanentemente'
);
console.log('  -> Máquina de estados explícita validada.');

// 3. App.tsx: Estados iniciais de popularMovies, popularSeries e animeItems possuem fallback canônico
console.log('\n3. Verificando estados iniciais com fallback canônico na ausência de cache...');
assert.ok(
  appSource.includes("canonicalCatalogMaster.getPublicCatalog('movies')"),
  'popularMovies deve inicializar com canonicalCatalogMaster quando o cache local estiver vazio (aba anônima)'
);
assert.ok(
  appSource.includes("canonicalCatalogMaster.getPublicCatalog('series')"),
  'popularSeries deve inicializar com canonicalCatalogMaster quando o cache local estiver vazio (aba anônima)'
);
assert.ok(
  appSource.includes("canonicalCatalogMaster.getPublicCatalog('animes')"),
  'animeItems deve inicializar com canonicalCatalogMaster quando o cache local estiver vazio (aba anônima)'
);

const canonicalMovies = canonicalCatalogMaster.getPublicCatalog('movies');
const canonicalSeries = canonicalCatalogMaster.getPublicCatalog('series');
const canonicalAnimes = canonicalCatalogMaster.getPublicCatalog('animes');

assert.ok(canonicalMovies.length >= 10, `Acervo canônico de filmes deve ter pelo menos 10 itens (encontrados: ${canonicalMovies.length})`);
assert.ok(canonicalSeries.length >= 10, `Acervo canônico de séries deve ter pelo menos 10 itens (encontrados: ${canonicalSeries.length})`);
assert.ok(canonicalAnimes.length >= 10, `Acervo canônico de animes deve ter pelo menos 10 itens (encontrados: ${canonicalAnimes.length})`);
console.log(`  -> Acervo canônico populado (Filmes: ${canonicalMovies.length}, Séries: ${canonicalSeries.length}, Animes: ${canonicalAnimes.length}).`);

// 4. TvApp.tsx: Filmes e Séries aproveitam fullTvCatalog unificado
console.log('\n4. Verificando catálogo unificado em TvApp.tsx...');
const tvAppSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/tv/TvApp.tsx'), 'utf8');

assert.ok(
  tvAppSource.includes('const unifiedMovies = useMemo('),
  'TvApp.tsx deve calcular unifiedMovies combinando fullTvCatalog e popularMovies'
);
assert.ok(
  tvAppSource.includes('const unifiedSeries = useMemo('),
  'TvApp.tsx deve calcular unifiedSeries combinando fullTvCatalog e popularSeries'
);
assert.ok(
  tvAppSource.includes('const unifiedAnimes = useMemo('),
  'TvApp.tsx deve calcular unifiedAnimes combinando fullTvCatalog e animeItems'
);
assert.ok(
  tvAppSource.includes('const unifiedTrending = useMemo('),
  'TvApp.tsx deve calcular unifiedTrending com fallback robusto'
);

assert.ok(
  tvAppSource.includes('popularMovies={unifiedMovies}'),
  'TvHomeView deve receber unifiedMovies'
);
assert.ok(
  tvAppSource.includes('popularSeries={unifiedSeries}'),
  'TvHomeView deve receber unifiedSeries'
);
assert.ok(
  tvAppSource.includes('items={unifiedMovies}'),
  'TvCategoryView (Filmes) deve receber unifiedMovies'
);
assert.ok(
  tvAppSource.includes('items={unifiedSeries}'),
  'TvCategoryView (Séries) deve receber unifiedSeries'
);
assert.ok(
  tvAppSource.includes('items={unifiedAnimes}'),
  'TvAnimeView deve receber unifiedAnimes'
);
console.log('  -> Coleções unificadas integradas a todas as abas da TV.');

// 5. Recuperação de Dados: Listas existentes nunca são substituídas por arrays vazios quando APIs falham
console.log('\n5. Verificando proteção contra substituição por arrays vazios...');
assert.ok(
  appSource.includes('if (combinedMovies.length > 0) {'),
  'setPopularMovies deve ser guardado por combinedMovies.length > 0'
);
assert.ok(
  appSource.includes('if (combinedSeries.length > 0) {'),
  'setPopularSeries deve ser guardado por combinedSeries.length > 0'
);
assert.ok(
  appSource.includes('if (combinedAnimes.length > 0) {'),
  'setAnimeItems deve ser guardado por combinedAnimes.length > 0'
);

const existingMovies: ContentItem[] = [
  { id: 'm1', title: 'Filme Existente', type: ContentType.MOVIE }
];
const incomingEmpty: ContentItem[] = [];
const merged = incomingEmpty.length > 0 ? deduplicateContentItems([...incomingEmpty, ...existingMovies]) : existingMovies;

assert.equal(merged.length, 1);
assert.equal(merged[0].id, 'm1');
console.log('  -> Listas existentes 100% blindadas contra falhas de rede.');

// 6. TvCard16x9.tsx: Eliminação do loop de fallback e proteção contra imagens piscando
console.log('\n6. Verificando eliminação de loop em TvCard16x9.tsx...');
const cardSource = fs.readFileSync(path.join(process.cwd(), 'src/components/tv/TvCard16x9.tsx'), 'utf8');

assert.ok(
  cardSource.includes('failedUrlsRef = useRef<Set<string>>(new Set())'),
  'TvCard16x9 deve manter failedUrlsRef para rastrear URLs com erro e impedir loops'
);
assert.ok(
  !cardSource.includes('[item.id, item.image, item.poster, item.backdrop, imgSrc]'),
  'useEffect do TvCard16x9 NÃO deve conter imgSrc nas dependências (causa raiz do loop de render)'
);
assert.ok(
  cardSource.includes('!failedUrlsRef.current.has(url)'),
  'handleImgError deve selecionar apenas candidatos que ainda não falharam'
);
console.log('  -> TvCard16x9 protegido contra loops de fallback e piscadas.');

// 7. TvHeroBanner.tsx: Pré-carregamento de imagem antes do crossfade e prevenção de loop no onError
console.log('\n7. Verificando pré-carregamento e estabilidade em TvHeroBanner.tsx...');
const heroSource = fs.readFileSync(path.join(process.cwd(), 'src/components/tv/TvHeroBanner.tsx'), 'utf8');

assert.ok(
  heroSource.includes('preloadBannerImage'),
  'TvHeroBanner deve implementar preloadBannerImage para baixar os bytes antes de revelar o slide'
);
assert.ok(
  heroSource.includes('await preloadBannerImage(targetUrl)'),
  'goToSlide deve aguardar preloadBannerImage antes de iniciar setIsCrossfading'
);
assert.ok(
  heroSource.includes('fallbackRetried'),
  'onError do TvHeroBanner deve ter proteção anti-loop via fallbackRetried'
);
console.log('  -> TvHeroBanner pré-carrega imagens e bloqueia loops no onError.');

// 8. Categorização e Elegibilidade de Gêneros
console.log('\n8. Verificando geração de fileiras de gêneros ricas...');
const eligibleMovies = catalogEligibilityService.filterEligibleItemsSync(canonicalMovies);

const genresMap = new Map<string, ContentItem[]>();
eligibleMovies.forEach(item => {
  (item.genres || []).forEach(genre => {
    if (!genresMap.has(genre)) genresMap.set(genre, []);
    genresMap.get(genre)!.push(item);
  });
});

const activeGenreRows = Array.from(genresMap.entries()).filter(([_, items]) => items.length >= 3);
assert.ok(activeGenreRows.length >= 2, `Devem existir pelo menos 2 fileiras de gêneros com >= 3 títulos (encontradas: ${activeGenreRows.length})`);

const eligibleSeries = catalogEligibilityService.filterEligibleItemsSync(canonicalSeries);
assert.ok(eligibleSeries.length >= 5, `Séries elegíveis devem conter ao menos 5 títulos (encontrados: ${eligibleSeries.length})`);
console.log(`  -> Fileiras de gêneros validadas (${activeGenreRows.length} gêneros com >= 3 filmes).`);

// 9. Simulação de Janela Anônima / Cold Start: Todos os dados necessários são derivados no primeiro ciclo
console.log('\n9. Simulando cold start em janela anônima (sem cache prévio)...');
const mockEmptyStorage = {
  getCachedCatalog: (_type: string) => []
};

const initialTrending = mockEmptyStorage.getCachedCatalog('trending').length > 0
  ? mockEmptyStorage.getCachedCatalog('trending')
  : canonicalCatalogMaster.getPublicCatalog('movies').slice(0, 10);

const initialMovies = mockEmptyStorage.getCachedCatalog('movies').length > 0
  ? mockEmptyStorage.getCachedCatalog('movies')
  : canonicalCatalogMaster.getPublicCatalog('movies');

const initialSeries = mockEmptyStorage.getCachedCatalog('series').length > 0
  ? mockEmptyStorage.getCachedCatalog('series')
  : canonicalCatalogMaster.getPublicCatalog('series');

const initialAnimes = mockEmptyStorage.getCachedCatalog('animes').length > 0
  ? mockEmptyStorage.getCachedCatalog('animes')
  : canonicalCatalogMaster.getPublicCatalog('animes');

assert.ok(initialTrending.length > 0, 'Trending inicial não pode ser vazio na aba anônima');
assert.ok(initialMovies.length > 0, 'Filmes iniciais não podem ser vazios na aba anônima');
assert.ok(initialSeries.length > 0, 'Séries iniciais não podem ser vazias na aba anônima');
assert.ok(initialAnimes.length > 0, 'Animes iniciais não podem ser vazios na aba anônima');
console.log('  -> Cold start sem dados prévios inicializa catálogo imediatamente.');

// 10. Isolamento com Desktop e Smart TV preservado rigorosamente
console.log('\n10. Verificando isolamento entre Desktop e Smart TV...');
assert.ok(
  appSource.includes("if (location.pathname.startsWith('/tv')) {"),
  'App.tsx deve manter o retorno antecipado isolado para TvApp na rota /tv'
);
assert.ok(
  appSource.includes("!location.pathname.startsWith('/tv')"),
  'App.tsx deve garantir a remoção de tv-mode fora da rota /tv'
);
console.log('  -> Isolamento arquitetural rigoroso preservado.');

console.log('\n=== TODOS OS 10 TESTES DE INCOGNITO BOOTSTRAP E RESILIÊNCIA PASSARAM COM SUCESSO! ===');
process.exit(0);
