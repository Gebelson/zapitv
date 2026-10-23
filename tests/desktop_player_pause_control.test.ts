import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Início dos Testes: Controle de Play/Pause no Desktop (ZapiTV) ---\n');

const zapiPlayerPath = path.resolve(process.cwd(), 'src/components/player/ZapiPlayer.tsx');
const tvControlsPath = path.resolve(process.cwd(), 'src/components/player/TvPlayerControls.tsx');

// Normalize line breaks to \n for robust string inspection
const zapiPlayerContent = fs.readFileSync(zapiPlayerPath, 'utf-8').replace(/\r\n/g, '\n');
const tvControlsContent = fs.readFileSync(tvControlsPath, 'utf-8').replace(/\r\n/g, '\n');

// Teste 1: Presença do rastreamento de intenção do usuário (isUserPausedRef)
console.log('Teste 1: Verificação do rastreamento de intenção do usuário (isUserPausedRef)');
assert.ok(
  zapiPlayerContent.includes('const isUserPausedRef = useRef<boolean>(false);'),
  'ZapiPlayer deve declarar const isUserPausedRef = useRef<boolean>(false);'
);
console.log('  ✓ Teste 1 passou: isUserPausedRef declarado.');

// Teste 2: togglePlay define isUserPausedRef explicitamente
console.log('\nTeste 2: Verificação de togglePlay atualizando isUserPausedRef');
assert.ok(
  zapiPlayerContent.includes('isUserPausedRef.current = true;\n      video.pause();\n      setIsPlaying(false);'),
  'togglePlay deve setar isUserPausedRef.current = true ao pausar o vídeo principal'
);
assert.ok(
  zapiPlayerContent.includes('isUserPausedRef.current = false;\n      video.play().then('),
  'togglePlay deve setar isUserPausedRef.current = false ao retomar o vídeo principal'
);
console.log('  ✓ Teste 2 passou: togglePlay sincroniza isUserPausedRef em pausas e reproduções.');

// Teste 3: Proteção contra autoplay espúrio em startIntroIfReady
console.log('\nTeste 3: Verificação de proteção em startIntroIfReady');
const startIntroIndex = zapiPlayerContent.indexOf('const startIntroIfReady = useCallback(() => {');
assert.ok(startIntroIndex !== -1, 'startIntroIfReady deve existir');
const startIntroBlock = zapiPlayerContent.slice(startIntroIndex, startIntroIndex + 3000);

assert.ok(
  startIntroBlock.includes('if (isUserPausedRef.current) return;'),
  'startIntroIfReady deve abortar se o usuário estiver pausado propositalmente'
);
console.log('  ✓ Teste 3 passou: startIntroIfReady não despausa o vídeo se isUserPausedRef for true.');

// Teste 4: Proteção em markMediaAsReady contra chamadas repetidas de chunks HLS
console.log('\nTeste 4: Verificação de idempotência e proteção em markMediaAsReady');
const markMediaIndex = zapiPlayerContent.indexOf('const markMediaAsReady = useCallback(() => {');
assert.ok(markMediaIndex !== -1, 'markMediaAsReady deve existir');
const markMediaBlock = zapiPlayerContent.slice(markMediaIndex, markMediaIndex + 1500);

assert.ok(
  markMediaBlock.includes('const wasAlreadyReady = isMediaReadyRef.current;'),
  'markMediaAsReady deve checar se a mídia já estava marcada como pronta'
);
assert.ok(
  markMediaBlock.includes('if (!wasAlreadyReady && !isUserPausedRef.current) {'),
  'markMediaAsReady só deve chamar startIntroIfReady na primeira vez e se não pausado'
);
console.log('  ✓ Teste 4 passou: Novos fragmentos e buffers HLS não redisparam startIntroIfReady se pausado.');

// Teste 5: Proteção no effect de inicialização direta pós-intro
console.log('\nTeste 5: Verificação de proteção no effect de inicialização pós-intro');
const directEffectMatch = zapiPlayerContent.includes(
  'useEffect(() => {\n    if (isMediaReady && (isIntroEnded || userSkippedIntro) && !isPlayingIntro && !showNonDubbedPrompt) {\n      if (isUserPausedRef.current) {\n        return;\n      }'
);
assert.ok(
  directEffectMatch,
  'O effect de reprodução direta deve checar if (isUserPausedRef.current) return;'
);
console.log('  ✓ Teste 5 passou: Reavaliação de props e volume não despausam o vídeo.');

// Teste 6: Reset de isUserPausedRef na troca de episódio
console.log('\nTeste 6: Verificação de reset de estado ao trocar de episódio');
assert.ok(
  zapiPlayerContent.includes('isUserPausedRef.current = false;\n    setIsAutoPlayCancelled(false);'),
  'Troca de episódio deve resetar isUserPausedRef para permitir início do novo episódio'
);
console.log('  ✓ Teste 6 passou: Novo episódio inicia sem herdar pausa do anterior.');

// Teste 7: Sincronização visual com isEffectivePlaying no Desktop
console.log('\nTeste 7: Verificação de isEffectivePlaying no Desktop');
assert.ok(
  zapiPlayerContent.includes('const isEffectivePlaying = isPlaying && !isUserPausedRef.current;'),
  'ZapiPlayer deve computar isEffectivePlaying considerando isUserPausedRef'
);
assert.ok(
  zapiPlayerContent.includes('aria-label={isEffectivePlaying ? \'Pausar\' : \'Reproduzir\'}'),
  'Botão de play/pause no Desktop deve exibir o estado real de isEffectivePlaying'
);
assert.ok(
  zapiPlayerContent.includes('(showControls || !isEffectivePlaying || hasOpenMenu)'),
  'Barra de controles no Desktop deve permanecer visível quando pausado'
);
console.log('  ✓ Teste 7 passou: Botão e barra de controles Desktop sincronizados com o estado real.');

// Teste 8: Isolamento do player Smart TV
console.log('\nTeste 8: Verificação de isolamento do Player da Smart TV');
assert.ok(
  zapiPlayerContent.includes('if (isTvPlayback) {\n            handleUserActivity();\n            return;\n          }'),
  'Clique no vídeo na Smart TV não deve disparar togglePlay desktop'
);
assert.ok(
  !tvControlsContent.includes('isEffectivePlaying'),
  'TvPlayerControls não deve sofrer alterações indevidas de escopo Desktop'
);
console.log('  ✓ Teste 8 passou: Smart TV devidamente isolada e preservada.');

console.log('\n======================================================');
console.log('TODOS OS 8 TESTES DE CONTROLE DE PAUSE NO DESKTOP PASSARAM COM SUCESSO!');
console.log('======================================================\n');
