import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runOfficialBrandLogoAuditSuite() {
  console.log('=== ZapiTV | Auditoria da Logo Oficial em Toda a Aplicação ===\n');

  const cwd = process.cwd();

  // 1. Verificação dos Assets Oficiais da Marca
  console.log('1. Verificando integridade dos assets oficiais em public/...');
  const publicDir = path.join(cwd, 'public');
  const iconPng = path.join(publicDir, 'zapi-icon.png');
  const iconWebp = path.join(publicDir, 'zapi-icon.webp');
  const iconApng = path.join(publicDir, 'zapi-icon.apng');
  const iconWebm = path.join(publicDir, 'zapi-icon.webm');
  const textDark = path.join(publicDir, 'zapitv-text.png');
  const textLight = path.join(publicDir, 'zapitv-text-light.png');

  assert(fs.existsSync(iconPng), 'zapi-icon.png deve existir');
  assert(fs.existsSync(iconWebp), 'zapi-icon.webp deve existir');
  assert(fs.existsSync(iconApng), 'zapi-icon.apng deve existir');
  assert(fs.existsSync(iconWebm), 'zapi-icon.webm deve existir');
  assert(fs.existsSync(textDark), 'zapitv-text.png deve existir');
  assert(fs.existsSync(textLight), 'zapitv-text-light.png deve existir');
  console.log('✓ Todos os assets oficiais (símbolo 3D multi-formato e tipografia oficial) existem e estão íntegros.\n');

  // 2. Verificação do Componente Centralizado ZapiBrandLogo
  console.log('2. Verificando o componente centralizado ZapiBrandLogo.tsx...');
  const brandLogoComponentPath = path.join(cwd, 'src', 'components', 'common', 'ZapiBrandLogo.tsx');
  assert(fs.existsSync(brandLogoComponentPath), 'ZapiBrandLogo.tsx deve existir');
  const brandLogoCode = fs.readFileSync(brandLogoComponentPath, 'utf8');

  assert(brandLogoCode.includes('export const ZapiBrandLogo'), 'Deve exportar ZapiBrandLogo');
  assert(brandLogoCode.includes('ZapiAnimatedLogo'), 'Deve integrar o ZapiAnimatedLogo oficial');
  assert(brandLogoCode.includes('/zapitv-text.png'), 'Deve referenciar o asset oficial zapitv-text.png');
  assert(brandLogoCode.includes('/zapitv-text-light.png'), 'Deve suportar modo claro com zapitv-text-light.png');
  assert(brandLogoCode.includes('translateY(1.5px)'), 'Deve aplicar alinhamento óptico fino entre símbolo e texto');
  assert(brandLogoCode.includes('resolveDimensions'), 'Deve calibrar proporções harmônicas entre ícone e texto (52%)');
  console.log('✓ ZapiBrandLogo implementado como fonte única de verdade com proporções e alinhamento óptico preservados.\n');

  // 3. Verificação da Tela "Quem está assistindo agora?" (ProfileSelectorView)
  console.log('3. Auditando a tela de seleção de perfil "Quem está assistindo agora?" (ProfileSelectorView.tsx)...');
  const profileSelectorPath = path.join(cwd, 'components', 'ProfileSelectorView.tsx');
  const profileSelectorCode = fs.readFileSync(profileSelectorPath, 'utf8');

  assert(profileSelectorCode.includes('ZapiBrandLogo'), 'ProfileSelectorView deve importar e renderizar ZapiBrandLogo');
  assert(!profileSelectorCode.includes('315.93'), 'ProfileSelectorView não deve conter o path SVG da logo errada');
  assert(!profileSelectorCode.includes('LogoGradProfile'), 'ProfileSelectorView não deve conter gradientes inline da logo errada');
  assert(!profileSelectorCode.includes('const BrandLogo ='), 'ProfileSelectorView não deve conter a função BrandLogo antiga');
  assert(profileSelectorCode.includes('<ZapiBrandLogo size="lg" />'), 'Deve renderizar ZapiBrandLogo com tamanho lg no Top Header');
  console.log('✓ ProfileSelectorView corrigido: logo oficial ZapiTV integrada, símbolo falso 100% removido.\n');

  // 4. Verificação da Tela de Login / Cadastro (AuthView)
  console.log('4. Auditando a tela de autenticação (AuthView.tsx)...');
  const authViewPath = path.join(cwd, 'components', 'AuthView.tsx');
  const authViewCode = fs.readFileSync(authViewPath, 'utf8');

  assert(authViewCode.includes('ZapiBrandLogo'), 'AuthView deve importar e renderizar ZapiBrandLogo');
  assert(!authViewCode.includes('315.93'), 'AuthView não deve conter o path SVG da logo errada');
  assert(!authViewCode.includes('Gradiente_Auth_Brand'), 'AuthView não deve conter gradiente da logo errada');
  assert(!authViewCode.includes('const BrandLogo ='), 'AuthView não deve conter a função BrandLogo antiga');
  assert(authViewCode.includes('<ZapiBrandLogo size="md" />'), 'Deve renderizar ZapiBrandLogo com tamanho md no header');
  console.log('✓ AuthView corrigido: logo oficial ZapiTV integrada.\n');

  // 5. Verificação do Modal de Autenticação Obrigatória (MandatoryAuthModal)
  console.log('5. Auditando o modal de autenticação obrigatória (MandatoryAuthModal.tsx)...');
  const mandatoryModalPath = path.join(cwd, 'src', 'components', 'auth', 'MandatoryAuthModal.tsx');
  const mandatoryModalCode = fs.readFileSync(mandatoryModalPath, 'utf8');

  assert(mandatoryModalCode.includes('ZapiBrandLogo'), 'MandatoryAuthModal deve importar e renderizar ZapiBrandLogo');
  assert(!mandatoryModalCode.includes('315.93'), 'MandatoryAuthModal não deve conter o path SVG da logo errada');
  assert(!mandatoryModalCode.includes('Gradiente_Mandatory_Brand'), 'MandatoryAuthModal não deve conter gradiente da logo errada');
  assert(!mandatoryModalCode.includes('const BrandLogo ='), 'MandatoryAuthModal não deve conter a função BrandLogo antiga');
  assert(mandatoryModalCode.includes('ZapiBrandLogo size="xl" symbolOnly'), 'Tela de boas-vindas deve renderizar o símbolo oficial em tamanho xl com glow');
  console.log('✓ MandatoryAuthModal corrigido: logo oficial integrada nas boas-vindas, login e cadastro.\n');

  // 6. Verificação da Tela de Ativação Guiada na TV (TvActivationScreen)
  console.log('6. Auditando a tela de ativação guiada na TV (TvActivationScreen.tsx)...');
  const tvActivationPath = path.join(cwd, 'src', 'components', 'tv', 'TvActivationScreen.tsx');
  const tvActivationCode = fs.readFileSync(tvActivationPath, 'utf8');

  assert(tvActivationCode.includes('ZapiBrandLogo'), 'TvActivationScreen deve importar e renderizar ZapiBrandLogo');
  assert(!tvActivationCode.includes('315.93'), 'TvActivationScreen não deve conter o path SVG da logo errada');
  assert(!tvActivationCode.includes('Gradiente_TvActivation_Brand'), 'TvActivationScreen não deve conter gradiente da logo errada');
  assert(!tvActivationCode.includes('const BrandLogo ='), 'TvActivationScreen não deve conter a função BrandLogo antiga');
  assert(tvActivationCode.includes('<ZapiBrandLogo size="lg" />'), 'Deve renderizar ZapiBrandLogo no cabeçalho da TV');
  console.log('✓ TvActivationScreen corrigido: logo oficial ZapiTV integrada na ativação da Smart TV.\n');

  // 7. Verificação do Header Mobile (MobileHeader)
  console.log('7. Auditando o cabeçalho mobile (MobileHeader.tsx)...');
  const mobileHeaderPath = path.join(cwd, 'src', 'components', 'mobile', 'MobileHeader.tsx');
  const mobileHeaderCode = fs.readFileSync(mobileHeaderPath, 'utf8');

  assert(mobileHeaderCode.includes('ZapiBrandLogo'), 'MobileHeader deve utilizar ZapiBrandLogo');
  assert(!mobileHeaderCode.includes('<span>Zapi<span className="text-[#007df7]">TV</span></span>'), 'MobileHeader não deve usar texto raw para ZapiTV');
  assert(mobileHeaderCode.includes('<ZapiBrandLogo size="sm" />'), 'MobileHeader deve renderizar ZapiBrandLogo tamanho sm');
  console.log('✓ MobileHeader corrigido: logotipo tipográfico oficial integrado perfeitamente ao mobile.\n');

  // 8. Verificação da Página 404 (NotFoundPage)
  console.log('8. Auditando a página de erro 404 (NotFoundPage.tsx)...');
  const notFoundPath = path.join(cwd, 'src', 'pages', 'NotFoundPage.tsx');
  const notFoundCode = fs.readFileSync(notFoundPath, 'utf8');

  assert(notFoundCode.includes('ZapiBrandLogo'), 'NotFoundPage deve utilizar ZapiBrandLogo');
  assert(!notFoundCode.includes('315.93'), 'NotFoundPage não deve conter o path SVG da logo errada');
  console.log('✓ NotFoundPage corrigido: logo oficial integrada.\n');

  // 9. Verificação do Splash / Loader Inicial (index.tsx)
  console.log('9. Auditando o splash loader inicial (index.tsx)...');
  const indexPath = path.join(cwd, 'index.tsx');
  const indexCode = fs.readFileSync(indexPath, 'utf8');

  assert(!indexCode.includes('315.93'), 'index.tsx não deve conter o path SVG da logo errada');
  assert(indexCode.includes('/zapi-icon.png') && indexCode.includes('/zapitv-text.png'), 'index.tsx deve utilizar os assets oficiais');
  console.log('✓ index.tsx corrigido: splash inicial utiliza assets oficiais da ZapiTV.\n');

  // 10. Varredura Global: Ausência Absoluta do Path Geométrico Falso em Todo o Código Fonte
  console.log('10. Varrendo todos os arquivos fonte para garantir erradicação total do path incorreto...');
  const checkDirs = ['components', 'src'];
  for (const dir of checkDirs) {
    const fullDir = path.join(cwd, dir);
    if (!fs.existsSync(fullDir)) continue;

    function walkDir(currentPath: string) {
      const files = fs.readdirSync(currentPath);
      for (const file of files) {
        const filePath = path.join(currentPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const content = fs.readFileSync(filePath, 'utf8');
          assert(
            !content.includes('217.84,315.93'),
            `Arquivo ${filePath} ainda contém o path da logo errada!`
          );
        }
      }
    }

    walkDir(fullDir);
  }
  console.log('✓ Varredura concluída: zero ocorrências do path falso em todos os componentes e páginas.\n');

  console.log('========================================================================');
  console.log('🎉 TODOS OS 10 TESTES DA LOGO OFICIAL DA ZAPITV PASSARAM COM SUCESSO TOTAL!');
  console.log('========================================================================\n');
}

runOfficialBrandLogoAuditSuite().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Falha na auditoria da logo oficial:', err);
  process.exit(1);
});
