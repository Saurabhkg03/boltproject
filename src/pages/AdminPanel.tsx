import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, PlusCircle, Check, X, Loader2, Edit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, getDocs, doc, updateDoc, query, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { Question } from '../data/mockData.ts';

type AdminView = 'pending' | 'all';

export function AdminPanel() {
  const { userInfo } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [adminView, setAdminView] = useState<AdminView>('pending');


  useEffect(() => {
    if (!userInfo) {
      navigate('/login');
      return;
    }
    
    const fetchQuestions = async () => {
      setLoading(true);
      let q;
      if (userInfo.role === 'admin') {
        // Admin fetches all questions to manage them
        q = query(collection(db, 'questions'));
      } else if (userInfo.role === 'moderator') {
        // Moderator sees all questions they added, regardless of verification status
        q = query(collection(db, 'questions'), where('addedBy', '==', userInfo.uid));
      } else {
        navigate('/'); // Not an admin or mod, redirect
        return;
      }

      try {
        const querySnapshot = await getDocs(q);
        const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setQuestions(questionsData);
      } catch (error) {
        console.error("Error fetching questions for admin panel:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [userInfo, navigate]);
  
  const handleApprove = async (id: string) => {
    const questionRef = doc(db, 'questions', id);
    await updateDoc(questionRef, { verified: true });
    setQuestions(questions.map(q => q.id === id ? { ...q, verified: true } : q));
  };

  const handleApproveAll = async () => {
    // In a real app, you'd want a confirmation modal here instead of window.confirm
    if (window.confirm('Are you sure you want to approve all pending questions?')) {
        setIsApprovingAll(true);
        const pendingQuestions = questions.filter(q => !q.verified);
        if (pendingQuestions.length === 0) {
            setIsApprovingAll(false);
            return;
        }

        const batch = writeBatch(db);
        pendingQuestions.forEach(question => {
            const questionRef = doc(db, 'questions', question.id);
            batch.update(questionRef, { verified: true });
        });

        try {
            await batch.commit();
            setQuestions(questions.map(q => q.verified ? q : { ...q, verified: true }));
        } catch (error) {
            console.error("Error approving all questions:", error);
        } finally {
            setIsApprovingAll(false);
        }
    }
  };

  const handleReject = async (id: string) => {
    // In a real app, you'd want a confirmation modal here instead of window.confirm
    if (window.confirm('Are you sure you want to delete this question? This cannot be undone.')) {
        await deleteDoc(doc(db, 'questions', id));
        setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const displayedQuestions = userInfo?.role === 'admin' && adminView === 'pending'
    ? questions.filter(q => !q.verified)
    : questions;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {userInfo?.role === 'admin' ? 'Admin Panel' : 'Moderator Panel'}
          </h1>
        </div>

        {(userInfo?.role === 'moderator' || userInfo?.role === 'admin') && (
          <div className="mb-6">
            <Link
              to="/add-question"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              Add New Question
            </Link>
          </div>
        )}

        {userInfo?.role === 'admin' && (
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setAdminView('pending')}
                        className={`${ adminView === 'pending' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Pending Verification
                    </button>
                    <button
                        onClick={() => setAdminView('all')}
                        className={`${ adminView === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        All Questions
                    </button>
                </nav>
            </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-xl font-semibold">
              {userInfo?.role === 'admin' 
                ? (adminView === 'pending' ? 'Questions for Verification' : 'All Questions')
                : 'Your Submitted Questions'
              }
            </h2>
            {userInfo?.role === 'admin' && adminView === 'pending' && displayedQuestions.length > 0 && (
                <button
                    onClick={handleApproveAll}
                    disabled={isApprovingAll}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm disabled:bg-gray-400"
                >
                    {isApprovingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4"/>}
                    Approve All ({displayedQuestions.length})
                </button>
            )}
          </div>
          {displayedQuestions.length === 0 ? (
            <p className="p-6 text-gray-500 dark:text-gray-400">
               {userInfo?.role === 'admin' && adminView === 'pending' ? 'No questions are pending verification.' : 'No questions found.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topic</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {displayedQuestions.map((q) => (
                    <tr key={q.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{q.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{q.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{q.topic}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${q.verified ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                {q.verified ? 'Verified' : 'Pending'}
                            </span>
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                            {userInfo?.role === 'admin' && !q.verified && (
                                <>
                                <button onClick={() => handleApprove(q.id)} className="text-green-600 hover:text-green-900 p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/50"><Check className="w-5 h-5"/></button>
                                <button onClick={() => handleReject(q.id)} className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><X className="w-5 h-5"/></button>
                                </>
                            )}
                            <Link to={`/edit-question/${q.id}`} className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50"><Edit className="w-5 h-5"/></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

