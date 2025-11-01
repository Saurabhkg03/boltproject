import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
// MODIFIED: Added List, Plus, Folder, Trash2, X, Bookmark, Check
import { Search, Filter, CheckCircle, Circle, Edit, ArrowDownUp, ChevronLeft, ChevronRight, AlertTriangle, RotateCcw, List, Plus, Folder, Trash2, X, Loader2, Bookmark as BookmarkIcon, Check as CheckIcon } from 'lucide-react';
// MODIFIED: Corrected import paths
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
// MODIFIED: Added documentId, arrayUnion, arrayRemove, writeBatch, addDoc, serverTimestamp, deleteDoc
import { collection, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, DocumentSnapshot, endBefore, limitToLast, doc, getDoc, documentId, addDoc, serverTimestamp, deleteDoc, writeBatch, arrayRemove, arrayUnion, onSnapshot } from 'firebase/firestore';
// MODIFIED: Added QuestionList
import { Question, Submission, QuestionList, UserQuestionData } from '../data/mockData.ts';
// MODIFIED: Corrected import paths
import { PracticeSkeleton } from '../components/Skeletons.tsx';
import { getCache, setCache } from '../utils/cache.ts';

const PAGE_SIZE = 10; // For server-side paginated "All Questions"
const CLIENT_PAGE_SIZE = 10; // For client-side paginated lists

interface FilterOptionsCache {
    topics: string[];
    subjects: string[];
    years: string[];
    tags: string[];
}

// --- NEW: Question Lists Sidebar ---
const QuestionListsSidebar = ({
    selectedListId,
    onSelectList,
    userId
}: {
    selectedListId: string | null;
    onSelectList: (listId: string | null) => void;
    userId: string | null;
}) => {
    const [lists, setLists] = useState<QuestionList[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewListInput, setShowNewListInput] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [creatingList, setCreatingList] = useState(false);

    // Fetch lists in real-time
    useEffect(() => {
        if (!userId) {
            setLoading(false);
            setLists([]);
            return;
        }
        
        setLoading(true);
        const listsQuery = query(collection(db, `users/${userId}/questionLists`), orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
            const userLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionList));
            setLists(userLists);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching lists: ", error);
            setLoading(false);
        });

        return () => unsubscribe(); // Detach listener on cleanup

    }, [userId]);

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !newListName.trim() || creatingList) return;

        setCreatingList(true);
        try {
            const newList: Omit<QuestionList, 'id'> = {
                uid: userId,
                name: newListName.trim(),
                questionIds: [],
                createdAt: new Date().toISOString(), // Use ISO string for client-side sorting consistency
                isPrivate: false,
            };
            
            const docRef = await addDoc(collection(db, `users/${userId}/questionLists`), {
                ...newList,
                createdAt: serverTimestamp() // Use serverTimestamp for accurate ordering
            });
            
            // Optimistic update (or wait for onSnapshot)
            setLists(prev => [{ ...newList, id: docRef.id, createdAt: new Date().toISOString() }, ...prev]);
            setNewListName("");
            setShowNewListInput(false);
        } catch (error) {
            console.error("Error creating new list:", error);
        } finally {
            setCreatingList(false);
        }
    };

    const handleDeleteList = async (e: React.MouseEvent, listId: string, listName: string) => {
        e.stopPropagation(); // Prevent list selection
        if (!userId) return;
        
        // Use custom modal/confirm dialog in production
        if (window.confirm(`Are you sure you want to delete the list "${listName}"? This action cannot be undone.`)) {
            try {
                // 1. Delete the list doc
                await deleteDoc(doc(db, `users/${userId}/questionLists`, listId));
                
                // 2. Remove this listId from all userQuestionData docs
                const batch = writeBatch(db);
                const q = query(collection(db, `users/${userId}/userQuestionData`), where('savedListIds', 'array-contains', listId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    batch.update(doc.ref, {
                        savedListIds: arrayRemove(listId)
                    });
                });
                await batch.commit();

                if(selectedListId === listId) {
                    onSelectList(null);
                }
                // onSnapshot will handle the state update
            } catch (error) {
                console.error("Error deleting list:", error);
            }
        }
    };

    if (!userId) {
        return (
             <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    <Link to="/login" className="text-blue-500 hover:underline">Log in</Link> to create and view question lists.
                </p>
             </div>
        );
    }

    return (
        <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4 space-y-4 md:border-r border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">My Lists</h2>
                <button
                    onClick={() => setShowNewListInput(!showNewListInput)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    title="Create new list"
                >
                    {showNewListInput ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
            </div>

            {showNewListInput && (
                <form onSubmit={handleCreateList} className="flex gap-2 mb-2">
                    <input
                        type="text"
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        placeholder="New list name..."
                        className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    />
                    <button type="submit" disabled={creatingList || !newListName.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-600">
                        {creatingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                    </button>
                </form>
            )}

            <nav className="flex flex-col gap-1">
                <SidebarItem
                    label="All Questions"
                    icon={<List className="w-5 h-5" />}
                    isActive={selectedListId === null}
                    onClick={() => onSelectList(null)}
                />
                <SidebarItem
                    label="Favorites"
                    icon={<BookmarkIcon className="w-5 h-5" />}
                    isActive={selectedListId === 'favorites'}
                    onClick={() => onSelectList('favorites')}
                />
                
                {loading && (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                )}
                
                {!loading && lists.map(list => (
                    <SidebarItem
                        key={list.id}
                        label={list.name}
                        icon={<Folder className="w-5 h-5" />}
                        isActive={selectedListId === list.id}
                        onClick={() => onSelectList(list.id)}
                        onDelete={(e) => handleDeleteList(e, list.id, list.name)}
                    />
                ))}
            </nav>
        </div>
    );
};

const SidebarItem = ({ label, icon, isActive, onClick, onDelete }: {
    label: string,
    icon: React.ReactNode,
    isActive: boolean,
    onClick: () => void,
    onDelete?: (e: React.MouseEvent) => void
}) => (
    <button
        onClick={onClick}
        className={`group w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
    >
        <div className="flex items-center gap-3 min-w-0"> {/* Added min-w-0 */}
            <span className="flex-shrink-0">{icon}</span>
            <span className="truncate">{label}</span>
        </div>
        {onDelete && (
             <span
                onClick={onDelete}
                className="flex-shrink-0 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete list"
            >
                <Trash2 className="w-4 h-4" />
            </span>
        )}
    </button>
);


// --- MAIN PRACTICE COMPONENT (REFACTORED) ---
export function Practice() {
  const { user, userInfo, loading: authLoading } = useAuth();
  const location = useLocation();

  // Filter and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all'); // MODIFIED: Added
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>(location.state?.subject || 'all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('default');

  // NEW: List selection state
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Data State
  const [questions, setQuestions] = useState<Question[]>([]); // For 'All Questions' (paginated)
  const [listQuestions, setListQuestions] = useState<Question[]>([]); // For selected list (all loaded)
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // For 'All Questions' pagination
  const [queryError, setQueryError] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null); // For server pagination
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null); // For server pagination
  const [totalQuestions, setTotalQuestions] = useState(0); // Total server-side questions OR client-side list count

  // Filter Options State
  const [topics, setTopics] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  
  const isAuthenticated = !!user && !!userInfo;
  const filtersDisabled = selectedListId !== null;

  // Effect to populate filter dropdowns (unchanged)
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingFilters(true);
      const cacheKey = 'filterOptions';
      const cachedOptions = getCache<FilterOptionsCache>(cacheKey);

      if (cachedOptions) {
        setTopics(cachedOptions.topics);
        setSubjects(cachedOptions.subjects);
        setYears(cachedOptions.years);
        setTags(cachedOptions.tags);
        setLoadingFilters(false);
        return;
      }

      try {
        const questionsQuery = query(collection(db, "questions"));
        const querySnapshot = await getDocs(questionsQuery);
        const questionsData = querySnapshot.docs.map(doc => doc.data() as Question);

        const topicSet = new Set<string>();
        const subjectSet = new Set<string>();
        const yearSet = new Set<string>();
        const tagSet = new Set<string>();

        questionsData.forEach(q => {
            if(q.topic) topicSet.add(q.topic);
            if(q.subject) subjectSet.add(q.subject);
            if(q.year) yearSet.add(q.year);
            if(q.tags) q.tags.forEach((tag: string) => tag && tagSet.add(tag));
        });

        const newTopics = Array.from(topicSet).sort();
        const newSubjects = Array.from(subjectSet).sort();
        const newYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a)); // Descending years
        const newTags = Array.from(tagSet).sort();

        setTopics(newTopics);
        setSubjects(newSubjects);
        setYears(newYears);
        setTags(newTags);

        setCache<FilterOptionsCache>(cacheKey, { topics: newTopics, subjects: newSubjects, years: newYears, tags: newTags }, 86400);
      } catch (error) {
        console.error("Error fetching filter options:", error);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchFilterOptions();
  }, []);

  // REFACTORED: Fetch paginated questions (only for "All Questions" mode)
  const fetchPaginatedQuestions = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
    if (direction === 'first') setLoadingData(true);
    else setLoadingMore(true);
    setQueryError('');
    setListQuestions([]); // Clear list questions

    try {
      let q = query(collection(db, "questions"));
      let countQuery = query(collection(db, "questions")); // Base count query
      
      let baseFilters: any[] = []; // Store base filters for count

      if (userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
        baseFilters.push(where("verified", "==", true));
      }
      if (difficultyFilter !== 'all') baseFilters.push(where('difficulty', '==', difficultyFilter));
      if (questionTypeFilter !== 'all') baseFilters.push(where('question_type', '==', questionTypeFilter)); // MODIFIED: Added
      if (subjectFilter !== 'all') baseFilters.push(where('subject', '==', subjectFilter));
      if (topicFilter !== 'all') baseFilters.push(where('topic', '==', topicFilter));
      if (yearFilter !== 'all') baseFilters.push(where('year', '==', yearFilter));
      if (tagFilter !== 'all') baseFilters.push(where('tags', 'array-contains', tagFilter));

      if(baseFilters.length > 0) {
          q = query(q, ...baseFilters);
          countQuery = query(countQuery, ...baseFilters);
      }

      if (direction === 'first') {
        const snapshot = await getCountFromServer(countQuery);
        setTotalQuestions(snapshot.data().count);
      }
      
      switch (sortOrder) {
          case 'difficulty-asc': q = query(q, orderBy('difficulty')); break;
          case 'difficulty-desc': q = query(q, orderBy('difficulty', 'desc')); break;
          case 'year-desc': q = query(q, orderBy('year', 'desc')); break;
          case 'year-asc': q = query(q, orderBy('year', 'asc')); break;
          case 'default': default: q = query(q, orderBy('title')); break;
      }

      if (direction === 'next' && lastVisible) q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
      else if (direction === 'prev' && firstVisible) q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      else q = query(q, limit(PAGE_SIZE));

      const documentSnapshots = await getDocs(q);
      const questionsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions(direction === 'prev' ? questionsData.reverse() : questionsData);

      if (documentSnapshots.docs.length > 0) {
        if (direction === 'prev') {
            setFirstVisible(documentSnapshots.docs[0]);
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
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
      console.error("Error fetching questions:", error);
      if (error.code === 'failed-precondition') {
        setQueryError(`Firestore query failed because a database index is missing. This usually happens when you combine filters and sorting. Open your browser's developer console for a link to create the required index automatically.`);
      } else {
        setQueryError('An unexpected error occurred while fetching questions.');
      }
      setQuestions([]); setTotalQuestions(0); setFirstVisible(null); setLastVisible(null);
    } finally {
      setLoadingData(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter, questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, lastVisible, firstVisible]);

  // NEW: Effect to fetch questions when a list is selected
  useEffect(() => {
    const fetchListQuestions = async () => {
        if (!isAuthenticated || !user) {
             setListQuestions([]);
             // If user logs out while viewing a list, switch to "All Questions"
             if(selectedListId) setSelectedListId(null);
             return;
        }

        if (selectedListId === null) {
            // "All Questions" mode is selected
            setListQuestions([]);
            setLastVisible(null);
            setFirstVisible(null);
            fetchPaginatedQuestions(1, 'first');
            return;
        }

        setLoadingData(true);
        setQueryError('');
        setQuestions([]); // Clear paginated questions
        let questionIds: string[] = [];

        try {
            if (selectedListId === 'favorites') {
                const q = query(collection(db, `users/${user.uid}/userQuestionData`), where('isFavorite', '==', true));
                const snapshot = await getDocs(q);
                questionIds = snapshot.docs.map(doc => doc.id);
            } else {
                const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, selectedListId));
                if (listDoc.exists()) {
                    questionIds = (listDoc.data() as QuestionList).questionIds || [];
                }
            }
            
            if (questionIds.length === 0) {
                setListQuestions([]);
                setTotalQuestions(0);
                setLoadingData(false);
                return;
            }

            const questionData: Question[] = [];
            const chunks: string[][] = [];
            for (let i = 0; i < questionIds.length; i += 30) {
                chunks.push(questionIds.slice(i, i + 30));
            }
            
            for (const chunk of chunks) {
                if(chunk.length === 0) continue;
                // Only fetch verified questions unless admin/mod
                let qQuery = query(collection(db, "questions"), where(documentId(), 'in', chunk));
                if (userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
                    qQuery = query(qQuery, where("verified", "==", true));
                }
                const qSnapshot = await getDocs(qQuery);
                
                // Create a map of fetched data
                const fetchedMap = new Map<string, Question>();
                qSnapshot.forEach(doc => {
                    fetchedMap.set(doc.id, { id: doc.id, ...doc.data() } as Question);
                });

                // Preserve original list's question order
                chunk.forEach(id => {
                    if (fetchedMap.has(id)) {
                        questionData.push(fetchedMap.get(id)!);
                    }
                });
            }
            
            setListQuestions(questionData);
            setTotalQuestions(questionData.length);
            setCurrentPage(1);
        } catch (error) {
            console.error("Error fetching list questions:", error);
            setQueryError("Failed to load questions for this list.");
            setListQuestions([]);
            setTotalQuestions(0);
        } finally {
            setLoadingData(false);
        }
    };
    
    if (!loadingFilters) { // Only fetch when filters (and user auth) are ready
        fetchListQuestions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId, isAuthenticated, user, loadingFilters]);


  // Effect for filter/sort changes (ONLY for "All Questions")
  useEffect(() => {
    if (selectedListId === null && !loadingFilters) {
        setLastVisible(null);
        setFirstVisible(null);
        fetchPaginatedQuestions(1, 'first');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter, questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, loadingFilters]);

   // Fetch user submissions (real-time)
  useEffect(() => {
    if (user) {
      const subsCollection = collection(db, `users/${user.uid}/submissions`);
      const unsubscribe = onSnapshot(subsCollection, (snapshot) => {
          const subsData = snapshot.docs.map(doc => doc.data() as Submission);
          setSubmissions(subsData);
      }, (error) => {
          console.error("Could not fetch submissions: ", error);
      });
      return () => unsubscribe(); // Detach listener
    } else {
      setSubmissions([]);
    }
  }, [user]);

  // Handle location state for subject filter
  useEffect(() => {
    if (location.state?.subject && location.state.subject !== subjectFilter) {
      setSelectedListId(null);
      setSubjectFilter(location.state.subject);
      // Clear location state after applying it
      window.history.replaceState({}, document.title)
    }
  }, [location.state, subjectFilter]);

  // Server-side Pagination Handlers
  const handleNextPage = () => {
    if (!loadingMore && lastVisible && (currentPage * PAGE_SIZE < totalQuestions)) {
      fetchPaginatedQuestions(currentPage + 1, 'next');
    }
  };
  const handlePrevPage = () => {
     if (!loadingMore && firstVisible && currentPage > 1) {
        fetchPaginatedQuestions(currentPage - 1, 'prev');
    }
  };
  
  // Client-side Pagination Handlers
  const handleClientNextPage = () => {
    const totalPages = Math.max(1, Math.ceil(totalQuestions / CLIENT_PAGE_SIZE));
    if (currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
    }
  };
  const handleClientPrevPage = () => {
     if (currentPage > 1) {
        setCurrentPage(currentPage - 1);
    }
  };


  // Filter Reset Handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setDifficultyFilter('all');
    setQuestionTypeFilter('all'); // MODIFIED: Added
    setTopicFilter('all');
    setSubjectFilter('all');
    setYearFilter('all');
    setTagFilter('all');
    setSortOrder('default');
    if(selectedListId !== null) {
      setSelectedListId(null); // This will trigger refetch
    }
    // else, the filter/sort useEffect will trigger the refetch
  };

  const solvedQuestionIds = useMemo(() =>
    new Set(submissions.filter(s => s.correct).map(s => s.qid)),
    [submissions]
  );
  
  const clientFilteredQuestions = useMemo(() => {
      let questionsToFilter = [...listQuestions]; // Clone to avoid mutating state
      
      // Client-side filtering
      if (difficultyFilter !== 'all') {
          questionsToFilter = questionsToFilter.filter(q => q.difficulty === difficultyFilter);
      }
      if (questionTypeFilter !== 'all') { // MODIFIED: Added
          questionsToFilter = questionsToFilter.filter(q => q.question_type === questionTypeFilter);
      }
      if (subjectFilter !== 'all') {
          questionsToFilter = questionsToFilter.filter(q => q.subject === subjectFilter);
      }
      if (topicFilter !== 'all') {
          questionsToFilter = questionsToFilter.filter(q => q.topic === topicFilter);
      }
      if (yearFilter !== 'all') {
          questionsToFilter = questionsToFilter.filter(q => q.year === yearFilter);
      }
      if (tagFilter !== 'all') {
          questionsToFilter = questionsToFilter.filter(q => q.tags?.includes(tagFilter));
      }
      
      questionsToFilter.sort((a, b) => {
         switch (sortOrder) {
          case 'difficulty-asc': 
            const diffMap: Record<string, number> = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
            return (diffMap[a.difficulty] || 0) - (diffMap[b.difficulty] || 0);
          case 'difficulty-desc':
            const diffMapDesc: Record<string, number> = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
            return (diffMapDesc[b.difficulty] || 0) - (diffMapDesc[a.difficulty] || 0);
          case 'year-desc': return (b.year || '').localeCompare(a.year || '');
          case 'year-asc': return (a.year || '').localeCompare(b.year || '');
          case 'default': default: return (a.title || '').localeCompare(b.title || '');
        }
      });
      
      if (!searchQuery) return questionsToFilter;
      const lowerCaseQuery = searchQuery.toLowerCase();
      return questionsToFilter.filter(q =>
          q.id?.toLowerCase().includes(lowerCaseQuery) ||
          q.topic?.toLowerCase().includes(lowerCaseQuery) ||
          q.subject?.toLowerCase().includes(lowerCaseQuery) ||
          q.title?.toLowerCase().includes(lowerCaseQuery)
      );
  // MODIFIED: Added all filters to dependency array
  }, [listQuestions, sortOrder, searchQuery, difficultyFilter, questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter]);

  const serverPagedAndFilteredQuestions = useMemo(() => {
    if (!searchQuery) return questions;
    const lowerCaseQuery = searchQuery.toLowerCase();
    return questions.filter(q =>
        q.id?.toLowerCase().includes(lowerCaseQuery) ||
        q.topic?.toLowerCase().includes(lowerCaseQuery) ||
        q.subject?.toLowerCase().includes(lowerCaseQuery) ||
        q.title?.toLowerCase().includes(lowerCaseQuery)
    );
  }, [searchQuery, questions]);
  
  const questionsToDisplay = useMemo(() => {
      if (selectedListId !== null) {
          const start = (currentPage - 1) * CLIENT_PAGE_SIZE;
          const end = start + CLIENT_PAGE_SIZE;
          return clientFilteredQuestions.slice(start, end);
      }
      return serverPagedAndFilteredQuestions;
  }, [selectedListId, currentPage, clientFilteredQuestions, serverPagedAndFilteredQuestions]);
  
  useEffect(() => {
      if (selectedListId !== null) {
          setTotalQuestions(clientFilteredQuestions.length);
          if (currentPage > Math.max(1, Math.ceil(clientFilteredQuestions.length / CLIENT_PAGE_SIZE))) {
              setCurrentPage(1);
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientFilteredQuestions, selectedListId]);


  const getDifficultyColor = (difficulty: string | undefined) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50';
      case 'Medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50';
      case 'Hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
    }
  };
  
  // MODIFIED: Added
  const getQuestionTypeColor = (type: string | undefined) => {
    switch (type) {
      case 'mcq': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50';
      case 'msq': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50';
      case 'nat': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalQuestions / (selectedListId !== null ? CLIENT_PAGE_SIZE : PAGE_SIZE)));
  const listMode = selectedListId !== null;

  if (authLoading || loadingFilters) {
    return <PracticeSkeleton />;
  }

  // --- Render Actual Page Content ---
  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto flex flex-col md:flex-row">
        
        <QuestionListsSidebar
            selectedListId={selectedListId}
            onSelectList={(listId) => {
                setSelectedListId(listId);
                setCurrentPage(1); // Reset page on list change
            }}
            userId={user?.uid || null}
        />

        <div className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Practice Questions
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {loadingData ? 'Loading...' : (totalQuestions > 0
                    ? listMode
                        ? `Showing ${ (currentPage - 1) * CLIENT_PAGE_SIZE + 1 }-${ Math.min(currentPage * CLIENT_PAGE_SIZE, totalQuestions) } of ${totalQuestions} questions in this list`
                        : `Showing ${ (currentPage - 1) * PAGE_SIZE + 1 }-${ Math.min(currentPage * PAGE_SIZE, totalQuestions) } of ${totalQuestions} questions`
                    : queryError ? 'Error loading questions' : '0 questions found'
                )}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:p-6 mb-6 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search questions by title, subject, topic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Filter className="w-5 h-5 text-gray-400 flex-shrink-0 hidden sm:inline-block" />

                  {/* MODIFIED: Apply filtersDisabled to all selects */}
                  <select disabled={filtersDisabled} value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                    <option value="all">Difficulty</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                  
                  {/* MODIFIED: Added Question Type Filter */}
                  <select disabled={filtersDisabled} value={questionTypeFilter} onChange={(e) => setQuestionTypeFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                    <option value="all">Type</option>
                    <option value="mcq">MCQ</option>
                    <option value="msq">MSQ</option>
                    <option value="nat">NAT</option>
                  </select>

                  <select disabled={filtersDisabled} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                    <option value="all">Subject</option>
                    {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                  </select>

                  <select disabled={filtersDisabled} value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                    <option value="all">Topic</option>
                    {topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
                  </select>

                  <select disabled={filtersDisabled} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                    <option value="all">Year</option>
                    {years.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>

                  <select disabled={filtersDisabled} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                    <option value="all">Tag</option>
                    {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </select>

                  <div className="flex-grow"></div>

                  <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                    <ArrowDownUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer">
                        <option value="default">Sort: Title</option>
                        <option value="difficulty-asc">Difficulty ↑</option>
                        <option value="difficulty-desc">Difficulty ↓</option>
                        <option value="year-desc">Year ↓</option>
                        <option value="year-asc">Year ↑</option>
                    </select>
                  </div>
                   <button onClick={handleResetFilters} className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto mt-2 sm:mt-0 justify-center" title="Reset Filters">
                      <RotateCcw className="w-4 h-4" />
                       <span className="sm:hidden">Reset</span>
                    </button>
                </div>
              </div>
            </div>

            {queryError && (
              <div className="text-center py-8 px-4 my-6 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400"/>
                  <h3 className="text-red-800 dark:text-red-300 font-semibold text-lg">Error</h3>
                </div>
                <p className="text-red-600 dark:text-red-400 mt-2 max-w-2xl mx-auto text-sm">{queryError}</p>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative shadow-sm">
                {(loadingMore || (loadingData && !authLoading)) && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}

                <div className="divide-y divide-gray-200 dark:divide-gray-800 md:hidden">
                  {questionsToDisplay.map((question) => {
                      const isSolved = solvedQuestionIds.has(question.id);
                      return (
                          <div key={question.id} className="block px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <Link to={`/question/${question.id}`} className="block mb-1">
                                  <span className="text-blue-600 dark:text-blue-400 font-medium text-base truncate">
                                      {question.title || `Question ${question.id.substring(0,4)}...`}
                                  </span>
                              </Link>
                               <div className="flex items-center gap-2 mb-2">
                                   {isSolved ? (
                                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-gray-300 dark:text-gray-700 flex-shrink-0" />
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {isSolved ? 'Solved' : 'Not Solved'}
                                    </span>
                               </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                  <span className={`px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(question.difficulty)}`}>
                                    {question.difficulty || '?'}
                                  </span>
                                  {/* MODIFIED: Added Question Type */}
                                  <span className={`px-2 py-0.5 rounded-full font-medium uppercase ${getQuestionTypeColor(question.question_type)}`}>
                                    {question.question_type || 'N/A'}
                                  </span>
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded font-medium">
                                      {question.subject || 'N/A'}
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded">
                                      {question.year || '?'}
                                  </span>
                                  {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                                    <span className={`px-2 py-0.5 rounded-full font-medium ${question.verified ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'}`}>
                                        {question.verified ? 'Verified' : 'Pending'}
                                    </span>
                                  )}
                              </div>
                               {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                                  <div className="mt-2">
                                      <Link to={`/edit-question/${question.id}`} className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1 text-sm font-medium">
                                          <Edit className="w-3 h-3" /> Edit
                                      </Link>
                                  </div>
                               )}
                          </div>
                      );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Title</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Topic</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Type</th>{/* MODIFIED: Added */}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Difficulty</th>
                            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Verified</th>}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Details</th>
                            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Actions</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {questionsToDisplay.map((question) => {
                          const isSolved = solvedQuestionIds.has(question.id);
                          return (
                              <tr key={question.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-center">{isSolved ? <CheckCircle className="w-5 h-5 text-green-500 inline-block" /> : <Circle className="w-5 h-5 text-gray-300 dark:text-gray-700 inline-block" />}</td>
                                <td className="px-6 py-4 whitespace-nowrap"><Link to={`/question/${question.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">{question.title || `Question ${question.id.substring(0,4)}...`}</Link></td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className="text-gray-900 dark:text-white text-sm">{question.topic || 'N/A'}</span></td>
                                {/* MODIFIED: Added Type Column */}
                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${getQuestionTypeColor(question.question_type)}`}>{question.question_type || 'N/A'}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>{question.difficulty || '?'}</span></td>
                                {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium ${question.verified ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'}`}>{question.verified ? 'Yes' : 'No'}</span></td>}
                                <td className="px-6 py-4 whitespace-nowrap"><div className="flex flex-wrap gap-1"><span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded text-xs font-medium">{question.subject || 'N/A'}</span><span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded text-xs">{question.year || '?'}</span></div></td>
                                {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <td className="px-6 py-4 whitespace-nowrap"><Link to={`/edit-question/${question.id}`} className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-sm font-medium"><Edit className="w-4 h-4" /> Edit</Link></td>}
                              </tr>
                          );
                          })}
                      </tbody>
                    </table>
                </div>
            </div>

            {questionsToDisplay.length === 0 && !loadingData && !queryError && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No questions found matching your criteria.
                </p>
              </div>
            )}

            {totalQuestions > (listMode ? CLIENT_PAGE_SIZE : PAGE_SIZE) && !queryError && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button onClick={listMode ? handleClientPrevPage : handlePrevPage} disabled={currentPage === 1 || loadingMore} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-400 order-first sm:order-none">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button onClick={listMode ? handleClientNextPage : handleNextPage} disabled={currentPage === totalPages || loadingMore || (listMode ? questionsToDisplay.length < CLIENT_PAGE_SIZE : questionsToDisplay.length < PAGE_SIZE && !lastVisible) } className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Next <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


