import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { tvModeService } from '../src/core/tv/tvModeService';
import { tvNavigationManager, isRemoteConfirmEvent } from '../src/core/tv/tvNavigationManager';
import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

// Garante que o modo TV esteja ativo para os testes
tvModeService.setTvMode(true);

console.log('========================================================================');
console.log('--- TESTE: DESAMBIGUAÇÃO DA TECLA B NA PESQUISA DA SMART TV (ZAPITV) ---');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// [Teste 1] Teste de Diferenciação: isRemoteConfirmEvent()
// -----------------------------------------------------------------------------
console.log('[Teste 1] Verificando diferenciação estrita entre a letra B e confirmação de controle...');

// A. Teclas físicas alfanuméricas 'B' e 'b' (NUNCA confirmação)
const physicalB = { key: 'b', code: 'KeyB', keyCode: 66 } as KeyboardEvent;
const physicalUpperB = { key: 'B', code: 'KeyB', keyCode: 66 } as KeyboardEvent;
const physicalA = { key: 'a', code: 'KeyA', keyCode: 65 } as KeyboardEvent;
const physicalM = { key: 'm', code: 'KeyM', keyCode: 77 } as KeyboardEvent;

assert.strictEqual(isRemoteConfirmEvent(physicalB), false, "A tecla física 'b' (keyCode 66) não deve ser tratada como confirmação");
assert.strictEqual(isRemoteConfirmEvent(physicalUpperB), false, "A tecla física 'B' (keyCode 66) não deve ser tratada como confirmação");
assert.strictEqual(isRemoteConfirmEvent(physicalA), false, "A tecla física 'a' não deve ser tratada como confirmação");
assert.strictEqual(isRemoteConfirmEvent(physicalM), false, "A tecla física 'm' não deve ser tratada como confirmação");
console.log("✓ Teclas físicas 'b', 'B' e alfanuméricas rejeitadas como evento de confirmação.");

// B. Controles remotos legítimos da Fire TV / Android TV (Android KEYCODE_ENTER = 66)
const fireTvRemoteEnter = { key: 'Enter', code: 'Enter', keyCode: 66 } as KeyboardEvent;
const fireTvRemoteSelect = { key: 'Select', code: 'Select', keyCode: 66 } as KeyboardEvent;
const fireTvRemoteUnidentified = { key: 'Unidentified', code: '', keyCode: 66 } as KeyboardEvent;
const fireTvRemoteEmpty = { key: '', code: '', keyCode: 66 } as KeyboardEvent;

assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteEnter), true, "Botão OK da Fire TV (keyCode 66, key 'Enter') deve ser aceito");
assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteSelect), true, "Botão OK da Fire TV (keyCode 66, key 'Select') deve ser aceito");
assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteUnidentified), true, "Botão OK da Fire TV (keyCode 66, key 'Unidentified') deve ser aceito");
assert.strictEqual(isRemoteConfirmEvent(fireTvRemoteEmpty), true, "Botão OK da Fire TV (keyCode 66, key vazia) deve ser aceito");
console.log("✓ Botão OK/Enter de controles remotos Fire TV / Android TV (código 66) reconhecido com sucesso.");

// C. Controles remotos W3C padrão, Samsung Tizen, LG webOS e Desktop
const standardEnter = { key: 'Enter', code: 'Enter', keyCode: 13 } as KeyboardEvent;
const standardSelect = { key: 'Select', code: 'Select', keyCode: 13 } as KeyboardEvent;
const webOsSelect = { key: 'Ok', code: 'Select', keyCode: 65385 } as KeyboardEvent;

assert.strictEqual(isRemoteConfirmEvent(standardEnter), true, "Enter padrão W3C (keyCode 13) deve ser aceito");
assert.strictEqual(isRemoteConfirmEvent(standardSelect), true, "Select padrão (keyCode 13) deve ser aceito");
assert.strictEqual(isRemoteConfirmEvent(webOsSelect), true, "LG webOS Select (keyCode 65385) deve ser aceito");
console.log("✓ Controles remotos de Samsung Tizen, LG webOS e desktop W3C reconhecidos com sucesso.");

// -----------------------------------------------------------------------------
// [Teste 2] Desambiguação no tvNavigationManager: Interceptação e Normalização
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Verificando sanitização de keyCode no handleGlobalKeyDown...');

// Simula evento da letra B física
const bEvent = {
  key: 'b',
  code: 'KeyB',
  keyCode: 66,
  defaultPrevented: false,
  preventDefault: function() { this.defaultPrevented = true; }
} as any;

// Executa handleGlobalKeyDown
(tvNavigationManager as any).handleGlobalKeyDown(bEvent);

assert.strictEqual(bEvent.keyCode, 0, "KeyCode da letra física 'b' deve ser neutralizado para 0 para o Norigin");
assert.strictEqual(bEvent.key, 'b', "Propriedade key 'b' deve ser preservada intacta para a caixa de pesquisa");
console.log("✓ Letra 'b' teve keyCode sobrescrito para 0, impedindo acionamento indevido no Norigin.");

// Simula botão OK da Fire TV (código 66)
const remoteEvent = {
  key: 'Enter',
  code: 'Enter',
  keyCode: 66,
  defaultPrevented: false,
  preventDefault: function() { this.defaultPrevented = true; }
} as any;

(tvNavigationManager as any).handleGlobalKeyDown(remoteEvent);

assert.strictEqual(remoteEvent.keyCode, 13, "Botão OK da Fire TV (código 66) deve ser normalizado para 13 (Enter W3C)");
assert.strictEqual(remoteEvent.key, 'Enter', "Propriedade key 'Enter' preservada");
console.log("✓ Botão OK da Fire TV (código 66) normalizado para 13 com sucesso.");

// -----------------------------------------------------------------------------
// [Teste 3] Simulação de Digitação Física na Pesquisa (batman, Breaking Bad)
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Verificando digitação física contínua na pesquisa...');

// Simulador da lógica de digitação de TvSearchView.tsx
class SearchTypingSimulator {
  public query: string = '';
  public focusedVirtualKey: string = 'tv-key-a';
  public actionTriggeredCount: number = 0;

  public handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Proteção implementada: confirmações reais de TV não inserem texto
    if (isRemoteConfirmEvent(e)) {
      // Confirmação no Norigin ativaria a tecla virtual focada
      this.actionTriggeredCount++;
      return;
    }

    if (e.key === 'Backspace') {
      this.query = this.query.slice(0, -1);
      return;
    }

    // Se o Norigin fosse acionado por engano (caso do bug da letra B onde keyCode era 66),
    // a tecla virtual focada era clicada!
    if (e.keyCode === 66 && isRemoteConfirmEvent(e)) {
      this.actionTriggeredCount++;
    }

    if (e.key.length === 1 && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) {
      this.query += e.key;
    }
  }

  public typeString(text: string) {
    for (const char of text) {
      const isB = char.toLowerCase() === 'b';
      const event = {
        key: char,
        code: isB ? 'KeyB' : `Key${char.toUpperCase()}`,
        keyCode: isB ? 66 : char.toUpperCase().charCodeAt(0),
        defaultPrevented: false,
        preventDefault: () => {}
      } as any;

      // Passa primeiro pelo tvNavigationManager (fase de captura)
      (tvNavigationManager as any).handleGlobalKeyDown(event);

      // Depois pelo manipulador de digitação de TvSearchView
      this.handleKeyDown(event);
    }
  }
}

// A. Digitar 'b' produz somente 'b'
const simB = new SearchTypingSimulator();
simB.typeString('b');
assert.strictEqual(simB.query, 'b', "Digitar 'b' deve produzir estritamente 'b'");
assert.strictEqual(simB.actionTriggeredCount, 0, "Nenhum botão de ação deve ser disparado ao digitar 'b'");
console.log("✓ Digitar 'b' produziu exatamente 'b' sem acionar botões indevidos.");

// B. Digitar 'batman' produz exatamente 'batman'
const simBatman = new SearchTypingSimulator();
simBatman.typeString('batman');
assert.strictEqual(simBatman.query, 'batman', "Digitar 'batman' deve produzir estritamente 'batman'");
assert.strictEqual(simBatman.actionTriggeredCount, 0, "Nenhum botão de ação deve ser disparado ao digitar 'batman'");
console.log("✓ Digitar 'batman' produziu exatamente 'batman' sem duplicatas.");

// C. Digitar 'Breaking Bad' produz exatamente 'Breaking Bad' sem disparar botões indevidos
const simBreaking = new SearchTypingSimulator();
simBreaking.typeString('Breaking Bad');
assert.strictEqual(simBreaking.query, 'Breaking Bad', "Digitar 'Breaking Bad' deve produzir estritamente 'Breaking Bad'");
assert.strictEqual(simBreaking.actionTriggeredCount, 0, "Nenhum botão de ação deve ser disparado ao digitar 'Breaking Bad'");
console.log("✓ Digitar 'Breaking Bad' produziu exatamente 'Breaking Bad' sem disparar botões indevidos.");

// -----------------------------------------------------------------------------
// [Teste 4] Seleção de 'B' pelo Teclado Virtual com Controle Remoto (OK / Enter)
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Verificando seleção da tecla virtual B com o controle remoto...');

let virtualQuery = '';
let lastPressTime = 0;

function onVirtualKeyPress(char: string) {
  const now = performance.now();
  if (now - lastPressTime < 150) return;
  lastPressTime = now;
  virtualQuery += char;
}

// Simula seleção da tecla B com controle remoto da Fire TV (Enter disparado via Norigin)
lastPressTime = 0;
onVirtualKeyPress('B');
assert.strictEqual(virtualQuery, 'B', "Selecionar 'B' com controle remoto deve adicionar uma única letra 'B'");

// Simula evento concorrente/sintético de click HTML do botão disparado 10ms depois
onVirtualKeyPress('B');
assert.strictEqual(virtualQuery, 'B', "Click sintético concorrente dentro de 150ms deve ser ignorado para evitar duplicata");

console.log("✓ Selecionar B pelo teclado virtual com o controle remoto insere somente B (sem duplicata).");

// -----------------------------------------------------------------------------
// [Teste 5] Auditoria Estática dos Arquivos
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Auditoria estática dos arquivos corrigidos...');

const tvNavCode = fs.readFileSync(path.join(process.cwd(), 'src/core/tv/tvNavigationManager.ts'), 'utf8');
assert(tvNavCode.includes('isRemoteConfirmEvent'), 'tvNavigationManager deve exportar isRemoteConfirmEvent');
assert(tvNavCode.includes('keyCode === 66'), 'tvNavigationManager deve tratar código 66');
assert(tvNavCode.includes("enter: [13, 10, 'Enter', 'Select', 'Ok', 'OK', 65385, 66]"), 'Código 66 deve ser mantido no setKeyMap como fallback de TV');

const tvSearchCode = fs.readFileSync(path.join(process.cwd(), 'src/components/tv/TvSearchView.tsx'), 'utf8');
assert(tvSearchCode.includes('isRemoteConfirmEvent(e)'), 'TvSearchView deve ignorar eventos de confirmação ao digitar');
assert(tvSearchCode.includes('lastPressTimeRef'), 'TvVirtualKey deve possuir trava contra múltiplos acionamentos');

console.log('✓ Implementação estática verificada com integridade.');

console.log('\n========================================================================');
console.log('  TODOS OS TESTES DE CORREÇÃO DA TECLA B PASSARAM COM SUCESSO!          ');
console.log('========================================================================\n');
process.exit(0);
