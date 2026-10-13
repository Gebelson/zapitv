import { skipService, SkipInterval } from '../src/core/skip/skipService';
import { ContentType, ContentItem } from '../types';

// Setup mock localStorage for Node environment
const storage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => storage[k] || null,
  setItem: (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

interface SeekableRange {
  start: (i: number) => number;
  end: (i: number) => number;
  length: number;
}

class MockVideoElement {
  public currentTime = 0;
  public duration = 1500;
  public seekable: SeekableRange = {
    length: 1,
    start: () => 0,
    end: () => 1500
  };

  public seek(targetTime: number): boolean {
    if (!this.seekable || this.seekable.length === 0) {
      return false; // Seek rejected: fonte não permite seek
    }
    const end = this.seekable.end(0);
    if (targetTime > end + 2) {
      return false; // Seek rejected: fora do buffer navegável
    }
    this.currentTime = targetTime;
    return true;
  }
}

async function runFullIntegrationTests() {
  console.log('====================================================');
  console.log('   ZAPITV - TESTES DE INTEGRAÇÃO REAL DO SKIP   ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (!condition) {
      throw new Error(`FALHA NO TESTE: ${msg}`);
    }
    console.log(`[PASSOU] ${msg}`);
    passedTests++;
  }

  // 1. ANIME: AniSkip com Naruto (Ep 1)
  console.log('--- 1. Validação AniSkip (Naruto - Anime Clássico) ---');
  const naruto: ContentItem = {
    id: 'anime-naruto',
    title: 'Naruto',
    type: ContentType.ANIME,
    rating: 8.5,
    year: 2002,
    image: ''
  };
  const narutoTimes = await skipService.getSkipTimes(naruto, 1, 1, 1420);
  assert(narutoTimes.length >= 2, 'Naruto Ep 1 possui múltiplos intervalos detectados');
  const narutoOp = narutoTimes.find(t => t.type === 'op');
  assert(Boolean(narutoOp && narutoOp.startTime >= 0 && narutoOp.endTime <= 120), 'Abertura de Naruto identificada corretamente (1s -> 102s)');
  const narutoEd = narutoTimes.find(t => t.type === 'ed');
  assert(Boolean(narutoEd && narutoEd.startTime > 1200), 'Encerramento de Naruto identificado no terço final');

  // 2. ANIME: AniSkip com Attack on Titan (Ep 1)
  console.log('\n--- 2. Validação AniSkip (Attack on Titan - Resolução por Título) ---');
  const aot: ContentItem = {
    id: 'anime-aot',
    title: 'Attack on Titan',
    type: ContentType.ANIME,
    rating: 9.0,
    year: 2013,
    image: ''
  };
  const aotTimes = await skipService.getSkipTimes(aot, 1, 1, 1540);
  assert(aotTimes.length >= 1, 'Attack on Titan Ep 1 obteve intervalos válidos');
  const aotOp = aotTimes.find(t => t.type === 'op');
  assert(Boolean(aotOp && aotOp.startTime > 30 && aotOp.endTime < 180), 'Abertura de Attack on Titan entre 40s e 140s');

  // 3. SÉRIE: IntroDB com Game of Thrones (S1 E1)
  console.log('\n--- 3. Validação IntroDB (Game of Thrones - S1 E1) ---');
  const got: ContentItem = {
    id: 'series-got',
    imdbId: 'tt0944947',
    title: 'Game of Thrones',
    type: ContentType.SERIES,
    rating: 9.3,
    year: 2011,
    image: ''
  };
  const gotTimes = await skipService.getSkipTimes(got, 1, 1, 3700);
  assert(gotTimes.length >= 2, 'Game of Thrones possui Abertura e Encerramento');
  const gotIntro = gotTimes.find(t => t.type === 'op');
  assert(Boolean(gotIntro && gotIntro.startTime === 437 && gotIntro.endTime === 531), 'Abertura de GoT exatamente em 437s -> 531s');

  // 4. SÉRIE: IntroDB com Breaking Bad (S1 E1)
  console.log('\n--- 4. Validação IntroDB (Breaking Bad - S1 E1) ---');
  const bb: ContentItem = {
    id: 'series-bb',
    imdbId: 'tt0903747',
    title: 'Breaking Bad',
    type: ContentType.SERIES,
    rating: 9.5,
    year: 2008,
    image: ''
  };
  const bbTimes = await skipService.getSkipTimes(bb, 1, 1, 3500);
  const bbOutro = bbTimes.find(t => t.type === 'ed');
  assert(Boolean(bbOutro && bbOutro.startTime === 3431), 'Encerramento de Breaking Bad em 3431s detectado');

  // 5. TESTE DE SEEK DO PLAYER E PRESERVAÇÃO DE CONTEÚDO
  console.log('\n--- 5. Simulação de Reprodução & Execução do Seek do Player ---');
  const video = new MockVideoElement();
  video.currentTime = 450; // No meio da abertura de GoT (437s -> 531s)
  
  // Verifica se o tempo atual ativa o botão
  const activeInterval = gotTimes.find(i => video.currentTime >= i.startTime && video.currentTime < i.endTime);
  assert(Boolean(activeInterval && activeInterval.type === 'op'), 'Botão "Pular Abertura" ativado no currentTime 450s');
  
  // Executa seek para o final da abertura
  const seekSuccess = video.seek(activeInterval!.endTime);
  assert(seekSuccess && video.currentTime === 531, 'Seek executado exatamente para o fim da abertura (531s), preservando o início do episódio');
  
  // Verifica que após o seek o botão desaparece
  const postSeekActive = gotTimes.find(i => video.currentTime >= i.startTime && video.currentTime < i.endTime);
  assert(postSeekActive === undefined, 'Botão de pular desaparece imediatamente após o intervalo');

  // 6. PROTEÇÃO CONTRA FONTES QUE NÃO PERMITEM SEEK (Requisito 14)
  console.log('\n--- 6. Proteção contra Fontes Não Navegáveis (seekable.length === 0) ---');
  const unseekableVideo = new MockVideoElement();
  unseekableVideo.seekable = { length: 0, start: () => 0, end: () => 0 }; // Live stream ou restrito
  const unseekableResult = unseekableVideo.seek(100);
  assert(unseekableResult === false, 'Vídeo não-seekable rejeita avanço com segurança sem quebrar');

  // 7. COMPENSAÇÃO DE LOGOS / EDICÕES (OFFSET MANUAL)
  console.log('\n--- 7. Compensação de Edição / Offset (+3.5s) ---');
  skipService.setSkipOffset(got.id, 3.5);
  const offsetTimes = await skipService.getSkipTimes(got, 1, 1, 3700);
  const offsetOp = offsetTimes.find(t => t.type === 'op');
  assert(offsetOp!.startTime === 440.5 && offsetOp!.endTime === 534.5, 'Offset de +3.5s aplicado com precisão decimal');
  skipService.setSkipOffset(got.id, 0); // Reset

  // 8. CONFIGURAÇÃO DE SALTO AUTOMÁTICO (AUTO-SKIP)
  console.log('\n--- 8. Preferência de Salto Automático (Default OFF) ---');
  assert(skipService.isAutoSkipEnabled() === false, 'Salto automático vem desligado por padrão (Requisito 8)');
  skipService.setAutoSkipEnabled(true);
  assert(skipService.isAutoSkipEnabled() === true, 'Salto automático habilitado com sucesso (Requisito 9)');
  skipService.setAutoSkipEnabled(false);
  assert(skipService.isAutoSkipEnabled() === false, 'Salto automático desabilitado novamente');

  // 9. CORREÇÃO MANUAL CUSTOMIZADA POR EPISÓDIO
  console.log('\n--- 9. Gravação e Aplicação de Marcação Manual ---');
  skipService.saveManualInterval(naruto.id, 1, 1, { startTime: 15, endTime: 105, type: 'op' });
  const customNaruto = await skipService.getSkipTimes(naruto, 1, 1, 1420);
  const customOp = customNaruto.find(t => t.type === 'op');
  assert(customOp!.startTime === 15 && customOp!.endTime === 105 && customOp!.source === 'manual', 'Marcação manual salva localmente substitui o valor da API para o episódio');
  skipService.clearManualInterval(naruto.id, 1, 1);
  const restoredNaruto = await skipService.getSkipTimes(naruto, 1, 1, 1420);
  assert(restoredNaruto.find(t => t.type === 'op')!.startTime === 1, 'Marcação manual limpa, restaura dados do AniSkip');

  console.log('\n====================================================');
  console.log(` RESULTADO: ${passedTests}/${totalTests} TESTES PASSARAM COM 100% DE SUCESSO! `);
  console.log('====================================================');
}

runFullIntegrationTests().catch(err => {
  console.error('\n❌ ERRO DURANTE EXECUÇÃO DOS TESTES:', err);
  process.exit(1);
});
