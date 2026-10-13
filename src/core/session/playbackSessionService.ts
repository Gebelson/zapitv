/**
 * ZapiTV Playback Session Service
 * 
 * Controla e rastreia o ciclo de vida das sessões de reprodução de mídia,
 * garantindo que a intro institucional do ZapiTV seja executada EXCLUSIVAMENTE
 * quando o usuário inicia uma sessão manualmente, e nunca durante reprodução
 * contínua, avanço automático ou troca de episódio/qualidade/fonte.
 */

export type NavigationType = 'manual_start' | 'continuous_playback';

export interface PlaybackSession {
  sessionId: string;
  contentId: string;
  season?: number;
  episode?: number;
  navigationType: NavigationType;
  introPlayed: boolean;
  startedAt: number;
  lastActiveAt: number;
}

class PlaybackSessionService {
  private currentSession: PlaybackSession | null = null;
  private listeners: Set<(session: PlaybackSession | null) => void> = new Set();
  private sessionCounter = 0;

  /**
   * Inicia ou continua uma sessão de reprodução.
   * - 'manual_start': Cria um novo sessionId único e define introPlayed = false.
   * - 'continuous_playback': Preserva o sessionId ativo e garante introPlayed = true.
   */
  public startSession(
    contentId: string,
    navigationType: NavigationType = 'manual_start',
    season?: number,
    episode?: number
  ): PlaybackSession {
    const now = Date.now();

    if (navigationType === 'continuous_playback' && this.currentSession) {
      // Preserva a sessão atual mantendo o mesmo sessionId e garantindo introPlayed = true
      this.currentSession = {
        ...this.currentSession,
        contentId,
        season,
        episode,
        navigationType: 'continuous_playback',
        introPlayed: true,
        lastActiveAt: now
      };
      this.notifyListeners();
      return this.currentSession;
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
