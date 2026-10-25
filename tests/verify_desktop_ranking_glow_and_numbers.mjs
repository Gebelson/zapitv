import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

async function verifyViewport(browser, width, height) {
  console.log(`\n--- Testando resolução ${width}x${height} ---`);
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://localhost:4000/em-destaque', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const carousel = page.locator('section.group\\/ranked-section').first();
  await carousel.waitFor({ state: 'visible' });

  // 1. Auditoria geométrica na Página 1 (ranks 1 a 5)
  const p0Data = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('section.group\\/ranked-section:first-of-type [role="button"]'));
    return cards.map((c, i) => {
      const cardRect = c.getBoundingClientRect();
      const numSpan = c.querySelector('span.font-black');
      const numRect = numSpan ? numSpan.getBoundingClientRect() : null;
      const poster = c.querySelector('.aspect-\\[2\\/3\\]');
      const posterRect = poster ? poster.getBoundingClientRect() : null;
      return {
        rank: i + 1,
        cardWidth: Math.round(cardRect.width),
        numLeftRel: numRect ? Math.round(numRect.left - cardRect.left) : 0,
        numRightRel: numRect ? Math.round(numRect.right - cardRect.left) : 0,
        numWidth: numRect ? Math.round(numRect.width) : 0,
        posterLeftRel: posterRect ? Math.round(posterRect.left - cardRect.left) : 0,
        overlapUnderPoster: numRect && posterRect ? Math.round(numRect.right - posterRect.left) : 0
      };
    });
  });

  // Validação: Número 1 deve estar próximo e parcialmente sob o poster
  const r1 = p0Data[0];
  assert.ok(r1.overlapUnderPoster > 0, `Número 1 deve estar parcialmente sob o pôster (overlap: ${r1.overlapUnderPoster}px)`);
  assert.ok(r1.numLeftRel > 0, `Número 1 deve ter espaçamento de segurança à esquerda (numLeftRel: ${r1.numLeftRel}px)`);
  console.log(`✓ Rank 1: overlap sob a capa = ${r1.overlapUnderPoster}px, margem esquerda = ${r1.numLeftRel}px`);

  // Validação: Ranks 2 a 5 não devem invadir card vizinho e devem ter overlap sob a capa
  for (let i = 0; i < 5; i++) {
    const item = p0Data[i];
    assert.ok(item.numLeftRel >= 0, `Rank ${item.rank} não deve invadir o card vizinho (leftRel: ${item.numLeftRel}px)`);
    assert.ok(item.overlapUnderPoster > 0, `Rank ${item.rank} deve estar parcialmente sob a capa (overlap: ${item.overlapUnderPoster}px)`);
  }
  console.log(`✓ Ranks 1 a 5 validados geometricamente sem colisões.`);

  // Screenshot Página 0
  const outDir = path.resolve('tests/output_screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  await carousel.screenshot({ path: path.join(outDir, `ranking_${width}_p0.png`) });

  // Hover no Card 1
  const card1 = carousel.locator('[role="button"]').first();
  await card1.hover();
  await page.waitForTimeout(400);
  await carousel.screenshot({ path: path.join(outDir, `ranking_${width}_card1_hover.png`) });
  console.log(`✓ Captura de hover no Card 1 realizada.`);

  // Hover no Card 5
  const card5 = carousel.locator('[role="button"]').nth(4);
  await card5.hover();
  await page.waitForTimeout(400);
  await carousel.screenshot({ path: path.join(outDir, `ranking_${width}_card5_hover.png`) });
  console.log(`✓ Captura de hover no Card 5 realizada.`);

  // 2. Navegação para a Página 2 (ranks 6 a 10)
  const nextBtn = carousel.locator('button[aria-label="Ver posições 6 a 10"]');
  await nextBtn.click();
  await page.waitForTimeout(600);

  // Screenshot Página 1
  await carousel.screenshot({ path: path.join(outDir, `ranking_${width}_p1.png`) });

  // Validação dos Ranks 6 a 10
  for (let i = 5; i < 10; i++) {
    const item = p0Data[i];
    assert.ok(item.numLeftRel >= 0, `Rank ${item.rank} não deve invadir o card vizinho (leftRel: ${item.numLeftRel}px)`);
    assert.ok(item.overlapUnderPoster > 0, `Rank ${item.rank} deve estar parcialmente sob a capa (overlap: ${item.overlapUnderPoster}px)`);
  }
  console.log(`✓ Ranks 6 a 10 validados geometricamente sem colisões.`);

  // Hover no Card 10 (dois dígitos)
  const card10 = carousel.locator('[role="button"]').nth(9);
  await card10.hover();
  await page.waitForTimeout(400);
  await carousel.screenshot({ path: path.join(outDir, `ranking_${width}_card10_hover.png`) });
  console.log(`✓ Captura de hover no Card 10 realizada.`);

  // 3. Validação de isolamento de páginas (Página 2 não vaza na Página 1)
  const prevBtn = carousel.locator('button[aria-label="Ver posições 1 a 5"]');
  await prevBtn.click();
  await page.waitForTimeout(600);

  const isolationCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('section.group\\/ranked-section:first-of-type [role="button"]'));
    const container = document.querySelector('section.group\\/ranked-section > div');
    const cRect = container.getBoundingClientRect();
    return cards.map((c, i) => {
      const r = c.getBoundingClientRect();
      const inView = r.right > cRect.left + 5 && r.left < cRect.right - 5;
      return { rank: i + 1, inView };
    });
  });

  const p1Visible = isolationCheck.slice(0, 5).every(x => x.inView);
  const p2Hidden = isolationCheck.slice(5, 10).every(x => !x.inView);
  assert.ok(p1Visible, 'Posições 1 a 5 devem estar visíveis na Página 1');
  assert.ok(p2Hidden, 'Posições 6 a 10 DEVEM estar totalmente ocultas na Página 1');
  console.log(`✓ Isolamento estrito entre páginas confirmado (sem vazamentos horizontais).`);

  await page.close();
}

async function main() {
  console.log('========================================================================');
  console.log('--- TESTE VISUAL: AJUSTE DE NÚMEROS E CORREÇÃO DE GLOW NO TOP 10 PC ---');
  console.log('========================================================================');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  try {
    await verifyViewport(browser, 1920, 1080);
    await verifyViewport(browser, 1366, 768);
    await verifyViewport(browser, 1024, 768);

    console.log('\n========================================================================');
    console.log(' TODOS OS TESTES E AUDITORIAS VISUAIS PASSARAM COM 100% DE SUCESSO! ');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Falha no teste visual:', err);
  process.exit(1);
});
