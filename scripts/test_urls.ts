async function test() {
  const u1 = 'http://fenixflix.fenixhub.online/r/NN0LUTAtQZIw7gBwlVppN1zf21tN7WvqW9baP_3xw2qRxYjziPSCYBTTcDXwOLz5aaA4lcYHgMeKINz4u6TyP6P6ijiU1mcwzINW/video.mp4';
  const u2 = 'https://embedplayer2.xyz/cdn/hls/8c2d118cdcc6b4a3608259bb779af12e/master.m3u8?md5=ejWWlw4O-7nfkRJbJAhmQQ&expires=1792133863';
  for (const u of [u1, u2]) {
    try {
      const res = await fetch(u, {
        method: 'GET',
        headers: { Range: 'bytes=0-100' }
      });
      console.log(u.slice(0, 40), 'Status:', res.status, 'Type:', res.headers.get('content-type'));
    } catch(e: any) {
      console.log(u.slice(0, 40), 'Error:', e.message);
    }
  }
}
test();
