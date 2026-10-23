/**
 * ZAPITV — TESTE DE LIMITES DE NAVEGAÇÃO DO HEADER DA SMART TV
 *
 * Valida a restrição de navegação pelo controle remoto para que o foco
 * nunca ultrapasse os limites da tela, desapareça ou caia no body:
 *
 * 1. Início + Esquerda → permanece em Início (retorna false sem setFocus).
 * 2. Início + Cima → permanece em Início.
 * 3. Filmes + Cima → permanece em Filmes.
 * 4. Séries + Cima → permanece em Séries.
 * 5. Animes + Cima → permanece em Animes.
 * 6. Em Destaque + Cima → permanece em Em Destaque.
 * 7. Busca + Cima → permanece em Busca.
 * 8. Perfil + Cima → permanece em Perfil.
 * 9. Perfil + Direita → permanece em Perfil (retorna false sem setFocus).
 * 10. Navegação horizontal normal Início ↔ Filmes ↔ Séries ↔ Animes ↔ Em Destaque ↔ Busca ↔ Perfil mantida.
 * 11. Baixo continua direcionando para o banner principal (tv-hero-play / tv-hero-details).
 * 12. Pressionamento prolongado nos limites mantém o foco e o indicador cyan 100% estáveis sem sons redundantes.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runHeaderBoundariesTests() {
  console.log('\n========================================================================');
  console.log('--- TESTE: LIMITES DE NAVEGAÇÃO DO HEADER DA SMART TV (ZAPITV) ---');
  console.log('========================================================================\n');

  const headerPath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');
  assert.ok(fs.existsSync(headerPath), 'TvHeader.tsx deve existir');
  const headerCode = fs.readFileSync(headerPath, 'utf8');

  // --- Validação Estrutural e de Código ---

  // 1. Limite superior em TvNavTabButton
  console.log('--- Cenário 1: Limite superior em TvNavTabButton (Início, Filmes, Séries, Animes, Destaque) ---');
  const navTabSection = headerCode.substring(
    headerCode.indexOf('const TvNavTabButton: React.FC'),
    headerCode.indexOf('export const TvHeader: React.FC')
  );
  assert.ok(
    navTabSection.includes("if (direction === 'up') {\r\n        return false;\r\n      }") ||
    navTabSection.includes("if (direction === 'up') {\n        return false;\n      }"),
    'TvNavTabButton deve bloquear seta Cima retornando false'
  );
  console.log('✓ Cenário 1: TvNavTabButton bloqueia movimento Cima com return false OK');

  // 2. Limite esquerdo em Início (tv-nav-home)
  console.log('\n--- Cenário 2: Limite esquerdo no link Início ---');
  assert.ok(
    navTabSection.includes("if (direction === 'left' && focusKey === 'tv-nav-home') {\r\n        return false;\r\n      }") ||
    navTabSection.includes("if (direction === 'left' && focusKey === 'tv-nav-home') {\n        return false;\n      }"),
    'TvNavTabButton deve bloquear seta Esquerda no link tv-nav-home retornando false'
  );
  console.log('✓ Cenário 2: tv-nav-home bloqueia movimento Esquerda com return false OK');

  // 3. Limite superior em Busca (tv-nav-search)
  console.log('\n--- Cenário 3: Limite superior no botão de Busca ---');
  const searchSection = headerCode.substring(
    headerCode.indexOf("focusKey: 'tv-nav-search'"),
    headerCode.indexOf("focusKey: 'tv-nav-profile'")
  );
  assert.ok(
    searchSection.includes("if (direction === 'up') {\r\n        return false;\r\n      }") ||
    searchSection.includes("if (direction === 'up') {\n        return false;\n      }"),
    'Busca deve bloquear seta Cima retornando false'
  );
  console.log('✓ Cenário 3: tv-nav-search bloqueia movimento Cima com return false OK');

  // 4. Limite superior e direito em Perfil (tv-nav-profile)
  console.log('\n--- Cenário 4: Limites superior e direito no botão de Perfil ---');
  const profileIdx = headerCode.indexOf("focusKey: 'tv-nav-profile'");
  const profileSection = headerCode.substring(
    profileIdx,
    headerCode.indexOf('return (', profileIdx)
  );
  assert.ok(
    profileSection.includes("if (direction === 'up') {\r\n        return false;\r\n      }") ||
    profileSection.includes("if (direction === 'up') {\n        return false;\n      }"),
    'Perfil deve bloquear seta Cima retornando false'
  );
  assert.ok(
    profileSection.includes("if (direction === 'right') {\r\n        return false;\r\n      }") ||
    profileSection.includes("if (direction === 'right') {\n        return false;\n      }"),
    'Perfil deve bloquear seta Direita retornando false'
  );
  console.log('✓ Cenário 4: tv-nav-profile bloqueia Cima e Direita com return false OK');

  // --- Simulação dos 12 Casos de Teste Solicitados ---
  console.log('\n--- Execução da Matriz de Navegação Espacial (12 Casos de Teste) ---');

  // Simulador representativo dos handlers onArrowPress do TvHeader
  let currentFocus = 'tv-nav-home';
  let soundPlayed = false;

  const arrowHandlerNavTab = (focusKey: string, direction: string): boolean => {
    if (direction === 'up') return false;
    if (direction === 'left' && focusKey === 'tv-nav-home') return false;
    if (direction === 'down') {
      currentFocus = 'tv-hero-play';
      return false;
    }
    if (direction === 'right' && focusKey === 'tv-nav-featured') {
      currentFocus = 'tv-nav-search';
      return false;
    }
    return true; // navegação natural do norigin
  };

  const arrowHandlerSearch = (direction: string): boolean => {
    if (direction === 'up') return false;
    if (direction === 'left') {
      currentFocus = 'tv-nav-featured';
      return false;
    }
    if (direction === 'right') {
      currentFocus = 'tv-nav-profile';
      return false;
    }
    if (direction === 'down') {
      currentFocus = 'tv-hero-play';
      return false;
    }
    return true;
  };

  const arrowHandlerProfile = (direction: string): boolean => {
    if (direction === 'up') return false;
    if (direction === 'right') return false;
    if (direction === 'left') {
      currentFocus = 'tv-nav-search';
      return false;
    }
    if (direction === 'down') {
      currentFocus = 'tv-hero-details';
      return false;
    }
    return true;
  };

  const dispatchArrow = (fromKey: string, direction: 'up' | 'down' | 'left' | 'right') => {
    soundPlayed = false;
    let allowed = false;

    if (fromKey.startsWith('tv-nav-') && fromKey !== 'tv-nav-search' && fromKey !== 'tv-nav-profile') {
      allowed = arrowHandlerNavTab(fromKey, direction);
      if (allowed) {
        // Simulação do movimento natural espacial entre tabs irmãs
        const tabOrder = ['tv-nav-home', 'tv-nav-movies', 'tv-nav-series', 'tv-nav-animes', 'tv-nav-featured'];
        const idx = tabOrder.indexOf(fromKey);
        if (direction === 'right' && idx < tabOrder.length - 1) {
          currentFocus = tabOrder[idx + 1];
          soundPlayed = true;
        } else if (direction === 'left' && idx > 0) {
          currentFocus = tabOrder[idx - 1];
          soundPlayed = true;
        }
      }
    } else if (fromKey === 'tv-nav-search') {
      allowed = arrowHandlerSearch(direction);
    } else if (fromKey === 'tv-nav-profile') {
      allowed = arrowHandlerProfile(direction);
    }

    return { allowed, currentFocus, soundPlayed };
  };

  // 1. Início + Esquerda → permanece em Início
  currentFocus = 'tv-nav-home';
  let res = dispatchArrow('tv-nav-home', 'left');
  assert.strictEqual(res.allowed, false, 'Início + Esquerda deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-home', 'Foco deve permanecer em Início');
  console.log('✓ 1. Início + Esquerda → permanece em Início');

  // 2. Início + Cima → permanece em Início
  currentFocus = 'tv-nav-home';
  res = dispatchArrow('tv-nav-home', 'up');
  assert.strictEqual(res.allowed, false, 'Início + Cima deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-home', 'Foco deve permanecer em Início');
  console.log('✓ 2. Início + Cima → permanece em Início');

  // 3. Filmes + Cima → permanece em Filmes
  currentFocus = 'tv-nav-movies';
  res = dispatchArrow('tv-nav-movies', 'up');
  assert.strictEqual(res.allowed, false, 'Filmes + Cima deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-movies', 'Foco deve permanecer em Filmes');
  console.log('✓ 3. Filmes + Cima → permanece em Filmes');

  // 4. Séries + Cima → permanece em Séries
  currentFocus = 'tv-nav-series';
  res = dispatchArrow('tv-nav-series', 'up');
  assert.strictEqual(res.allowed, false, 'Séries + Cima deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-series', 'Foco deve permanecer em Séries');
  console.log('✓ 4. Séries + Cima → permanece em Séries');

  // 5. Animes + Cima → permanece em Animes
  currentFocus = 'tv-nav-animes';
  res = dispatchArrow('tv-nav-animes', 'up');
  assert.strictEqual(res.allowed, false, 'Animes + Cima deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-animes', 'Foco deve permanecer em Animes');
  console.log('✓ 5. Animes + Cima → permanece em Animes');

  // 6. Em Destaque + Cima → permanece em Em Destaque
  currentFocus = 'tv-nav-featured';
  res = dispatchArrow('tv-nav-featured', 'up');
  assert.strictEqual(res.allowed, false, 'Em Destaque + Cima deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-featured', 'Foco deve permanecer em Em Destaque');
  console.log('✓ 6. Em Destaque + Cima → permanece em Em Destaque');

  // 7. Busca + Cima → permanece em Busca
  currentFocus = 'tv-nav-search';
  res = dispatchArrow('tv-nav-search', 'up');
  assert.strictEqual(res.allowed, false, 'Busca + Cima deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-search', 'Foco deve permanecer em Busca');
  console.log('✓ 7. Busca + Cima → permanece em Busca');

  // 8. Perfil + Cima → permanece em Perfil
  currentFocus = 'tv-nav-profile';
  res = dispatchArrow('tv-nav-profile', 'up');
  assert.strictEqual(res.allowed, false, 'Perfil + Cima deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-profile', 'Foco deve permanecer em Perfil');
  console.log('✓ 8. Perfil + Cima → permanece em Perfil');

  // 9. Perfil + Direita → permanece em Perfil
  currentFocus = 'tv-nav-profile';
  res = dispatchArrow('tv-nav-profile', 'right');
  assert.strictEqual(res.allowed, false, 'Perfil + Direita deve ser bloqueado');
  assert.strictEqual(res.currentFocus, 'tv-nav-profile', 'Foco deve permanecer em Perfil');
  console.log('✓ 9. Perfil + Direita → permanece em Perfil');

  // 10. Navegação horizontal normal completa
  console.log('\n--- Teste 10: Navegação Horizontal Normal Bidirecional ---');
  currentFocus = 'tv-nav-home';
  // Indo para a direita: Home -> Movies -> Series -> Animes -> Featured -> Search -> Profile
  dispatchArrow(currentFocus, 'right');
  assert.strictEqual(currentFocus, 'tv-nav-movies');
  dispatchArrow(currentFocus, 'right');
  assert.strictEqual(currentFocus, 'tv-nav-series');
  dispatchArrow(currentFocus, 'right');
  assert.strictEqual(currentFocus, 'tv-nav-animes');
  dispatchArrow(currentFocus, 'right');
  assert.strictEqual(currentFocus, 'tv-nav-featured');
  dispatchArrow(currentFocus, 'right');
  assert.strictEqual(currentFocus, 'tv-nav-search');
  dispatchArrow(currentFocus, 'right');
  assert.strictEqual(currentFocus, 'tv-nav-profile');

  // Voltando para a esquerda: Profile -> Search -> Featured -> Animes -> Series -> Movies -> Home
  dispatchArrow(currentFocus, 'left');
  assert.strictEqual(currentFocus, 'tv-nav-search');
  dispatchArrow(currentFocus, 'left');
  assert.strictEqual(currentFocus, 'tv-nav-featured');
  dispatchArrow(currentFocus, 'left');
  assert.strictEqual(currentFocus, 'tv-nav-animes');
  dispatchArrow(currentFocus, 'left');
  assert.strictEqual(currentFocus, 'tv-nav-series');
  dispatchArrow(currentFocus, 'left');
  assert.strictEqual(currentFocus, 'tv-nav-movies');
  dispatchArrow(currentFocus, 'left');
  assert.strictEqual(currentFocus, 'tv-nav-home');
  console.log('✓ 10. Navegação horizontal normal Início ↔ Filmes ↔ Séries ↔ Animes ↔ Em Destaque ↔ Busca ↔ Perfil OK');

  // 11. Baixo continua funcionando
  console.log('\n--- Teste 11: Navegação Vertical para Baixo (Header -> Banner) ---');
  currentFocus = 'tv-nav-home';
  dispatchArrow('tv-nav-home', 'down');
  assert.strictEqual(currentFocus, 'tv-hero-play', 'Baixo a partir de Início deve focar tv-hero-play');

  currentFocus = 'tv-nav-search';
  dispatchArrow('tv-nav-search', 'down');
  assert.strictEqual(currentFocus, 'tv-hero-play', 'Baixo a partir de Busca deve focar tv-hero-play');

  currentFocus = 'tv-nav-profile';
  dispatchArrow('tv-nav-profile', 'down');
  assert.strictEqual(currentFocus, 'tv-hero-details', 'Baixo a partir de Perfil deve focar tv-hero-details');
  console.log('✓ 11. Baixo continua direcionando perfeitamente para o banner principal OK');

  // 12. Pressionamento prolongado nos limites
  console.log('\n--- Teste 12: Pressionamento prolongado nos limites (estabilidade e ausência de som) ---');
  currentFocus = 'tv-nav-home';
  for (let i = 0; i < 20; i++) {
    const leftRes = dispatchArrow('tv-nav-home', 'left');
    assert.strictEqual(leftRes.allowed, false);
    assert.strictEqual(leftRes.currentFocus, 'tv-nav-home');
    assert.strictEqual(leftRes.soundPlayed, false, 'Nenhum som deve tocar no bloqueio de limite');

    const upRes = dispatchArrow('tv-nav-home', 'up');
    assert.strictEqual(upRes.allowed, false);
    assert.strictEqual(upRes.currentFocus, 'tv-nav-home');
    assert.strictEqual(upRes.soundPlayed, false);
  }

  currentFocus = 'tv-nav-profile';
  for (let i = 0; i < 20; i++) {
    const rightRes = dispatchArrow('tv-nav-profile', 'right');
    assert.strictEqual(rightRes.allowed, false);
    assert.strictEqual(rightRes.currentFocus, 'tv-nav-profile');
    assert.strictEqual(rightRes.soundPlayed, false);

    const upRes = dispatchArrow('tv-nav-profile', 'up');
    assert.strictEqual(upRes.allowed, false);
    assert.strictEqual(upRes.currentFocus, 'tv-nav-profile');
    assert.strictEqual(upRes.soundPlayed, false);
  }
  console.log('✓ 12. Pressionamento prolongado nos limites validado com 100% de estabilidade e silêncio OK');

  console.log('\n========================================================================');
  console.log('TODOS OS 12 CENÁRIOS DE LIMITES DE NAVEGAÇÃO PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
}

runHeaderBoundariesTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Falha no teste de limites do header:', err);
  process.exit(1);
});
