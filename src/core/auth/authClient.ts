/**
 * ZAPITV — CLIENTE DE AUTENTICAÇÃO REAL (P3.A)
 * 
 * Comunicação direta com a API (/api/auth) utilizando cookies de sessão seguros HttpOnly.
 * Todas as requisições incluem credentials: 'include'.
 */

import type { ProfileItem } from '../profile/profileClient';
import { syncQueue } from '../sync/syncQueue';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: number;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  termsAccepted: boolean;
}

class AuthClient {
  /**
   * Consulta a sessão ativa no servidor (/api/auth/me)
   */
  async checkSession(): Promise<{ authenticated: boolean; user: AuthUser | null; activeProfile: ProfileItem | null }> {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Zapi-Client': 'web',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        return { authenticated: false, user: null, activeProfile: null };
      }

      const data = await res.json();
      if (data.authenticated && data.user?.id) {
        syncQueue.setAccountScope(data.user.id);
      } else {
        syncQueue.setAccountScope(null);
      }
      return {
        authenticated: Boolean(data.authenticated),
        user: data.user || null,
        activeProfile: data.activeProfile || null,
      };
    } catch (err) {
      // Falha de rede ou offline: assume anônimo sem travar a aplicação
      return { authenticated: false, user: null, activeProfile: null };
    }
  }

  /**
   * Realiza cadastro de nova conta real (/api/auth/register)
   */
  async register(payload: RegisterPayload): Promise<{ user: AuthUser; message: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível concluir o cadastro.');
    }

    if (data.user?.id) {
      syncQueue.setAccountScope(data.user.id);
    }

    return {
      user: data.user,
      message: data.message || 'Conta criada com sucesso!',
    };
  }

  /**
   * Realiza login com e-mail e senha (/api/auth/login)
   */
  async login(email: string, pass: string): Promise<{ user: AuthUser; message: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password: pass }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(data.error || 'Muitas tentativas de login com falha. Aguarde alguns minutos.');
      }
      throw new Error(data.error || 'E-mail ou senha incorretos.');
    }

    if (data.user?.id) {
      syncQueue.setAccountScope(data.user.id);
    }

    return {
      user: data.user,
      message: data.message || 'Login realizado com sucesso!',
    };
  }

  /**
   * Encerra a sessão ativa no servidor (/api/auth/logout)
   */
  async logout(): Promise<boolean> {
    try {
      syncQueue.pauseAndUnloadQueues();
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-Zapi-Client': 'web',
        },
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const authClient = new AuthClient();
