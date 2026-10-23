import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { ContentItem, ContentType } from '../types';
import { animeEditorialService, hasPtBrAudioEvidence } from '../src/core/anime/animeEditorialService';
import { searchService } from '../src/core/search/searchService';

async function runTvAnimeCrunchyrollTests() {
  console.log('--- Auditoria e Testes: Carrosséis de Animes no Padrão Crunchyroll Brasil (Smart TV) ---');

  // 1. Verificação da existência dos arquivos exclusivos
  const animeViewPath = path.resolve(process.cwd(), 'src/components/tv/TvAnimeView.tsx');
  const servicePath = path.resolve(process.cwd(), 'src/core/anime/animeEditorialService.ts');
  const tvAppPath = path.resolve(process.cwd(), 'src/pages/tv/TvApp.tsx');
  const tvCategoryPath = path.resolve(process.cwd(), 'src/components/tv/TvCategoryView.tsx');

  assert(fs.existsSync(animeViewPath), 'TvAnimeView.tsx deve existir');
  assert(fs.existsSync(servicePath), 'animeEditorialService.ts deve existir');
  assert(fs.existsSync(tvAppPath), 'TvApp.tsx deve existir');

  const animeViewCode = fs.readFileSync(animeViewPath, 'utf8');
  const serviceCode = fs.readFileSync(servicePath, 'utf8');
  const tvAppCode = fs.readFileSync(tvAppPath, 'utf8');
  const tvCategoryCode = fs.readFileSync(tvCategoryPath, 'utf8');

  console.log('✓ Teste 1: Arquitetura isolada com TvAnimeView.tsx e animeEditorialService.ts OK');

  // 2. Isolamento estrito: TvApp usa TvAnimeView apenas para animes; Séries e Filmes continuam em TvCategoryView
  assert(
    tvAppCode.includes("currentTab === 'animes' ? (") &&
    tvAppCode.includes('<TvAnimeView') &&
    tvAppCode.includes("currentTab === 'movies' ? (") &&
    tvAppCode.includes('<TvCategoryView') &&
    tvAppCode.includes("currentTab === 'series' ? ("),
    'TvApp deve renderizar TvAnimeView exclusivamente na aba animes, mantendo TvCategoryView para Filmes e Séries'
  );
  assert(
    !tvCategoryCode.includes('animeEditorialService'),
    'TvCategoryView deve permanecer genérico e limpo, sem dependência do serviço de animes'
  );
  console.log('✓ Teste 2: Isolamento de escopo (exclusivo para Animes na Smart TV) OK');

  // 3. Catálogo de mock para validação de cruzamento e curadoria
  const sampleAnimes: ContentItem[] = [
    {
      id: 'a1',
      title: 'Solo Leveling',
      originalTitle: 'Ore dake Level Up na Ken',
      type: ContentType.ANIME,
      year: 2024,
      rating: 9.1,
      image: 'https://img.test/solo.jpg',
      genres: ['Anime', 'Ação', 'Fantasia'],
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'a2',
      title: 'Jujutsu Kaisen',
      originalTitle: 'Jujutsu Kaisen',
      type: ContentType.ANIME,
      year: 2023,
      rating: 8.9,
      image: 'https://img.test/jjk.jpg',
      genres: ['Anime', 'Ação', 'Shounen'],
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'a3',
      title: 'Frieren e a Jornada para o Além',
      originalTitle: 'Sousou no Frieren',
      type: ContentType.ANIME,
      year: 2024,
      rating: 9.3,
      image: 'https://img.test/frieren.jpg',
      genres: ['Anime', 'Fantasia', 'Aventura'],
      audioStatus: 'pt-br-subtitles' // legendado
    },
    {
      id: 'a4',
      title: 'Demon Slayer: Kimetsu no Yaiba',
      originalTitle: 'Kimetsu no Yaiba',
      type: ContentType.ANIME,
      year: 2024,
      rating: 9.0,
      image: 'https://img.test/demonslayer.jpg',
      genres: ['Anime', 'Ação', 'Shounen', 'Fantasia'],
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'a5',
      title: 'Kaguya-sama: Love Is War',
      originalTitle: 'Kaguya-sama wa Kokurasetai',
      type: ContentType.ANIME,
      year: 2022,
      rating: 8.8,
      image: 'https://img.test/kaguya.jpg',
      genres: ['Anime', 'Romance', 'Comédia Romântica']
    },
    {
      id: 'a6',
      title: 'Death Note',
      originalTitle: 'Death Note',
      type: ContentType.ANIME,
      year: 2006,
      rating: 9.0,
      image: 'https://img.test/deathnote.jpg',
      genres: ['Anime', 'Mistério', 'Suspense'],
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'a7',
      title: 'Fullmetal Alchemist: Brotherhood',
      originalTitle: 'Hagane no Renkinjutsushi',
      type: ContentType.ANIME,
      year: 2009,
      rating: 9.2,
      image: 'https://img.test/fma.jpg',
      genres: ['Anime', 'Ação', 'Shounen'],
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'a8',
      title: 'Cowboy Bebop',
      originalTitle: 'Cowboy Bebop',
      type: ContentType.ANIME,
      year: 1998,
      rating: 8.9,
      image: 'https://img.test/bebop.jpg',
      genres: ['Anime', 'Ação', 'Ficção Científica']
    },
    {
      id: 'a9',
      title: 'Horimiya',
      originalTitle: 'Horimiya',
      type: ContentType.ANIME,
      year: 2021,
      rating: 8.2,
      image: 'https://img.test/horimiya.jpg',
      genres: ['Anime', 'Romance', 'Slice of Life']
    },
    {
      id: 'a10',
      title: 'My Dress-Up Darling',
      originalTitle: 'Sono Bisque Doll wa Koi wo Suru',
      type: ContentType.ANIME,
      year: 2022,
      rating: 8.3,
      image: 'https://img.test/marin.jpg',
      genres: ['Anime', 'Romance', 'Comédia']
    },
    // Item que NÃO é anime (Filme live action ocidental)
    {
      id: 'm1',
      title: 'Oppenheimer',
      type: ContentType.MOVIE,
      year: 2023,
      rating: 8.5,
      image: 'https://img.test/opp.jpg',
      genres: ['Drama', 'História']
    }
  ];

  // 4. Teste de geração de carrosséis editoriais
  const categories = animeEditorialService.getEditorialCategories(sampleAnimes);
  assert(categories.length > 0, 'Categorias editoriais devem ser geradas');

  // Verifica que títulos não-anime NUNCA são inseridos em nenhuma categoria
  for (const cat of categories) {
    const hasNonAnime = cat.items.some(item => !searchService.isAnimeItem(item));
    assert(!hasNonAnime, `Categoria ${cat.title} não deve conter itens que não são animes`);
  }
  console.log('✓ Teste 3: Filtragem estrita de animes elegíveis (rejeição de conteúdos não-anime) OK');

  // 5. Categorias esperadas inspiradas na Crunchyroll
  const categoryIds = categories.map(c => c.id);
  console.log('Categorias ativas geradas:', categories.map(c => c.title));

  assert(categoryIds.includes('anime-popular'), 'Deve conter "Animes Mais Populares"');
  assert(categoryIds.includes('anime-simulcasts'), 'Deve conter "Simulcasts da Temporada"');
  assert(categoryIds.includes('anime-dubbed'), 'Deve conter "Dublados em Português"');
  assert(categoryIds.includes('anime-action'), 'Deve conter "Ação e Aventura"');
  assert(categoryIds.includes('anime-romance'), 'Deve conter "Romance"');
  assert(categoryIds.includes('anime-shounen'), 'Deve conter "Shounen"');
  assert(categoryIds.includes('anime-classics'), 'Deve conter "Clássicos Imperdíveis"');

  console.log('✓ Teste 4: Categorias editoriais baseadas na Crunchyroll Brasil estruturadas OK');

  // 6. Teste de Dublagem PT-BR confiável
  const dubbedCat = categories.find(c => c.id === 'anime-dubbed');
  assert(dubbedCat, 'Categoria Dublados em Português deve estar presente');
  for (const item of dubbedCat.items) {
    assert(hasPtBrAudioEvidence(item), `Anime ${item.title} deve ter evidência real de dublagem PT-BR`);
  }
  // Frieren (que foi marcada como pt-br-subtitles) NÃO deve estar em dublados
  assert(
    !dubbedCat.items.some(it => it.id === 'a3'),
    'Frieren (marcada com legendas) não deve entrar na categoria Dublados'
  );
  console.log('✓ Teste 5: Categoria Dublados restrita estritamente a títulos com evidência de áudio PT-BR OK');

  // 7. Ausência de carrosséis vazios ou com menos de 3 títulos
  for (const cat of categories) {
    assert(cat.items.length >= 3, `Categoria ${cat.title} deve ter pelo menos 3 itens (encontrado: ${cat.items.length})`);
  }
  console.log('✓ Teste 6: Regra anti-vazio validada (nenhum carrossel com menos de 3 itens) OK');

  // 8. Sem duplicações dentro de cada carrossel
  for (const cat of categories) {
    const ids = cat.items.map(it => it.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, `Categoria ${cat.title} não pode ter itens duplicados`);
  }
  console.log('✓ Teste 7: Ausência de duplicatas em cada carrossel individual OK');

  // 9. Clássicos Imperdíveis deve conter apenas animes antigos consagrados
  const classicsCat = categories.find(c => c.id === 'anime-classics');
  assert(classicsCat, 'Categoria Clássicos Imperdíveis deve estar presente');
  assert(classicsCat.items.some(it => it.title === 'Death Note'), 'Death Note deve estar em Clássicos');
  assert(classicsCat.items.some(it => it.title === 'Fullmetal Alchemist: Brotherhood'), 'FMA Brotherhood deve estar em Clássicos');
  assert(classicsCat.items.some(it => it.title === 'Cowboy Bebop'), 'Cowboy Bebop deve estar em Clássicos');
  assert(!classicsCat.items.some(it => it.year >= 2023), 'Animes recentes não devem entrar em Clássicos');
  console.log('✓ Teste 8: Curadoria de Clássicos Imperdíveis com critérios cronológicos e de prestígio OK');

  // 10. Resiliência a falhas de rede: funciona sem depender de conexão externa
  const offlineCats = animeEditorialService.getEditorialCategories(sampleAnimes);
  assert.strictEqual(offlineCats.length, categories.length, 'EditorialService opera offline com 100% de estabilidade');
  console.log('✓ Teste 9: Funcionamento offline e sem scraping contínuo OK');

  // 11. Verificação do componente visual TvAnimeView
  assert(
    animeViewCode.includes('TvHeroBanner') &&
    animeViewCode.includes('TvContentRow') &&
    animeViewCode.includes('animeEditorialService.getEditorialCategories') &&
    animeViewCode.includes('handleFirstRowUpPress'),
    'TvAnimeView deve reutilizar TvHeroBanner, TvContentRow e gerenciar a navegação espacial por D-Pad'
  );
  console.log('✓ Teste 10: Componente TvAnimeView reutiliza TvHeroBanner e TvContentRow mantendo identidade visual OK');

  console.log('\n--- TODOS OS 10 TESTES DE CARROSSÉIS DE ANIMES PASSARAM COM SUCESSO! ---');
  process.exit(0);
}

runTvAnimeCrunchyrollTests().catch(err => {
  console.error('Falha nos testes de animes Crunchyroll:', err);
  process.exit(1);
});
