import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Loader2, BookOpen, Bookmark, Calendar, RefreshCcw, Save, Timer as TimerIcon, Play, Pause, LogIn, Check as CheckIcon, X as XIcon, FolderPlus, ListPlus, RotateCcw } from 'lucide-react';

import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove, query, serverTimestamp, writeBatch, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Question, Submission, UserQuestionData, QuestionList } from '../data/mockData';

// Declare KaTeX auto-render function from the global scope
declare global {
  interface Window {
    renderMathInElement: (element: HTMLElement, options: any) => void;
  }
}

// --- UTILITY FUNCTIONS ---

const RATING_SCALING_FACTOR = 100;

/**
 * Calculates the user's performance rating.
 * @param {number | undefined} accuracy - The user's accuracy (0-100).
 * @param {number | undefined} correct - The user's total correct answers.
 * @returns {number} The calculated rating.
 */
const calculateRating = (accuracy: number | undefined, correct: number | undefined): number => {
    const safeAccuracy = accuracy ?? 0;
    const safeCorrect = correct ?? 0;
    // Rating = (Accuracy / 100) * log10(CorrectlySolved + 1) * ScalingFactor
    const rating = Math.max(0, (safeAccuracy / 100) * Math.log10(safeCorrect + 1) * RATING_SCALING_FACTOR);
    return parseFloat(rating.toFixed(2));
};

/**
 * Formats a Date object to 'YYYY-MM-DD' string.
 * @param {Date | string} date The date to format.
 * @returns {string | null} A string in 'YYYY-MM-DD' format or null if invalid.
 */
function formatDate(date: Date | string): string | null {
    // Ensure it's a Date object
    if (!(date instanceof Date)) {
        try {
            date = new Date(date);
            if (isNaN(date.getTime())) throw new Error("Invalid date");
        } catch (e) {
            console.warn("Could not parse date:", date, (e as Error).message);
            return null;
        }
    }
    // toISOString() returns 'YYYY-MM-DDTHH:mm:ss.sssZ', we just want the date part.
    return date.toISOString().split('T')[0];
}

/**
 * Calculates the difference in days between two dates.
 * @param {Date} date1 Newer date.
 * @param {Date} date2 Older date.
 * @returns {number} The difference in days.
 */
function getDayDiff(date1: Date, date2: Date): number {
    const d1 = new Date(date1.toDateString()); // Normalize to start of day
    const d2 = new Date(date2.toDateString()); // Normalize to start of day
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

const extractAndCleanHtml = (html: string, contentClass?: string): string => {
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
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

// --- Login Prompt Component ---
const LoginPrompt = () => {
    const location = useParams();
    return (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium text-center sm:text-left">
                You need to be logged in to attempt questions, track progress, save notes, and use other features.
            </p>
            <Link
                to="/login"
                state={{ from: location }}
                className="flex-shrink-0 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm shadow-md hover:shadow-lg"
            >
                <LogIn className="w-4 h-4" />
                Login / Sign Up
            </Link>
        </div>
    );
};

// --- NEW: Lists Management Modal ---
const ListsModal = ({
  isOpen,
  onClose,
  questionId,
  userId
}: {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  userId: string;
}) => {
  const [lists, setLists] = useState<QuestionList[]>([]);
  const [questionListIds, setQuestionListIds] = useState<Set<string>>(new Set());
  const [loadingLists, setLoadingLists] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  // Fetch user's lists and which lists this question is in
  useEffect(() => {
    if (isOpen && userId) {
      const fetchLists = async () => {
        setLoadingLists(true);
        try {
          // Fetch all lists for the user
          const listsQuery = query(collection(db, `users/${userId}/questionLists`), orderBy('createdAt', 'desc'));
          const listsSnapshot = await getDocs(listsQuery);
          const userLists = listsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionList));
          setLists(userLists);

          // Fetch which lists this specific question is in
          const userQuestionDataRef = doc(db, `users/${userId}/userQuestionData`, questionId);
          const userQuestionDataSnap = await getDoc(userQuestionDataRef);
          if (userQuestionDataSnap.exists()) {
            const data = userQuestionDataSnap.data() as UserQuestionData;
            setQuestionListIds(new Set(data.savedListIds || []));
          } else {
            setQuestionListIds(new Set());
          }
        } catch (error) {
          console.error("Error fetching lists:", error);
        } finally {
          setLoadingLists(false);
        }
      };
      fetchLists();
    }
  }, [isOpen, userId, questionId]);

  // Toggle question in a list
  const handleToggleList = (listId: string) => {
    setQuestionListIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  // Create a new list
  const handleCreateList = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newListName.trim() || creatingList) return;
      
      setCreatingList(true);
      try {
          const newListData: Omit<QuestionList, 'id' | 'createdAt'> = { // createdAt will be set by server
              uid: userId,
              name: newListName.trim(),
              questionIds: [questionId], // Automatically add current question
              isPrivate: false,
          };
          
          const listCollectionRef = collection(db, `users/${userId}/questionLists`);
          // Add server timestamp
          const docRef = await addDoc(listCollectionRef, {
              ...newListData,
              createdAt: serverTimestamp() 
          });
          
          // Add new list to local state
          setLists(prev => [{ ...newListData, id: docRef.id, questionIds: [questionId], createdAt: new Date().toISOString() }, ...prev]);
          // Add to selected lists
          handleToggleList(docRef.id);
          setNewListName("");
          
      } catch (error) {
          console.error("Error creating new list:", error);
      } finally {
          setCreatingList(false);
      }
  };

  // Save all changes
  const handleSaveChanges = async () => {
    setSaving(true);
    const batch = writeBatch(db);
    const newSavedListIds = Array.from(questionListIds);

    // 1. Update the UserQuestionData doc
    const userQuestionDataRef = doc(db, `users/${userId}/userQuestionData`, questionId);
    batch.set(userQuestionDataRef, { savedListIds: newSavedListIds }, { merge: true });

    // 2. Update all list docs
    lists.forEach(list => {
      const questionIsInList = list.questionIds && list.questionIds.includes(questionId);
      const questionShouldBeInList = questionListIds.has(list.id);
      
      const listRef = doc(db, `users/${userId}/questionLists`, list.id);

      if (questionShouldBeInList && !questionIsInList) {
        // Add question to list
        batch.update(listRef, { questionIds: arrayUnion(questionId) });
      } else if (!questionShouldBeInList && questionIsInList) {
        // Remove question from list
        batch.update(listRef, { questionIds: arrayRemove(questionId) });
      }
    });

    try {
      await batch.commit();
      onClose(); // Close modal on success
    } catch (error) {
      console.error("Error saving list changes:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 max-w-md w-full relative transform transition-all" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Save to...</h3>
        
        {loadingLists ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        ) : (
            <>
                {/* New List Form */}
                <form onSubmit={handleCreateList} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        placeholder="Create new list..."
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    />
                    <button type="submit" disabled={creatingList || !newListName.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-600">
                        {creatingList ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderPlus className="w-5 h-5" />}
                    </button>
                </form>

                {/* Lists Checkboxes */}
                <div className="max-h-60 overflow-y-auto space-y-2 mb-4 pr-1">
                    {lists.length === 0 && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No lists created yet.</p>
                    )}
                    {lists.map(list => (
                        <label
                            key={list.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={questionListIds.has(list.id)}
                                onChange={() => handleToggleList(list.id)}
                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{list.name}</span>
                        </label>
                    ))}
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="w-full py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 flex items-center justify-center gap-2"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckIcon className="w-5 h-5" />}
                    Done
                </button>
            </>
        )}
      </div>
    </div>
  );
};


// --- MAIN APPLICATION COMPONENT ---
export function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userInfo, setUserInfo, loading: loadingAuth, isAuthenticated } = useAuth();

  const [question, setQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [natAnswer, setNatAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  const [showListModal, setShowListModal] = useState(false);

  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerOn, setIsTimerOn] = useState(false);
  const timerRef = useRef<number | null>(null);

  const questionRef = useRef<HTMLDivElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleResetTimer = () => {
    setTimeElapsed(0);
  };

  useEffect(() => {
    const fetchAllData = async () => {
      if (!id) return;
      if(timerRef.current) clearInterval(timerRef.current);
      setLoadingData(true);
      setSubmitted(false);
      setSelectedOptions([]);
      setNatAnswer('');
      setIsFavorite(false);
      setNote('');
      setTimeElapsed(0);
      setIsTimerOn(false);

      try {
        const docRef = doc(db, 'questions', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const fetchedQuestion = { id: docSnap.id, ...docSnap.data() } as Question;
          setQuestion(fetchedQuestion);

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
              setSelectedOptions(sub.selectedOptions || []);
              setNatAnswer(sub.natAnswer || '');
              setTimeElapsed(sub.timeTaken || 0);
            }
            if (userQuestionDataSnap.exists()) {
                const data = userQuestionDataSnap.data() as UserQuestionData;
                setIsFavorite(data.isFavorite || false);
                setNote(data.note || '');
            }
          }
        } else {
          setQuestion(null);
        }

        // Fetch all questions only once if not already fetched
        if (allQuestions.length === 0) {
          const questionsQuery = query(collection(db, 'questions'), orderBy('title'));
          const querySnapshot = await getDocs(questionsQuery);
          const questionsData = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Question));
          questionsData.sort((a, b) => {
              const numA = parseInt((a.title || '0').replace(/\D/g,''), 10) || 0;
              const numB = parseInt((b.title || '0').replace(/\D/g,''), 10) || 0;
              return numA - numB;
          });
          setAllQuestions(questionsData);
        }
      } catch (error) {
        console.error("Error fetching question data:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAllData();

    return () => {
        if(timerRef.current) clearInterval(timerRef.current);
    }
  }, [id, user, loadingAuth, isAuthenticated, setUserInfo]); // Removed allQuestions


    // Dedicated effect for timer logic
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
    }, [isAuthenticated, isTimerOn, submitted]);

  useEffect(() => {
    const renderKatex = () => {
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
        if (questionRef.current) {
            window.renderMathInElement(questionRef.current, renderOptions);
        }
        if (submitted && explanationRef.current) {
            window.renderMathInElement(explanationRef.current, renderOptions);
        }
        optionsRef.current.forEach(el => {
            if (el) window.renderMathInElement(el, renderOptions);
        });
    };

    let katexReadyCheckInterval: number | null = null;

    if (typeof window.renderMathInElement !== 'function') {
        katexReadyCheckInterval = window.setInterval(() => {
            if (typeof window.renderMathInElement === 'function') {
                renderKatex();
                if(katexReadyCheckInterval !== null) clearInterval(katexReadyCheckInterval);
            }
        }, 100);
    } else {
        const renderTimeout = setTimeout(renderKatex, 50);
        return () => clearTimeout(renderTimeout);
    }

    return () => {
      if (katexReadyCheckInterval !== null) clearInterval(katexReadyCheckInterval);
    };
  }, [question, loadingData, submitted]);

  const handleMcqSelect = (label: string) => {
    if (submitted || !isAuthenticated) return;
    setSelectedOptions([label]);
  };

  const handleMsqToggle = (label: string) => {
    if (submitted || !isAuthenticated) return;
    setSelectedOptions(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };


  // --- *** UPDATED: handleSubmit with incremental stats *** ---
  const handleSubmit = async () => {
    if (!user || !question || !userInfo || submitted) return;
    setIsTimerOn(false);
    let userCorrect = false;
    const today = new Date();
    const todayStr = formatDate(today); // 'YYYY-MM-DD'
    if (!todayStr) {
        console.error("Could not format today's date.");
        return;
    }

    if (question.question_type === 'nat') {
      const userAnswer = parseFloat(natAnswer.trim());
      const min = parseFloat(question.nat_answer_min || '-Infinity');
      const max = parseFloat(question.nat_answer_max || 'Infinity');
      if (isNaN(userAnswer)) {
          userCorrect = false;
      } else {
          userCorrect = userAnswer >= min && userAnswer <= max;
      }
    } else if (question.question_type === 'msq') {
      const correctLabels = new Set(question.options.filter(o => o.is_correct).map(o => o.label));
      const selectedLabels = new Set(selectedOptions);
      userCorrect = correctLabels.size === selectedLabels.size &&
                    [...correctLabels].every(label => selectedLabels.has(label));
    } else {
      if (!selectedOptions[0]) return;
      const correctOption = question.options.find(opt => opt.is_correct);
      userCorrect = selectedOptions[0] === correctOption?.label;
    }
    
    setIsCorrect(userCorrect);
    setSubmitted(true);

    // 1. Create submission document
    // --- FIX: Use Partial<Submission> and conditionally add timeTaken ---
    const submissionData: Partial<Submission> = {
      qid: question.id,
      uid: user.uid,
      correct: userCorrect,
      timestamp: today.toISOString(),
      selectedOptions: selectedOptions, 
      natAnswer: natAnswer,
      // timeTaken is omitted if 0
    };

    if (timeElapsed > 0) {
        submissionData.timeTaken = timeElapsed; // Conditionally add the field
    }
    // --- END FIX ---

    try {
      // 2. Get current user data for incremental update
      // We use userInfo from context as the "old data"
      const oldStats = userInfo.stats || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
      const oldStreak = userInfo.streakData || { currentStreak: 0, lastSubmissionDate: '' };
      const oldCalendar = userInfo.activityCalendar || {};

      // 3. Calculate new stats
      const newStats = { ...oldStats, subjects: { ...(oldStats.subjects || {}) } };
      newStats.attempted = (newStats.attempted || 0) + 1;
      if (userCorrect) {
        newStats.correct = (newStats.correct || 0) + 1;
        // Update subject stats
        const subject = question.subject;
        if (subject && subject !== "General" && subject !== "N/A") {
          newStats.subjects[subject] = (newStats.subjects[subject] || 0) + 1;
        }
      }
      newStats.accuracy = newStats.attempted > 0 ? parseFloat(((newStats.correct / newStats.attempted) * 100).toFixed(2)) : 0;

      // 4. Calculate new streak
      const newStreakData = { ...oldStreak };
      if (todayStr !== oldStreak.lastSubmissionDate) {
        const lastSubDate = oldStreak.lastSubmissionDate ? new Date(oldStreak.lastSubmissionDate + 'T00:00:00') : null;
        if (lastSubDate && getDayDiff(today, lastSubDate) === 1) {
            newStreakData.currentStreak = (oldStreak.currentStreak || 0) + 1;
        } else {
            newStreakData.currentStreak = 1; // Reset or start streak
        }
        newStreakData.lastSubmissionDate = todayStr;
      }

      // 5. Calculate new calendar
      const newCalendar = { ...oldCalendar };
      newCalendar[todayStr] = (newCalendar[todayStr] || 0) + 1;

      // 6. Calculate new rating
      const newRating = calculateRating(newStats.accuracy, newStats.correct);

      // 7. Write all updates to the database
      const userDocRef = doc(db, 'users', user.uid);
      const submissionDocRef = doc(db, `users/${user.uid}/submissions`, question.id);

      // Use a batch write for atomicity (submission + user stats)
      const batch = writeBatch(db);
      batch.set(submissionDocRef, submissionData); // Save the submission
      batch.update(userDocRef, { // Update the main user doc
          stats: newStats,
          streakData: newStreakData,
          activityCalendar: newCalendar,
          rating: newRating
      });
      
      await batch.commit();
      console.log("Successfully submitted and updated user stats.");

      // 8. Update local context state immediately
      // This provides a snappy UI response while the onSnapshot listener confirms the change
      setUserInfo(prev => prev ? {
          ...prev,
          stats: newStats,
          streakData: newStreakData,
          activityCalendar: newCalendar,
          rating: newRating
      } : null);

    } catch (error) {
        console.error("Error saving submission/updating stats:", error);
        // Revert UI on failure
        setSubmitted(false);
        setIsCorrect(false);
    }
  };
  
  // --- *** UPDATED: handleTryAgain with incremental stats *** ---
  const handleTryAgain = async () => {
    if (!user || !question || !userInfo || resetting) return;
    setResetting(true);

    try {
        // 1. Get old data from context
        const oldStats = userInfo.stats || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };

        // 2. Calculate new stats by reverting
        const newStats = { ...oldStats, subjects: { ...(oldStats.subjects || {}) } };
        
        if (newStats.attempted > 0) {
            newStats.attempted -= 1;
        }
        if (isCorrect && newStats.correct > 0) {
            newStats.correct -= 1;
            // Revert subject stats
            const subject = question.subject;
            if (subject && subject !== "General" && subject !== "N/A" && newStats.subjects[subject] > 0) {
                newStats.subjects[subject] -= 1;
            }
        }
        newStats.accuracy = newStats.attempted > 0 ? parseFloat(((newStats.correct / newStats.attempted) * 100).toFixed(2)) : 0;

        // 3. Calculate new rating
        const newRating = calculateRating(newStats.accuracy, newStats.correct);
        
        // 4. Write all updates
        // NOTE: We do NOT update calendar or streak here.
        // It's too complex to revert, and the migration script can fix any rare discrepancies.
        const userDocRef = doc(db, 'users', user.uid);
        const submissionDocRef = doc(db, `users/${user.uid}/submissions`, question.id);

        const batch = writeBatch(db);
        batch.delete(submissionDocRef); // Delete the submission
        batch.update(userDocRef, { // Update stats and rating
            stats: newStats,
            rating: newRating
        });

        await batch.commit();
        console.log("Successfully reset submission and updated user stats.");

        // 5. Update local context state immediately
        setUserInfo(prev => prev ? { 
            ...prev, 
            stats: newStats, 
            rating: newRating 
        } : null);

        // 6. Reset local page state
        setSubmitted(false);
        setSelectedOptions([]);
        setNatAnswer('');
        setIsCorrect(false);
        setTimeElapsed(0);
        setIsTimerOn(false);

    } catch (error) {
        console.error("Error resetting question:", error);
    } finally {
        setResetting(false);
    }
  };
  
  const handleToggleFavorite = async () => {
    if (!user || !id) return;
    const newFavoriteStatus = !isFavorite;
    setIsFavorite(newFavoriteStatus); // Update UI immediately
    const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);
    try {
        await setDoc(userQuestionDataRef, { isFavorite: newFavoriteStatus }, { merge: true });
    } catch (error) {
        console.error("Error toggling favorite status:", error);
        setIsFavorite(!newFavoriteStatus); // Revert UI on error
    }
  }

  const handleSaveNote = async () => {
      if (!user || !id) return;
      setSavingNote(true);
      const userQuestionDataRef = doc(db, `users/${user.uid}/userQuestionData`, id);
      try {
          await setDoc(userQuestionDataRef, { note: note }, { merge: true });
      } catch (error) {
          console.error("Error saving note: ", error);
      } finally {
          setSavingNote(false);
      }
  }
  
  const findNextQuestionId = () => {
    if (!id || allQuestions.length === 0) return null;
    const currentIndex = allQuestions.findIndex(q => q.id === id);
    if (currentIndex > -1 && currentIndex < allQuestions.length - 1) {
      return allQuestions[currentIndex + 1].id;
    }
    return null;
  };
  const findPrevQuestionId = () => {
    if (!id || allQuestions.length === 0) return null;
    const currentIndex = allQuestions.findIndex(q => q.id === id);
    if (currentIndex > 0) {
      return allQuestions[currentIndex - 1].id;
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
  };
  const handlePrev = () => {
    const prevId = findPrevQuestionId();
    if (prevId) {
        navigate(`/question/${prevId}`);
    }
  };

  if (loadingData) {
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
  
  const cleanedQuestionHtml = extractAndCleanHtml(question.question_html, 'question_text');
  const cleanedExplanationHtml = extractAndCleanHtml(question.explanation_html, 'mtq_explanation-text');
  const primaryInfo = new Set([
      question.subject?.toLowerCase(),
      question.topic?.toLowerCase(),
      `gate ${question.year}`.toLowerCase(),
      question.year?.toLowerCase(),
      (question as any).branch?.toLowerCase(),
  ]);
  const otherTags = (question.tags || []).filter(tag => tag && !primaryInfo.has(tag.toLowerCase()));


  return (
    <>
      {/* NEW: Lists Modal */}
      {isAuthenticated && user && id && (
        <ListsModal
          isOpen={showListModal}
          onClose={() => setShowListModal(false)}
          questionId={id}
          userId={user.uid}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Navigation Row */}
          <div className="flex justify-between items-center mb-6">
              <button onClick={handlePrev} disabled={!findPrevQuestionId()} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowLeft className="w-5 h-5" /> Previous
              </button>
              <button onClick={() => navigate('/practice')} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Back to Practice List
              </button>
              <button onClick={handleNext} disabled={!findNextQuestionId()} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Next <ArrowRight className="w-5 h-5" />
              </button>
          </div>

          {!loadingAuth && !isAuthenticated && <LoginPrompt />}

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-4">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex-1">
                      {question.title}
                    </h1>
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 w-full sm:w-auto justify-end">
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                            <TimerIcon className="w-4 h-4"/>
                            <span className="text-sm tabular-nums">{formatTime(timeElapsed)}</span>
                            <button
                              onClick={() => setIsTimerOn(!isTimerOn)}
                              disabled={submitted || !isAuthenticated}
                              className="ml-1 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!isAuthenticated ? "Login to use timer" : (isTimerOn ? "Pause timer" : "Start timer")}
                            >
                                {isTimerOn ? <Pause className="w-3.5 h-3.5"/> : <Play className="w-3.5 h-3.5"/>}
                            </button>
                            {/* MODIFIED: Added reset timer button */}
                            <button
                              onClick={handleResetTimer}
                              disabled={submitted || !isAuthenticated || timeElapsed === 0}
                              className="ml-0.5 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!isAuthenticated ? "Login to reset timer" : "Reset timer"}
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        
                        {/* MODIFIED: Favorite (Bookmark) Button */}
                          <button
                            onClick={handleToggleFavorite}
                            disabled={!isAuthenticated}
                            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border whitespace-nowrap ${
                                isFavorite
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700'
                                : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={!isAuthenticated ? "Login to add to Favorites" : (isFavorite ? "Remove from Favorites" : "Add to Favorites")}
                          >
                              <Bookmark className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`}/>
                              {isFavorite ? 'Favorited' : 'Favorite'}
                          </button>

                        {/* NEW: Save to List Button */}
                          <button
                            onClick={() => setShowListModal(true)}
                            disabled={!isAuthenticated}
                            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!isAuthenticated ? "Login to save to lists" : "Save to list"}
                          >
                              <ListPlus className="w-3.5 h-3.5" />
                              Save
                          </button>

                    </div>
                </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
                {/* MODIFIED: Removed Difficulty span */}
                <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {question.subject}</span>
                <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" /> {question.topic}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> GATE {question.year}</span>
              </div>
              {otherTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {otherTags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs">{tag}</span>
                      ))}
                  </div>
              )}
            </div>

            <div className="p-6">
              <div ref={questionRef} className="text-gray-800 dark:text-gray-200 space-y-4 max-w-none mb-8 prose dark:prose-invert prose-sm md:prose-base">
                <div dangerouslySetInnerHTML={{ __html: cleanedQuestionHtml }} />
                {question.question_image_links && question.question_image_links.length > 0 && (
                  <div className="space-y-4">
                    {question.question_image_links.map((imgUrl, index) => (
                      <img key={`q-img-${index}`} src={imgUrl} alt={`Question illustration ${index + 1}`} className="mt-4 rounded-lg border dark:border-gray-700 max-w-full h-auto mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                )}
              </div>

              {/* --- MODIFIED: Options Rendering Logic --- */}
              {question.question_type === 'nat' ? (
                // NAT Input
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Answer</label>
                  <input type="text" value={natAnswer} onChange={(e) => setNatAnswer(e.target.value)} disabled={submitted || !isAuthenticated} className="w-full max-w-xs px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed" placeholder="Enter numerical answer" />
                </div>
              ) : question.question_type === 'msq' ? (
                // MSQ Checkboxes
                <div className="space-y-3 mb-8">
                  {question.options.map((option, index) => {
                    const isSelected = selectedOptions.includes(option.label);
                    const isCorrectOption = option.is_correct;
                    const cleanedOptionHtml = extractAndCleanHtml(option.text_html, 'option_data');
                    let optionClasses = 'w-full p-4 rounded-lg border-2 text-left transition-all flex items-start gap-3 ';
                    let stateIndicator: React.ReactNode = null;
                    if (!submitted) {
                      optionClasses += isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-700' : 'border-gray-200 dark:border-gray-700';
                      if (isAuthenticated) optionClasses += ' hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer';
                      else optionClasses += ' cursor-default opacity-75';
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
                      <button key={option.label} ref={el => optionsRef.current[index] = el} onClick={() => handleMsqToggle(option.label)} disabled={submitted || !isAuthenticated} className={optionClasses} title={!isAuthenticated ? "Login to select an option" : ""}>
                          <span className={`flex-shrink-0 w-7 h-7 rounded-md border-2 flex items-center justify-center font-semibold text-sm mt-0.5 ${ isSelected && !submitted ? 'bg-blue-500 border-blue-500 text-white' : submitted && isCorrectOption ? 'bg-green-500 border-green-500 text-white' : submitted && isSelected && !isCorrectOption ? 'bg-red-500 border-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' }`}>
                              {/* Show checkmark if selected, otherwise label */}
                              {isSelected ? <CheckIcon className="w-4 h-4" /> : option.label}
                          </span>
                          <span className="flex-1 text-gray-900 dark:text-white prose dark:prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: cleanedOptionHtml }} />
                          {stateIndicator}
                      </button>
                    );
                  })}
                </div>
              ) : (
                // MCQ Radio Buttons
                <div className="space-y-3 mb-8">
                  {question.options.map((option, index) => {
                    const isSelected = selectedOptions[0] === option.label;
                    const isCorrectOption = option.is_correct;
                    const cleanedOptionHtml = extractAndCleanHtml(option.text_html, 'option_data');
                    let optionClasses = 'w-full p-4 rounded-lg border-2 text-left transition-all flex items-start gap-3 ';
                    let stateIndicator: React.ReactNode = null;
                    if (!submitted) {
                      optionClasses += isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-700' : 'border-gray-200 dark:border-gray-700';
                      if (isAuthenticated) optionClasses += ' hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer';
                      else optionClasses += ' cursor-default opacity-75';
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
                      <button key={option.label} ref={el => optionsRef.current[index] = el} onClick={() => handleMcqSelect(option.label)} disabled={submitted || !isAuthenticated} className={optionClasses} title={!isAuthenticated ? "Login to select an option" : ""}>
                          <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center font-semibold text-sm mt-0.5 ${ isSelected && !submitted ? 'bg-blue-500 border-blue-500 text-white' : submitted && isCorrectOption ? 'bg-green-500 border-green-500 text-white' : submitted && isSelected && !isCorrectOption ? 'bg-red-500 border-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' }`}>
                            {option.label}
                          </span>
                          <span className="flex-1 text-gray-900 dark:text-white prose dark:prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: cleanedOptionHtml }} />
                          {stateIndicator}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* --- End Options --- */}


              {isAuthenticated && !submitted && (
                <button 
                  onClick={handleSubmit} 
                  disabled={(!selectedOptions.length && (question.question_type === 'mcq' || question.question_type === 'msq')) || (question.question_type === 'nat' && !natAnswer) || loadingAuth} 
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Answer
                </button>
              )}
              {submitted && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border ${isCorrect ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'}`}>
                      <div className="flex items-center gap-3">
                        {isCorrect ? <CheckCircle className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                        <span className={`font-semibold ${isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                          {isCorrect ? 'Correct!' : 'Incorrect.'}
                          {/* MODIFIED: Show correct answer label(s) */}
                          {/* --- FIX: Show correct NAT range --- */}
                          {question.question_type === 'nat' && !isCorrect && ` The correct answer is between ${question.nat_answer_min || 'N/A'} and ${question.nat_answer_max || 'N/A'}.`}
                          {/* --- END FIX --- */}
                          {question.question_type === 'mcq' && !isCorrect && ` Correct option was ${question.options.find(o => o.is_correct)?.label}.`}
                          {question.question_type === 'msq' && !isCorrect && ` Correct options were ${question.options.filter(o => o.is_correct).map(o => o.label).join(', ')}.`}
                        </span>
                      </div>
                  </div>
                  {cleanedExplanationHtml && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700/50">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 text-lg">Explanation</h3>
                      <div ref={explanationRef} className="space-y-3 max-w-none text-gray-700 dark:text-gray-300 text-sm prose dark:prose-invert prose-sm md:prose-base">
                        <div dangerouslySetInnerHTML={{ __html: cleanedExplanationHtml }} />
                        {question.explanation_image_links && question.explanation_image_links.length > 0 && (
                            <div className="space-y-4">
                                {question.explanation_image_links.map((imgUrl, index) => (
                                    <img key={`e-img-${index}`} src={imgUrl} alt={`Explanation illustration ${index + 1}`} className="mt-4 rounded-lg border dark:border-gray-700 max-w-full h-auto mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                                ))}
                            </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={handleTryAgain} disabled={resetting} className="flex-1 py-3 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                          {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                          Try Again
                      </button>
                    <button onClick={handleNext} disabled={!findNextQuestionId()} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:cursor-not-allowed">
                          Next Question <ArrowRight className="w-5 h-5" />
                      </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">My Notes</h3>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!isAuthenticated} placeholder={isAuthenticated ? "Write a short note for this question..." : "Login to save notes."} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[100px] disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"/>
                <button onClick={handleSaveNote} disabled={!isAuthenticated || savingNote} className="mt-3 w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {savingNote ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />}
                    Save Note
                </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

