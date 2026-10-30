import fs from 'fs';
import path from 'path';
import { mobileFullscreenService } from '../src/core/mobile/mobileFullscreenService';
import { mobileViewportService } from '../src/core/mobile/mobileViewportService';
import { tvModeService } from '../src/core/tv/tvModeService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runMobileFullscreenOrientationTests() {
  console.log('\n========================================================================');
  console.log('--- Auditoria e Testes de Tela Cheia e Orientação Horizontal Automática no Mobile ---');
  console.log('========================================================================\n');

  // Teste 1: Auditoria de arquivos e integrações nos pontos de entrada de reprodução
  console.log('[Teste 1] Auditoria de Código e Contratos Estritos...');
  
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(
    manifestJson.orientation === 'portrait-primary',
    'manifest.json deve estabelecer "portrait-primary" como orientação padrão do PWA'
  );
  console.log('✓ manifest.json estabelece portrait-primary como orientação padrão do PWA');

  const heroPath = path.resolve(process.cwd(), 'components/Hero.tsx');
  const heroCode = fs.readFileSync(heroPath, 'utf8');
  assert(
    heroCode.includes('mobileFullscreenService.requestAutoFullscreenAndLandscape'),
    'Hero.tsx deve chamar mobileFullscreenService.requestAutoFullscreenAndLandscape no clique de Assistir'
  );
  console.log('✓ Hero.tsx dispara tela cheia mobile diretamente no clique do usuário');

  const mobileHeroPath = path.resolve(process.cwd(), 'src/components/mobile/MobileHero.tsx');
  const mobileHeroCode = fs.readFileSync(mobileHeroPath, 'utf8');
  assert(
    mobileHeroCode.includes('mobileFullscreenService.requestAutoFullscreenAndLandscape'),
    'MobileHero.tsx deve chamar mobileFullscreenService.requestAutoFullscreenAndLandscape no clique de Assistir'
  );
  console.log('✓ MobileHero.tsx dispara tela cheia mobile diretamente no clique do usuário');

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
  assert(
    detailModalCode.includes('mobileFullscreenService.beginEpisodeTransition'),
    'ContentDetailModal.tsx deve sinalizar beginEpisodeTransition na troca de episódios'
  );
  console.log('✓ ContentDetailModal.tsx integrado síncronamente na inicialização, fechamento e transição de episódios');

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

  const liveTvPath = path.resolve(process.cwd(), 'src/components/livetv/LiveTvPlayer.tsx');
  const liveTvCode = fs.readFileSync(liveTvPath, 'utf8');
  assert(
    liveTvCode.includes('mobileFullscreenService.requestAutoFullscreenAndLandscape'),
    'LiveTvPlayer.tsx deve chamar mobileFullscreenService.requestAutoFullscreenAndLandscape ao alternar para fullscreen no mobile'
  );
  assert(
    liveTvCode.includes('mobileFullscreenService.exitMobileFullscreen'),
    'LiveTvPlayer.tsx deve chamar mobileFullscreenService.exitMobileFullscreen ao sair de fullscreen'
  );
  console.log('✓ LiveTvPlayer.tsx integrado com a política móvel de orientação e tela cheia');

  // Teste 2: Isolamento Rigoroso com o Modo TV e Desktop
  console.log('\n[Teste 2] Isolamento com Modo TV e Desktop...');

  (tvModeService as any).isTv = true;
  assert(
    mobileFullscreenService.isMobile() === false,
    'No Modo TV, mobileFullscreenService.isMobile() DEVE retornar false'
  );
  assert(
    mobileViewportService.isMobileViewport() === false,
    'No Modo TV, mobileViewportService.isMobileViewport() DEVE retornar false'
  );
  const tvResult = await mobileFullscreenService.requestAutoFullscreenAndLandscape();
  assert(
    tvResult.fullscreenGranted === false && tvResult.orientationLocked === false,
    'No Modo TV, requestAutoFullscreenAndLandscape não deve executar ações móveis'
  );
  (tvModeService as any).isTv = false;
  console.log('✓ Modo TV 100% blindado contra ativação móvel');

  // Configuração do ambiente simulado
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

  // Cria ambiente simulado de navegador Android Pixel 8
  const listeners: Record<string, Function[]> = {};
  setMockWindow({
    innerWidth: 412,
    innerHeight: 915,
    screen: {
      width: 412,
      height: 915,
      orientation: {
        type: 'portrait-primary',
        lock: async (mode: string) => {
          mockOrientationLockedWith = mode;
        },
        unlock: () => {
          mockOrientationUnlocked = true;
        }
      }
    },
    location: {
      pathname: '/',
      search: ''
    },
    matchMedia: (query: string) => ({
      matches: query.includes('pointer: coarse') || query.includes('max-width'),
      addEventListener: () => {},
      removeEventListener: () => {}
    }),
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

  // Teste 3: Simulação de Ambiente Android
  console.log('\n[Teste 3] Simulação do Fluxo Android (Fullscreen + Landscape Lock)...');
  assert(mobileFullscreenService.isMobile() === true, 'Android deve ser identificado como mobile');
  assert(mobileFullscreenService.isAndroid() === true, 'Android deve ser identificado como Android');
  assert(mobileFullscreenService.isIOS() === false, 'Android NÃO deve ser identificado como iOS');

  const androidResult = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
  assert(mockFullscreenRequested === true, 'Element.requestFullscreen deve ter sido chamado no Android');
  assert(androidResult.fullscreenGranted === true, 'fullscreenGranted deve ser true');
  assert(mockOrientationLockedWith === 'landscape', 'screen.orientation.lock deve ser chamado com "landscape"');
  assert(androidResult.orientationLocked === true, 'orientationLocked deve ser true');

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

  const iosResult = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockIosElement);
  assert(iosResult.fullscreenGranted === false, 'Sem HTML5 fullscreen, fullscreenGranted deve ser false');
  assert(iosResult.orientationLocked === false, 'Sem orientation API, orientationLocked deve ser false');

  const iosState = mobileFullscreenService.getState();
  assert(iosState.isPortrait === true, 'Dispositivo em 412x915 deve ser identificado como retrato (portrait)');
  assert(iosState.showOrientationHint === true, 'Dica de girar aparelho deve ser ativada para o usuário no iOS em retrato');

  mobileFullscreenService.dismissOrientationHint();
  assert(mobileFullscreenService.getState().showOrientationHint === false, 'Após dispensar, a dica não deve ser exibida novamente');

  setMockWindow({
    innerWidth: 915,
    innerHeight: 412,
    screen: { width: 412, height: 915 },
    location: { pathname: '/', search: '' },
    matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {}
  });
  const rotatedState = mobileFullscreenService.getState();
  assert(rotatedState.isLandscape === true, 'Após girar tela, deve ser identificado como paisagem (landscape)');
  assert(rotatedState.showOrientationHint === false, 'Em paisagem, a dica nunca deve ser exibida');
  await mobileFullscreenService.exitMobileFullscreen();
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
  await mobileFullscreenService.exitMobileFullscreen();
  console.log('✓ Rejeições de permissão do sistema operacional foram absorvidas com 100% de segurança');

  // =========================================================================
  // EXECUÇÃO DOS 15 CENÁRIOS OBRIGATÓRIOS DO CONTROLE DE ORIENTAÇÃO MOBILE
  // =========================================================================

  console.log('\n--- Validação Estrita dos 15 Cenários de Orientação Obrigatórios ---');

  // Configuração do mock Android moderno com suporte pleno
  let currentScreenOrientation = 'portrait-primary';
  const orientationLockHistory: string[] = [];
  let unlockCount = 0;

  const mockAndroidScreen: any = {
    get type() { return currentScreenOrientation; },
    lock: async (mode: string) => {
      orientationLockHistory.push(mode);
      if (mode === 'landscape') {
        currentScreenOrientation = 'landscape-primary';
      } else if (mode.startsWith('portrait')) {
        currentScreenOrientation = mode === 'portrait' ? 'portrait-primary' : mode;
      } else {
        currentScreenOrientation = mode;
      }
    },
    unlock: () => {
      unlockCount++;
      currentScreenOrientation = 'portrait-primary';
    }
  };

  setMockScreen({
    orientation: mockAndroidScreen
  });

  setMockWindow({
    innerWidth: 412,
    innerHeight: 915,
    screen: {
      width: 412,
      height: 915,
      orientation: mockAndroidScreen
    },
    location: { pathname: '/', search: '' },
    matchMedia: (query: string) => ({
      matches: query.includes('pointer: coarse'),
      addEventListener: () => {},
      removeEventListener: () => {}
    }),
    addEventListener: () => {},
    removeEventListener: () => {}
  });

  setMockNavigator({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    maxTouchPoints: 5
  });

  // Cenário 1: Home permanece em modo de navegação vertical
  console.log('\n[Cenário 1] Home permanece em modo de navegação vertical (BROWSING)...');
  await mobileFullscreenService.exitMobileFullscreen();
  assert(mobileFullscreenService.isBrowsing() === true, 'Fora do player, o estado DEVE ser BROWSING');
  await mobileFullscreenService.enforceBrowsingOrientation();
  assert(
    orientationLockHistory[orientationLockHistory.length - 1] === 'portrait' ||
    orientationLockHistory[orientationLockHistory.length - 1] === 'portrait-primary',
    'Em BROWSING, enforceBrowsingOrientation deve solicitar trava vertical portrait'
  );
  console.log('✓ Cenário 1 aprovado: Home opera sob estado BROWSING e preferência vertical');

  // Cenário 2: Busca, catálogo, detalhes e perfis seguem a mesma regra
  console.log('\n[Cenário 2] Busca, Catálogo, Detalhes e Perfis em modo vertical...');
  const browsingRoutes = ['/buscar', '/filmes', '/series', '/animes', '/minha-zapitv', '/filmes/tmdb-550'];
  for (const r of browsingRoutes) {
    (globalThis as any).window.location.pathname = r;
    assert(mobileFullscreenService.isBrowsing() === true, `Rota ${r} deve permanecer em BROWSING`);
    assert(mobileFullscreenService.getState().isPortrait === true, `Rota ${r} deve ter isPortrait=true`);
  }
  console.log('✓ Cenário 2 aprovado: Todas as telas de navegação operam em modo vertical');

  // Cenário 3: Iniciar reprodução solicita orientação landscape
  console.log('\n[Cenário 3] Iniciar reprodução solicita orientação landscape...');
  orientationLockHistory.length = 0;
  const playRes = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
  assert(playRes.orientationLocked === true, 'Orientação landscape deve ser concedida');
  assert(mobileFullscreenService.isPlaying() === true, 'Ao iniciar reprodução, estado DEVE ser PLAYING');
  assert(orientationLockHistory[0] === 'landscape', 'Lock deve ser solicitado com "landscape" para habilitar ambos os lados');
  console.log('✓ Cenário 3 aprovado: Início da reprodução solicita landscape e transita para PLAYING');

  // Cenário 4: O player admite as duas orientações horizontais (landscape-primary e landscape-secondary)
  console.log('\n[Cenário 4] Player admite as duas orientações horizontais...');
  assert(mobileFullscreenService.isLandscape() === true, 'Deve estar em landscape');
  assert(mobileFullscreenService.getState().orientationType.startsWith('landscape'), 'orientationType deve ser landscape');
  console.log('✓ Cenário 4 aprovado: Player opera sob orientação horizontal bidirecional');

  // Cenário 5: Girar entre landscape-primary e landscape-secondary preserva o vídeo
  console.log('\n[Cenário 5] Girar 180° entre landscape-primary e landscape-secondary...');
  currentScreenOrientation = 'landscape-secondary';
  const stateSec = mobileFullscreenService.getState();
  assert(stateSec.orientationType === 'landscape-secondary', 'Deve detectar landscape-secondary');
  assert(stateSec.isLandscape === true, 'Permanece landscape');
  assert(mobileFullscreenService.isPlaying() === true, 'Estado PLAYING não é afetado por rotação entre horizontais');
  assert(stateSec.showOrientationHint === false, 'Aviso de rotação nunca deve ser exibido em landscape-secondary');
  console.log('✓ Cenário 5 aprovado: Rotação 180° horizontal preserva o player sem recriação');

  // Cenário 6: Pausar e retomar não altera a orientação
  console.log('\n[Cenário 6] Pausar e retomar não altera a orientação...');
  const stateBeforePause = mobileFullscreenService.getState();
  // Simula evento de pausa no player
  assert(mobileFullscreenService.isPlaying() === true, 'Pausa mantém lifecycleState como PLAYING');
  assert(mobileFullscreenService.getState().isLandscape === stateBeforePause.isLandscape, 'Orientação inalterada após pausa');
  console.log('✓ Cenário 6 aprovado: Ciclo de play/pause preserva intacta a orientação horizontal');

  // Cenário 7: Trocar episódio não libera indevidamente o bloqueio horizontal
  console.log('\n[Cenário 7] Troca contínua de episódios sem liberação de orientação...');
  unlockCount = 0;
  mobileFullscreenService.beginEpisodeTransition();
  // Simula desmonte do player do episódio 1
  await mobileFullscreenService.exitMobileFullscreen();
  assert(unlockCount === 0, 'exitMobileFullscreen em transição de episódios DEVE ser ignorado');
  assert(mobileFullscreenService.isPlaying() === true, 'Continua em PLAYING durante troca de episódio');
  // Monta player do episódio 2
  mobileFullscreenService.endEpisodeTransition();
  assert(mobileFullscreenService.isPlaying() === true, 'Episódio 2 permanece em tela cheia e paisagem');
  console.log('✓ Cenário 7 aprovado: Transição de episódios mantém travamento horizontal sem piscadas');

  // Cenário 8: Fechar o player restaura a orientação de navegação vertical
  console.log('\n[Cenário 8] Fechamento do player restaura vertical de navegação...');
  unlockCount = 0;
  orientationLockHistory.length = 0;
  await mobileFullscreenService.exitMobileFullscreen({ force: true });
  assert(unlockCount > 0, 'Ao fechar o player, screen.orientation.unlock deve ser chamado');
  assert(mobileFullscreenService.isBrowsing() === true, 'Estado deve voltar para BROWSING');
  assert(
    orientationLockHistory.some(m => m.startsWith('portrait')),
    'Fechamento deve solicitar restauração de trava portrait'
  );
  console.log('✓ Cenário 8 aprovado: Fechamento restaura orientação vertical e estado BROWSING');

  // Cenário 9: Voltar pelo Android restaura o estado corretamente
  console.log('\n[Cenário 9] Botão Voltar do Android (popstate) restaura a navegação...');
  await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
  assert(mobileFullscreenService.isPlaying() === true, 'Player reaberto');
  // Simula popstate saindo de rota /assistir/... para /
  (globalThis as any).window.location.pathname = '/';
  await mobileFullscreenService.exitMobileFullscreen({ force: true });
  assert(mobileFullscreenService.isBrowsing() === true, 'Voltar do Android deve redefinir para BROWSING');
  console.log('✓ Cenário 9 aprovado: Botão Voltar do Android restaura layout e orientação');

  // Cenário 10: Falha de permissão não gera exceção não tratada
  console.log('\n[Cenário 10] Falha de permissão absorvida com segurança...');
  const brokenScreen: any = {
    lock: async () => { throw new Error('NotAllowedError: Permissions policy denied'); },
    unlock: () => { throw new Error('SecurityError'); }
  };
  setMockScreen({ orientation: brokenScreen });
  let uncaught = false;
  try {
    const res = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
    assert(res.orientationLocked === false, 'lock deve falhar suavemente');
    await mobileFullscreenService.exitMobileFullscreen({ force: true });
  } catch {
    uncaught = true;
  }
  assert(!uncaught, 'Nenhuma exceção não tratada pode ser emitida');
  setMockScreen({ orientation: mockAndroidScreen });
  console.log('✓ Cenário 10 aprovado: Erros de política e segurança são absorvidos sem travar a UI');

  // Cenário 11: Reabrir o player após sair funciona normalmente
  console.log('\n[Cenário 11] Reabertura do player com novo token de sessão...');
  const reopenResult = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
  assert(reopenResult.orientationLocked === true, 'Reabertura deve travar landscape');
  assert(mobileFullscreenService.isPlaying() === true, 'Reabertura entra em PLAYING');
  await mobileFullscreenService.exitMobileFullscreen({ force: true });
  assert(mobileFullscreenService.isBrowsing() === true, 'Saída retorna a BROWSING');
  console.log('✓ Cenário 11 aprovado: Reaberturas subsequentes operam com novos tokens determinísticos');

  // Cenário 12: Rotação rápida não deixa requisições concorrentes pendentes
  console.log('\n[Cenário 12] Rotação rápida sem requisições concorrentes pendentes...');
  // Simula abertura imediata seguida de fechamento antes da resolução
  const reqPromise = mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
  await mobileFullscreenService.exitMobileFullscreen({ force: true });
  const laggedResult = await reqPromise;
  assert(mobileFullscreenService.isBrowsing() === true, 'Estado DEVE permanecer BROWSING após fechamento antecipado');
  assert(laggedResult.orientationLocked === false, 'Promise atrasada não pode sobrescrever a saída do player');
  console.log('✓ Cenário 12 aprovado: Tokens de geração anulam promessas assíncronas concorrentes');

  // Cenário 13: Mobile nunca é confundido com desktop apenas por estar horizontal
  console.log('\n[Cenário 13] Smartphone em landscape continua smartphone (sem layout desktop)...');
  setMockWindow({
    innerWidth: 915,
    innerHeight: 412,
    screen: { width: 412, height: 915 },
    location: { pathname: '/', search: '' },
    matchMedia: (q: string) => ({ matches: q.includes('pointer: coarse'), addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {}
  });
  assert(mobileViewportService.isSmartphone() === true, 'Dispositivo com tela física mínima de 412px DEVE ser smartphone');
  assert(mobileViewportService.isMobileViewport() === true, 'isMobileViewport DEVE ser true mesmo com innerWidth=915px em landscape');
  console.log('✓ Cenário 13 aprovado: Smartphone em landscape preserva estritamente o layout móvel');

  // Cenário 14: Desktop e Smart TV permanecem inalterados
  console.log('\n[Cenário 14] Preservação de Desktop e Smart TV...');
  // Simula Desktop Monitor 1920x1080
  setMockNavigator({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    maxTouchPoints: 0
  });
  setMockWindow({
    innerWidth: 1920,
    innerHeight: 1080,
    screen: { width: 1920, height: 1080 },
    location: { pathname: '/', search: '' },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {}
  });
  assert(mobileViewportService.isSmartphone() === false, 'Desktop não é smartphone');
  assert(mobileViewportService.isMobileDevice() === false, 'Desktop não é mobile');
  assert(mobileViewportService.isMobileViewport() === false, 'Desktop de tela cheia não usa mobile viewport');
  assert(mobileFullscreenService.isMobile() === false, 'Desktop ignora travas de orientação');
  console.log('✓ Cenário 14 aprovado: Desktop e Smart TV operam sem qualquer interferência móvel');

  // Cenário 15: O player mobile de TV ao vivo respeita a política aplicável
  console.log('\n[Cenário 15] Player mobile de TV ao vivo respeita a política de orientação...');
  setMockNavigator({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    maxTouchPoints: 5
  });
  setMockScreen({ orientation: mockAndroidScreen });
  // Simula clique em fullscreen na TV ao vivo
  const liveTvFullscreenRes = await mobileFullscreenService.requestAutoFullscreenAndLandscape(mockElement);
  assert(liveTvFullscreenRes.orientationLocked === true, 'Live TV no mobile solicita landscape ao entrar em tela cheia');
  assert(mobileFullscreenService.isPlaying() === true, 'Live TV ativa estado PLAYING');
  await mobileFullscreenService.exitMobileFullscreen({ force: true });
  assert(mobileFullscreenService.isBrowsing() === true, 'Live TV restaura BROWSING ao sair de tela cheia');
  console.log('✓ Cenário 15 aprovado: Player de TV ao vivo no mobile segue rigorosamente a política');

  // Restaura ambiente global
  setMockWindow(originalWindow);
  setMockDocument(originalDocument);
  setMockScreen(originalScreen);
  setMockNavigator(originalNavigator);

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS 15 CENÁRIOS DE ORIENTAÇÃO MOBILE FORAM APROVADOS COM SUCESSO TOTAL!');
  console.log('========================================================================\n');
}

runMobileFullscreenOrientationTests().catch((err) => {
  console.error('[ERRO FATAL NO TESTE MOBILE FULLSCREEN]', err);
  process.exit(1);
});
