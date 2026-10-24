import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST SUITE: ZapiTV | Remoção Permanente de Subtítulos de Todos os Carrosséis ===\n');

// 1. Verificação de components/ContentRow.tsx (Desktop e Geral)
console.log('1. Verificando components/ContentRow.tsx...');
const contentRowCode = fs.readFileSync(path.resolve('components/ContentRow.tsx'), 'utf8');

assert.strictEqual(
  contentRowCode.includes('{subtitle && ('),
  false,
  'ContentRow.tsx NÃO deve renderizar {subtitle && (...)}'
);
assert.strictEqual(
  contentRowCode.includes('subtitle?: string'),
  false,
  'ContentRowProps NÃO deve declarar parâmetro subtitle'
);
assert.strictEqual(
  contentRowCode.includes('<p className={`text-xs sm:text-sm font-medium'),
  false,
  'ContentRow.tsx NÃO deve renderizar elemento <p> de subtítulo'
);
assert.ok(
  contentRowCode.includes('<h3 className={`text-base sm:text-xl md:text-3xl font-black tracking-tight'),
  'ContentRow.tsx deve preservar o título com tipografia intacta'
);
console.log('  -> ContentRow.tsx limpo de subtítulos, títulos preservados.');

// 2. Verificação de src/components/mobile/MobileContentRow.tsx (Mobile)
console.log('\n2. Verificando src/components/mobile/MobileContentRow.tsx...');
const mobileContentRowCode = fs.readFileSync(path.resolve('src/components/mobile/MobileContentRow.tsx'), 'utf8');

assert.strictEqual(
  mobileContentRowCode.includes('{subtitle && ('),
  false,
  'MobileContentRow.tsx NÃO deve renderizar {subtitle && (...)}'
);
assert.strictEqual(
  mobileContentRowCode.includes('subtitle?: string'),
  false,
  'MobileContentRowProps NÃO deve declarar parâmetro subtitle'
);
assert.strictEqual(
  mobileContentRowCode.includes('text-[11px] text-slate-400 mt-0.5'),
  false,
  'MobileContentRow.tsx NÃO deve conter classes de subtítulo'
);
assert.ok(
  mobileContentRowCode.includes('<h3\n          className="text-base sm:text-lg font-black text-white tracking-tight"'),
  'MobileContentRow.tsx deve preservar o título com tipografia Sora'
);
console.log('  -> MobileContentRow.tsx limpo de subtítulos.');

// 3. Verificação de src/components/mobile/MobileRankedRow.tsx (Mobile Ranking Top 10)
console.log('\n3. Verificando src/components/mobile/MobileRankedRow.tsx...');
const mobileRankedRowCode = fs.readFileSync(path.resolve('src/components/mobile/MobileRankedRow.tsx'), 'utf8');

assert.strictEqual(
  mobileRankedRowCode.includes('{subtitle && ('),
  false,
  'MobileRankedRow.tsx NÃO deve renderizar {subtitle && (...)}'
);
assert.strictEqual(
  mobileRankedRowCode.includes('subtitle?: string'),
  false,
  'MobileRankedRowProps NÃO deve declarar parâmetro subtitle'
);
assert.ok(
  mobileRankedRowCode.includes('<Icon className="w-4 h-4 text-[#007df7]" />'),
  'MobileRankedRow.tsx deve preservar o ícone estilizado da fileira'
);
console.log('  -> MobileRankedRow.tsx limpo de subtítulos, ícone e títulos preservados.');

// 4. Verificação de components/FeaturedRankedCarousel.tsx (Desktop Ranking Em Destaque)
console.log('\n4. Verificando components/FeaturedRankedCarousel.tsx...');
const featuredRankedCode = fs.readFileSync(path.resolve('components/FeaturedRankedCarousel.tsx'), 'utf8');

assert.strictEqual(
  featuredRankedCode.includes('{subtitle && ('),
  false,
  'FeaturedRankedCarousel.tsx NÃO deve renderizar {subtitle && (...)}'
);
assert.strictEqual(
  featuredRankedCode.includes('subtitle?: string'),
  false,
  'FeaturedRankedCarouselProps NÃO deve declarar parâmetro subtitle'
);
assert.ok(
  featuredRankedCode.includes('<h3 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight leading-tight">'),
  'FeaturedRankedCarousel.tsx deve manter o título nas posições e fontes corretas'
);
console.log('  -> FeaturedRankedCarousel.tsx limpo de subtítulos.');

// 5. Verificação de src/components/mobile/MobileHomeView.tsx
console.log('\n5. Verificando src/components/mobile/MobileHomeView.tsx...');
const mobileHomeCode = fs.readFileSync(path.resolve('src/components/mobile/MobileHomeView.tsx'), 'utf8');

assert.strictEqual(
  mobileHomeCode.includes('subtitle='),
  false,
  'MobileHomeView.tsx NÃO deve passar atributo subtitle para nenhum carrossel'
);
assert.ok(
  mobileHomeCode.includes('title="Continuar Assistindo"'),
  'MobileHomeView.tsx deve manter o carrossel Continuar Assistindo'
);
assert.ok(
  mobileHomeCode.includes('title="Em Alta Agora"'),
  'MobileHomeView.tsx deve manter o carrossel Em Alta Agora'
);
assert.ok(
  mobileHomeCode.includes('title="Top 10 do Mês"'),
  'MobileHomeView.tsx deve manter o carrossel Top 10 do Mês'
);
console.log('  -> MobileHomeView.tsx não possui mais passagem de subtítulos.');

// 6. Verificação de src/components/mobile/MobileExploreView.tsx
console.log('\n6. Verificando src/components/mobile/MobileExploreView.tsx...');
const mobileExploreCode = fs.readFileSync(path.resolve('src/components/mobile/MobileExploreView.tsx'), 'utf8');

assert.strictEqual(
  mobileExploreCode.includes('subtitle='),
  false,
  'MobileExploreView.tsx NÃO deve passar atributo subtitle para nenhum carrossel'
);
console.log('  -> MobileExploreView.tsx não possui mais passagem de subtítulos.');

// 7. Verificação de src/components/mobile/MobileMyZapiView.tsx
console.log('\n7. Verificando src/components/mobile/MobileMyZapiView.tsx...');
const mobileMyZapiCode = fs.readFileSync(path.resolve('src/components/mobile/MobileMyZapiView.tsx'), 'utf8');

assert.strictEqual(
  mobileMyZapiCode.includes('subtitle='),
  false,
  'MobileMyZapiView.tsx NÃO deve passar atributo subtitle para nenhum carrossel'
);
console.log('  -> MobileMyZapiView.tsx não possui mais passagem de subtítulos.');

// 8. Verificação de App.tsx (Carrosséis Desktop e Recomendações)
console.log('\n8. Verificando App.tsx...');
const appCode = fs.readFileSync(path.resolve('App.tsx'), 'utf8');

assert.strictEqual(
  appCode.includes('subtitle={row.subtitle}'),
  false,
  'App.tsx NÃO deve passar subtitle={row.subtitle} para ContentRow'
);
assert.strictEqual(
  appCode.includes('subtitle={`${monthlyStatusLabel}'),
  false,
  'App.tsx NÃO deve passar subtítulo mensal para FeaturedRankedCarousel'
);
console.log('  -> App.tsx não possui mais passagem de subtítulos para carrosséis.');

// 9. Verificação de Smart TV (src/components/tv/TvContentRow.tsx)
console.log('\n9. Verificando src/components/tv/TvContentRow.tsx...');
const tvRowCode = fs.readFileSync(path.resolve('src/components/tv/TvContentRow.tsx'), 'utf8');

assert.strictEqual(
  tvRowCode.includes('subtitle'),
  false,
  'TvContentRow.tsx NÃO deve conter referências a subtitle'
);
assert.ok(
  tvRowCode.includes('<h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow-md">'),
  'TvContentRow.tsx deve exibir apenas o título h2 da fileira'
);
console.log('  -> Smart TV exibe exclusivamente os títulos, sem subtítulos.');

// 10. Verificação de Preservação de Sinopses e Informações de Conteúdo
console.log('\n10. Verificando preservação de sinopses e dados de filmes...');
const contentCardCode = fs.readFileSync(path.resolve('components/ContentCard.tsx'), 'utf8');
assert.ok(
  contentCardCode.includes('item.description') || contentCardCode.includes('item.title'),
  'ContentCard deve manter suas informações de conteúdo preservadas'
);
const modalCode = fs.readFileSync(path.resolve('components/ContentDetailModal.tsx'), 'utf8');
assert.ok(
  modalCode.includes('item.description'),
  'ContentDetailModal deve manter sinopse completa preservada'
);
console.log('  -> Sinopses, descrições e detalhes de obras 100% preservados.');

console.log('\n=== TODOS OS 10 TESTES DE REMOÇÃO DE SUBTÍTULOS PASSARAM COM SUCESSO! ===');
process.exit(0);
