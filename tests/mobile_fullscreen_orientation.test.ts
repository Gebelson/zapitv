import fs from 'fs';
import path from 'path';
import { mobileFullscreenService } from '../src/core/mobile/mobileFullscreenService';
import { tvModeService } from '../src/core/tv/tvModeService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runMobileFullscreenOrientationTests() {
  console.log('\n--- Auditoria e Testes de Tela Cheia e Orientação Horizontal Automática no Mobile ---');

  // Teste 1: Auditoria de arquivos e integrações nos pontos de entrada de reprodução
  console.log('\n[Teste 1] Auditoria de Código e Contratos Estritos...');
  
  const heroPath = path.resolve(process.cwd(), 'components/Hero.tsx');
  const heroCode = fs.readFileSync(heroPath, 'utf8');
  assert(
    heroCode.includes('mobileFullscreenService.requestAutoFullscreenAndLandscape'),
    'Hero.tsx deve chamar mobileFullscreenService.requestAutoFullscreenAndLandscape no clique de Assistir'
  );
  console.log('✓ Hero.tsx dispara tela cheia mobile diretamente no clique do usuário');

  const detailModalPath = path.resolve(process.cwd(), 'components/ContentDetailModal.tsx');
  const detailModalCode = fs.readFileSync(detailModalPath, 'utf8');
  assert(
    detailModalCode.includes('mobileFullscreenService.requestAutoFullscreenAndLandscape'),
    'ContentDetailModal.tsx deve solicitar fullscreen e orientação landscape de forma síncrona no início da reprodução'
  );
  assert(
    detailModalCode.includes('mobileFullscreenService.exitMobileFullscreen'),
    'ContentDetailModal.tsx deve chamar exitMobileFullscreen ao fechar o player'
  );
  console.log('✓ ContentDetailModal.tsx integrado síncronamente na inicialização e fechamento');

  const playerPath = path.resolve(process.cwd(), 'src/components/player/ZapiPlayer.tsx');
  const playerCode = fs.readFileSync(playerPath, 'utf8');
  assert(
    playerCode.includes('mobileFullscreenService.subscribe'),
    'ZapiPlayer.tsx deve assinar as mudanças de estado do mobileFullscreenService'
  );
  assert(
    playerCode.includes('mobileFullscreenService.exitMobileFullscreen'),
    'ZapiPlayer.tsx deve encerrar tela cheia e liberar orientação ao fechar ou desmontar'
  );
  assert(
    playerCode.includes('showOrientationHint'),
    'ZapiPlayer.tsx deve renderizar o aviso discreto de orientação para aparelhos em formato retrato'
  );
  assert(
    playerCode.includes('safe-area-inset-left') && playerCode.includes('safe-area-inset-right'),
    'ZapiPlayer.tsx deve incluir margens seguras (safe-area-inset) para evitar sobreposição em entalhes e ilhas dinâmicas'
  );
  assert(
    playerCode.includes('webkitEnterFullscreen'),
    'ZapiPlayer.tsx deve suportar webkitEnterFullscreen como fallback para iOS Safari ao alternar tela cheia'
  );
  console.log('✓ ZapiPlayer.tsx possui integração completa com mobileFullscreenService e safe-area insets');

  const skipBtnPath = path.resolve(process.cwd(), 'src/components/player/ZapiSkipButton.tsx');
  const skipBtnCode = fs.readFileSync(skipBtnPath, 'utf8');
  assert(
    skipBtnCode.includes('safe-area-inset-bottom') && skipBtnCode.includes('safe-area-inset-right'),
    'ZapiSkipButton.tsx deve respeitar safe-area-inset-bottom e safe-area-inset-right em dispositivos móveis'
  );
  console.log('✓ ZapiSkipButton.tsx preservado com suporte a entalhes e barras de navegação do sistema');

  // Teste 2: Isolamento Rigoroso com o Modo TV e Desktop
  console.log('\n[Teste 2] Isolamento com Modo TV e Desktop...');

  // Força Modo TV ativo e verifica se mobile é estritamente ignorado
  (tvModeService as any).isTv = true;
  assert(
    mobileFullscreenService.isMobile() === false,
    'No Modo TV, mobileFullscreenService.isMobile() DEVE retornar false'
  );
  const tvResult = await mobileFullscreenService.requestAutoFullscreenAndLandscape();
  assert(
    tvResult.fullscreenGranted === false && tvResult.orientationLocked === false,
    'No Modo TV, requestAutoFullscreenAndLandscape não deve executar ações móveis'
  );
  (tvModeService as any).isTv = false;
  console.log('✓ Modo TV 100% blindado contra ativação móvel');

  // Teste 3: Simulação de Ambiente Android
  console.log('\n[Teste 3] Simulação do Fluxo Android (Fullscreen + Landscape Lock)...');

  let mockFullscreenRequested = false;
  let mockOrientationLockedWith: string | null = null;
  let mockOrientationUnlocked = false;

  const mockElement: any = {
    requestFullscreen: async () => {
      mockFullscreenRequested = true;
    }
  };

  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalScreen = (globalThis as any).screen;
  const originalNavigator = (globalThis as any).navigator;

  const setMockNavigator = (nav: any) => {
    Object.defineProperty(globalThis, 'navigator', {
      value: nav,
      configurable: true,
      writable: true
    });
  };

  const setMockWindow = (win: any) => {
    Object.defineProperty(globalThis, 'window', {
      value: win,
      configurable: true,
      writable: true
    });
  };

  const setMockDocument = (doc: any) => {
    Object.defineProperty(globalThis, 'document', {
      value: doc,
      configurable: true,
      writable: true
    });
  };

  const setMockScreen = (scr: any) => {
    Object.defineProperty(globalThis, 'screen', {
      value: scr,
      configurable: true,
      writable: true
    });
  };

  // Cria ambiente simulado de navegador Android
  const listeners: Record<string, Function[]> = {};
  setMockWindow({
    innerWidth: 412,
    innerHeight: 915,
    location: {
      pathname: '/',
      search: ''
    },
    addEventListener: (event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: () => {}
  });

  setMockNavigator({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    maxTouchPoints: 5
  });

  setMockDocument({
    documentElement: mockElement,
    fullscreenElement: null,
    body: { style: { overflow: '' } },
    addEventListener: (event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: () => {}
  });

  setMockScreen({
    orientation: {
      type: 'portrait-primary',
      lock: async (mode: string) => {
        mockOrientationLockedWith = mode;
      },
      unlock: () => {
        mockOrientationUnlocked = true;
      }
    }
  });

  assert(mobileFullscreenService.isMobile() === true, 'Android deve ser identificado como mobile');
  assert(mobileFullscreenService.isAndroid() === true, 'Android deve ser identificado como Android');
  assert(mobileFullscreenService.isIOS() === false, 'Android NÃO deve ser identificado como iOS');

  // Executa solicitação imediata de tela cheia + landscape
  const androidResult = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
  assert(mockFullscreenRequested === true, 'Element.requestFullscreen deve ter sido chamado no Android');
  assert(androidResult.fullscreenGranted === true, 'fullscreenGranted deve ser true');
  assert(mockOrientationLockedWith === 'landscape', 'screen.orientation.lock deve ser chamado com "landscape"');
  assert(androidResult.orientationLocked === true, 'orientationLocked deve ser true');

  // Simula saída do fullscreen e verificação de liberação de orientação
  (global as any).document.fullscreenElement = mockElement;
  await mobileFullscreenService.exitMobileFullscreen();
  assert(mockOrientationUnlocked === true, 'Ao sair de fullscreen, screen.orientation.unlock deve ser chamado');
  console.log('✓ Fluxo Android executou tela cheia imediata e trava de orientação landscape');

  // Teste 4: Simulação de Ambiente iOS / Safari
  console.log('\n[Teste 4] Simulação do Fluxo iOS Safari (Graceful Fallback & Orientation Hint)...');

  setMockNavigator({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    maxTouchPoints: 5
  });

  // No iOS Safari comum, requestFullscreen no div e orientation.lock não são suportados
  const mockIosElement: any = {
    requestFullscreen: undefined,
    webkitRequestFullscreen: undefined
  };

  setMockScreen({
    orientation: undefined
  });

  assert(mobileFullscreenService.isMobile() === true, 'iPhone deve ser identificado como mobile');
  assert(mobileFullscreenService.isIOS() === true, 'iPhone deve ser identificado como iOS');
  assert(mobileFullscreenService.isAndroid() === false, 'iPhone NÃO deve ser identificado como Android');

  // Tenta solicitar tela cheia sem falhas ou exceções não tratadas
  const iosResult = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockIosElement);
  assert(iosResult.fullscreenGranted === false, 'Sem HTML5 fullscreen, fullscreenGranted deve ser false');
  assert(iosResult.orientationLocked === false, 'Sem orientation API, orientationLocked deve ser false');

  // Em modo retrato com player ativo, a dica de orientação deve ser exibida
  const iosState = mobileFullscreenService.getState();
  assert(iosState.isPortrait === true, 'Dispositivo em 412x915 deve ser identificado como retrato (portrait)');
  assert(iosState.showOrientationHint === true, 'Dica de girar aparelho deve ser ativada para o usuário no iOS em retrato');

  // Usuário dispensa a dica
  mobileFullscreenService.dismissOrientationHint();
  assert(mobileFullscreenService.getState().showOrientationHint === false, 'Após dispensar, a dica não deve ser exibida novamente');

  // Ao girar para paisagem (landscape)
  setMockWindow({
    innerWidth: 915,
    innerHeight: 412,
    location: {
      pathname: '/',
      search: ''
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  });
  const rotatedState = mobileFullscreenService.getState();
  assert(rotatedState.isLandscape === true, 'Após girar tela, deve ser identificado como paisagem (landscape)');
  assert(rotatedState.showOrientationHint === false, 'Em paisagem, a dica nunca deve ser exibida');
  console.log('✓ Fluxo iOS Safari operou com fallback suave, orientação responsiva e dica não intrusiva');

  // Teste 5: Tratamento de Falhas e Rejeições sem Interrupção da Reprodução
  console.log('\n[Teste 5] Resiliência a Rejeições de Permissão...');

  const rejectingElement: any = {
    requestFullscreen: async () => {
      const err = new Error('The play() request was interrupted by a call to pause().');
      err.name = 'NotAllowedError';
      throw err;
    }
  };

  setMockScreen({
    orientation: {
      type: 'portrait-primary',
      lock: async () => {
        const err = new Error('orientation lock not allowed');
        err.name = 'NotSupportedError';
        throw err;
      },
      unlock: () => {}
    }
  });

  let threwError = false;
  try {
    const res = await mobileFullscreenService.requestAutoFullscreenAndLandscape(rejectingElement);
    assert(res.fullscreenGranted === false, 'Quando o navegador rejeita tela cheia, deve retornar fullscreenGranted=false sem quebrar');
    assert(res.orientationLocked === false, 'Quando o navegador rejeita bloqueio, deve retornar orientationLocked=false sem quebrar');
  } catch (err) {
    threwError = true;
  }
  assert(!threwError, 'requestAutoFullscreenAndLandscape NUNCA deve propagar erro não tratado para interromper o player');
  console.log('✓ Rejeições de permissão do sistema operacional foram absorvidas com 100% de segurança');

  // Restaura ambiente global
  setMockWindow(originalWindow);
  setMockDocument(originalDocument);
  setMockScreen(originalScreen);
  setMockNavigator(originalNavigator);

  console.log('\n=== TODOS OS TESTES DE TELA CHEIA E ORIENTAÇÃO MOBILE PASSARAM COM SUCESSO! ===\n');
}

runMobileFullscreenOrientationTests().catch((err) => {
  console.error('[ERRO FATAL NO TESTE MOBILE FULLSCREEN]', err);
  process.exit(1);
});
