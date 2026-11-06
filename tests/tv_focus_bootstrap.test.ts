import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('=== TEST SUITE: ZapiTV | TV Initial Focus Bootstrap Verification ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tvAppPath = path.resolve(__dirname, '../src/pages/tv/TvApp.tsx');
const tvAppSource = fs.readFileSync(tvAppPath, 'utf8');

// 1. Verifica se o efeito de inicialização de montagem não contém timer redundante de foco
const mountEffectSnippet = tvAppSource.slice(
  tvAppSource.indexOf('// Inicializa gerenciador de navegação espacial e modo TV'),
  tvAppSource.indexOf('// Garante que o foco inicial seja estabelecido')
);
assert.ok(
  !mountEffectSnippet.includes('setTimeout'),
  'Efeito de montagem não deve possuir timer redundante de foco'
);

// 2. Verifica se existe o efeito consolidado que estabelece o foco inicial
assert.ok(
  tvAppSource.includes('// Garante que o foco inicial seja estabelecido assim que a autenticação e o perfil TV forem resolvidos'),
  'TvApp.tsx deve possuir efeito reativo consolidado de bootstrap de foco'
);

// 3. Verifica proteção contra sobrescrita de foco ativo legítimo
assert.ok(
  tvAppSource.includes("if (cur && cur !== 'BODY' && cur !== 'root' && cur !== 'SN:ROOT')"),
  'TvApp.tsx deve verificar se já existe foco válido antes de redefinir'
);

// 4. Verifica verificação de montagem e visibilidade de tv-hero-play
assert.ok(
  tvAppSource.includes('heroPlayEl.offsetParent !== null') && tvAppSource.includes('isHeroPlayUsable'),
  'TvApp.tsx deve verificar se tv-hero-play está montado e visível antes de focar'
);

// 5. Verifica fallback seguro para aba do cabeçalho
assert.ok(
  tvAppSource.includes('tabFocusKeys[currentTab] || \'tv-nav-home\''),
  'TvApp.tsx deve possuir fallback para a aba do cabeçalho caso hero play não esteja usável'
);

console.log('✓ Bootstrap reativo de foco espacial no modo TV validado com sucesso!');
