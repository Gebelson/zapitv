import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiSoundService } from '../src/core/audio/uiSoundService';

describe('sons da interface', () => {
  const store = new Map<string, string>();
  const context = { state: 'running', currentTime: 0, resume: vi.fn().mockResolvedValue(undefined) };
  let render: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); }
    });
    vi.stubGlobal('window', { AudioContext: function AudioContext() { return context; } });
    render = vi.spyOn(uiSoundService as any, 'render').mockImplementation(() => {});
    (uiSoundService as any).context = null;
    (uiSoundService as any).lastPlayed.clear();
    uiSoundService.updatePreferences({ enabled: true, volume: 18, watchPartyNotifications: false,
      hoverEnabled: true, navigationEnabled: true, autoCarouselSounds: false });
  });

  afterEach(() => {
    render.mockRestore();
    vi.unstubAllGlobals();
  });

  it('persiste volume limitado a 0–100 e a escolha de ativação', () => {
    uiSoundService.updatePreferences({ enabled: false, volume: 150 });
    expect(uiSoundService.getPreferences()).toMatchObject({ enabled: false, volume: 100 });
    expect(JSON.parse(store.get('zapitv_ui_sound_v1')!)).toMatchObject({ enabled: false, volume: 100 });
  });

  it('inicia desativado sem preferência salva e não toca nem o teste explícito', () => {
    store.clear();
    uiSoundService.syncFromStorage();
    expect(uiSoundService.getPreferences().enabled).toBe(false);
    uiSoundService.updatePreferences({ enabled: false });
    uiSoundService.play('detailOpen');
    expect(render).not.toHaveBeenCalled();
    uiSoundService.play('detailOpen', { preview: true });
    expect(render).not.toHaveBeenCalled();
  });

  it('sincroniza alterações externas e interrompe os envelopes em andamento', () => {
    const envelope = { gain: { cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() } };
    (uiSoundService as any).activeEnvelopes.add(envelope);
    const listener = vi.fn();
    const unsubscribe = uiSoundService.subscribe(listener);
    store.set('zapitv_ui_sound_v1', JSON.stringify({ enabled: false, volume: 18 }));
    uiSoundService.syncFromStorage();
    expect(uiSoundService.getPreferences().enabled).toBe(false);
    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalled();
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(listener).toHaveBeenCalledTimes(1);
    (uiSoundService as any).activeEnvelopes.clear();
    unsubscribe();
  });

  it('corta imediatamente um efeito ativo ao desligar na própria aba', () => {
    const envelope = { gain: { cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() } };
    (uiSoundService as any).activeEnvelopes.add(envelope);
    uiSoundService.updatePreferences({ enabled: false });
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    uiSoundService.play('message', { preview: true });
    expect(render).not.toHaveBeenCalled();
    (uiSoundService as any).activeEnvelopes.clear();
  });

  it('prepara a saída no gesto antes de uma ação assíncrona sem tocar antecipadamente', () => {
    uiSoundService.prime();
    expect((uiSoundService as any).context).not.toBeNull();
    expect(render).not.toHaveBeenCalled();
    uiSoundService.play('listAdd');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('silencia efeitos decorativos no player e restaura após desmontagem', () => {
    const endPlayback = uiSoundService.beginPlayback();
    uiSoundService.play('detailOpen');
    expect(render).not.toHaveBeenCalled();
    endPlayback();
    endPlayback();
    uiSoundService.play('detailOpen');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('notifica mensagem durante o player somente com consentimento e limita repetições', () => {
    const endPlayback = uiSoundService.beginPlayback();
    uiSoundService.play('message');
    expect(render).not.toHaveBeenCalled();
    uiSoundService.updatePreferences({ watchPartyNotifications: true });
    uiSoundService.play('message');
    uiSoundService.play('message');
    expect(render).toHaveBeenCalledTimes(1);
    endPlayback();
  });

  it('respeita preferências independentes de hover, navegação e transição automática', () => {
    uiSoundService.updatePreferences({ hoverEnabled: false, navigationEnabled: false });
    uiSoundService.play('hoverCard');
    uiSoundService.play('slideRight');
    expect(render).not.toHaveBeenCalled();
    uiSoundService.updatePreferences({ hoverEnabled: true, navigationEnabled: true });
    uiSoundService.play('slideRight', { automatic: true });
    expect(render).not.toHaveBeenCalled();
    uiSoundService.play('slideRight');
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('mantém hover silencioso no player e permite clique apenas nos controles', () => {
    const endPlayback = uiSoundService.beginPlayback();
    uiSoundService.play('hoverCard');
    uiSoundService.play('click');
    expect(render).not.toHaveBeenCalled();
    uiSoundService.play('click', { playerControl: true });
    expect(render).toHaveBeenCalledTimes(1);
    endPlayback();
  });
});
