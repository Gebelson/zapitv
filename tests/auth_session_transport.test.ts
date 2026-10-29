import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { authClient } from '../src/core/auth/authClient';
import { syncQueue } from '../src/core/sync/syncQueue';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { readFileSync } from 'node:fs';
after(()=>canonicalCatalogMaster.dispose());
test('legacy Firebase subscriptions cannot overwrite account-scoped Turso identity or lists',()=>{
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  const subscriptions=app.slice(app.indexOf('// Listen to content changes'),app.indexOf('const [searchQuery'));
  assert.ok(!subscriptions.includes('setCurrentUser('));
  assert.ok(!subscriptions.includes('setActiveProfile('));
  assert.ok(!app.includes('`zapitv_mylist_${currentUser.id}`'));
  assert.ok(!app.includes('`zapitv_favorites_${currentUser.id}`'));
  assert.ok(app.includes('const [isAuthenticated, setIsAuthenticated] = useState(false)'));
});
test('session transport failure differs from confirmed logout and keeps the active profile scope', async()=>{
  const fetchBefore=globalThis.fetch, scopeBefore=syncQueue.setAccountScope;
  const scopes: unknown[][]=[];
  syncQueue.setAccountScope=(...args)=>{scopes.push(args);};
  try {
    globalThis.fetch=async()=>Response.json({authenticated:true,user:{id:'a'},activeProfile:{id:'p'}});
    assert.equal((await authClient.checkSession()).authenticated,true);
    assert.deepEqual(scopes,[['a','p']]);
    globalThis.fetch=async()=>new Response(null,{status:503});
    assert.equal((await authClient.checkSession()).unavailable,true);
    globalThis.fetch=async()=>{throw new Error('controlled offline');};
    assert.equal((await authClient.checkSession()).unavailable,true);
    assert.equal(scopes.length,1,'transport errors cannot unload pending account data');
    globalThis.fetch=async()=>Response.json({authenticated:false});
    assert.equal((await authClient.checkSession()).unavailable,undefined);
    assert.deepEqual(scopes[1],[null]);
  } finally {globalThis.fetch=fetchBefore;syncQueue.setAccountScope=scopeBefore;}
});
test('session response started before logout cannot reactivate its queue',async()=>{
  const fetchBefore=globalThis.fetch, scopeBefore=syncQueue.setAccountScope;
  const scopes: unknown[][]=[];
  syncQueue.setAccountScope=(...args)=>{scopes.push(args);};
  let release!: (value:Response)=>void;
  try {
    globalThis.fetch=async(input)=>String(input).endsWith('/me')?new Promise<Response>(resolve=>{release=resolve;}):Response.json({success:true});
    const checking=authClient.checkSession();
    await authClient.logout();
    release(Response.json({authenticated:true,user:{id:'old'},activeProfile:{id:'old-profile'}}));
    await checking;
    assert.equal(scopes.length,0,'stale session cannot reactivate the old account');
  } finally {globalThis.fetch=fetchBefore;syncQueue.setAccountScope=scopeBefore;}
});
