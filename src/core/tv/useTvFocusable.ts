import { useCallback, useState, useEffect } from 'react';
import { useFocusable as useNoriginFocusable, FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation';
import { tvModeService } from './tvModeService';

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
  trackChildren = false
}: UseTvFocusableOptions = {}) {
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

  const handleFocus = useCallback((layout: FocusableComponentLayout) => {
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
    onFocus?.(layout);
  }, [autoScroll, onFocus, scrollBlock, scrollInline]);

  const norigin = useNoriginFocusable<object, any>({
    focusKey,
    onEnterPress: () => {
      if (focusable) {
        onEnterPress?.();
      }
    },
    onArrowPress: (direction: string) => {
      if (onArrowPress) {
        return onArrowPress(direction);
      }
      return true;
    },
    onFocus: handleFocus,
    onBlur,
    focusable: focusable,
    saveLastFocusedChild,
    trackChildren
  });

  // Em rotas que começam com /tv, o componente é sempre ativo para controle remoto
  const isEffectiveTv = (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv')) || isTvActive;

  if (!isEffectiveTv) {
    return {
      ref: norigin.ref,
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
