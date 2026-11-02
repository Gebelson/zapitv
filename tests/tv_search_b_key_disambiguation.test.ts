import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium, type Page } from 'playwright';
const targets = [
 ['Fire TV / Silk','Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Chrome/119.0 Silk/119 Safari/537.36'],
 ['Samsung Tizen','Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 Chrome/85.0 TV Safari/537.36'],
 ['LG webOS','Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0 Safari/537.36'],
 ['Desktop TV','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'],
];
const queries=['b','batman','Breaking Bad','bob','Barbie','bbb'];
const characters='abcdefghijklmnopqrstuvwxyz1234567890';
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function query(page:Page){return (await page.locator('[data-focus-key="tv-search-input"] .tracking-wide').textContent().catch(()=>'')) || '';}
async function expectQuery(page:Page,expected:string){await page.waitForFunction(expected=>(document.querySelector('[data-focus-key="tv-search-input"] .tracking-wide')?.textContent||'')===expected,expected,{timeout:4000});assert.equal(await query(page),expected);}
async function focused(page:Page){return page.locator('[data-focus-key][data-tv-focused="true"]').first().getAttribute('data-focus-key');}
async function navigate(page:Page,char:string){
 const destination=characters.indexOf(char);assert.ok(destination>=0);
 let key=await focused(page);assert.ok(key?.startsWith('tv-key-'));
 let current=characters.indexOf(key!.slice(7));assert.ok(current>=0,`Unexpected keyboard position ${key}`);
 for(const axis of ['vertical','horizontal']){
  const coordinate=(i:number)=>axis==='vertical'?Math.floor(i/6):i%6;
  let attempts=0;
  while(coordinate(current)!==coordinate(destination)){
   const direction=coordinate(current)<coordinate(destination)?(axis==='vertical'?'ArrowDown':'ArrowRight'):(axis==='vertical'?'ArrowUp':'ArrowLeft');
   await page.keyboard.press(direction);assert.ok(++attempts<9,'D-Pad cannot reach key');
   await page.waitForFunction(previous=>document.querySelector('button[data-tv-focused="true"]')?.getAttribute('data-focus-key')!==previous,key);
   key=await focused(page);current=characters.indexOf(key!.slice(7));assert.ok(current>=0,`D-Pad left keyboard unexpectedly: ${key}`);
  }
 }
 assert.equal(await focused(page),`tv-key-${char}`);
 assert.ok((await page.locator(`[data-focus-key="tv-key-${char}"]`).getAttribute('class'))?.includes('border-cyan-400'));
}
async function confirm(page:Page,key:string,code:string,keyCode:number){
 await page.evaluate(({key,code,keyCode})=>{const target=document.activeElement||window;for(const type of ['keydown','keyup']){const e=new KeyboardEvent(type,{key,code,keyCode,which:keyCode,bubbles:true,cancelable:true});Object.defineProperty(e,'keyCode',{value:keyCode,configurable:false});target.dispatchEvent(e);}}, {key,code,keyCode});
}
try{
 await server.listen();const base=`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}`;
 browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)});
 for(const [name,userAgent]of targets){
  const context=await browser.newContext({viewport:{width:1280,height:720},userAgent,hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(4000);const errors:string[]=[];const searches:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>{const url=new URL(route.request().url());const q=url.searchParams.get('query');if(q) searches.push(q);return route.fulfill({json:url.hostname.includes('anilist')?{data:{Page:{media:[]}}}:{results:[],metas:[],data:[]}});});
  const reset=async()=>{await page.goto(`${base}/tests/harness/search_keyboard_preview.html?tv=1`,{waitUntil:'domcontentloaded'});await page.locator('[data-focus-key="tv-key-a"][data-tv-focused="true"]').waitFor();};
  await reset();await navigate(page,'b');
  // Explicit Enter wins over a contradictory legacy code=KeyB. No writable event patching.
  await confirm(page,'Enter','KeyB',66);await expectQuery(page,'b');
  for(const event of [['Enter','Enter',13],['Enter','Enter',66],['Select','',13],['OK','',65385],['Unidentified','',66],['','',66]] as const){await reset();await navigate(page,'b');await confirm(page,...event);await expectQuery(page,'b');}
  for(const text of queries){
   await reset();await page.keyboard.type(text);await expectQuery(page,text);
   await reset();let expected='';
   for(const char of text.toLowerCase()){
    if(char===' ')await page.locator('[data-focus-key="tv-key-space"]').click();
    else {await navigate(page,char);await page.keyboard.press('Enter');}
    expected+=char;await expectQuery(page,expected);
   }
  }
  await reset();await navigate(page,'b');for(let i=1;i<=3;i++){await page.keyboard.press('Enter');await expectQuery(page,'b'.repeat(i));}
  await reset();await page.locator('[data-focus-key="tv-key-b"]').click();await expectQuery(page,'b');await page.locator('[data-focus-key="tv-key-b"]').tap();await expectQuery(page,'bb');
  await reset();await confirm(page,'Unidentified','KeyB',66);await expectQuery(page,'b');assert.equal(await focused(page),'tv-key-a');
  await reset();await navigate(page,'b');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');await expectQuery(page,'b');
  await reset();let expected='';for(const char of characters){await navigate(page,char);await page.keyboard.press('Enter');expected+=char;await expectQuery(page,expected);}
  await page.locator('[data-focus-key="tv-key-backspace"]').click();await expectQuery(page,expected.slice(0,-1));
  await page.locator('[data-focus-key="tv-key-clear"]').click();await expectQuery(page,'');
  await reset();for(let i=0;i<5&&!(await focused(page))?.startsWith('tv-filter-');i++){await page.keyboard.press('ArrowUp');await page.waitForTimeout(100);}
  assert.ok((await focused(page))?.startsWith('tv-filter-'));await page.keyboard.press('ArrowRight');await page.locator('[data-focus-key="tv-filter-movies"][data-tv-focused="true"]').waitFor();await confirm(page,'Unidentified','',66);assert.equal(await page.locator('[data-focus-key="tv-filter-movies"]').getAttribute('data-tv-active'),'true');await expectQuery(page,'');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#close-count')?.textContent==='1');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({platform:name,queries:6,physicalAndVirtual:true,allKeys:36,remoteCodes:[13,66,65385],realArrowNavigation:true,onePressOneCharacter:true,otherButtonConfirmed:true,jsErrors:0,physicalHardware:false}));await context.close();
 }
}finally{await browser?.close();await server.close();}
