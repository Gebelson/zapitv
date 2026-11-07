import React, { Profiler, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { TvContentRow } from '../../src/components/tv/TvContentRow';
import { tvPerformanceService } from '../../src/core/tv/tvPerformanceService';
import { ContentType } from '../../types';
import '../../index.css';

const metrics = { commits: 0, renderMs: 0, selected: '', pagesRequested: 0, isFireTv: tvPerformanceService.isFireTv() };
Object.assign(window, { p1Metrics: metrics, p1Focus: () => setFocus('row-p1-row') });
const fixtureItems = (count: number, prefix = 'fixture') => Array.from({ length: count }, (_, n) => ({ id: `${prefix}-${n}`, title: `${prefix} ${n}`, type: ContentType.MOVIE,
  year: 2020, rating: 8, image: '/p1-poster.svg' }));
function RowHarness() {
  const [items, setItems] = useState(() => fixtureItems(Number(new URLSearchParams(location.search).get('count') || 40)));
  const [mounted, setMounted] = useState(true);
  Object.assign(window, {
    p1ReplaceItems: (count: number, prefix = 'replacement') => setItems(fixtureItems(count, prefix)),
    p1Mount: (value: boolean) => setMounted(value)
  });
  return mounted ? <TvContentRow title="Fixture row" rowId="p1-row" items={items} onItemClick={item => { metrics.selected = item.id; }}
    onNearEnd={() => { metrics.pagesRequested++; }} /> : null;
}
createRoot(document.getElementById('root')!).render(<div className="zapi-tv-root" style={{ paddingTop: 40 }}>
  <Profiler id="row" onRender={(_, __, duration) => { metrics.commits++; metrics.renderMs += duration; }}>
    <RowHarness />
  </Profiler>
</div>);
