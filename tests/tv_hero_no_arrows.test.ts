import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runTvHeroNoArrowsTests() {
  console.log('--- Auditoria e Testes: Remoção de Setas do Banner Principal na Smart TV ---');

  const heroPath = path.resolve(process.cwd(), 'src/components/tv/TvHeroBanner.tsx');
  assert(fs.existsSync(heroPath), 'TvHeroBanner.tsx deve existir');
  const heroCode = fs.readFileSync(heroPath, 'utf8');

  // Teste 1: Setas manuais (ChevronLeft / ChevronRight) removidas do arquivo
  assert(
    !heroCode.includes('ChevronLeft') && !heroCode.includes('ChevronRight'),
    'Ícones ChevronLeft e ChevronRight devem ter sido completamente removidos'
  );
  console.log('✓ Teste 1: Ícones ChevronLeft e ChevronRight removidos OK');

  // Teste 2: Registros de foco tv-hero-prev e tv-hero-next removidos
  assert(
    !heroCode.includes('tv-hero-prev') && !heroCode.includes('tv-hero-next'),
    'Registros de foco tv-hero-prev e tv-hero-next devem ser inexistentes'
  );
  assert(
    !heroCode.includes('TvHeroIconButton'),
    'Componente TvHeroIconButton deve ter sido removido por completo'
  );
  console.log('✓ Teste 2: Registros de foco tv-hero-prev/next e botões de seta removidos do Norigin OK');

  // Teste 3: Ausência de troca manual com as setas do controle remoto
  assert(
    !heroCode.includes('goToPrevSlide'),
    'goToPrevSlide deve ser removido, pois o banner é 100% automático'
  );
  assert(
    !heroCode.includes('onLeftPress={slides.length > 1'),
    'Botão Assistir (tv-hero-play) não deve interceptar seta esquerda para trocar destaques'
  );
  console.log('✓ Teste 3: Troca manual por setas do controle remoto eliminada OK');

  // Teste 4: Rotação automática a cada 8 segundos preservada
  assert(
    heroCode.includes('autoRotateInterval = 8000') || heroCode.includes('autoRotateInterval?: number'),
    'TvHeroBanner deve manter o intervalo padrão de 8000ms (8 segundos)'
  );
  assert(
    heroCode.includes('setInterval(') && heroCode.includes('goToNextSlide()'),
    'Rotação automática via setInterval com chamada a goToNextSlide deve estar preservada'
  );
  assert(
    heroCode.includes('(targetIndex + slides.length) % slides.length'),
    'Transição circular contínua (último destaque para o primeiro) preservada'
  );
  console.log('✓ Teste 4: Rotação automática contínua de 8 segundos preservada OK');

  // Teste 5: Suavidade do crossfade e fade de textos preservada
  assert(
    heroCode.includes('isCrossfading') &&
    heroCode.includes('textOpacity') &&
    heroCode.includes('duration-700 ease-in-out') &&
    heroCode.includes('250'),
    'Transições sincronizadas de imagem (700ms) e fade de texto (250ms) preservadas'
  );
  console.log('✓ Teste 5: Crossfade cinematográfico suave de imagens e textos preservado OK');

  // Teste 6: Pausa e retomada inteligentes (suspended / document.hidden)
  assert(
    heroCode.includes('suspended') &&
    heroCode.includes('visibilitychange') &&
    heroCode.includes('document.hidden'),
    'Lógica de suspensão durante descanso de tela ou aba oculta deve estar preservada'
  );
  console.log('✓ Teste 6: Suspensão inteligente no descanso de tela e retomada automática OK');

  // Teste 7: Indicadores preservados como elementos visuais não clicáveis e sem foco
  assert(
    heroCode.includes('hero-dot-') &&
    heroCode.includes('pointer-events-none') &&
    heroCode.includes('w-8 h-2.5 bg-gradient-to-r from-blue-500 to-cyan-400') &&
    !heroCode.includes('onClick={() => { resetTimer(); goToSlide(idx); }}'),
    'Indicadores devem ser exibidos visualmente mas ser pointer-events-none, sem onClick e sem foco'
  );
  console.log('✓ Teste 7: Indicadores de posição visuais preservados sem comportamento de clique ou foco OK');

  // Teste 8: Navegação entre botões Assistir e Mais Detalhes e interface da TV preservada
  assert(
    heroCode.includes('tv-hero-play') &&
    heroCode.includes('tv-hero-details') &&
    heroCode.includes("setFocus('tv-nav-home')") &&
    heroCode.includes('onDownPress'),
    'Navegação espacial para Header (Up), Carrosséis (Down) e entre botões (Left/Right) preservada'
  );
  console.log('✓ Teste 8: Navegação padrão por D-pad (Header <-> Hero <-> Carrosséis) preservada OK');

  console.log('\n--- TODOS OS 8 TESTES DE REMOÇÃO DE SETAS DO HERO PASSARAM COM SUCESSO! ---');
}

runTvHeroNoArrowsTests().catch(err => {
  console.error('Falha nos testes de remoção de setas do hero:', err);
  process.exit(1);
});
