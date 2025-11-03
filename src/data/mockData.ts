export interface Question {
  id: string; // The document ID from Firestore
  title: string;
  subject: string;
  topic: string;
  question_html: string;
  question_image_links?: string[];
  explanation_html: string;
  explanation_image_links?: string[];
  options: {
    label: string;
    text_html: string;
    is_correct: boolean;
  }[];
  correctAnswerLabel?: string | null; // For MCQ
  correctAnswerLabels?: string[]; // For MSQ
  // difficulty: 'Easy' | 'Medium' | 'Hard'; // <-- REMOVED per your request
  year: string;
  source?: string;
  createdAt?: string;
  tags: string[];
  accuracy?: number;
  attempts?: number;
  question_type: 'mcq' | 'nat' | 'msq';
  nat_answer_min?: string | null; // MODIFIED: For NAT ranges
  nat_answer_max?: string | null; // MODIFIED: For NAT ranges
  verified: boolean;
  addedBy?: string;
}

// Represents the data structure in the 'users/{uid}' document
export interface User {
  uid: string;
  name: string;
  username: string;
  email: string;
  joined: string;
  stats: {
    attempted: number;
    correct: number;
    accuracy: number;
    // Pre-calculated map of { [subjectName]: count }
    subjects?: Record<string, number>; 
  };
  // Pre-calculated heatmap data: { 'YYYY-MM-DD': count }
  activityCalendar?: Record<string, number>;
  // Pre-calculated streak data
  streakData?: {
    currentStreak: number;
    lastSubmissionDate: string; // ISO date string 'YYYY-MM-DD'
  };
  avatar?: string;
  role?: 'admin' | 'moderator' | 'user';
  needsSetup?: boolean;
  rating?: number;
}

// Represents a document in 'users/{uid}/submissions'
export interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string; // ISO string
  selectedOptions: string[]; // Always an array
  natAnswer?: string;
  timeTaken?: number;
}

// Represents a document in 'users/{uid}/userQuestionData'
export interface UserQuestionData {
    isFavorite?: boolean; 
    note?: string;
    savedListIds?: string[];
}

// Represents a document in 'users/{uid}/questionLists'
export interface QuestionList {
    id: string; // Firestore document ID
    uid: string; // Owner's UID
    name: string;
    questionIds: string[]; // Array of question IDs
    createdAt: string; // ISO string or Firestore Timestamp
    isPrivate?: boolean;
}

