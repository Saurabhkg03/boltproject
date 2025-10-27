import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, PlusCircle, Check, X, Loader2, Edit, ChevronLeft, ChevronRight } from 'lucide-react'; // Added pagination icons
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  deleteDoc,
  writeBatch,
  orderBy, // Added orderBy
  limit,   // Added limit
  startAfter, // Added startAfter
  endBefore, // Added endBefore
  limitToLast, // Added limitToLast
  getCountFromServer, // Added getCountFromServer
  DocumentSnapshot, // Added DocumentSnapshot
  Query,           // Import Query type
  DocumentData,    // Import DocumentData type
  CollectionReference // Import CollectionReference type
} from 'firebase/firestore';
import { Question } from '../data/mockData.ts';
// Assuming you might create a skeleton for this later, but using Loader2 for now
// import { AdminPanelSkeleton } from '../components/Skeletons.tsx';

type AdminView = 'pending' | 'all';
const PAGE_SIZE = 15; // Set page size for admin panel

export function AdminPanel() {
  const { userInfo, loading: authLoading } = useAuth(); // Use auth loading state
  const navigate = useNavigate();

  // Data State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Renamed loading state
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [adminView, setAdminView] = useState<AdminView>('pending');
  const [queryError, setQueryError] = useState(''); // State for query errors

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch Questions Function with Pagination
  const fetchQuestions = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
    if (!userInfo) return; // Should not happen due to initial check, but good practice

    if (direction === 'first') setLoadingData(true);
    else setLoadingMore(true);
    setQueryError('');

    try {
      // Fix: Initialize baseQuery as a Query type directly
      let baseQuery: Query<DocumentData, DocumentData> = query(collection(db, 'questions'));
      let countQuery = baseQuery; // Start count query from the initial base query

      // Apply base filters based on role and view
      if (userInfo.role === 'admin') {
        if (adminView === 'pending') {
          // Reassign baseQuery and countQuery with the new filtered query
          baseQuery = query(baseQuery, where('verified', '==', false));
          countQuery = query(countQuery, where('verified', '==', false));
        }
        // No additional filter needed for 'all' view for admin
      } else if (userInfo.role === 'moderator') {
         // Reassign baseQuery and countQuery with the new filtered query
        baseQuery = query(baseQuery, where('addedBy', '==', userInfo.uid));
        countQuery = query(countQuery, where('addedBy', '==', userInfo.uid));
      } else {
        navigate('/'); // Should not be here
        return;
      }

      // Fetch total count for pagination (using the potentially filtered countQuery)
      if (direction === 'first') {
        const snapshot = await getCountFromServer(countQuery);
        setTotalQuestions(snapshot.data().count);
      }

      // Add ordering (important for pagination consistency) to the baseQuery
      let dataQuery = query(baseQuery, orderBy('title')); // Order by title by default

      // Apply pagination logic
      if (direction === 'next' && lastVisible) {
        dataQuery = query(dataQuery, startAfter(lastVisible), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisible) {
        dataQuery = query(dataQuery, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      } else { // 'first' or initial load
        dataQuery = query(dataQuery, limit(PAGE_SIZE));
      }

      const documentSnapshots = await getDocs(dataQuery);
      const questionsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

      console.log(`AdminPanel: Fetched ${documentSnapshots.docs.length} documents.`);

      // Reverse order if fetching previous page
      setQuestions(direction === 'prev' ? questionsData.reverse() : questionsData);

      // Update cursors
      if (documentSnapshots.docs.length > 0) {
        // Correctly get first/last doc based on potential reversal
        if (direction === 'prev') {
             setFirstVisible(documentSnapshots.docs[0]); // First doc before reversal
             setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]); // Last doc before reversal
        } else {
             setFirstVisible(documentSnapshots.docs[0]);
             setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        }
      } else if (direction !== 'prev') {
        setFirstVisible(null);
        setLastVisible(null);
      }

      setCurrentPage(page);

    } catch (error: any) {
        console.error("Error fetching questions for admin panel:", error);
        if (error.code === 'failed-precondition') {
            setQueryError(`Firestore query failed because a database index is missing. This usually happens when combining filters ('${adminView === 'pending' ? 'verified == false' : 'all'}') and sorting. Open your browser's developer console for a link to create the required index automatically.`);
            console.error(error.message); // Log the full error message
        } else {
            setQueryError('An unexpected error occurred while fetching questions.');
        }
        setQuestions([]);
        setTotalQuestions(0);
        setFirstVisible(null);
        setLastVisible(null);
    } finally {
      setLoadingData(false);
      setLoadingMore(false);
    }
  }, [userInfo, adminView, lastVisible, firstVisible, navigate]);

  // Effect for initial load and view changes
  useEffect(() => {
    if (!authLoading && !userInfo) {
      navigate('/login');
      return;
    }
    if (userInfo) {
        // Reset pagination and fetch first page when view or user changes
        setLastVisible(null);
        setFirstVisible(null);
        fetchQuestions(1, 'first');
    }
   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo, adminView, authLoading, navigate]); // fetchQuestions is memoized

  const handleApprove = async (id: string) => {
    try {
        const questionRef = doc(db, 'questions', id);
        await updateDoc(questionRef, { verified: true });
        // Update local state: remove from pending or update in all view
        if(adminView === 'pending'){
            setQuestions(prev => prev.filter(q => q.id !== id));
            setTotalQuestions(prev => Math.max(0, prev -1)); // Decrement total count safely
        } else {
            setQuestions(prev => prev.map(q => q.id === id ? { ...q, verified: true } : q));
        }
    } catch (error) {
        console.error("Error approving question:", error);
        // Add user feedback here (e.g., toast notification)
        setQueryError(`Failed to approve question ${id}.`);
    }
  };

  const handleApproveAll = async () => {
    if (!userInfo || userInfo.role !== 'admin' || adminView !== 'pending') return;

    // Fetch all pending question IDs first
    setIsApprovingAll(true);
    setQueryError('');
    let allPendingIds: string[] = [];
    try {
        // Query only for IDs to minimize data transfer
        const pendingQuery = query(collection(db, 'questions'), where('verified', '==', false));
        const snapshot = await getDocs(pendingQuery);
        allPendingIds = snapshot.docs.map(doc => doc.id);

        if (allPendingIds.length === 0) {
            setIsApprovingAll(false);
            setQueryError('No questions currently pending approval.'); // Inform user
            return; // No pending questions
        }

        // Confirmation (consider a modal in production)
        if (!window.confirm(`Are you sure you want to approve all ${allPendingIds.length} pending questions?`)) {
            setIsApprovingAll(false);
            return;
        }

        // Batch update in chunks to avoid exceeding limits (Firestore batch limit is 500 writes)
        const MAX_WRITES_PER_BATCH = 500;
        for (let i = 0; i < allPendingIds.length; i += MAX_WRITES_PER_BATCH) {
            const batch = writeBatch(db);
            const chunk = allPendingIds.slice(i, i + MAX_WRITES_PER_BATCH);
            chunk.forEach(id => {
                const questionRef = doc(db, 'questions', id);
                batch.update(questionRef, { verified: true });
            });
            console.log(`Approving batch ${i / MAX_WRITES_PER_BATCH + 1}...`);
            await batch.commit();
        }

        // Refetch the current page to reflect changes and update count
        fetchQuestions(1, 'first'); // Go back to first page after mass approval

    } catch (error) {
        console.error("Error approving all questions:", error);
        setQueryError('Failed to approve all questions. Please try again.');
    } finally {
        setIsApprovingAll(false);
    }
  };


  const handleReject = async (id: string) => {
    // Confirmation (use a modal in production)
    if (window.confirm('Are you sure you want to DELETE this question? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, 'questions', id));
            // Refetch current page data to reflect deletion and update count
            // Check if deleting the last item on a page > 1
            if (questions.length === 1 && currentPage > 1) {
                // Go to previous page after deletion
                fetchQuestions(currentPage - 1, 'prev');
            } else {
                // Otherwise, just refetch the current page
                fetchQuestions(currentPage, 'first'); // Use 'first' to recalculate total
            }
        } catch(error){
            console.error("Error deleting question:", error);
            setQueryError(`Failed to delete question ${id}.`);
        }
    }
  };

  // Pagination Handlers
  const handleNextPage = () => {
    // Ensure lastVisible exists before attempting to fetch next
    if (!loadingMore && lastVisible && (currentPage * PAGE_SIZE < totalQuestions)) {
      fetchQuestions(currentPage + 1, 'next');
    }
  };

  const handlePrevPage = () => {
     // Ensure firstVisible exists before attempting to fetch previous
    if (!loadingMore && firstVisible && currentPage > 1) {
       fetchQuestions(currentPage - 1, 'prev');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalQuestions / PAGE_SIZE));

  // Show loading indicator if auth is pending or initial data is loading
  if (authLoading || loadingData) {
    // Replace with AdminPanelSkeleton if you create one
    return (
        <div className="min-h-screen flex items-center justify-center">
            {/* Simple centered loader */}
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
    );
  }

  // If not admin/moderator after loading, redirect (handled by useEffect, but keep as safeguard)
  if (!userInfo || (userInfo.role !== 'admin' && userInfo.role !== 'moderator')) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <p>Redirecting...</p> {/* Or show an access denied message */}
          </div>
      );
  }


  return (
    <div className="min-h-screen"> {/* Removed bg classes */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {userInfo?.role === 'admin' ? 'Admin Panel' : 'Moderator Panel'}
          </h1>
        </div>

        {/* Add Question Button */}
        {(userInfo?.role === 'moderator' || userInfo?.role === 'admin') && (
          <div className="mb-6">
            <Link
              to="/add-question"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow hover:shadow-md"
            >
              <PlusCircle className="w-5 h-5" />
              Add New Question
            </Link>
          </div>
        )}

        {/* Admin View Tabs */}
        {userInfo?.role === 'admin' && (
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => { if (adminView !== 'pending') setAdminView('pending'); }} // Only update state if changed
                        className={`${ adminView === 'pending' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                        Pending Verification
                    </button>
                    <button
                        onClick={() => { if (adminView !== 'all') setAdminView('all'); }} // Only update state if changed
                        className={`${ adminView === 'all' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                        All Questions
                    </button>
                </nav>
            </div>
        )}

        {/* Query Error Display */}
        {queryError && (
             <div className="text-center py-4 px-4 my-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{queryError}</p>
             </div>
         )}

        {/* Questions Table Container */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden relative">
          {/* Loading overlay for pagination/actions */}
          {(loadingMore || isApprovingAll) && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500"/></div>}

          {/* Table Header Area */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {/* Display correct title and count */}
              {userInfo?.role === 'admin'
                ? (adminView === 'pending' ? `Pending (${totalQuestions})` : `All (${totalQuestions})`)
                : `Your Submissions (${totalQuestions})`
              }
            </h2>
            {/* Approve All Button */}
            {userInfo?.role === 'admin' && adminView === 'pending' && totalQuestions > 0 && (
                <button
                    onClick={handleApproveAll}
                    disabled={isApprovingAll || loadingMore}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isApprovingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4"/>}
                    Approve All Pending
                </button>
            )}
          </div>

          {/* Table or No Questions Message */}
          {questions.length === 0 && !loadingData && !queryError ? (
            <p className="p-6 text-center text-gray-500 dark:text-gray-400">
               {adminView === 'pending' && userInfo?.role === 'admin' ? 'No questions are pending verification.' : 'No questions found for this view.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]"> {/* Ensure table doesn't collapse too much */}
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
                  {questions.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{q.title || 'No Title'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{q.subject || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{q.topic || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${q.verified ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'}`}>
                                {q.verified ? 'Verified' : 'Pending'}
                            </span>
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                            {/* Approve/Reject Buttons for Admin on Pending */}
                            {userInfo?.role === 'admin' && !q.verified && (
                                <>
                                <button onClick={() => handleApprove(q.id)} title="Approve" className="text-green-600 hover:text-green-900 p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={loadingMore || isApprovingAll}><Check className="w-5 h-5"/></button>
                                <button onClick={() => handleReject(q.id)} title="Reject/Delete" className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={loadingMore || isApprovingAll}><X className="w-5 h-5"/></button>
                                </>
                            )}
                            {/* Edit Button */}
                            <Link to={`/edit-question/${q.id}`} title="Edit" className={`text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors ${loadingMore || isApprovingAll ? 'pointer-events-none opacity-50' : ''}`}><Edit className="w-5 h-5"/></Link>
                             {/* Delete Button for Admin (also for verified) */}
                            {userInfo?.role === 'admin' && (
                                <button onClick={() => handleReject(q.id)} title="Delete Question" className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={loadingMore || isApprovingAll}><X className="w-5 h-5"/></button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

         {/* Pagination Controls */}
        {totalQuestions > PAGE_SIZE && !queryError && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button onClick={handlePrevPage} disabled={currentPage === 1 || loadingMore || isApprovingAll} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-400 order-first sm:order-none">
                    Page {currentPage} of {totalPages}
                </span>
                <button onClick={handleNextPage} disabled={currentPage === totalPages || loadingMore || isApprovingAll || questions.length < PAGE_SIZE} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Next <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

