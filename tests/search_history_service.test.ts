import { describe, it, expect, beforeEach } from 'vitest';
import { searchHistoryService, STORAGE_KEY_SEARCH_HISTORY, MAX_SEARCH_HISTORY } from '../src/core/search/searchHistoryService';

// Mock localStorage para ambiente Node no Vitest
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

describe('SearchHistoryService - Histórico das Últimas 10 Pesquisas', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    searchHistoryService.clearHistory();
  });

  it('1. Deve iniciar vazio se não houver buscas salvas', () => {
    const history = searchHistoryService.getHistory();
    expect(history).toEqual([]);
  });

  it('2. Deve adicionar pesquisas mantendo a ordem da mais recente para a mais antiga', () => {
    searchHistoryService.addSearch('Matrix');
    searchHistoryService.addSearch('Vingadores');
    searchHistoryService.addSearch('Interestelar');

    const history = searchHistoryService.getHistory();
    expect(history).toEqual(['Interestelar', 'Vingadores', 'Matrix']);
  });

  it('3. Não deve criar duplicatas ignorando maiúsculas, minúsculas e espaços extras, movendo para o topo', () => {
    searchHistoryService.addSearch('Batman');
    searchHistoryService.addSearch('Superman');
    searchHistoryService.addSearch('Spider-Man');

    // Pesquisa Batman novamente com case e espaços diferentes
    searchHistoryService.addSearch('  batman  ');

    const history = searchHistoryService.getHistory();
    expect(history.length).toBe(3);
    expect(history[0]).toBe('batman'); // Movido para o topo
    expect(history).toEqual(['batman', 'Spider-Man', 'Superman']);
  });

  it('4. Deve limitar o histórico a exatamente 10 pesquisas', () => {
    for (let i = 1; i <= 15; i++) {
      searchHistoryService.addSearch(`Pesquisa ${i}`);
    }

    const history = searchHistoryService.getHistory();
    expect(history.length).toBe(MAX_SEARCH_HISTORY);
    expect(history[0]).toBe('Pesquisa 15');
    expect(history[MAX_SEARCH_HISTORY - 1]).toBe('Pesquisa 6');
  });

  it('5. Deve permitir remover itens individualmente pelo botão X', () => {
    searchHistoryService.addSearch('Filme A');
    searchHistoryService.addSearch('Filme B');
    searchHistoryService.addSearch('Filme C');

    const afterRemoval = searchHistoryService.removeSearch('filme b');
    expect(afterRemoval).toEqual(['Filme C', 'Filme A']);
    expect(searchHistoryService.getHistory()).toEqual(['Filme C', 'Filme A']);
  });

  it('6. Deve permitir limpar todo o histórico', () => {
    searchHistoryService.addSearch('Anime 1');
    searchHistoryService.addSearch('Anime 2');

    searchHistoryService.clearHistory();
    expect(searchHistoryService.getHistory()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY)).toBeNull();
  });

  it('7. Não deve adicionar termos vazios ou compostos apenas de espaços', () => {
    searchHistoryService.addSearch('');
    searchHistoryService.addSearch('   ');
    expect(searchHistoryService.getHistory()).toEqual([]);
  });
});
