import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { uiSoundService } from '../src/core/audio/uiSoundService';

console.log('========================================================================');
console.log('⚡ SUÍTE DE TESTES: MIGRAÇÃO DOS SONS DA INTERFACE PARA O MENU DE PERFIL');
console.log('========================================================================\n');

// 1. Verificar remoção completa da Barra Lateral (Sidebar.tsx)
console.log('--- 1. Auditoria de Remoção na Barra Lateral (Sidebar.tsx) ---');
const sidebarPath = path.resolve(process.cwd(), 'components/Sidebar.tsx');
assert(fs.existsSync(sidebarPath), 'Sidebar.tsx deve existir');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

assert(!sidebarCode.includes('Sons da interface'), 'Sidebar.tsx NÃO deve conter o texto "Sons da interface"');
assert(!sidebarCode.includes('uiSoundService'), 'Sidebar.tsx NÃO deve importar nem usar uiSoundService');
assert(!sidebarCode.includes('Volume2'), 'Sidebar.tsx NÃO deve importar nem usar Volume2');
assert(!sidebarCode.includes('VolumeX'), 'Sidebar.tsx NÃO deve importar nem usar VolumeX');
assert(!sidebarCode.includes('toggleSounds'), 'Sidebar.tsx NÃO deve conter a função toggleSounds');
assert(!sidebarCode.includes('soundsEnabled'), 'Sidebar.tsx NÃO deve conter estado soundsEnabled');
console.log('  ✅ [PASS] Sidebar completamente livre de controles ou estados de som');

// 2. Verificar presença e estrutura no Menu de Perfil (Header.tsx)
console.log('\n--- 2. Auditoria da Estrutura no Menu de Perfil (Header.tsx) ---');
const headerPath = path.resolve(process.cwd(), 'components/Header.tsx');
assert(fs.existsSync(headerPath), 'Header.tsx deve existir');
const headerCode = fs.readFileSync(headerPath, 'utf8');

assert(headerCode.includes('Volume2') && headerCode.includes('VolumeX'), 'Header.tsx deve importar Volume2 e VolumeX');
assert(headerCode.includes('uiSoundService'), 'Header.tsx deve importar e usar uiSoundService');
assert(headerCode.includes('soundsEnabled'), 'Header.tsx deve controlar soundsEnabled');
assert(headerCode.includes('handleToggleSounds'), 'Header.tsx deve conter handleToggleSounds');
assert(headerCode.includes('uiSoundService.updatePreferences'), 'Header.tsx deve atualizar preferências via uiSoundService');
assert(headerCode.includes('uiSoundService.prime()'), 'Header.tsx deve chamar uiSoundService.prime() ao ativar');
console.log('  ✅ [PASS] Integração técnica com uiSoundService verificada no Header');

// 3. Verificar posicionamento estrito entre linhas divisórias
console.log('\n--- 3. Verificação de Posicionamento e Linhas Divisórias ---');
const diagIdx = headerCode.indexOf('Diagnóstico do Catálogo');
const soundIdx = headerCode.indexOf('Sons da interface');
const logoutIdx = headerCode.indexOf('Sair da Zapi');

assert(diagIdx !== -1, 'Diagnóstico do Catálogo deve existir no menu');
assert(soundIdx !== -1, 'Sons da interface deve existir no menu');
assert(logoutIdx !== -1, 'Sair da Zapi deve existir no menu');

assert(diagIdx < soundIdx, '"Diagnóstico do Catálogo" deve vir ANTES de "Sons da interface"');
assert(soundIdx < logoutIdx, '"Sons da interface" deve vir ANTES de "Sair da Zapi"');

// Trecho entre Diagnóstico e Sons
const betweenDiagAndSound = headerCode.substring(diagIdx, soundIdx);
assert(
  betweenDiagAndSound.includes('h-[1px] w-full'),
  'Deve existir uma linha divisória entre Diagnóstico e Sons da interface'
);

// Trecho entre Sons e Sair
const betweenSoundAndLogout = headerCode.substring(soundIdx, logoutIdx);
assert(
  betweenSoundAndLogout.includes('h-[1px] w-full'),
  'Deve existir uma linha divisória entre Sons da interface e Sair da Zapi'
);
console.log('  ✅ [PASS] Posicionamento e divisórias estritamente conforme especificação');

// 4. Verificar acessibilidade, layout horizontal e integridade do switch
console.log('\n--- 4. Layout, Acessibilidade e Estilo do Switch ---');
assert(headerCode.includes('role="switch"'), 'Botão deve ter role="switch" para acessibilidade');
assert(headerCode.includes('aria-checked={soundsEnabled}'), 'Botão deve ter aria-checked vinculado a soundsEnabled');
assert(headerCode.includes('bg-[#007df7]'), 'Switch ativo deve usar a cor azul #007df7');
assert(headerCode.includes('translate-x-4'), 'Switch slider deve conter animação de transição translate-x-4');
assert(headerCode.includes('transition-transform duration-200'), 'Slider deve conter transition suave');
assert(headerCode.includes('justify-between'), 'Item deve usar flex com justify-between para layout horizontal');
console.log('  ✅ [PASS] Switch, acessibilidade e alinhamento horizontal validados');

// 5. Verificar que clique em Sons NÃO fecha o menu
console.log('\n--- 5. Não Fechamento do Dropdown ao Alternar Sons ---');
// O bloco do botão de som não deve conter setShowDropdown(false)
const soundBlockMatch = headerCode.match(/role="switch"[\s\S]*?<\/button>/);
assert(soundBlockMatch, 'Bloco do botão switch deve existir');
const soundBlock = soundBlockMatch[0];
assert(
  !soundBlock.includes('setShowDropdown(false)'),
  'Clicar em Sons da interface NÃO deve invocar setShowDropdown(false)'
);
console.log('  ✅ [PASS] Dropdown permanece aberto ao alternar os sons');

// 6. Teste Funcional do Serviço de Sons (uiSoundService)
console.log('\n--- 6. Teste Funcional de Persistência e Alternância do uiSoundService ---');
const initialPrefs = uiSoundService.getPreferences();
const initialEnabled = initialPrefs.enabled;

// Simular alternância
uiSoundService.updatePreferences({ enabled: !initialEnabled });
assert.strictEqual(uiSoundService.getPreferences().enabled, !initialEnabled, 'Preferência deve alternar');

// Restaurar
uiSoundService.updatePreferences({ enabled: initialEnabled });
assert.strictEqual(uiSoundService.getPreferences().enabled, initialEnabled, 'Preferência deve ser restaurada');
console.log('  ✅ [PASS] uiSoundService persiste e altera preferências corretamente');

console.log('\n========================================================================');
console.log('📊 RESULTADO FINAL: TODOS OS TESTES PASSARAM COM SUCESSO (6/6)');
console.log('========================================================================');
