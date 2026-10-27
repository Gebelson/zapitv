import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('=== ZapiTV | Validação da Remoção Definitiva de Subtítulos em Carrosséis Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const mobileContentRowPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileContentRow.tsx');
const mobileRankedRowPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileRankedRow.tsx');
const mobileHomeViewPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileHomeView.tsx');
const mobileMyZapiPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileMyZapiView.tsx');
const editorialCuratorPath = path.join(projectRoot, 'src', 'core', 'recommendations', 'editorialCuratorService.ts');
const contentCardPath = path.join(projectRoot, 'components', 'ContentCard.tsx');
const detailModalPath = path.join(projectRoot, 'components', 'ContentDetailModal.tsx');

const contentRowCode = fs.readFileSync(mobileContentRowPath, 'utf8');
const rankedRowCode = fs.readFileSync(mobileRankedRowPath, 'utf8');
const homeViewCode = fs.readFileSync(mobileHomeViewPath, 'utf8');
const myZapiCode = fs.readFileSync(mobileMyZapiPath, 'utf8');
const editorialCode = fs.readFileSync(editorialCuratorPath, 'utf8');
const cardCode = fs.readFileSync(contentCardPath, 'utf8');
const modalCode = fs.readFileSync(detailModalPath, 'utf8');

// Teste 1: Auditoria de MobileContentRow.tsx
console.log('1. Verificando MobileContentRow.tsx...');
assert.strictEqual(
  contentRowCode.includes('subtitle?: string'),
  false,
  'MobileContentRowProps NÃO deve declarar parâmetro subtitle'
);
assert.strictEqual(
  contentRowCode.includes('subtitle'),
  false,
  'MobileContentRow.tsx NÃO deve conter referências a subtitle'
);
assert.strictEqual(
  contentRowCode.includes('<p'),
  false,
  'MobileContentRow.tsx NÃO deve conter tags <p> de subtítulo ou texto descritivo'
);
assert(
  contentRowCode.includes('<h3') && contentRowCode.includes('{title}'),
  'MobileContentRow.tsx deve exibir exclusivamente o título principal <h3>'
);
assert(
  contentRowCode.includes('font-black text-white tracking-tight'),
  'MobileContentRow.tsx deve preservar a tipografia do título'
);
assert(
  contentRowCode.includes('mb-2'),
  'MobileContentRow.tsx deve ter espaçamento vertical compacto (mb-2) sem espaço vazio residual'
);
console.log('  -> MobileContentRow exibe apenas o título principal sem subtítulos ou espaços ociosos.');

// Teste 2: Auditoria de MobileRankedRow.tsx (Top 10)
console.log('\n2. Verificando MobileRankedRow.tsx...');
assert.strictEqual(
  rankedRowCode.includes('subtitle?: string'),
  false,
  'MobileRankedRowProps NÃO deve declarar parâmetro subtitle'
);
assert.strictEqual(
  rankedRowCode.includes('subtitle'),
  false,
  'MobileRankedRow.tsx NÃO deve conter referências a subtitle'
);
assert.strictEqual(
  rankedRowCode.includes('<p'),
  false,
  'MobileRankedRow.tsx NÃO deve conter tags <p> de subtítulo'
);
assert(
  rankedRowCode.includes('<h3') && rankedRowCode.includes('{title}'),
  'MobileRankedRow.tsx deve exibir exclusivamente o título principal com seu ícone'
);
console.log('  -> MobileRankedRow exibe apenas o título principal e ícone, sem subtítulos.');

// Teste 3: Auditoria de MobileHomeView.tsx (Todos os Carrosséis da Home)
console.log('\n3. Verificando renderização de carrosséis em MobileHomeView.tsx...');
assert.strictEqual(
  homeViewCode.includes('subtitle='),
  false,
  'MobileHomeView.tsx NÃO deve passar propriedade subtitle para nenhum carrossel'
);
assert(
  homeViewCode.includes('title="Continuar Assistindo"'),
  'Deve conter carrossel Continuar Assistindo'
);
assert(
  homeViewCode.includes('title="Em Alta Agora"'),
  'Deve conter carrossel Em Alta Agora'
);
assert.strictEqual(
  homeViewCode.includes('title="Top 10 do Mês"'),
  false,
  'Não deve conter carrossel Top 10 do Mês'
);
assert(
  homeViewCode.includes('personalizedRows.map'),
  'Carrosséis personalizados devem ser renderizados dinamicamente'
);
// Verifica que a renderização de personalizedRows passa exclusivamente title e items
const personalizedSection = homeViewCode.slice(homeViewCode.indexOf('personalizedRows.map'));
assert.strictEqual(
  personalizedSection.includes('subtitle='),
  false,
  'Carrosséis personalizados NÃO devem passar subtitle'
);
console.log('  -> Todos os carrosséis da Home mobile renderizam estritamente sem subtítulos.');

// Teste 4: Auditoria de MobileMyZapiView.tsx
console.log('\n4. Verificando carrosséis em MobileMyZapiView.tsx...');
assert.strictEqual(
  myZapiCode.includes('subtitle='),
  false,
  'MobileMyZapiView.tsx NÃO deve passar subtitle para nenhum carrossel'
);
console.log('  -> Carrosséis de Minha ZapiTV renderizam sem subtítulos.');

// Teste 5: Preservação de Dados de Catálogo e Curadoria (Requisito 6)
console.log('\n5. Verificando integridade dos dados no sistema de curadoria...');
assert(
  editorialCode.includes('Obras-primas atemporais que moldaram a história cinematográfica'),
  'Dados de curadoria editorial DEVEM ser preservados nos serviços de recomendação (não apagados do catálogo)'
);
console.log('  -> Dados de catálogo e curadoria editorial 100% preservados no backend/core.');

// Teste 6: Preservação de Sinopses de Obras e Detalhes de Cards (Requisito 8)
console.log('\n6. Verificando preservação de sinopses e metadados nos cards...');
assert(
  cardCode.includes('item.title'),
  'ContentCard deve manter suas informações de conteúdo preservadas'
);
assert(
  modalCode.includes('item.description'),
  'ContentDetailModal deve manter sinopse completa preservada'
);
console.log('  -> Sinopses, descrições e detalhes de obras mantidos intactos.');

console.log('\n=== TODOS OS TESTES DE REMOÇÃO DE SUBTÍTULOS DOS CARROSSÉIS MOBILE PASSARAM! ===');
process.exit(0);
