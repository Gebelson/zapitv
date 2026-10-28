import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { audioPreferenceService } from '../src/core/audio/audioPreferenceService';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';
import { ContentType, ContentItem } from '../types';

interface InvestigationResult {
  title: string;
  expectedIdentity: string;
  tmdbId?: string | number;
  imdbId?: string;
  type: string;
  year?: number;
  episode?: { season: number; episode: number };
  resolvedItem?: ContentItem;
  streamsFound: number;
  validStreams: number;
  sampleSources: Array<{
    name: string;
    title: string;
    isMatch: boolean;
    reasons: string[];
    isPtBr: boolean;
    isDubbed: boolean;
    tier: string;
    badge: string;
    lang: string;
    transport: string;
  }>;
  audioOptions: Array<{ label: string; langCode: string; badge?: string; isCurrent: boolean }>;
  evidence: string;
  status: string;
  pending: string;
}

const titlesToInvestigate = [
  { title: 'Sussurros do Coração', query: 'Whisper of the Heart', year: 1995, kind: 'movie' as const },
  { title: 'Lupin', query: 'Lupin', year: 2021, kind: 'series' as const, episode: { season: 1, episode: 1 } },
  { title: 'Jimihen!!', query: 'Jimihen!!', year: 2021, kind: 'anime' as const, episode: { season: 1, episode: 1 } },
  { title: 'Chicago Typewriter', query: 'Chicago Typewriter', year: 2017, kind: 'series' as const, episode: { season: 1, episode: 1 } },
  { title: 'Hope: O Primeiro Impacto', query: 'Hope: O Primeiro Impacto', year: 2026, kind: 'movie' as const },
  { title: 'Resident Evil', query: 'Resident Evil', year: 2002, kind: 'movie' as const },
  { title: 'Sword Art Online', query: 'Sword Art Online', year: 2012, kind: 'anime' as const, episode: { season: 1, episode: 1 }, tmdbId: '45782' },
  { title: 'Bleach: Thousand-Year Blood War', query: 'Bleach: Thousand-Year Blood War', year: 2022, kind: 'anime' as const, episode: { season: 1, episode: 1 }, tmdbId: '214995' }
];

async function main() {
  console.log('=== INVESTIGAÇÃO P1.3B: HOMOLOGAÇÃO REAL DOS 8 TÍTULOS ===\n');
  const results: InvestigationResult[] = [];

  for (const target of titlesToInvestigate) {
    console.log(`Investigando: "${target.title}" (${target.kind}${target.episode ? ` S${target.episode.season}E${target.episode.episode}` : ''})...`);
    try {
      const searchRes = await tmdbService.searchMulti(target.query);
      const match = searchRes.find(it => {
        if (target.tmdbId && String(it.tmdbId) === String(target.tmdbId)) return true;
        if (target.year && Math.abs((it.year || 0) - target.year) <= 1) return true;
        return false;
      }) || searchRes[0];

      if (!match) {
        console.log(`  -> Nenhum item encontrado no TMDB para "${target.title}"`);
        results.push({
          title: target.title,
          expectedIdentity: `${target.title} (${target.year || 'N/A'})`,
          type: target.kind,
          streamsFound: 0,
          validStreams: 0,
          sampleSources: [],
          audioOptions: [],
          evidence: 'Item não localizado nos indexadores de catálogo primários',
          status: 'Fonte incorreta ou indisponível',
          pending: 'Cadastramento de metadados'
        });
        continue;
      }

      const identity = canonicalIdentityService.buildIdentity(match, target.episode);
      console.log(`  -> Identidade Canônica: "${identity.title}" | TMDB: ${identity.tmdbId} | IMDb: ${identity.imdbId} | Ano: ${identity.year} | Tipo: ${identity.type}`);

      let streams: any[] = [];
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        streams = await providerRegistry.resolveStreams(target.kind, match, target.episode, {
          signal: controller.signal
        });
        clearTimeout(timeout);
      } catch (err) {
        console.log(`  -> Timeout ou erro ao consultar provedores para "${target.title}":`, (err as Error).message);
      }

      console.log(`  -> Fontes brutas retornadas: ${streams.length}`);

      const sampleSources: InvestigationResult['sampleSources'] = [];
      let validCount = 0;

      for (const s of streams) {
        const evalRes = sourceConfidenceEngine.evaluate(s, identity);
        if (evalRes.isMatch) validCount++;

        const analysis = audioPreferenceService.analyzeAudio(s);
        const lang = audioSelectionManager.inspectStreamAudioLanguage(s, match.originalLanguage || 'en');

        sampleSources.push({
          name: s.name || s.addonId || 'Desconhecido',
          title: (s.title || s.name || '').slice(0, 100).replace(/\n/g, ' '),
          isMatch: evalRes.isMatch,
          reasons: evalRes.reasons,
          isPtBr: analysis.isPtBr,
          isDubbed: analysis.isDubbed,
          tier: analysis.tier,
          badge: analysis.isDubbed ? '🔊' : (analysis.hasPtSubtitle ? '💬' : '🌐'),
          lang,
          transport: s.infoHash ? 'torrent' : (s.url ? 'http/hls' : 'outro')
        });
      }

      const audioOptions = audioSelectionManager.buildAudioOptions({
        item: match,
        streams: streams.filter(s => sourceConfidenceEngine.evaluate(s, identity).isMatch),
        activeStream: streams.find(s => sourceConfidenceEngine.evaluate(s, identity).isMatch)
      });

      console.log(`  -> Fontes válidas aceitas por identidade: ${validCount}/${streams.length}`);
      console.log(`  -> Opções de áudio geradas: ${audioOptions.map(o => `${o.label} [${o.langCode}] (${o.badge || 'N/A'}${o.isCurrent ? ' *ATIVA*' : ''})`).join(' | ') || 'Nenhuma'}`);

      results.push({
        title: target.title,
        expectedIdentity: `${target.title} (${identity.year || target.year}) - ${target.kind.toUpperCase()}${target.episode ? ` S${target.episode.season}E${target.episode.episode}` : ''}`,
        tmdbId: identity.tmdbId,
        imdbId: identity.imdbId,
        type: identity.type,
        year: identity.year,
        episode: target.episode,
        resolvedItem: match,
        streamsFound: streams.length,
        validStreams: validCount,
        sampleSources: sampleSources.slice(0, 5),
        audioOptions: audioOptions.map(o => ({ label: o.label, langCode: o.langCode, badge: o.badge, isCurrent: Boolean(o.isCurrent) })),
        evidence: `Metadados TMDb (${identity.tmdbId || 'N/A'}) e IMDb (${identity.imdbId || 'N/A'}) confirmados. ${validCount} fontes aprovadas pelo motor de identidade de ${streams.length} candidatas.`,
        status: validCount > 0 ? 'Identidade de metadados confirmada' : (streams.length > 0 ? 'Fonte incorreta ou indisponível' : 'Fonte indisponível'),
        pending: validCount > 0 ? 'Reprodução não verificada (inspeção de áudio supervisionada)' : 'Provedores sem fonte válida'
      });
    } catch (e) {
      console.error(`Erro ao investigar ${target.title}:`, e);
    }
    console.log('');
  }

  console.log('=== RESUMO DA INVESTIGAÇÃO ===');
  console.log(JSON.stringify(results.map(r => ({
    title: r.title,
    identity: r.expectedIdentity,
    tmdbId: r.tmdbId,
    imdbId: r.imdbId,
    validStreams: `${r.validStreams}/${r.streamsFound}`,
    audioOptions: r.audioOptions,
    status: r.status
  })), null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
