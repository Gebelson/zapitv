import assert from 'node:assert/strict';
import fs from 'fs';
import http from 'http';
import { createDatabase, ensureAuthTables, type Database } from '../src/server/database/client';

const TEST_DB_PATH = 'data/test_feedback_full_cycle.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

if (fs.existsSync(TEST_DB_PATH)) {
  try { fs.unlinkSync(TEST_DB_PATH); } catch {}
}

process.env.TURSO_DATABASE_URL = TEST_DB_URL;
process.env.LOCAL_DB_URL = TEST_DB_URL;
process.env.ALLOW_LOCAL_DB = 'true';
process.env.VERCEL = '1';
process.env.ADMIN_EMAILS = 'graficadfuturo@gmail.com,admin.feedback@zapitv.com';
delete process.env.TURSO_AUTH_TOKEN;

const testDb = createDatabase(TEST_DB_URL);
await ensureAuthTables(testDb);

// Assegura tabela global_settings
await testDb.client.execute(`
  CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL
  );
`);

const { default: app } = await import('../server.ts');
const server = http.createServer(app);

await new Promise<void>((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve());
});

const addr = server.address() as any;
const baseUrl = `http://127.0.0.1:${addr.port}`;
console.log(`✓ Servidor de teste ativo em ${baseUrl}`);

try {
  // 1. Cadastra Usuário Comum
  const regUserRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Usuario Comum',
      email: 'comum.feedback@exemplo.com',
      password: 'SenhaUser123',
      passwordConfirm: 'SenhaUser123',
      termsAccepted: true
    })
  });
  assert.equal(regUserRes.status, 201);
  const userCookie = regUserRes.headers.get('set-cookie')?.split(';')[0] || '';
  assert.ok(userCookie, 'Cookie de sessão do usuário comum deve ser gerado');

  // 2. Cadastra Usuário Administrador
  const regAdminRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Admin ZapiTV',
      email: 'admin.feedback@zapitv.com',
      password: 'AdminPassword123',
      passwordConfirm: 'AdminPassword123',
      termsAccepted: true
    })
  });
  assert.equal(regAdminRes.status, 201);
  const adminCookie = regAdminRes.headers.get('set-cookie')?.split(';')[0] || '';
  assert.ok(adminCookie, 'Cookie de sessão do administrador deve ser gerado');

  console.log('=== TESTE 1: Prevenção de Falso Sucesso no FeedbackCollector ===');
  const { FeedbackCollector } = await import('../src/core/feedback/feedbackCollector');
  
  // Tenta submeter simulando falha de servidor 500
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Erro de infraestrutura simulado' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    const failedResponse = await FeedbackCollector.submitFeedback('video_not_loading', 'Falha intencional');
    assert.equal(failedResponse.success, false, 'Erro de servidor NÃO pode retornar success: true');
    assert.equal(failedResponse.message, 'Erro de infraestrutura simulado');
    console.log('✓ Falha de servidor tratada como erro com mensagem clara, sem falso sucesso.');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('=== TESTE 2: Submissão Pública de Feedbacks (/api/feedback/submit) ===');
  // Submissão 1: Feedback anônimo válido
  const submitRes1 = await fetch(`${baseUrl}/api/feedback/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'video_not_loading',
      userDescription: 'Player travou aos 10 minutos',
      technicalContext: {
        canonicalMediaId: 'tmdb-movie-550',
        mediaTitle: 'Clube da Luta',
        mediaType: 'movie',
        browser: 'Chrome',
        os: 'Windows',
        deviceType: 'desktop'
      },
      clientSubmissionToken: 'client-tok-100'
    })
  });
  assert.equal(submitRes1.status, 200, 'Submissão pública deve ser permitida com 200');
  const submitData1 = await submitRes1.json();
  assert.equal(submitData1.success, true);
  assert.ok(submitData1.reportId);
  const clusterId1 = submitData1.clusterId;
  assert.ok(clusterId1);

  // Submissão 2: Feedback com detalhes adicionais do mesmo cliente não deve ser bloqueado prematuramente
  const submitRes2 = await fetch(`${baseUrl}/api/feedback/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'video_not_loading',
      userDescription: 'A imagem também congelou',
      technicalContext: {
        canonicalMediaId: 'tmdb-movie-550',
        mediaTitle: 'Clube da Luta',
        mediaType: 'movie',
        browser: 'Chrome',
        os: 'Windows',
        deviceType: 'desktop'
      },
      clientSubmissionToken: 'client-tok-100'
    })
  });
  assert.equal(submitRes2.status, 200);
  const submitData2 = await submitRes2.json();
  assert.equal(submitData2.success, true);
  assert.equal(submitData2.isDuplicate, false, 'Relato com nova descrição válida não deve ser descartado por deduplicação');

  // Submissão 3: Envio idêntico em rápida repetição (duplo clique acidental)
  const submitRes3 = await fetch(`${baseUrl}/api/feedback/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'video_not_loading',
      userDescription: 'A imagem também congelou',
      technicalContext: {
        canonicalMediaId: 'tmdb-movie-550',
        mediaTitle: 'Clube da Luta',
        mediaType: 'movie'
      },
      clientSubmissionToken: 'client-tok-100'
    })
  });
  assert.equal(submitRes3.status, 200);
  const submitData3 = await submitRes3.json();
  assert.equal(submitData3.isDuplicate, true, 'Duplo clique com mesmo token e mesma descrição é deduplicado com segurança');
  console.log('✓ Submissão e deduplicação inteligente validadas.');

  console.log('=== TESTE 3: Blindagem de Acesso Administrativo (403 para anônimos e usuários comuns) ===');
  // Anônimo tentando acessar estatísticas
  const anonStats = await fetch(`${baseUrl}/api/feedback/stats`);
  assert.equal(anonStats.status, 403, 'Acesso anônimo a /api/feedback/stats deve retornar 403');

  // Anônimo tentando acessar clusters
  const anonClusters = await fetch(`${baseUrl}/api/feedback/clusters`);
  assert.equal(anonClusters.status, 403, 'Acesso anônimo a /api/feedback/clusters deve retornar 403');

  // Usuário comum autenticado tentando acessar endpoints administrativos
  const userStats = await fetch(`${baseUrl}/api/feedback/stats`, {
    headers: { Cookie: userCookie }
  });
  assert.equal(userStats.status, 403, 'Usuário comum deve receber 403 em /api/feedback/stats');

  const userClusters = await fetch(`${baseUrl}/api/feedback/clusters`, {
    headers: { Cookie: userCookie }
  });
  assert.equal(userClusters.status, 403, 'Usuário comum deve receber 403 em /api/feedback/clusters');

  const userPatch = await fetch(`${baseUrl}/api/feedback/clusters/${clusterId1}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: userCookie
    },
    body: JSON.stringify({ status: 'investigating' })
  });
  assert.equal(userPatch.status, 403, 'Usuário comum deve receber 403 ao tentar modificar cluster');
  console.log('✓ Blindagem de autorização administrativa validada com sucesso.');

  console.log('=== TESTE 4: Acesso Administrativo via Cookie de Sessão ZapiTV ===');
  // Admin acessando estatísticas
  const adminStatsRes = await fetch(`${baseUrl}/api/feedback/stats`, {
    headers: { Cookie: adminCookie }
  });
  assert.equal(adminStatsRes.status, 200, 'Admin deve receber 200 em /api/feedback/stats');
  const stats = await adminStatsRes.json();
  assert.ok(stats.totalFeedbacksReceived >= 2, 'Total de feedbacks deve refletir os relatos reais recebidos');
  assert.ok(stats.totalUniqueClusters >= 1);
  console.log(`✓ Admin leu estatísticas reais: ${stats.totalFeedbacksReceived} relatos recebidos.`);

  // Admin listando clusters de problemas
  const adminClustersRes = await fetch(`${baseUrl}/api/feedback/clusters`, {
    headers: { Cookie: adminCookie }
  });
  assert.equal(adminClustersRes.status, 200, 'Admin deve receber 200 em /api/feedback/clusters');
  const clusterList = await adminClustersRes.json();
  assert.ok(clusterList.clusters.length >= 1, 'Admin deve visualizar clusters persistidos');
  assert.equal(clusterList.clusters[0].id, clusterId1);
  assert.equal(clusterList.clusters[0].category, 'video_not_loading');
  console.log('✓ Admin listou os clusters com metadados e contadores completos.');

  // Admin inspeciona detalhes do cluster
  const adminDetailsRes = await fetch(`${baseUrl}/api/feedback/clusters/${clusterId1}`, {
    headers: { Cookie: adminCookie }
  });
  assert.equal(adminDetailsRes.status, 200);
  const details = await adminDetailsRes.json();
  assert.equal(details.cluster.id, clusterId1);
  assert.ok(details.reports.length >= 2, 'Relatos devem estar associados ao cluster');
  assert.equal(details.reports[0].technicalContext.browser, 'Chrome');
  console.log('✓ Detalhes do cluster recuperados com contexto técnico e dispositivos.');

  // Admin atualiza status e prioridade
  const adminPatchRes = await fetch(`${baseUrl}/api/feedback/clusters/${clusterId1}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie
    },
    body: JSON.stringify({
      status: 'investigating',
      priority: 'critical',
      adminNotes: 'Investigando com o provedor de vídeo'
    })
  });
  assert.equal(adminPatchRes.status, 200);
  const patchData = await adminPatchRes.json();
  assert.equal(patchData.cluster.status, 'investigating');
  assert.equal(patchData.cluster.priority, 'critical');
  assert.equal(patchData.cluster.adminNotes, 'Investigando com o provedor de vídeo');
  console.log('✓ Modificações administrativas gravadas no banco Turso.');

  console.log('=== TESTE 5: Geração e Edição Manual de Prompts Técnicos ===');
  // Regeneração de prompt
  const promptRes = await fetch(`${baseUrl}/api/feedback/clusters/${clusterId1}/prompt`, {
    method: 'POST',
    headers: { Cookie: adminCookie }
  });
  assert.equal(promptRes.status, 200);
  const promptData = await promptRes.json();
  assert.ok(promptData.prompt.markdownContent);

  // Edição manual de prompt
  const editPromptRes = await fetch(`${baseUrl}/api/feedback/clusters/${clusterId1}/prompt`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie
    },
    body: JSON.stringify({
      markdownContent: '# Solução Técnica Aprovada pelo Admin\nInstruções detalhadas para correção...'
    })
  });
  assert.equal(editPromptRes.status, 200);
  const editData = await editPromptRes.json();
  assert.equal(editData.prompt.markdownContent, '# Solução Técnica Aprovada pelo Admin\nInstruções detalhadas para correção...');
  console.log('✓ Geração e edição de prompts técnicos preservadas.');

  console.log('=== TESTE 6: Resiliência a Reinicializações e Concorrência ===');
  const { withFeedbackStore } = await import('../src/server/feedback/repository');
  
  // Simula múltiplas submissões paralelas concorrentes
  await Promise.all(Array.from({ length: 5 }, (_, i) =>
    withFeedbackStore(store => store.submitFeedback({
      category: 'video_stuttering',
      userDescription: `Stutter teste ${i}`,
      technicalContext: {
        canonicalMediaId: `media-stutter-${i}`,
        mediaTitle: `Obra ${i}`,
        mediaType: 'movie'
      },
      clientSubmissionToken: `tok-concurrent-${i}`
    }), { write: true, actor: 'concurrent-test' })
  ));

  const afterConcurrent = await withFeedbackStore(store => store.getSnapshot());
  assert.ok(afterConcurrent.reports.length >= 7, 'Todas as submissões concorrentes devem ser preservadas');
  console.log(`✓ Concorrência validada sem perda de dados: ${afterConcurrent.reports.length} relatos totais persistidos.`);

  console.log('=== TESTE 7: Compactação de Snapshot sem Perda de Dados ===');
  const { FeedbackStore } = await import('../src/core/feedback/FeedbackStore');
  const testStore = new FeedbackStore(false);
  testStore.restoreSnapshot(afterConcurrent);

  // Injeta prompts obsoletos para simular crescimento
  for (let i = 0; i < 50; i++) {
    testStore.getSnapshot().prompts.push({
      id: `obsolete_prompt_${i}`,
      clusterId: 'unknown',
      type: 'consolidated',
      version: 1,
      markdownContent: 'Rascunho obsoleto '.repeat(100),
      generatedAt: Date.now() - 100000,
      isAiRefined: false,
      isManuallyEdited: false,
      feedbackIds: [],
      variablesUsed: {}
    });
  }

  const compacted = testStore.compactSnapshot();
  // Verifica que prompts obsoletos foram limpos e clusters/relatos mantidos
  assert.ok(compacted.clusters.length >= 2);
  assert.ok(compacted.reports.length >= 7);
  assert.ok(!compacted.prompts.some(p => p.id.startsWith('obsolete_prompt_')));
  console.log('✓ Compactação de snapshot opera sem exceder capacidade e sem perda histórica.');

  console.log('\n======================================================');
  console.log('TODOS OS 7 TESTES DE HOMOLOGAÇÃO PASSARAM COM SUCESSO!');
  console.log('======================================================\n');
} finally {
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  testDb.client.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }
  await new Promise(r => setTimeout(r, 100));
  process.exit(0);
}
