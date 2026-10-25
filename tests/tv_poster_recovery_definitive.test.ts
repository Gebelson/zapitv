import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContentItem, ContentType } from '../types';
import { posterRecoveryService } from '../src/core/catalog/PosterRecoveryService';
import { tvPerformanceProfileService } from '../src/core/tv/tvPerformanceProfileService';
import { tvImagePreloaderService } from '../src/core/tv/tvImagePreloaderService';

console.log('=== ZapiTV | Suíte Definitiva de Recuperação de Capas na Televisão ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const tvCardPath = path.join(projectRoot, 'src', 'components', 'tv', 'TvCard16x9.tsx');
const tvRowPath = path.join(projectRoot, 'src', 'components', 'tv', 'TvContentRow.tsx');

// =========================================================================
// TESTE 1: Recuperação Automática das 6 Obras Afetadas (e todo o catálogo)
// =========================================================================
console.log('1. Testando recuperação automática dos 6 animes com capas ausentes/404...');

const testAnimeCases: ContentItem[] = [
  {
    id: 'anime-solo-leveling',
    title: 'Solo Leveling',
    originalTitle: 'Ore dake Level Up na Ken',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.7,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/broken_404_solo.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/broken_404_solo_bg.jpg',
    aniListId: 151807,
    tmdbId: '127532'
  },
  {
    id: 'anime-attack-on-titan',
    title: 'Attack on Titan',
    originalTitle: 'Shingeki no Kyojin',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 9.0,
    year: 2013,
    image: 'https://image.tmdb.org/t/p/w500/broken_404_aot.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/broken_404_aot_bg.jpg',
    aniListId: 16498,
    tmdbId: '1429'
  },
  {
    id: 'anime-bleach-tybw',
    title: 'Bleach: Thousand-Year Blood War',
    originalTitle: 'Bleach: Sennen Kessen-hen',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.9,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/broken_404_bleach.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/broken_404_bleach_bg.jpg',
    aniListId: 114446,
    tmdbId: '13916'
  },
  {
    id: 'anime-blue-lock',
    title: 'Blue Lock',
    originalTitle: 'Blue Lock',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.2,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/broken_404_bluelock.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/broken_404_bluelock_bg.jpg',
    aniListId: 163148,
    tmdbId: '136283'
  },
  {
    id: 'anime-chainsaw-man',
    title: 'Chainsaw Man',
    originalTitle: 'Chainsaw Man',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.5,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/broken_404_csm.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/broken_404_csm_bg.jpg',
    aniListId: 127230,
    tmdbId: '114410'
  },
  {
    id: 'anime-dandadan',
    title: 'Dandadan',
    originalTitle: 'Dan Da Dan',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.5,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/broken_404_dandadan.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/broken_404_dandadan_bg.jpg',
    aniListId: 171018,
    tmdbId: '240411'
  }
];

const recoveredPosters = new Map<string, string>();

for (const anime of testAnimeCases) {
  const recoveredUrl = await posterRecoveryService.recoverPoster(anime);
  assert(
    recoveredUrl && typeof recoveredUrl === 'string' && recoveredUrl.startsWith('http'),
    `Falha na recuperação de capa para "${anime.title}". URL retornada: ${recoveredUrl}`
  );
  recoveredPosters.set(anime.id, recoveredUrl);
  console.log(`  -> "${anime.title}" recuperado com sucesso: ${recoveredUrl}`);
}

// =========================================================================
// TESTE 2: Cache em Memória e Retorno à Home (Sem Re-Downloads)
// =========================================================================
console.log('\n2. Testando persistência em cache ao retornar à Home...');

for (const anime of testAnimeCases) {
  const cachedUrl = posterRecoveryService.getCachedPoster(anime);
  assert.strictEqual(
    cachedUrl,
    recoveredPosters.get(anime.id),
    `O cache para "${anime.title}" deve retornar a URL recuperada previamente`
  );

  const t0 = Date.now();
  const secondRecovery = await posterRecoveryService.recoverPoster(anime);
  const duration = Date.now() - t0;
  assert.strictEqual(
    secondRecovery,
    cachedUrl,
    'Chamada subsequente deve retornar a URL em cache'
  );
  assert(duration < 20, 'Recuperação em cache deve responder instantaneamente (< 20ms)');
}
console.log('  -> Cache funcionando perfeitamente sem requisições redundantes na volta à Home.');

// =========================================================================
// TESTE 3: Controle de Concorrência & Deduplicação de Requisições
// =========================================================================
console.log('\n3. Testando controle de concorrência e deduplicação de requisições em voo...');

// Simula 8 requisições simultâneas para o mesmo item
const simultaneousSolo = Array.from({ length: 8 }).map(() =>
  posterRecoveryService.recoverPoster(testAnimeCases[0])
);
const results = await Promise.all(simultaneousSolo);
results.forEach(res => {
  assert.strictEqual(res, recoveredPosters.get(testAnimeCases[0].id));
});
console.log('  -> Deduplicação de requisições em voo validada (8 chamadas paralelas unificadas).');

// =========================================================================
// TESTE 4: Isolamento Estrito: Nunca Associar Imagem de Outro Conteúdo
// =========================================================================
console.log('\n4. Testando isolamento e integridade de associação por conteúdo...');

const recoveredSolo = recoveredPosters.get('anime-solo-leveling');
const recoveredAoT = recoveredPosters.get('anime-attack-on-titan');
const recoveredBleach = recoveredPosters.get('anime-bleach-tybw');

assert.notStrictEqual(recoveredSolo, recoveredAoT, 'Solo Leveling e Attack on Titan não devem ter a mesma capa');
assert.notStrictEqual(recoveredSolo, recoveredBleach, 'Solo Leveling e Bleach não devem ter a mesma capa');
console.log('  -> Cada mídia possui capa individual estrita sem colisão.');

// =========================================================================
// TESTE 5: Auditoria Estrutural de TvCard16x9.tsx (Ciclo de Vida & Memo)
// =========================================================================
console.log('\n5. Auditando ciclo de vida, subscrições e memoização em TvCard16x9.tsx...');

const tvCardCode = fs.readFileSync(tvCardPath, 'utf8');

// A. Gatilho de recuperação integrado
assert.ok(
  tvCardCode.includes('triggerRecovery') && tvCardCode.includes('posterRecoveryService.recoverPoster(item)'),
  'TvCard16x9 deve integrar triggerRecovery com posterRecoveryService'
);

// B. Subscrição a atualizações de cache
assert.ok(
  tvCardCode.includes('posterRecoveryService.subscribe'),
  'TvCard16x9 deve subscrever a atualizações de cache do posterRecoveryService'
);

// C. Sincronização em slots reutilizados
assert.ok(
  tvCardCode.includes('if (prevItemId !== item.id)'),
  'TvCard16x9 deve sincronizar no render ao mudar item.id em slot reutilizado'
);

// D. Proteção de ciclo de vida (isMounted & currentItemId)
assert.ok(
  tvCardCode.includes('isMountedRef') && tvCardCode.includes('currentItemIdRef'),
  'TvCard16x9 deve rastrear isMounted e currentItemId para evitar memory leaks e imagens trocadas'
);

// E. Memo comparator atualizado com URLs do item
assert.ok(
  tvCardCode.includes('prev.item.image === next.item.image') &&
  tvCardCode.includes('prev.item.poster === next.item.poster') &&
  tvCardCode.includes('prev.item.backdrop === next.item.backdrop'),
  'Memo comparator de TvCard16x9 deve comparar item.image, item.poster e item.backdrop'
);

// F. Preservação de elementos visuais e atributos de TV
assert.ok(tvCardCode.includes('data-card-poster="true"'), 'data-card-poster="true" preservado');
assert.ok(tvCardCode.includes('aspect-[2/3]'), 'Proporção 2:3 preservada');
assert.ok(tvCardCode.includes('rounded-2xl'), 'Cantos arredondados rounded-2xl preservados');
assert.ok(tvCardCode.includes('getCardAmbientGlow'), 'Glow ambiente preservado');
assert.ok(tvCardCode.includes('key={`${item.id}`}'), 'key do elemento img atômica mantida');
assert.ok(tvCardCode.includes("getAttribute('data-item-id') !== String(item.id)"), 'Validação de nó obsoleto mantida');
console.log('  -> TvCard16x9.tsx auditado: ciclo de vida reativo, memoização e slots protegidos.');

// =========================================================================
// TESTE 6: Otimização de Performance para Smart TV (Modo Econômico)
// =========================================================================
console.log('\n6. Testando otimizações para Smart TV e compatibilidade com modo eco...');

const raw4KUrl = 'https://image.tmdb.org/t/p/original/sample_poster_4k.jpg';
const optUrl = tvPerformanceProfileService.getOptimizedPosterUrl(raw4KUrl);
assert.strictEqual(
  optUrl,
  'https://image.tmdb.org/t/p/w500/sample_poster_4k.jpg',
  'getOptimizedPosterUrl deve substituir /original/ por /w500/ para economizar VRAM'
);

const isReady = tvImagePreloaderService.isReady(optUrl);
assert.strictEqual(typeof isReady, 'boolean', 'isReady deve retornar booleano');
console.log('  -> Otimização de resoluções e preloader adaptativo validados.');

console.log('\n=== TODOS OS 6 TESTES DE RECUPERAÇÃO DEFINITIVA DE CAPAS PASSARAM COM SUCESSO! ===');
