import { filmesData } from '../constants';

const series = filmesData.filter(f => f.type === 'SÉRIE');
console.log('filmesData series count:', series.length);
console.log('Series list:', series.map(s => ({ id: s.id, title: s.title, imdbId: s.imdbId, year: s.year })));
