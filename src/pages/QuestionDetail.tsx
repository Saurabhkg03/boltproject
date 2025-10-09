import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render/auto-render';

if (typeof window !== 'undefined') {
  window.renderMathInElement = renderMathInElement;
}


// --- FIREBASE AND AUTH SETUP (Internalized to fix compile errors) ---
import { initializeApp, getApps, getApp } from 'firebase/app'; // Import getApps and getApp
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';



// Global variables provided by the environment
declare const __app_id: string;
declare const __firebase_config: string;
declare const __initial_auth_token: string;

// Interfaces copied from mockData.ts (internalized for single file)
interface Question {
  id: string; // The document ID from Firestore
  title: string;
  subject: string;
  topic: string;
  question_html: string;
  question_image_links?: string[]; // To hold clean image URLs
  explanation_html: string;
  explanation_image_links?: string[]; // To hold clean explanation image URLs
  options: {
    label: string;
    text_html: string; // FIX: Ensure this matches the seeder output
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
}

interface UserInfo {
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

interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string;
  selectedOption: string;
  natAnswer?: string;
}


// Firebase Initialization FIX: Check if the default app already exists
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// Auth Context Setup
interface AuthContextType {
  user: FirebaseAuthUser | null;
  userInfo: UserInfo | null;
  setUserInfo: React.Dispatch<React.SetStateAction<UserInfo | null>> | undefined;
}
const AuthContext = createContext<AuthContextType>({ user: null, userInfo: null, setUserInfo: undefined });
const useAuth = () => useContext(AuthContext);

// Mock Auth Provider (Internalized)
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    // 1. Authenticate user
    const authenticate = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    
    // 2. Set up listener to manage user state
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userId = currentUser.uid;
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);

        let userData: UserInfo;
        if (userSnap.exists()) {
          userData = userSnap.data() as UserInfo;
        } else {
          // Create initial user document
          userData = {
            uid: userId,
            name: currentUser.displayName || `User ${userId.substring(0, 4)}`,
            email: currentUser.email || 'N/A',
            joined: new Date().toISOString(),
            stats: { attempted: 0, correct: 0, accuracy: 0 },
          };
          await setDoc(userDocRef, userData);
        }
        setUserInfo(userData);
      } else {
        setUserInfo(null);
      }
      setLoadingAuth(false);
    });

    authenticate();
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userInfo, setUserInfo }}>
      {children}
    </AuthContext.Provider>
  );
};

// End of Auth Setup

// Declare KaTeX auto-render function from the global scope
declare global {
  interface Window {
    renderMathInElement: (element: HTMLElement, options: any) => void;
  }
}

// --- UTILITY FUNCTIONS ---

/**
 * Strips common wrapping divs, image tags, and noscript tags from HTML strings.
 * @param html The raw HTML string from Firestore.
 * @param contentClass The class name of the inner content to extract (e.g., 'question_text', 'mtq_explanation-text', 'option_data').
 * @returns Cleaned HTML string containing only the inner content, or the original string if parsing fails.
 */
const extractAndCleanHtml = (html: string, contentClass?: string): string => {
  if (!html) return '';
  
  // 1. Remove <noscript> and <img> tags globally
  let clean = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
  clean = clean.replace(/<img[^>]*>/gi, '');

  // 2. If a specific class is provided, attempt to extract the inner content
  if (contentClass) {
    // Regex to find the div with the specific class and capture its content (non-greedy)
    const regex = new RegExp(`<div[^>]*class=["'][^"']*${contentClass}[^"']*["'][^>]*>([\\s\\S]*?)<\/div>`, 'i');
    const match = clean.match(regex);
    
    // If the content is successfully extracted, use that content.
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // 3. If no specific class was provided or extraction failed, return the globally cleaned string
  return clean.trim();
};


// --- MAIN APPLICATION COMPONENT ---

function QuestionDetailComponent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userInfo, setUserInfo } = useAuth();

  const [question, setQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [natAnswer, setNatAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const questionRef = useRef<HTMLDivElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]); 

  useEffect(() => {
    const fetchQuestionData = async () => {
      if (!id) return;
      setLoading(true);
      setSubmitted(false);
      setSelectedOption(null);
      setNatAnswer('');

      try {
        const docRef = doc(db, 'questions', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const fetchedQuestion = { id: docSnap.id, ...docSnap.data() } as Question;
          setQuestion(fetchedQuestion);

          if (user) {
            const submissionRef = doc(db, `users/${user.uid}/submissions`, id);
            const submissionSnap = await getDoc(submissionRef);
            if (submissionSnap.exists()) {
              const sub = submissionSnap.data() as Submission;
              setSubmitted(true);
              setIsCorrect(sub.correct);
              if (sub.selectedOption) {
                setSelectedOption(sub.selectedOption);
              }
              if (sub.natAnswer) {
                setNatAnswer(sub.natAnswer);
              }
            }
          }
        } else {
          setQuestion(null);
        }

        if (allQuestions.length === 0) {
          const querySnapshot = await getDocs(collection(db, 'questions'));
          const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          questionsData.sort((a, b) => (a.title || "").localeCompare(b.title || "")); 
          setAllQuestions(questionsData);
        }
      } catch (error) {
        console.error("Error fetching question:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user || !userInfo) {
      fetchQuestionData();
    }
  }, [id, user, allQuestions.length]);

  useEffect(() => {
    // Render KaTeX after question and submission state has stabilized
    if (!loading && question && window.renderMathInElement) {
      const renderOptions = {
        delimiters: [
          { left: '[latex]', right: '[/latex]', display: true },
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      };
      if (questionRef.current) {
        window.renderMathInElement(questionRef.current, renderOptions);
      }
      if (submitted && explanationRef.current) {
        window.renderMathInElement(explanationRef.current, renderOptions);
      }
      optionsRef.current.forEach(el => {
        if (el) window.renderMathInElement(el, renderOptions);
      });
    }
  }, [question, loading, submitted]);

  const handleSubmit = async () => {
    if (!user || !question || !userInfo || submitted) return;

    let userCorrect = false;

    if (question.question_type === 'nat') {
      userCorrect = natAnswer.trim() === question.nat_answer;
    } else {
      if (!selectedOption) return;
      const correctOption = question.options.find(opt => opt.is_correct);
      userCorrect = selectedOption === correctOption?.label;
    }

    setIsCorrect(userCorrect);
    setSubmitted(true);

    const submissionData: Submission = {
      qid: question.id,
      uid: user.uid,
      correct: userCorrect,
      timestamp: new Date().toISOString(),
      selectedOption: selectedOption || '',
      natAnswer: natAnswer,
    };

    await setDoc(doc(db, `users/${user.uid}/submissions`, question.id), submissionData);

    const newStats = { ...userInfo.stats };
    newStats.attempted += 1;
    if (userCorrect) {
      newStats.correct += 1;
    }
    newStats.accuracy = (newStats.correct / newStats.attempted) * 100;

    const userDocRef = doc(db, `users/${user.uid}`);
    await updateDoc(userDocRef, { stats: newStats });

    if (setUserInfo) {
      setUserInfo({ ...userInfo, stats: newStats });
    }
  };

  const findNextQuestionId = () => {
    if (!id || allQuestions.length === 0) return null;
    const currentIndex = allQuestions.findIndex(q => q.id === id);
    if (currentIndex > -1 && currentIndex < allQuestions.length - 1) {
      return allQuestions[currentIndex + 1].id;
    }
    return null;
  };

  const handleNext = () => {
    const nextId = findNextQuestionId();
    if (nextId) {
      navigate(`/question/${nextId}`);
    } else {
      navigate('/practice'); 
    }
  }

  // Loading state (combines auth loading and data loading)
  if (loading || !userInfo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Question not found.
          </h2>
          <button
            onClick={() => navigate('/practice')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Practice
          </button>
        </div>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string | undefined) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
      case 'Medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950';
      case 'Hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950';
    }
  };
  
  // Cleaned content for the main question and explanation
  const cleanedQuestionHtml = extractAndCleanHtml(question.question_html, 'question_text');
  const cleanedExplanationHtml = extractAndCleanHtml(question.explanation_html, 'mtq_explanation-text');


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/practice')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Practice
        </button>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {question.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                    {question.difficulty || 'N/A'}
                  </span>
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">GATE {question.year}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div
              ref={questionRef}
              className="text-gray-800 dark:text-gray-200 space-y-4 max-w-none mb-8 prose dark:prose-invert"
            >
              {/* Question HTML content: Now uses the cleaned, extracted HTML */}
              <div dangerouslySetInnerHTML={{ __html: cleanedQuestionHtml }} />
              
              {/* Question Image Links: Still renders external images separately */}
              {question.question_image_links && question.question_image_links.map((imgUrl, index) => (
                <img
                  key={`q-img-${index}`}
                  src={imgUrl}
                  alt={`Question image ${index + 1}`}
                  className="mt-4 rounded-lg border dark:border-gray-700 max-w-full h-auto"
                />
              ))}
            </div>

            {question.question_type === 'nat' ? (
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Answer
                </label>
                <input
                  type="text"
                  value={natAnswer}
                  onChange={(e) => setNatAnswer(e.target.value)}
                  disabled={submitted}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter your numerical answer"
                />
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {question.options.map((option, index) => {
                  const isSelected = selectedOption === option.label;
                  const showResult = submitted;
                  const isCorrectOption = option.is_correct;
                  
                  // Cleaned content for the option (inside 'option_data' div)
                  const cleanedOptionHtml = extractAndCleanHtml(option.text_html, 'option_data');

                  let optionClasses = 'w-full p-4 rounded-lg border-2 text-left transition-all ';

                  if (!submitted) {
                    optionClasses += isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700';
                  } else {
                    if (isCorrectOption) {
                      optionClasses += 'border-green-500 bg-green-50 dark:bg-green-950';
                    } else if (isSelected && !isCorrectOption) {
                      optionClasses += 'border-red-500 bg-red-50 dark:bg-red-950';
                    } else {
                      optionClasses += 'border-gray-200 dark:border-gray-700 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={option.label}
                      ref={el => optionsRef.current[index] = el}
                      onClick={() => !submitted && setSelectedOption(option.label)}
                      disabled={submitted}
                      className={optionClasses}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-semibold text-gray-700 dark:text-gray-300">
                          {option.label}
                        </span>
                        {/* Now using cleanedOptionHtml */}
                        <span className="flex-1 text-gray-900 dark:text-white" dangerouslySetInnerHTML={{ __html: cleanedOptionHtml }} />
                        {showResult && isCorrectOption && (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        )}
                        {showResult && isSelected && !isCorrectOption && (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}


            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={(!selectedOption && question.question_type !== 'nat') || (question.question_type === 'nat' && !natAnswer) || !user}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                {!user ? 'Login to Submit' : 'Submit Answer'}
              </button>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    {isCorrect ? <CheckCircle className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                    <span className={`font-semibold ${isCorrect ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                      {isCorrect ? 'Correct!' : 'Incorrect'} {question.question_type === 'nat' && `The correct answer is ${question.nat_answer}`}
                    </span>
                  </div>
                </div>

                {question.explanation_html && (
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                      Explanation
                    </h3>
                    <div
                      ref={explanationRef}
                      className="space-y-2 max-w-none text-blue-800 dark:text-blue-200 text-sm prose dark:prose-invert"
                    >
                      {/* Explanation HTML content: Now uses the cleaned, extracted HTML */}
                      <div dangerouslySetInnerHTML={{ __html: cleanedExplanationHtml }} />
                      
                      {/* Explanation Image Links */}
                      {question.explanation_image_links && question.explanation_image_links.map((imgUrl, index) => (
                        <img
                          key={`e-img-${index}`}
                          src={imgUrl}
                          alt={`Explanation image ${index + 1}`}
                          className="mt-4 rounded-lg border dark:border-gray-700 max-w-full h-auto"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {findNextQuestionId() && (
                  <button
                    onClick={handleNext}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Next Question
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the component wrapped in the necessary provider
export function QuestionDetail() {
  return (
    <AuthProvider>
      <QuestionDetailComponent />
    </AuthProvider>
  );
}
