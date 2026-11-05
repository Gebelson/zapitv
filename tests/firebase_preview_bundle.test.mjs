import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const tempRoot=path.resolve(tmpdir());
const output=mkdtempSync(path.join(tempRoot,'zapitv-firebase-preview-'));
const production=JSON.parse(readFileSync('firebase-applet-config.json','utf8'));
const env={...process.env,VERCEL:'1',VERCEL_ENV:'preview',VITE_VERCEL_ENV:'preview',ZAPITV_DEPLOYMENT_ENV:'preview',
 ZAPITV_PREVIEW_FIREBASE_PROJECT_ID:'zapitv-staging-fixture',ZAPITV_PREVIEW_FIREBASE_API_KEY:'AIza'+'s'.repeat(35),
 ZAPITV_PREVIEW_FIREBASE_APP_ID:'1:222222222:web:abcdef0123456789',ZAPITV_PREVIEW_FIREBASE_AUTH_DOMAIN:'zapitv-staging-fixture.firebaseapp.com',
 ZAPITV_PREVIEW_FIREBASE_DATABASE_ID:'(default)',ZAPITV_PREVIEW_FIREBASE_STORAGE_BUCKET:'zapitv-staging-fixture.firebasestorage.app',
 ZAPITV_PREVIEW_FIREBASE_MESSAGING_SENDER_ID:'222222222',FIREBASE_PROJECT_ID:'zapitv-staging-fixture',TURSO_AUTH_TOKEN:'SENTINEL_SERVER_ONLY_NEVER_EXPOSE'};
try {
 const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','production','--outDir',output],{env,encoding:'utf8',timeout:120000});
 assert.equal(result.status,0,(result.stderr||'').slice(-1800));
 const assets=path.join(output,'assets');
 const scripts=readdirSync(assets).filter(f=>f.endsWith('.js')).map(f=>readFileSync(path.join(assets,f),'utf8')).join('\n');
 assert.ok(scripts.includes('zapitv-staging-fixture'));
 for(const value of [production.projectId,production.apiKey,production.authDomain,'SENTINEL_SERVER_ONLY_NEVER_EXPOSE'])assert.equal(scripts.includes(value),false,'Preview bundle contains forbidden production/server configuration');
 console.log('Actual Preview build includes staging fixture, excludes Production Firebase and server secret: PASS (no remote provisioning)');
} finally {
 const resolved=path.resolve(output);
 assert.equal(path.dirname(resolved),tempRoot);assert.ok(path.basename(resolved).startsWith('zapitv-firebase-preview-'));
 rmSync(resolved,{recursive:true,force:true});
}
