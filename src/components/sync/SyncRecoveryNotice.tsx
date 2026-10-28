import React, { useEffect, useRef, useState } from 'react';
import { syncQueue } from '../../core/sync/syncQueue';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { tvModeService } from '../../core/tv/tvModeService';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

function RecoveryButton({ focusKey, children, onClick, disabled = false }: {
  focusKey: string; children: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  const { ref, focused } = useTvFocusable({ focusKey, onEnterPress: onClick, focusable: !disabled, autoScroll: false });
  return <button ref={ref} type="button" disabled={disabled} onClick={onClick}
    className={`rounded-lg border border-current px-3 py-2 disabled:opacity-50 ${focused ? 'outline outline-2 outline-cyan-400' : ''}`}>{children}</button>;
}

type Comparison = NonNullable<Awaited<ReturnType<typeof syncQueue.reviewConflicts>>>;
export function SyncRecoveryNotice({ accountId, profileId }: { accountId: string; profileId: string }) {
  const [, refresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const issues = syncQueue.getRecoveryItems(profileId, accountId);
  const count = issues.length;
  const persistenceFailed = syncQueue.hasPersistenceFailure(profileId, accountId);
  useEffect(() => {
    alive.current = true;
    const unsubscribe = syncQueue.subscribe(() => refresh(n => n + 1));
    return () => { alive.current = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!open || !count || !tvModeService.isTvMode()) return;
    const previous = getCurrentFocusKey();
    const cleanup = tvNavigationManager.registerBackHandler('sync-recovery', 120, () => { setOpen(false); return true; });
    setFocus('sync-recovery-preserve');
    return () => {
      cleanup();
      const visible = Array.from(document.querySelectorAll<HTMLElement>('[data-focus-key]'))
        .filter(element => element.getClientRects().length > 0).map(element => element.dataset.focusKey!)
        .filter(key => doesFocusableExist(key));
      const target = visible.includes(previous) ? previous : visible.includes('sync-recovery-review')
        ? 'sync-recovery-review' : visible.find(key => !key.startsWith('sync-recovery-'));
      if (target) setFocus(target);
    };
  }, [open, count]);

  if (!count || syncQueue.getAccountScope() !== accountId) return null;
  const review = async () => {
    setOpen(true); setBusy(true); setError(''); setComparison(null);
    const result = await syncQueue.reviewConflicts(profileId, accountId);
    if (!alive.current) return;
    if (result) setComparison(result);
    else setError('Não foi possível comparar com a conta agora. Nada foi reenviado.');
    setBusy(false);
  };
  const retry = async () => {
    setBusy(true);
    await syncQueue.retryPending(profileId, accountId);
    if (alive.current) setBusy(false);
  };
  const summary = (value: any) => value == null ? 'Sem registro remoto.' : [
    value.title || value.canonicalId || value.id,
    value.season ? `Temporada ${value.season}, episódio ${value.episode}` : '',
    typeof value.positionSec === 'number' ? `Posição: ${value.positionSec}s` : '',
    typeof value.isRemoved === 'number' ? (value.isRemoved ? 'Removido' : 'Presente') : ''
  ].filter(Boolean).join(' · ');
  const labels = { progress: 'Progresso', history: 'Histórico', my_list: 'Minha Lista', favorites: 'Favoritos' };
  return <aside aria-label="Recuperação de sincronização" className="fixed bottom-4 left-4 right-4 z-[250] mx-auto max-w-xl rounded-xl border border-cyan-500/40 bg-slate-950 p-4 text-white shadow-xl">
    <p role="status">{count} alteração(ões) local(is) não foram sincronizadas. {persistenceFailed
      ? 'Não foi possível gravar no dispositivo. Mantenha esta aba aberta para preservar os dados em memória.'
      : 'Os dados foram mantidos neste dispositivo.'}</p>
    {!open ? <RecoveryButton focusKey="sync-recovery-review" onClick={() => { void review(); }}>Revisar alterações</RecoveryButton> :
      <section role="dialog" aria-label="Alterações preservadas" aria-modal="false" className="mt-3 max-h-[65vh] overflow-y-auto">
        <h2 className="text-lg font-bold">Alterações preservadas</h2>
        <p>Esta comparação não modifica a conta. Para alterar o remoto, revise o estado e faça uma nova ação explícita na interface.</p>
        {busy && <p role="status">Carregando comparação…</p>}
        {error && <p role="alert">{error}</p>}
        {comparison?.map(({ operation, remote }) => <article key={operation.id} className="my-3 break-words border-t border-white/20 pt-2 text-sm">
          <p>{labels[operation.type]} · {operation.action === 'remove' ? 'Remover' : 'Salvar'} · {operation.syncState === 'conflict' ? 'Recusada — não será reenviada automaticamente' : 'Aguardando confirmação'}</p>
          <p>Local ({new Date(operation.timestamp).toLocaleString()}): {summary(operation.data)}</p>
          <p>Conta: {summary(remote)}</p>
        </article>)}
        <div className="mt-3 flex flex-wrap gap-3">
          <RecoveryButton focusKey="sync-recovery-preserve" onClick={() => setOpen(false)}>Manter no dispositivo</RecoveryButton>
          {issues.some(item => item.syncState !== 'conflict') && <RecoveryButton focusKey="sync-recovery-retry" disabled={busy} onClick={() => { void retry(); }}>Tentar apenas pendentes</RecoveryButton>}
        </div>
      </section>}
  </aside>;
}
