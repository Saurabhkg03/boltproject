import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Added Link
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Loader2, BookOpen, Bookmark, Calendar, RefreshCcw, Save, AlertTriangle, Timer as TimerIcon, Play, Pause, LogIn } from 'lucide-react'; // Added LogIn icon

import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// ... (interfaces Question, Submission, UserQuestionData remain the same) ...
interface Question {
  id: string; // The document ID from Firestore
  title: string;
  subject: string;
  topic: string;
  branch: string;
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
interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string;
  selectedOption: string;
  natAnswer?: string;
  timeTaken?: number;
}
interface UserQuestionData {
    isMarkedAsDoubt?: boolean;
    note?: string;
}

// Declare KaTeX auto-render function from the global scope
declare global {
  interface Window {
    renderMathInElement: (element: HTMLElement, options: any) => void;
  }
}

// --- UTILITY FUNCTIONS ---
const extractAndCleanHtml = (html: string, contentClass?: string): string => {
  // ... (extractAndCleanHtml function remains the same) ...
  if (!html) return '';

  let clean = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
  clean = clean.replace(/<img[^>]*>/gi, '');

  if (contentClass) {
    const regex = new RegExp(`<div[^>]*class=["'][^"']*${contentClass}[^"']*["'][^>]*>([\\s\\S]*?)<\/div>`, 'i');
    const match = clean.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return clean.trim();
};

const formatTime = (seconds: number) => {
    // ... (formatTime function remains the same) ...
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};


// --- Login Prompt Component ---
const LoginPrompt = () => {
    const location = useParams(); // Use location to redirect back after login
    return (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium text-center sm:text-left">
                You need to be logged in to attempt questions, track progress, save notes, and use other features.
            </p>
            <Link
                to="/login"
                state={{ from: location }} // Pass current location
                className="flex-shrink-0 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm shadow-md hover:shadow-lg"
            >
                <LogIn className="w-4 h-4" />
                Login / Sign Up
            </Link>
        </div>
    );
};


// --- MAIN APPLICATION COMPONENT ---

export function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Get auth state directly from the central context
  const { user, userInfo, setUserInfo, loading: loadingAuth, isAuthenticated } = useAuth(); // Added isAuthenticated

  const [question, setQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [natAnswer, setNatAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [resetting, setResetting] = useState(false);

  // New state for features
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerOn, setIsTimerOn] = useState(false);
  const [isDoubt, setIsDoubt] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const timerRef = useRef<number | null>(null);

  const questionRef = useRef<HTMLDivElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Combined effect to fetch all question-related data
  useEffect(() => {
    // ... (fetchAllData logic remains largely the same, but fetching user data is conditional) ...
    const fetchAllData = async () => {
      if (!id) return;

      if(timerRef.current) clearInterval(timerRef.current);

      setLoadingData(true); // Use loadingData state
      setSubmitted(false);
      setSelectedOption(null);
      setNatAnswer('');
      setIsDoubt(false);
      setNote('');
      setTimeElapsed(0);
      setIsTimerOn(false);

      try {
        const docRef = doc(db, 'questions', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const fetchedQuestion = { id: docSnap.id, ...docSnap.data() } as Question;
          setQuestion(fetchedQuestion);

          // Fetch user-specific data ONLY if the user is authenticated
          if (user && isAuthenticated && !loadingAuth) {
            const submissionRef = doc(db, `users/${user.uid}/submissions`, id);
            const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);

            const [submissionSnap, userQuestionDataSnap] = await Promise.all([
                getDoc(submissionRef),
                getDoc(userQuestionDataRef)
            ]);

            if (submissionSnap.exists()) {
              const sub = submissionSnap.data() as Submission;
              setSubmitted(true);
              setIsCorrect(sub.correct);
              setSelectedOption(sub.selectedOption || null);
              setNatAnswer(sub.natAnswer || '');
              setTimeElapsed(sub.timeTaken || 0); // Display saved time
            }

            if (userQuestionDataSnap.exists()) {
                const data = userQuestionDataSnap.data() as UserQuestionData;
                setIsDoubt(data.isMarkedAsDoubt || false);
                setNote(data.note || '');
            }
          }
        } else {
          setQuestion(null);
        }

        // Fetch all questions only once if not already fetched
        if (allQuestions.length === 0) {
          const querySnapshot = await getDocs(collection(db, 'questions'));
          const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          // Consistent sorting based on title (numeric part)
          questionsData.sort((a, b) => {
              // Extract numbers more robustly
              const numA = parseInt((a.title || '0').replace(/\D/g,''), 10) || 0;
              const numB = parseInt((b.title || '0').replace(/\D/g,''), 10) || 0;
              return numA - numB;
          });
          setAllQuestions(questionsData);
        }
      } catch (error) {
        console.error("Error fetching question data:", error);
      } finally {
        setLoadingData(false); // Use loadingData state
      }
    };
    // Fetch data regardless of auth state, user-specific data fetch is conditional inside
    fetchAllData();


    return () => {
        if(timerRef.current) clearInterval(timerRef.current);
    }
  // Depend on id, user (to refetch submission state if user changes), loadingAuth (to know when user state is final)
  }, [id, user, loadingAuth, isAuthenticated, setUserInfo]);


    // Dedicated effect for timer logic - Only run if authenticated
    useEffect(() => {
        if (isAuthenticated && isTimerOn && !submitted) {
            timerRef.current = window.setInterval(() => {
                setTimeElapsed(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isAuthenticated, isTimerOn, submitted]); // Add isAuthenticated dependency

  useEffect(() => {
    // ... (KaTeX rendering logic remains the same) ...
    const renderKatex = () => {
        // Guard clause: Exit if still loading, no question, or KaTeX isn't loaded yet.
        if (loadingData || !question || typeof window.renderMathInElement !== 'function') return;

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
        // Render math in the question body
        if (questionRef.current) {
            window.renderMathInElement(questionRef.current, renderOptions);
        }
        // Render math in the explanation only if submitted and explanation exists
        if (submitted && explanationRef.current) {
            window.renderMathInElement(explanationRef.current, renderOptions);
        }
        // Render math in each option button
        optionsRef.current.forEach(el => {
            if (el) window.renderMathInElement(el, renderOptions);
        });
    };

    let katexReadyCheckInterval: number | null = null;

    // Check if KaTeX is loaded, otherwise set an interval to check periodically.
    if (typeof window.renderMathInElement !== 'function') {
        katexReadyCheckInterval = window.setInterval(() => {
            if (typeof window.renderMathInElement === 'function') {
                renderKatex();
                // Clear interval once KaTeX is found
                if(katexReadyCheckInterval !== null) clearInterval(katexReadyCheckInterval);
            }
        }, 100); // Check every 100ms
    } else {
        // KaTeX is already loaded, render after a short delay for React rendering.
        const renderTimeout = setTimeout(renderKatex, 50);
         // Cleanup function for the timeout
         return () => clearTimeout(renderTimeout);
    }

     // Cleanup function for the interval
     return () => {
       if (katexReadyCheckInterval !== null) clearInterval(katexReadyCheckInterval);
     };
  // Re-run this effect if the question data, loading status, or submission status changes.
  }, [question, loadingData, submitted]);

  // --- Interaction Handlers (handleSubmit, handleTryAgain, handleToggleDoubt, handleSaveNote) remain mostly the same, as they already check for `user` ---

  const handleSubmit = async () => {
    // ... (handleSubmit logic remains the same) ...
    if (!user || !question || !userInfo || submitted) return;

    setIsTimerOn(false); // Stop timer on submit

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

    const submissionData: Partial<Submission> = {
      qid: question.id,
      uid: user.uid,
      correct: userCorrect,
      timestamp: new Date().toISOString(),
      selectedOption: selectedOption || '',
      natAnswer: natAnswer,
    };

    if (timeElapsed > 0) {
        submissionData.timeTaken = timeElapsed;
    }

    try {
        await setDoc(doc(db, `users/${user.uid}/submissions`, question.id), submissionData);

        // Update User Stats in Firestore and Context
        const newStats = { ...userInfo.stats };
        newStats.attempted = (newStats.attempted || 0) + 1;
        if (userCorrect) {
          newStats.correct = (newStats.correct || 0) + 1;
        }
        // Prevent division by zero
        newStats.accuracy = newStats.attempted > 0 ? (newStats.correct / newStats.attempted) * 100 : 0;

        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { stats: newStats });

        // Update context immediately for responsive UI
        setUserInfo(prev => prev ? { ...prev, stats: newStats } : null);

    } catch (error) {
        console.error("Error saving submission/updating stats:", error);
        // Optionally revert UI state or show error message
        setSubmitted(false); // Example: Revert submission state on error
        setIsCorrect(false);
    }
  };
  const handleTryAgain = async () => {
    // ... (handleTryAgain logic remains the same) ...
    if (!user || !question || !userInfo || resetting) return;

    setResetting(true);
    try {
        const newStats = { ...userInfo.stats };
        if (newStats.attempted > 0) {
            newStats.attempted -= 1;
            if (isCorrect) { // Only decrement correct count if the *previous* attempt was correct
                newStats.correct -= 1;
            }
        }

        // Ensure correct is not negative
        newStats.correct = Math.max(0, newStats.correct);
        // Prevent division by zero for accuracy
        newStats.accuracy = newStats.attempted > 0 ? (newStats.correct / newStats.attempted) * 100 : 0;

        const userDocRef = doc(db, 'users', user.uid);
        const submissionDocRef = doc(db, `users/${user.uid}/submissions`, question.id);

        // Batch update is safer if needed, but separate calls are okay here
        await updateDoc(userDocRef, { stats: newStats });
        await deleteDoc(submissionDocRef);

        // Update context state
        setUserInfo(prev => prev ? { ...prev, stats: newStats } : null);

        // Reset UI state
        setSubmitted(false);
        setSelectedOption(null);
        setNatAnswer('');
        setIsCorrect(false);
        setTimeElapsed(0);
        setIsTimerOn(false); // Ensure timer is off

    } catch (error) {
        console.error("Error resetting question:", error);
    } finally {
        setResetting(false);
    }
  };
  const handleToggleDoubt = async () => {
    // ... (handleToggleDoubt logic remains the same) ...
    if (!user || !id) return;
    const newDoubtStatus = !isDoubt;
    setIsDoubt(newDoubtStatus); // Update UI immediately
    const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);
    try {
        await setDoc(userQuestionDataRef, { isMarkedAsDoubt: newDoubtStatus }, { merge: true });
    } catch (error) {
        console.error("Error toggling doubt status:", error);
        setIsDoubt(!newDoubtStatus); // Revert UI on error
    }
  }
  const handleSaveNote = async () => {
    // ... (handleSaveNote logic remains the same) ...
      if (!user || !id) return;
      setSavingNote(true);
      const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);
      try {
          await setDoc(userQuestionDataRef, { note: note }, { merge: true });
          // Optionally show a success message briefly
      } catch (error) {
          console.error("Error saving note: ", error);
          // Optionally show an error message
      } finally {
          setSavingNote(false);
      }
  }
  const findNextQuestionId = () => {
    // ... (findNextQuestionId logic remains the same) ...
    if (!id || allQuestions.length === 0) return null;
    const currentIndex = allQuestions.findIndex(q => q.id === id);
    if (currentIndex > -1 && currentIndex < allQuestions.length - 1) {
      return allQuestions[currentIndex + 1].id;
    }
    return null; // No next question found
  };
  const findPrevQuestionId = () => {
    // ... (findPrevQuestionId logic remains the same) ...
    if (!id || allQuestions.length === 0) return null;
    const currentIndex = allQuestions.findIndex(q => q.id === id);
    if (currentIndex > 0) {
      return allQuestions[currentIndex - 1].id;
    }
    return null; // No previous question found
  };
  const handleNext = () => {
    // ... (handleNext logic remains the same) ...
    const nextId = findNextQuestionId();
    if (nextId) {
      navigate(`/question/${nextId}`);
    } else {
      // Maybe show a message "Last question reached" or navigate to practice
       navigate('/practice'); // Navigate back to practice list if no next question
    }
  };
  const handlePrev = () => {
    // ... (handlePrev logic remains the same) ...
    const prevId = findPrevQuestionId();
    if (prevId) {
        navigate(`/question/${prevId}`);
    }
    // Optionally handle the case where there's no previous question (e.g., disable button)
  };


  // Show main loader if the initial question data hasn't loaded yet
  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Handle case where question ID is invalid or question not found
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

  // --- (getDifficultyColor, cleaned HTML variables remain the same) ---
  const getDifficultyColor = (difficulty: string | undefined) => {
    // ... (getDifficultyColor logic remains the same) ...
    switch (difficulty) {
      case 'Easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/50';
      case 'Medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/50';
      case 'Hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50';
    }
  };
  const cleanedQuestionHtml = extractAndCleanHtml(question.question_html, 'question_text');
  const cleanedExplanationHtml = extractAndCleanHtml(question.explanation_html, 'mtq_explanation-text');
  const primaryInfo = new Set([
      question.subject?.toLowerCase(),
      question.topic?.toLowerCase(),
      `gate ${question.year}`.toLowerCase(),
      question.year?.toLowerCase(),
      question.branch?.toLowerCase(),
  ]);
  const otherTags = (question.tags || []).filter(tag => tag && !primaryInfo.has(tag.toLowerCase()));


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Row */}
        <div className="flex justify-between items-center mb-6">
            {/* ... (Prev/Next buttons remain the same) ... */}
            <button
              onClick={handlePrev} // Navigate to previous question
              disabled={!findPrevQuestionId()} // Disable if no previous question
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5" />
              Previous
            </button>
            <button
              onClick={() => navigate('/practice')} // Back to list button
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to Practice List
            </button>
             <button
              onClick={handleNext} // Navigate to next question
              disabled={!findNextQuestionId()} // Disable if no next question
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-5 h-5" />
            </button>
        </div>

        {/* --- ADD LOGIN PROMPT --- */}
        {!loadingAuth && !isAuthenticated && <LoginPrompt />}

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-4">
                 <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex-1">
                    {question.title}
                 </h1>
                 {/* Right-aligned controls */}
                 <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 w-full sm:w-auto justify-end">
                    {/* Timer - Disable button if not authenticated */}
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                        <TimerIcon className="w-4 h-4"/>
                        <span className="text-sm tabular-nums">{formatTime(timeElapsed)}</span>
                         <button
                            onClick={() => setIsTimerOn(!isTimerOn)}
                            // Disable if submitted OR not authenticated
                            disabled={submitted || !isAuthenticated}
                            className="ml-1 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!isAuthenticated ? "Login to use timer" : (isTimerOn ? "Pause timer" : "Start timer")} // Add tooltip
                         >
                             {isTimerOn ? <Pause className="w-3.5 h-3.5"/> : <Play className="w-3.5 h-3.5"/>}
                         </button>
                    </div>
                     {/* Doubt Button - Disable if not authenticated */}
                     <button
                        onClick={handleToggleDoubt}
                        // Disable if not authenticated
                        disabled={!isAuthenticated}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border whitespace-nowrap ${
                            isDoubt
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700'
                            : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={!isAuthenticated ? "Login to mark doubts" : (isDoubt ? "Unmark as doubt" : "Mark as doubt")} // Add tooltip
                     >
                         <AlertTriangle className={`w-3.5 h-3.5 ${isDoubt ? 'fill-current' : ''}`}/>
                         {isDoubt ? 'Marked' : 'Mark'}
                     </button>
                 </div>
             </div>
            {/* ... (Tags and difficulty display remain the same) ... */}
             <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
              <span className={`px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(question.difficulty)}`}>
                {question.difficulty}
              </span>
               <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> {question.subject}
              </span>
               <span className="flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5" /> {question.topic}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> GATE {question.year}
              </span>
            </div>
             {otherTags.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {otherTags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs">
                            {tag}
                        </span>
                    ))}
                </div>
             )}
          </div>

          <div className="p-6">
            {/* ... (Question HTML/Image rendering remains the same) ... */}
            <div
              ref={questionRef}
              className="text-gray-800 dark:text-gray-200 space-y-4 max-w-none mb-8 prose dark:prose-invert prose-sm md:prose-base"
            >
              {/* Render cleaned HTML */}
              <div dangerouslySetInnerHTML={{ __html: cleanedQuestionHtml }} />

              {/* Render image URLs */}
              {question.question_image_links && question.question_image_links.length > 0 && (
                <div className="space-y-4">
                  {question.question_image_links.map((imgUrl, index) => (
                    <img
                      key={`q-img-${index}`}
                      src={imgUrl}
                      alt={`Question illustration ${index + 1}`}
                      className="mt-4 rounded-lg border dark:border-gray-700 max-w-full h-auto mx-auto" // Added mx-auto
                      onError={(e) => { e.currentTarget.style.display = 'none'; /* Hide broken images */ }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* --- Conditionally Disable Options / NAT Input --- */}
            {question.question_type === 'nat' ? (
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Answer
                </label>
                <input
                  type="text"
                  value={natAnswer}
                  onChange={(e) => setNatAnswer(e.target.value)}
                  // Disable if submitted OR not authenticated
                  disabled={submitted || !isAuthenticated}
                  className="w-full max-w-xs px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                  placeholder="Enter numerical answer"
                />
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {question.options.map((option, index) => {
                  const isSelected = selectedOption === option.label;
                  const isCorrectOption = option.is_correct;
                  const cleanedOptionHtml = extractAndCleanHtml(option.text_html, 'option_data');

                  let optionClasses = 'w-full p-4 rounded-lg border-2 text-left transition-all flex items-start gap-3 ';
                  let stateIndicator: React.ReactNode = null;

                  if (!submitted) {
                    optionClasses += isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-700'
                      : 'border-gray-200 dark:border-gray-700';
                    // Add hover effect and cursor only if authenticated
                    if (isAuthenticated) {
                        optionClasses += ' hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer';
                    } else {
                        optionClasses += ' cursor-default opacity-75'; // Dim options slightly for non-logged in
                    }
                  } else {
                     optionClasses += ' cursor-default ';
                    if (isCorrectOption) {
                      optionClasses += 'border-green-500 bg-green-50 dark:bg-green-900/30';
                      stateIndicator = <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />;
                    } else if (isSelected && !isCorrectOption) {
                      optionClasses += 'border-red-500 bg-red-50 dark:bg-red-900/30';
                       stateIndicator = <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />;
                    } else {
                      optionClasses += 'border-gray-200 dark:border-gray-700 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={option.label}
                      ref={el => optionsRef.current[index] = el}
                      // Only allow selection if authenticated and not submitted
                      onClick={() => isAuthenticated && !submitted && setSelectedOption(option.label)}
                      // Disable if submitted OR not authenticated
                      disabled={submitted || !isAuthenticated}
                      className={optionClasses}
                      title={!isAuthenticated ? "Login to select an option" : ""} // Add tooltip
                    >
                        {/* Option Label Circle */}
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center font-semibold text-sm mt-0.5 ${
                            isSelected && !submitted ? 'bg-blue-500 border-blue-500 text-white' :
                            submitted && isCorrectOption ? 'bg-green-500 border-green-500 text-white' :
                            submitted && isSelected && !isCorrectOption ? 'bg-red-500 border-red-500 text-white' :
                            'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}>
                          {option.label}
                        </span>
                        {/* Option Text */}
                        <span className="flex-1 text-gray-900 dark:text-white prose dark:prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: cleanedOptionHtml }} />
                        {/* Result Indicator */}
                        {stateIndicator}
                    </button>
                  );
                })}
              </div>
            )}

            {/* --- Submit/Result Section --- */}
            {/* Show Submit button only if authenticated */}
            {isAuthenticated && !submitted && (
              <button
                onClick={handleSubmit}
                // Disable if option/answer not selected or auth is still loading
                disabled={(!selectedOption && question.question_type !== 'nat') || (question.question_type === 'nat' && !natAnswer) || loadingAuth}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                Submit Answer
              </button>
            )}

            {/* Show Result/Explanation/TryAgain only if submitted (which implies user is authenticated) */}
            {submitted && (
              <div className="space-y-4">
                {/* Result Indicator */}
                <div className={`p-4 rounded-lg border ${isCorrect ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'}`}>
                   {/* ... (Result text remains the same) ... */}
                   <div className="flex items-center gap-3">
                    {isCorrect ? <CheckCircle className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                    <span className={`font-semibold ${isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                      {isCorrect ? 'Correct!' : 'Incorrect.'}
                      {question.question_type === 'nat' && !isCorrect && ` The correct answer is ${question.nat_answer}.`}
                      {question.question_type !== 'nat' && !isCorrect && ` Correct option was ${question.correctAnswerLabel}.`}
                    </span>
                  </div>
                </div>

                {/* Explanation */}
                {cleanedExplanationHtml && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700/50">
                    {/* ... (Explanation content remains the same) ... */}
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 text-lg">
                      Explanation
                    </h3>
                    <div
                      ref={explanationRef}
                      className="space-y-3 max-w-none text-gray-700 dark:text-gray-300 text-sm prose dark:prose-invert prose-sm md:prose-base"
                    >
                      <div dangerouslySetInnerHTML={{ __html: cleanedExplanationHtml }} />

                      {question.explanation_image_links && question.explanation_image_links.length > 0 && (
                          <div className="space-y-4">
                              {question.explanation_image_links.map((imgUrl, index) => (
                                  <img
                                  key={`e-img-${index}`}
                                  src={imgUrl}
                                  alt={`Explanation illustration ${index + 1}`}
                                  className="mt-4 rounded-lg border dark:border-gray-700 max-w-full h-auto mx-auto" // Added mx-auto
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                              ))}
                          </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={handleTryAgain}
                        disabled={resetting} // Try again is only possible if submitted, hence user must be logged in
                        className="flex-1 py-3 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                        Try Again
                    </button>
                   <button
                        onClick={handleNext}
                        disabled={!findNextQuestionId()} // Next button is always available to navigate
                        className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                        Next Question
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
              </div>
            )}
          </div>

           {/* --- Notes Section - Disable if not authenticated --- */}
           {/* Keep the section visible but disable input/button */}
           <div className="p-6 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">My Notes</h3>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    // Disable if not authenticated
                    disabled={!isAuthenticated}
                    placeholder={isAuthenticated ? "Write a short note for this question..." : "Login to save notes."}
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[100px] disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                />
                <button
                    onClick={handleSaveNote}
                    // Disable if not authenticated or already saving
                    disabled={!isAuthenticated || savingNote}
                    className="mt-3 w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {savingNote ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />}
                    Save Note
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}

