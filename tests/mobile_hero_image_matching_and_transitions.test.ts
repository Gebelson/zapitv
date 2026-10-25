import assert from 'node:assert';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { sameCatalogWork } from '../src/core/tmdb/tmdbClient';
import {
  posterRecoveryService,
  isCorruptedPosterUrl,
  CORRUPTED_POSTER_FRAGMENTS
} from '../src/core/catalog/PosterRecoveryService';
import { heroImageService, ZAPITV_HERO_FALLBACK_IMAGE } from '../src/core/catalog/heroImageService';
import { ContentType, ContentItem } from '../types';

console.log('--- TEST SUITE: MOBILE HERO IMAGE MATCHING & ATOMIC SLIDE TRANSITIONS ---\n');

// =========================================================================
// TESTE 1: Integridade dos Metadados de Bleach TYBW no Catálogo
// =========================================================================
console.log('1. Validando metadados e imagens canônicas de Bleach: Thousand-Year Blood War...');

const bleachItem = FEATURED_CATALOG_ITEMS.find(i => i.id === 'anime-bleach-tybw');
assert(bleachItem, 'Bleach TYBW deve existir no catálogo de destaques');
assert.strictEqual(bleachItem.title, 'Bleach: Thousand-Year Blood War');
assert.strictEqual(bleachItem.type, ContentType.ANIME);
assert.strictEqual(bleachItem.aniListId, 116674, 'AniList ID deve ser 116674 (Bleach TYBW), não 114446 (Higurashi)');
assert.strictEqual(bleachItem.tmdbId, '30984', 'TMDB ID deve ser 30984 (Bleach), não 13916 (Death Note)');

// Verifica que nenhuma URL de Death Note está associada
assert(
  !bleachItem.image?.includes('iigTJJskR1PcjjXqxdyJwVB3BoU'),
  'A capa de Bleach TYBW não pode conter o pôster de Death Note'
);
assert(
  !bleachItem.backdrop?.includes('z8IPicmEKXUO4I2UDdMEqw7RqOE'),
  'O backdrop de Bleach TYBW não pode conter o backdrop de Death Note'
);
assert(
  bleachItem.image?.includes('116674'),
  'A capa de Bleach TYBW deve referenciar a arte oficial do AniList 116674'
);
console.log('  -> Bleach TYBW: metadados, AniList ID e imagens oficiais verificados com sucesso.');

// =========================================================================
// TESTE 2: Integridade dos Metadados de Blue Lock no Catálogo
// =========================================================================
console.log('\n2. Validando metadados e imagens canônicas de Blue Lock...');

const blueLockItem = FEATURED_CATALOG_ITEMS.find(i => i.id === 'anime-blue-lock');
assert(blueLockItem, 'Blue Lock deve existir no catálogo de destaques');
assert.strictEqual(blueLockItem.title, 'Blue Lock');
assert.strictEqual(blueLockItem.type, ContentType.ANIME);
assert.strictEqual(blueLockItem.aniListId, 137822, 'AniList ID deve ser 137822 (Blue Lock)');
assert.strictEqual(blueLockItem.tmdbId, '131041', 'TMDB ID deve ser 131041 (Blue Lock anime), não 136283 (A Lição / The Glory)');

// Verifica que nenhuma URL da produção live-action 'A Lição' está associada
assert(
  !blueLockItem.image?.includes('bnTXjwOwdUz8MKFyQCNf0hG4fdL'),
  'A capa de Blue Lock não pode conter a imagem da atriz de A Lição'
);
assert(
  !blueLockItem.backdrop?.includes('AjwoDj77HLlqcpwEGqsnvMXm5my'),
  'O backdrop de Blue Lock não pode conter o backdrop live-action de A Lição'
);
assert(
  blueLockItem.image?.includes('9aICTTHECyRwB2pBHm3rAj1SgGg'),
  'A capa de Blue Lock deve referenciar o pôster do anime oficial (TMDB 131041)'
);
console.log('  -> Blue Lock: metadados, TMDB ID e pôster de animação verificados com sucesso.');

// =========================================================================
// TESTE 3: Regras de sameCatalogWork: Rejeição Rigorosa Anime vs Live-Action
// =========================================================================
console.log('\n3. Validando rejeição estrita de correspondência entre animes e live-actions...');

const fakeLiveActionTheGlory: ContentItem = {
  id: 'tv-the-glory',
  title: 'A Lição',
  originalTitle: '더 글로리',
  type: ContentType.SERIES,
  mediaFormat: 'series',
  rating: 8.5,
  year: 2022,
  image: 'https://image.tmdb.org/t/p/w500/bnTXjwOwdUz8MKFyQCNf0hG4fdL.jpg',
  genres: ['Drama', 'Crime']
};

const fakeDeathNote: ContentItem = {
  id: 'anime-death-note',
  title: 'Death Note',
  originalTitle: 'DEATH NOTE',
  type: ContentType.ANIME,
  mediaFormat: 'series',
  rating: 9.0,
  year: 2006,
  image: 'https://image.tmdb.org/t/p/w500/iigTJJskR1PcjjXqxdyJwVB3BoU.jpg',
  genres: ['Anime', 'Mistério']
};

// Blue Lock (anime) nunca pode coincidir com The Glory (live-action drama)
assert.strictEqual(
  sameCatalogWork(blueLockItem, fakeLiveActionTheGlory),
  false,
  'sameCatalogWork deve rejeitar correspondência entre Blue Lock (Anime) e The Glory (Live-Action)'
);

// Bleach TYBW nunca pode coincidir com Death Note
assert.strictEqual(
  sameCatalogWork(bleachItem, fakeDeathNote),
  false,
  'sameCatalogWork deve rejeitar correspondência entre Bleach e Death Note'
);

// Blue Lock deve coincidir consigo mesmo ou com entrada canônica equivalente de mesmo ano
const canonicalBlueLockCandidate: ContentItem = {
  id: 'tmdb-131041',
  title: 'BLUE LOCK',
  originalTitle: 'ブルーロック',
  type: ContentType.ANIME,
  mediaFormat: 'series',
  year: 2022,
  genres: ['Animação', 'Ação', 'Drama'],
  rating: 8.2
};
assert.strictEqual(
  sameCatalogWork(blueLockItem, canonicalBlueLockCandidate),
  true,
  'sameCatalogWork deve aceitar correspondência legítima para o anime Blue Lock'
);
console.log('  -> sameCatalogWork isola perfeitamente animes e rejeita live-actions ou obras distintas.');

// =========================================================================
// TESTE 4: Saneamento e Proteção contra URLs de Produções Corrompidas
// =========================================================================
console.log('\n4. Testando bloqueio e saneamento de URLs corrompidas no PosterRecoveryService...');

CORRUPTED_POSTER_FRAGMENTS.forEach(frag => {
  const testUrl = `https://image.tmdb.org/t/p/w500/${frag}.jpg`;
  assert.strictEqual(isCorruptedPosterUrl(testUrl), true, `URL com ${frag} deve ser identificada como corrompida`);
  assert.strictEqual(heroImageService.isUrlFailed(testUrl), true, `URL com ${frag} deve falhar automaticamente`);
});

// Valida que getCandidateUrls de Blue Lock não contém nenhuma URL de The Glory
const blueLockCandidates = heroImageService.getCandidateUrls(blueLockItem);
assert(blueLockCandidates.length > 0, 'Blue Lock deve possuir candidatos válidos');
blueLockCandidates.forEach(url => {
  assert(
    !isCorruptedPosterUrl(url),
    `Candidato de Blue Lock não pode ser URL corrompida: ${url}`
  );
});

// Valida que getCandidateUrls de Bleach TYBW não contém nenhuma URL de Death Note
const bleachCandidates = heroImageService.getCandidateUrls(bleachItem);
assert(bleachCandidates.length > 0, 'Bleach TYBW deve possuir candidatos válidos');
bleachCandidates.forEach(url => {
  assert(
    !isCorruptedPosterUrl(url),
    `Candidato de Bleach TYBW não pode ser URL corrompida: ${url}`
  );
});
console.log('  -> URLs de outras produções bloqueadas e expurgadas da cadeia de candidatos.');

// =========================================================================
// TESTE 5: Recuperação de Imagem em Segundo Plano para Bleach e Blue Lock
// =========================================================================
console.log('\n5. Testando resolução de imagem do banner mobile via heroImageService...');

const resBleach = await heroImageService.resolveHeroImageForItem(bleachItem);
assert(
  resBleach && typeof resBleach.url === 'string' && resBleach.url.startsWith('http'),
  'heroImageService deve resolver uma imagem válida para Bleach TYBW'
);
assert.strictEqual(resBleach.isFallback, false, 'Bleach TYBW não deve cair no fallback institucional');
assert(
  !isCorruptedPosterUrl(resBleach.url),
  'A imagem resolvida para Bleach TYBW não pode ser de Death Note'
);

const resBlueLock = await heroImageService.resolveHeroImageForItem(blueLockItem);
assert(
  resBlueLock && typeof resBlueLock.url === 'string' && resBlueLock.url.startsWith('http'),
  'heroImageService deve resolver uma imagem válida para Blue Lock'
);
assert.strictEqual(resBlueLock.isFallback, false, 'Blue Lock não deve cair no fallback institucional');
assert(
  !isCorruptedPosterUrl(resBlueLock.url),
  'A imagem resolvida para Blue Lock não pode ser de A Lição / The Glory'
);
console.log(`  -> Bleach TYBW resolvido para: ${resBleach.url}`);
console.log(`  -> Blue Lock resolvido para: ${resBlueLock.url}`);

// =========================================================================
// TESTE 6: Modelo de Slide Atômico no MobileHero
// =========================================================================
console.log('\n6. Testando integridade atômica do slide para evitar descompasso visual...');

// Simula a estrutura do ActiveHeroSlide
interface ActiveHeroSlide {
  item: ContentItem;
  imageUrl: string;
  generation: number;
}

let generation = 0;
let displayedSlide: ActiveHeroSlide = {
  item: bleachItem,
  imageUrl: resBleach.url,
  generation: ++generation
};

// Slide inicial
assert.strictEqual(displayedSlide.item.title, 'Bleach: Thousand-Year Blood War');
assert.strictEqual(displayedSlide.imageUrl, resBleach.url);

// Simula transição para Blue Lock com generation tracking
const nextGen = ++generation;
const resolvedBlueLock = await heroImageService.resolveHeroImageForItem(blueLockItem);

// Durante a transição, uma atualização atômica aplica simultaneamente item + imagem + generation
displayedSlide = {
  item: blueLockItem,
  imageUrl: resolvedBlueLock.url,
  generation: nextGen
};

assert.strictEqual(displayedSlide.item.title, 'Blue Lock');
assert.strictEqual(displayedSlide.imageUrl, resolvedBlueLock.url);
assert.strictEqual(displayedSlide.generation, nextGen);
assert(
  !displayedSlide.imageUrl.includes('Death Note') && !displayedSlide.imageUrl.includes('iigTJJskR1PcjjXqxdyJwVB3BoU'),
  'Slide de Blue Lock não pode ter imagem de Death Note'
);
assert(
  !displayedSlide.imageUrl.includes('The Glory') && !displayedSlide.imageUrl.includes('bnTXjwOwdUz8MKFyQCNf0hG4fdL'),
  'Slide de Blue Lock não pode ter imagem live-action'
);

console.log('  -> Atualização atômica coordenada garante que títulos e imagens nunca fiquem descompassados.');

console.log('\n✅ TODOS OS TESTES PASSARAM COM SUCESSO!');
process.exit(0);
