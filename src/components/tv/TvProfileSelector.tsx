/**
 * ZAPITV — SELEÇÃO DE PERFIS SMART TV COM SUPORTE A D-PAD (P0 CORREÇÃO DEFINITIVA)
 * 
 * Componente espacial isolado para navegação por controle remoto nas Smart TVs
 * (Fire TV, Samsung Tizen, LG webOS, Media Station X, Android TV).
 * 
 * Correções P0 implementadas:
 * 1. Isolamento completo: tela única de seleção de perfis, sem interferência da Home.
 * 2. Auto-foco imediato no perfil ativo ou primeiro perfil com requestAnimationFrame.
 * 3. Prevenção de acionamentos duplicados (debounce de 600ms para evitar synthetic click da Silk/Fire TV).
 * 4. Trava de concorrência e feedback visual de carregamento por card.
 * 5. Gerenciamento completo de perfis na TV via controle remoto:
 *    - Criar perfil (com sugestões rápidas de nome e seletor de avatares oficiais).
 *    - Editar perfil (alterar nome e avatar).
 *    - Excluir perfil com confirmação prévia e barreira de foco.
 * 6. Integração com botão Voltar físico do controle remoto via TvNavigationManager.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Plus, Check, Edit3, Trash2, X, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Profile } from '../../../types';
import { OFFICIAL_AVATARS, DEFAULT_AVATAR_ID, resolveAvatarUrl } from '../../core/profile/avatarRegistry';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';

export interface TvProfileSelectorProps {
  profiles: Profile[];
  activeProfileId?: string | null;
  onSelectProfile: (profile: Profile) => Promise<void> | void;
  onAddProfile?: (name: string, avatarId: string) => Promise<Profile | null | void> | void;
  onEditProfile?: (id: string, name: string, avatarId: string) => Promise<Profile | null | void> | void;
  onDeleteProfile?: (id: string) => Promise<boolean | void> | void;
  onClose?: () => void;
  isSelecting?: boolean;
  errorMessage?: string | null;
}

interface TvProfileCardProps {
  profile: Profile;
  isActive: boolean;
  isManaging: boolean;
  isSelecting: boolean;
  isSelectedTarget: boolean;
  onSelect: (p: Profile) => void;
  onEdit: (p: Profile) => void;
  focusKey: string;
}

const TvProfileCard: React.FC<TvProfileCardProps> = ({
  profile,
  isActive,
  isManaging,
  isSelecting,
  isSelectedTarget,
  onSelect,
  onEdit,
  focusKey,
}) => {
  const lastTriggerRef = useRef(0);

  const handleAction = useCallback(() => {
    const now = performance.now();
    if (now - lastTriggerRef.current < 600 || isSelecting) {
      return;
    }
    lastTriggerRef.current = now;

    if (isManaging) {
      uiSoundService.play('click');
      onEdit(profile);
    } else {
      uiSoundService.play('click');
      onSelect(profile);
    }
  }, [isManaging, isSelecting, onEdit, onSelect, profile]);

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: handleAction,
    onFocus: () => {
      uiSoundService.play('hover');
    },
  });

  return (
    <div
      ref={ref}
      tabIndex={0}
      data-focus-key={focusKey}
      data-profile-id={profile.id}
      data-focused={focused ? 'true' : 'false'}
      onClick={handleAction}
      className={`group relative flex flex-col items-center gap-4 p-4 rounded-3xl transition-all duration-300 outline-none cursor-pointer ${
        focused
          ? 'scale-110 -translate-y-2'
          : isSelecting && !isSelectedTarget
          ? 'opacity-40 pointer-events-none'
          : 'opacity-80 hover:opacity-100'
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

        {/* Indicador de perfil ativo atual */}
        {isActive && !isManaging && (
          <div className="absolute top-2 right-2 bg-[#007df7] text-white p-1 rounded-full shadow-md">
            <Check className="w-4 h-4" />
          </div>
        )}

        {/* Indicador de modo de edição */}
        {isManaging && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            <div className="p-3 bg-[#00baa3] text-black rounded-full shadow-lg">
              <Edit3 className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* Feedback visual durante seleção / ativação */}
        {isSelectedTarget && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-[#00baa3] animate-spin" />
          </div>
        )}
      </div>

      <span
        className={`text-lg md:text-xl font-bold tracking-tight text-center max-w-[160px] truncate transition-colors ${
          focused ? 'text-[#00baa3]' : isActive ? 'text-white font-black' : 'text-white/70'
        }`}
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        {profile.name}
      </span>
      {isManaging && (
        <span className="text-xs text-[#00baa3] font-semibold -mt-2">
          Pressione OK para editar
        </span>
      )}
    </div>
  );
};

const TvAddProfileCard: React.FC<{
  onAdd: () => void;
  disabled?: boolean;
}> = ({ onAdd, disabled }) => {
  const lastTriggerRef = useRef(0);

  const handleAction = useCallback(() => {
    if (disabled) return;
    const now = performance.now();
    if (now - lastTriggerRef.current < 600) return;
    lastTriggerRef.current = now;
    uiSoundService.play('click');
    onAdd();
  }, [disabled, onAdd]);

  const { ref, focused } = useFocusable({
    focusKey: 'TV_PROFILE_ADD_BTN',
    onEnterPress: handleAction,
    onFocus: () => uiSoundService.play('hover'),
  });

  return (
    <div
      ref={ref}
      tabIndex={0}
      data-focus-key="TV_PROFILE_ADD_BTN"
      data-focused={focused ? 'true' : 'false'}
      onClick={handleAction}
      className={`group flex flex-col items-center gap-4 p-4 rounded-3xl transition-all duration-300 outline-none cursor-pointer ${
        focused
          ? 'scale-110 -translate-y-2'
          : 'opacity-60 hover:opacity-100'
      } ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
    >
      <div
        className={`w-36 h-36 md:w-44 md:h-44 rounded-3xl border-4 border-dashed flex items-center justify-center transition-all duration-300 shadow-xl ${
          focused
            ? 'border-[#00baa3] bg-[#00baa3]/10 shadow-[0_0_30px_rgba(0,186,163,0.3)] ring-4 ring-[#00baa3]/20'
            : 'border-white/20 bg-white/5 hover:border-[#007df7]'
        }`}
      >
        <Plus
          className={`w-12 h-12 transition-colors ${
            focused ? 'text-[#00baa3]' : 'text-white/40 group-hover:text-white'
          }`}
        />
      </div>
      <span
        className={`text-lg font-bold transition-colors ${
          focused ? 'text-[#00baa3]' : 'text-white/50'
        }`}
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        Adicionar
      </span>
    </div>
  );
};

const TvActionButton: React.FC<{
  focusKey: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
}> = ({ focusKey, label, icon, variant = 'secondary', onClick, disabled }) => {
  const lastTriggerRef = useRef(0);

  const handleAction = useCallback(() => {
    if (disabled) return;
    const now = performance.now();
    if (now - lastTriggerRef.current < 400) return;
    lastTriggerRef.current = now;
    uiSoundService.play('click');
    onClick();
  }, [disabled, onClick]);

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: handleAction,
    onFocus: () => uiSoundService.play('hover'),
  });

  const getVariantStyles = () => {
    if (variant === 'danger') {
      return focused
        ? 'bg-red-600 text-white border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)] scale-105'
        : 'bg-red-950/60 text-red-300 border-red-800/60 hover:bg-red-900/80';
    }
    if (variant === 'primary') {
      return focused
        ? 'bg-[#00baa3] text-black border-[#00baa3] shadow-[0_0_25px_rgba(0,186,163,0.5)] scale-105 font-black'
        : 'bg-[#007df7] text-white border-[#007df7] hover:bg-[#0060cc]';
    }
    return focused
      ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105'
      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white';
  };

  return (
    <button
      ref={ref}
      tabIndex={0}
      data-focus-key={focusKey}
      data-focused={focused ? 'true' : 'false'}
      onClick={handleAction}
      disabled={disabled}
      className={`px-6 py-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-wider transition-all duration-200 outline-none cursor-pointer ${getVariantStyles()} ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      }`}
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

// Seletor de Avatar espacial
const TvAvatarItem: React.FC<{
  avatar: { id: string; name: string; dataUri: string };
  isSelected: boolean;
  onSelect: (id: string) => void;
  focusKey: string;
}> = ({ avatar, isSelected, onSelect, focusKey }) => {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => {
      uiSoundService.play('click');
      onSelect(avatar.id);
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  return (
    <div
      ref={ref}
      tabIndex={0}
      onClick={() => {
        uiSoundService.play('click');
        onSelect(avatar.id);
      }}
      className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-4 transition-all duration-200 outline-none cursor-pointer shrink-0 ${
        focused
          ? 'scale-110 border-[#00baa3] shadow-[0_0_25px_rgba(0,186,163,0.6)] ring-4 ring-[#00baa3]/30 z-10'
          : isSelected
          ? 'border-[#007df7] ring-2 ring-[#007df7]/40'
          : 'border-white/10 opacity-60 hover:opacity-100'
      }`}
    >
      <img src={avatar.dataUri} alt={avatar.name} className="w-full h-full object-cover" />
      {isSelected && (
        <div className="absolute top-1 right-1 bg-[#007df7] text-white p-0.5 rounded-full shadow">
          <Check className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
};

export const TvProfileSelector: React.FC<TvProfileSelectorProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onEditProfile,
  onDeleteProfile,
  onClose,
  isSelecting = false,
  errorMessage = null,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);

  // Estados dos modais de criação/edição/exclusão
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formName, setFormName] = useState('');
  const [formAvatarId, setFormAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_PROFILE_SELECTOR_CONTAINER',
    isFocusBoundary: true,
  });

  // Sugestões de nomes rápidos para facilitar uso com controle remoto na TV
  const namePresets = ['Principal', 'Família', 'Kids', 'Quarto', 'Filmes'];

  // Auto-foco obrigatório ao abrir ou retornar à lista de perfis
  useEffect(() => {
    if (isModalOpen || deleteTarget) return;

    const targetKey =
      activeProfileId && profiles.some((p) => p.id === activeProfileId)
        ? `TV_PROFILE_CARD_${activeProfileId}`
        : profiles.length > 0
        ? `TV_PROFILE_CARD_${profiles[0].id}`
        : 'TV_PROFILE_ADD_BTN';

    const frame = requestAnimationFrame(() => {
      try {
        setFocus(targetKey);
      } catch {}
    });

    const timer = setTimeout(() => {
      try {
        setFocus(targetKey);
      } catch {}
    }, 60);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [isModalOpen, deleteTarget, profiles, activeProfileId]);

  // Foco inicial ao abrir o formulário de perfil
  useEffect(() => {
    if (isModalOpen && !deleteTarget) {
      const timer = setTimeout(() => {
        try {
          setFocus('TV_PROFILE_FORM_NAME');
        } catch {}
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, deleteTarget]);

  // Foco inicial ao abrir a confirmação de exclusão (foco de segurança no Cancelar)
  useEffect(() => {
    if (deleteTarget) {
      const timer = setTimeout(() => {
        try {
          setFocus('TV_CONFIRM_CANCEL_BTN');
        } catch {}
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [deleteTarget]);

  // Captura do botão Voltar / Back da Smart TV via pilha prioritária
  useEffect(() => {
    return tvNavigationManager.registerBackHandler('tv-profile-selector', 100, () => {
      if (deleteTarget) {
        setDeleteTarget(null);
        return true;
      }
      if (isModalOpen) {
        setIsModalOpen(false);
        setEditingProfile(null);
        return true;
      }
      if (isManaging) {
        setIsManaging(false);
        return true;
      }
      if (onClose) {
        onClose();
        return true;
      }
      // Quando não há perfil anterior ativo (login inicial), consome para não sair para tela preta
      return true;
    });
  }, [deleteTarget, isModalOpen, isManaging, onClose]);

  const selectingLockRef = useRef(false);

  const handleStartSelect = useCallback(
    async (profile: Profile) => {
      if (isSelecting || selectingLockRef.current) return;
      selectingLockRef.current = true;
      setSelectedTargetId(profile.id);
      try {
        await onSelectProfile(profile);
      } finally {
        selectingLockRef.current = false;
        setSelectedTargetId(null);
      }
    },
    [isSelecting, onSelectProfile]
  );

  const handleOpenAddModal = useCallback(() => {
    setEditingProfile(null);
    setFormName(`Perfil ${profiles.length + 1}`);
    const nextAvatar = OFFICIAL_AVATARS[profiles.length % OFFICIAL_AVATARS.length]?.id || DEFAULT_AVATAR_ID;
    setFormAvatarId(nextAvatar);
    setFormError(null);
    setIsModalOpen(true);
  }, [profiles.length]);

  const handleOpenEditModal = useCallback((profile: Profile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormAvatarId(profile.avatarId || DEFAULT_AVATAR_ID);
    setFormError(null);
    setIsModalOpen(true);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    const clean = formName.trim();
    if (!clean || clean.length < 2 || clean.length > 30) {
      setFormError('O nome deve conter entre 2 e 30 caracteres.');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      if (editingProfile) {
        if (onEditProfile) {
          await onEditProfile(editingProfile.id, clean, formAvatarId);
        }
      } else {
        if (onAddProfile) {
          await onAddProfile(clean, formAvatarId);
        }
      }
      setIsModalOpen(false);
      setEditingProfile(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar o perfil.');
    } finally {
      setFormLoading(false);
    }
  }, [editingProfile, formAvatarId, formName, onAddProfile, onEditProfile]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || !onDeleteProfile) return;
    setFormLoading(true);
    try {
      await onDeleteProfile(deleteTarget.id);
      setDeleteTarget(null);
      setIsModalOpen(false);
      setEditingProfile(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao excluir o perfil.');
    } finally {
      setFormLoading(false);
    }
  }, [deleteTarget, onDeleteProfile]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        data-focus-key={focusKey}
        data-testid="tv-profile-selector"
        className="fixed inset-0 z-[500] bg-[#05070a]/98 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-12 select-none overflow-y-auto"
      >
        {/* Banner de Mensagem de Erro Geral */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 px-6 py-3 bg-red-950/80 border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-200 text-sm md:text-base max-w-xl shadow-2xl"
          >
            <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Título Principal */}
        <div className="text-center mb-8 md:mb-12">
          <h2
            className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {isManaging ? 'Gerenciar Perfis na TV' : 'Quem está assistindo na TV?'}
          </h2>
          <p className="text-sm md:text-base text-white/50 font-medium max-w-lg mx-auto">
            {isManaging
              ? 'Selecione um perfil com o controle remoto para editar o nome, avatar ou excluir.'
              : 'Navegue com o direcional do controle remoto e pressione OK para selecionar.'}
          </p>
        </div>

        {/* Grid de Perfis */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 max-w-6xl py-4">
          {profiles.map((p) => (
            <TvProfileCard
              key={p.id}
              profile={p}
              isActive={p.id === activeProfileId}
              isManaging={isManaging}
              isSelecting={isSelecting}
              isSelectedTarget={p.id === selectedTargetId}
              onSelect={handleStartSelect}
              onEdit={handleOpenEditModal}
              focusKey={`TV_PROFILE_CARD_${p.id}`}
            />
          ))}

          {onAddProfile && profiles.length < 5 && !isManaging && (
            <TvAddProfileCard onAdd={handleOpenAddModal} disabled={isSelecting} />
          )}
        </div>

        {/* Barra de Ações Inferior */}
        <div className="mt-8 md:mt-12 flex flex-wrap items-center justify-center gap-4">
          {(onEditProfile || onAddProfile || onDeleteProfile) && profiles.length > 0 && (
            <TvActionButton
              focusKey="TV_PROFILE_MANAGE_BTN"
              label={isManaging ? 'Concluir' : 'Gerenciar Perfis'}
              icon={isManaging ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              variant={isManaging ? 'primary' : 'secondary'}
              onClick={() => setIsManaging((prev) => !prev)}
              disabled={isSelecting}
            />
          )}

          {onClose && (
            <TvActionButton
              focusKey="TV_PROFILE_CLOSE_BTN"
              label="Voltar à TV"
              icon={<ArrowLeft className="w-4 h-4" />}
              variant="secondary"
              onClick={onClose}
              disabled={isSelecting}
            />
          )}
        </div>

        {/* Modal de Criação / Edição de Perfil */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
            <div
              className="w-full max-w-2xl bg-[#0b0e14] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-2xl font-bold text-white">
                  {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {formError && (
                <div className="px-4 py-2 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-sm">
                  {formError}
                </div>
              )}

              {/* Seletor de Avatar */}
              <div>
                <label className="block text-sm font-semibold text-white/60 mb-3">
                  Escolha um Avatar Oficial
                </label>
                <div className="flex items-center gap-3 overflow-x-auto py-2 px-1">
                  {OFFICIAL_AVATARS.map((avatar) => (
                    <TvAvatarItem
                      key={avatar.id}
                      avatar={avatar}
                      isSelected={avatar.id === formAvatarId}
                      onSelect={(id) => setFormAvatarId(id)}
                      focusKey={`TV_FORM_AVATAR_${avatar.id}`}
                    />
                  ))}
                </div>
              </div>

              {/* Campo de Nome do Perfil */}
              <div>
                <label className="block text-sm font-semibold text-white/60 mb-2">
                  Nome do Perfil
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={30}
                  className="w-full bg-white/5 border-2 border-white/20 focus:border-[#00baa3] rounded-2xl px-5 py-3.5 text-lg font-bold text-white outline-none transition-colors"
                  placeholder="Ex: Sala de Estar"
                  autoFocus
                />

                {/* Sugestões de nomes rápidos com D-Pad */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-xs text-white/40 mr-1">Sugestões rápidas:</span>
                  {namePresets.map((preset, idx) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormName(preset)}
                      className="px-3 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-semibold text-white/70 hover:text-white transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ações do Modal */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                <div>
                  {editingProfile && onDeleteProfile && profiles.length > 1 && (
                    <TvActionButton
                      focusKey="TV_FORM_DELETE_BTN"
                      label="Excluir Perfil"
                      icon={<Trash2 className="w-4 h-4" />}
                      variant="danger"
                      onClick={() => setDeleteTarget(editingProfile)}
                      disabled={formLoading}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <TvActionButton
                    focusKey="TV_FORM_CANCEL_BTN"
                    label="Cancelar"
                    variant="secondary"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingProfile(null);
                    }}
                    disabled={formLoading}
                  />

                  <TvActionButton
                    focusKey="TV_FORM_SAVE_BTN"
                    label={formLoading ? 'Salvando...' : 'Salvar'}
                    icon={formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    variant="primary"
                    onClick={handleSaveProfile}
                    disabled={formLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[700] bg-black/95 backdrop-blur-lg flex items-center justify-center p-6">
            <div
              className="w-full max-w-lg bg-[#0f1118] border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 text-center"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400">
                <Trash2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white mb-2">
                  Excluir o perfil &ldquo;{deleteTarget.name}&rdquo;?
                </h3>
                <p className="text-sm text-white/60">
                  Todas as listas, favoritos e histórico de reprodução deste perfil serão excluídos permanentemente.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
                <TvActionButton
                  focusKey="TV_CONFIRM_CANCEL_BTN"
                  label="Cancelar"
                  variant="secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={formLoading}
                />

                <TvActionButton
                  focusKey="TV_CONFIRM_DELETE_BTN"
                  label={formLoading ? 'Excluindo...' : 'Sim, Excluir'}
                  icon={formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  variant="danger"
                  onClick={handleConfirmDelete}
                  disabled={formLoading}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
};
