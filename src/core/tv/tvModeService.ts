/**
 * TV Mode Service for ZapiTV
 * Gerencia a ativação, persistência e detecção do Modo TV (Smart TVs / Media Station X / Samsung The Frame).
 */

type TvModeListener = (isTv: boolean) => void;

class TvModeService {
  private static instance: TvModeService | null = null;
  private isTv: boolean = false;
  private isDiag: boolean = false;
  private listeners: Set<TvModeListener> = new Set();
  private initialized: boolean = false;

  private constructor() {
    this.init();
  }

  public static getInstance(): TvModeService {
    if (!TvModeService.instance) {
      TvModeService.instance = new TvModeService();
    }
    return TvModeService.instance;
  }

  private init(): void {
    if (typeof window === 'undefined') return;
    if (this.initialized) return;
    this.initialized = true;

    try {
      // Limpa dados legados de localStorage/sessionStorage que poderiam vazar para o desktop
      localStorage.removeItem('zapitv_tv_mode');
      sessionStorage.removeItem('zapitv_tv_mode');

      const urlParams = new URLSearchParams(window.location.search);
      const tvParam = urlParams.get('tv');
      const diagParam = urlParams.get('tvdiag') ?? urlParams.get('tv_diag');
      const isTvPath = window.location.pathname.startsWith('/tv');

      // O modo TV é estritamente ativado pela rota /tv ou pelo parâmetro explícito ?tv=1
      if (isTvPath || tvParam === '1' || tvParam === 'true') {
        this.isTv = true;
      } else {
        // Rotas normais (desktop/mobile) NUNCA ativam modo TV automaticamente
        this.isTv = false;
      }

      // Verificação do parâmetro de diagnóstico ?tvdiag=
      if (diagParam === '1' || diagParam === 'true') {
        this.isDiag = true;
        try { sessionStorage.setItem('zapitv_tv_diag', '1'); } catch {}
      } else if (diagParam === '0' || diagParam === 'false') {
        this.isDiag = false;
        try { sessionStorage.setItem('zapitv_tv_diag', '0'); } catch {}
      } else {
        try {
          this.isDiag = sessionStorage.getItem('zapitv_tv_diag') === '1';
        } catch {
          this.isDiag = false;
        }
      }
    } catch {
      this.isTv = false;
      this.isDiag = false;
    }
  }

  public isTvMode(): boolean {
    if (typeof window === 'undefined') return this.isTv;
    // A rota canônica /tv ou parâmetro explícito são as únicas fontes autorizadas.
    // O endereço normal / é permanentemente desktop/mobile.
    const isTvPath = window.location.pathname.startsWith('/tv');
    if (isTvPath) return true;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tvParam = urlParams.get('tv');
      if (tvParam === '1' || tvParam === 'true') return true;
    } catch {}
    return false;
  }

  public isDiagMode(): boolean {
    return this.isDiag;
  }

  public setTvMode(enabled: boolean): void {
    this.isTv = enabled;
    this.notify();
  }

  public setDiagMode(enabled: boolean): void {
    this.isDiag = enabled;
    try {
      sessionStorage.setItem('zapitv_tv_diag', enabled ? '1' : '0');
    } catch {}
    this.notify();
  }

  public subscribe(listener: TvModeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.isTv);
      } catch (err) {
        console.warn('[TvModeService] Erro em listener:', err);
      }
    }
  }

  /**
   * Preserva o parâmetro ?tv=1 durante a navegação interna sem perder estado.
   */
  public formatInternalRoute(path: string): string {
    if (!this.isTv) return path;
    const [pathname, search] = path.split('?');
    const params = new URLSearchParams(search || '');
    if (!params.has('tv')) {
      params.set('tv', '1');
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }
}

export const tvModeService = TvModeService.getInstance();
