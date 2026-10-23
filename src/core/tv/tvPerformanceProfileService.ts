/**
 * ZAPITV — TV PERFORMANCE PROFILE SERVICE
 * 
 * Configurações adaptativas por perfil de hardware para Smart TV:
 * - Alto Desempenho (high)
 * - Equilibrado (balanced)
 * - Econômico (eco - Samsung The Frame, Tizen, Media Station X)
 */

import { tvPerformanceService } from './tvPerformanceService';

export interface PerformanceProfileConfig {
  name: 'high' | 'balanced' | 'eco';
  bufferSlotsLeft: number;
  bufferSlotsRight: number;
  enableDynamicWillChange: boolean;
  skipUnfocusedBlurGlow: boolean;
  renderOffscreenRows: boolean;
  maxDistantRowRenderDistance: number;
  optimizeImageResolution: boolean;
}

const PROFILES: Record<'high' | 'balanced' | 'eco', PerformanceProfileConfig> = {
  high: {
    name: 'high',
    bufferSlotsLeft: 2,
    bufferSlotsRight: 6,
    enableDynamicWillChange: true,
    skipUnfocusedBlurGlow: true,
    renderOffscreenRows: true,
    maxDistantRowRenderDistance: 4,
    optimizeImageResolution: true
  },
  balanced: {
    name: 'balanced',
    bufferSlotsLeft: 1,
    bufferSlotsRight: 5,
    enableDynamicWillChange: true,
    skipUnfocusedBlurGlow: true,
    renderOffscreenRows: false,
    maxDistantRowRenderDistance: 3,
    optimizeImageResolution: true
  },
  eco: {
    name: 'eco',
    bufferSlotsLeft: 1,
    bufferSlotsRight: 4,
    enableDynamicWillChange: true,
    skipUnfocusedBlurGlow: true,
    renderOffscreenRows: false,
    maxDistantRowRenderDistance: 2,
    optimizeImageResolution: true
  }
};

class TvPerformanceProfileService {
  private static instance: TvPerformanceProfileService;

  private constructor() {}

  public static getInstance(): TvPerformanceProfileService {
    if (!TvPerformanceProfileService.instance) {
      TvPerformanceProfileService.instance = new TvPerformanceProfileService();
    }
    return TvPerformanceProfileService.instance;
  }

  public getActiveConfig(): PerformanceProfileConfig {
    const profile = tvPerformanceService.getHardwareProfile();
    return PROFILES[profile] || PROFILES.balanced;
  }

  /**
   * Converte URLs do TMDB para dimensões ideais de pôster de Smart TV (260px em tela 1080p -> w342 / w500)
   * Previne decodificar imagens originais 4K/2K para cards de 260px na GPU da TV.
   */
  public getOptimizedPosterUrl(rawUrl?: string): string {
    if (!rawUrl) return '';
    if (rawUrl.includes('image.tmdb.org/t/p/original/')) {
      return rawUrl.replace('image.tmdb.org/t/p/original/', 'image.tmdb.org/t/p/w500/');
    }
    return rawUrl;
  }
}

export const tvPerformanceProfileService = TvPerformanceProfileService.getInstance();
