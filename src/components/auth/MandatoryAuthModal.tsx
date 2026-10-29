/**
 * ZAPITV — MODAL DE AUTENTICAÇÃO OBRIGATÓRIA (MANDATORY AUTH MODAL)
 * 
 * Exibido sobre a interface para qualquer usuário não autenticado.
 * - Mantém a interface da ZapiTV visível ao fundo com backdrop blur e escurecimento.
 * - Bloqueia qualquer interação com o fundo (mouse, toque, teclado e controle remoto).
 * - Sem botão de fechar (sem X, sem Escape, sem clique fora, sem atalho de fechar).
 * - Modos:
 *     1. Welcome: "Bem-vindo à ZapiTV" com botões "Criar minha conta" e "Já tenho uma conta".
 *     2. Signup: Cadastro completo com nome, e-mail, senha, confirmação e aceite de Termos LGPD.
 *     3. Login: Autenticação com e-mail, senha e link para recuperação.
 *     4. TV QR: Modo dedicado para Smart TV com QR Code SVG, código curto legível e polling RFC 8628.
 *     5. Connection Error: Tratamento de indisponibilidade de backend com botão "Tentar novamente".
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Check, 
  AlertCircle, 
  ArrowLeft, 
  Loader2, 
  ShieldCheck, 
  FileText, 
  Tv, 
  RefreshCw, 
  Smartphone,
  WifiOff
} from 'lucide-react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { deviceAuthClient, DeviceChallengeData } from '../../core/deviceAuth/deviceAuthClient';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { ZapiBrandLogo } from '../common/ZapiBrandLogo';

export interface MandatoryAuthModalProps {
  isTvMode?: boolean;
  isDarkMode?: boolean;
  initialMode?: 'welcome' | 'signup' | 'login' | 'tv_qr';
  onLogin: (email: string, pass: string) => Promise<string | null>;
  onSignup: (name: string, email: string, pass: string, passConfirm: string, termsAccepted: boolean) => Promise<string | null>;
  onTvLinked?: (userData: any) => Promise<void> | void;
  onForgotPassword?: () => void;
  authError?: string | null;
  onRetryAuth?: () => void;
}


export const MandatoryAuthModal: React.FC<MandatoryAuthModalProps> = ({
  isTvMode = false,
  isDarkMode = true,
  initialMode,
  onLogin,
  onSignup,
  onTvLinked,
  onForgotPassword,
  authError,
  onRetryAuth,
}) => {
  // Define o modo inicial: se especificado, usa initialMode; se TV, começa prioritariamente no fluxo de QR Code
  const [mode, setMode] = useState<'welcome' | 'signup' | 'login' | 'tv_qr'>(() => {
    if (initialMode) return initialMode;
    return isTvMode ? 'tv_qr' : 'welcome';
  });
  
  // Estados de formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Estados de vinculação por Smart TV QR Code
  const [challenge, setChallenge] = useState<DeviceChallengeData | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [tvStatus, setTvStatus] = useState<'loading' | 'pending' | 'approved' | 'rejected' | 'expired' | 'error'>('loading');
  const [tvErrorMessage, setTvErrorMessage] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<number>(5000);
  const isPollingRef = useRef<boolean>(false);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // Norigin Spatial Navigation para controle remoto na TV
  const { ref: spatialContainerRef, focusKey } = useFocusable({
    focusKey: 'MANDATORY_AUTH_MODAL_ROOT',
    isFocusBoundary: true,
  });

  const { ref: welcomeSignupBtnRef, focused: welcomeSignupFocused } = useFocusable({
    focusKey: 'MANDATORY_BTN_WELCOME_SIGNUP',
    onEnterPress: () => {
      uiSoundService.play('click');
      setMode('signup');
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: welcomeLoginBtnRef, focused: welcomeLoginFocused } = useFocusable({
    focusKey: 'MANDATORY_BTN_WELCOME_LOGIN',
    onEnterPress: () => {
      uiSoundService.play('click');
      setMode('login');
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: tvSwitchToRemoteBtnRef, focused: tvSwitchToRemoteFocused } = useFocusable({
    focusKey: 'MANDATORY_BTN_TV_REMOTE_LOGIN',
    onEnterPress: () => {
      uiSoundService.play('click');
      setMode('login');
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: tvRefreshQrBtnRef, focused: tvRefreshQrFocused } = useFocusable({
    focusKey: 'MANDATORY_BTN_TV_REFRESH_QR',
    onEnterPress: () => {
      uiSoundService.play('click');
      initTvChallenge();
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  const { ref: authRetryBtnRef, focused: authRetryFocused } = useFocusable({
    focusKey: 'MANDATORY_BTN_AUTH_RETRY',
    onEnterPress: () => {
      uiSoundService.play('click');
      if (onRetryAuth) onRetryAuth();
    },
    onFocus: () => uiSoundService.play('hover'),
  });

  // Limpa timers de polling de TV
  const clearTvTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Inicializa o desafio RFC 8628 para a TV
  const initTvChallenge = useCallback(async () => {
    clearTvTimers();
    setTvStatus('loading');
    setTvErrorMessage('');
    setQrSvg('');

    try {
      const data = await deviceAuthClient.createChallenge();
      setChallenge(data);
      setSecondsRemaining(data.expiresIn || 600);
      pollIntervalRef.current = (data.interval || 5) * 1000;

      const svg = await QRCode.toString(data.verificationUrl, {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#05070a',
          light: '#ffffff',
        },
      });
      setQrSvg(svg);
      setTvStatus('pending');

      countdownTimerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearTvTimers();
            setTvStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Inicia o polling contínuo da TV
      startTvPolling(data.deviceCode);
    } catch (err: any) {
      setTvStatus('error');
      setTvErrorMessage(err?.message || 'Falha ao gerar código de pareamento na Smart TV.');
    }
  }, [clearTvTimers]);

  const startTvPolling = useCallback((deviceCode: string) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    const poll = async () => {
      if (!isPollingRef.current) return;

      abortControllerRef.current = new AbortController();

      try {
        const result = await deviceAuthClient.pollChallenge(deviceCode, abortControllerRef.current.signal);

        if (result.status === 'approved') {
          clearTvTimers();
          setTvStatus('approved');
          uiSoundService.play('success');
          if (onTvLinked) {
            await onTvLinked(result);
          }
          return;
        }

        if (result.status === 'rejected') {
          clearTvTimers();
          setTvStatus('rejected');
          uiSoundService.play('error');
          return;
        }

        if (result.status === 'expired') {
          clearTvTimers();
          setTvStatus('expired');
          return;
        }

        if (result.status === 'slow_down') {
          pollIntervalRef.current = Math.min(pollIntervalRef.current + 5000, 15000);
        }

        if (isPollingRef.current) {
          pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (isPollingRef.current) {
          pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
        }
      }
    };

    pollTimerRef.current = setTimeout(poll, pollIntervalRef.current);
  }, [clearTvTimers, onTvLinked]);

  // Se estiver em modo TV, inicia o desafio de QR Code automaticamente
  useEffect(() => {
    if (isTvMode && mode === 'tv_qr') {
      initTvChallenge();
    }
    return () => {
      clearTvTimers();
    };
  }, [isTvMode, mode, initTvChallenge, clearTvTimers]);

  // Bloqueio rigoroso de rolagem no body enquanto o modal obrigatório estiver montado
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  // Bloqueio rigoroso de atalhos de fechamento (Escape, Backspace em campos vazios)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Escape nunca fecha o modal obrigatório
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Tecla Back / Backspace na TV ou Web: se estiver em sub-telas, volta para welcome, mas nunca fecha
    if (e.key === 'Backspace' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
      if (mode === 'signup' || mode === 'login') {
        e.preventDefault();
        setMode(isTvMode ? 'tv_qr' : 'welcome');
      }
    }
  }, [mode, isTvMode]);

  // Submissão do Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setFormError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setFormError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      const err = await onLogin(cleanEmail, password);
      if (err) {
        setFormError(err);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Falha ao conectar com o serviço de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  // Submissão do Cadastro
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setFormError(null);
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      setFormError('O nome deve conter entre 2 e 100 caracteres.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Informe um endereço de e-mail válido.');
      return;
    }

    if (!password || password.length < 8) {
      setFormError('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setFormError('A senha deve conter pelo menos uma letra e um número.');
      return;
    }

    if (password !== passwordConfirm) {
      setFormError('A confirmação de senha não confere.');
      return;
    }

    if (!termsAccepted) {
      setFormError('É necessário concordar com os Termos de Uso e Política de Privacidade (LGPD).');
      return;
    }

    setLoading(true);
    try {
      const err = await onSignup(cleanName, cleanEmail, password, passwordConfirm, termsAccepted);
      if (err) {
        setFormError(err);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Falha ao processar o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <FocusContext.Provider value={focusKey}>
      <div 
        ref={(el) => {
          modalContainerRef.current = el;
          if (spatialContainerRef) {
            (spatialContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
        id="zapitv-mandatory-auth-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mandatory-auth-title"
        onKeyDown={handleKeyDown}
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-[#05070a]/80 backdrop-blur-md overflow-hidden select-none pointer-events-auto transition-all duration-300"
        style={{ touchAction: 'none' }}
      >
        {/* Glow suave e estético ao fundo */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#007df7]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[#00baa3]/15 rounded-full blur-3xl pointer-events-none" />

        {/* CONTAINER DO MODAL */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md sm:max-w-lg bg-[#0b0e14]/95 border border-white/10 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 max-h-[92vh] flex flex-col"
        >
          {/* ============================================================== */}
          {/* ESTADO DE ERRO DE CONEXÃO COM O BACKEND                       */}
          {/* ============================================================== */}
          {authError ? (
            <div className="flex flex-col items-center text-center py-4 my-auto">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 id="mandatory-auth-title" className="text-xl sm:text-2xl font-black text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
                Conexão Indisponível
              </h2>
              <p className="text-sm text-white/70 mt-2 mb-6 max-w-sm">
                {authError}
              </p>
              <button
                ref={authRetryBtnRef}
                type="button"
                onClick={() => {
                  if (onRetryAuth) onRetryAuth();
                }}
                className={`w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#007df7]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authRetryFocused ? 'ring-4 ring-cyan-400 scale-[1.02]' : ''
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar novamente</span>
              </button>
            </div>
          ) : mode === 'welcome' ? (
            /* ============================================================== */
            /* MODO 1: BOAS-VINDAS (WELCOME SCREEN)                           */
            /* ============================================================== */
            <div className="flex flex-col items-center text-center my-auto">
              <div className="mb-5 relative flex items-center justify-center drop-shadow-[0_10px_20px_rgba(0,125,247,0.3)]">
                <ZapiBrandLogo size="xl" symbolOnly glow />
              </div>

              <h1 id="mandatory-auth-title" className="text-2xl sm:text-3xl font-black text-white tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                Bem-vindo à ZapiTV
              </h1>
              <p className="text-sm sm:text-base text-white/70 mt-2 mb-8 max-w-xs sm:max-w-sm">
                Crie sua conta para continuar assistindo.
              </p>

              <div className="w-full flex flex-col gap-3">
                <button
                  ref={welcomeSignupBtnRef}
                  type="button"
                  onClick={() => {
                    uiSoundService.play('click');
                    setMode('signup');
                  }}
                  className={`w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white font-bold text-sm sm:text-base tracking-wide shadow-lg shadow-[#007df7]/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    welcomeSignupFocused ? 'ring-4 ring-white ring-offset-2 ring-offset-[#0b0e14] scale-[1.02]' : ''
                  }`}
                >
                  Criar minha conta
                </button>

                <button
                  ref={welcomeLoginBtnRef}
                  type="button"
                  onClick={() => {
                    uiSoundService.play('click');
                    setMode('login');
                  }}
                  className={`w-full py-4 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm sm:text-base tracking-wide border border-white/10 transition-all cursor-pointer ${
                    welcomeLoginFocused ? 'ring-4 ring-white ring-offset-2 ring-offset-[#0b0e14] scale-[1.02] bg-white/20' : ''
                  }`}
                >
                  Já tenho uma conta
                </button>

                {isTvMode && (
                  <button
                    type="button"
                    onClick={() => {
                      uiSoundService.play('click');
                      setMode('tv_qr');
                    }}
                    className="w-full py-3 px-6 mt-1 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-[#007df7]" />
                    <span>Conectar pelo celular via QR Code</span>
                  </button>
                )}
              </div>

              <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-white/50">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Streaming protegido e sincronizado</span>
              </div>
            </div>
          ) : mode === 'tv_qr' ? (
            /* ============================================================== */
            /* MODO 2: SMART TV COM QR CODE E CÓDIGO (RFC 8628)               */
            /* ============================================================== */
            <div className="flex flex-col items-center text-center my-auto">
              <div className="flex items-center gap-2 text-[#007df7] mb-2">
                <Tv className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#007df7]">Smart TV ZapiTV</span>
              </div>

              <h2 id="mandatory-auth-title" className="text-xl sm:text-2xl font-black text-white mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>
                Conectar sua TV
              </h2>
              <p className="text-xs sm:text-sm text-white/70 mb-5 max-w-xs">
                Aponte a câmera do seu celular para o QR Code ou acesse o endereço abaixo.
              </p>

              {tvStatus === 'loading' ? (
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 mb-4">
                  <Loader2 className="w-8 h-8 text-[#007df7] animate-spin" />
                  <span className="text-xs text-white/60 font-medium">Gerando código seguro...</span>
                </div>
              ) : tvStatus === 'pending' ? (
                <div className="flex flex-col items-center mb-4">
                  {/* QR Code SVG */}
                  <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/40 mb-3">
                    <div 
                      className="w-40 h-40 sm:w-48 sm:h-48 [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  </div>

                  {/* Código legível formatado */}
                  <div className="flex flex-col items-center mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-white/50 font-bold mb-1">
                      Código de ativação:
                    </span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-[#007df7] via-cyan-300 to-[#00baa3] tracking-widest">
                      {challenge?.userCode || '----'}
                    </span>
                  </div>

                  <p className="text-xs text-white/60 mb-2">
                    No celular, acesse: <strong className="text-white">zapitv.vercel.app/tv/ativar</strong>
                  </p>
                  <span className="text-[11px] text-white/40">
                    Expira em {timeFormatted}
                  </span>
                </div>
              ) : tvStatus === 'approved' ? (
                <div className="flex flex-col items-center py-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                    <Check className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">TV Conectada com Sucesso!</h3>
                  <p className="text-sm text-white/70">Carregando seus perfis...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {tvStatus === 'expired' ? 'Código Expirado' : 'Falha na Vinculação'}
                  </h3>
                  <p className="text-xs text-white/70 mb-4 max-w-xs">
                    {tvErrorMessage || 'O tempo limite do código esgotou. Gere um novo código para continuar.'}
                  </p>
                  <button
                    ref={tvRefreshQrBtnRef}
                    type="button"
                    onClick={() => {
                      uiSoundService.play('click');
                      initTvChallenge();
                    }}
                    className={`py-3 px-6 rounded-2xl bg-[#007df7] hover:bg-[#007df7]/80 text-white font-bold text-xs tracking-wide transition-all cursor-pointer ${
                      tvRefreshQrFocused ? 'ring-4 ring-white' : ''
                    }`}
                  >
                    Gerar novo código
                  </button>
                </div>
              )}

              {/* Ações adicionais na TV */}
              <div className="w-full flex flex-col gap-2 mt-2 pt-4 border-t border-white/10">
                <button
                  ref={tvSwitchToRemoteBtnRef}
                  type="button"
                  onClick={() => {
                    uiSoundService.play('click');
                    setMode('login');
                  }}
                  className={`py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs transition-all cursor-pointer ${
                    tvSwitchToRemoteFocused ? 'ring-2 ring-white bg-white/20 text-white' : ''
                  }`}
                >
                  Entrar pelo controle remoto
                </button>
              </div>
            </div>
          ) : mode === 'login' ? (
            /* ============================================================== */
            /* MODO 3: FORMULÁRIO DE LOGIN                                    */
            /* ============================================================== */
            <div className="flex flex-col overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setMode(isTvMode ? 'tv_qr' : 'welcome');
                  }}
                  className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors cursor-pointer py-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <div className="w-8 h-8 flex items-center justify-center">
                  <ZapiBrandLogo size="sm" symbolOnly />
                </div>
              </div>

              <h2 id="mandatory-auth-title" className="text-2xl font-black text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
                Entrar na ZapiTV
              </h2>
              <p className="text-xs sm:text-sm text-white/60 mt-1 mb-6">
                Informe suas credenciais para continuar assistindo.
              </p>

              {formError && (
                <div className="p-3.5 mb-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{formError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 ml-1">
                    <label className="text-xs font-bold text-white/70">Senha</label>
                    {onForgotPassword && (
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-xs text-[#007df7] hover:underline cursor-pointer"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha segura"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-2 bg-gradient-to-r from-[#007df7] to-[#00baa3] hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-[#007df7]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <span>Entrar na minha conta</span>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/10 text-center">
                <span className="text-xs text-white/60">
                  Não possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setMode('signup');
                    }}
                    className="text-[#007df7] font-bold hover:underline cursor-pointer"
                  >
                    Criar conta
                  </button>
                </span>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* MODO 4: FORMULÁRIO DE CADASTRO                                 */
            /* ============================================================== */
            <div className="flex flex-col overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setMode(isTvMode ? 'tv_qr' : 'welcome');
                  }}
                  className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors cursor-pointer py-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <div className="w-8 h-8 flex items-center justify-center">
                  <ZapiBrandLogo size="sm" symbolOnly />
                </div>
              </div>

              <h2 id="mandatory-auth-title" className="text-2xl font-black text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
                Criar Conta ZapiTV
              </h2>
              <p className="text-xs sm:text-sm text-white/60 mt-1 mb-5">
                Cadastre-se para ter acesso completo ao catálogo.
              </p>

              {formError && (
                <div className="p-3.5 mb-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{formError}</span>
                </div>
              )}

              <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 ml-1">Nome completo</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como deseja ser chamado"
                      autoComplete="name"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 ml-1">Senha (mínimo 8 caracteres)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Letras e números"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 ml-1">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Repita sua senha"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 text-sm outline-none focus:border-[#007df7] focus:bg-white/10 transition-all font-medium"
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
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <span>Concluir cadastro</span>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-white/10 text-center">
                <span className="text-xs text-white/60">
                  Já possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setMode('login');
                    }}
                    className="text-[#007df7] font-bold hover:underline cursor-pointer"
                  >
                    Entrar
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* MODAL DE TERMOS LGPD */}
        {showTermsModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="bg-[#0b0e14] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-white">
                <FileText className="w-5 h-5 text-[#007df7]" />
                <h3 className="font-bold text-lg">Termos de Uso e Privacidade (LGPD)</h3>
              </div>
              <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
                <p>
                  <strong>1. Dados Coletados:</strong> A ZapiTV coleta exclusivamente seu nome, e-mail e hash seguro da senha (criptografia irreversível via Argon2id) para autenticação, controle de múltiplos perfis e gestão de sessão.
                </p>
                <p>
                  <strong>2. Finalidade:</strong> Os dados são utilizados para garantir o controle seguro da sua conta, sessões ativas e sincronização de favoritos, histórico e progresso de reprodução entre múltiplos aparelhos.
                </p>
                <p>
                  <strong>3. Segurança e Sigilo:</strong> A ZapiTV nunca armazena senhas em texto puro, não comercializa seus dados com terceiros e mantém cookies HttpOnly protegidos contra CSRF e ataques XSS.
                </p>
                <p>
                  <strong>4. Direitos do Titular:</strong> Em conformidade com a LGPD (Lei nº 13.709/2018), você pode a qualquer momento revogar suas sessões ativas, desvincular dispositivos conectados ou excluir sua conta de forma transparente.
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
    </FocusContext.Provider>
  );
};
