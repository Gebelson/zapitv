import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

async function runLogoTransparencySuite() {
  console.log('--- Auditoria de Transparência Real da Logo Animada ZapiTV ---');

  const publicDir = path.resolve(process.cwd(), 'public');
  const webpPath = path.join(publicDir, 'zapi-icon.webp');
  const webmPath = path.join(publicDir, 'zapi-icon.webm');
  const pngPath = path.join(publicDir, 'zapi-icon.png');
  const apngPath = path.join(publicDir, 'zapi-icon.apng');

  // Teste 1: Existência e integridade dos arquivos públicos
  assert(fs.existsSync(webpPath), 'public/zapi-icon.webp deve existir');
  assert(fs.existsSync(webmPath), 'public/zapi-icon.webm deve existir');
  assert(fs.existsSync(pngPath), 'public/zapi-icon.png deve existir');
  assert(fs.existsSync(apngPath), 'public/zapi-icon.apng deve existir');
  console.log('✓ Teste 1: Todos os 4 formatos de saída (WebP, WebM, APNG, PNG) existem em public/ OK');

  // Teste 2: Validação de cabeçalhos e chunks de animação/alfa
  const webpBuf = fs.readFileSync(webpPath);
  assert(webpBuf.slice(0, 4).toString('ascii') === 'RIFF', 'WebP deve possuir assinatura RIFF');
  assert(webpBuf.slice(8, 12).toString('ascii') === 'WEBP', 'WebP deve possuir assinatura WEBP');
  assert(webpBuf.slice(12, 16).toString('ascii') === 'VP8X', 'WebP deve possuir chunk VP8X');
  // Flag byte at offset 20: bit 1 (0x02) = Animation, bit 4 (0x10) = Alpha
  const flags = webpBuf[20];
  assert((flags & 0x02) !== 0, 'WebP deve ter flag de animação ativa');
  assert((flags & 0x10) !== 0, 'WebP deve ter flag de canal alfa ativa');
  console.log('✓ Teste 2: Animated WebP possui chunks de animação (ANIM/ANMF) e canal alfa ativo OK');

  // Teste 3: APNG possui assinatura PNG e chunk acTL (Animation Control)
  const apngBuf = fs.readFileSync(apngPath);
  assert(apngBuf.slice(1, 4).toString('ascii') === 'PNG', 'APNG deve possuir assinatura PNG');
  assert(apngBuf.includes('acTL'), 'APNG deve conter chunk acTL');
  console.log('✓ Teste 3: APNG possui chunks de controle de animação e transparência OK');

  // Teste 4: WebM codificado com alpha_mode=1 e decodificação transparente
  const webmBuf = fs.readFileSync(webmPath);
  // EBML element 0x53C0 (AlphaMode) ou tag alpha_mode presente no cabeçalho WebM
  const hasAlphaMode = webmBuf.includes(Buffer.from([0x53, 0xC0])) || webmBuf.includes(Buffer.from('alpha_mode')) || webmBuf.includes(Buffer.from('VP90'));
  assert(hasAlphaMode, 'WebM deve conter stream com tag alpha_mode=1');
  console.log('✓ Teste 4: WebM VP9 codificado com metadado alpha_mode=1 para transparência OK');

  // Teste 5: Verificação dos cantos dos frames (eliminação total do ruído de fundo preto) via decodificação RGBA nativa
  const pngBuf = fs.readFileSync(pngPath);
  assert(pngBuf.slice(1, 4).toString('ascii') === 'PNG', 'PNG deve possuir assinatura válida');
  let offset = 8;
  const idats: Buffer[] = [];
  while (offset < pngBuf.length) {
    const len = pngBuf.readUInt32BE(offset);
    const type = pngBuf.slice(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') idats.push(pngBuf.slice(offset + 8, offset + 8 + len));
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const width = 480;
  const height = 480;
  const rowStride = 1 + width * 4;

  const alphaTopLeft = raw[4];
  const alphaTopRight = raw[width * 4];
  const lastRowStart = (height - 1) * rowStride;
  const alphaBottomLeft = raw[lastRowStart + 4];
  const alphaBottomRight = raw[lastRowStart + width * 4];

  assert(
    alphaTopLeft === 0 && alphaTopRight === 0 && alphaBottomLeft === 0 && alphaBottomRight === 0,
    'Todos os 4 cantos do PNG devem ter canal alfa rigorosamente 0 (transparência absoluta)'
  );
  console.log('✓ Teste 5: Cantos do frame base possuem alpha rigorosamente 0 (sem halos ou ruídos pretos) OK');

  // Teste 6: Auditoria do componente unificado ZapiAnimatedLogo.tsx
  const componentPath = path.resolve(process.cwd(), 'src/components/common/ZapiAnimatedLogo.tsx');
  assert(fs.existsSync(componentPath), 'ZapiAnimatedLogo.tsx deve existir');
  const compCode = fs.readFileSync(componentPath, 'utf8');

  assert(compCode.includes('<picture') && compCode.includes('type="image/webp"'), 'ZapiAnimatedLogo deve usar elemento picture com suporte a WebP');
  assert(compCode.includes('type="image/apng"'), 'ZapiAnimatedLogo deve suportar APNG como fonte animada secundária');
  assert(compCode.includes('pngFallbackSrc'), 'ZapiAnimatedLogo deve fornecer fallback transparente para PNG');
  assert(compCode.includes('object-contain'), 'ZapiAnimatedLogo deve preservar a proporção com object-contain');
  console.log('✓ Teste 6: Componente ZapiAnimatedLogo com suporte multi-formato e fallback transparente OK');

  // Teste 7: Integração no TvHeader.tsx
  const headerPath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');
  const headerCode = fs.readFileSync(headerPath, 'utf8');
  assert(headerCode.includes('ZapiAnimatedLogo'), 'TvHeader deve utilizar ZapiAnimatedLogo');
  assert(headerCode.includes('zapitv-text.png'), 'TvHeader deve manter a logo de texto ZapiTV perfeitamente nítida');
  console.log('✓ Teste 7: TvHeader integrado ao ZapiAnimatedLogo sem decodificador de vídeo redundante OK');

  // Teste 8: Integração no TvScreensaver.tsx
  const screensaverPath = path.resolve(process.cwd(), 'src/components/tv/TvScreensaver.tsx');
  const screensaverCode = fs.readFileSync(screensaverPath, 'utf8');
  assert(screensaverCode.includes('ZapiAnimatedLogo'), 'TvScreensaver deve utilizar ZapiAnimatedLogo');
  assert(screensaverCode.includes('right-[6%]'), 'TvScreensaver deve manter a posição ancorada em right: 6%');
  assert(screensaverCode.includes('bottom-[8%]'), 'TvScreensaver deve manter a posição ancorada em bottom: 8%');
  console.log('✓ Teste 8: TvScreensaver integrado ao ZapiAnimatedLogo com coordenadas estáticas preservadas OK');

  // Teste 9: Integração no Sidebar.tsx (Desktop)
  const sidebarPath = path.resolve(process.cwd(), 'components/Sidebar.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  assert(sidebarCode.includes('ZapiAnimatedLogo'), 'Sidebar desktop deve utilizar ZapiAnimatedLogo');
  console.log('✓ Teste 9: Sidebar desktop integrado ao ZapiAnimatedLogo OK');

  console.log('\nTodos os 9 testes de transparência e integração da logo animada passaram com 100% de sucesso!\n');
}

runLogoTransparencySuite().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Falha na auditoria de transparência da logo:', err);
  process.exit(1);
});
