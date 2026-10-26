import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runTvProfileMenuHeaderTests() {
  console.log('\n=== ZAPITV | TESTE DE INTEGRIDADE DO HEADER E MENU DE PERFIL ===\n');

  const profileMenuPath = path.resolve(process.cwd(), 'src/components/tv/TvProfileMenu.tsx');
  const headerPath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');

  assert(fs.existsSync(profileMenuPath), 'TvProfileMenu.tsx deve existir');
  assert(fs.existsSync(headerPath), 'TvHeader.tsx deve existir');

  const profileMenuCode = fs.readFileSync(profileMenuPath, 'utf8');
  const headerCode = fs.readFileSync(headerPath, 'utf8');

  // Teste 1: Remoção de bg-black/40 e adoção de overlay 100% transparente
  console.log('[Teste 1] Auditoria do Overlay do Menu de Perfil...');
  assert(
    !profileMenuCode.includes('bg-black/40'),
    'TvProfileMenu NÃO deve conter a camada escura bg-black/40 que escurecia o header'
  );
  assert(
    profileMenuCode.includes('bg-transparent'),
    'TvProfileMenu deve utilizar overlay 100% transparente (bg-transparent)'
  );
  assert(
    profileMenuCode.includes('data-testid="tv-profile-menu-overlay"'),
    'TvProfileMenu deve possuir data-testid para o overlay transparente'
  );
  console.log('✓ Teste 1 aprovado: bg-black/40 removido e overlay 100% transparente ativo.');

  // Teste 2: Isolamento do Stacking Context via createPortal
  console.log('[Teste 2] Auditoria do Portal DOM (createPortal)...');
  assert(
    profileMenuCode.includes('createPortal') &&
    profileMenuCode.includes('document.body'),
    'TvProfileMenu deve renderizar via createPortal no document.body para isolar do transform-gpu do header'
  );
  console.log('✓ Teste 2 aprovado: Menu renderizado via Portal no document.body.');

  // Teste 3: Preservação Integral do Header e Glassmorphism
  console.log('[Teste 3] Auditoria da Integridade do Header...');
  assert(
    headerCode.includes('tv-header-blur') &&
    headerCode.includes("backdropFilter: 'blur(16px)'") &&
    headerCode.includes('WebkitBackdropFilter:'),
    'TvHeader deve manter intacto o desfoque cinematográfico de 16px'
  );
  assert(
    headerCode.includes('linear-gradient(to bottom, rgba(5,7,10,0.92) 0%'),
    'TvHeader deve manter intacto o degradê cinematográfico superior'
  );
  assert(
    headerCode.includes('anchorRef={profileRef}'),
    'TvHeader deve repassar a referência do botão de perfil (profileRef) para ancoragem'
  );
  console.log('✓ Teste 3 aprovado: Glassmorphism e posicionamento do header 100% preservados.');

  // Teste 4: Preservação das Funcionalidades do Menu de Perfil
  console.log('[Teste 4] Auditoria dos Itens e Ações do Menu de Perfil...');
  assert(
    profileMenuCode.includes('focusKey="tv-menu-mylist"') &&
    profileMenuCode.includes('focusKey="tv-menu-history"') &&
    profileMenuCode.includes('focusKey="tv-menu-settings"') &&
    profileMenuCode.includes('focusKey="tv-menu-update"'),
    'TvProfileMenu deve manter todos os 4 itens com suas respectivas focusKeys'
  );
  assert(
    profileMenuCode.includes('Atualizar ZapiTV') &&
    profileMenuCode.includes('window.location.reload()'),
    'TvProfileMenu deve manter a rotina oficial de Atualizar ZapiTV'
  );
  assert(
    profileMenuCode.includes('tvNavigationManager.registerBackHandler'),
    'TvProfileMenu deve interceptar o botão VOLTAR / Back e fechar o menu'
  );
  assert(
    profileMenuCode.includes("setFocus('tv-nav-profile')"),
    'TvProfileMenu deve restaurar o foco para tv-nav-profile ao fechar'
  );
  console.log('✓ Teste 4 aprovado: Itens, atualização do app e manipulação de foco preservados.');

  // Teste 5: Isolamento de Navegação D-Pad (onArrowPress)
  console.log('[Teste 5] Auditoria de Confinamento D-Pad...');
  assert(
    profileMenuCode.includes("direction === 'left' || direction === 'right'"),
    'TvProfileMenu deve bloquear vazamento do foco para a esquerda e direita'
  );
  console.log('✓ Teste 5 aprovado: Confinamento D-pad ativo para prevenir vazamento para a Home.');

  console.log('\n========================================================================');
  console.log(' TODOS OS TESTES DE INTEGRIDADE DO HEADER E MENU DE PERFIL PASSARAM! ');
  console.log('========================================================================\n');
}

runTvProfileMenuHeaderTests().catch((err) => {
  console.error('\n❌ Falha nos testes de integridade do header:', err);
  process.exit(1);
});
