/**
 * Mobile Fullscreen & Screen Orientation Service for ZapiTV
 * 
 * Gerencia a máquina de estados centralizada de orientação de tela e tela cheia
 * em dispositivos móveis (Android e iOS).
 * 
 * Regras Centrais:
 * 1. FORA DA REPRODUÇÃO (BROWSING):
 *    - Todas as telas (Home, Explorar, Detalhes, Busca, etc.) permanecem na vertical (Portrait).
 *    - Ao girar fisicamente o aparelho, nunca alterna para layout desktop e não deforma a tela.
 *    - Quando suportado pelo navegador/OS (ex: PWA ou Android com Fullscreen), trava em portrait-primary.
 * 
 * 2. DURANTE A REPRODUÇÃO (PLAYING):
 *    - Orientação horizontal obrigatória (Landscape).
 *    - Suporte bidirecional: tanto landscape-primary quanto landscape-secondary.
 *    - Ao girar 180° entre as duas orientações horizontais, o player continua reproduzindo
 *      sem recriar o vídeo, sem perder timestamp, legendas ou áudio.
 *    - Troca contínua de episódios NÃO libera o bloqueio horizontal nem sai de tela cheia.
 *    - Tokens de geração / controle de sessão previnem condições de corrida assíncronas.
 */

import { tvModeService } from '../tv/tvModeService';
import { mobileViewportService } from './mobileViewportService';

export type OrientationLifecycleState = 
  | 'BROWSING'
  | 'ENTERING_PLAYER'
  | 'PLAYING'
  | 'EXITING_PLAYER';

export interface MobileFullscreenState {
  isMobile: boolean;
  isSmartphone: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isFullscreen: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  orientationType: 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary' | 'unknown';
  isOrientationLocked: boolean;
  showOrientationHint: boolean;
  lifecycleState: OrientationLifecycleState;
}

type StateListener = (state: MobileFullscreenState) => void;

class MobileFullscreenService {
  private static instance: MobileFullscreenService | null = null;
  private listeners: Set<StateListener> = new Set();
  private isOrientationLocked: boolean = false;
  private orientationHintDismissed: boolean = false;
  private isPlayerActive: boolean = false;
  private lifecycleState: OrientationLifecycleState = 'BROWSING';
  
  // Controle de tokens de geração para evitar condições de corrida assíncronas
  private sessionToken: number = 0;
  private activeSessionId: number = 0;
  private isEpisodeTransition: boolean = false;
  private resizeDebounceTimer: any = null;

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
   * Identifica se é dispositivo móvel (smartphone ou tablet).
   * Isolamento estrito: NUNCA retorna true se estiver no Modo TV.
   */
  public isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    if (tvModeService.isTvMode()) return false;
    return mobileViewportService.isMobileDevice();
  }

  public isSmartphone(): boolean {
    if (typeof window === 'undefined') return false;
    if (tvModeService.isTvMode()) return false;
    return mobileViewportService.isSmartphone();
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

  public getOrientationType(): 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary' | 'unknown' {
    if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.type) {
      const t = screen.orientation.type;
      if (t === 'portrait-primary' || t === 'portrait-secondary' || t === 'landscape-primary' || t === 'landscape-secondary') {
        return t;
      }
    }
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight ? 'landscape-primary' : 'portrait-primary';
    }
    return 'unknown';
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

  public getLifecycleState(): OrientationLifecycleState {
    return this.lifecycleState;
  }

  public isBrowsing(): boolean {
    return this.lifecycleState === 'BROWSING';
  }

  public isPlaying(): boolean {
    return this.lifecycleState === 'PLAYING';
  }

  public isEnteringPlayer(): boolean {
    return this.lifecycleState === 'ENTERING_PLAYER';
  }

  public isExitingPlayer(): boolean {
    return this.lifecycleState === 'EXITING_PLAYER';
  }

  public getState(): MobileFullscreenState {
    const isMobile = this.isMobile();
    const isPortrait = this.isPortrait();
    return {
      isMobile,
      isSmartphone: this.isSmartphone(),
      isAndroid: this.isAndroid(),
      isIOS: this.isIOS(),
      isFullscreen: this.isFullscreenActive(),
      isLandscape: this.isLandscape(),
      isPortrait,
      orientationType: this.getOrientationType(),
      isOrientationLocked: this.isOrientationLocked,
      showOrientationHint: isMobile && this.isPlayerActive && isPortrait && !this.orientationHintDismissed && !this.isOrientationLocked,
      lifecycleState: this.lifecycleState,
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
   * Em modo BROWSING, solicita orientação vertical quando o ambiente permitir.
   * Não força tela cheia na navegação.
   */
  public async enforceBrowsingOrientation(): Promise<void> {
    if (!this.isMobile() || tvModeService.isTvMode()) return;
    if (this.lifecycleState !== 'BROWSING' && this.lifecycleState !== 'EXITING_PLAYER') return;

    if (this.supportsOrientationLock()) {
      try {
        const scr = screen as any;
        if (scr.orientation && typeof scr.orientation.lock === 'function') {
          await scr.orientation.lock('portrait').catch(() => scr.orientation.lock('portrait-primary')).catch(() => {});
        } else if (scr.lockOrientation) {
          scr.lockOrientation('portrait');
        }
      } catch {}
    }
  }

  /**
   * Dispara a solicitação de tela cheia e orientação horizontal.
   * CRÍTICO: Chamada síncrona dentro do evento de toque/clique do usuário
   * para não perder a autorização de gesto (User Activation) do navegador.
   * 
   * Solicita 'landscape' para permitir AMBAS as orientações horizontais:
   * landscape-primary e landscape-secondary.
   */
  public async requestAutoFullscreenAndLandscape(targetElement?: HTMLElement | null): Promise<{
    fullscreenGranted: boolean;
    orientationLocked: boolean;
  }> {
    if (!this.isMobile()) {
      return { fullscreenGranted: false, orientationLocked: false };
    }

    // Marca transição para reprodução e emite novo token de geração
    this.lifecycleState = 'ENTERING_PLAYER';
    const currentToken = ++this.sessionToken;
    this.activeSessionId = currentToken;
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
        // são tratadas suavemente sem interromper a reprodução.
        console.warn('[ZapiMobile] Tela cheia não concedida pelo navegador:', fsErr);
      }
    }

    // 2. Tenta bloqueio de orientação para paisagem (Landscape bidirecional)
    if (this.supportsOrientationLock()) {
      try {
        const scr = screen as any;
        if (scr.orientation && typeof scr.orientation.lock === 'function') {
          try {
            // 'landscape' permite landscape-primary e landscape-secondary
            await scr.orientation.lock('landscape');
            orientationLocked = true;
          } catch {
            // Fallback caso o navegador suporte apenas modo específico
            await scr.orientation.lock('landscape-primary');
            orientationLocked = true;
          }
        } else if (scr.lockOrientation) {
          orientationLocked = Boolean(scr.lockOrientation('landscape') || scr.lockOrientation('landscape-primary'));
        } else if (scr.mozLockOrientation) {
          orientationLocked = Boolean(scr.mozLockOrientation('landscape') || scr.mozLockOrientation('landscape-primary'));
        }
      } catch (oriErr) {
        console.warn('[ZapiMobile] Bloqueio de orientação horizontal rejeitado:', oriErr);
      }
    }

    // Verificação de token: se a sessão mudou ou foi cancelada enquanto esperava promises assíncronas,
    // aborta imediatamente para impedir travamento indevido após sair do player.
    const stateStr = this.lifecycleState as string;
    if (this.activeSessionId !== currentToken || stateStr === 'EXITING_PLAYER' || stateStr === 'BROWSING') {
      this.enforceBrowsingOrientation().catch(() => {});
      return { fullscreenGranted: false, orientationLocked: false };
    }

    this.isOrientationLocked = orientationLocked;
    this.lifecycleState = 'PLAYING';
    this.notify();

    return { fullscreenGranted, orientationLocked };
  }

  /**
   * Sinaliza início de transição de episódio durante reprodução contínua.
   * Impede que o desmonte temporário da instância anterior do player
   * libere indevidamente o bloqueio horizontal ou saia de fullscreen.
   */
  public beginEpisodeTransition(): void {
    this.isEpisodeTransition = true;
  }

  /**
   * Finaliza a transição de episódio, mantendo o player em tela cheia e paisagem.
   */
  public endEpisodeTransition(): void {
    this.isEpisodeTransition = false;
  }

  /**
   * Encerra a sessão de fullscreen e desativa o bloqueio de orientação,
   * restaurando o estado original da página e preferência vertical.
   */
  public async exitMobileFullscreen(options?: { force?: boolean }): Promise<void> {
    // Se estiver em transição de episódio e não for encerramento forçado pelo usuário, não encerra
    if (this.isEpisodeTransition && !options?.force) {
      return;
    }

    // Invalida o token de sessão ativo imediatamente para neutralizar promessas atrasadas
    this.activeSessionId = ++this.sessionToken;
    this.isEpisodeTransition = false;
    this.lifecycleState = 'EXITING_PLAYER';
    this.isPlayerActive = false;
    this.orientationHintDismissed = false;

    // 1. Libera orientação bloqueada e solicita retorno a portrait
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

    // 3. Restaura a orientação vertical no ambiente PWA / navegador compatível
    this.enforceBrowsingOrientation().catch(() => {});

    // 4. Restaura o scroll do corpo
    if (typeof document !== 'undefined') {
      try {
        document.body.style.overflow = '';
      } catch {}
    }

    this.lifecycleState = 'BROWSING';
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
      if (!active && (this.lifecycleState === 'PLAYING' || this.isOrientationLocked)) {
        // Se o usuário saiu do fullscreen por gesto do sistema ou botão nativo do aparelho,
        // restaura a navegação vertical suavemente se não estiver em transição de episódio
        if (!this.isEpisodeTransition) {
          this.exitMobileFullscreen({ force: true }).catch(() => {});
        }
      }
      this.notify();
    };

    const handleOrientationOrResize = () => {
      // Se girou para landscape durante reprodução, oculta a dica automaticamente
      if (this.isLandscape()) {
        this.orientationHintDismissed = false;
      }
      
      // Debounce de notificações em rotação rápida para não sobrecarregar React
      if (this.resizeDebounceTimer) {
        clearTimeout(this.resizeDebounceTimer);
      }
      this.resizeDebounceTimer = setTimeout(() => {
        this.notify();
      }, 50);
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
