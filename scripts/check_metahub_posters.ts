import https from 'https';

const urls = [
  'https://images.metahub.space/poster/medium/tt15888806/img',
  'https://images.metahub.space/poster/medium/tt11576182/img',
  'https://images.metahub.space/poster/medium/tt2788314/img',
  'https://images.metahub.space/poster/medium/tt31854290/img'
];

urls.forEach(u => {
  const req = https.request(u, { method: 'HEAD', timeout: 4000 }, (res) => {
    console.log(u, '-> Status:', res.statusCode);
  });
  req.on('error', (err) => {
    console.log(u, '-> Error:', err.message);
  });
  req.on('timeout', () => {
    req.destroy();
    console.log(u, '-> Timeout');
  });
  req.end();
});
