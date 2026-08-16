import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const getEnvVar = (key: string): string => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[`VITE_FIREBASE_${key}`]) {
    // @ts-ignore
    return import.meta.env[`VITE_FIREBASE_${key}`];
  }
  if (typeof process !== 'undefined' && process.env && process.env[`REACT_APP_FIREBASE_${key}`]) {
    return process.env[`REACT_APP_FIREBASE_${key}`] as string;
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('API_KEY'),
  authDomain: getEnvVar('AUTH_DOMAIN'),
  projectId: getEnvVar('PROJECT_ID'),
  storageBucket: getEnvVar('STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('MESSAGING_SENDER_ID'),
  appId: getEnvVar('APP_ID')
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
