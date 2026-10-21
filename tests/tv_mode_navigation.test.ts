import { tvModeService } from '../src/core/tv/tvModeService';
import { tvNavigationManager } from '../src/core/tv/tvNavigationManager';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runTvModeNavigationTests() {
  console.log('\n--- Início dos Testes de Modo TV e Navegação Espacial ---');

  // Teste 1: Preservação de rota com ?tv=1
  tvModeService.setTvMode(true);
  assert(tvModeService.isTvMode() === true, 'Modo TV deve estar ativo após setTvMode(true)');

  const formattedHome = tvModeService.formatInternalRoute('/');
  assert(formattedHome === '/?tv=1', `formatInternalRoute('/') esperado '/?tv=1', obtido: '${formattedHome}'`);

  const formattedMovies = tvModeService.formatInternalRoute('/filmes');
  assert(formattedMovies === '/filmes?tv=1', `formatInternalRoute('/filmes') esperado '/filmes?tv=1', obtido: '${formattedMovies}'`);

  const formattedWithParam = tvModeService.formatInternalRoute('/series?genre=action');
  assert(formattedWithParam.includes('tv=1') && formattedWithParam.includes('genre=action'),
    `formatInternalRoute com query existente deve manter ambos os parâmetros. Obtido: '${formattedWithParam}'`);

  console.log('✓ Teste 1: Preservação de ?tv=1 em rotas internas OK');

  // Teste 2: Desativação do Modo TV não afeta rotas
  tvModeService.setTvMode(false);
  assert(tvModeService.isTvMode() === false, 'Modo TV deve estar desativado');
  const normalRoute = tvModeService.formatInternalRoute('/filmes');
  assert(normalRoute === '/filmes', `Em modo normal a rota não deve ter tv=1. Obtido: '${normalRoute}'`);
  console.log('✓ Teste 2: Desativação explícita do Modo TV OK');

  // Reativa para testes de navegação
  tvModeService.setTvMode(true);

  // Teste 3: Pilha de Voltar (Back-Stack) com Prioridades
  let playerBackTriggered = false;
  let modalBackTriggered = false;
  let rootBackTriggered = false;

  const unregRoot = tvNavigationManager.registerBackHandler('test-root', 10, () => {
    rootBackTriggered = true;
    return true;
  });

  const unregModal = tvNavigationManager.registerBackHandler('test-modal', 100, () => {
    modalBackTriggered = true;
    return true;
  });

  const unregPlayer = tvNavigationManager.registerBackHandler('test-player', 200, () => {
    playerBackTriggered = true;
    return true;
  });

  // 1º Voltar: Deve disparar o Player (prioridade 200) e parar aí
  const handled1 = tvNavigationManager.dispatchBack();
  assert(handled1 === true, 'dispatchBack deve retornar true quando tratado');
  assert(playerBackTriggered === true, 'Player deve ser tratado primeiro');
  assert(modalBackTriggered === false, 'Modal não deve ser tratado enquanto Player estiver no topo');
  assert(rootBackTriggered === false, 'Root não deve ser tratado enquanto Player estiver no topo');

  // Desregistra o player (simulando fechamento do player)
  unregPlayer();

  // 2º Voltar: Deve disparar o Modal (prioridade 100)
  const handled2 = tvNavigationManager.dispatchBack();
  assert(handled2 === true, 'dispatchBack deve retornar true');
  assert(modalBackTriggered === true, 'Modal deve ser tratado quando Player não estiver presente');
  assert(rootBackTriggered === false, 'Root ainda não deve ser tratado');

  // Desregistra o modal (simulando fechamento do modal)
  unregModal();

  // 3º Voltar: Deve disparar o Root (prioridade 10)
  const handled3 = tvNavigationManager.dispatchBack();
  assert(handled3 === true, 'dispatchBack deve retornar true');
  assert(rootBackTriggered === true, 'Root deve ser tratado quando não houver modal');

  unregRoot();

  // 4º Voltar com pilha vazia: Deve retornar false para permitir evento nativo da TV/MSX
  const handled4 = tvNavigationManager.dispatchBack();
  assert(handled4 === false, 'dispatchBack com pilha vazia deve retornar false para não prender o usuário na TV');
  console.log('✓ Teste 3: Hierarquia de prioridade do botão Voltar (Player > Modal > Root > TV nativo) OK');

  // Teste 4: Snapshot e restauração de foco pré-modal
  tvNavigationManager.saveFocusSnapshot();
  // Não quebra nem lança erro ao restaurar mesmo sem DOM ativo
  tvNavigationManager.restoreFocusSnapshot('card-teste');
  console.log('✓ Teste 4: Snapshot de foco pré-modal OK');

  console.log('\nTodos os testes de Modo TV e Navegação Espacial passaram com sucesso!\n');
}

runTvModeNavigationTests().catch(err => {
  console.error('\n❌ Falha nos testes de Modo TV:', err);
  process.exit(1);
});
