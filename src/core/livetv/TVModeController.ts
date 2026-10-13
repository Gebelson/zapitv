/**
 * ZapiTV — TVModeController
 * Controlador de navegação e zapping do Modo Televisão.
 * Gerencia a fila de canais, zapear para frente e para trás, teclado Smart TV e transições suaves.
 */

import { LiveChannel } from './types';
import { liveTvPreferences } from './liveTvPreferences';

export class TVModeController {
  private static instance: TVModeController;
  private channels: LiveChannel[] = [];
  private activeChannelIndex = 0;
  private listeners = new Set<(activeChannel: LiveChannel, index: number) => void>();

  public static getInstance(): TVModeController {
    if (!TVModeController.instance) {
      TVModeController.instance = new TVModeController();
    }
    return TVModeController.instance;
  }

  public setChannels(channels: LiveChannel[], initialActiveId?: string): void {
    this.channels = channels;
    if (channels.length === 0) return;

    if (initialActiveId) {
      const idx = channels.findIndex(c => c.id === initialActiveId);
      this.activeChannelIndex = idx !== -1 ? idx : 0;
    } else {
      const lastWatched = liveTvPreferences.getState().lastWatchedChannelId;
      const idx = channels.findIndex(c => c.id === lastWatched);
      this.activeChannelIndex = idx !== -1 ? idx : 0;
    }
  }

  public getActiveChannel(): LiveChannel | null {
    if (this.channels.length === 0) return null;
    return this.channels[this.activeChannelIndex] || this.channels[0];
  }

  public getActiveIndex(): number {
    return this.activeChannelIndex;
  }

  public getTotalChannels(): number {
    return this.channels.length;
  }

  public selectChannelById(id: string): LiveChannel | null {
    const idx = this.channels.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.activeChannelIndex = idx;
      const ch = this.channels[idx];
      liveTvPreferences.setLastWatched(ch.id);
      this.notify();
      return ch;
    }
    return null;
  }

  public nextChannel(): LiveChannel | null {
    if (this.channels.length === 0) return null;
    this.activeChannelIndex = (this.activeChannelIndex + 1) % this.channels.length;
    const ch = this.channels[this.activeChannelIndex];
    liveTvPreferences.setLastWatched(ch.id);
    this.notify();
    return ch;
  }

  public prevChannel(): LiveChannel | null {
    if (this.channels.length === 0) return null;
    this.activeChannelIndex = (this.activeChannelIndex - 1 + this.channels.length) % this.channels.length;
    const ch = this.channels[this.activeChannelIndex];
    liveTvPreferences.setLastWatched(ch.id);
    this.notify();
    return ch;
  }

  public subscribe(listener: (activeChannel: LiveChannel, index: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const active = this.getActiveChannel();
    if (active) {
      this.listeners.forEach(fn => fn(active, this.activeChannelIndex));
    }
  }
}

export const tvModeController = TVModeController.getInstance();
