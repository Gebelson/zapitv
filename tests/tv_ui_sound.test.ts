import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { uiSoundService } from '../src/core/audio/uiSoundService';
import { tvNavigationManager } from '../src/core/tv/tvNavigationManager';

async function runTvUiSoundTests() {
  console.log('--- Auditoria e Testes de Sons de Interface na Smart TV (ZapiTV) ---');

  // Configuração de ambiente simulado
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear()
  };

  (globalThis as any).localStorage = mockStorage;

  const eventListeners: Record<string, ((...args: any[]) => void)[]> = {};
  const mockWindow = {
    addEventListener: (event: string, fn: any) => {
      eventListeners[event] = eventListeners[event] || [];
      eventListeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: any) => {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(l => l !== fn);
      }
    },
    location: { pathname: '/tv' },
    document: {
      addEventListener: (event: string, fn: any) => {
        eventListeners[event] = eventListeners[event] || [];
        eventListeners[event].push(fn);
      },
      removeEventListener: () => {}
    }
  };

  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockWindow.document;

  const mockContext = {
    state: 'running',
    currentTime: 10,
    resume: async () => {},
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        cancelScheduledValues: () => {}
      },
      connect: () => {}
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {}
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: { setValueAtTime: () => {} },
      Q: { setValueAtTime: () => {} },
      connect: () => {}
    }),
    destination: {}
  };

  class MockHTMLInputElement {}
  class MockHTMLTextAreaElement {}
  (globalThis as any).HTMLInputElement = MockHTMLInputElement;
  (globalThis as any).HTMLTextAreaElement = MockHTMLTextAreaElement;
  (globalThis as any).AudioContext = function AudioContext() {
    return mockContext;
  };
  mockWindow.AudioContext = (globalThis as any).AudioContext;
  (mockWindow as any).HTMLInputElement = MockHTMLInputElement;
  (mockWindow as any).HTMLTextAreaElement = MockHTMLTextAreaElement;

  let renderedSounds: string[] = [];
  const originalRender = (uiSoundService as any).render;
  (uiSoundService as any).render = function(type: string, options?: any) {
    renderedSounds.push(type);
  };

  try {
    // 1. Ativação padrão na Smart TV
    store.clear();
    uiSoundService.setTvMode(true);
    assert.strictEqual(uiSoundService.isTv(), true, 'uiSoundService deve estar em modo TV');
    const tvInitialPrefs = uiSoundService.getPreferences();
    assert.strictEqual(tvInitialPrefs.enabled, true, 'Sons de interface devem vir ativados por padrão na Smart TV');
    assert.strictEqual(tvInitialPrefs.volume, 24, 'Volume inicial da Smart TV deve ser de 24%');
    console.log('✓ Teste 1: Ativação por padrão na Smart TV (enabled: true, volume: 24%) OK');

    // 2. Isolamento estrito entre configurações do Desktop e da TV
    uiSoundService.setTvMode(false);
    assert.strictEqual(uiSoundService.isTv(), false, 'uiSoundService deve estar em modo Desktop');
    const desktopInitialPrefs = uiSoundService.getPreferences();
    assert.strictEqual(desktopInitialPrefs.enabled, false, 'Desktop deve permanecer desativado por padrão (enabled: false)');
    assert.strictEqual(desktopInitialPrefs.volume, 18, 'Desktop deve ter volume padrão de 18%');

    // Alterar preferência na TV não deve alterar o desktop
    uiSoundService.setTvMode(true);
    uiSoundService.updatePreferences({ volume: 50 });
    assert.strictEqual(uiSoundService.getPreferences().volume, 50, 'Volume na TV atualizado para 50%');
    assert(store.has('zapitv_ui_sound_tv_v1'), 'Preferência de TV deve ser gravada na chave zapitv_ui_sound_tv_v1');
    assert(!store.has('zapitv_ui_sound_v1'), 'Chave de Desktop zapitv_ui_sound_v1 não deve ter sido afetada');

    uiSoundService.setTvMode(false);
    assert.strictEqual(uiSoundService.getPreferences().volume, 18, 'Preferência de Desktop permaneceu intacta');
    uiSoundService.setTvMode(true);
    assert.strictEqual(uiSoundService.getPreferences().volume, 50, 'Preferência de TV foi preservada na chave isolada');
    console.log('✓ Teste 2: Isolamento de chaves e configurações Desktop x TV OK');

    // 3. Priming do AudioContext com o primeiro toque do controle remoto
    (uiSoundService as any).context = null;
    renderedSounds = [];
    uiSoundService.prime();
    assert((uiSoundService as any).context !== null, 'AudioContext deve ser inicializado pelo método prime()');
    assert.strictEqual(renderedSounds.length, 0, 'prime() não deve emitir som audível');
    console.log('✓ Teste 3: Priming seguro do AudioContext para contornar autoplay na Smart TV OK');

    // 4. Detecção de navegação do usuário (setas direcionais) vs foco programático
    tvNavigationManager.init();
    assert.strictEqual(tvNavigationManager.isNavigatingByUser(), false, 'Sem ação física do usuário, isNavigatingByUser deve ser falso');

    tvNavigationManager.handleGlobalKeyDown({
      key: 'ArrowRight',
      keyCode: 39,
      repeat: false,
      preventDefault: () => {},
      stopPropagation: () => {},
      target: null
    } as any);

    assert.strictEqual(tvNavigationManager.isNavigatingByUser(), true, 'Após toque na seta direita, isNavigatingByUser deve ser verdadeiro');
    console.log('✓ Teste 4: Rastreamento de navegação ativa do usuário via controle remoto OK');

    // 5. Sons de reprodução normais na TV
    renderedSounds = [];
    uiSoundService.play('navigate');
    assert.strictEqual(renderedSounds.includes('navigate'), true, 'Efeito navigate deve tocar');

    renderedSounds = [];
    uiSoundService.play('click');
    assert.strictEqual(renderedSounds.includes('click'), true, 'Efeito click deve tocar');
    console.log('✓ Teste 5: Disparo de efeitos sonoros com sintetizador Web Audio OK');

    // 6. Silenciamento durante descanso de tela (Screensaver)
    renderedSounds = [];
    uiSoundService.setSilenced(true);
    uiSoundService.play('hover');
    uiSoundService.play('slideRight');
    assert.strictEqual(renderedSounds.length, 0, 'Durante screensaver ativado, nenhum som deve ser emitido');

    uiSoundService.setSilenced(false);
    uiSoundService.play('hover');
    assert.strictEqual(renderedSounds.includes('hover'), true, 'Ao sair do screensaver, sons voltam a funcionar');
    console.log('✓ Teste 6: Silenciamento automático no Descanso de Tela (Screensaver) OK');

    // 7. Isolamento durante reprodução de vídeo no Player
    renderedSounds = [];
    const endPlayback = uiSoundService.beginPlayback();
    // Som comum de navegação sem flag playerControl deve ser bloqueado
    uiSoundService.play('navigate');
    uiSoundService.play('detailOpen');
    assert.strictEqual(renderedSounds.length, 0, 'Sons comuns da interface são bloqueados durante reprodução de vídeo');

    // Sons de controle do player com flag playerControl passam normalmente
    uiSoundService.play('toggle', { playerControl: true });
    assert.strictEqual(renderedSounds.includes('toggle'), true, 'Controles do player tocam som com a flag playerControl');

    endPlayback();
    renderedSounds = [];
    (uiSoundService as any).lastPlayed.clear();
    uiSoundService.play('navigate');
    assert.strictEqual(renderedSounds.includes('navigate'), true, 'Após encerrar vídeo, sons comuns voltam ao normal');
    console.log('✓ Teste 7: Isolamento de som durante o vídeo e liberação de controles de player OK');

    // 8. Restaurar Padrões da TV
    uiSoundService.updatePreferences({ volume: 90, enabled: false });
    assert.strictEqual(uiSoundService.getPreferences().enabled, false);
    uiSoundService.resetDefaults();
    assert.strictEqual(uiSoundService.getPreferences().enabled, true, 'resetDefaults deve reativar sons na TV');
    assert.strictEqual(uiSoundService.getPreferences().volume, 24, 'resetDefaults deve restaurar 24% na TV');
    console.log('✓ Teste 8: Restaurar Padrões da TV (resetDefaults) OK');

    // 9. Verificação estática da integração nos componentes da Smart TV
    const filesToCheck = [
      {
        path: 'src/components/tv/TvContentRow.tsx',
        requirements: ['hoverCard', 'detailOpen']
      },
      {
        path: 'src/components/tv/TvHeader.tsx',
        requirements: ['navigate', 'click', 'confirm']
      },
      {
        path: 'src/components/tv/TvHeroBanner.tsx',
        requirements: ['watch', 'detailOpen']
      },
      {
        path: 'src/components/tv/TvDetailsModal.tsx',
        requirements: ['detailOpen', 'detailClose', 'watch', 'listAdd', 'listRemove', 'toggle']
      },
      {
        path: 'src/components/tv/TvSearchView.tsx',
        requirements: ['click', 'close', 'toggle', 'detailOpen']
      },
      {
        path: 'src/components/tv/TvProfileMenu.tsx',
        requirements: ['confirm', 'close', 'click']
      },
      {
        path: 'src/components/player/TvPlayerControls.tsx',
        requirements: ['playerControl: true', 'toggle', 'close', 'watch', 'isPlayerControl: true']
      },
      {
        path: 'src/components/tv/TvSettingsView.tsx',
        requirements: ['tv-setting-sound-toggle', 'tv-setting-sound-volume', 'tv-setting-sound-test', 'tv-setting-sound-reset']
      },
      {
        path: 'src/pages/tv/TvApp.tsx',
        requirements: ['uiSoundService.setTvMode(true)', 'uiSoundService.setSilenced(screensaverActive)', '<TvSettingsView']
      }
    ];

    for (const file of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), file.path);
      assert(fs.existsSync(fullPath), `Arquivo ${file.path} deve existir`);
      const src = fs.readFileSync(fullPath, 'utf8');
      for (const req of file.requirements) {
        assert(src.includes(req), `Arquivo ${file.path} deve conter "${req}"`);
      }
    }
    console.log('✓ Teste 9: Integração de sons em todos os componentes da Smart TV OK');

    console.log('\n--- TODOS OS 9 TESTES DE SONS DA SMART TV PASSARAM COM SUCESSO! ---');
  } finally {
    (uiSoundService as any).render = originalRender;
  }
}

runTvUiSoundTests().catch(err => {
  console.error('Falha nos testes de som da Smart TV:', err);
  process.exit(1);
});
