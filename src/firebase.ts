// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// MODIFIED: Added arrayUnion, arrayRemove, writeBatch, documentId
import { getFirestore, arrayUnion, arrayRemove, writeBatch, documentId } from 'firebase/firestore';

// Get the Firebase configuration from environment variables
// Vite exposes env variables on the `import.meta.env` object
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// **NEW DEBUGGING CHECK**
// This will log a specific error if the environment variables are not loaded.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    'Firebase config is missing. Make sure you have a .env.local file in the root of your project with the correct VITE_ prefixed variables, and that you have restarted your development server.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
