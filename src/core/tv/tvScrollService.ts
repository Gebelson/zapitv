/**
 * ZAPITV — TV SCROLL SERVICE
 * 
 * Gerenciador unificado de rolagem vertical cinematográfica e coordenada para Smart TV.
 * Elimina rolagens simultâneas, saltos de scrollTop e chamadas conflitantes de scrollIntoView.
 */

class TvScrollService {
  private static instance: TvScrollService;
  private isScrollingToHero: boolean = false;
  private heroScrollTimer: any = null;

  private constructor() {}

  public static getInstance(): TvScrollService {
    if (!TvScrollService.instance) {
      TvScrollService.instance = new TvScrollService();
    }
    return TvScrollService.instance;
  }

  /**
   * Retorno suave e cinematográfico ao banner principal (Hero)
   * Garante uma única animação sem comandos concorrentes.
   */
  public scrollToHero(onComplete?: () => void): void {
    if (this.isScrollingToHero) return;

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

    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
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
    this.heroScrollTimer = setTimeout(finish, 380);
  }

  public isScrolling(): boolean {
    return this.isScrollingToHero;
  }

  public reset(): void {
    if (this.heroScrollTimer) {
      clearTimeout(this.heroScrollTimer);
      this.heroScrollTimer = null;
    }
    this.isScrollingToHero = false;
  }
}

export const tvScrollService = TvScrollService.getInstance();
