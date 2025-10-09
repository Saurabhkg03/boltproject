import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { Question, Submission } from '../data/mockData';

// Declare KaTeX auto-render function from the global scope
declare global {
  interface Window {
    renderMathInElement: (element: HTMLElement, options: any) => void;
  }
}

export function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userInfo, setUserInfo } = useAuth();
  
  const [question, setQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
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

    fetchQuestionData();
  }, [id, user]);

  useEffect(() => {
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
    if (!selectedOption || !user || !question || !userInfo) return;
    if (submitted) return;

    const correctOption = question.options.find(opt => opt.is_correct);
    const userCorrect = selectedOption === correctOption?.label;

    setIsCorrect(userCorrect);
    setSubmitted(true);

    const submissionData: Submission = {
      qid: question.id,
      uid: user.uid,
      correct: userCorrect,
      timestamp: new Date().toISOString(),
      selectedOption: selectedOption,
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
    if(nextId) {
      navigate(`/question/${nextId}`);
    } else {
      navigate('/practice');
    }
  }
  
  if (loading) {
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
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
      case 'Medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950';
      case 'Hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950';
    }
  };
  
  // Helper to remove img tags from HTML, so we can render them cleanly from question_images
  const cleanHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<img[^>]*>/g, "");
  };

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

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {question.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                    {question.difficulty}
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
              className="text-gray-800 dark:text-gray-200 space-y-4 max-w-none mb-8"
            >
              <div dangerouslySetInnerHTML={{ __html: cleanHtml(question.question_html) }} />
              {question.question_images && question.question_images.map((imgUrl, index) => (
                <img 
                  key={`q-img-${index}`} 
                  src={imgUrl} 
                  alt={`Question image ${index + 1}`} 
                  className="mt-4 rounded-lg border dark:border-gray-700 max-w-full h-auto" 
                />
              ))}
            </div>

            <div className="space-y-3 mb-8">
              {question.options.map((option, index) => {
                const isSelected = selectedOption === option.label;
                const showResult = submitted;
                const isCorrectOption = option.is_correct;

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
                      <span className="flex-1 text-gray-900 dark:text-white" dangerouslySetInnerHTML={{ __html: option.text }} />
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

            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={!selectedOption || !user}
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
                      {isCorrect ? 'Correct!' : 'Incorrect'}
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
                      className="space-y-2 max-w-none text-blue-800 dark:text-blue-200 text-sm"
                    >
                      <div dangerouslySetInnerHTML={{ __html: cleanHtml(question.explanation_html) }} />
                      {question.explanation_images && question.explanation_images.map((imgUrl, index) => (
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
