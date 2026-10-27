/**
 * ZAPITV — TV VIEWPORT & SCALE SERVICE
 * 
 * Gerenciamento centralizado de escala e resolução responsiva para Smart TV.
 * Detecta e interpreta com precisão o viewport CSS real fornecido pelo navegador/WebView
 * (ex: 960x540 no Amazon Silk / Fire OS com DPR 2.0, 1280x720 com DPR 1.5, 1920x1080 em Full HD).
 * 
 * NÃO força artificialmente uma resolução fixa nem aplica transform: scale() / zoom global,
 * fornecendo em vez disso tokens e medidas responsivas calculadas para cada viewport.
 * 
 * Isola rigorosamente otimizações específicas do ecossistema Amazon Fire TV das demais Smart TVs
 * (Samsung Tizen, LG webOS, Media Station X e navegadores de TV).
 */

import { tvPerformanceService } from './tvPerformanceService';

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
  isFireTv: boolean;
  deviceFamily: 'firetv' | 'samsung' | 'msx' | 'generic';
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
   * Calcula as métricas reais do viewport CSS do ambiente atual,
   * diferenciando regras universais de layout das otimizações exclusivas de Fire TV.
   */
  public computeMetrics(customUa?: string): TvViewportMetrics {
    const ua = (customUa || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '').toLowerCase();
    const mockFamily = typeof window !== 'undefined' ? (window as any).__MOCK_DEVICE_FAMILY__ : undefined;

    const isExplicitNonFireTv = mockFamily ? mockFamily !== 'firetv' : (
      /tizen|maple|samsung.*(?:tv|smarttv)|webos|lg\s*browser/i.test(ua) || 
      (/mediastationx|media\s*station\s*x/i.test(ua) && !(/aft|amazon|fire/i.test(ua)))
    );

    if (typeof window === 'undefined') {
      const isFireTv = !isExplicitNonFireTv && (mockFamily === 'firetv' || tvPerformanceService.isFireTv(customUa));
      const deviceFamily = isFireTv ? 'firetv' : (mockFamily || tvPerformanceService.getDeviceFamily(customUa));

      return {
        width: 1920,
        height: 1080,
        dpr: 1,
        screenWidth: 1920,
        screenHeight: 1080,
        visualViewportWidth: 1920,
        visualViewportHeight: 1080,
        scaleCategory: 'expanded',
        isFireTv,
        deviceFamily,
        headerHeight: isFireTv ? 82 : 92,
        safeMarginX: isFireTv ? 56 : 64,
        logoIconSize: isFireTv ? 42 : 48,
        logoTextHeight: isFireTv ? 24 : 28,
        navFontSize: isFireTv ? 18 : 21,
        navGap: isFireTv ? 24 : 28,
        actionBtnSize: isFireTv ? 46 : 52,
        actionIconSize: isFireTv ? 23 : 26,
        heroTitleSize: 48,
        heroBtnHeight: 54,
        heroDotsBottom: 48,
        heroDotsWidth: 32,
        heroDotsHeight: 8,
        cardWidth: 265,
        cardGap: 20,
        rowTitleSize: 24,
        searchSidebarWidth: isFireTv ? 360 : 380,
        keyboardKeyHeight: isFireTv ? 42 : 46,
        keyboardFontSize: isFireTv ? 15 : 17,
        loaderSize: 120,
        hudMaxW: isFireTv ? 'max-w-[900px]' : 'max-w-5xl'
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

    // Detecção segura e isolada da família do dispositivo
    const isFireTv = !isExplicitNonFireTv && (
      mockFamily === 'firetv' ||
      tvPerformanceService.isFireTv(customUa) || 
      // Fallback para mock/ambiente de teste do Fire TV Stick (960x540 DPR 2.0) sem UA explícito de outra plataforma
      ((!ua || ua.includes('node')) && width <= 960 && height <= 540 && dpr >= 1.8)
    );
    const deviceFamily = isFireTv ? 'firetv' : (mockFamily || tvPerformanceService.getDeviceFamily(customUa));

    // Categorização de escala da Smart TV:
    // - compact: Fire TV Stick ou telas com largura <= 1080px ou altura <= 600px
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
    // Padrão não-Fire TV (Samsung Tizen, LG webOS, MSX, desktop) preservado integralmente
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
    let keyboardKeyHeight = 46;
    let keyboardFontSize = 17;
    let loaderSize = 120;
    let hudMaxW = 'max-w-5xl';

    if (isFireTv) {
      headerHeight = 82;
      safeMarginX = 56;
      logoIconSize = 42;
      logoTextHeight = 24;
      navFontSize = 18;
      navGap = 24;
      actionBtnSize = 46;
      actionIconSize = 23;
      searchSidebarWidth = 360;
      keyboardKeyHeight = 42;
      keyboardFontSize = 15;
      loaderSize = 104;
      hudMaxW = 'max-w-[900px]';
    }

    if (scaleCategory === 'compact') {
      if (isFireTv) {
        // Amazon Fire TV Stick compacto (960x540 / viewport reduzido)
        headerHeight = 52;
        safeMarginX = 28;
        logoIconSize = 30;
        logoTextHeight = 16;
        navFontSize = 12;
        navGap = 8;
        actionBtnSize = 34;
        actionIconSize = 16;
        heroTitleSize = 22;
        heroBtnHeight = 33;
        heroDotsBottom = 18;
        heroDotsWidth = 16;
        heroDotsHeight = 4;
        cardWidth = 132;
        cardGap = 12;
        rowTitleSize = 15;
        loaderSize = 68;
        hudMaxW = 'max-w-[620px]';
        searchSidebarWidth = 260;
        keyboardKeyHeight = 30;
        keyboardFontSize = 11;
      } else {
        // Smart TVs normais (Samsung Tizen, MSX, etc.): proporções originais
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
        cardWidth = 132;
        cardGap = 12;
        rowTitleSize = 16;
        loaderSize = 76;
        hudMaxW = 'max-w-3xl';
        searchSidebarWidth = 300;
        keyboardKeyHeight = 38;
        keyboardFontSize = 14;
      }
    } else if (scaleCategory === 'standard') {
      if (isFireTv) {
        // Amazon Fire TV standard (1280x720 / 720p)
        headerHeight = 68;
        safeMarginX = 42;
        logoIconSize = 37;
        logoTextHeight = 19;
        navFontSize = 15;
        navGap = 15;
        actionBtnSize = 38;
        actionIconSize = 19;
        heroTitleSize = 32;
        heroBtnHeight = 41;
        heroDotsBottom = 30;
        heroDotsWidth = 21;
        heroDotsHeight = 5;
        cardWidth = 175;
        cardGap = 16;
        rowTitleSize = 18;
        loaderSize = 84;
        hudMaxW = 'max-w-[760px]';
        searchSidebarWidth = 330;
        keyboardKeyHeight = 36;
        keyboardFontSize = 14;
      } else {
        // Smart TVs normais (Samsung Tizen, MSX, etc.): proporções originais
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
        cardWidth = 175;
        cardGap = 16;
        rowTitleSize = 20;
        loaderSize = 96;
        hudMaxW = 'max-w-4xl';
        searchSidebarWidth = 340;
        keyboardKeyHeight = 42;
        keyboardFontSize = 15;
      }
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
      isFireTv,
      deviceFamily,
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
        const next = this.computeMetrics();
        if (next.isFireTv && this.currentMetrics.isFireTv &&
          (Object.keys(next) as (keyof TvViewportMetrics)[]).every(key => next[key] === this.currentMetrics[key])) return;
        this.currentMetrics = next;
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
    root.classList.remove('tv-vp-compact', 'tv-vp-standard', 'tv-vp-expanded', 'tv-firetv');
    body.classList.remove('tv-vp-compact', 'tv-vp-standard', 'tv-vp-expanded', 'tv-firetv');

    const catClass = `tv-vp-${this.currentMetrics.scaleCategory}`;
    root.classList.add(catClass);
    body.classList.add(catClass);

    if (this.currentMetrics.isFireTv) {
      root.classList.add('tv-firetv');
      body.classList.add('tv-firetv');
    }

    // CSS Custom Properties para componentes acessarem nativamente em estilos
    root.style.setProperty('--tv-header-height', `${this.currentMetrics.headerHeight}px`);
    root.style.setProperty('--tv-safe-margin-x', `${this.currentMetrics.safeMarginX}px`);
    root.style.setProperty('--tv-card-width', `${this.currentMetrics.cardWidth}px`);
    root.style.setProperty('--tv-card-gap', `${this.currentMetrics.cardGap}px`);
    root.style.setProperty('--tv-keyboard-key-height', `${this.currentMetrics.keyboardKeyHeight}px`);
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
