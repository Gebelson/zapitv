export type UiSound = 'detailOpen' | 'detailClose' | 'watch' | 'sidebarOpen' | 'sidebarClose'
  | 'listAdd' | 'listRemove' | 'toggle' | 'partyConnect' | 'message' | 'error'
  | 'hover' | 'hoverCard' | 'hoverPrimary' | 'hoverIcon' | 'click' | 'clickPrimary'
  | 'confirm' | 'close' | 'slide' | 'slideLeft' | 'slideRight' | 'navigate' | 'success' | 'notification';

export interface UiSoundPreferences {
  enabled: boolean;
  volume: number;
  watchPartyNotifications: boolean;
  hoverEnabled: boolean;
  navigationEnabled: boolean;
  autoCarouselSounds: boolean;
}

const STORAGE_KEY_DESKTOP = 'zapitv_ui_sound_v1';
const STORAGE_KEY_TV = 'zapitv_ui_sound_tv_v1';

const DEFAULTS_DESKTOP: UiSoundPreferences = {
  enabled: false,
  volume: 18,
  watchPartyNotifications: false,
  hoverEnabled: true,
  navigationEnabled: true,
  autoCarouselSounds: false
};

const DEFAULTS_TV: UiSoundPreferences = {
  enabled: true, // Sons permanentemente ativados por padrão na Smart TV
  volume: 24,    // Volume inicial discreto e confortável na televisão (24%)
  watchPartyNotifications: false,
  hoverEnabled: true,
  navigationEnabled: true,
  autoCarouselSounds: false
};

const COOLDOWN: Record<UiSound, number> = {
  detailOpen: 180, detailClose: 180, watch: 450, sidebarOpen: 260, sidebarClose: 260,
  listAdd: 220, listRemove: 220, toggle: 110, partyConnect: 800, message: 650, error: 900,
  hover: 75, hoverCard: 90, hoverPrimary: 75, hoverIcon: 75, click: 80,
  clickPrimary: 80, confirm: 180, close: 160, slide: 180, slideLeft: 180,
  slideRight: 180, navigate: 200, success: 240, notification: 650
};

function clampVolume(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

function getActiveStorageKey(isTv: boolean): string {
  return isTv ? STORAGE_KEY_TV : STORAGE_KEY_DESKTOP;
}

function getActiveDefaults(isTv: boolean): UiSoundPreferences {
  return isTv ? DEFAULTS_TV : DEFAULTS_DESKTOP;
}

function readPreferences(isTv: boolean): UiSoundPreferences {
  const key = getActiveStorageKey(isTv);
  const defaults = getActiveDefaults(isTv);
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) {
      return { ...defaults };
    }
    const saved = JSON.parse(raw);
    return {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : defaults.enabled,
      volume: clampVolume(saved.volume, defaults.volume),
      watchPartyNotifications: saved.watchPartyNotifications === true,
      hoverEnabled: saved.hoverEnabled !== false,
      navigationEnabled: saved.navigationEnabled !== false,
      autoCarouselSounds: saved.autoCarouselSounds === true
    };
  } catch {
    return { ...defaults };
  }
}

class UiSoundService {
  private isTvMode: boolean = typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/tv') ||
     window.location.search.includes('tv=1') ||
     window.location.search.includes('tv=true'));
  private preferences = readPreferences(this.isTvMode);
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<UiSound, number>();
  private activePlayers = 0;
  private lastAnyPlayed = -Infinity;
  private lastHoverPlayed = -Infinity;
  private sidebarHoverSuppressedUntil = 0;
  private listeners = new Set<() => void>();
  private activeEnvelopes = new Set<GainNode>();
  private isSilenced: boolean = false;

  public setTvMode(isTv: boolean): void {
    if (this.isTvMode === isTv) return;
    this.isTvMode = isTv;
    this.preferences = readPreferences(isTv);
    this.notify();
  }

  public isTv(): boolean {
    return this.isTvMode;
  }

  public setSilenced(silenced: boolean): void {
    this.isSilenced = silenced;
    if (silenced) {
      this.stopEffects();
    }
  }

  public getLastAnyPlayed(): number {
    return this.lastAnyPlayed;
  }

  getPreferences(): UiSoundPreferences {
    return { ...this.preferences };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  private stopEffects(): void {
    const now = this.context?.currentTime ?? 0;
    this.activeEnvelopes.forEach(envelope => {
      try {
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setValueAtTime(0, now);
      } catch {}
    });
  }

  syncFromStorage(): void {
    const next = readPreferences(this.isTvMode);
    if (JSON.stringify(next) === JSON.stringify(this.preferences)) return;
    if (!next.enabled) this.stopEffects();
    this.preferences = next;
    this.notify();
  }

  updatePreferences(changes: Partial<UiSoundPreferences>): UiSoundPreferences {
    if (changes.enabled === false) this.stopEffects();
    const defaults = getActiveDefaults(this.isTvMode);
    this.preferences = {
      enabled: typeof changes.enabled === 'boolean' ? changes.enabled : this.preferences.enabled,
      volume: changes.volume === undefined ? this.preferences.volume : clampVolume(changes.volume, defaults.volume),
      watchPartyNotifications: typeof changes.watchPartyNotifications === 'boolean'
        ? changes.watchPartyNotifications : this.preferences.watchPartyNotifications,
      hoverEnabled: typeof changes.hoverEnabled === 'boolean' ? changes.hoverEnabled : this.preferences.hoverEnabled,
      navigationEnabled: typeof changes.navigationEnabled === 'boolean' ? changes.navigationEnabled : this.preferences.navigationEnabled,
      autoCarouselSounds: typeof changes.autoCarouselSounds === 'boolean' ? changes.autoCarouselSounds : this.preferences.autoCarouselSounds
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getActiveStorageKey(this.isTvMode), JSON.stringify(this.preferences));
      }
    } catch {}
    this.notify();
    return this.getPreferences();
  }

  resetDefaults(): UiSoundPreferences {
    const defaults = getActiveDefaults(this.isTvMode);
    return this.updatePreferences(defaults);
  }

  beginPlayback(): () => void {
    this.activePlayers++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activePlayers = Math.max(0, this.activePlayers - 1);
    };
  }

  prime(): void {
    if (!this.preferences.enabled || this.preferences.volume === 0) return;
    try {
      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || (window as any).webkitAudioContext)
        : null;
      if (!AudioContextClass) return;
      this.context ??= new AudioContextClass();
      if (this.context?.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {}
  }

  play(sound: UiSound, options: { preview?: boolean; playerControl?: boolean; automatic?: boolean } = {}): void {
    try {
      if (this.isSilenced && !options.preview) return;
      const prefs = this.preferences;
      if (!prefs.enabled || prefs.volume === 0) return;
      if (sound === 'message' && !prefs.watchPartyNotifications && !options.preview) return;
      const isHover = sound.startsWith('hover');
      const isNavigation = sound.startsWith('slide') || sound === 'navigate';
      if (isHover && !prefs.hoverEnabled && !options.preview) return;
      if (isNavigation && !prefs.navigationEnabled && !options.preview) return;
      if (options.automatic && !prefs.autoCarouselSounds && !options.preview) return;
      if (this.activePlayers > 0 && sound !== 'error' && sound !== 'message' && sound !== 'watch' && !options.preview && !options.playerControl) return;
      const now = performance.now();
      if (!options.preview && now - (this.lastPlayed.get(sound) ?? -Infinity) < COOLDOWN[sound]) return;
      if (isHover && now - this.lastHoverPlayed < 85) return;

      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || (window as any).webkitAudioContext)
        : null;
      if (!AudioContextClass) return;
      this.context ??= new AudioContextClass();
      const context = this.context;
      if (!context) return;
      const renderIfCurrent = () => {
        if (performance.now() - now > 250) return;
        if (this.isSilenced && !options.preview) return;
        if (this.activePlayers > 0 && sound !== 'error' && sound !== 'message' && sound !== 'watch' && !options.preview && !options.playerControl) return;
        if (!this.preferences.enabled || (sound === 'message' && !this.preferences.watchPartyNotifications)) return;
        this.render(sound, context, this.preferences.volume);
      };
      if (context.state === 'suspended') {
        // O navegador só retoma após gesto do usuário; um som perdido nunca bloqueia a ação.
        void context.resume().then(renderIfCurrent).catch(() => {});
      } else {
        renderIfCurrent();
      }
      this.lastPlayed.set(sound, now);
      this.lastAnyPlayed = now;
      if (isHover) this.lastHoverPlayed = now;
      if (sound === 'sidebarOpen' || sound === 'sidebarClose') this.sidebarHoverSuppressedUntil = now + 350;
    } catch {
      // Falhas de áudio são sempre independentes da interface.
    }
  }

  /** One listener pair for React portals and lazy routes; released when the app unmounts. */
  bindInteractions(root: Document): () => void {
    const onStorage = (event: StorageEvent) => {
      const activeKey = getActiveStorageKey(this.isTvMode);
      if (event.key === activeKey || event.key === STORAGE_KEY_DESKTOP || event.key === STORAGE_KEY_TV || event.key === null) {
        this.syncFromStorage();
      }
    };
    window.addEventListener('storage', onStorage);
    const interactive = 'button, a[href], [role="button"], [role="switch"], [data-ui-sound-card]';
    const targetElement = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element ? target.closest<HTMLElement>(interactive) : null;
    const disabled = (element: HTMLElement): boolean =>
      element.matches(':disabled, [aria-disabled="true"]') || !!element.closest('[inert], [aria-hidden="true"]');
    const isPrimary = (element: HTMLElement): boolean => element.matches('[data-ui-sound-primary]') ||
      /bg-\[#007df7\]|bg-blue-[567]00|from-\[#007df7\]/.test(element.getAttribute('class') || '');
    const category = (element: HTMLElement): UiSound => {
      if (element.matches('[data-ui-sound-card]')) return 'hoverCard';
      if (element.closest('[data-ui-sound-sidebar]')) return 'hover';
      if (isPrimary(element)) return 'hoverPrimary';
      if (element.matches('[data-ui-sound-icon]') || (!element.textContent?.trim() && element.querySelector('svg'))) return 'hoverIcon';
      return 'hover';
    };
    const onHover = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !this.preferences.hoverEnabled || this.activePlayers > 0) return;
      if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
      const element = targetElement(event.target);
      if (!element || disabled(element) || element.closest('[data-ui-sound-ignore]')) return;
      const card = element.closest<HTMLElement>('[data-ui-sound-card]');
      const subject = card ?? element;
      if (event.relatedTarget instanceof Node && subject.contains(event.relatedTarget)) return;
      if (subject.closest('[data-ui-sound-sidebar]') && performance.now() < this.sidebarHoverSuppressedUntil) return;
      this.play(category(subject));
    };
    const onClick = (event: MouseEvent) => {
      const element = targetElement(event.target);
      if (!element || disabled(element) || element.closest('[data-ui-sound-ignore]') || element.hasAttribute('data-ui-sound-card')) return;
      const playerControl = !!element.closest('[data-ui-sound-player]');
      const sound: UiSound = element.closest('[data-ui-sound-sidebar]') && element.closest('nav')
        ? 'navigate' : isPrimary(element) ? 'clickPrimary' : 'click';
      const before = performance.now();
      // React handlers can play a more specific sound; they win over this generic click.
      queueMicrotask(() => {
        if (this.lastAnyPlayed >= before) return;
        this.play(sound, { playerControl });
      });
    };
    root.addEventListener('pointerover', onHover, { passive: true });
    root.addEventListener('click', onClick, true);
    return () => {
      root.removeEventListener('pointerover', onHover);
      root.removeEventListener('click', onClick, true);
      window.removeEventListener('storage', onStorage);
    };
  }

  private tone(context: AudioContext, at: number, frequency: number, endFrequency: number,
    duration: number, level: number, type: OscillatorType = 'sine'): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    this.activeEnvelopes.add(envelope);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + Math.min(0.025, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.activeEnvelopes.delete(envelope); };
  }

  private air(context: AudioContext, at: number, duration: number, level: number, rising: boolean): void {
    if (!this.noiseBuffer) {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.5), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    this.activeEnvelopes.add(envelope);
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(rising ? 650 : 2200, at);
    filter.frequency.exponentialRampToValueAtTime(rising ? 2200 : 650, at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + duration * 0.25);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(envelope).connect(context.destination);
    source.start(at);
    source.stop(at + duration + 0.01);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); this.activeEnvelopes.delete(envelope); };
  }

  private render(sound: UiSound, context: AudioContext, volume: number): void {
    if (context.state !== 'running') return;
    const at = context.currentTime + 0.005;
    const level = (volume / 100) * 0.12;
    switch (sound) {
      case 'hover':
      case 'hoverCard':
      case 'hoverPrimary':
      case 'hoverIcon':
        this.tone(context, at, sound === 'hoverCard' ? 620 : 740,
          sound === 'hoverPrimary' ? 910 : 810, sound === 'hoverCard' ? 0.065 : 0.045,
          level * (sound === 'hoverIcon' ? 0.19 : 0.25), 'sine');
        break;
      case 'click':
      case 'clickPrimary':
        this.tone(context, at, sound === 'clickPrimary' ? 540 : 660,
          sound === 'clickPrimary' ? 780 : 590, 0.09, level * 0.42, 'triangle');
        break;
      case 'confirm':
      case 'success':
        this.tone(context, at, 540, 690, 0.12, level * 0.42);
        this.tone(context, at + 0.07, 760, 890, 0.15, level * 0.36);
        break;
      case 'close':
        this.tone(context, at, 590, 390, 0.12, level * 0.38);
        break;
      case 'slide':
      case 'slideLeft':
      case 'slideRight':
      case 'navigate':
        this.air(context, at, sound === 'navigate' ? 0.18 : 0.15,
          level * 0.22, sound !== 'slideLeft');
        break;
      case 'notification':
        this.tone(context, at, 820, 790, 0.12, level * 0.32);
        break;
      case 'detailOpen':
        this.air(context, at, 0.28, level * 0.48, true);
        this.tone(context, at + 0.045, 440, 660, 0.25, level * 0.65);
        break;
      case 'detailClose':
        this.air(context, at, 0.15, level * 0.33, false);
        this.tone(context, at, 560, 350, 0.16, level * 0.5);
        break;
      case 'watch':
        this.tone(context, at, 520, 660, 0.13, level * 0.8);
        this.tone(context, at + 0.085, 780, 940, 0.19, level * 0.62);
        break;
      case 'sidebarOpen':
      case 'sidebarClose':
        this.air(context, at, 0.22, level * 0.35, sound === 'sidebarOpen');
        this.tone(context, at, sound === 'sidebarOpen' ? 340 : 470,
          sound === 'sidebarOpen' ? 470 : 320, 0.2, level * 0.42);
        break;
      case 'listAdd':
        this.tone(context, at, 620, 700, 0.1, level * 0.55);
        this.tone(context, at + 0.065, 880, 920, 0.14, level * 0.42);
        break;
      case 'listRemove':
        this.tone(context, at, 720, 520, 0.16, level * 0.55);
        break;
      case 'toggle':
        this.tone(context, at, 680, 570, 0.075, level * 0.38, 'triangle');
        break;
      case 'partyConnect':
        this.tone(context, at, 420, 520, 0.15, level * 0.58);
        this.tone(context, at + 0.1, 630, 780, 0.24, level * 0.55);
        break;
      case 'message':
        this.tone(context, at, 820, 790, 0.12, level * 0.32);
        this.tone(context, at + 0.09, 1030, 990, 0.13, level * 0.25);
        break;
      case 'error':
        this.tone(context, at, 360, 300, 0.16, level * 0.5, 'triangle');
        this.tone(context, at + 0.08, 300, 250, 0.16, level * 0.38, 'triangle');
        break;
    }
  }
}

export const uiSoundService = new UiSoundService();
