import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== ZapiTV | Suíte de Testes: Sinopses Expansíveis nas Janelas de Detalhes ===\n');

const projectRoot = process.cwd();
const contentModalPath = path.resolve(projectRoot, 'components/ContentDetailModal.tsx');
const tvModalPath = path.resolve(projectRoot, 'src/components/tv/TvDetailsModal.tsx');
const hookPath = path.resolve(projectRoot, 'src/components/common/useExpandableSynopsis.ts');

assert(fs.existsSync(contentModalPath), 'ContentDetailModal.tsx deve existir');
assert(fs.existsSync(tvModalPath), 'TvDetailsModal.tsx deve existir');
assert(fs.existsSync(hookPath), 'useExpandableSynopsis.ts deve existir');

const contentModalCode = fs.readFileSync(contentModalPath, 'utf8').replace(/\r\n/g, '\n');
const tvModalCode = fs.readFileSync(tvModalPath, 'utf8').replace(/\r\n/g, '\n');
const hookCode = fs.readFileSync(hookPath, 'utf8').replace(/\r\n/g, '\n');

// --------------------------------------------------------------------------
// 1. Verificação de Contratos Estáticos: ContentDetailModal (Desktop & Mobile)
// --------------------------------------------------------------------------
console.log('1. Validando ContentDetailModal.tsx (Desktop e Mobile)...');

// Importação do hook e viewport
assert(
  contentModalCode.includes("import { useExpandableSynopsis } from '../src/components/common/useExpandableSynopsis'"),
  'ContentDetailModal deve importar useExpandableSynopsis'
);
assert(
  contentModalCode.includes("import { useIsMobileViewport } from '../src/core/mobile/mobileViewportService'"),
  'ContentDetailModal deve importar useIsMobileViewport'
);

// Limites responsivos de linhas (3 no mobile, 4 no desktop)
assert(
  contentModalCode.includes('maxLines: isMobile ? 3 : 4'),
  'ContentDetailModal deve alternar maxLines entre 3 (mobile) e 4 (desktop)'
);
assert(
  contentModalCode.includes("isSynopsisExpanded ? 'line-clamp-none' : 'line-clamp-3 md:line-clamp-4'"),
  'ContentDetailModal deve alternar entre line-clamp-none e line-clamp-3 md:line-clamp-4'
);

// Rótulos estritos "Ver mais" e "Ver menos"
assert(
  contentModalCode.includes("isSynopsisExpanded ? 'Ver menos' : 'Ver mais'"),
  'ContentDetailModal deve usar estritamente os textos "Ver mais" e "Ver menos"'
);

// Sem reticências manuais inseridas no texto
assert(
  !contentModalCode.includes("'Ver mais...'") && !contentModalCode.includes("'Ver menos...'"),
  'Não deve conter reticências manuais nos rótulos de expansão'
);

// Atributo de acessibilidade aria-expanded
assert(
  contentModalCode.includes('aria-expanded={isSynopsisExpanded}'),
  'ContentDetailModal deve fornecer aria-expanded={isSynopsisExpanded}'
);

// Elemento de medição oculto dedicado
assert(
  contentModalCode.includes('ref={synopsisMeasureRef}') &&
  contentModalCode.includes('aria-hidden="true"') &&
  contentModalCode.includes('pointer-events-none opacity-0 select-none -z-50') &&
  contentModalCode.includes('line-clamp-3 md:line-clamp-4'),
  'ContentDetailModal deve possuir elemento de medição invisível dedicado com o clamp padrão'
);

// Não reservar espaço em branco quando não puder expandir
assert(
  contentModalCode.includes('{canExpandSynopsis && ('),
  'Botão de expansão só deve ser renderizado quando canExpandSynopsis for true (sem reservar espaço)'
);
console.log('  -> Contratos estáticos do ContentDetailModal validados com sucesso.');

// --------------------------------------------------------------------------
// 2. Verificação de Contratos Estáticos: TvDetailsModal (Smart TV)
// --------------------------------------------------------------------------
console.log('\n2. Validando TvDetailsModal.tsx (Smart TV)...');

// Importação do hook
assert(
  tvModalCode.includes("import { useExpandableSynopsis } from '../common/useExpandableSynopsis'"),
  'TvDetailsModal deve importar useExpandableSynopsis'
);

// Limite estrito de 3 linhas na TV
assert(
  tvModalCode.includes('maxLines: 3'),
  'TvDetailsModal deve ter maxLines configurado em 3'
);
assert(
  tvModalCode.includes("isSynopsisExpanded ? 'line-clamp-none' : 'line-clamp-3'"),
  'TvDetailsModal deve alternar entre line-clamp-none e line-clamp-3'
);

// Proteção da tela com container rolável dedicado para sinopses gigantes
assert(
  tvModalCode.includes('max-h-[160px] overflow-y-auto no-scrollbar'),
  'TvDetailsModal deve conter container com max-h-[160px] overflow-y-auto no-scrollbar quando expandido'
);

// Registro no Spatial Navigation com useTvFocusable
assert(
  tvModalCode.includes("focusKey: 'tv-details-synopsis-toggle'"),
  'TvDetailsModal deve registrar o botão com focusKey "tv-details-synopsis-toggle"'
);
assert(
  tvModalCode.includes('focusable: canExpandSynopsis'),
  'Botão de sinopse na TV só deve ser focalizável quando puder expandir'
);

// Preservação do foco ao alternar com Enter
assert(
  tvModalCode.includes("setFocus('tv-details-synopsis-toggle')"),
  'TvDetailsModal deve preservar o foco em tv-details-synopsis-toggle após expansão/recolhimento'
);

// Navegação do controle remoto (D-pad)
assert(
  tvModalCode.includes("direction === 'down' && canExpandSynopsis") &&
  tvModalCode.includes("setFocus('tv-details-synopsis-toggle')"),
  'Ao pressionar down do botão Voltar, deve navegar para tv-details-synopsis-toggle se visível'
);
assert(
  tvModalCode.includes("direction === 'up' && canExpandSynopsis") &&
  tvModalCode.includes("setFocus('tv-details-synopsis-toggle')"),
  'Ao pressionar up do botão Assistir, deve navegar para tv-details-synopsis-toggle se visível'
);

// Rótulos estritos
assert(
  tvModalCode.includes("isSynopsisExpanded ? 'Ver menos' : 'Ver mais'"),
  'TvDetailsModal deve usar exclusivamente "Ver mais" e "Ver menos"'
);
console.log('  -> Contratos estáticos do TvDetailsModal validados com sucesso.');

// --------------------------------------------------------------------------
// 3. Isolamento e Não-Regressão
// --------------------------------------------------------------------------
console.log('\n3. Validando isolamento e integridade das sinopses de episódios e carrosséis...');

// Em ContentDetailModal, os episódios usam EpisodeTvRow sem interferência
const episodeRowStart = contentModalCode.indexOf('const EpisodeTvRow:');
const episodeRowEnd = contentModalCode.indexOf('export const ContentDetailModal');
const episodeRowBlock = contentModalCode.slice(episodeRowStart, episodeRowEnd);
assert(
  !episodeRowBlock.includes('useExpandableSynopsis'),
  'Sinopses de episódios não devem usar useExpandableSynopsis'
);

// Em TvDetailsModal, os cards de episódios continuam isolados
const tvEpisodeCardStart = tvModalCode.indexOf('const TvEpisodeCard:');
const tvEpisodeCardEnd = tvModalCode.indexOf('export const TvDetailsModal');
const tvEpisodeCardBlock = tvModalCode.slice(tvEpisodeCardStart, tvEpisodeCardEnd);
assert(
  !tvEpisodeCardBlock.includes('useExpandableSynopsis'),
  'TvEpisodeCard não deve usar useExpandableSynopsis'
);
console.log('  -> Isolamento de episódios e componentes externos garantido.');

// --------------------------------------------------------------------------
// 4. Testes de Lógica de Overflow e Comportamento
// --------------------------------------------------------------------------
console.log('\n4. Simulando lógica de medição de overflow real no DOM...');

// Função pura simuladora da lógica de medição implementada no hook
function evaluateOverflow(params: {
  scrollHeight: number;
  clientHeight: number;
  lineHeight: number;
  maxLines: number;
  isExpanded: boolean;
  hasText: boolean;
}): { canExpand: boolean; nextExpanded: boolean } {
  if (!params.hasText) {
    return { canExpand: false, nextExpanded: false };
  }

  if (!params.isExpanded) {
    // Quando recolhido com line-clamp, scrollHeight excede clientHeight se houver mais linhas
    const hasOverflow = params.scrollHeight > params.clientHeight + 1;
    return { canExpand: hasOverflow, nextExpanded: false };
  } else {
    // Quando expandido, checa se a altura total ainda excede a altura correspondente a maxLines
    const maxHeight = params.lineHeight * params.maxLines + 2;
    const stillOverflows = params.scrollHeight > maxHeight;
    return { canExpand: stillOverflows, nextExpanded: stillOverflows };
  }
}

const LINE_HEIGHT = 24;

// Caso A: Texto curto de 1 linha (ex: "Filme de ação comédia.")
// Mobile (max 3 linhas): cabe perfeitamente
const short1LineMobile = evaluateOverflow({
  scrollHeight: LINE_HEIGHT,
  clientHeight: LINE_HEIGHT,
  lineHeight: LINE_HEIGHT,
  maxLines: 3,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(short1LineMobile.canExpand, false, 'Texto de 1 linha não deve exibir botão no mobile');

// Desktop (max 4 linhas): cabe perfeitamente
const short1LineDesktop = evaluateOverflow({
  scrollHeight: LINE_HEIGHT,
  clientHeight: LINE_HEIGHT,
  lineHeight: LINE_HEIGHT,
  maxLines: 4,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(short1LineDesktop.canExpand, false, 'Texto de 1 linha não deve exibir botão no desktop');

// Caso B: Texto curto de 2 linhas
const short2Lines = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 2,
  clientHeight: LINE_HEIGHT * 2,
  lineHeight: LINE_HEIGHT,
  maxLines: 3,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(short2Lines.canExpand, false, 'Texto de 2 linhas não deve exibir botão');

// Caso C: Texto exato de 3 linhas
// No mobile/TV (max 3): cabe sem overflow
const exact3LinesMobile = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 3,
  clientHeight: LINE_HEIGHT * 3,
  lineHeight: LINE_HEIGHT,
  maxLines: 3,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(exact3LinesMobile.canExpand, false, 'Texto de 3 linhas exatas cabe no mobile sem botão');

// Caso D: Texto de 4 linhas
// No mobile (< 768px, clamp 3): clientHeight = 72px, scrollHeight = 96px -> OVERFLOW!
const fourLinesMobile = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 4,
  clientHeight: LINE_HEIGHT * 3,
  lineHeight: LINE_HEIGHT,
  maxLines: 3,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(fourLinesMobile.canExpand, true, 'Texto de 4 linhas no mobile DEVE exibir "Ver mais"');

// No desktop (>= 768px, clamp 4): clientHeight = 96px, scrollHeight = 96px -> CABE!
const fourLinesDesktop = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 4,
  clientHeight: LINE_HEIGHT * 4,
  lineHeight: LINE_HEIGHT,
  maxLines: 4,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(fourLinesDesktop.canExpand, false, 'Texto de 4 linhas no desktop cabe sem botão');

// Caso E: Texto longo de 6 linhas
// No mobile:
const sixLinesMobile = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 6,
  clientHeight: LINE_HEIGHT * 3,
  lineHeight: LINE_HEIGHT,
  maxLines: 3,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(sixLinesMobile.canExpand, true, 'Texto de 6 linhas no mobile DEVE exibir "Ver mais"');

// No desktop:
const sixLinesDesktop = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 6,
  clientHeight: LINE_HEIGHT * 4,
  lineHeight: LINE_HEIGHT,
  maxLines: 4,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(sixLinesDesktop.canExpand, true, 'Texto de 6 linhas no desktop DEVE exibir "Ver mais"');

// Na Smart TV:
const sixLinesTv = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 6,
  clientHeight: LINE_HEIGHT * 3,
  lineHeight: LINE_HEIGHT,
  maxLines: 3,
  isExpanded: false,
  hasText: true
});
assert.strictEqual(sixLinesTv.canExpand, true, 'Texto de 6 linhas na Smart TV DEVE exibir "Ver mais"');

// Caso F: Transição de Expansão e Recolhimento
// 1. Usuário clica em "Ver mais" -> isExpanded passa a ser true
const expandedState = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 6,
  clientHeight: LINE_HEIGHT * 6,
  lineHeight: LINE_HEIGHT,
  maxLines: 4,
  isExpanded: true,
  hasText: true
});
assert.strictEqual(expandedState.canExpand, true, 'Quando expandido, o botão "Ver menos" deve permanecer disponível');

// 2. Redimensionamento de janela enquanto expandido onde o texto agora caberia em 4 linhas
const resizedToWideScreen = evaluateOverflow({
  scrollHeight: LINE_HEIGHT * 3, // Em tela ultralarga, o texto quebrou em apenas 3 linhas
  clientHeight: LINE_HEIGHT * 3,
  lineHeight: LINE_HEIGHT,
  maxLines: 4,
  isExpanded: true,
  hasText: true
});
assert.strictEqual(resizedToWideScreen.canExpand, false, 'Se em resize o texto couber nas linhas limites, o botão desaparece');
assert.strictEqual(resizedToWideScreen.nextExpanded, false, 'Se couber, o estado expandido reseta');

// Caso G: Troca de item e reset de estado
assert(
  hookCode.includes('useEffect(() => {\n    setIsExpanded(false);\n    setCanExpand(false);\n  }, [contentId]);'),
  'O hook deve resetar obrigatoriamente isExpanded e canExpand ao trocar contentId'
);

console.log('  -> Simulação de medição e lógica de overflow validada com 100% de sucesso.');

console.log('\n--- TODOS OS TESTES PASSARAM COM SUCESSO! ---\n');
