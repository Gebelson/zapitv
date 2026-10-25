import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('=== ZapiTV | Validação do Glassmorphism na Barra de Navegação Inferior Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const bottomNavPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileBottomNavigation.tsx');
const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

// 1. Verificação de Glassmorphism Real (Transparência Escura e Backdrop Blur)
console.log('1. Verificando transparência translúcida escura e blur real...');
// Fundo escuro translúcido (não sólido como /95 ou /100)
assert(
  bottomNavContent.includes('bg-[#05070a]/75') || bottomNavContent.includes('bg-[#05070a]/80'),
  'A barra deve ter fundo escuro translúcido com opacidade de 75-80% (#05070a)'
);
assert.strictEqual(
  bottomNavContent.includes('bg-[#05070a]/95'),
  false,
  'Não deve usar opacidade 95% que elimina a sensação de vidro fosco'
);

// Efeito de blur profundo
assert(
  bottomNavContent.includes('backdrop-blur-2xl') || bottomNavContent.includes('backdrop-blur-xl'),
  'A barra deve usar backdrop-blur profundo (xl ou 2xl)'
);

// Borda sutil de baixa opacidade e highlight de vidro
assert(
  bottomNavContent.includes('border-white/[0.08]') || bottomNavContent.includes('border-white/10'),
  'A borda superior deve ser suave e com baixa opacidade (8-10%)'
);
assert(
  bottomNavContent.includes('inset_0_1px_0_0_rgba(255,255,255,'),
  'Deve possuir micro-reflexo interno na aresta superior para acabamento de vidro'
);
console.log('  -> Fundo translúcido, backdrop-blur e aresta de vidro lapidado validados com sucesso.');

// 2. Preservação da Legibilidade e Estabilidade dos Ícones
console.log('\n2. Verificando estabilidade e dimensões fixas dos ícones...');
assert.strictEqual(
  bottomNavContent.includes('scale-110') || bottomNavContent.includes('scale-105') || bottomNavContent.includes('scale-'),
  false,
  'Ícones não devem possuir variações de escala'
);
assert(
  bottomNavContent.includes('strokeWidth={1.8}'),
  'Ícones devem usar strokeWidth={1.8} fixo'
);
assert(
  bottomNavContent.includes('w-6 h-6'),
  'Ícones devem manter dimensões fixas w-6 h-6'
);
assert(
  bottomNavContent.includes('flex items-center justify-center'),
  'Ícones devem permanecer centralizados vertical e horizontalmente'
);
console.log('  -> Ícones permanecem perfeitamente estáveis, centralizados e sem variações de escala.');

// 3. Indicação de Aba Ativa Exclusiva por Cor e Traço Inferior
console.log('\n3. Verificando indicação de aba ativa por cor e traço inferior...');
assert(
  bottomNavContent.includes("isActive ? 'text-[#007df7]' : 'text-slate-400 hover:text-slate-200'"),
  'Cor ativa deve ser o azul institucional #007df7 e inativa slate-400'
);
assert(
  bottomNavContent.includes('bottom-1 w-6 h-0.5 rounded-full bg-[#007df7] shadow-[0_0_8px_rgba(0,125,247,0.8)]'),
  'Traço azul com brilho suave deve estar posicionado na base'
);
console.log('  -> Cores ativas e linha inferior preservadas.');

// 4. Preservação de Safe Area, Rotas e Acessibilidade
console.log('\n4. Verificando safe area, rotas e acessibilidade...');
assert(
  bottomNavContent.includes('pb-[env(safe-area-inset-bottom,0px)]'),
  'Deve respeitar env(safe-area-inset-bottom)'
);
const expectedTabs = ['home', 'explore', 'my-zapitv', 'programas', 'search'];
expectedTabs.forEach(tab => {
  assert(
    bottomNavContent.includes(`id: '${tab}'`),
    `Aba "${tab}" deve estar preservada`
  );
});
assert(
  bottomNavContent.includes('aria-label={item.label}'),
  'aria-label deve estar preservado para leitores de tela'
);
assert(
  bottomNavContent.includes("aria-current={isActive ? 'page' : undefined}"),
  'aria-current deve estar preservado'
);
console.log('  -> Safe area, todas as 5 rotas e acessibilidade preservadas.');

console.log('\n=== TODOS OS TESTES DE GLASSMORPHISM PASSARAM COM SUCESSO! ===');
process.exit(0);
