async function checkArchiveMetadata() {
  try {
    const res = await fetch('https://archive.org/metadata/night_of_the_living_dead');
    console.log('Metadata status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Server:', data.server, 'dir:', data.dir);
      const mp4Files = (data.files || []).filter(f => f.name.endsWith('.mp4'));
      console.log('MP4 files count:', mp4Files.length);
      for (const f of mp4Files.slice(0, 5)) {
        console.log('File:', f.name, f.size, f.format);
        const testUrl = `https://archive.org/download/night_of_the_living_dead/${encodeURIComponent(f.name)}`;
        const testRes = await fetch(testUrl, { method: 'GET', headers: { Range: 'bytes=0-1024' }, signal: AbortSignal.timeout(6000) });
        console.log('Test URL status:', testRes.status, 'Content-Range:', testRes.headers.get('content-range'), 'Type:', testRes.headers.get('content-type'));
      }
    }
  } catch (e) {
    console.log('Archive metadata error:', e.message);
  }
}
checkArchiveMetadata();
