import { catalogDiscoveryService } from '../src/core/catalog/CatalogDiscoveryService';
import { searchService } from '../src/core/search/SearchService';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { filmesData } from '../constants';
import { ContentItem } from '../types';

async function testNavigation() {
  console.log('=== TEST REAL DISCOVERY AND CLASSIFICATION ===');
  
  // 1. Simular descoberta de Filmes
  const moviesRes = await catalogDiscoveryService.discoverMovies(1);
  console.log('Discovered movies count:', moviesRes.items.length);
  const movieTitles = moviesRes.items.slice(0, 5).map(m => m.title);
  console.log('Discovered movies sample:', movieTitles);
  
  // Verificar se há séries nos filmes descobertos
  const seriesInMovies = moviesRes.items.filter(i => searchService.isSeriesItem(i));
  console.log('Series in movies:', seriesInMovies.map(s => s.title));

  // 2. Simular descoberta de Séries
  const seriesRes = await catalogDiscoveryService.discoverSeries(1);
  console.log('Discovered series count:', seriesRes.items.length);
  const seriesTitles = seriesRes.items.slice(0, 5).map(s => s.title);
  console.log('Discovered series sample:', seriesTitles);

  // Verificar se há filmes nas séries descobertas
  const moviesInSeries = seriesRes.items.filter(i => searchService.isMovieItem(i, false));
  console.log('Movies in series:', moviesInSeries.map(m => m.title));

  // 3. Simular descoberta de Animes
  const animesRes = await catalogDiscoveryService.discoverAnimes(1);
  console.log('Discovered animes count:', animesRes.items.length);
  const animesTitles = animesRes.items.slice(0, 5).map(a => a.title);
  console.log('Discovered animes sample:', animesTitles);

  // Verificar se Oppenheimer ou Deadpool estão nos animes ou séries
  const oppInSeries = seriesRes.items.find(i => i.title?.toLowerCase().includes('oppenheimer'));
  const oppInAnimes = animesRes.items.find(i => i.title?.toLowerCase().includes('oppenheimer'));
  const deadpoolInSeries = seriesRes.items.find(i => i.title?.toLowerCase().includes('deadpool'));
  const deadpoolInAnimes = animesRes.items.find(i => i.title?.toLowerCase().includes('deadpool'));
  console.log('Oppenheimer in series?', !!oppInSeries, 'in animes?', !!oppInAnimes);
  console.log('Deadpool in series?', !!deadpoolInSeries, 'in animes?', !!deadpoolInAnimes);
}

testNavigation();
