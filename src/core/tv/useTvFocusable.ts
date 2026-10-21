import { useCallback } from 'react';
import { useFocusable as useNoriginFocusable, FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation';
import { tvModeService } from './tvModeService';

interface UseTvFocusableOptions {
  focusKey?: string;
  onEnterPress?: () => void;
  onFocus?: (layout: FocusableComponentLayout) => void;
  onBlur?: (layout: FocusableComponentLayout) => void;
  autoScroll?: boolean;
  scrollBlock?: ScrollLogicalPosition;
  scrollInline?: ScrollLogicalPosition;
  focusable?: boolean;
}

export function useTvFocusable({
  focusKey,
  onEnterPress,
  onFocus,
  onBlur,
  autoScroll = true,
  scrollBlock = 'nearest',
  scrollInline = 'center',
  focusable = true
}: UseTvFocusableOptions = {}) {
  const isTv = tvModeService.isTvMode();

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
      if (isTv && focusable) {
        onEnterPress?.();
      }
    },
    onFocus: handleFocus,
    onBlur,
    focusable: isTv && focusable
  });

  if (!isTv) {
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
