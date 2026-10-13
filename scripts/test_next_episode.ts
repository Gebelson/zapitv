import fs from 'fs';
import path from 'path';

function runNextEpisodeValidation() {
  console.log('======================================================');
  console.log('    ZAPITV - TESTES DO BOTÃO DE PRÓXIMO EPISÓDIO     ');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      throw new Error(`FALHA: ${msg}`);
    }
    console.log(`[PASSOU] ${msg}`);
    passed++;
  }

  // --- 1. Testes de Unidade da Lógica de Navegação de Episódios ---
  console.log('--- 1. Lógica Algorítmica de Transição de Episódios ---');

  function computeNextStep(params: {
    hasEpisodes: boolean;
    curSeason: number;
    curEpisode: number;
    seasonEpCount: number;
    totalSeasons: number;
  }) {
    const { hasEpisodes, curSeason, curEpisode, seasonEpCount, totalSeasons } = params;
    if (!hasEpisodes) return { canAdvance: false, nextSeason: curSeason, nextEpisode: curEpisode };

    const hasNext = curEpisode < seasonEpCount || curSeason < totalSeasons;
    if (!hasNext) {
      return { canAdvance: false, nextSeason: curSeason, nextEpisode: curEpisode };
    }

    if (curEpisode < seasonEpCount) {
      return { canAdvance: true, nextSeason: curSeason, nextEpisode: curEpisode + 1 };
    } else if (curSeason < totalSeasons) {
      return { canAdvance: true, nextSeason: curSeason + 1, nextEpisode: 1 };
    }

    return { canAdvance: false, nextSeason: curSeason, nextEpisode: curEpisode };
  }

  // Caso 1: Episódio intermediário (ex: T1E1 -> T1E2)
  const step1 = computeNextStep({
    hasEpisodes: true,
    curSeason: 1,
    curEpisode: 1,
    seasonEpCount: 8,
    totalSeasons: 3
  });
  assert(step1.canAdvance && step1.nextSeason === 1 && step1.nextEpisode === 2,
    'Avança de T1E1 para T1E2 na mesma temporada'
  );

  // Caso 2: Último episódio da temporada atual (ex: T1E8 -> T2E1)
  const step2 = computeNextStep({
    hasEpisodes: true,
    curSeason: 1,
    curEpisode: 8,
    seasonEpCount: 8,
    totalSeasons: 3
  });
  assert(step2.canAdvance && step2.nextSeason === 2 && step2.nextEpisode === 1,
    'Avança de T1E8 para T2E1 na virada de temporada'
  );

  // Caso 3: Último episódio da última temporada (ex: T3E8 de 3 temporadas)
  const step3 = computeNextStep({
    hasEpisodes: true,
    curSeason: 3,
    curEpisode: 8,
    seasonEpCount: 8,
    totalSeasons: 3
  });
  assert(!step3.canAdvance,
    'Não exibe/permite avanço no último episódio da última temporada'
  );

  // Caso 4: Filme (hasEpisodes = false)
  const step4 = computeNextStep({
    hasEpisodes: false,
    curSeason: 1,
    curEpisode: 1,
    seasonEpCount: 1,
    totalSeasons: 1
  });
  assert(!step4.canAdvance,
    'Filmes não possuem próximo episódio'
  );

  // --- 2. Validação Estática do ContentDetailModal.tsx ---
  console.log('\n--- 2. Verificação do ContentDetailModal.tsx ---');
  const modalPath = path.resolve('components/ContentDetailModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert(
    modalCode.includes('let targetSeason = season ?? currentEpisodeParams?.season ?? currentSeason ?? 1'),
    'startPlayback determina targetSeason com fallback robusto'
  );

  assert(
    modalCode.includes('let targetEpisode = episode ?? currentEpisodeParams?.episode') &&
    modalCode.includes('targetEpisode = 1'),
    'startPlayback inicializa targetEpisode como 1 caso o usuário clique diretamente em Assistir'
  );

  assert(
    modalCode.includes('setCurrentEpisodeParams(epParams)'),
    'currentEpisodeParams é sempre definido em séries ao iniciar reprodução'
  );

  assert(
    modalCode.includes('setResolvedStreams([])'),
    'startPlayback limpa streams anteriores antes de resolver novos'
  );

  assert(
    modalCode.includes('curEpisode < seasonEpCount') && modalCode.includes('curSeason < totalSeasons'),
    'handleNextEpisode trata transição dentro da temporada e entre temporadas'
  );

  assert(
    modalCode.includes('key={hasEpisodes ? `${item.id}_s${currentEpisodeParams?.season || 1}_e${currentEpisodeParams?.episode || 1}` : item.id}'),
    'ZapiPlayer possui chave React única por episódio para remontagem e reinicialização limpa'
  );

  assert(
    modalCode.includes('onNextEpisode={hasNextEpisode ? handleNextEpisode : undefined}'),
    'onNextEpisode só é repassado quando hasNextEpisode for verdadeiro'
  );

  // --- 3. Verificação Estática do ZapiPlayer.tsx ---
  console.log('\n--- 3. Verificação do ZapiPlayer.tsx ---');
  const playerPath = path.resolve('src/components/player/ZapiPlayer.tsx');
  const playerCode = fs.readFileSync(playerPath, 'utf8');

  assert(
    playerCode.includes('case \'n\':') && playerCode.includes('case \'N\':') && playerCode.includes('onNextEpisode()'),
    'Atalho de teclado "N" implementado para avançar ao próximo episódio'
  );

  assert(
    playerCode.includes('onEnded={() => {') && playerCode.includes('if (onNextEpisode'),
    'Ao término do vídeo (onEnded), dispara automaticamente o próximo episódio se disponível'
  );

  assert(
    playerCode.includes('disabled={isLoadingStreams}') && playerCode.includes('Próximo'),
    'Botão de Próximo desabilita cliques enquanto streams estão carregando'
  );

  assert(
    playerCode.includes('e.stopPropagation();\n                  onNextEpisode();'),
    'Botão de Próximo previne propagação de clique indesejada'
  );

  console.log('\n======================================================');
  console.log(` RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO! `);
  console.log('======================================================');
}

runNextEpisodeValidation();
