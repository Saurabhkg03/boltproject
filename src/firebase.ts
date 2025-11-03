// No changes needed here, but I'm adding a Question type for clarity
// based on your seeder script.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { app, auth, db, storage, analytics };

// --- Types ---
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
  role?: 'admin' | 'user';
  // Add other user-specific fields
}

export interface Option {
  label: string | null;
  text_html: string;
  is_correct: boolean;
}

export interface Question {
  id: string; // Document ID
  scraped_id: string;
  title: string;
  question_html: string;
  question_image_links: string[];
  explanation_html: string;
axplanation_image_links: string[];
  options: Option[];
  correctAnswerLabel: string | null; // For MCQ
  correctAnswerLabels: string[]; // For MSQ
  question_type: 'mcq' | 'msq' | 'nat';
  nat_answer_min: string | null;
  nat_answer_max: string | null;
  year: string;
  subject: string;
  branch: string;
  topic: string;
  tags: string[];
  createdAt: string;
  verified: boolean;
  attempts: number;
  accuracy: number;
}
