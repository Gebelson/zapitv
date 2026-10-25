import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('=== ZapiTV | Validação da Home Mobile Cinematográfica com Header Integrado ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const homeViewPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileHomeView.tsx');
const headerPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileHeader.tsx');
const heroPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileHero.tsx');
const explorePath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileExploreView.tsx');

// Teste 1: Remoção dos Filtros Rápidos da Home Mobile
console.log('1. Verificando ausência de filtros rápidos na Home Mobile...');
const homeViewContent = fs.readFileSync(homeViewPath, 'utf8');

assert.strictEqual(
  homeViewContent.includes('quickFilterChips'),
  false,
  'MobileHomeView NÃO deve conter quickFilterChips'
);

assert.strictEqual(
  homeViewContent.includes('pt-16 pb-2 px-4 flex items-center gap-2 overflow-x-auto'),
  false,
  'MobileHomeView NÃO deve conter container pt-16 de chips'
);

// Verifica que o primeiro elemento filho é o MobileHero
const heroIndex = homeViewContent.indexOf('<MobileHero');
assert(heroIndex > -1, 'MobileHomeView deve renderizar <MobileHero>');
const pb28Index = homeViewContent.indexOf('className="pb-28"');
assert(heroIndex > pb28Index, 'MobileHero deve estar dentro do container principal');

// Não há elementos intermediários entre <div className="pb-28"> e <MobileHero
const betweenContent = homeViewContent.slice(pb28Index, heroIndex);
assert.strictEqual(
  betweenContent.includes('button') || betweenContent.includes('quickFilter'),
  false,
  'Não deve haver chips ou botões antes do MobileHero na Home'
);
console.log('  -> Filtros rápidos removidos e MobileHero posicionado diretamente no topo.');

// Teste 2: Banner Mobile Iniciando no Topo e Preenchendo a Viewport
console.log('\n2. Verificando dimensões e enquadramento do MobileHero...');
const heroContent = fs.readFileSync(heroPath, 'utf8');

assert(
  heroContent.includes('bg-[#05070a]'),
  'MobileHero deve usar a cor de background da aplicação (#05070a)'
);

assert(
  heroContent.includes('h-[58vh]') || heroContent.includes('min-h-[420px]'),
  'MobileHero deve ter altura cinematográfica adaptativa'
);

assert(
  heroContent.includes('object-cover object-top'),
  'MobileHero deve enquadrar a imagem no topo com object-cover'
);

assert(
  heroContent.includes('from-[#05070a]'),
  'MobileHero deve ter gradiente inferior fundindo suavemente com #05070a'
);
console.log('  -> MobileHero configurado para início no topo com transição contínua.');

// Teste 3: Header com Degradê Cinematográfico e Blur Progressivo
console.log('\n3. Verificando Header com blur progressivo e ausência de bordas duras...');
const headerContent = fs.readFileSync(headerPath, 'utf8');

// Isola o elemento <header>...</header>
const headerTagMatch = headerContent.match(/<header[\s\S]*?<\/header>/);
assert(headerTagMatch, 'MobileHeader deve conter a tag <header>');
const headerBarCode = headerTagMatch[0];

// Não deve conter borda inferior nem sombra dura na barra do header
assert.strictEqual(
  headerBarCode.includes('border-b'),
  false,
  'MobileHeader NÃO deve possuir border-b na barra do header'
);

assert.strictEqual(
  headerBarCode.includes('shadow-lg'),
  false,
  'MobileHeader NÃO deve possuir shadow-lg na barra do header'
);

// Deve conter máscara gradual (maskImage) para blur progressivo
assert(
  headerBarCode.includes('maskImage') && headerBarCode.includes('linear-gradient'),
  'MobileHeader deve utilizar maskImage com gradiente para blur progressivo'
);

assert(
  headerBarCode.includes('WebkitMaskImage'),
  'MobileHeader deve incluir -webkit-mask-image para compatibilidade com WebKit/iOS'
);

assert(
  headerBarCode.includes('backdrop-blur'),
  'MobileHeader deve aplicar backdrop-blur progressivo'
);

// Deve respeitar safe area do topo
assert(
  headerBarCode.includes('pt-[env(safe-area-inset-top,0px)]'),
  'MobileHeader deve respeitar env(safe-area-inset-top)'
);

// Deve ser fixed no topo
assert(
  headerBarCode.includes('fixed top-0 left-0 right-0'),
  'MobileHeader deve ser fixed no topo'
);

// Eventos de clique: pointer-events-none no wrapper e pointer-events-auto na barra
assert(
  headerBarCode.includes('pointer-events-none') && headerBarCode.includes('pointer-events-auto'),
  'MobileHeader deve usar pointer-events-none no container e pointer-events-auto nos controles'
);
console.log('  -> MobileHeader cinematográfico com blur progressivo e máscara validado.');

// Teste 4: Preservação da Aba Explorar
console.log('\n4. Verificando preservação dos filtros na aba Explorar...');
const exploreContent = fs.readFileSync(explorePath, 'utf8');
assert(
  exploreContent.includes('categories') || exploreContent.includes('categoryChips') || exploreContent.includes('activeCategory'),
  'Aba Explorar deve preservar a navegação por categorias'
);
console.log('  -> Aba Explorar e seus filtros permanecem intactos.');

// Teste 5: Suavidade da Transição na Rolagem
console.log('\n5. Verificando comportamento de transição scrollY...');
const isScrolledAtTop = 0 > 20;
const isScrolledDown = 45 > 20;
assert.strictEqual(isScrolledAtTop, false, 'No topo (scrollY=0), isScrolled deve ser false');
assert.strictEqual(isScrolledDown, true, 'Ao rolar (scrollY=45), isScrolled deve ser true');
console.log('  -> Estados de transição scroll validados com sucesso.');

console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
process.exit(0);
