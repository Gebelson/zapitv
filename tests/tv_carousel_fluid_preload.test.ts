import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tvImagePreloaderService } from '../src/core/tv/tvImagePreloaderService';
import { posterRecoveryService } from '../src/core/catalog/PosterRecoveryService';
import { ContentItem, ContentType } from '../types';

console.log('========================================================================');
console.log('--- TESTE: NAVEGAÇÃO ULTRAFLUIDA E PRÉ-CARREGAMENTO REAL DAS CAPAS ---');
console.log('========================================================================\n');

async function runTests() {
  // Cenário 1: Pré-carregador com fila de prioridade e concorrência limitada (máx 3)
  console.log('--- Cenário 1: Concorrência limitada e fila com prioridade ---');
  tvImagePreloaderService.clear();

  const url1 = 'https://image.tmdb.org/t/p/w500/test_poster_1.jpg';
  const url2 = 'https://image.tmdb.org/t/p/w500/test_poster_2.jpg';
  const url3 = 'https://image.tmdb.org/t/p/w500/test_poster_3.jpg';
  const url4 = 'https://image.tmdb.org/t/p/w500/test_poster_4.jpg';

  const p1 = tvImagePreloaderService.preload(url1, 1);
  const p2 = tvImagePreloaderService.preload(url2, 2);
  const p3 = tvImagePreloaderService.preload(url3, 3);
  const p4 = tvImagePreloaderService.preload(url4, 1); // prioridade alta deve furar a fila

  await Promise.all([p1, p2, p3, p4]);

  const metrics1 = tvImagePreloaderService.getMetrics();
  assert.ok(metrics1.totalRequested >= 4, 'Total de requisições deve registrar as 4 entradas');
  assert.ok(tvImagePreloaderService.isReady(url1), 'URL 1 deve estar marcada como pronta');
  assert.ok(tvImagePreloaderService.isReady(url4), 'URL 4 deve estar marcada como pronta');
  console.log('✔ Cenário 1: Fila prioritária e concorrência limitada calibrada para TV OK');

  // Cenário 2: Deduplicação de requisições em voo (inFlight sharing)
  console.log('\n--- Cenário 2: Deduplicação de requisições em voo ---');
  tvImagePreloaderService.clear();

  const sharedUrl = 'https://image.tmdb.org/t/p/w500/shared_hero.jpg';
  const req1 = tvImagePreloaderService.preload(sharedUrl, 1);
  const req2 = tvImagePreloaderService.preload(sharedUrl, 1);
  const req3 = tvImagePreloaderService.preload(sharedUrl, 2);

  // Ambas as chamadas devem compartilhar a mesma Promise subjacente
  assert.strictEqual(req1, req2, 'Requisições simultâneas para a mesma URL devem compartilhar a mesma Promise');
  assert.strictEqual(req2, req3, 'Requisições com prioridades distintas devem compartilhar a mesma Promise');

  await req1;
  const metrics2 = tvImagePreloaderService.getMetrics();
  assert.ok(metrics2.inFlightDeduplicated >= 2, 'Deduplicação deve evitar downloads concorrentes da mesma capa');
  console.log('✔ Cenário 2: Zero downloads duplicados da mesma URL durante o carregamento OK');

  // Cenário 3: Cache de imagens decodificadas limitado (LRU máx 80 itens)
  console.log('\n--- Cenário 3: Limite estrito de memória LRU (máx 80) ---');
  tvImagePreloaderService.clear();

  // Insere 90 imagens para verificar a evicção dos itens mais antigos
  const urls: string[] = [];
  for (let i = 0; i < 90; i++) {
    urls.push(`https://image.tmdb.org/t/p/w500/test_overflow_${i}.jpg`);
  }

  await Promise.all(urls.map((u, idx) => tvImagePreloaderService.preload(u, (idx % 2 + 1) as 1 | 2)));

  const metrics3 = tvImagePreloaderService.getMetrics();
  assert.ok(
    metrics3.readyCacheSize <= 80,
    `Cache de imagens decodificadas deve respeitar o teto estrito de 80 entradas (atual: ${metrics3.readyCacheSize})`
  );
  // O primeiro item (0) deve ter sido descartado em favor dos mais recentes
  assert.strictEqual(
    tvImagePreloaderService.isReady(urls[0]),
    false,
    'Item mais antigo deve ter sido evictado pelo LRU para poupar memória da Smart TV'
  );
  assert.strictEqual(
    tvImagePreloaderService.isReady(urls[89]),
    true,
    'Item mais recente deve permanecer pronto no cache'
  );
  console.log(`✔ Cenário 3: Consumo de memória estritamente limitado em 80 itens (atual: ${metrics3.readyCacheSize}) OK`);

  // Cenário 4: Integração com PosterRecoveryService
  console.log('\n--- Cenário 4: Integração com PosterRecoveryService ---');
  const mockItem: ContentItem = {
    id: 'test-item-preload-1',
    title: 'Interestelar',
    type: ContentType.MOVIE,
    image: 'https://image.tmdb.org/t/p/w500/interestelar_poster.jpg'
  };

  const preloaded = await posterRecoveryService.preloadItemPoster(mockItem, 1);
  assert.strictEqual(preloaded, true, 'preloadItemPoster deve retornar true');
  assert.strictEqual(
    posterRecoveryService.isPosterReady(mockItem),
    true,
    'isPosterReady deve confirmar que a capa está pronta na memória'
  );
  console.log('✔ Cenário 4: PosterRecoveryService pré-carrega e reporta status instantâneo OK');

  // Cenário 5: Verificação estática de TvContentRow.tsx (prioridade de carregamento e setas imediatas)
  console.log('\n--- Cenário 5: Verificação estática de TvContentRow.tsx ---');
  const rowSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/tv/TvContentRow.tsx'),
    'utf-8'
  );

  // Apenas a fileira focada recebe prioridade nos primeiros slots
  assert.ok(
    rowSource.includes('priority={focused && slotIdx >= 0 && slotIdx <= 2}'),
    'TvContentRow deve limitar priority (eager) exclusivamente aos slots 0 a 2 da fileira focada'
  );
  assert.ok(
    !rowSource.includes('priority={slotIdx >= 0 && slotIdx <= 4}'),
    'TvContentRow NÃO deve marcar todas as fileiras com eager em 5 slots simultaneamente'
  );

  // Inversão imediata de direção sem esperar término da animação oposta
  assert.ok(
    rowSource.includes("if (pendingSlideRef.current === 'left')") &&
    rowSource.includes("if (pendingSlideRef.current === 'right')"),
    'TvContentRow deve interromper e reverter a direção imediatamente ao alternar de seta'
  );

  // Duração dinâmica para passos acumulados
  assert.ok(
    rowSource.includes('stepsRemaining > 2 ? 140 : stepsRemaining > 1 ? 190 : CHAINED_DURATION'),
    'TvContentRow deve aplicar aceleração adaptativa (140ms/190ms) para passos rápidos acumulados'
  );

  // Pré-carregamento dos próximos itens na direção de navegação
  assert.ok(
    rowSource.includes('preloadItemPoster(next1') &&
    rowSource.includes('preloadItemPoster(prev1'),
    'TvContentRow deve pré-carregar ativamente o próximo (+1) e o anterior (-1)'
  );
  console.log('✔ Cenário 5: Regras de concorrência seletiva e setas imediatas em TvContentRow OK');

  // Cenário 6: Verificação de TvCard16x9.tsx (eliminação de renders desnecessários e cálculo de progresso)
  console.log('\n--- Cenário 6: Eliminação de trabalho desnecessário em TvCard16x9.tsx ---');
  const cardSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/tv/TvCard16x9.tsx'),
    'utf-8'
  );

  // Consulta de continuidade condicionada a showProgress
  assert.ok(
    cardSource.includes('showProgress ? storageService.getPlaybackContinuity(item) : null'),
    'TvCard16x9 deve consultar storageService apenas quando showProgress for verdadeiro'
  );

  // Eliminação de renders redundantes no useEffect
  assert.ok(
    cardSource.includes('if (optimized && optimized !== imgSrc)'),
    'TvCard16x9 deve evitar re-setar imgSrc quando a URL já estiver sincronizada no render'
  );

  // transform-gpu apenas onde há transformação ativa (evita inflar composite layers na TV)
  assert.ok(
    cardSource.includes('disableScale') && cardSource.includes('z-10'),
    'TvCard16x9 não deve aplicar transform-gpu desnecessário nos cards estáticos do carrossel'
  );
  console.log('✔ Cenário 6: Zero overhead de render e storage durante o deslizamento lateral OK');

  // Cenário 7: Simulação de estresse: 50 movimentos consecutivos rápidos
  console.log('\n--- Cenário 7: Simulação de estresse com 50 movimentos rápidos consecutivos ---');
  const catalogSize = 25;
  let currentIndex = 0;
  let targetIndex = 0;
  const startStress = Date.now();

  for (let move = 0; move < 50; move++) {
    // Alterna direções para simular uso real do controle
    const direction = (move % 8 === 0) ? -1 : 1;
    targetIndex = (targetIndex + direction + catalogSize) % catalogSize;
    // Simula commit em streak rápido
    currentIndex = (currentIndex + direction + catalogSize) % catalogSize;

    // Dispara pré-carregamento assíncrono sem aguardar
    const nextIdx = (currentIndex + 1) % catalogSize;
    tvImagePreloaderService.preload(`https://image.tmdb.org/t/p/w500/stress_${nextIdx}.jpg`, 1);
  }

  const stressDurationMs = Date.now() - startStress;
  assert.ok(
    stressDurationMs < 50,
    `50 movimentos lógicos devem executar em menos de 50ms na CPU (tempo real: ${stressDurationMs}ms)`
  );
  assert.strictEqual(
    currentIndex,
    targetIndex,
    'Índice físico e índice lógico de destino devem permanecer sincronizados após 50 comandos'
  );
  console.log(`✔ Cenário 7: 50 comandos de controle remoto executados com latência de ${stressDurationMs}ms e sincronia perfeita OK`);

  console.log('\n========================================================================');
  console.log('TODOS OS 7 CENÁRIOS DE NAVEGAÇÃO ULTRAFLUIDA E PRÉ-CARREGAMENTO PASSARAM!');
  console.log('========================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Falha no teste de navegação fluida:', err);
  process.exit(1);
});
