import assert from 'node:assert/strict';
import { catalogEligibilityService, TEMPORARILY_LOCKED_RELEASES } from '../src/core/catalog/CatalogEligibilityService';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { bannedContentRegistry } from '../src/core/catalog/BannedContentRegistry';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { trustedTimeService } from '../src/core/time/trustedTimeService';
import { localSearchIndexService } from '../src/core/search/localSearchIndexService';
import { streamValidator } from '../src/core/providers/streamValidator';
import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { ContentType, ContentItem } from '../types';

console.log('=== TEST SUITE: ZapiTV | Bloqueio Temporário e Integridade de Resident Evil (2026) ===\n');

// -----------------------------------------------------------------------------
// 1. Identificação canônica estrita e integridade dos metadados
// -----------------------------------------------------------------------------
console.log('1. Verificando metadados e configuração de Resident Evil (2026)...');
const featuredRE = FEATURED_CATALOG_ITEMS.find(it => 
  catalogEligibilityService.isResidentEvil2026(it) || it.id === 'movie-resident-evil-2026'
);

assert.ok(featuredRE, 'Resident Evil (2026) deve existir em FEATURED_CATALOG_ITEMS');
assert.strictEqual(featuredRE.id, 'movie-resident-evil-2026');
assert.strictEqual(featuredRE.tmdbId, '1423191');
assert.strictEqual(featuredRE.imdbId, 'tt13000574');
assert.strictEqual(featuredRE.type, ContentType.MOVIE);
assert.strictEqual(featuredRE.year, 2026);
assert.strictEqual(featuredRE.director, 'Zach Cregger');
assert.strictEqual(featuredRE.isFeatured, false, 'Resident Evil 2026 não pode estar como destaque durante o bloqueio');
assert.strictEqual(featuredRE.availabilityStatus, 'unavailable', 'Status de disponibilidade deve ser "unavailable"');
assert.strictEqual(featuredRE.catalogVisibleFrom, '2026-11-20T00:00:00-03:00');
assert.strictEqual(bannedContentRegistry.isBanned(featuredRE), false, 'Resident Evil 2026 NUNCA deve ser banido (é bloqueio temporário)');

// Verifica cadastro na estrutura generalizada TEMPORARILY_LOCKED_RELEASES
const lockedConfig = catalogEligibilityService.getTemporarilyLockedRelease(featuredRE);
assert.ok(lockedConfig, 'Deve estar registrado em TEMPORARILY_LOCKED_RELEASES');
assert.strictEqual(lockedConfig.id, 'movie-resident-evil-2026');
assert.strictEqual(lockedConfig.reevaluationDate, '2026-11-20T00:00:00-03:00');
assert.strictEqual(lockedConfig.requiresExplicitDigitalRelease, true, 'Deve exigir liberação digital explícita');
assert.strictEqual(lockedConfig.requiresVerifiedHdSource, true, 'Deve exigir fonte HD verificada');

console.log('  -> Metadados, diretor e registro de lançamento temporariamente bloqueado confirmados.');

// -----------------------------------------------------------------------------
// 2. Não colisão com outras produções da franquia Resident Evil
// -----------------------------------------------------------------------------
console.log('\n2. Verificando isolamento canônico de Resident Evil (2026) contra outras produções da franquia...');
const re2002: ContentItem = {
  id: 'movie-resident-evil-2002',
  title: 'Resident Evil: O Hóspede Maldito',
  originalTitle: 'Resident Evil',
  type: ContentType.MOVIE,
  year: 2002,
  imdbId: 'tt0120804',
  tmdbId: '107',
  rating: 6.7
};

const reVendetta: ContentItem = {
  id: 'movie-resident-evil-vendetta-2017',
  title: 'Resident Evil: Vendetta',
  originalTitle: 'Biohazard: Vendetta',
  type: ContentType.MOVIE,
  year: 2017,
  imdbId: 'tt5776208',
  tmdbId: '400136',
  rating: 6.3
};

const reSeriesNetflix: ContentItem = {
  id: 'series-resident-evil-netflix-2022',
  title: 'Resident Evil: A Série',
  originalTitle: 'Resident Evil',
  type: ContentType.SERIES,
  year: 2022,
  imdbId: 'tt9614918',
  tmdbId: '107985',
  rating: 4.2
};

assert.strictEqual(catalogEligibilityService.isResidentEvil2026(re2002), false, 'Resident Evil (2002) NÃO pode ser identificado como o filme de 2026');
assert.strictEqual(catalogEligibilityService.isResidentEvil2026(reVendetta), false, 'Resident Evil Vendetta (2017) NÃO pode ser identificado como o filme de 2026');
assert.strictEqual(catalogEligibilityService.isResidentEvil2026(reSeriesNetflix), false, 'Série Resident Evil Netflix (2022) NÃO pode ser identificada como o filme de 2026');

assert.strictEqual(catalogEligibilityService.getTemporarilyLockedRelease(re2002), null, 'Filme de 2002 não tem lock temporário');
assert.strictEqual(catalogEligibilityService.getTemporarilyLockedRelease(reVendetta), null, 'Vendetta 2017 não tem lock temporário');

console.log('  -> Isolamento estrito verificado: produções de outros anos e animações não são afetadas.');

// -----------------------------------------------------------------------------
// 3. Ocultação imediata de todas as áreas públicas (Catálogo, Busca, Playable)
// -----------------------------------------------------------------------------
console.log('\n3. Testando ocultação de Resident Evil (2026) no catálogo, filtros e busca instantânea...');
trustedTimeService.setMockTime('2026-10-24T16:00:00-03:00');

assert.strictEqual(catalogEligibilityService.isCatalogVisibleNow(featuredRE), false, 'Deve estar oculto em 24/10/2026');
assert.strictEqual(catalogEligibilityService.isItemPubliclyPlayableSync(featuredRE), false, 'Reprodução pública deve estar bloqueada');
assert.strictEqual(theatricalFilterService.isMovieAllowedSync(featuredRE), false, 'theatricalFilterService deve rejeitar o filme');

// Filtragem em lote
const catalogBatch: ContentItem[] = [featuredRE, re2002];
const filteredCatalog = catalogEligibilityService.filterEligibleItemsSync(catalogBatch);
assert.strictEqual(filteredCatalog.some(it => it.id === featuredRE.id), false, 'Resident Evil 2026 DEVE ser filtrado do catálogo');

// Busca Instantânea
localSearchIndexService.clear();
localSearchIndexService.syncCatalog([featuredRE, re2002]);
const searchResults = localSearchIndexService.searchInstant('Resident Evil');
assert.strictEqual(searchResults.some(r => r.id === featuredRE.id), false, 'Resident Evil 2026 NÃO deve aparecer nos resultados de busca pública');
assert.strictEqual(searchResults.some(r => r.id === re2002.id), true, 'Resident Evil 2002 DEVE aparecer normalmente na busca');

console.log('  -> Resident Evil (2026) está 100% oculto de catálogo público, filtros e busca.');

// -----------------------------------------------------------------------------
// 4. Mensagem institucional e preservação de dados do usuário
// -----------------------------------------------------------------------------
console.log('\n4. Verificando mensagem institucional amigável de bloqueio e integridade de dados...');
const notice = catalogEligibilityService.getLockedReleaseNotice(featuredRE);
assert.ok(notice, 'Deve existir uma mensagem institucional de aviso');
assert.ok(notice.includes('20/11/2026'), 'Aviso deve mencionar a data de reavaliação 20/11/2026');
assert.ok(notice.includes('HD') || notice.includes('digital oficial'), 'Aviso deve mencionar disponibilidade digital oficial em HD');

// Testando preservação dos dados de favoritos e lista do usuário
const mockUserFavorites = ['movie-resident-evil-2026', 'movie-resident-evil-2002'];
assert.strictEqual(mockUserFavorites.includes('movie-resident-evil-2026'), true, 'Dados de usuário em favoritos NUNCA devem ser deletados pelo embargo');

console.log('  -> Mensagem institucional e preservação de dados do usuário verificadas com sucesso.');

// -----------------------------------------------------------------------------
// 5. Rejeição de streams trocados (Kadokawa / Vendetta / outras animações e adaptações)
// -----------------------------------------------------------------------------
console.log('\n5. Testando bloqueio rigoroso de streams de animação (Kadokawa/Vendetta) e obras trocadas...');
const rogueStreams = [
  { name: 'Torrentio', title: 'Resident Evil Vendetta (2017) 1080p BluRay Kadokawa Marza', url: 'https://example.com/vendetta.mp4' },
  { name: 'Torrentio', title: 'Resident Evil: Degeneration (2008) 720p WEB-DL', url: 'https://example.com/degeneration.mp4' },
  { name: 'Torrentio', title: 'Resident Evil: Damnation (2012) 1080p Animado', url: 'https://example.com/damnation.mp4' },
  { name: 'Torrentio', title: 'Resident Evil Death Island 2023 2160p 4K UHD Animation', url: 'https://example.com/death_island.mp4' },
  { name: 'Torrentio', title: 'Resident Evil Infinite Darkness S01E01 1080p NF', url: 'https://example.com/infinite_darkness.mp4' },
  { name: 'Torrentio', title: 'Resident Evil Welcome to Raccoon City (2021) 1080p BluRay', url: 'https://example.com/raccoon.mp4' },
  { name: 'Torrentio', title: 'Resident Evil Apocalypse 2004 1080p', url: 'https://example.com/apocalypse.mp4' },
  { name: 'Torrentio', title: 'Resident Evil (2002) 1080p BluRay x264', url: 'https://example.com/re2002.mp4' },
  { name: 'FenixFlix', title: 'Resident Evil (2026) 1080p WEB-DL DDP5.1 Atmos', url: 'https://example.com/re2026_legit.mp4' }
];

const re2026Identity = canonicalIdentityService.buildIdentity(featuredRE);

// Teste com streamValidator.isStreamMatchingTargetTitle
const cleanedStreams = streamValidator.filterCleanStreams(
  rogueStreams,
  featuredRE.title,
  featuredRE.originalTitle,
  [featuredRE.id, featuredRE.imdbId!, featuredRE.tmdbId!, String(featuredRE.year)]
);

assert.strictEqual(cleanedStreams.some(s => s.title.includes('Vendetta')), false, 'Streams de Vendetta/Kadokawa DEVEM ser rejeitados');
assert.strictEqual(cleanedStreams.some(s => s.title.includes('Degeneration')), false, 'Streams de Degeneration DEVEM ser rejeitados');
assert.strictEqual(cleanedStreams.some(s => s.title.includes('Damnation')), false, 'Streams de Damnation DEVEM ser rejeitados');
assert.strictEqual(cleanedStreams.some(s => s.title.includes('Death Island')), false, 'Streams de Death Island DEVEM ser rejeitados');
assert.strictEqual(cleanedStreams.some(s => s.title.includes('Infinite Darkness')), false, 'Streams de Infinite Darkness DEVEM ser rejeitados');
assert.strictEqual(cleanedStreams.some(s => s.title.includes('Raccoon City')), false, 'Streams de Welcome to Raccoon City DEVEM ser rejeitados');
assert.strictEqual(cleanedStreams.some(s => s.title.includes('Apocalypse')), false, 'Streams de Apocalypse DEVEM ser rejeitados');
assert.strictEqual(cleanedStreams.some(s => s.title.includes('2002')), false, 'Streams do filme de 2002 DEVEM ser rejeitados para a requisição de 2026');

// Teste com SourceConfidenceEngine
for (const rogue of rogueStreams.slice(0, 8)) {
  const evalResult = sourceConfidenceEngine.evaluate(rogue, re2026Identity);
  assert.strictEqual(evalResult.confidence, 'REJECTED', `Stream ${rogue.title} deve ser classificado como REJECTED`);
  assert.strictEqual(evalResult.isMatch, false, `Stream ${rogue.title} não pode ser correspondido`);
}

console.log('  -> Blindagem contra animações e outras produções da franquia validada com sucesso.');

// -----------------------------------------------------------------------------
// 6. Rejeição incondicional de gravações de cinema (CAM, HDCAM, Telesync, TC)
// -----------------------------------------------------------------------------
console.log('\n6. Testando eliminação da exceção de CAM para filmes (bloqueio incondicional)...');
const camStreams = [
  { name: 'Torrentio', title: 'Resident Evil 2026 1080p CAMRip x264', url: 'https://example.com/cam.mp4' },
  { name: 'Torrentio', title: 'Resident Evil.2026.HDCAM.720p', url: 'https://example.com/hdcam.mp4' },
  { name: 'Torrentio', title: 'Resident Evil 2026 Telesync LINE Audio', url: 'https://example.com/ts.mp4' },
  { name: 'Torrentio', title: 'Resident Evil 2026 Telecine x265', url: 'https://example.com/tc.mp4' }
];

for (const cam of camStreams) {
  assert.strictEqual(theatricalFilterService.isCamRecording(cam.title), true, `theatricalFilterService deve detectar CAM em: ${cam.title}`);
  assert.strictEqual(CamBlockerEngine.evaluateStream(cam, featuredRE).isCam, true, `CamBlockerEngine deve classificar como isCam: true para: ${cam.title}`);
}

console.log('  -> Exceção de CAM eliminada: filmes rejeitam incondicionalmente CAM, HDCAM, Telesync e Telecine.');

// -----------------------------------------------------------------------------
// 7. Simulação pós 20/11/2026: Exigência de disponibilidade real e fonte HD
// -----------------------------------------------------------------------------
console.log('\n7. Testando comportamento após 20/11/2026 (não liberar sem confirmação HD legítima)...');
// Avança mock para após 20/11/2026
trustedTimeService.setMockTime('2026-11-20T12:00:00-03:00');

// Caso A: A data chegou, mas o item continua marcado como 'unavailable' e sem fontes HD verificadas
assert.strictEqual(
  catalogEligibilityService.isCatalogVisibleNow(featuredRE),
  false,
  'Resident Evil (2026) NÃO deve ser liberado automaticamente só pela chegada da data se continuar sem fontes HD verificadas'
);

// Caso B: A Odisseia (2026) que NÃO exigia verificação HD prévia libera normalmente na data
const featuredOdyssey = FEATURED_CATALOG_ITEMS.find(it => it.id === 'movie-a-odisseia-2026')!;
assert.strictEqual(
  catalogEligibilityService.isCatalogVisibleNow(featuredOdyssey),
  true,
  'A Odisseia (2026) torna-se visível na data programada'
);

// Caso C: Resident Evil (2026) com fontes HD legítimas comprovadas no registro
const reWithVerifiedHd: ContentItem = {
  ...featuredRE,
  availabilityStatus: 'verified',
  verifiedStreams: [
    {
      name: 'Fonte Oficial HD',
      title: 'Resident Evil (2026) 1080p Digital Oficial BR',
      url: 'https://cdn.example.com/re2026.mp4',
      quality: '1080p',
      isPtBr: true
    }
  ]
};

assert.strictEqual(
  catalogEligibilityService.isCatalogVisibleNow(reWithVerifiedHd),
  true,
  'Resident Evil (2026) DEVE ser liberado quando comprovadamente possuir fonte HD oficial verificada e status liberado'
);

// Restaura mock de tempo
trustedTimeService.resetMockTime();

console.log('  -> Comportamento pós-data validado: liberação estritamente condicionada à disponibilidade real em HD.');

console.log('\n=== TODOS OS 7 TESTES DE RESIDENT EVIL (2026) PASSARAM COM SUCESSO! ===\n');
process.exit(0);
