import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveFirebaseDeployment,initializeFirebaseClients} from '../src/core/config/firebaseEnvironment';
const production=JSON.parse(readFileSync('firebase-applet-config.json','utf8'));
const fixture={VERCEL:'1',VERCEL_ENV:'preview',MODE:'production',
 ZAPITV_PREVIEW_FIREBASE_PROJECT_ID:'zapitv-staging-fixture',
 ZAPITV_PREVIEW_FIREBASE_API_KEY:'AIza'+'s'.repeat(35),
 ZAPITV_PREVIEW_FIREBASE_APP_ID:'1:222222222:web:abcdef0123456789',
 ZAPITV_PREVIEW_FIREBASE_AUTH_DOMAIN:'zapitv-staging-fixture.firebaseapp.com',
 ZAPITV_PREVIEW_FIREBASE_DATABASE_ID:'(default)',
 ZAPITV_PREVIEW_FIREBASE_STORAGE_BUCKET:'zapitv-staging-fixture.firebasestorage.app',
 ZAPITV_PREVIEW_FIREBASE_MESSAGING_SENDER_ID:'222222222'};
const selected=resolveFirebaseDeployment(fixture,production);
assert.equal(selected.environment,'preview');assert.equal(selected.firebase.projectId,fixture.ZAPITV_PREVIEW_FIREBASE_PROJECT_ID);
for(const key of Object.keys(fixture).filter(k=>k.startsWith('ZAPITV_'))){const env={...fixture};delete env[key];assert.throws(()=>resolveFirebaseDeployment(env,production),/FIREBASE_PREVIEW_/);}
assert.deepEqual(resolveFirebaseDeployment({VERCEL:'1',VERCEL_ENV:'production'},production).firebase,production);
assert.deepEqual(resolveFirebaseDeployment({},production).firebase,production);
assert.throws(()=>resolveFirebaseDeployment({VERCEL:'1'},production),/FIREBASE_ENVIRONMENT_/);
assert.throws(()=>resolveFirebaseDeployment({...fixture,VITE_VERCEL_ENV:'production'},production),/FIREBASE_ENVIRONMENT_/);
assert.throws(()=>resolveFirebaseDeployment({...fixture,ZAPITV_DEPLOYMENT_ENV:'production'},production),/FIREBASE_ENVIRONMENT_/);
assert.throws(()=>resolveFirebaseDeployment({...fixture,ZAPITV_PREVIEW_FIREBASE_PROJECT_ID:production.projectId,ZAPITV_PREVIEW_FIREBASE_DATABASE_ID:'different-db'},production),/FIREBASE_PREVIEW_/);
for(const [key,field] of [['API_KEY','apiKey'],['APP_ID','appId'],['AUTH_DOMAIN','authDomain'],['STORAGE_BUCKET','storageBucket'],['MESSAGING_SENDER_ID','messagingSenderId']] as const){assert.throws(()=>resolveFirebaseDeployment({...fixture,['ZAPITV_PREVIEW_FIREBASE_'+key]:production[field]},production),/FIREBASE_PREVIEW_/);}
assert.throws(()=>resolveFirebaseDeployment({...fixture,FIREBASE_PROJECT_ID:production.projectId},production),/FIREBASE_PREVIEW_/);
for(const value of ['https://example.test','production.firebaseapp.com','evil.test/path'])assert.throws(()=>resolveFirebaseDeployment({...fixture,ZAPITV_PREVIEW_FIREBASE_AUTH_DOMAIN:value},production),/FIREBASE_PREVIEW_/);
assert.throws(()=>resolveFirebaseDeployment({...fixture,ZAPITV_PREVIEW_FIREBASE_API_KEY:'-----BEGIN PRIVATE KEY-----'},production),/FIREBASE_PREVIEW_/);
const withSecrets=resolveFirebaseDeployment({...fixture,TURSO_AUTH_TOKEN:'never-client-side',FIREBASE_PRIVATE_KEY:'never-client-side'},production);
assert.doesNotMatch(JSON.stringify(withSecrets),/never-client-side|PRIVATE_KEY|TURSO/);
const writes:Array<{project:string,db:string,collection:string}>=[];
const sdk={initializeApp:(options:any)=>({options}),getAuth:(app:any)=>({project:app.options.projectId}),getFirestore:(app:any,db:string)=>({project:app.options.projectId,db,write:(collection:string)=>writes.push({project:app.options.projectId,db,collection})})};
const clients=initializeFirebaseClients(selected,sdk);clients.db.write('users');
assert.equal(clients.auth.project,fixture.ZAPITV_PREVIEW_FIREBASE_PROJECT_ID);
assert.deepEqual(writes,[{project:fixture.ZAPITV_PREVIEW_FIREBASE_PROJECT_ID,db:'(default)',collection:'users'}]);
assert.ok(writes.every(w=>w.project!==production.projectId));
console.log('Firebase environment fail-closed selection and SDK destination fixtures: PASS (remote permissions unverified)');
