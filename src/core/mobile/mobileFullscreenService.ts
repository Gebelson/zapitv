/**
 * Mobile Fullscreen & Screen Orientation Service for ZapiTV
 * Gerencia a ativação de tela cheia automática e orientação horizontal em dispositivos móveis (Android e iOS).
 * Respeita as políticas de gesto do usuário (User Activation) e restrições de cada plataforma.
 */

import { tvModeService } from '../tv/tvModeService';

export interface MobileFullscreenState {
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isFullscreen: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  isOrientationLocked: boolean;
  showOrientationHint: boolean;
}

type StateListener = (state: MobileFullscreenState) => void;

class MobileFullscreenService {
  private static instance: MobileFullscreenService | null = null;
  private listeners: Set<StateListener> = new Set();
  private isOrientationLocked: boolean = false;
  private orientationHintDismissed: boolean = false;
  private isPlayerActive: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.bindSystemEvents();
    }
  }

  public static getInstance(): MobileFullscreenService {
    if (!MobileFullscreenService.instance) {
      MobileFullscreenService.instance = new MobileFullscreenService();
    }
    return MobileFullscreenService.instance;
  }

  /**
   * Detecta se o dispositivo atual é móvel (smartphone/tablet),
   * garantindo isolamento estrito: NUNCA retorna true se estiver no Modo TV.
   */
  public isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    if (tvModeService.isTvMode()) return false;

    const ua = navigator.userAgent || '';
    const isMobileUa = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return isMobileUa || (isTouch && window.innerWidth <= 1024);
  }

  public isAndroid(): boolean {
    if (typeof window === 'undefined') return false;
    return this.isMobile() && /android/i.test(navigator.userAgent || '');
  }

  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return this.isMobile() && (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  }

  public supportsFullscreen(): boolean {
    if (typeof document === 'undefined') return false;
    const doc = document as any;
    return Boolean(
      doc.documentElement.requestFullscreen ||
      doc.documentElement.webkitRequestFullscreen ||
      doc.documentElement.mozRequestFullScreen ||
      doc.documentElement.msRequestFullscreen
    );
  }

  public supportsOrientationLock(): boolean {
    if (typeof screen === 'undefined') return false;
    const scr = screen as any;
    return Boolean(
      (scr.orientation && typeof scr.orientation.lock === 'function') ||
      scr.lockOrientation ||
      scr.mozLockOrientation ||
      scr.msLockOrientation
    );
  }

  public isLandscape(): boolean {
    if (typeof window === 'undefined') return true;
    if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.type) {
      return screen.orientation.type.startsWith('landscape');
    }
    return window.innerWidth > window.innerHeight;
  }

  public isPortrait(): boolean {
    return !this.isLandscape();
  }

  public isFullscreenActive(): boolean {
    if (typeof document === 'undefined') return false;
    const doc = document as any;
    return Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  }

  public getState(): MobileFullscreenState {
    const isMobile = this.isMobile();
    const isPortrait = this.isPortrait();
    return {
      isMobile,
      isAndroid: this.isAndroid(),
      isIOS: this.isIOS(),
      isFullscreen: this.isFullscreenActive(),
      isLandscape: this.isLandscape(),
      isPortrait,
      isOrientationLocked: this.isOrientationLocked,
      showOrientationHint: isMobile && this.isPlayerActive && isPortrait && !this.orientationHintDismissed && !this.isOrientationLocked
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(l => {
      try { l(state); } catch {}
    });
  }

  /**
   * Dispara a solicitação de tela cheia e orientação horizontal.
   * CRÍTICO: Deve ser chamada de forma síncrona dentro do evento de toque/clique do usuário
   * para não perder a autorização de gesto (User Activation) do navegador.
   */
  public async requestAutoFullscreenAndLandscape(targetElement?: HTMLElement | null): Promise<{
    fullscreenGranted: boolean;
    orientationLocked: boolean;
  }> {
    if (!this.isMobile()) {
      return { fullscreenGranted: false, orientationLocked: false };
    }

    this.isPlayerActive = true;
    this.orientationHintDismissed = false;

    let fullscreenGranted = false;
    let orientationLocked = false;

    // 1. Tenta Fullscreen diretamente no gesto do usuário
    const element = targetElement || (typeof document !== 'undefined' ? document.documentElement : null);
    if (element) {
      const el = element as any;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
          fullscreenGranted = true;
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
          fullscreenGranted = true;
        } else if (el.mozRequestFullScreen) {
          await el.mozRequestFullScreen();
          fullscreenGranted = true;
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
          fullscreenGranted = true;
        }
      } catch (fsErr) {
        // Rejeições de Fullscreen (ex: Safari iPhone que não suporta HTML5 element fullscreen)
        // são tratadas sem interromper a reprodução.
        console.warn('[ZapiMobile] Solicitação de tela cheia não concedida pelo navegador:', fsErr);
      }
    }

    // 2. Tenta bloqueio de orientação para paisagem (Landscape)
    if (this.supportsOrientationLock()) {
      try {
        const scr = screen as any;
        if (scr.orientation && typeof scr.orientation.lock === 'function') {
          try {
            await scr.orientation.lock('landscape');
            orientationLocked = true;
          } catch {
            await scr.orientation.lock('landscape-primary');
            orientationLocked = true;
          }
        } else if (scr.lockOrientation) {
          orientationLocked = Boolean(scr.lockOrientation('landscape'));
        } else if (scr.mozLockOrientation) {
          orientationLocked = Boolean(scr.mozLockOrientation('landscape'));
        }
      } catch (oriErr) {
        console.warn('[ZapiMobile] Bloqueio de orientação horizontal rejeitado:', oriErr);
      }
    }

    this.isOrientationLocked = orientationLocked;
    this.notify();

    return { fullscreenGranted, orientationLocked };
  }

  /**
   * Encerra a sessão de fullscreen e desativa o bloqueio de orientação,
   * restaurando o estado original da página e limpando estilos.
   */
  public async exitMobileFullscreen(): Promise<void> {
    this.isPlayerActive = false;
    this.orientationHintDismissed = false;

    // 1. Libera orientação bloqueada
    if (this.isOrientationLocked || this.supportsOrientationLock()) {
      try {
        const scr = screen as any;
        if (scr.orientation && typeof scr.orientation.unlock === 'function') {
          scr.orientation.unlock();
        } else if (scr.unlockOrientation) {
          scr.unlockOrientation();
        }
      } catch (err) {
        console.warn('[ZapiMobile] Erro ao liberar orientação:', err);
      }
      this.isOrientationLocked = false;
    }

    // 2. Sai de fullscreen se ainda estiver ativo
    if (typeof document !== 'undefined' && this.isFullscreenActive()) {
      try {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      } catch (err) {
        console.warn('[ZapiMobile] Erro ao sair de tela cheia:', err);
      }
    }

    // 3. Restaura o scroll do corpo
    if (typeof document !== 'undefined') {
      try {
        document.body.style.overflow = '';
      } catch {}
    }

    this.notify();
  }

  /**
   * Dispensa a dica discreta de girar aparelho para a sessão atual
   */
  public dismissOrientationHint(): void {
    this.orientationHintDismissed = true;
    this.notify();
  }

  /**
   * Monitora eventos do sistema operacional e navegador
   */
  private bindSystemEvents(): void {
    const handleFullscreenChange = () => {
      const active = this.isFullscreenActive();
      if (!active && this.isOrientationLocked) {
        // Se o usuário saiu do fullscreen por gesto do sistema ou botão nativo do aparelho,
        // desbloqueia a orientação automaticamente
        try {
          if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            screen.orientation.unlock();
          }
        } catch {}
        this.isOrientationLocked = false;
      }
      this.notify();
    };

    const handleOrientationOrResize = () => {
      // Se girou para landscape, oculta a dica automaticamente
      if (this.isLandscape()) {
        this.orientationHintDismissed = false;
      }
      this.notify();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    window.addEventListener('orientationchange', handleOrientationOrResize);
    window.addEventListener('resize', handleOrientationOrResize);
  }
}

export const mobileFullscreenService = MobileFullscreenService.getInstance();
