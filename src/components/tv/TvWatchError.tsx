import React, { useCallback, useEffect, useRef } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';

export const TvWatchError: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const leaving = useRef(false);
  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    onBack();
  }, [onBack]);
  const { ref, focused } = useTvFocusable({
    focusKey: 'tv-error-back',
    onEnterPress: leave,
    autoScroll: false,
    onArrowPress: () => false
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus('tv-error-back'));
    const unregister = tvNavigationManager.registerBackHandler('tv-error-back', 300, () => {
      leave();
      return true;
    });
    return () => {
      cancelAnimationFrame(frame);
      unregister();
    };
  }, [leave]);

  return (
    <div className="text-center">
      <p>Conteúdo não encontrado ou indisponível.</p>
      <button
        ref={ref}
        type="button"
        data-focus-key="tv-error-back"
        className={`mt-5 rounded-lg bg-[#007df7] px-5 py-2 ${focused ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black' : ''}`}
        onClick={leave}
      >
        Voltar à TV
      </button>
    </div>
  );
};
