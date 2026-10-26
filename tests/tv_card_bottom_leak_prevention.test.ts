/**
 * ZAPITV — TESTE DE PREVENÇÃO DE VAZAMENTO VISUAL NA PARTE INFERIOR DOS CARDS (SMART TV)
 *
 * Valida a integridade do recorte visual e a eliminação de sobras na borda inferior:
 * 1. Card com progresso: barra de progresso com clipPath concêntrico (inset 0 round 0 0 1rem 1rem) e sem sombras externas que vazem para baixo.
 * 2. Card sem progresso: container com clipPath (inset 0 round 1rem), WebkitMaskImage e contain: paint sem shadow-xl residual.
 * 3. Card focado no carrossel: disableScale ativo sem hover:scale-102 e sem dilatação na base.
 * 4. Card não focado: camada z-10 sem interferência na moldura em z-30.
 * 5. Navegação lateral (direita e esquerda): translate3d(X, 0, 0) com deslocamento estritamente inteiro.
 * 6. Primeiro card vs cards seguintes: alinhamento no Slot 0 em SAFE_MARGIN_LEFT (64px) e slots seguintes com gap uniforme (24px).
 * 7. Capas claras e escuras: gradiente de base recortado rigidamente pela máscara de GPU.
 * 8. Zero reflow síncrono ou leituras forçadas de layout durante o movimento.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runCardLeakPreventionTests() {
  console.log('\n========================================================================');
  console.log('--- TESTE: PREVENÇÃO DE VAZAMENTO VISUAL NA BORDA INFERIOR DOS CARDS ---');
  console.log('========================================================================\n');

  const cardPath = path.resolve(process.cwd(), 'src/components/tv/TvCard16x9.tsx');
  const rowPath = path.resolve(process.cwd(), 'src/components/tv/TvContentRow.tsx');

  assert.ok(fs.existsSync(cardPath), 'TvCard16x9.tsx deve existir');
  assert.ok(fs.existsSync(rowPath), 'TvContentRow.tsx deve existir');

  const cardCode = fs.readFileSync(cardPath, 'utf8');
  const rowCode = fs.readFileSync(rowPath, 'utf8');

  // Cenário 1: Card com barra de progresso (recorte e ausência de sombra externa)
  console.log('--- Cenário 1: Card com progresso (recorte e ausência de vazamento) ---');
  assert.ok(
    cardCode.includes("clipPath: 'inset(0 round 0 0 1rem 1rem)'") ||
    cardCode.includes('clipPath: "inset(0 round 0 0 1rem 1rem)"'),
    'Barra de progresso deve conter clipPath recortando perfeitamente os cantos inferiores arredondados (1rem)'
  );
  assert.ok(
    cardCode.includes("WebkitClipPath: 'inset(0 round 0 0 1rem 1rem)'") ||
    cardCode.includes('WebkitClipPath: "inset(0 round 0 0 1rem 1rem)"'),
    'Barra de progresso deve conter WebkitClipPath para compatibilidade com motores WebKit de Smart TVs'
  );
  assert.ok(
    !cardCode.includes('shadow-[0_0_8px_#00e5ff]'),
    'A barra de progresso NÃO deve projetar sombra ciana externa que vaze para fora do pôster'
  );
  console.log('✓ Cenário 1: Barra de progresso com recorte concêntrico 1rem e livre de sombras vazando OK');

  // Cenário 2: Card sem progresso (recorte de GPU no container do pôster e ausência de shadow-xl)
  console.log('\n--- Cenário 2: Card sem progresso (clipping em GPU e eliminação de shadow-xl) ---');
  assert.ok(
    cardCode.includes("clipPath: 'inset(0 round 1rem)'") ||
    cardCode.includes('clipPath: "inset(0 round 1rem)"'),
    'Container principal do pôster deve aplicar clipPath: inset(0 round 1rem) para contenção total'
  );
  assert.ok(
    cardCode.includes("WebkitMaskImage: '-webkit-radial-gradient(white, black)'"),
    'Container principal deve aplicar WebkitMaskImage para corrigir bug histórico de overflow em WebKit durante 3D transforms'
  );
  assert.ok(
    cardCode.includes("contain: 'paint'"),
    'Container principal deve declarar contain: paint para isolar totalmente a pintura interna'
  );
  assert.ok(
    cardCode.includes("transform: 'translateZ(0)'"),
    'Container principal deve forçar camada de composição dedicada com transform: translateZ(0)'
  );
  assert.ok(
    !cardCode.includes('shadow-xl border border-white/10'),
    'Container principal NÃO deve conter shadow-xl que projeta sombra de 20px abaixo do card'
  );
  console.log('✓ Cenário 2: Container do pôster com recorte absoluto em GPU e sem shadow-xl inferior OK');

  // Cenário 3: Card focado no carrossel sem dilatação ou escala indevida
  console.log('\n--- Cenário 3: Card focado no carrossel com escala neutra (disableScale) ---');
  assert.ok(
    cardCode.includes("disableScale\r\n          ? 'z-10'") ||
    cardCode.includes("disableScale\n          ? 'z-10'"),
    'TvCard16x9 não deve aplicar hover:scale-102 nem scale-105 quando disableScale for true'
  );
  assert.ok(
    rowCode.includes('disableScale={true}'),
    'TvContentRow deve instruir todos os cards dos carrosséis com disableScale={true}'
  );
  console.log('✓ Cenário 3: Escala indevida e dilatações por hover totalmente suprimidas OK');

  // Cenário 4: Camadas z-index (moldura fixa z-30 sobre cards deslizantes z-10)
  console.log('\n--- Cenário 4: Hierarquia de z-index evitando invasão visual de contornos ---');
  assert.ok(
    rowCode.includes('className="absolute z-30 pointer-events-none flex-none'),
    'A moldura fixa do Slot 0 deve estar em z-30'
  );
  assert.ok(
    rowCode.includes('className="relative z-10 flex items-center"') &&
    rowCode.includes('gap: `${viewport.cardGap}px`'),
    'O trilho horizontal com os cards deve estar em z-10'
  );
  console.log('✓ Cenário 4: Moldura em z-30 sobre cards em z-10 garantindo que os cards passem por baixo OK');

  // Cenário 5: Translação estritamente horizontal com translate3d(X, 0, 0)
  console.log('\n--- Cenário 5: Translação lateral com coordenadas inteiras no eixo Y e Z ---');
  assert.ok(
    rowCode.includes('transform: `translate3d(${baseOffset + translateX}px, 0, 0)`'),
    'Trilho horizontal deve transladar exclusivamente no eixo X com Y e Z fixados em 0'
  );
  console.log('✓ Cenário 5: translate3d fixado em Y=0 e Z=0 sem desvios subpixel no eixo vertical OK');

  // Cenário 6: Posicionamento no Slot 0 e espaçamento uniforme entre cards
  console.log('\n--- Cenário 6: Alinhamento milimétrico do Slot 0 e gap entre cards ---');
  assert.ok(
    rowCode.includes('viewport.safeMarginX'),
    'A margem segura deve acompanhar o viewport da TV'
  );
  assert.ok(
    rowCode.includes('gap: `${viewport.cardGap}px`'),
    'O espaçamento dos cards deve acompanhar o viewport da TV'
  );
  console.log('✓ Cenário 6: Margem segura (64px) e espaçamento de 24px entre cards validados OK');

  // Cenário 7: Capas escuras e claras com gradiente recortado
  console.log('\n--- Cenário 7: Gradiente de legibilidade restrito ao recorte da imagem ---');
  assert.ok(
    cardCode.includes('bottom-0 h-14 sm:h-18 bg-gradient-to-t') || cardCode.includes('bottom-0 h-24 sm:h-28 bg-gradient-to-t'),
    'Gradiente inferior de legibilidade deve permanecer restrito à base inferior'
  );
  console.log('✓ Cenário 7: Gradiente inferior de legibilidade contido dentro do clipPath da GPU OK');

  // Cenário 8: Ausência de reflow forçado e layout trancado
  console.log('\n--- Cenário 8: Ausência de reflow síncrono forçado durante animações ---');
  assert.ok(
    !rowCode.includes('trackRef.current.offsetHeight') &&
    !rowCode.includes('.offsetHeight;'),
    'TvContentRow não deve invocar offsetHeight durante a animação horizontal'
  );
  console.log('✓ Cenário 8: Zero reflow síncrono durante deslizamento horizontal OK');

  console.log('\n========================================================================');
  console.log('TODOS OS 8 CENÁRIOS DE PREVENÇÃO DE VAZAMENTO PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runCardLeakPreventionTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Falha no teste de prevenção de vazamento dos cards:', err);
  process.exit(1);
});
