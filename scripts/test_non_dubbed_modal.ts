import { classifyStream, sortStreamsByPtBrPriority } from '../src/core/audio/audioDetector';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { ContentItem, ContentType } from '../types';

function checkDubbingAvailability(item: ContentItem, streams: StremioStream[]): boolean {
  if (item.audioStatus === 'pt-br-original') return true;
  if (!streams || streams.length === 0) return false;
  return streams.some(s => {
    if (s.isDubbed === true) return true;
    if (s.isPtBr === true && !s.isSubtitled) return true;
    const cls = classifyStream(s);
    return cls.isDubbed || (cls.isPtBr && !cls.isSubtitled) || cls.badge.includes('🔊');
  });
}

function shouldShowNonDubbedPrompt(
  item: ContentItem,
  streams: StremioStream[],
  isLoadingStreams: boolean,
  hasUserConfirmed: boolean
): boolean {
  const hasDub = checkDubbingAvailability(item, streams);
  return !isLoadingStreams && streams.length > 0 && !hasDub && !hasUserConfirmed;
}

async function runTests() {
  console.log('=== TESTE DE PRIORIDADE DE DUBLAGEM & MODAL DE CONFIRMAÇÃO ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${description}`);
    }
  }

  // 1. Conteúdo com stream dublado disponível
  const dubbedStream: StremioStream = {
    name: 'FenixFlix',
    title: '[DUBLADO PT-BR] Dragon Ball Super - Ep 1 - 1080p',
    url: 'https://cdn.example.com/dbs1.mp4',
    isDubbed: true,
    isPtBr: true
  };
  const subStream: StremioStream = {
    name: 'Torrent',
    title: '[LEG] Dragon Ball Super - Ep 1 - 1080p (Japanese Audio)',
    url: 'https://cdn.example.com/dbs1_sub.mp4',
    isDubbed: false,
    isPtBr: false
  };

  const animeItem: ContentItem = {
    id: 'anime-dbs',
    title: 'Dragon Ball Super',
    type: ContentType.ANIME,
    image: '',
    audioStatus: 'pt-br-dubbed'
  };

  const sortedWithDub = sortStreamsByPtBrPriority([subStream, dubbedStream]);
  assert(sortedWithDub[0].isDubbed === true, 'Stream dublado PT-BR é classificado com prioridade absoluta no índice 0');
  assert(checkDubbingAvailability(animeItem, sortedWithDub) === true, 'Detecta que existe dublagem brasileira disponível');
  assert(shouldShowNonDubbedPrompt(animeItem, sortedWithDub, false, false) === false, 'NÃO exibe modal de confirmação quando há dublagem brasileira');

  // 2. Conteúdo apenas com áudio original/legendado (Sem dublagem brasileira)
  const animeSubOnlyItem: ContentItem = {
    id: 'anime-sub-only',
    title: 'Anime Raro Não Dublado',
    type: ContentType.ANIME,
    image: '',
    audioStatus: 'subtitled'
  };
  const subOnlyStreams = [subStream];
  assert(checkDubbingAvailability(animeSubOnlyItem, subOnlyStreams) === false, 'Detecta corretamente a ausência de dublagem brasileira');
  assert(shouldShowNonDubbedPrompt(animeSubOnlyItem, subOnlyStreams, true, false) === false, 'Não exibe modal precocemente enquanto streams estão carregando (isLoadingStreams=true)');
  assert(shouldShowNonDubbedPrompt(animeSubOnlyItem, subOnlyStreams, false, false) === true, 'EXIBE modal de confirmação "Conteúdo não disponível no seu idioma" quando streams terminam de carregar');

  // 3. Usuário confirma "Sim"
  assert(shouldShowNonDubbedPrompt(animeSubOnlyItem, subOnlyStreams, false, true) === false, 'Modal é fechado após usuário clicar "Sim" (hasUserConfirmed=true)');

  // 4. Conteúdo nacional brasileiro (pt-br-original)
  const nationalMovie: ContentItem = {
    id: 'movie-auto-compadecida',
    title: 'O Auto da Compadecida',
    type: ContentType.MOVIE,
    image: '',
    audioStatus: 'pt-br-original'
  };
  assert(checkDubbingAvailability(nationalMovie, subOnlyStreams) === true, 'Conteúdo de produção nacional PT-BR é reconhecido como nativo no idioma');
  assert(shouldShowNonDubbedPrompt(nationalMovie, subOnlyStreams, false, false) === false, 'Não exibe modal para produção nacional brasileira');

  // 5. Lista de streams vazia
  assert(shouldShowNonDubbedPrompt(animeSubOnlyItem, [], false, false) === false, 'Não exibe modal quando lista de streams está vazia (vai para tela de fonte indisponível)');

  console.log(`\nResultado: ${passed}/${total} testes passaram.`);
  if (passed !== total) process.exit(1);
}

runTests();
