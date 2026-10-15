import { skipService } from '../src/core/skip/skipService.js';
import { ContentType } from '../types.js';

async function runTest() {
  console.log('--- Testando Dexter S01E01 ---');
  const dexterItem = {
    id: '1405',
    tmdbId: '1405',
    imdbId: 'tt0773262',
    title: 'Dexter',
    type: ContentType.SERIES,
    year: 2006,
    rating: 8.7,
    image: 'https://image.tmdb.org/t/p/w500/58H6CtF0xvSbbL2VP9w8862Ke2.jpg'
  };

  const intervalsE1 = await skipService.getSkipTimes(dexterItem, 1, 1, 3190);
  console.log('Intervalos retornados Dexter S1E1:', JSON.stringify(intervalsE1, null, 2));

  // Validação S1E1:
  const opE1 = intervalsE1.find(i => i.type === 'op');
  const edE1 = intervalsE1.find(i => i.type === 'ed');

  if (!opE1 || opE1.startTime !== 450 || opE1.endTime !== 555) {
    console.error('ERRO: Abertura de Dexter S1E1 deve ser de 450 a 555!');
    process.exit(1);
  }
  if (!edE1 || edE1.startTime !== 3088 || edE1.endTime !== 3190) {
    console.error('ERRO: Créditos de Dexter S1E1 devem ser de 3088 a 3190!');
    process.exit(1);
  }

  console.log('✓ Dexter S1E1 validado com sucesso!');

  console.log('--- Testando Dexter S01E02 ---');
  const intervalsE2 = await skipService.getSkipTimes(dexterItem, 1, 2, 3285);
  console.log('Intervalos retornados Dexter S1E2:', JSON.stringify(intervalsE2, null, 2));

  const recapE2 = intervalsE2.find(i => i.type === 'recap');
  const opE2 = intervalsE2.find(i => i.type === 'op');
  const edE2 = intervalsE2.find(i => i.type === 'ed');

  if (!recapE2 || recapE2.startTime !== 1 || recapE2.endTime !== 125) {
    console.error('ERRO: Recap de Dexter S1E2 deve ser de 1 a 125!');
    process.exit(1);
  }
  if (!opE2 || opE2.startTime !== 126 || opE2.endTime !== 228) {
    console.error('ERRO: Abertura de Dexter S1E2 deve ser de 126 a 228!');
    process.exit(1);
  }
  if (!edE2 || edE2.startTime !== 3232 || edE2.endTime !== 3285) {
    console.error('ERRO: Créditos de Dexter S1E2 devem ser de 3232 a 3285!');
    process.exit(1);
  }

  console.log('✓ Dexter S1E2 validado com sucesso!');

  console.log('--- Testando Cadastro Administrativo ---');
  const customEntry = skipService.saveAdminInterval({
    contentId: 'breaking-bad',
    contentTitle: 'Breaking Bad',
    season: 1,
    episode: 1,
    type: 'op',
    startTime: 180,
    endTime: 215,
    source: 'admin'
  });
  console.log('Entrada admin salva:', customEntry);

  const bbItem = {
    id: '1396',
    tmdbId: '1396',
    imdbId: 'tt0903747',
    title: 'Breaking Bad',
    type: ContentType.SERIES,
    year: 2008,
    rating: 9.5,
    image: ''
  };

  const bbIntervals = await skipService.getSkipTimes(bbItem, 1, 1, 3400);
  console.log('Intervalos Breaking Bad S1E1:', JSON.stringify(bbIntervals, null, 2));
  const bbOp = bbIntervals.find(i => i.type === 'op');
  if (!bbOp || bbOp.startTime !== 180 || bbOp.endTime !== 215) {
    console.error('ERRO: Intervalo cadastrado no admin não foi retornado com prioridade!');
    process.exit(1);
  }
  console.log('✓ Intervalos cadastrados no painel administrativo validados com sucesso!');

  console.log('TODOS OS TESTES PASSARAM COM SUCESSO!');
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
