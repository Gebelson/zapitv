/**
 * ZapiTV Playback Session Service
 * 
 * Controla e rastreia o ciclo de vida das sessões de reprodução de mídia,
 * garantindo que a intro institucional do ZapiTV seja executada EXCLUSIVAMENTE
 * quando o usuário inicia uma sessão manualmente, e nunca durante reprodução
 * contínua, avanço automático ou troca de episódio/qualidade/fonte.
 */

export type NavigationType = 'manual_start' | 'continuous_playback' | 'retry_playback' | 'remote_sync';

export interface PlaybackSession {
  sessionId: string;
  contentId: string;
  season?: number;
  episode?: number;
  navigationType: NavigationType;
  introPlayed: boolean;
  nonDubbedConfirmed?: boolean;
  startedAt: number;
  lastActiveAt: number;
}

const SESSION_STORAGE_KEY = 'zapitv_playback_session_v1';

class PlaybackSessionService {
  private currentSession: PlaybackSession | null = null;
  private listeners: Set<(session: PlaybackSession | null) => void> = new Set();
  private sessionCounter = 0;
  private resumeAfterReload = typeof window !== 'undefined' &&
    /^(?:\/tv)?\/assistir\//.test(window.location.pathname) &&
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';

  constructor() {
    const stored = this.loadStoredSession();
    if (stored) {
      this.currentSession = stored;
    }
  }

  private loadStoredSession(): PlaybackSession | null {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private persistSession(session: PlaybackSession | null): void {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      if (!session) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
    } catch {}
  }

  private clearStoredSession(): void {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }

  /**
   * Inicia ou continua uma sessão de reprodução.
   * - 'manual_start': Cria um novo sessionId único e define introPlayed = false.
   * - 'continuous_playback': Preserva o sessionId ativo e garante introPlayed = true.
   * - 'retry_playback': Preserva o sessionId e mantém introPlayed = true (nunca repete a intro no retry).
   */
  public startSession(
    contentId: string,
    navigationType: NavigationType = 'manual_start',
    season?: number,
    episode?: number
  ): PlaybackSession {
    const now = Date.now();

    if ((navigationType === 'continuous_playback' || navigationType === 'retry_playback' || navigationType === 'remote_sync') && this.currentSession) {
      // Preserva a sessão atual mantendo o mesmo sessionId e garantindo introPlayed = true
      this.currentSession = {
        ...this.currentSession,
        contentId,
        season,
        episode,
        navigationType,
        introPlayed: true,
        lastActiveAt: now
      };
      this.persistSession(this.currentSession);
      this.notifyListeners();
      return this.currentSession;
    }

    if (navigationType === 'retry_playback' || navigationType === 'remote_sync') {
      this.sessionCounter += 1;
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      const sessionId = `sess_${now}_${this.sessionCounter}_${randomSuffix}`;
      this.currentSession = {
        sessionId,
        contentId,
        season,
        episode,
        navigationType,
        introPlayed: true,
        startedAt: now,
        lastActiveAt: now
      };
      this.persistSession(this.currentSession);
      this.notifyListeners();
      return this.currentSession;
    }

    // Se for manual_start mas o usuário acabou de atualizar a página (F5) no mesmo conteúdo, recupera continuidade sem repetir vinheta
    if (navigationType === 'manual_start' && this.resumeAfterReload) {
      this.resumeAfterReload = false;
      const stored = this.loadStoredSession() || this.currentSession;
      if (stored && stored.contentId === contentId) {
        const matchesEpisode = season !== undefined ? (stored.season === season && stored.episode === episode) : true;
        const isFresh = now - (stored.lastActiveAt || 0) < 30 * 60 * 1000;
        if (matchesEpisode && isFresh) {
          this.currentSession = {
            ...stored,
            navigationType: 'continuous_playback',
            introPlayed: true,
            lastActiveAt: now
          };
          this.persistSession(this.currentSession);
          this.notifyListeners();
          return this.currentSession;
        }
      }
    }

    // manual_start: nova sessão
    this.sessionCounter += 1;
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const sessionId = `sess_${now}_${this.sessionCounter}_${randomSuffix}`;

    this.currentSession = {
      sessionId,
      contentId,
      season,
      episode,
      navigationType,
      introPlayed: false,
      startedAt: now,
      lastActiveAt: now
    };

    this.persistSession(this.currentSession);
    this.notifyListeners();
    return this.currentSession;
  }

  /**
   * Verifica se a intro deve ser exibida para a sessão.
   * Retorna true APENAS se for uma sessão iniciada manualmente onde a intro ainda não foi tocada.
   */
  public shouldPlayIntro(sessionId?: string): boolean {
    if (!this.currentSession) return false;
    if (sessionId && this.currentSession.sessionId !== sessionId) return false;
    return !this.currentSession.introPlayed && this.currentSession.navigationType === 'manual_start';
  }

  /**
   * Marca a intro como concluída para a sessão ativa.
   * Protege contra execuções duplicadas e condições de corrida.
   */
  public markIntroPlayed(sessionId?: string): void {
    if (!this.currentSession) return;
    if (sessionId && this.currentSession.sessionId !== sessionId) return;

    if (!this.currentSession.introPlayed) {
      this.currentSession.introPlayed = true;
      this.currentSession.lastActiveAt = Date.now();
      this.persistSession(this.currentSession);
      this.notifyListeners();
    }
  }

  /**
   * Retorna se a intro já foi executada para a sessão ativa.
   */
  public isIntroPlayed(sessionId?: string): boolean {
    if (!this.currentSession) return true;
    if (sessionId && this.currentSession.sessionId !== sessionId) return true;
    return this.currentSession.introPlayed;
  }

  /**
   * Registra a confirmação de reprodução no idioma original para a sessão atual,
   * evitando que o mesmo modal reapareça a cada episódio na mesma sessão.
   */
  public markNonDubbedConfirmed(sessionId?: string): void {
    if (!this.currentSession) return;
    if (sessionId && this.currentSession.sessionId !== sessionId) return;

    this.currentSession.nonDubbedConfirmed = true;
    this.currentSession.lastActiveAt = Date.now();
    this.persistSession(this.currentSession);
    this.notifyListeners();
  }

  /**
   * Retorna se a confirmação no idioma original já foi concedida nesta sessão.
   */
  public isNonDubbedConfirmed(sessionId?: string): boolean {
    if (!this.currentSession) return false;
    if (sessionId && this.currentSession.sessionId !== sessionId) return false;
    return Boolean(this.currentSession.nonDubbedConfirmed);
  }

  /**
   * Retorna a sessão ativa atual.
   */
  public getCurrentSession(): PlaybackSession | null {
    return this.currentSession;
  }

  /**
   * Encerra a sessão atual (quando o usuário fecha/sai do player).
   * Na próxima vez que o usuário clicar em Assistir, uma nova sessão será iniciada.
   */
  public endSession(sessionId?: string): void {
    if (!this.currentSession) return;
    if (sessionId && this.currentSession.sessionId !== sessionId) return;

    this.currentSession = null;
    this.clearStoredSession();
    this.notifyListeners();
  }

  /**
   * Registra um listener para atualizações de sessão.
   */
  public subscribe(listener: (session: PlaybackSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentSession);
      } catch (err) {
        console.error('[PlaybackSessionService] Erro no listener:', err);
      }
    }
  }
}

export const playbackSessionService = new PlaybackSessionService();
