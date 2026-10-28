/**
 * ZAPITV — SELEÇÃO DE PERFIS SMART TV COM SUPORTE A D-PAD (P3.B)
 * 
 * Componente espacial preparado para navegação por controle remoto nas Smart TVs
 * (Fire TV, Samsung Tizen, LG webOS, Media Station X).
 * 
 * Cumpre os requisitos P3.B:
 * - Não exige login para uso da TV (desobstruído por padrão).
 * - Totalmente compatível com controle remoto (D-Pad via norigin-spatial-navigation).
 * - Não altera proporções da Samsung nem força vinculação antecipada.
 */

import React from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { Plus, Check } from 'lucide-react';
import { Profile } from '../../../types';
import { resolveAvatarUrl } from '../../core/profile/avatarRegistry';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface TvProfileSelectorProps {
  profiles: Profile[];
  activeProfileId?: string | null;
  onSelectProfile: (profile: Profile) => void;
  onAddProfile?: () => void;
  onClose?: () => void;
}

interface TvProfileCardProps {
  profile: Profile;
  isActive: boolean;
  onSelect: (p: Profile) => void;
  focusKey: string;
}

const TvProfileCard: React.FC<TvProfileCardProps> = ({ profile, isActive, onSelect, focusKey }) => {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => {
      uiSoundService.play('click');
      onSelect(profile);
    },
    onFocus: () => {
      uiSoundService.play('hover');
    },
  });

  return (
    <div
      ref={ref}
      tabIndex={0}
      onClick={() => {
        uiSoundService.play('click');
        onSelect(profile);
      }}
      className={`group flex flex-col items-center gap-4 p-4 rounded-3xl transition-all duration-300 outline-none cursor-pointer ${
        focused
          ? 'scale-110 -translate-y-2'
          : 'opacity-70 hover:opacity-100'
      }`}
    >
      <div
        className={`relative w-36 h-36 md:w-44 md:h-44 rounded-3xl overflow-hidden border-4 transition-all duration-300 shadow-2xl ${
          focused
            ? 'border-[#00baa3] shadow-[0_0_30px_rgba(0,186,163,0.5)] ring-4 ring-[#00baa3]/30'
            : isActive
            ? 'border-[#007df7]'
            : 'border-white/10'
        }`}
      >
        <img
          src={resolveAvatarUrl(profile.avatarId || profile.avatar)}
          alt={profile.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {isActive && (
          <div className="absolute top-2 right-2 bg-[#007df7] text-white p-1 rounded-full shadow-md">
            <Check className="w-4 h-4" />
          </div>
        )}
      </div>

      <span
        className={`text-lg md:text-xl font-bold tracking-tight text-center max-w-[160px] truncate transition-colors ${
          focused ? 'text-[#00baa3]' : isActive ? 'text-white font-black' : 'text-white/60'
        }`}
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        {profile.name}
      </span>
    </div>
  );
};

export const TvProfileSelector: React.FC<TvProfileSelectorProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onClose,
}) => {
  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_PROFILE_SELECTOR_CONTAINER',
    isFocusBoundary: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="fixed inset-0 z-[500] bg-[#05070a]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 select-none"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
            Quem está assistindo na TV?
          </h2>
          <p className="text-sm md:text-base text-white/50 font-medium">
            Navegue com o direcional do controle remoto e pressione OK para selecionar.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 max-w-6xl py-6">
          {profiles.map((p, idx) => (
            <TvProfileCard
              key={p.id}
              profile={p}
              isActive={p.id === activeProfileId}
              onSelect={onSelectProfile}
              focusKey={`TV_PROFILE_CARD_${idx}_${p.id}`}
            />
          ))}

          {onAddProfile && profiles.length < 5 && (
            <div
              tabIndex={0}
              onClick={() => {
                uiSoundService.play('click');
                onAddProfile();
              }}
              className="flex flex-col items-center gap-4 p-4 rounded-3xl opacity-60 hover:opacity-100 hover:scale-105 transition-all outline-none cursor-pointer"
            >
              <div className="w-36 h-36 md:w-44 md:h-44 rounded-3xl border-4 border-dashed border-white/20 flex items-center justify-center hover:border-[#007df7] transition-colors">
                <Plus className="w-12 h-12 text-white/40 hover:text-white" />
              </div>
              <span className="text-lg font-bold text-white/50" style={{ fontFamily: "'Sora', sans-serif" }}>
                Adicionar
              </span>
            </div>
          )}
        </div>

        {onClose && (
          <div className="mt-10">
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-2xl border-2 border-white/20 text-white/60 hover:text-white hover:border-white font-bold text-sm uppercase tracking-widest transition-all cursor-pointer"
            >
              Voltar à TV
            </button>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
};
