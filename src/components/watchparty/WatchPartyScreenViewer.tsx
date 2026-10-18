import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { watchPartyService } from '../../core/watchparty/WatchPartyService';
import { WatchPartyOverlay } from './WatchPartyOverlay';
import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';

export const WatchPartyScreenViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(() => watchPartyService.getScreenStream());
  const [needsPlay, setNeedsPlay] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => watchPartyService.onScreenStreamChange(next => {
    setStream(next);
    if (next) setTimedOut(false);
  }), []);

  useEffect(() => {
    if (stream) return;
    const timer = window.setTimeout(() => setTimedOut(true), 15000);
    return () => window.clearTimeout(timer);
  }, [stream, retryCount]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    setNeedsPlay(false);
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    const ended = () => setStream(null);
    videoTrack?.addEventListener('ended', ended);
    video.play().catch(() => setNeedsPlay(true));
    return () => {
      videoTrack?.removeEventListener('ended', ended);
      video.srcObject = null;
    };
  }, [stream]);

  const leave = () => {
    void watchPartyService.leaveRoom();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black text-white">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
          <p className="text-lg font-bold">{timedOut ? 'A transmissão do anfitrião não chegou.' : 'Aguardando a transmissão do anfitrião...'}</p>
          {timedOut && (
            <button onClick={() => { setTimedOut(false); setRetryCount(count => count + 1); watchPartyService.requestScreenStream(); }}
              className="rounded-full bg-[#007df7] px-5 py-2.5 text-sm font-bold">Tentar novamente</button>
          )}
        </div>
      )}
      {needsPlay && stream && (
        <button onClick={() => videoRef.current?.play().then(() => setNeedsPlay(false)).catch(() => {})}
          className="absolute inset-0 m-auto h-14 w-fit rounded-full bg-[#007df7] px-6 font-bold">Ativar áudio e vídeo</button>
      )}
      <button onClick={leave} aria-label="Sair da Watch Party"
        className="absolute top-5 right-5 rounded-full bg-black/70 p-3 hover:bg-black"><X className="h-5 w-5" /></button>
      <FeatureErrorBoundary featureName="controles da Watch Party" fallback={null}>
        <WatchPartyOverlay onLeaveRoom={leave} />
      </FeatureErrorBoundary>
    </div>
  );
};
