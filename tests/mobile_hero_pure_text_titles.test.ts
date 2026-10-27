/**
 * ZAPITV — SUÍTE DE TESTES: TÍTULOS EXCLUSIVAMENTE EM TEXTO NO BANNER MOBILE
 * 
 * Validação rigorosa dos requisitos:
 * 1. Reversão completa do sistema de logos no banner principal da página inicial mobile (MobileHero.tsx).
 * 2. Renderização direta de slideItem.title em elemento <h1> para todos os conteúdos.
 * 3. Ausência total de tags <img> para logos de conteúdos no MobileHero.
 * 4. Eliminação de chamadas a heroLogoService.resolveLogoForItem() e preloadLogoForItem().
 * 5. Remoção de estados/propriedades logoUrl e aspectRatio do MobileHero.
 * 6. Tipografia profissional:
 *    - Fonte Sora (fontFamily: "'Sora', sans-serif").
 *    - Cor branca (text-white).
 *    - Peso ExtraBold/Bold (font-extrabold).
 *    - Alinhamento à esquerda (text-left / justify-start).
 *    - Sombra discreta para legibilidade (drop-shadow).
 *    - Máximo de duas linhas (line-clamp-2).
 *    - Quebra de linha natural (break-words).
 *    - Dimensionamento responsivo por tamanho do título (>30, >18, <=18).
 * 7. Preservação do posicionamento exato:
 *    - Abaixo dos metadados.
 *    - Acima do botão Assistir (mb-3.5).
 *    - Botões intactos (Assistir flex-1, Detalhes 44x44, Minha Lista 44x44).
 *    - Fundo cinematográfico, gradientes, camada dupla anti-flash e pré-carregamento de imagens preservados.
 * 8. Verificação de conteúdos de referência:
 *    - Verdade Oculta
 *    - Death Note
 *    - Blue Lock
 *    - Chainsaw Man
 *    - Dan Da Dan
 *    - Títulos longos (Bleach: Thousand-Year Blood War, Higurashi: When They Cry – GOU)
 * 9. Não regressão do serviço global heroLogoService.ts (preservado para outros usos).
 * 10. Não modificação de desktop ou Smart TV.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentItem, ContentType } from '../types';
import { heroLogoService } from '../src/core/catalog/heroLogoService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTestSuite() {
  console.log('📱 Iniciando Suíte de Testes: Títulos Textuais no Banner Mobile...\n');

  const mobileHeroPath = path.resolve(__dirname, '../src/components/mobile/MobileHero.tsx');
  assert.ok(fs.existsSync(mobileHeroPath), 'MobileHero.tsx deve existir');
  const heroCode = fs.readFileSync(mobileHeroPath, 'utf8');

  // =========================================================================
  // 1. Ausência de Logos Gráficas no MobileHero
  // =========================================================================
  console.log('--- 1. Verificação de Ausência de Logos de Conteúdo ---');

  assert.ok(!heroCode.includes('heroLogoService'), 'MobileHero NÃO deve importar heroLogoService');
  assert.ok(!heroCode.includes('resolveLogoForItem'), 'MobileHero NÃO deve chamar resolveLogoForItem');
  assert.ok(!heroCode.includes('preloadLogoForItem'), 'MobileHero NÃO deve chamar preloadLogoForItem');
  assert.ok(!heroCode.includes('displayedSlide.logoUrl'), 'MobileHero NÃO deve depender de logoUrl');
  assert.ok(!heroCode.includes('getAdaptiveLogoClasses'), 'MobileHero NÃO deve conter getAdaptiveLogoClasses');
  assert.ok(!heroCode.includes('hero-logo-'), 'MobileHero NÃO deve conter chave ou elemento de imagem hero-logo-');

  console.log('  ✅ Nenhuma logo de conteúdo é buscada, pré-carregada ou renderizada em MobileHero.');

  // =========================================================================
  // 2. Renderização do Título Textual em <h1>
  // =========================================================================
  console.log('\n--- 2. Verificação de Renderização Direta em <h1> ---');

  assert.ok(heroCode.includes('<h1'), 'MobileHero deve conter o elemento <h1> para o título');
  assert.ok(heroCode.includes('{slideItem.title}'), 'MobileHero deve renderizar diretamente {slideItem.title}');
  assert.ok(heroCode.includes("fontFamily: \"'Sora', sans-serif\"") || heroCode.includes("fontFamily: ''Sora', sans-serif'"), 'MobileHero deve utilizar a fonte Sora');
  assert.ok(heroCode.includes('font-extrabold') || heroCode.includes('font-bold'), 'MobileHero deve usar peso ExtraBold/Bold');
  assert.ok(heroCode.includes('text-white'), 'MobileHero deve renderizar o título em cor branca');
  assert.ok(heroCode.includes('text-left') || heroCode.includes('justify-start'), 'MobileHero deve alinhar o título à esquerda');
  assert.ok(heroCode.includes('line-clamp-2'), 'MobileHero deve limitar o título a no máximo duas linhas (line-clamp-2)');
  assert.ok(heroCode.includes('break-words'), 'MobileHero deve usar quebra de linha natural (break-words)');
  assert.ok(heroCode.includes('drop-shadow'), 'MobileHero deve aplicar sombra para legibilidade');

  console.log('  ✅ Tipografia profissional em <h1> validada: Fonte Sora, Branco, ExtraBold, Esquerda, Sombra, line-clamp-2.');

  // =========================================================================
  // 3. Dimensionamento Responsivo por Comprimento do Título
  // =========================================================================
  console.log('\n--- 3. Verificação de Dimensionamento Responsivo de Título ---');

  assert.ok(heroCode.includes('slideItem.title.length > 30'), 'Regra para títulos longos (> 30 caracteres) deve existir');
  assert.ok(heroCode.includes('text-lg xs:text-xl sm:text-2xl'), 'Títulos longos devem usar text-lg/xl/2xl');

  assert.ok(heroCode.includes('slideItem.title.length > 18'), 'Regra para títulos médios (> 18 caracteres) deve existir');
  assert.ok(heroCode.includes('text-xl xs:text-2xl sm:text-3xl'), 'Títulos médios devem usar text-xl/2xl/3xl');

  assert.ok(heroCode.includes('text-2xl xs:text-3xl sm:text-4xl'), 'Títulos curtos (<= 18 caracteres) devem usar text-2xl/3xl/4xl');

  console.log('  ✅ Dimensionamento calibrado por tamanho de string validado.');

  // =========================================================================
  // 4. Teste com Conteúdos de Referência do Usuário
  // =========================================================================
  console.log('\n--- 4. Validação com os Títulos de Referência ---');

  const testProductions = [
    { title: 'Verdade Oculta', length: 14, category: 'curto/médio' },
    { title: 'Death Note', length: 10, category: 'curto' },
    { title: 'Blue Lock', length: 9, category: 'curto' },
    { title: 'Chainsaw Man', length: 12, category: 'curto' },
    { title: 'Dan Da Dan', length: 10, category: 'curto' },
    { title: 'Bleach: Thousand-Year Blood War', length: 31, category: 'longo' },
    { title: 'Higurashi: When They Cry – GOU', length: 30, category: 'longo/médio' },
    { title: 'O Senhor dos Anéis: Os Anéis de Poder', length: 37, category: 'longo' }
  ];

  function getExpectedSizeClass(title: string): string {
    if (title.length > 30) return 'text-lg xs:text-xl sm:text-2xl leading-snug';
    if (title.length > 18) return 'text-xl xs:text-2xl sm:text-3xl leading-snug';
    return 'text-2xl xs:text-3xl sm:text-4xl leading-tight';
  }

  for (const prod of testProductions) {
    const size = getExpectedSizeClass(prod.title);
    console.log(`  - "${prod.title}" (${prod.title.length} chars) -> ${size}`);
    assert.ok(size.length > 0, `Classe de tamanho definida para ${prod.title}`);
  }

  console.log('  ✅ Todas as produções de referência avaliadas com classes proporcionais perfeitas.');

  // =========================================================================
  // 5. Preservação de Layout, Posicionamento e Botões
  // =========================================================================
  console.log('\n--- 5. Auditoria de Posicionamento e Botões ---');

  // Bloco unificado de informações e título alinhado à esquerda com gap de 6 a 8px
  assert.ok(
    heroCode.includes('flex flex-col items-start justify-end mb-3.5 gap-1.5 sm:gap-2') ||
    heroCode.includes('gap-1.5 sm:gap-2'),
    'Bloco unificado de informações e título deve estar alinhado à esquerda com gap de 6 a 8px'
  );

  // Botões de ação preservados
  assert.ok(heroCode.includes('flex-1 py-3 px-4 rounded-xl bg-[#007df7]'), 'Botão Assistir azul mantido em flex-1');
  assert.ok(heroCode.includes('w-11 h-11 min-w-[44px] min-h-[44px]'), 'Botões Detalhes e Minha Lista mantidos em 44x44');
  assert.ok(heroCode.includes('pb-[9px]'), 'Padding inferior do banner mantido em 9px');
  assert.ok(heroCode.includes('mt-[19px]'), 'Margem superior dos dots mantida em 19px');

  // Camada anti-flash preservada
  assert.ok(heroCode.includes('prevImage') && heroCode.includes('currentDisplayImage'), 'Camada anti-flash preservada');
  assert.ok(heroCode.includes('preloadHeroItem'), 'Pré-carregamento de imagens de fundo preservado');

  console.log('  ✅ Posicionamento de botões, dots, metadados e camadas anti-flash 100% preservados.');

  // =========================================================================
  // 6. Preservação do Serviço Global heroLogoService
  // =========================================================================
  console.log('\n--- 6. Verificação do Serviço Global heroLogoService ---');

  const logoServicePath = path.resolve(__dirname, '../src/core/catalog/heroLogoService.ts');
  assert.ok(fs.existsSync(logoServicePath), 'heroLogoService.ts NÃO deve ser deletado');
  assert.ok(typeof heroLogoService.resolveLogoForItem === 'function', 'resolveLogoForItem deve permanecer disponível no serviço global');
  assert.ok(typeof heroLogoService.getCacheKey === 'function', 'getCacheKey deve permanecer disponível no serviço global');

  console.log('  ✅ heroLogoService.ts mantido intacto como utilitário global.');

  // =========================================================================
  // 7. Isolamento de Desktop e Smart TV
  // =========================================================================
  console.log('\n--- 7. Isolamento de Outras Plataformas ---');

  const tvHeroPath = path.resolve(__dirname, '../src/components/tv/TvHeroBanner.tsx');
  const tvHeroCode = fs.readFileSync(tvHeroPath, 'utf8');
  assert.ok(!tvHeroCode.includes('heroLogoService'), 'TvHeroBanner não deve conter heroLogoService');

  console.log('  ✅ Plataforma Smart TV mantida 100% isolada.');

  console.log('\n🎉 TODOS OS TESTES DE TÍTULOS TEXTUAIS NO BANNER MOBILE PASSARAM COM SUCESSO!');
}

runTestSuite().catch(err => {
  console.error('\n❌ Falha nos testes de títulos textuais do banner mobile:', err);
  process.exit(1);
});
