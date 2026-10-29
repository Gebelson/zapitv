/**
 * ZAPITV — CLIENTE DE AUTENTICAÇÃO REAL (P3.A)
 * 
 * Comunicação direta com a API (/api/auth) utilizando cookies de sessão seguros HttpOnly.
 * Todas as requisições incluem credentials: 'include'.
 */

import type { ProfileItem } from '../profile/profileClient';
import { syncQueue } from '../sync/syncQueue';

export interface SessionCheckResult {
  unavailable?: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  activeProfile: ProfileItem | null;
  mandatoryAuth?: boolean;
  policyVersion?: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  status: string;
  role?: 'admin' | 'user';
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
  private sessionEpoch = 0;
  async requestPasswordRecovery(email: string): Promise<{ message: string }> {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível solicitar a recuperação.');
    return data;
  }

  async completePasswordRecovery(token: string, password: string, passwordConfirm: string): Promise<{ message: string }> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token, password, passwordConfirm }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a senha.');
    return data;
  }
  /**
   * Consulta a sessão ativa no servidor (/api/auth/me)
   */
  async checkSession(): Promise<SessionCheckResult> {
    const epoch = this.sessionEpoch;
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Zapi-Client': 'web',
        },
        credentials: 'include',
      });

      if (epoch !== this.sessionEpoch) return { unavailable: true, authenticated: false, user: null, activeProfile: null };
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) syncQueue.setAccountScope(null);
        return { unavailable: res.status !== 401 && res.status !== 403, authenticated: false, user: null, activeProfile: null, mandatoryAuth: true, policyVersion: 0 };
      }

      const data = await res.json();
      if (epoch !== this.sessionEpoch) return { unavailable: true, authenticated: false, user: null, activeProfile: null };
      if (data.authenticated && data.user?.id) {
        syncQueue.setAccountScope(data.user.id, data.activeProfile?.id || null);
      } else {
        syncQueue.setAccountScope(null);
      }
      return {
        authenticated: Boolean(data.authenticated),
        user: data.user || null,
        activeProfile: data.activeProfile || null,
        mandatoryAuth: typeof data.mandatoryAuth === 'boolean' ? data.mandatoryAuth : true,
        policyVersion: typeof data.policyVersion === 'number' ? data.policyVersion : 0,
      };
    } catch (err) {
      // Transport failure is distinct from a confirmed anonymous session.
      return { unavailable: true, authenticated: false, user: null, activeProfile: null, mandatoryAuth: true, policyVersion: 0 };
    }
  }

  /**
   * Consulta a política global de autenticação (/api/auth/policy)
   */
  async getPolicy(): Promise<{ mandatoryAuth: boolean; version: number; updatedAt: number }> {
    try {
      const res = await fetch('/api/auth/policy', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return { mandatoryAuth: true, version: 0, updatedAt: Date.now() };
      }
      return await res.json();
    } catch {
      return { mandatoryAuth: true, version: 0, updatedAt: Date.now() };
    }
  }

  /**
   * Altera a política global de autenticação (/api/auth/policy)
   */
  async setPolicy(mandatoryAuth: boolean): Promise<{ mandatoryAuth: boolean; version: number }> {
    const res = await fetch('/api/auth/policy', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ mandatoryAuth }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível alterar a política de autenticação.');
    }
    return data;
  }

  /**
   * Realiza cadastro de nova conta real (/api/auth/register)
   */
  async register(payload: RegisterPayload): Promise<{ user: AuthUser; message: string }> {
    this.sessionEpoch++;
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
    this.sessionEpoch++;
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
    this.sessionEpoch++;
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
