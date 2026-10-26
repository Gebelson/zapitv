import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';

async function runProfileMenuTests() {
  console.log('\n=== ZAPITV | TESTES P0: REDUÇÃO DO MENU DE PERFIL EXCLUSIVAMENTE NO FIRE TV ===\n');

  // 1. Auditoria Estática dos Fontes
  console.log('--- 1. Auditoria de Código de TvProfileMenu.tsx ---');
  const profileMenuPath = path.resolve(process.cwd(), 'src/components/tv/TvProfileMenu.tsx');
  assert(fs.existsSync(profileMenuPath), 'TvProfileMenu.tsx deve existir');
  const code = fs.readFileSync(profileMenuPath, 'utf8');

  // Validação: chamada de tvPerformanceService.getDeviceFamily()
  assert(
    code.includes('tvPerformanceService.getDeviceFamily()'),
    'TvProfileMenu deve invocar tvPerformanceService.getDeviceFamily() para diferenciar dispositivos'
  );

  // Validação: não usar apenas viewport.scaleCategory === compact
  assert(
    code.includes('isFireTv') && (code.includes("deviceFamily === 'firetv'") || code.includes("getProfileMenuConfig")),
    'TvProfileMenu deve condicionar as reduções especificamente para Fire TV'
  );

  // Validação: preservação de todas as opções
  assert(code.includes('tv-menu-mylist'), 'Opção Minha Lista deve existir');
  assert(code.includes('tv-menu-history'), 'Opção Histórico deve existir');
  assert(code.includes('tv-menu-settings'), 'Opção Configurações deve existir');
  assert(code.includes('tv-menu-update'), 'Opção Atualizar ZapiTV deve existir');

  // Validação: overlay transparente mantido
  assert(!code.includes('bg-black/40'), 'Overlay escuro não pode existir');
  assert(code.includes('bg-transparent'), 'Overlay deve ser 100% transparente');

  console.log('✓ Auditoria estática aprovada: tvPerformanceService.getDeviceFamily() e regras de Fire TV implementadas.');

  // 2. Detecção de Plataforma por User-Agent e Isolamento
  console.log('\n--- 2. Detecção de Dispositivos e Isolamento ---');
  const fireTvUas = [
    'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; AFTKM Build/PS7652) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 9; Silk/120.3.1 like Chrome/120.0.6099.144) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Safari/537.36 AmazonWebAppPlatform/3.0.0',
    'MediaStationX/0.1.155 (Android; AFTMM; Fire OS 6.2.8.0)'
  ];

  for (const ua of fireTvUas) {
    const family = tvPerformanceService.getDeviceFamily(ua);
    assert.strictEqual(family, 'firetv', `UA Fire TV deve retornar 'firetv': ${ua}`);
  }
  console.log('✓ Todos os identificadores Fire TV (Silk, AFTMM, AFTKM, MSX on Fire OS) detectados como "firetv".');

  const nonFireTvUas = [
    { ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36', expected: 'samsung' },
    { ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/108.0.0.0 TV Safari/537.36', expected: 'samsung' },
    { ua: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager', expected: 'generic' },
    { ua: 'MediaStationX/0.1.155 (LG; webOS.TV-2022; OLED55C2)', expected: 'msx' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', expected: 'generic' }
  ];

  for (const item of nonFireTvUas) {
    const family = tvPerformanceService.getDeviceFamily(item.ua);
    assert.strictEqual(family, item.expected, `UA de Smart TV concorrente não pode ser detectado como 'firetv': ${item.ua}`);
  }
  console.log('✓ Isolamento confirmado: Samsung Tizen, LG webOS, MSX padrão e Desktop NÃO são identificados como Fire TV.');

  console.log('\n========================================================================');
  console.log(' TESTES UNITÁRIOS DE REDUÇÃO DO MENU DE PERFIL FIRE TV APROVADOS! ');
  console.log('========================================================================\n');
}

runProfileMenuTests().catch((err) => {
  console.error('\n❌ Erro durante testes unitários:', err);
  process.exit(1);
});
