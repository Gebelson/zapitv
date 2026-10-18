/**
 * ZapiTV — WatchPartyVoiceService
 * 
 * Serviço isolado do plano de mídia de áudio/voz (Voice Chat).
 * Gerencia captura de microfone, detecção de atividade de voz (VAD),
 * renderização de elementos de áudio no DOM, controle de volume e silenciamento.
 */

export interface VoiceStateChangeData {
  isVoiceActive: boolean;
  isMuted: boolean;
}

export type VoiceStateChangeCallback = (data: VoiceStateChangeData) => void;
export type SpeakingChangeCallback = (peerId: string, isSpeaking: boolean) => void;

export class WatchPartyVoiceService {
  private localAudioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private vadInterval: any = null;
  private isSpeakingLocal: boolean = false;
  private speakingDecayTimers: Map<string, any> = new Map();

  // Áudio remoto
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private remoteVadIntervals: Map<string, any> = new Map();
  private remoteAnalysers: Map<string, AnalyserNode> = new Map();
  private participantVolumes: Map<string, number> = new Map();
  private localMutedPeers: Set<string> = new Set();

  private voiceStateListeners: Set<VoiceStateChangeCallback> = new Set();
  private speakingListeners: Set<SpeakingChangeCallback> = new Set();

  private getOrCreateAudioContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    let container = document.getElementById('zapitv-watchparty-audio-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'zapitv-watchparty-audio-container';
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '0';
      container.style.height = '0';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.setAttribute('aria-hidden', 'true');
      document.body.appendChild(container);
    }
    return container;
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  public isVoiceActive(): boolean {
    return Boolean(this.localAudioStream !== null);
  }

  public isMicrophoneMuted(): boolean {
    if (!this.localAudioStream) return true;
    const track = this.localAudioStream.getAudioTracks()[0];
    return !track || !track.enabled;
  }

  public getLocalAudioStream(): MediaStream | null {
    return this.localAudioStream;
  }

  public getRemoteAudioElements(): Map<string, HTMLAudioElement> {
    return this.remoteAudioElements;
  }

  public async startVoiceChat(options?: { echoCancellation?: boolean; noiseSuppression?: boolean }): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microfone não suportado neste navegador.');
    }

    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: options?.echoCancellation ?? true,
          noiseSuppression: options?.noiseSuppression ?? true,
          autoGainControl: true
        },
        video: false
      });

      this.startLocalVad();
      this.notifyVoiceState(true, false);
      return this.localAudioStream;
    } catch (err) {
      console.warn('[WatchPartyVoiceService] Permissão de microfone negada ou erro:', err);
      return null;
    }
  }

  public stopVoiceChat(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    this.speakingDecayTimers.forEach(t => clearTimeout(t));
    this.speakingDecayTimers.clear();

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(t => t.stop());
      this.localAudioStream = null;
    }

    this.isSpeakingLocal = false;
    this.notifySpeaking('local', false);

    this.remoteAudioElements.forEach(el => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    this.remoteAudioElements.clear();
    this.remoteVadIntervals.forEach(t => clearInterval(t));
    this.remoteVadIntervals.clear();
    this.remoteAnalysers.clear();

    this.notifyVoiceState(false, true);
  }

  public toggleMuteVoice(): boolean {
    if (!this.localAudioStream) return true;
    const audioTrack = this.localAudioStream.getAudioTracks()[0];
    if (!audioTrack) return true;

    audioTrack.enabled = !audioTrack.enabled;
    const isMuted = !audioTrack.enabled;

    if (isMuted) {
      this.setLocalSpeaking(false);
    }

    this.notifyVoiceState(true, isMuted);
    return isMuted;
  }

  public attachRemoteAudio(peerId: string, stream: MediaStream): void {
    if (!stream || stream.getAudioTracks().length === 0) return;

    let audio = this.remoteAudioElements.get(peerId);
    if (audio && audio.srcObject === stream) {
      const vol = this.participantVolumes.get(peerId) ?? 1.0;
      const isLocallyMuted = this.localMutedPeers.has(peerId);
      audio.volume = isLocallyMuted ? 0 : vol;
      audio.muted = isLocallyMuted;
      if (audio.paused) audio.play().catch(() => {});
      return;
    }

    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      (audio as any).playsInline = true;
      const container = this.getOrCreateAudioContainer();
      if (container) container.appendChild(audio);
      this.remoteAudioElements.set(peerId, audio);
    }

    audio.srcObject = stream;
    const vol = this.participantVolumes.get(peerId) ?? 1.0;
    const isLocallyMuted = this.localMutedPeers.has(peerId);
    audio.volume = isLocallyMuted ? 0 : vol;
    audio.muted = isLocallyMuted;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn('[WatchPartyVoiceService] Áudio remoto aguardando gesto do usuário:', e);
        const unlockAudio = () => {
          audio?.play().catch(() => {});
          document.removeEventListener('click', unlockAudio);
          document.removeEventListener('keydown', unlockAudio);
          document.removeEventListener('touchstart', unlockAudio);
        };
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });
        document.addEventListener('touchstart', unlockAudio, { once: true });
      });
    }

    this.setupRemoteVad(peerId, stream);
  }

  public removeRemoteAudio(peerId: string): void {
    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudioElements.delete(peerId);
    }

    if (this.remoteVadIntervals.has(peerId)) {
      clearInterval(this.remoteVadIntervals.get(peerId));
      this.remoteVadIntervals.delete(peerId);
    }
    this.remoteAnalysers.delete(peerId);
    this.notifySpeaking(peerId, false);
  }

  public unlockRemoteAudio(): void {
    const ctx = this.ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.remoteAudioElements.forEach(audio => {
      if (audio.paused && audio.srcObject) {
        audio.play().catch(() => {});
      }
    });
  }

  public setParticipantAudioVolume(peerId: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.participantVolumes.set(peerId, clamped);

    const audio = this.remoteAudioElements.get(peerId);
    const isLocallyMuted = this.localMutedPeers.has(peerId);
    if (audio) {
      audio.volume = isLocallyMuted ? 0 : clamped;
    }
  }

  public toggleMuteParticipantLocally(peerId: string): boolean {
    if (this.localMutedPeers.has(peerId)) {
      this.localMutedPeers.delete(peerId);
    } else {
      this.localMutedPeers.add(peerId);
    }
    const isLocallyMuted = this.localMutedPeers.has(peerId);

    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      audio.muted = isLocallyMuted;
      audio.volume = isLocallyMuted ? 0 : (this.participantVolumes.get(peerId) ?? 1.0);
    }
    return isLocallyMuted;
  }

  public isParticipantLocallyMuted(peerId: string): boolean {
    return this.localMutedPeers.has(peerId);
  }

  // --- Voice Activity Detection (VAD) ---

  private startLocalVad(): void {
    if (!this.localAudioStream) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaStreamSource(this.localAudioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      this.localAnalyser = analyser;

      if (this.vadInterval) clearInterval(this.vadInterval);

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      this.vadInterval = setInterval(() => {
        if (!this.localAudioStream || !this.localAnalyser) return;
        const track = this.localAudioStream.getAudioTracks()[0];
        if (!track || !track.enabled) {
          if (this.isSpeakingLocal) {
            this.setLocalSpeaking(false);
          }
          return;
        }

        this.localAnalyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const speakingNow = avg > 14;

        if (speakingNow) {
          if (!this.isSpeakingLocal) {
            this.setLocalSpeaking(true);
          }
          if (this.speakingDecayTimers.has('local')) {
            clearTimeout(this.speakingDecayTimers.get('local'));
          }
          const timer = setTimeout(() => {
            this.setLocalSpeaking(false);
          }, 450);
          this.speakingDecayTimers.set('local', timer);
        }
      }, 70);
    } catch (e) {
      console.warn('[WatchPartyVoiceService] Falha ao iniciar VAD local:', e);
    }
  }

  private setLocalSpeaking(isSpeaking: boolean): void {
    if (this.isSpeakingLocal === isSpeaking) return;
    this.isSpeakingLocal = isSpeaking;
    this.notifySpeaking('local', isSpeaking);
  }

  private setupRemoteVad(peerId: string, stream: MediaStream): void {
    if (this.remoteVadIntervals.has(peerId)) {
      clearInterval(this.remoteVadIntervals.get(peerId));
      this.remoteVadIntervals.delete(peerId);
    }

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.remoteAnalysers.set(peerId, analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const remoteVad = setInterval(() => {
        if (!this.remoteAudioElements.has(peerId)) {
          clearInterval(remoteVad);
          this.remoteVadIntervals.delete(peerId);
          return;
        }
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const avg = sum / buf.length;
        if (avg > 14) {
          this.notifySpeaking(peerId, true);
          if (this.speakingDecayTimers.has(peerId)) {
            clearTimeout(this.speakingDecayTimers.get(peerId));
          }
          const timer = setTimeout(() => {
            this.notifySpeaking(peerId, false);
          }, 450);
          this.speakingDecayTimers.set(peerId, timer);
        }
      }, 100);

      this.remoteVadIntervals.set(peerId, remoteVad);
    } catch (e) {
      console.warn('[WatchPartyVoiceService] Falha ao iniciar VAD remoto:', e);
    }
  }

  // --- Subscrições ---

  public onVoiceStateChange(cb: VoiceStateChangeCallback): () => void {
    this.voiceStateListeners.add(cb);
    return () => this.voiceStateListeners.delete(cb);
  }

  public onSpeakingChange(cb: SpeakingChangeCallback): () => void {
    this.speakingListeners.add(cb);
    return () => this.speakingListeners.delete(cb);
  }

  private notifyVoiceState(isVoiceActive: boolean, isMuted: boolean): void {
    this.voiceStateListeners.forEach(cb => {
      try {
        cb({ isVoiceActive, isMuted });
      } catch (err) {
        console.error('[WatchPartyVoiceService] Erro no callback de voice state:', err);
      }
    });
  }

  private notifySpeaking(peerId: string, isSpeaking: boolean): void {
    this.speakingListeners.forEach(cb => {
      try {
        cb(peerId, isSpeaking);
      } catch (err) {
        console.error('[WatchPartyVoiceService] Erro no callback de speaking:', err);
      }
    });
  }
}
