/**
 * ZAPITV — TV SCROLL SERVICE
 * 
 * Gerenciador unificado de rolagem vertical cinematográfica e coordenada para Smart TV.
 * Elimina rolagens simultâneas, saltos de scrollTop e chamadas conflitantes de scrollIntoView.
 * Pausa o pré-carregamento de imagens em segundo plano durante movimentos verticais rápidos
 * para prioridade máxima de resposta ao controle remoto.
 */

import { tvPerformanceService } from './tvPerformanceService';
import { tvImagePreloaderService } from './tvImagePreloaderService';

class TvScrollService {
  private static instance: TvScrollService;
  private isScrollingToHero: boolean = false;
  private heroScrollTimer: any = null;
  private lastRowScrollTime: number = 0;
  private pendingRowScrollRaf: any = null;
  private targetRowElement: HTMLElement | null = null;

  private constructor() {}

  public static getInstance(): TvScrollService {
    if (!TvScrollService.instance) {
      TvScrollService.instance = new TvScrollService();
    }
    return TvScrollService.instance;
  }

  /**
   * Centralização vertical coordenada de carrossel de conteúdo.
   * Elimina chamadas concorrentes e saltos bruscos ao navegar com setas verticais.
   */
  public scrollToRow(element: HTMLElement | null): void {
    if (!element) return;
    if (this.isScrollingToHero) return;

    // Prioridade máxima ao controle remoto: pausa pré-carregamento durante o deslocamento
    tvImagePreloaderService.pause(180);

    this.targetRowElement = element;
    if (this.pendingRowScrollRaf !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.pendingRowScrollRaf);
      } else {
        clearTimeout(this.pendingRowScrollRaf);
      }
      this.pendingRowScrollRaf = null;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isRapid = now - this.lastRowScrollTime < 180;
    this.lastRowScrollTime = now;
    const isFireTv = tvPerformanceService.isFireTv();

    const executeScroll = () => {
      this.pendingRowScrollRaf = null;
      if (!this.targetRowElement || this.isScrollingToHero) return;

      try {
        if (typeof (this.targetRowElement as any).scrollIntoView === 'function') {
          // No Fire TV ou durante toques rápidos, comportamento 'auto' evita fila de animações no compositor
          this.targetRowElement.scrollIntoView({
            behavior: (isRapid || isFireTv) ? 'auto' : 'smooth',
            block: 'center'
          });
        }
      } catch {
        try {
          (this.targetRowElement as any).scrollIntoView?.(false);
        } catch {}
      }
      this.targetRowElement = null;
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.pendingRowScrollRaf = requestAnimationFrame(executeScroll);
    } else {
      this.pendingRowScrollRaf = setTimeout(executeScroll, 16);
    }
  }

  /**
   * Retorno suave e cinematográfico ao banner principal (Hero)
   * Garante uma única animação sem comandos concorrentes.
   */
  public scrollToHero(onComplete?: () => void): void {
    if (this.isScrollingToHero) return;

    tvImagePreloaderService.pause(250);

    if (typeof window === 'undefined') {
      onComplete?.();
      return;
    }

    const currentScrollY = window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
    if (currentScrollY <= 2) {
      onComplete?.();
      return;
    }

    this.isScrollingToHero = true;

    if (this.heroScrollTimer) {
      clearTimeout(this.heroScrollTimer);
      this.heroScrollTimer = null;
    }

    const isFireTv = tvPerformanceService.isFireTv();

    try {
      window.scrollTo({ 
        top: 0, 
        left: 0, 
        behavior: isFireTv ? 'auto' : 'smooth' 
      });
    } catch {
      window.scrollTo(0, 0);
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;

      window.removeEventListener('scrollend', handleScrollEnd);
      if (this.heroScrollTimer) {
        clearTimeout(this.heroScrollTimer);
        this.heroScrollTimer = null;
      }

      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }

      this.isScrollingToHero = false;
      onComplete?.();
    };

    const handleScrollEnd = () => finish();
    window.addEventListener('scrollend', handleScrollEnd, { once: true });
    this.heroScrollTimer = setTimeout(finish, isFireTv ? 120 : 380);
  }

  public isScrolling(): boolean {
    return this.isScrollingToHero || this.pendingRowScrollRaf !== null;
  }

  public reset(): void {
    if (this.heroScrollTimer) {
      clearTimeout(this.heroScrollTimer);
      this.heroScrollTimer = null;
    }
    if (this.pendingRowScrollRaf !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.pendingRowScrollRaf);
      } else {
        clearTimeout(this.pendingRowScrollRaf);
      }
      this.pendingRowScrollRaf = null;
    }
    this.targetRowElement = null;
    this.isScrollingToHero = false;
  }
}

export const tvScrollService = TvScrollService.getInstance();
