/**
 * ZapiTV — WatchPartyStateMachine
 * 
 * Máquina de estados finita formal para o ciclo de vida da sala de Watch Party.
 * Garante transições válidas, impede condições de corrida e sincroniza
 * estados entre Host e Convidados.
 */

import { RoomLifecycleState } from './watchPartyTypes';

export type StateChangeCallback = (newState: RoomLifecycleState, previousState: RoomLifecycleState, reason?: string) => void;

export class WatchPartyStateMachine {
  private currentState: RoomLifecycleState = 'LOBBY';
  private listeners: Set<StateChangeCallback> = new Set();

  private static readonly VALID_TRANSITIONS: Record<RoomLifecycleState, RoomLifecycleState[]> = {
    CREATING: ['LOBBY', 'ERROR', 'ENDED'],
    LOBBY: ['CREATING', 'PREPARING', 'READY', 'STARTING', 'PLAYING_INTRO', 'PLAYING_CONTENT', 'RECONNECTING', 'ERROR', 'ENDED'],
    PREPARING: ['READY', 'LOBBY', 'STARTING', 'PLAYING_INTRO', 'PLAYING_CONTENT', 'RECONNECTING', 'ERROR', 'ENDED'],
    READY: ['STARTING', 'PLAYING_INTRO', 'PLAYING_CONTENT', 'LOBBY', 'PREPARING', 'RECONNECTING', 'ERROR', 'ENDED'],
    STARTING: ['PLAYING_INTRO', 'PLAYING_CONTENT', 'READY', 'LOBBY', 'ERROR', 'ENDED'],
    PLAYING_INTRO: ['PLAYING_CONTENT', 'PLAYING', 'PAUSED', 'LOBBY', 'RECONNECTING', 'ERROR', 'ENDED'],
    PLAYING_CONTENT: ['PAUSED', 'PLAYING_INTRO', 'LOBBY', 'RECONNECTING', 'ERROR', 'ENDED'],
    PLAYING: ['PAUSED', 'PLAYING_INTRO', 'PLAYING_CONTENT', 'LOBBY', 'RECONNECTING', 'ERROR', 'ENDED'],
    PAUSED: ['PLAYING_CONTENT', 'PLAYING', 'PLAYING_INTRO', 'LOBBY', 'RECONNECTING', 'ERROR', 'ENDED'],
    RECONNECTING: ['LOBBY', 'PREPARING', 'READY', 'PLAYING_INTRO', 'PLAYING_CONTENT', 'PAUSED', 'ERROR', 'ENDED'],
    ERROR: ['LOBBY', 'RECONNECTING', 'ENDED'],
    ENDED: ['LOBBY', 'CREATING'] // Permite reiniciar sala
  };

  constructor(initialState: RoomLifecycleState = 'LOBBY') {
    this.currentState = initialState;
  }

  public getState(): RoomLifecycleState {
    return this.currentState;
  }

  public canTransitionTo(nextState: RoomLifecycleState): boolean {
    if (this.currentState === nextState) return true;
    const allowed = WatchPartyStateMachine.VALID_TRANSITIONS[this.currentState];
    return allowed ? allowed.includes(nextState) : false;
  }

  public transitionTo(nextState: RoomLifecycleState, reason?: string, force: boolean = false): boolean {
    // Normaliza PLAYING para PLAYING_CONTENT para consistência
    const target = (nextState === 'PLAYING') ? 'PLAYING_CONTENT' : nextState;

    if (this.currentState === target) {
      return true;
    }

    if (!force && !this.canTransitionTo(target)) {
      console.warn(`[WatchPartyStateMachine] Transição inválida rejeitada: ${this.currentState} -> ${target} (motivo: ${reason || 'N/A'})`);
      return false;
    }

    const previousState = this.currentState;
    this.currentState = target;
    console.log(`[WatchPartyStateMachine] Transição de estado: ${previousState} -> ${target} [motivo: ${reason || 'sem detalhes'}]`);

    this.notify(target, previousState, reason);
    return true;
  }

  public reset(initialState: RoomLifecycleState = 'LOBBY'): void {
    const prev = this.currentState;
    this.currentState = initialState;
    this.notify(initialState, prev, 'reset');
  }

  public subscribe(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(newState: RoomLifecycleState, previousState: RoomLifecycleState, reason?: string): void {
    this.listeners.forEach(cb => {
      try {
        cb(newState, previousState, reason);
      } catch (err) {
        console.error('[WatchPartyStateMachine] Erro no callback de listener:', err);
      }
    });
  }
}
