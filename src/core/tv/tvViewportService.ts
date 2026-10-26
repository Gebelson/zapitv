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
  // Tokens de layout calculados proporcionalmente
  headerHeight: number;
  safeMarginX: number;
  logoIconSize: number;
  logoTextHeight: number;
  navFontSize: number;
  navGap: number;
  actionBtnSize: number;
  actionIconSize: number;
  heroTitleSize: number;
  heroBtnHeight: number;
  heroDotsBottom: number;
  heroDotsWidth: number;
  heroDotsHeight: number;
  cardWidth: number;
  cardGap: number;
  rowTitleSize: number;
  searchSidebarWidth: number;
  keyboardKeyHeight: number;
  keyboardFontSize: number;
  loaderSize: number;
  hudMaxW: string;
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
        headerHeight: 92,
        safeMarginX: 64,
        logoIconSize: 48,
        logoTextHeight: 28,
        navFontSize: 21,
        navGap: 28,
        actionBtnSize: 52,
        actionIconSize: 26,
        heroTitleSize: 48,
        heroBtnHeight: 54,
        heroDotsBottom: 48,
        heroDotsWidth: 32,
        heroDotsHeight: 8,
        cardWidth: 265,
        cardGap: 20,
        rowTitleSize: 24,
        searchSidebarWidth: 380,
        keyboardKeyHeight: 44,
        keyboardFontSize: 16,
        loaderSize: 120,
        hudMaxW: 'max-w-5xl'
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
    let headerHeight = 92;
    let safeMarginX = 64;
    let logoIconSize = 48;
    let logoTextHeight = 28;
    let navFontSize = 21;
    let navGap = 28;
    let actionBtnSize = 52;
    let actionIconSize = 26;
    let heroTitleSize = 48;
    let heroBtnHeight = 54;
    let heroDotsBottom = 48;
    let heroDotsWidth = 32;
    let heroDotsHeight = 8;
    let cardWidth = 265;
    let cardGap = 20;
    let rowTitleSize = 24;
    let searchSidebarWidth = 380;
    let keyboardKeyHeight = 44;
    let keyboardFontSize = 16;
    let loaderSize = 120;
    let hudMaxW = 'max-w-5xl';

    if (scaleCategory === 'compact') {
      headerHeight = 60;
      safeMarginX = 32;
      logoIconSize = 34;
      logoTextHeight = 18;
      navFontSize = 14;
      navGap = 10;
      actionBtnSize = 38;
      actionIconSize = 18;
      heroTitleSize = 24;
      heroBtnHeight = 36;
      heroDotsBottom = 20;
      heroDotsWidth = 18;
      heroDotsHeight = 4;
      // Proporção precisa para 6,5 capas na tela de 960x540 (6 completas + 48.5% da 7ª capa visível)
      cardWidth = 132;
      cardGap = 12;
      rowTitleSize = 16;
      searchSidebarWidth = 260;
      keyboardKeyHeight = 30;
      keyboardFontSize = 11;
      loaderSize = 76;
      hudMaxW = 'max-w-3xl';
    } else if (scaleCategory === 'standard') {
      headerHeight = 76;
      safeMarginX = 48;
      logoIconSize = 42;
      logoTextHeight = 22;
      navFontSize = 17;
      navGap = 18;
      actionBtnSize = 44;
      actionIconSize = 22;
      heroTitleSize = 36;
      heroBtnHeight = 46;
      heroDotsBottom = 34;
      heroDotsWidth = 24;
      heroDotsHeight = 6;
      // Proporção precisa para 6,5 capas na tela de 1280x720 (6 completas + 49% da 7ª capa visível)
      cardWidth = 175;
      cardGap = 16;
      rowTitleSize = 20;
      searchSidebarWidth = 330;
      keyboardKeyHeight = 36;
      keyboardFontSize = 14;
      loaderSize = 96;
      hudMaxW = 'max-w-4xl';
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
      logoIconSize,
      logoTextHeight,
      navFontSize,
      navGap,
      actionBtnSize,
      actionIconSize,
      heroTitleSize,
      heroBtnHeight,
      heroDotsBottom,
      heroDotsWidth,
      heroDotsHeight,
      cardWidth,
      cardGap,
      rowTitleSize,
      searchSidebarWidth,
      keyboardKeyHeight,
      keyboardFontSize,
      loaderSize,
      hudMaxW
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
