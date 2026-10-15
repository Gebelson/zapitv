import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { mediaSourceValidationService } from '../src/core/providers/mediaSourceValidationService';
import { ContentType } from '../types';

async function testCoralineConfidence() {
  const coralineItem = {
    id: '14836',
    tmdbId: '14836',
    imdbId: 'tt0327597',
    title: 'Coraline e o Mundo Secreto',
    originalTitle: 'Coraline',
    year: 2009,
    type: ContentType.MOVIE,
    genres: ['Animação', 'Família']
  };

  const identity = canonicalIdentityService.buildIdentity(coralineItem);
  console.log('--- Coraline Identity ---');
  console.log('Title:', identity.title);
  console.log('Original Title:', identity.originalTitle);
  console.log('isChildFriendly:', identity.isChildFriendly);
  console.log('Known Aliases:', identity.knownAliases);

  const streams = [
    {
      name: 'Torrentio\n4k HDR',
      title: 'Coraline (2009) (2160p BluRay x265 HEVC 10bit HDR AAC 7.1 Tigole) [QxR]',
      url: 'http://127.0.0.1:11470/stream4k1'
    },
    {
      name: 'Torrentio\n4k DV',
      title: 'Coraline 2009 UHD BluRay 2160p TrueHD Atmos 7 1 DV HEVC REMUX-FraMeSToR',
      url: 'http://127.0.0.1:11470/stream4k2'
    },
    {
      name: 'Torrentio\n1080p',
      title: 'Coraline e o Mundo Secreto (2009) BDRip 1080p dublado',
      url: 'http://127.0.0.1:11470/stream1080p'
    },
    {
      name: 'Torrentio\n720p',
      title: 'Coraline (2009) 720p BrRip x264 - 550MB - YIFY',
      url: 'http://127.0.0.1:11470/stream720p'
    }
  ];

  console.log('\n--- Avaliando Confiabilidade e Resoluções ---');
  streams.forEach((s, idx) => {
    const conf = sourceConfidenceEngine.evaluate(s, identity);
    const resolutions = mediaSourceValidationService.extractStreamResolutions(s);
    console.log(`[${idx}] ${s.name.replace(/\n/g, ' ')}`);
    console.log(`    Title: ${s.title}`);
    console.log(`    Confidence: ${conf.confidence} | isMatch: ${conf.isMatch} | Reasons: ${conf.reasons.join(', ')}`);
    console.log(`    Resolutions extraídas: ${JSON.stringify(resolutions)}`);
  });
}

testCoralineConfidence().catch(console.error);
