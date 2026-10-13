import React, { useId } from 'react';

export interface ZapiLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showText?: boolean;
  text?: string;
}

export const ZapiLoader: React.FC<ZapiLoaderProps> = ({
  size = 'md',
  className = '',
  showText = false,
  text = 'Carregando'
}) => {
  const rawId = useId();
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `zapi-g-${cleanId}`;
  const pathId = `z-path-${cleanId}`;

  let width = 170;
  if (typeof size === 'number') {
    width = size;
  } else {
    switch (size) {
      case 'xs':
        width = 48;
        break;
      case 'sm':
        width = 72;
        break;
      case 'md':
        width = 120;
        break;
      case 'lg':
        width = 170;
        break;
      case 'xl':
        width = 220;
        break;
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          viewBox="-20 -20 415 356"
          xmlns="http://www.w3.org/2000/svg"
          className="loader"
          style={{
            width: `${width}px`,
            display: 'block',
            margin: 'auto',
            overflow: 'visible'
          }}
          aria-label="Carregando ZapiTV"
        >
          <style>{`
            .glow-track-${cleanId} {
              fill: none;
              stroke: rgba(0, 186, 163, 0.15);
              stroke-width: 3.5;
              stroke-linecap: round;
              stroke-linejoin: round;
            }

            .draw-line-${cleanId} {
              fill: none;
              stroke: url(#${gradientId});
              stroke-width: 4;
              stroke-linecap: round;
              stroke-linejoin: round;
              stroke-dasharray: 240 760;
              animation: traceLoop-${cleanId} 2.2s linear infinite;
              filter: drop-shadow(0 0 6px rgba(0, 163, 198, 0.6));
            }

            @keyframes traceLoop-${cleanId} {
              from {
                stroke-dashoffset: 1000;
              }
              to {
                stroke-dashoffset: 0;
              }
            }
          `}</style>

          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b273d8" />
              <stop offset="50%" stopColor="#0095d4" />
              <stop offset="100%" stopColor="#00baa3" />
            </linearGradient>

            <path
              id={pathId}
              pathLength="1000"
              d="
                M 20 0
                H 352
                Q 370 0 374 12
                Q 378 22 368 34

                L 246 187
                Q 239 196 227 196
                Q 220 196 214 192
                L 186 174
                Q 179 169 174 176

                L 116 274
                Q 110 284 114 291
                Q 119 299 130 295

                L 359 204
                Q 375 198 375 214
                V 296
                Q 375 316 355 316
                H 20
                Q 0 316 0 296

                Q 0 288 5 281
                L 94 167
                Q 106 151 118 136
                Q 129 122 142 114
                Q 150 109 157 113
                L 189 133
                Q 196 138 202 131

                L 273 30
                Q 280 19 274 14
                Q 269 10 258 14

                L 16 111
                Q 0 117 0 101
                V 20
                Q 0 0 20 0
                Z
              "
            />
          </defs>

          <use href={`#${pathId}`} className={`glow-track-${cleanId} glow-track`} />
          <use href={`#${pathId}`} className={`draw-line-${cleanId} draw-line`} />
        </svg>
      </div>

      {showText && text && (
        <p className="mt-4 text-white text-xs sm:text-sm font-bold tracking-wide drop-shadow text-center">
          {text}
        </p>
      )}
    </div>
  );
};

export default ZapiLoader;
