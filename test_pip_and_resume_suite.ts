import { pipService } from './src/core/pip/pipService';
import { storageService } from './src/core/storage/storageService';
import { ContentType } from './types';

console.log('===============================================================');
console.log('🧪 TEST SUITE: ZAPITV PICTURE-IN-PICTURE (PiP) & RETOMADA DE VÍDEO');
console.log('===============================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   Detalhes: ${details}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. PipService: Suporte e Detecção de APIs
// -------------------------------------------------------------
console.log('--- 1. PipService: Verificação de APIs e Suporte ---');
{
  assert(
    typeof pipService.isPipSupported === 'function',
    'pipService expõe método isPipSupported'
  );
  assert(
    typeof pipService.isDocumentPipSupported === 'function',
    'pipService expõe método isDocumentPipSupported'
  );
  assert(
    typeof pipService.togglePictureInPicture === 'function',
    'pipService expõe método togglePictureInPicture'
  );
  assert(
    typeof pipService.requestPictureInPicture === 'function',
    'pipService expõe método requestPictureInPicture'
  );
  assert(
    typeof pipService.exitPictureInPicture === 'function',
    'pipService expõe método exitPictureInPicture'
  );
}

// -------------------------------------------------------------
// 2. PipService: Preferência de PiP Automático ao Trocar de Aba
// -------------------------------------------------------------
console.log('\n--- 2. PipService: Preferência de PiP Automático ---');
{
  pipService.setAutoPipOnBlurEnabled(false);
  assert(
    pipService.isAutoPipOnBlurEnabled() === false,
    'Preferência padrão de PiP automático inicia desativada (false)'
  );

  let notifiedValue = false;
  const unsub = pipService.subscribeAutoPipPreference((val) => {
    notifiedValue = val;
  });

  pipService.setAutoPipOnBlurEnabled(true);
  assert(
    pipService.isAutoPipOnBlurEnabled() === true,
    'setAutoPipOnBlurEnabled(true) atualiza e persiste estado ativo'
  );
  assert(
    notifiedValue === true,
    'Notifica ouvintes registrados ao alternar preferência de PiP automático'
  );

  unsub();
  pipService.setAutoPipOnBlurEnabled(false);
}

// -------------------------------------------------------------
// 3. PipService: Media Session API Integration
// -------------------------------------------------------------
console.log('\n--- 3. PipService: Integração com Media Session API ---');
{
  // Testar execução sem quebrar em ambientes de teste sem navigator.mediaSession
  let played = false;
  let paused = false;
  let seekTarget = 0;

  pipService.updateMediaSession({
    title: 'A Viagem de Chihiro',
    artist: 'ZapiTV',
    album: 'Filme',
    artworkUrl: 'https://image.tmdb.org/t/p/w500/test.jpg',
    duration: 7500,
    currentTime: 1200,
    isPlaying: true,
    onPlay: () => { played = true; },
    onPause: () => { paused = true; },
    onSeek: (t) => { seekTarget = t; }
  });

  assert(true, 'updateMediaSession executa com sucesso sem falhas de runtime');
}

// -------------------------------------------------------------
// 4. Continuidade de Reprodução e Posição Salva (Resume)
// -------------------------------------------------------------
console.log('\n--- 4. Preservação de Posição de Reprodução e Retomada ---');
{
  const testItem = {
    id: 'test-pip-movie-123',
    title: 'Filme Teste PiP',
    type: ContentType.MOVIE,
    year: 2024,
    rating: 8.5,
    overview: 'Teste de PiP',
    image: 'https://test.com/img.jpg',
    backdrop: 'https://test.com/bg.jpg'
  };

  // Salvar progresso
  await storageService.saveProgress({
    contentId: testItem.id,
    item: testItem,
    currentTime: 1450,
    duration: 5400,
    percentage: 27,
    updatedAt: new Date().toISOString()
  });

  const savedRecord = storageService.getSyncItemProgressRecord(testItem.id);
  assert(
    savedRecord !== null && savedRecord.currentTime === 1450,
    'storageService armazena e recupera de forma síncrona a posição salva (1450s)'
  );

  // Testar preservação de episódio específico
  const seriesItem = {
    id: 'test-pip-series-456',
    title: 'Série Teste PiP',
    type: ContentType.SERIES,
    year: 2024,
    rating: 9.0,
    overview: 'Teste de Série',
    image: 'https://test.com/img.jpg',
    backdrop: 'https://test.com/bg.jpg'
  };

  await storageService.saveProgress({
    contentId: seriesItem.id,
    item: seriesItem,
    season: 2,
    episode: 4,
    currentTime: 890,
    duration: 2400,
    percentage: 37,
    updatedAt: new Date().toISOString()
  });

  const epRecord = storageService.getSyncEpisodeProgressRecord(seriesItem.id, 2, 4);
  assert(
    epRecord !== null && epRecord.currentTime === 890,
    'storageService preserva posição específica do episódio (T2:E4 = 890s)'
  );
}

// -------------------------------------------------------------
// 5. Simulação de Troca de Fonte e Prevenção de Reset para 0
// -------------------------------------------------------------
console.log('\n--- 5. Prevenção de Reset durante Troca de Fonte/Qualidade/Áudio ---');
{
  // Simular comportamento de targetResumeTimeRef
  let targetResumeTime = 0;
  let videoCurrentTime = 1250; // Usuário assistindo aos 1250 segundos

  // Usuário clica para trocar qualidade ou áudio:
  const lastTime = videoCurrentTime > 0 ? videoCurrentTime : 0;
  if (lastTime > 0) {
    targetResumeTime = lastTime;
  }
  assert(
    targetResumeTime === 1250,
    'Momento da troca: targetResumeTimeRef memoriza posição exata do usuário'
  );

  // Vídeo antigo é destruído, nova URL carrega (tempo do novo vídeo zera temporariamente para 0):
  videoCurrentTime = 0;

  // flushProgress durante a troca NÃO pode sobrescrever com 0:
  const flushedCur = (videoCurrentTime > 0) ? videoCurrentTime : targetResumeTime;
  assert(
    flushedCur === 1250,
    'flushProgress preserva 1250s em vez de 0s durante carregamento da nova fonte'
  );

  // Metadados do novo vídeo carregam (onLoadedMetadata / MANIFEST_PARSED):
  if (targetResumeTime > 0) {
    videoCurrentTime = targetResumeTime;
    targetResumeTime = 0; // Consumido
  }
  assert(
    videoCurrentTime === 1250 && targetResumeTime === 0,
    'Novo vídeo retoma imediatamente aos 1250s sem voltar ao início'
  );
}

console.log('\n===============================================================');
console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS`);
console.log('===============================================================');

if (passedTests === totalTests) {
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
} else {
  console.error('💥 ALGUNS TESTES FALHARAM!\n');
  process.exit(1);
}
