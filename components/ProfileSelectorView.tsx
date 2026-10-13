
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit3, Trash2, Check, X, User as UserIcon, Camera, Upload, Loader2, Lock, Unlock, AlertCircle, Baby } from 'lucide-react';
import { User, Profile } from '../types';
import { AVATARS } from '../constants';
import AnimatedBackground from './AnimatedBackground';

interface ProfileSelectorViewProps {
  user: User;
  onSelectProfile: (profile: Profile) => void;
  onUpdateUser: (updatedUser: User) => void;
  isDarkMode: boolean;
}

type PinMode = 'access' | 'create' | 'delete' | 'edit' | 'create_new' | null;

const KIDS_AVATAR_URL = "https://i.imgur.com/LSu54L9.png";

const ProfileSelectorView: React.FC<ProfileSelectorViewProps> = ({ user, onSelectProfile, onUpdateUser, isDarkMode }) => {
  const [isManaging, setIsManaging] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isKidsMode, setIsKidsMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para PIN
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null); // Perfil alvo da ação de PIN
  const [newProfilePin, setNewProfilePin] = useState<string | undefined>(undefined); // PIN temporário para novo perfil
  const pinInputRef = useRef<HTMLInputElement>(null);

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

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsProcessingImage(true);
        const resized = await resizeImage(file);
        setSelectedAvatar(resized);
      } catch (err) {
        console.error("Erro ao processar imagem:", err);
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleToggleKidsMode = () => {
    const newValue = !isKidsMode;
    setIsKidsMode(newValue);
    if (newValue) {
      setSelectedAvatar(KIDS_AVATAR_URL);
    } else {
      // Reverte para o avatar padrão ou o original se estiver editando
      setSelectedAvatar(editingProfile ? editingProfile.avatar : AVATARS[0]);
    }
  };

  const handleAddProfile = () => {
    if (!newName.trim()) return;
    const newProfile: Profile = {
      id: `p-${Date.now()}`,
      name: newName,
      avatar: selectedAvatar,
      isChild: isKidsMode,
      pin: newProfilePin
    };
    onUpdateUser({ ...user, profiles: [...user.profiles, newProfile] });
    setIsAdding(false);
    setNewName('');
    setIsKidsMode(false);
    setNewProfilePin(undefined);
  };

  const handleUpdateProfile = () => {
    if (!editingProfile || !newName.trim()) return;
    const updatedProfiles = user.profiles.map(p => 
      p.id === editingProfile.id ? { ...p, name: newName, avatar: selectedAvatar, isChild: isKidsMode, pin: editingProfile.pin } : p
    );
    onUpdateUser({ ...user, profiles: updatedProfiles });
    setEditingProfile(null);
    setNewName('');
    setIsKidsMode(false);
  };

  const handleDeleteProfile = (id: string) => {
    if (user.profiles.length <= 1) return;
    const updatedProfiles = user.profiles.filter(p => p.id !== id);
    onUpdateUser({ ...user, profiles: updatedProfiles });
  };

  // Lógica de Clique no Perfil
  const handleProfileClick = (profile: Profile) => {
    if (isManaging) {
      // Se tiver PIN, exige senha para editar
      if (profile.pin) {
        setTargetProfile(profile);
        setPinMode('edit');
        setPinInput('');
        setPinError(false);
      } else {
        // Sem PIN, edita direto
        setEditingProfile(profile);
        setNewName(profile.name);
        setSelectedAvatar(profile.avatar);
        setIsKidsMode(profile.isChild);
      }
    } else {
      // Tentar acessar perfil
      if (profile.pin) {
        setTargetProfile(profile);
        setPinMode('access');
        setPinInput('');
        setPinError(false);
      } else {
        onSelectProfile(profile);
      }
    }
  };

  // Lógica de Manipulação do PIN
  const handlePinChange = (val: string) => {
    if (!/^\d*$/.test(val)) return; // Apenas números
    if (val.length > 4) return;
    
    setPinInput(val);
    setPinError(false);

    // Auto-submit quando tiver 4 dígitos
    if (val.length === 4) {
      handlePinSubmit(val);
    }
  };

  const handlePinSubmit = (code: string) => {
    // 1. Acessar Perfil
    if (pinMode === 'access' && targetProfile) {
      if (code === targetProfile.pin) {
        onSelectProfile(targetProfile);
        setPinMode(null);
        setTargetProfile(null);
      } else {
        setPinError(true);
        setTimeout(() => setPinInput(''), 400);
      }
    } 
    // 2. Criar PIN (Dentro do Editor - Perfil Existente)
    else if (pinMode === 'create' && editingProfile) {
      const updatedProfile = { ...editingProfile, pin: code };
      setEditingProfile(updatedProfile); // Atualiza estado local do editor
      setPinMode(null);
    }
    // 3. Criar PIN (Dentro do Editor - Novo Perfil)
    else if (pinMode === 'create_new') {
      setNewProfilePin(code);
      setPinMode(null);
    }
    // 4. Remover PIN (Dentro do Editor - Exige confirmação)
    else if (pinMode === 'delete' && editingProfile) {
      if (code === editingProfile.pin) {
        const updatedProfile = { ...editingProfile, pin: undefined };
        setEditingProfile(updatedProfile); // Remove PIN do estado local
        setPinMode(null);
      } else {
        setPinError(true);
        setTimeout(() => setPinInput(''), 400);
      }
    }
    // 5. Editar Perfil Protegido
    else if (pinMode === 'edit' && targetProfile) {
      if (code === targetProfile.pin) {
        // Senha correta, abre o editor
        setEditingProfile(targetProfile);
        setNewName(targetProfile.name);
        setSelectedAvatar(targetProfile.avatar);
        setIsKidsMode(targetProfile.isChild);
        setPinMode(null);
        setTargetProfile(null);
      } else {
        setPinError(true);
        setTimeout(() => setPinInput(''), 400);
      }
    }
  };

  // Renderiza o Modal de PIN
  const renderPinModal = () => {
    if (!pinMode) return null;

    let title = "";
    let sub = "";
    if (pinMode === 'access') {
      title = `Bloqueio de Perfil`;
      sub = `Digite o PIN de ${targetProfile?.name} para acessar.`;
    } else if (pinMode === 'create' || pinMode === 'create_new') {
      title = "Criar PIN de Perfil";
      sub = "Crie uma senha de 4 dígitos para proteger este perfil.";
    } else if (pinMode === 'delete') {
      title = "Remover Bloqueio";
      sub = "Confirme o PIN atual para remover a senha.";
    } else if (pinMode === 'edit') {
      title = "Bloqueio de Edição";
      sub = "Digite o PIN para editar este perfil.";
    }

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-black/30 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl flex flex-col items-center relative overflow-hidden animate-in zoom-in-95 duration-300">
          
          {/* Efeito de brilho de vidro */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          <h3 className="text-xl font-black text-white mb-2 relative z-10">{title}</h3>
          <p className="text-gray-300 mb-8 text-center text-xs relative z-10 max-w-[80%]">{sub}</p>
          
          <div className={`flex gap-4 mb-8 relative z-10 ${pinError ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pinInput.length > i 
                    ? (pinError ? 'bg-[#007df7] border-[#007df7] shadow-[0_0_10px_rgba(0,125,247,0.5)]' : 'bg-white border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]') 
                    : 'border-white/20 bg-transparent'
                }`} 
              />
            ))}
          </div>

          <input 
            ref={pinInputRef}
            type="tel" 
            value={pinInput} 
            onChange={(e) => handlePinChange(e.target.value)}
            className="opacity-0 absolute pointer-events-none" 
            autoFocus 
            onBlur={() => pinInputRef.current?.focus()} // Mantém foco
          />

          <div className="grid grid-cols-3 gap-4 md:gap-5 mb-8 relative z-10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button 
                key={num} 
                onClick={() => handlePinChange(pinInput + num)}
                className="w-16 h-16 rounded-full border border-white/10 hover:bg-white/10 hover:border-white/40 text-white text-2xl font-bold transition-all flex items-center justify-center active:scale-90 active:bg-white/20"
              >
                {num}
              </button>
            ))}
            <div className="w-16 h-16" />
            <button 
              onClick={() => handlePinChange(pinInput + '0')}
              className="w-16 h-16 rounded-full border border-white/10 hover:bg-white/10 hover:border-white/40 text-white text-2xl font-bold transition-all flex items-center justify-center active:scale-90 active:bg-white/20"
            >
              0
            </button>
             <button 
              onClick={() => setPinInput(pinInput.slice(0, -1))}
              className="w-16 h-16 rounded-full border-transparent hover:bg-white/10 text-white flex items-center justify-center active:scale-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <button onClick={() => { setPinMode(null); setPinInput(''); setPinError(false); }} className="text-white/40 hover:text-white uppercase font-bold text-xs tracking-widest transition-colors relative z-10">
            Cancelar
          </button>
        </div>
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
          .animate-shake { animation: shake 0.3s ease-in-out; }
        `}</style>
      </div>,
      document.body
    );
  };

  const renderEditor = (isNew: boolean) => (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className={`w-full max-w-xl rounded-[40px] border p-8 md:p-12 shadow-2xl relative overflow-hidden ${isDarkMode ? 'bg-[#0A0E17]/90 border-white/10 text-white' : 'bg-white/90 border-black/5 text-gray-900'}`}>
        <div className="absolute top-0 right-0 p-8">
            <button onClick={() => { setIsAdding(false); setEditingProfile(null); setNewProfilePin(undefined); setIsKidsMode(false); }} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                <X className="w-6 h-6 opacity-40 hover:opacity-100" />
            </button>
        </div>

        <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black mb-10 tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                {isNew ? 'Novo Perfil' : 'Editar Perfil'}
            </h2>
            
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-6">
                <div className="relative group shrink-0">
                    <button 
                      disabled={isProcessingImage || isKidsMode}
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-32 h-32 rounded-[22%] overflow-hidden shadow-2xl border-4 border-[#007df7]/20 relative block group disabled:opacity-100 disabled:cursor-default aspect-square flex-shrink-0 transition-all ${isKidsMode ? 'brightness-110' : ''}`}
                    >
                        {isProcessingImage ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                          </div>
                        ) : (
                          <>
                            <img src={selectedAvatar} className="w-full h-full object-cover group-hover:brightness-50 transition-all" alt="Avatar" loading="lazy" />
                            {!isKidsMode && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Upload className="w-8 h-8 text-white" />
                              </div>
                            )}
                          </>
                        )}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    {!isKidsMode && (
                      <div className="absolute -bottom-2 -right-2 bg-[#007df7] text-white p-2 rounded-2xl shadow-lg pointer-events-none">
                          <Camera className="w-4 h-4" />
                      </div>
                    )}
                </div>
                <div className="flex-1 space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-black tracking-widest opacity-40 mb-2 block">Apelido do Perfil</label>
                      <input 
                          type="text" 
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Ex: Sala de Estar"
                          className={`w-full p-4 rounded-3xl border-none outline-none font-bold text-lg transition-all ${isDarkMode ? 'bg-white/5 focus:bg-white/10' : 'bg-black/5 focus:bg-black/10'}`}
                          autoFocus
                      />
                    </div>
                    
                    {/* Checkbox Perfil Kids */}
                    <div className="flex items-center gap-3">
                       <button 
                          onClick={handleToggleKidsMode}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            isKidsMode ? 'bg-[#007df7] border-[#007df7]' : 'border-gray-500 bg-transparent'
                          }`}
                       >
                          {isKidsMode && <Check className="w-4 h-4 text-white" />}
                       </button>
                       <span className="font-bold text-sm cursor-pointer" onClick={handleToggleKidsMode}>Perfil Kids</span>
                       {isKidsMode && <Baby className="w-5 h-5 text-[#007df7]" />}
                    </div>
                </div>
              </div>

              {/* Seção de Bloqueio de Perfil (Agora disponível para Novo e Edição) */}
              {(isNew || editingProfile) && (
                <div className={`p-5 rounded-3xl border flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {(isNew ? newProfilePin : editingProfile?.pin) ? <Lock className="w-4 h-4 text-[#007df7]" /> : <Unlock className="w-4 h-4 opacity-50" />}
                      <span className="font-bold text-sm">Bloqueio de Perfil</span>
                    </div>
                    <p className="text-[10px] opacity-60 max-w-[200px] leading-tight">
                      {(isNew ? newProfilePin : editingProfile?.pin)
                        ? "Este perfil está protegido com um PIN de 4 dígitos." 
                        : "Adicione um PIN para proteger o acesso."}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      if (isNew) {
                        if (newProfilePin) {
                           setNewProfilePin(undefined); // Remove direto na criação
                        } else {
                           setPinInput('');
                           setPinError(false);
                           setPinMode('create_new');
                        }
                      } else if (editingProfile) {
                        setPinInput('');
                        setPinError(false);
                        setPinMode(editingProfile.pin ? 'delete' : 'create');
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      (isNew ? newProfilePin : editingProfile?.pin)
                        ? 'bg-white/10 hover:bg-[#007df7] hover:text-white border border-transparent' 
                        : 'bg-transparent border border-gray-500 hover:border-[#007df7] hover:text-[#007df7]'
                    }`}
                  >
                    {(isNew ? newProfilePin : editingProfile?.pin) ? "Remover PIN" : "Criar PIN"}
                  </button>
                </div>
              )}

              {/* Seleção de Avatar (Escondida se for Kids Mode) */}
              {!isKidsMode && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] uppercase font-black tracking-widest opacity-40 block">Escolha um Avatar</p>
                      <button 
                          disabled={isProcessingImage}
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[10px] uppercase font-black tracking-widest text-[#007df7] hover:underline flex items-center gap-1 disabled:opacity-30"
                      >
                          <Upload className="w-3 h-3" /> Fazer Upload
                      </button>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                    {AVATARS.map(avatar => (
                      <button 
                        key={avatar} 
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`w-full aspect-square rounded-[22%] overflow-hidden border-2 transition-all transform hover:scale-110 active:scale-90 flex-shrink-0 ${selectedAvatar === avatar ? 'border-[#007df7] scale-105 shadow-lg shadow-[#007df7]/30' : 'border-transparent opacity-40 hover:opacity-100'}`}
                      >
                        <img src={avatar} className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagem Informativa para Kids Mode */}
              {isKidsMode && (
                <div className={`p-4 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 ${isDarkMode ? 'bg-[#007df7]/10 text-[#007df7]' : 'bg-[#007df7]/10 text-[#007df7]'}`}>
                  <Baby className="w-6 h-6 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    O <b>Perfil Kids</b> possui uma interface simplificada e exibe apenas conteúdo adequado para crianças.
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button 
                  disabled={isProcessingImage || !newName.trim()}
                  onClick={isNew ? handleAddProfile : handleUpdateProfile}
                  className="flex-1 py-4 bg-[#007df7] text-white font-black rounded-[24px] shadow-xl shadow-[#007df7]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Check className="w-5 h-5" /> Salvar Perfil
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[350] flex flex-col items-center justify-start sm:justify-center p-6 transition-colors duration-500 overflow-y-auto no-scrollbar pt-12 md:pt-6">
      <AnimatedBackground isDarkMode={isDarkMode} />
      
      <div className="flex items-center gap-2 md:gap-3 mb-10 md:mb-14 shrink-0">
        <div className="w-10 h-8 md:w-12 md:h-10"><BrandLogo /></div>
        <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Sora', sans-serif" }}>
          ZAPI<span className="text-blue-500">TV</span>
        </h1>
      </div>

      <div className="max-w-full w-full text-center relative z-10 flex flex-col items-center px-4 pb-20 md:pb-0">
        <h2 className={`text-xl md:text-3xl lg:text-4xl font-black mb-2 md:mb-4 tracking-tight leading-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Sora', sans-serif" }}>
            Quem está assistindo agora?
        </h2>
        
        {/* lg:flex-nowrap e lg:max-w-none forçam a fileira única no desktop */}
        <div className="flex flex-wrap lg:flex-nowrap justify-center items-start gap-x-4 md:gap-x-10 lg:gap-x-14 w-full max-w-4xl lg:max-w-none py-8 md:py-10">
          {user.profiles.map(profile => (
            <div key={profile.id} className="group flex flex-col items-center gap-3 md:gap-5 w-[140px] xs:w-[160px] sm:w-auto mb-4 shrink-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-[#007df7] rounded-[22%] opacity-0 group-hover:opacity-25 blur-xl transition-all duration-500 scale-105" />
                
                <button 
                  onClick={() => handleProfileClick(profile)}
                  className={`relative w-28 h-28 xs:w-32 xs:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 aspect-square rounded-[22%] overflow-hidden border-4 transition-all duration-300 transform group-hover:scale-110 group-active:scale-95 shadow-2xl flex-shrink-0 ${
                    isManaging ? 'border-[#007df7] animate-pulse' : 'border-white/10 group-hover:border-white'
                  }`}
                >
                  <img src={profile.avatar} className="w-full h-full object-cover" loading="lazy" />
                  
                  {/* Overlay de Bloqueio */}
                  {!isManaging && profile.pin && (
                    <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-md">
                      <Lock className="w-3 h-3 md:w-4 md:h-4 text-white" />
                    </div>
                  )}

                  {isManaging && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <Edit3 className="w-8 h-8 md:w-16 text-white" />
                    </div>
                  )}
                </button>

                {isManaging && user.profiles.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                    className="absolute -top-2 -right-2 md:-top-3 md:-right-3 w-8 h-8 md:w-12 md:h-12 bg-[#007df7] text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl border-2 border-white/20 hover:scale-110 active:scale-90 transition-all z-20"
                  >
                    <Trash2 className="w-4 h-4 md:w-6" />
                  </button>
                )}
              </div>
              <span className={`text-sm md:text-xl lg:text-2xl font-black tracking-tight transition-all duration-300 max-w-full px-2 truncate flex items-center gap-2 ${
                isManaging ? 'text-[#007df7]' : `${isDarkMode ? 'text-white/40 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-900'}`
              }`} style={{ fontFamily: "'Sora', sans-serif" }}>
                {profile.name}
              </span>
            </div>
          ))}

          {user.profiles.length < 5 && (
            <div className="group flex flex-col items-center gap-3 md:gap-5 w-[140px] xs:w-[160px] sm:w-auto mb-4 shrink-0">
              <button 
                onClick={() => { setIsAdding(true); setNewName(''); setSelectedAvatar(AVATARS[user.profiles.length % AVATARS.length]); setNewProfilePin(undefined); setIsKidsMode(false); }}
                className={`w-28 h-28 xs:w-32 xs:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 aspect-square flex items-center justify-center rounded-[22%] border-4 border-dashed transition-all transform hover:scale-110 hover:border-[#007df7]/50 hover:bg-[#007df7]/10 flex-shrink-0 ${
                  isDarkMode ? 'border-white/10' : 'border-black/10'
                }`}
              >
                <Plus className={`w-8 h-8 md:w-20 transition-colors ${isDarkMode ? 'text-white/20 group-hover:text-[#007df7]' : 'text-black/10 group-hover:text-[#007df7]'}`} />
              </button>
              <span className={`text-sm md:text-xl lg:text-2xl font-black tracking-tight transition-all duration-300 ${isDarkMode ? 'text-white/20 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-900'}`} style={{ fontFamily: "'Sora', sans-serif" }}>
                Adicionar
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 md:mt-14 mb-10">
            <button 
                onClick={() => setIsManaging(!isManaging)}
                className={`px-8 md:px-12 py-3 md:py-4 rounded-[18px] md:rounded-[20px] font-black text-[10px] md:text-sm uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all border-2 flex items-center gap-2 md:gap-3 mx-auto ${
                    isManaging 
                    ? 'bg-white text-gray-900 border-white shadow-xl shadow-white/20' 
                    : `${isDarkMode ? 'border-white/20 text-white/40 hover:text-white hover:border-white' : 'border-black/10 text-gray-400 hover:text-gray-900 hover:border-black'}`
                }`}
            >
                {isManaging ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : null}
                {isManaging ? 'Concluir Edição' : 'Gerenciar Perfis'}
            </button>
        </div>
      </div>

      {isAdding && renderEditor(true)}
      {editingProfile && renderEditor(false)}
      {renderPinModal()}
    </div>
  );
};

export default ProfileSelectorView;
