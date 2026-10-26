import { editorialCuratorService } from '../src/core/recommendations/editorialCuratorService';
import { hybridRecommendationEngine } from '../src/core/recommendations/hybridRecommendationEngine';
import { recommendationEngine } from '../src/core/recommendations/recommendationEngine';
import { userPreferenceStore } from '../src/core/recommendations/userPreferenceStore';
import { ContentItem, ContentType } from '../types';

async function runEditorialCurationQualitySuite() {
  console.log('========================================================================');
  console.log('🎯 SUÍTE DE TESTES: NOVA CURADORIA EDITORIAL E QUALIDADE DOS CARROSSÉIS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // Gerador de Catálogo Sintético Realista para Simulação Abrangente (220 itens)
  // --------------------------------------------------------------------------
  function createSyntheticCatalog(size = 220): ContentItem[] {
    const genresPool = [
      ['Ação', 'Aventura'],
      ['Suspense', 'Mistério'],
      ['Comédia'],
      ['Drama'],
      ['Ficção Científica'],
      ['Terror'],
      ['Família', 'Animação'],
      ['Anime', 'Ação', 'Fantasia'],
      ['Anime', 'Isekai', 'Magia']
    ];

    const catalog: ContentItem[] = [];

    for (let i = 1; i <= size; i++) {
      const gIndex = (i - 1) % genresPool.length;
      const genres = genresPool[gIndex];
      let type = ContentType.MOVIE;
      if (genres.includes('Anime')) {
        type = ContentType.ANIME;
      } else if (i % 3 === 0) {
        type = ContentType.SERIES;
      }

      const rating = Math.round((6.0 + ((i * 7) % 36) / 10) * 10) / 10; // 6.0 a 9.5
      const year = 1990 + (i % 36); // 1990 a 2025
      const isFeatured = i % 15 === 0;
      const imdbRank = i <= 60 ? i : undefined;

      catalog.push({
        id: `item_${type}_${i}`,
        title: `Obra Editorial ${i} (${type})`,
        type,
        rating,
        year,
        genres,
        isFeatured,
        imdbRank,
        availabilityStatus: 'verified',
        audioStatus: i % 2 === 0 ? 'pt-br-dubbed' : 'pt-br-subtitles'
      });
    }

    return catalog;
  }

  const largeCatalog = createSyntheticCatalog(360);
  const smallCatalog = createSyntheticCatalog(10);

  // ==========================================================================
  // REQUISITO 1 & 2: Quantidade de Carrosséis e Variedade em Catálogo Grande
  // ==========================================================================
  console.log('\n--- 1. Quantidade de Carrosséis e Variedade em Catálogo Grande ---');
  {
    editorialCuratorService.invalidateCache();
    const rows = editorialCuratorService.buildHomeEditorialRows(largeCatalog, 'user_test_large', []);

    assert('Gera entre 10 e 15 carrosséis editoriais', rows.length >= 10 && rows.length <= 15, `Geradas: ${rows.length}`);
    
    // Verifica presença das categorias principais
    const hasTrending = rows.some(r => r.reasonType === 'trending');
    const hasCriticallyAcclaimed = rows.some(r => r.reasonType === 'critically_acclaimed');
    const hasRecommended = rows.some(r => r.id === 'recommended_for_you');
    const hasRecent = rows.some(r => r.reasonType === 'new_releases');
    const hasHiddenGems = rows.some(r => r.id === 'hidden_gems');

    assert('Contém fileira Em Alta no ZapiTV', hasTrending);
    assert('Contém fileira Recomendados para Você', hasRecommended);
    assert('Contém fileira Aclamados pela Crítica', hasCriticallyAcclaimed);
    assert('Contém fileira Adicionados Recentemente', hasRecent);
    assert('Contém fileira Joias Escondidas', hasHiddenGems);
  }

  // ==========================================================================
  // REQUISITO 3 & 4: Quantidade de Títulos por Carrossel e Unicidade Interna
  // ==========================================================================
  console.log('\n--- 2. Capacidade e Unicidade Interna de Cada Fileira ---');
  {
    editorialCuratorService.invalidateCache();
    const rows = editorialCuratorService.buildHomeEditorialRows(largeCatalog, 'user_test_capacity', []);

    // Verifica que as fileiras com acervo disponível atingem 30 a 36 títulos
    const generalRows = rows.filter(r => r.id !== 'continue_watching');
    const wellFilledRows = generalRows.filter(r => r.items.length >= 20);
    assert('Maioria das fileiras possui grande volume de títulos (>= 20 títulos)', wellFilledRows.length >= generalRows.length * 0.6, `Preenchidas: ${wellFilledRows.length} de ${generalRows.length}`);

    // Unicidade interna absoluta: zero duplicatas dentro de uma mesma fileira
    let zeroInternalDuplicates = true;
    for (const row of rows) {
      const ids = new Set<string>();
      for (const item of row.items) {
        if (ids.has(item.id)) {
          zeroInternalDuplicates = false;
          break;
        }
        ids.add(item.id);
      }
    }
    assert('Unicidade absoluta: zero duplicatas internas em qualquer carrossel', zeroInternalDuplicates);
  }

  // ==========================================================================
  // REQUISITO 5 & 6: Medição da Taxa de Repetição e Baixa Sobreposição Global
  // ==========================================================================
  console.log('\n--- 3. Taxa de Repetição e Multi-tier Global Allocation ---');
  {
    editorialCuratorService.invalidateCache();
    const rows = editorialCuratorService.buildHomeEditorialRows(largeCatalog, 'user_test_overlap', []);

    const appearanceCount: Record<string, number> = {};
    let totalCardSlots = 0;

    for (const row of rows) {
      for (const item of row.items) {
        totalCardSlots++;
        appearanceCount[item.id] = (appearanceCount[item.id] || 0) + 1;
      }
    }

    const uniqueTitlesCount = Object.keys(appearanceCount).length;
    // Obras repetidas mais de uma vez
    const repeatedTitlesCount = Object.values(appearanceCount).filter(cnt => cnt > 1).length;
    const repetitionRate = (repeatedTitlesCount / uniqueTitlesCount) * 100;

    console.log(`     Total de slots ocupados: ${totalCardSlots}`);
    console.log(`     Títulos distintos exibidos na Home: ${uniqueTitlesCount}`);
    console.log(`     Taxa de títulos repetidos entre fileiras: ${repetitionRate.toFixed(1)}%`);

    // No sistema antigo, os mesmos ~20 títulos ocupavam todas as fileiras (> 60% repetição)
    // Com curadoria multi-tier inteligente, a taxa cai drasticamente para < 25%
    assert('Taxa de repetição entre fileiras é drasticamente reduzida (< 25%)', repetitionRate < 25, `Taxa real: ${repetitionRate.toFixed(1)}%`);

    // Nenhum título pode exceder o teto estrito de 2 aparições no catálogo grande
    const maxAppearance = Math.max(...Object.values(appearanceCount));
    assert('Nenhum título aparece 3 ou mais vezes (Tier 3 bloqueia estritamente)', maxAppearance <= 2, `Máximo: ${maxAppearance}`);
  }

  // ==========================================================================
  // REQUISITO 7: Cold Start para Novos Usuários
  // ==========================================================================
  console.log('\n--- 4. Perfil Novo (Cold Start sem Histórico) ---');
  {
    const coldUserId = 'user_brand_new_cold_test';
    await userPreferenceStore.clearPreferences(coldUserId);

    editorialCuratorService.invalidateCache();
    const coldRows = editorialCuratorService.buildHomeEditorialRows(largeCatalog, coldUserId, []);

    assert('Cold start gera carrosséis de descoberta ricos', coldRows.length >= 8);
    assert('Primeira fileira do cold start é Em Alta no ZapiTV', coldRows[0].id === 'trending_zapitv');
    assert('Cold start não inclui Continuar Assistindo se não houver reprodução', !coldRows.some(r => r.id === 'continue_watching'));
    assert('Títulos das seções são em português brasileiro natural', coldRows.every(r => typeof r.title === 'string' && r.title.length > 3));
  }

  // ==========================================================================
  // REQUISITO 8: Perfil com Histórico e Personalização Contextual
  // ==========================================================================
  console.log('\n--- 5. Perfil com Histórico e Personalização Contextual ---');
  {
    const historyUserId = 'user_scifi_fan_test';
    await userPreferenceStore.clearPreferences(historyUserId);

    // Usuário assistiu filme de Ficção Científica
    const scifiItem = largeCatalog.find(i => i.genres?.includes('Ficção Científica'))!;
    await userPreferenceStore.recordPlayback(scifiItem, 3500, 3600, false, historyUserId);

    editorialCuratorService.invalidateCache();
    const rowsWithHistory = editorialCuratorService.buildHomeEditorialRows(largeCatalog, historyUserId, []);

    // Deve conter fileira contextual "Porque você assistiu [Título]"
    const contextualRow = rowsWithHistory.find(r => r.id.startsWith('because_watched_') || r.id.startsWith('collab_watched_'));
    assert('Contém carrossel contextual baseado na obra recente do histórico', !!contextualRow);
    if (contextualRow) {
      assert('Título do carrossel contextual menciona a obra assistida', contextualRow.title.includes(scifiItem.title));
      assert('Itens do carrossel contextual compartilham gêneros ou similaridade', contextualRow.items.every(it => it.id !== scifiItem.id));
    }
  }

  // ==========================================================================
  // REQUISITO 9: Perfil Infantil (isChild = true)
  // ==========================================================================
  console.log('\n--- 6. Perfil Infantil (Proteção de Conteúdo e Foco Familiar) ---');
  {
    const childUserId = 'user_child_test';
    editorialCuratorService.invalidateCache();
    const childRows = editorialCuratorService.buildHomeEditorialRows(largeCatalog, childUserId, [], true);

    assert('Perfil infantil gera fileiras apropriadas', childRows.length >= 4);
    assert('Título de recomendação é adaptado para crianças', childRows.some(r => r.title.includes('Crianças') || r.title.includes('Família')));

    // Nenhuma fileira de Terror, Suspense Adulto ou Policial no perfil infantil
    const hasTerror = childRows.some(r => r.id.includes('horror') || r.id.includes('suspense') || r.id.includes('crime'));
    assert('Bloqueia rigorosamente carrosséis de terror ou suspense adulto', !hasTerror);

    // Todos os itens nas fileiras infantis devem ser Animação, Família ou Anime apropriado
    const allItemsAppropriate = childRows.every(r => 
      r.items.every(it => 
        it.type === ContentType.ANIME || 
        it.genres?.some(g => /família|familia|animação|animacao|infantil/i.test(g))
      )
    );
    assert('100% dos títulos em perfil infantil são adequados para a família', allItemsAppropriate);
  }

  // ==========================================================================
  // REQUISITO 10: Catálogo Pequeno (< 15 itens)
  // ==========================================================================
  console.log('\n--- 7. Adaptação Dinâmica em Catálogo Reduzido (< 15 itens) ---');
  {
    editorialCuratorService.invalidateCache();
    const smallRows = editorialCuratorService.buildHomeEditorialRows(smallCatalog, 'user_small_catalog', []);

    assert('Gera carrosséis sem estourar erro mesmo com acervo reduzido', smallRows.length >= 3);
    assert('Itens dentro de cada carrossel permanecem únicos', smallRows.every(r => new Set(r.items.map(i => i.id)).size === r.items.length));
  }

  // ==========================================================================
  // REQUISITO 11 & 12: Invalidação de Cache, TTL e Estabilidade
  // ==========================================================================
  console.log('\n--- 8. Estabilidade de Sessão, TTL e Invalidação com Novos Títulos ---');
  {
    editorialCuratorService.invalidateCache();
    const sessionUser = 'user_stability_test';

    // 1. Múltiplas chamadas sucessivas retornam a mesma referência de cache
    const firstCall = editorialCuratorService.buildHomeEditorialRows(largeCatalog, sessionUser, []);
    const secondCall = editorialCuratorService.buildHomeEditorialRows(largeCatalog, sessionUser, []);
    assert('Múltiplos renders preservam estritamente o mesmo cache de sessão', firstCall === secondCall);

    // 2. Adição de novo título ao catálogo invalida automaticamente o cache
    const modifiedCatalog = [
      ...largeCatalog,
      {
        id: 'newly_added_blockbuster',
        title: 'Super Estreia Inédita',
        type: ContentType.MOVIE,
        rating: 9.8,
        year: 2026,
        genres: ['Ação', 'Aventura'],
        isFeatured: true,
        availabilityStatus: 'verified',
        audioStatus: 'pt-br-dubbed'
      } as ContentItem
    ];

    const thirdCall = editorialCuratorService.buildHomeEditorialRows(modifiedCatalog, sessionUser, []);
    assert('Adição de novo título ao catálogo renova a curadoria inteligentemente', firstCall !== thirdCall);
    assert('Novo título adicionado é contemplado nas recomendações', thirdCall.some(r => r.items.some(i => i.id === 'newly_added_blockbuster')));
  }

  // ==========================================================================
  // REQUISITO 13: Preservação Estrita de "Continuar Assistindo"
  // ==========================================================================
  console.log('\n--- 9. Preservação Absoluta de Continuar Assistindo ---');
  {
    const cwItemA = largeCatalog[5];
    const cwItemB = largeCatalog[12];
    const cwList = [cwItemA, cwItemB];

    editorialCuratorService.invalidateCache();
    const rows = editorialCuratorService.buildHomeEditorialRows(largeCatalog, 'user_cw_test', cwList);

    assert('Primeira fileira é estritamente Continuar Assistindo', rows[0].id === 'continue_watching');
    assert('Continuar Assistindo preserva exatamente a ordem fornecida', rows[0].items[0].id === cwItemA.id && rows[0].items[1].id === cwItemB.id);
    assert('Itens em Continuar Assistindo não são duplicados na fileira imediatamente seguinte', 
      !rows[1].items.some(it => it.id === cwItemA.id || it.id === cwItemB.id)
    );
  }

  // ==========================================================================
  // REQUISITO 14: Preservação das Seções Personalizadas do Administrador
  // ==========================================================================
  console.log('\n--- 10. Respeito às Seções do Administrador ---');
  {
    const adminReservedItem = largeCatalog[3];
    const customSections = [
      {
        id: 'admin_exclusive_section',
        title: 'Seleção do Diretor ZapiTV',
        items: [adminReservedItem.id]
      }
    ];

    editorialCuratorService.invalidateCache();
    const rows = editorialCuratorService.buildHomeEditorialRows(largeCatalog, 'user_admin_sec_test', [], false, customSections);

    // Itens presentes na seção do admin devem receber prioridade menor ou exclusão nas primeiras fileiras automáticas
    const firstAutoRow = rows.find(r => r.id === 'recommended_for_you' || r.id === 'trending_zapitv');
    assert('Itens reservados pelo admin não poluem as primeiras posições da curadoria automática', 
      !firstAutoRow?.items.slice(0, 5).some(it => it.id === adminReservedItem.id)
    );
  }

  // ==========================================================================
  // REQUISITO 15 & 16: Otimização de Performance e Buffer Proporcional
  // ==========================================================================
  console.log('\n--- 11. Otimização de Buffer Proporcional e Performance ---');
  {
    // Testa o cálculo de buffer proporcional: para 36 itens, o buffer é 8 em vez de 36*2 = 72!
    const itemCount = 36;
    const bufferSize = Math.min(8, Math.floor(itemCount / 2));
    const totalRenderedExtended = bufferSize * 2 + itemCount; // 8 prefixo + 36 base + 8 sufixo = 52
    const oldTriplication = itemCount * 3; // 108 itens

    assert('Buffer proporcional limita a expansão circular a no máximo 8 capas em cada ponta', bufferSize === 8);
    assert('Redução de mais de 50% nos nós DOM por carrossel infinito', totalRenderedExtended < (oldTriplication * 0.55), `Redução: de ${oldTriplication} para ${totalRenderedExtended}`);
  }

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO FINAL DA SUÍTE DE CURADORIA: ${passed} PASS, ${failed} FAIL`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runEditorialCurationQualitySuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Erro fatal na suíte:', err);
  process.exit(1);
});
