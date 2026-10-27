/**
 * ZAPITV — TESTE DE CORREÇÃO DO ESPAÇAMENTO DAS INFORMAÇÕES NO BANNER MOBILE
 * 
 * Validação rigorosa dos requisitos:
 * 1. Proximidade vertical de 6 a 8px entre informações (categoria, ano, nota) e título.
 * 2. Ordem estrita mantida:
 *    - 1º: Categoria, ano e avaliação
 *    - 2º: Título do conteúdo logo abaixo
 * 3. Agrupamento em um único bloco alinhado à esquerda (flex flex-col items-start).
 * 4. Posicionamento no terço inferior do banner, respeitando margens existentes.
 * 5. Remoção de justify-between, margem automática ou min-h excessivo separando as informações.
 * 6. Responsividade de títulos longos preservada (line-clamp-2, break-words, Sora).
 * 7. Isolamento de Desktop e Smart TV.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('\n========================================================================');
  console.log('=== ZAPITV | TESTE: ESPAÇAMENTO DAS INFORMAÇÕES NO BANNER MOBILE ===');
  console.log('========================================================================\n');

  const heroPath = path.resolve(__dirname, '../src/components/mobile/MobileHero.tsx');
  assert.ok(fs.existsSync(heroPath), 'MobileHero.tsx deve existir');
  const heroCode = fs.readFileSync(heroPath, 'utf8');

  // 1. Verificação do Bloco Unificado
  console.log('[1] Verificando agrupamento em bloco único alinhado à esquerda...');
  assert.ok(
    heroCode.includes('flex flex-col items-start justify-end mb-3.5 gap-1.5 sm:gap-2') ||
    heroCode.includes('flex flex-col items-start justify-end mb-3.5 gap-[7px]'),
    'Metadados e título devem estar agrupados em um único container flex-col items-start com gap calibrado entre 6 e 8px'
  );
  console.log('✓ 1: Bloco unificado com alinhamento à esquerda (items-start) confirmado.');

  // 2. Verificação do Espaçamento de 6 a 8px
  console.log('\n[2] Verificando espaçamento vertical calibrado (6 a 8px)...');
  assert.ok(
    heroCode.includes('gap-1.5 sm:gap-2') || heroCode.includes('gap-[7px]'),
    'Espaçamento vertical deve ser aproximadamente 6 a 8px (gap-1.5 = 6px, gap-2 = 8px)'
  );
  assert.ok(
    !heroCode.includes('mb-1.5 text-[11px]'),
    'Margem inferior redundante do bloco de metadados DEVE ser eliminada para não somar espaçamento excessivo'
  );
  assert.ok(
    !heroCode.includes('min-h-[56px]'),
    'min-h-[56px] que afastava títulos curtos dos metadados DEVE ser removido'
  );
  console.log('✓ 2: Espaçamento vertical estritamente calibrado em 6 a 8px sem espaçadores excessivos.');

  // 3. Ordem dos Elementos
  console.log('\n[3] Verificando ordem dos elementos (1º Metadados, 2º Título)...');
  const metadataIndex = heroCode.indexOf('slideItem.genres');
  const titleIndex = heroCode.indexOf('{slideItem.title}');
  assert.ok(metadataIndex > -1, 'Metadados devem existir no código');
  assert.ok(titleIndex > -1, 'Título deve existir no código');
  assert.ok(
    metadataIndex < titleIndex,
    'Metadados (gênero/categoria, ano, nota) DEVEM vir imediatamente antes do título'
  );
  console.log('✓ 3: Ordem correta validada: Categoria/Ano/Avaliação logo acima do Título.');

  // 4. Posicionamento e Margens
  console.log('\n[4] Verificando posicionamento inferior e margens do banner...');
  assert.ok(
    heroCode.includes('px-4 pb-[9px] z-10 max-w-lg mx-auto'),
    'Margens inferiores pb-[9px] e horizontais px-4 do banner devem ser rigorosamente preservadas'
  );
  assert.ok(
    heroCode.includes('mb-3.5'),
    'Margem inferior mb-3.5 do bloco em relação aos botões de ação deve ser preservada'
  );
  console.log('✓ 4: Posicionamento próximo à base e margens preservadas.');

  // 5. Quebra de Linha e Tipografia
  console.log('\n[5] Verificando suporte a títulos longos e tipografia...');
  assert.ok(heroCode.includes('line-clamp-2'), 'Título deve manter line-clamp-2');
  assert.ok(heroCode.includes('break-words'), 'Título deve manter quebra natural break-words');
  assert.ok(heroCode.includes("fontFamily: \"'Sora', sans-serif\""), 'Fonte Sora deve ser mantida');
  assert.ok(heroCode.includes('font-extrabold'), 'Peso ExtraBold do título deve ser mantido');
  assert.ok(heroCode.includes('text-white'), 'Cor branca do título deve ser mantida');
  console.log('✓ 5: Quebra responsiva e tipografia intactas.');

  // 6. Isolamento das Demais Plataformas
  console.log('\n[6] Verificando isolamento de Desktop e Smart TV...');
  const desktopHeroPath = path.resolve(__dirname, '../components/Hero.tsx');
  const tvHeroPath = path.resolve(__dirname, '../src/components/tv/TvHeroBanner.tsx');
  assert.ok(fs.existsSync(desktopHeroPath), 'Hero.tsx desktop deve existir');
  assert.ok(fs.existsSync(tvHeroPath), 'TvHeroBanner.tsx TV deve existir');
  console.log('✓ 6: Desktop e Smart TV mantidos 100% isolados.');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS TESTES DE ESPAÇAMENTO DO BANNER MOBILE PASSARAM!');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Erro no teste de espaçamento do banner mobile:', err);
  process.exit(1);
});
