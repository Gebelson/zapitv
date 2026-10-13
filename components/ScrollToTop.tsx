
import React, { useEffect, RefObject } from 'react';

interface ScrollToTopProps {
  /** 
   * A dependência que indica uma mudança de "página" ou "rota".
   * Toda vez que este valor mudar, o scroll será resetado.
   */
  dependency: any;
  /** 
   * A referência do elemento que contém o scroll transbordante.
   * Se nulo, o scroll será resetado no objeto window.
   */
  targetRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Componente funcional que garante que a navegação sempre comece no topo.
 * Projetado para ser inserido dentro do fluxo de renderização da aplicação.
 */
const ScrollToTop: React.FC<ScrollToTopProps> = ({ dependency, targetRef }) => {
  useEffect(() => {
    // Execução imediata após a atualização do DOM (pós-montagem da nova view)
    const performScrollReset = () => {
      if (targetRef && targetRef.current) {
        targetRef.current.scrollTo({
          top: 0,
          left: 0,
          behavior: 'instant'
        });
      }
      
      // Sempre garante o reset do window para layouts responsivos ou fixos
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
      });
    };

    performScrollReset();
  }, [dependency, targetRef]);

  return null;
};

export default ScrollToTop;
