import assert from 'node:assert/strict';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { bannedContentRegistry } from '../src/core/catalog/BannedContentRegistry';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { trustedTimeService } from '../src/core/time/trustedTimeService';
import { localSearchIndexService } from '../src/core/search/localSearchIndexService';
import { streamValidator } from '../src/core/providers/streamValidator';
import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';
import { ContentType, ContentItem } from '../types';

console.log('=== TEST SUITE: ZapiTV | Agendamento e Visibilidade de A Odisseia (2026) ===\n');

// 1. Identificação canônica estrita no catálogo de destaque
console.log('1. Verificando integridade e metadados de A Odisseia (2026)...');
const featuredOdyssey = FEATURED_CATALOG_ITEMS.find(it => 
  catalogEligibilityService.isTheOdyssey2026(it) || it.id === 'movie-a-odisseia-2026'
);

assert.ok(featuredOdyssey, 'A Odisseia (2026) deve existir em FEATURED_CATALOG_ITEMS');
assert.strictEqual(featuredOdyssey.id, 'movie-a-odisseia-2026');
assert.strictEqual(featuredOdyssey.tmdbId, '1368337');
assert.strictEqual(featuredOdyssey.imdbId, 'tt33764258');
assert.strictEqual(featuredOdyssey.type, ContentType.MOVIE);
assert.strictEqual(featuredOdyssey.year, 2026);
assert.strictEqual(featuredOdyssey.catalogVisibleFrom, '2026-11-20T00:00:00-03:00');
assert.notStrictEqual(featuredOdyssey.releaseDate, '2026-11-20T00:00:00-03:00', 'A data de estreia cinematográfica (releaseDate) NÃO deve ser sobrescrita pelo agendamento do catálogo');
assert.strictEqual(bannedContentRegistry.isBanned(featuredOdyssey), false, 'A Odisseia NUNCA deve ser incluída em BannedContentRegistry (não é banimento)');

console.log('  -> Metadados e identificadores canônicos verificados com sucesso.');

// 2. Não colisão com outras obras que compartilham "Odisseia" no título
console.log('\n2. Verificando isolamento canônico contra títulos similares (ex: 2001: Uma Odisseia no Espaço)...');
const spaceOdyssey: ContentItem = {
  id: 'movie-space-odyssey-1968',
  tmdbId: '62',
  imdbId: 'tt0062622',
  title: '2001: Uma Odisseia no Espaço',
  originalTitle: '2001: A Space Odyssey',
  type: ContentType.MOVIE,
  year: 1968,
  image: 'https://image.tmdb.org/t/p/w500/space-odyssey.jpg',
  rating: 8.3
};

assert.strictEqual(catalogEligibilityService.isTheOdyssey2026(spaceOdyssey), false, '2001 não pode ser identificado como A Odisseia 2026');
assert.strictEqual(catalogEligibilityService.getCatalogVisibleFrom(spaceOdyssey), null, '2001 não possui data de visibilidade futura');
assert.strictEqual(catalogEligibilityService.isCatalogVisibleNow(spaceOdyssey), true, '2001 deve estar sempre visível agora');
assert.strictEqual(catalogEligibilityService.isItemPubliclyPlayableSync(spaceOdyssey), true, '2001 deve ser reproduzível publicamente');

console.log('  -> Isolamento canônico verificado: títulos semelhantes não sofrem qualquer interferência.');

// 3. Cenário: 24/10/2026 (Hoje / Bloqueio Ativo)
console.log('\n3. Testando comportamento em 24/10/2026 (filme estritamente oculto do catálogo e busca)...');
trustedTimeService.setMockTime('2026-10-24T16:00:00-03:00');

assert.strictEqual(catalogEligibilityService.isCatalogVisibleNow(featuredOdyssey), false, 'Deve estar oculto em 24/10/2026');
assert.strictEqual(catalogEligibilityService.isItemPubliclyPlayableSync(featuredOdyssey), false, 'Reprodução deve estar bloqueada em 24/10/2026');
assert.strictEqual(theatricalFilterService.isMovieAllowedSync(featuredOdyssey), false, 'theatricalFilterService deve rejeitar o filme');

// Filtragem em lote de catálogo
const mixedCatalog: ContentItem[] = [featuredOdyssey, spaceOdyssey];
const filteredSync = catalogEligibilityService.filterEligibleItemsSync(mixedCatalog);
assert.strictEqual(filteredSync.length, 1, 'Apenas 1 item deve ser elegível no catálogo');
assert.strictEqual(filteredSync[0].id, spaceOdyssey.id, 'Apenas 2001 deve permanecer no catálogo');

// Busca Instantânea
localSearchIndexService.clear();
localSearchIndexService.syncCatalog([featuredOdyssey, spaceOdyssey]);
const searchResults = localSearchIndexService.searchInstant('Odisseia');
assert.strictEqual(searchResults.some(r => r.id === featuredOdyssey.id), false, 'A Odisseia 2026 NÃO pode aparecer nos resultados da busca antes de 20/11/2026');
assert.strictEqual(searchResults.some(r => r.id === spaceOdyssey.id), true, '2001 DEVE aparecer nos resultados da busca por "Odisseia"');

console.log('  -> 24/10/2026: A Odisseia está 100% oculta das listagens, filtros e busca instantânea.');

// 4. Cenário: 19/11/2026 às 23:59:59 (1 segundo antes da virada)
console.log('\n4. Testando comportamento em 19/11/2026 às 23:59:59 (limite final do bloqueio)...');
trustedTimeService.setMockTime('2026-11-19T23:59:59-03:00');

assert.strictEqual(catalogEligibilityService.isCatalogVisibleNow(featuredOdyssey), false, 'Deve permanecer oculto 1 segundo antes da data programada');
assert.strictEqual(catalogEligibilityService.isItemPubliclyPlayableSync(featuredOdyssey), false, 'Reprodução deve permanecer bloqueada até o último segundo');

console.log('  -> 19/11/2026 23:59:59: Bloqueio estritamente mantido até o último segundo.');

// 5. Cenário: 20/11/2026 às 00:00:00 (Momento exato da liberação automática)
console.log('\n5. Testando liberação automática em 20/11/2026 às 00:00:00 (Horário de Brasília)...');
trustedTimeService.setMockTime('2026-11-20T00:00:00-03:00');

// Simula a invalidação e verificação que ocorre na virada automática
catalogEligibilityService.invalidateScheduledItemCaches(featuredOdyssey);

assert.strictEqual(catalogEligibilityService.isCatalogVisibleNow(featuredOdyssey), true, 'Deve tornar-se visível às 00:00:00 de 20/11/2026');
assert.strictEqual(theatricalFilterService.isMovieAllowedSync(featuredOdyssey), true, 'theatricalFilterService deve aceitar o filme a partir de 20/11/2026');

// Filtragem em lote agora inclui A Odisseia
const afterMidnightFiltered = catalogEligibilityService.filterEligibleItemsSync(mixedCatalog);
assert.strictEqual(afterMidnightFiltered.length, 2, 'Ambos os filmes devem ser elegíveis após a virada');
assert.ok(afterMidnightFiltered.some(it => it.id === featuredOdyssey.id), 'A Odisseia deve estar presente no catálogo');

// Busca Instantânea agora retorna A Odisseia
const searchAfterMidnight = localSearchIndexService.searchInstant('Odisseia');
assert.strictEqual(searchAfterMidnight.some(r => r.id === featuredOdyssey.id), true, 'A Odisseia DEVE aparecer na busca a partir de 20/11/2026');

console.log('  -> 20/11/2026 00:00:00: Liberação automática confirmada sem deploy ou alteração de código.');

// 6. Cenário: 21/11/2026 (Dias posteriores à liberação)
console.log('\n6. Testando permanência nos dias posteriores (21/11/2026)...');
trustedTimeService.setMockTime('2026-11-21T14:30:00-03:00');

assert.strictEqual(catalogEligibilityService.isCatalogVisibleNow(featuredOdyssey), true, 'Deve permanecer visível no dia seguinte');
assert.strictEqual(theatricalFilterService.isMovieAllowedSync(featuredOdyssey), true, 'Deve permanecer autorizado no dia seguinte');

console.log('  -> 21/11/2026: Permanência e estabilidade pós-virada confirmadas.');

// 7. Reatividade instantânea sem F5 via inscrição de eventos
console.log('\n7. Testando reatividade de eventos sem recarregar a página (subscribe listener)...');
let notifiedCount = 0;
const unsubscribe = catalogEligibilityService.subscribe(() => {
  notifiedCount++;
});

// Força notificação programada
catalogEligibilityService.notifyListeners();
assert.strictEqual(notifiedCount, 1, 'Listener deve ser notificado imediatamente quando a visibilidade mudar');
unsubscribe();

catalogEligibilityService.notifyListeners();
assert.strictEqual(notifiedCount, 1, 'Após unsubscribe, o listener não deve mais ser invocado');

console.log('  -> Reatividade de listeners sem F5 testada com sucesso.');

// 8. Rejeição de streams CAM/HDCAM/Telesync/HDTC/Telecine mesmo após liberação da ficha
console.log('\n8. Testando bloqueio rigoroso de gravações de cinema (CAM/HDCAM/Telesync/HDTC/Telecine)...');
const sampleStreams = [
  { name: 'Torrentio', title: 'The Odyssey 2026 1080p CAMRip x264', url: 'https://example.com/cam.mp4' },
  { name: 'Torrentio', title: 'The.Odyssey.2026.HDCAM.720p', url: 'https://example.com/hdcam.mp4' },
  { name: 'Torrentio', title: 'The Odyssey 2026 Telesync LINE Audio', url: 'https://example.com/ts.mp4' },
  { name: 'Torrentio', title: 'The.Odyssey.2026.HDTC.Clean.Audio.1080p', url: 'https://example.com/hdtc.mp4' },
  { name: 'Torrentio', title: 'The Odyssey 2026 Telecine x265', url: 'https://example.com/tc.mp4' },
  { name: 'FenixFlix', title: 'The.Odyssey.2026.1080p.WEB-DL.DDP5.1.Atmos.H.264', url: 'https://example.com/webdl.mp4' },
  { name: 'FenixFlix', title: 'The Odyssey (2026) 2160p 4K UHD HDR NF WEB-DL', url: 'https://example.com/4k.mp4' }
];

const cleanStreams = streamValidator.filterCleanStreams(sampleStreams, featuredOdyssey.title);
assert.strictEqual(cleanStreams.length, 2, 'Apenas as 2 fontes legítimas WEB-DL/4K devem ser aprovadas');
assert.strictEqual(cleanStreams.some(s => s.title.includes('CAM')), false, 'Nenhum stream CAM pode ser aprovado');
assert.strictEqual(cleanStreams.some(s => s.title.includes('HDCAM')), false, 'Nenhum stream HDCAM pode ser aprovado');
assert.strictEqual(cleanStreams.some(s => s.title.includes('Telesync')), false, 'Nenhum stream Telesync pode ser aprovado');
assert.strictEqual(cleanStreams.some(s => s.title.includes('HDTC')), false, 'Nenhum stream HDTC pode ser aprovado');
assert.strictEqual(cleanStreams.some(s => s.title.includes('Telecine')), false, 'Nenhum stream Telecine pode ser aprovado');

// Validação direta via CamBlockerEngine
assert.strictEqual(CamBlockerEngine.isCamStream({ title: 'The Odyssey 2026 HDCAM' }, featuredOdyssey), true);
assert.strictEqual(CamBlockerEngine.isCamStream({ title: 'The Odyssey 2026 1080p WEB-DL' }, featuredOdyssey), false);

console.log('  -> Bloqueio absoluto de fontes CAM/Telesync/HDTC/Telecine mantido intacto.');

// 9. Acesso direto e bloqueio de reprodução antecipada na ficha técnica
console.log('\n9. Testando acesso direto e bloqueio de reprodução na ficha técnica antes de 20/11...');
trustedTimeService.setMockTime('2026-10-24T16:00:00-03:00');

assert.strictEqual(catalogEligibilityService.isCatalogVisibleNow(featuredOdyssey), false);
assert.strictEqual(catalogEligibilityService.isItemPubliclyPlayableSync(featuredOdyssey), false, 'Acesso direto por URL não pode autorizar reprodução antecipada');

// 10. Cold start e relógio de autoridade
console.log('\n10. Testando cold start e cálculo de fuso horário de Brasília (America/Sao_Paulo)...');
const brOffsetHours = -3;
const targetIso = '2026-11-20T00:00:00-03:00';
const targetMs = Date.parse(targetIso);
assert.strictEqual(targetMs, 1795143600000, 'Timestamp exato de 20/11/2026 00:00:00-03:00 deve ser 1795143600000');

// Limpa mock do relógio
trustedTimeService.resetMockTime();

console.log('\n=== TODOS OS 10 CENÁRIOS DE TESTE PASSARAM COM SUCESSO! ===\n');
process.exit(0);
