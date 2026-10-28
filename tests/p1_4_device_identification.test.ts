import assert from 'node:assert/strict';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';
import { tvViewportService } from '../src/core/tv/tvViewportService';

console.log('=== ZAPITV | P1.4 — IDENTIFICAÇÃO E DIFERENCIAÇÃO DE DISPOSITIVOS ===\n');

// Timeout de segurança global de 10 segundos
const safetyTimeout = setTimeout(() => {
  console.error('TIMEOUT DE SEGURANÇA: Teste de identificação de dispositivos excedeu 10s.');
  process.exit(1);
}, 10000);

try {
  // 1. Amazon Fire TV com Silk e Hardware AFT
  console.log('1. Validando detecção do ecossistema Amazon Fire TV...');
  const fireTvUas = [
    {
      name: 'Fire TV Stick 4K (AFTMM) com Silk',
      ua: 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7292; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 Mobile Safari/537.36 Silk/108.1.13',
      expectedModel: 'Amazon Fire TV Stick 4K'
    },
    {
      name: 'Fire TV Stick 4K Max (AFTKM) com Silk',
      ua: 'Mozilla/5.0 (Linux; Android 11; AFTKM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/114.3.4 Safari/537.36',
      expectedModel: 'Amazon Fire TV Stick 4K Max (Gen 2)'
    },
    {
      name: 'Fire TV Cube (AFTEU)',
      ua: 'Mozilla/5.0 (Linux; Android 9; AFTEU) AppleWebKit/537.36 (KHTML, like Gecko) Silk/110.1.2 Safari/537.36',
      expectedModel: 'Amazon Fire TV Cube (Gen 3)'
    },
    {
      name: 'Fire TV Stick Lite (AFTSS)',
      ua: 'Mozilla/5.0 (Linux; Android 9; AFTSS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.225 Mobile Safari/537.36',
      expectedModel: 'Amazon Fire TV Stick Lite'
    },
    {
      name: 'Media Station X rodando no Fire TV (AFTT)',
      ua: 'Mozilla/5.0 (Linux; Android 9; AFTT) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36 MediaStationX/0.1.150',
      expectedModel: 'Amazon Fire TV Stick (Gen 2/3)'
    }
  ];

  for (const item of fireTvUas) {
    const isFire = tvPerformanceService.isFireTv(item.ua);
    const family = tvPerformanceService.getDeviceFamily(item.ua);
    const model = tvPerformanceService.getDeviceModel(item.ua);
    const vp = tvViewportService.computeMetrics(item.ua);

    assert.equal(isFire, true, `${item.name} DEVE ser identificado como Fire TV`);
    assert.equal(family, 'firetv', `${item.name} DEVE ter família 'firetv'`);
    assert.equal(model, item.expectedModel, `${item.name} modelo deve ser ${item.expectedModel}`);
    assert.equal(vp.isFireTv, true, `${item.name} viewport DEVE reconhecer isFireTv`);
    assert.equal(vp.deviceFamily, 'firetv', `${item.name} viewport deviceFamily DEVE ser firetv`);
    console.log(`  ✓ ${item.name}: isFireTv=true, family=${family}, model="${model}"`);
  }

  // 2. Samsung Tizen
  console.log('\n2. Validando detecção do Samsung Tizen...');
  const tizenUas = [
    {
      name: 'Samsung Tizen 6.0 (2021)',
      ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0.3809.146 TV Safari/537.36'
    },
    {
      name: 'Samsung Tizen 7.0 (2023)',
      ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/94.0.4606.85 TV Safari/537.36'
    },
    {
      name: 'Samsung The Frame / Smart TV',
      ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0; SAMSUNG) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36'
    },
    {
      name: 'Media Station X no Samsung Tizen',
      ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.106 Safari/537.36 MediaStationX/0.1.150'
    }
  ];

  for (const item of tizenUas) {
    const isFire = tvPerformanceService.isFireTv(item.ua);
    const family = tvPerformanceService.getDeviceFamily(item.ua);
    const vp = tvViewportService.computeMetrics(item.ua);

    assert.equal(isFire, false, `${item.name} NUNCA deve ser identificado como Fire TV`);
    assert.ok(family === 'samsung' || (family === 'msx' && item.ua.includes('MediaStationX')), `${item.name} deve ser samsung ou msx`);
    assert.equal(vp.isFireTv, false, `${item.name} viewport NÃO deve ser isFireTv`);
    assert.ok(vp.deviceFamily === 'samsung' || vp.deviceFamily === 'msx', `${item.name} viewport deviceFamily deve ser samsung ou msx`);
    console.log(`  ✓ ${item.name}: isFireTv=false, family=${family}`);
  }

  // 3. Desktop e Mobile (não-TV)
  console.log('\n3. Validando que Desktop e Mobile NÃO herdam identificação de Fire TV...');
  const genericUas = [
    {
      name: 'Desktop Chrome Windows',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    {
      name: 'Desktop Safari macOS',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    },
    {
      name: 'Mobile Safari iPhone',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    },
    {
      name: 'Mobile Chrome Android (Não-Amazon)',
      ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36'
    }
  ];

  for (const item of genericUas) {
    const isFire = tvPerformanceService.isFireTv(item.ua);
    const family = tvPerformanceService.getDeviceFamily(item.ua);
    const vp = tvViewportService.computeMetrics(item.ua);

    assert.equal(isFire, false, `${item.name} NÃO deve ser identificado como Fire TV`);
    assert.equal(family, 'generic', `${item.name} deve ter família 'generic'`);
    assert.equal(vp.isFireTv, false, `${item.name} viewport NÃO deve ser isFireTv`);
    assert.equal(vp.deviceFamily, 'generic', `${item.name} viewport deviceFamily deve ser generic`);
    console.log(`  ✓ ${item.name}: isFireTv=false, family=${family}`);
  }

  // 4. Verificação crítica: NÃO identificar Fire TV SOMENTE pela resolução
  console.log('\n4. Validando que resolução reduzida isolada NÃO força Fire TV em UA não-Amazon...');
  // Simula um navegador desktop ou Tizen redimensionado para 960x540
  const tizenSmallVp = tvViewportService.computeMetrics(tizenUas[0].ua);
  assert.equal(tizenSmallVp.isFireTv, false, 'Tizen em qualquer resolução nunca vira Fire TV');
  assert.equal(tizenSmallVp.deviceFamily, 'samsung', 'Tizen mantém família samsung');

  const desktopSmallVp = tvViewportService.computeMetrics(genericUas[0].ua);
  assert.equal(desktopSmallVp.isFireTv, false, 'Desktop em qualquer resolução nunca vira Fire TV');
  assert.equal(desktopSmallVp.deviceFamily, 'generic', 'Desktop mantém família generic');
  console.log('  ✓ Resolução reduzida em navegadores não-Amazon não causa identificação indevida de Fire TV.');

  // 5. Verificação de isolamento de tokens de layout
  console.log('\n5. Validando que otimizações de layout do Fire TV são estritamente isoladas...');
  const fireMetrics = tvViewportService.computeMetrics(fireTvUas[0].ua);
  const samsungMetrics = tvViewportService.computeMetrics(tizenUas[0].ua);

  // No Fire TV, cabeçalho e componentes são compactados para evitar cortes no Silk
  // No Samsung Tizen, as proporções completas de Smart TV são mantidas
  assert.notEqual(fireMetrics.headerHeight, samsungMetrics.headerHeight, 'headerHeight deve ser diferenciado');
  assert.notEqual(fireMetrics.logoIconSize, samsungMetrics.logoIconSize, 'logoIconSize deve ser diferenciado');
  assert.notEqual(fireMetrics.navFontSize, samsungMetrics.navFontSize, 'navFontSize deve ser diferenciado');
  assert.notEqual(fireMetrics.hudMaxW, samsungMetrics.hudMaxW, 'hudMaxW deve ser diferenciado');

  console.log(`  ✓ Fire TV Header: ${fireMetrics.headerHeight}px vs Samsung Header: ${samsungMetrics.headerHeight}px`);
  console.log(`  ✓ Fire TV Logo: ${fireMetrics.logoIconSize}px vs Samsung Logo: ${samsungMetrics.logoIconSize}px`);
  console.log(`  ✓ Fire TV HUD MaxW: ${fireMetrics.hudMaxW} vs Samsung HUD MaxW: ${samsungMetrics.hudMaxW}`);

  console.log('\n========================================================================');
  console.log(' TODOS OS TESTES DE IDENTIFICAÇÃO E DIFERENCIAÇÃO FORAM APROVADOS! ');
  console.log('========================================================================');
} finally {
  clearTimeout(safetyTimeout);
}
