import { OfficialChannelProvider } from '../src/core/livetv/OfficialChannelProvider';
import { liveStreamValidator } from '../src/core/livetv/LiveStreamValidator';
import { channelNormalizer } from '../src/core/livetv/ChannelNormalizer';
import { channelSourceResolver } from '../src/core/livetv/ChannelSourceResolver';
import { LiveChannel, RawChannelInput } from '../src/core/livetv/types';

interface ChannelAuditResult {
  id: string;
  name: string;
  category: string;
  isOfficial: boolean;
  requiresExternalAccess: boolean;
  streamUrl: string;
  maskedUrl: string;
  format: string;
  httpStatus?: number;
  contentType?: string;
  manifestOk: boolean;
  hasAudioVideoTracks: boolean;
  hasLiveSlidingWindow: boolean;
  firstSegmentAccessible: boolean;
  actualStatus: string;
  errorReason?: string;
  playbackClassification: 
    | 'Reprodução real aprovada'
    | 'Fonte acessível, mas reprodução não comprovada'
    | 'Fonte indisponível'
    | 'Não testável no ambiente disponível';
  pending: string;
}

function maskUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.hostname}/***`;
  } catch {
    return '[url-indisponivel]';
  }
}

async function auditChannel(raw: RawChannelInput): Promise<ChannelAuditResult> {
  const isExternal = Boolean(raw.requiresExternalAccess);
  const streamUrl = raw.url || '';
  const masked = maskUrl(streamUrl);

  if (isExternal) {
    return {
      id: raw.id,
      name: raw.name,
      category: raw.category || 'aberta',
      isOfficial: Boolean(raw.isOfficial),
      requiresExternalAccess: true,
      streamUrl: '',
      maskedUrl: 'Acesso Oficial Externo (requiresExternalAccess)',
      format: 'Portal Oficial / Assinatura',
      manifestOk: false,
      hasAudioVideoTracks: false,
      hasLiveSlidingWindow: false,
      firstSegmentAccessible: false,
      actualStatus: 'EXTERNAL_ACCESS',
      playbackClassification: 'Não testável no ambiente disponível',
      pending: 'Exige autenticação/assinatura em portal oficial externo'
    };
  }

  if (!streamUrl) {
    return {
      id: raw.id,
      name: raw.name,
      category: raw.category || 'aberta',
      isOfficial: Boolean(raw.isOfficial),
      requiresExternalAccess: false,
      streamUrl: '',
      maskedUrl: '[sem-url]',
      format: 'Desconhecido',
      manifestOk: false,
      hasAudioVideoTracks: false,
      hasLiveSlidingWindow: false,
      firstSegmentAccessible: false,
      actualStatus: 'UNAVAILABLE',
      playbackClassification: 'Fonte indisponível',
      pending: 'Nenhum endereço de transmissão configurado'
    };
  }

  // Testa o manifesto HLS / DASH com timeout controlado
  let httpStatus = 0;
  let contentType = '';
  let manifestText = '';
  let manifestOk = false;
  let hasAudioVideo = false;
  let hasLiveSliding = false;
  let firstSegOk = false;
  let errorReason = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(streamUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZapiTV-LiveAudit/2.0'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    httpStatus = res.status;
    contentType = res.headers.get('content-type') || '';

    if (res.ok) {
      manifestText = await res.text();
      // Valida se é manifesto HLS (#EXTM3U)
      if (manifestText.includes('#EXTM3U')) {
        manifestOk = true;

        // Verifica se há variantes com resoluções / codecs de vídeo e áudio
        const hasStreamInf = manifestText.includes('#EXT-X-STREAM-INF');
        const hasMedia = manifestText.includes('#EXT-X-MEDIA');
        const hasSegments = manifestText.includes('#EXTINF');
        hasAudioVideo = hasStreamInf || (hasSegments && (manifestText.includes('.ts') || manifestText.includes('.m4s') || manifestText.includes('.mp4')));

        // Verifica janela deslizante ao vivo (ausência de #EXT-X-ENDLIST)
        hasLiveSliding = !manifestText.includes('#EXT-X-ENDLIST');

        const finalMasterUrl = res.url || streamUrl;

        // Se for Master Playlist com variantes, tenta buscar a primeira sub-playlist
        let subPlaylistUrl = '';
        if (hasStreamInf) {
          const lines = manifestText.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF') && i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              if (nextLine && !nextLine.startsWith('#')) {
                subPlaylistUrl = nextLine.startsWith('http') 
                  ? nextLine 
                  : new URL(nextLine, finalMasterUrl).toString();
                break;
              }
            }
          }
        }

        // Testa o primeiro segmento de mídia da sub-playlist ou da playlist direta
        let segUrl = '';

        if (subPlaylistUrl) {
          try {
            const subCtrl = new AbortController();
            const subTimeout = setTimeout(() => subCtrl.abort(), 5000);
            const subRes = await fetch(subPlaylistUrl, { signal: subCtrl.signal });
            clearTimeout(subTimeout);
            if (subRes.ok) {
              const finalSubUrl = subRes.url || subPlaylistUrl;
              const subText = await subRes.text();
              const lines = subText.split('\n');
              for (const l of lines) {
                const cleanL = l.trim();
                if (cleanL && !cleanL.startsWith('#')) {
                  segUrl = cleanL.startsWith('http') ? cleanL : new URL(cleanL, finalSubUrl).toString();
                  break;
                }
              }
            }
          } catch {}
        } else {
          const lines = manifestText.split('\n');
          for (const l of lines) {
            const cleanL = l.trim();
            if (cleanL && !cleanL.startsWith('#')) {
              segUrl = cleanL.startsWith('http') ? cleanL : new URL(cleanL, finalMasterUrl).toString();
              break;
            }
          }
        }

        if (segUrl) {
          try {
            const segCtrl = new AbortController();
            const segTimeout = setTimeout(() => segCtrl.abort(), 6000);
            const segRes = await fetch(segUrl, {
              headers: { Range: 'bytes=0-10240' },
              signal: segCtrl.signal
            });
            clearTimeout(segTimeout);
            if (segRes.ok || segRes.status === 206) {
              firstSegOk = true;
            } else {
              errorReason = `Segmento retornou HTTP ${segRes.status}`;
            }
          } catch (e: any) {
            errorReason = `Falha ao baixar segmento: ${e.message}`;
          }
        } else {
          errorReason = 'Nenhum segmento de mídia encontrado na playlist';
        }
      } else {
        errorReason = 'Resposta HTTP 200 não é um manifesto HLS (#EXTM3U)';
      }
    } else {
      errorReason = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err: any) {
    errorReason = err.message || 'Erro de conexão/timeout';
  }

  let classification: ChannelAuditResult['playbackClassification'];
  let actualStatus = 'UNAVAILABLE';
  let pending = '';

  if (manifestOk && firstSegOk) {
    classification = 'Reprodução real aprovada';
    actualStatus = 'AVAILABLE';
    pending = 'Nenhuma (reprodução de manifesto e segmentos de mídia confirmados)';
  } else if (manifestOk && !firstSegOk) {
    classification = 'Fonte acessível, mas reprodução não comprovada';
    actualStatus = 'UNSTABLE';
    pending = `Manifesto acessível, mas segmentos falharam (${errorReason})`;
  } else {
    classification = 'Fonte indisponível';
    actualStatus = 'UNAVAILABLE';
    pending = errorReason;
  }

  return {
    id: raw.id,
    name: raw.name,
    category: raw.category || 'aberta',
    isOfficial: Boolean(raw.isOfficial),
    requiresExternalAccess: false,
    streamUrl,
    maskedUrl: masked,
    format: 'HLS (.m3u8)',
    httpStatus,
    contentType,
    manifestOk,
    hasAudioVideoTracks: hasAudioVideo,
    hasLiveSlidingWindow: hasLiveSliding,
    firstSegmentAccessible: firstSegOk,
    actualStatus,
    errorReason: errorReason || undefined,
    playbackClassification: classification,
    pending
  };
}

async function main() {
  console.log('=== AUDITORIA REAL DE TODOS OS CANAIS AO VIVO CONFIGURADOS ===\n');
  const officialRaw = OfficialChannelProvider.getOfficialChannels();
  console.log(`Total de canais cadastrados: ${officialRaw.length}\n`);

  const results: ChannelAuditResult[] = [];

  const concurrency = 6;
  const executing: Promise<void>[] = [];
  let index = 0;

  async function worker() {
    while (index < officialRaw.length) {
      const currentIndex = index++;
      const raw = officialRaw[currentIndex];
      const res = await auditChannel(raw);
      console.log(`[${currentIndex + 1}/${officialRaw.length}] "${raw.name}" => ${res.playbackClassification} (${res.actualStatus})`);
      results[currentIndex] = res;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log('\n=== RESUMO CONSOLIDADO ===');
  const approved = results.filter(r => r.playbackClassification === 'Reprodução real aprovada');
  const accessibleOnly = results.filter(r => r.playbackClassification === 'Fonte acessível, mas reprodução não comprovada');
  const unavailable = results.filter(r => r.playbackClassification === 'Fonte indisponível');
  const notTestable = results.filter(r => r.playbackClassification === 'Não testável no ambiente disponível');

  console.log(`- Reprodução real aprovada: ${approved.length}`);
  console.log(`- Fonte acessível, mas reprodução não comprovada: ${accessibleOnly.length}`);
  console.log(`- Fonte indisponível: ${unavailable.length}`);
  console.log(`- Não testável no ambiente disponível (requer acesso oficial externo): ${notTestable.length}`);

  // Grava relatório JSON
  const fs = await import('fs');
  fs.writeFileSync('tests/audit_livetv_report.json', JSON.stringify(results, null, 2));
  console.log('\nRelatório gravado em tests/audit_livetv_report.json');
}

main().catch(console.error);
