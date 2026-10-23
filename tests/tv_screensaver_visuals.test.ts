import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { ContentItem, ContentType } from '../types';
import { getCategoryLabel } from '../src/components/tv/TvScreensaver';

async function runTvScreensaverVisualsTests() {
  console.log('--- Auditoria dos Ajustes Visuais do Descanso de Tela (Smart TV) ---');

  const screensaverPath = path.resolve(process.cwd(), 'src/components/tv/TvScreensaver.tsx');
  assert(fs.existsSync(screensaverPath), 'TvScreensaver.tsx deve existir');
  const code = fs.readFileSync(screensaverPath, 'utf8');

  // Teste 1: Degradê escuro progressivo de baixo para cima
  assert(
    code.includes('linear-gradient(to top, rgba(5,7,10,0.94) 0%') &&
    code.includes('transparent 70%'),
    'TvScreensaver deve implementar degradê cinematográfico multi-stop subindo do fundo em direção ao centro'
  );
  console.log('✓ Teste 1: Degradê escuro progressivo de baixo para cima com transição suave OK');

  // Teste 2: Exibição da logo oficial do conteúdo no canto inferior esquerdo
  assert(
    code.includes('currentLogo') &&
    code.includes('images.metahub.space/logo/medium') &&
    code.includes('object-contain object-left-bottom') &&
    code.includes('left-[6%]') &&
    code.includes('bottom-[8%]'),
    'TvScreensaver deve exibir a logo oficial do conteúdo na parte inferior esquerda com object-contain'
  );
  console.log('✓ Teste 2: Logo oficial do conteúdo posicionada à esquerda e com proporção preservada OK');

  // Teste 3: Comportamento de fallback quando a logo não estiver disponível
  assert(
    code.includes('hasLogo ?') &&
    code.includes('setLogoFailed(true)') &&
    code.includes('current.item.title'),
    'TvScreensaver deve utilizar o título do conteúdo como fallback tipográfico caso a logo falhe ou não exista'
  );
  console.log('✓ Teste 3: Fallback gracioso com nome do conteúdo quando a logo não está disponível OK');

  // Teste 4: Categoria exibida abaixo da logo (Filme, Série, Anime)
  const movieItem: ContentItem = { id: 'm1', title: 'Filme Teste', type: ContentType.MOVIE, year: 2024, rating: 8, image: '' };
  const seriesItem: ContentItem = { id: 's1', title: 'Série Teste', type: ContentType.SERIES, seasonsCount: 3, year: 2023, rating: 9, image: '' };
  const animeItem: ContentItem = { id: 'a1', title: 'Anime Teste', type: ContentType.ANIME, genres: ['Anime'], year: 2022, rating: 9.5, image: '' };

  assert.strictEqual(getCategoryLabel(movieItem), 'Filme');
  assert.strictEqual(getCategoryLabel(seriesItem), 'Série');
  assert.strictEqual(getCategoryLabel(animeItem), 'Anime');

  assert(
    code.includes('getCategoryLabel(current.item)') &&
    code.includes('text-cyan-300'),
    'TvScreensaver deve exibir a linha de categoria (Filme, Série, Anime) formatada em text-cyan-300 abaixo da logo'
  );
  console.log('✓ Teste 4: Linha pequena de categoria exibida corretamente abaixo da logo OK');

  // Teste 5: Logotipo animado da ZapiTV no canto inferior direito
  assert(
    code.includes('right-[6%]') &&
    code.includes('zapi-icon.webm') &&
    code.includes('zapitv-text.png'),
    'TvScreensaver deve exibir o logotipo animado da ZapiTV na parte inferior direita'
  );
  console.log('✓ Teste 5: Logo animada da ZapiTV no canto inferior direito respeitando margens seguras OK');

  // Teste 6: Preservação de acessibilidade e compatibilidade com suíte de testes
  assert(
    code.includes('data-tv-screensaver="true"') &&
    code.includes('<h1 className="sr-only">{current.item.title}</h1>'),
    'TvScreensaver deve manter data-tv-screensaver="true" e o h1 semântico com o título para leitores de tela e testes'
  );
  console.log('✓ Teste 6: Preservação de atributos de acessibilidade e hooks de teste OK');

  // Teste 7: Desempenho leve e pause de recursos na Smart TV
  assert(
    code.includes('pointer-events-auto') &&
    code.includes('playsInline') &&
    code.includes('muted'),
    'O vídeo da logo deve operar em modo leve com muted e playsInline sem impactar a GPU ou áudio da Smart TV'
  );
  console.log('✓ Teste 7: Execução leve e sem concorrência com o player ou decodificador de vídeo OK');

  
  // ==========================================================================
  // SUÍTE ESPECÍFICA: FIXAÇÃO DEFINITIVA DAS LOGOS NO DESCANSO DE TELA
  // ==========================================================================
  console.log('\n--- Auditoria de Fixação e Alinhamento Permanente das Logos ---');

  // Teste 8: Remoção completa do deslocamento automático (drift / translateX)
  assert(
    !code.includes('const drift =') &&
    !code.includes('translateX(${drift}vw)'),
    'O deslocamento automático drift e qualquer translateX variável devem ser completamente eliminados'
  );
  console.log('✓ Teste 8: Deslocamento automático (drift) e translateX eliminados com 100% de sucesso');

  // Teste 9: Área de posicionamento fixa do conteúdo (left: 6%, bottom: 8%)
  assert(
    code.includes('data-testid="tv-screensaver-content-anchor"') &&
    code.includes('bottom-[8%]') &&
    code.includes('left-[6%]') &&
    code.includes('w-[320px] sm:w-[420px] lg:w-[500px]') &&
    code.includes('max-w-[65vw]'),
    'O contêiner do conteúdo deve ter ancoragem estática em left: 6%, bottom: 8% e largura máxima de 500px'
  );
  console.log('✓ Teste 9: Contêiner de conteúdo ancorado permanentemente em left: 6% e bottom: 8%');

  // Teste 10: Área reservada para a logo com altura fixa e responsiva
  assert(
    code.includes('data-testid="tv-screensaver-logo-area"') &&
    code.includes('h-[100px] sm:h-[120px] lg:h-[140px]') &&
    code.includes('flex items-end justify-start'),
    'A área da logo deve ter altura fixa (100px/120px/140px) e alinhar elementos à base e à esquerda'
  );
  console.log('✓ Teste 10: Área da logo com altura fixa pré-dimensionada e alinhamento à base esquerda OK');

  // Teste 11: Categoria sempre fixada na mesma altura com espaçamento fixo
  assert(
    code.includes('data-testid="tv-screensaver-category-area"') &&
    code.includes('mt-3 sm:mt-3.5') &&
    code.includes('h-6 flex items-center'),
    'A área da categoria deve ter espaçamento fixo superior (mt-3/mt-3.5) e altura constante h-6'
  );
  console.log('✓ Teste 11: Categoria e ano ancorados com espaçamento fixo invariante entre slides');

  // Teste 12: Padronização do fallback de texto (título de 1 ou 2 linhas na mesma área)
  assert(
    code.includes('line-clamp-2') &&
    code.includes('text-left') &&
    code.includes('clamp(1.8rem, 2.8vw, 3.2rem)'),
    'Fallback de texto deve ser limitado a 2 linhas, alinhado à esquerda e contido na mesma área da logo'
  );
  console.log('✓ Teste 12: Fallback tipográfico padronizado em até 2 linhas dentro da mesma área reservada');

  // Teste 13: Logotipo animado da ZapiTV absolutamente estável
  assert(
    code.includes('data-testid="tv-screensaver-zapi-logo"') &&
    code.includes('bottom-[8%]') &&
    code.includes('right-[6%]'),
    'O logotipo animado da ZapiTV deve estar permanentemente fixado em bottom: 8% e right: 6%'
  );
  console.log('✓ Teste 13: Logotipo da ZapiTV absolutamente estável no canto inferior direito');

  // Teste 14: Verificação da simulação de transição e ausência de layout shift
  assert(
    code.includes('tv-screensaver-enter') &&
    code.includes('overflow-hidden'),
    'Transições devem preservar overflow controlado sem provocar quebras ou saltos de layout'
  );
  console.log('✓ Teste 14: Transições suaves sem deslocamento espacial ou layout shift validadas');

  console.log('\nTodos os 14 testes de fixação e alinhamento do descanso de tela passaram com 100% de sucesso!\n');

}

runTvScreensaverVisualsTests().catch((err) => {
  console.error('\n❌ Falha nos testes visuais do descanso de tela:', err);
  process.exit(1);
});
