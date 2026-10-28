import assert from 'node:assert/strict';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { streamValidator } from '../src/core/providers/streamValidator';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { mediaSourceValidationService } from '../src/core/providers/mediaSourceValidationService';
import { playbackOptimizerService, decideTvStallAction } from '../src/core/playback/PlaybackOptimizerService';
import { ContentType, ContentItem } from '../types';
import { StremioStream } from '../src/core/stremio/stremioTypes';

console.log('=== SUÍTE DE TESTES: IDENTIDADE CANÔNICA, BLINDAGEM DE FONTES E RESILIÊNCIA DE REPRODUÇÃO (ZapiTV P0) ===\n');

// ------------------------------------------------------------------------------------------------
// 1. Lupin (2021, série Netflix) vs Lupin III: The First (2019, filme) vs Lupin The Third Part 6
// ------------------------------------------------------------------------------------------------
console.log('Teste 1: Lupin (Série Netflix, 2021) vs Lupin III / Lupin The Third');
const lupinSeriesItem: ContentItem = {
  id: 'tv-96677',
  tmdbId: '96677',
  imdbId: 'tt2531336',
  title: 'Lupin',
  originalTitle: 'Lupin',
  type: ContentType.SERIES,
  year: 2021,
  genres: ['Crime', 'Drama', 'Mystery'],
  image: '',
  rating: 7.5
};
const lupinSeriesIdentity = canonicalIdentityService.buildIdentity(lupinSeriesItem, { season: 1, episode: 1 });

// Fontes incorretas que NUNCA devem ser aceitas para Lupin (Netflix)
const lupin3MovieStream: StremioStream = {
  name: 'Torrentio',
  title: 'Lupin III: The First (2019) 1080p BluRay x264 Dual Audio',
  url: 'https://cdn.example.com/lupin-the-first.mp4'
};
const lupin3SeriesStream: StremioStream = {
  name: 'FenixFlix',
  title: 'Lupin III S01E01 1080p Legendado',
  url: 'https://cdn.example.com/lupin-3-s01e01.mp4'
};
const lupinPart6Stream: StremioStream = {
  name: 'AnimeAddon',
  title: 'Lupin The Third Part 6 S01E01 1080p',
  url: 'https://cdn.example.com/lupin-part-6.mp4'
};
const lupinCagliostroStream: StremioStream = {
  name: 'AnimeFlix',
  title: 'Lupin Sansei: Castle of Cagliostro (1979) 1080p BluRay',
  url: 'https://cdn.example.com/cagliostro.mp4'
};
const lupinConflictingImdbStream: StremioStream = {
  name: 'Torrentio',
  title: 'Lupin 1080p NF WEB-DL',
  imdbId: 'tt11465248', // ID de Lupin III: The First
  url: 'https://cdn.example.com/fake-lupin.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(lupin3MovieStream, lupinSeriesIdentity).isMatch, false, 'Lupin III: The First deve ser rejeitado para série Lupin');
assert.equal(sourceConfidenceEngine.evaluate(lupin3SeriesStream, lupinSeriesIdentity).isMatch, false, 'Lupin III S01E01 deve ser rejeitado para série Lupin');
assert.equal(sourceConfidenceEngine.evaluate(lupinPart6Stream, lupinSeriesIdentity).isMatch, false, 'Lupin The Third Part 6 deve ser rejeitado para série Lupin');
assert.equal(sourceConfidenceEngine.evaluate(lupinCagliostroStream, lupinSeriesIdentity).isMatch, false, 'Castle of Cagliostro deve ser rejeitado para série Lupin');
assert.equal(sourceConfidenceEngine.evaluate(lupinConflictingImdbStream, lupinSeriesIdentity).isMatch, false, 'Fonte com IMDb ID divergente deve ser rejeitada');
assert.equal(streamValidator.isStreamMatchingTargetTitle(lupin3MovieStream, 'Lupin', 'Lupin', [], { season: 1, episode: 1 }), false);

// Fontes legítimas de Lupin (2021) que DEVEM ser aceitas
const legitimateLupinStream1: StremioStream = {
  name: 'FenixFlix',
  title: 'Lupin.S01E01.1080p.NF.WEB-DL.DDP5.1.Atmos.H.264-FLIX',
  url: 'https://cdn.example.com/lupin-s01e01.mp4'
};
const legitimateLupinStream2: StremioStream = {
  name: 'RedeCanais',
  title: 'Lupin 1ª Temporada Episódio 1 Dublado 1080p',
  url: 'https://cdn.example.com/lupin-ep1-dublado.mp4'
};
const legitimateLupinWithImdb: StremioStream = {
  name: 'Torrentio',
  title: 'Lupin S01E01 1080p NF WEB-DL',
  imdbId: 'tt2531336',
  url: 'https://cdn.example.com/lupin-tt2531336.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(legitimateLupinStream1, lupinSeriesIdentity).isMatch, true, 'Lupin S01E01 legítimo deve ser aceito');
assert.equal(sourceConfidenceEngine.evaluate(legitimateLupinStream2, lupinSeriesIdentity).isMatch, true, 'Lupin dublado em PT-BR legítimo deve ser aceito');
assert.equal(sourceConfidenceEngine.evaluate(legitimateLupinWithImdb, lupinSeriesIdentity).isMatch, true, 'Lupin com IMDb ID coincidente deve ser aceito');

// Recíproco: Alvo Lupin III (Anime) aceita fontes Lupin III e rejeita série francesa
const lupin3MovieItem: ContentItem = {
  id: 'movie-638134',
  tmdbId: '638134',
  imdbId: 'tt11465248',
  title: 'Lupin III: The First',
  originalTitle: 'Rupan Sansei: The First',
  type: ContentType.MOVIE,
  year: 2019,
  genres: ['Animation', 'Action', 'Adventure'],
  image: '',
  rating: 6.8
};
const lupin3Identity = canonicalIdentityService.buildIdentity(lupin3MovieItem);
assert.equal(sourceConfidenceEngine.evaluate(lupin3MovieStream, lupin3Identity).isMatch, true, 'Lupin III: The First deve ser aceito para seu próprio item');
assert.equal(sourceConfidenceEngine.evaluate(legitimateLupinStream1, lupin3Identity).isMatch, false, 'Série francesa Lupin não deve ser aceita para filme Lupin III');
console.log('  ✓ Teste 1 passou: Lupin e Lupin III completamente isolados e bidirecionalmente protegidos.\n');

// ------------------------------------------------------------------------------------------------
// 2. Resident Evil (2026, live-action Zach Cregger) vs animações Resident Evil
// ------------------------------------------------------------------------------------------------
console.log('Teste 2: Resident Evil (2026, Live-Action) vs Animações Resident Evil');
const residentEvil2026Item: ContentItem = {
  id: 'movie-re-2026',
  title: 'Resident Evil',
  originalTitle: 'Resident Evil',
  type: ContentType.MOVIE,
  year: 2026,
  genres: ['Horror', 'Action', 'Sci-Fi'],
  image: '',
  rating: 0
};
const re2026Identity = canonicalIdentityService.buildIdentity(residentEvil2026Item);

const reAnimationDeathIsland: StremioStream = {
  name: 'Addon',
  title: 'Resident Evil: Death Island (2023) 1080p BluRay Dual Áudio',
  url: 'https://cdn.example.com/re-death-island.mp4'
};
const reAnimationDegeneration: StremioStream = {
  name: 'Addon',
  title: 'Resident Evil: Degeneration (2008) 1080p BluRay',
  url: 'https://cdn.example.com/re-degeneration.mp4'
};
const reInfiniteDarkness: StremioStream = {
  name: 'Addon',
  title: 'Resident Evil: Infinite Darkness S01E01 1080p',
  url: 'https://cdn.example.com/re-infinite-darkness.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(reAnimationDeathIsland, re2026Identity).isMatch, false, 'Death Island (2023) rejeitado para RE 2026');
assert.equal(sourceConfidenceEngine.evaluate(reAnimationDegeneration, re2026Identity).isMatch, false, 'Degeneration (2008) rejeitado para RE 2026');
assert.equal(sourceConfidenceEngine.evaluate(reInfiniteDarkness, re2026Identity).isMatch, false, 'Infinite Darkness rejeitado para RE 2026');

// Validação de isolamento estrito entre filmes diferentes da franquia Resident Evil (sem ano no título do release)
const re2002Item: ContentItem = {
  id: 'movie-re-2002',
  title: 'Resident Evil: O Hóspede Maldito',
  originalTitle: 'Resident Evil',
  type: ContentType.MOVIE,
  year: 2002,
  genres: ['Horror', 'Action'],
  image: '',
  rating: 6.7
};
const re2002Identity = canonicalIdentityService.buildIdentity(re2002Item);

const reApocalypseNoYear: StremioStream = {
  name: 'Addon',
  title: 'Resident Evil Apocalypse 1080p Dual Audio.mkv',
  url: 'https://cdn.example.com/re-apocalypse.mp4'
};
const reExtinctionNoYear: StremioStream = {
  name: 'Addon',
  title: 'Resident Evil Extinction 1080p Dual Audio.mkv',
  url: 'https://cdn.example.com/re-extinction.mp4'
};
const reWelcomeRaccoonCity: StremioStream = {
  name: 'Addon',
  title: 'Resident Evil: Welcome to Raccoon City 1080p.mkv',
  url: 'https://cdn.example.com/re-raccoon.mp4'
};
const re2002LegitStream: StremioStream = {
  name: 'Addon',
  title: 'Resident Evil (2002) 1080p BluRay Dual Audio.mkv',
  url: 'https://cdn.example.com/re-2002.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(reApocalypseNoYear, re2002Identity).isMatch, false, 'Apocalypse deve ser rejeitado para Resident Evil 2002');
assert.equal(sourceConfidenceEngine.evaluate(reExtinctionNoYear, re2002Identity).isMatch, false, 'Extinction deve ser rejeitado para Resident Evil 2002');
assert.equal(sourceConfidenceEngine.evaluate(reWelcomeRaccoonCity, re2002Identity).isMatch, false, 'Welcome to Raccoon City deve ser rejeitado para Resident Evil 2002');
assert.equal(sourceConfidenceEngine.evaluate(re2002LegitStream, re2002Identity).isMatch, true, 'Resident Evil 2002 legítimo deve ser aceito');

console.log('  ✓ Teste 2 passou: Animações e filmes diferentes da franquia Resident Evil devidamente isolados.\n');

// ------------------------------------------------------------------------------------------------
// 3. Chicago Typewriter vs Chicago (filme 2002)
// ------------------------------------------------------------------------------------------------
console.log('Teste 3: Chicago Typewriter vs Chicago (2002)');
const ctItem: ContentItem = {
  id: 'tv-70528',
  title: 'Chicago Typewriter',
  originalTitle: 'Sikago Tajagi',
  type: ContentType.SERIES,
  year: 2017,
  genres: ['Drama'],
  image: '',
  rating: 8.3
};
const ctIdentity = canonicalIdentityService.buildIdentity(ctItem, { season: 1, episode: 1 });
const chicagoMovieStream: StremioStream = {
  name: 'Addon',
  title: 'Chicago (2002) 1080p BluRay x264 Dublado',
  url: 'https://cdn.example.com/chicago-2002.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(chicagoMovieStream, ctIdentity).isMatch, false);
console.log('  ✓ Teste 3 passou: Filme Chicago rejeitado para Chicago Typewriter.\n');

// ------------------------------------------------------------------------------------------------
// 4. Naruto vs Naruto Shippuden vs Boruto
// ------------------------------------------------------------------------------------------------
console.log('Teste 4: Naruto vs Naruto Shippuden vs Boruto');
const narutoClassicItem: ContentItem = {
  id: 'anime-naruto',
  title: 'Naruto',
  originalTitle: 'Naruto',
  type: ContentType.ANIME,
  year: 2002,
  genres: ['Animation', 'Action'],
  image: '',
  rating: 8.4
};
const narutoClassicIdentity = canonicalIdentityService.buildIdentity(narutoClassicItem, { season: 1, episode: 1 });

const narutoShippudenStream: StremioStream = {
  name: 'Addon',
  title: 'Naruto Shippuden S01E01 1080p Dual Áudio',
  url: 'https://cdn.example.com/shippuden-e1.mp4'
};
const borutoStream: StremioStream = {
  name: 'Addon',
  title: 'Boruto: Naruto Next Generations S01E01 1080p',
  url: 'https://cdn.example.com/boruto-e1.mp4'
};
const narutoClassicStream: StremioStream = {
  name: 'Addon',
  title: 'Naruto S01E01 1080p Dublado Clássico',
  url: 'https://cdn.example.com/naruto-e1.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(narutoShippudenStream, narutoClassicIdentity).isMatch, false, 'Shippuden rejeitado para Naruto clássico');
assert.equal(sourceConfidenceEngine.evaluate(borutoStream, narutoClassicIdentity).isMatch, false, 'Boruto rejeitado para Naruto clássico');
assert.equal(sourceConfidenceEngine.evaluate(narutoClassicStream, narutoClassicIdentity).isMatch, true, 'Naruto clássico aceito');

// Recíproco: Alvo Naruto Shippuden
const narutoShippudenItem: ContentItem = {
  id: 'anime-naruto-shippuden',
  title: 'Naruto: Shippuden',
  originalTitle: 'Naruto: Shippuuden',
  type: ContentType.ANIME,
  year: 2007,
  genres: ['Animation', 'Action'],
  image: '',
  rating: 8.7
};
const shippudenIdentity = canonicalIdentityService.buildIdentity(narutoShippudenItem, { season: 1, episode: 1 });
assert.equal(sourceConfidenceEngine.evaluate(narutoShippudenStream, shippudenIdentity).isMatch, true, 'Shippuden aceita fontes Shippuden');
assert.equal(sourceConfidenceEngine.evaluate(narutoClassicStream, shippudenIdentity).isMatch, false, 'Shippuden rejeita Naruto clássico');
console.log('  ✓ Teste 4 passou: Naruto, Naruto Shippuden e Boruto devidamente discriminados.\n');

// ------------------------------------------------------------------------------------------------
// 5. Sword Art Online (T1) vs SAO II vs Ordinal Scale vs Alicization
// ------------------------------------------------------------------------------------------------
console.log('Teste 5: Sword Art Online (T1) vs SAO II vs Ordinal Scale vs Alicization');
const saoT1Item: ContentItem = {
  id: 'anime-sao',
  title: 'Sword Art Online',
  originalTitle: 'Sword Art Online',
  type: ContentType.ANIME,
  year: 2012,
  genres: ['Animation', 'Sci-Fi'],
  image: '',
  rating: 7.6
};
const saoT1Identity = canonicalIdentityService.buildIdentity(saoT1Item, { season: 1, episode: 1 });

const sao2Stream: StremioStream = {
  name: 'Addon',
  title: 'Sword Art Online II S01E01 1080p Dual Áudio',
  url: 'https://cdn.example.com/sao-2.mp4'
};
const saoOrdinalScaleStream: StremioStream = {
  name: 'Addon',
  title: 'Sword Art Online The Movie: Ordinal Scale (2017) 1080p',
  url: 'https://cdn.example.com/sao-movie.mp4'
};
const saoAlicizationStream: StremioStream = {
  name: 'Addon',
  title: 'Sword Art Online: Alicization S01E01 1080p',
  url: 'https://cdn.example.com/sao-alicization.mp4'
};
const saoLegitimateT1: StremioStream = {
  name: 'Addon',
  title: 'Sword Art Online S01E01 1080p Dual Áudio',
  url: 'https://cdn.example.com/sao-t1.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(sao2Stream, saoT1Identity).isMatch, false, 'SAO II rejeitado para SAO T1');
assert.equal(sourceConfidenceEngine.evaluate(saoOrdinalScaleStream, saoT1Identity).isMatch, false, 'SAO Ordinal Scale rejeitado para SAO T1');
assert.equal(sourceConfidenceEngine.evaluate(saoAlicizationStream, saoT1Identity).isMatch, false, 'SAO Alicization rejeitado para SAO T1');
assert.equal(sourceConfidenceEngine.evaluate(saoLegitimateT1, saoT1Identity).isMatch, true, 'SAO T1 legítimo aceito');
console.log('  ✓ Teste 5 passou: SAO T1 blindado contra SAO II, filmes e sequências derivadas.\n');

// ------------------------------------------------------------------------------------------------
// 6. Sussurros do Coração vs The Cazalets
// ------------------------------------------------------------------------------------------------
console.log('Teste 6: Sussurros do Coração vs The Cazalets');
const whisperItem: ContentItem = {
  id: 'movie-whisper',
  title: 'Sussurros do Coração',
  originalTitle: 'Mimi wo Sumaseba',
  type: ContentType.ANIME,
  year: 1995,
  genres: ['Animation', 'Drama'],
  image: '',
  rating: 7.9
};
const whisperIdentity = canonicalIdentityService.buildIdentity(whisperItem);

const cazaletsStream: StremioStream = {
  name: 'Addon',
  title: 'The Cazalets S01E01 1080p',
  url: 'https://cdn.example.com/cazalets.mp4'
};
const whisperLegitStream: StremioStream = {
  name: 'Addon',
  title: 'Whisper of the Heart (1995) 1080p BluRay Dual Áudio',
  url: 'https://cdn.example.com/whisper-1995.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(cazaletsStream, whisperIdentity).isMatch, false, 'The Cazalets rejeitado para Sussurros do Coração');
assert.equal(sourceConfidenceEngine.evaluate(whisperLegitStream, whisperIdentity).isMatch, true, 'Whisper of the Heart (1995) aceito');
console.log('  ✓ Teste 6 passou: Sussurros do Coração e The Cazalets devidamente isolados.\n');

// ------------------------------------------------------------------------------------------------
// 7. Jimihen!! vs Raven of the Inner Palace (Koukyuu no Karasu)
// ------------------------------------------------------------------------------------------------
console.log('Teste 7: Jimihen!! vs Raven of the Inner Palace (Koukyuu no Karasu)');
const jimihenItem: ContentItem = {
  id: 'anime-jimihen',
  title: 'Jimihen!! Pure Cimina: Ikimasho',
  originalTitle: 'Jimihen!!',
  type: ContentType.ANIME,
  year: 2021,
  genres: ['Animation'],
  image: '',
  rating: 6.0
};
const jimihenIdentity = canonicalIdentityService.buildIdentity(jimihenItem, { season: 1, episode: 1 });

const ravenStream: StremioStream = {
  name: 'Addon',
  title: 'Raven of the Inner Palace S01E01 1080p',
  url: 'https://cdn.example.com/raven.mp4'
};
const koukyuuStream: StremioStream = {
  name: 'Addon',
  title: 'Koukyuu no Karasu S01E01 1080p',
  url: 'https://cdn.example.com/koukyuu.mp4'
};
const jimihenLegitStream: StremioStream = {
  name: 'Addon',
  title: 'Jimihen!! S01E01 1080p',
  url: 'https://cdn.example.com/jimihen.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(ravenStream, jimihenIdentity).isMatch, false, 'Raven of the Inner Palace rejeitado para Jimihen');
assert.equal(sourceConfidenceEngine.evaluate(koukyuuStream, jimihenIdentity).isMatch, false, 'Koukyuu no Karasu rejeitado para Jimihen');
assert.equal(sourceConfidenceEngine.evaluate(jimihenLegitStream, jimihenIdentity).isMatch, true, 'Jimihen S01E01 aceito');
console.log('  ✓ Teste 7 passou: Jimihen e Raven of the Inner Palace colisão prevenida.\n');

// ------------------------------------------------------------------------------------------------
// 8. Filmes vs séries com o mesmo título (Fargo 1996 vs Fargo 2014)
// ------------------------------------------------------------------------------------------------
console.log('Teste 8: Filmes vs Séries com mesmo título (Fargo 1996 vs Fargo 2014)');
const fargoSeriesItem: ContentItem = {
  id: 'tv-60622',
  title: 'Fargo',
  originalTitle: 'Fargo',
  type: ContentType.SERIES,
  year: 2014,
  genres: ['Crime', 'Drama'],
  image: '',
  rating: 8.9
};
const fargoSeriesIdentity = canonicalIdentityService.buildIdentity(fargoSeriesItem, { season: 1, episode: 1 });

const fargoMovieItem: ContentItem = {
  id: 'movie-275',
  title: 'Fargo',
  originalTitle: 'Fargo',
  type: ContentType.MOVIE,
  year: 1996,
  genres: ['Crime', 'Drama'],
  image: '',
  rating: 8.1
};
const fargoMovieIdentity = canonicalIdentityService.buildIdentity(fargoMovieItem);

const fargo1996MovieStream: StremioStream = {
  name: 'Addon',
  title: 'Fargo (1996) 1080p BluRay x264',
  url: 'https://cdn.example.com/fargo-1996.mp4'
};
const fargo2014SeriesStream: StremioStream = {
  name: 'Addon',
  title: 'Fargo.S01E01.1080p.HDTV.x264',
  url: 'https://cdn.example.com/fargo-s01e01.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(fargo1996MovieStream, fargoSeriesIdentity).isMatch, false, 'Filme 1996 rejeitado para série Fargo');
assert.equal(sourceConfidenceEngine.evaluate(fargo2014SeriesStream, fargoSeriesIdentity).isMatch, true, 'Episódio S01E01 aceito para série Fargo');
assert.equal(sourceConfidenceEngine.evaluate(fargo2014SeriesStream, fargoMovieIdentity).isMatch, false, 'Episódio de série rejeitado para filme Fargo');
assert.equal(sourceConfidenceEngine.evaluate(fargo1996MovieStream, fargoMovieIdentity).isMatch, true, 'Filme 1996 aceito para filme Fargo');
console.log('  ✓ Teste 8 passou: Fargo filme e série completamente diferenciados.\n');

// ------------------------------------------------------------------------------------------------
// 9. Remakes com anos diferentes (Total Recall 1990 vs 2012)
// ------------------------------------------------------------------------------------------------
console.log('Teste 9: Remakes com anos diferentes (Total Recall 1990 vs 2012)');
const totalRecall1990Item: ContentItem = {
  id: 'movie-861',
  title: 'Total Recall',
  originalTitle: 'Total Recall',
  type: ContentType.MOVIE,
  year: 1990,
  genres: ['Action', 'Sci-Fi'],
  image: '',
  rating: 7.5
};
const tr1990Identity = canonicalIdentityService.buildIdentity(totalRecall1990Item);

const totalRecall2012Item: ContentItem = {
  id: 'movie-64635',
  title: 'Total Recall',
  originalTitle: 'Total Recall',
  type: ContentType.MOVIE,
  year: 2012,
  genres: ['Action', 'Sci-Fi'],
  image: '',
  rating: 6.3
};
const tr2012Identity = canonicalIdentityService.buildIdentity(totalRecall2012Item);

const tr1990Stream: StremioStream = {
  name: 'Addon',
  title: 'Total Recall (1990) 1080p Remastered BluRay',
  url: 'https://cdn.example.com/tr-1990.mp4'
};
const tr2012Stream: StremioStream = {
  name: 'Addon',
  title: 'Total Recall (2012) Extended Cut 1080p BluRay',
  url: 'https://cdn.example.com/tr-2012.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(tr2012Stream, tr1990Identity).isMatch, false, 'Remake 2012 rejeitado para original 1990');
assert.equal(sourceConfidenceEngine.evaluate(tr1990Stream, tr1990Identity).isMatch, true, 'Original 1990 aceito para 1990');
assert.equal(sourceConfidenceEngine.evaluate(tr1990Stream, tr2012Identity).isMatch, false, 'Original 1990 rejeitado para remake 2012');
assert.equal(sourceConfidenceEngine.evaluate(tr2012Stream, tr2012Identity).isMatch, true, 'Remake 2012 aceito para 2012');
console.log('  ✓ Teste 9 passou: Remakes separados estritamente por ano.\n');

// ------------------------------------------------------------------------------------------------
// 10. Episódios de temporadas diferentes (S01E01 vs S02E01 vs S01E02)
// ------------------------------------------------------------------------------------------------
console.log('Teste 10: Temporadas e episódios divergentes');
const s1e1Identity = canonicalIdentityService.buildIdentity(lupinSeriesItem, { season: 1, episode: 1 });
const s2e1Identity = canonicalIdentityService.buildIdentity(lupinSeriesItem, { season: 2, episode: 1 });

const s1e1Stream: StremioStream = {
  name: 'Addon',
  title: 'Lupin S01E01 1080p',
  url: 'https://cdn.example.com/s01e01.mp4'
};
const s2e1Stream: StremioStream = {
  name: 'Addon',
  title: 'Lupin S02E01 1080p',
  url: 'https://cdn.example.com/s02e01.mp4'
};
const s1e2Stream: StremioStream = {
  name: 'Addon',
  title: 'Lupin S01E02 1080p',
  url: 'https://cdn.example.com/s01e02.mp4'
};

assert.equal(sourceConfidenceEngine.evaluate(s1e1Stream, s1e1Identity).isMatch, true);
assert.equal(sourceConfidenceEngine.evaluate(s2e1Stream, s1e1Identity).isMatch, false, 'S02E01 rejeitado para pedido S01E01');
assert.equal(sourceConfidenceEngine.evaluate(s1e2Stream, s1e1Identity).isMatch, false, 'S01E02 rejeitado para pedido S01E01');
assert.equal(sourceConfidenceEngine.evaluate(s2e1Stream, s2e1Identity).isMatch, true, 'S02E01 aceito para pedido S02E01');
assert.equal(sourceConfidenceEngine.evaluate(s1e1Stream, s2e1Identity).isMatch, false, 'S01E01 rejeitado para pedido S02E01');
console.log('  ✓ Teste 10 passou: Temporadas e episódios não se misturam.\n');

// ------------------------------------------------------------------------------------------------
// 11. Metadados conflitantes e fontes vazias
// ------------------------------------------------------------------------------------------------
console.log('Teste 11: Metadados conflitantes e proteção contra fontes vazias');
const emptyStream: StremioStream = {
  url: 'https://cdn.example.com/video.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(emptyStream, lupinSeriesIdentity).isMatch, false, 'Stream sem metadados deve ser rejeitado');

const conflictingImdb: StremioStream = {
  name: 'Test',
  title: 'Lupin S01E01 1080p',
  imdbId: 'tt9999999', // Não bate com tt2531336
  url: 'https://cdn.example.com/test.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(conflictingImdb, lupinSeriesIdentity).isMatch, false, 'Stream com IMDb discordante deve ser rejeitado');

const conflictingTmdb: StremioStream = {
  name: 'Test',
  title: 'Lupin S01E01 1080p',
  tmdbId: 88888, // Não bate com 96677
  url: 'https://cdn.example.com/test.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(conflictingTmdb, lupinSeriesIdentity).isMatch, false, 'Stream com TMDB discordante deve ser rejeitado');
console.log('  ✓ Teste 11 passou: Fontes com IDs conflitantes ou sem metadados rejeitadas.\n');

// ------------------------------------------------------------------------------------------------
// 12. Ranqueamento, Cache e Fallback protegidos por Identidade Canônica
// ------------------------------------------------------------------------------------------------
console.log('Teste 12: Ranqueamento, Cache e Fallback protegidos por Identidade Canônica');
const mixedLupinCandidates: StremioStream[] = [
  lupin3MovieStream,
  lupin3SeriesStream,
  legitimateLupinStream1,
  lupinPart6Stream,
  legitimateLupinStream2
];

// O ranqueamento deve eliminar todas as fontes de Lupin III / Part 6
const rankedLupin = sourceSelectionService.rankStreams(mixedLupinCandidates, {
  hasExternalPtSub: false,
  preferDubbed: true,
  identity: lupinSeriesIdentity
});
assert.equal(rankedLupin.length, 2, 'Apenas as 2 fontes legítimas de Lupin devem ser ranqueadas');
assert.ok(rankedLupin.every(s => s.title && s.title.includes('Lupin') && !s.title.includes('III') && !s.title.includes('Part 6')));

// Pool de fallback deve ser estritamente canônico
const safeFallback = mixedLupinCandidates.filter(s => sourceConfidenceEngine.evaluate(s, lupinSeriesIdentity).isMatch);
assert.equal(safeFallback.length, 2);

// O MediaSourceValidationService rejeita e isola fontes com conflito canônico
const validationLupinValid = await mediaSourceValidationService.validateSource(legitimateLupinStream1, {
  mediaId: 'tv-96677',
  mediaTitle: 'Lupin',
  mediaType: 'series',
  season: 1,
  episode: 1,
  canonicalIdentity: lupinSeriesIdentity
});
assert.notEqual(validationLupinValid.availability, 'rejected', 'Fonte legítima não pode ser rejeitada por identidade');

const validationLupinInvalid = await mediaSourceValidationService.validateSource(lupin3MovieStream, {
  mediaId: 'tv-96677',
  mediaTitle: 'Lupin',
  mediaType: 'series',
  season: 1,
  episode: 1,
  canonicalIdentity: lupinSeriesIdentity
});
assert.equal(validationLupinInvalid.availability, 'rejected', 'Fonte colidente Lupin III deve ser rejeitada');
assert.equal(validationLupinInvalid.validationState, 'rejected');

console.log('  ✓ Teste 12 passou: Ranqueamento, pool de fallback e cache estritamente blindados.\n');

// ------------------------------------------------------------------------------------------------
// 13. Resiliência de Reprodução e Otimizador de Playback
// ------------------------------------------------------------------------------------------------
console.log('Teste 13: Resiliência de Reprodução, Stalls e Preservação de Posição');

// Teste de política de stalls na Smart TV
const stallWait = decideTvStallAction({
  elapsedMs: 5000,
  sinceProgressMs: 2000,
  bufferAheadSeconds: 0,
  recoveryAttempted: false,
  online: true
});
assert.equal(stallWait, 'wait', 'Stall curto sob 12s deve aguardar');

const stallRecover = decideTvStallAction({
  elapsedMs: 15000,
  sinceProgressMs: 10000,
  bufferAheadSeconds: 3,
  recoveryAttempted: false,
  online: true
});
assert.equal(stallRecover, 'recover', 'Stall com buffer deve acionar recuperação');

const stallFallback = decideTvStallAction({
  elapsedMs: 46000,
  sinceProgressMs: 20000,
  bufferAheadSeconds: 0,
  recoveryAttempted: true,
  online: true
});
assert.equal(stallFallback, 'fallback', 'Stall severo acima do limite deve acionar fallback para outra fonte');

// Teste de ABR Dinâmico com Downgrade Rápido em Buffer Crítico
const abrDecision = playbackOptimizerService.evaluateMultiSourceAbr({
  availableQualities: ['1080p', '720p', '480p'],
  currentQuality: '1080p',
  bufferAheadSeconds: 1.2,
  isStalling: true
});
assert.equal(abrDecision.shouldChange, true, 'Deve acionar downgrade de qualidade');
assert.equal(abrDecision.targetQuality, '720p', 'Deve reduzir para a próxima qualidade inferior');

// Teste de Telemetria e Recuperação de Stalls
playbackOptimizerService.notifyLoadStart('hls');
playbackOptimizerService.notifyFirstFrame();
playbackOptimizerService.notifyBufferingStart();
playbackOptimizerService.notifyBufferingEnd();
playbackOptimizerService.recordStallRecovered();

const telemetria = playbackOptimizerService.getTelemetry();
assert.equal(telemetria.stallsRecovered, 1, 'Contador de stalls recuperados deve ser 1');
assert.equal(telemetria.streamSourceType, 'hls');

console.log('  ✓ Teste 13 passou: Recuperação de stalls e ABR adaptativo validados com sucesso.\n');

// ------------------------------------------------------------------------------------------------
// 14. Bleach: Thousand-Year Blood War (T1E1) — Dupla numeração de cena e áudio japonês original
// ------------------------------------------------------------------------------------------------
console.log('Teste 14: Bleach: Thousand-Year Blood War (T1E1) — Dupla numeração e áudio legítimo');
const bleachItem: ContentItem = {
  id: 'anime-bleach-tybw',
  title: 'Bleach: Thousand-Year Blood War',
  originalTitle: 'Bleach: Sennen Kessen-hen',
  type: ContentType.ANIME,
  year: 2022,
  originalLanguage: 'ja',
  genres: ['Anime', 'Action', 'Supernatural'],
  image: '',
  rating: 9.1
};
const bleachIdentity = canonicalIdentityService.buildIdentity(bleachItem, { season: 1, episode: 1 });

const bleachAlfaHdStream: StremioStream = {
  name: 'NyaaSi',
  title: '[alfaHD] Bleach Sennen Kessen-hen S01E01 ( Bleach S17E01 - (367) ) 1080p DSNP WEB-DL AAC 2.0 x264 Multi-Subs (Thousand-Year Blood War) [EN][PT-BR][ES-LA] [F7298272]',
  url: 'https://cdn.example.com/bleach-alfahd.mkv'
};
const bleachLegacyMovie: StremioStream = {
  name: 'Torrentio',
  title: 'Bleach: Memories of Nobody (2006) 1080p BluRay',
  url: 'https://cdn.example.com/bleach-movie.mp4'
};
const bleachOldEpisodeRemaster: StremioStream = {
  name: 'Torrentio',
  title: 'Bleach 367 Remaster 1080p.mkv',
  url: 'https://cdn.example.com/bleach-367.mkv'
};

assert.equal(streamValidator.isStreamMatchingEpisode(bleachAlfaHdStream, { season: 1, episode: 1 }), true, 'Bleach S01E01 com dupla tag S17E01 deve ser aceito');
assert.equal(sourceConfidenceEngine.evaluate(bleachAlfaHdStream, bleachIdentity).isMatch, true, 'Bleach AlfaHD legítimo deve ser aceito por identidade');
assert.equal(sourceConfidenceEngine.evaluate(bleachLegacyMovie, bleachIdentity).isMatch, false, 'Filme antigo de Bleach deve ser rejeitado para TYBW');
assert.equal(sourceConfidenceEngine.evaluate(bleachOldEpisodeRemaster, bleachIdentity).isMatch, false, 'Remaster episódio 367 deve ser rejeitado para TYBW');

console.log('  ✓ Teste 14 passou: Bleach TYBW aceita streams com dupla tag S01/S17 e rejeita filmes antigos.\n');

console.log('========================================================================================');
console.log('=== TODOS OS TESTES DE IDENTIDADE CANÔNICA, PROTEÇÃO E RESILIÊNCIA PASSARAM COM 100%! ===');
console.log('========================================================================================\n');
process.exit(0);
