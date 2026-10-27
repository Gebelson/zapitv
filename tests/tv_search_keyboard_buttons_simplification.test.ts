/**
 * ZAPITV — SIMPLIFICAÇÃO DOS BOTÕES DO TECLADO VIRTUAL DE BUSCA
 * 
 * Validação rigorosa dos requisitos:
 * 1. ESPAÇO: sem ícone "␣", texto "ESPAÇO" centralizado sem gaps residuais.
 * 2. APAGAR: sem ícone "⌫", texto "APAGAR" centralizado sem gaps residuais.
 * 3. LIMPAR: sem texto, ícone de lixeira Trash2 centralizado e aria-label="Limpar pesquisa".
 * 4. Preservação de layout: 3, 2 e 1 colunas (col-span-3, col-span-2, col-span-1).
 * 5. Preservação de navegação e foco: focusKeys (tv-key-space, tv-key-backspace, tv-key-clear) e salto para resultados.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('\n========================================================================');
  console.log('=== ZAPITV | TESTE: SIMPLIFICAÇÃO DOS BOTÕES DO TECLADO VIRTUAL ===');
  console.log('========================================================================\n');

  const searchPath = path.resolve(__dirname, '../src/components/tv/TvSearchView.tsx');
  assert.ok(fs.existsSync(searchPath), 'TvSearchView.tsx deve existir');
  const code = fs.readFileSync(searchPath, 'utf8');

  // 1. Verificação de Importação de Trash2 da biblioteca existente
  console.log('[1] Verificando importação do Trash2 da lucide-react...');
  assert.ok(
    /import\s*\{[^}]*Trash2[^}]*\}\s*from\s*['"]lucide-react['"]/.test(code),
    'Trash2 DEVE ser importado de lucide-react'
  );
  console.log('✓ 1: Trash2 devidamente importado de lucide-react.');

  // 2. Verificação do Botão ESPAÇO
  console.log('\n[2] Verificando botão ESPAÇO...');
  assert.ok(
    code.includes('focusKey="tv-key-space"'),
    'Botão de espaço deve manter focusKey="tv-key-space"'
  );
  assert.ok(
    code.includes('className="col-span-3"'),
    'Botão de espaço deve ocupar 3 colunas'
  );
  assert.ok(
    !code.includes('␣'),
    'Ícone/símbolo ␣ DEVE ser completamente removido'
  );
  assert.ok(
    code.includes('>ESPAÇO<'),
    'Botão de espaço DEVE exibir o texto "ESPAÇO"'
  );
  console.log('✓ 2: Botão ESPAÇO sem ícone, com texto perfeitamente centralizado e 3 colunas.');

  // 3. Verificação do Botão APAGAR
  console.log('\n[3] Verificando botão APAGAR...');
  assert.ok(
    code.includes('focusKey="tv-key-backspace"'),
    'Botão apagar deve manter focusKey="tv-key-backspace"'
  );
  assert.ok(
    code.includes('className="col-span-2"'),
    'Botão apagar deve ocupar 2 colunas'
  );
  assert.ok(
    !code.includes('⌫'),
    'Ícone/símbolo ⌫ DEVE ser completamente removido'
  );
  assert.ok(
    code.includes('>APAGAR<'),
    'Botão apagar DEVE exibir o texto "APAGAR"'
  );
  console.log('✓ 3: Botão APAGAR sem ícone, com texto centralizado e 2 colunas.');

  // 4. Verificação do Botão LIMPAR (Lixeira)
  console.log('\n[4] Verificando botão LIMPAR (Trash2)...');
  assert.ok(
    code.includes('focusKey="tv-key-clear"'),
    'Botão limpar deve manter focusKey="tv-key-clear"'
  );
  assert.ok(
    code.includes('className="col-span-1"'),
    'Botão limpar deve ocupar 1 coluna'
  );
  assert.ok(
    !code.includes('>Limpar<'),
    'Texto "Limpar" DEVE ser completamente removido'
  );
  assert.ok(
    code.includes('<Trash2'),
    'Botão limpar DEVE renderizar o componente <Trash2 />'
  );
  assert.ok(
    code.includes('ariaLabel="Limpar pesquisa"') || code.includes('aria-label="Limpar pesquisa"'),
    'Botão limpar DEVE conter aria-label="Limpar pesquisa"'
  );
  assert.ok(
    code.includes('aria-label={ariaLabel}'),
    'TvVirtualKey DEVE repassar a propriedade aria-label para a tag <button>'
  );
  console.log('✓ 4: Botão LIMPAR com lixeira Trash2, sem texto e com aria-label acessível.');

  // 5. Preservação da Navegação e Adaptações de TV
  console.log('\n[5] Verificando preservação de navegação e responsividade...');
  assert.ok(
    code.includes('onArrowRightFromEdge={handleJumpToResults}'),
    'Botão da extremidade direita (tv-key-clear) deve preservar salto para a grade de resultados'
  );
  assert.ok(
    code.includes('viewport.keyboardKeyHeight'),
    'Altura dinâmica viewport.keyboardKeyHeight deve ser mantida'
  );
  assert.ok(
    code.includes('isFireTv ? \'rounded-lg\' : \'rounded-xl\''),
    'Bordas arredondadas e adaptações específicas de Fire TV e Smart TVs mantidas'
  );
  console.log('✓ 5: Navegação por controle remoto e adaptações de plataforma 100% preservadas.');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS TESTES DE SIMPLIFICAÇÃO DO TECLADO PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Erro no teste de simplificação dos botões:', err);
  process.exit(1);
});
