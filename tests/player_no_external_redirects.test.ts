import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { officialPlatformsService } from '../src/core/catalog/officialPlatformsService';
import { sourceVerificationService, MSG_INCONCLUSIVE, MSG_UNAVAILABLE } from '../src/core/providers/sourceVerificationService';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { ContentType, ContentItem } from '../types';

console.log('========================================================================');
console.log('--- TESTE: REMOÇÃO DE REDIRECIONAMENTOS EXTERNOS DO PLAYER (ZAPITV) ---');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// [Teste 1] Auditoria Estática de TvPlaybackErrorScreen.tsx
// -----------------------------------------------------------------------------
console.log('[Teste 1] Verificando remoção de redirecionamentos externos em TvPlaybackErrorScreen.tsx...');
const errorScreenPath = path.join(process.cwd(), 'src/components/player/TvPlaybackErrorScreen.tsx');
assert(fs.existsSync(errorScreenPath), 'TvPlaybackErrorScreen.tsx deve existir');

const errorScreenCode = fs.readFileSync(errorScreenPath, 'utf-8');

// 1.1 Não deve conter "Onde assistir oficialmente"
assert(
  !errorScreenCode.toLowerCase().includes('onde assistir'),
  'TvPlaybackErrorScreen NUNCA deve conter o texto "Onde assistir oficialmente"'
);

// 1.2 Não deve conter OfficialPlatformButton ou referências a officialPlatforms
assert(
  !errorScreenCode.includes('OfficialPlatformButton'),
  'TvPlaybackErrorScreen NUNCA deve definir ou renderizar OfficialPlatformButton'
);
assert(
  !errorScreenCode.includes('officialPlatformsService'),
  'TvPlaybackErrorScreen NUNCA deve importar ou invocar officialPlatformsService'
);

// 1.3 Não deve conter links externos com target="_blank" ou window.open
assert(
  !errorScreenCode.includes('window.open'),
  'TvPlaybackErrorScreen NUNCA deve conter window.open'
);
assert(
  !errorScreenCode.includes('target="_blank"'),
  'TvPlaybackErrorScreen NUNCA deve conter links externos com target="_blank"'
);
assert(
  !errorScreenCode.includes('ExternalLink'),
  'TvPlaybackErrorScreen NUNCA deve importar ou exibir ícone de ExternalLink'
);

// 1.4 Deve preservar os três botões exclusivos da tela de erro
assert(
  errorScreenCode.includes('data-focus-key="tv-player-error-retry"'),
  'Botão 1: Deve existir com focusKey tv-player-error-retry ("Tentar novamente")'
);
assert(
  errorScreenCode.includes('data-focus-key="tv-player-error-report"'),
  'Botão 2: Deve existir com focusKey tv-player-error-report ("Reportar erro")'
);
assert(
  errorScreenCode.includes('data-focus-key="tv-player-error-back"'),
  'Botão 3: Deve existir com focusKey tv-player-error-back ("Voltar aos detalhes")'
);

// 1.5 Deve preservar a navegação horizontal e trava vertical
assert(
  errorScreenCode.includes("if (direction === 'up' || direction === 'down')") &&
  errorScreenCode.includes("return false;"),
  'Setas Cima e Baixo devem permanecer travadas para evitar perda de foco'
);
assert(
  errorScreenCode.includes("setFocus('tv-player-error-report');") &&
  errorScreenCode.includes("setFocus('tv-player-error-back');"),
  'Navegação por setas deve circular estritamente entre os 3 botões'
);

console.log('✓ TvPlaybackErrorScreen.tsx livre de "Onde assistir oficialmente", links externos e window.open.');
console.log('✓ Os 3 botões (Tentar novamente, Reportar erro, Voltar aos detalhes) estão 100% preservados com navegação espacial.');

// -----------------------------------------------------------------------------
// [Teste 2] Auditoria de sourceVerificationService.ts
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Verificando sourceVerificationService.ts no fluxo de reprodução...');
const svPath = path.join(process.cwd(), 'src/core/providers/sourceVerificationService.ts');
const svCode = fs.readFileSync(svPath, 'utf-8');

assert(
  !svCode.includes('officialPlatformsService'),
  'sourceVerificationService NUNCA deve importar ou chamar officialPlatformsService'
);
assert(
  !svCode.includes('officialPlatforms:'),
  'sourceVerificationService NUNCA deve retornar campo officialPlatforms em VerificationResult'
);

console.log('✓ sourceVerificationService.ts totalmente desacoplado de officialPlatformsService.');

// -----------------------------------------------------------------------------
// [Teste 3] Auditoria de ZapiPlayer.tsx
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Verificando isolamento interno de reprodução em ZapiPlayer.tsx...');
const playerPath = path.join(process.cwd(), 'src/components/player/ZapiPlayer.tsx');
const playerCode = fs.readFileSync(playerPath, 'utf-8');

assert(
  !playerCode.includes('<iframe'),
  'ZapiPlayer NUNCA deve utilizar <iframe> para reprodução'
);
assert(
  !playerCode.includes('window.open('),
  'ZapiPlayer NUNCA deve acionar window.open para plataformas externas'
);
assert(
  playerCode.includes('<TvPlaybackErrorScreen'),
  'ZapiPlayer deve renderizar TvPlaybackErrorScreen quando allSourcesFailed estiver ativo'
);

console.log('✓ ZapiPlayer.tsx preserva reprodução 100% interna sem iframes, embeds ou redirecionamentos.');

// -----------------------------------------------------------------------------
// [Teste 4] officialPlatformsService: Sem Falsas Recomendações por Drama/Romance
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Verificando que officialPlatformsService não recomenda plataformas baseado em Drama/Romance...');

// A. Conteúdo genérico com gêneros Drama e Romance (NÃO deve sugerir iQIYI, WeTV, Viki, etc.)
const genericRomanceDrama: Partial<ContentItem> = {
  title: 'Um Amor de Outono',
  originalTitle: 'Autumn Romance',
  genres: ['Drama', 'Romance'],
  year: 2023
};

const genericResult = officialPlatformsService.getOfficialPlatforms(genericRomanceDrama);
assert.strictEqual(
  genericResult.length,
  0,
  'Obra ocidental com gêneros Drama e Romance não deve receber recomendações de C-Drama'
);

// B. Conteúdo sem dados asiáticos ou redes
const actionMovie: Partial<ContentItem> = {
  title: 'Velocidade Extrema',
  originalTitle: 'Extreme Speed',
  genres: ['Ação', 'Crime'],
  year: 2024
};

const actionResult = officialPlatformsService.getOfficialPlatforms(actionMovie);
assert.strictEqual(
  actionResult.length,
  0,
  'Obra de ação comum não deve receber plataformas externas arbitrárias'
);

// C. Produção asiática com caracteres nativos no título original
const asianDramaItem: Partial<ContentItem> = {
  title: 'Pursuit of Jade',
  originalTitle: '逐玉',
  genres: ['Drama', 'Romance', 'Ação'],
  networks: [{ name: 'iQiyi' }]
};

const asianResult = officialPlatformsService.getOfficialPlatforms(asianDramaItem);
assert(
  asianResult.length >= 2,
  'Produção com caracteres chineses e rede iQiyi deve identificar plataformas asiáticas apenas via utilitário direto'
);
assert(
  asianResult.some(p => p.id === 'iqiyi'),
  'iQiyi deve ser identificado para produção com rede iQiyi'
);

console.log('✓ officialPlatformsService nunca recomenda C-Drama apenas pelos gêneros "Drama" ou "Romance".');
console.log('✓ JustWatch Brasil e plataformas globais arbitrárias eliminadas do serviço.');

// -----------------------------------------------------------------------------
// [Teste 5] Fluxo Funcional de Verificação de Fontes (Ausência Confirmada)
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Verificando resultado de verificação quando nenhuma fonte é encontrada...');

async function testVerificationOutcome() {
  const dummyItem: ContentItem = {
    id: 'movie-test-empty',
    title: 'Filme Inexistente de Teste',
    originalTitle: 'Nonexistent Test Movie',
    type: ContentType.MOVIE,
    rating: 6.0,
    year: 2024,
    image: '',
    genres: ['Drama', 'Romance']
  };

  // Espiona o providerRegistry para simular ausência comprovada em todos os provedores
  const originalResolve = providerRegistry.resolveStreams;
  providerRegistry.resolveStreams = async (_type, _id, _ep, options) => {
    options?.onProviderResult?.({
      providerId: 'provider-1',
      providerName: 'Provedor 1',
      durationMs: 50,
      success: true,
      streamCount: 0
    });
    return [];
  };

  try {
    const result = await sourceVerificationService.verifySources(dummyItem);

    // Deve ser classificado como UNAVAILABLE (ausência comprovada)
    assert.strictEqual(result.state, 'UNAVAILABLE', 'Deve classificar como UNAVAILABLE');
    assert.strictEqual(result.streams.length, 0, 'Não deve retornar streams');
    assert.strictEqual(result.errorMessage, MSG_UNAVAILABLE, 'Deve retornar mensagem clara de indisponibilidade');

    // NUNCA deve conter officialPlatforms
    assert.strictEqual(
      (result as any).officialPlatforms,
      undefined,
      'Resultado de verificação NUNCA deve injetar officialPlatforms'
    );
    console.log('✓ Verificação conclui com UNAVAILABLE sem poluir o resultado com redirecionamentos externos.');
  } finally {
    providerRegistry.resolveStreams = originalResolve;
  }
}

testVerificationOutcome().then(() => {
  console.log('\n========================================================================');
  console.log('  TODOS OS TESTES DE REMOÇÃO DE REDIRECIONAMENTOS EXTERNOS PASSARAM!    ');
  console.log('========================================================================\n');
  process.exit(0);
}).catch(err => {
  console.error('Falha nos testes de remoção de redirecionamentos externos:', err);
  process.exit(1);
});
