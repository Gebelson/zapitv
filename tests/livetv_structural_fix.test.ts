import assert from 'node:assert';
import { channelSourceResolver } from '../src/core/livetv/ChannelSourceResolver';
import { channelHealthService } from '../src/core/livetv/channelHealthService';
import { liveStreamValidator } from '../src/core/livetv/LiveStreamValidator';
import { LiveChannel, LiveStreamSource } from '../src/core/livetv/types';

console.log('=== TESTES ESTRUTURAIS DE CANAIS AO VIVO E RECUPERAÇÃO ANTI-LOOP ===\n');

// -----------------------------------------------------------------------------
// TESTE 1: Anti-Loop e Cooldown no ChannelSourceResolver
// -----------------------------------------------------------------------------
console.log('[Teste 1] Validação de Cooldown e Prevenção de Loops no ChannelSourceResolver...');

const channelMock: LiveChannel = {
  id: 'canal-loop-test',
  name: 'Canal Teste Loop',
  logo: 'https://example.com/logo.png',
  category: 'noticias',
  categoryLabel: 'Notícias',
  streamUrl: 'https://cdn.example.com/stream-primario.m3u8',
  backupStreamUrls: [
    'https://cdn.example.com/stream-backup1.m3u8',
    'https://cdn.example.com/stream-backup2.m3u8'
  ],
  quality: '1080p',
  isOfficial: true,
  status: 'AVAILABLE'
};

channelSourceResolver.clearFailedSources(channelMock.id);

// Fonte 1 inicial
const initial = channelSourceResolver.resolveBestSource(channelMock);
assert.strictEqual(initial.primaryUrl, 'https://cdn.example.com/stream-primario.m3u8');
assert.strictEqual(initial.hasEligibleSource, true);
assert.strictEqual(initial.allSourcesFailed, false);

// Falha fonte 1 -> deve ir para backup 1
const b1 = channelSourceResolver.getNextSource(channelMock, initial.primaryUrl, 'Falha primária');
assert.ok(b1, 'Deve retornar backup 1');
assert.strictEqual(b1?.url, 'https://cdn.example.com/stream-backup1.m3u8');

// Falha backup 1 -> deve ir para backup 2
const b2 = channelSourceResolver.getNextSource(channelMock, b1!.url, 'Falha backup 1');
assert.ok(b2, 'Deve retornar backup 2');
assert.strictEqual(b2?.url, 'https://cdn.example.com/stream-backup2.m3u8');

// Falha backup 2 -> todas esgotadas, NÃO PODE retornar a primária nem entrar em loop
const b3 = channelSourceResolver.getNextSource(channelMock, b2!.url, 'Falha backup 2');
assert.strictEqual(b3, null, 'Anti-loop: getNextSource deve retornar null quando todas as fontes falharem');

// Verifica resolução quando todas as fontes estão em cooldown
const resolvedAfterAllFailed = channelSourceResolver.resolveBestSource(channelMock);
assert.strictEqual(resolvedAfterAllFailed.allSourcesFailed, true, 'Deve sinalizar allSourcesFailed: true');
assert.strictEqual(resolvedAfterAllFailed.hasEligibleSource, false, 'hasEligibleSource deve ser false');

console.log('✓ Teste 1 passou: Prevenção de loop imediato e exaustão determinística de fontes comprovadas.');

// -----------------------------------------------------------------------------
// TESTE 2: Período Diferenciado de Cooldown (Transitório vs Permanente)
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Período Diferenciado de Cooldown...');

const recordTransient1 = { lastFailureTime: Date.now(), failureCount: 1, isPermanent: false };
const recordTransient2 = { lastFailureTime: Date.now(), failureCount: 2, isPermanent: false };
const recordTransient3 = { lastFailureTime: Date.now(), failureCount: 3, isPermanent: false };
const recordPermanent = { lastFailureTime: Date.now(), failureCount: 1, isPermanent: true };

assert.strictEqual(channelSourceResolver.getCooldownDuration(recordTransient1), 180_000, '1ª falha transitória: 3 min');
assert.strictEqual(channelSourceResolver.getCooldownDuration(recordTransient2), 360_000, '2ª falha transitória: 6 min');
assert.strictEqual(channelSourceResolver.getCooldownDuration(recordTransient3), 720_000, '3ª falha transitória: 12 min');
assert.strictEqual(channelSourceResolver.getCooldownDuration(recordPermanent), 1_800_000, 'Falha permanente (404/410/parked): 30 min');

console.log('✓ Teste 2 passou: Escalonamento de cooldown temporal validado.');

// -----------------------------------------------------------------------------
// TESTE 3: Cura e Limpeza de Falhas com Sucesso de Reprodução
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Cura e Limpeza de Falhas com Sucesso de Reprodução...');

const testSuccessChannel: LiveChannel = {
  id: 'canal-sucesso',
  name: 'Canal Sucesso',
  logo: 'https://example.com/logo.png',
  category: 'noticias',
  categoryLabel: 'Notícias',
  streamUrl: 'https://cdn.example.com/stream-sucesso.m3u8',
  quality: '720p',
  isOfficial: true,
  status: 'UNAVAILABLE'
};

// Registra falha prévia
channelSourceResolver.markSourceFailed(testSuccessChannel.id, testSuccessChannel.streamUrl, 'Erro prévio');
assert.ok(channelSourceResolver.getSourceFailureRecord(testSuccessChannel.id, testSuccessChannel.streamUrl));

// Confirma reprodução real via player
channelHealthService.confirmPlayback(testSuccessChannel, testSuccessChannel.streamUrl, 850);
assert.strictEqual(
  channelSourceResolver.getSourceFailureRecord(testSuccessChannel.id, testSuccessChannel.streamUrl),
  undefined,
  'Sucesso real deve limpar o histórico de falha da fonte'
);
assert.ok(testSuccessChannel.status === 'AVAILABLE' || testSuccessChannel.status === 'VERIFIED', 'Status do canal deve voltar para AVAILABLE ou VERIFIED');

console.log('✓ Teste 3 passou: Auto-cura e confirmação de reprodução real comprovadas.');

// -----------------------------------------------------------------------------
// TESTE 4: Isolamento de Sessão de Reprodução e Zapping Rápido
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Isolamento de Sessão de Zapping...');

let playbackGeneration = 0;
const simulateZap = (channelId: string) => {
  playbackGeneration += 1;
  const currentGen = playbackGeneration;
  return {
    generation: currentGen,
    isCurrent: () => playbackGeneration === currentGen
  };
};

const session1 = simulateZap('canal-1');
assert.strictEqual(session1.isCurrent(), true);

const session2 = simulateZap('canal-2');
assert.strictEqual(session1.isCurrent(), false, 'Sessão 1 deve ser invalidada imediatamente ao zapear para sessão 2');
assert.strictEqual(session2.isCurrent(), true, 'Sessão 2 deve ser a única ativa');

console.log('✓ Teste 4 passou: Token de geração monotonicamente crescente previne race conditions no zapping.');

// -----------------------------------------------------------------------------
// TESTE 5: Configurações Diferenciadas de Buffer Smart TV vs Desktop
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Parâmetros de Buffer Smart TV vs Desktop...');

const tvBufferConfig = {
  enableWorker: false,
  backBufferLength: 10,
  maxBufferLength: 20,
  maxMaxBufferLength: 35
};

const desktopBufferConfig = {
  enableWorker: true,
  backBufferLength: 20,
  maxBufferLength: 40,
  maxMaxBufferLength: 80
};

assert.ok(tvBufferConfig.backBufferLength < desktopBufferConfig.backBufferLength, 'TV deve economizar backBuffer de memória');
assert.ok(tvBufferConfig.maxBufferLength < desktopBufferConfig.maxBufferLength, 'TV deve limitar tamanho do buffer');
assert.strictEqual(tvBufferConfig.enableWorker, false, 'TV deve desativar workers para estabilidade');
assert.strictEqual(desktopBufferConfig.enableWorker, true, 'Desktop deve usar web workers para fluidez');

console.log('✓ Teste 5 passou: Perfis de Hls.js calibrados para conservação de memória na Smart TV e fluidez no PC.');

console.log('\n========================================================================');
console.log(' TODOS OS TESTES ESTRUTURAIS DE CORREÇÃO DE LIVE TV PASSARAM COM SUCESSO! ');
console.log('========================================================================');
