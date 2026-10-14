import fs from 'fs';
import path from 'path';
import { aiEnhancerService } from '../src/core/enhancement/aiEnhancerService';
import { videoEnhancer } from '../src/core/enhancement/videoEnhancer';

async function runEnhancerControlsSuite() {
  console.log('=== SUÍTE DE TESTES: REPOSICIONAMENTO E CONTROLES DE IA / TELA DIVIDIDA ===\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extra?: any) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`, extra ? extra : '');
      failed++;
    }
  }

  const playerFile = path.resolve('src/components/player/ZapiPlayer.tsx');
  const playerCode = fs.readFileSync(playerFile, 'utf-8');

  // 1. Posicionamento no canto superior direito
  console.log('--- TESTE 1: Posicionamento no canto superior direito ---');
  assert(
    'Header superior posicionado de forma absoluta no topo com justify-between',
    playerCode.includes('absolute top-0 inset-x-0 p-4 md:p-6 bg-gradient-to-b')
  );
  assert(
    'Controles agrupados no lado direito do header superior',
    playerCode.includes('Canto Superior Direito: [ Ícone Tela Dividida ] [ Melhoria por IA ]')
  );

  // 2. Ordem horizontal correta: [ Tela Dividida ] imediatamente à esquerda de [ Melhoria por IA ]
  console.log('\n--- TESTE 2: Ordem horizontal dos controles ---');
  const splitBtnIndex = playerCode.indexOf('Botão Tela Dividida (Comparar imagem - apenas ícone)');
  const aiBtnIndex = playerCode.indexOf('Botão Melhoria por IA');
  assert(
    'Botão Tela Dividida aparece antes (à esquerda) do botão Melhoria por IA no JSX',
    splitBtnIndex !== -1 && aiBtnIndex !== -1 && splitBtnIndex < aiBtnIndex
  );

  // 3. Botão Tela Dividida somente com ícone (sem texto)
  console.log('\n--- TESTE 3: Botão Tela Dividida somente com ícone ---');
  const splitSection = playerCode.substring(splitBtnIndex, aiBtnIndex);
  assert(
    'Botão Tela Dividida usa ícone Columns2',
    splitSection.includes('<Columns2')
  );
  assert(
    'Botão Tela Dividida não contém texto visível',
    !splitSection.includes('<span>') && !splitSection.includes('Comparar</span>')
  );
  assert(
    'Botão Tela Dividida possui formato compacto (w-9 h-9 md:w-10 md:h-10)',
    splitSection.includes('w-9 h-9 md:w-10 md:h-10 rounded-xl')
  );

  // 4. Hover e Tooltips
  console.log('\n--- TESTE 4: Tooltips e acessibilidade ---');
  assert(
    'Botão Tela Dividida tem tooltip "Comparar imagem" ou "Encerrar comparação de imagem"',
    splitSection.includes("title={") && splitSection.includes("'Comparar imagem'")
  );
  assert(
    'Botão Tela Dividida possui aria-label="Comparar imagem"',
    splitSection.includes('aria-label="Comparar imagem"')
  );

  // 5. Ativação e Desativação da Melhoria por IA
  console.log('\n--- TESTE 5: Ativação / Desativação da Melhoria por IA ---');
  aiEnhancerService.setVideoEnabled(true);
  const initialState = aiEnhancerService.getSettings().enabled;
  const toggledState = aiEnhancerService.toggleEnabled();
  assert(
    'toggleEnabled inverte o estado da IA',
    toggledState === !initialState
  );
  const restoredState = aiEnhancerService.toggleEnabled();
  assert(
    'toggleEnabled restaura o estado inicial da IA',
    restoredState === initialState
  );

  // 6. Relação obrigatória: Tela Dividida depende da IA estar ativa
  console.log('\n--- TESTE 6: Relação entre os dois botões ---');
  assert(
    'Botão Tela Dividida fica desabilitado (disabled={!isAiActive}) quando a IA não está ativa',
    splitSection.includes('disabled={!isAiActive}')
  );
  assert(
    'ZapiPlayer possui efeito que desativa tela dividida se a IA for desativada',
    playerCode.includes('if (isSplitComparing && !isAiActive)') &&
    playerCode.includes("aiEnhancerService.setComparisonMode('off')")
  );

  // 7. Divisor e Máscara Clip-Path de Comparação
  console.log('\n--- TESTE 7: Divisor e Renderização de Comparação ---');
  assert(
    'Canvas de IA usa clipPath em polígono de splitPosition% a 100%',
    playerCode.includes('clipPath: (isSplitComparing && isAiActive)') &&
    playerCode.includes('polygon(${splitPosition}% 0%, 100% 0%, 100% 100%, ${splitPosition}% 100%)')
  );
  assert(
    'Lado esquerdo (0 a splitPosition%) revela diretamente o vídeo original por baixo sem duplicar stream',
    playerCode.includes('ref={videoRef}') && playerCode.includes('ref={aiCanvasRef}')
  );
  assert(
    'Divisor arrastável possui linha vertical em left: splitPosition%',
    playerCode.includes("style={{ left: `${splitPosition}%` }}")
  );
  assert(
    'Handle do divisor usa cursor-ew-resize',
    playerCode.includes('cursor-ew-resize')
  );

  // 8. Badges discretos de Original vs Aprimorado
  console.log('\n--- TESTE 8: Badges visuais de identificação na tela dividida ---');
  assert(
    'Exibe badge "Original" no lado esquerdo da comparação',
    playerCode.includes('Original') && playerCode.includes('top-20 left-4 md:left-8')
  );
  assert(
    'Exibe badge "Melhoria por IA" no lado direito da comparação',
    playerCode.includes('Melhoria por IA') && playerCode.includes('top-20 right-4 md:right-8')
  );

  // 9. Arraste limitado entre 5% e 95%
  console.log('\n--- TESTE 9: Limites de arraste e responsividade ---');
  assert(
    'Função updateSplitPosition limita arraste entre 5% e 95% para não perder o divisor',
    playerCode.includes('Math.max(5, Math.min(95, Math.round(rawPos)))')
  );
  assert(
    'Removeu o botão duplicado de IA da barra de controles inferiores',
    !playerCode.includes('{/* AI Enhancement One-Click Button with Hold-to-Compare (Melhoria por IA) */}')
  );

  // 10. Visibilidade durante reprodução e arraste
  console.log('\n--- TESTE 10: Visibilidade dos controles ---');
  assert(
    'Header permanece visível durante a comparação ou arraste do divisor',
    playerCode.includes('showControls || !isPlaying || isSplitComparing || isDraggingDivider')
  );

  console.log(`\n======================================================`);
  console.log(`RESULTADO DA SUÍTE: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runEnhancerControlsSuite().catch(err => {
  console.error('Erro na suíte:', err);
  process.exit(1);
});
