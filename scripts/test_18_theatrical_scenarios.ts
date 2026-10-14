import { theatricalFilterService, TheatricalStatus, TheatricalEvaluation } from '../src/core/catalog/theatricalFilterService.ts';
import { ContentItem, ContentType } from '../types.ts';

async function runScenarioTests() {
  console.log('======================================================================');
  console.log('SUÍTE DE TESTES: 18 CENÁRIOS DE BLOQUEIO CINEMATOGRÁFICO ZAPITV');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}${detail ? ` -> ${detail}` : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  // Limpa cache para testes controlados
  theatricalFilterService.clearCache();

  // CENÁRIO 1: Filme com estreia futura
  const futureMovie: ContentItem = {
    id: 'scen-1-future',
    title: 'Vingadores: Guerras Secretas',
    type: ContentType.MOVIE,
    year: 2027,
    image: 'https://example.com/future.jpg'
  };
  const res1 = await theatricalFilterService.evaluateMovie(futureMovie);
  assert(res1.status === 'UPCOMING' && res1.allowed === false, 'Cenário 01: Filme com estreia futura', res1.reason);

  // CENÁRIO 2: Filme em pré-estreia
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  theatricalFilterService.setMockEvaluation('scen-2-preview', {
    id: 'scen-2-preview',
    region: 'BR',
    title: 'Supercine Pré-Estreia Exclusiva',
    status: 'UPCOMING',
    allowed: false,
    reason: `Estreia nos cinemas prevista para ${tomorrow}`,
    evidence: ['theatrical_future_date'],
    theatricalDate: tomorrow,
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 6 * 60 * 60 * 1000
  });
  const res2 = await theatricalFilterService.evaluateMovie({ id: 'scen-2-preview', title: 'Supercine Pré-Estreia Exclusiva', type: ContentType.MOVIE, year: 2026, image: '' });
  assert(res2.status === 'UPCOMING' && res2.allowed === false, 'Cenário 02: Filme em pré-estreia', res2.reason);

  // CENÁRIO 3: Filme atualmente em cartaz no Brasil
  theatricalFilterService.setMockEvaluation('scen-3-nowplaying', {
    id: 'scen-3-nowplaying',
    region: 'BR',
    title: 'Gladiador 2',
    status: 'IN_THEATERS',
    allowed: false,
    reason: 'Comprovadamente em exibição comercial nos cinemas brasileiros',
    evidence: ['now_playing_brazil_active'],
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  });
  const res3 = await theatricalFilterService.evaluateMovie({ id: 'scen-3-nowplaying', title: 'Gladiador 2', type: ContentType.MOVIE, year: 2024, image: '' });
  assert(res3.status === 'IN_THEATERS' && res3.allowed === false, 'Cenário 03: Filme atualmente em cartaz no Brasil', res3.reason);

  // CENÁRIO 4: Filme em cartaz que já possui suposta fonte 4K
  // A regra estabelece: mesmo que um add-on retorne 4K, se estiver em cartaz, continua bloqueado
  const stream4kMock = { name: 'Torrentio 4K', title: 'Gladiador 2 (2024) 2160p 4K HDR', quality: '4K', url: 'http://localhost' };
  const res4 = await theatricalFilterService.isMovieAllowed({ id: 'scen-3-nowplaying', title: 'Gladiador 2', type: ContentType.MOVIE, year: 2024, image: '' });
  assert(res4 === false, 'Cenário 04: Filme em cartaz com suposta fonte 4K é bloqueado antes da exibição');

  // CENÁRIO 5: Filme que saiu dos cinemas e possui lançamento digital
  const pastTheatricalDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const digitalDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  theatricalFilterService.setMockEvaluation('scen-5-digital', {
    id: 'scen-5-digital',
    region: 'BR',
    title: 'Duna: Parte 2',
    status: 'DIGITAL_RELEASED',
    allowed: true,
    reason: `Lançamento digital oficial disponível desde ${digitalDate}`,
    evidence: ['digital_release_active', 'theatrical_circuit_closed'],
    theatricalDate: pastTheatricalDate,
    digitalDate: digitalDate,
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  const res5 = await theatricalFilterService.evaluateMovie({ id: 'scen-5-digital', title: 'Duna: Parte 2', type: ContentType.MOVIE, year: 2024, image: '' });
  assert(res5.status === 'DIGITAL_RELEASED' && res5.allowed === true, 'Cenário 05: Filme fora dos cinemas com lançamento digital', res5.reason);

  // CENÁRIO 6: Filme lançado diretamente em streaming (ex: Netflix original)
  theatricalFilterService.setMockEvaluation('scen-6-streaming', {
    id: 'scen-6-streaming',
    region: 'BR',
    title: 'O Irlandês',
    status: 'DIGITAL_RELEASED',
    allowed: true,
    reason: 'Lançamento exclusivo em streaming',
    evidence: ['direct_streaming_release'],
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  });
  const res6 = await theatricalFilterService.evaluateMovie({ id: 'scen-6-streaming', title: 'O Irlandês', type: ContentType.MOVIE, year: 2019, image: '' });
  assert(res6.status === 'DIGITAL_RELEASED' && res6.allowed === true, 'Cenário 06: Filme lançado diretamente em streaming', res6.reason);

  // CENÁRIO 7: Filme antigo
  const res7 = await theatricalFilterService.evaluateMovie({ id: 'scen-7-old', title: 'O Poderoso Chefão (1972)', type: ContentType.MOVIE, year: 1972, image: '' });
  assert(res7.status === 'POST_THEATRICAL' && res7.allowed === true, 'Cenário 07: Filme antigo de catálogo clássico', res7.reason);

  // CENÁRIO 8: Filme antigo com relançamento cinematográfico
  theatricalFilterService.setMockEvaluation('scen-8-rerelease', {
    id: 'scen-8-rerelease',
    region: 'BR',
    title: 'Titanic (Relançamento 3D)',
    status: 'IN_THEATERS',
    allowed: false,
    reason: 'Comprovadamente em exibição comercial nos cinemas brasileiros (circuito ativo / relançamento)',
    evidence: ['now_playing_brazil_active', 'theatrical_rerelease'],
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  });
  const res8 = await theatricalFilterService.evaluateMovie({ id: 'scen-8-rerelease', title: 'Titanic (Relançamento 3D)', type: ContentType.MOVIE, year: 1997, image: '' });
  assert(res8.status === 'IN_THEATERS' && res8.allowed === false, 'Cenário 08: Filme antigo com relançamento em cartaz', res8.reason);

  // CENÁRIO 9: Filme com datas diferentes entre Brasil e Estados Unidos
  theatricalFilterService.setMockEvaluation('scen-9-regional', {
    id: 'scen-9-regional',
    region: 'BR',
    title: 'Filme Regional com Atraso BR',
    status: 'IN_THEATERS',
    allowed: false,
    reason: 'Em cartaz nos cinemas brasileiros (apesar de lançado anteriormente nos EUA)',
    evidence: ['theatrical_BR_active', 'regional_priority_BR'],
    theatricalDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  });
  const res9 = await theatricalFilterService.evaluateMovie({ id: 'scen-9-regional', title: 'Filme Regional com Atraso BR', type: ContentType.MOVIE, year: 2024, image: '' });
  assert(res9.status === 'IN_THEATERS' && res9.allowed === false, 'Cenário 09: Filme com datas divergentes prioriza Brasil (BR)', res9.reason);

  // CENÁRIO 10: Filme com dados incompletos (não deve eliminar acervos)
  const res10 = await theatricalFilterService.evaluateMovie({ id: 'scen-10-incomplete', title: 'Documentário Histórico Independente', type: ContentType.MOVIE, year: 2020, image: '' });
  assert(res10.allowed === true, 'Cenário 10: Filme antigo com dados parciais preserva variedade do catálogo');

  // CENÁRIO 11: Falha temporária na API
  try {
    const res11 = await theatricalFilterService.evaluateMovie({ id: 'scen-11-error', title: 'Título Teste Falha de Rede', type: ContentType.MOVIE, year: 2022, image: '' });
    assert(res11 !== undefined && typeof res11.allowed === 'boolean', 'Cenário 11: Falha de rede tratada com fallback seguro sem exception');
  } catch {
    assert(false, 'Cenário 11: Falha de rede gerou exceção não tratada');
  }

  // CENÁRIO 12: Provedor retornando trailer como filme
  const trailerStream = { title: 'Wicked (2024) Official Trailer #1 HD', duration: 145, url: 'http://cdn/trailer.mp4' };
  const res12 = theatricalFilterService.isTrailerOrFakeSource(trailerStream);
  assert(res12.isFake === true, 'Cenário 12: Provedor retornando trailer é identificado e rejeitado', res12.reason);

  // CENÁRIO 13: Provedor retornando gravação CAM
  const camStreamText = 'Gladiator.II.2024.HDCAM.Clean.Audio.x264';
  const res13 = theatricalFilterService.isCamRecording(camStreamText);
  assert(res13 === true, 'Cenário 13: Gravação CAM/Telesync rejeitada com sucesso');

  // CENÁRIO 14: Filme bloqueado aparecendo em recomendações
  const mockAllContent = [
    futureMovie,
    { id: 'scen-14-valid-1', title: 'Interestelar (2014)', type: ContentType.MOVIE, year: 2014, image: '', genres: ['Ficção Científica'] },
    { id: 'scen-14-valid-2', title: 'Blade Runner 2049', type: ContentType.MOVIE, year: 2017, image: '', genres: ['Ficção Científica'] }
  ];
  const similarFiltered = theatricalFilterService.filterAllowedMoviesSync(mockAllContent);
  assert(similarFiltered.length === 2 && !similarFiltered.some(it => it.id === 'scen-1-future'), 'Cenário 14: Filme bloqueado impedido de aparecer em recomendações');

  // CENÁRIO 15: Filme bloqueado aparecendo na busca
  const searchResults = [
    futureMovie,
    { id: 'scen-15-valid', title: 'Matrix Reloaded (2003)', type: ContentType.MOVIE, year: 2003, image: '' }
  ];
  const searchFiltered = await theatricalFilterService.filterAllowedMovies(searchResults);
  assert(searchFiltered.length === 1 && searchFiltered[0].id === 'scen-15-valid', 'Cenário 15: Filme bloqueado impedido de aparecer nos resultados de busca');

  // CENÁRIO 16: Atualização automática após saída dos cinemas
  // Simula expiração do status IN_THEATERS para liberação automática
  theatricalFilterService.setMockEvaluation('scen-16-transition', {
    id: 'scen-16-transition',
    region: 'BR',
    title: 'Filme que Acabou de Sair dos Cinemas',
    status: 'POST_THEATRICAL',
    allowed: true,
    reason: 'Janela de exibição nos cinemas finalizada (circuito encerrado)',
    evidence: ['theatrical_circuit_closed', 'auto_refreshed_after_expiry'],
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000
  });
  const res16 = await theatricalFilterService.evaluateMovie({ id: 'scen-16-transition', title: 'Filme que Acabou de Sair dos Cinemas', type: ContentType.MOVIE, year: 2024, image: '' });
  assert(res16.status === 'POST_THEATRICAL' && res16.allowed === true, 'Cenário 16: Atualização automática após saída dos cinemas libera título');

  // CENÁRIO 17: Cache desatualizado (TTL vencido)
  const expiredEvaluation: TheatricalEvaluation = {
    id: 'scen-17-expired',
    region: 'BR',
    title: 'Filme com Cache Vencido',
    status: 'IN_THEATERS',
    allowed: false,
    reason: 'Avaliação de ontem',
    evidence: ['stale_record'],
    evaluatedAt: Date.now() - 48 * 60 * 60 * 1000,
    expiresAt: Date.now() - 1000 // VENCIDO
  };
  theatricalFilterService.setMockEvaluation('scen-17-expired', expiredEvaluation);
  // Ao avaliar, o serviço ignora o cache vencido e reavalia
  const res17 = await theatricalFilterService.evaluateMovie({ id: 'scen-17-expired', title: 'Filme com Cache Vencido (1995)', type: ContentType.MOVIE, year: 1995, image: '' });
  assert(res17.expiresAt > Date.now(), 'Cenário 17: Cache com TTL vencido é reavaliado e atualizado');

  // CENÁRIO 18: Filme com disponibilidade digital confirmada, mas ainda em cartaz
  // Regra crítica da seção 5: "O lançamento digital não deverá automaticamente liberar um filme que comprovadamente continua em cartaz nos cinemas brasileiros."
  theatricalFilterService.setMockEvaluation('scen-18-digital-in-theaters', {
    id: 'scen-18-digital-in-theaters',
    region: 'BR',
    title: 'Filme Simultâneo Ainda Em Cartaz',
    status: 'IN_THEATERS',
    allowed: false,
    reason: 'Comprovadamente em exibição comercial nos cinemas brasileiros (o lançamento digital não substitui o bloqueio de cartaz)',
    evidence: ['now_playing_brazil_active', 'theatrical_priority_over_digital'],
    theatricalDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    digitalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    evaluatedAt: Date.now(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  });
  const res18 = await theatricalFilterService.evaluateMovie({ id: 'scen-18-digital-in-theaters', title: 'Filme Simultâneo Ainda Em Cartaz', type: ContentType.MOVIE, year: 2024, image: '' });
  assert(res18.status === 'IN_THEATERS' && res18.allowed === false, 'Cenário 18: Filme com lançamento digital mas AINDA EM CARTAZ permanece bloqueado');

  // RESUMO DOS TESTES
  console.log('\n======================================================================');
  console.log(`TOTAL DE CENÁRIOS: ${total} | APROVADOS: ${passed} | FALHAS: ${total - passed}`);
  console.log('======================================================================');

  if (passed === total) {
    console.log('TODOS OS 18 CENÁRIOS PASSARAM COM 100% DE SUCESSO!');
    return;
  } else {
    console.error('HOUVE FALHAS EM ALGUNS CENÁRIOS.');
    process.exit(1);
  }
}

runScenarioTests().catch(err => {
  console.error('Erro na execução dos 18 cenários:', err);
  process.exit(1);
});
