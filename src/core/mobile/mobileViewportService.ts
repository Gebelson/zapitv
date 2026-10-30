/**
 * ZAPITV — Mobile Viewport & Device Detection Service
 * 
 * Gerencia a detecção determinística de dispositivos móveis, smartphones e viewports,
 * separando claramente:
 * 1. Identificação do tipo físico de dispositivo (Smartphone, Tablet, Desktop, Smart TV).
 * 2. Dimensão atual do viewport (largura e altura).
 * 3. Orientação física da tela (Portrait vs Landscape).
 * 4. Isolamento estrito com o Modo TV (?tv=1 ou /tv) e Desktop.
 * 
 * Um smartphone continua sendo um smartphone mesmo quando colocado em landscape (> 768px),
 * garantindo que o aplicativo nunca monte acidentalmente a interface desktop no celular.
 */

import { useState, useEffect } from 'react';
import { tvModeService } from '../tv/tvModeService';

export const MOBILE_BREAKPOINT = 768;

export interface DeviceMetrics {
  isMobileDevice: boolean;
  isSmartphone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTv: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  width: number;
  height: number;
}

class MobileViewportService {
  private static instance: MobileViewportService | null = null;
  private isMobile: boolean = false;
  private listeners: Set<(isMobile: boolean) => void> = new Set();
  private mql: MediaQueryList | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): MobileViewportService {
    if (!MobileViewportService.instance) {
      MobileViewportService.instance = new MobileViewportService();
    }
    return MobileViewportService.instance;
  }

  /**
   * Identifica se o ambiente atual é Smart TV (/tv, ?tv=1 ou user-agent de TV)
   */
  public isTv(): boolean {
    if (typeof window === 'undefined') return false;
    if (tvModeService.isTvMode()) return true;
    if (window.location && (window.location.pathname.startsWith('/tv') || window.location.search.includes('tv=1'))) {
      return true;
    }
    const ua = (navigator.userAgent || '').toLowerCase();
    return /smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast.tv|tizen|webos/i.test(ua);
  }

  /**
   * Identifica se é fisicamente um dispositivo móvel (smartphone ou tablet),
   * garantindo isolamento estrito contra o Modo TV.
   */
  public isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isTv()) return false;

    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobileUa = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isIpad = /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const hasCoarseTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    
    // Menor dimensão da tela física (largura ou altura, invariante à rotação)
    const screenMinDim = typeof window.screen !== 'undefined'
      ? Math.min(window.screen.width || Infinity, window.screen.height || Infinity)
      : Infinity;

    return isMobileUa || isIpad || (hasCoarseTouch && screenMinDim <= 820);
  }

  /**
   * Identifica especificamente um smartphone (formato telefone),
   * que deve operar em portrait fora da reprodução e manter UX mobile mesmo em landscape.
   */
  public isSmartphone(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isTv()) return false;

    const ua = (navigator.userAgent || '').toLowerCase();
    const isPhoneUa = /iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua);
    const isTabletUa = /ipad|tablet/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const screenMinDim = typeof window.screen !== 'undefined'
      ? Math.min(window.screen.width || Infinity, window.screen.height || Infinity)
      : Infinity;

    // Se é smartphone por UA ou se a dimensão mínima da tela física é típica de smartphone (<= 500px)
    if (isPhoneUa) return true;
    if (isTabletUa && screenMinDim > 500) return false;
    
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return hasTouch && screenMinDim <= 500;
  }

  /**
   * Identifica se o dispositivo é um tablet
   */
  public isTablet(): boolean {
    return this.isMobileDevice() && !this.isSmartphone();
  }

  /**
   * Identifica se é um computador desktop / laptop
   */
  public isDesktop(): boolean {
    return !this.isMobileDevice() && !this.isTv();
  }

  public isLandscape(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.type) {
      return screen.orientation.type.startsWith('landscape');
    }
    return window.innerWidth > window.innerHeight;
  }

  public isPortrait(): boolean {
    return !this.isLandscape();
  }

  /**
   * Retorna a classificação completa do dispositivo e métricas de viewport
   */
  public getMetrics(): DeviceMetrics {
    const isTv = this.isTv();
    const isMobileDevice = !isTv && this.isMobileDevice();
    const isSmartphone = !isTv && this.isSmartphone();
    const isTablet = isMobileDevice && !isSmartphone;
    const isDesktop = !isTv && !isMobileDevice;
    const isLandscape = this.isLandscape();

    return {
      isMobileDevice,
      isSmartphone,
      isTablet,
      isDesktop,
      isTv,
      isLandscape,
      isPortrait: !isLandscape,
      width: typeof window !== 'undefined' ? window.innerWidth : 0,
      height: typeof window !== 'undefined' ? window.innerHeight : 0,
    };
  }

  /**
   * Determina se o layout mobile deve ser renderizado:
   * 1. NUNCA em Modo TV.
   * 2. SEMPRE em smartphones (mesmo em landscape quando width > 768px!).
   * 3. Em desktops/tablets, respeita o breakpoint de largura (< 768px).
   */
  public isMobileViewport(breakpoint: number = MOBILE_BREAKPOINT): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isTv()) return false;
    if (this.isSmartphone()) return true;
    return window.innerWidth < breakpoint;
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    const check = () => {
      this.update(this.isMobileViewport());
    };

    check();

    try {
      this.mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      const handler = () => {
        check();
      };

      if (this.mql.addEventListener) {
        this.mql.addEventListener('change', handler);
      } else {
        (this.mql as any).addListener(handler);
      }
    } catch {}

    window.addEventListener('resize', check, { passive: true });
    window.addEventListener('orientationchange', check, { passive: true });
  }

  private update(val: boolean): void {
    if (this.isMobile !== val) {
      this.isMobile = val;
      this.notify();
    }
  }

  private notify(): void {
    for (const l of this.listeners) {
      try { l(this.isMobile); } catch {}
    }
  }

  public subscribe(listener: (isMobile: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const mobileViewportService = MobileViewportService.getInstance();

export function useIsMobileViewport(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return mobileViewportService.isMobileViewport(breakpoint);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setIsMobile(mobileViewportService.isMobileViewport(breakpoint));
    };

    update();

    const unsub = mobileViewportService.subscribe(update);
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });

    return () => {
      unsub();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [breakpoint]);

  return isMobile;
}
