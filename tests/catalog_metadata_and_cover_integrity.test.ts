import assert from 'node:assert';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import {
  posterRecoveryService,
  isCorruptedPosterUrl,
  CORRUPTED_POSTER_FRAGMENTS
} from '../src/core/catalog/PosterRecoveryService';
import { heroImageService } from '../src/core/catalog/heroImageService';
import { isValidHeroImageUrl } from '../src/core/catalog/heroCarouselStore';
import { catalogMetadataIntegrityAuditor } from '../src/core/catalog/CatalogMetadataIntegrityAuditor';
import { monthlyFeaturedRankingService } from '../src/core/rankings/MonthlyFeaturedRankingService';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { ContentType } from '../types';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TESTE DE INTEGRIDADE DE METADADOS E CAPA DE FRIEREN (ZAPITV) ===\n');

// --------------------------------------------------------------------------
// TESTE 1: Verificação da Correção do Registro Original de Frieren
// --------------------------------------------------------------------------
console.log('[Teste 1] Verificando registro de Frieren em featuredCatalogItems.ts...');
const frieren = FEATURED_CATALOG_ITEMS.find(i => i.id === 'anime-frieren');
assert.ok(frieren, 'Item anime-frieren DEVE existir em FEATURED_CATALOG_ITEMS');

assert.strictEqual(frieren.title, "Frieren: Beyond Journey's End");
assert.strictEqual(frieren.originalTitle, 'Sousou no Frieren');
assert.strictEqual(frieren.type, ContentType.ANIME);
assert.strictEqual(frieren.year, 2023);
assert.strictEqual(frieren.aniListId, 154587);
assert.strictEqual(String(frieren.tmdbId), '209867');
assert.strictEqual(frieren.malId, 52991);

// Imagens Oficiais
assert.strictEqual(frieren.image, 'https://image.tmdb.org/t/p/w500/qykTIEJQF8cunKD0CKOqab15wns.jpg');
assert.strictEqual(frieren.backdrop, 'https://image.tmdb.org/t/p/original/rBOnrVlck7BIlGeWVlzYiZeg4l2.jpg');

// Proibição expressa de Spider-Man
assert.ok(!frieren.image.includes('dqZENchTd7lp5zht7BdlqM7RBPd'), 'Pôster NÃO deve ser de Homem-Aranha');
assert.ok(!frieren.backdrop.includes('4HodYYKEIsGOdinkGi2Ucz6X9i0'), 'Backdrop NÃO deve ser de Homem-Aranha');

// Miniatura do episódio 1
assert.ok(Array.isArray(frieren.episodes) && frieren.episodes.length > 0, 'Frieren deve ter episódios');
const ep1 = frieren.episodes[0];
assert.strictEqual(ep1.id, 'frieren-s1e1');
assert.strictEqual(ep1.number, 1);
assert.strictEqual(ep1.image, 'https://image.tmdb.org/t/p/w500/7SfqQVmW125ugsktoRVTnRXpAkd.jpg');
assert.notStrictEqual(ep1.image, frieren.image, 'A imagem do episódio NÃO deve reutilizar automaticamente o pôster vertical');
assert.ok(!ep1.image?.includes('dqZENchTd7lp5zht7BdlqM7RBPd'), 'Episódio NÃO deve conter imagem de Homem-Aranha');

console.log('✓ Teste 1 aprovado: Registro de Frieren contém todos os metadados e imagens oficiais corretos.\n');

// --------------------------------------------------------------------------
// TESTE 2: Auditoria de Detecção e Bloqueio em PosterRecoveryService
// --------------------------------------------------------------------------
console.log('[Teste 2] Verificando proteção contra URLs corrompidas no PosterRecoveryService...');
const spiderPoster = 'https://image.tmdb.org/t/p/w500/dqZENchTd7lp5zht7BdlqM7RBPd.jpg';
const spiderBackdrop = 'https://image.tmdb.org/t/p/original/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg';

assert.ok(CORRUPTED_POSTER_FRAGMENTS.includes('dqZENchTd7lp5zht7BdlqM7RBPd'), 'Fragmento dqZENch DEVE estar em CORRUPTED_POSTER_FRAGMENTS');
assert.ok(CORRUPTED_POSTER_FRAGMENTS.includes('4HodYYKEIsGOdinkGi2Ucz6X9i0'), 'Fragmento 4HodYYKE DEVE estar em CORRUPTED_POSTER_FRAGMENTS');

assert.strictEqual(isCorruptedPosterUrl(spiderPoster), true, 'isCorruptedPosterUrl DEVE bloquear pôster de Spider-Man em Frieren');
assert.strictEqual(isCorruptedPosterUrl(spiderBackdrop), true, 'isCorruptedPosterUrl DEVE bloquear backdrop de Spider-Man em Frieren');
assert.strictEqual(isCorruptedPosterUrl(frieren.image), false, 'isCorruptedPosterUrl NÃO deve bloquear pôster oficial de Frieren');

// Injeção de cache corrompido e verificação de saneamento
(posterRecoveryService as any).memoryCache.set('id:anime-frieren', {
  url: spiderPoster,
  status: 'verified',
  timestamp: Date.now()
});

// getCachedPoster deve recusar e expurgar a entrada corrompida
const cached = posterRecoveryService.getCachedPoster(frieren);
assert.notStrictEqual(cached, spiderPoster, 'getCachedPoster NUNCA deve retornar a URL corrompida de Homem-Aranha');

posterRecoveryService.sanitizeKnownCorruptedImages();
assert.strictEqual((posterRecoveryService as any).memoryCache.has('id:anime-frieren'), false, 'sanitizeKnownCorruptedImages deve ter eliminado a chave corrompida');

console.log('✓ Teste 2 aprovado: PosterRecoveryService rejeita e expurga URLs corrompidas ativamente.\n');

// --------------------------------------------------------------------------
// TESTE 3: Verificação dos Serviços de Banner e Hero (heroImageService e heroCarouselStore)
// --------------------------------------------------------------------------
console.log('[Teste 3] Verificando validação de imagens no heroImageService e heroCarouselStore...');
assert.strictEqual(isValidHeroImageUrl(spiderPoster), false, 'isValidHeroImageUrl DEVE rejeitar pôster de Homem-Aranha');
assert.strictEqual(isValidHeroImageUrl(spiderBackdrop), false, 'isValidHeroImageUrl DEVE rejeitar backdrop de Homem-Aranha');
assert.strictEqual(isValidHeroImageUrl(frieren.backdrop), true, 'isValidHeroImageUrl DEVE aceitar backdrop oficial de Frieren');

assert.strictEqual(heroImageService.isUrlFailed(spiderPoster), true, 'heroImageService DEVE considerar URL corrompida como falha imediata');
assert.strictEqual(heroImageService.isUrlFailed(spiderBackdrop), true, 'heroImageService DEVE considerar backdrop corrompido como falha imediata');

console.log('✓ Teste 3 aprovado: Serviços de Hero blindados contra uso de imagens corrompidas.\n');

// --------------------------------------------------------------------------
// TESTE 4: Auditoria dos Arquivos JSON de Cache Persistente em Disco
// --------------------------------------------------------------------------
console.log('[Teste 4] Auditando persistência em disco de dados semanais e mensais...');
const weeklyPath = path.resolve('data', 'featured_weekly_selection.json');
const monthlyPath = path.resolve('data', 'monthly_featured_rankings.json');

const weeklyContent = fs.readFileSync(weeklyPath, 'utf-8');
const monthlyContent = fs.readFileSync(monthlyPath, 'utf-8');

assert.ok(!weeklyContent.includes('dqZENchTd7lp5zht7BdlqM7RBPd'), 'featured_weekly_selection.json NÃO deve conter dqZENchTd7lp5zht7BdlqM7RBPd');
assert.ok(!weeklyContent.includes('4HodYYKEIsGOdinkGi2Ucz6X9i0'), 'featured_weekly_selection.json NÃO deve conter 4HodYYKEIsGOdinkGi2Ucz6X9i0');

assert.ok(!monthlyContent.includes('dqZENchTd7lp5zht7BdlqM7RBPd'), 'monthly_featured_rankings.json NÃO deve conter dqZENchTd7lp5zht7BdlqM7RBPd');
assert.ok(!monthlyContent.includes('4HodYYKEIsGOdinkGi2Ucz6X9i0'), 'monthly_featured_rankings.json NÃO deve conter 4HodYYKEIsGOdinkGi2Ucz6X9i0');

// Confirma presença da capa oficial nos arquivos JSON
assert.ok(weeklyContent.includes('qykTIEJQF8cunKD0CKOqab15wns.jpg'), 'featured_weekly_selection.json DEVE conter o pôster oficial');
assert.ok(monthlyContent.includes('qykTIEJQF8cunKD0CKOqab15wns.jpg'), 'monthly_featured_rankings.json DEVE conter o pôster oficial');
assert.ok(weeklyContent.includes('7SfqQVmW125ugsktoRVTnRXpAkd.jpg'), 'featured_weekly_selection.json DEVE conter a miniatura do ep 1');
assert.ok(monthlyContent.includes('7SfqQVmW125ugsktoRVTnRXpAkd.jpg'), 'monthly_featured_rankings.json DEVE conter a miniatura do ep 1');

console.log('✓ Teste 4 aprovado: Todos os arquivos persistentes em disco estão saneados e com metadados oficiais.\n');

// --------------------------------------------------------------------------
// TESTE 5: Auditoria Reutilizável de Integridade (CatalogMetadataIntegrityAuditor)
// --------------------------------------------------------------------------
console.log('[Teste 5] Executando CatalogMetadataIntegrityAuditor em FEATURED_CATALOG_ITEMS...');
const auditReport = catalogMetadataIntegrityAuditor.auditCatalog(FEATURED_CATALOG_ITEMS);

console.log(`  -> Total de obras auditadas: ${auditReport.totalAudited}`);
console.log(`  -> Obras 100% válidas: ${auditReport.totalValid}`);
console.log(`  -> Obras com erros críticos: ${auditReport.totalCritical}`);
console.log(`  -> Alertas secundários: ${auditReport.totalWarnings}`);

assert.strictEqual(auditReport.totalCritical, 0, 'Catálogo de destaque NÃO deve possuir erros críticos de integridade');

// Teste de sensibilidade do auditor com injeção de erro
const mockCorruptedFrieren = {
  ...frieren,
  image: spiderPoster
};
const mockReport = catalogMetadataIntegrityAuditor.auditItem(mockCorruptedFrieren);
assert.strictEqual(mockReport.valid, false, 'Auditor DEVE acusar erro caso Frieren receba pôster incorreto');
assert.ok(mockReport.issues.some(i => i.category === 'IMAGE_MISMATCH'), 'Auditor DEVE categorizar como IMAGE_MISMATCH');

console.log('✓ Teste 5 aprovado: Auditor reutilizável validou 100% do catálogo e detecta anomalias com precisão.\n');

// --------------------------------------------------------------------------
// TESTE 6: Simulação de Sanitização de Cache sem Perda de Dados do Usuário
// --------------------------------------------------------------------------
console.log('[Teste 6] Testando sanitização de cache em rankings sem reset do storage...');
// Simula snapshot legado carregado com a imagem antiga de Frieren
const mockSnapshot: any = {
  monthKey: '2026-10',
  animes: [
    {
      position: 6,
      canonicalId: 'anime:anilist:154587',
      title: "Frieren: Beyond Journey's End",
      poster: spiderPoster,
      backdrop: spiderBackdrop,
      item: {
        id: 'anime-frieren',
        image: spiderPoster,
        backdrop: spiderBackdrop,
        episodes: [{ id: 'frieren-s1e1', image: spiderPoster }]
      }
    }
  ]
};

(monthlyFeaturedRankingService as any).sanitizeSnapshot(mockSnapshot);
assert.strictEqual(mockSnapshot.animes[0].poster, frieren.image, 'Pôster legado no snapshot deve ser corrigido automaticamente');
assert.strictEqual(mockSnapshot.animes[0].backdrop, frieren.backdrop, 'Backdrop legado no snapshot deve ser corrigido automaticamente');
assert.strictEqual(mockSnapshot.animes[0].item.image, frieren.image, 'Item.image legado no snapshot deve ser corrigido');
assert.strictEqual(mockSnapshot.animes[0].item.episodes[0].image, ep1.image, 'Episódio legado no snapshot deve ter miniatura real');

console.log('✓ Teste 6 aprovado: Sanitização reativa corrige entradas obsoletas preservando posições e estado do usuário.\n');

console.log('========================================================================');
console.log(' TODOS OS 6 TESTES DE INTEGRIDADE DA CAPA DE FRIEREN PASSARAM! ');
console.log('========================================================================');

process.exit(0);
