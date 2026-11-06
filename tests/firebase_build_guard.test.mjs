import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const base={...process.env,VERCEL:'1',VERCEL_ENV:'preview'};
for(const key of Object.keys(base))if(key.startsWith('ZAPITV_PREVIEW_FIREBASE_')||key==='VITE_VERCEL_ENV'||key==='ZAPITV_DEPLOYMENT_ENV'||key==='FIREBASE_PROJECT_ID')delete base[key];
const failed=spawnSync(process.execPath,['--import','tsx','scripts/validate_firebase_environment.ts'],{env:base,encoding:'utf8',timeout:30000});
assert.equal(failed.status,1);assert.match(failed.stderr,/FIREBASE_PREVIEW_MISSING/);
const fixture={...base,ZAPITV_PREVIEW_FIREBASE_PROJECT_ID:'zapitv-staging-fixture',ZAPITV_PREVIEW_FIREBASE_API_KEY:'AIza'+'s'.repeat(35),ZAPITV_PREVIEW_FIREBASE_APP_ID:'1:222222222:web:abcdef0123456789',ZAPITV_PREVIEW_FIREBASE_AUTH_DOMAIN:'zapitv-staging-fixture.firebaseapp.com',ZAPITV_PREVIEW_FIREBASE_DATABASE_ID:'(default)',ZAPITV_PREVIEW_FIREBASE_STORAGE_BUCKET:'zapitv-staging-fixture.firebasestorage.app',ZAPITV_PREVIEW_FIREBASE_MESSAGING_SENDER_ID:'222222222'};
// Vite itself must reject a missing configuration even if --mode production is used.
const blocked=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','production'],{env:base,encoding:'utf8',timeout:30000});
assert.equal(blocked.status,1);assert.match(blocked.stderr,/FIREBASE_PREVIEW_MISSING/);
const valid=spawnSync(process.execPath,['--import','tsx','scripts/validate_firebase_environment.ts'],{env:fixture,encoding:'utf8',timeout:30000});
assert.equal(valid.status,0,valid.stderr);assert.match(valid.stdout,/"environment":"preview"/);
console.log('Actual validation command and Vite production-mode Preview gate: PASS (synthetic config only)');
