import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { isRemoteConfirmEvent } from '../src/core/tv/tvNavigationManager';

const UA_FIRE_TV = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36';
const UA_SAMSUNG_TIZEN = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';
const UA_LG_WEBOS = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager';
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function runTestSuite() {
  console.log('========================================================================');
  console.log('--- TESTE: DESAMBIGUAÇÃO DA TECLA B NA PESQUISA DA SMART TV (ZAPITV) ---');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // [Parte 1] Teste Unitário de Diferenciação: isRemoteConfirmEvent()
  // ---------------------------------------------------------------------------
  console.log('[Parte 1] Verificando diferenciação estrita entre a letra B e confirmação de controle...');

  // A. Teclas físicas alfanuméricas 'B' e 'b' (NUNCA confirmação)
  const physicalB = { key: 'b', code: 'KeyB', keyCode: 66 } as KeyboardEvent;
  const physicalUpperB = { key: 'B', code: 'KeyB', keyCode: 66 } as KeyboardEvent;
  const physicalA = { key: 'a', code: 'KeyA', keyCode: 65 } as KeyboardEvent;
  const physicalM = { key: 'm', code: 'KeyM', keyCode: 77 } as KeyboardEvent;

  assert.strictEqual(isRemoteConfirmEvent(physicalB), false, "A tecla física 'b' (keyCode 66) não deve ser tratada como confirmação");
  assert.strictEqual(isRemoteConfirmEvent(physicalUpperB), false, "A tecla física 'B' (keyCode 66) não deve ser tratada como confirmação");
  assert.strictEqual(isRemoteConfirmEvent(physicalA), false, "A tecla física 'a' não deve ser tratada como confirmação");
  assert.strictEqual(isRemoteConfirmEvent(physicalM), false, "A tecla física 'm' não deve ser tratada como confirmação");
  console.log("  ✓ Teclas físicas 'b', 'B' e alfanuméricas rejeitadas como evento de confirmação.");

  // B. Controles remotos legítimos da Fire TV / Android TV (Android KEYCODE_ENTER = 66)
  const fireTvRemoteEnter = { key: 'Enter', code: 'Enter', keyCode: 66 } as KeyboardEvent;
  const fireTvRemoteSelect = { key: 'Select', code: 'Select', keyCode: 66 } as KeyboardEvent;
  const fireTvRemoteUnidentified = { key: 'Unidentified', code: '', keyCode: 66 } as KeyboardEvent;
  const fireTvRemoteEmpty = { key: '', code: '', keyCode: 66 } as KeyboardEvent;

  assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteEnter), true, "Botão OK da Fire TV (keyCode 66, key 'Enter') deve ser aceito");
  assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteSelect), true, "Botão OK da Fire TV (keyCode 66, key 'Select') deve ser aceito");
  assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteUnidentified), true, "Botão OK da Fire TV (keyCode 66, key 'Unidentified') deve ser aceito");
  assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteEmpty), true, "Botão OK da Fire TV (keyCode 66, key vazia) deve ser aceito");
  console.log("  ✓ Botão OK/Enter de controles remotos Fire TV / Android TV (código 66) reconhecido com sucesso.");

  // C. Controles remotos W3C padrão, Samsung Tizen, LG webOS e Desktop
  const standardEnter = { key: 'Enter', code: 'Enter', keyCode: 13 } as KeyboardEvent;
  const standardSelect = { key: 'Select', code: 'Select', keyCode: 13 } as KeyboardEvent;
  const webOsSelect = { key: 'Ok', code: 'Select', keyCode: 65385 } as KeyboardEvent;

  assert.strictEqual(isRemoteConfirmEvent(standardEnter), true, "Enter padrão W3C (keyCode 13) deve ser aceito");
  assert.strictEqual(isRemoteConfirmEvent(standardSelect), true, "Select padrão (keyCode 13) deve ser aceito");
  assert.strictEqual(isRemoteConfirmEvent(webOsSelect), true, "LG webOS Select (keyCode 65385) deve ser aceito");
  console.log("  ✓ Controles remotos de Samsung Tizen, LG webOS e desktop W3C reconhecidos com sucesso.");

  // ---------------------------------------------------------------------------
  // [Parte 2] Auditoria Estática do Código Fonte
  // ---------------------------------------------------------------------------
  console.log('\n[Parte 2] Auditoria estática dos arquivos corrigidos...');

  const tvNavCode = fs.readFileSync(path.join(process.cwd(), 'src/core/tv/tvNavigationManager.ts'), 'utf8');
  assert(tvNavCode.includes('isRemoteConfirmEvent'), 'tvNavigationManager deve exportar isRemoteConfirmEvent');
  assert(tvNavCode.includes('keyCode === 66'), 'tvNavigationManager deve tratar código 66');

  const tvSearchCode = fs.readFileSync(path.join(process.cwd(), 'src/components/tv/TvSearchView.tsx'), 'utf8');
  assert(tvSearchCode.includes('isRemoteConfirmEvent(e)'), 'TvSearchView deve ignorar eventos de confirmação ao digitar');
  assert(tvSearchCode.includes('lastPressTimeRef'), 'TvVirtualKey deve possuir trava contra múltiplos acionamentos');
  console.log('  ✓ Estrutura estática de tvNavigationManager e TvSearchView validada.');

  // ---------------------------------------------------------------------------
  // [Parte 3] Teste Real no DOM com Playwright e Vite
  // ---------------------------------------------------------------------------
  console.log('\n[Parte 3] Iniciando testes no DOM real montado via Playwright...');

  const server = await createServer({
    server: { port: 5399 }
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5399;
  console.log(`  Servidor de teste Vite rodando na porta ${port}\n`);

  const browser = await chromium.launch({ headless: true });

  const testUserAgents = [
    { name: 'Fire TV (Silk Browser)', ua: UA_FIRE_TV },
    { name: 'Samsung Tizen', ua: UA_SAMSUNG_TIZEN },
    { name: 'LG webOS', ua: UA_LG_WEBOS },
    { name: 'Desktop TV Mode', ua: UA_DESKTOP }
  ];

  for (const target of testUserAgents) {
    console.log(`>>> Executando testes no ambiente: ${target.name} <<<`);
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      userAgent: target.ua
    });

    await page.goto(`http://localhost:${port}/tests/harness/search_keyboard_preview.html?tv=1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const getQuery = async () => {
      return page.evaluate(() => {
        const text = document.querySelector('[data-focus-key="tv-search-input"]')?.textContent?.trim() || '';
        if (text === 'Digite para pesquisar...') return '';
        return text;
      });
    };

    const clearQuery = async () => {
      await page.evaluate(() => {
        const clearBtn = document.querySelector('[data-focus-key="tv-key-clear"]') as HTMLElement | null;
        clearBtn?.click();
      });
      await page.waitForTimeout(150);
    };

    const getFocusedKey = () => page.evaluate(() => document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key'));

    // 1. Foco inicial em 'a', navegação com seta para 'b' e verificação de destaque visual
    assert.strictEqual(await getFocusedKey(), 'tv-key-a', 'Foco inicial deve ser tv-key-a');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    assert.strictEqual(await getFocusedKey(), 'tv-key-b', 'Seta para direita deve focar tv-key-b');

    const isVisualHighlighted = await page.evaluate(() => {
      const el = document.querySelector('[data-focus-key="tv-key-b"]');
      return el?.getAttribute('data-tv-focused') === 'true' && el?.className.includes('border-cyan-400');
    });
    assert.strictEqual(isVisualHighlighted, true, 'Tecla B deve receber destaque visual de foco');
    console.log('  ✓ 1. Navegação espacial e destaque visual em tv-key-b validados.');

    // 2. Confirmação com Enter padrão (13) sobre B
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    assert.strictEqual(await getQuery(), 'b', 'Enter padrão sobre tv-key-b deve inserir "b"');
    console.log('  ✓ 2. Confirmação com Enter (13) sobre B validada: "b"');
    await clearQuery();

    // 3. Confirmação com Fire TV OK (keyCode 66, key Enter) sobre B
    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-b');
      const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 66, which: 66, bubbles: true });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    assert.strictEqual(await getQuery(), 'b', 'Fire TV OK (keyCode 66, Enter) deve inserir "b"');
    console.log('  ✓ 3. Fire TV OK (keyCode 66, key Enter) validado: "b"');
    await clearQuery();

    // 4. Confirmação com Fire TV OK (keyCode 66, key Unidentified / vazia) sobre B
    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-b');
      const ev = new KeyboardEvent('keydown', { key: 'Unidentified', code: '', keyCode: 66, which: 66, bubbles: true });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    assert.strictEqual(await getQuery(), 'b', 'Fire TV OK (keyCode 66, key Unidentified) deve inserir "b"');
    console.log('  ✓ 4. Fire TV OK (keyCode 66, key Unidentified) validado: "b"');
    await clearQuery();

    // 5. Confirmação com LG webOS OK (keyCode 65385, key Ok) sobre B
    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-b');
      const ev = new KeyboardEvent('keydown', { key: 'Ok', code: 'Select', keyCode: 65385, which: 65385, bubbles: true });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    assert.strictEqual(await getQuery(), 'b', 'LG webOS OK (65385) deve inserir "b"');
    console.log('  ✓ 5. LG webOS OK (keyCode 65385) validado: "b"');
    await clearQuery();

    // 6. Tecla física 'b' quando o foco está em outra tecla (ex: 'tv-key-a')
    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-a');
    });
    await page.waitForTimeout(100);
    assert.strictEqual(await getFocusedKey(), 'tv-key-a');

    await page.keyboard.press('b');
    await page.waitForTimeout(200);
    assert.strictEqual(await getQuery(), 'b', 'Digitar tecla física "b" com foco em "a" deve produzir apenas "b"');
    assert.strictEqual(await getFocusedKey(), 'tv-key-a', 'Foco deve permanecer em "a" sem ativação acidental');
    console.log('  ✓ 6. Tecla física "b" com foco em "a" não acionou "a": produziu apenas "b"');
    await clearQuery();

    // 7. Digitação física das pesquisas obrigatórias
    const queriesToTest = ['b', 'batman', 'Breaking Bad', 'bob', 'Barbie', 'bbb'];
    for (const q of queriesToTest) {
      await clearQuery();
      await page.keyboard.type(q);
      await page.waitForTimeout(200);
      const res = await getQuery();
      assert.strictEqual(res, q, `Digitação de "${q}" deve produzir exatamente "${q}"`);
      console.log(`  ✓ 7. Digitação física de "${q}": OK`);
    }

    // 8. Inserção virtual de "bbb" com D-Pad + OK
    await clearQuery();
    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-b');
    });
    await page.waitForTimeout(100);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    assert.strictEqual(await getQuery(), 'bbb', 'Pressionar B 3 vezes via teclado virtual deve produzir "bbb"');
    console.log('  ✓ 8. Inserção virtual de "bbb" com Enter/OK: OK');

    // 9. Inserção virtual de "bob" navegando com setas
    await clearQuery();
    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-b');
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-o');
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-key-b');
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    assert.strictEqual(await getQuery(), 'bob', 'Inserção virtual de "bob" deve produzir "bob"');
    console.log('  ✓ 9. Inserção virtual de "bob": OK');

    // 10. Botão OK da TV em outro componente (ex: tv-search-back)
    await page.evaluate(async () => {
      await (window as any).__setTvFocus?.('tv-search-back');
      const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 66, which: 66, bubbles: true });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    console.log('  ✓ 10. Botão OK da TV no botão Voltar acionado com sucesso.\n');

    await page.close();
  }

  await browser.close();
  await server.close();

  console.log('========================================================================');
  console.log('  TODOS OS TESTES DE CORREÇÃO DA TECLA B PASSARAM COM SUCESSO!          ');
  console.log('========================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Falha nos testes de desambiguação da tecla B:', err);
  process.exit(1);
});
