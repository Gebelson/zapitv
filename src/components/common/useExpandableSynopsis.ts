/**
 * ZAPITV — Hook de Sinopse Expansível ("Ver mais" / "Ver menos")
 * 
 * Avalia o overflow real no DOM (scrollHeight vs clientHeight) com base nos limites
 * de linhas da plataforma:
 * - Mobile (< 768px): máximo 3 linhas inicialmente (line-clamp-3).
 * - Desktop (>= 768px): máximo 4 linhas inicialmente (md:line-clamp-4).
 * - Smart TV: máximo 3 linhas inicialmente (line-clamp-3).
 * 
 * Exibição inteligente:
 * - O botão só aparece quando o texto realmente ultrapassa o limite de linhas da plataforma.
 * - Para textos curtos (1, 2 linhas ou dentro do limite), o texto é exibido por completo,
 *   sem botão e sem reservar espaço em branco.
 * - Inicia sempre recolhido ao abrir ou trocar de conteúdo (contentId).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseExpandableSynopsisOptions {
  text: string;
  contentId?: string | number;
  maxLines: number; // 3 para Mobile / Smart TV, 4 para Desktop
}

export interface UseExpandableSynopsisReturn {
  isExpanded: boolean;
  canExpand: boolean;
  toggleSynopsis: () => void;
  setIsExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  textRef: React.RefObject<HTMLParagraphElement | null>;
  measureRef: React.RefObject<HTMLParagraphElement | null>;
  checkOverflow: () => void;
}

export function useExpandableSynopsis({
  text,
  contentId,
  maxLines
}: UseExpandableSynopsisOptions): UseExpandableSynopsisReturn {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const measureRef = useRef<HTMLParagraphElement | null>(null);

  // Reset obrigatório de estado ao abrir outro título ou mudar contentId
  useEffect(() => {
    setIsExpanded(false);
    setCanExpand(false);
  }, [contentId]);

  const checkOverflow = useCallback(() => {
    if (!text || text.trim().length === 0) {
      setCanExpand(false);
      return;
    }

    // 1. Elemento de medição dedicado (sempre com line-clamp estático da plataforma aplicado)
    const measureEl = measureRef.current;
    if (measureEl) {
      if (measureEl.clientHeight > 0 || measureEl.scrollHeight > 0) {
        const hasOverflow = measureEl.scrollHeight > measureEl.clientHeight + 1;
        setCanExpand(hasOverflow);
        if (!hasOverflow && isExpanded) {
          setIsExpanded(false);
        }
        return;
      }
    }

    // 2. Medição direta no elemento visível como fallback
    const el = textRef.current;
    if (!el) return;

    if (el.clientHeight === 0 && el.scrollHeight === 0) {
      return;
    }

    if (!isExpanded) {
      const hasOverflow = el.scrollHeight > el.clientHeight + 1;
      setCanExpand(hasOverflow);
    } else {
      // Quando já expandido, calculamos a altura máxima teórica para o limite maxLines
      const style = window.getComputedStyle(el);
      let lineHeight = parseFloat(style.lineHeight);
      if (isNaN(lineHeight) || lineHeight <= 0) {
        const fontSize = parseFloat(style.fontSize) || 16;
        lineHeight = fontSize * 1.5;
      }
      const maxHeightForLines = lineHeight * maxLines + 2;
      const stillNeedsToggle = el.scrollHeight > maxHeightForLines;
      setCanExpand(stillNeedsToggle);
      if (!stillNeedsToggle) {
        setIsExpanded(false);
      }
    }
  }, [text, isExpanded, maxLines]);

  // Medição no ciclo de renderização, montagem e fontes
  useEffect(() => {
    checkOverflow();

    const rafId = requestAnimationFrame(() => {
      checkOverflow();
    });

    const timer = setTimeout(() => {
      checkOverflow();
    }, 60);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [checkOverflow, contentId, text, maxLines]);

  // ResizeObserver e listener de resize da janela para recalcular em redimensionamentos e rotações
  useEffect(() => {
    const el = textRef.current;
    const measureEl = measureRef.current;
    const target = measureEl || el;
    if (!target) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      try {
        ro = new ResizeObserver(() => {
          checkOverflow();
        });
        ro.observe(target);
        if (target.parentElement) {
          ro.observe(target.parentElement);
        }
      } catch {}
    }

    const handleResize = () => {
      checkOverflow();
    };
    window.addEventListener('resize', handleResize, { passive: true });

    if (typeof document !== 'undefined' && 'fonts' in document && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => {
        checkOverflow();
      }).catch(() => {});
    }

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [checkOverflow]);

  const toggleSynopsis = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return {
    isExpanded,
    setIsExpanded,
    canExpand,
    toggleSynopsis,
    textRef,
    measureRef,
    checkOverflow
  };
}
