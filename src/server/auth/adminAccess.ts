// Administrative grants use server-configured account IDs, never client roles or emails.
export function accountRole(id: string | undefined): 'admin' | 'user' {
  const allowed = (process.env.ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
  return id && allowed.includes(id) ? 'admin' : 'user';
}
