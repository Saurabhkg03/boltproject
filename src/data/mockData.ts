export interface Question {
  id: string; // The document ID from Firestore
  title: string;
  subject: string;
  topic: string;
  // These are the fields from your seed script
  question_html: string;
  question_images?: string[]; // To hold clean image URLs
  explanation_html: string;
  explanation_images?: string[]; // To hold clean explanation image URLs
  options: {
    label: string;
    text: string;
    is_correct: boolean;
  }[];
  correctAnswerLabel: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  year: string;
  source?: string;
  createdAt?: string;
  tags: string[];
  // These can be calculated later
  accuracy?: number;
  attempts?: number;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  joined: string;
  stats: {
    attempted: number;
    correct: number;
    accuracy: number;
  };
  avatar?: string;
}

export interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string;
  selectedOption: string;
}
