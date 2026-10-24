/**
 * ZAPITV — Mobile Viewport Service
 * 
 * Gerencia a detecção determinística de telas smartphones (< 768px)
 * isolando completamente tablets, desktop e Smart TV (?tv=1).
 */

import { useState, useEffect } from 'react';
import { tvModeService } from '../tv/tvModeService';

export const MOBILE_BREAKPOINT = 768;

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

  private init(): void {
    if (typeof window === 'undefined') return;

    const check = () => {
      if (tvModeService.isTvMode()) {
        this.isMobile = false;
        return;
      }
      this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    };

    check();

    try {
      this.mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      const handler = (e: MediaQueryListEvent) => {
        if (tvModeService.isTvMode()) {
          this.update(false);
          return;
        }
        this.update(e.matches);
      };

      if (this.mql.addEventListener) {
        this.mql.addEventListener('change', handler);
      } else {
        (this.mql as any).addListener(handler);
      }
    } catch {}

    window.addEventListener('resize', () => {
      check();
      this.notify();
    }, { passive: true });
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

  public isSmartphone(): boolean {
    if (typeof window === 'undefined') return false;
    if (tvModeService.isTvMode()) return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  public subscribe(listener: (isMobile: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const mobileViewportService = MobileViewportService.getInstance();

export function useIsMobileViewport(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (tvModeService.isTvMode()) return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateMatches = () => {
      if (tvModeService.isTvMode()) {
        setIsMobile(false);
        return;
      }
      setIsMobile(window.innerWidth < breakpoint);
    };

    updateMatches();

    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (tvModeService.isTvMode()) {
        setIsMobile(false);
        return;
      }
      setIsMobile(e.matches);
    };

    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else {
      (mql as any).addListener(handler);
    }

    window.addEventListener('resize', updateMatches, { passive: true });

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler);
      } else {
        (mql as any).removeListener(handler);
      }
      window.removeEventListener('resize', updateMatches);
    };
  }, [breakpoint]);

  return isMobile;
}
