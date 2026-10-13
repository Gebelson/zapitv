import { classifyStream } from '../src/core/audio/audioDetector';
import { SubtitleTrack } from '../src/core/subtitles/subtitleService';
import { ContentItem, ContentType } from '../types';

function shouldAutoActivatePortugueseSubtitle(item: ContentItem, stream: any): boolean {
  // Check stream classification
  if (stream) {
    if (stream.isDubbed === true || stream.isPtBr === true) return false;
    const classification = classifyStream(stream);
    if (classification.isDubbed || classification.isPtBr || classification.badge.includes('🔊')) return false;
  }
  // Check item metadata
  if (item.audioStatus === 'pt-br-original') return false;
  if (item.audioStatus === 'pt-br-dubbed') {
    if (stream) {
      const cls = classifyStream(stream);
      if (cls.isSubtitled && !cls.isDubbed) return true;
    }
    return false;
  }
  return true;
}

function selectBestPortugueseSubtitle(list: SubtitleTrack[]): SubtitleTrack | null {
  return list.find(s => s.isPtBr) ||
         list.find(s => /^(pob|pt-br|bra|por-br)$/i.test(s.lang)) ||
         list.find(s => /^(por|pt|pt-pt)$/i.test(s.lang)) ||
         null;
}

console.log('Testing Auto-Subtitle Activation Logic...');

// Test 1: Dubbed anime stream
const dubbedAnimeItem: ContentItem = {
  id: 'naruto-1',
  title: 'Naruto',
  type: ContentType.ANIME,
  audioStatus: 'pt-br-dubbed',
  rating: 8.5,
  year: 2002,
  image: ''
};
const dubbedStream = {
  name: '🔊 FenixFlix 1080p Dublado',
  title: 'Naruto S01E01 Dublado PT-BR',
  isDubbed: true
};
const shouldSubDubbed = shouldAutoActivatePortugueseSubtitle(dubbedAnimeItem, dubbedStream);
console.log('Test 1 (Dubbed Stream): should auto-activate subtitle =', shouldSubDubbed);
if (shouldSubDubbed !== false) throw new Error('Expected false for dubbed stream');

// Test 2: Subtitled-only anime stream (Japanese audio)
const subbedAnimeItem: ContentItem = {
  id: 'aot-1',
  title: 'Attack on Titan',
  type: ContentType.ANIME,
  audioStatus: 'other',
  rating: 9.0,
  year: 2013,
  image: ''
};
const subbedStream = {
  name: '💬 Torrentio 1080p',
  title: 'Attack on Titan S01E01 Japanese Audio with Subs',
  isDubbed: false
};
const shouldSubNonDubbed = shouldAutoActivatePortugueseSubtitle(subbedAnimeItem, subbedStream);
console.log('Test 2 (Non-dubbed / Subtitled Stream): should auto-activate subtitle =', shouldSubNonDubbed);
if (shouldSubNonDubbed !== true) throw new Error('Expected true for non-dubbed stream');

// Test 3: Best Portuguese subtitle track selection
const mockTracks: SubtitleTrack[] = [
  { id: 'sub-eng', lang: 'eng', label: 'Inglês', languageName: 'Inglês', flag: '🇺🇸', url: '', order: 3 },
  { id: 'sub-ptbr-1', lang: 'pob', label: 'Português (Brasil)', languageName: 'Português (Brasil)', flag: '🇧🇷', url: '', order: 1, isPtBr: true },
  { id: 'sub-spa', lang: 'spa', label: 'Espanhol', languageName: 'Espanhol', flag: '🇪🇸', url: '', order: 4 }
];
const bestSub = selectBestPortugueseSubtitle(mockTracks);
console.log('Test 3 (Best Sub Selection):', bestSub?.label, 'id =', bestSub?.id);
if (bestSub?.id !== 'sub-ptbr-1') throw new Error('Expected sub-ptbr-1 as best Portuguese subtitle');

console.log('✅ ALL AUTO-SUBTITLE TESTS PASSED SUCCESSFULLY!');
