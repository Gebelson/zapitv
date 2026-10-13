/**
 * ZapiTV AutoPlay Service
 * 
 * Gerencia a preferência e o estado compartilhado da reprodução automática
 * de episódios no ZapiTV, sincronizando em tempo real as configurações gerais
 * do aplicativo e o menu de configurações do player.
 */

const STORAGE_KEY = 'zapitv_autoplay_next_episode';
const EVENT_NAME = 'zapitv_autoplay_changed';

class AutoPlayService {
  private enabled: boolean;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
    this.enabled = this.loadPreference();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.enabled = e.newValue !== 'false';
          this.notify();
        }
      });
      window.addEventListener(EVENT_NAME, (e: any) => {
        if (typeof e.detail?.enabled === 'boolean') {
          this.enabled = e.detail.enabled;
          this.notify();
        }
      });
    }
  }

  private loadPreference(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return true; // Ativado por padrão
      return stored !== 'false';
    } catch {
      return true;
    }
  }

  /**
   * Retorna se a reprodução automática de episódios está ativada.
   */
  public isAutoPlayEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Define o estado da reprodução automática, salvando no localStorage e sincronizando todos os componentes.
   */
  public setAutoPlayEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      }
    } catch (err) {
      console.warn('[AutoPlayService] Falha ao salvar no localStorage:', err);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled } }));
    }
    this.notify();
  }

  /**
   * Registra um listener para atualizações de preferência em tempo real.
   */
  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.enabled);
      } catch (err) {
        console.error('[AutoPlayService] Erro no listener:', err);
      }
    }
  }
}

export const autoPlayService = new AutoPlayService();
