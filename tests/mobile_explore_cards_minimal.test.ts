import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

console.log('=== TEST SUITE: ZapiTV | Simplificação Minimalista dos Quadros da Página Explorar Mobile ===\n');

const exploreViewPath = path.resolve('src/components/mobile/MobileExploreView.tsx');
assert.ok(fs.existsSync(exploreViewPath), 'MobileExploreView.tsx deve existir');
const exploreCode = fs.readFileSync(exploreViewPath, 'utf8');

// 1. Remoção de Ícones, Fundos dos Ícones e Subtítulos
console.log('1. Verificando ausência de ícones, fundos e subtítulos nos 4 quadros...');
assert.strictEqual(
  exploreCode.includes('<Icon'),
  false,
  'NÃO deve renderizar <Icon nos quadros de categoria'
);
assert.strictEqual(
  exploreCode.includes('subtitle:'),
  false,
  'exploreCards NÃO deve conter propriedades de subtítulo'
);
assert.strictEqual(
  exploreCode.includes('w-9 h-9 rounded-xl'),
  false,
  'NÃO deve conter o container quadrado do ícone (w-9 h-9)'
);
assert.strictEqual(
  exploreCode.includes('Longas e produções'),
  false,
  'Subtítulo "Longas e produções" deve estar completamente ausente'
);
assert.strictEqual(
  exploreCode.includes('Temporadas completas'),
  false,
  'Subtítulo "Temporadas completas" deve estar completamente ausente'
);
assert.strictEqual(
  exploreCode.includes('Animações japonesas'),
  false,
  'Subtítulo "Animações japonesas" deve estar completamente ausente'
);
assert.strictEqual(
  exploreCode.includes('Canais e programas'),
  false,
  'Subtítulo "Canais e programas" deve estar completamente ausente'
);
console.log('  -> Ícones, fundos de ícones e subtítulos removidos com sucesso.');

// 2. Remoção da bolinha indicadora azul e ausência de checkmarks/ícones no estado ativo
console.log('\n2. Verificando ausência de bolinha azul ou checkmark de seleção...');
assert.strictEqual(
  exploreCode.includes('rounded-full bg-[#007df7] shadow-[0_0_8px_#007df7]'),
  false,
  'NÃO deve conter a bolinha azul indicadora de seleção'
);
assert.strictEqual(
  exploreCode.includes('w-2 h-2 rounded-full'),
  false,
  'NÃO deve conter o indicador de ponto circular'
);
console.log('  -> Bolinha indicadora removida com sucesso dos quadros.');

// 3. Verificação do novo layout dos 4 quadros (Texto centralizado, Sora bold, altura uniforme reduzida)
console.log('\n3. Verificando novo layout (Centralização vertical/horizontal, Sora, altura uniforme)...');
assert.ok(
  exploreCode.includes("grid-cols-2") && exploreCode.includes("repeat(2, minmax(0, 1fr))"),
  'Deve manter a grade 2x2 com duas colunas de largura igual'
);
assert.ok(
  exploreCode.includes('flex items-center justify-center') && exploreCode.includes('text-center'),
  'Texto deve estar perfeitamente centralizado vertical e horizontalmente'
);
assert.ok(
  exploreCode.includes("fontFamily: \"'Sora', sans-serif\"") || exploreCode.includes("fontFamily: ''Sora', sans-serif'"),
  'Tipografia dos quadros deve utilizar a fonte Sora'
);
assert.ok(
  exploreCode.includes('font-bold'),
  'Texto da categoria deve ser em negrito'
);
assert.ok(
  exploreCode.includes('min-h-[52px]'),
  'Altura dos quadros deve ser uniforme e reduzida proporcionalmente (min-h-[52px])'
);
assert.ok(
  exploreCode.includes('rounded-2xl'),
  'Quadros devem possuir bordas arredondadas'
);
console.log('  -> Layout dos quadros minimalistas e centralizados validado.');

// 4. Verificação do estado selecionado (Borda azul #007df7, fundo discretamente azulado, transição)
console.log('\n4. Verificando estado selecionado exclusivo (Borda azul #007df7 e fundo sutil)...');
assert.ok(
  exploreCode.includes('border-2 border-[#007df7]'),
  'Card ativo deve possuir borda azul oficial #007df7'
);
assert.ok(
  exploreCode.includes('bg-gradient-to-br from-[#007df7]/20 to-[#007df7]/10') ||
  exploreCode.includes('bg-[#007df7]'),
  'Card ativo deve possuir fundo discretamente azulado'
);
assert.ok(
  exploreCode.includes('transition-all duration-200'),
  'Transição de seleção deve ser suave'
);
console.log('  -> Destaque selecionado limpo via borda e fundo validado.');

// 5. Preservação das 4 categorias obrigatórias e rotas
console.log('\n5. Verificando integridade das 4 categorias e rotas...');
assert.ok(exploreCode.includes("label: 'Filmes'"), 'Opção Filmes presente');
assert.ok(exploreCode.includes("label: 'Séries'"), 'Opção Séries presente');
assert.ok(exploreCode.includes("label: 'Animes'"), 'Opção Animes presente');
assert.ok(exploreCode.includes("label: 'TV ao vivo'"), 'Opção TV ao vivo presente');
assert.ok(exploreCode.includes("/programas"), 'TV ao vivo roteada para /programas');
console.log('  -> As 4 categorias obrigatórias e rotas estão preservadas.');

// 6. Preservação do restante da página Explorar
console.log('\n6. Verificando preservação do seletor de gêneros, modal fullscreen e grid de catálogo...');
assert.ok(exploreCode.includes('data-testid="explore-genre-bar"'), 'Barra de seleção de gêneros preservada');
assert.ok(exploreCode.includes('data-testid="mobile-genre-list"'), 'Lista de gêneros em tela cheia preservada');
assert.ok(exploreCode.includes('data-testid="explore-content-grid"'), 'Grade de conteúdos preservada');
console.log('  -> Gêneros e catálogo 100% preservados.');

console.log('\n=== TODOS OS TESTES DOS QUADROS MINIMALISTAS DA PÁGINA EXPLORAR PASSARAM COM SUCESSO! ===\n');
process.exit(0);
