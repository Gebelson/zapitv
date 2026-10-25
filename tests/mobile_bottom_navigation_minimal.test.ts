import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('=== ZapiTV | Validação da Barra de Navegação Mobile Minimalista ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const bottomNavPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileBottomNavigation.tsx');
const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

// Teste 1: Remoção de Textos Visíveis
console.log('1. Verificando ausência de textos visíveis abaixo dos ícones...');
// Verifica que não há <span> renderizando o texto do rótulo
assert.strictEqual(
  bottomNavContent.includes('{item.label}</span>'),
  false,
  'NÃO deve haver tag span exibindo {item.label}'
);
assert.strictEqual(
  bottomNavContent.includes('text-[10px]'),
  false,
  'NÃO deve haver classes de tipografia de texto de rótulo (text-[10px])'
);

// Verifica preservação de aria-label para acessibilidade
assert(
  bottomNavContent.includes('aria-label={item.label}'),
  'DEVE preservar aria-label={item.label} para acessibilidade'
);
console.log('  -> Barra minimalista com apenas ícones e aria-label validada.');

// Teste 2: Reorganização dos Botões (Nova Ordem Obrigatória)
console.log('\n2. Verificando nova ordem obrigatória dos 5 botões...');
const expectedOrder = [
  { id: 'home', label: 'Início', path: '/' },
  { id: 'explore', label: 'Explorar', path: '/explorar' },
  { id: 'my-zapitv', label: 'Minha Zapi', path: '/minha-zapitv' },
  { id: 'programas', label: 'Programas', path: '/programas' },
  { id: 'search', label: 'Buscar', path: '/buscar' }
];

// Extrai a declaração de navItems
const navItemsMatch = bottomNavContent.match(/navItems:\s*Array<[\s\S]*?>\s*=\s*\[([\s\S]*?)\];/);
assert(navItemsMatch, 'navItems deve ser declarado no componente');
const navItemsStr = navItemsMatch[1];

// Valida a ordem exata das chaves id
const idMatches = Array.from(navItemsStr.matchAll(/id:\s*['"]([^'"]+)['"]/g)).map(m => m[1]);
assert.strictEqual(idMatches.length, 5, 'Devem existir 5 itens em navItems');
assert.strictEqual(idMatches[0], 'home', 'Item 1 deve ser "home" (Início)');
assert.strictEqual(idMatches[1], 'explore', 'Item 2 deve ser "explore" (Explorar)');
assert.strictEqual(idMatches[2], 'my-zapitv', 'Item 3 deve ser "my-zapitv" (Minha Zapi)');
assert.strictEqual(idMatches[3], 'programas', 'Item 4 deve ser "programas" (Programas)');
assert.strictEqual(idMatches[4], 'search', 'Item 5 deve ser "search" (Buscar)');

// Valida as rotas correspondentes
assert(navItemsStr.includes("id: 'home', label: 'Início', icon: Home, path: '/'"));
assert(navItemsStr.includes("id: 'explore', label: 'Explorar', icon: Compass, path: '/explorar'"));
assert(navItemsStr.includes("id: 'my-zapitv', label: 'Minha Zapi', icon: UserRound, path: '/minha-zapitv'"));
assert(navItemsStr.includes("id: 'programas', label: 'Programas', icon: Tv, path: '/programas'"));
assert(navItemsStr.includes("id: 'search', label: 'Buscar', icon: Search, path: '/buscar'"));
console.log('  -> Ordem rigorosa validada: 1. Início, 2. Explorar, 3. Minha Zapi, 4. Programas, 5. Buscar.');

// Teste 3: Dimensões, Alinhamento e Indicador Ativo
console.log('\n3. Verificando dimensões compactas, centralização vertical e indicador azul...');
// Altura reduzida
assert(
  bottomNavContent.includes('h-13') || bottomNavContent.includes('h-14'),
  'A altura da barra deve ser reduzida (h-13 ou h-14)'
);

// Centralização vertical no botão
assert(
  bottomNavContent.includes('flex items-center justify-center'),
  'Ícones devem ser centralizados verticalmente e horizontalmente no botão'
);

// Safe area inferior
assert(
  bottomNavContent.includes('pb-[env(safe-area-inset-bottom,0px)]'),
  'DEVE respeitar env(safe-area-inset-bottom)'
);

// Indicador azul ativo
assert(
  bottomNavContent.includes('bg-[#007df7]') && bottomNavContent.includes('bottom-1'),
  'Indicador azul de aba ativa deve estar posicionado na base do botão'
);

// Dimensão consistente dos ícones
assert(
  bottomNavContent.includes('w-6 h-6'),
  'Ícones devem ter dimensões confortáveis e consistentes (w-6 h-6)'
);

// Badge de notificação em Minha Zapi
assert(
  bottomNavContent.includes("item.id === 'my-zapitv' && unreadNotificationsCount > 0"),
  'Badge de notificações deve permanecer associado a Minha Zapi'
);
console.log('  -> Dimensões compactas, safe area e indicador ativo validados com sucesso.');

// Teste 4: Preservação de Navegação e Delegação
console.log('\n4. Verificando preservação de navegação e ausência de navigate() duplicado...');
assert.strictEqual(
  bottomNavContent.includes('useNavigate'),
  false,
  'MobileBottomNavigation NÃO deve importar useNavigate'
);
assert(
  bottomNavContent.includes('onSelectTab(item.id)'),
  'handleTabClick deve delegar estritamente para onSelectTab(item.id)'
);
console.log('  -> Delegação de navegação limpa preservada.');

console.log('\n=== TODOS OS TESTES DA BARRA DE NAVEGAÇÃO MINIMALISTA PASSARAM COM SUCESSO! ===');
process.exit(0);
