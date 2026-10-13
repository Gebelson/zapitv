import { storageService } from '../src/core/storage/storageService';
import { ContentItem, ContentType } from '../types';

async function testProgress() {
  console.log('Testing watch progress tracking and red bar values...');

  const mockItem: ContentItem = {
    id: 'naruto-test-123',
    title: 'Naruto',
    type: ContentType.ANIME,
    image: 'https://image.tmdb.org/t/p/w500/test.jpg',
    rating: 8.5,
    year: 2002
  };

  // Test 1: Save item progress (e.g. 45%)
  await storageService.saveProgress({
    contentId: mockItem.id,
    item: mockItem,
    season: 1,
    episode: 1,
    currentTime: 450,
    duration: 1000,
    percentage: 45,
    updatedAt: new Date().toISOString()
  });

  const itemPct = storageService.getSyncItemProgress(mockItem.id);
  const ep1Pct = storageService.getSyncEpisodeProgress(mockItem.id, 1, 1);
  const ep2Pct = storageService.getSyncEpisodeProgress(mockItem.id, 1, 2);

  console.log(`Item Progress: ${itemPct}%`);
  console.log(`Season 1 Ep 1 Progress: ${ep1Pct}%`);
  console.log(`Season 1 Ep 2 Progress: ${ep2Pct}%`);

  if (itemPct !== 45) throw new Error(`Expected itemPct 45, got ${itemPct}`);
  if (ep1Pct !== 45) throw new Error(`Expected ep1Pct 45, got ${ep1Pct}`);
  if (ep2Pct !== 0) throw new Error(`Expected ep2Pct 0, got ${ep2Pct}`);

  // Test 2: Save episode 2 as completed (>92% should become 100%)
  await storageService.saveProgress({
    contentId: mockItem.id,
    item: mockItem,
    season: 1,
    episode: 2,
    currentTime: 950,
    duration: 1000,
    percentage: 95,
    updatedAt: new Date().toISOString()
  });

  const ep2Completed = storageService.getSyncEpisodeProgress(mockItem.id, 1, 2);
  console.log(`Season 1 Ep 2 Completed Progress: ${ep2Completed}%`);
  if (ep2Completed !== 100) throw new Error(`Expected ep2Completed 100, got ${ep2Completed}`);

  // Episode 1 progress should be untouched
  const ep1Still45 = storageService.getSyncEpisodeProgress(mockItem.id, 1, 1);
  if (ep1Still45 !== 45) throw new Error(`Expected ep1 still 45, got ${ep1Still45}`);

  console.log('✅ ALL WATCH PROGRESS TESTS PASSED SUCCESSFULLY!');
}

testProgress().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
