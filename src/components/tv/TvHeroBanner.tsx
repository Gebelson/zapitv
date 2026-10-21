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
      className={`zapi-tv-hero-btn px-9 py-4 rounded-2xl font-black text-base sm:text-lg tracking-wide inline-flex items-center justify-center gap-3.5 transition-all duration-200 outline-none select-none cursor-pointer ${
        isPrimary
          ? focused
            ? 'bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 text-white scale-105 border-2 border-white shadow-[0_0_30px_rgba(0,229,255,0.75)]'
            : 'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 text-white shadow-xl shadow-cyan-500/25 border-2 border-transparent hover:scale-102'
          : focused
          ? 'bg-white/25 text-white scale-105 border-2 border-white shadow-[0_0_24px_rgba(255,255,255,0.5)]'
          : 'bg-white/10 hover:bg-white/15 text-gray-200 border-2 border-white/20 hover:scale-102'
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
        className="relative w-full h-screen min-h-[100vh] select-none overflow-hidden"
        aria-label={`Destaque: ${item.title}`}
      >
        {/* Camada 0: Imagem do Banner do Topo Absoluto até a Base (100% da primeira viewport) */}
        <div className="absolute inset-0 z-0">
          {backdropUrl && (
            <img
              src={backdropUrl}
              alt={item.title}
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                if (item.image && (e.currentTarget as HTMLImageElement).src !== item.image) {
                  (e.currentTarget as HTMLImageElement).src = item.image;
                }
              }}
            />
          )}

          {/* Blur Progressivo Superior (Fade-out suave com desfoque desaparecendo em direção ao centro) */}
          <div 
            className="absolute top-0 inset-x-0 h-48 pointer-events-none z-[2] overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
            }}
          >
            {backdropUrl && (
              <img
                src={backdropUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover object-center filter blur-md scale-105"
              />
            )}
            <div 
              className="absolute inset-0"
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)'
              }}
            />
          </div>

          {/* Gradiente Escuro Superior Progressivo (0%: escuro intenso, 12%: moderado, 25%: suave, 38%: leve, 54%: livre) */}
          <div 
            className="absolute top-0 inset-x-0 h-[48%] bg-gradient-to-b from-[#05070a] via-[#05070a]/75 via-25% to-transparent pointer-events-none z-[3]"
            style={{
              background: 'linear-gradient(to bottom, rgba(5,7,10,0.96) 0%, rgba(5,7,10,0.80) 12%, rgba(5,7,10,0.48) 25%, rgba(5,7,10,0.18) 38%, transparent 54%)'
            }}
          />

          {/* Gradiente Lateral Esquerdo (Contraste cinematográfico para o texto e botões) */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#05070a] via-[#05070a]/85 via-45% to-transparent pointer-events-none z-[3]" />

          {/* Blur Progressivo Inferior (Fade-in suave aumentando em direção à base e dissolvendo no fundo escuro) */}
          <div 
            className="absolute bottom-0 inset-x-0 h-64 pointer-events-none z-[2] overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
            }}
          >
            {backdropUrl && (
              <img
                src={backdropUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover object-center filter blur-lg scale-105"
              />
            )}
            <div 
              className="absolute inset-0"
              style={{
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)'
              }}
            />
          </div>

          {/* Gradiente Inferior Progressivo (Fusão suave com o fundo escuro da primeira tela) */}
          <div className="absolute bottom-0 inset-x-0 h-[48%] bg-gradient-to-t from-[#05070a] via-[#05070a]/85 via-40% to-transparent pointer-events-none z-[3]" />

          {/* Efeito Glow Ambiente do Destaque (Cores atmosféricas do ZapiTV) */}
          <div 
            className="absolute top-1/3 left-14 w-[500px] h-[380px] rounded-full pointer-events-none opacity-30 blur-3xl z-[3]"
            style={{
              background: 'radial-gradient(circle, rgba(0, 125, 247, 0.45) 0%, rgba(0, 229, 255, 0.25) 45%, transparent 75%)'
            }}
          />
        </div>

        {/* Informações do Destaque Posicionadas no Terço Inferior Esquerdo com Área Segura */}
        <div className="relative z-10 h-full flex flex-col justify-end pb-24 sm:pb-28 lg:pb-32 pl-14 sm:pl-16 pr-8 max-w-2xl lg:max-w-3xl">
          {/* Metadados: Ano, Classificação, Gêneros, Nota */}
          <div className="flex flex-wrap items-center gap-3 mb-3 text-sm font-bold text-gray-300 drop-shadow">
            {item.rating ? (
              <span className="flex items-center gap-1.5 text-amber-400 bg-black/60 px-2.5 py-1 rounded-lg border border-amber-400/30">
                <Star className="w-4 h-4 fill-amber-400" />
                {item.rating.toFixed(1)}
              </span>
            ) : null}

            {item.year ? <span>{item.year}</span> : null}

            {item.ageRating && (
              <span className="px-2 py-0.5 rounded-md bg-white/15 border border-white/20 text-xs text-white">
                {item.ageRating}
              </span>
            )}

            <span>•</span>
            <span className="text-cyan-300 font-semibold">{genresText}</span>
          </div>

          {/* Título Principal em Tipografia Imponente */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight mb-4 drop-shadow-2xl">
            {item.title}
          </h1>

          {/* Sinopse Curta (2 a 3 linhas) */}
          <p className="text-base sm:text-lg text-gray-300/95 leading-relaxed line-clamp-3 mb-8 max-w-xl drop-shadow">
            {item.description || item.overview || 'Acompanhe esta incrível produção agora no ZapiTV com a máxima qualidade e sem interrupções.'}
          </p>

          {/* Botões Grandes de Ação para Controle Remoto */}
          <div className="flex items-center gap-5">
            <TvHeroButton
              focusKey="tv-hero-play"
              onClick={() => onPlay(item)}
              isPrimary
              icon={<Play className="w-6 h-6 fill-white" />}
              label="Assistir"
              onDownPress={onDownPress}
            />

            <TvHeroButton
              focusKey="tv-hero-details"
              onClick={() => onOpenDetails(item)}
              isPrimary={false}
              icon={<Info className="w-6 h-6" />}
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
