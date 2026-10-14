import { catalogIndexCountService } from '../src/core/catalog/CatalogIndexCountService';

async function runTests() {
  console.log('=== TESTES DO CATALOG INDEX COUNT SERVICE ===\n');

  console.log('1. Verificando estado de prontidão (isReady):');
  console.log('isReady:', catalogIndexCountService.isReady());

  const totalMovies = catalogIndexCountService.getTotal('movies');
  const totalSeries = catalogIndexCountService.getTotal('series');
  const totalAnimes = catalogIndexCountService.getTotal('animes');

  console.log('\n2. Totais consolidados do índice completo:');
  console.log('Total Filmes:', totalMovies);
  console.log('Total Séries:', totalSeries);
  console.log('Total Animes:', totalAnimes);

  if (typeof totalMovies !== 'number' || totalMovies <= 0) {
    throw new Error('Falha: total de filmes inválido');
  }
  if (typeof totalSeries !== 'number' || totalSeries <= 0) {
    throw new Error('Falha: total de séries inválido');
  }
  if (typeof totalAnimes !== 'number' || totalAnimes <= 0) {
    throw new Error('Falha: total de animes inválido');
  }

  console.log('\n3. Totais por gênero específico no índice:');
  const comedyMovies = catalogIndexCountService.getTotal('movies', 'Comédia');
  const terrorMovies = catalogIndexCountService.getTotal('movies', 'Terror');
  console.log('Filmes de Comédia:', comedyMovies);
  console.log('Filmes de Terror:', terrorMovies);

  if (typeof comedyMovies !== 'number' || comedyMovies <= 0) {
    throw new Error('Falha: total de filmes de comédia inválido');
  }

  console.log('\n4. Testando estabilidade perante recompute com mesmos dados:');
  const signatureBefore = totalMovies;
  catalogIndexCountService.recomputeIndex();
  const signatureAfter = catalogIndexCountService.getTotal('movies');
  console.log('Antes:', signatureBefore, '| Depois:', signatureAfter);

  if (signatureBefore !== signatureAfter) {
    throw new Error('Falha: total mudou indevidamente');
  }

  console.log('\nTODOS OS TESTES DO ÍNDICE PASSARAM COM SUCESSO!');
}

runTests().catch(err => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
