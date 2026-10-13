import { channelRegistry } from './src/core/livetv/channelRegistry';
import { epgService } from './src/core/livetv/epgService';
import { liveTvPreferences } from './src/core/livetv/liveTvPreferences';
import { channelHealthService } from './src/core/livetv/channelHealthService';

async function runTestSuite() {
  console.log('=== TEST SUITE: ZAPITV LIVE TV & MODO TELEVISÃO ===\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // 1. Carregamento dos canais
  const channels = channelRegistry.getAllChannels();
  assert('Carregamento de canais não-vazio', channels.length > 0);
  assert('Contagem de canais calculada dinamicamente', channelRegistry.getAvailableCount() === channels.length);

  // 2. Metadados e Logotipos
  const hasLogos = channels.every(c => Boolean(c.logo && c.name && c.streamUrl));
  assert('Todos os canais possuem logo, nome e streamUrl válidos', hasLogos);

  // 3. Categorias válidas
  const cultura = channelRegistry.getChannelById('tv-cultura');
  assert('Canal TV Cultura cadastrado na categoria correta (aberta)', cultura?.category === 'aberta');
  const recNews = channelRegistry.getChannelById('record-news');
  assert('Canal Record News cadastrado na categoria correta (noticias)', recNews?.category === 'noticias');

  // 4. EPG e Fuso Horário de Brasília
  if (cultura) {
    const epg = epgService.getCurrentEpgState(cultura);
    assert('EPG calcula programa atual com título válido', Boolean(epg.currentProgram.title));
    assert('EPG calcula horários de início e término', Boolean(epg.formattedStartTime && epg.formattedEndTime));
    assert('EPG calcula barra de progresso entre 0% e 100%', epg.progressPercent >= 0 && epg.progressPercent <= 100);
    assert('EPG identifica próximo programa do canal', Boolean(epg.nextProgram?.title));
  }

  // 5. Preferências e Favoritos
  const testChannelId = 'tv-cultura';
  const initialFav = liveTvPreferences.isFavorite(testChannelId);
  const toggled = liveTvPreferences.toggleFavorite(testChannelId);
  assert('Alternância de favorito inverte o estado', toggled === !initialFav);
  // Reverte
  liveTvPreferences.toggleFavorite(testChannelId);

  liveTvPreferences.setLastWatched('record-news');
  assert('Armazena último canal assistido', liveTvPreferences.getState().lastWatchedChannelId === 'record-news');

  // 6. Resolução de URL para reprodução com bypass de CORS
  if (cultura) {
    const playableUrl = channelHealthService.getPlayableUrl(cultura);
    assert('Gera URL de reprodução acessível', Boolean(playableUrl));
  }

  // 7. Filtro por Categoria
  const newsChannels = channelRegistry.getChannelsByCategory('noticias');
  assert('Filtra canais de notícias com precisão', newsChannels.some(c => c.id === 'record-news'));

  console.log(`\n=== RESULTADO: ${passed} / ${total} TESTES APROVADOS ===`);
}

runTestSuite().catch(console.error);
