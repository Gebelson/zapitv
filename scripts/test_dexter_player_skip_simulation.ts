import { skipService, SkipInterval } from '../src/core/skip/skipService.js';
import { ContentType } from '../types.js';

function computeActiveSkipInterval(skipIntervals: SkipInterval[], currentTime: number): SkipInterval | null {
  if (!skipIntervals || skipIntervals.length === 0) return null;
  return skipIntervals.find(i => {
    if (i.type === 'ed') {
      return currentTime >= i.startTime && (i.endTime <= 0 || currentTime <= i.endTime);
    }
    return currentTime >= i.startTime && currentTime < i.endTime;
  }) || null;
}

async function testPlayerSimulation() {
  console.log('--- Iniciando Simulação de Player para Dexter S01E01 ---');
  const dexter = {
    id: '1405',
    tmdbId: '1405',
    imdbId: 'tt0773262',
    title: 'Dexter',
    type: ContentType.SERIES,
    year: 2006,
    rating: 8.7,
    image: ''
  };

  const intervals = await skipService.getSkipTimes(dexter, 1, 1, 3190);
  console.log(`Carregados ${intervals.length} intervalos para Dexter S01E01`);

  // 1. Início do episódio (cold open de 0 a 450s)
  let time = 100;
  let active = computeActiveSkipInterval(intervals, time);
  console.log(`Tempo ${time}s (Cold Open): botão ativo =`, active ? active.label : 'NENHUM');
  if (active !== null) throw new Error('Não deveria haver botão de skip no cold open');

  // 2. Chegada na abertura real (450s a 555s)
  time = 450;
  active = computeActiveSkipInterval(intervals, time);
  console.log(`Tempo ${time}s (Início Abertura): botão ativo =`, active ? active.label : 'NENHUM');
  if (!active || active.label !== 'Pular Abertura') throw new Error('Botão Pular Abertura deveria estar ativo em 450s');

  // 3. Meio da abertura
  time = 500;
  active = computeActiveSkipInterval(intervals, time);
  console.log(`Tempo ${time}s (Meio da Abertura): botão ativo =`, active ? active.label : 'NENHUM');
  if (!active || active.label !== 'Pular Abertura') throw new Error('Botão Pular Abertura deveria estar ativo em 500s');

  // 4. Execução do Pular Abertura -> Pula para 555s
  time = active.endTime;
  active = computeActiveSkipInterval(intervals, time);
  console.log(`Tempo após pular (${time}s): botão ativo =`, active ? active.label : 'NENHUM');
  if (active !== null) throw new Error('Botão deveria sumir após pular para o término da abertura');

  // 5. Usuário retrocede manualmente na barra para 470s
  time = 470;
  active = computeActiveSkipInterval(intervals, time);
  console.log(`Tempo após retroceder manualmente (${time}s): botão ativo =`, active ? active.label : 'NENHUM');
  if (!active || active.label !== 'Pular Abertura') throw new Error('Botão Pular Abertura deveria REAPARECER após retroceder');

  // 6. Avanço direto na barra de tempo para os créditos (3100s)
  time = 3100;
  active = computeActiveSkipInterval(intervals, time);
  console.log(`Tempo após avançar para créditos (${time}s): botão ativo =`, active ? active.label : 'NENHUM');
  if (!active || active.label !== 'Pular Créditos') throw new Error('Botão Pular Créditos deveria aparecer em 3100s');

  // 7. Fim dos créditos (3191s)
  time = 3191;
  active = computeActiveSkipInterval(intervals, time);
  console.log(`Tempo após fim dos créditos (${time}s): botão ativo =`, active ? active.label : 'NENHUM');
  if (active !== null) throw new Error('Botão deveria sumir após fim dos créditos');

  console.log('✓ Simulação de Player e Seek para Dexter S01E01 concluída com 100% de sucesso!');
}

testPlayerSimulation().catch(err => {
  console.error(err);
  process.exit(1);
});
