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
  correctAnswerLabel: string;
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
  selectedOption: string;
  natAnswer?: string;
  timeTaken?: number;
}

export interface UserQuestionData {
    isMarkedAsDoubt?: boolean;
    note?: string;
}

