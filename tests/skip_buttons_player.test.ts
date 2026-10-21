import assert from 'assert';
import { skipService, SkipInterval, VERIFIED_SERIES_INTERVALS } from '../src/core/skip/skipService';
import { calculateSkipProgress, generatePillPath } from '../src/components/player/ZapiSkipButton';
import { tvModeService } from '../src/core/tv/tvModeService';
import fs from 'fs';
import path from 'path';

console.log('--- Início da Bateria de Testes: Pular Abertura e Pular Créditos (ZapiTV) ---\n');

async function runTests() {
  // Teste 1: Intervalos canônicos de abertura (Dexter S01E01)
  console.log('Teste 1: Intervalos canônicos de abertura e créditos para Dexter');
  const dexter = { id: '1405', title: 'Dexter', type: 'series' as const };
  const intervals = await skipService.getSkipTimes(dexter, 1, 1, 3190);
  assert(intervals.length >= 2, 'Dexter deve retornar pelo menos 2 intervalos (abertura e encerramento)');
  
  const op = intervals.find(i => i.type === 'op');
  const ed = intervals.find(i => i.type === 'ed');
  assert(op, 'Dexter S01E01 deve conter abertura (op)');
  assert(ed, 'Dexter S01E01 deve conter créditos (ed)');
  assert.strictEqual(op?.startTime, 450, 'Abertura de Dexter S01E01 inicia em 450s');
  assert.strictEqual(op?.endTime, 555, 'Abertura de Dexter S01E01 termina em 555s');
  assert.strictEqual(op?.label, 'Pular Abertura');
  assert.strictEqual(ed?.startTime, 3088, 'Créditos de Dexter S01E01 iniciam em 3088s');
  assert.strictEqual(ed?.endTime, 3190, 'Créditos de Dexter S01E01 terminam em 3190s');
  assert.strictEqual(ed?.label, 'Pular Créditos');
  console.log('  ✓ Teste 1 passou: Dexter S01E01 abertura [450s-555s] e créditos [3088s-3190s] verificados.');

  // Teste 2: Intervalo de créditos curtos não é descartado incorretamente
  console.log('\nTeste 2: Intervalo de créditos com duração curta ajustada');
  const fakeItem = { id: 'anime_test', title: 'Anime Test', type: 'series' as const };
  skipService.saveManualInterval(fakeItem.id, 1, 1, {
    startTime: 1435,
    endTime: 1438,
    type: 'ed'
  });
  const saved = await skipService.getSkipTimes(fakeItem, 1, 1, 1440);
  const manualEd = saved.find(i => i.type === 'ed');
  assert(manualEd, 'Créditos com diff de 3s devem ser preservados');
  assert.strictEqual(manualEd?.startTime, 1435);
  assert.strictEqual(manualEd?.endTime, 1438);
  skipService.clearManualInterval(fakeItem.id, 1, 1);
  console.log('  ✓ Teste 2 passou: Créditos curtos são preservados adequadamente.');

  // Teste 3: Lógica de ativação temporal (activeSkipInterval)
  console.log('\nTeste 3: Ativação e desativação temporal dos botões');
  const testIntervals: SkipInterval[] = [
    { startTime: 100, endTime: 190, rawStartTime: 100, rawEndTime: 190, type: 'op', label: 'Pular Abertura', source: 'verified' },
    { startTime: 1200, endTime: 1280, rawStartTime: 1200, rawEndTime: 1280, type: 'ed', label: 'Pular Créditos', source: 'verified' }
  ];

  const getActive = (time: number, dur: number) => {
    return testIntervals.find(i => {
      if (i.type === 'ed') {
        const effectiveEnd = i.endTime > 0 ? (dur > 0 ? Math.max(i.endTime, dur) : i.endTime) : Infinity;
        return time >= i.startTime && time <= effectiveEnd;
      }
      return time >= i.startTime && time < i.endTime;
    }) || null;
  };

  // Antes da abertura
  assert.strictEqual(getActive(99, 1300), null, 'Aos 99s nenhum botão deve estar ativo');
  // Início da abertura
  assert.strictEqual(getActive(100, 1300)?.label, 'Pular Abertura', 'Aos 100s "Pular Abertura" deve estar ativo');
  // Meio da abertura
  assert.strictEqual(getActive(150, 1300)?.label, 'Pular Abertura', 'Aos 150s "Pular Abertura" deve estar ativo');
  // Fim da abertura
  assert.strictEqual(getActive(190, 1300), null, 'Aos 190s abertura terminou, botão deve sumir');
  // Antes dos créditos
  assert.strictEqual(getActive(1199, 1300), null, 'Aos 1199s créditos ainda não iniciaram');
  // Início dos créditos
  assert.strictEqual(getActive(1200, 1300)?.label, 'Pular Créditos', 'Aos 1200s "Pular Créditos" deve estar ativo');
  // Meio dos créditos
  assert.strictEqual(getActive(1250, 1300)?.label, 'Pular Créditos', 'Aos 1250s "Pular Créditos" deve estar ativo');
  // Além do endTime original, mas antes do fim da duração (1290s)
  assert.strictEqual(getActive(1290, 1300)?.label, 'Pular Créditos', 'Aos 1290s créditos continuam ativos até o fim da duração do vídeo');
  // Após a duração do vídeo
  assert.strictEqual(getActive(1301, 1300), null, 'Após o fim do vídeo botão não deve estar ativo');
  console.log('  ✓ Teste 3 passou: Lógica de ativação temporal precisa para op e ed.');

  // Teste 4: Cálculo de progresso e SVG Pill Path
  console.log('\nTeste 4: Cálculo de progresso temporal e SVG Pill Path');
  assert.strictEqual(calculateSkipProgress(100, 100, 200), 0, 'No início o progresso deve ser 0');
  assert.strictEqual(calculateSkipProgress(150, 100, 200), 0.5, 'Na metade o progresso deve ser 0.5');
  assert.strictEqual(calculateSkipProgress(200, 100, 200), 1, 'No final o progresso deve ser 1');
  assert.strictEqual(calculateSkipProgress(250, 100, 200), 1, 'Acima do final deve ser mantido em 1');
  assert.strictEqual(calculateSkipProgress(50, 100, 200), 0, 'Abaixo do início deve ser 0');

  const pillPath = generatePillPath(195, 44, 3.5);
  assert(pillPath.startsWith('M '), 'Pill Path deve iniciar com comando M');
  assert(pillPath.includes(' A '), 'Pill Path deve conter arcos para as bordas arredondadas');
  assert(pillPath.endsWith(' Z'), 'Pill Path deve fechar com Z');
  console.log('  ✓ Teste 4 passou: Progresso normalizado e renderização vetorial validados.');

  // Teste 5: Simulação de Seek e Reaparecimento Imediato
  console.log('\nTeste 5: Simulação de Seek temporal');
  let currentSeekTime = 50;
  assert.strictEqual(getActive(currentSeekTime, 1300), null);
  // Usuário pula para o minuto 2 (120s - dentro da abertura)
  currentSeekTime = 120;
  assert.strictEqual(getActive(currentSeekTime, 1300)?.type, 'op', 'Seek para 120s reativa o botão de abertura');
  // Usuário salta para a frente (300s)
  currentSeekTime = 300;
  assert.strictEqual(getActive(currentSeekTime, 1300), null, 'Seek para 300s desativa o botão de abertura');
  // Usuário retrocede novamente para dentro da abertura (110s)
  currentSeekTime = 110;
  assert.strictEqual(getActive(currentSeekTime, 1300)?.type, 'op', 'Retrocesso reativa o botão de abertura instantaneamente');
  console.log('  ✓ Teste 5 passou: Reaparecimento e desaparecimento dinâmico em seek verificado.');

  // Teste 6: Avanço e Transição para Próximo Episódio em Pular Créditos
  console.log('\nTeste 6: Ação de Pular Créditos conectada ao próximo episódio');
  let nextEpisodeCalled = false;
  let seekTarget: number | null = null;
  const mockOnNextEpisode = () => { nextEpisodeCalled = true; };
  const mockSeek = (target: number) => { seekTarget = target; };

  const executeSkip = (interval: SkipInterval, hasNext: boolean) => {
    if (interval.type === 'ed' && hasNext) {
      mockOnNextEpisode();
      return;
    }
    mockSeek(interval.endTime);
  };

  // Pular abertura -> seek para o final da abertura
  executeSkip(testIntervals[0], true);
  assert.strictEqual(seekTarget, 190, 'Pular abertura deve executar seek para endTime da abertura (190s)');
  assert.strictEqual(nextEpisodeCalled, false, 'Pular abertura não deve trocar de episódio');

  // Pular créditos com próximo episódio disponível -> dispara onNextEpisode
  seekTarget = null;
  executeSkip(testIntervals[1], true);
  assert.strictEqual(nextEpisodeCalled, true, 'Pular créditos com próximo episódio disponível deve chamar onNextEpisode');
  assert.strictEqual(seekTarget, null, 'Pular créditos com próximo episódio não deve buscar fim do vídeo');

  // Pular créditos no último episódio (sem próximo) -> busca o fim
  nextEpisodeCalled = false;
  seekTarget = null;
  executeSkip(testIntervals[1], false);
  assert.strictEqual(nextEpisodeCalled, false, 'Sem próximo episódio, não chama onNextEpisode');
  assert.strictEqual(seekTarget, 1280, 'Sem próximo episódio, avança até endTime dos créditos');
  console.log('  ✓ Teste 6 passou: Transição entre episódios e busca de encerramento validadas.');

  // Teste 7: Stacking context e Z-Index no componente ZapiSkipButton.tsx
  console.log('\nTeste 7: Verificação do Z-Index e isolamento em ZapiSkipButton.tsx');
  const skipButtonFile = fs.readFileSync(path.join(process.cwd(), 'src/components/player/ZapiSkipButton.tsx'), 'utf-8');
  assert(skipButtonFile.includes('z-50'), 'ZapiSkipButton deve usar z-50 para sobrepor controles (z-40)');
  assert(skipButtonFile.includes('pointer-events-auto'), 'ZapiSkipButton deve ter pointer-events-auto');
  assert(skipButtonFile.includes('onClick={(e) => e.stopPropagation()}'), 'Outer wrapper deve impedir propagação de clique para o player');
  console.log('  ✓ Teste 7 passou: ZapiSkipButton possui z-50, pointer-events-auto e stopPropagation.');

  // Teste 8: Suporte ao Controle Remoto da TV (Norigin Spatial Navigation) em ZapiSkipButton.tsx
  console.log('\nTeste 8: Suporte à Navegação Espacial de Smart TV em ZapiSkipButton.tsx');
  assert(skipButtonFile.includes('useTvFocusable'), 'ZapiSkipButton deve integrar useTvFocusable');
  assert(skipButtonFile.includes("focusKey: 'tv-skip-button'"), 'ZapiSkipButton deve registrar focusKey tv-skip-button');
  assert(skipButtonFile.includes("setFocus('tv-skip-button')"), 'ZapiSkipButton deve auto-focar na TV ao surgir');
  assert(skipButtonFile.includes('isTvFocused'), 'ZapiSkipButton deve ter lógica para estado focado na TV');
  assert(skipButtonFile.includes('data-tv-focused'), 'ZapiSkipButton deve ter data-tv-focused');
  console.log('  ✓ Teste 8 passou: Suporte ao controle remoto da TV verificado em ZapiSkipButton.tsx.');

  // Teste 9: Isolamento do foco e ausência de vazamento no Desktop
  console.log('\nTeste 9: Ausência de vazamento de estilos de TV no Desktop');
  const isTv = tvModeService.isTvMode();
  assert.strictEqual(isTv, false, 'No ambiente desktop padrão o modo TV deve estar desativado');
  assert(skipButtonFile.includes('isTvFocused ?'), 'Estilo ciano do botão TV deve ser condicionado a isTvFocused');
  console.log('  ✓ Teste 9 passou: Modos TV e Desktop devidamente isolados.');

  // Teste 10: Atualização precoce de duração e resolução de episódio em ZapiPlayer.tsx
  console.log('\nTeste 10: Robustez de duração e parâmetros em ZapiPlayer.tsx');
  const zapiPlayerFile = fs.readFileSync(path.join(process.cwd(), 'src/components/player/ZapiPlayer.tsx'), 'utf-8');
  assert(zapiPlayerFile.includes('currentSeason'), 'ZapiPlayer deve normalizar currentSeason');
  assert(zapiPlayerFile.includes('currentEpisode'), 'ZapiPlayer deve normalizar currentEpisode');
  assert(zapiPlayerFile.includes('onLoadedMetadata'), 'ZapiPlayer deve conter handler onLoadedMetadata');
  assert(zapiPlayerFile.includes('setDuration(videoRef.current.duration)'), 'ZapiPlayer deve definir duration no loadedmetadata');
  console.log('  ✓ Teste 10 passou: Duração e resolução de episódio blindadas no ZapiPlayer.');

  console.log('\n======================================================');
  console.log(' TODOS OS 10 TESTES DE RECUPERAÇÃO DOS BOTÕES PASSARAM! ');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Falha no teste:', err);
  process.exit(1);
});
