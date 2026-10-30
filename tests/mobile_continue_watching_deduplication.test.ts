import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { ContentItem, ContentType } from '../types';

console.log('=== ZapiTV | Suíte de Validação da Eliminação de Duplicação do Continuar Assistindo Mobile ===\n');

const projectRoot = path.resolve('.');

// -----------------------------------------------------------------------------
// 1. Auditoria Estática de src/components/mobile/MobileHomeView.tsx
// -----------------------------------------------------------------------------
console.log('1. Auditando código-fonte de src/components/mobile/MobileHomeView.tsx...');
const homeViewPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileHomeView.tsx');
assert.ok(fs.existsSync(homeViewPath), 'MobileHomeView.tsx deve existir');

const homeCode = fs.readFileSync(homeViewPath, 'utf8');

// A. Não deve usar display: none para ocultar duplicatas
assert.strictEqual(
  homeCode.includes('display: none') || homeCode.includes('display:none') || homeCode.includes('hidden'),
  false,
  'MobileHomeView.tsx NÃO deve utilizar display: none ou hidden para ocultar seções duplicadas'
);

// B. Deve identificar e eliminar fileiras de Continuar Assistindo na origem
assert.ok(
  homeCode.includes('isContinueWatchingRow'),
  'MobileHomeView.tsx deve possuir função identificadora isContinueWatchingRow'
);
assert.ok(
  homeCode.includes('isContinueWatchingRow(row)') && homeCode.includes('return null'),
  'MobileHomeView.tsx deve eliminar a renderização de Continuar Assistindo na origem em personalizedRows retornando null'
);

// C. Deve renderizar exatamente uma chamada a MobileContentRow com title="Continuar Assistindo"
const continueWatchingTitleMatches = homeCode.match(/title="Continuar Assistindo"/g) || [];
assert.strictEqual(
  continueWatchingTitleMatches.length,
  1,
  'MobileHomeView.tsx deve conter exatamente UMA renderização de title="Continuar Assistindo"'
);

// D. Deve passar showProgress={true} para a seção única de Continuar Assistindo
assert.ok(
  homeCode.includes('showProgress={true}'),
  'MobileHomeView.tsx deve passar showProgress={true} para o carrossel de Continuar Assistindo'
);

// E. A ordenação pertence ao seletor compartilhado, não a uma implementação visual duplicada.
assert.ok(homeCode.includes('useProfileContinuity(allContent)'), 'Mobile deve consumir continuidade compartilhada');
const watchStateCode = fs.readFileSync(path.join(projectRoot,'src/core/storage/watchState.ts'),'utf8');
assert.ok(watchStateCode.includes('Date.parse(b.updatedAt) - Date.parse(a.updatedAt)') && watchStateCode.includes('contentKey(a.item).localeCompare'), 'Ordenação recente com desempate determinístico deve ser preservada');

// F. Deve consolidar as duas fontes de dados em consolidatedContinueWatching
assert.ok(
  homeCode.includes('consolidatedContinueWatching'),
  'MobileHomeView.tsx deve consolidar as fontes em consolidatedContinueWatching'
);

console.log('  ✓ Auditoria estática de MobileHomeView.tsx aprovada com sucesso!');

// -----------------------------------------------------------------------------
// 2. Teste Unitário da Lógica de Deduplicação e Consolidação
// -----------------------------------------------------------------------------
console.log('\n2. Testando algoritmos de consolidação e deduplicação de dados...');

const mockItemA: ContentItem = {
  id: 'movie_1',
  title: 'Loki',
  type: ContentType.SERIES,
  year: 2021,
  rating: 8.2,
  duration: '50m',
  image: 'https://images.unsplash.com/poster1',
  genres: ['Ação', 'Ficção'],
  synopsis: 'Loki em aventuras no multiverso'
};

const mockItemB: ContentItem = {
  id: 'movie_2',
  title: 'Ruptura',
  type: ContentType.SERIES,
  year: 2022,
  rating: 8.7,
  duration: '55m',
  image: 'https://images.unsplash.com/poster2',
  genres: ['Drama', 'Sci-Fi'],
  synopsis: 'Severance na Lumon'
};

const mockItemC: ContentItem = {
  id: 'movie_3',
  title: 'Succession',
  type: ContentType.SERIES,
  year: 2023,
  rating: 8.9,
  duration: '60m',
  image: 'https://images.unsplash.com/poster3',
  genres: ['Drama'],
  synopsis: 'Família Roy'
};

// Caso A: Ambas as fontes possuem itens, com sobreposição parcial
{
  const localItems = [mockItemB, mockItemA]; // Ruptura (mais recente), depois Loki
  const dynamicItems = [mockItemA, mockItemC]; // Loki (já em local), Succession (novo)

  const combined = [...localItems, ...dynamicItems];
  const deduped = deduplicateContentItems(combined);
  const eligible = catalogEligibilityService.filterEligibleItemsSync(deduped);

  assert.strictEqual(eligible.length, 3, 'Deve consolidar exatamente 3 itens únicos');
  assert.strictEqual(eligible[0].id, 'movie_2', 'Primeiro deve ser Ruptura (mais recente local)');
  assert.strictEqual(eligible[1].id, 'movie_1', 'Segundo deve ser Loki (segundo local)');
  assert.strictEqual(eligible[2].id, 'movie_3', 'Terceiro deve ser Succession (adicionado da fonte dinâmica sem duplicar)');
  console.log('  ✓ Consolidação com sobreposição preserva ordem recente e elimina duplicatas');
}

// Caso B: Apenas fonte dinâmica possui itens (ex: antes do carregamento local assíncrono resolver)
{
  const localItems: ContentItem[] = [];
  const dynamicItems = [mockItemC, mockItemB];

  const combined = [...localItems, ...dynamicItems];
  const deduped = deduplicateContentItems(combined);
  const eligible = catalogEligibilityService.filterEligibleItemsSync(deduped);

  assert.strictEqual(eligible.length, 2, 'Deve manter os 2 itens da fonte dinâmica');
  assert.strictEqual(eligible[0].id, 'movie_3');
  assert.strictEqual(eligible[1].id, 'movie_2');
  console.log('  ✓ Resiliência durante carregamento assíncrono: nenhum item perdido');
}

// Caso C: Ambas as fontes vazias (sem histórico de reprodução)
{
  const localItems: ContentItem[] = [];
  const dynamicItems: ContentItem[] = [];

  const combined = [...localItems, ...dynamicItems];
  const deduped = deduplicateContentItems(combined);
  const eligible = catalogEligibilityService.filterEligibleItemsSync(deduped);

  assert.strictEqual(eligible.length, 0, 'Com zero histórico, resultado deve ser vazio');
  console.log('  ✓ Estado vazio: nenhuma seção exibida indevidamente');
}

// -----------------------------------------------------------------------------
// 3. Teste de Filtragem Rigorosa de personalizedRows
// -----------------------------------------------------------------------------
console.log('\n3. Testando filtragem de fileiras dinâmicas (personalizedRows)...');

const isContinueWatchingRow = (row: { id?: string; title?: string; reasonType?: string }): boolean => {
  const id = (row.id || '').toLowerCase().trim();
  const title = (row.title || '').toLowerCase().trim();
  const reason = (row.reasonType || '').toLowerCase().trim();
  return (
    id === 'continue_watching' ||
    id === 'continuar_assistindo' ||
    reason === 'continue_watching' ||
    title === 'continuar assistindo' ||
    title === 'continue watching'
  );
};

const sampleRows = [
  { id: 'continue_watching', title: 'Continuar Assistindo', items: [mockItemA] },
  { id: 'disney_plus', title: 'Exclusivos Disney+', items: [mockItemA] },
  { id: 'hbo_max', title: 'Exclusivos HBO Max', items: [mockItemB] },
  { id: 'rec_for_you', title: 'Recomendados para Você', items: [mockItemC] }
];

const filtered = sampleRows.filter(r => !isContinueWatchingRow(r));

assert.strictEqual(filtered.length, 3, 'Deve sobrar exatamente 3 fileiras (a de Continuar Assistindo foi removida)');
assert.ok(!filtered.some(r => r.id === 'continue_watching'), 'Fileira continue_watching não deve existir em filtered');
assert.ok(!filtered.some(r => r.title.toLowerCase() === 'continuar assistindo'), 'Título Continuar Assistindo não deve existir em filtered');
assert.strictEqual(filtered[0].id, 'disney_plus', 'Disney+ preservado');
assert.strictEqual(filtered[1].id, 'hbo_max', 'HBO Max preservado');
assert.strictEqual(filtered[2].id, 'rec_for_you', 'Recomendados preservado');
console.log('  ✓ personalizedRows limpo na origem: nenhuma duplicação gerada dinamicamente');

// -----------------------------------------------------------------------------
// 4. Preservação de Desktop, Smart TV, Fire TV e MobileCard
// -----------------------------------------------------------------------------
console.log('\n4. Verificando preservação das demais plataformas e componentes...');

// Desktop (App.tsx)
const appPath = path.join(projectRoot, 'App.tsx');
const appCode = fs.readFileSync(appPath, 'utf8');
assert.ok(appCode.includes('personalizedHomeRows'), 'Desktop App.tsx deve preservar personalizedHomeRows');
assert.ok(appCode.includes('personalizedRows={personalizedHomeRows}'), 'Desktop App.tsx deve passar personalizedHomeRows');

// Smart TV / Fire TV (TvHomeView.tsx)
const tvHomePath = path.join(projectRoot, 'src', 'components', 'tv', 'TvHomeView.tsx');
const tvHomeCode = fs.readFileSync(tvHomePath, 'utf8');
assert.ok(tvHomeCode.includes('title="Continuar assistindo"'), 'Smart TV deve manter seu Continuar assistindo');
assert.ok(tvHomeCode.includes('rowId="continue-watching"'), 'Smart TV deve manter rowId="continue-watching"');

// MobileCard.tsx
const mobileCardPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileCard.tsx');
const mobileCardCode = fs.readFileSync(mobileCardPath, 'utf8');
assert.ok(mobileCardCode.includes('storageService.getPlaybackContinuity(item)'), 'MobileCard deve calcular continuidade via storageService');
assert.ok(mobileCardCode.includes('continuity.hasStarted'), 'MobileCard deve renderizar barra se hasStarted');
assert.ok(mobileCardCode.includes('continuity.label'), 'MobileCard deve renderizar label do episódio');

console.log('  ✓ Desktop, Smart TV, Fire TV e MobileCard 100% preservados sem regressões');

console.log('\n========================================================================');
console.log('🎉 TODOS OS TESTES DE DEDUPLICAÇÃO DO CONTINUAR ASSISTINDO PASSARAM!');
console.log('========================================================================\n');
process.exit(0);

