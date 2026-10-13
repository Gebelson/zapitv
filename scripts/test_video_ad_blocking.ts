import { videoAdBlocker, FramePixelData } from '../src/core/security/videoAdBlocker';
import { streamValidator } from '../src/core/providers/streamValidator';
import { StremioStream } from '../src/core/stremio/stremioTypes';

// Utilitário para criar FramePixelData sintético 320x180
function createSyntheticFrame(width = 320, height = 180, fill: (x: number, y: number) => [number, number, number]): FramePixelData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b] = fill(x, y);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTE COMPLETO: BLOQUEIO RÍGIDO DE PROPAGANDA EMBUTIDA (1XBET)');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
      if (details) console.log(`     └─ ${details}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error(`     └─ ${details}`);
    }
  }

  // -------------------------------------------------------------
  // TESTE 1: MÍDIA LIMPA (Sem banners, sem tags de apostas)
  // -------------------------------------------------------------
  console.log('--- TESTE 1: MÍDIA LIMPA ---');
  const cleanFrame = createSyntheticFrame(320, 180, (x, y) => {
    // Cena cinematográfica natural (gradiente de pôr do sol / anime)
    const r = Math.min(255, 40 + Math.floor((y / 180) * 120));
    const g = Math.min(255, 30 + Math.floor((x / 320) * 80));
    const b = Math.min(255, 50 + Math.floor(((x + y) / 500) * 60));
    return [r, g, b];
  });

  const cleanAnalysis = videoAdBlocker.analyzeFrameData(cleanFrame, 3);
  assert(cleanAnalysis.riskScore === 0, 'Frame limpo possui riskScore = 0', `Score retornado: ${cleanAnalysis.riskScore}`);
  assert(cleanAnalysis.evidences.length === 0, 'Frame limpo não gera evidências de propaganda');

  const cleanStream: StremioStream = {
    name: 'ZapiTV Direct',
    title: 'Doraemon: Nobita and the Birth of Japan (1080p) [Dual]',
    url: 'https://cdn.example.com/doraemon_clean_1080p.mp4',
    quality: '1080p',
    isPtBr: true
  };
  const cleanMetaEval = videoAdBlocker.evaluateStream(cleanStream, 'Doraemon');
  assert(cleanMetaEval.status === 'limpo', 'Metadados de stream limpo avaliados como "limpo"');
  assert(streamValidator.isStreamMatchingTargetTitle(cleanStream, 'Doraemon'), 'Validador de stream aceita stream limpo');

  // -------------------------------------------------------------
  // TESTE 2: MÍDIA COM BANNER 1XBET NO TOPO
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: MÍDIA COM BANNER 1XBET NO TOPO ---');
  const frameWith1xBet = createSyntheticFrame(320, 180, (x, y) => {
    // Top banner de 0 a 18% da altura (y < 32): Fundo azul 1xBet (#0d47a1) com texto branco contrastante alternado
    if (y < 30) {
      // Simula caracteres brancos do texto "1XBET APOSTAS" a cada 6 pixels
      const isCharPixel = (x % 6 === 0 || x % 6 === 1) && y >= 8 && y <= 22;
      if (isCharPixel) {
        return [255, 255, 255]; // Texto branco de alto contraste
      }
      return [13, 71, 161]; // Azul padrão 1xBet (#0d47a1)
    }
    // Resto do quadro é cena cinematográfica
    return [50, 45, 60];
  });

  const ad1xBetAnalysis = videoAdBlocker.analyzeFrameData(frameWith1xBet, 8);
  assert(ad1xBetAnalysis.riskScore >= 90, 'Frame com banner 1xBet gera riskScore >= 90', `Score: ${ad1xBetAnalysis.riskScore}`);
  assert(
    ad1xBetAnalysis.evidences.some(e => e.region === 'top_banner' && e.description.includes('1xBet')),
    'Identificou banner com assinatura cromática 1xBet no topo',
    ad1xBetAnalysis.evidences[0]?.description
  );

  // Metadados com release 1xBet
  const stream1xBetMeta: StremioStream = {
    name: 'TorrentGalaxy [1XBET]',
    title: 'Doraemon Nobita [HDTC-1XBET] 1080p Dual Áudio',
    url: 'https://seed.example.com/doraemon_1xbet.mkv',
    isPtBr: true
  };
  const eval1xBetMeta = videoAdBlocker.evaluateStream(stream1xBetMeta, 'Doraemon');
  assert(eval1xBetMeta.status === 'bloqueado por propaganda embutida', 'Stream com release [1XBET] bloqueado por metadados');
  assert(eval1xBetMeta.riskScore >= 95, 'Risk score de metadados 1xBet é >= 95', `Score: ${eval1xBetMeta.riskScore}`);
  assert(!streamValidator.isStreamMatchingTargetTitle(stream1xBetMeta, 'Doraemon'), 'Validador rejeita stream com 1xBet');

  // -------------------------------------------------------------
  // TESTE 3: MÍDIA COM WATERMARK PROMOCIONAL NO CANTO
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: MÍDIA COM WATERMARK PROMOCIONAL ---');
  const frameWithWatermark = createSyntheticFrame(320, 180, (x, y) => {
    // Watermark promocional no canto superior direito (x > 230, y < 40)
    if (x > 240 && x < 310 && y > 5 && y < 35) {
      // Badge amarela vibrante "BÔNUS CASSINO" (r: 250, g: 200, b: 10)
      return [250, 200, 10];
    }
    // Cena normal
    return [40, 40, 40];
  });

  const watermarkAnalysis = videoAdBlocker.analyzeFrameData(frameWithWatermark, 15);
  assert(watermarkAnalysis.riskScore >= 80, 'Frame com watermark promocional gera riskScore >= 80', `Score: ${watermarkAnalysis.riskScore}`);
  assert(
    watermarkAnalysis.evidences.some(e => e.region === 'top_right'),
    'Identificou watermark promocional no canto superior direito',
    watermarkAnalysis.evidences[0]?.description
  );

  // -------------------------------------------------------------
  // TESTE 4: PUBLICIDADE PERSISTENTE NO TOPO (TEMPORAL)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 4: BANNER ESTÁTICO PERSISTENTE (TEMPORAL) ---');
  // Frame A aos 3s: cena A com banner estático cinza escuro/preto no topo
  const frameA = createSyntheticFrame(320, 180, (x, y) => {
    if (y < 25) {
      return [20, 20, 20]; // Faixa estática do banner
    }
    return [200, 100, 50]; // Cena A clara e avermelhada
  });

  // Frame B aos 8s: cena B (mudança de ângulo da câmera/ação no filme), mas com O MESMO banner no topo
  const frameB = createSyntheticFrame(320, 180, (x, y) => {
    if (y < 25) {
      return [20, 20, 20]; // EXATAMENTE a mesma faixa no topo (diferença = 0)
    }
    return [30, 80, 190]; // Cena B azulada e escura (grande diferença no centro)
  });

  const temporalAnalysis = videoAdBlocker.analyzeTemporalPersistence(frameA, frameB);
  assert(temporalAnalysis.isPersistentOverlay === true, 'Detectou persistência matemática de banner sobre filme');
  assert(temporalAnalysis.region === 'top_banner', 'Localizou a região persistente no top_banner');
  assert(temporalAnalysis.confidence >= 0.9, 'Confiança da análise temporal >= 0.90', `Confiança: ${temporalAnalysis.confidence}`);

  // -------------------------------------------------------------
  // TESTE 5: FALLBACK AUTOMÁTICO E PRESERVAÇÃO DE DUBLAGEM PT-BR
  // -------------------------------------------------------------
  console.log('\n--- TESTE 5: FALLBACK AUTOMÁTICO E PRESERVAÇÃO DE PRIORIDADE PT-BR ---');
  const candidateStreams: StremioStream[] = [
    {
      name: 'Fonte 1 Contaminada (1xBet)',
      title: 'Doraemon 1080p Dublado [1XBET Exclusivo]',
      url: 'https://badcdn.com/1xbet_stream.mp4',
      quality: '1080p',
      isPtBr: true // Dublado, porém contaminado!
    },
    {
      name: 'Fonte 2 Limpa PT-BR',
      title: 'Doraemon: O Filme Dublado PT-BR Oficial',
      url: 'https://clean-cdn.com/doraemon_dublado_oficial.mp4',
      quality: '1080p',
      isPtBr: true // Dublado limpo
    },
    {
      name: 'Fonte 3 Limpa Legendada',
      title: 'Doraemon 1080p Legendado Japonês',
      url: 'https://clean-cdn.com/doraemon_sub.mp4',
      quality: '1080p',
      isPtBr: false
    }
  ];

  const filtered = streamValidator.filterCleanStreams(candidateStreams, 'Doraemon');
  assert(filtered.length === 2, 'Filtrou e removeu a fonte contaminada com 1xBet', `Restantes: ${filtered.length}`);
  assert(filtered[0].url === 'https://clean-cdn.com/doraemon_dublado_oficial.mp4', 'Primeira fonte selecionada é a dublada PT-BR LIMPA');
  assert(filtered[0].isPtBr === true, 'Prioridade de áudio PT-BR preservada com sucesso');

  // -------------------------------------------------------------
  // TESTE 6: CONTEÚDO INDISPONÍVEL SE TODAS AS FONTES FOREM CONTAMINADAS
  // -------------------------------------------------------------
  console.log('\n--- TESTE 6: REJEIÇÃO TOTAL SE SÓ HOUVER FONTES CONTAMINADAS ---');
  const onlyContaminatedStreams: StremioStream[] = [
    {
      name: 'Provedor A (1xBet)',
      title: 'Filme 1080p 1xbet telecine rip',
      url: 'https://bad1.com/stream.mp4'
    },
    {
      name: 'Provedor B (Cassino)',
      title: 'Filme HD casino promo slots',
      url: 'https://bad2.com/video.mp4'
    },
    {
      name: 'Provedor C (Casa de Aposta)',
      title: 'Filme 720p casa de aposta bonus',
      url: 'https://bad3.com/video.mp4'
    }
  ];

  const noCleanAvailable = streamValidator.filterCleanStreams(onlyContaminatedStreams, 'Filme');
  assert(noCleanAvailable.length === 0, 'Todas as fontes contaminadas foram rejeitadas (lista vazia)');
  console.log('     └─ Resultado: Nenhuma fonte contaminada é exibida ao usuário; conteúdo é marcado como indisponível.');

  // -------------------------------------------------------------
  // TESTE 7: BLOQUEIO E DESBLOQUEIO MANUAL NO PAINEL ADMINISTRATIVO
  // -------------------------------------------------------------
  console.log('\n--- TESTE 7: GERENCIAMENTO MANUAL NO PAINEL ADMINISTRATIVO ---');
  const manualUrl = 'https://stream.teste/manual_ad_stream.mp4';
  videoAdBlocker.blockStreamManually(manualUrl, 'Banner promocional detectado visualmente por moderador', 'Teste Admin');
  
  assert(videoAdBlocker.isStreamBlocked(manualUrl), 'Stream está bloqueado após ação manual');
  const records = videoAdBlocker.getAuditRecords();
  const manualRecord = records.find(r => r.streamUrl === manualUrl);
  assert(manualRecord !== undefined && manualRecord.status === 'bloqueado por propaganda embutida', 'Registro de bloqueio manual gravado no histórico administrativo');

  // Desbloqueio
  videoAdBlocker.unblockStream(manualUrl);
  assert(!videoAdBlocker.isStreamBlocked(manualUrl), 'Stream desbloqueado com sucesso pelo administrador');
  assert(videoAdBlocker.evaluateStream({ url: manualUrl } as StremioStream).status === 'limpo', 'Status restaurado para "limpo"');

  console.log('\n================================================================');
  console.log(`📊 RESULTADO DOS TESTES: ${passedTests} de ${totalTests} APROVADOS (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 TODOS OS REQUISITOS DA NOVA REGRA OBRIGATÓRIA FORAM VALIDADOS COM SUCESSO!');
    process.exit(0);
  } else {
    console.error('⚠️ ALGUNS TESTES FALHARAM!');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
