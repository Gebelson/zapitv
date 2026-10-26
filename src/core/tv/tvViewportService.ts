/**
 * ZAPITV — TV VIEWPORT & SCALE SERVICE
 * 
 * Gerenciamento centralizado de escala e resolução responsiva para Smart TV.
 * Detecta e interpreta com precisão o viewport CSS real fornecido pelo navegador/WebView
 * (ex: 960x540 no Amazon Silk / Fire OS com DPR 2.0, 1280x720 com DPR 1.5, 1920x1080 em Full HD).
 * 
 * NÃO força artificialmente uma resolução fixa nem aplica transform: scale() / zoom global,
 * fornecendo em vez disso tokens e medidas responsivas calculadas para cada viewport.
 */

export type TvScaleCategory = 'compact' | 'standard' | 'expanded';

export interface TvViewportMetrics {
  width: number;
  height: number;
  dpr: number;
  screenWidth: number;
  screenHeight: number;
  visualViewportWidth: number;
  visualViewportHeight: number;
  scaleCategory: TvScaleCategory;
  // Tokens de layout calculados
  headerHeight: number;
  safeMarginX: number;
  navFontSize: number;
  navGap: number;
  heroTitleSize: number;
  heroBtnHeight: number;
  cardWidth: number;
  cardGap: number;
}

class TvViewportService {
  private static instance: TvViewportService;
  private currentMetrics: TvViewportMetrics;
  private subscribers = new Set<(metrics: TvViewportMetrics) => void>();
  private isListening = false;
  private resizeThrottleTimer: any = null;

  private constructor() {
    this.currentMetrics = this.computeMetrics();
    this.setupListeners();
    this.applyRootClasses();
  }

  public static getInstance(): TvViewportService {
    if (!TvViewportService.instance) {
      TvViewportService.instance = new TvViewportService();
    }
    return TvViewportService.instance;
  }

  /**
   * Calcula as métricas reais do viewport CSS do ambiente atual
   */
  public computeMetrics(): TvViewportMetrics {
    if (typeof window === 'undefined') {
      return {
        width: 1920,
        height: 1080,
        dpr: 1,
        screenWidth: 1920,
        screenHeight: 1080,
        visualViewportWidth: 1920,
        visualViewportHeight: 1080,
        scaleCategory: 'expanded',
        headerHeight: 96,
        safeMarginX: 64,
        navFontSize: 21,
        navGap: 32,
        heroTitleSize: 56,
        heroBtnHeight: 58,
        cardWidth: 275,
        cardGap: 24
      };
    }

    const width = window.innerWidth || document.documentElement?.clientWidth || 1920;
    const height = window.innerHeight || document.documentElement?.clientHeight || 1080;
    const dpr = window.devicePixelRatio || 1;
    const screenWidth = window.screen?.width || width;
    const screenHeight = window.screen?.height || height;
    const visualVp = window.visualViewport;
    const visualViewportWidth = visualVp ? Math.round(visualVp.width) : width;
    const visualViewportHeight = visualVp ? Math.round(visualVp.height) : height;

    // Categorização de escala da Smart TV:
    // - compact: Fire TV Stick (geralmente 960x540 CSS px) ou telas com largura <= 1080px ou altura <= 600px
    // - standard: 720p nativo (1280x720 CSS px) ou telas intermediárias (1081px a 1500px)
    // - expanded: 1080p nativo (1920x1080 CSS px), 4K ou telas amplas (> 1500px)
    let scaleCategory: TvScaleCategory = 'expanded';
    if (width <= 1080 || height <= 600) {
      scaleCategory = 'compact';
    } else if (width <= 1500 || height <= 800) {
      scaleCategory = 'standard';
    } else {
      scaleCategory = 'expanded';
    }

    // Parâmetros de design fluidos e proporcionais a cada categoria
    let headerHeight = 96;
    let safeMarginX = 64;
    let navFontSize = 21;
    let navGap = 32;
    let heroTitleSize = 56;
    let heroBtnHeight = 58;
    let cardWidth = 275;
    let cardGap = 24;

    if (scaleCategory === 'compact') {
      headerHeight = 64;
      safeMarginX = 36;
      navFontSize = 15;
      navGap = 14;
      heroTitleSize = 32;
      heroBtnHeight = 44;
      cardWidth = 205;
      cardGap = 16;
    } else if (scaleCategory === 'standard') {
      headerHeight = 80;
      safeMarginX = 48;
      navFontSize = 18;
      navGap = 22;
      heroTitleSize = 44;
      heroBtnHeight = 50;
      cardWidth = 240;
      cardGap = 20;
    }

    return {
      width,
      height,
      dpr,
      screenWidth,
      screenHeight,
      visualViewportWidth,
      visualViewportHeight,
      scaleCategory,
      headerHeight,
      safeMarginX,
      navFontSize,
      navGap,
      heroTitleSize,
      heroBtnHeight,
      cardWidth,
      cardGap
    };
  }

  private setupListeners(): void {
    if (typeof window === 'undefined' || this.isListening) return;
    this.isListening = true;

    const onResize = () => {
      if (this.resizeThrottleTimer) return;
      this.resizeThrottleTimer = setTimeout(() => {
        this.resizeThrottleTimer = null;
        this.currentMetrics = this.computeMetrics();
        this.applyRootClasses();
        this.notifySubscribers();
      }, 60);
    };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize, { passive: true });
    }
  }

  private applyRootClasses(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    // Atualiza classes semânticas no elemento raiz
    root.classList.remove('tv-vp-compact', 'tv-vp-standard', 'tv-vp-expanded');
    body.classList.remove('tv-vp-compact', 'tv-vp-standard', 'tv-vp-expanded');

    const catClass = `tv-vp-${this.currentMetrics.scaleCategory}`;
    root.classList.add(catClass);
    body.classList.add(catClass);

    // CSS Custom Properties para componentes acessarem nativamente em estilos
    root.style.setProperty('--tv-header-height', `${this.currentMetrics.headerHeight}px`);
    root.style.setProperty('--tv-safe-margin-x', `${this.currentMetrics.safeMarginX}px`);
    root.style.setProperty('--tv-card-width', `${this.currentMetrics.cardWidth}px`);
    root.style.setProperty('--tv-card-gap', `${this.currentMetrics.cardGap}px`);
  }

  public getMetrics(): TvViewportMetrics {
    return this.currentMetrics;
  }

  public subscribe(callback: (metrics: TvViewportMetrics) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentMetrics);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(cb => {
      try {
        cb(this.currentMetrics);
      } catch (err) {
        console.warn('[TvViewportService] Erro ao notificar subscriber:', err);
      }
    });
  }
}

export const tvViewportService = TvViewportService.getInstance();

import { useState, useEffect } from 'react';

export function useTvViewport(): TvViewportMetrics {
  const [metrics, setMetrics] = useState<TvViewportMetrics>(() => tvViewportService.getMetrics());

  useEffect(() => {
    return tvViewportService.subscribe(newMetrics => {
      setMetrics(newMetrics);
    });
  }, []);

  return metrics;
}
