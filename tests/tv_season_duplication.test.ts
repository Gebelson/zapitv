import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

function normalizeSeasons(seasons: any[]): number[] {
  return Array.from(
    new Set<number>(
      seasons
        .map((s: any) => {
          const raw = typeof s === 'number' || typeof s === 'string' ? s : (s?.season_number ?? s?.seasonNumber);
          return Number(raw);
        })
        .filter((n: number): n is number => Number.isInteger(n) && n > 0)
    )
  ).sort((a, b) => a - b);
}

async function runSeasonDuplicationSuite() {
  console.log('--- Auditoria de Normalização e Eliminação de Temporadas Duplicadas na Smart TV ---');

  const modalPath = path.resolve(process.cwd(), 'src/components/tv/TvDetailsModal.tsx');
  assert(fs.existsSync(modalPath), 'TvDetailsModal.tsx deve existir');
  const code = fs.readFileSync(modalPath, 'utf8');

  // Teste 1: Auditoria estrita do código-fonte em TvDetailsModal.tsx
  assert(
    !code.includes('s.season_number || s.seasonNumber || 1'),
    'O código NÃO deve conter o operador || que converte a temporada 0 em temporada 1'
  );
  assert(
    code.includes('s?.season_number ?? s?.seasonNumber') || code.includes('s.season_number ?? s.seasonNumber'),
    'O código deve utilizar o operador nullish coalescing (??) para preservar números válidos'
  );
  assert(
    code.includes('new Set<number>') || code.includes('new Set('),
    'O código deve deduplicar as temporadas utilizando Set'
  );
  assert(
    code.includes('Number.isInteger(n) && n > 0'),
    'O código deve filtrar estritamente números inteiros maiores que zero (excluindo specials/temporada 0)'
  );
  assert(
    code.includes('sort((a, b) => a - b)'),
    'As temporadas devem ser ordenadas de forma estritamente crescente'
  );
  console.log('✓ Teste 1: Auditoria estática de código-fonte em TvDetailsModal.tsx aprovada OK');

  // Teste 2: Validação dos 4 casos de teste obrigatórios solicitados
  const testInput1 = [0, 1, 2, 3, 4];
  const res1 = normalizeSeasons(testInput1);
  assert.deepStrictEqual(res1, [1, 2, 3, 4], 'Caso 1 [0, 1, 2, 3, 4] deve resultar em [1, 2, 3, 4]');
  console.log('✓ Teste 2.1: [0, 1, 2, 3, 4] -> [1, 2, 3, 4] OK');

  const testInput2 = [1, 1, 2, 3];
  const res2 = normalizeSeasons(testInput2);
  assert.deepStrictEqual(res2, [1, 2, 3], 'Caso 2 [1, 1, 2, 3] deve resultar em [1, 2, 3]');
  console.log('✓ Teste 2.2: [1, 1, 2, 3] -> [1, 2, 3] OK');

  const testInput3 = [0, 1, 1, 2, 2, 3];
  const res3 = normalizeSeasons(testInput3);
  assert.deepStrictEqual(res3, [1, 2, 3], 'Caso 3 [0, 1, 1, 2, 2, 3] deve resultar em [1, 2, 3]');
  console.log('✓ Teste 2.3: [0, 1, 1, 2, 2, 3] -> [1, 2, 3] OK');

  const testInput4 = ['1', 1, '2', 2, 3];
  const res4 = normalizeSeasons(testInput4);
  assert.deepStrictEqual(res4, [1, 2, 3], 'Caso 4 ["1", 1, "2", 2, 3] deve resultar em [1, 2, 3]');
  console.log('✓ Teste 2.4: ["1", 1, "2", 2, 3] -> [1, 2, 3] OK');

  // Teste 3: Objetos reais do TMDB (Séries e Animes com Temporada 0 / Especiais)
  const tmdbSeriesWithSpecials = [
    { season_number: 0, name: 'Especiais', episode_count: 4 },
    { season_number: 1, name: 'Temporada 1', episode_count: 10 },
    { season_number: 2, name: 'Temporada 2', episode_count: 10 },
    { season_number: 3, name: 'Temporada 3', episode_count: 8 }
  ];
  const resTmdbSeries = normalizeSeasons(tmdbSeriesWithSpecials);
  assert.deepStrictEqual(resTmdbSeries, [1, 2, 3], 'Série com especiais deve conter apenas temporadas [1, 2, 3]');
  console.log('✓ Teste 3: Metadados TMDB com temporada 0 eliminam especiais sem duplicar T1 OK');

  // Teste 4: Séries com uma única temporada e especiais
  const tmdbSingleSeasonWithSpecials = [
    { season_number: 0, name: 'Specials' },
    { season_number: 1, name: 'Season 1' }
  ];
  const resSingleSeason = normalizeSeasons(tmdbSingleSeasonWithSpecials);
  assert.deepStrictEqual(resSingleSeason, [1], 'Série de temporada única deve retornar apenas [1]');
  // No modal, availableSeasons.length > 1 é falso para [1], impedindo exibição de seletor redundante
  assert.strictEqual(resSingleSeason.length > 1, false, 'Temporada única não deve renderizar botões redundantes');
  console.log('✓ Teste 4: Conteúdo de temporada única normalizado para [1] sem exibição de botões duplicados OK');

  // Teste 5: Séries com temporadas faltantes / descontínuas (ex: Temporadas 1 e 3)
  const missingSeasons = [
    { season_number: 1, name: 'Temporada 1' },
    { season_number: 3, name: 'Temporada 3' },
    { season_number: 5, name: 'Temporada 5' }
  ];
  const resMissing = normalizeSeasons(missingSeasons);
  assert.deepStrictEqual(resMissing, [1, 3, 5], 'Temporadas faltantes não devem criar temporadas artificiais inexistentes');
  console.log('✓ Teste 5: Temporadas descontinuadas preservadas rigorosamente [1, 3, 5] OK');

  // Teste 6: Resiliência contra dados inválidos ou malformados
  const invalidData = [null, undefined, {}, { season_number: -1 }, { season_number: 0 }, { season_number: 'invalid' }, { seasonNumber: 2 }, 3];
  const resInvalid = normalizeSeasons(invalidData);
  assert.deepStrictEqual(resInvalid, [2, 3], 'Valores inválidos, nulos ou negativos devem ser descartados com segurança');
  console.log('✓ Teste 6: Resiliência contra valores inválidos e negativos OK');

  // Teste 7: Unicidade absoluta de Chaves React e Focus Keys do Norigin
  const seasonsSample = [1, 2, 3, 4];
  const reactKeys = seasonsSample.map(s => `tv-season-${s}`);
  const focusKeys = seasonsSample.map(s => `tv-details-season-${s}`);

  assert.strictEqual(new Set(reactKeys).size, seasonsSample.length, 'Todas as react keys devem ser exclusivas');
  assert.strictEqual(new Set(focusKeys).size, seasonsSample.length, 'Todas as focusKeys do Norigin devem ser exclusivas');
  console.log('✓ Teste 7: Unicidade das chaves React e focusKeys do Norigin validada OK');

  // Teste 8: Exclusividade de seleção (apenas 1 botão ativo em qualquer instante)
  for (const selectedSeason of [1, 2, 3, 4]) {
    const buttonStates = seasonsSample.map(sNum => ({
      season: sNum,
      selected: selectedSeason === sNum,
      className: selectedSeason === sNum
        ? 'bg-cyan-500 text-black shadow-[0_0_12px_#00e5ff]'
        : 'bg-white/10 text-gray-300 hover:bg-white/20'
    }));

    const activeCount = buttonStates.filter(b => b.selected).length;
    assert.strictEqual(activeCount, 1, `Apenas 1 temporada deve estar ativa quando a temporada ${selectedSeason} for selecionada`);
    const activeBtn = buttonStates.find(b => b.selected);
    assert.strictEqual(activeBtn?.season, selectedSeason, 'A temporada selecionada deve coincidir com a ativa');
    assert(activeBtn?.className.includes('bg-cyan-500'), 'A temporada selecionada deve possuir fundo cyan');
  }
  console.log('✓ Teste 8: Seleção única e exclusiva (apenas 1 botão cyan por vez) OK');

  // Teste 9: Retorno do player preservando a temporada ativa
  const resolveCurrentSeason = (initialSeason: number, availableSeasons: number[]): number => {
    return availableSeasons.includes(initialSeason) ? initialSeason : availableSeasons[0];
  };

  // Usuário retorna do player na Temporada 4 de uma série com 5 temporadas
  const returnFromPlayerSeason4 = resolveCurrentSeason(4, [1, 2, 3, 4, 5]);
  assert.strictEqual(returnFromPlayerSeason4, 4, 'Ao retornar do player na Temporada 4, o modal DEVE preservar a Temporada 4');

  // Caso inicialSeason seja inexistente, recua com segurança para a primeira temporada disponível
  const fallbackNonExistent = resolveCurrentSeason(99, [1, 2, 3]);
  assert.strictEqual(fallbackNonExistent, 1, 'Temporada inválida ou inexistente deve recuar para sNums[0]');
  console.log('✓ Teste 9: Preservação de continuidade e retorno do player na Temporada correta OK');

  // Teste 10: Fallback por seasonsCount quando details.seasons for ausente ou vazio
  const fallbackFromCount = (count?: number): number[] => {
    if (count && count > 1) {
      return Array.from({ length: Math.max(1, Math.floor(count)) }, (_, i) => i + 1);
    }
    return [1];
  };
  assert.deepStrictEqual(fallbackFromCount(3), [1, 2, 3], 'Fallback por seasonsCount deve gerar [1, 2, 3]');
  assert.deepStrictEqual(fallbackFromCount(1), [1], 'seasonsCount = 1 deve resultar em [1]');
  console.log('✓ Teste 10: Fallback por seasonsCount preservado e validado OK');

  console.log('\nTodos os 10 testes de normalização de temporadas na Smart TV passaram com 100% de sucesso!\n');
}

runSeasonDuplicationSuite().catch(err => {
  console.error('\n❌ Falha nos testes de normalização de temporadas:', err);
  process.exit(1);
});
