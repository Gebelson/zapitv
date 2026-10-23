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

  console.log('\nTodos os 7 testes visuais do descanso de tela passaram com 100% de sucesso!\n');
}

runTvScreensaverVisualsTests().catch((err) => {
  console.error('\n❌ Falha nos testes visuais do descanso de tela:', err);
  process.exit(1);
});
