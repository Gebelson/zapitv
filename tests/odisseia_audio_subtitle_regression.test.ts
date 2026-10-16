import assert from 'node:assert/strict';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { analyzeStreamSubtitleFormat } from '../src/core/subtitles/streamSubtitleDetector';
import { subtitlePreferenceService } from '../src/core/subtitles/subtitlePreferenceService';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';

const odyssey = FEATURED_CATALOG_ITEMS.find(item => item.id === 'movie-a-odisseia-2026');
assert.ok(odyssey);
assert.notEqual(odyssey.availabilityStatus, 'verified');
assert.notEqual(odyssey.audioStatus, 'pt-br-dubbed');
assert.equal(odyssey.verifiedStreams?.length ?? 0, 0);

const spanishHardsub = { name: 'Provedor', title: 'The Odyssey PT-BR audio • Hardsub Español', url: 'https://example.org/film.mp4' };
assert.equal(analyzeStreamSubtitleFormat(spanishHardsub).format, 'hardsub_foreign');
assert.equal(subtitlePreferenceService.analyzeSubtitles(spanishHardsub).hasPtSubtitle, false);

const ambiguousHardsub = { name: 'Provedor', title: 'The Odyssey Hardsub', url: 'https://example.org/film.mp4' };
assert.notEqual(analyzeStreamSubtitleFormat(ambiguousHardsub).format, 'hardsub_ptbr');
assert.equal(subtitlePreferenceService.analyzeSubtitles(ambiguousHardsub).hasPtSubtitle, false);

const portugueseHardsub = { name: 'Provedor', title: 'The Odyssey Hardsub PT-BR', url: 'https://example.org/film.mp4' };
assert.equal(analyzeStreamSubtitleFormat(portugueseHardsub).format, 'hardsub_ptbr');
assert.equal(subtitlePreferenceService.analyzeSubtitles(portugueseHardsub).hasPtSubtitle, true);

const audioOptions = audioSelectionManager.buildAudioOptions({
  item: odyssey,
  streams: [ambiguousHardsub],
  hlsTracks: [],
  currentStreamIndex: 0,
  activeAudioId: null
});
assert.equal(audioOptions[0]?.langCode, 'other');
console.log('A Odisseia: disponibilidade, áudio e legendas sem afirmações falsas: OK');
