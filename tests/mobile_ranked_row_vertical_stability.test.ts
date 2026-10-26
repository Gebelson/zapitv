import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

async function runTests() {
  console.log('=== TEST SUITE: ZapiTV | Estabilidade Vertical do Top 10 Mobile ===\n');

  const rowPath = path.resolve('src/components/mobile/MobileRankedRow.tsx');
  assert.ok(fs.existsSync(rowPath), 'MobileRankedRow.tsx deve existir');
  const rowCode = fs.readFileSync(rowPath, 'utf8');

  // --- 1. Auditoria Estática de Código ---
  console.log('1. Verificando código fonte de MobileRankedRow.tsx...');

  // Não deve usar position: fixed nem sticky para prender o componente
  assert.strictEqual(
    rowCode.includes('position: fixed') || rowCode.includes('fixed inset') || rowCode.includes('sticky top'),
    false,
    'MobileRankedRow NÃO deve utilizar position: fixed nem sticky'
  );
  console.log('  ✓ Sem uso indevido de position: fixed ou sticky.');

  // Deve ter overflow-y: hidden e overflow-x: auto
  assert.ok(
    rowCode.includes('overflow-y-hidden') || rowCode.includes("overflowY: 'hidden'"),
    'MobileRankedRow deve conter overflow-y: hidden'
  );
  assert.ok(
    rowCode.includes('overflow-x-auto'),
    'MobileRankedRow deve manter overflow-x: auto'
  );
  console.log('  ✓ overflow-y: hidden e overflow-x: auto validados.');

  // Deve ter touch-action: pan-x
  assert.ok(
    rowCode.includes("touchAction: 'pan-x'") || rowCode.includes('touch-pan-x'),
    'MobileRankedRow deve definir touch-action: pan-x para controle estrito de eixo'
  );
  console.log('  ✓ touch-action: pan-x validado.');

  // Deve ter overscroll-behavior
  assert.ok(
    rowCode.includes("overscrollBehaviorX: 'contain'"),
    'MobileRankedRow deve conter overscrollBehaviorX: contain'
  );
  assert.ok(
    rowCode.includes("overscrollBehaviorY: 'none'"),
    'MobileRankedRow deve conter overscrollBehaviorY: none'
  );
  console.log('  ✓ overscroll-behavior contido para prevenir bounce vertical.');

  // Deve ter scroll-smooth preservado
  assert.ok(
    rowCode.includes('scroll-smooth'),
    'MobileRankedRow deve manter scroll-smooth próprio para swipe horizontal'
  );
  console.log('  ✓ scroll-smooth preservado.');

  // Não deve ter active:scale-95 no card container (evita salto vertical ao tocar)
  assert.strictEqual(
    rowCode.includes('active:scale-95 transition-transform'),
    false,
    'Card container NÃO deve ter active:scale-95 transition-transform'
  );
  console.log('  ✓ active:scale-95 removido do container para evitar oscilação vertical.');

  // Números brancos sólidos preservados
  assert.ok(
    rowCode.includes("color: '#ffffff'"),
    'Números do ranking devem permanecer sólidos brancos (#ffffff)'
  );
  console.log('  ✓ Números brancos sólidos preservados.');

  // --- 2. Validação Funcional em Navegador Mobile Real via Playwright ---
  console.log('\n2. Inicializando servidor Vite e navegador mobile real (Playwright)...');
  const viteServer = await createServer({
    server: { port: 5195 }
  });
  await viteServer.listen();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3.0,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5195/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // 2.1 Validação de scrollHeight vs clientHeight (Zero Vertical Overflow)
  console.log('\n2.1 Verificando métricas de dimensões internas do contêiner...');
  const containerMetrics = await page.evaluate(() => {
    const s = document.querySelector('section[aria-label="Top 10 do Mês"]');
    const row = s?.querySelector('.overflow-x-auto');
    const firstCard = row?.querySelector('[role="button"]');
    const num = firstCard?.querySelector('div:first-child');
    const post = firstCard?.querySelector('div:last-child');

    const numRect = num?.getBoundingClientRect();
    const postRect = post?.getBoundingClientRect();

    return {
      scrollHeight: row?.scrollHeight || 0,
      clientHeight: row?.clientHeight || 0,
      verticalDiff: (row?.scrollHeight || 0) - (row?.clientHeight || 0),
      scrollTop: row?.scrollTop || 0,
      numBottomOffset: (numRect?.bottom || 0) - (postRect?.bottom || 0)
    };
  });

  console.log('  Métricas DOM do Top 10:', containerMetrics);
  assert.strictEqual(
    containerMetrics.verticalDiff,
    0,
    `scrollHeight (${containerMetrics.scrollHeight}) deve ser estritamente igual a clientHeight (${containerMetrics.clientHeight})`
  );
  assert.strictEqual(containerMetrics.scrollTop, 0, 'scrollTop inicial deve ser 0');
  assert.strictEqual(containerMetrics.numBottomOffset, 8, 'Alinhamento visual da capa e número preservado (8px)');
  console.log('  ✓ scrollHeight === clientHeight: zero overflow vertical interno garantido!');

  // Posiciona a seção na tela
  await page.evaluate(() => {
    const s = document.querySelector('section[aria-label="Top 10 do Mês"]');
    s?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);

  const cdp = await context.newCDPSession(page);

  const getState = async () => {
    return page.evaluate(() => {
      const s = document.querySelector('section[aria-label="Top 10 do Mês"]');
      const row = s?.querySelector('.overflow-x-auto');
      const cards = row?.querySelectorAll('[role="button"]') || [];
      const firstCard = cards[0];
      const h3 = s?.querySelector('h3');
      return {
        windowScrollY: window.scrollY,
        sectionTop: s?.getBoundingClientRect().top || 0,
        titleTop: h3?.getBoundingClientRect().top || 0,
        cardTop: firstCard?.getBoundingClientRect().top || 0,
        rowScrollLeft: row?.scrollLeft || 0,
        rowScrollTop: row?.scrollTop || 0
      };
    });
  };

  const getRowPoint = async () => {
    return page.evaluate(() => {
      const row = document.querySelector('section[aria-label="Top 10 do Mês"] .overflow-x-auto');
      const r = row?.getBoundingClientRect() || { left: 0, top: 0 };
      return { x: r.left + 250, y: r.top + 60 };
    });
  };

  async function performTouchSwipe(startX: number, startY: number, deltaX: number, deltaY: number, steps = 10, stepDelay = 20) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY, id: 0 }]
    });
    await page.waitForTimeout(20);

    for (let i = 1; i <= steps; i++) {
      const curX = startX + (deltaX * (i / steps));
      const curY = startY + (deltaY * (i / steps));
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: curX, y: curY, id: 0 }]
      });
      await page.waitForTimeout(stepDelay);
    }

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await page.waitForTimeout(300);
  }

  const initial = await getState();

  // Teste 2.2: Arrastar lentamente para a esquerda
  console.log('\n2.2 Testando arrasto lento para a esquerda...');
  let pt = await getRowPoint();
  await performTouchSwipe(pt.x, pt.y, -160, 0, 20, 25);
  let s1 = await getState();
  assert.ok(s1.rowScrollLeft > 50, 'Deve ter rolado horizontalmente para a esquerda');
  assert.strictEqual(s1.windowScrollY, initial.windowScrollY, 'window.scrollY não deve mudar');
  assert.strictEqual(s1.sectionTop, initial.sectionTop, 'section.top não deve mudar');
  assert.strictEqual(s1.rowScrollTop, 0, 'row.scrollTop deve permanecer 0');
  console.log(`  ✓ Rolagem horizontal: ${s1.rowScrollLeft}px | Deslocamento vertical: 0px`);

  // Teste 2.3: Arrastar rapidamente para a esquerda
  console.log('\n2.3 Testando arrasto rápido para a esquerda...');
  pt = await getRowPoint();
  await performTouchSwipe(pt.x, pt.y, -200, 0, 5, 10);
  let s2 = await getState();
  assert.ok(s2.rowScrollLeft > s1.rowScrollLeft, 'Deve avançar no carrossel');
  assert.strictEqual(s2.windowScrollY, initial.windowScrollY, 'window.scrollY deve permanecer inalterado');
  assert.strictEqual(s2.sectionTop, initial.sectionTop, 'section.top deve permanecer inalterado');
  console.log(`  ✓ Rolagem horizontal rápida: ${s2.rowScrollLeft}px | Deslocamento vertical: 0px`);

  // Teste 2.4: Arrastar para a direita
  console.log('\n2.4 Testando arrasto para a direita...');
  pt = await getRowPoint();
  await performTouchSwipe(pt.x, pt.y, 180, 0, 10, 20);
  let s3 = await getState();
  assert.ok(s3.rowScrollLeft < s2.rowScrollLeft, 'Deve retroceder no carrossel');
  assert.strictEqual(s3.windowScrollY, initial.windowScrollY, 'window.scrollY deve permanecer inalterado');
  assert.strictEqual(s3.sectionTop, initial.sectionTop, 'section.top deve permanecer inalterado');
  console.log(`  ✓ Rolagem para a direita: ${s3.rowScrollLeft}px | Deslocamento vertical: 0px`);

  // Teste 2.5: Fazer movimentos diagonais leves (dx: -150, dy: -35)
  console.log('\n2.5 Testando gestos diagonais com componente vertical...');
  pt = await getRowPoint();
  await performTouchSwipe(pt.x, pt.y, -150, -35, 12, 20);
  let s4 = await getState();
  assert.strictEqual(s4.windowScrollY, initial.windowScrollY, 'Gesto diagonal não deve mover window.scrollY');
  assert.strictEqual(s4.sectionTop, initial.sectionTop, 'Gesto diagonal não deve mover sectionTop');
  assert.strictEqual(s4.titleTop, initial.titleTop, 'Título deve permanecer 100% estável');
  assert.strictEqual(s4.rowScrollTop, 0, 'row.scrollTop não deve sofrer alteração');
  console.log(`  ✓ Gesto diagonal: desvio vertical totalmente absorvido (0px de deslocamento).`);

  // Teste 2.6: Repetir movimentos continuamente
  console.log('\n2.6 Testando movimentos contínuos consecutivos...');
  for (let s = 1; s <= 6; s++) {
    pt = await getRowPoint();
    const dir = s % 2 === 0 ? 120 : -120;
    const dy = (s % 3) * 10 - 10;
    await performTouchSwipe(pt.x, pt.y, dir, dy, 8, 15);
  }
  let s5 = await getState();
  assert.strictEqual(s5.windowScrollY, initial.windowScrollY, 'window.scrollY inalterado após movimentos contínuos');
  assert.strictEqual(s5.sectionTop, initial.sectionTop, 'sectionTop inalterado após movimentos contínuos');
  console.log(`  ✓ 6 gestos contínuos concluídos com estabilidade vertical absoluta.`);

  // Teste 2.7: Chegar ao décimo conteúdo e voltar ao primeiro
  console.log('\n2.7 Testando navegação até o 10º item e retorno ao 1º item...');
  await page.evaluate(() => {
    const row = document.querySelector('section[aria-label="Top 10 do Mês"] .overflow-x-auto');
    row?.scrollTo({ left: row.scrollWidth, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  let sTenth = await getState();
  assert.ok(sTenth.rowScrollLeft > 1000, 'Deve ter alcançado o final do carrossel (10º item)');
  assert.strictEqual(sTenth.windowScrollY, initial.windowScrollY, 'window.scrollY no 10º item preservado');

  await page.evaluate(() => {
    const row = document.querySelector('section[aria-label="Top 10 do Mês"] .overflow-x-auto');
    row?.scrollTo({ left: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  let sFirst = await getState();
  assert.strictEqual(sFirst.rowScrollLeft, 0, 'Deve ter retornado ao 1º item');
  assert.strictEqual(sFirst.windowScrollY, initial.windowScrollY, 'window.scrollY no retorno preservado');
  console.log(`  ✓ Ciclo 1º -> 10º -> 1º concluído com sucesso e estabilidade absoluta.`);

  // Teste 2.8: Preservação de rolagem vertical da página FORA do carrossel
  console.log('\n2.8 Testando rolagem vertical normal fora do carrossel...');
  await page.evaluate(() => {
    window.scrollBy({ top: 150, behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  const afterOuterScroll = await page.evaluate(() => window.scrollY);
  assert.strictEqual(afterOuterScroll, initial.windowScrollY + 150, 'A rolagem vertical normal fora do carrossel deve funcionar');
  console.log(`  ✓ Rolagem vertical livre na página confirmada: ${afterOuterScroll}px.`);

  await browser.close();
  await viteServer.close();

  console.log('\n🎉 TODOS OS TESTES DE ESTABILIDADE VERTICAL DO TOP 10 PASSARAM COM SUCESSO!\n');
}

runTests().catch(err => {
  console.error('Falha nos testes de estabilidade vertical do Top 10:', err);
  process.exit(1);
});
