import React, { useState } from 'react';
import { Mail, Lock, User, Check, AlertCircle, ArrowLeft, Loader2, ShieldCheck, FileText } from 'lucide-react';

interface AuthViewProps {
  isDarkMode: boolean;
  onLogin: (email: string, pass: string) => Promise<string | null>;
  onSignup: (name: string, email: string, pass: string, passConfirm: string, termsAccepted: boolean) => Promise<string | null>;
  onClose?: () => void;
  initialEmail?: string;
  initialMode?: 'login' | 'signup';
}

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

const AuthView: React.FC<AuthViewProps> = ({
  isDarkMode: _isDarkMode,
  onLogin,
  onSignup,
  onClose,
  initialEmail = '',
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Campos do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Modais de Termos e Privacidade
  const [showTermsModal, setShowTermsModal] = useState(false);

  const resetMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    resetMessages();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      const err = await onLogin(cleanEmail, password);
      if (err) {
        setError(err);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao conectar com o serviço de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    resetMessages();
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 2) {
      setError('O nome deve ter no mínimo 2 caracteres.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('A senha deve conter ao menos uma letra e um número.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('A confirmação de senha não confere.');
      return;
    }

    if (!termsAccepted) {
      setError('Você deve concordar com os Termos de Uso e Política de Privacidade.');
      return;
    }

    setLoading(true);
    try {
      const err = await onSignup(cleanName, cleanEmail, password, passwordConfirm, termsAccepted);
      if (err) {
        setError(err);
      } else {
        setSuccessMessage('Conta criada com sucesso! Conectando...');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white flex flex-col font-sans selection:bg-[#007df7] selection:text-white relative overflow-x-hidden">
      {/* Header com Logo e Voltar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 md:w-11 md:h-11">
            <BrandLogo />
          </div>
          <span className="text-xl md:text-2xl font-black tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
            ZAPI<span className="text-blue-500">TV</span>
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao catálogo
          </button>
        )}
      </header>

      {/* Container Central com Glassmorphism */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 z-10">
        <div className="w-full max-w-md bg-[#0b0e14]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-7 md:p-10 shadow-2xl relative">
          {/* Alternância de Abas: Entrar vs Cadastrar */}
          <div className="flex p-1 bg-black/40 border border-white/10 rounded-2xl mb-8">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                resetMessages();
              }}
              className={`flex-1 py-2.5 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                resetMessages();
              }}
              className={`flex-1 py-2.5 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Título e Subtítulo */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1.5">
              {mode === 'login'
                ? 'Acesse sua conta para continuar assistindo de onde parou.'
                : 'Cadastre-se para ter sua conta ZapiTV com sessões seguras.'}
            </p>
          </div>

          {/* Mensagens de Feedback */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulário de Login */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[#007df7] to-[#00baa3] hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-[#007df7]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar na conta'
                )}
              </button>
            </form>
          )}

          {/* Formulário de Cadastro */}
          {mode === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">Nome completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">Senha (mínimo 8 caracteres)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Letras e números"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">Confirmar senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repita sua senha"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Checkbox LGPD Termos de Uso */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-white/5 text-[#007df7] focus:ring-0 cursor-pointer"
                  />
                  <span>
                    Li e concordo com os{' '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-[#007df7] underline hover:text-cyan-400"
                    >
                      Termos de Uso e Política de Privacidade (LGPD)
                    </button>
                    .
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[#007df7] to-[#00baa3] hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-[#007df7]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Concluir cadastro'
                )}
              </button>
            </form>
          )}

          {/* Rodapé de Segurança e Privacidade */}
          <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sessões protegidas com criptografia Argon2id</span>
          </div>
        </div>
      </main>

      {/* Modal de Termos de Uso e Política de Privacidade */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center gap-3 text-white">
              <FileText className="w-5 h-5 text-[#007df7]" />
              <h3 className="font-bold text-lg">Termos de Uso e Privacidade (LGPD)</h3>
            </div>
            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                <strong>1. Dados Coletados:</strong> A ZapiTV coleta exclusivamente seu nome, e-mail e hash seguro da senha (criptografia irreversível via Argon2id) para autenticação e gestão de sessão.
              </p>
              <p>
                <strong>2. Finalidade:</strong> Os dados são utilizados para garantir o controle seguro da sua conta, sessões ativas e futura vinculação entre múltiplos aparelhos.
              </p>
              <p>
                <strong>3. Segurança e Sigilo:</strong> A ZapiTV nunca armazena senhas em texto puro, não comercializa seus dados com terceiros e mantém cookies HttpOnly protegidos contra CSRF e ataques XSS.
              </p>
              <p>
                <strong>4. Seus Direitos (LGPD):</strong> Você possui o direito de revogar suas sessões, solicitar exclusão de conta ou retificação de dados a qualquer momento.
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-5 py-2.5 bg-[#007df7] text-white text-xs font-bold rounded-xl hover:bg-[#0069d9] transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthView;
