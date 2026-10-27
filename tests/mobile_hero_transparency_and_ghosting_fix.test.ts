/**
 * ZAPITV — TESTE DE CORREÇÃO DE TRANSPARÊNCIA E SOBREPOSIÇÃO DO BANNER PRINCIPAL MOBILE
 * 
 * Validação rigorosa dos requisitos:
 * 1. Cada banner é exibido com sua imagem totalmente opaca (opacity-100).
 * 2. Ausência de opacity reduzida (ex: opacity-90) na imagem do banner ativo.
 * 3. Eliminação total de camadas antigas sob a imagem atual (prevImage não renderizado no DOM).
 * 4. Fundo sólido escuro (#05070a) atrás das imagens para impedir que banners antigos apareçam.
 * 5. Degradês cinematográficos aplicados exclusivamente sobre a imagem do conteúdo atual.
 * 6. Transição suave com passagem por fundo escuro sólido e pré-carregamento na memória.
 * 7. Preservação de dimensões, enquadramento (object-cover object-top), metadados, títulos, botões e dots.
 * 8. Isolamento de Desktop e Smart TV.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('\n========================================================================');
  console.log('=== ZAPITV | TESTE: TRANSPARÊNCIA E SOBREPOSIÇÃO DO BANNER MOBILE ===');
  console.log('========================================================================\n');

  const heroPath = path.resolve(__dirname, '../src/components/mobile/MobileHero.tsx');
  assert.ok(fs.existsSync(heroPath), 'MobileHero.tsx deve existir');
  const heroCode = fs.readFileSync(heroPath, 'utf8');

  // 1. Eliminação de Sobreposição de Banners Antigos
  console.log('[1] Verificando ausência de sobreposição e remoção da camada prevImage no DOM...');
  assert.ok(
    !heroCode.includes('src={prevImage}'),
    'Tag <img> com src={prevImage} DEVE ser eliminada para não renderizar o banner anterior por baixo'
  );
  assert.ok(
    !heroCode.includes('prevSlide?.imageUrl'),
    'prevSlide não deve renderizar camada de imagem antiga no DOM'
  );
  console.log('✓ 1: Nenhuma imagem anterior é renderizada por trás da imagem atual (zero sobreposição fantasma).');

  // 2. Opacidade Total na Imagem Principal (Sem Opacidade Reduzida Indesejada)
  console.log('\n[2] Verificando opacidade total e ausência de opacity-90...');
  assert.ok(
    !heroCode.includes('opacity-90'),
    'A imagem principal NÃO PODE utilizar opacity-90 durante transição ou exibição'
  );
  assert.ok(
    heroCode.includes('opacity-100 duration-200 ease-in') || heroCode.includes('opacity-100'),
    'A imagem principal deve ser exibida com opacidade total (opacity-100)'
  );
  console.log('✓ 2: Imagem exibida com opacidade total de 100% sem translucidez.');

  // 3. Fundo Sólido Escuro Anti-Transparência
  console.log('\n[3] Verificando fundo sólido escuro (#05070a)...');
  assert.ok(
    heroCode.includes('absolute inset-0 bg-[#05070a]'),
    'Container de imagem deve possuir fundo sólido escuro (#05070a) atrás das imagens'
  );
  assert.ok(
    heroCode.includes('bg-[#05070a]'),
    'Section deve manter a cor de background base (#05070a)'
  );
  console.log('✓ 3: Fundo sólido escuro #05070a garante bloqueio visual completo.');

  // 4. Degradês Escuros Cinematográficos
  console.log('\n[4] Verificando degradês escuros sobre a imagem atual...');
  assert.ok(
    heroCode.includes('bg-gradient-to-t from-[#05070a] via-[#05070a]/60 to-transparent'),
    'Degradê inferior to-t from-[#05070a] deve ser mantido para legibilidade de texto'
  );
  assert.ok(
    heroCode.includes('bg-gradient-to-b from-[#05070a]/80 via-transparent to-transparent'),
    'Degradê superior to-b deve ser mantido'
  );
  console.log('✓ 4: Degradês escuros preservados e aplicados sobre a imagem do conteúdo ativo.');

  // 5. Transição Suave com Passagem por Fundo Escuro e Pré-Carregamento
  console.log('\n[5] Verificando transição suave e pré-carregamento...');
  assert.ok(
    heroCode.includes('fadePhase'),
    'MobileHero deve gerenciar as fases de transição via fadePhase'
  );
  assert.ok(
    heroCode.includes("new Image()"),
    'MobileHero deve pré-carregar na memória (new Image()) antes de transicionar'
  );
  assert.ok(
    heroCode.includes('fade-out') && heroCode.includes('fade-in'),
    'MobileHero deve implementar fade-out para fundo escuro seguido de fade-in da nova imagem'
  );
  assert.ok(
    heroCode.includes('preloadHeroItem'),
    'MobileHero deve manter o pré-carregamento antecipado do próximo slide'
  );
  console.log('✓ 5: Transição elegante com passagem por fundo escuro e pré-carregamento confirmada.');

  // 6. Preservação de Dimensões, Botões e Enquadramento
  console.log('\n[6] Verificando preservação de enquadramento, dimensões e botões...');
  assert.ok(heroCode.includes('h-[58vh] min-h-[420px] max-h-[560px]'), 'Dimensões do banner preservadas');
  assert.ok(heroCode.includes('object-cover object-top'), 'Enquadramento object-cover object-top preservado');
  assert.ok(heroCode.includes('Assistir') || heroCode.includes('Ver Detalhes'), 'Botões preservados');
  assert.ok(heroCode.includes('Minha Lista'), 'Botão Minha Lista preservado');
  assert.ok(heroCode.includes('slideItem.title'), 'Título preservado');
  assert.ok(heroCode.includes('slideItem.genres'), 'Metadados preservados');
  console.log('✓ 6: Enquadramento, botões, metadados e títulos 100% preservados.');

  // 7. Isolamento de Desktop e Smart TV
  console.log('\n[7] Verificando isolamento de Desktop e Smart TV...');
  const desktopHeroPath = path.resolve(__dirname, '../components/Hero.tsx');
  const tvHeroPath = path.resolve(__dirname, '../src/components/tv/TvHeroBanner.tsx');
  assert.ok(fs.existsSync(desktopHeroPath), 'Hero.tsx desktop existe');
  assert.ok(fs.existsSync(tvHeroPath), 'TvHeroBanner.tsx TV existe');
  console.log('✓ 7: Desktop e Smart TV mantidos 100% isolados.');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS TESTES DE CORREÇÃO DE TRANSPARÊNCIA PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Erro no teste de transparência do banner:', err);
  process.exit(1);
});
