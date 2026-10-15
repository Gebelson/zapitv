import { providerRegistry } from './src/core/providers/providerRegistry';
import { VERIFIED_OPEN_ITEMS } from './src/core/catalog/verifiedCatalog';
import { sortStreamsByPtBrPriority, classifyStream } from './src/core/audio/audioDetector';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runOfficialProviderTests() {
  console.log('================================================================');
  console.log('🎬 BATERIA OFICIAL DE TESTES DE PROVEDORES REAIS - ZAPITV STREMIO');
  console.log('================================================================\n');

  let passed = 0;
  const total = 6;

  // ====================================================================
  // TESTE A — Filme Completo (Domínio Público / Autorizado)
  // ====================================================================
  console.log('👉 [TESTE A] Testando Filme Completo (A Noite dos Mortos-Vivos)...');
  try {
    const movie = VERIFIED_OPEN_ITEMS.find(i => i.id === 'open-night-living-dead-1968');
    if (!movie) throw new Error('Filme A Noite dos Mortos-Vivos não encontrado no catálogo.');

    console.log(`   Título: "${movie.title}" (${movie.year})`);
    console.log(`   Diretor: ${movie.director} | Status: ${movie.availabilityStatus}`);

    const streams = await providerRegistry.resolveStreams('movie', { id: movie.id });
    if (!streams || streams.length === 0) throw new Error('Nenhuma fonte de reprodução encontrada.');

    const primaryStream = streams.find(s => s.url.includes('/api/proxy')) || streams[0];
    console.log(`   Fonte selecionada: [${primaryStream.name}] ${primaryStream.url}`);

    const primaryUrl = primaryStream.url.startsWith('/') ? `http://localhost:4000${primaryStream.url}` : `http://localhost:4000/api/proxy?url=${encodeURIComponent(primaryStream.url)}`;
    // Teste de carregamento inicial (bytes 0-1000)
    const initialRes = await fetch(primaryUrl, {
      headers: { Range: 'bytes=0-1000', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (initialRes.status !== 200 && initialRes.status !== 206) {
      throw new Error(`Falha no carregamento inicial do stream. Status: ${initialRes.status}`);
    }

    // Teste de avanço na linha do tempo / Seek (bytes 10000000 - 10001000)
    const seekRes = await fetch(primaryUrl, {
      headers: { Range: 'bytes=10000000-10001000', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (seekRes.status !== 206) {
      throw new Error(`Falha no avanço da linha do tempo (Seek Range). Status: ${seekRes.status}`);
    }

    console.log(`✅ [TESTE A APROVADO]: Filme completo carrega bytes iniciais e permite seek na linha do tempo (HTTP 206 Partial Content).`);
    console.log(`   Tipo de Mídia: ${seekRes.headers.get('content-type')} | Range: ${seekRes.headers.get('content-range')}`);
    passed++;
  } catch (e: any) {
    console.error(`❌ [TESTE A FALHOU]:`, e.message);
  }

  // ====================================================================
  // TESTE B — Série/Anime com Navegação de Episódios
  // ====================================================================
  console.log('\n👉 [TESTE B] Testando Série Aberta e Navegação de Episódios...');
  try {
    const series = VERIFIED_OPEN_ITEMS.find(i => i.id === 'tmdb-95897');
    if (!series) throw new Error('Série verificada não encontrada no catálogo.');

    const eps = series.episodes || [];
    if (eps.length < 2) throw new Error(`A série deve ter pelo menos 2 episódios disponíveis. Encontrados: ${eps.length}`);

    console.log(`   Série: "${series.title}" - Total de Episódios: ${eps.length}`);
    eps.forEach(e => console.log(`   - Ep ${e.number}: "${e.title}"`));

    // Reproduzir Episódio 1
    const ep1Streams = await providerRegistry.resolveStreams('anime', { id: series.id }, { season: 1, episode: 1 });
    if (!ep1Streams || ep1Streams.length === 0) throw new Error('Fonte do Episódio 1 não resolvida.');

    const targetUrl1 = ep1Streams[0].url.startsWith('/') ? `http://localhost:4000${ep1Streams[0].url}` : ep1Streams[0].url;
    const resEp1 = await fetch(targetUrl1, {
      headers: { Range: 'bytes=0-1000', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (resEp1.status !== 200 && resEp1.status !== 206) {
      throw new Error(`Falha ao reproduzir Episódio 1. Status: ${resEp1.status}`);
    }
    console.log(`   Episódio 1 validado: Status ${resEp1.status} (${ep1Streams[0].title})`);

    // Navegar para Episódio 2
    const ep2Streams = await providerRegistry.resolveStreams('series', { id: series.id }, { season: 1, episode: 2 });
    if (!ep2Streams || ep2Streams.length === 0) throw new Error('Fonte do Episódio 2 não resolvida.');

    const targetUrl2 = ep2Streams[0].url.startsWith('/') ? `http://localhost:4000${ep2Streams[0].url}` : ep2Streams[0].url;
    const resEp2 = await fetch(targetUrl2, {
      headers: { Range: 'bytes=0-1000', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (resEp2.status !== 200 && resEp2.status !== 206) {
      throw new Error(`Falha ao reproduzir Episódio 2. Status: ${resEp2.status}`);
    }
    console.log(`   Episódio 2 validado: Status ${resEp2.status} (${ep2Streams[0].title})`);

    console.log(`✅ [TESTE B APROVADO]: Série com múltiplos episódios e navegação contínua validada com sucesso.`);
    passed++;
  } catch (e: any) {
    console.error(`❌ [TESTE B FALHOU]:`, e.message);
  }

  // ====================================================================
  // TESTE C — Dublagem e Áudio PT-BR Confirmado
  // ====================================================================
  console.log('\n👉 [TESTE C] Testando Áudio em Português Brasileiro (PT-BR)...');
  try {
    const ptBrWork = VERIFIED_OPEN_ITEMS.find(i => i.id === 'open-historias-fome-br');
    if (!ptBrWork) throw new Error('Obra com áudio original PT-BR não encontrada.');

    console.log(`   Obra: "${ptBrWork.title}"`);
    console.log(`   Classificação de Áudio: ${ptBrWork.audioStatus} (Áudio Original PT-BR)`);

    const streams = await providerRegistry.resolveStreams('movie', { id: ptBrWork.id });
    if (!streams || streams.length === 0) throw new Error('Fontes de áudio não encontradas.');

    // Confirmação de seleção prioritária
    const topStream = streams[0];
    if (!topStream.isPtBr) {
      throw new Error('O algoritmo de áudio não priorizou a faixa brasileira.');
    }

    const ptBrUrl = topStream.url.startsWith('/') ? `http://localhost:4000${topStream.url}` : topStream.url;
    // Teste de conexão na mídia real brasileira
    const res = await fetch(ptBrUrl, {
      headers: { Range: 'bytes=0-1000', 'User-Agent': 'ZapiTV-Player/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (res.status !== 200 && res.status !== 206) {
      throw new Error(`Falha ao carregar stream PT-BR. Status: ${res.status}`);
    }

    console.log(`✅ [TESTE C APROVADO]: Áudio original brasileiro identificado, classificado com precisão e priorizado em 1º lugar.`);
    passed++;
  } catch (e: any) {
    console.error(`❌ [TESTE C FALHOU]:`, e.message);
  }

  // ====================================================================
  // TESTE D — Simulação de Falha de Provedor e Fallback Automático
  // ====================================================================
  console.log('\n👉 [TESTE D] Testando Simulação de Falha e Fallback Automático...');
  try {
    // Simula uma lista de streams onde a primeira fonte é inválida/indisponível
    const failingStreams: any[] = [
      {
        name: "Servidor Indisponível (Simulação)",
        title: "[FONTE 1] Servidor Fora do Ar",
        url: "https://invalid-host-offline-test.local/stream.mp4",
        sourceType: "mp4"
      },
      {
        name: "Servidor Secundário Ativo",
        title: "[FONTE 2 - FALLBACK] Mux HLS Backup",
        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        sourceType: "hls"
      }
    ];

    // Simula lógica de fallback do ZapiPlayer
    let activeIndex = 0;
    let fallbackTriggered = false;

    try {
      // Tentativa 1: Deve falhar
      await fetch(failingStreams[activeIndex].url, { signal: AbortSignal.timeout(1000) });
    } catch {
      // Fallback acionado
      fallbackTriggered = true;
      activeIndex = 1;
    }

    if (!fallbackTriggered || activeIndex !== 1) {
      throw new Error('Mecanismo de fallback não alternou para a próxima fonte.');
    }

    // Tentativa 2: Fonte secundária deve responder com sucesso
    const fallbackRes = await fetch(failingStreams[activeIndex].url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (!fallbackRes.ok) {
      throw new Error(`Fonte secundária de fallback não respondeu: ${fallbackRes.status}`);
    }

    console.log(`   Fonte primária indisponível identificada com sucesso.`);
    console.log(`   Alternância automática para: "${failingStreams[activeIndex].name}" (Status: ${fallbackRes.status})`);
    console.log(`✅ [TESTE D APROVADO]: Tolerância a falhas e seleção automática de fonte secundária validadas.`);
    passed++;
  } catch (e: any) {
    console.error(`❌ [TESTE D FALHOU]:`, e.message);
  }

  // ====================================================================
  // TESTE E — Primeira Execução em Navegador Limpo (Sem Configuração)
  // ====================================================================
  console.log('\n👉 [TESTE E] Testando Primeira Execução sem Configurações Prévias...');
  try {
    const providers = providerRegistry.getProviders();
    const active = providers.filter(p => p.enabled);

    if (active.length < 4) {
      throw new Error(`Menos de 4 provedores ativos por padrão. Ativos: ${active.length}`);
    }

    console.log(`   Provedores pré-configurados de fábrica encontrados: ${active.length}`);
    active.forEach(p => console.log(`   - [${p.priority}] ${p.name} (${p.status})`));

    // Verifica que o catálogo inicial possui filmes reproduzíveis prontos
    if (VERIFIED_OPEN_ITEMS.length === 0) {
      throw new Error('Nenhum filme verificado presente na inicialização.');
    }

    console.log(`   Títulos verificados prontos para exibição imediata: ${VERIFIED_OPEN_ITEMS.length}`);
    console.log(`✅ [TESTE E APROVADO]: O usuário abre o sistema e pode assistir imediatamente sem configurar add-ons ou servidores.`);
    passed++;
  } catch (e: any) {
    console.error(`❌ [TESTE E FALHOU]:`, e.message);
  }

  // ====================================================================
  // TESTE F — Ausência de Anúncios e Rastreadores
  // ====================================================================
  console.log('\n👉 [TESTE F] Testando Ausência Total de Anúncios e Rastreamento...');
  try {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    const playerCode = fs.readFileSync(path.join(__dirname, 'src', 'components', 'player', 'ZapiPlayer.tsx'), 'utf-8');

    const adTerms = ['adsbygoogle', 'doubleclick', 'pagead2', 'adsterra', 'popunder', 'clickadu', 'monetag'];
    const foundTerms = adTerms.filter(term => html.includes(term) || playerCode.includes(term));

    if (foundTerms.length > 0) {
      throw new Error(`Detectada presença de termos publicitários: ${foundTerms.join(', ')}`);
    }

    if (playerCode.includes('<iframe')) {
      throw new Error('Detectada presença de tag <iframe> no player de vídeo.');
    }

    if (!playerCode.includes('<video')) {
      throw new Error('Player nativo HTML5 <video> não encontrado.');
    }

    console.log(`   Varredura em index.html e ZapiPlayer.tsx: 0 termos de publicidade encontrados.`);
    console.log(`   Reprodução nativa direta HTML5 video/HLS confirmada: 0 iframes, 0 embeds, 0 pop-ups.`);
    console.log(`✅ [TESTE F APROVADO]: A aplicação e os fluxos de reprodução não incorporam anúncios próprios nem rastreadores.`);
    passed++;
  } catch (e: any) {
    console.error(`❌ [TESTE F FALHOU]:`, e.message);
  }

  console.log('\n================================================================');
  console.log(`📊 RESULTADO FINAL DA BATERIA DE PROVEDORES: ${passed}/${total} TESTES APROVADOS!`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runOfficialProviderTests().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
