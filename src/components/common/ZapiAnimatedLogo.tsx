import React, { memo } from 'react';
import { tvModeService } from '../../core/tv/tvModeService';

export interface ZapiAnimatedLogoProps {
  className?: string;
  alt?: string;
  /** Permite forçar uso de imagem animada (WebP/APNG) ou vídeo WebM */
  mode?: 'auto' | 'image' | 'video';
  videoSrc?: string;
  webpSrc?: string;
  apngSrc?: string;
  pngFallbackSrc?: string;
  muted?: boolean;
  playsInline?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
}

/**
 * ZapiAnimatedLogo
 * Componente unificado e otimizado da logo animada da ZapiTV com transparência real.
 * 
 * - Smart TV (Tizen, Media Station X, webOS): decodificadores de hardware de TV ignoram
 *   o canal alfa de vídeos WebM e renderizam fundo preto, além de consumir decodificadores
 *   de hardware limitados. Para Smart TV, utiliza Animated WebP/APNG de alta fidelidade
 *   em tag de imagem (2D composited com 100% de transparência real).
 * - Desktop/Web: utiliza Picture/WebP/APNG com fallback gracioso para PNG transparente.
 * - Elimina 100% do fundo preto e vazamento de ruído alfa em todas as telas.
 */
export const ZapiAnimatedLogo: React.FC<ZapiAnimatedLogoProps> = memo(({
  className = 'w-full h-full object-contain',
  alt = 'ZapiTV',
  mode = 'auto',
  videoSrc = '/zapi-icon.webm',
  webpSrc = '/zapi-icon.webp',
  apngSrc = '/zapi-icon.apng',
  pngFallbackSrc = '/zapi-icon.png',
  muted = true,
  playsInline = true,
  autoPlay = true,
  loop = true
}) => {
  // Na Smart TV, o hardware de vídeo decodifica WebM com fundo preto e retém decodificadores de vídeo.
  // Usar Animated WebP ou APNG garante transparência perfeita sem usar hardware video decoder.
  const isTv = typeof window !== 'undefined' && tvModeService.isTvMode();
  const shouldUseImage = mode === 'image' || (mode === 'auto' && (isTv || true));

  if (shouldUseImage) {
    return (
      <picture className="w-full h-full flex items-center justify-center pointer-events-none select-none bg-transparent">
        <source srcSet={webpSrc} type="image/webp" />
        <source srcSet={apngSrc} type="image/apng" />
        <img
          src={webpSrc}
          alt={alt}
          className={`w-full h-full object-contain pointer-events-none select-none bg-transparent ${className}`}
          draggable={false}
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src.endsWith(webpSrc)) {
              target.src = apngSrc;
            } else if (!target.src.endsWith(pngFallbackSrc)) {
              target.src = pngFallbackSrc;
            }
          }}
        />
      </picture>
    );
  }

  return (
    <video
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      className={`w-full h-full object-contain pointer-events-none select-none bg-transparent ${className}`}
      aria-label={alt}
    >
      <source src={videoSrc} type="video/webm; codecs=vp9" />
      <picture className="w-full h-full flex items-center justify-center">
        <source srcSet={webpSrc} type="image/webp" />
        <source srcSet={apngSrc} type="image/apng" />
        <img
          src={webpSrc}
          alt={alt}
          className={`w-full h-full object-contain pointer-events-none select-none ${className}`}
          draggable={false}
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.src = pngFallbackSrc;
          }}
        />
      </picture>
    </video>
  );
});

ZapiAnimatedLogo.displayName = 'ZapiAnimatedLogo';
