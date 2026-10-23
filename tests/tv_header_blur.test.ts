import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runTvHeaderBlurTests() {
  console.log('\n--- Auditoria do Desfoque Real e Progressivo do Header na Smart TV ---');

  // 1. Auditoria de index.css
  const indexCssPath = path.resolve(process.cwd(), 'index.css');
  assert(fs.existsSync(indexCssPath), 'index.css deve existir');
  const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

  // 1.1 Exceção controlada para tv-header-blur nas regras de desativação global
  assert(
    indexCssContent.includes('.backdrop-blur-md:not(.tv-header-blur)') &&
    indexCssContent.includes('.backdrop-blur-lg:not(.tv-header-blur)') &&
    indexCssContent.includes('.backdrop-blur-xl:not(.tv-header-blur)') &&
    indexCssContent.includes('.backdrop-blur-2xl:not(.tv-header-blur)') &&
    indexCssContent.includes('.backdrop-blur-3xl:not(.tv-header-blur)'),
    'index.css deve preservar a desativação de desfoques pesados globais no modo TV mantendo exceção estrita para .tv-header-blur'
  );
  console.log('✓ Teste 1: Regras globais de desempenho para Smart TV preservadas com exceção controlada para o header');

  // 1.2 Regra dedicada para .tv-header-blur com prefixos e aceleração de GPU
  assert(
    indexCssContent.includes('.zapi-tv-root .tv-header-blur') &&
    indexCssContent.includes('backdrop-filter: blur(16px) !important;') &&
    indexCssContent.includes('-webkit-backdrop-filter: blur(16px) !important;') &&
    indexCssContent.includes('transform: translateZ(0);'),
    'index.css deve definir a classe .tv-header-blur com desfoque real de 16px, prefixo -webkit- e aceleração por GPU'
  );
  console.log('✓ Teste 2: Classe .tv-header-blur configurada com blur(16px), -webkit-backdrop-filter e aceleração de GPU');

  // 1.3 Fallback gracioso para navegadores e Smart TVs legadas sem suporte a backdrop-filter
  assert(
    indexCssContent.includes('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))') &&
    indexCssContent.includes('background: linear-gradient('),
    'index.css deve fornecer fallback em degradê escuro via @supports not para navegadores sem suporte a desfoque em tempo real'
  );
  console.log('✓ Teste 3: Fallback leve e elegante garantido para WebViews sem suporte a backdrop-filter');

  // 2. Auditoria de TvHeader.tsx
  const tvHeaderPath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');
  assert(fs.existsSync(tvHeaderPath), 'TvHeader.tsx deve existir');
  const tvHeaderContent = fs.readFileSync(tvHeaderPath, 'utf8');

  // 2.1 Preservação do design flutuante livre
  assert(
    !tvHeaderContent.includes('border-b border-white/5') &&
    !tvHeaderContent.includes('bg-[#05070a]/92'),
    'TvHeader NÃO deve ser transformado em uma barra retangular sólida ou fechada com borda dura'
  );
  assert(
    tvHeaderContent.includes('bg-transparent') &&
    tvHeaderContent.includes('border-none'),
    'TvHeader deve manter a base transparente e sem bordas'
  );
  console.log('✓ Teste 4: Design flutuante livre preservado sem faixas retangulares sólidas ou bordas duras');

  // 2.2 Desfoque real no fundo em camada z-0 com máscara progressiva
  assert(
    tvHeaderContent.includes('tv-header-blur') &&
    tvHeaderContent.includes("backdropFilter: 'blur(16px)'") &&
    tvHeaderContent.includes("WebkitBackdropFilter: 'blur(16px)'") &&
    tvHeaderContent.includes('maskImage:') &&
    tvHeaderContent.includes('WebkitMaskImage:') &&
    tvHeaderContent.includes('linear-gradient(to bottom, black 0%') &&
    tvHeaderContent.includes('transparent 100%'),
    'TvHeader deve conter elemento .tv-header-blur com blur(16px) e máscara gradual de dissolução sem cortes retos'
  );
  console.log('✓ Teste 5: Desfoque progressivo implementado com máscara suave dissolvendo em direção ao catálogo');

  // 2.3 Camada de degradê escuro complementar preservada
  assert(
    tvHeaderContent.includes('linear-gradient(to bottom, rgba(5,7,10,0.92) 0%') &&
    tvHeaderContent.includes('rgba(5,7,10,0.70) 38%') &&
    tvHeaderContent.includes('rgba(5,7,10,0.20) 75%'),
    'TvHeader deve combinar o desfoque ao degradê escuro cinematográfico para excelente legibilidade'
  );
  console.log('✓ Teste 6: Degradê cinematográfico escuro integrado harmoniosamente ao desfoque');

  // 2.4 Isolamento de nitidez dos elementos interativos (z-10 vs z-0)
  assert(
    tvHeaderContent.includes('absolute z-0 inset-x-0 top-0') &&
    tvHeaderContent.includes('relative z-10 flex items-center gap-3.5') && // Logo
    tvHeaderContent.includes('absolute z-10 left-1/2 -translate-x-1/2') && // Nav links
    tvHeaderContent.includes('relative z-10 flex items-center gap-4 sm:gap-5'), // Busca e perfil
    'Todos os elementos do header (Logo, links, busca e perfil) devem estar em camada z-10, mantendo 100% de nitidez'
  );
  console.log('✓ Teste 7: Elementos do cabeçalho (logo, links, busca, perfil) preservados em z-10 com 100% de nitidez');

  // 2.5 Resposta ao scroll do usuário
  assert(
    tvHeaderContent.includes('isScrolled ?') &&
    tvHeaderContent.includes('window.scrollY'),
    'TvHeader deve sincronizar intensidade do desfoque e degradê com a rolagem vertical do catálogo'
  );
  console.log('✓ Teste 8: Transição suave de opacidade conectada ao scroll da página');

  console.log('\nTodos os 8 testes de desfoque real e progressivo do header passaram com 100% de sucesso!\n');
}

runTvHeaderBlurTests().catch(err => {
  console.error('\n❌ Falha na auditoria de desfoque do header:', err);
  process.exit(1);
});
