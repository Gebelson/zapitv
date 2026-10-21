import React, { memo } from 'react';
import { Play, Info, Star } from 'lucide-react';
import { ContentItem } from '../../../types';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvHeroBannerProps {
  item: ContentItem;
  onPlay: (item: ContentItem) => void;
  onOpenDetails: (item: ContentItem) => void;
  onDownPress?: () => void;
}

const TvHeroButton: React.FC<{
  focusKey: string;
  onClick: () => void;
  isPrimary?: boolean;
  icon: React.ReactNode;
  label: string;
  onDownPress?: () => void;
}> = ({ focusKey, onClick, isPrimary = false, icon, label, onDownPress }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    onArrowPress: (direction) => {
      if (direction === 'up') {
        setFocus('tv-nav-home');
        return false;
      }
      if (direction === 'down' && onDownPress) {
        onDownPress();
        return false;
      }
      return true;
    },
    autoScroll: true
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={onClick}
      className={`px-8 py-3.5 rounded-xl font-black text-sm tracking-wide flex items-center gap-3 transition-all duration-200 outline-none select-none ${
        isPrimary
          ? focused
            ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white scale-105 shadow-[0_0_30px_rgba(0,229,255,0.7)] border-2 border-[#00e5ff]'
            : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:scale-102 border-2 border-transparent'
          : focused
          ? 'bg-white/25 text-white scale-105 shadow-[0_0_25px_rgba(255,255,255,0.4)] border-2 border-white'
          : 'bg-white/10 hover:bg-white/15 text-gray-200 border border-white/15 hover:scale-102'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

export const TvHeroBanner: React.FC<TvHeroBannerProps> = memo(({
  item,
  onPlay,
  onOpenDetails,
  onDownPress
}) => {
  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-hero',
    trackChildren: true,
    saveLastFocusedChild: true
  });

  const backdropUrl = item.backdrop || item.image || item.poster || '';
  const genresText = item.genres?.slice(0, 3).join(' • ') || (item.type === 'FILME' ? 'Filme' : 'Série');

  return (
    <FocusContext.Provider value={focusKey}>
      <section 
        ref={noriginRef as any}
        className="relative w-full h-[68vh] min-h-[480px] max-h-[720px] mb-4 overflow-hidden select-none"
        aria-label={`Destaque: ${item.title}`}
      >
        {/* Imagem de Fundo Cinematográfica */}
        <div className="absolute inset-0 z-0">
          {backdropUrl && (
            <img
              src={backdropUrl}
              alt={item.title}
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-top sm:object-right-top"
            />
          )}

          {/* Gradiente Lateral Esquerdo (Cinematográfico) */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#05070a] via-[#05070a]/80 via-45% to-transparent" />

          {/* Gradiente Inferior Progressivo (Fusão suave com os carrosséis) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/70 via-30% to-transparent" />

          {/* Efeito Glow Ambiente do Destaque (Cores atmosféricas) */}
          <div 
            className="absolute top-1/4 left-10 w-[450px] h-[350px] rounded-full pointer-events-none opacity-40 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(0, 125, 247, 0.45) 0%, rgba(0, 229, 255, 0.25) 45%, transparent 75%)'
            }}
          />
        </div>

        {/* Informações do Destaque Posicionadas à Esquerda */}
        <div className="relative z-10 h-full flex flex-col justify-end pb-8 sm:pb-12 pl-8 sm:pl-12 md:pl-16 pr-8 max-w-2xl lg:max-w-3xl">
          {/* Metadados: Ano, Classificação, Gêneros, Nota */}
          <div className="flex flex-wrap items-center gap-2.5 mb-2.5 text-xs font-bold text-gray-300 drop-shadow">
            {item.rating ? (
              <span className="flex items-center gap-1 text-amber-400 bg-black/60 px-2 py-0.5 rounded-md border border-amber-400/30">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {item.rating.toFixed(1)}
              </span>
            ) : null}

            {item.year ? <span>{item.year}</span> : null}

            {item.ageRating && (
              <span className="px-1.5 py-0.5 rounded bg-white/15 border border-white/20 text-[11px] text-white">
                {item.ageRating}
              </span>
            )}

            <span>•</span>
            <span className="text-cyan-300 font-semibold">{genresText}</span>
          </div>

          {/* Título Principal em Tipografia Imponente */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-3 drop-shadow-2xl">
            {item.title}
          </h1>

          {/* Sinopse Curta (2 a 3 linhas) */}
          <p className="text-xs sm:text-sm md:text-base text-gray-300/90 leading-relaxed line-clamp-3 mb-6 max-w-xl drop-shadow">
            {item.description || item.overview || 'Acompanhe esta incrível produção agora no ZapiTV com a máxima qualidade e sem interrupções.'}
          </p>

          {/* Botões Grandes de Ação para Controle Remoto */}
          <div className="flex items-center gap-4">
            <TvHeroButton
              focusKey="tv-hero-play"
              onClick={() => onPlay(item)}
              isPrimary
              icon={<Play className="w-5 h-5 fill-white" />}
              label="Assistir"
              onDownPress={onDownPress}
            />

            <TvHeroButton
              focusKey="tv-hero-details"
              onClick={() => onOpenDetails(item)}
              isPrimary={false}
              icon={<Info className="w-5 h-5" />}
              label="Mais detalhes"
              onDownPress={onDownPress}
            />
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  );
});

TvHeroBanner.displayName = 'TvHeroBanner';
