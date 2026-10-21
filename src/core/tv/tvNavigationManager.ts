/**
 * TV Navigation & Spatial Focus Manager for ZapiTV
 * Gerencia a pilha de 'Voltar' (Back-Stack), atalhos de controle remoto e integração com Norigin Spatial Navigation.
 */

import { init as initNorigin, setKeyMap, setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { tvModeService } from './tvModeService';

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

      // Inicializa a navegação espacial do Norigin com mapeamento de TV e foco no DOM nativo
      initNorigin({
        debug: false,
        visualDebug: false,
        shouldFocusDOMNode: true
      });

      setKeyMap({
        left: [37, 'ArrowLeft'],
        up: [38, 'ArrowUp'],
        right: [39, 'ArrowRight'],
        down: [40, 'ArrowDown'],
        enter: [13, 10, 'Enter', 'Select', 65385]
      });

      // Captura global do botão VOLTAR / BACK (Tizen 10009, Escape, Backspace)
      window.addEventListener('keydown', this.handleGlobalKeyDown, { capture: true });
    }
  }

  private handleGlobalKeyDown = (e: KeyboardEvent): void => {
    if (!tvModeService.isTvMode()) return;

    const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const isBackKey =
      e.keyCode === 10009 ||
      e.key === 'GoBack' ||
      e.key === 'Return' ||
      e.key === 'Escape' ||
      (e.key === 'Backspace' && !isInput);

    if (isBackKey) {
      const handled = this.dispatchBack();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

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
