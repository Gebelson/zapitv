import { describe, it, expect } from 'vitest';
import { streamValidator } from '../src/core/providers/streamValidator';
import { streamQuarantineService } from '../src/core/security/streamQuarantineService';
import { sourceVerificationService } from '../src/core/providers/sourceVerificationService';
import { episodeAvailabilityService } from '../src/core/episodes/episodeAvailabilityService';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';

describe('Regressão de Disponibilidade de Séries (Westworld e A Leste do Éden)', () => {
  it('Não deve quarentenar nem banir releases do grupo Ben The Men como trote ou pornografia', () => {
    const btmStream = {
      name: 'Torrentio',
      title: 'East.Of.Eden.S01E01.2160p.WEB-DL.DV.HDR.MULTi[Ben The Men].mp4',
      url: 'http://127.0.0.1:11470/82c7f54546557fbb173106ff36722506c5fb555b/0',
      infoHash: '82c7f54546557fbb173106ff36722506c5fb555b'
    };

    const quarantineCheck = streamQuarantineService.evaluateQuarantine(btmStream, 'East of Eden');
    expect(quarantineCheck.isQuarantined).toBe(false);

    const isMatch = streamValidator.isStreamMatchingTargetTitle(btmStream, 'East of Eden', 'East of Eden');
    expect(isMatch).toBe(true);
  });

  it('Deve aceitar títulos bilíngues e normalizar diacríticos (A Leste do Éden vs East of Eden)', () => {
    const fenixStream = {
      name: 'FenixFlix',
      title: '🐦‍🔥 A Leste do Éden ⏸️ Episódio 01 [Dublado PT-BR] 1080p',
      url: 'https://example.com/eden.m3u8'
    };

    // Teste com targetTitle em inglês e originalTitle em inglês
    const matchEN = streamValidator.isStreamMatchingTargetTitle(fenixStream, 'East of Eden', 'East of Eden', ['A Leste do Éden']);
    expect(matchEN).toBe(true);

    // Teste com targetTitle em português
    const matchPT = streamValidator.isStreamMatchingTargetTitle(fenixStream, 'A Leste do Éden', 'East of Eden');
    expect(matchPT).toBe(true);
  });

  it('A Leste do Éden deve ter o IMDb ID canônico tt21097264 e status verificado no catálogo mestre', () => {
    const eoe = FEATURED_CATALOG_ITEMS.find(i => i.id === 'series-a-leste-do-eden-2026' || i.title.includes('Leste do Éden'));
    expect(eoe).toBeDefined();
    expect(eoe?.imdbId).toBe('tt21097264');
    expect(eoe?.availabilityStatus).toBe('verified');
    expect(eoe?.audioStatus).toBe('pt-br-dubbed');
    expect(eoe?.seasonsCount).toBe(1);
    expect(eoe?.episodes?.length).toBeGreaterThan(0);
  });

  it('Deve verificar disponibilidade do episódio S01E01 de Westworld com sucesso mesmo sem IMDb ID pré-carregado', async () => {
    const westworldItem = {
      id: 'tmdb-63247',
      tmdbId: '63247',
      title: 'Westworld',
      type: 'SÉRIE' as any,
      mediaFormat: 'series' as any,
      year: 2016
    };

    const isAvailable = await episodeAvailabilityService.verifyEpisodeAvailability(westworldItem, 1, 1);
    expect(isAvailable).toBe(true);
  }, 15000);

  it('Deve resolver fontes com status AVAILABLE para Westworld S01E01', async () => {
    const westworldItem = {
      id: 'tmdb-63247',
      tmdbId: '63247',
      title: 'Westworld',
      type: 'SÉRIE' as any,
      mediaFormat: 'series' as any,
      year: 2016
    };

    const res = await sourceVerificationService.verifySources(westworldItem, { season: 1, episode: 1 });
    expect(res.state).toBe('AVAILABLE');
    expect(res.streams.length).toBeGreaterThan(0);
  }, 20000);

  it('Deve resolver fontes com status AVAILABLE para A Leste do Éden S01E01', async () => {
    const eoeItem = {
      id: 'series-a-leste-do-eden-2026',
      tmdbId: '258165',
      imdbId: 'tt21097264',
      title: 'A Leste do Éden',
      originalTitle: 'East of Eden',
      type: 'SÉRIE' as any,
      mediaFormat: 'series' as any,
      year: 2026
    };

    const res = await sourceVerificationService.verifySources(eoeItem, { season: 1, episode: 1 });
    expect(res.state).toBe('AVAILABLE');
    expect(res.streams.length).toBeGreaterThan(0);
  }, 20000);
});
