export interface Question {
  id: string; // The document ID from Firestore
  title: string;
  subject: string;
  topic: string;
  // These are the fields from your seed script
  question_html: string;
  question_image_links?: string[]; // To hold clean image URLs
  explanation_html: string;
  explanation_image_links?: string[]; // To hold clean explanation image URLs
  options: {
    label: string;
    text_html: string; // RENAMED: Changed from 'text' to 'text_html' to match seeder
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
  question_type: 'mcq' | 'nat' | 'msq'; // Add this
  nat_answer?: string; // And this
  verified: boolean; // To check if admin has verified the question
  addedBy?: string; // UID of the moderator who added the question
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
  role?: 'admin' | 'moderator' | 'user'; // Add user role
  needsSetup?: boolean; // Flag to indicate if user needs to complete their profile
}

export interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string;
  selectedOption: string;
  natAnswer?: string; // Add this for NAT answers
}
