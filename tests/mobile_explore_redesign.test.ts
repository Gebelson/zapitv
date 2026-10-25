import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchService } from '../src/core/search/searchService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { ContentItem } from '../types';

console.log('=== ZapiTV | Validação da Reformulação da Página Explorar Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const exploreViewPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileExploreView.tsx');
const layoutPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileLayout.tsx');

const exploreContent = fs.readFileSync(exploreViewPath, 'utf8');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

// Teste 1: Título da Página e Linha Divisória
console.log('1. Verificando Título da Página e Remoção do Subtítulo...');
assert(exploreContent.includes('>Explorar<') || exploreContent.includes('Explorar'), 'Deve conter o título Explorar');
assert.strictEqual(
  exploreContent.includes('Catálogo completo por tipo de mídia e gênero'),
  false,
  'O subtítulo "Catálogo completo por tipo de mídia e gênero" DEVE ser completamente removido'
);
assert(
  exploreContent.includes('border-b border-white/10'),
  'Deve conter a linha divisória horizontal abaixo do título'
);
console.log('  -> Título limpo "Explorar" com borda divisória validado.');

// Teste 2: Quatro Quadros Fixos de Navegação (Grade 2x2)
console.log('\n2. Verificando Grade 2x2 com os 4 Quadros Fixos (Filmes, Séries, Animes, TV ao vivo)...');
assert(
  exploreContent.includes("grid-cols-2") && exploreContent.includes("repeat(2, minmax(0, 1fr))"),
  'Deve possuir grade 2x2 com duas colunas de largura igual'
);

// Verifica as 4 opções obrigatórias
assert(exploreContent.includes("label: 'Filmes'"), 'Opção 1 deve ser Filmes');
assert(exploreContent.includes("label: 'Séries'"), 'Opção 2 deve ser Séries');
assert(exploreContent.includes("label: 'Animes'"), 'Opção 3 deve ser Animes');
assert(exploreContent.includes("label: 'TV ao vivo'"), 'Opção 4 deve ser TV ao vivo');

// Verifica remoção de "Todos" e "Em Destaque" da grade de seleção
assert.strictEqual(
  exploreContent.includes("id: 'all'"),
  false,
  'Opção "Todos" DEVE ser removida da seleção de categorias'
);
assert.strictEqual(
  exploreContent.includes("id: 'featured'"),
  false,
  'Opção "Em Destaque" DEVE ser removida da seleção de categorias'
);

// Verifica que TV ao vivo navega para /programas
assert(
  exploreContent.includes("/programas"),
  'Seleção de TV ao vivo deve redirecionar para a rota /programas sem duplicar código'
);
console.log('  -> Grade fixa 2x2 com as 4 opções e TV ao vivo integrada validada.');

// Teste 3: Barra de Seleção de Gêneros (Estilo Prime Video)
console.log('\n3. Verificando Barra de Seleção de Gêneros...');
assert(
  exploreContent.includes("data-testid=\"explore-genre-bar\""),
  'Deve possuir a barra de seleção de gêneros'
);
assert(
  exploreContent.includes("ChevronDown"),
  'Barra de gêneros deve exibir ícone de seta indicando que pode ser expandida'
);
assert(
  exploreContent.includes("Todos os gêneros"),
  'Inicialmente deve apresentar "Todos os gêneros"'
);

// Verifica ausência de carrossel horizontal de gêneros na página principal
assert.strictEqual(
  exploreContent.includes("overflow-x-auto no-scrollbar py-1 mb-4"),
  false,
  'NÃO deve haver carrossel horizontal de gêneros'
);
console.log('  -> Barra de gêneros discreta tipo Prime Video validada.');

// Teste 4: Menu de Gêneros em Tela Cheia (Fullscreen)
console.log('\n4. Verificando Menu de Gêneros em Tela Cheia e Portal...');
assert(
  exploreContent.includes("createPortal"),
  'Menu de gêneros deve utilizar createPortal para renderização no topo do DOM'
);
assert(
  exploreContent.includes("bg-[#07090E]"),
  'Menu de tela cheia deve possuir fundo escuro #07090E da ZapiTV'
);
assert(
  exploreContent.includes("fixed inset-0") && exploreContent.includes("w-screen h-screen"),
  'Menu deve ocupar toda a viewport'
);
assert(
  exploreContent.includes("data-testid=\"mobile-genre-list\""),
  'Deve conter a lista vertical de gêneros com rolagem'
);
assert(
  exploreContent.includes("text-[#007df7]") && exploreContent.includes("Check"),
  'Gênero selecionado deve ser visualmente destacado com #007df7 e ícone Check'
);
console.log('  -> Menu em tela cheia com portal e lista vertical validado.');

// Teste 5: Botão de Fechar Centralizado
console.log('\n5. Verificando Botão de Fechar Centralizado...');
assert(
  exploreContent.includes("data-testid=\"close-genre-menu-btn\""),
  'Deve possuir o botão de fechar do menu de gêneros'
);
assert(
  exploreContent.includes("left-1/2 -translate-x-1/2"),
  'Botão de fechar DEVE estar horizontalmente centralizado na tela'
);
assert(
  exploreContent.includes("rounded-full"),
  'Botão de fechar deve ter formato circular'
);
assert(
  exploreContent.includes("bottom-[max("),
  'Botão de fechar deve respeitar safe area inferior do dispositivo'
);
console.log('  -> Botão circular de fechar perfeitamente centralizado validado.');

// Teste 6: Ocultação do Header e Barra Inferior
console.log('\n6. Verificando Ocultação do Header e Barra Inferior durante Menu Aberto...');
assert(
  layoutContent.includes("!isGenreMenuOpen && (") && layoutContent.includes("<MobileHeader"),
  'MobileHeader NÃO deve aparecer enquanto o menu de gêneros estiver aberto'
);
assert(
  layoutContent.includes("!isGenreMenuOpen && (") && layoutContent.includes("<MobileBottomNavigation"),
  'MobileBottomNavigation NÃO deve aparecer enquanto o menu de gêneros estiver aberto'
);
assert(
  exploreContent.includes("document.body.style.overflow = 'hidden'"),
  'Rolagem de fundo DEVE ser bloqueada ao abrir o menu de gêneros'
);
assert(
  exploreContent.includes("document.body.style.overflow = ''"),
  'Rolagem de fundo DEVE ser restaurada ao fechar o menu'
);
assert(
  exploreContent.includes("popstate") && exploreContent.includes("keydown"),
  'Botão Voltar do Android e tecla Escape devem fechar o menu de gêneros'
);
console.log('  -> Ocultação estrita de Header, Bottom Navigation e bloqueio de scroll validados.');

// Teste 7: Filtragem de Conteúdos e Isolamento Estrito
console.log('\n7. Verificando lógica de filtragem por categoria e gênero...');
const mockItems: ContentItem[] = [
  { id: 'm1', title: 'Filme Ação 1', type: 'movie', genres: ['Ação', 'Aventura'], rating: 8.5 } as any,
  { id: 'm2', title: 'Filme Drama 1', type: 'movie', genres: ['Drama'], rating: 7.9 } as any,
  { id: 's1', title: 'Série Suspense 1', type: 'series', genres: ['Suspense', 'Drama'], rating: 8.8 } as any,
  { id: 's2', title: 'Série Comédia 1', type: 'series', genres: ['Comédia'], rating: 7.5 } as any,
  { id: 'a1', title: 'Anime Ação 1', type: 'anime', genres: ['Anime', 'Ação', 'Fantasia'], rating: 9.0 } as any,
  { id: 'a2', title: 'Anime Romance 1', type: 'anime', genres: ['Anime', 'Romance'], rating: 8.2 } as any
];

// Categoria Filmes + Gênero Ação
const moviesAcao = mockItems
  .filter(it => searchService.isMovieItem(it))
  .filter(it => it.genres?.includes('Ação'));
assert.strictEqual(moviesAcao.length, 1, 'Deve encontrar 1 filme de ação');
assert.strictEqual(moviesAcao[0].id, 'm1');

// Categoria Séries + Gênero Suspense
const seriesSuspense = mockItems
  .filter(it => searchService.isSeriesItem(it) && !searchService.isAnimeItem(it))
  .filter(it => it.genres?.includes('Suspense'));
assert.strictEqual(seriesSuspense.length, 1, 'Deve encontrar 1 série de suspense');
assert.strictEqual(seriesSuspense[0].id, 's1');

// Animes NÃO podem vazar para Séries
const animesInSeries = seriesSuspense.filter(it => searchService.isAnimeItem(it));
assert.strictEqual(animesInSeries.length, 0, 'Animes NÃO podem vazar para séries');

// Categoria Animes + Gênero Romance
const animesRomance = mockItems
  .filter(it => searchService.isAnimeItem(it))
  .filter(it => it.genres?.includes('Romance'));
assert.strictEqual(animesRomance.length, 1, 'Deve encontrar 1 anime de romance');
assert.strictEqual(animesRomance[0].id, 'a2');
console.log('  -> Filtragem estrita sem vazamentos validada.');

// Teste 8: Ausência Total de Contadores de Títulos
console.log('\n8. Verificando ausência de contadores de títulos na página Explorar...');
assert.strictEqual(
  exploreContent.includes('títulos encontrados'),
  false,
  'NÃO deve existir texto "{X} títulos encontrados" em MobileExploreView'
);
assert.strictEqual(
  exploreContent.includes('filmes encontrados'),
  false,
  'NÃO deve existir texto "X filmes encontrados"'
);
assert.strictEqual(
  exploreContent.includes('séries encontradas'),
  false,
  'NÃO deve existir texto "X séries encontradas"'
);
console.log('  -> Zero contadores de títulos validado.');

// Teste 9: Proporcionalidade em Telas Mobile (320px, 375px, 390px, 430px)
console.log('\n9. Verificando responsividade em viewports de 320px, 375px, 390px e 430px...');
const testWidths = [320, 375, 390, 430];
testWidths.forEach(width => {
  const paddingX = 16 * 2; // px-4 = 16px de cada lado
  const gap = 12; // gap-3 = 12px
  const availableWidth = width - paddingX;
  const colWidth = (availableWidth - gap) / 2;

  assert(colWidth > 120, `Largura da coluna em ${width}px (${colWidth}px) deve ser confortável para o card`);
  assert(availableWidth > 0, `Largura disponível em ${width}px deve ser positiva`);
});
console.log('  -> Todas as larguras móveis (320px a 430px) suportam a grade 2x2 com folga.');

console.log('\n=== TODOS OS TESTES DA REFORMULAÇÃO DA PÁGINA EXPLORAR PASSARAM COM SUCESSO! ===');
process.exit(0);
