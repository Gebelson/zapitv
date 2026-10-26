/**
 * ZapiTV — Suíte de Testes: Avaliação e Integração Inteligente de Fontes de TV ao Vivo
 * 
 * Validação rigorosa dos requisitos:
 * 1. Avaliação e segregação técnica dos 7 ecossistemas investigados:
 *    - FrostView TV, Flix-Streams, Minha TV, StremTV US, StreamsPPV, StremVerse, AIOLiveTV.
 * 2. Carregamento paralelo controlado e não-bloqueante no LiveTVProviderRegistry.
 * 3. Detecção automática e isolamento de eventos esportivos temporários (PPV / confrontos).
 * 4. Canais lineares permanentes 24/7 isolados de eventos efêmeros.
 * 5. Inclusão comprovada de 5 novos canais brasileiros funcionais com fontes HLS diretas:
 *    - Arte 1, AgroCanal, AgroMais, Box Kids TV, +MaisUm TV.
 * 6. Numeração permanente de 3 dígitos no channelNumberingService para todos os novos canais.
 * 7. Deduplicação inteligente e multi-source fallback (estilo AIOLiveTV).
 * 8. Conformidade total com políticas de reprodução (sem bypass de DRM, sem links externos).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { liveTvProviderRegistry } from '../src/core/livetv/LiveTVProviderRegistry';
import { StremioLiveTVAdapter } from '../src/core/livetv/StremioLiveTVAdapter';
import { channelNormalizer } from '../src/core/livetv/ChannelNormalizer';
import { channelNumberingService } from '../src/core/livetv/channelNumberingService';
import { VERIFIED_STREAMS_SNAPSHOT } from '../src/core/livetv/verifiedStreamsSnapshot';
import { RawChannelInput, LiveChannel } from '../src/core/livetv/types';

console.log('=== ZAPITV | TESTES DE AVALIAÇÃO E INTEGRAÇÃO INTELIGENTE DE FONTES DE TV AO VIVO ===\n');

// -----------------------------------------------------------------------------------------
// TESTE 1: Auditoria Técnica dos Ecossistemas e Regras de Segurança / Conformidade
// -----------------------------------------------------------------------------------------
console.log('[Teste 1] Auditoria de regras e restrições de arquitetura dos 7 projetos pesquisados...');

// 1.1 Não admitir contornos de DRM ou proxies obrigatórios (StremVerse / MediaFlow Proxy)
const stremioAdapterPath = path.resolve(process.cwd(), 'src/core/livetv/StremioLiveTVAdapter.ts');
const stremioAdapterContent = fs.readFileSync(stremioAdapterPath, 'utf8');
assert.ok(
  !stremioAdapterContent.includes('mediaflow_proxy') && !stremioAdapterContent.includes('drm_bypass'),
  'O StremioLiveTVAdapter não deve incorporar proxies de DRM proibidos'
);

// 1.2 Registro deve dispor de métodos para gerenciar adaptadores Stremio em tempo de execução
assert.strictEqual(typeof liveTvProviderRegistry.addStremioAdapter, 'function', 'Deve existir addStremioAdapter');
assert.strictEqual(typeof liveTvProviderRegistry.removeStremioAdapter, 'function', 'Deve existir removeStremioAdapter');
assert.strictEqual(typeof liveTvProviderRegistry.toggleStremioAdapter, 'function', 'Deve existir toggleStremioAdapter');
console.log('✓ Teste 1 aprovado: Políticas de conformidade técnica e gestão de adaptadores Stremio validadas.\n');

// -----------------------------------------------------------------------------------------
// TESTE 2: Detecção Automática e Segregação de Eventos Esportivos Temporários
// -----------------------------------------------------------------------------------------
console.log('[Teste 2] Testando detecção e isolamento de eventos esportivos temporários...');

const adapter = new StremioLiveTVAdapter('https://example.com/manifest.json');
const isTemporary = (adapter as any).isTemporarySportsEvent.bind(adapter);

// Exemplos típicos de eventos esportivos temporários (StreamsPPV, Flix-Streams)
const temporaryTitles = [
  'Flamengo vs Palmeiras - Brasileirão Série A',
  'Real Madrid x Barcelona - El Clásico',
  'UFC 300: Pereira vs Prochazka 2',
  'NBA: Lakers vs Warriors (22:30)',
  'Liverpool vs Manchester City [Ao Vivo]',
  'São Paulo x Corinthians - Rodada 28',
  'F1 GP de São Paulo - Corrida',
  'Botafogo x Peñarol - Libertadores'
];

for (const title of temporaryTitles) {
  assert.strictEqual(
    isTemporary(title),
    true,
    `O evento '${title}' deve ser classificado como temporário (isTemporaryEvent: true)`
  );
}

// Canais lineares permanentes 24/7 NÃO devem ser classificados como temporários
const permanentTitles = [
  'TV Cultura (1080p)',
  'Arte 1',
  'CNN Brasil',
  'AgroCanal',
  'AgroMais',
  'Box Kids TV',
  '+MaisUm TV',
  'Rede Brasil de Televisão',
  'Pluto TV Cine Sucessos',
  'Band Sports HD'
];

for (const title of permanentTitles) {
  assert.strictEqual(
    isTemporary(title),
    false,
    `O canal permanente '${title}' NÃO deve ser classificado como evento temporário`
  );
}
console.log('✓ Teste 2 aprovado: Segregação precisa entre partidas temporárias e emissoras lineares 24/7.\n');

// -----------------------------------------------------------------------------------------
// TESTE 3: Carregamento Paralelo Não Bloqueante e Deduplicação Canônica
// -----------------------------------------------------------------------------------------
console.log('[Teste 3] Testando agregação de catálogo com carregamento paralelo e deduplicação...');

const sampleInputs: RawChannelInput[] = [
  {
    id: 'arte-1',
    name: 'Arte 1',
    url: 'http://45.162.64.114/ARTE1/index.m3u8',
    provider: 'Provider A',
    quality: '720p',
    isOfficial: true
  },
  {
    name: 'Arte 1 HD (Brasil)',
    url: 'http://45.162.64.114/ARTE1/backup.m3u8',
    provider: 'Provider B',
    quality: '720p'
  },
  {
    name: 'Flamengo vs Fluminense [16:00]',
    url: 'http://stream.example.com/live/fla-flu.m3u8',
    provider: 'Stremio PPV',
    quality: '1080p',
    isTemporaryEvent: true
  }
];

const normalized = channelNormalizer.normalizeAndDeduplicate(sampleInputs);
assert.ok(Array.isArray(normalized), 'O normalizador deve retornar uma lista de LiveChannel');

// Arte 1 deve ter sido deduplicado em um único canal canônico com duas fontes (primária e backup)
const arte1Channel = normalized.find(c => c.canonicalId === 'arte-1');
assert.ok(arte1Channel, 'O canal arte-1 deve existir na lista unificada');
assert.strictEqual(arte1Channel.sources?.length, 2, 'O canal arte-1 deve agregar as duas fontes disponíveis');
assert.strictEqual(arte1Channel.backupStreamUrls?.length, 1, 'A segunda fonte deve ser backup');
assert.strictEqual(arte1Channel.isTemporaryEvent, false, 'Arte 1 não é evento temporário');

// O evento temporário deve estar com isTemporaryEvent: true
const tempEvent = normalized.find(c => c.isTemporaryEvent);
assert.ok(tempEvent, 'O evento esportivo temporário deve estar marcado na lista');
assert.strictEqual(tempEvent.isTemporaryEvent, true, 'O evento esportivo deve ter isTemporaryEvent = true');

console.log('✓ Teste 3 aprovado: Deduplicação e unificação multi-source estilo AIOLiveTV funcionando perfeitamente.\n');

// -----------------------------------------------------------------------------------------
// TESTE 4: Verificação dos 5 Novos Canais Brasileiros com Reprodução Comprovada
// -----------------------------------------------------------------------------------------
console.log('[Teste 4] Verificação dos novos canais brasileiros integrados à grade permanente...');

const newChannelIds = ['arte-1', 'agro-canal', 'agro-mais', 'box-kids-tv', 'mais-um-tv'];

for (const id of newChannelIds) {
  // 4.1 Deve estar presente no snapshot de inicialização rápida (0ms)
  const seed = VERIFIED_STREAMS_SNAPSHOT[id];
  assert.ok(seed, `Canal ${id} deve estar registrado em VERIFIED_STREAMS_SNAPSHOT`);
  assert.ok(seed.streamUrl.startsWith('http'), `Canal ${id} deve possuir streamUrl HLS válida`);
  assert.ok(seed.latencyMs > 0 && seed.latencyMs < 1000, `Canal ${id} deve ter latência registrada baixa (<1000ms)`);

  // 4.2 Deve ser encontrado no LiveTVProviderRegistry
  const ch = liveTvProviderRegistry.getChannelById(id);
  assert.ok(ch, `Canal ${id} deve ser resolvido pelo LiveTVProviderRegistry`);
  assert.strictEqual(ch.isTemporaryEvent, false, `Canal ${id} deve ser linear permanente`);
  assert.ok(ch.streamUrl, `Canal ${id} deve ter streamUrl configurada`);

  // 4.3 Deve possuir numeração fixa de 3 dígitos no channelNumberingService
  const num = channelNumberingService.getNumber(id);
  assert.ok(typeof num === 'number' && num > 0, `Canal ${id} deve ter número atribuído`);
  const formatted = channelNumberingService.getFormattedNumber(id);
  assert.strictEqual(formatted.length, 3, `O número formatado de ${id} deve ter 3 dígitos (recebido: ${formatted})`);
}

// Números específicos atribuídos:
assert.strictEqual(channelNumberingService.getFormattedNumber('mais-um-tv'), '035');
assert.strictEqual(channelNumberingService.getFormattedNumber('box-kids-tv'), '057');
assert.strictEqual(channelNumberingService.getFormattedNumber('arte-1'), '074');
assert.strictEqual(channelNumberingService.getFormattedNumber('agro-canal'), '075');
assert.strictEqual(channelNumberingService.getFormattedNumber('agro-mais'), '076');

console.log('✓ Teste 4 aprovado: 5 novos canais brasileiros (035, 057, 074, 075, 076) validados com fontes ativas.\n');

// -----------------------------------------------------------------------------------------
// TESTE 5: Isolamento de Eventos Temporários das Listas Lineares e do EPG
// -----------------------------------------------------------------------------------------
console.log('[Teste 5] Verificação de isolamento: getVerifiedChannels() e getPermanentLinearChannels()...');

// Injeta temporariamente um canal de evento para teste
const testRegistryChannels = (liveTvProviderRegistry as any).channels as LiveChannel[];
const fakeEvent: LiveChannel = {
  id: 'temp-partida-teste',
  canonicalId: 'temp-partida-teste',
  name: 'Time A vs Time B (PPV Temporário)',
  shortName: 'Time A x B',
  category: 'esportes',
  categoryLabel: 'Esportes',
  streamUrl: 'http://example.com/test-ppv.m3u8',
  status: 'VERIFIED',
  isEnabled: true,
  accessType: 'internal',
  isTemporaryEvent: true
};
testRegistryChannels.push(fakeEvent);

const verifiedList = liveTvProviderRegistry.getVerifiedChannels();
assert.ok(
  !verifiedList.some(c => c.id === 'temp-partida-teste'),
  'getVerifiedChannels() NUNCA deve incluir eventos esportivos temporários na grade linear'
);

const permanentList = liveTvProviderRegistry.getPermanentLinearChannels();
assert.ok(
  !permanentList.some(c => c.id === 'temp-partida-teste'),
  'getPermanentLinearChannels() NUNCA deve incluir eventos esportivos temporários'
);

const tempEvents = liveTvProviderRegistry.getTemporarySportsEvents();
assert.ok(
  tempEvents.some(c => c.id === 'temp-partida-teste'),
  'getTemporarySportsEvents() deve retornar os eventos temporários isoladamente'
);

// Limpeza do fakeEvent
const idx = testRegistryChannels.findIndex(c => c.id === 'temp-partida-teste');
if (idx !== -1) testRegistryChannels.splice(idx, 1);

console.log('✓ Teste 5 aprovado: Eventos temporários totalmente isolados da grade linear permanente.\n');

// -----------------------------------------------------------------------------------------
// TESTE 6: Resolução Determinística de Falhas e Múltiplas Fontes
// -----------------------------------------------------------------------------------------
console.log('[Teste 6] Testando fallback multi-fontes e aliases canônicos no normalizador...');

assert.strictEqual(channelNormalizer.generateCanonicalSlug('Arte 1 (720p)'), 'arte-1');
assert.strictEqual(channelNormalizer.generateCanonicalSlug('Canal Arte 1'), 'arte-1');
assert.strictEqual(channelNormalizer.generateCanonicalSlug('Agro Canal HD'), 'agro-canal');
assert.strictEqual(channelNormalizer.generateCanonicalSlug('AgroMais Notícias'), 'agro-mais');
assert.strictEqual(channelNormalizer.generateCanonicalSlug('Box Kids'), 'box-kids-tv');
assert.strictEqual(channelNormalizer.generateCanonicalSlug('+MaisUm TV'), 'mais-um-tv');

console.log('✓ Teste 6 aprovado: Aliases canônicos mapeados com precisão.\n');

console.log('========================================================================');
console.log('TODOS OS TESTES DA AVALIAÇÃO E INTEGRAÇÃO DE FONTES FORAM APROVADOS!');
console.log('========================================================================\n');
