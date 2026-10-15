import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function generatePngLogos() {
  console.log('Iniciando geração de PNGs em alta definição...');
  const browser = await chromium.launch({ 
    headless: true,
    channel: 'msedge'
  });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  const publicDir = path.resolve('public');
  const artifactsDir = path.resolve('C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d');

  // 1. Símbolo ZapiTV (Ícone Z com Gradiente Animado/Estilizado) - Fundo Transparente
  const symbolSvg = fs.readFileSync(path.join(publicDir, 'zapitv-logo.svg'), 'utf-8');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 20px; background: transparent; display: flex; align-items: center; justify-content: center; }
          svg { width: 512px; height: auto; }
        </style>
      </head>
      <body>
        ${symbolSvg}
      </body>
    </html>
  `);

  const symbolElement = await page.$('svg');
  if (symbolElement) {
    await symbolElement.screenshot({ path: path.join(publicDir, 'zapitv-logo.png'), omitBackground: true });
    await symbolElement.screenshot({ path: path.join(artifactsDir, 'zapitv-logo.png'), omitBackground: true });
    console.log('Gerado zapitv-logo.png com sucesso!');
  }

  // 2. Logo Completa Versão Dark (Texto Branco + TV Azul) - Fundo Transparente
  const darkSvg = fs.readFileSync(path.join(publicDir, 'zapitv-logo-full.svg'), 'utf-8');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;900&family=Sora:wght@700;900&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; padding: 20px; background: transparent; display: flex; align-items: center; justify-content: center; }
          svg { width: 900px; height: auto; }
        </style>
      </head>
      <body>
        ${darkSvg}
      </body>
    </html>
  `);
  await page.evaluate(() => document.fonts.ready);
  const darkElement = await page.$('svg');
  if (darkElement) {
    await darkElement.screenshot({ path: path.join(publicDir, 'zapitv-logo-dark.png'), omitBackground: true });
    await darkElement.screenshot({ path: path.join(artifactsDir, 'zapitv-logo-dark.png'), omitBackground: true });
    console.log('Gerado zapitv-logo-dark.png com sucesso!');
  }

  // 3. Logo Completa Versão Light (Texto Grafite + TV Azul) - Fundo Transparente
  const lightSvg = fs.readFileSync(path.join(publicDir, 'zapitv-logo-full-light.svg'), 'utf-8');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;900&family=Sora:wght@700;900&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; padding: 20px; background: transparent; display: flex; align-items: center; justify-content: center; }
          svg { width: 900px; height: auto; }
        </style>
      </head>
      <body>
        ${lightSvg}
      </body>
    </html>
  `);
  await page.evaluate(() => document.fonts.ready);
  const lightElement = await page.$('svg');
  if (lightElement) {
    await lightElement.screenshot({ path: path.join(publicDir, 'zapitv-logo-light.png'), omitBackground: true });
    await lightElement.screenshot({ path: path.join(artifactsDir, 'zapitv-logo-light.png'), omitBackground: true });
    console.log('Gerado zapitv-logo-light.png com sucesso!');
  }

  // 4. Card / Banner com fundo escuro oficial e brilho
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;900&family=Sora:wght@700;900&display=swap" rel="stylesheet">
        <style>
          body { 
            margin: 0; 
            padding: 40px 60px; 
            background: #05070A; 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            border-radius: 28px; 
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 25px 60px rgba(0,0,0,0.8);
          }
          svg { width: 850px; height: auto; }
        </style>
      </head>
      <body>
        ${darkSvg}
      </body>
    </html>
  `);
  await page.evaluate(() => document.fonts.ready);
  const cardElement = await page.$('body');
  if (cardElement) {
    await cardElement.screenshot({ path: path.join(publicDir, 'zapitv-logo-card.png') });
    await cardElement.screenshot({ path: path.join(artifactsDir, 'zapitv-logo-card.png') });
    console.log('Gerado zapitv-logo-card.png com sucesso!');
  }

  await browser.close();
  console.log('Todos os PNGs gerados com sucesso!');
}

generatePngLogos().catch(err => {
  console.error('Erro ao gerar PNGs:', err);
  process.exit(1);
});
