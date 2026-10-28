/**
 * ZAPITV — PÁGINA DE ATIVAÇÃO DE SMART TV NO CELULAR/WEB (P3.C)
 * 
 * Rota: /tv/ativar?code=XXXX-XXXX
 * 
 * Permite que o usuário autorize explicitamente a Smart TV pelo celular:
 * - Identifica o dispositivo (nome e tipo detectados pelo servidor).
 * - Exige login na conta ZapiTV.
 * - Confirmação explícita (sem aprovação silenciosa por simples abertura de link).
 * - Feedback imediato de autorização ou recusa.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Tv, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, ArrowRight, LogIn, RefreshCw } from 'lucide-react';
import { User } from '../types';
import { deviceAuthClient, ValidateCodeResponse } from '../src/core/deviceAuth/deviceAuthClient';

interface TvActivationViewProps {
  currentUser: User | null;
  onNavigate?: (view: any) => void;
}

export const TvActivationView: React.FC<TvActivationViewProps> = ({ currentUser, onNavigate }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryCode = searchParams.get('code') || '';
  const [inputCode, setInputCode] = useState<string>(queryCode);
  const [validation, setValidation] = useState<ValidateCodeResponse | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approved, setApproved] = useState<boolean>(false);
  const [rejected, setRejected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanCode = inputCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const formatCodeInput = (val: string) => {
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (raw.length <= 4) return raw;
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  };

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
        setErrorMessage(res.error || 'Código inválido ou expirado. Verifique os caracteres na TV.');
      }
    } catch (err: any) {
      setErrorMessage('Erro ao consultar o código no servidor.');
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    if (queryCode && queryCode.trim().length >= 6) {
      const formatted = formatCodeInput(queryCode);
      setInputCode(formatted);
      validateCurrentCode(formatted);
    }
  }, [queryCode, validateCurrentCode]);

  const handleApprove = async () => {
    if (!currentUser) return;
    if (!cleanCode) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await deviceAuthClient.approveDeviceLink(cleanCode);
      if (res.success) {
        setApproved(true);
        setStatusMessage(res.message || 'Smart TV autorizada com sucesso!');
      } else {
        setErrorMessage(res.error || 'Não foi possível autorizar este dispositivo.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de comunicação ao autorizar a TV.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!cleanCode) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await deviceAuthClient.rejectDeviceLink(cleanCode);
      setRejected(true);
      setStatusMessage('Solicitação de vinculação recusada.');
    } catch (err: any) {
      setErrorMessage('Erro ao registrar recusa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md bg-[#0b0e14] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#007df7]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#00baa3]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header com ícone */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#007df7]/20 to-[#00baa3]/20 border border-[#007df7]/30 flex items-center justify-center mb-4 text-[#007df7]">
            <Tv className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
            Vincular Smart TV
          </h1>
          <p className="text-xs text-white/60 mt-1">
            Autorize o acesso da sua televisão sem digitar senha no controle.
          </p>
        </div>

        {/* ESTADO 1: TV Autorizada com Sucesso */}
        {approved ? (
          <div className="flex flex-col items-center text-center py-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              TV Autorizada com Sucesso!
            </h2>
            <p className="text-sm text-white/70 mb-6">
              A sua televisão foi conectada à conta. Você já pode voltar para a TV e escolher seu perfil para assistir.
            </p>
            <button
              onClick={() => {
                if (onNavigate) onNavigate('home');
                else navigate('/');
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#007df7] hover:bg-[#007df7]/80 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#007df7]/20 cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        ) : rejected ? (
          /* ESTADO 2: Solicitação Recusada */
          <div className="flex flex-col items-center text-center py-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              Vinculação Recusada
            </h2>
            <p className="text-sm text-white/70 mb-6">
              A solicitação foi recusada. A televisão não terá acesso à sua conta.
            </p>
            <button
              onClick={() => {
                if (onNavigate) onNavigate('home');
                else navigate('/');
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all cursor-pointer"
            >
              Concluir
            </button>
          </div>
        ) : !currentUser ? (
          /* ESTADO 3: Usuário Desconectado (Exige Login) */
          <div className="flex flex-col items-center text-center py-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3 text-left">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300">
                <strong className="block font-bold mb-1">Login necessário</strong>
                Para autorizar esta televisão, você precisa primeiro entrar na sua conta ZapiTV.
              </div>
            </div>

            <p className="text-sm text-white/70 mb-6">
              Entre com seu e-mail e senha cadastrados para vincular o dispositivo.
            </p>

            <button
              onClick={() => {
                const target = `/login?redirect=${encodeURIComponent(`/tv/ativar?code=${inputCode}`)}`;
                if (onNavigate) onNavigate('login');
                else navigate(target);
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#007df7] to-[#00baa3] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#007df7]/20 hover:opacity-90 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar na minha conta</span>
            </button>
          </div>
        ) : (
          /* ESTADO 4: Usuário Logado com Código para Confirmar */
          <div className="flex flex-col gap-5">
            {/* Conta conectada */}
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-[#007df7]/20 text-[#007df7] flex items-center justify-center font-bold">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <span className="block text-xs text-white/50">Conectado como</span>
                <span className="block text-sm font-bold text-white truncate">{currentUser.name}</span>
                <span className="block text-xs text-white/60 truncate">{currentUser.email}</span>
              </div>
            </div>

            {/* Campo de Código */}
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
                Código de Ativação
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputCode}
                  onChange={handleInputChange}
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  className="w-full bg-white/5 border-2 border-white/20 focus:border-[#007df7] rounded-2xl py-3.5 px-4 text-center text-2xl font-mono font-black text-white tracking-widest uppercase outline-none transition-all placeholder:text-white/20"
                />
                {isValidating && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#007df7]" />
                  </div>
                )}
              </div>
            </div>

            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Identificação do Dispositivo Detectado */}
            {validation && validation.valid && validation.challenge && (
              <div className="bg-[#00baa3]/10 border border-[#00baa3]/30 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[#00baa3] font-bold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Dispositivo Identificado</span>
                </div>
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>Aparelho:</span>
                  <strong className="text-white font-bold">{validation.challenge.deviceName}</strong>
                </div>
                <p className="text-[11px] text-white/60 mt-1">
                  Ao confirmar, esta Smart TV receberá uma sessão própria para acessar seus perfis.
                </p>
              </div>
            )}

            {/* Botões de Ação Explícita */}
            <div className="flex flex-col gap-2.5 mt-2">
              <button
                disabled={isSubmitting || !validation?.valid}
                onClick={handleApprove}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  validation?.valid
                    ? 'bg-[#00baa3] hover:bg-[#00baa3]/80 text-black shadow-lg shadow-[#00baa3]/20'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Autorizando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Autorizar TV</span>
                  </>
                )}
              </button>

              <button
                disabled={isSubmitting || !validation?.valid}
                onClick={handleReject}
                className="w-full py-3 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium text-xs transition-all cursor-pointer"
              >
                Recusar esta solicitação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TvActivationView;
