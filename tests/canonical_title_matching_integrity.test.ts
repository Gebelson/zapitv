import assert from 'node:assert/strict';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { streamValidator } from '../src/core/providers/streamValidator';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { ContentType, ContentItem } from '../types';
import { StremioStream } from '../src/core/stremio/stremioTypes';

console.log('--- Início dos Testes: Integridade Canônica e Correspondência Estrita de Títulos (ZapiTV) ---\n');

// Objeto de teste: Chicago Typewriter (Série, 2017)
const chicagoTypewriterItem: ContentItem = {
  id: 'tv-70528',
  tmdbId: '70528',
  imdbId: 'tt6516076',
  title: 'Chicago Typewriter',
  originalTitle: 'Sikago Tajagi',
  type: ContentType.SERIES,
  year: 2017,
  genres: ['Drama', 'Romance', 'Fantasy'],
  image: '',
  rating: 8.3
};

const chicagoTypewriterIdentity = canonicalIdentityService.buildIdentity(chicagoTypewriterItem, { season: 1, episode: 1 });

// Objeto de teste: Chicago (Filme, 2002)
const chicagoMovieItem: ContentItem = {
  id: 'movie-1574',
  tmdbId: '1574',
  imdbId: 'tt0299658',
  title: 'Chicago',
  originalTitle: 'Chicago',
  type: ContentType.MOVIE,
  year: 2002,
  genres: ['Comedy', 'Crime', 'Musical'],
  image: '',
  rating: 7.2
};

const chicagoMovieIdentity = canonicalIdentityService.buildIdentity(chicagoMovieItem);

// Cenário 1: Chicago Typewriter (2017) → aceita fonte da série correta
console.log('Cenário 1: Chicago Typewriter (2017) aceita fonte legítima da série');
const validTypewriterStream: StremioStream = {
  name: 'FenixFlix',
  title: 'Chicago.Typewriter.S01E01.1080p.NF.WEB-DL.DDP2.0.x264',
  url: 'https://cdn.example.com/chicago-typewriter-s01e01.mp4'
};
const eval1 = sourceConfidenceEngine.evaluate(validTypewriterStream, chicagoTypewriterIdentity);
assert.equal(eval1.isMatch, true, 'Fonte correta de Chicago Typewriter deve ser aceita');
assert.ok(eval1.confidence === 'PROVISIONAL' || eval1.confidence === 'VERIFIED');
assert.ok(streamValidator.isStreamMatchingTargetTitle(validTypewriterStream, 'Chicago Typewriter', 'Sikago Tajagi', [], { season: 1, episode: 1 }));
console.log('  ✓ Cenário 1 passou: Série Chicago Typewriter aprovada.');

// Cenário 2: Chicago Typewriter → filme Chicago (2002) REJEITADO
console.log('\nCenário 2: Chicago Typewriter REJEITA terminantemente o filme Chicago (2002)');
const movieChicagoStream: StremioStream = {
  name: 'FenixFlix',
  title: 'Chicago (2002) 1080p BluRay x264 Dublado',
  url: 'https://cdn.example.com/chicago-2002.mp4'
};
const eval2 = sourceConfidenceEngine.evaluate(movieChicagoStream, chicagoTypewriterIdentity);
assert.equal(eval2.isMatch, false, 'Filme Chicago não pode corresponder à série Chicago Typewriter');
assert.equal(eval2.confidence, 'REJECTED');
assert.equal(
  streamValidator.isStreamMatchingTargetTitle(movieChicagoStream, 'Chicago Typewriter', 'Sikago Tajagi', [], { season: 1, episode: 1 }),
  false,
  'StreamValidator deve reprovar filme Chicago para requisição de Chicago Typewriter'
);
console.log('  ✓ Cenário 2 passou: Filme Chicago de 2002 rejeitado para Chicago Typewriter.');

// Cenário 3: Chicago (2002) → aceita fonte do filme correto
console.log('\nCenário 3: Chicago (2002) aceita fonte correta do filme');
const eval3 = sourceConfidenceEngine.evaluate(movieChicagoStream, chicagoMovieIdentity);
assert.equal(eval3.isMatch, true, 'Filme Chicago (2002) deve aceitar fonte correta de Chicago');
assert.ok(streamValidator.isStreamMatchingTargetTitle(movieChicagoStream, 'Chicago', 'Chicago'));
console.log('  ✓ Cenário 3 passou: Filme Chicago aceita fonte legítima.');

// Cenário 4: Filme Chicago → episódio de Chicago Typewriter REJEITADO
console.log('\nCenário 4: Filme Chicago REJEITA episódio de Chicago Typewriter');
const eval4 = sourceConfidenceEngine.evaluate(validTypewriterStream, chicagoMovieIdentity);
assert.equal(eval4.isMatch, false, 'Filme Chicago não pode aceitar episódio de Chicago Typewriter');
assert.equal(eval4.confidence, 'REJECTED');
console.log('  ✓ Cenário 4 passou: Episódio de série rejeitado para o filme.');

// Cenário 5: Títulos com uma palavra em comum (Spider-Man vs Iron Man / House of the Dragon vs Dragon Ball)
console.log('\nCenário 5: Rejeição de obras diferentes que compartilham apenas uma palavra');
const spiderManIdentity = canonicalIdentityService.buildIdentity({
  id: 'movie-557', title: 'Spider-Man', type: ContentType.MOVIE, year: 2002, genres: ['Action'], image: '', rating: 7.4
});
const ironManStream: StremioStream = {
  name: 'Addon', title: 'Iron Man (2008) 1080p BluRay', url: 'https://cdn.example.com/iron-man.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(ironManStream, spiderManIdentity).isMatch, false);

const houseOfDragonIdentity = canonicalIdentityService.buildIdentity({
  id: 'tv-94997', title: 'House of the Dragon', originalTitle: 'House of the Dragon', type: ContentType.SERIES, year: 2022, genres: ['Drama'], image: '', rating: 8.4
}, { season: 1, episode: 1 });
const dragonBallStream: StremioStream = {
  name: 'Addon', title: 'Dragon Ball Z S01E01 1080p', url: 'https://cdn.example.com/dbz-s01e01.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(dragonBallStream, houseOfDragonIdentity).isMatch, false);
console.log('  ✓ Cenário 5 passou: Títulos com 1 palavra coincidente rejeitados.');

// Cenário 6: Títulos que são prefixos de outros (Matrix vs Matrix Reloaded)
console.log('\nCenário 6: Rejeição quando o título de um é prefixo do outro');
const matrixIdentity = canonicalIdentityService.buildIdentity({
  id: 'movie-603', title: 'Matrix', originalTitle: 'The Matrix', type: ContentType.MOVIE, year: 1999, genres: ['Sci-Fi'], image: '', rating: 8.7
});
const matrixReloadedStream: StremioStream = {
  name: 'Addon', title: 'The Matrix Reloaded (2003) 1080p BluRay', url: 'https://cdn.example.com/matrix-reloaded.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(matrixReloadedStream, matrixIdentity).isMatch, false);
console.log('  ✓ Cenário 6 passou: Sequência não aceita para o filme original.');

// Cenário 7: Séries com títulos iguais aos de filmes (Fargo 2014 vs Fargo 1996)
console.log('\nCenário 7: Séries vs Filmes com mesmo título diferenciados por tipo e ano');
const fargoSeriesIdentity = canonicalIdentityService.buildIdentity({
  id: 'tv-60622', title: 'Fargo', type: ContentType.SERIES, year: 2014, genres: ['Crime'], image: '', rating: 8.9
}, { season: 1, episode: 1 });
const fargoMovieStream: StremioStream = {
  name: 'Addon', title: 'Fargo (1996) 1080p BluRay', url: 'https://cdn.example.com/fargo-1996.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(fargoMovieStream, fargoSeriesIdentity).isMatch, false);
console.log('  ✓ Cenário 7 passou: Filme de 1996 rejeitado para a série de 2014.');

// Cenário 8: Remakes com anos diferentes (Total Recall 1990 vs 2012)
console.log('\nCenário 8: Remakes com anos divergentes');
const totalRecall1990Identity = canonicalIdentityService.buildIdentity({
  id: 'movie-861', title: 'Total Recall', type: ContentType.MOVIE, year: 1990, genres: ['Action'], image: '', rating: 7.5
});
const totalRecall2012Stream: StremioStream = {
  name: 'Addon', title: 'Total Recall (2012) 1080p BluRay', url: 'https://cdn.example.com/total-recall-2012.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(totalRecall2012Stream, totalRecall1990Identity).isMatch, false);
console.log('  ✓ Cenário 8 passou: Remake de ano divergente rejeitado.');

// Cenário 9: Obras com traduções oficiais legítimas
console.log('\nCenário 9: Preservação de traduções e aliases oficiais legítimos');
const bleachIdentity = canonicalIdentityService.buildIdentity({
  id: 'anime-bleach-tybw', title: 'Bleach: Thousand-Year Blood War', originalTitle: 'Bleach: Sennen Kessen-hen', type: ContentType.ANIME, year: 2022, genres: ['Anime'], image: '', rating: 9.0
}, { season: 1, episode: 1 });
const bleachStream: StremioStream = {
  name: 'Addon', title: 'Bleach - Sennen Kessen-hen S01E01 1080p', url: 'https://cdn.example.com/bleach.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(bleachStream, bleachIdentity).isMatch, true);
console.log('  ✓ Cenário 9 passou: Tradução oficial japonesa/inglesa aceita.');

// Cenário 10: Séries da mesma franquia (Chicago Fire vs Chicago P.D. vs Chicago Med)
console.log('\nCenário 10: Séries com nomes semelhantes da mesma franquia rejeitam-se mutuamente');
const chicagoFireIdentity = canonicalIdentityService.buildIdentity({
  id: 'tv-44006', title: 'Chicago Fire', type: ContentType.SERIES, year: 2012, genres: ['Drama'], image: '', rating: 8.0
}, { season: 1, episode: 1 });
const chicagoPdStream: StremioStream = {
  name: 'Addon', title: 'Chicago.PD.S01E01.1080p', url: 'https://cdn.example.com/chicago-pd.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(chicagoPdStream, chicagoFireIdentity).isMatch, false);
assert.equal(sourceConfidenceEngine.evaluate(chicagoPdStream, chicagoTypewriterIdentity).isMatch, false);
console.log('  ✓ Cenário 10 passou: Chicago P.D. rejeitado para Chicago Fire e Chicago Typewriter.');

// Cenário 11: Episódios de temporadas diferentes
console.log('\nCenário 11: Rejeição de episódios com temporadas divergentes');
const season2Identity = canonicalIdentityService.buildIdentity(chicagoTypewriterItem, { season: 2, episode: 1 });
const season1Stream: StremioStream = {
  name: 'Addon', title: 'Chicago Typewriter S01E01 1080p', url: 'https://cdn.example.com/ct-s01e01.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(season1Stream, season2Identity).isMatch, false);
console.log('  ✓ Cenário 11 passou: Temporada 1 rejeitada para requisição da Temporada 2.');

// Cenário 12: Fontes sem metadados suficientes (inconclusivas/suspeitas)
console.log('\nCenário 12: Fontes genéricas ou sem metadados não são auto-aprovadas');
const bareStream: StremioStream = {
  url: 'https://unknown-cdn.com/stream/xyz123.mp4'
};
const eval12 = sourceConfidenceEngine.evaluate(bareStream, chicagoTypewriterIdentity);
assert.equal(eval12.isMatch, false);
console.log('  ✓ Cenário 12 passou: Fontes sem metadados suficientes marcadas como não compatíveis.');

// Cenário 13: Fontes de provedores com IDs incorretos
console.log('\nCenário 13: Fontes entregues com títulos incompatíveis descartadas');
const wrongIdStream: StremioStream = {
  name: 'Addon',
  title: '🐦‍🔥 Chicago (2002) ⏸️ 1080p Dublado',
  url: 'https://cdn.example.com/chicago.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(wrongIdStream, chicagoTypewriterIdentity).isMatch, false);
console.log('  ✓ Cenário 13 passou: Título declarado de filme divergente rejeitado.');

// Cenário 14: Cache de ranqueamento e isolamento
console.log('\nCenário 14: Ranqueamento elimina streams rejeitados por identidade');
const mixedStreams: StremioStream[] = [
  movieChicagoStream,
  validTypewriterStream,
  chicagoPdStream
];
const ranked = sourceSelectionService.rankStreams(mixedStreams, {
  hasExternalPtSub: false,
  preferDubbed: true,
  identity: chicagoTypewriterIdentity
});
assert.equal(ranked.length, 1, 'Apenas o stream correto de Chicago Typewriter deve sobreviver ao ranqueamento');
assert.equal(ranked[0].title, validTypewriterStream.title);
console.log('  ✓ Cenário 14 passou: Filtro de ranqueamento descarta todas as fontes de outras obras.');

// Cenário 15: Fallback no player não reintroduz obra errada
console.log('\nCenário 15: Fallback não reintroduz fontes de outras obras');
const availableForFallback = mixedStreams.filter(s => sourceConfidenceEngine.evaluate(s, chicagoTypewriterIdentity).isMatch);
assert.equal(availableForFallback.length, 1);
assert.equal(availableForFallback[0].title, validTypewriterStream.title);
console.log('  ✓ Cenário 15 passou: Fallback blindado contra obras colidentes.');

// Cenário 16: Troca de idioma/qualidade preserva a obra
console.log('\nCenário 16: Troca de qualidade da mesma obra preserva a identidade');
const typeWriter720p: StremioStream = {
  name: 'FenixFlix',
  title: 'Chicago Typewriter S01E01 720p Legendado',
  url: 'https://cdn.example.com/ct-720p.mp4'
};
assert.equal(sourceConfidenceEngine.evaluate(typeWriter720p, chicagoTypewriterIdentity).isMatch, true);
console.log('  ✓ Cenário 16 passou: Mesma obra em qualidade/idioma diferente aprovada.');

// Cenário 17: Telemetria de diagnóstico registrada
console.log('\nCenário 17: Telemetria diagnóstica de validação de identidade disponível');
const diagnostics = sourceConfidenceEngine.getRecentDiagnostics();
assert.ok(diagnostics.length > 0, 'Histórico diagnóstico deve conter registros');
const lastRecord = diagnostics.find(d => d.targetTitle === 'Chicago Typewriter' && d.isMatch === false);
assert.ok(lastRecord, 'Deve haver registro de rejeição com motivo documentado');
console.log(`  ✓ Cenário 17 passou: Diagnóstico gravado com motivo: "${lastRecord.reasons.join(', ')}".`);

// Cenário 18: Aliases de Chicago Typewriter não incluem "chicago" isolado
console.log('\nCenário 18: Verificação de remoção de tokens isolados como aliases canônicos');
assert.ok(
  !chicagoTypewriterIdentity.knownAliases.includes('chicago'),
  'knownAliases de Chicago Typewriter NUNCA deve conter "chicago" isolado'
);
console.log('  ✓ Cenário 18 passou: "chicago" não foi incluído como alias de Chicago Typewriter.');

console.log('\n--- TODOS OS 18 CENÁRIOS DE INTEGRIDADE CANÔNICA PASSARAM COM SUCESSO! ---');
process.exit(0);
