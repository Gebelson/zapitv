import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContentItem, ContentType } from '../types';
import { heroCarouselStore, hasValidHeroImageCandidate, isValidHeroImageUrl } from '../src/core/catalog/heroCarouselStore';
import { heroImageService, ZAPITV_HERO_FALLBACK_IMAGE } from '../src/core/catalog/heroImageService';
import { posterRecoveryService } from '../src/core/catalog/PosterRecoveryService';

console.log('=== ZapiTV | Validação do Fallback e Recuperação de Imagens do Banner Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const heroComponentPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileHero.tsx');

// Teste 1: Validação de URLs e Detecção de Candidatos Válidos
console.log('1. Testando detecção de URLs válidas e descarte de valores nulos/vazios...');

assert.strictEqual(isValidHeroImageUrl(''), false, 'String vazia deve ser inválida');
assert.strictEqual(isValidHeroImageUrl('   '), false, 'Espaços devem ser inválidos');
assert.strictEqual(isValidHeroImageUrl('null'), false, '"null" deve ser inválido');
assert.strictEqual(isValidHeroImageUrl('undefined'), false, '"undefined" deve ser inválido');
assert.strictEqual(isValidHeroImageUrl(null), false, 'null deve ser inválido');
assert.strictEqual(isValidHeroImageUrl(undefined), false, 'undefined deve ser inválido');
assert.strictEqual(isValidHeroImageUrl('https://image.tmdb.org/t/p/w500/test.jpg'), true, 'HTTPS legítimo deve ser válido');
assert.strictEqual(isValidHeroImageUrl('http://image.tmdb.org/t/p/w500/test.jpg'), true, 'HTTP legítimo deve ser válido');

const itemWithoutImages: ContentItem = {
  id: 'no-img-1',
  title: 'Obra Sem Capa',
  type: ContentType.MOVIE,
  rating: 7.0,
  year: 2025,
  image: '',
  poster: 'null',
  backdrop: undefined
};

const itemWithValidPoster: ContentItem = {
  id: 'valid-img-1',
  title: 'Obra Com Capa Oficial',
  type: ContentType.MOVIE,
  rating: 8.5,
  year: 2025,
  image: 'https://images.metahub.space/poster/medium/tt1234567/img',
  poster: 'https://images.metahub.space/poster/medium/tt1234567/img',
  backdrop: 'https://images.metahub.space/background/medium/tt1234567/img'
};

assert.strictEqual(hasValidHeroImageCandidate(itemWithoutImages), false, 'Item sem imagens não deve ser candidato');
assert.strictEqual(hasValidHeroImageCandidate(itemWithValidPoster), true, 'Item com capa oficial deve ser candidato');
console.log('  -> Validação de candidatos a banner funcionando com precisão.');

// Teste 2: Filtragem no heroCarouselStore.getDisplayItems
console.log('\n2. Testando filtragem de obras sem imagem no heroCarouselStore...');

const mockMixedItems: ContentItem[] = [
  itemWithoutImages,
  itemWithValidPoster,
  {
    id: 'valid-img-2',
    title: 'Segunda Obra Válida',
    type: ContentType.SERIES,
    rating: 8.0,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/sample2.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/backdrop2.jpg'
  }
];

const displayItems = heroCarouselStore.getDisplayItems(mockMixedItems, 6);
const hasNoImgItem = displayItems.some(i => i.id === 'no-img-1');
assert.strictEqual(hasNoImgItem, false, 'getDisplayItems NÃO deve incluir obras sem imagem candidata');
assert(displayItems.some(i => i.id === 'valid-img-1'), 'getDisplayItems deve incluir obra com imagem válida');
console.log('  -> heroCarouselStore descarta com segurança itens sem imagem sem mutar dados.');

// Teste 3: Cadeia Ordenada e Desduplicada de Fallback
console.log('\n3. Testando cadeia de fallback ordenada sem repetições...');

const testItemWithCascade: ContentItem = {
  id: 'cascade-item-1',
  title: 'Item de Teste de Cascata',
  type: ContentType.MOVIE,
  rating: 8.0,
  year: 2025,
  poster: 'https://image.tmdb.org/t/p/w500/poster_vertical.jpg',
  image: 'https://image.tmdb.org/t/p/w500/image_alt.jpg',
  backdrop: 'https://image.tmdb.org/t/p/original/backdrop_official.jpg',
  backdrops: [
    'https://image.tmdb.org/t/p/original/backdrop_official.jpg', // Duplicata proposital
    'https://image.tmdb.org/t/p/original/backdrop_extra1.jpg'
  ],
  images: [
    'https://image.tmdb.org/t/p/w500/extra_img1.jpg'
  ]
};

const candidateUrls = heroImageService.getCandidateUrls(testItemWithCascade);

// 1º Pôster vertical oficial
assert.strictEqual(candidateUrls[0], 'https://image.tmdb.org/t/p/w500/poster_vertical.jpg');
// 2º Imagem alternativa
assert.strictEqual(candidateUrls[1], 'https://image.tmdb.org/t/p/w500/image_alt.jpg');
// 3º Backdrop oficial
assert.strictEqual(candidateUrls[2], 'https://image.tmdb.org/t/p/original/backdrop_official.jpg');
// 4º Extra backdrops (sem duplicata do oficial)
assert.strictEqual(candidateUrls[3], 'https://image.tmdb.org/t/p/original/backdrop_extra1.jpg');
// 5º Extra imagens
assert.strictEqual(candidateUrls[4], 'https://image.tmdb.org/t/p/w500/extra_img1.jpg');
// 6º Fallback institucional da marca ZapiTV no final
assert.strictEqual(candidateUrls[candidateUrls.length - 1], ZAPITV_HERO_FALLBACK_IMAGE);

// Verifica ausência de duplicatas
const uniqueCandidates = new Set(candidateUrls);
assert.strictEqual(uniqueCandidates.size, candidateUrls.length, 'Não deve haver URLs duplicadas na cadeia');
console.log('  -> Cadeia de fallback respeita estritamente a prioridade sem repetições.');

// Teste 4: Cache de URLs com Falha e TTL
console.log('\n4. Testando cache de URLs com falha (failedUrlCache)...');

heroImageService.clearCache();
const brokenUrl = 'https://broken-cdn.com/404-not-found.jpg';
assert.strictEqual(heroImageService.isUrlFailed(brokenUrl), false, 'Inicialmente a URL não está no cache de falha');

heroImageService.markUrlFailed(brokenUrl);
assert.strictEqual(heroImageService.isUrlFailed(brokenUrl), true, 'Após markUrlFailed, URL deve constar como falha');

const validatedUrl = 'https://image.tmdb.org/t/p/w500/success.jpg';
heroImageService.markUrlValidated(validatedUrl);
assert.strictEqual(heroImageService.isUrlValidated(validatedUrl), true, 'URL validada deve constar em validatedUrlCache');
assert.strictEqual(heroImageService.isUrlFailed(validatedUrl), false, 'URL validada não deve constar em falha');
console.log('  -> Caches de validação e falha operando corretamente.');

// Teste 5: Resolução Automática com Fallback Quando Candidatos Falham
console.log('\n5. Testando resolução inteligente de imagem com múltiplos fallbacks...');

const testItemFailingPrimary: ContentItem = {
  id: 'failing-primary-item',
  title: 'Item com Primária Quebrada',
  type: ContentType.MOVIE,
  rating: 7.5,
  year: 2025,
  poster: 'https://broken-cdn.com/poster404.jpg',
  image: 'https://broken-cdn.com/image404.jpg',
  backdrop: 'https://valid-cdn.com/working-backdrop.jpg'
};

// Marcamos as URLs do pôster como falhadas
heroImageService.markUrlFailed('https://broken-cdn.com/poster404.jpg');
heroImageService.markUrlFailed('https://broken-cdn.com/image404.jpg');

async function testResolution() {
  const result = await heroImageService.resolveHeroImageForItem(testItemFailingPrimary);
  assert.strictEqual(
    result.url,
    'https://valid-cdn.com/working-backdrop.jpg',
    'Deve pular as URLs quebradas e resolver diretamente o backdrop válido'
  );
  assert.strictEqual(result.source, 'backdrop', 'A fonte resolvida deve ser o backdrop');
  assert.strictEqual(result.isFallback, false, 'Não deve ser fallback genérico de marca pois o backdrop é do item');
}

await testResolution();
console.log('  -> Resolução automática avança na cadeia de fallback sem travar.');

// Teste 6: Fallback Institucional Seguro Quando Todas as Imagens Falham
console.log('\n6. Testando salvaguarda institucional ZapiTV quando todas as fontes falham...');

const allBrokenItem: ContentItem = {
  id: 'all-broken-item',
  title: 'Item Totalmente Inacessível',
  type: ContentType.MOVIE,
  rating: 6.0,
  year: 2025,
  poster: 'https://broken-cdn.com/p1.jpg',
  backdrop: 'https://broken-cdn.com/b1.jpg'
};

heroImageService.markUrlFailed('https://broken-cdn.com/p1.jpg');
heroImageService.markUrlFailed('https://broken-cdn.com/b1.jpg');

const brandFallbackResult = await heroImageService.resolveHeroImageForItem(allBrokenItem);
assert.strictEqual(
  brandFallbackResult.url,
  ZAPITV_HERO_FALLBACK_IMAGE,
  'Deve usar o fallback de marca ZapiTV quando todas as fontes do item falharem'
);
assert.strictEqual(brandFallbackResult.isFallback, true, 'Deve sinalizar isFallback: true');
console.log('  -> Fallback institucional garante que a tela nunca fique preta ou quebrada.');

// Teste 7: Inspeção Estrutural de MobileHero.tsx
console.log('\n7. Verificando estrutura e recursos anti-flash em MobileHero.tsx...');

const heroCode = fs.readFileSync(heroComponentPath, 'utf8');

// 1. Altura cinematográfica e background
assert(heroCode.includes('bg-[#05070a]'), 'MobileHero deve usar bg-[#05070a]');
assert(heroCode.includes('h-[58vh]') || heroCode.includes('min-h-[420px]'), 'MobileHero deve ter altura adaptativa');
assert(heroCode.includes('object-cover object-top'), 'MobileHero deve usar object-cover object-top');
assert(heroCode.includes('from-[#05070a]'), 'MobileHero deve ter gradiente from-[#05070a]');

// 2. Camada dupla de transição (elimina tela preta e flashes brancos)
assert(
  heroCode.includes('prevImage') && heroCode.includes('currentDisplayImage'),
  'MobileHero deve manter prevImage e currentDisplayImage para crossfade sem flash preto'
);
assert(
  heroCode.includes('transition-opacity duration-500'),
  'MobileHero deve ter transição suave de opacidade duration-500'
);

// 3. Pré-carregamento do próximo slide
assert(
  heroCode.includes('preloadHeroItem'),
  'MobileHero deve pré-carregar antecipadamente a imagem do próximo slide'
);

// 4. Cancelamento de operações pendentes via AbortController
assert(
  heroCode.includes('AbortController') && heroCode.includes('controller.abort()'),
  'MobileHero deve usar AbortController para cancelar requisições ao trocar de slide'
);

// 5. Filtragem de itens totalmente falhados na rotação
assert(
  heroCode.includes('failedItemIds') && heroCode.includes('setFailedItemIds'),
  'MobileHero deve pular temporariamente da rotação itens cujas imagens falharam por completo'
);

// 6. Botões e metadados preservados
assert(heroCode.includes('Assistir') || heroCode.includes('Ver Detalhes'), 'Botão Assistir deve existir');
assert(heroCode.includes('Minha Lista'), 'Botão Minha Lista deve existir');
assert(heroCode.includes('data-testid="mobile-hero"'), 'data-testid="mobile-hero" deve ser mantido');
console.log('  -> MobileHero.tsx possui camada dupla anti-flash, pré-carregamento e abort controller.');

console.log('\n=== TODOS OS 7 TESTES DE FALLBACK E RECUPERAÇÃO DE IMAGENS PASSARAM COM SUCESSO! ===');
process.exit(0);
