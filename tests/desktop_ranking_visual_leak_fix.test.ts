import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

console.log('=== TEST SUITE: ZapiTV | Correção de Vazamento Visual nos Banners Top 10 PC ===\n');

const carouselPath = path.resolve('components/FeaturedRankedCarousel.tsx');
assert.ok(fs.existsSync(carouselPath), 'FeaturedRankedCarousel.tsx deve existir');
const carouselCode = fs.readFileSync(carouselPath, 'utf8');

// 1. Eliminação definitiva do box-shadow com deslocamento vertical excessivo que gerava o vazamento retangular
console.log('1. Verificando eliminação de sombras assimétricas que causavam o vazamento...');
assert.strictEqual(
  carouselCode.includes('shadow-[0_15px_35px_rgba(0,125,247,0.35)]'),
  false,
  'NÃO deve conter a sombra com deslocamento vertical excessivo shadow-[0_15px_35px_rgba(0,125,247,0.35)]'
);
console.log('  -> Sombra problemática shadow-[0_15px_35px] eliminada com sucesso.');

// 2. Separação de responsabilidades: Camada de Glow externa independente
console.log('\n2. Verificando camada de glow externa independente...');
assert.ok(
  carouselCode.includes('absolute inset-0 rounded-xl sm:rounded-2xl pointer-events-none transition-all duration-300'),
  'Deve conter elemento dedicado para a camada de glow externo'
);
assert.ok(
  carouselCode.includes('shadow-[0_0_24px_rgba(0,125,247,0.4)'),
  'Glow deve possuir dissipação concêntrica suave (0 offset horizontal e vertical) no hover'
);
console.log('  -> Camada de glow independente e dissipação concêntrica suave validadas.');

// 3. Separação de responsabilidades: Camada da capa com recorte rigoroso e isolamento de GPU
console.log('\n3. Verificando camada da capa com recorte absoluto e isolamento...');
assert.ok(
  carouselCode.includes('w-full h-full rounded-xl sm:rounded-2xl overflow-hidden border transition-colors'),
  'Camada da capa deve possuir dimensões completas (w-full h-full), overflow-hidden e border-radius correspondente'
);
assert.ok(
  carouselCode.includes("WebkitMaskImage: '-webkit-radial-gradient(white, black)'"),
  'Deve aplicar WebkitMaskImage para correção de subpixel bleed em motores WebKit/Chromium'
);
assert.ok(
  carouselCode.includes("isolation: 'isolate'"),
  'Deve aplicar isolation: isolate para isolamento do contexto de renderização/stacking'
);
assert.ok(
  carouselCode.includes("contain: 'paint'"),
  'Deve declarar contain: paint para impedir que qualquer pintura interna ultrapasse as bordas da capa'
);
assert.ok(
  carouselCode.includes("transform: 'translateZ(0)'"),
  'Deve forçar camada de composição dedicada com transform: translateZ(0)'
);
console.log('  -> Camada da capa com isolamento de renderização e recorte de GPU validada.');

// 4. Preservação dos botões interativos e estrutura interna
console.log('\n4. Verificando preservação dos elementos interativos do banner...');
assert.ok(carouselCode.includes('aria-label="Favoritar"'), 'Botão de Favoritar deve estar preservado');
assert.ok(carouselCode.includes('aria-label="Minha Lista"'), 'Botão Minha Lista deve estar preservado');
assert.ok(carouselCode.includes('Play className'), 'Botão Play deve estar preservado');
assert.ok(carouselCode.includes('item.type === ContentType.SERIES ? \'SÉRIE\' : \'FILME\''), 'Badge de tipo deve estar preservado');
assert.ok(carouselCode.includes('item.rating.toFixed(1)'), 'Badge de nota/avaliação deve estar preservado');
console.log('  -> Elementos interativos e badges 100% preservados.');

// 5. Preservação do carrossel finito e dissipação de sombras
console.log('\n5. Verificando preservação do carrossel finito e dissipação vertical...');
assert.ok(carouselCode.includes('items.slice(0, 5)'), 'Página 1 deve conter exatamente 5 itens');
assert.ok(carouselCode.includes('items.slice(5, 10)'), 'Página 2 deve conter exatamente 5 itens');
assert.ok(carouselCode.includes("overflowX: 'clip'"), 'overflowX deve ser clip');
assert.ok(carouselCode.includes("overflowY: 'visible'"), 'overflowY deve ser visible');
console.log('  -> Carrossel finito e dissipação vertical de sombra preservados.');

// 6. Invariância dos carrosséis mobile e de TV
console.log('\n6. Verificando que carrosséis mobile e de TV permaneceram inalterados...');
const mobileHomeCode = fs.readFileSync(path.resolve('src/components/mobile/MobileHomeView.tsx'), 'utf8');
assert.ok(mobileHomeCode.includes('MobileContentRow'), 'MobileHomeView deve permanecer intacto');
const tvRowCode = fs.readFileSync(path.resolve('src/components/tv/TvContentRow.tsx'), 'utf8');
assert.ok(tvRowCode.includes('TvCard16x9'), 'TvContentRow deve permanecer intacto');
console.log('  -> Carrosséis mobile e de TV permanecem 100% preservados.');

console.log('\n=== TODOS OS TESTES DE CORREÇÃO DE VAZAMENTO VISUAL PASSARAM COM SUCESSO! ===\n');
process.exit(0);
