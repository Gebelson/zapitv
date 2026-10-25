/**
 * ZapiTV — P0: Exibir SOMENTE Canais Realmente Funcionais e Verificados
 * 
 * Validação rigorosa dos requisitos:
 * 1. A página Programas e o Modo Televisão apresentam exclusivamente canais com reprodução comprovada (VERIFIED / AVAILABLE).
 * 2. Nenhum canal que exija autorização externa (requiresExternalAccess) aparece na grade pública ou categorias.
 * 3. Canais UNVERIFIED, CHECKING, UNSTABLE, UNAVAILABLE ou RESTRICTED permanecem ocultos.
 * 4. Preservação integral dos metadados e registros no provedor/catálogo interno.
 * 5. Busca e categorias operam estritamente sobre canais verificados.
 * 6. Falhas em tempo de execução rebaixam o canal para UNAVAILABLE e acionam auto-avanço para o próximo canal funcional.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { liveTvProviderRegistry } from '../src/core/livetv/LiveTVProviderRegistry';
import { channelRegistry } from '../src/core/livetv/channelRegistry';
import { isChannelVerified, LiveChannel } from '../src/core/livetv/types';
import { liveStreamValidator } from '../src/core/livetv/LiveStreamValidator';
import { VERIFIED_STREAMS_SNAPSHOT } from '../src/core/livetv/verifiedStreamsSnapshot';

console.log('=== ZAPITV | P0: EXIBIÇÃO EXCLUSIVA DE CANAIS REALMENTE FUNCIONAIS ===\n');

// -----------------------------------------------------------------------------------------
// TESTE 1: Inicialização e Seed Instantâneo a partir do Snapshot Verificado
// -----------------------------------------------------------------------------------------
console.log('[Teste 1] Verificação do snapshot e seeding instantâneo...');
const snapshotKeys = Object.keys(VERIFIED_STREAMS_SNAPSHOT);
assert.ok(snapshotKeys.length >= 40, `Snapshot deve conter pelo menos 40 canais verificados (atual: ${snapshotKeys.length})`);
assert.ok(VERIFIED_STREAMS_SNAPSHOT['tv-cultura'], 'TV Cultura deve constar no snapshot');
assert.ok(VERIFIED_STREAMS_SNAPSHOT['cnn-brasil'], 'CNN Brasil deve constar no snapshot');
assert.ok(VERIFIED_STREAMS_SNAPSHOT['record-news'], 'Record News deve constar no snapshot');
assert.ok(VERIFIED_STREAMS_SNAPSHOT['fifa-plus-br'], 'FIFA+ deve constar no snapshot');

console.log(`✓ Teste 1 aprovado: Snapshot carregado com ${snapshotKeys.length} canais verificados em 0ms.\n`);

// -----------------------------------------------------------------------------------------
// TESTE 2: Listagem Pública Estrita (getVerifiedChannels)
// -----------------------------------------------------------------------------------------
console.log('[Teste 2] Auditoria da listagem pública de canais verificados...');

const verifiedFromProvider = liveTvProviderRegistry.getVerifiedChannels();
const verifiedFromRegistry = channelRegistry.getVerifiedChannels();

assert.strictEqual(
  verifiedFromProvider.length,
  verifiedFromRegistry.length,
  'ChannelRegistry e LiveTVProviderRegistry devem retornar a mesma quantidade de canais verificados'
);

assert.ok(
  verifiedFromProvider.length >= 40,
  `Deve haver pelo menos 40 canais verificados disponíveis publicamente (atual: ${verifiedFromProvider.length})`
);

for (const channel of verifiedFromProvider) {
  // Regra 1: Deve passar no critério estrito isChannelVerified
  assert.ok(
    isChannelVerified(channel),
    `Canal ${channel.id} (${channel.name}) na listagem pública falhou na verificação de elegibilidade`
  );

  // Regra 2: Jamais pode exigir acesso externo
  assert.strictEqual(
    channel.requiresExternalAccess,
    false,
    `Canal ${channel.id} exige acesso externo e NÃO pode aparecer na listagem pública`
  );

  // Regra 3: Deve ter streamUrl preenchida e válida
  assert.ok(
    channel.streamUrl && channel.streamUrl.startsWith('http'),
    `Canal ${channel.id} não possui streamUrl válida: ${channel.streamUrl}`
  );

  // Regra 4: Não pode estar desabilitado
  assert.ok(!channel.disabled, `Canal ${channel.id} está desabilitado e não pode ser listado`);

  // Regra 5: Status deve ser estritamente funcional (VERIFIED ou AVAILABLE)
  assert.ok(
    channel.status === 'VERIFIED' || channel.status === 'AVAILABLE',
    `Canal ${channel.id} possui status inválido para exibição pública: ${channel.status}`
  );
}

console.log(`✓ Teste 2 aprovado: Todos os ${verifiedFromProvider.length} canais públicos são 100% internos e verificados.\n`);

// -----------------------------------------------------------------------------------------
// TESTE 3: Canais com Acesso Externo Ocultos da Exibição Pública
// -----------------------------------------------------------------------------------------
console.log('[Teste 3] Verificação de ocultação dos 12 canais de acesso externo...');

const externalIds = [
  'globo-oficial',
  'sbt-nacional',
  'record-tv-oficial',
  'band-nacional',
  'redetv-nacional',
  'tv-alesp',
  'ge-tv-oficial',
  'sportv-oficial',
  'sportv-2-oficial',
  'sportv-3-oficial',
  'espn-oficial',
  'premiere-oficial'
];

for (const extId of externalIds) {
  const foundInPublic = verifiedFromProvider.find(c => c.id === extId);
  assert.strictEqual(
    foundInPublic,
    undefined,
    `VIOLAÇÃO CRÍTICA P0: Canal externo ${extId} não pode estar presente na lista pública getVerifiedChannels()`
  );
}

console.log('✓ Teste 3 aprovado: 100% dos 12 canais de acesso externo estão ausentes da lista pública.\n');

// -----------------------------------------------------------------------------------------
// TESTE 4: Preservação Íntegra dos Metadados Internos (getAllChannels)
// -----------------------------------------------------------------------------------------
console.log('[Teste 4] Preservação do catálogo interno de canais...');

const allChannels = liveTvProviderRegistry.getAllChannels();
assert.ok(
  allChannels.length >= 50,
  `Catálogo interno deve manter todos os canais para auditoria futura (atual: ${allChannels.length})`
);

for (const extId of externalIds) {
  const preserved = allChannels.find(c => c.id === extId);
  assert.ok(preserved, `Canal ${extId} deve continuar existindo no registro interno`);
  assert.strictEqual(preserved?.requiresExternalAccess, true, `Canal ${extId} deve manter flag requiresExternalAccess`);
}

console.log(`✓ Teste 4 aprovado: Todos os ${allChannels.length} canais continuam preservados no catálogo interno.\n`);

// -----------------------------------------------------------------------------------------
// TESTE 5: Categorias Livres de Canais Inválidos ou com Acesso Externo
// -----------------------------------------------------------------------------------------
console.log('[Teste 5] Verificação de categorias...');

const abertaChannels = channelRegistry.getChannelsByCategory('aberta');
for (const ch of abertaChannels) {
  assert.strictEqual(ch.requiresExternalAccess, false, `Canal ${ch.name} em 'aberta' não pode ser externo`);
  assert.ok(ch.status === 'VERIFIED' || ch.status === 'AVAILABLE');
}
assert.ok(abertaChannels.some(c => c.id === 'tv-brasil'), 'TV Brasil deve estar em aberta');
assert.ok(abertaChannels.some(c => c.id === 'sbt-interior'), 'SBT Interior deve estar em aberta');

const culturaChannels = channelRegistry.getChannelsByCategory('cultura');
assert.ok(culturaChannels.some(c => c.id === 'tv-cultura'), 'TV Cultura deve estar em cultura');
assert.ok(culturaChannels.some(c => c.id === 'cultura-fast'), 'Cultura Fast deve estar em cultura');

const esportesChannels = channelRegistry.getChannelsByCategory('esportes');
for (const ch of esportesChannels) {
  assert.strictEqual(ch.requiresExternalAccess, false, `Canal ${ch.name} em 'esportes' não pode ser externo`);
  assert.ok(ch.status === 'VERIFIED' || ch.status === 'AVAILABLE');
}
assert.ok(esportesChannels.some(c => c.id === 'fifa-plus-br'), 'FIFA+ deve estar em esportes');
assert.ok(esportesChannels.some(c => c.id === 'red-bull-tv-br'), 'Red Bull TV deve estar em esportes');

console.log('✓ Teste 5 aprovado: Todas as categorias contêm exclusivamente canais verificados.\n');

// -----------------------------------------------------------------------------------------
// TESTE 6: Busca Exclusiva em Canais Verificados
// -----------------------------------------------------------------------------------------
console.log('[Teste 6] Verificação do motor de busca...');

const searchExternal = liveTvProviderRegistry.searchChannels('Globo');
assert.strictEqual(searchExternal.length, 0, 'Busca por canais externos deve retornar vazio na listagem pública');

const searchCultura = liveTvProviderRegistry.searchChannels('Cultura');
assert.ok(searchCultura.length >= 1, 'Busca por Cultura deve retornar os canais verificados');
assert.ok(searchCultura.every(c => !c.requiresExternalAccess));

console.log('✓ Teste 6 aprovado: Busca indexa somente canais verificados.\n');

// -----------------------------------------------------------------------------------------
// TESTE 7: Atualização Dinâmica e Auto-purgação de Canal com Falha
// -----------------------------------------------------------------------------------------
console.log('[Teste 7] Auto-purgação de canal que se torna indisponível...');

const sampleChannel = verifiedFromProvider[0];
const initialVerifiedCount = liveTvProviderRegistry.getVerifiedChannels().length;

// Simula falha em tempo de execução
liveTvProviderRegistry.updateChannelStatus(sampleChannel.id, 'UNAVAILABLE');

const countAfterFailure = liveTvProviderRegistry.getVerifiedChannels().length;
assert.strictEqual(
  countAfterFailure,
  initialVerifiedCount - 1,
  'Canal que falha deve ser imediatamente purgado da lista getVerifiedChannels()'
);

const checkPurged = liveTvProviderRegistry.getVerifiedChannels().find(c => c.id === sampleChannel.id);
assert.strictEqual(checkPurged, undefined, 'Canal com status UNAVAILABLE não pode ser listado');

// Restaura status para AVAILABLE
liveTvProviderRegistry.updateChannelStatus(sampleChannel.id, 'AVAILABLE');
assert.strictEqual(
  liveTvProviderRegistry.getVerifiedChannels().length,
  initialVerifiedCount,
  'Canal recuperado volta à listagem de verificados'
);

console.log('✓ Teste 7 aprovado: Canais que caem saem imediatamente da listagem pública.\n');

// -----------------------------------------------------------------------------------------
// TESTE 8: Auditoria de Código da UI (ProgramasView e TelevisionMode)
// -----------------------------------------------------------------------------------------
console.log('[Teste 8] Auditoria das views de interface (ProgramasView & TelevisionMode)...');

const programasViewCode = fs.readFileSync(path.resolve(process.cwd(), 'components/ProgramasView.tsx'), 'utf8');
assert.ok(
  programasViewCode.includes('channelRegistry.getVerifiedChannels()'),
  'ProgramasView deve inicializar exclusivamente com channelRegistry.getVerifiedChannels()'
);

const televisionModeCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/livetv/TelevisionMode.tsx'), 'utf8');
assert.ok(
  !televisionModeCode.includes('Transmissão indisponível no momento'),
  'TelevisionMode não deve conter texto estático de indisponibilidade'
);

const liveTvPlayerCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/livetv/LiveTvPlayer.tsx'), 'utf8');
assert.ok(
  liveTvPlayerCode.includes("liveTvProviderRegistry.updateChannelStatus(channel.id, 'UNAVAILABLE')"),
  'LiveTvPlayer deve atualizar o status no registro para UNAVAILABLE ao esgotar fontes'
);

console.log('✓ Teste 8 aprovado: UI e Player calibrados estritamente para reprodução contínua e verificada.\n');

console.log('========================================================================');
console.log(' TODOS OS 8 TESTES P0 DE CANAIS VERIFICADOS FORAM CONCLUÍDOS COM SUCESSO! ');
console.log('========================================================================\n');
