import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { chromium } from 'playwright';
import { createServer, transformWithEsbuild } from 'vite';

// Locally authored color bars + sine tones: real codecs, HLS segments, audio and
// subtitle tracks. No movie is replaced and no video passes through the app API.
const directory=mkdtempSync(join(tmpdir(),'zapitv-origin-media-'));
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const encode=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{timeout:45000,stdio:'pipe'});
let origin:http.Server|undefined, vite:Awaited<ReturnType<typeof createServer>>|undefined, browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const originRequests:{path:string;range:boolean;bytes:number}[]=[];
try {
  encode(['-f','lavfi','-i','testsrc2=size=640x360:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','32','-c:v','libx264','-preset','ultrafast','-g','48','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',join(directory,'movie.mp4')]);
  encode(['-i',join(directory,'movie.mp4'),'-an','-c:v','copy','-hls_time','2','-hls_playlist_type','vod','-hls_segment_filename',join(directory,'v%d.ts'),join(directory,'video.m3u8')]);
  for(const [name,frequency] of [['pt','440'],['en','660']]) encode(['-f','lavfi','-i',`sine=frequency=${frequency}:sample_rate=48000`,'-t','32','-c:a','aac','-hls_time','2','-hls_playlist_type','vod','-hls_segment_filename',join(directory,`${name}%d.ts`),join(directory,`${name}.m3u8`)]);
  writeFileSync(join(directory,'sub.vtt'),'WEBVTT\n\n00:00:00.000 --> 00:00:31.000\nLegenda de teste autorizada\n');
  writeFileSync(join(directory,'sub.m3u8'),'#EXTM3U\n#EXT-X-TARGETDURATION:32\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:32,\nsub.vtt\n#EXT-X-ENDLIST\n');
  writeFileSync(join(directory,'master.m3u8'),'#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Português",LANGUAGE="pt-BR",DEFAULT=YES,AUTOSELECT=YES,URI="pt.m3u8"\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",DEFAULT=NO,AUTOSELECT=YES,URI="en.m3u8"\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Português",LANGUAGE="pt-BR",DEFAULT=NO,AUTOSELECT=YES,URI="sub.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=640x360,CODECS="avc1.42c01e,mp4a.40.2",AUDIO="audio",SUBTITLES="subs"\nvideo.m3u8\n');
  origin=http.createServer((req,res)=>{
    const path=new URL(req.url!,'http://fixture').pathname.slice(1);
    const filename=path==='episode2.mp4'?'movie.mp4':path;
    if(!/^[\w.-]+$/.test(filename)||!existsSync(join(directory,filename))){res.writeHead(404).end();return;}
    const data=readFileSync(join(directory,filename));
    const match=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),data.length-1):data.length-1;
    const body=data.subarray(start,end+1);
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Accept-Ranges','bytes');
    res.setHeader('Content-Type',filename.endsWith('.m3u8')?'application/vnd.apple.mpegurl':filename.endsWith('.vtt')?'text/vtt':filename.endsWith('.ts')?'video/mp2t':'video/mp4');
    if(match)res.setHeader('Content-Range',`bytes ${start}-${end}/${data.length}`);
    res.setHeader('Content-Length',body.length);res.statusCode=match?206:200;
    originRequests.push({path,range:Boolean(match),bytes:body.length});res.end(body);
  });
  await new Promise<void>(done=>origin!.listen(0,'127.0.0.1',done));
  const media=`http://127.0.0.1:${(origin.address() as {port:number}).port}`;
  const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {init} from '@noriginmedia/norigin-spatial-navigation';import {ZapiPlayer} from '/src/components/player/ZapiPlayer.tsx';import {ContentType} from '/types.ts';import '/index.css';init();
  function Test(){const [episode,setEpisode]=React.useState(1);const hls=new URLSearchParams(location.search).get('hls')==='1';const url='${media}/'+(episode===2?'episode2.mp4':hls?'master.m3u8':'movie.mp4');return <ZapiPlayer item={{id:'owned-media-fixture',imdbId:'tt99999999',title:'Mídia própria de teste',type:ContentType.SERIES,year:2026,rating:0,image:''}} streams={[{url:'/api/proxy?url='+encodeURIComponent(url),sourceType:hls&&episode===1?'hls':'mp4',providerId:'owned-fixture',name:'Mídia própria de teste',title:'Mídia própria de teste',imdbId:'tt99999999',season:1,episode,subtitles:[{id:'fixture-pt',lang:'por',url:'${media}/sub.vtt'}]}]} initialSeason={1} initialEpisode={episode} initialPlayIntro={false} initialResumeTime={5} navigationType="continuous_playback" onClose={()=>{}} nextEpisodeInfo={episode===1?{season:1,episode:2,title:'Segundo teste'}:null} onNextEpisode={()=>setEpisode(2)}/>;}createRoot(document.getElementById('root')).render(<Test/>);`;
  vite=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{
    name:'origin-playback-fixture',
    configureServer(server){const handler=async(_req:any,res:any)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__origin','<html><meta name="viewport" content="width=device-width,initial-scale=1"/><body style="margin:0"><div id="root" style="height:100vh;width:100vw"></div><script type="module" src="/origin-fixture.tsx"></script></body></html>'));};server.middlewares.use('/__origin',handler);server.middlewares.use('/tv/__origin',handler);},
    resolveId(id){if(id==='/origin-fixture.tsx')return '\0origin-fixture.tsx';},
    async load(id){if(id==='\0origin-fixture.tsx')return(await transformWithEsbuild(entry,'origin-fixture.tsx',{loader:'tsx',jsx:'automatic'})).code;}
  }]});
  await vite.listen();const base=`http://127.0.0.1:${(vite.httpServer!.address() as {port:number}).port}`;
  browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync),args:['--autoplay-policy=no-user-gesture-required']});
  const cases=[{name:'desktop-hls',hls:true,tv:false,mobile:false},{name:'desktop-mp4',hls:false,tv:false,mobile:false},{name:'mobile-mp4',hls:false,tv:false,mobile:true},{name:'tv-hls',hls:true,tv:true,mobile:false},{name:'firetv-hls',hls:true,tv:true,mobile:false}];
  const only=process.argv.find(arg=>arg.startsWith('--scenario='))?.split('=')[1];
  for(const scenario of cases.filter(value=>!only||value.name===only)){
    const context=await browser.newContext({viewport:scenario.mobile?{width:390,height:844}:{width:1280,height:720},isMobile:scenario.mobile,hasTouch:scenario.mobile,...(scenario.name.startsWith('firetv')?{userAgent:'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/80.5.3 like Chrome/80.0.3987.162 Safari/537.36'}:{})});
    const page=await context.newPage();const proxyRequests:string[]=[];page.on('console',message=>{if(message.text().includes('[ZapiPlayer] Fonte rejeitada'))console.log(message.text().slice(0,300));});
    await page.route(/https:\/\/opensubtitles(?:-v3)?\.strem\.io\/subtitles\//,route=>route.fulfill({json:{subtitles:[{id:'fixture-pt',lang:'por',url:`${media}/sub.vtt`,imdbId:'tt99999999',season:1,episode:1}]}}));
    await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/proxy')proxyRequests.push(path);return route.fulfill({status:path==='/api/proxy'?410:200,json:{progress:[],streams:[],subtitles:[]}});});
    await page.goto(`${base}${scenario.tv?'/tv':''}/__origin?hls=${scenario.hls?1:0}`,{waitUntil:'domcontentloaded'});
    const video=page.locator('video[data-zapi-main-video]');await video.waitFor({state:'attached',timeout:20000});
    await video.evaluate((el:HTMLVideoElement)=>el.play());
    try { await page.waitForFunction(()=>{const v=document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]');return v&&v.currentTime>=5&&v.videoWidth>0;},null,{timeout:25000}); }
    catch(error){console.log(JSON.stringify({scenario:scenario.name,diagnostic:await video.evaluate((v:HTMLVideoElement)=>({error:v.error?.message,time:v.currentTime,ready:v.readyState})),screen:(await page.locator('body').innerText()).slice(0,600),paths:originRequests.slice(-12).map(r=>r.path)}));throw error;}
    const before=await video.evaluate((v:HTMLVideoElement)=>({time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames}));
    await page.waitForTimeout(scenario.name==='desktop-hls'?15500:4000);
    const after=await video.evaluate((v:HTMLVideoElement)=>({time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,error:v.error?.code,width:v.videoWidth,height:v.videoHeight,audio:(v as any).webkitAudioDecodedByteCount||0}));
    assert.ok(after.time-before.time>(scenario.name==='desktop-hls'?14:3));assert.ok(after.frames>before.frames);assert.equal(after.error,undefined);assert.ok(after.audio>0,'real AAC audio must be decoded');
    await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=22;void v.play();});
    await page.waitForFunction(()=>document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]')!.currentTime>24,null,{timeout:10000});
    assert.equal(proxyRequests.length,0,'player cannot fetch its legacy proxy URL');
    if(scenario.name==='desktop-hls'){
      await page.mouse.move(600,650);await page.getByTitle('Áudio e Dublagem',{exact:true}).click();
      await page.getByRole('button',{name:/English/}).first().click();
      await page.waitForFunction(()=>document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]')!.currentTime>25);
      assert.ok(originRequests.some(req=>req.path.startsWith('en')&&req.path.endsWith('.ts')),'real alternate audio segments are requested');
    }
    if(scenario.name==='desktop-mp4'){
      await video.evaluate((v:HTMLVideoElement)=>v.pause());
      await page.mouse.move(600,650);
      await page.getByTitle(/^Legendas/).click();
      await page.getByRole('button',{name:/Português/}).first().click();
      await page.getByText('Legenda de teste autorizada',{exact:true}).waitFor({timeout:10000});
      await page.getByTitle('Próximo Episódio (N)',{exact:true}).click();
      await page.waitForFunction(()=>{const v=document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]');return v?.currentSrc.endsWith('/episode2.mp4')&&v.currentTime>5;},null,{timeout:15000});
      assert.equal(proxyRequests.length,0);
      console.log('PASS real subtitles rendered and next episode loaded directly');
    }
    console.log(JSON.stringify({scenario:scenario.name,resume:before.time,advancedSeconds:after.time-before.time,frames:after.frames-before.frames,decodedAudioBytes:after.audio,resolution:`${after.width}x${after.height}`,seek:true,mediaApiRequests:proxyRequests.length,physicalDevice:false}));
    await context.close();
  }
  assert.ok(originRequests.some(req=>req.range&&req.path.endsWith('.mp4')),'MP4 Range must reach the media origin');
  console.log(JSON.stringify({controlledOriginRequests:originRequests.length,controlledOriginBytes:originRequests.reduce((sum,r)=>sum+r.bytes,0),productionMonitoring:false}));
} finally {
  await browser?.close();await vite?.close();
  if(origin){origin.closeAllConnections();await new Promise<void>(done=>origin!.close(()=>done()));}
  const absolute=resolve(directory);assert.ok(absolute.toLowerCase().startsWith((resolve(tmpdir())+sep).toLowerCase())&&basename(absolute).startsWith('zapitv-origin-media-'));
  rmSync(absolute,{recursive:true,force:true});
}
