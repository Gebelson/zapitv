/**
 * TV Navigation & Spatial Focus Manager for ZapiTV
 * Gerencia a pilha de 'Voltar' (Back-Stack), atalhos de controle remoto e integração com Norigin Spatial Navigation.
 */

import { init as initNorigin, setKeyMap, setFocus, getCurrentFocusKey, pause as pauseNorigin, resume as resumeNorigin } from '@noriginmedia/norigin-spatial-navigation';
import { tvModeService } from './tvModeService';
import { uiSoundService } from '../audio/uiSoundService';

export interface BackHandler {
  id: string;
  priority: number; // Maior prioridade executa primeiro
  handle: () => boolean; // Retorna true se consumiu o evento
}

class TvNavigationManager {
  private static instance: TvNavigationManager | null = null;
  private backHandlers: BackHandler[] = [];
  private isInitialized: boolean = false;
  private lastFocusedKeyBeforeModal: string | null = null;
  private lastUserNavTime: number = -Infinity;
  private activityHandler: ((event: KeyboardEvent) => boolean) | null = null;
  private commandHandler: ((event: KeyboardEvent) => boolean) | null = null;

  private constructor() {}

  public static getInstance(): TvNavigationManager {
    if (!TvNavigationManager.instance) {
      TvNavigationManager.instance = new TvNavigationManager();
    }
    return TvNavigationManager.instance;
  }

  public init(): void {
    if (typeof window === 'undefined') return;

    if (!this.isInitialized) {
      this.isInitialized = true;

      // Inicializa a navegação espacial do Norigin com mapeamento de TV e foco no DOM nativo sem saltos de rolagem
      initNorigin({
        debug: false,
        visualDebug: false,
        shouldFocusDOMNode: true,
        domNodeFocusOptions: { preventScroll: true }
      });

      (window as any).__setTvFocus = (key: string) => setFocus(key);

      setKeyMap({
        left: [37, 'ArrowLeft'],
        up: [38, 'ArrowUp'],
        right: [39, 'ArrowRight'],
        down: [40, 'ArrowDown'],
        enter: [13, 10, 'Enter', 'Select', 'Ok', 'OK', 65385, 66]
      });

      // Captura global do botão VOLTAR / BACK (Tizen 10009, Escape, Backspace)
      window.addEventListener('keydown', this.handleGlobalKeyDown, { capture: true });

      // Registro defensivo de teclas de TV no Samsung Tizen (CH+, CH- e Teclado Numérico)
      try {
        const tizenObj = (window as any)?.tizen;
        if (tizenObj?.tvinputdevice?.registerKey) {
          const tizenKeys = ['ChannelUp', 'ChannelDown', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
          for (const k of tizenKeys) {
            try {
              tizenObj.tvinputdevice.registerKey(k);
            } catch {}
          }
        }
      } catch {}
    }
  }

  public pause(): void {
    try {
      pauseNorigin();
    } catch {}
  }

  public resume(): void {
    try {
      resumeNorigin();
    } catch {}
  }

  private handleGlobalKeyDown = (e: KeyboardEvent): void => {
    if (!tvModeService.isTvMode()) return;

    // Prepara o AudioContext durante a primeira interação legítima com o controle remoto
    uiSoundService.prime();

    if (this.activityHandler?.(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    // Registra navegação intencional do usuário ao pressionar setas direcionais
    const isDirectionKey =
      e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
      e.keyCode === 37 || e.keyCode === 38 || e.keyCode === 39 || e.keyCode === 40;

    if (isDirectionKey) {
      this.lastUserNavTime = performance.now();
    }

    const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const isBackKey =
      e.keyCode === 10009 ||
      e.keyCode === 4 ||
      e.key === 'Back' ||
      e.key === 'GoBack' ||
      e.key === 'BrowserBack' ||
      e.key === 'Return' ||
      e.key === 'Escape' ||
      (e.key === 'Backspace' && !isInput);

    if (isBackKey) {
      const handled = this.dispatchBack();
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }

    if (this.commandHandler?.(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  /** Único ponto de captura de teclas da TV para acordar a tela sem acionar o foco anterior. */
  public setActivityHandler(handler: ((event: KeyboardEvent) => boolean) | null): void {
    this.activityHandler = handler;
  }

  /** Informa se uma mudança de foco é decorrente de navegação intencional do usuário via controle remoto. */
  public isNavigatingByUser(windowMs: number = 380): boolean {
    return performance.now() - this.lastUserNavTime < windowMs;
  }

  public registerCommandHandler(handler: (event: KeyboardEvent) => boolean): () => void {
    this.commandHandler = handler;
    return () => { if (this.commandHandler === handler) this.commandHandler = null; };
  }

  /**
   * Registra um manipulador na pilha de 'Voltar'.
   * Ex: Modais registram com prioridade 100, Player com prioridade 200, Submenus com 300.
   */
  public registerBackHandler(id: string, priority: number, handle: () => boolean): () => void {
    const handler: BackHandler = { id, priority, handle };
    this.backHandlers.push(handler);
    this.backHandlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.backHandlers = this.backHandlers.filter(h => h.id !== id);
    };
  }

  /**
   * Executa os manipuladores de voltar na ordem de prioridade.
   */
  public dispatchBack(): boolean {
    for (const handler of this.backHandlers) {
      try {
        const consumed = handler.handle();
        if (consumed) return true;
      } catch (err) {
        console.warn(`[TvNavigationManager] Erro no manipulador de voltar (${handler.id}):`, err);
      }
    }
    return false;
  }

  /**
   * Salva o elemento com foco atual antes de abrir modal, para restaurar depois.
   */
  public saveFocusSnapshot(): void {
    this.lastFocusedKeyBeforeModal = getCurrentFocusKey() || null;
  }

  /**
   * Restaura o foco para o elemento pré-modal.
   */
  public restoreFocusSnapshot(fallbackKey?: string): void {
    const keyToRestore = this.lastFocusedKeyBeforeModal || fallbackKey;
    if (keyToRestore) {
      setTimeout(() => {
        try {
          setFocus(keyToRestore);
        } catch {}
      }, 50);
    }
    this.lastFocusedKeyBeforeModal = null;
  }
}

export const tvNavigationManager = TvNavigationManager.getInstance();
