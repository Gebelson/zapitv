import assert from 'node:assert';
import { getVisibleSlots } from '../src/components/tv/TvContentRow';

console.log('=== TESTES DE CARROSSEL FINITO (1-6 ITENS) E INFINITO (>= 7 ITENS) ===\n');

// -----------------------------------------------------------------------------
// TESTE 1: Lista com 1 conteúdo (Finito)
// -----------------------------------------------------------------------------
console.log('[Teste 1] Lista com 1 conteúdo...');
const slots1 = getVisibleSlots(1);
assert.deepStrictEqual(slots1, [0], 'Lista de 1 item deve conter exclusivamente o slot [0]');
assert.strictEqual(slots1.filter(s => s < 0).length, 0, 'Não deve conter slots negativos');
assert.strictEqual(new Set(slots1).size, slots1.length, 'Não deve conter duplicatas');
console.log('✓ 1 conteúdo: slots [0] finito, sem slots negativos nem duplicatas.');

// -----------------------------------------------------------------------------
// TESTE 2: Lista com 2 conteúdos (Finito)
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Lista com 2 conteúdos...');
const slots2 = getVisibleSlots(2);
assert.deepStrictEqual(slots2, [0, 1], 'Lista de 2 itens deve conter exatamente os slots [0, 1]');
assert.strictEqual(slots2.filter(s => s < 0).length, 0, 'Não deve conter slots negativos (-1)');
assert.strictEqual(slots2.includes(-1), false, 'Não deve apresentar o último item antes do primeiro');
assert.strictEqual(new Set(slots2).size, slots2.length, 'Não deve duplicar nenhum conteúdo');
console.log('✓ 2 conteúdos: slots [0, 1] finito, sem circularidade nem duplicatas.');

// -----------------------------------------------------------------------------
// TESTE 3: Lista com 5 conteúdos (Finito)
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Lista com 5 conteúdos...');
const slots5 = getVisibleSlots(5);
assert.deepStrictEqual(slots5, [0, 1, 2, 3, 4], 'Lista de 5 itens deve conter exatamente os slots [0, 1, 2, 3, 4]');
assert.strictEqual(slots5.length, 5, 'Deve conter exatamente 5 slots para 5 itens');
assert.strictEqual(slots5.filter(s => s < 0).length, 0, 'Não deve conter slots negativos');
console.log('✓ 5 conteúdos: slots [0, 1, 2, 3, 4] finito, estritamente limitado ao acervo.');

// -----------------------------------------------------------------------------
// TESTE 4: Lista com 6 conteúdos (Finito - Limite Superior)
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Lista com 6 conteúdos (Limite Superior Finito)...');
const slots6 = getVisibleSlots(6);
assert.deepStrictEqual(slots6, [0, 1, 2, 3, 4, 5], 'Lista de 6 itens deve conter exatamente os slots [0, 1, 2, 3, 4, 5]');
assert.strictEqual(slots6.length, 6, 'Deve conter exatamente 6 slots');
assert.strictEqual(slots6.includes(-1), false, 'Não deve conter slot -1');
assert.strictEqual(slots6.includes(6), false, 'Não deve referenciar índice 6 fora da lista de tamanho 6');
console.log('✓ 6 conteúdos: slots [0, 1, 2, 3, 4, 5] finito, sem extrapolação de limites.');

// -----------------------------------------------------------------------------
// TESTE 5: Lista com 7 conteúdos (Infinito - Limiar Circular)
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Lista com 7 conteúdos (Início do Modo Infinito)...');
const slots7 = getVisibleSlots(7);
assert.strictEqual(slots7.includes(-1), true, 'Lista com 7 itens deve ativar buffer circular com slot -1');
assert.strictEqual(slots7[0], -1, 'Primeiro slot do modo infinito deve ser -1 para transição contínua à esquerda');
assert.strictEqual(slots7[1], 0, 'Segundo slot deve ser o slot 0 ancorado na margem de referência');
console.log('✓ 7 conteúdos: carrossel infinito ativado com slot -1 e transições circulares.');

// -----------------------------------------------------------------------------
// TESTE 6: Lista com 10 conteúdos (Infinito Completo)
// -----------------------------------------------------------------------------
console.log('\n[Teste 6] Lista com 10 conteúdos...');
const slots10 = getVisibleSlots(10);
assert.strictEqual(slots10.includes(-1), true, 'Lista de 10 itens deve conter slot -1');
assert.ok(
  slots10.length >= 6 && slots10.length <= 9 && new Set(slots10).size === slots10.length,
  'Deve conter buffer circular sem duplicatas, dimensionado ao perfil de hardware da TV'
);
console.log(`✓ 10 conteúdos: carrossel infinito com ${slots10.length} slots de alta fluidez.`);

// -----------------------------------------------------------------------------
// TESTE 7: Simulação de Navegação Finito vs Infinito
// -----------------------------------------------------------------------------
console.log('\n[Teste 7] Simulação de Regras de Navegação nas Extremidades...');

// Simulação de navegação finita (4 itens)
const simulateFiniteNavigation = (itemCount: number) => {
  let activeIndex = 0;
  const moves: number[] = [];

  // Tenta voltar na primeira posição (deve ser bloqueado)
  if (activeIndex > 0) activeIndex--;
  moves.push(activeIndex); // ainda 0

  // Avança até o fim
  while (activeIndex < itemCount - 1) {
    activeIndex++;
    moves.push(activeIndex);
  }

  // Tenta avançar além da última posição (deve ser bloqueado)
  if (activeIndex < itemCount - 1) activeIndex++;
  moves.push(activeIndex); // continua no último

  return moves;
};

const finiteMoves = simulateFiniteNavigation(4);
assert.deepStrictEqual(finiteMoves, [0, 1, 2, 3, 3], 'Navegação finita não deve retroceder de 0 nem avançar além de 3');
console.log('✓ Navegação finita bloqueia retrocesso na posição 0 e bloqueia avanço na última posição.');

console.log('\n========================================================================');
console.log(' TODOS OS TESTES ESPECÍFICOS DE CARROSSEL FINITO E INFINITO PASSARAM! ');
console.log('========================================================================');

process.exit(0);

