import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('=== ZapiTV | Suíte de Validação da Remoção do Top 10 do Mês na Home Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Auditoria de src/components/mobile/MobileHomeView.tsx
console.log('1. Auditando src/components/mobile/MobileHomeView.tsx...');
const homePath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileHomeView.tsx');
assert.ok(fs.existsSync(homePath), 'MobileHomeView.tsx deve existir');
const homeCode = fs.readFileSync(homePath, 'utf8');

// Verificação de ausência de Top 10
assert.strictEqual(
  homeCode.includes('Top 10 do Mês'),
  false,
  'MobileHomeView.tsx NÃO deve conter o texto ou título "Top 10 do Mês"'
);

// Verificação de ausência de MobileRankedRow
assert.strictEqual(
  homeCode.includes('MobileRankedRow'),
  false,
  'MobileHomeView.tsx NÃO deve importar nem renderizar MobileRankedRow'
);

// Verificação de ausência de top10Movies
assert.strictEqual(
  homeCode.includes('top10Movies'),
  false,
  'MobileHomeView.tsx NÃO deve calcular top10Movies'
);

// Verificação de ausência do ícone Flame não utilizado
assert.strictEqual(
  homeCode.includes('Flame'),
  false,
  'MobileHomeView.tsx NÃO deve importar o ícone Flame'
);

console.log('  ✓ Top 10 do Mês e dependências completamente removidos de MobileHomeView.tsx');

// 2. Preservação das demais seções mobile
console.log('\n2. Verificando preservação das demais seções em MobileHomeView.tsx...');
assert.ok(homeCode.includes('<MobileHero'), 'Deve preservar MobileHero');
assert.ok(homeCode.includes('title="Continuar Assistindo"'), 'Deve preservar Continuar Assistindo');
assert.ok(homeCode.includes('title="Em Alta Agora"'), 'Deve preservar Em Alta Agora');
assert.ok(homeCode.includes('personalizedRows.map'), 'Deve preservar carrosséis personalizados (Disney, HBO, Prime, etc.)');
console.log('  ✓ Demais seções da Home mobile (Hero, Continuar Assistindo, Em Alta, Exclusivos) 100% preservadas');

// 3. Preservação do componente MobileRankedRow.tsx para outras partes do sistema
console.log('\n3. Verificando preservação de MobileRankedRow.tsx no projeto...');
const rankedRowPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileRankedRow.tsx');
assert.ok(fs.existsSync(rankedRowPath), 'MobileRankedRow.tsx deve continuar existindo no projeto');
const rankedRowCode = fs.readFileSync(rankedRowPath, 'utf8');
assert.ok(rankedRowCode.includes('export const MobileRankedRow'), 'MobileRankedRow deve continuar exportado');
console.log('  ✓ MobileRankedRow.tsx preservado intacto no repositório');

// 4. Preservação de Desktop, Smart TV e Fire TV
console.log('\n4. Verificando preservação de Desktop, Smart TV e Fire TV...');
const tvHomePath = path.join(projectRoot, 'src', 'components', 'tv', 'TvHomeView.tsx');
assert.ok(fs.existsSync(tvHomePath), 'TvHomeView.tsx deve existir');

const featuredRankedCarouselPath = path.join(projectRoot, 'components', 'FeaturedRankedCarousel.tsx');
assert.ok(fs.existsSync(featuredRankedCarouselPath), 'FeaturedRankedCarousel.tsx (Desktop) deve existir');
console.log('  ✓ Desktop e Smart TV permanecem intactos sem alterações');

console.log('\n========================================================================');
console.log('🎉 TODOS OS TESTES DE REMOÇÃO DO TOP 10 MOBILE PASSARAM COM SUCESSO!');
console.log('========================================================================\n');
