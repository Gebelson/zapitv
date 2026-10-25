import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('=== ZapiTV | Validação da Remoção de Expansão dos Ícones da Navegação Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const bottomNavPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileBottomNavigation.tsx');
const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

// 1. Verificação de Eliminação de Expansão e Escalas
console.log('1. Verificando eliminação total de variações de escala (scale-110, group-hover:scale-105)...');
assert.strictEqual(
  bottomNavContent.includes('scale-110'),
  false,
  'NÃO deve existir scale-110 nos ícones ao serem selecionados'
);
assert.strictEqual(
  bottomNavContent.includes('scale-105'),
  false,
  'NÃO deve existir scale-105 nos ícones durante hover'
);
assert.strictEqual(
  bottomNavContent.includes('scale-'),
  false,
  'NÃO deve existir nenhuma classe de escala (scale-) nos ícones ou botões'
);
assert.strictEqual(
  bottomNavContent.includes('transition-transform'),
  false,
  'NÃO deve haver transition-transform nos ícones pois o tamanho é estático'
);
console.log('  -> scale-110 e group-hover:scale-105 completamente eliminados.');

// 2. Verificação de Espessura Fixa (strokeWidth={1.8})
console.log('\n2. Verificando strokeWidth={1.8} fixo e invariante...');
assert.strictEqual(
  bottomNavContent.includes('strokeWidth={isActive ? 2.4 : 1.8}'),
  false,
  'NÃO deve haver variação condicional de strokeWidth'
);
assert.strictEqual(
  bottomNavContent.includes('2.4'),
  false,
  'Espessura 2.4 deve ser removida'
);
assert(
  bottomNavContent.includes('strokeWidth={1.8}'),
  'DEVE conter strokeWidth={1.8} fixo para todos os estados'
);
console.log('  -> strokeWidth={1.8} fixo em todos os estados validado.');

// 3. Verificação de Dimensões Fixas (w-6 h-6) e Centralização
console.log('\n3. Verificando dimensões estritas de w-6 h-6 e centralização...');
assert(
  bottomNavContent.includes('w-6 h-6'),
  'Ícones devem possuir dimensões fixas w-6 h-6'
);
assert(
  bottomNavContent.includes('flex items-center justify-center'),
  'Ícones devem permanecer perfeitamente centralizados'
);
console.log('  -> Dimensões w-6 h-6 e centralização validadas com sucesso.');

// 4. Verificação da Indicação Exclusiva por Cor e Linha Inferior
console.log('\n4. Verificando indicação de seleção exclusiva por cor e linha inferior...');
// Cor ativa
assert(
  bottomNavContent.includes("isActive ? 'text-[#007df7]' : 'text-slate-400 hover:text-slate-200'"),
  'A cor ativa deve ser #007df7 e a inativa slate-400 com hover slate-200'
);

// Linha inferior
assert(
  bottomNavContent.includes('bottom-1 w-6 h-0.5 rounded-full bg-[#007df7] shadow-[0_0_8px_rgba(0,125,247,0.8)]'),
  'Traço azul inferior deve manter largura w-6, espessura h-0.5, posição bottom-1 e brilho rgba(0,125,247,0.8)'
);
console.log('  -> Cores e traço inferior validados rigorosamente.');

// 5. Preservação dos 5 Ícones na Ordem Obrigatória
console.log('\n5. Verificando preservação das 5 abas...');
const expectedTabs = ['home', 'explore', 'my-zapitv', 'programas', 'search'];
expectedTabs.forEach(tab => {
  assert(
    bottomNavContent.includes(`id: '${tab}'`),
    `Aba "${tab}" deve estar preservada`
  );
});

// Acessibilidade e Safe Area
assert(
  bottomNavContent.includes('pb-[env(safe-area-inset-bottom,0px)]'),
  'Safe area inferior deve ser preservada'
);
assert(
  bottomNavContent.includes('aria-label={item.label}'),
  'aria-label deve ser preservado para leitores de tela'
);
assert(
  bottomNavContent.includes("aria-current={isActive ? 'page' : undefined}"),
  'aria-current deve indicar a página ativa para acessibilidade'
);

console.log('  -> Todas as 5 abas, rotas, safe area e acessibilidade preservadas intactas.');

console.log('\n=== TODOS OS TESTES DE REMOÇÃO DE EXPANSÃO DOS ÍCONES PASSARAM! ===');
process.exit(0);
