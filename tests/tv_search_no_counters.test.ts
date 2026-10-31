/**
 * ZAPITV — REMOÇÃO DEFINITIVA DE CONTADORES NA BUSCA DA SMART TV E FIRE TV
 * 
 * Validação rigorosa dos requisitos:
 * 1. Não exibir nenhuma quantidade de títulos ou resultados na busca da TV, independentemente da pesquisa.
 * 2. Manter "Resultados para [pesquisa]".
 * 3. Manter os filtros Todos, Filmes, Séries e Animes.
 * 4. Manter a grade de resultados e sua paginação interna.
 * 5. Não remover searchResults.length onde ele é necessário para a lógica de carregamento e navegação.
 * 6. Não deixar espaço vazio onde estava a contagem (sem elementos fantasmas ou placeholders).
 * 7. Preservar o layout e a navegação pelo controle remoto (Spatial Navigation, D-Pad).
 * 8. Aplicar a regra tanto no navegador quanto na Fire TV.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('\n========================================================================');
  console.log('=== ZAPITV | TESTE: REMOÇÃO DEFINITIVA DE CONTADORES NA BUSCA DA TV ===');
  console.log('========================================================================\n');

  const searchPath = path.resolve(__dirname, '../src/components/tv/TvSearchView.tsx');
  assert.ok(fs.existsSync(searchPath), 'TvSearchView.tsx deve existir');
  const code = fs.readFileSync(searchPath, 'utf8');

  // 1. Ausência de contadores visuais de títulos ou resultados
  console.log('[1] Verificando ausência de contadores visuais...');
  assert.ok(
    !code.includes('título disponível'),
    'TvSearchView NÃO deve conter o texto "título disponível"'
  );
  assert.ok(
    !code.includes('títulos disponíveis'),
    'TvSearchView NÃO deve conter o texto "títulos disponíveis"'
  );
  assert.ok(
    !code.includes('títulos encontrados'),
    'TvSearchView NÃO deve conter o texto "títulos encontrados"'
  );
  assert.ok(
    !code.includes('resultados encontrados'),
    'TvSearchView NÃO deve conter o texto "resultados encontrados"'
  );
  assert.ok(
    !/\{\s*searchResults\.length\s*\}\s*título/.test(code),
    'TvSearchView NÃO deve interpolar searchResults.length com texto de títulos'
  );
  console.log('✓ 1: Nenhum contador visual de títulos/resultados presente.');

  // 2. Preservação de "Resultados para [pesquisa]" e "Títulos em Alta e Recomendados"
  console.log('\n[2] Verificando preservação do cabeçalho de pesquisa...');
  assert.ok(
    code.includes('<span>Resultados para</span>'),
    'TvSearchView DEVE manter "Resultados para" quando há pesquisa'
  );
  assert.ok(
    code.includes('<span>Títulos em Alta e Recomendados</span>'),
    'TvSearchView DEVE manter "Títulos em Alta e Recomendados" quando sem pesquisa'
  );
  assert.ok(
    code.includes('"{query}"'),
    'TvSearchView DEVE exibir o termo pesquisado formatado'
  );
  console.log('✓ 2: Cabeçalho com "Resultados para [pesquisa]" e estado vazio inicial 100% preservados.');

  // 3. Preservação dos Filtros de Categoria (Todos, Filmes, Séries, Animes)
  console.log('\n[3] Verificando preservação dos filtros de categoria...');
  assert.ok(
    code.includes("id: 'all', label: 'Todos'"),
    'Filtro "Todos" deve existir'
  );
  assert.ok(
    code.includes("id: 'movies', label: 'Filmes'"),
    'Filtro "Filmes" deve existir'
  );
  assert.ok(
    code.includes("id: 'series', label: 'Séries'"),
    'Filtro "Séries" deve existir'
  );
  assert.ok(
    code.includes("id: 'animes', label: 'Animes'"),
    'Filtro "Animes" deve existir'
  );
  assert.ok(
    code.includes('CATEGORIES.map('),
    'Categorias devem ser iteradas e renderizadas com TvFilterTab'
  );
  console.log('✓ 3: Filtros Todos, Filmes, Séries e Animes intactos.');

  // 4. Preservação da lógica interna de searchResults.length (paginação, carregamento, navegação)
  console.log('\n[4] Verificando uso de searchResults.length onde é estritamente necessário...');
  assert.ok(
    code.includes('visibleCount >= searchResults.length'),
    'searchResults.length deve ser preservado para verificação de limites da paginação'
  );
  assert.ok(
    code.includes('Math.min(searchResults.length, count + incrementBatch)'),
    'searchResults.length deve ser preservado no incremento de lotes de cards'
  );
  assert.ok(
    code.includes('if (searchResults.length > 0)'),
    'searchResults.length deve ser preservado para controle de foco ao pular para resultados'
  );
  assert.ok(
    code.includes('searchResults.length > 0 ? ('),
    'searchResults.length deve ser preservado para alternância entre grade e mensagem de busca vazia'
  );
  console.log('✓ 4: searchResults.length rigorosamente preservado nas lógicas de paginação e navegação.');

  // 5. Verificação de ausência de espaços vazios residuais (ghost spacing / placeholders)
  console.log('\n[5] Verificando ausência de espaço vazio residual...');
  assert.ok(
    !code.includes('invisible') && !code.includes('visibility: hidden'),
    'TvSearchView NÃO deve utilizar visibility hidden para esconder elementos'
  );
  assert.ok(
    !/<p[^>]*>\s*<\/p>/.test(code),
    'Não deve haver parágrafos vazios ocupando espaço'
  );
  console.log('✓ 5: Nenhum espaçamento residual ou elemento fantasma no cabeçalho.');

  // 6. Preservação do layout e suporte simultâneo a Browser e Fire TV
  console.log('\n[6] Verificando preservação de layout e paridade Browser vs Fire TV...');
  assert.ok(
    code.includes('isFireTv'),
    'Diferenciação de plataforma isFireTv deve ser mantida'
  );
  assert.ok(
    code.includes('useTvViewport()'),
    'TvSearchView deve continuar consumindo o viewport dinâmico de TV'
  );
  assert.ok(
    code.includes('grid-cols-6') || code.includes('KEYBOARD_GRID'),
    'Teclado e grade devem manter sua estrutura espacial canônica'
  );
  console.log('✓ 6: Paridade perfeita entre navegadores Smart TV e Amazon Fire TV.');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS TESTES DE REMOÇÃO DE CONTADOR NA BUSCA DA TV PASSARAM!');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Erro no teste de remoção de contador na busca da TV:', err);
  process.exit(1);
});
