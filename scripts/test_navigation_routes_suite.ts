import { getContentRoute, getEpisodeRoute, ROUTES } from '../src/core/routes/navigationRoutes.ts';
import { ContentType, ContentItem } from '../types.ts';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FALHA] ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✅ [PASS] ${message}`);
  }
}

async function runNavigationSuite() {
  console.log('============================================================');
  console.log(' SUÍTE DE TESTES DE NAVEGAÇÃO E ROTAS CLIENT-SIDE (ZAPITV)');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  const test = (name: string, fn: () => void) => {
    total++;
    try {
      fn();
      passed++;
    } catch (e: any) {
      console.error(`Erro no teste ${name}:`, e.message);
    }
  };

  // 1. Testes de Definição de Rotas Canônicas
  console.log('Grupo 1: Rotas Canônicas Definidas e URLs Independentes');
  test('1.1: Rota Início é "/"', () => {
    assert(ROUTES.HOME === '/', 'ROUTES.HOME deve ser "/"');
  });

  test('1.2: Rota Em Destaque é "/em-destaque"', () => {
    assert(ROUTES.FEATURED === '/em-destaque', 'ROUTES.FEATURED deve ser "/em-destaque"');
  });

  test('1.3: Rota Filmes é "/filmes" e detalhes "/filmes/:id"', () => {
    assert(ROUTES.MOVIES === '/filmes', 'ROUTES.MOVIES deve ser "/filmes"');
    assert(ROUTES.MOVIE_DETAIL === '/filmes/:id', 'ROUTES.MOVIE_DETAIL deve ser "/filmes/:id"');
  });

  test('1.4: Rota Séries é "/series", detalhes "/series/:id" e episódios diretos', () => {
    assert(ROUTES.SERIES === '/series', 'ROUTES.SERIES deve ser "/series"');
    assert(ROUTES.SERIES_DETAIL === '/series/:id', 'ROUTES.SERIES_DETAIL deve ser "/series/:id"');
    assert(ROUTES.SERIES_EPISODE === '/series/:id/temporada/:season/episodio/:episode', 'ROUTES.SERIES_EPISODE deve conter parâmetros de temporada e episódio');
  });

  test('1.5: Rota Animes é "/animes", detalhes "/animes/:id" e episódios diretos', () => {
    assert(ROUTES.ANIMES === '/animes', 'ROUTES.ANIMES deve ser "/animes"');
    assert(ROUTES.ANIME_DETAIL === '/animes/:id', 'ROUTES.ANIME_DETAIL deve ser "/animes/:id"');
    assert(ROUTES.ANIME_EPISODE === '/animes/:id/temporada/:season/episodio/:episode', 'ROUTES.ANIME_EPISODE deve conter parâmetros de temporada e episódio');
  });

  test('1.6: Rotas de Funcionalidades Especiais (Programas, Televisão, Minha Lista, Histórico)', () => {
    assert(ROUTES.PROGRAMAS === '/programas', 'ROUTES.PROGRAMAS deve ser "/programas"');
    assert(ROUTES.TELEVISION === '/televisao', 'ROUTES.TELEVISION deve ser "/televisao"');
    assert(ROUTES.MY_LIST === '/minha-lista', 'ROUTES.MY_LIST deve ser "/minha-lista"');
    assert(ROUTES.HISTORY === '/historico', 'ROUTES.HISTORY deve ser "/historico"');
  });

  // 2. Testes dos Helpers de Geração de Rotas de Conteúdo
  console.log('\nGrupo 2: Resolução de Rotas de Conteúdo e Episódios');
  test('2.1: Filme gera rota "/filmes/:id"', () => {
    const movie: ContentItem = { id: 'tt0111161', title: 'Um Sonho de Liberdade', type: ContentType.MOVIE, rating: 9.3, year: 1994, image: '' };
    assert(getContentRoute(movie) === '/filmes/tt0111161', 'Filme deve mapear para /filmes/tt0111161');
  });

  test('2.2: Série gera rota "/series/:id"', () => {
    const series: ContentItem = { id: 'tt0903747', title: 'Breaking Bad', type: ContentType.SERIES, rating: 9.5, year: 2008, image: '' };
    assert(getContentRoute(series) === '/series/tt0903747', 'Série deve mapear para /series/tt0903747');
  });

  test('2.3: Anime gera rota "/animes/:id"', () => {
    const anime: ContentItem = { id: 'open-anime-1', title: 'Mushoku Tensei', type: ContentType.ANIME, rating: 8.8, year: 2021, image: '' };
    assert(getContentRoute(anime) === '/animes/open-anime-1', 'Anime deve mapear para /animes/open-anime-1');
  });

  test('2.4: Episódio de Série gera rota profunda "/series/:id/temporada/:season/episodio/:episode"', () => {
    const series: ContentItem = { id: 'tt0903747', title: 'Breaking Bad', type: ContentType.SERIES, rating: 9.5, year: 2008, image: '' };
    const epRoute = getEpisodeRoute(series, 2, 8);
    assert(epRoute === '/series/tt0903747/temporada/2/episodio/8', 'Episódio deve mapear com temporada 2 e episódio 8');
  });

  test('2.5: Episódio de Anime gera rota profunda "/animes/:id/temporada/:season/episodio/:episode"', () => {
    const anime: ContentItem = { id: 'mushoku-tensei', title: 'Mushoku Tensei', type: ContentType.ANIME, rating: 8.8, year: 2021, image: '' };
    const epRoute = getEpisodeRoute(anime, 2, 8);
    assert(epRoute === '/animes/mushoku-tensei/temporada/2/episodio/8', 'Anime deve mapear com temporada 2 e episódio 8');
  });

  // 3. Testes de Configuração do Vercel Rewrites para SPA
  console.log('\nGrupo 3: Configuração do vercel.json para SPA Deep Linking');
  test('3.1: vercel.json possui regras de rewrite para index.html sem quebrar /api/*', () => {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf-8'));
    assert(Array.isArray(vercelConfig.rewrites), 'rewrites deve ser um array');
    const apiRule = vercelConfig.rewrites.find((r: any) => r.source.startsWith('/api'));
    const spaRule = vercelConfig.rewrites.find((r: any) => r.destination === '/index.html');
    assert(Boolean(apiRule), 'Regra /api/ deve existir');
    assert(Boolean(spaRule), 'Regra de fallback SPA para /index.html deve existir');
  });

  console.log('\n============================================================');
  console.log(` RESULTADO FINAL NAVEGAÇÃO: ${passed} PASSOU / ${total - passed} FALHOU`);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runNavigationSuite().catch((e) => {
  console.error('Falha geral na suíte de testes de navegação:', e);
  process.exit(1);
});
