import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('=== ZapiTV | Validação do Botão Grupo Circular no Mobile ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const modalPath = path.join(projectRoot, 'components', 'ContentDetailModal.tsx');
const modalContent = fs.readFileSync(modalPath, 'utf8');

// 1. Extração do bloco do Botão Grupo
console.log('1. Localizando botão Grupo em ContentDetailModal.tsx...');
const groupButtonMatch = modalContent.match(
  /<DetailModalTvButton[\s\S]*?focusKey="modal-group"[\s\S]*?<\/DetailModalTvButton>/
);

assert(groupButtonMatch, 'O botão com focusKey="modal-group" deve existir no ContentDetailModal');
const groupButtonCode = groupButtonMatch[0];
console.log('  -> Botão Grupo localizado com sucesso.');

// 2. Remoção do texto "Grupo" na visualização Mobile e Preservação no Desktop
console.log('\n2. Verificando responsividade do texto "Grupo"...');
assert(
  groupButtonCode.includes('<span className="hidden sm:inline">Grupo</span>'),
  'O texto "Grupo" deve possuir className="hidden sm:inline" (oculto no mobile e visível a partir de sm:)'
);
console.log('  -> Texto oculto no mobile e preservado no desktop.');

// 3. Geometria Circular Perfeita (44x44px, rounded-full, aspect-square)
console.log('\n3. Verificando formato circular perfeito e área de toque de 44x44px...');
assert(
  groupButtonCode.includes('w-11 h-11'),
  'No mobile, o botão deve ter largura e altura w-11 h-11 (44px x 44px)'
);
assert(
  groupButtonCode.includes('aspect-square'),
  'O botão deve ter aspect-square para garantir proporção 1:1 sem deformações'
);
assert(
  groupButtonCode.includes('rounded-full'),
  'No mobile, o botão deve utilizar rounded-full para círculo perfeito'
);
assert(
  groupButtonCode.includes('sm:rounded-2xl'),
  'No desktop, o botão deve restaurar sm:rounded-2xl'
);
assert(
  groupButtonCode.includes('sm:w-auto sm:h-12'),
  'No desktop, o botão deve restaurar sm:w-auto sm:h-12'
);
console.log('  -> Botão circular 44x44px no mobile e cápsula no desktop validados.');

// 4. Centralização do Ícone e Remoção de Padding de Texto
console.log('\n4. Verificando centralização e eliminação do padding de texto no mobile...');
assert(
  groupButtonCode.includes('flex items-center justify-center'),
  'O botão deve ter flex items-center justify-center'
);
assert(
  groupButtonCode.includes('p-0 sm:px-5'),
  'No mobile deve usar p-0 (eliminando o padding horizontal do texto) e no desktop sm:px-5'
);
assert(
  groupButtonCode.includes('gap-0 sm:gap-2'),
  'No mobile gap-0 e no desktop sm:gap-2'
);
console.log('  -> Centralização e eliminação de padding validados com sucesso.');

// 5. Preservação de Efeitos Visuais (Gradiente, Borda, Blur, Sombra)
console.log('\n5. Verificando efeitos visuais existentes...');
assert(
  groupButtonCode.includes('bg-gradient-to-r from-cyan-600/20 to-[#007df7]/20'),
  'Gradiente azul-escuro/ciano original deve ser mantido'
);
assert(
  groupButtonCode.includes('border border-cyan-500/30 hover:border-cyan-400'),
  'Bordas ciano/azul devem ser mantidas'
);
assert(
  groupButtonCode.includes('backdrop-blur-sm'),
  'Efeito backdrop-blur-sm deve ser mantido'
);
assert(
  groupButtonCode.includes('shadow-lg shadow-cyan-500/10'),
  'Sombra ciano deve ser mantida'
);
console.log('  -> Fundo translúcido, gradiente, borda e sombras preservados.');

// 6. Preservação do Ícone de Pessoas
console.log('\n6. Verificando dimensões e propriedades do ícone Users...');
assert(
  groupButtonCode.includes('<Users className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />'),
  'O ícone Users deve manter exatamente as classes originais com shrink-0 e tamanhos w-4 h-4 / sm:w-5 sm:h-5'
);
console.log('  -> Ícone Users preservado integralmente.');

// 7. Prevenção de Deformações e Encolhimento
console.log('\n7. Verificando prevenção de deformação (shrink-0, box-border)...');
assert(
  groupButtonCode.includes('shrink-0'),
  'O botão deve ter shrink-0 para não ser deformado em contêineres flex'
);
assert(
  groupButtonCode.includes('box-border'),
  'O botão deve ter box-border para manter medidas exatas'
);
console.log('  -> Botão protegido contra deformações e encolhimento.');

// 8. Preservação de Acessibilidade e Funcionalidade
console.log('\n8. Verificando acessibilidade e ação do botão...');
assert(
  groupButtonCode.includes('ariaLabel="Grupo"'),
  'Deve preservar ariaLabel="Grupo" para leitores de tela e testes'
);
assert(
  groupButtonCode.includes('setShowWatchPartyModal(true)'),
  'Ação de abrir o WatchPartyModal deve ser preservada intacta'
);
console.log('  -> Acessibilidade e ação preservadas com sucesso.');

// 9. Não modificação da versão TV
console.log('\n9. Verificando isolamento da versão Smart TV...');
const tvModalPath = path.join(projectRoot, 'src', 'components', 'tv', 'TvDetailsModal.tsx');
const tvModalContent = fs.readFileSync(tvModalPath, 'utf8');
assert.strictEqual(
  tvModalContent.includes('modal-group'),
  false,
  'A versão TV (TvDetailsModal.tsx) não deve ser modificada nem conter o botão Grupo'
);
console.log('  -> Versão Smart TV permanece intacta.');

console.log('\n=== TODOS OS TESTES DO BOTÃO GRUPO CIRCULAR PASSARAM COM SUCESSO! ===');
