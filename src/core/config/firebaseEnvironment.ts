// Only public Firebase Web App settings may cross this build-time boundary.
export interface FirebasePublicConfig {
  projectId:string; appId:string; apiKey:string; authDomain:string;
  firestoreDatabaseId:string; storageBucket:string; messagingSenderId:string; measurementId?:string;
}
export interface FirebaseDeployment {environment:'production'|'preview'|'development';firebase:FirebasePublicConfig}
type Environment=Record<string,string|undefined>;
export function resolveFirebaseDeployment(env:Environment,production:FirebasePublicConfig):FirebaseDeployment {
  const signals=[env.VERCEL_ENV,env.VITE_VERCEL_ENV,env.ZAPITV_DEPLOYMENT_ENV].filter((v):v is string=>Boolean(v));
  if(new Set(signals).size>1)throw new Error('FIREBASE_ENVIRONMENT_CONFLICT');
  const environment=signals[0] || (env.VERCEL?'':'development');
  if(!['production','preview','development'].includes(environment))throw new Error('FIREBASE_ENVIRONMENT_REQUIRED_OR_INVALID');
  if(env.VERCEL_TARGET_ENV && !['production','preview','development'].includes(env.VERCEL_TARGET_ENV) && environment!=='preview')throw new Error('FIREBASE_ENVIRONMENT_CUSTOM_REQUIRES_PREVIEW');
  if(environment!=='preview')return {environment:environment as 'production'|'development',firebase:{...production}};
  const read=(name:string)=>{
    const key='ZAPITV_PREVIEW_FIREBASE_'+name,value=env[key]?.trim();
    if(!value)throw new Error('FIREBASE_PREVIEW_MISSING:'+key);
    return value;
  };
  const firebase:FirebasePublicConfig={
    projectId:read('PROJECT_ID'),apiKey:read('API_KEY'),appId:read('APP_ID'),authDomain:read('AUTH_DOMAIN'),
    firestoreDatabaseId:read('DATABASE_ID'),storageBucket:read('STORAGE_BUCKET'),messagingSenderId:read('MESSAGING_SENDER_ID')
  };
  const invalid=(field:string):never=>{throw new Error('FIREBASE_PREVIEW_INVALID_OR_PRODUCTION:'+field);};
  if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(firebase.projectId) || firebase.projectId===production.projectId)invalid('PROJECT_ID');
  if(!/^AIza[\w-]{35}$/.test(firebase.apiKey) || firebase.apiKey===production.apiKey)invalid('API_KEY');
  if(!/^\d+$/.test(firebase.messagingSenderId) || firebase.messagingSenderId===production.messagingSenderId)invalid('MESSAGING_SENDER_ID');
  if(!new RegExp('^1:'+firebase.messagingSenderId+':web:[a-z0-9]+$','i').test(firebase.appId) || firebase.appId===production.appId)invalid('APP_ID');
  if(firebase.authDomain!==firebase.projectId+'.firebaseapp.com' || firebase.authDomain===production.authDomain)invalid('AUTH_DOMAIN');
  if(!['(default)'].includes(firebase.firestoreDatabaseId) && !/^[a-z][a-z0-9-]{2,61}[a-z0-9]$/.test(firebase.firestoreDatabaseId))invalid('DATABASE_ID');
  if(![firebase.projectId+'.appspot.com',firebase.projectId+'.firebasestorage.app'].includes(firebase.storageBucket) || firebase.storageBucket===production.storageBucket)invalid('STORAGE_BUCKET');
  if(env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID!==firebase.projectId)invalid('SERVER_PROJECT_ID');
  return {environment:'preview',firebase};
}
export function initializeFirebaseClients<App,Auth,Db>(deployment:FirebaseDeployment,sdk:{
  initializeApp:(config:FirebasePublicConfig)=>App;getAuth:(app:App)=>Auth;getFirestore:(app:App,id:string)=>Db;
}):{auth:Auth;db:Db} {
  const app=sdk.initializeApp(deployment.firebase);
  return {auth:sdk.getAuth(app),db:sdk.getFirestore(app,deployment.firebase.firestoreDatabaseId)};
}
