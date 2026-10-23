import React, { memo } from 'react';
import { tvModeService } from '../../core/tv/tvModeService';

export const ZAPI_LOGO_ASSET_VERSION = 'v=20261023_aa';

function withVersion(url: string, v = ZAPI_LOGO_ASSET_VERSION): string {
  if (!url) return url;
  if (url.includes('?')) return url;
  return `${url}?${v}`;
}

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
 * Componente unificado e otimizado da logo animada da ZapiTV com transparência real
 * e antialiasing fino contínuo (sem serrilhado durante o giro).
 * 
 * - Smart TV (Tizen, Media Station X, webOS): decodificadores de hardware de TV ignoram
 *   o canal alfa de vídeos WebM e renderizam fundo preto, além de consumir decodificadores
 *   de hardware limitados. Para Smart TV, utiliza Animated WebP/APNG com antialiasing perfeito
 *   em tag de imagem 2D com transparência real e aceleração de composição sem serrilhado.
 * - Desktop/Web: utiliza WebM VP9 transparente com canal alfa ou Picture/WebP/APNG com fallback.
 * - Cache-busting automático (?v=...) garante que o Media Station X e browsers de TV não usem cache legado.
 * - Elimina 100% do fundo preto e o serrilhado de rotação em todas as telas.
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
  const shouldUseImage = mode === 'image' || (mode === 'auto' && isTv);

  const finalWebp = withVersion(webpSrc);
  const finalApng = withVersion(apngSrc);
  const finalPng = withVersion(pngFallbackSrc);
  const finalVideo = withVersion(videoSrc);

  if (shouldUseImage) {
    return (
      <picture className="w-full h-full flex items-center justify-center pointer-events-none select-none bg-transparent">
        <source srcSet={finalWebp} type="image/webp" />
        <source srcSet={finalApng} type="image/apng" />
        <img
          src={finalWebp}
          alt={alt}
          className={`w-full h-full object-contain pointer-events-none select-none bg-transparent ${className}`}
          draggable={false}
          style={{
            imageRendering: 'auto',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
          }}
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src.includes(webpSrc)) {
              target.src = finalApng;
            } else if (!target.src.includes(pngFallbackSrc)) {
              target.src = finalPng;
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
      style={{
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
      }}
    >
      <source src={finalVideo} type="video/webm; codecs=vp9" />
      <picture className="w-full h-full flex items-center justify-center">
        <source srcSet={finalWebp} type="image/webp" />
        <source srcSet={finalApng} type="image/apng" />
        <img
          src={finalWebp}
          alt={alt}
          className={`w-full h-full object-contain pointer-events-none select-none ${className}`}
          draggable={false}
          style={{
            imageRendering: 'auto',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
          }}
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.src = finalPng;
          }}
        />
      </picture>
    </video>
  );
});

ZapiAnimatedLogo.displayName = 'ZapiAnimatedLogo';
