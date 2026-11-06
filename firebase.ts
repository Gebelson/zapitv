import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeFirebaseClients, type FirebaseDeployment } from './src/core/config/firebaseEnvironment';

declare const __ZAPITV_FIREBASE_CONFIG__: FirebaseDeployment;
if (typeof __ZAPITV_FIREBASE_CONFIG__ === 'undefined') throw new Error('FIREBASE_BUILD_CONFIG_MISSING');
const clients = initializeFirebaseClients(__ZAPITV_FIREBASE_CONFIG__, { initializeApp, getAuth, getFirestore });
export const db = clients.db;
export const auth = clients.auth;
