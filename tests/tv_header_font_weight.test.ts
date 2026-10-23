import assert from 'assert';
import fs from 'fs';
import path from 'path';

/**
 * Teste de Validação Estrita do Peso da Fonte dos Links do Header da Smart TV
 *
 * Requisitos:
 * 1. Os 5 links de navegação (Início, Filmes, Séries, Animes, Em Destaque) devem usar exclusivamente font-medium (font-weight: 500).
 * 2. font-bold e font-extrabold devem ser totalmente removidos de todos os estados (normal, focado e ativo).
 * 3. Tamanho da fonte text-[20px] lg:text-[23px] mantido.
 * 4. Nenhuma outra propriedade (cores, espaçamento, efeitos de foco, navegação) modificada.
 */
async function runTests() {
  console.log('\n========================================================================');
  console.log('--- TESTE DO PESO DA FONTE DOS LINKS DO HEADER (ZAPITV) ---');
  console.log('========================================================================\n');

  const tvHeaderPath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');
  assert(fs.existsSync(tvHeaderPath), 'TvHeader.tsx deve existir');
  const tvHeaderCode = fs.readFileSync(tvHeaderPath, 'utf8');

  // Cenário 1: Presença dos 5 links de navegação
  console.log('--- Cenário 1: Presença dos 5 links de navegação mapeados ---');
  assert(
    tvHeaderCode.includes('label="Início"') &&
    tvHeaderCode.includes('label="Filmes"') &&
    tvHeaderCode.includes('label="Séries"') &&
    tvHeaderCode.includes('label="Animes"') &&
    tvHeaderCode.includes('label="Em Destaque"'),
    'TvHeader deve renderizar os 5 links com TvNavTabButton'
  );
  console.log('✓ Cenário 1: 5 links de navegação confirmados OK');

  // Cenário 2: TvNavTabButton possui font-medium na estilização base
  console.log('\n--- Cenário 2: font-medium (font-weight: 500) na classe base de TvNavTabButton ---');
  assert(
    tvHeaderCode.includes('font-medium tracking-wide'),
    'TvNavTabButton deve utilizar font-medium (font-weight: 500)'
  );
  console.log('✓ Cenário 2: font-medium presente na classe base OK');

  // Cenário 3: Remoção completa de font-bold em TvNavTabButton
  console.log('\n--- Cenário 3: Remoção completa de font-bold nos links do header ---');
  const navTabButtonDef = tvHeaderCode.substring(
    tvHeaderCode.indexOf('const TvNavTabButton: React.FC'),
    tvHeaderCode.indexOf('export const TvHeader: React.FC')
  );
  assert(
    !navTabButtonDef.includes('font-bold'),
    'TvNavTabButton NÃO deve conter font-bold em nenhum estado'
  );
  console.log('✓ Cenário 3: font-bold totalmente ausente de TvNavTabButton OK');

  // Cenário 4: Remoção completa de font-extrabold em TvNavTabButton (inclusive no estado isActive)
  console.log('\n--- Cenário 4: Remoção completa de font-extrabold no estado isActive ---');
  assert(
    !navTabButtonDef.includes('font-extrabold'),
    'TvNavTabButton NÃO deve conter font-extrabold no estado ativo (isActive)'
  );
  assert(
    navTabButtonDef.includes("isActive\r\n          ? 'text-white drop-shadow'") ||
    navTabButtonDef.includes("isActive\n          ? 'text-white drop-shadow'"),
    'Estado isActive deve aplicar text-white drop-shadow preservando font-medium'
  );
  console.log('✓ Cenário 4: font-extrabold totalmente ausente de TvNavTabButton OK');

  // Cenário 5: Estado focado preserva font-medium
  console.log('\n--- Cenário 5: Estado focado preserva font-medium ---');
  assert(
    navTabButtonDef.includes("focused\r\n          ? 'text-cyan-300 scale-105 drop-shadow-[0_0_14px_rgba(0,229,255,0.7)]'") ||
    navTabButtonDef.includes("focused\n          ? 'text-cyan-300 scale-105 drop-shadow-[0_0_14px_rgba(0,229,255,0.7)]'"),
    'Estado focused deve aplicar cor cyan e drop-shadow sem sobrescrever o font-weight 500'
  );
  console.log('✓ Cenário 5: Estado focado preserva font-medium sem forçar peso diferente OK');

  // Cenário 6: Tamanho da fonte preservado intacto
  console.log('\n--- Cenário 6: Tamanho da fonte text-[20px] lg:text-[23px] preservado ---');
  assert(
    navTabButtonDef.includes('text-[20px] lg:text-[23px]'),
    'TvNavTabButton deve preservar exatamente a escala tipográfica proporcional text-[20px] lg:text-[23px]'
  );
  console.log('✓ Cenário 6: Escala tipográfica mantida inalterada OK');

  console.log('\n========================================================================');
  console.log('TODOS OS CENÁRIOS DO PESO DA FONTE DO HEADER PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Falha no teste de peso da fonte do header:', err);
  process.exit(1);
});
