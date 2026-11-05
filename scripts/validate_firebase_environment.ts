import {readFileSync} from 'node:fs';
import {loadEnv} from 'vite';
import {resolveFirebaseDeployment} from '../src/core/config/firebaseEnvironment';
try {
  const config=resolveFirebaseDeployment({...loadEnv('production',process.cwd(),''),...process.env},JSON.parse(readFileSync('firebase-applet-config.json','utf8')));
  console.log(JSON.stringify({firebaseConfiguration:'validated',environment:config.environment,remotePermissionsVerified:false}));
} catch(error) {
  console.error(error instanceof Error?error.message:'FIREBASE_ENVIRONMENT_INVALID');process.exitCode=1;
}
