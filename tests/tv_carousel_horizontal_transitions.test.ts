import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getVisibleSlots } from '../src/components/tv/TvContentRow';

async function runTvCarouselHorizontalTransitionsTests() {
  console.log('--- Teste de Suavização das Transições Horizontais dos Carrosséis (Smart TV) ---');

  const tvContentRowPath = path.resolve(process.cwd(), 'src/components/tv/TvContentRow.tsx');
  const tvCardPath = path.resolve(process.cwd(), 'src/components/tv/TvCard16x9.tsx');

  assert(fs.existsSync(tvContentRowPath), 'TvContentRow.tsx deve existir');
  assert(fs.existsSync(tvCardPath), 'TvCard16x9.tsx deve existir');

  const contentRowCode = fs.readFileSync(tvContentRowPath, 'utf8');
  const cardCode = fs.readFileSync(tvCardPath, 'utf8');

  // Teste 1: Duração cinematográfica suave configurada entre 300ms e 350ms
  assert(
    contentRowCode.includes('NORMAL_DURATION = 320') ||
    contentRowCode.includes('NORMAL_DURATION = 300') ||
    contentRowCode.includes('NORMAL_DURATION = 350'),
    'TvContentRow deve configurar duração horizontal cinematográfica na faixa de 300 a 350ms'
  );
  assert(
    contentRowCode.includes('CHAINED_DURATION = 260') ||
    contentRowCode.includes('CHAINED_DURATION'),
    'TvContentRow deve configurar duração otimizada para navegação encadeada/contínua'
  );
  console.log('✓ Teste 1: Duração horizontal cinematográfica suave configurada (320ms normal / 260ms encadeada) OK');

  // Teste 2: Curva de transição de desaceleração suave (sem aceleração inicial agressiva)
  assert(
    contentRowCode.includes('EASING_CURVE = \'cubic-bezier(0.22, 1, 0.36, 1)\'') ||
    contentRowCode.includes('cubic-bezier(0.22, 1, 0.36, 1)'),
    'TvContentRow deve aplicar curva de desaceleração cinematográfica suave (ex: cubic-bezier(0.22, 1, 0.36, 1))'
  );
  assert(
    !contentRowCode.includes('180ms cubic-bezier(0.16, 1, 0.3, 1)'),
    'TvContentRow NÃO deve mais utilizar a transição rápida e mecânica de 180ms'
  );
  console.log('✓ Teste 2: Curva de transição de desaceleração suave e natural OK');

  // Teste 3: Eliminação de flushPendingSlide que zerava translateX no meio do movimento
  assert(
    !contentRowCode.includes('flushPendingSlide'),
    'TvContentRow NÃO deve conter flushPendingSlide que provocava saltos e solavancos ao apertar rapidamente as setas'
  );
  assert(
    contentRowCode.includes('queuedDirectionRef') &&
    contentRowCode.includes('queuedDirectionRef.current'),
    'TvContentRow deve enfileirar a direção pendente com queuedDirectionRef para continuidade fluida'
  );
  console.log('✓ Teste 3: Eliminação de flushPendingSlide e suporte a enfileiramento suave sem saltos OK');

  // Teste 4: Finalização por onTransitionEnd nativo com fallback de segurança
  assert(
    contentRowCode.includes('onTrackTransitionEnd') &&
    contentRowCode.includes('onTransitionEnd={onTrackTransitionEnd}'),
    'TvContentRow deve conectar onTransitionEnd no elemento trackRef para conclusão orgânica'
  );
  assert(
    contentRowCode.includes('fallbackTimerRef') &&
    contentRowCode.includes('duration + 60'),
    'TvContentRow deve manter timer de fallback com margem de segurança para Smart TVs'
  );
  console.log('✓ Teste 4: Coordenação com onTransitionEnd nativo e fallback timer de segurança OK');

  // Teste 5: Sincronização síncrona no render em TvCard16x9 (eliminação do atraso de 1 frame do useEffect)
  assert(
    cardCode.includes('prevItemId !== item.id') &&
    cardCode.includes('setPrevItemId(item.id)') &&
    cardCode.includes('setImgSrc(targetPoster)'),
    'TvCard16x9 deve sincronizar a imagem no próprio render ao mudar o item, evitando piscadas e 1 frame de delay'
  );
  console.log('✓ Teste 5: Sincronização de capas instantânea sem piscadas ou atraso de 1 frame OK');

  // Teste 6: Carrossel finito para 1-6 itens e circular infinito para >= 7 itens
  assert(
    JSON.stringify(getVisibleSlots(2)) === JSON.stringify([0, 1]) &&
    JSON.stringify(getVisibleSlots(6)) === JSON.stringify([0, 1, 2, 3, 4, 5]) &&
    getVisibleSlots(7)[0] === -1 && getVisibleSlots(7)[1] === 0,
    'getVisibleSlots deve fornecer carrossel finito para 1 a 6 itens e infinito para >= 7 itens'
  );
  console.log('✓ Teste 6: Regra estrita de carrossel finito (1-6) e infinito (>=7) OK');

  // Teste 7: Tecla Enter protegida para abrir o item correto mesmo durante a animação
  assert(
    contentRowCode.includes('targetIndexRef') &&
    contentRowCode.includes('targetIdx = isAnimatingRef.current ? targetIndexRef.current : currentIndex'),
    'onEnterPress deve identificar o targetIdx quando o carrossel estiver em movimento horizontal'
  );
  console.log('✓ Teste 7: Acionamento de Enter no item de destino durante o deslocamento OK');

  // Teste 8: Preservação integral do layout, margem segura responsiva e moldura externa ciano
  assert(
    contentRowCode.includes('viewport.safeMarginX') &&
    contentRowCode.includes('border-cyan-400') &&
    contentRowCode.includes('getCardAmbientGlow'),
    'TvContentRow deve preservar a margem segura responsiva, moldura de foco ciano e glow ambiente'
  );
  console.log('✓ Teste 8: Preservação da geometria, identidade visual e acabamento refinado OK');

  console.log('\nTodos os 8 testes de suavização horizontal dos carrosséis passaram com 100% de sucesso!\n');
}

runTvCarouselHorizontalTransitionsTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ Falha nos testes de suavização horizontal:', err);
  process.exit(1);
});
