import { providerRegistry } from '../src/core/providers/providerRegistry';
import { sourceVerificationService } from '../src/core/providers/sourceVerificationService';
import { ContentType } from '../types';

async function main() {
  const item = {
    id: 'tt15398776',
    imdbId: 'tt15398776',
    title: 'Oppenheimer',
    type: ContentType.MOVIE,
    year: 2023,
    rating: 8.9
  };

  console.log('Testing providerRegistry.resolveStreams directly...');
  const directStreams = await providerRegistry.resolveStreams('movie', item);
  console.log('Direct streams count:', directStreams.length);
  for (const s of directStreams.slice(0, 5)) {
    console.log(`- [${s.providerName}] ${s.title} (${s.url.substring(0, 50)}...) isPtBr: ${s.isPtBr}`);
  }

  console.log('\nTesting sourceVerificationService.verifySources...');
  const verResult = await sourceVerificationService.verifySources(item);
  console.log('Verification result state:', verResult.state);
  console.log('Verification streams count:', verResult.streams.length);
  console.log('Verification errorMessage:', verResult.errorMessage);
  console.log('Diagnostic log timeouts:', verResult.diagnosticLog.timeouts);
  console.log('Diagnostic log networkErrors:', verResult.diagnosticLog.networkErrors);
}

main().catch(console.error);
