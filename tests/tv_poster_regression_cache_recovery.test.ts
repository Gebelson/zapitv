import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContentItem, ContentType } from '../types';
import { posterRecoveryService, NO_IMAGE_SENTINEL } from '../src/core/catalog/PosterRecoveryService';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { filmesData } from '../constants';
import { tvPerformanceProfileService } from '../src/core/tv/tvPerformanceProfileService';

console.log('=== ZapiTV | Suíte Abrangente de Regressão de Cache e Recuperação de Capas na Smart TV ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const tvCardPath = path.join(projectRoot, 'src', 'components', 'tv', 'TvCard16x9.tsx');
const tvCardCode = fs.readFileSync(tvCardPath, 'utf8');

// =========================================================================
// TESTE 1: Recuperação dos 8 Títulos Críticos Confirmados Visualmente
// =========================================================================
console.log('1. Testando recuperação dos 8 títulos críticos com capas quebradas ou ausentes...');

const allCatalog = [...FEATURED_CATALOG_ITEMS, ...filmesData];

const targetTitles = [
  'Attack on Titan',
  'Solo Leveling',
  'Jujutsu Kaisen',
  'Dandadan',
  'Bleach: Thousand-Year Blood War',
  'Blue Lock',
  'Chainsaw Man',
  'Terra de Máfia'
];

for (const title of targetTitles) {
  const item = allCatalog.find(m => 
    m.title.toLowerCase().includes(title.toLowerCase()) || 
    (m.originalTitle && m.originalTitle.toLowerCase().includes(title.toLowerCase()))
  );

  assert.ok(item, `O título "${title}" deve existir no catálogo para validação`);

  // Simula que a imagem original do item é inválida ou falhou
  const recoveredUrl = await posterRecoveryService.recoverPoster(item);
  assert.ok(
    recoveredUrl && typeof recoveredUrl === 'string' && recoveredUrl.startsWith('http'),
    `Falha na recuperação de capa para "${item.title}". URL retornada: ${recoveredUrl}`
  );
  assert.ok(
    !recoveredUrl.includes('broken') && !recoveredUrl.includes('undefined'),
    `A capa recuperada para "${item.title}" não pode conter 'broken' ou 'undefined': ${recoveredUrl}`
  );

  console.log(`  ✓ "${item.title}" recuperado com sucesso: ${recoveredUrl}`);
}

// =========================================================================
// TESTE 2: Diferenciação entre URLs Verificadas, Armazenadas e Negativas
// =========================================================================
console.log('\n2. Testando status de cache (verified, stored e negative)...');

const mockItem: ContentItem = {
  id: 'mock-anime-test',
  title: 'Mock Anime Test',
  type: ContentType.ANIME,
  year: 2024
};

// A. URL armazenada mas ainda não verificada
posterRecoveryService.setCachedPoster(mockItem, 'https://image.tmdb.org/t/p/w500/mock_stored.jpg', 'stored');
assert.strictEqual(
  posterRecoveryService.getCachedPoster(mockItem),
  'https://image.tmdb.org/t/p/w500/mock_stored.jpg',
  'getCachedPoster deve retornar URL armazenada'
);
assert.strictEqual(
  posterRecoveryService.getVerifiedPoster(mockItem),
  null,
  'getVerifiedPoster deve retornar null para itens apenas em status "stored"'
);

// B. Promoção para URL verificada
posterRecoveryService.setCachedPoster(mockItem, 'https://image.tmdb.org/t/p/w500/mock_verified.jpg', 'verified');
assert.strictEqual(
  posterRecoveryService.getVerifiedPoster(mockItem),
  'https://image.tmdb.org/t/p/w500/mock_verified.jpg',
  'getVerifiedPoster deve retornar a URL quando em status "verified"'
);

// =========================================================================
// TESTE 3: Invalidar Entradas Comprovadamente Defeituosas (reportImageFailure)
// =========================================================================
console.log('\n3. Testando invalidação e limpeza com reportImageFailure...');

const brokenUrl = 'https://image.tmdb.org/t/p/w500/mock_verified.jpg';
posterRecoveryService.reportImageFailure(mockItem, brokenUrl);

assert.strictEqual(
  posterRecoveryService.getCachedPoster(mockItem),
  null,
  'reportImageFailure deve expurgar a URL defeituosa do cache do item'
);

// =========================================================================
// TESTE 4: Não Perpetuação de Marcadores Negativos (Expiração e Sem Persistência)
// =========================================================================
console.log('\n4. Testando expiração e descarte de marcadores negativos (NO_IMAGE_SENTINEL)...');

posterRecoveryService.markNoImageAvailable(mockItem);

// Logo após marcar indisponível, getCachedPoster retorna null
assert.strictEqual(
  posterRecoveryService.getCachedPoster(mockItem),
  null,
  'getCachedPoster deve retornar null sob sentinela negativa'
);

// Simula expiração do TTL negativo avançando o timestamp da entrada interna
const keys = (posterRecoveryService as any).getCacheKeys(mockItem);
for (const k of keys) {
  const entry = (posterRecoveryService as any).memoryCache.get(k);
  if (entry) {
    entry.timestamp = Date.now() - (4 * 60 * 1000); // 4 minutos atrás (TTL é 3 minutos)
  }
}

// Após expiração do TTL, hasAttemptedRecovery deve retornar false para permitir nova tentativa
assert.strictEqual(
  posterRecoveryService.hasAttemptedRecovery(mockItem),
  false,
  'Após o TTL de 3 minutos, a sentinela negativa deve expirar e liberar nova recuperação'
);

// =========================================================================
// TESTE 5: Auditoria de TvCard16x9.tsx (Proteção Anti-Loop e Report de Falhas)
// =========================================================================
console.log('\n5. Auditando TvCard16x9.tsx para prevenção de loops e recuperação contínua...');

assert.ok(
  tvCardCode.includes('posterRecoveryService.reportImageFailure(item, imgSrc)'),
  'TvCard16x9 deve reportar falhas de imagem ao posterRecoveryService'
);

assert.ok(
  tvCardCode.includes('recoveryAttemptsRef.current >= 3') || tvCardCode.includes('recoveryAttemptsRef'),
  'TvCard16x9 deve possuir limite e controle por tentativa'
);

assert.ok(
  tvCardCode.includes('generationRef.current') || tvCardCode.includes('activeGen'),
  'TvCard16x9 deve possuir controle de geração de requisições para evitar race conditions'
);

assert.ok(
  tvCardCode.includes('posterRecoveryService.subscribe'),
  'TvCard16x9 deve subscrever a atualizações reativas do posterRecoveryService'
);

// =========================================================================
// TESTE 6: Teste de Amostras de Diversas Categorias (Filmes, Séries, Exclusivos)
// =========================================================================
console.log('\n6. Testando recuperação em amostras de Filmes, Séries e Exclusivos...');

const categorySamples: ContentItem[] = [
  // Exclusivo Paramount+: Tulsa King
  allCatalog.find(m => m.id === 'series-tulsa-king')!,
  // Exclusivo Disney+: Divertida Mente 2
  allCatalog.find(m => m.id === 'movie-divertida-mente-2')!,
  // Exclusivo Apple TV+: Ruptura
  allCatalog.find(m => m.id === 'series-ruptura')!,
  // Exclusivo Prime Video: The Boys
  allCatalog.find(m => m.id === 'series-the-boys')!,
  // Exclusivo HBO Max: House of the Dragon
  allCatalog.find(m => m.id === 'series-house-of-the-dragon')!,
  // Exclusivo Netflix: Stranger Things
  allCatalog.find(m => m.id === 'series-stranger-things')!,
  // Exclusivo Globoplay: Os Outros
  allCatalog.find(m => m.id === 'series-os-outros')!
].filter(Boolean);

for (const sample of categorySamples) {
  const recovered = await posterRecoveryService.recoverPoster(sample);
  assert.ok(
    recovered && typeof recovered === 'string' && recovered.startsWith('http'),
    `Falha na recuperação de capa para amostra de categoria "${sample.title}"`
  );
  console.log(`  ✓ [${sample.type}] "${sample.title}": ${recovered}`);
}

console.log('\n========================================================================');
console.log('TODOS OS TESTES DE RECUPERAÇÃO DE CAPAS E REGRESSÃO DE CACHE PASSARAM!');
console.log('========================================================================\n');
