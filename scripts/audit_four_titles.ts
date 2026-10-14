import { tmdbService } from '../src/core/tmdb/tmdbClient.js';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService.js';
import { providerRegistry } from '../src/core/providers/providerRegistry.js';

async function audit() {
  const titles = ['VisionQuest', 'Tyson', 'Profundezas', 'O Intruso'];
  for (const t of titles) {
    console.log('\n========================================');
    console.log('AUDITANDO:', t);
    try {
      const searchRes = await tmdbService.searchMulti(t);
      console.log('Resultados encontrados no TMDB:', searchRes.length);
      const top = searchRes[0];
      if (!top) {
        console.log('Nenhum resultado retornado no TMDB para', t);
        continue;
      }
      console.log('Top match:', top.title, `(${top.originalTitle || ''})`, 'Tipo:', top.type, 'ID:', top.id, 'TMDB:', top.tmdbId, 'IMDb:', top.imdbId);
      console.log('Ano:', top.year, 'Data lançamento:', top.releaseDate);

      // 1. Checa elegibilidade teatral
      const evalRes = await theatricalFilterService.evaluateMovie(top);
      console.log('Avaliação Teatral:', evalRes.status, 'Allowed:', evalRes.allowed, 'Motivo:', evalRes.reason);

      // 2. Checa fontes
      const typeStr = top.type === 'SERIES' ? 'series' : (top.type === 'ANIME' ? 'anime' : 'movie');
      console.log('Consultando fontes nos provedores para tipo:', typeStr, '...');
      const streams = await providerRegistry.resolveStreams(
        typeStr as any,
        { id: top.id, imdbId: top.imdbId, tmdbId: top.tmdbId, title: top.title },
        typeStr === 'series' ? { season: 1, episode: 1 } : undefined
      );
      console.log('Fontes encontradas:', streams.length);
      if (streams.length > 0) {
        streams.slice(0, 3).forEach((s, idx) => {
          console.log(` Fonte [${idx}]:`, s.name, '|', s.title, '| URL:', s.url?.slice(0, 60));
        });
      } else {
        console.log(' NENHUMA FONTE DISPONÍVEL');
      }
    } catch (err: any) {
      console.log('Erro ao auditar', t, ':', err.message);
    }
  }
}

audit().then(() => console.log('\nAuditoria concluída!'));
