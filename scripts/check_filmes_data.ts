import { filmesData } from '../constants';

console.log('filmesData count:', filmesData.length);
const withVideo = filmesData.filter(f => f.videoUrl || f.verifiedStreams?.length || f.episodes?.length);
console.log('With video:', withVideo.length);
withVideo.slice(0, 15).forEach(f => console.log(' - Item with video:', f.id, f.title, f.type, f.videoUrl, f.verifiedStreams?.map(s => s.url), f.episodes?.map(e => e.videoUrl)));
