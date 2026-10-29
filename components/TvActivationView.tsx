/**
 * ZAPITV — PÁGINA DE ATIVAÇÃO DE SMART TV NO CELULAR/WEB (P3.C)
 * 
 * Rota: /tv/ativar?code=XXXX-XXXX
 * 
 * Fluxo guiado e automático:
 * 1. Abre a página pelo link do QR Code com o código preservado.
 * 2. Se o usuário já estiver logado, avança diretamente para a confirmação.
 * 3. Se não estiver logado, permite Login ou Cadastro com preservação do código.
 * 4. Confirmação clara: "Deseja conectar esta televisão à sua conta ZapiTV?"
 * 5. Identificação do dispositivo detectado (nome da TV).
 * 6. Botões explícitos: "Autorizar televisão" e "Cancelar".
 * 7. Feedback imediato e desbloqueio automático da TV.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Tv, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  LogIn, 
  UserPlus, 
  RefreshCw, 
  Lock, 
  Mail, 
  User as UserIcon, 
  FileText,
  Loader2
} from 'lucide-react';
import { User } from '../types';
import { deviceAuthClient, ValidateCodeResponse } from '../src/core/deviceAuth/deviceAuthClient';
import { authClient } from '../src/core/auth/authClient';

interface TvActivationViewProps {
  currentUser: User | null;
  onNavigate?: (view: any) => void;
  onUserAuthenticated?: (user: User) => void;
}

export const TvActivationView: React.FC<TvActivationViewProps> = ({ 
  currentUser, 
  onNavigate,
  onUserAuthenticated 
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryCode = searchParams.get('code') || '';
  
  const formatCodeInput = (val: string) => {
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (raw.length <= 4) return raw;
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  };

  const [inputCode, setInputCode] = useState<string>(() => formatCodeInput(queryCode));
  const [validation, setValidation] = useState<ValidateCodeResponse | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approved, setApproved] = useState<boolean>(false);
  const [rejected, setRejected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modo de autenticação no celular se deslogado: 'login' ou 'signup'
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Usuário autenticado ativo
  const [localUser, setLocalUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authClient.checkSession().then(session => {
      if (cancelled) return;
      if (!session.authenticated || !session.user?.id) {
        setLocalUser(null);
        return;
      }
      const user = session.user;
      setLocalUser({ id: user.id, name: user.name, email: user.email, role: user.role || 'user',
        devMode: false, memberSince: new Date(user.createdAt).toLocaleDateString('pt-BR'),
        plan: 'ZapiTV Padrão', status: 'Ativo', profiles: [] });
    });
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    if (queryCode) {
      setInputCode(formatCodeInput(queryCode));
      setValidation(null);
      setApproved(false);
      setRejected(false);
    }
  }, [queryCode]);

  const cleanCode = inputCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCodeInput(e.target.value);
    setInputCode(formatted);
    setValidation(null);
    setErrorMessage(null);
  };

  const validateCurrentCode = useCallback(async (codeToValidate: string) => {
    const norm = codeToValidate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (norm.length < 6) return;

    setIsValidating(true);
    setErrorMessage(null);

    try {
      const res = await deviceAuthClient.validateCode(norm);
      setValidation(res);
      if (!res.valid) {
        setErrorMessage(res.error || 'Código inválido ou expirado. Verifique os caracteres exibidos na TV.');
      }
    } catch {
      setErrorMessage('Erro de comunicação ao consultar o código no servidor.');
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    if (inputCode && cleanCode.length >= 6) {
      validateCurrentCode(inputCode);
    }
  }, [inputCode, cleanCode.length, validateCurrentCode]);

  // Login inline mantendo o código
  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await authClient.login(loginEmail.trim().toLowerCase(), loginPassword);
      const user = res.user;
      const authenticatedUser: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'user',
        devMode: false,
        memberSince: new Date(user.createdAt).toLocaleDateString('pt-BR'),
        plan: 'ZapiTV Padrão',
        status: 'Ativo',
        profiles: []
      };
      setLocalUser(authenticatedUser);
      if (onUserAuthenticated) onUserAuthenticated(authenticatedUser);
    } catch (err: any) {
      setAuthError(err?.message || 'E-mail ou senha incorretos.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Cadastro inline mantendo o código
  const handleInlineSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setAuthError('Você precisa concordar com os Termos de Uso e LGPD.');
      return;
    }
    if (signupPassword !== signupPasswordConfirm) {
      setAuthError('As senhas não conferem.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await authClient.register({
        name: signupName.trim(),
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        passwordConfirm: signupPasswordConfirm,
        termsAccepted: true
      });
      const user = res.user;
      const newUser: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'user',
        devMode: false,
        memberSince: new Date(user.createdAt).toLocaleDateString('pt-BR'),
        plan: 'ZapiTV Padrão',
        status: 'Ativo',
        profiles: []
      };
      setLocalUser(newUser);
      if (onUserAuthenticated) onUserAuthenticated(newUser);
    } catch (err: any) {
      setAuthError(err?.message || 'Falha ao concluir o cadastro.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Aprovação explícita da TV
  const handleApprove = async () => {
    if (!localUser || !cleanCode) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await deviceAuthClient.approveDeviceLink(cleanCode);
      if (res.success) {
        setApproved(true);
      } else {
        setErrorMessage(res.error || 'Não foi possível autorizar este dispositivo.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de comunicação ao autorizar a TV.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recusa / Cancelamento
  const handleReject = async () => {
    if (!cleanCode) {
      if (onNavigate) onNavigate('home');
      else navigate('/');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await deviceAuthClient.rejectDeviceLink(cleanCode);
      setRejected(true);
    } catch {
      setRejected(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deviceLabel = validation?.challenge?.deviceName || 'Smart TV';

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-lg bg-[#0b0e14] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-white">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#007df7]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#00baa3]/20 rounded-full blur-3xl pointer-events-none" />

        {/* ================================================================== */}
        {/* ESTADO 1: TV AUTORIZADA COM SUCESSO                                */}
        {/* ================================================================== */}
        {approved ? (
          <div className="flex flex-col items-center text-center py-6 animate-in fade-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 ring-8 ring-emerald-500/10">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              TV Conectada com Sucesso!
            </h2>
            <p className="text-sm text-white/70 mb-2 max-w-sm leading-relaxed">
              A sua televisão foi autorizada. Ela receberá acesso imediato e abrirá a lista de perfis para assistir.
            </p>
            <p className="text-xs text-cyan-300 font-semibold mb-8">
              Você já pode voltar para a televisão.
            </p>
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate('home');
                else navigate('/');
              }}
              className="w-full py-4 px-6 rounded-2xl bg-[#007df7] hover:bg-[#007df7]/85 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#007df7]/25 cursor-pointer"
            >
              Continuar no celular
            </button>
          </div>
        ) : rejected ? (
          /* ================================================================ */
          /* ESTADO 2: VINCULAÇÃO CANCELADA / RECUSADA                        */
          /* ================================================================ */
          <div className="flex flex-col items-center text-center py-6 animate-in fade-in duration-300">
            <div className="w-18 h-18 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
              <XCircle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              Conexão Cancelada
            </h2>
            <p className="text-sm text-white/70 mb-6 max-w-xs leading-relaxed">
              A solicitação foi recusada. A televisão não terá acesso à sua conta ZapiTV.
            </p>
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate('home');
                else navigate('/');
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        ) : !localUser ? (
          /* ================================================================ */
          /* ESTADO 3: USUÁRIO NÃO AUTENTICADO NO CELULAR (LOGIN OU SIGNUP)   */
          /* ================================================================ */
          <div className="flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#007df7]/20 to-[#00baa3]/20 border border-[#007df7]/30 flex items-center justify-center mb-3 text-[#007df7]">
                <Tv className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
                Conectar à Smart TV
              </h1>
              <p className="text-xs text-white/60 mt-1">
                Código detectado: <strong className="text-cyan-300 font-mono text-sm tracking-wider">{inputCode || '----'}</strong>
              </p>
            </div>

            {/* Alternador Login / Cadastro */}
            <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Já tenho uma conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError(null);
                }}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Criar minha conta
              </button>
            </div>

            {authError && (
              <div className="p-3 mb-5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'login' ? (
              /* FORMULÁRIO DE LOGIN */
              <form onSubmit={handleInlineLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 ml-1">Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 mt-2 bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white font-bold text-sm rounded-xl shadow-lg shadow-[#007df7]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Entrar e Continuar</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* FORMULÁRIO DE CADASTRO */
              <form onSubmit={handleInlineSignup} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1 ml-1">Nome completo</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1 ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-white/70 mb-1 ml-1">Senha</label>
                    <input
                      type="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-[#007df7]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/70 mb-1 ml-1">Confirmar</label>
                    <input
                      type="password"
                      required
                      value={signupPasswordConfirm}
                      onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-[#007df7]"
                    />
                  </div>
                </div>

                {/* Termos de Uso LGPD */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 text-xs text-white/70 cursor-pointer select-none">
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
                        className="text-[#007df7] underline hover:text-cyan-400 cursor-pointer"
                      >
                        Termos e LGPD
                      </button>
                      .
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 mt-2 bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white font-bold text-sm rounded-xl shadow-lg shadow-[#007df7]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Criar Conta e Conectar TV</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ================================================================ */
          /* ESTADO 4: USUÁRIO AUTENTICADO -> CONFIRMAÇÃO CLARA DA TV         */
          /* ================================================================ */
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#007df7]/20 to-[#00baa3]/20 border border-[#007df7]/40 flex items-center justify-center mb-4 text-[#00baa3] shadow-lg shadow-[#00baa3]/10">
                <Tv className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
                Deseja conectar esta televisão à sua conta ZapiTV?
              </h2>
              <p className="text-xs text-white/60 mt-1 max-w-sm">
                Aparelho identificado aguardando autorização de acesso aos seus perfis.
              </p>
            </div>

            {/* Cartão de Identificação do Dispositivo */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                <span className="text-white/50">Dispositivo detectado:</span>
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" />
                  <span>{deviceLabel}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                <span className="text-white/50">Código de pareamento:</span>
                <span className="font-mono font-black text-white tracking-widest text-sm">
                  {inputCode || '---- ----'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Conectado como:</span>
                <div className="text-right">
                  <strong className="block text-white font-bold">{localUser.name}</strong>
                  <span className="text-[11px] text-white/50">{localUser.email}</span>
                </div>
              </div>
            </div>

            {/* Campo de Código (editável se necessário) */}
            {!queryCode && (
              <div>
                <label className="block text-xs font-bold text-white/60 mb-1">Código de Ativação</label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={handleInputChange}
                    placeholder="XXXX-XXXX"
                    maxLength={9}
                    className="w-full bg-white/5 border border-white/15 focus:border-[#007df7] rounded-xl py-3 px-4 text-center text-xl font-mono font-black text-white tracking-widest uppercase outline-none"
                  />
                  {isValidating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#007df7]" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* BOTÕES EXPLÍCITOS DE AÇÃO */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting || (validation !== null && !validation.valid)}
                onClick={handleApprove}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#00baa3] to-[#007df7] text-white font-black text-base shadow-xl shadow-[#00baa3]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Autorizando televisão...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Autorizar televisão</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReject}
                className="w-full py-3 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-semibold text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE TERMOS LGPD */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0b0e14] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl text-white">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#007df7]" />
              <h3 className="font-bold text-lg">Termos de Uso e Privacidade (LGPD)</h3>
            </div>
            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                <strong>1. Dados Coletados:</strong> A ZapiTV coleta exclusivamente seu nome, e-mail e hash seguro da senha para autenticação, controle de múltiplos perfis e gestão de sessão.
              </p>
              <p>
                <strong>2. Finalidade:</strong> Os dados são utilizados para garantir o controle seguro da sua conta e sincronização de favoritos, histórico e progresso entre aparelhos.
              </p>
              <p>
                <strong>3. Segurança e Sigilo:</strong> A ZapiTV nunca armazena senhas em texto puro e mantém cookies HttpOnly protegidos contra CSRF e ataques XSS.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="w-full py-3 bg-[#007df7] hover:bg-[#007df7]/80 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Entendi e concordo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TvActivationView;
