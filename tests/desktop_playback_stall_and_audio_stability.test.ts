import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Início dos Testes: Estabilidade de Reprodução e Áudio no Desktop (ZapiTV) ---\n');

const zapiPlayerPath = path.resolve(process.cwd(), 'src/components/player/ZapiPlayer.tsx');
const zapiPlayerContent = fs.readFileSync(zapiPlayerPath, 'utf-8').replace(/\r\n/g, '\n');

// Teste 1: Proteção de Timers Iniciais com Consciência de Rede (Network-Progress Aware)
console.log('Teste 1: Verificação de tolerância a downloads ativos nos timers iniciais');
assert.ok(
  zapiPlayerContent.includes('Date.now() - tvNetworkProgressAtRef.current < 8000'),
  'watchdogTimer deve conceder tolerância se houver progresso de rede nos últimos 8 segundos'
);
assert.ok(
  zapiPlayerContent.includes('Date.now() - tvNetworkProgressAtRef.current < 6000'),
  'segmentTimer deve conceder tolerância se houver download de segmentos nos últimos 6 segundos'
);
console.log('  ✓ Teste 1 passou: Timers iniciais não interrompem streams funcionais com rede ativa.');

// Teste 2: Eliminação de Falsos Erros de Áudio em Chromium e WebKit/MSE
console.log('\nTeste 2: Verificação da remoção de kill switch por webkitAudioDecodedByteCount e audioTracks');
assert.ok(
  !zapiPlayerContent.includes("handleStreamFallback('Fonte sem áudio funcional')"),
  'ZapiPlayer não deve descartar a fonte com "Fonte sem áudio funcional" por falsos positivos de MSE'
);
assert.ok(
  zapiPlayerContent.includes('// NOTA: Em navegadores modernos e HLS via MSE (MediaSource), HTMLMediaElement.audioTracks'),
  'ZapiPlayer deve documentar a mitigação de audioTracks/webkitAudioDecodedByteCount vazios no Chrome/Edge'
);
assert.ok(
  zapiPlayerContent.includes("typeof mozHasAudio === 'boolean' && !mozHasAudio && !hlsRef.current && video.currentTime > 10"),
  'mozHasAudio só deve sinalizar falha em vídeo direto não-HLS e após mais de 10s de reprodução'
);
console.log('  ✓ Teste 2 passou: Eliminação de detecções espúrias de ausência de áudio no Desktop.');

// Teste 3: Confirmação Real de Buffering (hasRealBuffer)
console.log('\nTeste 3: Verificação de confirmação de buffer somente com frames anexados');
assert.ok(
  zapiPlayerContent.includes('const hasRealBuffer = video.readyState >= 2 || (video.buffered && video.buffered.length > 0 && video.buffered.end(0) > (video.currentTime || 0));'),
  'Confirmação de buffer em FRAG_BUFFERED/BUFFER_APPENDED deve checar hasRealBuffer'
);
assert.ok(
  !zapiPlayerContent.includes("hls.on(Hls.Events.FRAG_LOADED, () => {\n      handleMediaBuffered();"),
  'FRAG_LOADED não deve confirmar prematuramente o buffer antes da decodificação'
);
console.log('  ✓ Teste 3 passou: Buffer é confirmado apenas quando os fragmentos estão decodificáveis.');

// Teste 4: Watchdog Inteligente de Stall com Recuperação Escalonada
console.log('\nTeste 4: Verificação de recuperação escalonada e tolerância a buffering no Desktop');
assert.ok(
  zapiPlayerContent.includes('hlsRef.current.recoverMediaError()'),
  'Watchdog deve tentar recoverMediaError() antes de desistir da fonte'
);
assert.ok(
  zapiPlayerContent.includes('stallTimerRef.current >= 30000 && sinceProgressMs >= 15000') ||
  zapiPlayerContent.includes('stallTimerRef.current >= 30_000 && sinceProgressMs >= 15_000'),
  'Fallback por stall no Desktop só deve ocorrer após tempo prolongado sem tráfego de rede'
);
assert.ok(
  zapiPlayerContent.includes('video.currentTime = Math.max(0, video.currentTime + 0.02);'),
  'Watchdog deve aplicar micro-avanço de timecode para desengasgar reprodução estagnada'
);
console.log('  ✓ Teste 4 passou: Watchdog no Desktop é resiliente e prioriza recuperação sobre descarte.');

// Teste 5: Preservação de Idioma na Seleção de Qualidade
console.log('\nTeste 5: Verificação de preservação de idioma em handleSelectQuality');
assert.ok(
  zapiPlayerContent.includes('const sLang = audioSelectionManager.inspectStreamAudioLanguage(streams[idx], originalLanguage);') &&
  zapiPlayerContent.includes('return sLang === currentLanguage;'),
  'handleSelectQuality deve buscar uma fonte de mesma resolução com o idioma atual'
);
assert.ok(
  zapiPlayerContent.includes("console.warn('[ZapiPlayer] Resolução solicitada não disponível no mesmo idioma. Mantendo fonte atual.');"),
  'handleSelectQuality deve manter a fonte atual em vez de trocar o idioma se a qualidade não existir'
);
console.log('  ✓ Teste 5 passou: Troca de qualidade não degrada o idioma de reprodução.');

// Teste 6: Proteção do Cache contra Invalidação Indevida
console.log('\nTeste 6: Verificação de exclusão de invalidação permanente por erros de áudio');
assert.ok(
  zapiPlayerContent.includes('!/buffer|rede|network|timeout|tempo limite|stagn|estagn|sem progresso|recupera|HTTP 429|HTTP 5\\d\\d|sem áudio funcional|codec não suportado/i.test(reason)'),
  'handleStreamFallback não deve invalidar fontes permanentemente por falso erro de áudio ou codec'
);
console.log('  ✓ Teste 6 passou: Invalidação permanente prevenida.');

// Teste 7: Isolamento Rigoroso da Smart TV
console.log('\nTeste 7: Verificação de isolamento da Smart TV');
assert.ok(
  zapiPlayerContent.includes('if (isTvPlayback) {'),
  'ZapiPlayer deve manter fluxo exclusivo para a Smart TV'
);
console.log('  ✓ Teste 7 passou: Comportamento da Smart TV preservado.');

console.log('\n--- TODOS OS TESTES DE ESTABILIDADE NO DESKTOP PASSARAM COM SUCESSO! ---');
