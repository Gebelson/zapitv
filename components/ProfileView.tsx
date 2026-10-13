
import React, { useState } from 'react';
import { 
  User as UserIcon, Mail, Calendar, LogOut, Edit2, Save, X, 
  Settings, ChevronDown, Shield, PlayCircle, Key, Check, RefreshCw 
} from 'lucide-react';
import { User, AppView } from '../types';

interface ProfileViewProps {
  user: User;
  isDarkMode: boolean;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
  onNavigate: (view: AppView) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, isDarkMode, onLogout, onUpdateUser, onNavigate }) => {
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados dos formulários
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: user.password || '',
    newPassword: '',
  });

  const handleSaveHeader = () => {
    onUpdateUser({
      ...user,
      name: formData.name,
      email: formData.email
    });
    setIsEditingHeader(false);
  };

  const handleToggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      onUpdateUser({
        ...user,
        name: formData.name,
        email: formData.email,
        password: formData.newPassword || formData.password
      });
      setIsSaving(false);
      setFormData(prev => ({ ...prev, newPassword: '' }));
      setExpandedSection(null);
    }, 800);
  };

  return (
    <div className="p-4 md:p-12 max-w-4xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-8 md:mb-12">
        <h2 className={`text-3xl md:text-4xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Meu Perfil</h2>
        <p className="text-gray-500 text-sm md:text-base">Gerencie suas informações e preferências diretamente aqui</p>
      </div>

      {/* Perfil Principal */}
      <div className={`p-6 md:p-10 rounded-3xl mb-8 border transition-all ${
        isDarkMode ? 'bg-[#151C26] border-gray-800' : 'bg-white border-gray-100 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-[#007df7] flex items-center justify-center text-white shrink-0 shadow-xl shadow-[#007df7]/20">
            <UserIcon className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-2">
              {isEditingHeader ? (
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`text-2xl font-black w-full outline-none border-b-2 border-[#007df7] bg-transparent ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  autoFocus
                />
              ) : (
                <h3 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user.name}</h3>
              )}
              
              {!isEditingHeader && (
                <button onClick={() => setIsEditingHeader(true)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <Edit2 className="w-4 h-4 text-[#007df7]" />
                </button>
              )}
            </div>
            
            <p className="text-sm text-gray-500 mb-6">Assinante {user.plan}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#007df7]/10 flex items-center justify-center text-[#007df7] shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Email</p>
                  <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#007df7]/10 flex items-center justify-center text-[#007df7] shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Membro desde</p>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{user.memberSince}</p>
                </div>
              </div>
            </div>

            {isEditingHeader && (
              <div className="flex items-center gap-3 mt-8 animate-in slide-in-from-top-2">
                <button onClick={handleSaveHeader} className="px-6 py-2 bg-[#007df7] text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#0069d9] transition-colors">
                  <Save className="w-4 h-4" /> Salvar Nome
                </button>
                <button onClick={() => setIsEditingHeader(false)} className="px-6 py-2 bg-white/5 text-gray-400 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seção Acordeão de Configurações */}
      <div className={`rounded-3xl border transition-all overflow-hidden ${
        isDarkMode ? 'bg-[#151C26] border-gray-800' : 'bg-white border-gray-100 shadow-sm'
      }`}>
        <div className="p-8 border-b border-gray-800/50 flex items-center justify-between bg-black/5">
          <h4 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Configurações da Conta</h4>
          <Settings className="w-5 h-5 text-gray-500" />
        </div>
        
        <div className="divide-y divide-gray-800/50">
          {/* Segurança e Senha */}
          <div className="group">
            <button 
              onClick={() => handleToggleSection('security')}
              className="w-full p-8 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${expandedSection === 'security' ? 'bg-[#007df7] text-white' : 'bg-[#007df7]/10 text-[#007df7]'}`}>
                  <Key className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Segurança</p>
                  <p className="text-sm text-gray-500">Altere sua senha e e-mail de acesso</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${expandedSection === 'security' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'security' && (
              <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300">
                <form onSubmit={handleSaveAccount} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">Novo E-mail</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={`w-full p-3 rounded-xl border outline-none text-sm ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">Nova Senha</label>
                    <input type="password" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} placeholder="Mínimo 8 caracteres" className={`w-full p-3 rounded-xl border outline-none text-sm ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`} />
                  </div>
                  <button type="submit" disabled={isSaving} className="w-full py-3 bg-[#007df7] text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#0069d9] transition-all">
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Salvando...' : 'Atualizar Acesso'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Reprodução */}
          <div className="group">
            <button 
              onClick={() => handleToggleSection('playback')}
              className="w-full p-8 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${expandedSection === 'playback' ? 'bg-[#007df7] text-white' : 'bg-[#007df7]/10 text-[#007df7]'}`}>
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Reprodução</p>
                  <p className="text-sm text-gray-500">Configure qualidade de vídeo e legendas</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${expandedSection === 'playback' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'playback' && (
              <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300">
                <div className="space-y-4">
                  <p className="text-[10px] uppercase font-bold text-gray-500 mb-4">Qualidade Padrão</p>
                  {['Automático', 'Alta (HD)', 'Ultra HD (4K)'].map((opt, i) => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer group/opt">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${i === 0 ? 'border-[#007df7]' : 'border-gray-700'}`}>
                        {i === 0 && <div className="w-2.5 h-2.5 bg-[#007df7] rounded-full" />}
                      </div>
                      <span className={`text-sm ${i === 0 ? 'text-white font-bold' : 'text-gray-500'}`}>{opt}</span>
                    </label>
                  ))}
                  <div className="pt-4">
                    <button className="text-[10px] font-black uppercase text-[#007df7] hover:underline">Salvar Preferências</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Privacidade */}
          <div className="group">
            <button 
              onClick={() => handleToggleSection('privacy')}
              className="w-full p-8 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${expandedSection === 'privacy' ? 'bg-[#007df7] text-white' : 'bg-[#007df7]/10 text-[#007df7]'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Privacidade</p>
                  <p className="text-sm text-gray-500">Gerencie seus dados e histórico</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${expandedSection === 'privacy' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'privacy' && (
              <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div>
                      <p className="text-sm font-bold">Histórico de Visualização</p>
                      <p className="text-[10px] text-gray-500">Usado para recomendações personalizadas</p>
                    </div>
                    <div className="w-12 h-6 bg-[#007df7] rounded-full flex items-center justify-end px-1"><div className="w-4 h-4 bg-white rounded-full shadow-lg" /></div>
                  </div>
                  <button className="w-full py-3 border border-red-500/30 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">LIMPAR TODO O HISTÓRICO</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Gerenciar Assinatura
          </button>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-8 py-3 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-xl shadow-[#007df7]/20"
        >
          <LogOut className="w-5 h-5" />
          Desconectar da ZapiTV
        </button>
      </div>
    </div>
  );
};

export default ProfileView;
