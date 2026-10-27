import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LiveTvPlayer } from '../../src/components/livetv/LiveTvPlayer';
import { OfficialChannelProvider } from '../../src/core/livetv/OfficialChannelProvider';
import '../../index.css';

const counts = { next: 0, close: 0 };
const channel = { ...OfficialChannelProvider.getOfficialChannels()[0], requiresExternalAccess: true };
const onNext = () => { counts.next++; };
const onClose = () => { counts.close++; };
function Harness() {
  const [mounted, setMounted] = useState(true);
  const [tick, setTick] = useState(0);
  Object.assign(window, { p1LiveCounts: counts, p1LiveRender: () => setTick(n => n + 1),
    p1LiveMount: (value: boolean) => setMounted(value) });
  return <div data-tick={tick} style={{ width: 960, height: 540 }}>
    {mounted && <LiveTvPlayer channel={channel} onNextChannel={onNext} onClose={onClose} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
