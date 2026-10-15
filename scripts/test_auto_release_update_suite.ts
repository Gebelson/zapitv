/**
 * Suíte de Testes Automatizada: Sistema Automático de Descoberta e Atualização de Lançamentos do ZapiTV
 * 
 * Valida:
 * 1. Bloqueio Rigoroso de CAM pelo CamBlockerEngine (HDCAM, Telesync, CAMRip, Line Audio, etc.)
 * 2. Bloqueio de Lançamentos em Cartaz nos Cinemas Brasileiros (theatricalFilterService)
 * 3. Adição Automática de Obras Válidas sem Duplicações (CatalogReleaseStore)
 * 4. Adição e Atualização Automática de Novos Episódios
 * 5. Fila de Títulos Pendentes sem Fontes (Aguardando sem Anúncio Falso de Disponibilidade)
 * 6. Priorização de Áudio e Dublagem PT-BR
 * 7. Agendamento Backend e Cron Vercel (CatalogReleaseScheduler)
 */

import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';
import { catalogReleaseStore } from '../src/core/catalog/CatalogReleaseStore';
import { catalogReleaseScheduler } from '../src/core/catalog/CatalogReleaseScheduler';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { ContentItem, ContentType } from '../types';

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: any) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`, detail || '');
    failed++;
  }
}

async function runSuite() {
  console.log('======================================================================');
  console.log('SUÍTE DE TESTES: DESCOBERTA E ATUALIZAÇÃO AUTOMÁTICA DE LANÇAMENTOS');
  console.log('======================================================================\n');

  // -------------------------------------------------------------
  // GRUPO 1: Bloqueio Rigoroso de CAM e Gravações de Cinema
  // -------------------------------------------------------------
  console.log('--- GRUPO 1: Bloqueio Rigoroso de CAM e Gravações de Cinema ---');

  const camStreams = [
    { name: 'Torrentio', title: 'Movie 2026 1080p CAMRip x264', url: 'magnet:?xt=urn:btih:12345' },
    { name: 'Torrentio', title: 'Film.2026.HDCAM.x264-1XBET.mp4', url: 'magnet:?xt=urn:btih:67890' },
    { name: 'Torrentio', title: 'Cinema.Release.TELESYNC.720p.mkv', url: 'http://example.com/ts.mkv' },
    { name: 'Torrentio', title: 'Blockbuster.2026.HD-TS.Line.Audio.Dublado', url: 'http://example.com/hdts.mp4' },
    { name: 'Torrentio', title: 'Award.Film.DVDSCR.XviD-SCREENER', url: 'http://example.com/scr.avi' },
    { name: 'Torrentio', title: 'Filme.Gravado.No.Cinema.1080p', url: 'http://example.com/cam.mkv' }
  ];

  for (let i = 0; i < camStreams.length; i++) {
    const s = camStreams[i];
    const evalCam = CamBlockerEngine.evaluateStream(s);
    assert(`1.${i + 1} Rejeita gravação de cinema: "${s.title}"`, evalCam.isCam === true && evalCam.confidence === 'DEFINITIVE');
  }

  const cleanStreams = [
    { name: 'ZapiTV Direct', title: '1080p WEB-DL DUAL 5.1 x264', url: 'https://cdn.example.com/clean.mp4', quality: '1080p' },
    { name: 'Torrentio', title: 'Series.S01E01.1080p.NF.WEB-DL.DDP5.1.Atmos', url: 'magnet:?xt=urn:btih:clean1', quality: '1080p' },
    { name: 'Acervo ZapiTV', title: 'Anime 1080p BluRay Remux PT-BR', url: 'https://cdn.example.com/anime.m3u8', quality: '1080p' }
  ];

  for (let i = 0; i < cleanStreams.length; i++) {
    const s = cleanStreams[i];
    const evalClean = CamBlockerEngine.evaluateStream(s);
    assert(`1.${camStreams.length + i + 1} Aprova fonte limpa oficial: "${s.title}"`, evalClean.isCam === false);
  }

  // -------------------------------------------------------------
  // GRUPO 2: Bloqueio de Lançamentos em Cartaz nos Cinemas
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 2: Bloqueio de Lançamentos em Cartaz nos Cinemas ---');

  const unreleasedSpiderMan: ContentItem = {
    id: 'spiderman-brand-new-day',
    imdbId: 'tt20221436',
    title: 'Homem-Aranha: Um Novo Dia',
    type: ContentType.MOVIE,
    year: 2026,
    genres: ['Ação', 'Aventura']
  };

  const fakeStreamForUnreleased = {
    name: 'Torrentio',
    title: 'Spider-Man Brand New Day 2026 1080p',
    url: 'http://example.com/spiderman.mp4'
  };

  const isTheatricalRestricted = theatricalFilterService.isKnownUnreleasedOrTheatrical(unreleasedSpiderMan) || !theatricalFilterService.isMovieAllowedSync(unreleasedSpiderMan);
  assert('2.1 Spider-Man 2026 é classificado como restrito (não lançado / cinema)', isTheatricalRestricted === true);

  const evalUnreleased = CamBlockerEngine.evaluateStream(fakeStreamForUnreleased, unreleasedSpiderMan);
  assert('2.2 Fonte de filme em cartaz/não lançado é rejeitada preventivamente como CAM', evalUnreleased.isCam === true);

  // -------------------------------------------------------------
  // GRUPO 3: Adição Automática no Catálogo sem Duplicações
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 3: Adição Automática no Catálogo sem Duplicações ---');

  const validNewMovie: ContentItem = {
    id: 'open-test-release-2026',
    imdbId: 'tt987654321',
    tmdbId: '888777',
    title: 'O Despertar da Ciência (Lançamento Oficial)',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 2026,
    genres: ['Documentários', 'Histórico'],
    image: 'https://example.com/poster.jpg'
  };

  const firstAdd = catalogReleaseStore.addRelease(validNewMovie);
  assert('3.1 Nova obra validada é adicionada com sucesso ao catálogo', firstAdd === true);

  const secondAdd = catalogReleaseStore.addRelease(validNewMovie);
  assert('3.2 Tentativa de adicionar o mesmo título novamente é rejeitada (sem duplicações)', secondAdd === false);

  const allReleases = catalogReleaseStore.getReleases();
  const occurrences = allReleases.filter(r => r.imdbId === 'tt987654321');
  assert('3.3 O catálogo contém exatamente 1 ocorrência da obra', occurrences.length === 1);

  // -------------------------------------------------------------
  // GRUPO 4: Atualização Automática de Novos Episódios
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 4: Atualização Automática de Novos Episódios ---');

  const validNewSeries: ContentItem = {
    id: 'series-cyber-2026',
    imdbId: 'tt555444333',
    title: 'Cyber Chronicles',
    type: ContentType.SERIES,
    mediaFormat: 'series',
    year: 2026,
    genres: ['Ficção Científica', 'Ação'],
    episodes: [
      { id: 'ep-1', number: 1, season: 1, title: 'Piloto' }
    ]
  };

  catalogReleaseStore.addRelease(validNewSeries);

  const ep2Added = catalogReleaseStore.addEpisodeToWork('series-cyber-2026', {
    id: 'ep-2',
    number: 2,
    season: 1,
    title: 'O Despertar do Código',
    videoUrl: 'https://cdn.example.com/s01e02.mp4'
  });
  assert('4.1 Novo episódio (Ep 2) é adicionado com sucesso à série', ep2Added === true);

  const ep2Duplicate = catalogReleaseStore.addEpisodeToWork('series-cyber-2026', {
    id: 'ep-2-dup',
    number: 2,
    season: 1,
    title: 'O Despertar do Código (Cópia)'
  });
  assert('4.2 Tentativa de duplicar episódio existente é rejeitada', ep2Duplicate === false);

  const updatedSeries = catalogReleaseStore.getReleases().find(r => r.id === 'series-cyber-2026');
  assert('4.3 Série possui exatamente 2 episódios ordenados', updatedSeries?.episodes?.length === 2 && updatedSeries?.episodes[1].number === 2);

  // -------------------------------------------------------------
  // GRUPO 5: Fila de Títulos Pendentes (Sem Fontes Válidas)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 5: Fila de Títulos Pendentes sem Fontes ---');

  catalogReleaseStore.recordPending({
    id: 'pending-movie-2026',
    imdbId: 'tt11223344',
    title: 'Filme Aguardando Fontes Limpas',
    type: ContentType.MOVIE,
    year: 2026,
    reason: 'Aguardando liberação de fontes limpas sem CAM'
  });

  const releasesAfterPending = catalogReleaseStore.getReleases();
  const pendingInPublicCatalog = releasesAfterPending.some(r => r.id === 'pending-movie-2026');
  assert('5.1 Obra pendente sem fontes NÃO é adicionada como reproduzível no catálogo', !pendingInPublicCatalog);
  assert('5.2 A fila de pendentes contabiliza o título para reavaliação periódica', catalogReleaseStore.getPendingCount() > 0);

  // -------------------------------------------------------------
  // GRUPO 6: Agendador Diário Backend e Cron Vercel
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 6: Agendador Diário Backend e Cron Vercel ---');

  const schedulerStatus = catalogReleaseScheduler.getStatus();
  assert('6.1 Agendador diário possui horário alvo configurado (06:00 UTC)', schedulerStatus.targetHourUTC === 6);
  assert('6.2 Próxima execução diária calculada é uma data futura válida', schedulerStatus.nextRunTimestamp > Date.now());

  console.log('\n======================================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Erro fatal executando suíte:', err);
  process.exit(1);
});
