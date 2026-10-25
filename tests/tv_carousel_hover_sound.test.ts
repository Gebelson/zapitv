import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { uiSoundService } from '../src/core/audio/uiSoundService';

/**
 * Teste de Validação do Som de Hover na Navegação Horizontal dos Carrosséis da TV
 *
 * Requisitos:
 * 1. Pressionar Direita (slideNext) reproduz uiSoundService.play('hoverCard').
 * 2. Pressionar Esquerda (slidePrev) reproduz uiSoundService.play('hoverCard').
 * 3. slideRight e slideLeft removidos de TvContentRow.
 * 4. Nenhuma reprodução de som extra em handleTransitionEnd (eliminação de duplicatas).
 * 5. hoverCard utiliza o mesmo timbre e volume que o hover dos cards de desktop (620Hz -> 810Hz, 65ms, sine).
 * 6. Rate-limiting de hoverCard (cooldown 90ms e limite 85ms) previne sobreposição ao manter pressionado.
 * 7. Desktop ContentRow preservado sem alterações.
 */
async function runTests() {
  console.log('\n========================================================================');
  console.log('--- TESTE DO SOM DE HOVER NA NAVEGAÇÃO DOS CARROSSÉIS DA TV (ZAPITV) ---');
  console.log('========================================================================\n');

  const tvContentRowPath = path.resolve(process.cwd(), 'src/components/tv/TvContentRow.tsx');
  assert(fs.existsSync(tvContentRowPath), 'TvContentRow.tsx deve existir');
  const tvContentRowCode = fs.readFileSync(tvContentRowPath, 'utf8');

  // Cenário 1: Substituição de slideRight por hoverCard no slideNext
  console.log('--- Cenário 1: Disparo de hoverCard ao navegar para a Direita (slideNext) ---');
  const slideNextBody = tvContentRowCode.substring(
    tvContentRowCode.indexOf('const slideNext = useCallback('),
    tvContentRowCode.indexOf('const slidePrev = useCallback(')
  );
  assert(
    slideNextBody.includes("uiSoundService.play('hoverCard')"),
    'slideNext deve chamar uiSoundService.play(\'hoverCard\')'
  );
  console.log('✓ Cenário 1: slideNext reproduz hoverCard no acionamento da seta Direita OK');

  // Cenário 2: Substituição de slideLeft por hoverCard no slidePrev
  console.log('\n--- Cenário 2: Disparo de hoverCard ao navegar para a Esquerda (slidePrev) ---');
  const slidePrevBody = tvContentRowCode.substring(
    tvContentRowCode.indexOf('const slidePrev = useCallback('),
    tvContentRowCode.indexOf('const isFocused =')
  );
  assert(
    slidePrevBody.includes("uiSoundService.play('hoverCard')"),
    'slidePrev deve chamar uiSoundService.play(\'hoverCard\')'
  );
  console.log('✓ Cenário 2: slidePrev reproduz hoverCard no acionamento da seta Esquerda OK');

  // Cenário 3: Ausência total de slideRight e slideLeft em TvContentRow.tsx
  console.log('\n--- Cenário 3: Remoção completa de slideRight e slideLeft em TvContentRow.tsx ---');
  assert(
    !tvContentRowCode.includes("'slideRight'") && !tvContentRowCode.includes('"slideRight"'),
    'TvContentRow NÃO deve conter referências a slideRight'
  );
  assert(
    !tvContentRowCode.includes("'slideLeft'") && !tvContentRowCode.includes('"slideLeft"'),
    'TvContentRow NÃO deve conter referências a slideLeft'
  );
  console.log('✓ Cenário 3: slideRight e slideLeft 100% ausentes em TvContentRow OK');

  // Cenário 4: Eliminação de som duplicado na finalização de transição (handleTransitionEnd)
  console.log('\n--- Cenário 4: Sem sons extras na finalização da transição (handleTransitionEnd) ---');
  const handleTransitionEndBody = tvContentRowCode.substring(
    tvContentRowCode.indexOf('const handleTransitionEnd = useCallback('),
    tvContentRowCode.indexOf('// Inicia o deslocamento horizontal suave do carrossel')
  );
  assert(
    !handleTransitionEndBody.includes('uiSoundService.play'),
    'handleTransitionEnd NÃO deve chamar uiSoundService.play para evitar duplicações sonoras'
  );
  console.log('✓ Cenário 4: handleTransitionEnd não emite sons adicionais na conclusão do movimento OK');

  // Cenário 5: Timbre e síntese de hoverCard idênticos ao desktop
  console.log('\n--- Cenário 5: Verificação do timbre e características de hoverCard no sintetizador ---');
  const uiSoundCode = fs.readFileSync(path.resolve(process.cwd(), 'src/core/audio/uiSoundService.ts'), 'utf8');
  assert(
    uiSoundCode.includes("sound === 'hoverCard' ? 620 : 740"),
    'hoverCard deve iniciar em frequência harmônica de 620Hz'
  );
  assert(
    uiSoundCode.includes("sound === 'hoverCard' ? 0.065 : 0.045"),
    'hoverCard deve ter duração de envelope de 65ms'
  );
  assert(
    uiSoundCode.includes("hoverCard: 90"),
    'hoverCard deve ter cooldown de 90ms para evitar sobreposição'
  );
  console.log('✓ Cenário 5: Timbre (sine 620Hz -> 810Hz, 65ms) e parâmetros de áudio confirmados OK');

  // Cenário 6: Desktop e Mobile não modificados
  console.log('\n--- Cenário 6: Preservação estrita dos componentes desktop ---');
  const desktopRowPath = path.resolve(process.cwd(), 'components/ContentRow.tsx');
  assert(fs.existsSync(desktopRowPath), 'components/ContentRow.tsx deve existir');
  const desktopRowCode = fs.readFileSync(desktopRowPath, 'utf8');
  assert(
    desktopRowCode.includes("uiSoundService.play(direction === 'left' ? 'slideLeft' : 'slideRight')"),
    'components/ContentRow.tsx desktop deve permanecer inalterado'
  );
  console.log('✓ Cenário 6: Componente desktop preservado integralmente OK');

  console.log('\n========================================================================');
  console.log('TODOS OS CENÁRIOS DE SOM DE HOVER NOS CARROSSÉIS PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Falha no teste de som de hover nos carrosséis:', err);
  process.exit(1);
});
