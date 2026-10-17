// Smoke manual: com `npm run dev` ativo, execute `node tests/browser_ui_sound_smoke.mjs`.
import { chromium } from 'playwright';

const baseUrl = process.env.ZAPITV_TEST_URL || 'http://localhost:4000';
for (const channel of ['chrome', 'msedge']) {
  let browser;
  try {
    console.log(`${channel}: abrindo navegador`);
    browser = await chromium.launch({ channel, headless: true });
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    page.setDefaultTimeout(10000);
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      window.__soundContexts = [];
      window.__soundNodes = 0;
      window.AudioContext = function (...args) {
        const context = new NativeAudioContext(...args);
        const createOscillator = context.createOscillator.bind(context);
        const createBufferSource = context.createBufferSource.bind(context);
        context.createOscillator = (...nodeArgs) => {
          window.__soundNodes++;
          return createOscillator(...nodeArgs);
        };
        context.createBufferSource = (...nodeArgs) => {
          window.__soundNodes++;
          return createBufferSource(...nodeArgs);
        };
        window.__soundContexts.push(context);
        return context;
      };
    });
    await page.goto(`${baseUrl}/configuracoes`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const sidebarSwitch = page.locator('aside').getByRole('switch', { name: 'Sons da interface' });
    const footerBefore = await page.locator('aside > div:last-child').boundingBox();
    const controlBefore = await sidebarSwitch.boundingBox();
    if (!footerBefore || !controlBefore || controlBefore.y + controlBefore.height > footerBefore.y) {
      throw new Error('Controle não está acima do rodapé');
    }
    if (await sidebarSwitch.getAttribute('aria-checked') !== 'false') throw new Error('Sons não começaram desativados');
    if ((await page.evaluate(() => window.__soundContexts.length)) !== 0) throw new Error('Áudio iniciou sem gesto');
    await sidebarSwitch.click();
    const footerAfter = await page.locator('aside > div:last-child').boundingBox();
    if (!footerAfter || Math.abs(footerAfter.y - footerBefore.y) > 1) throw new Error('Rodapé mudou de posição');
    await page.getByRole('button', { name: 'Reprodução', exact: true }).click();
    if (await page.getByRole('main').getByRole('switch', { name: 'Ativar sons da interface' }).getAttribute('aria-checked') !== 'true') {
      throw new Error('Sidebar e configurações não sincronizaram');
    }
    await page.getByRole('button', { name: 'Recolher menu lateral' }).click();
    const collapsedToggle = page.getByRole('switch', { name: 'Desativar sons da interface' });
    await page.waitForTimeout(120);
    const midTransitionWidth = await collapsedToggle.locator('span').nth(1).evaluate(node => parseFloat(getComputedStyle(node).maxWidth));
    if (!(midTransitionWidth > 0 && midTransitionWidth < 150)) throw new Error('Texto do controle não animou ao recolher');
    const sameControl = await collapsedToggle.elementHandle();
    await collapsedToggle.click();
    if (await page.getByRole('main').getByRole('switch', { name: 'Ativar sons da interface' }).getAttribute('aria-checked') !== 'false') {
      throw new Error('Botão recolhido não desativou os sons');
    }
    await page.getByRole('button', { name: 'Expandir menu lateral' }).click();
    await page.waitForTimeout(120);
    const openingWidth = await sidebarSwitch.locator('span').nth(1).evaluate(node => parseFloat(getComputedStyle(node).maxWidth));
    if (!(openingWidth > 0 && openingWidth < 150) || !await sameControl.evaluate(node => node.isConnected)) {
      throw new Error('Controle saltou ao expandir o menu');
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (await sidebarSwitch.getAttribute('aria-checked') !== 'false') {
      throw new Error('Estado desativado não persistiu após atualizar');
    }
    await sidebarSwitch.click();
    await page.getByRole('button', { name: 'Reprodução', exact: true }).click();
    await page.locator('#ui-sound-volume').fill('32');
    console.log(`${channel}: reproduzindo efeito`);
    await page.getByRole('button', { name: 'Testar efeito sonoro' }).click();
    const result = await page.evaluate(() => ({
      saved: JSON.parse(localStorage.getItem('zapitv_ui_sound_v1') || '{}'),
      contextState: window.__soundContexts[0]?.state,
      soundNodes: window.__soundNodes
    }));
    if (result.saved.volume !== 32) throw new Error(`Volume não persistido: ${result.saved.volume}`);
    if (result.contextState !== 'running') throw new Error(`AudioContext: ${result.contextState}`);
    if (result.soundNodes < 1) throw new Error('Nenhuma fonte sonora foi sintetizada');
    const secondTab = await browserContext.newPage();
    await secondTab.goto(`${baseUrl}/configuracoes`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const secondSwitch = secondTab.locator('aside').getByRole('switch', { name: 'Sons da interface' });
    await secondSwitch.waitFor({ state: 'visible' });
    await secondTab.waitForTimeout(300);
    await sidebarSwitch.click();
    await secondTab.waitForFunction(() => document.querySelector('aside [role="switch"]')?.getAttribute('aria-checked') === 'false', null, { timeout: 7000 });
    if (await secondSwitch.getAttribute('aria-checked') !== 'false') throw new Error('Outra aba não sincronizou');
    await sidebarSwitch.click();
    await secondTab.close();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Reprodução', exact: true }).click();
    const persisted = await page.locator('#ui-sound-volume').inputValue();
    if (persisted !== '32') throw new Error(`Volume após reload: ${persisted}`);
    const hoverSwitch = page.getByRole('switch', { name: 'Sons ao passar o mouse' });
    const navigationSwitch = page.getByRole('switch', { name: 'Sons de navegação' });
    if (await hoverSwitch.getAttribute('aria-checked') !== 'true') throw new Error('Hover inicial desativado');
    await hoverSwitch.click();
    await navigationSwitch.click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Reprodução', exact: true }).click();
    if (await page.getByRole('switch', { name: 'Sons ao passar o mouse' }).getAttribute('aria-checked') !== 'false' ||
        await page.getByRole('switch', { name: 'Sons de navegação' }).getAttribute('aria-checked') !== 'false') {
      throw new Error('Preferências de hover/navegação não persistiram');
    }
    const testButton = page.getByRole('button', { name: 'Testar efeito sonoro' });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(150);
    const beforeHover = await page.evaluate(() => window.__soundNodes);
    await testButton.hover();
    await page.waitForTimeout(80);
    const afterDisabledHover = await page.evaluate(() => window.__soundNodes);
    if (afterDisabledHover !== beforeHover) throw new Error('Hover tocou estando desativado');
    await page.getByRole('switch', { name: 'Sons ao passar o mouse' }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(180);
    const beforeEnabledHover = await page.evaluate(() => window.__soundNodes);
    await testButton.hover();
    await page.waitForTimeout(80);
    const afterEnabledHover = await page.evaluate(() => window.__soundNodes);
    if (afterEnabledHover <= beforeEnabledHover) throw new Error('Hover ativo não produziu efeito');
    await testButton.locator('svg').hover();
    await page.waitForTimeout(80);
    if (await page.evaluate(() => window.__soundNodes) !== afterEnabledHover) {
      throw new Error('Elemento interno duplicou o hover');
    }
    const mobile = await browserContext.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(`${baseUrl}/configuracoes`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await mobile.getByRole('button', { name: 'Abrir menu de navegação' }).click();
    const mobileSwitch = mobile.locator('aside').getByRole('switch', { name: 'Sons da interface' });
    await mobileSwitch.waitFor({ state: 'visible' });
    const mobileFooter = await mobile.locator('aside > div:last-child').boundingBox();
    const mobileControl = await mobileSwitch.boundingBox();
    if (!mobileFooter || !mobileControl || mobileControl.y + mobileControl.height > mobileFooter.y) {
      throw new Error('Controle mobile desalinhado');
    }
    await mobileSwitch.click();
    if (await mobileSwitch.getAttribute('aria-checked') !== 'false') throw new Error('Controle mobile não alternou');
    await mobile.close();
    console.log(`${channel}: AudioContext ${result.contextState}, ${result.soundNodes} fontes sonoras, volume persistido em ${persisted}%`);
  } catch (error) {
    console.error(`${channel}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
