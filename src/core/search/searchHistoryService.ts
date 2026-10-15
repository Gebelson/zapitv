/**
 * ZAPITV — SEARCH HISTORY SERVICE
 * 
 * Gerencia o histórico das últimas 10 pesquisas realizadas na barra de busca:
 * - Armazenamento persistente no navegador (localStorage), sem exigir login.
 * - Eliminação de duplicatas com case-insensitive e trim de espaços extras.
 * - Move o termo pesquisado para o topo (ordem da mais recente para a mais antiga).
 * - Suporte à remoção individual (X) e limpeza total ("Limpar histórico").
 * - Notificação de mudanças via CustomEvent para sincronização reativa.
 */

export const STORAGE_KEY_SEARCH_HISTORY = 'zapitv_search_history';
export const EVENT_SEARCH_HISTORY_CHANGED = 'zapitv_search_history_changed';
export const MAX_SEARCH_HISTORY = 10;

class SearchHistoryService {
  private memoryCache: string[] | null = null;

  /**
   * Obtém a lista das últimas pesquisas (máximo 10, da mais recente para a mais antiga).
   */
  public getHistory(): string[] {
    if (this.memoryCache !== null) {
      return [...this.memoryCache];
    }

    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
      if (!raw) {
        this.memoryCache = [];
        return [];
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Sanitiza e garante sem duplicatas
        const sanitized = this.normalizeAndDeduplicate(parsed).slice(0, MAX_SEARCH_HISTORY);
        this.memoryCache = sanitized;
        return [...sanitized];
      }
    } catch (e) {
      console.warn('[SearchHistoryService] Erro ao ler histórico do localStorage:', e);
    }

    this.memoryCache = [];
    return [];
  }

  /**
   * Registra uma pesquisa efetivamente realizada.
   * Se já existir, remove a ocorrência anterior e posiciona o termo no topo (mais recente).
   * Limita a 10 itens.
   */
  public addSearch(query: string): string[] {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return this.getHistory();
    }

    const current = this.getHistory();
    const queryLower = trimmed.toLowerCase();

    // Filtra duplicatas ignorando maiúsculas, minúsculas e espaços extras
    const filtered = current.filter(item => item.trim().toLowerCase() !== queryLower);

    // Insere no topo e limita a 10
    const updated = [trimmed, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    this.save(updated);
    return updated;
  }

  /**
   * Remove uma pesquisa individual do histórico.
   */
  public removeSearch(query: string): string[] {
    const trimmedLower = (query || '').trim().toLowerCase();
    const current = this.getHistory();
    const updated = current.filter(item => item.trim().toLowerCase() !== trimmedLower);
    this.save(updated);
    return updated;
  }

  /**
   * Limpa todo o histórico de pesquisas.
   */
  public clearHistory(): void {
    this.save([]);
  }

  /**
   * Inscreve um ouvinte para alterações no histórico de pesquisas.
   */
  public subscribe(listener: (history: string[]) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      listener(customEvent.detail || this.getHistory());
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_SEARCH_HISTORY) {
        this.memoryCache = null;
        listener(this.getHistory());
      }
    };

    window.addEventListener(EVENT_SEARCH_HISTORY_CHANGED, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(EVENT_SEARCH_HISTORY_CHANGED, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }

  private save(history: string[]): void {
    this.memoryCache = [...history];

    if (typeof localStorage !== 'undefined') {
      try {
        if (history.length === 0) {
          localStorage.removeItem(STORAGE_KEY_SEARCH_HISTORY);
        } else {
          localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(history));
        }
      } catch (e) {
        console.warn('[SearchHistoryService] Erro ao salvar histórico no localStorage:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_SEARCH_HISTORY_CHANGED, { detail: history }));
    }
  }

  private normalizeAndDeduplicate(list: any[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of list) {
      if (typeof item === 'string') {
        const clean = item.trim();
        const key = clean.toLowerCase();
        if (clean && !seen.has(key)) {
          seen.add(key);
          result.push(clean);
        }
      }
    }

    return result;
  }
}

export const searchHistoryService = new SearchHistoryService();
