const BASE = 'http://127.0.0.1:19573';
const TOKEN_KEY = 'zapitv-helper-token';

export interface HelperJob {
  id: string;
  itemId: string;
  type?: string;
  title: string;
  season?: number;
  episode?: number;
  quality: string;
  format: 'mp4' | 'webm';
  status: string;
  bytes: number;
  total: number;
  error?: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    ...(location.protocol === 'https:' ? { targetAddressSpace: 'local' } : {}),
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    signal: init.signal || AbortSignal.timeout(5000),
    cache: 'no-store'
  } as RequestInit);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Helper HTTP ${response.status}`);
  return data as T;
}

export const helperClient = {
  hasStoredToken(): boolean { return Boolean(localStorage.getItem(TOKEN_KEY)); },
  async probe(): Promise<boolean> {
    try { await request('/health'); return true; } catch { return false; }
  },
  async connected(): Promise<boolean> {
    if (!localStorage.getItem(TOKEN_KEY)) return false;
    try { await request('/library'); return true; } catch { return false; }
  },
  async pair(code: string): Promise<void> {
    const data = await request<{ token: string }>('/pair', { method: 'POST', body: JSON.stringify({ code }) });
    localStorage.setItem(TOKEN_KEY, data.token);
  },
  async disconnect(): Promise<void> {
    try { await request('/disconnect', { method: 'POST' }); } finally { localStorage.removeItem(TOKEN_KEY); }
  },
  async start(input: { itemId: string; title: string; type: string; season?: number; episode?: number; quality: string; format: 'mp4' | 'webm'; url: string; offlineAllowed: true }): Promise<HelperJob> {
    const data = await request<{ job: HelperJob }>('/jobs', { method: 'POST', body: JSON.stringify(input) });
    return data.job;
  },
  async jobs(): Promise<HelperJob[]> { return (await request<{ jobs: HelperJob[] }>('/jobs')).jobs; },
  async library(): Promise<HelperJob[]> { return (await request<{ items: HelperJob[] }>('/library')).items; },
  async action(id: string, action: 'pause' | 'resume'): Promise<void> { await request(`/jobs/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ action }) }); },
  async cancel(id: string): Promise<void> { await request(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async mediaUrl(id: string): Promise<string> { return (await request<{ url: string }>(`/media/${encodeURIComponent(id)}/ticket`, { method: 'POST' })).url; }
};
