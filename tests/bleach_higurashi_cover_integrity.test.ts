import assert from 'node:assert';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import {
  posterRecoveryService,
  isCorruptedPosterUrl,
  CORRUPTED_POSTER_FRAGMENTS
} from '../src/core/catalog/PosterRecoveryService';
import { catalogMetadataIntegrityAuditor } from '../src/core/catalog/CatalogMetadataIntegrityAuditor';
import { deduplicateContentItems, getCanonicalKeysForItem } from '../src/core/catalog/catalogDeduplication';
import { ContentType, ContentItem } from '../types';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TESTE DE INTEGRIDADE CANÔNICA: BLEACH TYBW vs HIGURASHI (ZAPITV) ===\n');

// --------------------------------------------------------------------------
// TESTE 1: Integridade dos Registros Oficiais de Bleach: Thousand-Year Blood War
// --------------------------------------------------------------------------
console.log('[Teste 1] Verificando registros oficiais de Bleach TYBW no catálogo...');

// 1.1 featuredCatalogItems.ts
const bleachFeatured = FEATURED_CATALOG_ITEMS.find(i => i.id === 'anime-bleach-tybw');
assert.ok(bleachFeatured, 'Item anime-bleach-tybw DEVE existir em FEATURED_CATALOG_ITEMS');
assert.strictEqual(bleachFeatured.title, 'Bleach: Thousand-Year Blood War');
assert.strictEqual(bleachFeatured.originalTitle, 'Bleach: Sennen Kessen-hen');
assert.strictEqual(bleachFeatured.type, ContentType.ANIME);
assert.strictEqual(bleachFeatured.year, 2022);
assert.strictEqual(bleachFeatured.aniListId, 116674, 'AniList ID DEVE ser 116674 (Bleach TYBW)');
assert.notStrictEqual(bleachFeatured.aniListId, 114446, 'AniList ID NUNCA deve ser 114446 (Higurashi GOU)');
assert.strictEqual(String(bleachFeatured.tmdbId), '30984');
assert.strictEqual(bleachFeatured.malId, 41467);

// Proibição expressa de imagens de Higurashi no featured
assert.ok(!bleachFeatured.image.includes('114446'), 'Pôster NÃO deve conter referência a Higurashi 114446');
assert.ok(!bleachFeatured.image.includes('H6uxjVi8wBoo'), 'Pôster NÃO deve ser a capa de Higurashi (H6uxjVi8wBoo)');
assert.ok(!bleachFeatured.backdrop?.includes('114446'), 'Backdrop NÃO deve conter referência a Higurashi 114446');
assert.ok(!bleachFeatured.backdrop?.includes('DTd4xfGx7DJB'), 'Backdrop NÃO deve ser o banner de Higurashi (DTd4xfGx7DJB)');
assert.ok(bleachFeatured.image.includes('116674') || bleachFeatured.image.includes('30984') || bleachFeatured.image.includes('tmdb.org'), 'Pôster deve ser oficial de Bleach');

// Episódios de featured
assert.ok(Array.isArray(bleachFeatured.episodes) && bleachFeatured.episodes.length > 0, 'Bleach deve conter episódios');
for (const ep of bleachFeatured.episodes) {
  assert.ok(!ep.image?.includes('114446') && !ep.image?.includes('H6uxjVi8wBoo'), `Episódio ${ep.id} não deve ter imagem de Higurashi`);
}

// 1.2 verifiedCatalog.ts
const bleachVerified = VERIFIED_OPEN_ITEMS.find(i => i.id === 'anime-bleach-tvmeter');
assert.ok(bleachVerified, 'Item anime-bleach-tvmeter DEVE existir em VERIFIED_OPEN_ITEMS');
assert.strictEqual(bleachVerified.title, 'Bleach: Thousand-Year Blood War');
assert.strictEqual(bleachVerified.originalTitle, 'Bleach: Sennen Kessen-hen');
assert.strictEqual(bleachVerified.type, ContentType.ANIME);
assert.strictEqual(bleachVerified.year, 2022);
assert.strictEqual(bleachVerified.aniListId, 116674, 'AniList ID de anime-bleach-tvmeter DEVE ser 116674');
assert.notStrictEqual(bleachVerified.aniListId, 114446, 'AniList ID NUNCA deve ser 114446');
assert.strictEqual(String(bleachVerified.tmdbId), '30984');
assert.strictEqual(bleachVerified.canonicalId, 'anime:anilist:116674');

// Proibição expressa de imagens de Higurashi no verified
assert.ok(!bleachVerified.image.includes('114446') && !bleachVerified.image.includes('H6uxjVi8wBoo'), 'Pôster de verified não deve ter imagem de Higurashi');
assert.ok(!bleachVerified.backdrop?.includes('114446') && !bleachVerified.backdrop?.includes('DTd4xfGx7DJB'), 'Backdrop de verified não deve ter banner de Higurashi');

console.log('✓ Teste 1 aprovado: Registros de Bleach TYBW possuem AniList ID 116674 e capas canônicas corretas.\n');

// --------------------------------------------------------------------------
// TESTE 2: Verificação do Código-Fonte contra o ID 114446
// --------------------------------------------------------------------------
console.log('[Teste 2] Verificando ausência de 114446 associado a Bleach nos serviços...');

const animeEditorialPath = path.resolve('src/core/anime/animeEditorialService.ts');
const animeEditorialContent = fs.readFileSync(animeEditorialPath, 'utf-8');
assert.ok(!animeEditorialContent.includes('114446'), 'animeEditorialService.ts NÃO deve conter 114446');
assert.ok(animeEditorialContent.includes('116674'), 'animeEditorialService.ts DEVE conter 116674 para Bleach TYBW');

const snapshotsPath = path.resolve('src/core/rankings/anilistRankingSnapshots.ts');
const snapshotsContent = fs.readFileSync(snapshotsPath, 'utf-8');
assert.ok(!snapshotsContent.includes('114446'), 'anilistRankingSnapshots.ts NÃO deve conter 114446');

console.log('✓ Teste 2 aprovado: Causa raiz eliminada de todos os serviços e snapshots de ranking.\n');

// --------------------------------------------------------------------------
// TESTE 3: Deduplicação e Reconciliação dos Registros de Bleach
// --------------------------------------------------------------------------
console.log('[Teste 3] Verificando deduplicação canônica entre anime-bleach-tybw e anime-bleach-tvmeter...');

const keysFeatured = getCanonicalKeysForItem(bleachFeatured);
const keysVerified = getCanonicalKeysForItem(bleachVerified);

// Devem compartilhar chaves essenciais: tmdb, anilist e título normalizado + ano
const sharedTmdb = keysFeatured.some(k => keysVerified.includes(k) && k.includes('30984'));
const sharedAniList = keysFeatured.some(k => keysVerified.includes(k) && k.includes('116674'));
const sharedTitleYear = keysFeatured.some(k => keysVerified.includes(k) && k.includes('bleach') && k.includes('2022'));

assert.ok(sharedTmdb, 'Ambos os registros devem compartilhar a chave TMDB 30984');
assert.ok(sharedAniList, 'Ambos os registros devem compartilhar a chave AniList 116674');
assert.ok(sharedTitleYear, 'Ambos os registros devem compartilhar a chave de título normalizado + ano');

const mergedList = deduplicateContentItems([bleachFeatured, bleachVerified]);
assert.strictEqual(mergedList.length, 1, 'Os dois registros de Bleach TYBW DEVEM ser unificados em 1 único item');
const unified = mergedList[0];
assert.strictEqual(unified.title, 'Bleach: Thousand-Year Blood War');
assert.strictEqual(unified.aniListId, 116674);
assert.strictEqual(String(unified.tmdbId), '30984');
assert.ok(!unified.image.includes('114446') && !unified.image.includes('H6uxjVi8wBoo'), 'Item unificado não deve ter imagem de Higurashi');

console.log('✓ Teste 3 aprovado: Deduplicação reconcilia os registros sem duplicidade nem conflitos de dados.\n');

// --------------------------------------------------------------------------
// TESTE 4: Detecção e Bloqueio de Imagens de Higurashi no PosterRecoveryService
// --------------------------------------------------------------------------
console.log('[Teste 4] Verificando proteção e saneamento de cache no PosterRecoveryService...');

const higurashiPoster = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx114446-H6uxjVi8wBoo.jpg';
const higurashiBanner = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/114446-DTd4xfGx7DJB.jpg';
const bleachOfficialPoster = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx116674-p3zK4PUX2Aag.jpg';

assert.ok(CORRUPTED_POSTER_FRAGMENTS.includes('bx114446'), 'bx114446 deve estar em CORRUPTED_POSTER_FRAGMENTS');
assert.ok(CORRUPTED_POSTER_FRAGMENTS.includes('114446-H6uxjVi8wBoo'), '114446-H6uxjVi8wBoo deve estar em CORRUPTED_POSTER_FRAGMENTS');
assert.ok(CORRUPTED_POSTER_FRAGMENTS.includes('114446-DTd4xfGx7DJB'), '114446-DTd4xfGx7DJB deve estar em CORRUPTED_POSTER_FRAGMENTS');

assert.strictEqual(isCorruptedPosterUrl(higurashiPoster), true, 'isCorruptedPosterUrl DEVE bloquear a capa de Higurashi');
assert.strictEqual(isCorruptedPosterUrl(higurashiBanner), true, 'isCorruptedPosterUrl DEVE bloquear o banner de Higurashi');
assert.strictEqual(isCorruptedPosterUrl(bleachOfficialPoster), false, 'isCorruptedPosterUrl NÃO deve bloquear o pôster oficial de Bleach');

// Simulação de cache corrompido contendo a capa de Higurashi associada a Bleach
(posterRecoveryService as any).memoryCache.set('id:anime-bleach-tybw', {
  url: higurashiPoster,
  status: 'verified',
  timestamp: Date.now()
});
(posterRecoveryService as any).memoryCache.set('anilist:114446', {
  url: higurashiPoster,
  status: 'verified',
  timestamp: Date.now()
});

// getCachedPoster deve recusar e eliminar a URL corrompida
const cached = posterRecoveryService.getCachedPoster(bleachFeatured);
assert.notStrictEqual(cached, higurashiPoster, 'getCachedPoster NUNCA deve retornar a URL corrompida de Higurashi');

// sanitizeKnownCorruptedImages deve expurgar qualquer entrada de Higurashi
posterRecoveryService.sanitizeKnownCorruptedImages();
assert.strictEqual((posterRecoveryService as any).memoryCache.has('id:anime-bleach-tybw'), false, 'Cache id:anime-bleach-tybw deve ser expurgado');
assert.strictEqual((posterRecoveryService as any).memoryCache.has('anilist:114446'), false, 'Cache anilist:114446 deve ser expurgado');

console.log('✓ Teste 4 aprovado: PosterRecoveryService rejeita e expurga ativamente imagens de Higurashi associadas a Bleach.\n');

// --------------------------------------------------------------------------
// TESTE 5: Validação Semântica de Título no AniList (isMatchingAnimeMedia)
// --------------------------------------------------------------------------
console.log('[Teste 5] Verificando validação semântica isMatchingAnimeMedia...');

const higurashiMedia = {
  id: 114446,
  title: {
    romaji: 'Higurashi no Naku Koro ni Gou',
    english: 'Higurashi: When They Cry - GOU',
    native: 'ひぐらしのなく頃に業'
  },
  synonyms: ['Higurashi Gou']
};

const bleachMedia = {
  id: 116674,
  title: {
    romaji: 'BLEACH: Sennen Kessen-hen',
    english: 'BLEACH: Thousand-Year Blood War',
    native: 'BLEACH 千年血戦篇'
  },
  synonyms: ['Bleach TYBW', 'Bleach: Sennen Kessen-hen Part 1']
};

// Quando o item procurado é Bleach TYBW:
const matchBleachWithHigurashi = posterRecoveryService.isMatchingAnimeMedia(higurashiMedia, bleachFeatured);
assert.strictEqual(matchBleachWithHigurashi, false, 'isMatchingAnimeMedia DEVE REJEITAR Higurashi para Bleach TYBW');

const matchBleachWithBleach = posterRecoveryService.isMatchingAnimeMedia(bleachMedia, bleachFeatured);
assert.strictEqual(matchBleachWithBleach, true, 'isMatchingAnimeMedia DEVE ACEITAR Bleach Media para Bleach TYBW');

// Por string direta de busca:
assert.strictEqual(posterRecoveryService.isMatchingAnimeMedia(higurashiMedia, 'Bleach: Thousand-Year Blood War'), false);
assert.strictEqual(posterRecoveryService.isMatchingAnimeMedia(bleachMedia, 'Bleach: Thousand-Year Blood War'), true);
assert.strictEqual(posterRecoveryService.isMatchingAnimeMedia(bleachMedia, 'Bleach: Sennen Kessen-hen'), true);

console.log('✓ Teste 5 aprovado: Validação semântica rejeita categoricamente correspondências cruzadas de outros animes.\n');

// --------------------------------------------------------------------------
// TESTE 6: Auditoria Completa via CatalogMetadataIntegrityAuditor
// --------------------------------------------------------------------------
console.log('[Teste 6] Executando auditoria estrita de metadados em Bleach TYBW...');

const reportFeatured = catalogMetadataIntegrityAuditor.auditItem(bleachFeatured);
assert.strictEqual(reportFeatured.valid, true, 'anime-bleach-tybw DEVE ser 100% válido na auditoria');
assert.strictEqual(reportFeatured.issues.filter(i => i.severity === 'CRITICAL').length, 0, 'Não deve haver issues críticas');

const reportVerified = catalogMetadataIntegrityAuditor.auditItem(bleachVerified);
assert.strictEqual(reportVerified.valid, true, 'anime-bleach-tvmeter DEVE ser 100% válido na auditoria');
assert.strictEqual(reportVerified.issues.filter(i => i.severity === 'CRITICAL').length, 0, 'Não deve haver issues críticas');

// Verificação de detecção contra um item adulterado
const adulteratedBleach: ContentItem = {
  ...bleachFeatured,
  aniListId: 114446, // Adulterado com Higurashi
  image: higurashiPoster
};
const reportAdulterated = catalogMetadataIntegrityAuditor.auditItem(adulteratedBleach);
assert.strictEqual(reportAdulterated.valid, false, 'Item adulterado DEVE falhar na auditoria');
const criticalIssues = reportAdulterated.issues.filter(i => i.severity === 'CRITICAL');
assert.ok(criticalIssues.length >= 2, 'Deve apontar no mínimo 2 violações críticas (ID e Capa de Higurashi)');
assert.ok(criticalIssues.some(i => i.message.includes('114446')), 'Deve alertar sobre o AniList ID 114446');
assert.ok(criticalIssues.some(i => i.message.includes('Higurashi')), 'Deve alertar sobre a capa de Higurashi');

console.log('✓ Teste 6 aprovado: CatalogMetadataIntegrityAuditor audita perfeitamente a integridade de Bleach TYBW.\n');

console.log('========================================================================');
console.log('TODOS OS TESTES DE INTEGRIDADE BLEACH vs HIGURASHI FORAM APROVADOS! 🚀');
console.log('========================================================================\n');
// As verificações são síncronas; serviços importados podem manter timers ativos.
process.exit(0);
