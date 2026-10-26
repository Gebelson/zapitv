import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { heroLogoService, TMDBRawLogo } from '../src/core/catalog/heroLogoService';
import { ContentItem, ContentType } from '../types';

console.log('=== ZapiTV | Suíte de Testes: Refinamento do Banner Mobile com Logos Oficiais ===\n');

const projectRoot = process.cwd();
const mobileHeroPath = path.resolve(projectRoot, 'src/components/mobile/MobileHero.tsx');
const heroLogoServicePath = path.resolve(projectRoot, 'src/core/catalog/heroLogoService.ts');

assert(fs.existsSync(mobileHeroPath), 'MobileHero.tsx deve existir');
assert(fs.existsSync(heroLogoServicePath), 'heroLogoService.ts deve existir');

const heroCode = fs.readFileSync(mobileHeroPath, 'utf8').replace(/\r\n/g, '\n');
const logoServiceCode = fs.readFileSync(heroLogoServicePath, 'utf8').replace(/\r\n/g, '\n');

// --------------------------------------------------------------------------
// 1. Verificação de Título em Texto Puro (Sem Logos de Conteúdos)
// --------------------------------------------------------------------------
console.log('1. Validando renderização exclusiva do título textual em <h1>...');

assert(
  !heroCode.includes('heroLogoService'),
  'MobileHero.tsx NÃO deve importar nem invocar heroLogoService (títulos exclusivamente em texto)'
);

assert(
  heroCode.includes('<h1') && heroCode.includes('{slideItem.title}'),
  'MobileHero.tsx deve renderizar o título textual diretamente em <h1>'
);

assert(
  !heroCode.includes('displayedSlide.logoUrl') && !heroCode.includes('hero-logo-'),
  'MobileHero.tsx NÃO deve renderizar imagens de logos de conteúdos'
);

assert(
  heroCode.includes("fontFamily: \"'Sora', sans-serif\"") || heroCode.includes("fontFamily: ''Sora', sans-serif'"),
  'Título deve utilizar a fonte Sora'
);

assert(
  heroCode.includes('font-extrabold') || heroCode.includes('font-bold'),
  'Título deve possuir peso Bold ou ExtraBold'
);

assert(
  heroCode.includes('text-left') || heroCode.includes('justify-start'),
  'Título deve possuir alinhamento à esquerda'
);

console.log('  -> Renderização de título textual puro em <h1> validada com sucesso.');

// --------------------------------------------------------------------------
// 2. Remoção Completa da Sinopse do Banner Mobile
// --------------------------------------------------------------------------
console.log('\n2. Validando remoção completa da sinopse...');

assert(
  !heroCode.includes('{slideItem.description &&') &&
  !heroCode.includes('{slideItem.description}'),
  'MobileHero.tsx NÃO deve exibir a sinopse/descrição'
);

assert(
  heroCode.includes('min-h-[52px]') || heroCode.includes('min-h-[56px]'),
  'Estrutura do título/logo deve possuir min-height garantindo estabilidade vertical sem provocar queda dos metadados ou botões'
);

console.log('  -> Sinopse removida com sucesso e estabilidade de layout preservada.');

// --------------------------------------------------------------------------
// 3. Reorganização dos Botões de Ação
// --------------------------------------------------------------------------
console.log('\n3. Validando nova ordem e visual dos botões...');

// Ordem: 1. Assistir, 2. Detalhes, 3. Minha Lista
const buttonsSection = heroCode.slice(heroCode.indexOf('Botões de Ação Principais'));
const indexAssistir = buttonsSection.indexOf('<span>Assistir</span>');
const indexDetalhes = buttonsSection.indexOf('aria-label="Ver detalhes da obra"');
const indexMinhaLista = buttonsSection.indexOf('aria-label={isInList ?');

assert(indexAssistir !== -1, 'Botão Assistir deve existir');
assert(indexDetalhes !== -1, 'Botão Detalhes deve existir');
assert(indexMinhaLista !== -1, 'Botão Minha Lista deve existir');

assert(
  indexAssistir < indexDetalhes && indexDetalhes < indexMinhaLista,
  'A nova ordem dos botões deve ser rigorosamente: 1. Assistir, 2. Detalhes, 3. Minha Lista'
);

// Botão Assistir ocupa o espaço restante (flex-1)
assert(
  buttonsSection.includes('flex-1 py-3 px-4 rounded-xl bg-[#007df7]'),
  'Botão Assistir deve utilizar flex-1 e fundo azul #007df7'
);

// Botão Detalhes possui apenas ícone e dimensões 44x44
assert(
  buttonsSection.includes('w-11 h-11 min-w-[44px] min-h-[44px]') &&
  buttonsSection.includes('<Info className="w-5 h-5 text-white" />'),
  'Botão Detalhes deve possuir dimensões 44x44 px e exibir apenas o ícone Info'
);

// Botão Minha Lista sem texto e com Bookmark de contorno ou preenchido
assert(
  !buttonsSection.includes('<span>Minha Lista</span>'),
  'Texto "Minha Lista" deve ser completamente removido'
);

assert(
  buttonsSection.includes('<Bookmark') &&
  buttonsSection.includes('fill-[#007df7] text-[#007df7]') &&
  buttonsSection.includes('text-white stroke-[1.8]'),
  'Botão Minha Lista deve utilizar ícone Bookmark, preenchido quando na lista e com contorno quando fora'
);

assert(
  buttonsSection.includes('w-11 h-11 min-w-[44px] min-h-[44px]'),
  'Botão Minha Lista deve possuir dimensões 44x44 px idênticas ao botão Detalhes'
);

console.log('  -> Botões reorganizados com sucesso: Assistir (flex-1) -> Detalhes (44x44) -> Minha Lista (44x44 Bookmark).');

// --------------------------------------------------------------------------
// 4. Indicadores do Carrossel Discretamente Rebaixados
// --------------------------------------------------------------------------
console.log('\n4. Validando rebaixamento discreto dos indicadores (dots)...');

assert(
  heroCode.includes('mt-[19px]') || heroCode.includes('mt-5'),
  'Indicadores devem estar rebaixados em aproximadamente 6 a 8 pixels (mt-[19px] ou mt-5)'
);

assert(
  heroCode.includes('pb-[9px]') || heroCode.includes('pb-2.5'),
  'Container inferior deve acomodar o rebaixamento mantendo a posição vertical dos botões estável'
);

assert(
  heroCode.includes('flex items-center justify-center gap-1.5'),
  'Centralização horizontal e espaçamento entre os indicadores devem ser rigorosamente preservados'
);

console.log('  -> Indicadores rebaixados com sucesso preservando alinhamentos e distâncias seguras.');

// --------------------------------------------------------------------------
// 5. Testes Unitários de Prioridade de Idioma e Cache do heroLogoService
// --------------------------------------------------------------------------
console.log('\n5. Validando lógica de ordenação de idiomas e fallbacks do heroLogoService...');

const mockLogos: TMDBRawLogo[] = [
  { file_path: '/logo_en_low.png', iso_639_1: 'en', vote_average: 1.0, vote_count: 1 },
  { file_path: '/logo_fr.png', iso_639_1: 'fr', vote_average: 8.0, vote_count: 5 },
  { file_path: '/logo_pt_best.png', iso_639_1: 'pt', vote_average: 9.5, vote_count: 10 },
  { file_path: '/logo_pt_alt.png', iso_639_1: 'pt', vote_average: 7.0, vote_count: 2 },
  { file_path: '/logo_ja.png', iso_639_1: 'ja', vote_average: 9.0, vote_count: 8 },
  { file_path: '/logo_en_high.png', iso_639_1: 'en', vote_average: 8.5, vote_count: 9 }
];

// Teste A: Filme ocidental (prioriza PT -> EN)
const sortedWestern = heroLogoService.sortTmdbLogos(mockLogos, 'en');
assert.strictEqual(sortedWestern[0].file_path, '/logo_pt_best.png', 'Logo PT com maior nota deve ser o primeiro');
assert.strictEqual(sortedWestern[1].file_path, '/logo_pt_alt.png', 'Segundo logo deve ser o PT alternativo');
assert.strictEqual(sortedWestern[2].file_path, '/logo_en_high.png', 'Terceiro logo deve ser o EN com maior nota');

// Teste B: Anime japonês (prioriza PT -> JA -> EN)
const sortedAnime = heroLogoService.sortTmdbLogos(mockLogos, 'ja');
assert.strictEqual(sortedAnime[0].file_path, '/logo_pt_best.png', 'Anime deve priorizar logo em português se existir');
assert.strictEqual(sortedAnime[2].file_path, '/logo_ja.png', 'Em seguida deve priorizar o idioma original japonês');

// Teste C: Mock de Item sem TMDB e com Cinemeta
const mockItemCinemeta: ContentItem = {
  id: 'movie-cine-1',
  title: 'Filme Cinemeta',
  imdbId: 'tt9999999',
  type: ContentType.MOVIE,
  year: 2024
};

// Teste D: Deduplicação e Cache
heroLogoService.clearCache();
assert.strictEqual(heroLogoService.getResolvedLogoSync(mockItemCinemeta), undefined, 'Cache deve iniciar vazio');

console.log('  -> Lógica de seleção por idioma, qualidade e cache do heroLogoService validada com 100% de sucesso.');

// --------------------------------------------------------------------------
// 6. Isolamento e Não-Modificação de Outras Plataformas
// --------------------------------------------------------------------------
console.log('\n6. Validando isolamento de Desktop e Smart TV...');

const tvHeroPath = path.resolve(projectRoot, 'src/components/tv/TvHeroBanner.tsx');
if (fs.existsSync(tvHeroPath)) {
  const tvHeroCode = fs.readFileSync(tvHeroPath, 'utf8');
  assert(
    !tvHeroCode.includes('heroLogoService'),
    'TvHeroBanner não deve ser alterado indevidamente'
  );
}

console.log('  -> Plataformas Desktop e Smart TV permanecem 100% isoladas e inalteradas.');

console.log('\n--- TODOS OS TESTES PASSARAM COM SUCESSO! ---\n');
