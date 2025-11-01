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
  // MODIFIED: Made single label optional
  correctAnswerLabel?: string | null;
  // MODIFIED: Added array for MSQ
  correctAnswerLabels?: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  year: string;
  source?: string;
  createdAt?: string;
  tags: string[];
  accuracy?: number;
  attempts?: number;
  question_type: 'mcq' | 'nat' | 'msq';
  nat_answer?: string;
  verified: boolean;
  addedBy?: string;
}

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
  };
  avatar?: string;
  role?: 'admin' | 'moderator' | 'user';
  needsSetup?: boolean;
  rating?: number; // Renamed from score
}

export interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string;
  // MODIFIED: Changed to array for MSQ support
  selectedOptions: string[];
  natAnswer?: string;
  timeTaken?: number;
}

export interface UserQuestionData {
    isFavorite?: boolean; // Renamed from isMarkedAsDoubt
    note?: string;
    savedListIds?: string[]; // NEW: To track which lists this question is in
}

// NEW: Interface for user-created question lists
export interface QuestionList {
    id: string; // Firestore document ID
    uid: string; // Owner's UID
    name: string;
    questionIds: string[]; // Array of question IDs
    createdAt: string;
    isPrivate?: boolean; // For future use (like the lock icon)
}
