import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContentItem, ContentType } from '../types';
import { posterRecoveryService, isCorruptedPosterUrl } from '../src/core/catalog/PosterRecoveryService';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';

console.log('=== ZapiTV | Suíte Definitiva de Recuperação de Capas Oficiais Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// =========================================================================
// TESTE 1: Ausência Absoluta de URLs do Unsplash (Sala de Cinema / Poltronas Vermelhas)
// =========================================================================
console.log('1. Verificando ausência de URLs genéricas do Unsplash no código mobile...');

const filesToCheck = [
  path.join(projectRoot, 'src', 'components', 'mobile', 'MobileCard.tsx'),
  path.join(projectRoot, 'src', 'components', 'mobile', 'MobileRankedRow.tsx'),
  path.join(projectRoot, 'src', 'core', 'catalog', 'heroImageService.ts')
];

for (const filePath of filesToCheck) {
  const content = fs.readFileSync(filePath, 'utf8');
  assert(
    !content.includes('489599849927'),
    `[REGRESSÃO] Encontrada foto genérica do Unsplash no arquivo ${path.basename(filePath)}!`
  );
  assert(
    !content.includes('photo-1489599849927-2ee91cede3ba'),
    `[REGRESSÃO] Encontrado hash da foto de cinema no arquivo ${path.basename(filePath)}!`
  );
  console.log(`  ✓ ${path.basename(filePath)}: livre de fotos genéricas do Unsplash`);
}

// =========================================================================
// TESTE 2: Sanitização e Rejeição no isCorruptedPosterUrl
// =========================================================================
console.log('\n2. Verificando proteção contra URLs corrompidas / genéricas...');

const genericCinemaUrl = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300';
const genericUnsplash = 'https://images.unsplash.com/photo-1598970434795?w=600';
const validTmdb = 'https://image.tmdb.org/t/p/w500/2TwPJfPiBI2lVrofggw3H0b4cDC.jpg';

assert(isCorruptedPosterUrl(genericCinemaUrl), 'Deve classificar foto de cinema Unsplash como corrompida/inválida');
assert(isCorruptedPosterUrl(genericUnsplash), 'Deve classificar imagens do Unsplash como inválidas para capas');
assert(!isCorruptedPosterUrl(validTmdb), 'URL válida do TMDB deve ser aceita');
console.log('  ✓ isCorruptedPosterUrl rejeita rigorosamente Unsplash e aceita TMDB oficial');

// =========================================================================
// TESTE 3: Verificação dos 12 Títulos Obrigatórios no Catálogo
// =========================================================================
console.log('\n3. Verificando pôsteres oficiais dos 12 títulos solicitados...');

const requiredTitles = [
  { id: 'series-loki', title: 'Loki', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-the-mandalorian', title: 'The Mandalorian', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-ruptura', title: 'Ruptura', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-succession', title: 'Succession', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-the-last-of-us', title: 'The Last of Us', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-the-boys', title: 'The Boys', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-invencivel', title: 'Invencível', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-fallout', title: 'Fallout', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-yellowstone', title: 'Yellowstone', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-sob-pressao', title: 'Sob Pressão', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-os-outros', title: 'Os Outros', expectedPattern: /image\.tmdb\.org/ },
  { id: 'series-justica', title: 'Justiça', expectedPattern: /image\.tmdb\.org/ }
];

for (const req of requiredTitles) {
  const item = FEATURED_CATALOG_ITEMS.find(it => it.id === req.id);
  assert(item, `Título obrigatório não encontrado no catálogo: ${req.title} (${req.id})`);
  assert(item.image, `Título sem imagem definida: ${req.title}`);
  assert(req.expectedPattern.test(item.image), `URL da imagem não condizente com TMDB oficial: ${item.image}`);
  assert(!isCorruptedPosterUrl(item.image), `A imagem do item ${req.title} foi identificada como corrompida: ${item.image}`);
  console.log(`  ✓ ${req.title}: ${item.image}`);
}

// =========================================================================
// TESTE 4: Integração do MobileCard e MobileRankedRow com PosterRecoveryService
// =========================================================================
console.log('\n4. Verificando integração estrutural dos componentes mobile com posterRecoveryService...');

const mobileCardSource = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'mobile', 'MobileCard.tsx'), 'utf8');
const mobileRankedRowSource = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'mobile', 'MobileRankedRow.tsx'), 'utf8');

assert(mobileCardSource.includes('posterRecoveryService.getCachedPoster'), 'MobileCard deve usar getCachedPoster');
assert(mobileCardSource.includes('posterRecoveryService.recoverPoster'), 'MobileCard deve invocar recoverPoster');
assert(mobileCardSource.includes('posterRecoveryService.reportImageFailure'), 'MobileCard deve invocar reportImageFailure');
assert(mobileCardSource.includes('posterRecoveryService.subscribe'), 'MobileCard deve se inscrever no subscribe');
assert(mobileCardSource.includes('prevItemId !== item.id'), 'MobileCard deve ter sincronização síncrona no render');

assert(mobileRankedRowSource.includes('posterRecoveryService.getCachedPoster'), 'MobileRankedRow deve usar getCachedPoster');
assert(mobileRankedRowSource.includes('posterRecoveryService.recoverPoster'), 'MobileRankedRow deve invocar recoverPoster');
assert(mobileRankedRowSource.includes('posterRecoveryService.reportImageFailure'), 'MobileRankedRow deve invocar reportImageFailure');
assert(mobileRankedRowSource.includes('posterRecoveryService.subscribe'), 'MobileRankedRow deve se inscrever no subscribe');

console.log('  ✓ MobileCard e MobileRankedRow contêm todo o pipeline de recuperação resiliente');

// =========================================================================
// TESTE 5: Validação do Placeholder Institucional ZapiTV em Caso de Falha
// =========================================================================
console.log('\n5. Verificando renderização do placeholder nativo elegante da ZapiTV...');

assert(mobileCardSource.includes('bg-gradient-to-br from-[#0f172a]'), 'MobileCard deve renderizar gradiente institucional');
assert(mobileCardSource.includes('Play className="w-4 h-4 text-[#007df7]'), 'MobileCard deve exibir ícone de Play elegante da marca');
assert(mobileRankedRowSource.includes('bg-gradient-to-br from-[#0f172a]'), 'MobileRankedRow deve renderizar gradiente institucional');

console.log('  ✓ Placeholder institucional ZapiTV validado com sucesso');

console.log('\n=============================================================');
console.log('🎉 TODOS OS TESTES DE RECUPERAÇÃO DE PÔSTERES MOBILE PASSARAM!');
console.log('=============================================================\n');
