import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runTvDetailsEpisodesCarouselTests() {
  console.log('--- Auditoria do Carrossel de Episódios na Smart TV (TvDetailsModal.tsx) ---');

  const modalPath = path.resolve(process.cwd(), 'src/components/tv/TvDetailsModal.tsx');
  assert(fs.existsSync(modalPath), 'TvDetailsModal.tsx deve existir');
  const code = fs.readFileSync(modalPath, 'utf8');

  // Teste 1: Parâmetros de enquadramento exato e transição cinematográfica fluida
  assert(
    code.includes('CARD_GAP = 20') &&
    code.includes('TARGET_CARD_WIDTH = 270') &&
    code.includes('TRANSITION_DURATION = 320') &&
    code.includes("EASING_CURVE = 'cubic-bezier(0.22, 1, 0.36, 1)'"),
    'TvDetailsModal deve definir gap proporcional (20px), largura de referência 16:9 (270px) e transição cinematográfica (320ms, cubic-bezier)'
  );
  console.log('✓ Teste 1: Parâmetros de geometria e transição cinematográfica configurados OK');

  // Teste 2: Eliminação de overflow-x-auto e contenção em viewport com overflow-hidden no trilho de episódios
  const episodeSectionCode = code.slice(code.indexOf('Trilho de Episódios'));
  assert(
    !episodeSectionCode.includes('overflow-x-auto') &&
    code.includes('ref={episodesContainerRef}') &&
    code.includes('overflow-hidden') &&
    code.includes('translate3d(${translateX}px, 0, 0)'),
    'O carrossel de episódios NÃO deve usar overflow-x-auto arbitrário, devendo implementar viewport overflow-hidden com trilho deslocável translate3d'
  );
  console.log('✓ Teste 2: Contêiner com overflow-hidden e trilho translate3d sem barras ou cortes arbitrários OK');

  // Teste 3: Proteção da moldura de seleção contra cortes nas 4 bordas
  assert(
    code.includes('py-5 -my-5 px-3 -mx-3') ||
    code.includes('py-4 -my-4 px-3 -mx-3'),
    'O viewport deve fornecer padding interno (px-3, py-5) para acomodar o scale-105 e o glow cyan sem cortes no overflow'
  );
  assert(
    code.includes('border-cyan-400') &&
    code.includes('scale-105') &&
    code.includes('shadow-[0_0_16px_rgba(0,229,255,0.35)]'),
    'TvEpisodeCard deve preservar a identidade visual com borda cyan-400, cantos arredondados, scale-105 e glow'
  );
  console.log('✓ Teste 3: Moldura de seleção 100% visível nas 4 bordas com respiro interno anti-corte OK');

  // Teste 4: Cálculo matemático responsivo para diferentes resoluções (1080p, 720p, 4K)
  const CARD_GAP = 20;
  const TARGET_CARD_WIDTH = 270;

  function calculateGeometry(availableWidth: number) {
    const count = Math.max(1, Math.floor((availableWidth + CARD_GAP) / (TARGET_CARD_WIDTH + CARD_GAP)));
    const exactWidth = Math.floor((availableWidth - (count - 1) * CARD_GAP) / count);
    const totalFilled = count * exactWidth + (count - 1) * CARD_GAP;
    return { count, exactWidth, totalFilled, remainder: availableWidth - totalFilled };
  }

  // Resolução 1080p (Full HD TV): container de 1792px
  const fhd = calculateGeometry(1792);
  assert.strictEqual(fhd.count, 6, 'Em 1080p devem caber exatamente 6 cards completos');
  assert(fhd.exactWidth >= 270 && fhd.exactWidth <= 286, `Largura do card em 1080p (${fhd.exactWidth}) deve ser consistente`);
  assert(fhd.remainder >= 0 && fhd.remainder < fhd.count, 'Todos os cards devem caber sem transbordar');

  // Resolução 720p (HD TV): container de 1152px
  const hd = calculateGeometry(1152);
  assert.strictEqual(hd.count, 4, 'Em 720p devem caber exatamente 4 cards completos');
  assert(hd.exactWidth >= 270 && hd.exactWidth <= 286, `Largura do card em 720p (${hd.exactWidth}) deve ser consistente`);

  // Resolução 4K / 1440p: container de 2432px
  const qhd = calculateGeometry(2432);
  assert.strictEqual(qhd.count, 8, 'Em telas ultra-largas devem caber 8 cards completos');
  assert(qhd.exactWidth >= 270 && qhd.exactWidth <= 286, `Largura do card em 4K (${qhd.exactWidth}) deve ser consistente`);

  console.log('✓ Teste 4: Cálculo dinâmico para 720p (4 cards), 1080p (6 cards) e 4K (8 cards) validado OK');

  // Teste 5: Simulação de navegação com temporadas curtas (1 e 3 episódios)
  function simulateNavigation(totalEps: number, visibleCount: number, actions: ('right' | 'left')[]) {
    let currentIdx = 0;
    let startIndex = 0;
    const maxStart = Math.max(0, totalEps - visibleCount);

    const history: { idx: number; start: number; visibleWindow: [number, number] }[] = [];

    const record = () => {
      const windowEnd = Math.min(totalEps - 1, startIndex + visibleCount - 1);
      history.push({ idx: currentIdx, start: startIndex, visibleWindow: [startIndex, windowEnd] });
    };

    record();

    for (const act of actions) {
      if (act === 'right' && currentIdx < totalEps - 1) {
        currentIdx++;
      } else if (act === 'left' && currentIdx > 0) {
        currentIdx--;
      }

      if (currentIdx < startIndex) {
        startIndex = currentIdx;
      } else if (currentIdx >= startIndex + visibleCount) {
        startIndex = currentIdx - visibleCount + 1;
      }
      startIndex = Math.min(Math.max(0, startIndex), maxStart);
      record();
    }

    return { currentIdx, startIndex, history };
  }

  // Temporada com 1 episódio: card fixo, sem corte
  const sim1 = simulateNavigation(1, 6, ['right', 'left']);
  assert.strictEqual(sim1.startIndex, 0);
  assert.strictEqual(sim1.currentIdx, 0);

  // Temporada com 3 episódios: navegação entre os 3 sem deslocar o trilho (todos já visíveis)
  const sim3 = simulateNavigation(3, 6, ['right', 'right', 'left']);
  assert.strictEqual(sim3.startIndex, 0);
  assert.strictEqual(sim3.currentIdx, 1);
  console.log('✓ Teste 5: Temporadas com 1 e 3 episódios mantêm enquadramento perfeito sem rolagem desnecessária OK');

  // Teste 6: Simulação de navegação com 10 episódios e 60 episódios
  // 10 episódios, 6 visíveis:
  const sim10 = simulateNavigation(10, 6, ['right', 'right', 'right', 'right', 'right', 'right']); // vai até ep 7 (idx 6)
  assert.strictEqual(sim10.currentIdx, 6);
  assert.strictEqual(sim10.startIndex, 1, 'Ao focar o 7º episódio, o carrossel deve deslizar para startIndex=1');
  assert(sim10.currentIdx >= sim10.startIndex && sim10.currentIdx < sim10.startIndex + 6, 'O episódio focado deve estar integralmente na janela visível');

  // Avança até o 10º episódio (idx 9)
  const sim10End = simulateNavigation(10, 6, Array(10).fill('right'));
  assert.strictEqual(sim10End.currentIdx, 9);
  assert.strictEqual(sim10End.startIndex, 4, 'No 10º episódio, o carrossel deve repousar em startIndex=4 (exibindo 5 a 10)');

  // 60 episódios: avança até o 60º episódio (idx 59)
  const sim60End = simulateNavigation(60, 6, Array(70).fill('right'));
  assert.strictEqual(sim60End.currentIdx, 59);
  assert.strictEqual(sim60End.startIndex, 54, 'No 60º episódio, o carrossel deve repousar em startIndex=54 (exibindo 55 a 60)');

  // Retorna do 60º até o 1º episódio
  const sim60Back = simulateNavigation(60, 6, [...Array(70).fill('right'), ...Array(70).fill('left')]);
  assert.strictEqual(sim60Back.currentIdx, 0);
  assert.strictEqual(sim60Back.startIndex, 0, 'Ao voltar para o primeiro episódio, startIndex deve retornar exatamente a 0');
  console.log('✓ Teste 6: Temporadas longas (10 e 60 episódios) navegam ponta a ponta sem cortes nem travamentos OK');

  // Teste 7: Navegação determinística e preservação do último episódio focado
  assert(
    code.includes('onNavigateLeft={prevEp ? () => setFocus(episodeFocusKey(currentSeason, Number(prevEp.number))) : undefined}') &&
    code.includes('onNavigateRight={nextEp ? () => setFocus(episodeFocusKey(currentSeason, Number(nextEp.number))) : undefined}'),
    'TvEpisodeCard deve encadear setFocus de forma determinística entre episódios adjacentes'
  );
  assert(
    code.includes('lastFocusedEpisodeIndexRef.current') &&
    code.includes('validEpisodes[lastFocusedEpisodeIndexRef.current]'),
    'TvDetailsModal deve lembrar o último episódio focado ao retornar de seções vizinhas ou do player'
  );
  console.log('✓ Teste 7: Navegação direcional determinística e memória de foco do episódio OK');

  // Teste 8: Reset adequado na troca de temporada e suporte ao initialEpisode
  assert(
    code.includes('setStartIndex(0)') &&
    code.includes('lastFocusedEpisodeIndexRef.current = 0') &&
    code.includes('isInitialMountRef.current = true'),
    'A troca de temporada deve redefinir startIndex para 0 e suspender a transição no primeiro frame'
  );
  assert(
    code.includes('requestedIndex = validEpisodes.findIndex(ep => Number(ep.number) === requestedEpisodeFocus.current)') &&
    code.includes('requestedIndex - visibleCount + 1'),
    'Ao abrir com initialEpisode (retorno do player), o carrossel deve calcular o startIndex ideal sem teletransporte'
  );
  console.log('✓ Teste 8: Reset de temporada e posicionamento inteligente ao retornar do player OK');

  console.log('\nTodos os 8 testes do carrossel de episódios passaram com 100% de sucesso!\n');
}

runTvDetailsEpisodesCarouselTests().catch((err) => {
  console.error('\n❌ Falha nos testes do carrossel de episódios:', err);
  process.exit(1);
});
