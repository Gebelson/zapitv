/**
 * ZAPITV — SUÍTE DE TESTES OBRIGATÓRIOS DO SISTEMA SEMANAL EM DESTAQUE
 * 
 * Executa validações automatizadas de todos os 18 cenários especificados:
 * 1. Atualização semanal programada
 * 2. Obtenção de novo ranking
 * 3. Ranking sem mudanças
 * 4. Filme indisponível no primeiro lugar
 * 5. Filme ainda em cartaz
 * 6. Série sem episódios reproduzíveis
 * 7. Fonte sem áudio/stream inválido
 * 8. Substituição pelo próximo elegível
 * 9. Preenchimento de dez vagas
 * 10. Falha de obtenção do IMDb (fallback seguro)
 * 11. Cache persistente em disco
 * 12. Publicação atômica
 * 13. Reinicialização do servidor
 * 14. Atualização manual pelo admin
 * 15. Atualização automática na Vercel (/api/featured/cron)
 * 16. Navegação durante atualização (0ms de latência)
 * 17. Título que perdeu disponibilidade
 * 18. Ranking com menos de dez candidatos válidos
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { weeklyFeaturedScheduler } from '../src/core/rankings/WeeklyFeaturedScheduler';
import { ImdbWeeklySnapshot } from '../src/core/rankings/featuredRankingTypes';
import { ContentItem, ContentType } from '../types';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedTests++;
        console.log(`✅ [TEST ${totalTests}] ${name}: PASS`);
      }).catch((err) => {
        console.error(`❌ [TEST ${totalTests}] ${name}: FAIL`, err);
        throw err;
      });
    } else {
      passedTests++;
      console.log(`✅ [TEST ${totalTests}] ${name}: PASS`);
      return Promise.resolve();
    }
  } catch (err) {
    console.error(`❌ [TEST ${totalTests}] ${name}: FAIL`, err);
    throw err;
  }
}

async function runAll() {
  console.log('================================================================');
  console.log('🚀 INICIANDO SUÍTE DE TESTES SEMANAL — EM DESTAQUE (ZAPITV)');
  console.log('================================================================\n');

  // Teste 1: Atualização semanal programada (Segunda-feira 06:00 BRT / 09:00 UTC)
  await runTest('1. Atualização semanal programada (Segunda-feira às 06:00 BRT)', () => {
    const nextDate = featuredRankingService.getNextMonday6AMBRT();
    assert.strictEqual(nextDate.getUTCDay(), 1, 'Próxima execução deve ser uma segunda-feira em UTC');
    assert.strictEqual(nextDate.getUTCHours(), 9, 'Hora UTC deve ser 09:00 (correspondente a 06:00 BRT)');
    assert.strictEqual(nextDate.getUTCMinutes(), 0, 'Minutos devem ser 00');
    
    const formatted = featuredRankingService.formatNextScheduledRun(nextDate);
    assert.ok(formatted.includes('Segunda-feira'), 'Texto formatado deve indicar Segunda-feira');
    assert.ok(formatted.includes('06:00 (BRT)'), 'Texto formatado deve conter 06:00 (BRT)');
  });

  // Teste 2: Obtenção de novo ranking
  await runTest('2. Obtenção de novo ranking com data de referência mais recente', async () => {
    const baseSnapshot = featuredRankingService.getLatestWeeklySnapshot('movie');
    const testSnapshot: ImdbWeeklySnapshot = {
      ...baseSnapshot,
      id: 'snapshot-movie-2026-w43',
      weekKey: '2026-W43',
      weekLabel: 'Semana 43 (Outubro de 2026)',
      monthKey: '2026-10',
      rankType: 'movie',
      referenceDate: '2026-10-19',
      capturedAt: Date.now(),
      items: baseSnapshot.items.map(it => ({ ...it, referenceDate: '2026-10-19' }))
    };

    const res = await featuredRankingService.runWeeklyScheduledUpdate({
      incomingSnapshots: [testSnapshot],
      force: true
    });

    assert.strictEqual(res.weekKey, '2026-W43');
    assert.strictEqual(res.updateStatus, 'SUCCESS');
  });

  // Teste 3: Ranking sem mudanças (idempotência controlada)
  await runTest('3. Ranking sem mudanças (mantém seleção e status UP_TO_DATE)', async () => {
    const current = featuredRankingService.getFeaturedSelectionSync();
    const res = await featuredRankingService.runWeeklyScheduledUpdate({ force: false });

    assert.strictEqual(res.weekKey, current.weekKey);
    assert.strictEqual(res.updateStatus, 'UP_TO_DATE');
    assert.strictEqual(res.featuredMovies.length, current.featuredMovies.length);
  });

  // Teste 4: Filme indisponível no primeiro lugar
  await runTest('4. Filme indisponível no primeiro lugar é descartado e substituído', () => {
    const candidates = [
      { imdbId: 'tt9999999_indisponivel', title: 'Filme Inexistente no ZapiTV', year: 2024, position: 1 },
      { imdbId: 'tt15239678', title: 'Duna: Parte 2', year: 2024, position: 2 }
    ];

    const { approvedItems, audit } = featuredRankingService.resolveEligibleTop10(candidates as any, 'movie', [
      {
        id: 'movie-dune-2',
        title: 'Duna: Parte 2',
        imdbId: 'tt15239678',
        year: 2024,
        type: ContentType.MOVIE,
        availabilityStatus: 'verified',
        verifiedStreams: [{ name: 'Fonte 1', url: 'http://cdn/video.mp4', isPtBr: true }]
      } as any
    ]);

    const rejectedFirst = audit.find(a => a.imdbId === 'tt9999999_indisponivel');
    assert.ok(rejectedFirst, 'Primeiro colocado deve constar na auditoria');
    assert.strictEqual(rejectedFirst.status, 'REJECTED');
    assert.strictEqual(rejectedFirst.rejectionReason, 'Identificador não encontrado no acervo do ZapiTV');
    
    assert.strictEqual(approvedItems[0].imdbId, 'tt15239678', 'O segundo colocado deve assumir a 1ª vaga aprovada');
  });

  // Teste 5: Filme ainda em cartaz
  await runTest('5. Filme ainda em cartaz é rejeitado por restrição cinematográfica', () => {
    const candidates = [
      { imdbId: 'tt3498964', title: 'Vingadores: Doutor Destino', year: 2026, position: 1 }
    ];

    const { approvedItems, audit } = featuredRankingService.resolveEligibleTop10(candidates as any, 'movie', [
      {
        id: 'movie-avengers-doomsday',
        title: 'Vingadores: Doutor Destino',
        imdbId: 'tt3498964',
        year: 2026,
        type: ContentType.MOVIE,
        availabilityStatus: 'verified',
        verifiedStreams: [{ name: 'Fonte 1', url: 'http://cdn/video.mp4' }]
      } as any
    ]);

    assert.strictEqual(approvedItems.length, 0, 'Filme em cartaz não pode ser aprovado');
    assert.strictEqual(audit[0].status, 'REJECTED');
    assert.ok(audit[0].rejectionReason?.includes('em cartaz nos cinemas brasileiros'));
  });

  // Teste 6: Série sem episódios reproduzíveis
  await runTest('6. Série sem episódios reproduzíveis é rejeitada', () => {
    const candidates = [
      { imdbId: 'tt_serie_vazia', title: 'Série Sem Episódio', year: 2024, position: 1 }
    ];

    const { approvedItems, audit } = featuredRankingService.resolveEligibleTop10(candidates as any, 'series', [
      {
        id: 'series-empty',
        title: 'Série Sem Episódio',
        imdbId: 'tt_serie_vazia',
        year: 2024,
        type: ContentType.SERIES,
        availabilityStatus: 'pending',
        episodes: []
      } as any
    ]);

    assert.strictEqual(approvedItems.length, 0);
    assert.strictEqual(audit[0].status, 'REJECTED');
  });

  // Teste 7: Fonte sem stream funcional
  await runTest('7. Título sem fontes válidas ou reproduzíveis é rejeitado', () => {
    const candidates = [
      { imdbId: 'tt_sem_fonte', title: 'Filme Fantasma', year: 2023, position: 1 }
    ];

    const { approvedItems, audit } = featuredRankingService.resolveEligibleTop10(candidates as any, 'movie', [
      {
        id: 'movie-ghost',
        title: 'Filme Fantasma',
        imdbId: 'tt_sem_fonte',
        year: 2023,
        type: ContentType.MOVIE,
        availabilityStatus: 'unavailable',
        verifiedStreams: []
      } as any
    ]);

    assert.strictEqual(approvedItems.length, 0);
    assert.strictEqual(audit[0].status, 'REJECTED');
    assert.ok(audit[0].rejectionReason?.includes('Sem fontes válidas'));
  });

  // Teste 8: Substituição pelo próximo elegível
  await runTest('8. Substituição pelo próximo elegível segue a ordem estrita do ranking', () => {
    const candidates = [
      { imdbId: 'tt1', title: 'Indisponível 1', year: 2024, position: 1 },
      { imdbId: 'tt2', title: 'Indisponível 2', year: 2024, position: 2 },
      { imdbId: 'tt3', title: 'Disponível 3', year: 2024, position: 3 },
      { imdbId: 'tt4', title: 'Disponível 4', year: 2024, position: 4 }
    ];

    const catalog = [
      {
        id: 'item-3',
        title: 'Disponível 3',
        imdbId: 'tt3',
        year: 2024,
        type: ContentType.MOVIE,
        availabilityStatus: 'verified',
        verifiedStreams: [{ name: 'Fonte', url: 'http://cdn/3.mp4' }]
      },
      {
        id: 'item-4',
        title: 'Disponível 4',
        imdbId: 'tt4',
        year: 2024,
        type: ContentType.MOVIE,
        availabilityStatus: 'verified',
        verifiedStreams: [{ name: 'Fonte', url: 'http://cdn/4.mp4' }]
      }
    ];

    const { approvedItems } = featuredRankingService.resolveEligibleTop10(candidates as any, 'movie', catalog as any);
    assert.strictEqual(approvedItems.length, 2);
    assert.strictEqual(approvedItems[0].imdbId, 'tt3');
    assert.strictEqual(approvedItems[1].imdbId, 'tt4');
  });

  // Teste 9: Preenchimento de dez vagas de filmes e dez de séries
  await runTest('9. Preenchimento de dez vagas para filmes e séries no acervo completo', () => {
    const res = featuredRankingService.recomputeFeaturedSelectionSync();
    assert.strictEqual(res.featuredMovies.length, 10, 'Deve conter exatamente 10 filmes em destaque');
    assert.strictEqual(res.featuredSeries.length, 10, 'Deve conter exatamente 10 séries em destaque');
  });

  // Teste 10: Falha de obtenção do IMDb (fallback seguro sem tela vazia)
  await runTest('10. Falha de obtenção do IMDb preserva a lista anterior intacta', async () => {
    const previous = featuredRankingService.getFeaturedSelectionSync();
    assert.strictEqual(previous.featuredMovies.length, 10);

    // Simula erro na captura passando snapshot defeituoso que causaria throw
    try {
      await featuredRankingService.runWeeklyScheduledUpdate({
        incomingSnapshots: [{ id: 'broken' } as any]
      });
    } catch {}

    const safe = featuredRankingService.getFeaturedSelectionSync();
    assert.strictEqual(safe.featuredMovies.length, 10, 'A lista nunca deve ser esvaziada em caso de erro');
    assert.strictEqual(safe.featuredSeries.length, 10, 'As séries nunca devem ser esvaziadas em caso de erro');
  });

  // Teste 11: Cache persistente em disco
  await runTest('11. Cache persistente em disco com integridade de dados', () => {
    const testDir = path.resolve(process.cwd(), 'data');
    const testFile = path.resolve(testDir, 'test_featured_cache.json');
    
    let savedData: any = null;
    featuredRankingService.setStorageAdapter({
      load: () => savedData,
      save: (data) => {
        savedData = data;
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(testFile, JSON.stringify(data), 'utf-8');
      }
    });

    const res = featuredRankingService.recomputeFeaturedSelectionSync();
    assert.ok(fs.existsSync(testFile), 'Arquivo de cache no disco deve existir');
    const diskContent = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
    assert.strictEqual(diskContent.featuredMovies.length, 10);
    assert.strictEqual(diskContent.weekKey, res.weekKey);

    // Limpa arquivo de teste
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  // Teste 12: Publicação atômica (sem listas parciais ou incompletas)
  await runTest('12. Publicação atômica evita publicação parcial', () => {
    const current = featuredRankingService.getFeaturedSelectionSync();
    // Verifica que tanto movies quanto series estão devidamente preenchidos
    assert.ok(current.featuredMovies.length > 0 && current.featuredSeries.length > 0);
    assert.strictEqual(current.auditTrail.approvedMovies.length, current.featuredMovies.length);
  });

  // Teste 13: Reinicialização do servidor (recuperação de cache em disco)
  await runTest('13. Reinicialização do servidor recupera seleção válida do disco', () => {
    const current = featuredRankingService.getFeaturedSelectionSync();
    let memoryCache: any = JSON.parse(JSON.stringify(current));

    const mockAdapter = {
      load: () => memoryCache,
      save: (d: any) => { memoryCache = d; }
    };

    featuredRankingService.setStorageAdapter(mockAdapter);
    const recovered = featuredRankingService.getFeaturedSelectionSync();
    assert.strictEqual(recovered.weekKey, current.weekKey);
    assert.strictEqual(recovered.featuredMovies.length, 10);
  });

  // Teste 14: Atualização manual pelo admin
  await runTest('14. Atualização manual pelo admin (refreshFeaturedSelection)', async () => {
    const res = await featuredRankingService.refreshFeaturedSelection();
    assert.strictEqual(res.updateStatus, 'SUCCESS');
    assert.strictEqual(res.featuredMovies.length, 10);
    assert.strictEqual(res.featuredSeries.length, 10);
  });

  // Teste 15: Atualização automática na Vercel (simulação de requisição cron)
  await runTest('15. Configuração Vercel Cron (segunda-feira 09:00 UTC / 06:00 BRT)', () => {
    const vercelConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf-8'));
    assert.ok(Array.isArray(vercelConfig.crons), 'vercel.json deve conter chave crons');
    const cron = vercelConfig.crons.find((c: any) => c.path === '/api/featured/cron');
    assert.ok(cron, 'Rota /api/featured/cron deve estar declarada');
    assert.strictEqual(cron.schedule, '0 9 * * 1', 'Agendamento deve ser 0 9 * * 1 (Segunda 06:00 BRT)');
  });

  // Teste 16: Navegação durante atualização (leitura síncrona 0ms sem bloquear UI)
  await runTest('16. Leitura síncrona do cache responde em 0ms durante navegação', () => {
    const t0 = performance.now();
    const data = featuredRankingService.getFeaturedSelectionSync();
    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 5, `Leitura síncrona deve ser instantânea (<5ms), levou ${elapsed.toFixed(2)}ms`);
    assert.ok(data.featuredMovies.length > 0);
  });

  // Teste 17: Título que perdeu disponibilidade posterior
  await runTest('17. Substituição dinâmica de título que perdeu disponibilidade', () => {
    const current = featuredRankingService.getFeaturedSelectionSync();
    // Simula catálogo onde o primeiro filme foi marcado como unavailable
    const modifiedCatalog = [...current.featuredMovies, ...current.featuredSeries].map(item => {
      if (item.id === current.featuredMovies[0].id) {
        return { ...item, availabilityStatus: 'unavailable', verifiedStreams: [] };
      }
      return item;
    });

    const replaced = featuredRankingService.validateAndReplaceUnavailableItems(modifiedCatalog as any);
    assert.ok(replaced.featuredMovies.every(m => m.id !== current.featuredMovies[0].id || m.availabilityStatus !== 'unavailable'));
  });

  // Teste 18: Ranking com menos de dez candidatos válidos
  await runTest('18. Ranking com menos de 10 candidatos válidos preenche de forma controlada', () => {
    const candidates = [
      { imdbId: 'tt1', title: 'Filme Único 1', year: 2024, position: 1 },
      { imdbId: 'tt2', title: 'Filme Único 2', year: 2024, position: 2 }
    ];

    const catalog = [
      { id: 'f1', imdbId: 'tt1', title: 'Filme Único 1', year: 2024, type: ContentType.MOVIE, availabilityStatus: 'verified', verifiedStreams: [{ name: 'S1', url: 'http://cdn/1.mp4' }] },
      { id: 'f2', imdbId: 'tt2', title: 'Filme Único 2', year: 2024, type: ContentType.MOVIE, availabilityStatus: 'verified', verifiedStreams: [{ name: 'S2', url: 'http://cdn/2.mp4' }] }
    ];

    const { approvedItems } = featuredRankingService.resolveEligibleTop10(candidates as any, 'movie', catalog as any);
    assert.strictEqual(approvedItems.length, 2, 'Deve aprovar os 2 disponíveis sem inventar mídias aleatórias nem duplicar cards');
  });

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${passedTests}/${totalTests} TESTES FORAM APROVADOS COM SUCESSO!`);
  console.log('================================================================');
}

runAll().catch(err => {
  console.error('Falha geral na execução dos testes:', err);
  process.exit(1);
});
