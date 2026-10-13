import { subtitleService } from '../src/core/subtitles/subtitleService';
import { ContentItem, ContentType } from '../types';

async function runTests() {
  console.log('=== TESTE DE GARANTIA OBRIGATÓRIA DE LEGENDA EM PORTUGUÊS ===\n');

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

  // 1. Filme com IMDb ID conhecido (Um Sonho de Liberdade / Shawshank)
  const itemWithImdb: ContentItem = {
    id: 'movie-shawshank',
    imdbId: 'tt0111161',
    title: 'Um Sonho de Liberdade',
    type: ContentType.MOVIE,
    image: ''
  };

  const subs1 = await subtitleService.fetchSubtitles(itemWithImdb);
  assert(subs1.length > 0, 'Retorna legendas para título com IMDb ID');
  const hasPt1 = subs1.some(s => s.isPtBr || /^(pob|pt-br|bra|por|pt)$/i.test(s.lang));
  assert(hasPt1, 'CONTÉM SEMPRE legenda em português para filme com IMDb ID');
  assert(subs1[0].isPtBr === true, 'Legenda em Português (Brasil) está posicionada no topo absoluto');

  // 2. Anime com apenas título e temporada/episódio (Naruto S1E1)
  const animeTitleOnly: ContentItem = {
    id: 'anime-naruto-custom-id',
    title: 'Naruto',
    type: ContentType.ANIME,
    image: ''
  };

  const subs2 = await subtitleService.fetchSubtitles(animeTitleOnly, 1, 1);
  assert(subs2.length > 0, 'Resolve IMDb ID e busca legendas para anime pesquisado por título');
  const hasPt2 = subs2.some(s => s.isPtBr || /^(pob|pt-br|bra|por|pt)$/i.test(s.lang));
  assert(hasPt2, 'CONTÉM SEMPRE legenda em português para anime');

  // 3. Título sem cadastro no OpenSubtitles / stream de teste
  const sampleItem: ContentItem = {
    id: 'sample-stream',
    title: 'Vídeo Sem Cadastro Externo',
    type: ContentType.MOVIE,
    image: ''
  };

  const subs3 = await subtitleService.fetchSubtitles(sampleItem);
  assert(subs3.length > 0, 'Não retorna lista vazia mesmo sem cadastro externo');
  const hasPt3 = subs3.some(s => s.isPtBr || /^(pob|pt-br|bra|por|pt)$/i.test(s.lang));
  assert(hasPt3, 'CONTÉM SEMPRE opção de legenda em português via faixa garantida');
  assert(subs3[0].label.includes('Português'), 'Label da faixa garantida identifica claramente Português (Brasil)');

  // 4. Teste de decodificação da faixa garantida (direct-pt)
  const decodedDirect = await subtitleService.fetchAndDecodeSRT('direct-pt:Video%20Teste', 'pob');
  assert(typeof decodedDirect === 'string', 'Retorna string sem erros para faixa garantida direct-pt');
  assert(!decodedDirect.includes('Suporte a legendas em português ativo'), 'Não polui o vídeo com banners de suporte a legendas');

  // 5. Teste de decodificação de faixa adaptada (auto-translate)
  const autoUrl = `auto-translate:${subs1.find(s => s.lang === 'eng')?.url || subs1[0].url}`;
  const decodedAuto = await subtitleService.fetchAndDecodeSRT(autoUrl, 'pob');
  assert(decodedAuto.length > 0, 'Decodifica corretamente faixa com auto-translate');

  console.log(`\nResultado: ${passed}/${total} testes passaram.`);
  if (passed !== total) process.exit(1);
}

runTests();
