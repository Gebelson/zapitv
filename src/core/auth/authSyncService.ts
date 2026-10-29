/**
 * ZAPITV — SINCRONIZAÇÃO DINÂMICA DE AUTENTICAÇÃO E POLÍTICA GLOBAL (P4.D)
 * 
 * - Sincronização em tempo real entre abas via BroadcastChannel e Storage Events.
 * - Detecção instantânea de revogação de sessão ao recuperar foco / visibilidade (0ms).
 * - Heartbeat adaptativo e leve (30s em primeiro plano, pausado em segundo plano).
 * - Sem WebSockets ou conexões contínuas caras em serverless (Vercel).
 * - Compatível com Desktop, Mobile, Smart TV WebViews (Tizen, webOS, MSX, Fire TV).
 */

import { authClient, AuthUser } from './authClient';
import type { ProfileItem } from '../profile/profileClient';

export interface AuthSyncState {
  isAuthenticated: boolean;
  mandatoryAuth: boolean;
  user: AuthUser | null;
  activeProfile: ProfileItem | null;
  shouldBlock: boolean;
  lastCheckedAt: number;
}

type AuthSyncListener = (state: AuthSyncState) => void;

class AuthSyncService {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<AuthSyncListener>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private lastCheckTimestamp = 0;
  private isStarted = false;

  private currentState: AuthSyncState = {
    isAuthenticated: false,
    mandatoryAuth: true,
    user: null,
    activeProfile: null,
    shouldBlock: true,
    lastCheckedAt: 0,
  };

  constructor() {
    this.initCrossTabChannel();
  }

  private initCrossTabChannel() {
    if (typeof window === 'undefined') return;

    // 1. BroadcastChannel para comunicação de baixa latência entre abas
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('zapitv_auth_sync');
        this.channel.onmessage = (event) => {
          this.handleIncomingCrossTabMessage(event.data);
        };
      } catch {
        this.channel = null;
      }
    }

    // 2. Storage event como fallback resiliente para navegadores e Smart TVs mais antigas
    window.addEventListener('storage', (e) => {
      if (e.key === 'zapitv_auth_sync_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.handleIncomingCrossTabMessage(parsed);
        } catch {}
      }
    });

    // 3. Gatilhos de recuperação imediata de foco e visibilidade
    window.addEventListener('focus', () => {
      this.recheck('focus');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recheck('visibility');
        this.restartHeartbeat();
      } else {
        // Pausa heartbeat enquanto em segundo plano para economizar recursos
        this.pauseHeartbeat();
      }
    });

    window.addEventListener('online', () => {
      this.recheck('online');
    });
  }

  private handleIncomingCrossTabMessage(data: any) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'LOGIN' || data.type === 'LOGOUT' || data.type === 'POLICY_CHANGE' || data.type === 'SESSION_EXPIRED') {
      // Revalida imediatamente o estado sem F5
      this.recheck(`cross_tab_${data.type.toLowerCase()}`);
    }
  }

  /**
   * Notifica outras abas de mudanças locais (login, logout, pareamento)
   */
  public notifyAuthChange(type: 'LOGIN' | 'LOGOUT' | 'POLICY_CHANGE' | 'SESSION_EXPIRED', payload?: any) {
    const message = {
      type,
      payload,
      timestamp: Date.now(),
      senderId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {}
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('zapitv_auth_sync_event', JSON.stringify(message));
      } catch {}
    }

    // Revalida localmente
    this.recheck('local_mutation');
  }

  /**
   * Revalida a sessão e a política global com o backend
   */
  public async recheck(trigger = 'manual'): Promise<AuthSyncState> {
    const now = Date.now();
    // Evita chamadas duplicadas simultâneas ou com intervalo inferior a 2 segundos
    if (this.isChecking || (now - this.lastCheckTimestamp < 2000 && trigger === 'focus')) {
      return this.currentState;
    }

    this.isChecking = true;
    this.lastCheckTimestamp = now;

    try {
      const session = await authClient.checkSession();
      if (session.unavailable) return this.currentState;
      const mandatoryAuth = typeof session.mandatoryAuth === 'boolean' ? session.mandatoryAuth : true;
      const isAuthenticated = Boolean(session.authenticated && session.user);

      const newState: AuthSyncState = {
        isAuthenticated,
        mandatoryAuth,
        user: session.user || null,
        activeProfile: session.activeProfile || null,
        shouldBlock: mandatoryAuth && !isAuthenticated,
        lastCheckedAt: now,
      };

      const hasChanged =
        this.currentState.isAuthenticated !== newState.isAuthenticated ||
        this.currentState.mandatoryAuth !== newState.mandatoryAuth ||
        this.currentState.shouldBlock !== newState.shouldBlock ||
        this.currentState.user?.id !== newState.user?.id ||
        this.currentState.user?.role !== newState.user?.role ||
        this.currentState.activeProfile?.id !== newState.activeProfile?.id;

      this.currentState = newState;
      if (newState.isAuthenticated && newState.user && newState.activeProfile) {
        const { storageService } = await import('../storage/storageService');
        const scope = storageService.getScope();
        if (scope?.userId === newState.user.id && scope.profileId === newState.activeProfile.id) {
          await storageService.hydrateRemoteProfile(scope.profileId);
        }
      }

      if (hasChanged) {
        this.notifyListeners();
      }

      return newState;
    } catch {
      // Erro de rede ou offline: mantém o estado anterior para resiliência
      return this.currentState;
    } finally {
      this.isChecking = false;
    }
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('Erro no listener de authSync:', err);
      }
    }
  }

  /**
   * Inscreve um componente para receber atualizações reativas de autenticação
   */
  public subscribe(listener: AuthSyncListener): () => void {
    this.listeners.add(listener);
    // Emite o estado atual imediatamente
    listener(this.currentState);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): AuthSyncState {
    return this.currentState;
  }

  /**
   * Inicia o ciclo de sincronização e o heartbeat adaptativo
   */
  public start() {
    if (this.isStarted) return;
    this.isStarted = true;
    this.recheck('initial');
    this.restartHeartbeat();
  }

  private restartHeartbeat() {
    this.pauseHeartbeat();
    // 30 segundos enquanto ativo em primeiro plano
    this.heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.recheck('heartbeat');
      }
    }, 30000);
  }

  private pauseHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public stop() {
    this.pauseHeartbeat();
    this.isStarted = false;
  }
}

export const authSyncService = new AuthSyncService();
