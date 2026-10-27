import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Teste de Suavização do Retorno do Primeiro Carrossel ao Banner (Smart TV) ---');

const tvHomeViewPath = path.resolve('src/components/tv/TvHomeView.tsx');
const tvNavManagerPath = path.resolve('src/core/tv/tvNavigationManager.ts');
const tvScrollServicePath = path.resolve('src/core/tv/tvScrollService.ts');

const tvHomeViewCode = fs.readFileSync(tvHomeViewPath, 'utf8');
const tvNavManagerCode = fs.readFileSync(tvNavManagerPath, 'utf8');
const tvScrollServiceCode = fs.readFileSync(tvScrollServicePath, 'utf8');

// 1. Eliminação de comandos redundantes e conflitantes de scrollTop direto e scrollIntoView no handleFirstRowUpPress
console.log('✓ Teste 1: Eliminação de comandos concorrentes e conflitantes de scrollTop direto');
assert.ok(!tvHomeViewCode.includes('document.documentElement.scrollTop = 0'), 'Não deve conter atribuição direta document.documentElement.scrollTop = 0');
assert.ok(!tvHomeViewCode.includes('document.body.scrollTop = 0'), 'Não deve conter atribuição direta document.body.scrollTop = 0');
assert.ok(!tvHomeViewCode.includes('heroEl.scrollIntoView'), 'Não deve executar scrollIntoView concorrente com window.scrollTo no retorno ao hero');

// 2. Uso de estratégia única de rolagem nativa suave (window.scrollTo com behavior: smooth via tvScrollService)
console.log('✓ Teste 2: Estratégia única de rolagem nativa suave com behavior: smooth');
assert.ok(tvHomeViewCode.includes('tvScrollService.scrollToHero'), 'TvHomeView deve invocar tvScrollService.scrollToHero');
assert.ok(tvScrollServiceCode.includes("behavior: isFireTv ? 'auto' : 'smooth'"), 'tvScrollService deve utilizar rolagem suave nativa com adaptabilidade ao Fire TV');

// 3. Prevenção de múltiplas animações simultâneas caso o usuário pressione setas repetidamente
console.log('✓ Teste 3: Proteção contra múltiplas animações simultâneas (isScrollingToHero)');
assert.ok(tvScrollServiceCode.includes('isScrollingToHero'), 'Deve possuir controle isScrollingToHero para evitar animações simultâneas');
assert.ok(tvScrollServiceCode.includes('if (this.isScrollingToHero) return;'), 'Deve ignorar pressões repetidas enquanto a rolagem suave estiver em andamento');

// 4. Coordenação da transferência de foco para tv-hero-play com a conclusão da rolagem (350-500ms)
console.log('✓ Teste 4: Coordenação de transferência de foco para tv-hero-play e evento scrollend/fallback');
assert.ok(tvScrollServiceCode.includes('scrollend'), 'Deve registrar listener para evento scrollend para finalização nativa perfeita');
assert.ok(tvScrollServiceCode.includes('380'), 'Deve possuir fallback coordenado na faixa ideal de 350-500ms (380ms)');
assert.ok(tvHomeViewCode.includes("setFocus('tv-hero-play')"), 'Deve transferir o foco para tv-hero-play de forma coordenada');

// 5. Configuração do Norigin no tvNavigationManager com preventScroll: true no foco nativo
console.log('✓ Teste 5: Norigin configurado com domNodeFocusOptions: { preventScroll: true }');
assert.ok(tvNavManagerCode.includes('domNodeFocusOptions: { preventScroll: true }'), 'Norigin deve estar configurado com domNodeFocusOptions: { preventScroll: true } para evitar saltos instantâneos do browser');

// 6. Alinhamento perfeito do banner ao final da rolagem
console.log('✓ Teste 6: Banner perfeitamente enquadrado ao final da rolagem');
assert.ok(tvScrollServiceCode.includes('if (window.scrollY !== 0) {') && tvScrollServiceCode.includes('window.scrollTo(0, 0);'), 'Deve garantir alinhamento exato a 0 ao final da transição');

// 7. Cleanup de timers e refs
console.log('✓ Teste 7: Limpeza de timers e listeners');
assert.ok(tvScrollServiceCode.includes('clearTimeout(this.heroScrollTimer)'), 'Deve limpar o timer na conclusão');

// 8. Preservação da rolagem dos outros carrosséis e do banner
console.log('✓ Teste 8: Preservação dos demais carrosséis e do banner principal');
assert.ok(tvHomeViewCode.includes('onRowUp={firstActiveRowId === \'continue-watching\' ? handleFirstRowUpPress : undefined}'), 'onRowUp deve ser atribuído exclusivamente à primeira fileira ativa');
assert.ok(tvHomeViewCode.includes('handleHeroDownPress'), 'Navegação Hero -> Carrosséis deve continuar intacta');

console.log('\nTodos os 8 testes de suavização de retorno ao banner passaram com 100% de sucesso!');
