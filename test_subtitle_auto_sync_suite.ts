import { subtitleAutoSyncService } from './src/core/subtitles/subtitleAutoSyncService';
import { calculateSubtitleQualityScore, SubtitleTrack } from './src/core/subtitles/subtitleService';
import { StremioStream } from './src/core/stremio/stremioTypes';
import { SkipInterval } from './src/core/skip/skipService';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// Mock localStorage para testes Node.js
const mockStorage = new Map<string, string>();
(global as any).localStorage = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

console.log('===============================================================');
console.log('🧪 TEST SUITE: ZAPITV SINCRONIZAÇÃO AUTOMÁTICA DE LEGENDAS');
console.log('===============================================================\n');

// --- 1. SubtitleAutoSyncService: Persistência e Chaves de Cache ---
console.log('--- 1. SubtitleAutoSyncService: Persistência de Sincronia ---');

const testStream: StremioStream = {
  title: 'Movie.2024.1080p.AMZN.WEB-DL.DDP5.1.Atmos.H.264-FLUX',
  name: 'Torrentio'
};

const syncKey = subtitleAutoSyncService.getSyncKey('item-123', testStream, 'sub-ptbr-1');
assert(syncKey.includes('item-123') && syncKey.includes('FLUX'), 'Gera chave única incluindo ID do item e release do stream');

subtitleAutoSyncService.saveOffset('item-123', 2.5, testStream, 'sub-ptbr-1');
const savedOffset = subtitleAutoSyncService.getSavedOffset('item-123', testStream, 'sub-ptbr-1');
assert(savedOffset === 2.5, 'Salva e recupera com precisão o offset memorizado de +2.5s');

subtitleAutoSyncService.clearSavedOffset('item-123', testStream, 'sub-ptbr-1');
assert(subtitleAutoSyncService.getSavedOffset('item-123', testStream, 'sub-ptbr-1') === null, 'Limpa offset salvo corretamente');

// --- 2. Correspondência Inteligente de Release no SubtitleService ---
console.log('\n--- 2. SubtitleService: Seleção de Legenda Compatível com o Release do Vídeo ---');

const webDlStream: StremioStream = {
  title: 'Cyberpunk.Edgerunners.S01E01.1080p.NF.WEB-DL.DDP5.1.x264',
  name: 'Cyberpunk Stream'
};

const subWebDl = {
  movieReleaseName: 'Cyberpunk.Edgerunners.S01E01.1080p.NF.WEB-DL.x264',
  subtitleFileName: 'Cyberpunk.S01E01.pob.srt',
  url: 'https://subtitles.com/cyberpunk-webdl.srt',
  lang: 'pob',
  downloads: 150
};

const subBluRay = {
  movieReleaseName: 'Cyberpunk.Edgerunners.S01E01.1080p.BluRay.x264-SPARKS',
  subtitleFileName: 'Cyberpunk.S01E01.bluray.srt',
  url: 'https://subtitles.com/cyberpunk-bluray.srt',
  lang: 'pob',
  downloads: 300 // Mais downloads brutos, mas para release diferente!
};

const scoreWebDl = calculateSubtitleQualityScore(subWebDl, 0, webDlStream);
const scoreBluRay = calculateSubtitleQualityScore(subBluRay, 0, webDlStream);

assert(scoreWebDl > scoreBluRay, 'Legenda com release compatível (WEB-DL) supera legenda de Blu-Ray mesmo com menos downloads');
assert(scoreWebDl >= 250, 'Legenda WEB-DL recebe bônus de compatibilidade direta com o stream (+220 pts)');

// --- 3. Detecção Automática de Atraso por Vinheta (WEB-DL vs BluRay) ---
console.log('\n--- 3. SubtitleAutoSyncService: Detecção de Atraso de Vinheta de Estúdio ---');

const dummyCues = [
  { start: 14.5, end: 17.0, text: 'Primeira fala que só começa depois da vinheta de cinema' },
  { start: 20.0, end: 23.5, text: 'Segunda fala' }
];

const subTrackBluRay: SubtitleTrack = {
  id: 'sub-bluray',
  lang: 'pob',
  languageName: 'Português (Brasil)',
  label: '🇧🇷 Português',
  flag: '🇧🇷',
  url: 'https://sub.srt',
  order: 1,
  release: 'BLURAY',
  isPtBr: true
};

const bumperResult = subtitleAutoSyncService.alignWithReleaseBumper(webDlStream, subTrackBluRay, dummyCues);
assert(bumperResult !== null, 'Detecta discrepância de vinheta entre vídeo WEB-DL e legenda BluRay');
assert(bumperResult !== null && bumperResult.delta >= 8 && bumperResult.delta <= 14, `Calcula delta de vinheta automático de forma plausível (${bumperResult?.delta}s)`);

// --- 4. Calibração Integrada Automática (calculateAutoOffset) ---
console.log('\n--- 4. SubtitleAutoSyncService: Calibração Integrada sem Ação do Usuário ---');

const autoOffsetResult = subtitleAutoSyncService.calculateAutoOffset({
  contentId: 'movie-456',
  video: null,
  cues: dummyCues,
  stream: webDlStream,
  track: subTrackBluRay
});

assert(autoOffsetResult.offset > 0, `Offset calibrado automaticamente com sucesso (${autoOffsetResult.offset}s) para adiantar legenda atrasada`);
assert(autoOffsetResult.method === 'release_bumper_calibration', 'Método identificado corretamente como release_bumper_calibration');

// --- 5. Alinhamento com Abertura / SkipInterval ---
console.log('\n--- 5. SubtitleAutoSyncService: Alinhamento com SkipInterval (Abertura) ---');

const skipOp: SkipInterval = {
  startTime: 90,
  endTime: 180,
  rawStartTime: 90,
  rawEndTime: 180,
  type: 'op',
  label: 'Pular Abertura',
  source: 'aniskip'
};

const delayedAnimeCues = [
  { start: 192.5, end: 196.0, text: 'Fala pós-abertura com 12.0s de atraso acumulado' }
];

const skipMatch = subtitleAutoSyncService.alignWithSkipInterval(skipOp, delayedAnimeCues);
assert(skipMatch !== null && skipMatch.delta === 12.0, `Detecta delta de atraso pós-abertura (${skipMatch?.delta}s)`);

console.log('\n===============================================================');
console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS`);
console.log('===============================================================');

if (passedTests === totalTests) {
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  process.exit(0);
} else {
  console.error('⚠️ ALGUNS TESTES FALHARAM!');
  process.exit(1);
}
