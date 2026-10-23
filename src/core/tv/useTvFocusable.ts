import { useCallback, useState, useEffect, useRef } from 'react';
import { useFocusable as useNoriginFocusable, FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation';
import { tvModeService } from './tvModeService';
import { tvNavigationManager } from './tvNavigationManager';
import { uiSoundService } from '../audio/uiSoundService';

interface UseTvFocusableOptions {
  focusKey?: string;
  onEnterPress?: () => void;
  onArrowPress?: (direction: string) => boolean;
  onFocus?: (layout: FocusableComponentLayout) => void;
  onBlur?: (layout: FocusableComponentLayout) => void;
  autoScroll?: boolean;
  scrollBlock?: ScrollLogicalPosition;
  scrollInline?: ScrollLogicalPosition;
  focusable?: boolean;
  saveLastFocusedChild?: boolean;
  trackChildren?: boolean;
  soundType?: 'hover' | 'hoverCard' | 'none';
  enterSound?: 'click' | 'clickPrimary' | 'confirm' | 'toggle' | 'close' | 'watch' | 'none';
  isPlayerControl?: boolean;
}

export function useTvFocusable({
  focusKey,
  onEnterPress,
  onArrowPress,
  onFocus,
  onBlur,
  autoScroll = true,
  scrollBlock = 'nearest',
  scrollInline = 'center',
  focusable = true,
  saveLastFocusedChild = true,
  trackChildren = false,
  soundType,
  enterSound = 'click',
  isPlayerControl = false
}: UseTvFocusableOptions = {}) {
  // O hook do Norigin registra nós ainda na montagem, inclusive quando
  // focusable=false no desktop. Inicialize o adaptador antes do registro.
  tvNavigationManager.init();
  const dummyRef = useRef<any>(null);

  const [isTvActive, setIsTvActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv')) {
      return true;
    }
    return tvModeService.isTvMode();
  });

  useEffect(() => {
    return tvModeService.subscribe((tvState) => {
      const active = (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv')) || tvState;
      setIsTvActive(active);
    });
  }, []);

  const isEffectiveTv = (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv')) || isTvActive;

  const handleFocus = useCallback((layout: FocusableComponentLayout) => {
    if (!isEffectiveTv) return;
    if (autoScroll && norigin.ref.current) {
      try {
        (norigin.ref.current as any).scrollIntoView({
          behavior: 'smooth',
          block: scrollBlock,
          inline: scrollInline
        });
      } catch {
        try {
          (norigin.ref.current as any).scrollIntoView(false);
        } catch {}
      }
    }

    // Tocar efeito sonoro de foco espacial (hover ou hoverCard) quando decorrente de ação intencional do controle remoto
    if (tvNavigationManager.isNavigatingByUser() && soundType !== 'none') {
      const isCard = soundType === 'hoverCard' ||
        (soundType !== 'hover' && (
          Boolean(focusKey?.startsWith('row-')) ||
          Boolean(focusKey?.includes('card')) ||
          Boolean(focusKey?.startsWith('episode-'))
        ));
      uiSoundService.play(isCard ? 'hoverCard' : 'hover', { playerControl: isPlayerControl });
    }

    onFocus?.(layout);
  }, [autoScroll, isEffectiveTv, onFocus, scrollBlock, scrollInline, soundType, focusKey, isPlayerControl]);

  const norigin = useNoriginFocusable<object, any>({
    focusKey,
    onEnterPress: () => {
      if (isEffectiveTv && focusable) {
        const before = performance.now();
        onEnterPress?.();
        if (enterSound !== 'none') {
          queueMicrotask(() => {
            if (uiSoundService.getLastAnyPlayed() >= before) return;
            uiSoundService.play(enterSound, { playerControl: isPlayerControl });
          });
        }
      }
    },
    onArrowPress: (direction: string) => {
      if (!isEffectiveTv) return false;
      if (onArrowPress) {
        return onArrowPress(direction);
      }
      return true;
    },
    onFocus: handleFocus,
    onBlur,
    focusable: isEffectiveTv ? focusable : false,
    saveLastFocusedChild,
    trackChildren
  });

  if (!isEffectiveTv) {
    return {
      ref: dummyRef,
      focused: false,
      hasFocusedChild: false,
      focusSelf: () => {},
      focusKey: focusKey || ''
    };
  }

  return {
    ref: norigin.ref,
    focused: norigin.focused,
    hasFocusedChild: norigin.hasFocusedChild,
    focusSelf: norigin.focusSelf,
    focusKey: norigin.focusKey
  };
}
