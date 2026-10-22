import { useEffect, useRef, useState } from 'react';
import { tvNavigationManager } from './tvNavigationManager';

export const TV_IDLE_MS = 5 * 60 * 1000;

const isSystemKey = (event: KeyboardEvent): boolean =>
  /^(Volume|AudioVolume|Power|Brightness)/i.test(event.key) ||
  [447, 448, 449].includes(event.keyCode);

/** Um único timeout de inatividade; somente eventos reais do usuário o reiniciam. */
export function useTvIdle(enabled: boolean): boolean {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoveRef = useRef(0);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearIdle = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const scheduleIdle = () => {
      clearIdle();
      if (!enabled || document.hidden || activeRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        activeRef.current = true;
        setActive(true);
      }, TV_IDLE_MS);
    };
    const wake = () => {
      if (activeRef.current) {
        activeRef.current = false;
        setActive(false);
      }
      scheduleIdle();
    };

    if (!enabled) {
      activeRef.current = false;
      setActive(false);
      clearIdle();
      return;
    }

    scheduleIdle();
    tvNavigationManager.setActivityHandler(event => {
      if (!event.isTrusted || isSystemKey(event)) return false;
      const wasActive = activeRef.current;
      wake();
      return wasActive;
    });

    const pointerActivity = (event: Event) => {
      if (!event.isTrusted) return;
      const wasActive = activeRef.current;
      wake();
      if (wasActive) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClickRef.current = true;
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = setTimeout(() => { suppressClickRef.current = false; }, 600);
      }
    };
    const mouseActivity = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const now = Date.now();
      if (!activeRef.current && now - lastMoveRef.current < 1000) return;
      lastMoveRef.current = now;
      wake();
    };
    const consumeWakeClick = (event: MouseEvent) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const handleVisibility = () => {
      if (document.hidden) clearIdle();
      else scheduleIdle();
    };

    window.addEventListener('pointerdown', pointerActivity, true);
    window.addEventListener('mousedown', pointerActivity, true);
    window.addEventListener('touchstart', pointerActivity, { capture: true, passive: false });
    window.addEventListener('mousemove', mouseActivity, { passive: true });
    window.addEventListener('wheel', mouseActivity as EventListener, { passive: true });
    window.addEventListener('click', consumeWakeClick, true);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearIdle();
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressClickRef.current = false;
      tvNavigationManager.setActivityHandler(null);
      window.removeEventListener('pointerdown', pointerActivity, true);
      window.removeEventListener('mousedown', pointerActivity, true);
      window.removeEventListener('touchstart', pointerActivity, true);
      window.removeEventListener('mousemove', mouseActivity);
      window.removeEventListener('wheel', mouseActivity as EventListener);
      window.removeEventListener('click', consumeWakeClick, true);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled]);

  return active;
}
