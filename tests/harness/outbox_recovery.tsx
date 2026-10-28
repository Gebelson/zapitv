import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { syncQueue } from '../../src/core/sync/syncQueue';
import { SyncRecoveryNotice } from '../../src/components/sync/SyncRecoveryNotice';
import '../../index.css';

const key = syncQueue.getStorageKey('profile_A', 'account_A');
if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([{ id: 'original-expired-uuid', type: 'favorites', action: 'set',
  data: { canonicalId: 'private-title-A' }, timestamp: Date.now() - 8 * 86400000, syncState: 'conflict',
  syncError: 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP' }]));
syncQueue.setAccountScope('account_A', 'profile_A');
function Harness() {
  const [account, setAccount] = useState('account_A');
  const profile = account === 'account_A' ? 'profile_A' : 'profile_B';
  Object.assign(window, { changeRecoveryAccount: (value: string) => {
    syncQueue.setAccountScope(value, value === 'account_A' ? 'profile_A' : 'profile_B'); setAccount(value);
  } });
  return <SyncRecoveryNotice key={account} accountId={account} profileId={profile} />;
}
createRoot(document.getElementById('root')!).render(<Harness />);
