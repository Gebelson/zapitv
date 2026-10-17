
import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, MessageCircle, Mail, Phone, ArrowLeft, CreditCard, Lock, Tv, Wifi, Home, FileText, HelpCircle, AlertCircle, Plus } from 'lucide-react';
import { AppView } from '../types';

interface HelpViewProps {
  isDarkMode: boolean;
  onNavigate: (view: AppView) => void;
}

type HelpTab = 'overview' | 'account' | 'technical' | 'content';

const FAQ_DATA = {
  account: [
    { q: 'Como alterar minha forma de pagamento?', a: 'Acesse "Configurações" > "Assinatura" e clique em "Gerenciar forma de pagamento". Você poderá adicionar um novo cartão ou alterar para débito em conta.' },
    { q: 'Como cancelar minha assinatura?', a: 'Você pode cancelar a qualquer momento em "Configurações" > "Assinatura" > "Cancelar assinatura". O acesso continua disponível até o fim do ciclo de cobrança.' },
    { q: 'Cobrança indevida, o que fazer?', a: 'Se você identificou uma cobrança duplicada ou incorreta, entre em contato imediatamente pelo chat ao vivo ou envie um e-mail para financeiro@zapitv.com.' },
    { q: 'Onde vejo meu histórico de cobrança?', a: 'Seu histórico completo de faturas está disponível na página de Conta sob a seção "Detalhes de cobrança".' }
  ],
  technical: [
    { q: 'O vídeo está travando ou carregando', a: 'Verifique sua conexão com a internet. Recomendamos pelo menos 5Mbps para HD e 25Mbps para 4K. Tente reiniciar seu roteador.' },
    { q: 'Tela preta com som', a: 'Isso geralmente é um problema de DRM ou cabo HDMI. Tente desconectar e reconectar o cabo HDMI ou atualizar os drivers da sua placa de vídeo.' },
    { q: 'Como limpar o cache do app?', a: 'Nas configurações do seu dispositivo, vá em Aplicativos > ZapiTV > Armazenamento e selecione "Limpar Cache".' }
  ],
  content: [
    { q: 'Como ativar as legendas?', a: 'Durante a reprodução, clique no ícone de "Balão de Fala" no canto inferior direito do player e selecione o idioma desejado.' },
    { q: 'Como sugerir um filme ou série?', a: 'Adoramos sugestões! Envie o nome do título pelo nosso chat ou e-mail. Nossa equipe de curadoria analisa todos os pedidos.' },
    { q: 'O que é o Perfil Kids?', a: 'O Perfil Kids oferece uma interface simplificada e exibe apenas conteúdos classificados como livres ou para crianças até 12 anos.' }
  ]
};

interface FAQRowProps {
  item: { q: string; a: string };
  index: number;
  categoryPrefix: string;
  isDarkMode: boolean;
  expandedIndex: string | null;
  toggleAccordion: (index: string) => void;
}

const FAQRow: React.FC<FAQRowProps> = ({ item, index, categoryPrefix, isDarkMode, expandedIndex, toggleAccordion }) => {
  const uniqueId = `${categoryPrefix}-${index}`;
  const isOpen = expandedIndex === uniqueId;

  return (
    <div className={`border-b last:border-0 transition-colors ${
      isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
    }`}>
      <button 
        onClick={() => toggleAccordion(uniqueId)}
        className="w-full flex items-center justify-between p-4 md:px-6 md:py-5 cursor-pointer text-left"
      >
        <div className="flex items-center gap-5 pr-4">
          <HelpCircle className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} ${isOpen ? 'text-[#007df7]' : ''}`} />
          <div>
            <p className={`text-[15px] font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{item.q}</p>
          </div>
        </div>
        <Plus className={`w-5 h-5 text-gray-300 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-45 text-[#007df7]' : ''}`} />
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 pb-6 pl-[3.25rem] text-sm leading-relaxed opacity-80">
          {item.a}
        </div>
      </div>
    </div>
  );
};

const HelpView: React.FC<HelpViewProps> = ({ isDarkMode, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  const toggleAccordion = (index: string) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Helper para filtrar todas as questões na busca
  const getAllQuestions = () => {
    return [
      ...FAQ_DATA.account.map(i => ({ ...i, cat: 'Conta' })), 
      ...FAQ_DATA.technical.map(i => ({ ...i, cat: 'Técnico' })), 
      ...FAQ_DATA.content.map(i => ({ ...i, cat: 'Conteúdo' }))
    ];
  };

  const filteredQuestions = searchQuery.trim() 
    ? getAllQuestions().filter(q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) || q.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const SidebarItem = ({ id, label, icon: Icon }: { id: HelpTab, label: string, icon: any }) => (
    <button
      onClick={() => { setActiveTab(id); setSearchQuery(''); setExpandedIndex(null); }}
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

  const ContactCard = ({ icon: Icon, title, desc, action, colorClass }: any) => (
    <button className={`flex flex-col items-start p-6 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 text-left w-full h-full ${
      isDarkMode ? 'bg-[#151C26]/60 border-white/5 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className={`font-black text-sm mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      <p className="text-xs text-gray-500 mb-4 font-medium flex-1">{desc}</p>
      <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{action}</span>
    </button>
  );

  const renderContent = () => {
    // Se tiver busca, mostra resultados independente da tab
    if (searchQuery.trim()) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
          <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Busca</h1>
          <p className="text-sm text-gray-500 mb-8 font-medium">Resultados para "{searchQuery}"</p>
          
          <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
            isDarkMode ? 'bg-[#151C26]/60 border-white/5' : 'bg-white/80 border-gray-200'
          }`}>
            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((item, idx) => (
                <FAQRow 
                  key={idx} 
                  item={item} 
                  index={idx} 
                  categoryPrefix="search"
                  isDarkMode={isDarkMode}
                  expandedIndex={expandedIndex}
                  toggleAccordion={toggleAccordion}
                />
              ))
            ) : (
              <div className="p-12 text-center opacity-50">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum resultado encontrado.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Central de Ajuda</h1>
            <p className="text-sm text-gray-500 mb-8 font-medium">Como podemos ajudar você hoje?</p>

            {/* Search Input Hero Style */}
            <div className="relative mb-10 group">
              <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isDarkMode ? 'text-gray-500 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-900'}`} />
              <input 
                type="text" 
                placeholder="Busque por dúvidas, erros ou configurações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-14 pr-6 py-5 rounded-2xl outline-none font-bold text-sm transition-all shadow-lg ${
                  isDarkMode 
                    ? 'bg-[#151C26] border border-gray-800 text-white focus:border-[#007df7] placeholder:text-gray-600' 
                    : 'bg-white border border-gray-200 text-gray-900 focus:border-[#007df7] placeholder:text-gray-400'
                }`}
              />
            </div>

            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Canais de Atendimento</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              <ContactCard 
                icon={MessageCircle} 
                title="Chat Ao Vivo" 
                desc="Converse com um de nossos especialistas em tempo real." 
                action="Iniciar Chat"
                colorClass="bg-blue-500/10 text-blue-500"
              />
              <ContactCard 
                icon={Mail} 
                title="E-mail" 
                desc="Envie sua dúvida e responderemos em até 24 horas." 
                action="Enviar E-mail"
                colorClass="bg-green-500/10 text-green-500"
              />
              <ContactCard 
                icon={Phone} 
                title="Telefone" 
                desc="Ligue para nossa central de atendimento gratuita." 
                action="0800 123 4567"
                colorClass="bg-[#007df7]/10 text-[#007df7]"
              />
            </div>

            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Perguntas Recentes</h2>
            <div className={`border rounded-xl overflow-hidden shadow-sm backdrop-blur-xl ${
              isDarkMode ? 'bg-[#151C26]/60 border-white/5' : 'bg-white/80 border-gray-200'
            }`}>
              <FAQRow item={FAQ_DATA.account[0]} index={0} categoryPrefix="overview" isDarkMode={isDarkMode} expandedIndex={expandedIndex} toggleAccordion={toggleAccordion} />
              <FAQRow item={FAQ_DATA.technical[0]} index={1} categoryPrefix="overview" isDarkMode={isDarkMode} expandedIndex={expandedIndex} toggleAccordion={toggleAccordion} />
              <FAQRow item={FAQ_DATA.content[0]} index={2} categoryPrefix="overview" isDarkMode={isDarkMode} expandedIndex={expandedIndex} toggleAccordion={toggleAccordion} />
            </div>
          </div>
        );
      case 'account':
      case 'technical':
      case 'content':
        const data = activeTab === 'account' ? FAQ_DATA.account : activeTab === 'technical' ? FAQ_DATA.technical : FAQ_DATA.content;
        const title = activeTab === 'account' ? 'Conta e Pagamento' : activeTab === 'technical' ? 'Suporte Técnico' : 'Conteúdo e Recursos';
        const sub = activeTab === 'account' ? 'Gerencie sua assinatura e faturamento' : activeTab === 'technical' ? 'Resolução de problemas e erros' : 'Dúvidas sobre o catálogo e player';

        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
             <h1 className={`text-[32px] font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h1>
             <p className="text-sm text-gray-500 mb-8 font-medium">{sub}</p>

             <div className={`border rounded-xl overflow-hidden shadow-sm mb-10 backdrop-blur-xl ${
               isDarkMode ? 'bg-[#151C26]/60 border-white/5' : 'bg-white/80 border-gray-200'
             }`}>
                {data.map((item, idx) => (
                  <FAQRow 
                    key={idx} 
                    item={item} 
                    index={idx} 
                    categoryPrefix={activeTab}
                    isDarkMode={isDarkMode}
                    expandedIndex={expandedIndex}
                    toggleAccordion={toggleAccordion}
                  />
                ))}
             </div>

             <div className={`p-6 rounded-2xl border flex items-start gap-4 ${
               isDarkMode ? 'bg-blue-900/10 border-blue-800/30' : 'bg-blue-50 border-blue-100'
             }`}>
                <AlertCircle className={`w-6 h-6 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <div>
                  <h4 className={`font-bold text-sm mb-1 ${isDarkMode ? 'text-blue-200' : 'text-blue-800'}`}>Não encontrou o que procurava?</h4>
                  <p className={`text-xs leading-relaxed mb-3 ${isDarkMode ? 'text-blue-300/70' : 'text-blue-700/70'}`}>
                    Nossa equipe de suporte está disponível todos os dias para ajudar você com problemas mais complexos que não estão listados aqui.
                  </p>
                  <button className={`text-xs font-black uppercase tracking-widest hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                    Entrar em contato
                  </button>
                </div>
             </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className={`min-h-full w-full relative`}>
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
            <SidebarItem id="account" label="Conta e Pagamento" icon={CreditCard} />
            <SidebarItem id="technical" label="Suporte Técnico" icon={Wifi} />
            <SidebarItem id="content" label="Conteúdo" icon={Tv} />
          </aside>

          <main className="max-w-3xl w-full pb-32">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default HelpView;
