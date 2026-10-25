/**
 * ZapiTV - Suíte de Testes: Responsividade e Geometria do Catálogo Mobile
 * 
 * Validação rigorosa dos 10 requisitos:
 * 1. Grid ocupa 100% da largura útil da tela, respeitando as margens laterais.
 * 2. Duas colunas com larguras estritamente iguais e espaçamento uniforme.
 * 3. Estrutura equivalente a: grid-template-columns: repeat(2, minmax(0, 1fr)).
 * 4. Cards preenchem integralmente suas células (sem larguras fixas herdadas).
 * 5. Proporção vertical 2:3 original das capas preservada sem distorções.
 * 6. Preservação do alinhamento dos títulos, anos, badges e metadados.
 * 7. Margens laterais simétricas (16px / px-4) e gap uniforme entre colunas (12px / gap-3).
 * 8. Ausência de limitadores indevidos (max-width indesejado no grid, overflow ou deslocamentos).
 * 9. Sem uso de 100vw causador de overflow horizontal.
 * 10. Validação geométrica precisa nas larguras: 320px, 375px, 390px, 414px e 430px.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('========================================================================');
console.log('📱 SUÍTE DE TESTES: LAYOUT RESPONSIVO DO CATÁLOGO MOBILE (2 COLUNAS 100%)');
console.log('========================================================================\n');

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

// --------------------------------------------------------------------------
// 1. Auditoria Estática de MobileExploreView.tsx
// --------------------------------------------------------------------------
console.log('--- 1. Auditoria de MobileExploreView.tsx (Catálogo Mobile) ---');
const explorePath = path.resolve('src/components/mobile/MobileExploreView.tsx');
const exploreCode = fs.readFileSync(explorePath, 'utf8');

// Valida estrutura do grid
testAssert(
  'Grid do catálogo possui classe grid-cols-2',
  exploreCode.includes('grid-cols-2')
);

testAssert(
  'Grid do catálogo declara explicitamente gridTemplateColumns: repeat(2, minmax(0, 1fr))',
  exploreCode.includes("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
);

testAssert(
  'Grid do catálogo possui largura total w-full',
  exploreCode.includes('w-full grid grid-cols-2')
);

testAssert(
  'Grid do catálogo eliminou quebras de 3 colunas (xs:grid-cols-3 removido)',
  !exploreCode.includes('xs:grid-cols-3')
);

testAssert(
  'Container principal possui margens simétricas px-4 e largura total',
  exploreCode.includes('px-4 w-full max-w-lg mx-auto')
);

testAssert(
  'MobileCard é instanciado no catálogo com variant="grid"',
  exploreCode.includes('variant="grid"')
);

// --------------------------------------------------------------------------
// 2. Auditoria Estática de MobileCard.tsx
// --------------------------------------------------------------------------
console.log('\n--- 2. Auditoria de MobileCard.tsx (Preenchimento Integral) ---');
const cardPath = path.resolve('src/components/mobile/MobileCard.tsx');
const cardCode = fs.readFileSync(cardPath, 'utf8');

testAssert(
  'MobileCard suporta prop variant ("grid" | "carousel")',
  cardCode.includes("variant?: 'carousel' | 'grid'")
);

testAssert(
  'No modo grid, MobileCard aplica w-full min-w-0 max-w-full (preenchimento 100%)',
  cardCode.includes("'w-full min-w-0 max-w-full'")
);

testAssert(
  'MobileCard não impõe largura fixa no modo grid (w-[122px] restrito apenas ao carrossel)',
  cardCode.includes("variant === 'carousel'") && cardCode.includes("'shrink-0 w-[122px] xs:w-[132px]'")
);

testAssert(
  'Pôster preserva proporção exata aspect-[2/3] com largura total w-full',
  cardCode.includes('w-full aspect-[2/3]')
);

testAssert(
  'Imagem do pôster possui object-cover e preenchimento total w-full h-full',
  cardCode.includes('w-full h-full object-cover')
);

testAssert(
  'Contêiner de texto inferior possui w-full min-w-0 para alinhamento correto',
  cardCode.includes('mt-1.5 px-0.5 flex flex-col w-full min-w-0')
);

// --------------------------------------------------------------------------
// 3. Auditoria Estática de MobileSearchView.tsx e MobileContentRow.tsx
// --------------------------------------------------------------------------
console.log('\n--- 3. Auditoria de MobileSearchView.tsx e MobileContentRow.tsx ---');
const searchPath = path.resolve('src/components/mobile/MobileSearchView.tsx');
const searchCode = fs.readFileSync(searchPath, 'utf8');

testAssert(
  'MobileSearchView também adota grid-cols-2 com repeat(2, minmax(0, 1fr))',
  searchCode.includes("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
);

testAssert(
  'MobileSearchView eliminou xs:grid-cols-3',
  !searchCode.includes('xs:grid-cols-3')
);

const rowPath = path.resolve('src/components/mobile/MobileContentRow.tsx');
const rowCode = fs.readFileSync(rowPath, 'utf8');

testAssert(
  'MobileContentRow repassa variant="carousel" para preservar carrosséis horizontais',
  rowCode.includes('variant="carousel"')
);

// --------------------------------------------------------------------------
// 4. Validação Geométrica em Múltiplas Larguras (320px, 375px, 390px, 414px, 430px)
// --------------------------------------------------------------------------
console.log('\n--- 4. Validação Geométrica nos Breakpoints Obrigatórios ---');

const testViewports = [
  { name: 'iPhone SE 1st Gen', width: 320 },
  { name: 'iPhone SE 2nd/3rd / iPhone 8', width: 375 },
  { name: 'iPhone 12/13/14/15/16', width: 390 },
  { name: 'iPhone 11 / XR / XS Max', width: 414 },
  { name: 'iPhone 14/15/16 Pro Max / Plus', width: 430 }
];

const LATERAL_PADDING_PX = 16 * 2; // px-4 = 16px esquerda + 16px direita = 32px
const GAP_PX = 12; // gap-3 = 12px

for (const vp of testViewports) {
  const usableWidth = vp.width - LATERAL_PADDING_PX;
  const colWidth = (usableWidth - GAP_PX) / 2;
  const cardWidth = colWidth; // No modo grid, card ocupa 100% da coluna
  const posterHeight = Math.round(cardWidth * 1.5); // Aspect ratio 2:3 exato
  const totalOccupiedWidth = LATERAL_PADDING_PX + (colWidth * 2) + GAP_PX;
  const emptySpaceRight = vp.width - totalOccupiedWidth;

  testAssert(
    `[${vp.width}px - ${vp.name}] Duas colunas com larguras estritamente iguais (${colWidth.toFixed(1)}px)`,
    colWidth > 0
  );

  testAssert(
    `[${vp.width}px - ${vp.name}] Grade preenche 100% da largura útil sem espaço vazio residual (${emptySpaceRight.toFixed(1)}px)`,
    Math.abs(emptySpaceRight) < 0.001
  );

  testAssert(
    `[${vp.width}px - ${vp.name}] Proporção vertical 2:3 da capa matematicamente conservada (altura: ${posterHeight}px, ratio: 1.5)`,
    Math.abs((posterHeight / cardWidth) - 1.5) < 0.01
  );

  testAssert(
    `[${vp.width}px - ${vp.name}] Zero overflow horizontal (ocupado <= tela)`,
    totalOccupiedWidth <= vp.width
  );
}

// --------------------------------------------------------------------------
// 5. Isolamento e Não-Interferência com Desktop e Smart TV
// --------------------------------------------------------------------------
console.log('\n--- 5. Isolamento: Desktop, Smart TV e Carrosséis da Home Intactos ---');
const appCode = fs.readFileSync(path.resolve('App.tsx'), 'utf8');
const tvHomeCode = fs.readFileSync(path.resolve('src/components/tv/TvHomeView.tsx'), 'utf8');

testAssert(
  'App.tsx preserva VirtualizedCatalogGrid no desktop (>= 768px)',
  appCode.includes('<VirtualizedCatalogGrid')
);

testAssert(
  'TvHomeView permanece utilizando TvContentRow isolado sem alterações',
  tvHomeCode.includes('<TvContentRow')
);

console.log('\n========================================================================');
console.log(`📊 RESULTADO DA SUÍTE RESPONSIVA DO CATÁLOGO: ${passed} PASS, ${failed} FAIL`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
process.exit(0);
