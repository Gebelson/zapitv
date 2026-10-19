import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatCinemetaItem } from '../src/core/tmdb/tmdbClient';

const cases = [
  ['tt32499579', '2025–', 2025], // Haunted Hotel
  ['tt0281474', '1999–2002', 1999], // The New Woody Woodpecker Show
  ['tt11198330', '2022–', 2022], // House of the Dragon
  ['tt31938062', '2025–', 2025], // The Pitt
  ['tt13293588', '2021–', 2021] // Mushoku Tensei
] as const;

for (const [id, releaseInfo, year] of cases) {
  const item = formatCinemetaItem({ id, name: id, type: 'series', releaseInfo });
  assert.equal(item.imdbId, id);
  assert.equal(item.year, year, `${id}: ${releaseInfo}`);
}

assert.equal(formatCinemetaItem({
  id: 'tt0000000', name: 'Sem data', type: 'series', releaseInfo: 'unknown', year: '2023–'
}).year, 2023);
assert.equal(formatCinemetaItem({
  id: 'tt0000001', name: 'Sem data', type: 'series', releaseInfo: 'unknown'
}).year, 0);

// O serviço grava seu snapshot inicial. Isolamos essa verificação para não tocar dados do usuário.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zapitv-ranking-'));
const snapshotPath = path.join(tempDir, 'data', 'imdb_weekly_snapshots.json');
try {
  fs.mkdirSync(path.dirname(snapshotPath));
  fs.writeFileSync(snapshotPath, JSON.stringify([{
    id: 'test-series', weekKey: '2026-W41', weekLabel: 'Teste', monthKey: '2026-10',
    rankType: 'series', referenceDate: '2026-10-12', capturedAt: 1, source: 'imdb-tvmeter',
    items: [
      { imdbId: 'tt31908234', title: 'The Pitt', originalTitle: 'The Pitt', mediaType: 'series', position: 1 },
      { imdbId: 'tt11198330', title: 'House of the Dragon', mediaType: 'series', position: 2 },
      { imdbId: 'tt31908234', title: 'Outra obra', mediaType: 'movie', position: 3 }
    ]
  }, {
    id: 'test-series-duplicate', weekKey: '2026-W40', weekLabel: 'Teste', monthKey: '2026-10',
    rankType: 'series', referenceDate: '2026-10-05', capturedAt: 1, source: 'imdb-tvmeter',
    items: [
      { imdbId: 'tt31908234', title: 'The Pitt', mediaType: 'series', position: 1 },
      { imdbId: 'tt31938062', title: 'The Pitt', mediaType: 'series', position: 2 },
      { imdbId: 'tt11198330', title: 'House of the Dragon', mediaType: 'series', position: 3 }
    ]
  }]));
  process.chdir(tempDir);
  const { imdbWeeklyRankingService } = await import('../src/core/rankings/IMDbWeeklyRankingService');
  const ranking = imdbWeeklyRankingService.getLatestRanking('series').ranking;
  const pitt = ranking.find(item => item.title === 'The Pitt');
  assert.equal(pitt?.imdbId, 'tt31938062');
  assert.equal(ranking.find(item => item.title === 'House of the Dragon')?.imdbId, 'tt11198330');
  assert.equal(ranking.find(item => item.title === 'Outra obra')?.imdbId, 'tt31908234');
  const persisted = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.equal(persisted[0].items[0].imdbId, 'tt31938062');
  assert.deepEqual(persisted[1].items.map((item: { imdbId: string }) => item.imdbId),
    ['tt31938062', 'tt11198330']);
} finally {
  process.chdir(originalCwd);
  if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
  const dataDir = path.dirname(snapshotPath);
  if (fs.existsSync(dataDir)) fs.rmdirSync(dataDir);
  fs.rmdirSync(tempDir);
}

console.log('Anos e IDs do Cinemeta: OK');
