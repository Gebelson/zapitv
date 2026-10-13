import React from 'react';
import { Heart, Search, Tv } from 'lucide-react';
import { LiveChannel, LiveChannelCategory } from '../../core/livetv/types';
import { ChannelCard } from './ChannelCard';
import { CATEGORY_DEFINITIONS } from '../../core/livetv/channelRegistry';

interface ChannelGridProps {
  channels: LiveChannel[];
  selectedCategory: LiveChannelCategory;
  onSelectCategory: (cat: LiveChannelCategory) => void;
  selectedChannelId?: string;
  onSelectChannel: (channel: LiveChannel) => void;
  onWatchNow?: (channel: LiveChannel) => void;
  isDarkMode?: boolean;
  searchQuery?: string;
}

export const ChannelGrid: React.FC<ChannelGridProps> = ({
  channels,
  selectedCategory,
  onSelectCategory,
  selectedChannelId,
  onSelectChannel,
  onWatchNow,
  isDarkMode = true,
  searchQuery = ''
}) => {
  // Categorias que efetivamente possuem canais disponíveis
  const availableCategories = CATEGORY_DEFINITIONS.filter(def => {
    if (def.id === 'todos' || def.id === 'favoritos') return true;
    return channels.some(c => c.category === def.id);
  });

  return (
    <div className="space-y-6">
      {/* Category Pills Selector */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {availableCategories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id as LiveChannelCategory)}
              className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/30 scale-105'
                  : isDarkMode
                    ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 hover:border-white/15'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
              }`}
            >
              {cat.id === 'favoritos' && <Heart className={`w-3.5 h-3.5 ${isActive ? 'fill-current' : ''}`} />}
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Grid de Canais */}
      {channels.length === 0 ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm select-none">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 text-gray-400">
            {selectedCategory === 'favoritos' ? <Heart className="w-8 h-8" /> : <Tv className="w-8 h-8" />}
          </div>
          <h4 className="text-white text-lg font-black mb-1">
            {selectedCategory === 'favoritos' ? 'Nenhum canal favoritado ainda' : 'Nenhum canal encontrado'}
          </h4>
          <p className="text-gray-400 text-xs max-w-sm mb-4 leading-relaxed">
            {selectedCategory === 'favoritos'
              ? 'Clique no ícone de coração nos cards dos canais para salvar seus favoritos aqui.'
              : 'Nenhum canal corresponde ao filtro ou termo de busca selecionado.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              isSelected={channel.id === selectedChannelId}
              isDarkMode={isDarkMode}
              onSelect={onSelectChannel}
              onWatchNow={onWatchNow}
            />
          ))}
        </div>
      )}
    </div>
  );
};
