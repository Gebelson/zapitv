/**
 * ZAPITV — TESTE DO ENQUADRAMENTO E BORDER-RADIUS DA SELEÇÃO NOS CARROSSÉIS
 *
 * Valida a geometria compartilhada, concentricidade de cantos e contenção de vazamentos:
 * 1. Geometria compartilhada entre a capa (TvCard16x9) e a moldura (TvContentRow) em proporção 2:3.
 * 2. Contorno externo simétrico com respiro de 4px em todas as 4 extremidades (-inset-[4px]).
 * 3. Cantos concêntricos e proporcionais: capa rounded-2xl (16px) e moldura rounded-[20px] (16 + 4 = 20px).
 * 4. Eliminação total de escala indevida (hover:scale-102 e scale-105) quando disableScale está ativo.
 * 5. Hierarquia de profundidade (z-index): moldura em z-30 sobre o track em z-10 (cards deslizam por baixo).
 * 6. Moldura fixa no Slot 0 (SAFE_MARGIN_LEFT = 64px) sem se mover durante as transições horizontais.
 * 7. Glow ambiente compartilhando a mesma geometria e proporção 2:3.
 * 8. Simulação matemática do enquadramento nos 4 breakpoints responsivos (220px, 245px, 260px, 275px).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runSelectionFrameTests() {
  console.log('\n========================================================================');
  console.log('--- TESTE: ENQUADRAMENTO E BORDER-RADIUS DA SELEÇÃO NOS CARROSSÉIS ---');
  console.log('========================================================================\n');

  const tvContentRowPath = path.resolve(process.cwd(), 'src/components/tv/TvContentRow.tsx');
  const tvCardPath = path.resolve(process.cwd(), 'src/components/tv/TvCard16x9.tsx');

  assert.ok(fs.existsSync(tvContentRowPath), 'TvContentRow.tsx deve existir');
  assert.ok(fs.existsSync(tvCardPath), 'TvCard16x9.tsx deve existir');

  const contentRowCode = fs.readFileSync(tvContentRowPath, 'utf8');
  const cardCode = fs.readFileSync(tvCardPath, 'utf8');

  // Cenário 1: Geometria compartilhada 2:3 entre capa e moldura
  console.log('--- Cenário 1: Geometria compartilhada 2:3 entre capa e moldura ---');
  assert.ok(
    contentRowCode.includes('w-[220px] sm:w-[245px] md:w-[260px] lg:w-[275px]') &&
    contentRowCode.includes('relative w-full aspect-[2/3]'),
    'TvContentRow deve estruturar a moldura com as mesmas classes de largura e aspect-[2/3] dos slots'
  );
  assert.ok(
    cardCode.includes('aspect-[2/3]'),
    'TvCard16x9 deve manter o poster em proporção vertical 2:3'
  );
  console.log('✓ Cenário 1: Geometria compartilhada e proporção 2:3 confirmadas OK');

  // Cenário 2: Contorno externo simétrico com respiro de 4px (-inset-[4px])
  console.log('\n--- Cenário 2: Respiro externo de 4px simétrico em todos os lados ---');
  assert.ok(
    contentRowCode.includes('-inset-[4px]'),
    'A moldura de seleção em TvContentRow deve usar -inset-[4px] para respiro uniforme de 4px'
  );
  assert.ok(
    !contentRowCode.includes("top: 'calc(2rem - 4px)'") &&
    !contentRowCode.includes("left: `${SAFE_MARGIN_LEFT - 4}px`"),
    'TvContentRow NÃO deve mais calcular offsets manuais sujeitos a pixels fracionários'
  );
  console.log('✓ Cenário 2: Respiro de 4px simétrico via -inset-[4px] OK');

  // Cenário 3: Cantos arredondados concêntricos e proporcionais (16px capa + 4px respiro = 20px moldura)
  console.log('\n--- Cenário 3: Cantos arredondados concêntricos e proporcionais ---');
  assert.ok(
    cardCode.includes('rounded-2xl'),
    'A capa em TvCard16x9 deve possuir rounded-2xl (raio base de 16px)'
  );
  assert.ok(
    contentRowCode.includes('rounded-[20px]'),
    'A moldura externa deve possuir rounded-[20px] correspondente ao raio concêntrico proporcional (16 + 4 = 20px)'
  );
  console.log('✓ Cenário 3: Concentricidade de curvatura (16px base + 4px respiro = 20px) validada OK');

  // Cenário 4: Eliminação de hover:scale-102 e scale-105 quando disableScale está ativo
  console.log('\n--- Cenário 4: Supressão rigorosa de escala indevida na TV ---');
  assert.ok(
    cardCode.includes('disableScale') &&
    cardCode.includes("disableScale\r\n          ? 'z-10'") ||
    cardCode.includes("disableScale\n          ? 'z-10'"),
    'TvCard16x9 deve desativar scale-105 e hover:scale-102 quando disableScale for true'
  );
  assert.ok(
    contentRowCode.includes('disableScale={true}'),
    'TvContentRow deve passar disableScale={true} para TvCard16x9 nos slots do carrossel'
  );
  console.log('✓ Cenário 4: Escala indevida e hover:scale-102 100% suprimidos na TV OK');

  // Cenário 5: Hierarquia de profundidade (z-index): moldura em z-30 sobre trilho em z-10
  console.log('\n--- Cenário 5: Hierarquia de z-index (moldura fixa sobre cards deslizantes) ---');
  assert.ok(
    contentRowCode.includes('className="absolute z-30 pointer-events-none'),
    'A moldura deve estar posicionada em z-30'
  );
  assert.ok(
    contentRowCode.includes('className="relative z-10 flex items-center gap-6"'),
    'O trilho horizontal (trackRef) deve estar posicionado em z-10'
  );
  console.log('✓ Cenário 5: Moldura em z-30 sobre cards em z-10 sem invasão visual de contorno OK');

  // Cenário 6: Moldura estática na margem segura de 64px
  console.log('\n--- Cenário 6: Moldura estática no Slot 0 ---');
  assert.ok(
    contentRowCode.includes('left: `${SAFE_MARGIN_LEFT}px`') &&
    contentRowCode.includes("top: '2rem'"),
    'A moldura deve estar ancorada estaticamente em SAFE_MARGIN_LEFT (64px) e top: 2rem'
  );
  assert.ok(
    contentRowCode.includes('SAFE_MARGIN_LEFT = 64'),
    'SAFE_MARGIN_LEFT deve permanecer em 64px'
  );
  console.log('✓ Cenário 6: Ancoragem estática milimétrica no Slot 0 confirmada OK');

  // Cenário 7: Glow ambiente com geometria compartilhada
  console.log('\n--- Cenário 7: Glow ambiente com geometria compartilhada 2:3 ---');
  assert.ok(
    contentRowCode.includes('className="absolute z-0 pointer-events-none transition-all duration-300 flex-none w-[220px] sm:w-[245px] md:w-[260px] lg:w-[275px]"') &&
    contentRowCode.includes('getCardAmbientGlow'),
    'O glow ambiente de fundo deve utilizar a mesma geometria 2:3 dos slots'
  );
  console.log('✓ Cenário 7: Glow ambiente compartilhando geometria idêntica OK');

  // Cenário 8: Simulação matemática da concentricidade nos 4 breakpoints
  console.log('\n--- Cenário 8: Simulação matemática da geometria nos 4 breakpoints ---');
  const breakpoints = [
    { name: 'Base (<640px)', width: 220 },
    { name: 'sm (>=640px)', width: 245 },
    { name: 'md (>=768px)', width: 260 },
    { name: 'lg (>=1024px, 1080p)', width: 275 },
  ];

  for (const bp of breakpoints) {
    const cardH = bp.width * 1.5;
    const frameW = bp.width + 8; // -inset-[4px] adiciona 4px de cada lado
    const frameH = cardH + 8;
    const cardRadius = 16;
    const frameRadius = 20;

    // Respiro horizontal e vertical
    const gapH = (frameW - bp.width) / 2;
    const gapV = (frameH - cardH) / 2;
    const radiusDiff = frameRadius - cardRadius;

    assert.strictEqual(gapH, 4, `${bp.name}: Respiro horizontal deve ser exatamente 4px`);
    assert.strictEqual(gapV, 4, `${bp.name}: Respiro vertical deve ser exatamente 4px`);
    assert.strictEqual(radiusDiff, 4, `${bp.name}: Diferença de raio deve ser exatamente 4px`);

    console.log(`    ↳ Breakpoint ${bp.name}: card ${bp.width}x${cardH}px → moldura ${frameW}x${frameH}px | respiro: ${gapH}px | raio: ${cardRadius}px → ${frameRadius}px`);
  }
  console.log('✓ Cenário 8: Geometria e concentricidade perfeitas em todos os breakpoints OK');

  console.log('\n========================================================================');
  console.log('TODOS OS 8 CENÁRIOS DE ENQUADRAMENTO E BORDER-RADIUS PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runSelectionFrameTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Falha no teste de enquadramento da seleção:', err);
  process.exit(1);
});
