import React, { useState } from 'react';
import { ArrowLeft, Check, Loader2, Lock, Mail } from 'lucide-react';
import { authClient } from '../src/core/auth/authClient';

export default function PasswordRecoveryView({ reset, onBack }: { reset: boolean; onBack: (resetCompleted: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const result = reset ? await authClient.completePasswordRecovery(token, password, confirmation)
        : await authClient.requestPasswordRecovery(email.trim());
      setMessage(result.message);
      if (reset) {
        setPassword(''); setConfirmation('');
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível concluir.'); }
    finally { setLoading(false); }
  }

  const inputClass = 'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm outline-none focus:border-[#007df7] transition-all';
  return <main className="min-h-screen bg-[#05070a] text-white font-sans flex flex-col items-center justify-center p-6">
    <section className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#0d121d] p-6 md:p-8 shadow-2xl">
      <button type="button" onClick={() => onBack(false)} className="mb-6 text-sm text-white/60 hover:text-white flex items-center gap-2"><ArrowLeft size={16} /> Voltar para entrar</button>
      <p className="text-[#007df7] font-black tracking-widest mb-3">ZAPITV</p>
      <h1 className="text-2xl font-bold mb-3">{reset ? 'Criar nova senha' : 'Recuperar senha'}</h1>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      {message ? <div role="status" className="space-y-5"><p className="text-emerald-300 flex gap-2 text-sm"><Check size={20} />{message}</p><button onClick={() => onBack(reset)} className="w-full py-3 bg-[#007df7] rounded-xl font-bold">Voltar para entrar</button></div>
        : reset && !token ? <p role="alert" className="text-sm text-slate-300">Abra o link recebido por e-mail. Se ele expirou, solicite uma nova recuperação.</p>
          : <form onSubmit={submit} className="space-y-4">
            {!reset ? <label className="block text-sm text-slate-300"><span className="flex gap-2 mb-2"><Mail size={16} /> E-mail da conta</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className={inputClass} /></label>
              : <><label className="block text-sm text-slate-300"><span className="flex gap-2 mb-2"><Lock size={16} /> Nova senha</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} className={inputClass} /></label>
                <label className="block text-sm text-slate-300"><span className="block mb-2">Confirmar nova senha</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className={inputClass} /></label></>}
            <button disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-[#007df7] to-[#00baa3] rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">{loading && <Loader2 size={18} className="animate-spin" />}{reset ? 'Salvar nova senha' : 'Enviar instruções'}</button>
          </form>}
    </section>
  </main>;
}
