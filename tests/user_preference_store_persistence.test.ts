import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage para ambiente Node no Vitest
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (index: number) => Object.keys(store)[index] || null,
  get length() { return Object.keys(store).length; }
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

if (typeof window === 'undefined') {
  (global as any).window = { localStorage: mockLocalStorage };
} else {
  (window as any).localStorage = mockLocalStorage;
}

import { userPreferenceStore, UserPreferenceStore } from '../src/core/recommendations/userPreferenceStore';
import { recommendationEngine } from '../src/core/recommendations/recommendationEngine';
import { hybridRecommendationEngine } from '../src/core/recommendations/hybridRecommendationEngine';
import { ContentType, ContentItem } from '../types';

describe('UserPreferenceStore - Correção Crítica de persistProfile e Robustez no StrictMode', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('1. Deve possuir o método persistProfile definido e acessível como função', () => {
    expect(typeof userPreferenceStore.persistProfile).toBe('function');
  });

  it('2. setProfileMetadata deve executar sem erros e persistir os metadados do perfil', async () => {
    const profileId = 'profile_test_1';
    
    // Executa setProfileMetadata (anteriormente gerava: Uncaught TypeError: this.persistProfile is not a function)
    expect(() => {
      userPreferenceStore.setProfileMetadata(profileId, { isChild: true });
    }).not.toThrow();

    const profile = userPreferenceStore.getPreferencesSync(profileId);
    expect(profile.isChild).toBe(true);

    // Aguarda ciclo de microtask para persistência
    await userPreferenceStore.persistProfile(profileId, profile);

    const savedRaw = mockLocalStorage.getItem(`zapitv_user_prefs_${profileId}`);
    expect(savedRaw).not.toBeNull();
    const saved = JSON.parse(savedRaw!);
    expect(saved.isChild).toBe(true);
  });

  it('3. Deve suportar execuções duplicadas e simultâneas (simulando React StrictMode mount -> unmount -> mount)', async () => {
    const profileId = 'profile_strict_mode';

    // Simula execução duplicada do StrictMode em App.tsx (linha 253)
    expect(() => {
      userPreferenceStore.setProfileMetadata(profileId, { isChild: false });
      userPreferenceStore.setProfileMetadata(profileId, { isChild: false });
      userPreferenceStore.setProfileMetadata(profileId, { isChild: false });
    }).not.toThrow();

    const profile = userPreferenceStore.getPreferencesSync(profileId);
    expect(profile.isChild).toBe(false);

    // Troca para perfil infantil duplicadamente
    expect(() => {
      userPreferenceStore.setProfileMetadata(profileId, { isChild: true });
      userPreferenceStore.setProfileMetadata(profileId, { isChild: true });
    }).not.toThrow();

    const updatedProfile = userPreferenceStore.getPreferencesSync(profileId);
    expect(updatedProfile.isChild).toBe(true);
  });

  it('4. computeProfileFromHistory e interações devem preservar o metadado isChild', async () => {
    const profileId = 'profile_kids_preservation';
    userPreferenceStore.setProfileMetadata(profileId, { isChild: true });

    const mockItem: ContentItem = {
      id: 'movie_shrek',
      title: 'Shrek',
      type: ContentType.MOVIE,
      genres: ['Animação', 'Comédia', 'Família']
    };

    // Registra reprodução
    await userPreferenceStore.recordPlayback(mockItem, 3600, 4000, false, profileId);

    const profileAfterPlayback = userPreferenceStore.getPreferencesSync(profileId);
    expect(profileAfterPlayback.isChild).toBe(true);
    expect(profileAfterPlayback.genreAffinities['Animação']).toBeGreaterThan(0);
    expect(profileAfterPlayback.watchedContentIds).toContain('movie_shrek');
  });

  it('5. seedFromExistingContinuity deve hidratar e persistir sem erros', async () => {
    const profileId = 'profile_continuity';
    userPreferenceStore.setProfileMetadata(profileId, { isChild: false });

    const continueWatching = [
      {
        item: {
          id: 'movie_matrix',
          title: 'Matrix',
          type: ContentType.MOVIE,
          genres: ['Ação', 'Ficção Científica']
        } as ContentItem,
        percentage: 95,
        currentTime: 7000,
        duration: 7200
      }
    ];

    const favorites = [
      {
        id: 'series_breaking_bad',
        title: 'Breaking Bad',
        type: ContentType.SERIES,
        genres: ['Drama', 'Crime']
      } as ContentItem
    ];

    expect(() => {
      userPreferenceStore.seedFromExistingContinuity(profileId, continueWatching, favorites);
    }).not.toThrow();

    const profile = userPreferenceStore.getPreferencesSync(profileId);
    expect(profile.completedContentIds).toContain('movie_matrix');
    expect(profile.favoriteContentIds).toContain('series_breaking_bad');
    expect(profile.genreAffinities['Ficção Científica']).toBeGreaterThan(0);
  });

  it('6. Tolerância a falhas: persistProfile não deve travar a aplicação mesmo se storage falhar', async () => {
    const profileId = 'profile_failing_storage';
    const storeInstance = new UserPreferenceStore();

    // Simula erro no localStorage
    const originalSetItem = mockLocalStorage.setItem;
    mockLocalStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    try {
      // Não deve lançar exceção não capturada
      await expect(storeInstance.persistProfile(profileId)).resolves.not.toThrow();
      expect(() => {
        storeInstance.setProfileMetadata(profileId, { isChild: true });
      }).not.toThrow();
    } finally {
      mockLocalStorage.setItem = originalSetItem;
    }
  });

  it('7. Recomendações devem funcionar perfeitamente com o perfil salvo', async () => {
    const profileId = 'profile_rec_test';
    userPreferenceStore.setProfileMetadata(profileId, { isChild: true });

    const mockCatalog: ContentItem[] = [
      {
        id: 'movie_lion_king',
        title: 'O Rei Leão',
        type: ContentType.MOVIE,
        rating: 8.5,
        year: 1994,
        genres: ['Animação', 'Família'],
        availabilityStatus: 'verified'
      },
      {
        id: 'movie_gladiator',
        title: 'Gladiador',
        type: ContentType.MOVIE,
        rating: 8.5,
        year: 2000,
        genres: ['Ação', 'Drama'],
        availabilityStatus: 'verified'
      }
    ];

    const recs = recommendationEngine.sortCatalogByRelevance(
      mockCatalog,
      { profileId }
    );

    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
    // Em perfil infantil, a animação deve vir primeiro
    expect(recs[0].title).toBe('O Rei Leão');

    const hybridRecs = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      mockCatalog,
      { profileId }
    );
    expect(Array.isArray(hybridRecs)).toBe(true);
    expect(hybridRecs[0].title).toBe('O Rei Leão');
  });
});
