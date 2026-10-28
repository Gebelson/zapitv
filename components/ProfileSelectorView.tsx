import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { User, Profile } from '../types';
import AnimatedBackground from './AnimatedBackground';
import { profileClient, ProfileItem } from '../src/core/profile/profileClient';
import { OFFICIAL_AVATARS, DEFAULT_AVATAR_ID, resolveAvatarUrl } from '../src/core/profile/avatarRegistry';

interface ProfileSelectorViewProps {
  user: User;
  onSelectProfile: (profile: Profile) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onClose?: () => void;
  isDarkMode: boolean;
}

function toAppProfile(item: ProfileItem): Profile {
  return {
    id: item.id,
    name: item.name,
    avatar: resolveAvatarUrl(item.avatarId),
    avatarId: item.avatarId,
    isChild: false,
    isDefault: item.isDefault,
    displayOrder: item.displayOrder,
  };
}

const BrandLogo = () => (
  <svg viewBox="0 0 374.87 315.93" className="w-full h-full">
    <defs>
      <linearGradient id="LogoGradProfile" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#b273d8">
          <animate attributeName="stopColor" values="#b273d8;#00baa3;#007df7;#b273d8" dur="4s" repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor="#00baa3">
          <animate attributeName="stopColor" values="#00baa3;#007df7;#b273d8;#00baa3" dur="4s" repeatCount="indefinite" />
        </stop>
      </linearGradient>
    </defs>
    <path fill="url(#LogoGradProfile)" d="M217.84,315.93c-20.71-.34-41.38-.68-62-1.01-25.86.33-51.86.66-78,1l-58.67-.27c-8.71-.05-16.27-6.38-17.35-14.45-.89-6.67.79-11.65,4.8-16.59l42.96-52.9,34.5-41.58,46.93-57.01c4.73-5.74,8.53-12.04,14.93-16.09,4.47-2.83,11.02-1.13,15.32,1.5l29.66,18.14c5.5,3.37,12.16,1.15,15.73-4l16.82-24.22,47.74-74.06c.21-.33.37-.67.48-1.02,1.14-3.55-2.09-6.98-5.78-6.4-2.82.44-5.47,1.54-8.49,2.82l-128.58,54.14L9.09,134.06c-2.46,1.03-5.17.89-6.68-.21C1.28,133.02,0,130.3,0,128.19L.2,21.58C.23,9.78,8.11,0,20.12,0l335.27.02c5.38,0,11.72,3.13,14.46,6.66,6.08,7.82,3.13,17.81-2.26,24.85-5.81,7.6-11.51,14.36-17.53,21.64l-24.48,29.57-56.42,68.45-33.94,42.01c-5,6.19-12.76,9.24-19.74,5.04l-28.69-17.27c-3.83-2.31-10.24-5.82-14.33-3.45-5.92,3.43-8.84,10.15-12.43,15.62l-33.7,51.33-27.21,42.72c-.76,1.19-.35,3.03.15,3.78,1.9,2.87,9.6-.54,12.85-1.93l116.86-49.98,138.78-59.06c1.63-.7,3.99-.15,4.9.39s2.21,2,2.21,3.81l-.4,109.09c-.04,12.22-8.55,22.45-20.82,22.46l-135.81.19Z"/>
  </svg>
);

const ProfileSelectorView: React.FC<ProfileSelectorViewProps> = ({
  user,
  onSelectProfile,
  onUpdateUser,
  onClose,
  isDarkMode: _isDarkMode,
}) => {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de gestão
  const [isManaging, setIsManaging] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<ProfileItem | null>(null);

  // Campos do formulário de criação/edição
  const [formName, setFormName] = useState('');
  const [formAvatarId, setFormAvatarId] = useState(DEFAULT_AVATAR_ID);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await profileClient.list();
      setProfiles(list);
      if (onUpdateUser && list.length > 0) {
        onUpdateUser({
          ...user,
          profiles: list.map(toAppProfile),
        });
      }
    } catch {
      setError('Não foi possível carregar os perfis da conta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSelect = async (profile: ProfileItem) => {
    if (isManaging) {
      // No modo de gestão, clicar no card abre o editor
      setEditingProfile(profile);
      setFormName(profile.name);
      setFormAvatarId(profile.avatarId);
      return;
    }

    try {
      setSaving(true);
      await profileClient.select(profile.id);
      onSelectProfile(toAppProfile(profile));
    } catch {
      // Fallback para seleção local caso a API falhe
      onSelectProfile(toAppProfile(profile));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = formName.trim();
    if (!clean || clean.length < 2 || clean.length > 30) {
      setError('O nome deve conter entre 2 e 30 caracteres.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const created = await profileClient.create(clean, formAvatarId);
      setIsAdding(false);
      setFormName('');
      setFormAvatarId(DEFAULT_AVATAR_ID);
      await fetchProfiles();
      // Se não havia perfis, seleciona o novo
      if (profiles.length === 0) {
        onSelectProfile(toAppProfile(created));
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao criar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    const clean = formName.trim();
    if (!clean || clean.length < 2 || clean.length > 30) {
      setError('O nome deve conter entre 2 e 30 caracteres.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await profileClient.update(editingProfile.id, {
        name: clean,
        avatarId: formAvatarId,
      });
      setEditingProfile(null);
      await fetchProfiles();
    } catch (err: any) {
      setError(err?.message || 'Falha ao atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProfile) return;
    try {
      setSaving(true);
      setError(null);
      const res = await profileClient.delete(deletingProfile.id);
      setDeletingProfile(null);
      await fetchProfiles();
      // Se era o perfil ativo, notifica novo perfil padrão
      if (res.nextActiveProfileId) {
        const next = profiles.find((p) => p.id === res.nextActiveProfileId);
        if (next) onSelectProfile(toAppProfile(next));
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir o perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[350] flex flex-col items-center justify-start sm:justify-center p-6 bg-[#05070a] text-white transition-colors duration-500 overflow-y-auto no-scrollbar pt-12 md:pt-6">
      <AnimatedBackground isDarkMode={true} />

      {/* Top Header */}
      <div className="flex items-center gap-2 md:gap-3 mb-8 md:mb-12 shrink-0 relative z-10">
        <div className="w-10 h-8 md:w-12 md:h-10">
          <BrandLogo />
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
          ZAPI<span className="text-[#007df7]">TV</span>
        </h1>
      </div>

      <div className="max-w-full w-full text-center relative z-10 flex flex-col items-center px-4 pb-20 md:pb-0">
        <h2 className="text-2xl md:text-4xl lg:text-5xl font-black mb-3 md:mb-6 tracking-tight text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
          Quem está assistindo agora?
        </h2>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-2 text-sm max-w-md animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-[#007df7] animate-spin" />
            <p className="text-xs uppercase tracking-widest text-white/40 font-bold">Carregando perfis...</p>
          </div>
        ) : (
          <div className="flex flex-wrap lg:flex-nowrap justify-center items-start gap-x-4 md:gap-x-8 lg:gap-x-12 w-full max-w-5xl py-6 md:py-10">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="group flex flex-col items-center gap-3 md:gap-5 w-[140px] xs:w-[160px] sm:w-auto mb-4 shrink-0"
              >
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-[#007df7] rounded-[24px] opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 scale-105" />

                  <button
                    onClick={() => handleSelect(profile)}
                    disabled={saving}
                    className={`relative w-28 h-28 xs:w-32 xs:h-32 md:w-36 md:h-36 lg:w-44 lg:h-44 aspect-square rounded-[24px] overflow-hidden border-4 transition-all duration-300 transform group-hover:scale-105 group-active:scale-95 shadow-2xl flex-shrink-0 bg-white/5 ${
                      isManaging
                        ? 'border-[#00baa3] shadow-[0_0_20px_rgba(0,186,163,0.3)]'
                        : 'border-white/10 group-hover:border-[#007df7]'
                    }`}
                  >
                    <img
                      src={resolveAvatarUrl(profile.avatarId)}
                      className="w-full h-full object-cover"
                      alt={profile.name}
                      loading="lazy"
                    />

                    {isManaging && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-xs">
                        <Edit3 className="w-8 h-8 md:w-10 md:h-10 text-white" />
                      </div>
                    )}
                  </button>

                  {/* Botão de Excluir Perfil no Modo Gerenciar */}
                  {isManaging && profiles.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProfile(profile);
                      }}
                      className="absolute -top-2 -right-2 w-8 h-8 md:w-10 md:h-10 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-xl border-2 border-white/20 hover:scale-110 active:scale-90 transition-all z-20 cursor-pointer"
                      title="Excluir perfil"
                    >
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  )}
                </div>

                <span
                  className={`text-sm md:text-lg lg:text-xl font-bold tracking-tight transition-all duration-300 max-w-full px-2 truncate ${
                    isManaging
                      ? 'text-[#00baa3]'
                      : 'text-white/60 group-hover:text-white'
                  }`}
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {profile.name}
                </span>
              </div>
            ))}

            {/* Botão Adicionar Perfil */}
            {profiles.length < 5 && (
              <div className="group flex flex-col items-center gap-3 md:gap-5 w-[140px] xs:w-[160px] sm:w-auto mb-4 shrink-0">
                <button
                  onClick={() => {
                    setError(null);
                    setFormName('');
                    setFormAvatarId(OFFICIAL_AVATARS[profiles.length % OFFICIAL_AVATARS.length].id);
                    setIsAdding(true);
                  }}
                  className="w-28 h-28 xs:w-32 xs:h-32 md:w-36 md:h-36 lg:w-44 lg:h-44 aspect-square flex items-center justify-center rounded-[24px] border-4 border-dashed border-white/10 hover:border-[#007df7]/50 hover:bg-[#007df7]/10 transition-all transform hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
                >
                  <Plus className="w-8 h-8 md:w-12 md:h-12 text-white/30 group-hover:text-[#007df7] transition-colors" />
                </button>
                <span
                  className="text-sm md:text-lg lg:text-xl font-bold tracking-tight text-white/30 group-hover:text-white transition-colors"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  Adicionar
                </span>
              </div>
            )}
          </div>
        )}

        {/* Barra de Ações Inferior */}
        <div className="mt-8 md:mt-12 mb-6 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => setIsManaging(!isManaging)}
            className={`px-8 md:px-10 py-3 md:py-3.5 rounded-2xl font-bold text-xs md:text-sm uppercase tracking-[0.2em] transition-all border-2 flex items-center gap-2 cursor-pointer ${
              isManaging
                ? 'bg-white text-gray-950 border-white shadow-xl shadow-white/20 hover:bg-white/90'
                : 'border-white/20 text-white/60 hover:text-white hover:border-white'
            }`}
          >
            {isManaging ? <Check className="w-4 h-4" /> : null}
            {isManaging ? 'Concluir Edição' : 'Gerenciar Perfis'}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-3 md:py-3.5 rounded-2xl font-bold text-xs md:text-sm uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
            >
              Voltar à Navegação
            </button>
          )}
        </div>
      </div>

      {/* Modal Criar / Editar Perfil */}
      {(isAdding || editingProfile) && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#0d121d] p-6 md:p-8 shadow-2xl relative text-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl md:text-2xl font-black tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                {isAdding ? 'Criar Novo Perfil' : 'Editar Perfil'}
              </h3>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingProfile(null);
                  setError(null);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-white/50 hover:text-white" />
              </button>
            </div>

            <form onSubmit={isAdding ? handleCreateProfile : handleUpdateProfile} className="space-y-6">
              <div>
                <label className="text-xs uppercase font-bold tracking-widest text-white/50 block mb-2">
                  Nome do Perfil
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Sala de Estar, Kids, Maria"
                  maxLength={30}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 focus:border-[#007df7] rounded-2xl outline-none text-white font-bold placeholder-white/30 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs uppercase font-bold tracking-widest text-white/50 block mb-3">
                  Escolha um Avatar Oficial
                </label>
                <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto no-scrollbar p-1">
                  {OFFICIAL_AVATARS.map((av) => (
                    <button
                      type="button"
                      key={av.id}
                      onClick={() => setFormAvatarId(av.id)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all transform hover:scale-105 cursor-pointer ${
                        formAvatarId === av.id
                          ? 'border-[#007df7] ring-2 ring-[#007df7]/40 scale-100 shadow-lg'
                          : 'border-white/10 opacity-60 hover:opacity-100'
                      }`}
                      title={av.name}
                    >
                      <img src={av.dataUri} alt={av.name} className="w-full h-full object-cover" />
                      {formAvatarId === av.id && (
                        <div className="absolute top-1 right-1 bg-[#007df7] text-white p-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingProfile(null);
                    setError(null);
                  }}
                  className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/60 hover:text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || formName.trim().length < 2}
                  className="flex-1 py-3.5 bg-[#007df7] hover:bg-[#006ee6] disabled:opacity-40 text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#007df7]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isAdding ? 'Criar Perfil' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingProfile && (
        <div className="fixed inset-0 z-[410] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[32px] border border-red-500/20 bg-[#0d121d] p-6 md:p-8 shadow-2xl relative text-white">
            <h3 className="text-xl font-black text-white mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              Excluir perfil?
            </h3>
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              O perfil <strong className="text-white">"{deletingProfile.name}"</strong> será excluído permanentemente da sua conta.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingProfile(null)}
                className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/60 hover:text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={saving}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSelectorView;
