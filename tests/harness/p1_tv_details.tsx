import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { TvDetailsModal } from '../../src/components/tv/TvDetailsModal';
import { useTvFocusable } from '../../src/core/tv/useTvFocusable';
import { tvNavigationManager } from '../../src/core/tv/tvNavigationManager';
import { tmdbService } from '../../src/core/tmdb/tmdbClient';
import { ContentType } from '../../types';
import '../../index.css';

// All service substitutions are confined to this loopback-only fixture.
const query = new URLSearchParams(location.search);
const episodic = query.get('type') !== 'movie';
const item = { id: 'fixture-focus', title: 'Focus fixture', type: query.get('type') === 'anime' ? ContentType.ANIME : episodic ? ContentType.SERIES : ContentType.MOVIE,
  year: 2020, rating: 8, image: '/fixture.svg', tmdbId: '123456789', genres: ['Drama'] };
let releaseEpisodes = () => {};
const episodeGate = query.has('delay') ? new Promise<void>(r => { releaseEpisodes = r; }) : Promise.resolve();
const episodes = [1, 2, 3].map(number => ({ number, season: 1, title: 'Episode ' + number, airDate: '2020-01-01', availabilityStatus: 'available' }));
let episodeRequests = 0;
tmdbService.getSeasonEpisodes = async () => {
  episodeRequests++;
  await episodeGate;
  if (query.has('returnDelay') && episodeRequests > 1) await new Promise<void>(r => { releaseEpisodes = r; });
  return query.has('empty') ? [] : episodes;
};
Object.assign(window, { releaseEpisodes: () => releaseEpisodes() });

function Player({ close }: { close: () => void }) {
  const { ref, focused } = useTvFocusable({ focusKey: 'fixture-player', onEnterPress: close });
  useEffect(() => {
    setFocus('fixture-player');
    return tvNavigationManager.registerBackHandler('fixture-player', 200, () => { close(); return true; });
  }, [close]);
  return <button ref={ref} data-focus-key="fixture-player" data-tv-focused={focused || undefined} onClick={close}>Voltar do player interrompido</button>;
}
function Harness() {
  const [screen, setScreen] = useState('card');
  const [continuity, setContinuity] = useState<number | undefined>(query.has('progress') ? 1 : undefined);
  const [returnKey, setReturnKey] = useState<string>();
  const previous = useRef<string | undefined>(undefined);
  const { ref, focused } = useTvFocusable({ focusKey: 'fixture-card', onEnterPress: () => setScreen('details') });
  useEffect(() => { setFocus('fixture-card'); }, []);
  if (screen === 'player') return <Player close={() => { setReturnKey(previous.current); setScreen('details'); }} />;
  return <div className="zapi-tv-root">
    <button ref={ref} data-focus-key="fixture-card" data-tv-focused={focused || undefined}>Fixture card</button>
    {screen === 'details' && <TvDetailsModal item={item} initialSeason={1} initialEpisode={continuity}
      {...{ returnFocusKey: returnKey }} allContent={[item]} myList={[]} favorites={[]}
      onToggleList={() => {}} onToggleFavorite={() => {}}
      onClose={() => { setReturnKey(undefined); setScreen('card'); requestAnimationFrame(() => setFocus('fixture-card')); }}
      onPlay={(_, __, episode) => { previous.current = getCurrentFocusKey(); setContinuity(episode || 1); setScreen('player'); }} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
