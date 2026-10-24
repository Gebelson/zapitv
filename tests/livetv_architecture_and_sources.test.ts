import assert from 'node:assert';
import { OfficialChannelProvider } from '../src/core/livetv/OfficialChannelProvider';
import { channelNormalizer } from '../src/core/livetv/ChannelNormalizer';
import { channelSourceResolver } from '../src/core/livetv/ChannelSourceResolver';
import { liveStreamValidator } from '../src/core/livetv/LiveStreamValidator';
import { channelHealthService } from '../src/core/livetv/channelHealthService';
import { epgAggregator } from '../src/core/livetv/EPGAggregator';
import { M3UProviderAdapter } from '../src/core/livetv/M3UProviderAdapter';
import { liveTvProviderRegistry } from '../src/core/livetv/LiveTVProviderRegistry';
import { LiveChannel, RawChannelInput } from '../src/core/livetv/types';

console.log('--- Iniciando Testes de Arquitetura, Fontes e EPG da TV ao Vivo ---');

// =========================================================================
// TESTE 1: Auditoria de Canais Oficiais Sem Colisões de URL
// =========================================================================
console.log('\n[Teste 1] Auditoria de Canais Oficiais Sem Colisões de URL...');
const officialChannels = OfficialChannelProvider.getOfficialChannels();
assert.ok(officialChannels.length >= 50, 'Deve conter pelo menos 50 canais catalogados');

const camara = officialChannels.find(c => c.id === 'tv-camara');
const justica = officialChannels.find(c => c.id === 'tv-justica');
const senado = officialChannels.find(c => c.id === 'tv-senado');
const alesp = officialChannels.find(c => c.id === 'tv-alesp');
const brasilCentral = officialChannels.find(c => c.id === 'tv-brasil-central');

assert.ok(camara && justica, 'TV Câmara e TV Justiça devem existir');
assert.ok(senado && alesp && brasilCentral, 'TV Senado, TV ALESP e TV Brasil Central devem existir');

// TV Justiça não pode usar a URL da TV Câmara
assert.notStrictEqual(camara.url, justica.url, 'TV Justiça não pode usar a mesma URL da TV Câmara');
assert.ok(justica.url.includes('TV_JUSTICA'), 'TV Justiça deve ter seu próprio fluxo autêntico');

// TV Senado, TV Alesp e TV Brasil Central não podem colidir
assert.notStrictEqual(senado.url, brasilCentral.url, 'TV Brasil Central não pode compartilhar URL da TV Senado');
assert.ok(brasilCentral.url.includes('zoeweb.tv') || brasilCentral.url.includes('tbc'), 'TV Brasil Central deve possuir fluxo próprio da TBC Goiás');
assert.ok(alesp.requiresExternalAccess || alesp.url !== senado.url, 'TV ALESP não pode usar a URL da TV Senado');

// Nenhuma URL repetida entre canais com streaming ativo
const nonBlankUrls = officialChannels.map(c => c.url).filter(u => u && u.trim() !== '');
const urlSet = new Set(nonBlankUrls);
assert.strictEqual(nonBlankUrls.length, urlSet.size, 'Não deve haver nenhuma URL repetida entre canais distintos');
console.log('✓ Teste 1 passou: TV Justiça, TV Câmara, TV Senado, ALESP e Brasil Central com fontes exclusivas e sem colisões.');

// =========================================================================
// TESTE 2: Normalização Canônica e Priorização de Fontes Oficiais
// =========================================================================
console.log('\n[Teste 2] Normalização Canônica e Priorização de Fontes Oficiais...');
const rawList: RawChannelInput[] = [
  {
    name: 'TV Cultura (1080p)',
    url: 'https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8',
    provider: 'ZapiTV Oficial',
    quality: '1080p',
    isOfficial: true,
    groupTitle: 'Cultura'
  },
  {
    name: 'TV Cultura Brasil',
    url: 'https://unofficial-feed.example.com/stream.m3u8',
    provider: 'Lista Externa IPTV',
    quality: '4k',
    isOfficial: false,
    groupTitle: 'Geral'
  }
];

const normalized = channelNormalizer.normalizeAndDeduplicate(rawList);
assert.strictEqual(normalized.length, 1, 'Deve deduplicar variações do mesmo canal canônico');
const cultura = normalized[0];
assert.strictEqual(cultura.id, 'tv-cultura', 'ID canônico deve ser limpo e estável');
assert.strictEqual(cultura.isOfficial, true, 'Canal oficial deve manter flag oficial');
assert.strictEqual(cultura.streamUrl, 'https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8', 'Fonte oficial deve ser a principal');
assert.strictEqual(cultura.sources?.length, 2, 'Deve registrar ambas as fontes para fallback');
assert.strictEqual(cultura.sources[0].isOfficial, true, 'Fonte oficial deve encabeçar o ranking');
console.log('✓ Teste 2 passou: Deduplicação e priorização de streams oficiais validadas com sucesso.');

// =========================================================================
// TESTE 3: ChannelSourceResolver e Fallback Anti-Looping
// =========================================================================
console.log('\n[Teste 3] ChannelSourceResolver e Fallback Anti-Looping...');
const testChannel: LiveChannel = {
  id: 'canal-teste',
  name: 'Canal Teste Multi-Fonte',
  logo: 'https://example.com/logo.png',
  category: 'noticias',
  categoryLabel: 'Notícias',
  streamUrl: 'https://fonte-principal.example.com/stream.m3u8',
  backupStreamUrls: [
    'https://fonte-backup-1.example.com/stream.m3u8',
    'https://fonte-backup-2.example.com/stream.m3u8'
  ],
  quality: '1080p',
  isOfficial: true,
  status: 'AVAILABLE'
};

channelSourceResolver.clearFailedSources('canal-teste');
const best = channelSourceResolver.resolveBestSource(testChannel);
assert.strictEqual(best.primaryUrl, 'https://fonte-principal.example.com/stream.m3u8', 'Primeira fonte deve ser a principal');

// Simula falha da fonte principal
const next1 = channelSourceResolver.getNextSource(testChannel, best.primaryUrl);
assert.ok(next1, 'Deve retornar primeira fonte de backup');
assert.strictEqual(next1?.url, 'https://fonte-backup-1.example.com/stream.m3u8', 'Deve alternar para o backup 1');

// Simula falha do backup 1
const next2 = channelSourceResolver.getNextSource(testChannel, next1!.url);
assert.ok(next2, 'Deve retornar segunda fonte de backup');
assert.strictEqual(next2?.url, 'https://fonte-backup-2.example.com/stream.m3u8', 'Deve alternar para o backup 2');

// Simula falha do backup 2 (todas esgotadas)
const next3 = channelSourceResolver.getNextSource(testChannel, next2!.url);
assert.strictEqual(next3, null, 'Anti-loop: não deve retornar fontes já esgotadas nesta sessão');
console.log('✓ Teste 3 passou: Resolução ordenada de fontes e controle anti-looping comprovados.');

// =========================================================================
// TESTE 4: Validação de Disponibilidade e Domínios Estacionados
// =========================================================================
console.log('\n[Teste 4] Validação de Disponibilidade e Domínios Estacionados...');
assert.strictEqual(liveStreamValidator.isParkedDomain('https://superflixapi.top/live.m3u8'), true, 'Deve barrar domínio parked');
assert.strictEqual(liveStreamValidator.isParkedDomain('https://sedo.com/parking.m3u8'), true, 'Deve barrar sedo parked');
assert.strictEqual(liveStreamValidator.isParkedDomain('https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8'), false, 'Não deve barrar domínio legítimo');

// Canais de acesso externo oficial
const sportv = officialChannels.find(c => c.id === 'sportv-oficial');
assert.ok(sportv && sportv.requiresExternalAccess, 'SporTV deve ser marcado como acesso externo');
assert.strictEqual(sportv?.externalProviderName?.includes('Globoplay'), true, 'SporTV deve indicar Globoplay');

const healthStatus = await channelHealthService.checkChannelHealth(sportv as LiveChannel);
assert.strictEqual(healthStatus, 'EXTERNAL_ACCESS', 'Canal com acesso oficial deve retornar status canônico EXTERNAL_ACCESS');
console.log('✓ Teste 4 passou: Bloqueio de parked domains e status canônico EXTERNAL_ACCESS validados.');

// =========================================================================
// TESTE 5: Parser M3U com Metadados e Grupos
// =========================================================================
console.log('\n[Teste 5] Parser M3U com Metadados e Grupos...');
const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-id="CNN.br" tvg-name="CNN Brasil" tvg-logo="https://example.com/cnn.png" group-title="Notícias",CNN Brasil HD
https://d25usgadhphvwi.cloudfront.net/hls/main.m3u8
#EXTINF:-1 tvg-id="FakeParked.br" group-title="Spam",Canal Spam
https://parklogic.com/ads.m3u8
`;

const adapter = new M3UProviderAdapter('Teste M3U');
const parsed = adapter.parseM3UContent(sampleM3u);
assert.strictEqual(parsed.length, 1, 'Deve filtrar links de domínios parked/spam');
assert.strictEqual(parsed[0].name, 'CNN Brasil HD', 'Nome do canal extraído corretamente');
assert.strictEqual(parsed[0].tvgLogo, 'https://example.com/cnn.png', 'Logo extraído corretamente');
assert.strictEqual(parsed[0].groupTitle, 'Notícias', 'Grupo extraído corretamente');
console.log('✓ Teste 5 passou: Parser M3U com extração rigorosa de metadados validado.');

// =========================================================================
// TESTE 6: EPG com Dados Reais e Proteção contra Grades Inventadas
// =========================================================================
console.log('\n[Teste 6] EPG com Dados Reais e Proteção contra Grades Inventadas...');

// Canal sem grade verificada
const unknownChannel: LiveChannel = {
  id: 'canal-sem-grade',
  name: 'Canal Sem Grade Conhecida',
  logo: 'https://example.com/logo.png',
  category: 'noticias',
  categoryLabel: 'Notícias',
  streamUrl: 'https://example.com/stream.m3u8',
  quality: '720p',
  isOfficial: false,
  status: 'AVAILABLE'
};

const unkEpg = epgAggregator.getCurrentEpgState(unknownChannel);
assert.strictEqual(unkEpg.hasVerifiedSchedule, false, 'Canal sem grade não deve fingir possuir grade verificada');
assert.strictEqual(unkEpg.currentProgram.title, 'Programação não disponível', 'Deve exibir "Programação não disponível"');
assert.strictEqual(unkEpg.nextProgram, undefined, 'Não deve inventar próximo programa');
assert.strictEqual(unkEpg.formattedStartTime, '--:--', 'Horários devem ser neutros');

// Canal com grade verificada (ex: TV Brasil)
const tvBrasilChannel: LiveChannel = {
  id: 'tv-brasil',
  name: 'TV Brasil',
  logo: 'https://example.com/tvbrasil.png',
  category: 'aberta',
  categoryLabel: 'TV Aberta',
  streamUrl: 'https://tvbrasil-stream.ebc.com.br/index.m3u8',
  quality: '1080p',
  isOfficial: true,
  status: 'AVAILABLE'
};

const tvBrasilEpg = epgAggregator.getCurrentEpgState(tvBrasilChannel);
assert.strictEqual(tvBrasilEpg.hasVerifiedSchedule, true, 'TV Brasil deve possuir grade verificada');
assert.notStrictEqual(tvBrasilEpg.currentProgram.title, 'Programação não disponível', 'Deve conter programa real da TV Brasil');
assert.ok(tvBrasilEpg.nextProgram, 'Deve conter próximo programa real');
assert.ok(tvBrasilEpg.progressPercent >= 0 && tvBrasilEpg.progressPercent <= 100, 'Progresso deve estar entre 0 e 100%');
console.log(`✓ Teste 6 passou: TV Brasil exibindo programa real ("${tvBrasilEpg.currentProgram.title}") e canal sem grade protegido contra simulações falsas.`);

// =========================================================================
// TESTE 7: Gestão Dinâmica no LiveTVProviderRegistry
// =========================================================================
console.log('\n[Teste 7] Gestão Dinâmica no LiveTVProviderRegistry...');
const registry = liveTvProviderRegistry;
const initialTotal = registry.getAllChannels().length;
assert.ok(initialTotal >= 50, 'Catálogo inicial do registro deve ter pelo menos 50 canais');

// Teste de desativação e reativação
const testTarget = registry.getAllChannels()[0];
registry.toggleChannelEnabled(testTarget.id, false);
const withoutTarget = registry.getAllChannels();
assert.strictEqual(withoutTarget.some(c => c.id === testTarget.id), false, 'Canal desativado não deve aparecer no catálogo ativo');

registry.toggleChannelEnabled(testTarget.id, true);
const restored = registry.getAllChannels();
assert.strictEqual(restored.some(c => c.id === testTarget.id), true, 'Canal reativado deve voltar ao catálogo');

// Teste de edição de URL customizada de canal
const sampleCustomUrl = 'https://custom-override-stream.example.com/playlist.m3u8';
registry.updateChannelStreamUrl(testTarget.id, sampleCustomUrl);
const updatedTarget = registry.getChannelById(testTarget.id);
assert.strictEqual(updatedTarget?.streamUrl, sampleCustomUrl, 'Override de URL pelo admin deve ser refletido imediatamente');
console.log('✓ Teste 7 passou: Gerenciamento dinâmico de canais, ativação/desativação e override de stream validados.');

console.log('\n========================================================================');
console.log(' TODOS OS 7 TESTES DA ARQUITETURA DE TV AO VIVO PASSARAM COM SUCESSO! ');
console.log('========================================================================');
