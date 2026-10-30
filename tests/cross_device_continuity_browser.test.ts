import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer, transformWithEsbuild } from 'vite';

// Three independent storage contexts share a controlled HTTP backend. Real components,
// storage, scope guards, sync queue, pull client and metadata resolver execute unchanged.
const items = [
  ['tt0388629','One Piece',1999],['tt5753856','Dark',2017],['tmdb-121','tmdb-121',0],['tt2531336','Lupin',2021],['anilist-999001','Anime fixture',2021],
].map(([id,title,year],index)=>({id,title,year,type:index===4?'ANIME':'SÉRIE',mediaFormat:'series',rating:8,image:index===2?'':'/fixture-poster.svg',availabilityStatus:'declared'}));
let revision=1, position=120, offline=false;
const remote = () => ({profileId:'fixture-profile',serverTime:Date.now(),progress:items.map((item,index)=>({id:'p'+index,profileId:'fixture-profile',canonicalId:item.id,contentType:item.type,season:1,episode:index+1,positionSec:index===1?position:120+index,durationSec:1200,progressPercent:10,isCompleted:0,version:revision,updatedAt:1700000000000+index})),history:items.filter((_,i)=>i!==2).map(item=>({profileId:'fixture-profile',canonicalId:item.id,contentType:item.type,title:item.title,posterUrl:item.image,year:item.year})),myList:[{canonicalId:items[1].id,isRemoved:0}],favorites:[]});
const entry = `import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {init,setFocus} from '@noriginmedia/norigin-spatial-navigation';
import {storageService} from '/src/core/storage/storageService.ts';
import {useProfileContinuity} from '/src/core/storage/useProfileContinuity.ts';
import {tmdbService} from '/src/core/tmdb/tmdbClient.ts';
import {TvHomeView} from '/src/components/tv/TvHomeView.tsx';
import {MobileHomeView} from '/src/components/mobile/MobileHomeView.tsx';
import {TvSearchView} from '/src/components/tv/TvSearchView.tsx';
import {MobileMyZapiView} from '/src/components/mobile/MobileMyZapiView.tsx';
import {BrowserRouter} from 'react-router-dom';
import ContentRow from '/components/ContentRow.tsx';
import '/index.css';
init(); const items=${JSON.stringify(items)}; const mode=new URLSearchParams(location.search).get('mode');
const catalog=mode==='desktop'?items:mode==='mobile'?[]:items.slice(0,2);
tmdbService.getDetails=async(id,type,format)=>{if(String(id)!=='121'||type!=='SÉRIE'||format!=='series') throw Error('Wrong exact identity');return {item:{...items[2],title:'Doctor Who',year:1963,tmdbId:'121',image:'/fixture-poster.svg'}};};
tmdbService.searchMulti=async()=>[{...items[1],id:'tt-remote-fixture',title:'Remote discovery fixture'}];
const noop=()=>{};
function Fixture(){ const [ready,setReady]=useState(false); const data=useProfileContinuity(catalog);
useEffect(()=>{storageService.setScope({userId:'fixture-account',profileId:'fixture-profile'}).then(()=>setReady(true));},[]);
useEffect(()=>{const refresh=()=>storageService.hydrateRemoteProfile('fixture-profile');window.addEventListener('focus',refresh);window.addEventListener('online',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};},[]);
return <><output id="state" style={{display:"none"}}>{JSON.stringify({ready,items:data.continueWatching,progress:data.progress,list:data.myList})}</output><button id="refresh" style={{position:"fixed",right:0,top:0,zIndex:99999}} onClick={()=>storageService.hydrateRemoteProfile('fixture-profile')}>Refresh</button><button id="save" style={{position:"fixed",right:200,top:0,zIndex:99999}} onClick={async()=>{const old=(await storageService.getContinueWatching()).find(p=>p.contentId==="tt5753856");await storageService.saveProgress({...old,currentTime:600,percentage:50,updatedAt:new Date().toISOString()});}}>Save offline progress</button><button id="switch" style={{position:"fixed",right:80,top:0,zIndex:99999}} onClick={()=>storageService.setScope({userId:"account-b",profileId:"profile-b"})}>Other account</button>
{mode==='my'?<MobileMyZapiView currentUser={{id:'fixture-account',name:'Fixture',email:'fixture@example.test',role:'user'}} activeProfile={null} allContent={[]} myList={[]} favorites={[]} isDarkMode={true} setIsDarkMode={noop} onLogout={noop} onSwitchProfile={noop} onSelectContent={noop}/>:mode==='search'?<TvSearchView allContent={[]} onSelectItem={noop} onClose={noop}/>:mode==='tv'?<TvHomeView featuredItems={items.slice(0,2)} trendingItems={[]} popularMovies={[]} popularSeries={[]} animeItems={[]} allContent={catalog} onSelectItem={noop} onPlayItem={noop}/>:mode==='mobile'?<MobileHomeView heroItems={items.slice(0,1)} allContent={catalog} trendingItems={[]} personalizedRows={[]} myList={[]} favorites={[]} onSelectContent={noop} onToggleList={noop}/>:<ContentRow title="Continuar Assistindo" items={data.continueWatching} isDarkMode={true} myList={[]} favorites={[]} onToggleFavorite={noop} onToggleList={noop}/>}</>};createRoot(document.getElementById('root')).render(<BrowserRouter><Fixture/></BrowserRouter>);`;
let requests=0;
const server = await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{
 name:'continuity-browser-fixture',
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  if(req.url==='/api/sync/batch'){
    let body='';for await(const chunk of req) body+=chunk;
    const input=JSON.parse(body);res.setHeader('Content-Type','application/json');res.statusCode=offline?503:200;
    if(!offline){for(const mutation of input.mutations || [])if(mutation.type==='progress'&&mutation.data.canonicalId==='tt5753856'){position=mutation.data.positionSec;revision++;}}
    res.end(JSON.stringify(offline?{error:'offline'}:{success:true,processed:input.mutations.length,results:input.mutations.map((mutation:any)=>({id:mutation.id,success:true}))}));return;
  }
  if(req.url?.startsWith('/api/sync/pull')){requests++;res.setHeader('Content-Type','application/json');res.statusCode=offline?503:200;res.end(JSON.stringify(offline?{}:remote()));return;}
  if(req.url==='/fixture-poster.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#234"/></svg>');return;}
  if(req.url?.startsWith('/__continuity')){res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__continuity','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/continuity-fixture.tsx"></script></body></html>'));return;}
  next();
 });},
 resolveId(id){if(id==='/continuity-fixture.tsx')return '\0continuity-fixture.tsx';},
 async load(id){if(id==='\0continuity-fixture.tsx')return (await transformWithEsbuild(entry,'continuity-fixture.tsx',{loader:'tsx',jsx:'automatic'})).code;}
}]});
await server.listen();
const base=`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}`;
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const errors:string[]=[];
try{
 const pages=[];
 for(const [mode,width,height] of [['desktop',1440,900],['mobile',390,844],['tv',1920,1080]] as const){
  const context=await browser.newContext({viewport:{width,height},isMobile:mode==='mobile',hasTouch:mode==='mobile'});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/__continuity?mode=${mode}`);
  await page.waitForFunction(()=>{const state=JSON.parse(document.querySelector('#state')!.textContent!);return state.ready&&state.items.length===5&&state.items.some((i:any)=>i.title==='Doctor Who'&&i.year===1963&&i.image);});
  const snapshot=JSON.parse(await page.locator('#state').innerText());
  assert.equal(snapshot.list[0].title,'Dark');assert.equal(snapshot.progress.find((p:any)=>p.contentId==='tmdb-121').episode,3);
  await page.getByText(/^Continuar assistindo$/i).waitFor();
  assert.equal(await page.getByText(/^Continuar assistindo$/i).count(),1);
  pages.push(page);
 }
 const snapshots=await Promise.all(pages.map(async p=>JSON.parse(await p.locator('#state').innerText()).items.map((i:any)=>[i.id,i.title,i.year])));
 assert.deepEqual(snapshots[0],snapshots[1]);assert.deepEqual(snapshots[1],snapshots[2]);
 revision++;position=420;
 for(const page of pages){await page.locator('#refresh').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#state')!.textContent!).progress.some((p:any)=>p.contentId==='tt5753856'&&p.currentTime===420));await page.reload();await page.waitForFunction(()=>JSON.parse(document.querySelector('#state')!.textContent!).items.length===5);}
 offline=true;await pages[0].locator('#save').click();await pages[0].waitForFunction(()=>JSON.parse(document.querySelector('#state')!.textContent!).progress.some((p:any)=>p.contentId==='tt5753856'&&p.currentTime===600));await pages[0].reload();await pages[0].waitForFunction(()=>JSON.parse(document.querySelector('#state')!.textContent!).progress.some((p:any)=>p.contentId==='tt5753856'&&p.currentTime===600));offline=false;
 await pages[0].evaluate(()=>window.dispatchEvent(new Event('online')));await pages[0].waitForFunction(()=>JSON.parse(document.querySelector('#state')!.textContent!).items.length===5);
 for(const page of pages.slice(1)){await page.locator('#refresh').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#state')!.textContent!).progress.some((p:any)=>p.contentId==='tt5753856'&&p.currentTime===600));}
 await pages[2].evaluate(()=>window.dispatchEvent(new Event('online')));
 await pages[1].locator('#switch').click();await pages[1].waitForFunction(()=>JSON.parse(document.querySelector('#state')!.textContent!).items.length===0);
 await pages[2].keyboard.press('ArrowDown');await pages[2].keyboard.press('ArrowRight');await pages[2].keyboard.press('Enter');
 const my=await browser.newPage({viewport:{width:390,height:844}});my.on('pageerror',e=>errors.push(e.message));await my.goto(`${base}/__continuity?mode=my`);await my.getByText('Minha Lista',{exact:true}).first().waitFor();await my.getByText(/^Continuar assistindo$/i).waitFor();
 const search=await browser.newPage({viewport:{width:1280,height:720}});search.on('pageerror',e=>errors.push(e.message));await search.goto(`${base}/__continuity?mode=search`);await search.waitForSelector('[data-focus-key="tv-search-input"]');await search.keyboard.type('Remote');await search.getByText('Remote discovery fixture',{exact:true}).first().waitFor();
 assert.deepEqual(errors,[]);assert.ok(requests<30,`unexpected pull loop: ${requests}`);
 console.log(JSON.stringify({contexts:3,persisted:5,loadedCatalogs:[5,0,2],sameOrder:true,doctorWho:1963,updatedPosition:600,offlineQueueConfirmed:true,reload:true,offlinePreserved:true,accountIsolation:true,remoteSearch:true,pullRequests:requests,jsErrors:errors.length}));
}finally{await browser.close();await server.close();}
