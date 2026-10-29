import type { User } from '../../../types';

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: number;
  role: 'admin' | 'user';
}

export type ListedAdminUser = User & { readOnlyAccount?: true };

export function mergeAdminAccounts(legacy: User[], accounts: AdminAccount[]): ListedAdminUser[] {
  const result: ListedAdminUser[] = [...legacy];
  const ids = new Set(legacy.map(user => user.id));
  const emails = new Set(legacy.map(user => user.email.trim().toLowerCase()));
  for (const account of accounts) {
    const email = account.email.trim().toLowerCase();
    if (ids.has(account.id) || emails.has(email)) continue;
    result.push({ id: account.id, name: account.name, email: account.email, role: account.role,
      devMode: false, memberSince: new Date(account.createdAt).toLocaleDateString('pt-BR'), profiles: [],
      plan: 'Não informado', status: account.status === 'active' ? 'Ativo' : account.status === 'suspended' ? 'Inativo' : 'Pendente',
      readOnlyAccount: true });
    ids.add(account.id); emails.add(email);
  }
  return result;
}

export async function fetchAdminAccounts(signal: AbortSignal): Promise<AdminAccount[]> {
  const result: AdminAccount[] = [];
  let cursor = '';
  do {
    const response = await fetch(`/api/auth/admin/users${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
      credentials: 'include', cache: 'no-store', signal,
    });
    if (!response.ok) throw new Error('Não foi possível carregar as contas atuais.');
    const page = await response.json();
    if (!Array.isArray(page.users)) throw new Error('Resposta de contas inválida.');
    result.push(...page.users);
    if (!page.nextCursor) break;
    if (typeof page.nextCursor !== 'string' || page.nextCursor <= cursor) throw new Error('Paginação de contas inválida.');
    cursor = page.nextCursor;
  } while (!signal.aborted);
  return result;
}
