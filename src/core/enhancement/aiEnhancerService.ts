/**
 * ZapiTV — AiEnhancerService
 * Serviço coordenador da funcionalidade "Melhoria por IA".
 * Gerencia persistência em localStorage e sincronização entre vídeo e áudio.
 */

import {
  AiEnhancerSettings,
  DEFAULT_AI_ENHANCER_SETTINGS,
  EnhancementIntensity,
  VideoProcessingPlan,
  AudioProcessingPlan,
  ContentCategory,
  ComparisonMode
} from './aiEnhancerTypes';
import { videoEnhancer } from './videoEnhancer';
import { audioEnhancer } from './audioEnhancer';

const SETTINGS_STORAGE_KEY = 'zapitv_ai_enhancement_settings';

export class AiEnhancerService {
  private settings: AiEnhancerSettings = { ...DEFAULT_AI_ENHANCER_SETTINGS };
  private listeners: Set<(settings: AiEnhancerSettings) => void> = new Set();

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
          videoEnabled: typeof parsed.videoEnabled === 'boolean' ? parsed.videoEnabled : true,
          audioEnabled: typeof parsed.audioEnabled === 'boolean' ? parsed.audioEnabled : true,
          intensity: ['auto', 'subtle', 'balanced', 'strong'].includes(parsed.intensity) ? parsed.intensity : 'auto',
          categoryOverride: parsed.categoryOverride,
          comparisonMode: ['off', 'hold', 'split'].includes(parsed.comparisonMode) ? parsed.comparisonMode : 'off',
          splitPosition: typeof parsed.splitPosition === 'number' ? parsed.splitPosition : 50
        };
      }
    } catch (e) {
      console.warn('[ZapiAiService] Erro ao carregar configurações salvas:', e);
    }
  }

  public saveSettings(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[ZapiAiService] Erro ao salvar configurações no localStorage:', e);
    }
  }

  public getSettings(): AiEnhancerSettings {
    return { ...this.settings };
  }

  public subscribe(listener: (settings: AiEnhancerSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.saveSettings();
    videoEnhancer.updateSettings(this.settings);
    audioEnhancer.updateSettings(this.settings);
    this.listeners.forEach(fn => fn(this.getSettings()));
  }

  public toggleEnabled(): boolean {
    this.settings.enabled = !this.settings.enabled;
    this.notify();
    return this.settings.enabled;
  }

  public setVideoEnabled(enabled: boolean): void {
    this.settings.videoEnabled = enabled;
    this.notify();
  }

  public setAudioEnabled(enabled: boolean): void {
    this.settings.audioEnabled = enabled;
    this.notify();
  }

  public setIntensity(intensity: EnhancementIntensity): void {
    this.settings.intensity = intensity;
    this.notify();
  }

  public setComparisonMode(mode: ComparisonMode): void {
    this.settings.comparisonMode = mode;
    this.notify();
  }

  public setSplitPosition(position: number): void {
    this.settings.splitPosition = Math.max(0, Math.min(100, position));
    videoEnhancer.setSplitPosition(this.settings.splitPosition);
    this.listeners.forEach(fn => fn(this.getSettings()));
  }

  public setHoldComparison(isHolding: boolean): void {
    videoEnhancer.setHoldComparison(isHolding);
    audioEnhancer.setHoldComparison(isHolding);
  }

  public setCategoryOverride(category?: ContentCategory): void {
    this.settings.categoryOverride = category;
    videoEnhancer.setCategoryOverride(category);
    this.notify();
  }

  public updateAll(newSettings: Partial<AiEnhancerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.notify();
  }

  public setContentCategory(category: ContentCategory): void {
    videoEnhancer.setContentCategory(category);
  }

  public attachPlayer(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
    videoEnhancer.attach(video, canvas);
    audioEnhancer.attach(video);
    videoEnhancer.updateSettings(this.settings);
    audioEnhancer.updateSettings(this.settings);
  }

  public detachPlayer(): void {
    videoEnhancer.detach();
    audioEnhancer.detach();
  }

  public getVideoPlan(): VideoProcessingPlan {
    return videoEnhancer.getCurrentPlan();
  }

  public getAudioPlan(): AudioProcessingPlan {
    return audioEnhancer.getCurrentPlan();
  }

  public getStatus(): 'off' | 'initializing' | 'active' | 'unavailable' {
    return videoEnhancer.getStatus();
  }

  public onStatusChange(callback: (status: 'off' | 'initializing' | 'active' | 'unavailable') => void): () => void {
    return videoEnhancer.onStatusChange(callback);
  }

  public isRendering(): boolean {
    return videoEnhancer.isRendering();
  }

  public onRenderingChange(callback: (isRendering: boolean) => void): () => void {
    return videoEnhancer.onRenderingChange(callback);
  }
}

export const aiEnhancerService = new AiEnhancerService();
