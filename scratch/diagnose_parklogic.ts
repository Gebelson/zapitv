import { DEFAULT_PROVIDERS } from '../src/core/providers/providerRegistry';

async function diagnose() {
  console.log('--- DIAGNOSTIC SUITE FOR PARKLOGIC & STREAM FAILURES ---');
  
  const testUrls = [
    'https://superflixapi.top',
    'https://superflixapi.top/filme/550',
    'https://superflixapi.top/serie/1399/1/1',
    'https://embedplayapi.site',
    'https://embedplayapi.site/embed/movie/550',
    'https://embedplayapi.site/embed/550',
    'https://playerflixapi.com',
    'https://playerflixapi.com/filme/550',
    'https://playerflixapi.com/serie/1399/1/1'
  ];

  for (const url of testUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow'
      });
      const text = await res.text();
      const isParkLogic = text.toLowerCase().includes('parklogic') || text.toLowerCase().includes('park logic');
      const isDomainParked = isParkLogic || text.toLowerCase().includes('domain parked') || text.toLowerCase().includes('godaddy') || text.toLowerCase().includes('sedo');
      
      console.log(`URL: ${url}`);
      console.log(`  -> Status: ${res.status}`);
      console.log(`  -> Final URL: ${res.url}`);
      console.log(`  -> Content-Type: ${res.headers.get('content-type')}`);
      console.log(`  -> Content Length: ${text.length}`);
      console.log(`  -> ParkLogic detected: ${isParkLogic}`);
      console.log(`  -> Domain Parked detected: ${isDomainParked}`);
      if (isParkLogic) {
        console.log(`  -> SNIPPET: ${text.slice(0, 300)}`);
      }
    } catch (err: any) {
      console.log(`URL: ${url}`);
      console.log(`  -> FETCH ERROR: ${err.message}`);
    }
  }
}

diagnose();
