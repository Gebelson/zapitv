import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer, transformWithEsbuild } from 'vite';

// Real React components and native touch input; HTTP fixtures are intentionally
// controlled here. Remote API acceptance is a separate, explicit staging script.
const entry = `import React from 'react';
import {createRoot} from 'react-dom/client';
import {init} from '@noriginmedia/norigin-spatial-navigation';
import {MobileContentRow} from '/src/components/mobile/MobileContentRow.tsx';
import {MobileRankedRow} from '/src/components/mobile/MobileRankedRow.tsx';
import {MandatoryAuthModal} from '/src/components/auth/MandatoryAuthModal.tsx';
import {TvActivationScreen} from '/src/components/tv/TvActivationScreen.tsx';
import '/index.css';
init();
const mode = new URLSearchParams(location.search).get('mode');
const items = Array.from({length:20},(_,i)=>({id:'fixture-'+i,title:'Fixture '+i,type:'FILME',year:2020,rating:8,image:'',genres:[]}));
const clicked=()=>document.querySelector('#count').textContent=String(Number(document.querySelector('#count').textContent)+1);
createRoot(document.getElementById('root')).render(<><output id="count">0</output><button id="background" onClick={clicked}>Background</button>
{mode==='row'||mode==='rank'?<>{mode==='row'?<MobileContentRow title="Touch fixture" items={items} onItemClick={clicked}/>:<MobileRankedRow title="Touch fixture" items={items} onItemClick={clicked}/>}<div style={{height:2000}}/></>:
mode==='tv'?<TvActivationScreen onTvLinked={()=>{document.querySelector('#count').textContent='linked'}}/>:
<MandatoryAuthModal onLogin={async()=>null} onSignup={async()=>null}/>}</>);`;
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error', plugins: [{
  name: 'p0-browser-fixture',
  configureServer(vite) { vite.middlewares.use('/__p0', async (_req, res) => { res.setHeader('Content-Type','text/html'); res.end(await vite.transformIndexHtml('/__p0', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/p0-fixture.tsx"></script></body></html>')); }); },
  resolveId(id) { if (id === '/p0-fixture.tsx') return '\0p0-fixture.tsx'; },
  async load(id) { if (id === '\0p0-fixture.tsx') return (await transformWithEsbuild(entry,'p0-fixture.tsx',{loader:'tsx',jsx:'automatic'})).code; },
}] });
await server.listen();
const base = `http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}`;
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ headless:true, executablePath });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${base}/__p0`);
  await page.locator('[role=dialog]').waitFor();
  await page.locator('#background').evaluate((element: HTMLElement) => element.focus());
  assert.equal(await page.locator('#background').evaluate(el=>el===document.activeElement), false, 'background must not receive focus');
  for (const key of ['Escape','Backspace','Tab','Tab','Tab']) await page.keyboard.press(key);
  assert.equal(await page.locator('[role=dialog]').count(),1);
  assert.equal(await page.locator('[role=dialog]').evaluate(el=>el.contains(document.activeElement)),true,'keyboard focus remains inside auth');
  assert.equal(await page.locator('#count').textContent(),'0');
  console.log('PASS mandatory modal: background inert, Tab trap, Escape/Backspace cannot dismiss');
  await page.close();
  for (const width of (process.argv.includes('--auth-only')?[]:[360,390,430])) for (const mode of ['row','rank']) {
    const context = await browser.newContext({ viewport:{width,height:800},isMobile:true,hasTouch:true });
    const mobile = await context.newPage();
    await mobile.bringToFront();
    await mobile.goto(`${base}/__p0?mode=${mode}`);
    const row = mobile.locator('section[aria-label="Touch fixture"] > div').last();
    await row.waitFor();
    await mobile.waitForFunction(()=>{
      const el=document.querySelector('section[aria-label="Touch fixture"] .overflow-x-auto');
      return el && getComputedStyle(el).overflowX==='auto' && el.scrollWidth>el.clientWidth;
    });
    const rect = (await row.boundingBox())!;
    const cdp = await context.newCDPSession(mobile);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    await mobile.waitForTimeout(150);
    const swipe=async(x:number,y:number,dx:number,dy:number)=>{
      const point=(x:number,y:number)=>({x,y,id:1,radiusX:2,radiusY:2,force:1});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(x,y)]});
      await mobile.waitForTimeout(80);
      for(let i=1;i<=12;i++) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x+dx*i/12,y+dy*i/12)]});
        await mobile.waitForTimeout(35);
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    const y = rect.y+80, from = width-40;
    await swipe(from,y,-220,0);
    // Wait for native inertial scrolling to finish before a deliberate tap.
    await mobile.waitForTimeout(1200);
    const horizontal=await row.evaluate(el=>({left:el.scrollLeft,width:el.clientWidth,extent:el.scrollWidth,rect:el.getBoundingClientRect().toJSON(),bodyTouch:getComputedStyle(document.body).touchAction,hit:document.elementFromPoint(innerWidth-40,el.getBoundingClientRect().y+80)?.outerHTML.slice(0,160),innerWidth}));
    assert.ok(horizontal.left>100,`native horizontal scroll advances: ${JSON.stringify(horizontal)}`);
    assert.equal(await mobile.evaluate(()=>window.scrollY),0,'horizontal gesture does not move page');
    assert.equal(await mobile.locator('#count').textContent(),'0','drag does not activate card');
    await mobile.getByRole('button',{name:mode==='row'?'Fixture 3 (2020)':'Posição 4: Fixture 3',exact:true}).tap();
    assert.equal(await mobile.locator('#count').textContent(),'1','subsequent deliberate tap works');
    await mobile.waitForTimeout(150);
    await swipe(width/2,rect.y+130,0,-100);
    await mobile.waitForFunction(()=>window.scrollY>30,null,{timeout:3000});
    assert.ok(await mobile.evaluate(()=>window.scrollY)>30,'a vertical gesture over the row still scrolls the page');
    console.log(`PASS mobile ${mode} ${width}px: native horizontal/vertical gestures, no accidental click, tap restored`);
    await context.close();
  }
  const tv = await browser.newPage({viewport:{width:1920,height:1080}});
  let validSession = false;
  await tv.route('**/api/device-auth/challenge', route=>route.fulfill({json:{deviceCode:'controlled-device',userCode:'TEST1234',verificationUrl:'https://example.test/tv-activate',expiresIn:600,interval:0.1,deviceName:'Test TV',deviceType:'tv'}}));
  await tv.route('**/api/device-auth/poll', route=>route.fulfill({json:{status:'approved'}}));
  await tv.route('**/api/auth/me', route=>route.fulfill({json:{authenticated:validSession,user:validSession?{id:'controlled-user'}:null,activeProfile:null,mandatoryAuth:true}}));
  await tv.goto(`${base}/__p0?mode=tv`);
  await tv.getByText('A sessão da televisão não foi confirmada.',{exact:false}).waitFor();
  assert.equal(await tv.locator('#count').textContent(),'0','QR response alone must not authenticate TV');
  validSession=true;
  await tv.reload();
  await tv.waitForFunction(()=>document.querySelector('#count')?.textContent==='linked',null,{timeout:15000});
  await tv.keyboard.press('Escape');
  console.log('PASS TV activation: approved QR requires backend session before linked callback');
  await tv.close();
  for (const routePath of ['/','/tv','/tv/ativar?code=APPC1234']) {
    const phoneActivation=routePath.startsWith('/tv/ativar');
    const context=await browser.newContext({viewport:{width:routePath==='/tv'?1920:390,height:routePath==='/tv'?1080:844}});
    const app=await context.newPage();
    let phoneSession=false, approvals=0;
    const account={id:'phone-user',name:'Phone fixture',email:'phone@example.test',createdAt:Date.now(),role:'user'};
    const profile={id:'phone-profile',userId:account.id,name:'Fixture',avatarId:'avatar-1',isDefault:1,displayOrder:0};
    await app.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/api/auth/login') phoneSession=true;
      if(path==='/api/device-auth/approve') {
        assert.equal(route.request().postDataJSON().userCode.replace(/[^A-Z0-9]/g,''),'APPC1234');
        approvals++;
      }
      const json=path==='/api/auth/login'?{user:account}:
        path==='/api/auth/me'?{authenticated:phoneSession,user:phoneSession?account:null,activeProfile:phoneSession?profile:null,mandatoryAuth:true}:
        path==='/api/profiles'?{profiles:[profile]}:
        path==='/api/device-auth/validate'?{valid:true,challenge:{userCode:'APPC1234',deviceName:'Fixture TV',deviceType:'tv',expiresAt:Date.now()+600000,createdAt:Date.now()}}:
        path==='/api/device-auth/approve'?{success:true}:
        path==='/api/auth/policy'?{mandatoryAuth:true,version:1}:
        path==='/api/device-auth/challenge'?{deviceCode:'app-device',userCode:'APPC1234',verificationUrl:'https://example.test/tv-activate',expiresIn:600,interval:5}:
        path==='/api/device-auth/poll'?{status:'pending'}: {};
      return route.fulfill({json});
    });
    await app.goto(`${base}${routePath}`,{waitUntil:'domcontentloaded'});
    if(phoneActivation) {
      await app.getByPlaceholder('seu@email.com').waitFor({timeout:15000});
      assert.equal(await app.locator('#zapitv-mandatory-auth-overlay').count(),0);
      assert.ok(app.url().includes('code=APPC1234'),'phone login retains QR challenge');
    } else if(routePath==='/') {
      await app.locator('#zapitv-mandatory-auth-overlay').waitFor({timeout:30000});
      await app.keyboard.press('Escape');
      assert.equal(await app.locator('#zapitv-mandatory-auth-overlay').count(),1);
    } else {
      await app.getByText('APPC1234',{exact:false}).waitFor({timeout:30000});
      assert.equal(await app.locator('#zapitv-mandatory-auth-overlay').count(),0,'desktop auth overlay cannot cover TV activation');
    }
    await app.reload({waitUntil:'domcontentloaded'});
    await (phoneActivation?app.getByPlaceholder('seu@email.com'):routePath==='/'?app.locator('#zapitv-mandatory-auth-overlay'):app.getByText('APPC1234',{exact:false})).waitFor({timeout:30000});
    if(phoneActivation) {
      await app.getByPlaceholder('seu@email.com').fill(account.email);
      await app.getByPlaceholder('••••••••').fill('Fictional-test-password9!');
      await app.getByRole('button',{name:'Entrar e Continuar'}).click();
      await app.getByRole('button',{name:'Autorizar televisão',exact:true}).waitFor();
      assert.equal(approvals,0,'login alone cannot approve a device');
      assert.ok(app.url().includes('code=APPC1234'));
      const approved=app.waitForResponse(response=>response.url().endsWith('/api/device-auth/approve'));
      await app.getByRole('button',{name:'Autorizar televisão',exact:true}).click();
      await approved;
      assert.equal(approvals,1,'explicit approval uses the original QR challenge');
    }
    console.log(`PASS actual App ${routePath}: mandatory activation survives F5 with anonymous backend fixture`);
    await context.close();
  }
} finally { await browser.close(); await server.close(); }
