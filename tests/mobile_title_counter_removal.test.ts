/**
 * ZapiTV - Suíte de Testes: Remoção de Contador de Títulos no Mobile
 * 
 * Requisitos validados:
 * 1. Não exibir textos como "428 títulos encontrados", "X filmes encontrados", "X séries encontradas"
 *    ou qualquer outro contador de resultados no mobile.
 * 2. Aplicar a correção a todas as categorias do catálogo mobile: Filmes, Séries, Animes, Explorar (Todos).
 * 3. Aplicar a correção à página de Pesquisa mobile (MobileSearchView).
 * 4. Remoção do espaço ocupado pelo contador sem deixar margens ou espaçamentos desnecessários (sem gap residual).
 * 5. Não usar `visibility: hidden` para esconder o contador (garantir remoção real da árvore DOM / renderização limpa).
 * 6. Preservar o alinhamento dos filtros, títulos e cards da grade.
 * 7. Não alterar a quantidade real de resultados, paginação ou funcionamento dos filtros.
 * 8. Preservar intactos os contadores existentes no Smart TV (TvSearchView.tsx) e Desktop.
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function testAssert(desc: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${desc}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

console.log('========================================================================');
console.log('📱 SUÍTE DE TESTES: REMOÇÃO DE CONTADORES DE TÍTULOS NO MOBILE');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// 1. Auditoria Estática de MobileExploreView.tsx (Filmes, Séries, Animes, Todos)
// --------------------------------------------------------------------------
console.log('--- 1. Auditoria de MobileExploreView.tsx (Catálogo Mobile) ---');
const explorePath = path.resolve('src/components/mobile/MobileExploreView.tsx');
const exploreCode = fs.readFileSync(explorePath, 'utf8');

testAssert(
  'MobileExploreView NÃO contém "títulos encontrados"',
  !exploreCode.includes('títulos encontrados')
);

testAssert(
  'MobileExploreView NÃO contém "filmes encontrados"',
  !exploreCode.includes('filmes encontrados')
);

testAssert(
  'MobileExploreView NÃO contém "séries encontradas"',
  !exploreCode.includes('séries encontradas')
);

testAssert(
  'MobileExploreView NÃO contém "animes encontrados"',
  !exploreCode.includes('animes encontrados')
);

testAssert(
  'MobileExploreView NÃO contém contador {filteredItems.length}',
  !exploreCode.includes('{filteredItems.length}')
);

testAssert(
  'MobileExploreView removeu o container do contador (sem mb-3 px-1 residual antes do grid)',
  !exploreCode.includes('justify-between text-xs text-slate-400 mb-3 px-1')
);

testAssert(
  'MobileExploreView NÃO utiliza "visibility: hidden" para ocultar contadores',
  !exploreCode.includes('invisible') && !exploreCode.includes('visibility: hidden')
);

testAssert(
  'Grid do catálogo inicia diretamente após os filtros de gênero/categoria',
  exploreCode.includes('/* Grid de Resultados do Catálogo */\n        <div className="w-full">\n          <div\n            className="w-full grid grid-cols-2 gap-3"') ||
  exploreCode.includes('/* Grid de Resultados do Catálogo */\r\n        <div className="w-full">\r\n          <div\r\n            className="w-full grid grid-cols-2 gap-3"')
);

testAssert(
  'Lógica de filtragem por categoria (filmes, séries, animes) e gênero permanece 100% íntegra',
  exploreCode.includes('searchService.isMovieItem(it)') &&
  exploreCode.includes('searchService.isSeriesItem(it)') &&
  exploreCode.includes('searchService.isAnimeItem(it)') &&
  exploreCode.includes('deduplicateContentItems')
);

// --------------------------------------------------------------------------
// 2. Auditoria Estática de MobileSearchView.tsx (Pesquisa Mobile)
// --------------------------------------------------------------------------
console.log('\n--- 2. Auditoria de MobileSearchView.tsx (Pesquisa Mobile) ---');
const searchPath = path.resolve('src/components/mobile/MobileSearchView.tsx');
const searchCode = fs.readFileSync(searchPath, 'utf8');

testAssert(
  'MobileSearchView NÃO contém contador "Resultados ("',
  !searchCode.includes('Resultados (')
);

testAssert(
  'MobileSearchView NÃO contém contador "{displayItems.length}"',
  !searchCode.includes('{displayItems.length}')
);

testAssert(
  'MobileSearchView removeu o contador na seção de artistas ("Artistas ({actors.length})" -> "Artistas")',
  !searchCode.includes('Artistas ({actors.length})') && searchCode.includes('<span>Artistas</span>')
);

testAssert(
  'MobileSearchView removeu o container do contador antes do grid de produções',
  !searchCode.includes('justify-between text-xs text-slate-400 mb-3 px-1')
);

testAssert(
  'MobileSearchView NÃO utiliza "visibility: hidden" ou "invisible" para ocultar contadores',
  !searchCode.includes('invisible') && !searchCode.includes('visibility: hidden')
);

testAssert(
  'Indicador de busca remota (isLoadingRemote) permanece disponível de forma limpa e sem contadores',
  searchCode.includes('isLoadingRemote &&') && searchCode.includes('Buscando mais...')
);

// --------------------------------------------------------------------------
// 3. Preservação Estrita dos Contadores no Smart TV e Desktop
// --------------------------------------------------------------------------
console.log('\n--- 3. Preservação Estrita de Smart TV e Desktop ---');
const tvSearchPath = path.resolve('src/components/tv/TvSearchView.tsx');
const tvSearchCode = fs.readFileSync(tvSearchPath, 'utf8');

testAssert(
  'TvSearchView (Smart TV) PRESERVA seu contador de títulos disponíveis',
  tvSearchCode.includes('{searchResults.length}') &&
  tvSearchCode.includes("searchResults.length === 1 ? 'título disponível' : 'títulos disponíveis'")
);

const appPath = path.resolve('App.tsx');
const appCode = fs.readFileSync(appPath, 'utf8');

testAssert(
  'App.tsx preserva VirtualizedCatalogGrid no desktop (>= 768px)',
  appCode.includes('<VirtualizedCatalogGrid')
);

testAssert(
  'Isolamento MobileLayout vs Desktop preservado em App.tsx',
  appCode.includes('isMobileViewport && !isWatchRoute ? (') &&
  appCode.includes('<MobileLayout')
);

console.log('\n========================================================================');
console.log(`📊 RESULTADO DA SUÍTE DE REMOÇÃO DE CONTADORES: ${passed} PASS, ${failed} FAIL`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
process.exit(0);
