
import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, CreditCard, Shield, Monitor, User, ChevronRight, 
  ArrowLeft, Plus, Smartphone, Key, Mail, Phone, 
  AlertCircle, PlayCircle, Lock, Users, HelpCircle, Settings, Edit3, Clock, Trash2, Info, ShieldCheck, Smile, Sun, Moon, Bell, X, Star, LogOut, Check, Copy, AlertTriangle, Gift, FileText, Volume2
} from 'lucide-react';
import { User as UserType, AppView, SiteNotification } from '../types';
import { skipService } from '../src/core/skip/skipService';
import { autoPlayService } from '../src/core/playback/autoPlayService';
import { subtitleStyleService, SubtitleStyle } from '../src/core/subtitles/subtitleStyleService';
import { userPreferenceStore } from '../src/core/recommendations/userPreferenceStore';
import { recommendationEngine } from '../src/core/recommendations/recommendationEngine';
import { consentManager } from '../src/core/recommendations/consentManager';
import { uiSoundService } from '../src/core/audio/uiSoundService';

interface SettingsViewProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  user: UserType;
  onUpdateUser: (updatedUser: UserType) => void;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  notifications?: SiteNotification[];
}

type SettingsTab = 'overview' | 'playback' | 'subscription' | 'security' | 'devices';
type ActiveModal = 'plans' | 'payment' | 'cancel' | 'devices-logout' | 'redeem-code' | 'billing-history' | null;

const SettingsView: React.FC<SettingsViewProps> = ({ 
  isDarkMode, setIsDarkMode, user, onUpdateUser, onNavigate, onLogout, notifications = [] 
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [soundPreferences, setSoundPreferences] = useState(() => uiSoundService.getPreferences());
  useEffect(() => uiSoundService.subscribe(() => {
    setSoundPreferences(uiSoundService.getPreferences());
  }), []);
  const updateSoundPreferences = (changes: Partial<typeof soundPreferences>) => {
    uiSoundService.updatePreferences(changes);
  };
  
  // Preferências de reprodução
  const [autoSkip, setAutoSkip] = useState<boolean>(() => skipService.isAutoSkipEnabled());
  const handleToggleAutoSkipSetting = () => {
    const newVal = !autoSkip;
    setAutoSkip(newVal);
    skipService.setAutoSkipEnabled(newVal);
    uiSoundService.play('toggle');
    showToast(newVal ? "Salto automático de aberturas ativado." : "Salto automático desativado.");
  };

  // Reprodução automática de episódios
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(() => autoPlayService.isAutoPlayEnabled());

  useEffect(() => {
    const unsub = autoPlayService.subscribe(setAutoPlayNext);
    return unsub;
  }, []);

  const handleToggleAutoPlaySetting = () => {
    const newVal = !autoPlayNext;
    setAutoPlayNext(newVal);
    autoPlayService.setAutoPlayEnabled(newVal);
    uiSoundService.play('toggle');
    showToast(newVal ? "Reprodução automática ativada." : "Reprodução automática desativada.");
  };

  // Estilo de legendas
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(() => subtitleStyleService.getSubtitleStyle());

  useEffect(() => {
    const unsub = subtitleStyleService.subscribe(setSubtitleStyle);
    return unsub;
  }, []);

  const handleUpdateSubtitleStyle = (updates: Partial<SubtitleStyle>) => {
    const next = subtitleStyleService.updateSubtitleStyle(updates);
    setSubtitleStyle(next);
    uiSoundService.play('toggle');
  };

  const handleResetSubtitleStyle = () => {
    const reset = subtitleStyleService.resetSubtitleStyle();
    setSubtitleStyle(reset);
    showToast("Estilo das legendas restaurado para o padrão.");
  };

  const handleClearRecommendationPreferences = async () => {
    try {
      await userPreferenceStore.clearPreferences(user?.id || 'default');
      recommendationEngine.invalidateCache();
      showToast("Preferências de recomendação redefinidas com sucesso.");
    } catch {
      showToast("Não foi possível limpar as preferências.");
    }
  };

  const [collabOptIn, setCollabOptIn] = useState<boolean>(() => consentManager.isCollaborativeOptedIn());
  const handleToggleCollabOptIn = async () => {
    const next = !collabOptIn;
    setCollabOptIn(next);
    consentManager.setCollaborativeOptIn(next);
    uiSoundService.play('toggle');
    if (!next) {
      await consentManager.revokeConsentAndPurge();
      showToast("Participação colaborativa revogada e dados purgados.");
    } else {
      showToast("Participação voluntária em recomendações coletivas ativada!");
    }
  };

  // Estados para modais específicos
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemError, setRedeemError] = useState<string | null>(null);
  
  // Estado específico da aba de segurança para expandir seções via atalho
  const [securitySectionToExpand, setSecuritySectionToExpand] = useState<string | null>(null);

  // Estados dos formulários internos
  const [selectedPlanId, setSelectedPlanId] = useState(user.plan);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: user.password || '',
    newPassword: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdatePlan = () => {
    onUpdateUser({ ...user, plan: selectedPlanId });
    setActiveModal(null);
    showToast(`Plano alterado para ${selectedPlanId} com sucesso!`);
  };

  const handleCancelSubscription = () => {
    onUpdateUser({ ...user, status: 'Inativo' }); // Ou 'Atrasado'/'Cancelado' dependendo da sua lógica de tipos
    setActiveModal(null);
    showToast("Assinatura cancelada. O acesso continua até o fim do ciclo.");
  };

  const handleRedeemCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (redeemCode.toUpperCase() === 'PROMO2026') {
      showToast("Código resgatado! R$ 50,00 adicionados.");
      setRedeemCode('');
      setRedeemError(null);
      setActiveModal(null);
    } else {
      setRedeemError("O código inserido é inválido ou já foi utilizado.");
    }
  };

  const navigateToTab = (tab: SettingsTab, section?: string) => {
    setActiveTab(tab);
    if (section && tab === 'security') {
      setSecuritySectionToExpand(section);
    }
  };

  const MastercardIcon = () => (
    <div className={`w-10 h-6 rounded flex items-center justify-center border shadow-sm ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'}`}>
      <div className="w-3.5 h-3.5 bg-[#eb001b] rounded-full -mr-1.5 opacity-90" />
      <div className="w-3.5 h-3.5 bg-[#f79e1b] rounded-full opacity-90" />
    </div>
  );

  const SidebarItem = ({ id, label, icon: Icon }: { id: SettingsTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-4 px-4 py-3 text-[14px] font-bold transition-all rounded-lg mb-1 group ${
        activeTab === id 
          ? (isDarkMode ? 'text-white bg-white/10 shadow-lg' : 'text-gray-900 bg-gray-100 shadow-sm')
          : (isDarkMode ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')
      }`}
    >
      <Icon className={`w-5 h-5 transition-colors ${activeTab === id ? 'text-[#007df7]' : 'group-hover:text-[#007df7] opacity-50'}`} />
      {label}
    </button>
  );

  const ListRow = ({ icon: Icon, label, desc, badge, showChevron = true, onClick }: any) => (
    <div 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 md:px-6 md:py-5 border-b last:border-0 cursor-pointer group transition-colors ${
      isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
    }`}>
      <div className="flex items-center gap-5">
        {Icon && <Icon className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} group-hover:text-[#007df7] transition-colors`} />}
        <div className="text-left">
          <p className={`text-[15px] font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{label}</p>
          {desc && <p className="text-[12px] text-gray-500 mt-1 leading-tight">{desc}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {badge && <span className="bg-blue-600/10 text-blue-500 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">{badge}</span>}
        {showChevron && <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-1 transition-transform" />}
      </div>
    </div>
  );

  // --- MODALS ---
  const renderModal = () => {
    if (!activeModal) return null;

    const ModalWrapper = ({ children, title, maxWidth = "max-w-xl" }: any) => (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className={`w-full ${maxWidth} rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-[#151C26] border border-gray-800' : 'bg-white'}`}>
          <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
            <button onClick={() => { setActiveModal(null); setRedeemError(null); }} className={`p-2 rounded-full hover:bg-gray-500/10 ${isDarkMode ? 'text-white' : 'text-black'}`}><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </div>
      </div>
    );

    if (activeModal === 'plans') {
      const plans = [
        { id: 'Básico', price: 'R$ 25,90', res: '720p', screens: 1 },
        { id: 'Padrão', price: 'R$ 39,90', res: '1080p', screens: 2 },
        { id: 'Premium 4K', price: 'R$ 55,90', res: '4K + HDR', screens: 4 },
      ];
      return (
        <ModalWrapper title="Alterar Plano">
          <div className="space-y-4">
            {plans.map(p => (
              <div 
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${
                  selectedPlanId === p.id 
                    ? 'border-[#007df7] bg-[#007df7]/10' 
                    : `${isDarkMode ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300'}`
                }`}
              >
                <div>
                  <h4 className={`font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{p.id}</h4>
                  <p className="text-xs text-gray-500">{p.res} • {p.screens} Telas</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{p.price}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlanId === p.id ? 'border-[#007df7]' : 'border-gray-500'}`}>
                    {selectedPlanId === p.id && <div className="w-2.5 h-2.5 bg-[#007df7] rounded-full" />}
                  </div>
                </div>
              </div>
            ))}
            <button 
              onClick={handleUpdatePlan}
              className="w-full py-4 mt-4 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl font-black shadow-lg transition-all"
            >
              CONFIRMAR ALTERAÇÃO
            </button>
          </div>
        </ModalWrapper>
      );
    }

    if (activeModal === 'payment') {
      return (
        <ModalWrapper title="Gerenciar Pagamento">
          <div className="flex items-center gap-4 p-4 rounded-xl border mb-6 bg-gradient-to-r from-blue-900/20 to-transparent border-blue-500/30">
            <MastercardIcon />
            <div>
              <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Mastercard terminando em 5427</p>
              <p className="text-xs text-gray-500">Próxima cobrança em 25/02/2026</p>
            </div>
          </div>
          <button 
            onClick={() => { setActiveModal(null); showToast("Redirecionando para gateway seguro..."); }}
            className={`w-full py-3 rounded-xl border font-bold text-sm mb-3 ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-white' : 'border-gray-300 hover:bg-gray-50 text-gray-900'}`}
          >
            Atualizar forma de pagamento
          </button>
          <button 
            className={`w-full py-3 rounded-xl font-bold text-sm text-[#007df7] hover:underline`}
          >
            Adicionar cartão de backup
          </button>
        </ModalWrapper>
      );
    }

    if (activeModal === 'cancel') {
      return (
        <ModalWrapper title="Cancelar Assinatura">
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h4 className={`font-black text-2xl mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Tem certeza?</h4>
            <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto">
              Ao cancelar, você perderá acesso a milhares de filmes e séries exclusivos da ZapiTV Premium ao final do ciclo atual.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveModal(null)} 
                className={`flex-1 py-3 rounded-xl font-bold border ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-white' : 'border-gray-200 hover:bg-gray-50 text-gray-900'}`}
              >
                Manter Assinatura
              </button>
              <button 
                onClick={handleCancelSubscription}
                className="flex-1 py-3 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </ModalWrapper>
      );
    }

    if (activeModal === 'redeem-code') {
      return (
        <ModalWrapper title="Resgatar Código">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8" />
            </div>
            <p className="text-sm text-gray-500 mb-6">Insira o código do seu cartão pré-pago ou código promocional abaixo.</p>
            
            <form onSubmit={handleRedeemCode}>
              <input 
                autoFocus
                type="text" 
                placeholder="Código PIN ou Promocional" 
                value={redeemCode}
                onChange={(e) => { setRedeemCode(e.target.value); setRedeemError(null); }}
                className={`w-full p-4 rounded-xl border outline-none font-bold text-center tracking-widest text-lg mb-2 uppercase ${
                  isDarkMode 
                    ? 'bg-black/30 border-gray-700 text-white focus:border-[#007df7]' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#007df7]'
                }`}
              />
              {redeemError && (
                <div className="text-red-500 text-xs font-bold mb-4 flex items-center justify-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3" /> {redeemError}
                </div>
              )}
              <button 
                type="submit" 
                disabled={!redeemCode.trim()}
                className="w-full py-4 mt-2 bg-[#007df7] hover:bg-[#0069d9] text-white rounded-xl font-black shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                RESGATAR
              </button>
            </form>
            <p className="text-[10px] text-gray-500 mt-4">Dica: Tente "PROMO2026" para testar.</p>
          </div>
        </ModalWrapper>
      );
    }

    if (activeModal === 'billing-history') {
      const history = [
        { date: '25/01/2026', desc: 'Serviço de streaming ZapiTV', period: '25/01/26 - 25/02/26', amount: 'R$ 55,90', card: '•••• 5427' },
        { date: '25/12/2025', desc: 'Serviço de streaming ZapiTV', period: '25/12/25 - 25/01/26', amount: 'R$ 55,90', card: '•••• 5427' },
        { date: '25/11/2025', desc: 'Serviço de streaming ZapiTV', period: '25/11/25 - 25/12/25', amount: 'R$ 55,90', card: '•••• 5427' },
        { date: '25/10/2025', desc: 'Serviço de streaming ZapiTV', period: '25/10/25 - 25/11/25', amount: 'R$ 39,90', card: '•••• 5427' }, // Preço antigo/outro plano
      ];

      return (
        <ModalWrapper title="Histórico de Pagamento" maxWidth="max-w-2xl">
          <div className="space-y-1">
            {history.map((item, idx) => (
              <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.date}</p>
                    <p className="text-[11px] text-gray-500">{item.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.amount}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{item.card}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
             <button className={`text-xs font-bold hover:underline ${isDarkMode ? 'text-[#007df7]' : 'text-blue-600'}`}>
               Carregar mais transações
             </button>
          </div>
        </ModalWrapper>
      );
    }

    return null;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* Banner de "Assinante extra" removido */}

            <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Configurações</h1>
            <p className="text-sm text-gray-500 mb-8 font-medium">Detalhes da assinatura</p>

            <div className={`border rounded-xl overflow-hidden mb-10 shadow-sm transition-all backdrop-blur-xl ${
              isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
            }`}>
              <div className="bg-[#6c5ce7] px-6 py-2">
                <span className="text-white text-[11px] font-black uppercase tracking-widest">Assinante desde {user.memberSince}</span>
              </div>
              <div className="p-6 md:p-8">
                <h3 className={`text-[20px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Plano {user.plan}</h3>
                {/* Linha "Com 1 assinante extra" removida */}
                <p className={`text-[14px] font-bold mb-6 mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Próximo pagamento: 25 de fevereiro de 2026</p>
                
                <div className="flex items-center gap-3 mb-10">
                  <MastercardIcon />
                  <span className={`text-sm font-bold tracking-[0.2em] ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>•••• •••• •••• 5427</span>
                </div>
                
                <div className={`pt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                  <button 
                    onClick={() => setActiveTab('subscription')}
                    className={`w-full flex items-center justify-between font-bold text-[14px] group ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Gerenciar assinatura
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Atalhos</h2>
            <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl transition-all ${
              isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
            }`}>
              <ListRow icon={Edit3} label="Alterar plano" onClick={() => setActiveModal('plans')} />
              <ListRow icon={CreditCard} label="Gerenciar a forma de pagamento" onClick={() => setActiveModal('payment')} />
              {/* Item "Gerenciar assinante extra" removido */}
              <ListRow icon={Monitor} label="Gerenciar acesso e aparelhos" onClick={() => setActiveTab('devices')} />
              <ListRow icon={Lock} label="Atualizar senha" onClick={() => navigateToTab('security', 'password')} />
              <ListRow icon={Users} label="Transferir um perfil" onClick={() => showToast("Funcionalidade em desenvolvimento.")} />
              <ListRow icon={PlayCircle} label="Preferências de reprodução" desc="Salto automático de aberturas e encerramentos" onClick={() => setActiveTab('playback')} />
              <ListRow icon={HelpCircle} label="Central de Ajuda" desc="Perguntas frequentes e suporte" onClick={() => onNavigate('help')} />
            </div>
          </div>
        );
      case 'playback':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Reprodução</h1>
            <p className="text-sm text-gray-500 mb-8 font-medium">Preferências do player e salto de conteúdo</p>

            <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
              isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
            }`}>
              {/* Reprodução Automática de Episódios */}
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5">
                <div className="max-w-md">
                  <h3 className={`text-[16px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Reprodução automática
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Ao terminar um episódio, avança e inicia automaticamente o próximo com contagem regressiva de 10 segundos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoPlaySetting}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ml-4 ${
                    autoPlayNext ? 'bg-[#007df7]' : 'bg-gray-600/40'
                  }`}
                  title={autoPlayNext ? 'Desativar reprodução automática' : 'Ativar reprodução automática'}
                >
                  <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${
                    autoPlayNext ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5">
                <div className="max-w-md">
                  <h3 className={`text-[16px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Pular Abertura e Encerramento Automaticamente
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Avança automaticamente aberturas, recapitulações e encerramentos identificados de animes e séries sem precisar clicar no botão.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoSkipSetting}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ml-4 ${
                    autoSkip ? 'bg-[#007df7]' : 'bg-gray-600/40'
                  }`}
                >
                  <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${
                    autoSkip ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="p-6 md:p-8 flex items-center justify-between">
                <div className="max-w-md">
                  <h3 className={`text-[16px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Botões de Salto no Player
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Exibe os botões discretos "Pular Abertura", "Pular Recapitulação" e "Pular Encerramento" no canto inferior direito quando timestamps confiáveis forem detectados.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#007df7] uppercase bg-[#007df7]/10 px-3 py-1 rounded-full shrink-0 ml-4">
                  Ativado
                </span>
              </div>

              {/* Preferências Personalizadas de Recomendação */}
              <div className="p-6 md:p-8 flex items-center justify-between border-t border-white/5">
                <div className="max-w-md">
                  <h3 className={`text-[16px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Recomendações Personalizadas
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    O motor inteligente ajusta as fileiras da Home e catálogos ao seu estilo sem enviar seus dados para servidores externos. Você pode redefinir o aprendizado a qualquer momento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearRecommendationPreferences}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shrink-0 ml-4 cursor-pointer"
                >
                  Limpar Preferências
                </button>
              </div>

              {/* Participação em Recomendações Coletivas (Filtragem Colaborativa) */}
              <div className="p-6 md:p-8 flex items-center justify-between border-t border-white/5">
                <div className="max-w-md">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-[16px] font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Recomendações Coletivas Anônimas
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Privacidade 100%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Ajude o ZapiTV a descobrir conteúdos similares compartilhando padrões implícitos totalmente anônimos (sem contas, sem cookies de rastreamento e com exclusão rigorosa de conteúdos adultos).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleCollabOptIn}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ml-4 ${
                    collabOptIn ? 'bg-[#007df7]' : 'bg-gray-600/40'
                  }`}
                  title={collabOptIn ? 'Desativar participação' : 'Ativar participação voluntária'}
                >
                  <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${
                    collabOptIn ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Sons da Interface
            </h2>
            <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
              isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
            }`}>
              <div className="p-6 md:p-8 flex items-center justify-between gap-4 border-b border-white/5">
                <div>
                  <h3 className={`text-[16px] font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Ativar sons da interface</h3>
                  <p className="text-xs text-gray-500 mt-1">Efeitos discretos na interface, com controles suaves no player.</p>
                </div>
                <button type="button" role="switch" aria-checked={soundPreferences.enabled}
                  aria-label="Ativar sons da interface"
                  onClick={() => {
                    updateSoundPreferences({ enabled: !soundPreferences.enabled });
                    if (!soundPreferences.enabled) uiSoundService.play('toggle');
                  }}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors shrink-0 ${soundPreferences.enabled ? 'bg-[#007df7]' : 'bg-gray-600/40'}`}>
                  <span className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${soundPreferences.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="p-6 md:p-8 border-b border-white/5">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <label htmlFor="ui-sound-volume" className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Volume dos efeitos
                  </label>
                  <span className="text-xs font-bold text-[#007df7]">{soundPreferences.volume}%</span>
                </div>
                <input id="ui-sound-volume" type="range" min="0" max="100" step="1"
                  value={soundPreferences.volume}
                  onChange={event => updateSoundPreferences({ volume: Number(event.target.value) })}
                  className="w-full accent-[#007df7]" />
                <button type="button" disabled={!soundPreferences.enabled} onClick={() => uiSoundService.play('detailOpen', { preview: true })}
                  className="mt-4 px-4 py-2 text-xs font-bold rounded-lg border border-[#007df7]/30 text-[#007df7] hover:bg-[#007df7]/10 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Volume2 className="w-4 h-4" /> Testar efeito sonoro
                </button>
              </div>
              <div className="p-6 md:p-8 border-b border-white/5 space-y-5">
                {([
                  ['hoverEnabled', 'Sons ao passar o mouse', 'Toques suaves em capas e botões.'],
                  ['navigationEnabled', 'Sons de navegação', 'Transições manuais de banners e carrosséis.'],
                  ['autoCarouselSounds', 'Sons nas transições automáticas', 'Desativado por padrão para evitar repetições.']
                ] as const).map(([key, label, description]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{label}</h3>
                      <p className="text-xs text-gray-500 mt-1">{description}</p>
                    </div>
                    <button type="button" role="switch" aria-checked={soundPreferences[key]}
                      aria-label={label}
                      onClick={() => updateSoundPreferences({ [key]: !soundPreferences[key] })}
                      className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors shrink-0 ${soundPreferences[key] ? 'bg-[#007df7]' : 'bg-gray-600/40'}`}>
                      <span className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${soundPreferences[key] ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-6 md:p-8 flex items-center justify-between gap-4">
                <div>
                  <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Mensagens da Watch Party</h3>
                  <p className="text-xs text-gray-500 mt-1">Notificação suave ao receber mensagens, inclusive durante a transmissão.</p>
                </div>
                <button type="button" role="switch" aria-checked={soundPreferences.watchPartyNotifications}
                  aria-label="Notificações sonoras da Watch Party"
                  onClick={() => updateSoundPreferences({ watchPartyNotifications: !soundPreferences.watchPartyNotifications })}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors shrink-0 ${soundPreferences.watchPartyNotifications ? 'bg-[#007df7]' : 'bg-gray-600/40'}`}>
                  <span className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${soundPreferences.watchPartyNotifications ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Seção de Estilo e Personalização de Legendas */}
            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Estilo e Personalização de Legendas
            </h2>
            <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
              isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
            }`}>
              {/* Preview da Legenda */}
              <div className="p-6 md:p-8 border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-[16px] font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Pré-visualização
                    </h3>
                    <p className="text-xs text-gray-500">
                      Veja como suas legendas serão exibidas nos filmes e séries.
                    </p>
                  </div>
                  <button
                    onClick={handleResetSubtitleStyle}
                    className="text-xs font-bold text-[#007df7] hover:underline"
                  >
                    Restaurar Padrão
                  </button>
                </div>

                <div className="relative rounded-2xl overflow-hidden h-40 bg-gradient-to-tr from-slate-950 via-zinc-900 to-black border border-white/10 flex items-end justify-center pb-6 px-4 shadow-inner">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                  <span
                    className="max-w-xl text-center font-bold px-4 py-1.5 rounded-lg transition-all leading-relaxed whitespace-pre-line z-10 select-none"
                    style={subtitleStyleService.computeSubtitleCSS(subtitleStyle, false)}
                  >
                    O ZapiTV oferece a melhor experiência de streaming.
                  </span>
                </div>
              </div>

              {/* Opções de Contorno */}
              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5">
                <div className="max-w-md">
                  <h3 className={`text-[15px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Contorno da Legenda
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Define a espessura da borda preta ao redor das letras para facilitar a leitura em cenas claras.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 shrink-0">
                  {[
                    { id: 'none', label: 'Nenhum' },
                    { id: 'thin', label: 'Fino' },
                    { id: 'medium', label: 'Médio' },
                    { id: 'thick', label: 'Forte' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleUpdateSubtitleStyle({ outline: opt.id as any })}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        subtitleStyle.outline === opt.id
                          ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20'
                          : isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opções de Sombra */}
              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5">
                <div className="max-w-md">
                  <h3 className={`text-[15px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Sombra da Legenda
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Aplica sombra posterior para destacar o texto sobre fundos de alto contraste.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 shrink-0">
                  {[
                    { id: 'none', label: 'Nenhuma' },
                    { id: 'soft', label: 'Suave' },
                    { id: 'strong', label: 'Forte' },
                    { id: 'drop', label: 'Projetada' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleUpdateSubtitleStyle({ shadow: opt.id as any })}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        subtitleStyle.shadow === opt.id
                          ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20'
                          : isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tamanho da Fonte */}
              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5">
                <div className="max-w-md">
                  <h3 className={`text-[15px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Tamanho do Texto
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Ajuste a escala visual das legendas na tela.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 shrink-0">
                  {[
                    { id: 'sm', label: 'Pequeno' },
                    { id: 'md', label: 'Médio' },
                    { id: 'lg', label: 'Grande' },
                    { id: 'xl', label: 'Extra' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleUpdateSubtitleStyle({ fontSize: opt.id as any })}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        subtitleStyle.fontSize === opt.id
                          ? 'bg-[#007df7] text-white shadow-md shadow-[#007df7]/20'
                          : isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor do Texto e Fundo */}
              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="max-w-md">
                  <h3 className={`text-[15px] font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Cor e Fundo
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Escolha a tonalidade do texto e a opacidade do fundo das legendas.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 shrink-0">
                  {/* Cores */}
                  <div className="flex items-center gap-2">
                    {[
                      { name: 'Branco', hex: '#FFFFFF' },
                      { name: 'Amarelo', hex: '#FACC15' },
                      { name: 'Ciano', hex: '#38BDF8' },
                      { name: 'Verde', hex: '#4ADE80' }
                    ].map(color => (
                      <button
                        key={color.hex}
                        onClick={() => handleUpdateSubtitleStyle({ color: color.hex })}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          subtitleStyle.color === color.hex ? 'scale-110 border-[#007df7]' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>

                  <div className="h-6 w-px bg-white/10 hidden sm:block" />

                  {/* Fundo */}
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'none', label: 'Nenhum' },
                      { id: 'semi', label: 'Translúcido' },
                      { id: 'solid', label: 'Sólido' }
                    ].map(bg => (
                      <button
                        key={bg.id}
                        onClick={() => handleUpdateSubtitleStyle({ bgColor: bg.id as any })}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          subtitleStyle.bgColor === bg.id
                            ? 'bg-[#007df7] text-white'
                            : isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'subscription':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
             <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Assinatura</h1>
             <p className="text-sm text-gray-500 mb-8 font-medium">Detalhes do plano</p>
             <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
               isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
             }`}>
                <div className="bg-purple-600 h-1 w-full" />
                <div className="p-8 pb-4">
                   <h3 className={`text-[19px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Plano {user.plan}</h3>
                   <p className="text-[13px] text-gray-500 mb-6 font-medium leading-relaxed">Resolução de vídeo 1080p, assistir sem anúncios e muito mais.</p>
                </div>
                <div className={`border-t ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                  <ListRow label="Alterar plano" onClick={() => setActiveModal('plans')} />
                  {/* Item "Gerenciar assinante extra" removido */}
                </div>
             </div>

             <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Detalhes de pagamento e cobrança</h2>
             <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
               isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
             }`}>
                <div className="p-8 pb-4">
                   <p className={`text-[15px] font-bold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Próximo pagamento</p>
                   <p className="text-[14px] text-gray-500 mb-6 font-medium">25 de fevereiro de 2026</p>
                   <div className="flex items-center gap-3">
                    <MastercardIcon />
                    <span className={`text-sm font-bold tracking-[0.2em] ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>•••• •••• •••• 5427</span>
                  </div>
                </div>
                <div className={`border-t ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                  <ListRow label="Gerenciar a forma de pagamento" onClick={() => setActiveModal('payment')} />
                  <ListRow label="Resgatar cartão pré-pago ou código promocional" onClick={() => setActiveModal('redeem-code')} />
                  <ListRow label="Ver histórico de pagamento" onClick={() => setActiveModal('billing-history')} />
                </div>
             </div>
             <div className="flex justify-center mt-12">
               <button 
                 onClick={() => setActiveModal('cancel')}
                 className={`px-24 py-4 border rounded-md font-bold text-sm transition-all shadow-sm ${
                   isDarkMode ? 'border-white/10 text-[#007df7] bg-white/10 hover:bg-white/20' : 'border-gray-200 text-[#007df7] bg-white/80 hover:bg-gray-50'
                 }`}
               >
                  Cancelar assinatura
               </button>
             </div>
          </div>
        );
      case 'security':
        // Reutilizamos a lógica da View antiga que tinha expande/colapsa
        // O estado securitySectionToExpand pode vir da navegação
        return (
          <SecuritySection 
            isDarkMode={isDarkMode} 
            user={user} 
            defaultExpanded={securitySectionToExpand} 
            onUpdateUser={onUpdateUser}
            onLogout={onLogout}
          />
        );
      case 'devices':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Aparelhos</h1>
            <p className="text-sm text-gray-500 mb-8 font-medium">Gerencie onde sua conta está conectada</p>
            
            <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'}`}>
               {[
                 { name: 'Smart TV Samsung', loc: 'São Paulo, BR', active: 'Agora' },
                 { name: 'iPhone 13', loc: 'São Paulo, BR', active: 'Há 2 horas' },
                 { name: 'Chrome no Windows', loc: 'Rio de Janeiro, BR', active: 'Ontem' }
               ].map((dev, i) => (
                 <div key={i} className={`p-5 border-b last:border-0 flex justify-between items-center ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                          {dev.name.includes('TV') ? <Monitor className="w-5 h-5" /> : dev.name.includes('Phone') ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                       </div>
                       <div>
                          <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{dev.name}</p>
                          <p className="text-xs text-gray-500">{dev.loc} • Último acesso: {dev.active}</p>
                       </div>
                    </div>
                    <button onClick={() => showToast(`Desconectado de ${dev.name}`)} className={`text-xs font-bold ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'}`}>Sair</button>
                 </div>
               ))}
            </div>
            
            <button 
              onClick={() => { onLogout(); showToast("Desconectado de todos os dispositivos."); }}
              className="w-full py-4 border border-[#007df7]/30 text-[#007df7] rounded-xl font-bold uppercase tracking-widest hover:bg-[#007df7] hover:text-white transition-all"
            >
              Sair de todos os aparelhos
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-full w-full relative`}>
      {toastMessage && (
        <div className="fixed top-24 right-8 z-[300] bg-[#007df7] text-white px-6 py-3 rounded-xl shadow-2xl font-bold animate-in slide-in-from-right-10 fade-in duration-300 flex items-center gap-2">
          <Check className="w-5 h-5" />
          {toastMessage}
        </div>
      )}

      {renderModal()}

      <div className="max-w-7xl mx-auto px-4 md:px-12 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12 lg:gap-20">
          
          <aside className="space-y-1">
            <button 
              onClick={() => onNavigate('home')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-[14px] font-bold transition-all rounded-lg mb-8 ${
                isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="w-4 h-4 text-[#007df7]" />
              Voltar à ZapiTV
            </button>
            <SidebarItem id="overview" label="Visão Geral" icon={Home} />
            <SidebarItem id="playback" label="Reprodução" icon={PlayCircle} />
            <SidebarItem id="subscription" label="Assinatura" icon={CreditCard} />
            <SidebarItem id="security" label="Segurança" icon={Shield} />
            <SidebarItem id="devices" label="Aparelhos" icon={Monitor} />
          </aside>

          <main className="max-w-3xl w-full pb-32">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

// Componente auxiliar extraído para a aba Segurança para manter o código limpo
// e suportar o comportamento de expansão
const SecuritySection = ({ isDarkMode, user, defaultExpanded, onUpdateUser, onLogout }: any) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(defaultExpanded || null);
  const [formData, setFormData] = useState({ email: user.email, newPassword: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (defaultExpanded) setExpandedSection(defaultExpanded);
  }, [defaultExpanded]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      onUpdateUser({ ...user, email: formData.email, password: formData.newPassword || user.password });
      setIsSaving(false);
      setExpandedSection(null);
      setFormData(prev => ({...prev, newPassword: ''}));
    }, 1000);
  };

  const handleToggle = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
        <div className={`mb-8 p-4 md:p-5 rounded-lg flex gap-4 backdrop-blur-md ${
          isDarkMode ? 'bg-[#007df7]/10 border border-[#007df7]/20' : 'bg-[#007df7]/10 border border-[#007df7]/20'
        }`}>
          <AlertCircle className="w-6 h-6 text-[#007df7] shrink-0" />
          <p className={`text-[13px] leading-relaxed ${isDarkMode ? 'text-blue-300' : 'text-[#1a4da1]'}`}>
            Recomendamos atualizar sua senha periodicamente para garantir a segurança da sua conta.
          </p>
        </div>
        <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Segurança</h1>
        <p className="text-sm text-gray-500 mb-8 font-medium">Controle de acesso</p>
        <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
          isDarkMode ? 'bg-[#151C26]/85 border-white/5' : 'bg-white/80 border-gray-200'
        }`}>
          {/* Senha */}
          <div className="group border-b border-white/5">
            <button onClick={() => handleToggle('password')} className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <Key className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Senha e E-mail</p>
                  <p className="text-xs text-gray-500">Alterar dados de acesso</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedSection === 'password' ? 'rotate-90' : ''}`} />
            </button>
            {expandedSection === 'password' && (
              <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2">
                <form onSubmit={handleSave} className="space-y-4">
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={`w-full p-3 rounded-xl border outline-none text-sm ${isDarkMode ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-200'}`} />
                  <input type="password" placeholder="Nova senha" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} className={`w-full p-3 rounded-xl border outline-none text-sm ${isDarkMode ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-200'}`} />
                  <button type="submit" disabled={isSaving} className="w-full py-3 bg-[#007df7] text-white rounded-xl font-bold text-sm">
                    {isSaving ? 'Salvando...' : 'Atualizar Dados'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5">
             <div className="flex items-center gap-4">
                <Smartphone className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Verificação em duas etapas</p>
                  <p className="text-xs text-gray-500">Adicionar camada extra de segurança</p>
                </div>
             </div>
             <span className="text-[10px] uppercase font-bold text-gray-500">Desativado</span>
          </div>

          <button onClick={onLogout} className="w-full p-6 flex items-center gap-4 hover:bg-red-500/10 transition-colors group">
             <LogOut className="w-5 h-5 text-gray-500 group-hover:text-red-500" />
             <span className={`font-bold group-hover:text-red-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Sair de todos os aparelhos</span>
          </button>
        </div>
    </div>
  );
}

export default SettingsView;
