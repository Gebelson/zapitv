import { test, expect } from 'vitest';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { analyzeStreamSubtitleFormat } from '../src/core/subtitles/streamSubtitleDetector';
import { subtitlePreferenceService } from '../src/core/subtitles/subtitlePreferenceService';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';

test('A Odisseia: disponibilidade, áudio e legendas sem afirmações falsas', () => {
  const odyssey = FEATURED_CATALOG_ITEMS.find(item => item.id === 'movie-a-odisseia-2026');
  expect(odyssey).toBeDefined();
  expect(odyssey?.availabilityStatus).not.toBe('verified');
  expect(odyssey?.audioStatus).not.toBe('pt-br-dubbed');
  expect(odyssey?.verifiedStreams?.length ?? 0).toBe(0);

  const spanishHardsub = { name: 'Provedor', title: 'The Odyssey PT-BR audio • Hardsub Español', url: 'https://example.org/film.mp4' };
  expect(analyzeStreamSubtitleFormat(spanishHardsub).format).toBe('hardsub_foreign');
  expect(subtitlePreferenceService.analyzeSubtitles(spanishHardsub).hasPtSubtitle).toBe(false);

  const ambiguousHardsub = { name: 'Provedor', title: 'The Odyssey Hardsub', url: 'https://example.org/film.mp4' };
  expect(analyzeStreamSubtitleFormat(ambiguousHardsub).format).not.toBe('hardsub_ptbr');
  expect(subtitlePreferenceService.analyzeSubtitles(ambiguousHardsub).hasPtSubtitle).toBe(false);

  const portugueseHardsub = { name: 'Provedor', title: 'The Odyssey Hardsub PT-BR', url: 'https://example.org/film.mp4' };
  expect(analyzeStreamSubtitleFormat(portugueseHardsub).format).toBe('hardsub_ptbr');
  expect(subtitlePreferenceService.analyzeSubtitles(portugueseHardsub).hasPtSubtitle).toBe(true);

  const audioOptions = audioSelectionManager.buildAudioOptions({
    item: odyssey!,
    streams: [ambiguousHardsub],
    hlsTracks: [],
    currentStreamIndex: 0,
    activeAudioId: null
  });
  expect(audioOptions[0]?.langCode).toBe('other');
});
