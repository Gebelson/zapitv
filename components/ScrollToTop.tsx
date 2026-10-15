
import React, { useEffect, useRef, RefObject } from 'react';

interface ScrollToTopProps {
  /** 
   * A dependência que indica uma mudança de "página" ou "rota".
   */
  dependency: any;
  /**
   * Identificador da visualização atual (ex: 'movies', 'series', 'animes', 'home')
   */
  currentView?: string;
  /**
   * Termo de busca ativo. Se preenchido, o scroll é resetado ao topo.
   */
  searchQuery?: string;
  /** 
   * A referência do elemento que contém o scroll transbordante.
   * Se nulo, o scroll será monitorado e restaurado no objeto window.
   */
  targetRef?: RefObject<HTMLDivElement | null>;
}

// Mapa em memória que preserva a posição de rolagem por view durante toda a sessão
const scrollPositionsByView = new Map<string, number>();

export function getSavedScrollPosition(view: string): number {
  return scrollPositionsByView.get(view) || 0;
}

export function saveScrollPosition(view: string, position: number): void {
  scrollPositionsByView.set(view, Math.max(0, position));
}

export function clearSavedScrollPositions(): void {
  scrollPositionsByView.clear();
}

/**
 * Componente que preserva a posição de rolagem (scrollPosition) por view ao navegar
 * entre abas (filmes, séries, animes, home) e voltar, resetando ao topo apenas quando
 * o usuário realiza uma nova busca ou quando entra numa rota inédita.
 */
const ScrollToTop: React.FC<ScrollToTopProps> = ({ dependency, currentView, searchQuery, targetRef }) => {
  const prevViewRef = useRef<string | undefined>(currentView);
  const prevSearchRef = useRef<string | undefined>(searchQuery);

  // Monitora continuamente o scroll da view atual para manter a posição exata
  useEffect(() => {
    const container = targetRef?.current;
    const view = currentView || 'default';

    const handleScroll = () => {
      const pos = container ? container.scrollTop : window.scrollY;
      scrollPositionsByView.set(view, pos);
    };

    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentView, targetRef]);

  // Restauração de Scroll inteligente na mudança de view ou reset na busca
  useEffect(() => {
    const view = currentView || 'default';
    const isSearchActive = Boolean(searchQuery && searchQuery.trim().length > 0);
    const searchChanged = prevSearchRef.current !== searchQuery;
    const viewChanged = prevViewRef.current !== currentView;

    prevViewRef.current = currentView;
    prevSearchRef.current = searchQuery;

    // Se o usuário realizou uma nova busca, reseta ao topo para ver os resultados
    if (isSearchActive && searchChanged) {
      if (targetRef && targetRef.current) {
        targetRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }

    // Se houve mudança de view e não há busca ativa, restaura a posição salva daquela view
    if (viewChanged || !currentView) {
      const savedPosition = currentView ? (scrollPositionsByView.get(view) || 0) : 0;
      
      const applyScroll = () => {
        if (targetRef && targetRef.current) {
          targetRef.current.scrollTo({ top: savedPosition, left: 0, behavior: 'instant' });
        }
        window.scrollTo({ top: savedPosition, left: 0, behavior: 'instant' });
      };

      applyScroll();
      // Dupla execução para garantir sincronia após a renderização do grid de cards no DOM
      const rAF = requestAnimationFrame(applyScroll);
      const timer = setTimeout(applyScroll, 60);

      return () => {
        cancelAnimationFrame(rAF);
        clearTimeout(timer);
      };
    }
  }, [dependency, currentView, searchQuery, targetRef]);

  return null;
};

export default ScrollToTop;
