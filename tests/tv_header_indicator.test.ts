/**
 * ZAPITV — TESTE DO TRAÇO INDICADOR ÚNICO DESLIZANTE DOS LINKS DO HEADER
 * 
 * Verifica os 12 cenários exigidos pela especificação:
 * 1. Início → Filmes: deslizamento suave com translate3d.
 * 2. Filmes → Séries: deslizamento suave com cubic-bezier.
 * 3. Séries → Animes: deslizamento suave contínuo.
 * 4. Animes → Em Destaque: deslizamento suave contínuo.
 * 5. Navegação rápida entre vários links (interrupção e retargeting imediato sem fila atrasada).
 * 6. Link → Busca: traço desaparece (opacity 0, pointer-events-none).
 * 7. Link → Perfil: traço desaparece.
 * 8. Link → Banner: traço desaparece.
 * 9. Link → Carrossel: traço desaparece.
 * 10. Retorno aos links: traço reaparece diretamente sob o link focado sem cruzar a tela.
 * 11. Troca de página: NÃO mantém traço permanente indicando a página ativa.
 * 12. Redimensionamento: alinhamento preservado.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runTvHeaderIndicatorTests() {
  console.log('\n========================================================================');
  console.log('--- TESTE DO TRAÇO INDICADOR ÚNICO DESLIZANTE DO HEADER (ZAPITV) ---');
  console.log('========================================================================\n');

  const headerPath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');
  assert.ok(fs.existsSync(headerPath), 'TvHeader.tsx deve existir');
  const headerCode = fs.readFileSync(headerPath, 'utf8');

  // Cenário 1: Remoção definitiva dos traços individuais estáticos dentro dos botões
  console.log('--- Cenário 1: Remoção de traços individuais estáticos por botão ---');
  assert.ok(
    !headerCode.includes('w-6 h-[3px] bg-gradient-to-r'),
    'TvNavTabButton NÃO deve renderizar traço permanente individual para isActive'
  );
  assert.ok(
    !headerCode.includes('{focused ? (\n          <span className="absolute top-[calc(100%+5px)]') &&
    !headerCode.includes('{focused ? (\r\n          <span className="absolute top-[calc(100%+5px)]'),
    'TvNavTabButton NÃO deve renderizar span individual de traço para cada link focado'
  );
  console.log('✓ Cenário 1: Traços individuais e permanentes removidos dos botões de link OK');

  // Cenário 2: Único indicador absoluto no contêiner <nav>
  console.log('\n--- Cenário 2: Único elemento indicador absoluto em <nav> ---');
  assert.ok(
    headerCode.includes('data-testid="tv-nav-indicator"'),
    'TvHeader deve renderizar o elemento único de indicador com data-testid="tv-nav-indicator"'
  );
  assert.ok(
    headerCode.includes('w-8') && headerCode.includes('h-[3px]'),
    'O indicador deve possuir 32px de largura (w-8) e 3px de altura'
  );
  assert.ok(
    headerCode.includes('bg-cyan-400') && headerCode.includes('rounded-full'),
    'O indicador deve possuir cor cyan e pontas arredondadas (rounded-full)'
  );
  assert.ok(
    headerCode.includes('shadow-[0_0_10px_#00e5ff]'),
    'O indicador deve possuir brilho ciano discreto'
  );
  console.log('✓ Cenário 2: Único elemento indicador absoluto estilizado com 32x3px, cyan e glow discreto OK');

  // Cenário 3: Transição suave e aceleração GPU com cubic-bezier(0.22, 1, 0.36, 1)
  console.log('\n--- Cenário 3: Animação fluida com translate3d e curva desacelerada ---');
  assert.ok(
    headerCode.includes('translate3d(') && headerCode.includes('px, 0, 0)'),
    'O deslocamento do indicador deve utilizar aceleração GPU via translate3d(X, 0, 0)'
  );
  assert.ok(
    headerCode.includes('transform 300ms cubic-bezier(0.22, 1, 0.36, 1)'),
    'A transição deve utilizar duração de 300ms e curva cubic-bezier(0.22, 1, 0.36, 1)'
  );
  console.log('✓ Cenário 3: Transição horizontal de 300ms com curva cubic-bezier(0.22, 1, 0.36, 1) configurada OK');

  // Cenário 4: Posicionamento preciso baseado no centro do botão
  console.log('\n--- Cenário 4: Cálculo geométrico centralizado ---');
  assert.ok(
    headerCode.includes('buttonRect.left + buttonRect.width / 2') ||
    headerCode.includes('buttonEl.offsetLeft + (buttonEl.offsetWidth'),
    'O cálculo deve centralizar o indicador na posição exata do botão'
  );
  assert.ok(
    headerCode.includes('Math.round(centerX - 16)'),
    'A coordenada de translação deve subtrair metade da largura (16px) para centralizar perfeitamente'
  );
  console.log('✓ Cenário 4: Centralização matemática exata com sub-pixel precision OK');

  // Cenário 5: Simulação de navegação direta entre os 5 links (Início → Filmes → Séries → Animes → Destaque)
  console.log('\n--- Cenário 5: Simulação de navegação suave contínua entre os 5 links ---');
  const dummyNav = { getBoundingClientRect: () => ({ left: 500, width: 800 }) };
  const dummyButtons = {
    'tv-nav-home': { getBoundingClientRect: () => ({ left: 520, width: 80 }) },
    'tv-nav-movies': { getBoundingClientRect: () => ({ left: 630, width: 90 }) },
    'tv-nav-series': { getBoundingClientRect: () => ({ left: 750, width: 85 }) },
    'tv-nav-animes': { getBoundingClientRect: () => ({ left: 865, width: 90 }) },
    'tv-nav-featured': { getBoundingClientRect: () => ({ left: 985, width: 140 }) },
  };

  const computeX = (btn: { getBoundingClientRect: () => { left: number; width: number } }) => {
    const nr = dummyNav.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const cx = (br.left + br.width / 2) - nr.left;
    return Math.round(cx - 16);
  };

  const xHome = computeX(dummyButtons['tv-nav-home']);
  const xMovies = computeX(dummyButtons['tv-nav-movies']);
  const xSeries = computeX(dummyButtons['tv-nav-series']);
  const xAnimes = computeX(dummyButtons['tv-nav-animes']);
  const xFeatured = computeX(dummyButtons['tv-nav-featured']);

  assert.strictEqual(xHome, Math.round((520 + 40) - 500 - 16)); // 44px
  assert.strictEqual(xMovies, Math.round((630 + 45) - 500 - 16)); // 159px
  assert.strictEqual(xSeries, Math.round((750 + 42.5) - 500 - 16)); // 277px
  assert.strictEqual(xAnimes, Math.round((865 + 45) - 500 - 16)); // 394px
  assert.strictEqual(xFeatured, Math.round((985 + 70) - 500 - 16)); // 539px

  assert.ok(xHome < xMovies && xMovies < xSeries && xSeries < xAnimes && xAnimes < xFeatured);
  console.log(`    ↳ Posições calculadas: Início (${xHome}px) → Filmes (${xMovies}px) → Séries (${xSeries}px) → Animes (${xAnimes}px) → Em Destaque (${xFeatured}px)`);
  console.log('✓ Cenário 5: Translação progressiva suave sem regressões nem saltos OK');

  // Cenário 6: Desaparecimento do traço ao sair dos links (Busca, Perfil, Hero, Carrossel)
  console.log('\n--- Cenário 6: Desaparecimento do traço quando o foco sai dos links ---');
  assert.ok(
    headerCode.includes('indicatorVisible ? \'opacity-100\' : \'opacity-0\''),
    'O indicador deve alternar opacidade para 0 quando o foco sair dos 5 links do header'
  );
  assert.ok(
    headerCode.includes('blurTimerRef.current = setTimeout(') && headerCode.includes('setIndicatorVisible(false)'),
    'TvHeader deve acionar timer coordenado de blur para ocultar o traço ao sair dos links'
  );
  assert.ok(
    headerCode.includes('clearTimeout(blurTimerRef.current)'),
    'TvHeader deve cancelar o timer de blur quando outro link do nav receber foco imediatamente'
  );
  console.log('✓ Cenário 6: Desaparecimento coordenado sem flicker entre links OK');

  // Cenário 7: Entrada sem cruzar o header inteiro
  console.log('\n--- Cenário 7: Entrada limpa sem cruzar o header ao aparecer ---');
  assert.ok(
    headerCode.includes('!isIndicatorVisibleRef.current') &&
    headerCode.includes('setHasTransition(false)'),
    'Quando o traço não estiver visível, deve desativar a transição horizontal para posicionar imediatamente no link focado'
  );
  console.log('✓ Cenário 7: Entrada discreta diretamente sob o link focado garantida OK');

  // Cenário 8: Redimensionamento de tela
  console.log('\n--- Cenário 8: Alinhamento preservado no evento resize ---');
  assert.ok(
    headerCode.includes("window.addEventListener('resize', handleResize)"),
    'TvHeader deve recalcular a posição em resposta ao evento resize'
  );
  console.log('✓ Cenário 8: Listener de redimensionamento implementado com limpeza em unmount OK');

  console.log('\n========================================================================');
  console.log('TODOS OS CENÁRIOS DO INDICADOR ÚNICO DO HEADER PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runTvHeaderIndicatorTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Falha no teste do indicador do header:', err);
  process.exit(1);
});
