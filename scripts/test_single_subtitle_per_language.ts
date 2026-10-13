import { subtitleService, calculateSubtitleQualityScore } from '../src/core/subtitles/subtitleService';
import { ContentItem, ContentType } from '../types';

async function runTests() {
  console.log('=== TESTE DE REGRA: 1 LEGENDA POR IDIOMA (APENAS A MELHOR) ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // 1. Teste de Scoring de Qualidade
  const highQualitySub = {
    url: 'https://subs.example.com/movie_1080p_bluray.srt',
    movieReleaseName: 'Oppenheimer.2023.1080p.BluRay.x264',
    rating: 9.8,
    downloads: 12000,
    hearing_impaired: false,
    lang: 'pob'
  };

  const lowQualitySub = {
    url: 'https://subs.example.com/movie_cam.srt',
    movieReleaseName: 'Oppenheimer.2023.HDCAM.x264',
    rating: 4.2,
    downloads: 300,
    hearing_impaired: true,
    lang: 'pob'
  };

  const highScore = calculateSubtitleQualityScore(highQualitySub, 0);
  const lowScore = calculateSubtitleQualityScore(lowQualitySub, 5);

  assert(highScore > lowScore, `Legenda BluRay/WEB-DL tem pontuação muito superior (${highScore}) à versão CAM (${lowScore})`);

  // 2. Teste Real com Filme que possui dezenas de legendas no OpenSubtitles
  const movie: ContentItem = {
    id: 'movie-fight-club',
    imdbId: 'tt0137523', // Fight Club
    title: 'Clube da Luta',
    type: ContentType.MOVIE,
    image: ''
  };

  const subs = await subtitleService.fetchSubtitles(movie);
  assert(subs.length > 0, `Retorna legendas para o filme (${subs.length} idiomas disponíveis)`);

  // 3. Verificar que NÃO HÁ NENHUM IDIOMA DUPLICADO!
  const languageCounts = new Map<string, number>();
  subs.forEach(s => {
    const key = s.languageName;
    languageCounts.set(key, (languageCounts.get(key) || 0) + 1);
  });

  let hasDuplicates = false;
  languageCounts.forEach((count, lang) => {
    if (count > 1) {
      hasDuplicates = true;
      console.error(`[ERRO]: Idioma "${lang}" apareceu ${count} vezes!`);
    }
  });

  assert(!hasDuplicates, 'TODOS os idiomas possuem rigorosamente APENAS 1 legenda (sem duplicatas)');

  // 4. Verificar presença de Português (Brasil) único no topo
  const ptSubs = subs.filter(s => s.isPtBr || s.languageName === 'Português (Brasil)');
  assert(ptSubs.length === 1, 'Existe exatamente 1 legenda para Português (Brasil)');
  assert(subs[0].isPtBr === true, 'A única legenda em Português (Brasil) está no topo absoluto');

  // 5. Verificar que não há labels poluídos com "(Opção 2)", "(Principal)", etc.
  const hasPollutedLabels = subs.some(s => s.label.includes('Opção') || s.label.includes('(Principal)'));
  assert(!hasPollutedLabels, 'Nenhuma legenda possui labels artificiais como "(Opção 2)" ou "(Principal)"');

  console.log(`\nResultado: ${passed}/${total} testes passaram.`);
  if (passed !== total) process.exit(1);
}

runTests();
