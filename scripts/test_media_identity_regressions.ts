import assert from 'node:assert/strict';
import test from 'node:test';
import { ContentType } from '../types';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { audioPreferenceService } from '../src/core/audio/audioPreferenceService';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';
import { validateSubtitleContentMatch } from '../src/core/subtitles/subtitleLanguageDetector';
import { sameCatalogWork, formatContentItem } from '../src/core/tmdb/tmdbClient';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { streamValidator } from '../src/core/providers/streamValidator';
import { mediaSourceValidationService } from '../src/core/providers/mediaSourceValidationService';
import { mediaAvailabilityIndex } from '../src/core/catalog/MediaAvailabilityIndex';

const item = (title: string, type = ContentType.MOVIE, year = 2002) =>
  ({ id: title, title, type, year, image: '', rating: 0 });

test('metadados não misturam obras de mesmo ID, nome parcial ou ano diferente', () => {
  assert.equal(canonicalIdentityService.isSameWork(item('Sussurros do Coração'), item('The Cazalets', ContentType.SERIES)), false);
  assert.equal(sameCatalogWork(item('Resident Evil', ContentType.MOVIE, 2002), item('Resident Evil', ContentType.MOVIE, 2026)), false);
  assert.equal(canonicalIdentityService.isSameWork(item('Naruto', ContentType.ANIME, 2002), item('Naruto Shippuden', ContentType.ANIME, 2007)), false);
});

test('nome de provedor não transforma outra obra em fonte verificada', () => {
  const identity = canonicalIdentityService.buildIdentity(item('Jimihen!!', ContentType.ANIME, 2021));
  const result = sourceConfidenceEngine.evaluate({
    name: 'Acervo ZapiTV', title: 'Raven of the Inner Palace S01E01',
    url: 'https://example.org/Raven_of_the_Inner_Palace.mp4', providerId: 'fenixflix-animes'
  }, identity);
  assert.equal(result.isMatch, false);
});

test('temporada e episódio diferentes são rejeitados', () => {
  const identity = canonicalIdentityService.buildIdentity(item('Mushoku Tensei', ContentType.ANIME, 2021), { season: 2, episode: 8 });
  assert.equal(sourceConfidenceEngine.evaluate({ title: 'Mushoku Tensei S02E09', url: 'https://example.org/video.mp4' }, identity).isMatch, false);
  assert.equal(sourceConfidenceEngine.evaluate({ title: 'Mushoku Tensei T02 EP08', url: 'https://example.org/video.mp4' }, identity).isMatch, true);
});

test('filme de anime conserva formato de filme e rejeita fonte episódica', () => {
  const film = formatContentItem({ id: 37797, title: 'Sussurros do Coração', original_title: '耳をすませば',
    release_date: '1995-07-15', original_language: 'ja', genre_ids: [16], media_type: 'movie' } as any);
  assert.equal(film.type, ContentType.ANIME);
  assert.equal(film.mediaFormat, 'movie');
  const identity = canonicalIdentityService.buildIdentity({ ...film, type: ContentType.MOVIE });
  assert.equal(sourceConfidenceEngine.evaluate({ title: 'Sussurros do Coração T01 EP01', url: 'https://example.org/video.mp4' }, identity).isMatch, false);
});

test('variante de provedor com obras trocadas é isolada globalmente', () => {
  assert.equal(streamValidator.filterCleanStreams([{ title: 'Resident Evil Dublado 🐉 Malfoy', url: 'https://example.org/video.mp4' }], 'Resident Evil').length, 0);
});

test('addon com título estruturado não troca Naruto por Shippuden', () => {
  const identity = canonicalIdentityService.buildIdentity(item('Naruto', ContentType.ANIME, 2002), { season: 1, episode: 1 });
  assert.equal(sourceConfidenceEngine.evaluate({ title: '🐦‍🔥 Naruto Shippuden\nT01 EP01\nDublado', url: 'https://example.org/video.mp4' }, identity).isMatch, false);
  assert.equal(sourceConfidenceEngine.evaluate({ title: '🐦‍🔥 Naruto\nT01 EP01\nDublado', url: 'https://example.org/video.mp4' }, identity).isMatch, true);
});

test('dublagem exige indicação explícita, não nome do provedor ou legenda', () => {
  assert.equal(audioPreferenceService.analyzeAudio({ providerName: 'Mico-Leão Dublado', title: 'Bleach S01E01 Legendado', isPtBr: true }).isDubbed, false);
  assert.equal(audioPreferenceService.analyzeAudio({ title: 'Mushoku Tensei Dual Audio English Japanese' }).isPtBr, false);
  assert.equal(audioPreferenceService.analyzeAudio({ title: 'Bleach S01E01 Audio Latino Dublado' }).language, 'es');
  assert.equal(audioPreferenceService.analyzeAudio({ title: 'Bleach S01E01 Dublado PT-BR' }).language, 'pt-BR');
  assert.equal(audioSelectionManager.inspectStreamAudioLanguage({ title: 'Bleach S01E01' }, 'ja'), 'unknown');
});

test('legenda com idioma detectado diferente do selecionado é recusada', () => {
  const english = 'The people are here and they will come back when the night is over. Please take the time to see them.';
  assert.equal(validateSubtitleContentMatch(english, 'pob').isValid, false);
  assert.equal(validateSubtitleContentMatch(english, 'spa').isValid, false);
});

test('acervo não contém o vídeo de demonstração atribuído a Bleach ou Doraemon 1979', () => {
  for (const id of ['anime-bleach-tvmeter', 'tmdb-57911']) {
    const entry = VERIFIED_OPEN_ITEMS.find(value => value.id === id);
    assert.ok(entry);
    assert.ok(entry.episodes?.every(episode => !episode.videoUrl));
  }
});

test('acervo não substitui episódio ou temporada inexistente pelo primeiro', async () => {
  for (const provider of providerRegistry.getProviders()) providerRegistry.updateProvider(provider.id, { enabled: false });
  const target = { id: 'tmdb-95897', title: 'Overflow: Transbordando' };
  const first = await providerRegistry.resolveStreams('anime', target, { season: 1, episode: 1 });
  const wrongSeason = await providerRegistry.resolveStreams('anime', target, { season: 2, episode: 1 });
  const wrongEpisode = await providerRegistry.resolveStreams('anime', target, { season: 1, episode: 99 });
  assert.ok(first.length > 0);
  assert.equal(wrongSeason.length, 0);
  assert.equal(wrongEpisode.length, 0);
});

test('falha de uma fonte não invalida fontes alternativas da mesma obra', () => {
  const service = mediaSourceValidationService as any;
  const cache = service.cache as Map<string, any>;
  const first = { mediaId: 'film-a', url: 'https://example.org/a.mp4', availability: 'ready', validationState: 'ready_for_playback' };
  const second = { mediaId: 'film-a', url: 'https://example.org/b.mp4', availability: 'ready', validationState: 'ready_for_playback' };
  cache.set('test-a', first);
  cache.set('test-b', second);
  mediaSourceValidationService.invalidateSource('film-a', first.url, 'Falha temporária');
  assert.equal(first.availability, 'rejected');
  assert.equal(second.availability, 'ready');
  cache.delete('test-a');
  cache.delete('test-b');
});

test('falha real de reprodução invalida disponibilidade antiga sem afirmar indisponibilidade definitiva', () => {
  mediaAvailabilityIndex.markAvailable('test-film', 'movie', { sourceCount: 1, providersChecked: ['test'] });
  mediaAvailabilityIndex.markTemporaryError('test-film', 'movie', 'Falha na reprodução', [], true);
  assert.equal(mediaAvailabilityIndex.getStatus('test-film'), 'TEMPORARY_ERROR');
});
