import { ContentItem, ContentType, HeroTag } from '../../../types';
import { theatricalFilterService } from './theatricalFilterService';
import { catalogEligibilityService } from './CatalogEligibilityService';
import { deduplicateContentItems } from './catalogDeduplication';

export const HERO_CAROUSEL_STORAGE_KEY = 'zapitv_hero_carousel_v1';
export const EVENT_HERO_CAROUSEL_UPDATED = 'zapitv_hero_carousel_updated';
export const MAX_HERO_DISPLAY_COUNT = 6;

/**
 * Banners de Destaque Padrão Oficiais do ZapiTV
 * Inclui "Verdade Oculta" e as maiores obras em alta com metadados e backdrops oficiais em alta resolução.
 */
export const DEFAULT_HERO_BANNER_SEEDS: ContentItem[] = [
  {
    id: 'series-verdade-oculta-2024',
    title: 'Verdade Oculta',
    originalTitle: 'Disclaimer',
    type: ContentType.SERIES,
    rating: 8.4,
    year: 2024,
    image: 'https://images.metahub.space/poster/medium/tt16294384/img',
    backdrop: 'https://images.metahub.space/background/medium/tt16294384/img',
    description: 'Uma conceituada jornalista investigativa descobre que é a personagem principal de um romance que expõe um segredo perturbador de seu passado que ela tentou enterrar por décadas.',
    genres: ['Suspense', 'Drama', 'Mistério'],
    imdbId: 'tt16294384',
    isFeatured: true,
    heroTags: [
      { id: 'tag-vo-1', text: 'Top 10', style: 'solid', color: '#ea580c' },
      { id: 'tag-vo-2', text: 'Série em Alta', style: 'transparent', color: '#ffffff' },
      { id: 'tag-vo-3', text: '4K HDR', style: 'transparent', color: '#007df7' }
    ]
  },
  {
    id: 'movie-digger-2026',
    title: 'Digger',
    originalTitle: 'Digger',
    type: ContentType.MOVIE,
    rating: 7.8,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/1ATXKrIPJyKNwnJ6lcG088Sa6zi.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/b7t3r39Oll5qPxBKzLZ8eHMBD7l.jpg',
    description: 'Em uma região montanhosa e remota, um homem solitário se vê diante de conflitos do passado quando seu filho reaparece inesperadamente.',
    genres: ['Aventura', 'Drama', 'Ação'],
    imdbId: 'tt31454558',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    heroTags: [
      { id: 'tag-dig-1', text: 'Novo Lançamento', style: 'solid', color: '#2563eb' },
      { id: 'tag-dig-2', text: 'Dublado PT-BR', style: 'transparent', color: '#ffffff' }
    ]
  },
  {
    id: 'movie-outra-mamae-2026',
    title: 'Outra Mamãe',
    originalTitle: 'Another Mother',
    type: ContentType.MOVIE,
    rating: 7.4,
    year: 2026,
    image: 'https://images.metahub.space/poster/medium/tt21440780/img',
    backdrop: 'https://images.metahub.space/background/medium/tt21440780/img',
    description: 'Após uma perda devastadora, uma mulher descobre verdades perturbadoras sobre a nova família que tenta acolhê-la.',
    genres: ['Suspense', 'Mistério', 'Drama'],
    imdbId: 'tt21440780',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    heroTags: [
      { id: 'tag-om-1', text: 'Suspense Psicológico', style: 'solid', color: '#9333ea' },
      { id: 'tag-om-2', text: 'Exclusivo ZapiTV', style: 'transparent', color: '#ffffff' }
    ]
  },
  {
    id: 'movie-verity-2026',
    title: 'Verity',
    originalTitle: 'Verity',
    type: ContentType.MOVIE,
    rating: 8.1,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/6Qf3sylInJeyK0fFTfjprnGIXCF.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/6Qf3sylInJeyK0fFTfjprnGIXCF.jpg',
    description: 'Uma escritora em dificuldades financeiras aceita a proposta de concluir a série de sucesso de uma famosa autora incapacitada, descobrindo segredos aterrorizantes em seus manuscritos.',
    genres: ['Romance', 'Mistério', 'Drama'],
    imdbId: 'tt15888806',
    isFeatured: true,
    heroTags: [
      { id: 'tag-ver-1', text: 'Mais Votado', style: 'solid', color: '#dc2626' },
      { id: 'tag-ver-2', text: 'Alta Tensão', style: 'transparent', color: '#ffffff' }
    ]
  },
  {
    id: 'movie-exorcista-martires-2026',
    title: 'O Exorcista: Mártires',
    originalTitle: 'The Exorcist: Martyrs',
    type: ContentType.MOVIE,
    rating: 7.2,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/i3kvS445sWWIhuxgXywPuUcsoP0.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/ePIY6b8TlIjqFzK1JKANPhxUIPn.jpg',
    description: 'Dois padres investigam uma possessão demoníaca sem precedentes que ameaça a fé da humanidade.',
    genres: ['Terror', 'Mistério'],
    imdbId: 'tt28704204',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    heroTags: [
      { id: 'tag-exo-1', text: 'Terror Sobrenatural', style: 'solid', color: '#000000' },
      { id: 'tag-exo-2', text: 'Estreia', style: 'transparent', color: '#ffffff' }
    ]
  },
  {
    id: 'movie-matchbox-2026',
    title: 'Matchbox: O Filme',
    originalTitle: 'Matchbox',
    type: ContentType.MOVIE,
    rating: 7.0,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/y6RIuwuxLG3Nsb37KUj5yatnTIp.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/y6RIuwuxLG3Nsb37KUj5yatnTIp.jpg',
    description: 'Uma emocionante aventura de perseguições e ação em alta velocidade inspirada no lendário universo automobilístico.',
    genres: ['Ação', 'Aventura'],
    imdbId: 'tt33423719',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    heroTags: [
      { id: 'tag-mb-1', text: 'Ação sem Limites', style: 'solid', color: '#ea580c' },
      { id: 'tag-mb-2', text: 'Família', style: 'transparent', color: '#ffffff' }
    ]
  },
  {
    id: 'series-breaking-bad-2008',
    title: 'Breaking Bad',
    originalTitle: 'Breaking Bad',
    type: ContentType.SERIES,
    rating: 9.5,
    year: 2008,
    image: 'https://images.metahub.space/poster/medium/tt0903747/img',
    backdrop: 'https://images.metahub.space/background/medium/tt0903747/img',
    description: 'Um professor de química diagnosticado com câncer terminal se junta a um ex-aluno para produzir e comercializar metanfetamina, garantindo o futuro financeiro de sua família.',
    genres: ['Crime', 'Drama', 'Suspense'],
    imdbId: 'tt0903747',
    isFeatured: true,
    heroTags: [
      { id: 'tag-bb-1', text: 'Clássico Imbatível', style: 'solid', color: '#16a34a' },
      { id: 'tag-bb-2', text: 'Nota 9.5 IMDb', style: 'transparent', color: '#ffffff' }
    ]
  },
  {
    id: 'series-dark-matter',
    title: 'Matéria Escura',
    originalTitle: 'Dark Matter',
    type: ContentType.SERIES,
    rating: 8.2,
    year: 2024,
    image: 'https://images.metahub.space/poster/medium/tt19231492/img',
    backdrop: 'https://images.metahub.space/background/medium/tt19231492/img',
    description: 'O físico Jason Dessen é sequestrado e acorda em uma versão alternativa de sua vida, lutando para retornar à sua verdadeira família através de realidades paralelas.',
    genres: ['Ficção Científica', 'Drama', 'Mistério'],
    imdbId: 'tt19231492',
    isFeatured: true,
    heroTags: [
      { id: 'tag-dm-1', text: 'Ficção Científica', style: 'solid', color: '#2563eb' },
      { id: 'tag-dm-2', text: 'Temporada Completa', style: 'transparent', color: '#ffffff' }
    ]
  }
];

class HeroCarouselStore {
  private static instance: HeroCarouselStore;
  private cachedItems: ContentItem[] | null = null;
  private listeners = new Set<(items: ContentItem[]) => void>();

  private constructor() {}

  public static getInstance(): HeroCarouselStore {
    if (!HeroCarouselStore.instance) {
      HeroCarouselStore.instance = new HeroCarouselStore();
    }
    return HeroCarouselStore.instance;
  }

  /**
   * Obtém a lista de itens configurados para o Carrossel da Home.
   * Prioridade absoluta:
   * 1. Alterações manuais salvas no storage local (respeitando a ordem definida pelo usuário).
   * 2. Itens marcados como isFeatured no catálogo principal (preservando edições do usuário).
   * 3. Sementes padrão com "Verdade Oculta" e títulos de destaque.
   */
  public getCarouselItems(catalogContent: ContentItem[] = []): ContentItem[] {
    if (this.cachedItems && this.cachedItems.length > 0) {
      return this.cachedItems;
    }

    // 1. Tenta carregar personalizações salvas pelo usuário no storage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = theatricalFilterService.filterAllowedMoviesSync(parsed);
            if (sanitized.length > 0) {
              this.cachedItems = sanitized;
              return sanitized;
            }
          }
        }
      } catch (err) {
        console.warn('[HeroCarouselStore] Falha ao ler storage local:', err);
      }
    }

    // 2. Se o catálogo do usuário já possui itens em destaque (isFeatured: true)
    const manualFeatured = (catalogContent || []).filter(item => item && item.isFeatured === true);
    
    // Procura se existe algum item "Verdade Oculta" nas edições do usuário
    const userVerdadeOculta = manualFeatured.find(i => 
      i.title.toLowerCase().includes('verdade') || 
      i.title.toLowerCase().includes('disclaimer') ||
      (i.imdbId && i.imdbId === 'tt16294384')
    ) || DEFAULT_HERO_BANNER_SEEDS[0];

    // Monta a lista combinada mantendo Verdade Oculta na dianteira
    const otherManual = manualFeatured.filter(i => i.id !== userVerdadeOculta.id);
    
    let combined: ContentItem[] = [userVerdadeOculta, ...otherManual];

    // Se houver menos de 4 itens, complementa com os seeds oficiais para enriquecer o carrossel
    if (combined.length < DEFAULT_HERO_BANNER_SEEDS.length) {
      const existingIds = new Set(combined.map(i => i.id));
      for (const seed of DEFAULT_HERO_BANNER_SEEDS) {
        if (!existingIds.has(seed.id)) {
          combined.push(seed);
          existingIds.add(seed.id);
        }
      }
    }

    const eligible = catalogEligibilityService.filterEligibleItemsSync(combined);
    const sanitized = theatricalFilterService.filterAllowedMoviesSync(eligible);
    const finalItems = deduplicateContentItems(sanitized.length > 0 ? sanitized : DEFAULT_HERO_BANNER_SEEDS);

    this.cachedItems = finalItems;
    return finalItems;
  }

  /**
   * Retorna os conteúdos exibidos simultaneamente no carrossel da Home (exatamente até 6 itens).
   * - Prioriza os banners manuais na ordem configurada.
   * - Se houver menos de 6 banners manuais, completa as vagas com títulos elegíveis das sementes oficiais.
   * - Garante ausência total de duplicatas.
   * - Preserva todas as configurações manuais excedentes no store sem excluí-las.
   */
  public getDisplayItems(items: ContentItem[] = [], maxCount: number = MAX_HERO_DISPLAY_COUNT): ContentItem[] {
    const rawItems = items.length > 0 ? items : this.getCarouselItems();
    const sanitized = theatricalFilterService.filterAllowedMoviesSync(rawItems);
    
    const seenIds = new Set<string>();
    const result: ContentItem[] = [];

    // 1. Prioriza os itens configurados manualmente na ordem definida pelo usuário
    for (const item of sanitized) {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push(item);
      }
      if (result.length >= maxCount) break;
    }

    // 2. Caso existam menos de 6 banners manuais, completa as vagas com títulos disponíveis sem duplicações
    if (result.length < maxCount) {
      const eligibleSeeds = catalogEligibilityService.filterEligibleItemsSync(DEFAULT_HERO_BANNER_SEEDS);
      const sanitizedSeeds = theatricalFilterService.filterAllowedMoviesSync(eligibleSeeds);

      for (const seed of sanitizedSeeds) {
        if (seed && seed.id && !seenIds.has(seed.id)) {
          seenIds.add(seed.id);
          result.push(seed);
        }
        if (result.length >= maxCount) break;
      }
    }

    return result.slice(0, maxCount);
  }

  /**
   * Salva a lista de slides e sua ordem exata definida pelo usuário via "Editar Carrossel"
   */
  public saveCarouselItems(items: ContentItem[]): void {
    if (!items || items.length === 0) return;

    this.cachedItems = [...items];

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(HERO_CAROUSEL_STORAGE_KEY, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent(EVENT_HERO_CAROUSEL_UPDATED, { detail: items }));
      } catch (err) {
        console.error('[HeroCarouselStore] Erro ao persistir carrossel no storage:', err);
      }
    }

    this.notify(this.cachedItems);
  }

  /**
   * Restaura o carrossel padrão garantindo todos os slides oficiais
   */
  public resetToDefault(): ContentItem[] {
    this.cachedItems = [...DEFAULT_HERO_BANNER_SEEDS];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(HERO_CAROUSEL_STORAGE_KEY);
      } catch {}
    }
    this.notify(this.cachedItems);
    return this.cachedItems;
  }

  public subscribe(callback: (items: ContentItem[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(items: ContentItem[]): void {
    this.listeners.forEach(cb => {
      try {
        cb(items);
      } catch (err) {
        console.error('[HeroCarouselStore] Erro no listener:', err);
      }
    });
  }
}

export const heroCarouselStore = HeroCarouselStore.getInstance();
