import React, { memo } from 'react';
import { ZapiAnimatedLogo, ZapiAnimatedLogoProps } from './ZapiAnimatedLogo';

export type ZapiLogoSize = 'sm' | 'md' | 'lg' | 'xl' | number;

export interface ZapiBrandLogoProps {
  /**
   * Tamanho pré-definido ou valor numérico (altura/largura do ícone em px).
   * - 'sm': ícone 32px, texto 17px, gap 8px (mobile header, botões compactos)
   * - 'md': ícone 40px, texto 21px, gap 10px (login, auth modal, sidebar padrão)
   * - 'lg': ícone 48px, texto 25px, gap 12px (seleção de perfil, TV header padrão)
   * - 'xl': ícone 64px, texto 33px, gap 14px (screensaver, boas-vindas TV, splash)
   * - number: escala o ícone no tamanho exato e a tipografia proporcionalmente (52%)
   */
  size?: ZapiLogoSize;
  /** Se true, renderiza apenas o símbolo da ZapiTV */
  symbolOnly?: boolean;
  /** Se true, renderiza apenas a tipografia oficial */
  textOnly?: boolean;
  /** Disposição dos elementos: horizontal (padrão) ou vertical */
  layout?: 'horizontal' | 'vertical';
  /** Modo escuro (padrão true: usa /zapitv-text.png). Quando false: usa /zapitv-text-light.png */
  isDarkMode?: boolean;
  /** Modo de renderização da animação do símbolo ('auto' | 'image' | 'video') */
  mode?: ZapiAnimatedLogoProps['mode'];
  /** Colapsa a tipografia com transição suave (ideal para sidebars retraídas) */
  collapsed?: boolean;
  /** Classe adicional para o container externo */
  className?: string;
  /** Classe adicional para o wrapper do ícone */
  iconClassName?: string;
  /** Classe adicional para o elemento de texto */
  textClassName?: string;
  /** Texto alternativo para acessibilidade */
  alt?: string;
  /** Callback para evento de clique */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Se deve aplicar efeito de glow visual ao redor do símbolo */
  glow?: boolean;
}

interface SizeDimensions {
  iconSize: number;
  textHeight: number;
  gap: number;
}

function resolveDimensions(size: ZapiLogoSize): SizeDimensions {
  if (typeof size === 'number') {
    const iconSize = Math.max(16, Math.round(size));
    const textHeight = Math.max(10, Math.round(iconSize * 0.52));
    const gap = Math.max(4, Math.round(iconSize * 0.22));
    return { iconSize, textHeight, gap };
  }

  switch (size) {
    case 'sm':
      return { iconSize: 32, textHeight: 17, gap: 8 };
    case 'lg':
      return { iconSize: 48, textHeight: 25, gap: 12 };
    case 'xl':
      return { iconSize: 64, textHeight: 33, gap: 14 };
    case 'md':
    default:
      return { iconSize: 40, textHeight: 21, gap: 10 };
  }
}

/**
 * ZapiBrandLogo
 * 
 * Componente oficial e centralizado da marca ZapiTV para toda a aplicação.
 * Unifica o símbolo 3D autêntico (com antialiasing Lanczos e transparência real)
 * e o logotipo tipográfico oficial (/zapitv-text.png), garantindo proporção,
 * espaçamento e peso visual consistentes em todos os dispositivos:
 * Desktop, Mobile, Smart TV (Tizen/WebOS/MSX) e Fire TV.
 */
export const ZapiBrandLogo: React.FC<ZapiBrandLogoProps> = memo(({
  size = 'md',
  symbolOnly = false,
  textOnly = false,
  layout = 'horizontal',
  isDarkMode = true,
  mode = 'auto',
  collapsed = false,
  className = '',
  iconClassName = '',
  textClassName = '',
  alt = 'ZapiTV',
  onClick,
  glow = false,
}) => {
  const { iconSize, textHeight, gap } = resolveDimensions(size);

  const textSrc = isDarkMode ? '/zapitv-text.png' : '/zapitv-text-light.png';

  const isVertical = layout === 'vertical';

  const containerClasses = [
    'flex items-center select-none',
    isVertical ? 'flex-col justify-center text-center' : 'flex-row shrink-0',
    onClick ? 'cursor-pointer' : '',
    className,
  ].filter(Boolean).join(' ');

  const iconWrapperClasses = [
    'shrink-0 flex items-center justify-center relative',
    glow ? 'sidebar-logo-glow' : '',
    iconClassName,
  ].filter(Boolean).join(' ');

  const textWrapperClasses = [
    'flex items-center shrink-0 transition-[opacity,transform,max-width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
    collapsed
      ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none overflow-hidden'
      : 'max-w-[240px] opacity-100 translate-x-0',
    textClassName,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={containerClasses}
      style={{
        gap: collapsed ? 0 : `${gap}px`,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={alt}
    >
      {!textOnly && (
        <div
          className={iconWrapperClasses}
          style={{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
          }}
        >
          <ZapiAnimatedLogo
            mode={mode}
            videoSrc="/zapi-icon.webm"
            webpSrc="/zapi-icon.webp"
            apngSrc="/zapi-icon.apng"
            pngFallbackSrc="/zapi-icon.png"
            className="w-full h-full object-contain pointer-events-none select-none"
            alt={symbolOnly ? alt : ''}
          />
        </div>
      )}

      {!symbolOnly && (
        <div className={textWrapperClasses}>
          <img
            src={textSrc}
            alt={alt}
            className="w-auto object-contain select-none pointer-events-none"
            style={{
              height: `${textHeight}px`,
              // Alinhamento óptico fino entre o centro do símbolo 3D e a linha de base da tipografia
              transform: isVertical ? 'none' : 'translateY(1.5px)',
            }}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
});

ZapiBrandLogo.displayName = 'ZapiBrandLogo';
