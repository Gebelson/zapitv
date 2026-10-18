/**
 * ZapiTV — WatchPartyChatService
 * 
 * Serviço isolado para o Chat de Texto da Watch Party.
 * Responsável pelo histórico, deduplicação por ID único, mensagens de sistema
 * e desacoplamento do transporte de controle.
 */

import { WatchPartyChatMessage } from './watchPartyTypes';

export type ChatMessageCallback = (message: WatchPartyChatMessage) => void;

export class WatchPartyChatService {
  private messages: WatchPartyChatMessage[] = [];
  private seenMessageIds: Set<string> = new Set();
  private maxHistory: number = 150;
  private listeners: Set<ChatMessageCallback> = new Set();

  public getHistory(): WatchPartyChatMessage[] {
    return [...this.messages];
  }

  public createMessage(text: string, senderId: string, senderNickname: string, isHost: boolean): WatchPartyChatMessage {
    return {
      id: `chat_${senderId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId,
      senderNickname,
      isHost,
      text: text.trim(),
      timestamp: Date.now()
    };
  }

  public addMessage(message: WatchPartyChatMessage): boolean {
    if (!message || !message.id || !message.text) return false;

    // Deduplicação estrita
    if (this.seenMessageIds.has(message.id)) {
      return false;
    }

    this.seenMessageIds.add(message.id);
    this.messages.push(message);

    // Limita tamanho do histórico mantendo os mais recentes
    if (this.messages.length > this.maxHistory) {
      const removed = this.messages.shift();
      if (removed) {
        this.seenMessageIds.delete(removed.id);
      }
    }

    this.notify(message);
    return true;
  }

  public addSystemMessage(text: string): WatchPartyChatMessage {
    const sysMsg: WatchPartyChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: 'system',
      senderNickname: 'ZapiTV',
      isHost: false,
      text,
      timestamp: Date.now()
    };

    this.addMessage(sysMsg);
    return sysMsg;
  }

  public clear(): void {
    this.messages = [];
    this.seenMessageIds.clear();
  }

  public onMessage(callback: ChatMessageCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(message: WatchPartyChatMessage): void {
    this.listeners.forEach(cb => {
      try {
        cb(message);
      } catch (err) {
        console.error('[WatchPartyChatService] Erro no callback de mensagem:', err);
      }
    });
  }
}
