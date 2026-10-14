import React from 'react';

export type SubtitleFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type SubtitleBgColor = 'none' | 'semi' | 'solid';
export type SubtitleOutline = 'none' | 'thin' | 'medium' | 'thick';
export type SubtitleShadow = 'none' | 'soft' | 'strong' | 'drop';
export type SubtitleLineSpacing = 'compact' | 'normal' | 'relaxed' | 'spacious';

export const DEFAULT_VERTICAL_POSITION = 10; // 10% da altura da tela (padrão atual do ZapiTV)

export function normalizeVerticalPosition(val: any): number {
  if (typeof val !== 'number' || isNaN(val)) {
    return DEFAULT_VERTICAL_POSITION;
  }
  // Converte valores legados em pixels (> 35, ex: 80px) para a escala percentual correspondente (10%)
  if (val > 35) {
    const converted = Math.round((val / 800) * 100);
    return Math.max(4, Math.min(35, converted || DEFAULT_VERTICAL_POSITION));
  }
  return Math.max(4, Math.min(35, val));
}

export interface SubtitleStyle {
  fontSize: SubtitleFontSize;
  color: string;
  bgColor: SubtitleBgColor;
  outline: SubtitleOutline;
  shadow: SubtitleShadow;
  lineSpacing: SubtitleLineSpacing;
  customLineSpacing?: number;
  verticalPosition?: number; // Posição vertical relativa a partir da base (4% a 35%, padrão 10%)
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 'md',
  color: '#FFFFFF',
  bgColor: 'semi',
  outline: 'thin',
  shadow: 'soft',
  lineSpacing: 'normal',
  verticalPosition: DEFAULT_VERTICAL_POSITION
};

export const STORAGE_KEY_SUBTITLE_STYLE = 'zapitv_subtitle_style';
export const EVENT_SUBTITLE_STYLE_CHANGED = 'zapitv_subtitle_style_changed';

class SubtitleStyleService {
  private memoryStyle: SubtitleStyle = { ...DEFAULT_SUBTITLE_STYLE };

  /**
   * Obtém as preferências salvas de estilo ou retorna os padrões.
   */
  public getSubtitleStyle(): SubtitleStyle {
    if (typeof localStorage === 'undefined') {
      return { ...this.memoryStyle };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY_SUBTITLE_STYLE);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.memoryStyle = {
          ...DEFAULT_SUBTITLE_STYLE,
          ...parsed,
          lineSpacing: ['compact', 'normal', 'relaxed', 'spacious'].includes(parsed.lineSpacing)
            ? parsed.lineSpacing
            : DEFAULT_SUBTITLE_STYLE.lineSpacing,
          verticalPosition: normalizeVerticalPosition(parsed.verticalPosition)
        };
        return { ...this.memoryStyle };
      }
    } catch (e) {
      console.warn('[SubtitleStyleService] Erro ao ler estilos do localStorage:', e);
    }

    return { ...this.memoryStyle };
  }

  /**
   * Salva o estilo completo e notifica ouvintes.
   */
  public saveSubtitleStyle(style: SubtitleStyle): void {
    this.memoryStyle = { ...style };
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_SUBTITLE_STYLE, JSON.stringify(style));
      } catch (e) {
        console.warn('[SubtitleStyleService] Erro ao salvar estilos no localStorage:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_SUBTITLE_STYLE_CHANGED, { detail: style }));
    }
  }

  /**
   * Atualiza parcialmente as preferências de estilo.
   */
  public updateSubtitleStyle(updates: Partial<SubtitleStyle>): SubtitleStyle {
    const current = this.getSubtitleStyle();
    const next: SubtitleStyle = {
      ...current,
      ...updates
    };
    this.saveSubtitleStyle(next);
    return next;
  }

  /**
   * Restaura os valores padrão de fábrica para o estilo de legendas.
   */
  public resetSubtitleStyle(): SubtitleStyle {
    this.saveSubtitleStyle({ ...DEFAULT_SUBTITLE_STYLE });
    return { ...DEFAULT_SUBTITLE_STYLE };
  }

  /**
   * Restaura exclusivamente a altura/posição vertical padrão (10%).
   */
  public resetVerticalPosition(): SubtitleStyle {
    return this.updateSubtitleStyle({ verticalPosition: DEFAULT_VERTICAL_POSITION });
  }

  /**
   * Inscreve um ouvinte para alterações no estilo de legendas.
   */
  public subscribe(listener: (style: SubtitleStyle) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SubtitleStyle>;
      if (customEvent.detail) {
        listener(customEvent.detail);
      } else {
        listener(this.getSubtitleStyle());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_SUBTITLE_STYLE) {
        listener(this.getSubtitleStyle());
      }
    };

    window.addEventListener(EVENT_SUBTITLE_STYLE_CHANGED, handleCustomEvent);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(EVENT_SUBTITLE_STYLE_CHANGED, handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }

  /**
   * Computa o objeto CSS React completo correspondente ao estilo configurado.
   */
  public computeSubtitleCSS(
    style: SubtitleStyle,
    isMiniPreview: boolean = false
  ): React.CSSProperties {
    const safeStyle: SubtitleStyle = {
      ...DEFAULT_SUBTITLE_STYLE,
      ...style
    };

    const fontSizes: Record<SubtitleFontSize, string> = isMiniPreview
      ? { sm: '12px', md: '14px', lg: '17px', xl: '20px' }
      : { sm: '18px', md: '24px', lg: '30px', xl: '38px' };

    const bgColors: Record<SubtitleBgColor, string> = {
      none: 'transparent',
      semi: 'rgba(0, 0, 0, 0.75)',
      solid: '#000000'
    };

    const outlineStrokes: Record<SubtitleOutline, string> = isMiniPreview
      ? {
          none: '0px transparent',
          thin: '0.8px #000000',
          medium: '1.6px #000000',
          thick: '2.5px #000000'
        }
      : {
          none: '0px transparent',
          thin: '1.2px #000000',
          medium: '2.2px #000000',
          thick: '3.5px #000000'
        };

    const shadows: Record<SubtitleShadow, string> = {
      none: 'none',
      soft: '0 2px 4px rgba(0, 0, 0, 0.85)',
      strong: '0 0 6px #000000, 0 2px 6px #000000, 0 0 12px #000000',
      drop: '2px 2px 0px #000000, 3px 3px 4px rgba(0, 0, 0, 0.9)'
    };

    const lineSpacings: Record<SubtitleLineSpacing, number> = {
      compact: 1.15,
      normal: 1.35,
      relaxed: 1.6,
      spacious: 1.95
    };

    const effectiveLineHeight = typeof safeStyle.customLineSpacing === 'number'
      ? safeStyle.customLineSpacing
      : (lineSpacings[safeStyle.lineSpacing] || lineSpacings.normal);

    return {
      fontSize: fontSizes[safeStyle.fontSize] || fontSizes.md,
      lineHeight: effectiveLineHeight,
      color: safeStyle.color || '#FFFFFF',
      backgroundColor: bgColors[safeStyle.bgColor] || bgColors.semi,
      WebkitTextStroke: outlineStrokes[safeStyle.outline] || outlineStrokes.thin,
      paintOrder: 'stroke fill',
      textShadow: shadows[safeStyle.shadow] || shadows.soft,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    };
  }
}

export const subtitleStyleService = new SubtitleStyleService();
