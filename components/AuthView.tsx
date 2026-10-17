
import React, { useState, useEffect } from 'react';
import { Mail, Lock, Check, ChevronRight, ShieldCheck, Tv, Monitor, Smartphone, Tablet, Plus, X, ArrowLeft, CreditCard, Calendar, Play, Globe } from 'lucide-react';
import { User } from '../types';

interface AuthViewProps {
  isDarkMode: boolean;
  onLogin: (email: string, pass: string) => Promise<string | null>;
  onSignup: (name: string, email: string, pass: string, plan: string) => Promise<void>;
  onResetPassword?: (email: string) => Promise<void>;
  users: User[];
  initialEmail?: string;
}

type SignupStep = 'landing' | 'registration' | 'plan-selection' | 'payment-picker' | 'card-entry';

const FAQ_ITEMS = [
  { q: "O que é a ZapiTV?", a: "A ZapiTV é um serviço de streaming que oferece uma ampla variedade de filmes, séries, animes e documentários premiados em milhares de aparelhos conectados à internet." },
  { q: "Quanto custa a ZapiTV?", a: "Assista à ZapiTV no seu celular, tablet, Smart TV, notebook ou aparelho de streaming por uma taxa mensal fixa. Planos a partir de R$ 25,90 por mês. Sem custos adicionais nem contratos." },
  { q: "Onde posso assistir?", a: "Assista onde quiser, a qualquer hora. Faça login com sua conta ZapiTV em zapitv.com para assistir no computador ou em qualquer aparelho conectado à internet que ofereça o aplicativo ZapiTV." },
  { q: "Como faço para cancelar?", a: "A ZapiTV é flexível. Não há contratos nem compromissos. Você pode cancelar a sua conta online com apenas dois cliques. Não há taxa de cancelamento." }
];

const BACKGROUND_IMAGE_URL = "https://i.pinimg.com/1200x/19/8b/2f/198b2f01e73b905772279616eccc7c65.jpg";

// Componentes extraídos para fora para evitar re-montagem e perda de foco
const BrandLogo = () => (
  <svg viewBox="0 0 374.87 315.93" className="w-full h-full">
    <defs>
      <linearGradient id="Gradiente_Auth_Brand" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#b273d8">
          <animate attributeName="stopColor" values="#b273d8;#00baa3;#007df7;#b273d8" dur="4s" repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor="#00baa3">
          <animate attributeName="stopColor" values="#00baa3;#007df7;#b273d8;#00baa3" dur="4s" repeatCount="indefinite" />
        </stop>
      </linearGradient>
    </defs>
    <path 
      fill="url(#Gradiente_Auth_Brand)" 
      d="M217.84,315.93c-20.71-.34-41.38-.68-62-1.01-25.86.33-51.86.66-78,1l-58.67-.27c-8.71-.05-16.27-6.38-17.35-14.45-.89-6.67.79-11.65,4.8-16.59l42.96-52.9,34.5-41.58,46.93-57.01c4.73-5.74,8.53-12.04,14.93-16.09,4.47-2.83,11.02-1.13,15.32,1.5l29.66,18.14c5.5,3.37,12.16,1.15,15.73-4l16.82-24.22,47.74-74.06c.21-.33.37-.67.48-1.02,1.14-3.55-2.09-6.98-5.78-6.4-2.82.44-5.47,1.54-8.49,2.82l-128.58,54.14L9.09,134.06c-2.46,1.03-5.17.89-6.68-.21C1.28,133.02,0,130.3,0,128.19L.2,21.58C.23,9.78,8.11,0,20.12,0l335.27.02c5.38,0,11.72,3.13,14.46,6.66,6.08,7.82,3.13,17.81-2.26,24.85-5.81,7.6-11.51,14.36-17.53,21.64l-24.48,29.57-56.42,68.45-33.94,42.01c-5,6.19-12.76,9.24-19.74,5.04l-28.69-17.27c-3.83-2.31-10.24-5.82-14.33-3.45-5.92,3.43-8.84,10.15-12.43,15.62l-33.7,51.33-27.21,42.72c-.76,1.19-.35,3.03.15,3.78,1.9,2.87,9.6-.54,12.85-1.93l116.86-49.98,138.78-59.06c1.63-.7,3.99-.15,4.9.39s2.21,2,2.21,3.81l-.4,109.09c-.04,12.22-8.55,22.45-20.82,22.46l-135.81.19Z"
    />
  </svg>
);

const AuthLayoutWrapper = ({ children, maxWidth = "max-w-md" }: { children?: React.ReactNode, maxWidth?: string }) => (
  <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
    {/* Background Cinematográfico Comum */}
    <div className="absolute inset-0 z-0">
      <img 
        src={BACKGROUND_IMAGE_URL} 
        className="w-full h-full object-cover scale-105 brightness-[0.3]"
        alt="Background"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/40 z-10" />
    </div>

    {/* Conteúdo Glassmorphism */}
    <div className={`relative z-20 w-full ${maxWidth} animate-in zoom-in-95 fade-in duration-500`}>
      {children}
    </div>
  </div>
);

// Novo Separador em Arco com Brilho (Estilo Premium)
const ArcSeparator = () => (
  <div className="relative w-full h-16 md:h-24 -mt-16 md:-mt-24 z-20 pointer-events-none overflow-hidden">
    {/* O container precisa ficar acima da imagem do hero, mas o conteúdo deve ser 'cortado' visualmente */}
    {/* Arco Preto com Borda Brilhante */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] md:w-[120%] h-[100%] bg-black rounded-t-[50%] md:rounded-t-[100%] border-t-[3px] border-transparent shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
         style={{
           borderImageSource: 'linear-gradient(to right, #6a11cb 0%, #007df7 50%, #6a11cb 100%)',
           borderImageSlice: 1,
           borderTopWidth: '4px',
           boxShadow: '0 -4px 45px rgba(0, 125, 247, 0.4)'
         }}
    >
      {/* Brilho interno extra para dar volume */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#007df7]/20 to-transparent rounded-t-[50%] md:rounded-t-[100%]" />
    </div>
  </div>
);

// Divisor Simples para Seções Internas
const SectionDivider = () => (
  <div className="w-full h-2 bg-[#1a1a1a] relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800 to-transparent opacity-50" />
  </div>
);

// EmailForm moved outside to prevent re-mounting on input change
interface EmailFormProps {
  email: string;
  setEmail: (val: string) => void;
  onStartFlow: () => void;
}

const EmailForm: React.FC<EmailFormProps> = ({ email, setEmail, onStartFlow }) => (
  <form onSubmit={(e) => { e.preventDefault(); onStartFlow(); }} className="flex flex-col md:flex-row items-stretch justify-center gap-2 max-w-3xl mx-auto w-full">
    <div className="relative flex-1 group">
      <input 
        type="text" 
        placeholder=" "
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="peer w-full p-4 pt-6 rounded bg-black/60 backdrop-blur-sm border border-gray-500 text-white outline-none focus:ring-2 focus:ring-white focus:bg-black/80 transition-all text-lg"
        required
      />
      <label className="absolute left-4 top-4 text-gray-400 text-sm transition-all peer-placeholder-shown:text-lg peer-placeholder-shown:top-4 peer-focus:top-1 peer-focus:text-xs peer-focus:font-bold peer-focus:text-gray-300 peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-bold cursor-text pointer-events-none">
        Endereço de e-mail ou usuário
      </label>
    </div>
    <button 
      type="submit"
      className="w-full md:w-auto px-8 py-4 bg-[#007df7] hover:bg-[#0069d9] text-white font-black text-2xl rounded flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(0,125,247,0.4)] whitespace-nowrap"
    >
      Vamos lá <ChevronRight className="w-8 h-8" />
    </button>
  </form>
);

const AuthView: React.FC<AuthViewProps> = ({ isDarkMode, onLogin, onSignup, onResetPassword, users, initialEmail }) => {
  // Lógica de Redirecionamento Automático: Se já visitou antes, vai direto pro login
  const [step, setStep] = useState<SignupStep>('landing');
  const [isLoggingIn, setIsLoggingIn] = useState(() => {
    return initialEmail !== undefined && initialEmail !== '';
  });
  
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Form states com preenchimento inteligente do último email
  const [email, setEmail] = useState(() => initialEmail || '');
  const [password, setPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Premium 4K');

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setIsLoggingIn(true);
    }
  }, [initialEmail]);

  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetEmailSent(false);
    const loginError = await onLogin(email.trim(), password);
    if (loginError) setError(loginError);
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetPassword = async () => {
    console.log("AuthView: Reset password requested for:", email);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Por favor, insira seu e-mail para redefinir a senha.');
      return;
    }
    if (onResetPassword) {
      setIsResetting(true);
      setError(null);
      setResetEmailSent(false);
      try {
        console.log("AuthView: Calling onResetPassword prop for:", trimmedEmail);
        await onResetPassword(trimmedEmail);
        console.log("AuthView: onResetPassword prop succeeded");
        setResetEmailSent(true);
      } catch (err: any) {
        console.error("AuthView: onResetPassword prop failed:", err);
        setError(err.message || 'Erro ao enviar e-mail de redefinição.');
      } finally {
        setIsResetting(false);
      }
    } else {
      console.warn("AuthView: onResetPassword prop is missing!");
    }
  };

  const handleStartFlow = () => {
    if (!email.trim()) return;
    setIsLoggingIn(true);
    setError(null);
  };

  const handleFinalizeSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSignup(email.split('@')[0], email, password, selectedPlan);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta.');
    }
  };

  const renderLanding = () => (
    <div className="bg-black text-white overflow-x-hidden font-sans">
      {/* Hero Section */}
      <div className="relative min-h-[750px] md:h-[100vh] flex flex-col pb-24">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={BACKGROUND_IMAGE_URL} 
            className="w-full h-full object-cover scale-105"
            alt="Background"
          />
          {/* Gradientes para garantir legibilidade e o efeito escuro */}
          <div className="absolute inset-0 bg-black/40 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80 z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 z-10" />
        </div>

        {/* Content */}
        <div className="relative z-30 flex-1 flex flex-col items-center justify-center text-center px-6 pt-20">
          <div className="max-w-5xl animate-in fade-in zoom-in duration-1000 space-y-8">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-[1.1] drop-shadow-2xl" style={{ fontFamily: "'Sora', sans-serif" }}>
              Filmes, séries e muito mais, <span className="bg-gradient-to-r from-[#007df7] to-[#0069d9] bg-clip-text text-transparent">ilimitados</span>.
            </h1>
            <p className="text-xl md:text-2xl font-medium drop-shadow-lg max-w-3xl mx-auto">
              Assista onde quiser. Cancele quando quiser.
            </p>
            <p className="text-lg md:text-xl font-normal opacity-90">
              Pronto para assistir? Informe seu e-mail para criar ou reiniciar sua assinatura.
            </p>
            <div className="pt-4">
               <EmailForm email={email} setEmail={setEmail} onStartFlow={handleStartFlow} />
            </div>
          </div>
        </div>
      </div>

      {/* ARCO SEPARADOR DE IDENTIDADE VISUAL */}
      <ArcSeparator />

      {/* Feature Section 1: TV */}
      <div className="bg-black py-20 px-6 md:px-20 relative z-30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center md:text-left space-y-6">
            <h2 className="text-4xl md:text-5xl font-black">Aproveite na TV.</h2>
            <p className="text-xl md:text-2xl leading-relaxed opacity-90">
              Assista em Smart TVs, PlayStation, Xbox, Chromecast, Apple TV, aparelhos de Blu-ray e outros dispositivos.
            </p>
          </div>
          <div className="flex-1 relative">
            <div className="relative z-10 w-full aspect-video bg-zinc-900 rounded-xl border-4 border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center group">
                <img src="https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Tv className="w-24 h-24 text-white drop-shadow-lg" />
                </div>
            </div>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* Feature Section 2: Mobile Streaming */}
      <div className="bg-black py-20 px-6 md:px-20">
        <div className="max-w-6xl mx-auto flex flex-col-reverse md:flex-row items-center justify-between gap-12">
          <div className="flex-1 relative">
            <div className="relative w-full max-w-sm mx-auto aspect-[9/16] bg-zinc-900 rounded-[2rem] border-8 border-zinc-800 shadow-2xl overflow-hidden group">
                <img src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                
                {/* Now Playing Card */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] bg-black border-2 border-zinc-700 rounded-xl p-3 flex items-center gap-4 shadow-xl z-20">
                    <div className="w-12 h-16 bg-zinc-800 rounded overflow-hidden shrink-0">
                         <img src="https://picsum.photos/seed/stranger/100/150" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-white truncate">Stranger Things</div>
                        <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Reproduzindo
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-[#007df7] text-white flex items-center justify-center shrink-0 shadow-lg">
                      <Play className="w-4 h-4 fill-white" />
                    </div>
                </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-6">
            <h2 className="text-4xl md:text-5xl font-black">Streaming instantâneo em qualquer lugar.</h2>
            <p className="text-xl md:text-2xl leading-relaxed opacity-90">
              Assista no celular, tablet, computador ou TV sem consumir o espaço do seu aparelho.
            </p>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* Feature Section 3: Everywhere */}
      <div className="bg-black py-20 px-6 md:px-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center md:text-left space-y-6">
            <h2 className="text-4xl md:text-5xl font-black">Assista quando quiser.</h2>
            <p className="text-xl md:text-2xl leading-relaxed opacity-90">
              Assista no celular, tablet, Smart TV ou notebook sem pagar a mais por isso.
            </p>
          </div>
          <div className="flex-1 relative">
             <div className="grid grid-cols-2 gap-4">
                <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 transform translate-y-8 shadow-2xl">
                     <img src="https://images.unsplash.com/photo-1593784653059-d0a3319452b9?q=80&w=400&auto=format&fit=crop" className="w-full h-full object-cover" />
                </div>
                <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl z-10">
                     <img src="https://images.unsplash.com/photo-1522869635100-394d953f6306?q=80&w=400&auto=format&fit=crop" className="w-full h-full object-cover" />
                </div>
             </div>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* Feature Section 4: Kids */}
      <div className="bg-black py-20 px-6 md:px-20">
        <div className="max-w-6xl mx-auto flex flex-col-reverse md:flex-row items-center justify-between gap-12">
          <div className="flex-1">
             <div className="w-full aspect-square max-w-md mx-auto rounded-full overflow-hidden border-4 border-zinc-800 shadow-[0_0_50px_rgba(0,125,247,0.15)] group">
                <img src="https://img.freepik.com/premium-photo/3d-happy-cartoon-boy-listening-music-with-headphones_1029469-234241.jpg?w=800" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
             </div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-6">
            <h2 className="text-4xl md:text-5xl font-black">Crie perfis para crianças.</h2>
            <p className="text-xl md:text-2xl leading-relaxed opacity-90">
              Deixe as crianças se aventurarem com seus personagens favoritos em um espaço feito só para elas, sem pagar a mais por isso.
            </p>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* FAQ Section */}
      <div className="bg-black py-24 px-4 md:px-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-14">Perguntas frequentes</h2>
          <div className="space-y-2 mb-12">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} className="bg-[#132144] hover:bg-[#223362] transition-colors duration-300">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-6 md:p-8 flex justify-between items-center text-left focus:outline-none"
                >
                  <span className="text-xl md:text-2xl font-bold">{item.q}</span>
                  {openFaq === idx ? <X className="w-6 h-6 md:w-8 md:h-8" /> : <Plus className="w-6 h-6 md:w-8 md:h-8" />}
                </button>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openFaq === idx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="p-6 md:p-8 border-t border-black text-lg md:text-xl leading-relaxed">
                    {item.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center pt-8">
            <p className="text-lg md:text-xl mb-6">Pronto para assistir? Informe seu e-mail para criar ou reiniciar sua assinatura.</p>
            <EmailForm email={email} setEmail={setEmail} onStartFlow={handleStartFlow} />
          </div>
        </div>
      </div>

      {/* Footer Minimalista */}
      <div className="bg-black py-8 border-t border-zinc-900 text-center">
         <p className="text-zinc-600 text-sm">ZapiTV © 2026</p>
      </div>
    </div>
  );

  const renderRegistration = () => (
    <AuthLayoutWrapper>
      <div className="bg-black/75 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[32px] shadow-2xl">
        <div className="mb-8">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#007df7]">Passo 1 de 3</span>
          <h2 className="text-3xl font-black mt-3 leading-tight text-white" style={{ fontFamily: "'Sora', sans-serif" }}>Crie uma senha para iniciar</h2>
          <p className="text-gray-400 mt-3 text-sm">Faltam apenas alguns passos! Nós também odiamos papelada.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setStep('plan-selection'); }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">Email</label>
            <input 
              required 
              type="text" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="seu@email.com ou usuário" 
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">Senha</label>
            <input 
              required 
              type="password" 
              placeholder="Qualquer senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium" 
            />
          </div>
          <button type="submit" className="w-full py-5 bg-[#007df7] text-white font-black text-lg rounded-xl hover:bg-[#0069d9] hover:scale-[1.02] active:scale-95 transition-all mt-4 shadow-xl shadow-[#007df7]/20">
            PRÓXIMO
          </button>
        </form>
      </div>
    </AuthLayoutWrapper>
  );

  const renderPlanSelection = () => (
    <AuthLayoutWrapper maxWidth="max-w-6xl">
      <div className="flex flex-col items-center">
        <div className="mb-12 text-center">
          <div className="w-14 h-14 bg-[#007df7]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#007df7] border border-[#007df7]/30">
            <Check className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#007df7]">Passo 2 de 3</span>
          <h2 className="text-4xl md:text-5xl font-black mt-3 text-white" style={{ fontFamily: "'Sora', sans-serif" }}>Escolha seu plano</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
          {[
            { name: 'Básico', price: '25,90', res: '720p', devices: '1' },
            { name: 'Padrão', price: '39,90', res: '1080p', devices: '2' },
            { name: 'Premium 4K', price: '55,90', res: '4K + HDR', devices: '4' }
          ].map((p) => {
            const isSelected = selectedPlan === p.name;
            return (
              <div 
                key={p.name}
                onClick={() => setSelectedPlan(p.name)}
                className={`relative cursor-pointer p-8 rounded-[32px] border-2 transition-all backdrop-blur-xl flex flex-col ${
                  isSelected 
                    ? 'border-[#007df7] bg-[#007df7]/10 scale-105 z-10 shadow-2xl shadow-[#007df7]/10' 
                    : 'border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/20'
                }`}
              >
                {isSelected && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-[#007df7] text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg">
                    Recomendado
                  </div>
                )}
                <h3 className={`text-xl font-black mb-2 ${isSelected ? 'text-white' : 'text-gray-300'}`}>{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-sm font-bold text-gray-500">R$</span>
                  <span className={`text-4xl font-black ${isSelected ? 'text-[#007df7]' : 'text-white'}`}>{p.price}</span>
                  <span className="text-xs text-gray-500 font-bold">/mês</span>
                </div>
                
                <div className="space-y-4 mt-auto">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${isSelected ? 'bg-[#007df7] text-white' : 'bg-white/10 text-gray-400'}`}><Tv className="w-3 h-3" /></div>
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{p.res}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${isSelected ? 'bg-[#007df7] text-white' : 'bg-white/10 text-gray-400'}`}><Monitor className="w-3 h-3" /></div>
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{p.devices} Telas simultâneas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${isSelected ? 'bg-[#007df7] text-white' : 'bg-white/10 text-gray-400'}`}><Smartphone className="w-3 h-3" /></div>
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>Perfis e áudio HD</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setStep('payment-picker')} className="px-20 py-5 bg-[#007df7] text-white font-black text-xl rounded-2xl hover:bg-[#0069d9] transition-all shadow-xl shadow-[#007df7]/30 hover:scale-105">
          CONTINUAR
        </button>
      </div>
    </AuthLayoutWrapper>
  );

  const renderPaymentPicker = () => (
    <AuthLayoutWrapper>
      <div className="bg-black/75 backdrop-blur-xl border border-white/10 p-10 rounded-[32px] shadow-2xl text-center">
        <div className="w-16 h-16 bg-[#007df7]/20 rounded-full flex items-center justify-center mx-auto mb-6 text-[#007df7] border border-[#007df7]/30">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#007df7]">Passo 3 de 3</span>
        <h2 className="text-3xl font-black mt-3 mb-4 text-white" style={{ fontFamily: "'Sora', sans-serif" }}>Defina o pagamento</h2>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-xs mx-auto">Sua assinatura começa assim que você configurar o pagamento. Cancele quando quiser.</p>
        
        <div className="space-y-3">
          <button 
            onClick={() => setStep('card-entry')} 
            className="w-full p-5 bg-white/5 border border-white/10 hover:border-[#007df7] hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-4">
              <span className="font-bold text-white">Cartão de Crédito</span>
              <div className="flex gap-1.5 opacity-80">
                 <div className="w-8 h-5 bg-[#1a1f71] rounded flex items-center justify-center"><div className="w-4 h-4 bg-white/20 rounded-full blur-[1px]"/></div>
                 <div className="w-8 h-5 bg-[#eb001b] rounded flex items-center justify-center"><div className="w-4 h-4 bg-white/20 rounded-full blur-[1px]"/></div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#007df7]" />
          </button>
        </div>
      </div>
    </AuthLayoutWrapper>
  );

  const renderCardEntry = () => (
    <AuthLayoutWrapper>
      <div className="bg-black/75 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[32px] shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
           <button onClick={() => setStep('payment-picker')} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"><ArrowLeft className="w-6 h-6" /></button>
           <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Sora', sans-serif" }}>Dados do Cartão</h2>
        </div>

        <form onSubmit={handleFinalizeSignup} className="space-y-4">
          <div className="space-y-1">
             <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Titular</label>
             <input required type="text" placeholder="Nome como no cartão" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium" />
          </div>
          
          <div className="space-y-1">
             <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Número</label>
             <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input required type="text" placeholder="0000 0000 0000 0000" className="w-full pl-12 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium" />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Validade</label>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input required type="text" placeholder="MM/AA" className="w-full pl-12 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium" />
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">CVV</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input required type="text" placeholder="123" className="w-full pl-12 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium" />
                </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-[#007df7]/20 to-transparent border border-[#007df7]/20 flex justify-between items-center mt-6">
            <div>
              <p className="text-[10px] font-black text-[#007df7] uppercase tracking-widest">Plano Selecionado</p>
              <p className="font-black text-white text-lg">{selectedPlan}</p>
            </div>
            <button type="button" onClick={() => setStep('plan-selection')} className="text-white text-xs font-bold hover:underline bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors">Alterar</button>
          </div>
          
          <p className="text-[10px] text-gray-500 leading-relaxed py-4 text-center">
            Ao clicar no botão "Iniciar Assinatura", você concorda com nossos Termos de Uso. Sua assinatura será renovada automaticamente.
          </p>
          
          <button type="submit" className="w-full py-5 bg-[#007df7] text-white font-black text-xl rounded-2xl hover:bg-[#0069d9] transition-colors shadow-2xl shadow-[#007df7]/30">
            INICIAR ASSINATURA
          </button>
        </form>
      </div>
    </AuthLayoutWrapper>
  );

  const renderLogin = () => (
    <AuthLayoutWrapper>
      <div className="bg-black/75 text-white backdrop-blur-md border border-white/10 p-10 md:p-16 rounded-[32px] shadow-2xl">
        <h2 className="text-3xl font-black mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>Entrar</h2>
        <p className="text-sm text-zinc-400 mb-8 font-medium">Acesso livre: entre com qualquer e-mail e qualquer senha.</p>
        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <input required type="text" placeholder="E-mail ou Usuário" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 rounded-xl bg-zinc-800/50 border border-white/5 text-white outline-none focus:bg-zinc-700 focus:border-white/20 transition-all text-lg" />
          <div className="space-y-2">
            <input required type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 rounded-xl bg-zinc-800/50 border border-white/5 text-white outline-none focus:bg-zinc-700 focus:border-white/20 transition-all text-lg" />
            {onResetPassword && (
              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={handleResetPassword} 
                  disabled={isResetting}
                  className={`text-zinc-400 hover:text-white text-sm transition-colors ${isResetting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isResetting ? 'Enviando...' : 'Esqueceu a senha?'}
                </button>
              </div>
            )}
          </div>
          {error && <div className="p-3 bg-[#007df7]/20 border border-[#007df7]/30 rounded text-[#007df7] text-xs font-bold animate-shake">{error}</div>}
          {resetEmailSent && <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 text-xs font-bold">E-mail de redefinição de senha enviado! Verifique sua caixa de entrada.</div>}
          <button type="submit" className="w-full py-4 bg-[#007df7] hover:bg-[#0069d9] text-white font-black rounded-xl transition-colors mt-8 text-lg shadow-lg">ENTRAR</button>
        </form>
        <div className="mt-10 flex flex-col gap-2 text-center md:text-left">
          <p className="text-zinc-500 text-sm">Novo por aqui? <button onClick={() => { setIsLoggingIn(false); setStep('landing'); }} className="text-white font-bold hover:underline">Assine agora.</button></p>
          <p className="text-[11px] text-zinc-600 mt-4 leading-relaxed">
            Esta página é protegida pelo Google reCAPTCHA para garantir que você não é um robô. <span className="text-blue-600 hover:underline cursor-pointer">Saiba mais.</span>
          </p>
        </div>
      </div>
    </AuthLayoutWrapper>
  );

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-[#007df7] selection:text-white overflow-x-hidden">
      {/* Header Fixo */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] px-6 md:px-14 py-6 flex items-center justify-between transition-all duration-500 ${
        (step === 'landing' || isLoggingIn) ? 'bg-gradient-to-b from-black/80 to-transparent' : 'bg-transparent'
      }`}>
        {/* Logo Estática */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 md:w-14 md:h-12"><BrandLogo /></div>
          <h1 className="text-2xl md:text-3xl font-black text-white transition-colors" style={{ fontFamily: "'Sora', sans-serif" }}>
            ZAPI<span className="text-blue-500">TV</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {!isLoggingIn && step === 'landing' && (
            <button onClick={() => setIsLoggingIn(true)} className="px-5 py-2 bg-[#007df7] text-white rounded font-bold text-sm hover:bg-[#0069d9] transition-all hover:scale-105 shadow-xl text-white">Entrar</button>
          )}
          {(isLoggingIn || step !== 'landing') && (
            <button onClick={() => { setIsLoggingIn(false); setStep('landing'); }} className="font-black text-sm hover:underline transition-colors text-white">Sair</button>
          )}
        </div>
      </nav>

      <main>
        {isLoggingIn ? renderLogin() : (
          <>
            {step === 'landing' && renderLanding()}
            {step === 'registration' && renderRegistration()}
            {step === 'plan-selection' && renderPlanSelection()}
            {step === 'payment-picker' && renderPaymentPicker()}
            {step === 'card-entry' && renderCardEntry()}
          </>
        )}
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; animation-iteration-count: 2; }
      `}</style>
    </div>
  );
};

export default AuthView;
