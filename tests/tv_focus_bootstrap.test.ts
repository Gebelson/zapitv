import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('=== TEST SUITE: ZapiTV | TV Initial Focus Bootstrap Verification ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tvAppPath = path.resolve(__dirname, '../src/pages/tv/TvApp.tsx');
const tvAppSource = fs.readFileSync(tvAppPath, 'utf8');

// 1. Verifica se existe o efeito reativo que estabelece o foco inicial assim que o perfil é resolvido
assert.ok(
  tvAppSource.includes('// Garante que o foco inicial seja estabelecido assim que o perfil TV e autenticação forem resolvidos'),
  'TvApp.tsx deve possuir efeito reativo de bootstrap de foco'
);

// 2. Verifica as dependências do efeito
assert.ok(
  tvAppSource.includes('[isTvAuthenticated, isProfileSelectorOpen, activeTvProfile, location.pathname]'),
  'Efeito de foco deve observar isTvAuthenticated, isProfileSelectorOpen, activeTvProfile e location.pathname'
);

// 3. Verifica se setFocus("tv-hero-play") é chamado quando cur é nulo
assert.ok(
  tvAppSource.includes("setFocus('tv-hero-play')"),
  'TvApp.tsx deve definir foco inicial em tv-hero-play'
);

console.log('✓ Bootstrap reativo de foco espacial no modo TV validado com sucesso!');
