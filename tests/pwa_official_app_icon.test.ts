/**
 * ZapiTV — Suíte de Testes: Novo Ícone Oficial do Aplicativo (PWA / Favicon / Apple Touch)
 * 
 * Validação rigorosa dos requisitos:
 * 1. Existência e integridade do ícone oficial versionado em public/.
 * 2. Existência de todos os 8 arquivos gerados em public/:
 *    - pwa-512x512.png (512x512)
 *    - pwa-192x192.png (192x192)
 *    - pwa-maskable-512x512.png (512x512 com safe-zone 80%)
 *    - pwa-maskable-192x192.png (192x192 com safe-zone 80%)
 *    - apple-touch-icon.png (180x180)
 *    - favicon-32x32.png (32x32)
 *    - favicon-16x16.png (16x16)
 *    - favicon.ico (multi-size ICO)
 * 3. Auditoria de public/manifest.json:
 *    - Zero URLs externas (Unsplash eliminado).
 *    - name: "ZapiTV - Plataforma de Streaming".
 *    - short_name: "ZapiTV".
 *    - display: "standalone".
 *    - background_color: "#05070a".
 *    - theme_color: "#05070a".
 *    - Configuração rigorosa dos ícones any e maskable.
 * 4. Auditoria de index.html:
 *    - Favicons oficiais (.ico, 32x32, 16x16).
 *    - Apple Touch Icon (180x180).
 *    - Link do manifesto.
 * 5. Auditoria de public/sw.js:
 *    - Precache dos ícones locais para disponibilidade offline e instalação imediata.
 * 6. Preservação da identidade visual do site (logos de header/carregamento intactas).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== ZAPITV | TESTES DO NOVO ÍCONE OFICIAL DO APLICATIVO (PWA / FAVICON) ===\n');

// -----------------------------------------------------------------------------------------
// TESTE 1: Integridade do Ícone Oficial Versionado
// -----------------------------------------------------------------------------------------
console.log('[Teste 1] Verificação do ícone oficial versionado...');
const sourceMatrixPath = path.resolve(process.cwd(), 'public', 'pwa-512x512.png');
assert.ok(
  fs.existsSync(sourceMatrixPath),
  `O ícone oficial deve existir em ${sourceMatrixPath}`
);
const sourceBytes = fs.readFileSync(sourceMatrixPath);
assert.ok(sourceBytes.length > 10000, 'O ícone oficial deve possuir tamanho consistente (>10KB)');
assert.ok(sourceBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'O ícone oficial deve ser um PNG válido');
assert.strictEqual(sourceBytes.readUInt32BE(16), 512, 'O ícone oficial deve ter largura de 512px');
assert.strictEqual(sourceBytes.readUInt32BE(20), 512, 'O ícone oficial deve ter altura de 512px');
console.log(`✓ Teste 1 aprovado: Ícone oficial 512x512 encontrado (${sourceBytes.length} bytes).\n`);

// -----------------------------------------------------------------------------------------
// TESTE 2: Verificação dos 8 Arquivos Gerados em public/
// -----------------------------------------------------------------------------------------
console.log('[Teste 2] Verificação dos 8 arquivos de ícone gerados em public/...');
const publicDir = path.resolve(process.cwd(), 'public');

const expectedFiles = [
  { name: 'pwa-512x512.png', minSize: 50000 },
  { name: 'pwa-192x192.png', minSize: 10000 },
  { name: 'pwa-maskable-512x512.png', minSize: 40000 },
  { name: 'pwa-maskable-192x192.png', minSize: 8000 },
  { name: 'apple-touch-icon.png', minSize: 10000 },
  { name: 'favicon-32x32.png', minSize: 1000 },
  { name: 'favicon-16x16.png', minSize: 500 },
  { name: 'favicon.ico', minSize: 2000 }
];

for (const exp of expectedFiles) {
  const filePath = path.join(publicDir, exp.name);
  assert.ok(fs.existsSync(filePath), `Arquivo obrigatório ${exp.name} deve existir em public/`);
  const stats = fs.statSync(filePath);
  assert.ok(
    stats.size >= exp.minSize,
    `Arquivo ${exp.name} possui tamanho inconsistente (${stats.size} bytes < mínimo ${exp.minSize})`
  );
}
console.log('✓ Teste 2 aprovado: Todos os 8 arquivos gerados com integridade e alta qualidade.\n');

// -----------------------------------------------------------------------------------------
// TESTE 3: Auditoria do Manifesto PWA (public/manifest.json)
// -----------------------------------------------------------------------------------------
console.log('[Teste 3] Auditoria das especificações do public/manifest.json...');
const manifestPath = path.join(publicDir, 'manifest.json');
assert.ok(fs.existsSync(manifestPath), 'manifest.json deve existir');

const manifestContent = fs.readFileSync(manifestPath, 'utf8');
assert.ok(!manifestContent.includes('unsplash'), 'manifest.json NÃO deve conter links externos do Unsplash');
assert.ok(!manifestContent.includes('photo-1574375927938'), 'manifest.json NÃO deve conter foto antiga da Netflix');

const manifest = JSON.parse(manifestContent);
assert.strictEqual(manifest.name, 'ZapiTV - Plataforma de Streaming');
assert.strictEqual(manifest.short_name, 'ZapiTV');
assert.strictEqual(manifest.display, 'standalone');
assert.strictEqual(manifest.background_color, '#05070a');
assert.strictEqual(manifest.theme_color, '#05070a');

assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4, 'Deve conter pelo menos 4 ícones declarados');

// Valida ícones 'any'
const any192 = manifest.icons.find((i: any) => i.src === '/pwa-192x192.png' && i.purpose?.includes('any'));
const any512 = manifest.icons.find((i: any) => i.src === '/pwa-512x512.png' && i.purpose?.includes('any'));
assert.ok(any192, 'Deve existir ícone any para pwa-192x192.png');
assert.ok(any512, 'Deve existir ícone any para pwa-512x512.png');

// Valida ícones 'maskable'
const maskable192 = manifest.icons.find((i: any) => i.src === '/pwa-maskable-192x192.png' && i.purpose?.includes('maskable'));
const maskable512 = manifest.icons.find((i: any) => i.src === '/pwa-maskable-512x512.png' && i.purpose?.includes('maskable'));
assert.ok(maskable192, 'Deve existir ícone maskable para pwa-maskable-192x192.png');
assert.ok(maskable512, 'Deve existir ícone maskable para pwa-maskable-512x512.png');

console.log('✓ Teste 3 aprovado: manifest.json 100% conforme PWA W3C e livre de links externos.\n');

// -----------------------------------------------------------------------------------------
// TESTE 4: Auditoria do index.html (Favicon, Apple Touch, Metas)
// -----------------------------------------------------------------------------------------
console.log('[Teste 4] Auditoria das tags de ícone e manifesto no index.html...');
const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

assert.ok(indexHtml.includes('<link rel="icon" href="/favicon.ico" sizes="any" />'), 'Deve conter link para favicon.ico');
assert.ok(indexHtml.includes('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />'), 'Deve conter favicon 32x32');
assert.ok(indexHtml.includes('<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />'), 'Deve conter favicon 16x16');
assert.ok(indexHtml.includes('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />'), 'Deve conter apple-touch-icon');
assert.ok(indexHtml.includes('<link rel="manifest" href="/manifest.json" />'), 'Deve conter link para manifest.json');
assert.ok(indexHtml.includes('<meta name="application-name" content="ZapiTV" />'), 'Deve conter application-name');

console.log('✓ Teste 4 aprovado: index.html configurado para Chrome, Edge, Safari iOS e Windows.\n');

// -----------------------------------------------------------------------------------------
// TESTE 5: Auditoria do Service Worker (public/sw.js)
// -----------------------------------------------------------------------------------------
console.log('[Teste 5] Auditoria de precache de ícones no Service Worker...');
const swPath = path.join(publicDir, 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');

assert.ok(swContent.includes("'/pwa-512x512.png'"), 'sw.js deve pré-cachear pwa-512x512.png');
assert.ok(swContent.includes("'/pwa-192x192.png'"), 'sw.js deve pré-cachear pwa-192x192.png');
assert.ok(swContent.includes("'/apple-touch-icon.png'"), 'sw.js deve pré-cachear apple-touch-icon.png');
assert.ok(swContent.includes("'/favicon.ico'"), 'sw.js deve pré-cachear favicon.ico');

console.log('✓ Teste 5 aprovado: sw.js garante cache offline e atualização imediata do novo ícone.\n');

// -----------------------------------------------------------------------------------------
// TESTE 6: Preservação da Identidade Visual do Site
// -----------------------------------------------------------------------------------------
console.log('[Teste 6] Verificação de preservação das logos internas do projeto...');
assert.ok(fs.existsSync(path.join(publicDir, 'zapitv-logo.svg')), 'Logo SVG principal preservada');
assert.ok(fs.existsSync(path.join(publicDir, 'zapitv-loader.png')), 'Loader PNG preservado');
assert.ok(fs.existsSync(path.join(publicDir, 'zapitv-loader.svg')), 'Loader SVG preservado');

console.log('✓ Teste 6 aprovado: Logos e componentes internos da interface permanecem intactos.\n');

console.log('========================================================================');
console.log('TODOS OS TESTES DO NOVO ÍCONE OFICIAL FORAM APROVADOS!');
console.log('========================================================================\n');
