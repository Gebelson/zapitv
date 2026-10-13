async function testDirectUrl() {
  const url = 'https://upload.wikimedia.org/wikipedia/commons/2/24/Night_of_the_Living_Dead_%281968%29.webm';
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Range': 'bytes=0-1048576', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000)
    });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log('Content-Range:', res.headers.get('content-range'));
    console.log('Accept-Ranges:', res.headers.get('accept-ranges'));
    console.log('Content-Length:', res.headers.get('content-length'));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
testDirectUrl();
