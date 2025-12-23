import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, CheckCircle, Circle, ArrowDownUp, ChevronLeft, ChevronRight, RotateCcw, List, Plus, Folder, Trash2, X, Loader2, Bookmark as BookmarkIcon, Check as CheckIcon, Edit } from 'lucide-react';
import { useMetadata } from '../contexts/MetadataContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, limit, startAfter, DocumentSnapshot, endBefore, limitToLast, doc, getDoc, documentId, addDoc, serverTimestamp, deleteDoc, writeBatch, arrayRemove, onSnapshot, Query, DocumentData } from 'firebase/firestore';
import { Question, Submission, QuestionList } from '../data/mockData';
import { PracticeSkeleton } from '../components/Skeletons';

const PAGE_SIZE = 10;
const CLIENT_PAGE_SIZE = 10; // For client-side paginated lists

// --- Question Lists Sidebar (No changes) ---
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
            console.log("[Practice.Sidebar] No user ID, skipping list subscription.");
            setLoading(false);
            setLists([]);
            return;
        }

        setLoading(true);
        console.log(`[Practice.Sidebar] User ${userId}: Subscribing to questionLists... (1 listener)`);
        const listsQuery = query(collection(db, `users/${userId}/questionLists`), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
            const userLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionList));
            console.log(`[Practice.Sidebar] User ${userId}: Received ${userLists.length} lists from snapshot.`);
            setLists(userLists);
            setLoading(false);
        }, (error) => {
            console.error("[Practice.Sidebar] FATAL ERROR fetching lists: ", error);
            setLoading(false);
        });

        return () => {
            console.log("[Practice.Sidebar] Unsubscribing from questionLists.");
            unsubscribe(); // Detach listener on cleanup
        };

    }, [userId]);

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !newListName.trim() || creatingList) return;

        setCreatingList(true);
        console.log(`[Practice.Sidebar] User ${userId}: Creating new list '${newListName.trim()}'...`);
        try {
            const newList: Omit<QuestionList, 'id' | 'createdAt'> = {
                uid: userId,
                name: newListName.trim(),
                questionIds: [], // Start with an empty array
                isPrivate: false,
            };

            const docRef = await addDoc(collection(db, `users/${userId}/questionLists`), {
                ...newList,
                createdAt: serverTimestamp() // Use serverTimestamp for accurate ordering
            });
            console.log(`[Practice.Sidebar] SUCCESS: Created list with ID: ${docRef.id}.`);

            // onSnapshot will handle the update
            setNewListName("");
            setShowNewListInput(false);
        } catch (error) {
            console.error("[Practice.Sidebar] FATAL ERROR creating new list:", error);
        } finally {
            setCreatingList(false);
        }
    };

    const handleDeleteList = async (e: React.MouseEvent, listId: string, listName: string) => {
        e.stopPropagation(); // Prevent list selection
        if (!userId) return;

        // Use custom modal/confirm dialog in production
        if (window.confirm(`Are you sure you want to delete the list "${listName}"? This action cannot be undone.`)) {
            console.log(`[Practice.Sidebar] User ${userId}: Deleting list '${listName}' (ID: ${listId})...`);
            try {
                // 1. Delete the list doc
                await deleteDoc(doc(db, `users/${userId}/questionLists`, listId));

                // 2. Remove this listId from all userQuestionData docs
                console.log(`[Practice.Sidebar] Deleting list ID from 'userQuestionData' collection...`);
                const batch = writeBatch(db);
                const q = query(collection(db, `users/${userId}/userQuestionData`), where('savedListIds', 'array-contains', listId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    batch.update(doc.ref, {
                        savedListIds: arrayRemove(listId)
                    });
                });
                await batch.commit();
                console.log(`[Practice.Sidebar] SUCCESS: Deleted list and cleaned up ${snapshot.size} 'userQuestionData' entries.`);

                if (selectedListId === listId) {
                    onSelectList(null);
                }
                // onSnapshot will handle the state update
            } catch (error) {
                console.error("[Practice.Sidebar] FATAL ERROR deleting list:", error);
            }
        }
    };

    if (!userId) {
        return (
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    <Link to="/login" className="text-blue-500 hover:underline">Log in</Link> to create and view question lists.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full md:w-64 lg:w-72 flex-shrink-0 p-4 space-y-4 md:border-r border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">My Lists</h2>
                <button
                    onClick={() => setShowNewListInput(!showNewListInput)}
                    className="p-1.5 rounded-md text-zinc-500 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
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
                        className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                    />
                    <button type="submit" disabled={creatingList || !newListName.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-zinc-400 dark:disabled:bg-zinc-600">
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
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                    </div>
                )}

                {!loading && lists.map(list => (
                    // Filter out the 'favorites' list if it exists, as it's handled separately
                    list.id !== 'favorites' && (
                        <SidebarItem
                            key={list.id}
                            label={list.name}
                            icon={<Folder className="w-5 h-5" />}
                            isActive={selectedListId === list.id}
                            onClick={() => onSelectList(list.id)}
                            onDelete={(e) => handleDeleteList(e, list.id, list.name)}
                        />
                    )
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
        className={`group w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
    >
        <div className="flex items-center gap-3 min-w-0"> {/* Added min-w-0 */}
            <span className="flex-shrink-0">{icon}</span>
            <span className="truncate">{label}</span>
        </div>
        {onDelete && (
            <span
                onClick={onDelete}
                className="flex-shrink-0 p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete list"
            >
                <Trash2 className="w-4 h-4" />
            </span>
        )}
    </button>
);


// --- MAIN PRACTICE COMPONENT (REVERTED TO SERVER-SIDE FILTERING) ---
export function Practice() {
    const { user, userInfo, loading: authLoading } = useAuth();
    const { metadata, loading: metadataLoading, questionCollectionPath, availableBranches, selectedBranch } = useMetadata();
    const location = useLocation();

    // Filter and Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all');
    const [topicFilter, setTopicFilter] = useState<string>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>(location.state?.subject || 'all');
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [tagFilter, setTagFilter] = useState<string>('all');
    // --- *** NEW: Updated default sort order *** ---
    const [sortOrder, setSortOrder] = useState<string>('qIndex-asc');

    // List selection state
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [listQuestionIds, setListQuestionIds] = useState<string[]>([]);

    // Data State
    const [questions, setQuestions] = useState<Question[]>([]);
    const [listQuestions, setListQuestions] = useState<Question[]>([]);

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [queryError, setQueryError] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
    const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
    const [totalQuestions, setTotalQuestions] = useState(0);

    const subjects = useMemo(() => metadata?.subjects || [], [metadata]);
    const topics = useMemo(() => metadata?.topics || [], [metadata]);
    const years = useMemo(() => metadata?.years || [], [metadata]);
    const tags = useMemo(() => metadata?.tags || [], [metadata]);
    const baseTotalQuestions = useMemo(() => metadata?.questionCount || 0, [metadata]);

    const isAuthenticated = !!user && !!userInfo;
    const filtersDisabled = selectedListId !== null;

    const filtersAreActive = useMemo(() => {
        return (
            questionTypeFilter !== 'all' ||
            subjectFilter !== 'all' ||
            topicFilter !== 'all' ||
            yearFilter !== 'all' ||
            tagFilter !== 'all'
        );
    }, [questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter]);

    const listMode = selectedListId !== null;

    // --- *** UPDATED: server-side fetchPaginatedQuestions *** ---
    const fetchPaginatedQuestions = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
        if (!metadata) {
            console.log("[Practice.LoadQuestions] Waiting for metadata...");
            setLoadingData(true);
            return;
        }

        console.log(`[Practice.LoadQuestions] Fetching 'All Questions' (Branch: ${selectedBranch}) page: ${page}, direction: ${direction}`);
        if (direction === 'first') setLoadingData(true);
        else setLoadingMore(true);
        setQueryError('');
        setListQuestions([]);
        setListQuestionIds([]);

        try {
            let q: Query<DocumentData, DocumentData> = query(collection(db, questionCollectionPath));

            // 1. Start with base 'verified' filter for non-admins
            let baseFilters: any[] = [];
            if (userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
                baseFilters.push(where("verified", "==", true));
            }

            // 2. Check for the "poison pill" array-contains filter
            if (tagFilter !== 'all') {
                // If 'tags' filter is active, we can ONLY add this filter.
                // We ignore subject, topic, and year filters.
                console.log(`[Practice.LoadQuestions] Applying 'tags' filter. Other filters (subject, topic, year) will be ignored.`);
                baseFilters.push(where('tags', 'array-contains', tagFilter));
            } else {
                // If 'tags' filter is NOT active, we can add the other filters.
                if (questionTypeFilter !== 'all') baseFilters.push(where('question_type', '==', questionTypeFilter));
                if (subjectFilter !== 'all') baseFilters.push(where('subject', '==', subjectFilter));
                if (topicFilter !== 'all') baseFilters.push(where('topic', '==', topicFilter));
                if (yearFilter !== 'all') baseFilters.push(where('year', '==', yearFilter));
            }

            if (baseFilters.length > 0) {
                console.log(`[Practice.LoadQuestions] Applying ${baseFilters.length} filters.`);
                q = query(q, ...baseFilters);
            }

            if (direction === 'first') {
                if (filtersAreActive) {
                    console.warn("[Practice.LoadQuestions] Filters are active. Using baseTotalQuestions as fallback count.");
                    setTotalQuestions(baseTotalQuestions);
                } else {
                    console.log(`[Practice.LoadQuestions] No filters active. Using base total from metadata: ${baseTotalQuestions}`);
                    setTotalQuestions(baseTotalQuestions);
                }
            }

            // --- *** 3. Apply Sorting (NOW SORTS BY qIndex) *** ---
            switch (sortOrder) {
                case 'year-desc': q = query(q, orderBy('year', 'desc')); break;
                case 'year-asc': q = query(q, orderBy('year', 'asc')); break;
                case 'qIndex-desc': q = query(q, orderBy('qIndex', 'desc')); break;
                case 'qIndex-asc': // Default case
                default:
                    q = query(q, orderBy('qIndex', 'asc'));
                    break;
            }

            // 4. Apply Pagination
            if (direction === 'next' && lastVisible) q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
            else if (direction === 'prev' && firstVisible) q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
            else q = query(q, limit(PAGE_SIZE));

            console.log(
                `[Practice.LoadQuestions] DIAGNOSTIC: About to run getDocs(). Filters active: ${filtersAreActive}. Sort: ${sortOrder}. Page: ${page}. Limit: ${PAGE_SIZE}.`
            );

            console.log(`[Practice.LoadQuestions] Fetching documents for page ${page}... (${PAGE_SIZE} READS MAX)`);
            const documentSnapshots = await getDocs(q);

            const questionsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            console.log(`[Practice.LoadQuestions] SUCCESS: Received ${questionsData.length} documents.`);
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
            console.error("[Practice.LoadQuestions] FATAL ERROR fetching questions:", error);
            if (error.code === 'failed-precondition') {
                setQueryError(`Query failed: This combination of filters and sorting requires a new database index. Please open your browser's developer console (F12) to find a link to create the missing index in Firebase. Error: ${error.message}`);
            } else {
                setQueryError('An unexpected error occurred while fetching questions.');
            }
            setQuestions([]); setTotalQuestions(0); setFirstVisible(null); setLastVisible(null);
        } finally {
            setLoadingData(false);
            setLoadingMore(false);
        }
    }, [questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, lastVisible, firstVisible, filtersAreActive, baseTotalQuestions, metadata, selectedBranch, questionCollectionPath]);


    // --- Effect for list selection (FIXED) ---
    useEffect(() => {
        const fetchListIds = async () => {
            if (!isAuthenticated || !user) {
                console.log("[Practice.LoadList] No authenticated user. Clearing list.");
                setListQuestionIds([]);
                setListQuestions([]); // Clear list questions
                return;
            }

            if (selectedListId === null) {
                console.log("[Practice.LoadList] List ID is null. Clearing list state.");
                setListQuestionIds([]);
                setListQuestions([]);
                // The other useEffect (for filters/sort) will now handle fetching "All Questions"
                return;
            }

            setLoadingData(true);
            setQueryError('');
            setQuestions([]); // Clear the "All Questions" state
            setListQuestions([]);
            console.log(`[Practice.LoadList] Fetching IDs for List ID: '${selectedListId}'`);

            try {
                let questionIds: string[] = [];
                if (selectedListId === 'favorites') {
                    const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, 'favorites'));
                    if (listDoc.exists()) {
                        questionIds = (listDoc.data() as QuestionList).questionIds || [];
                    }
                } else {
                    const listDoc = await getDoc(doc(db, `users/${user.uid}/questionLists`, selectedListId));
                    if (listDoc.exists()) {
                        questionIds = (listDoc.data() as QuestionList).questionIds || [];
                    }
                }

                setListQuestionIds(questionIds);
                setTotalQuestions(questionIds.length);
                setCurrentPage(1); // Reset to page 1 for the new list

            } catch (error) {
                console.error(`[Practice.LoadList] FATAL ERROR fetching list '${selectedListId}':`, error);
                setQueryError("Failed to load questions for this list.");
                setListQuestionIds([]);
                setTotalQuestions(0);
            }
        };

        if (!metadataLoading) {
            console.log("[Practice] List selection or branch changed. Triggering ID fetch...");
            fetchListIds();
        } else {
            console.log("[Practice] Waiting for metadata to load before fetching list IDs...");
        }
        // FIXED: Removed fetchPaginatedQuestions from dependencies to break loop
    }, [selectedListId, isAuthenticated, user, metadataLoading, selectedBranch]);


    // --- Effect for fetching paginated LIST question data ---
    useEffect(() => {
        const fetchQuestionsForCurrentPage = async () => {
            if (!listMode || listQuestionIds.length === 0) {
                setListQuestions([]);
                if (listMode) setLoadingData(false);
                return;
            }

            if (metadataLoading || !questionCollectionPath) {
                console.log("[Practice.ListPager] Waiting for metadata/collection path...");
                setLoadingData(true);
                return;
            }

            console.log(`[Practice.ListPager] Fetching page ${currentPage} of list '${selectedListId}' from ${questionCollectionPath}`);
            setLoadingData(true);
            setQueryError('');

            try {
                const startIndex = (currentPage - 1) * CLIENT_PAGE_SIZE;
                const endIndex = startIndex + CLIENT_PAGE_SIZE;
                const idsToFetch = listQuestionIds.slice(startIndex, endIndex);

                if (idsToFetch.length === 0) {
                    console.log("[Practice.ListPager] No IDs to fetch for this page.");
                    setListQuestions([]);
                    setLoadingData(false);
                    return;
                }

                console.log(`[Practice.ListPager] Found ${idsToFetch.length} IDs for page ${currentPage}. Fetching... (${idsToFetch.length} READS MAX)`);

                const questionData: Question[] = [];
                const chunks: string[][] = [];
                for (let i = 0; i < idsToFetch.length; i += 30) {
                    chunks.push(idsToFetch.slice(i, i + 30));
                }

                for (const chunk of chunks) {
                    if (chunk.length === 0) continue;

                    let qQuery = query(collection(db, questionCollectionPath), where(documentId(), 'in', chunk));
                    if (userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
                        qQuery = query(qQuery, where("verified", "==", true));
                    }
                    const qSnapshot = await getDocs(qQuery);

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

            } catch (error) {
                console.error(`[Practice.ListPager] FATAL ERROR fetching questions for page ${currentPage}:`, error);
                setQueryError("Failed to load questions for this page.");
                setListQuestions([]);
            } finally {
                setLoadingData(false);
            }
        };

        fetchQuestionsForCurrentPage();
    }, [currentPage, listQuestionIds, listMode, userInfo?.role, metadataLoading, questionCollectionPath]);


    // --- Effect for filter/sort changes (FIXED) ---
    useEffect(() => {
        if (selectedListId === null && !metadataLoading) {
            console.log("[Practice] Filters, sort, or branch changed (or list deselected). Refetching 'All Questions' page 1.");
            setLastVisible(null);
            setFirstVisible(null);
            fetchPaginatedQuestions(1, 'first');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, selectedBranch, metadataLoading, selectedListId]);

    // Fetch user submissions (real-time) - No change
    useEffect(() => {
        if (user) {
            console.log(`[Practice.Submissions] User ${user.uid}: Subscribing to submissions... (1 listener)`);
            const subsCollection = collection(db, `users/${user.uid}/submissions`);
            const unsubscribe = onSnapshot(subsCollection, (snapshot) => {
                const subsData = snapshot.docs.map(doc => doc.data() as Submission);
                console.log(`[Practice.Submissions] User ${user.uid}: Received ${subsData.length} submissions from snapshot.`);
                setSubmissions(subsData);
            }, (error) => {
                console.error("[Practice.Submissions] FATAL ERROR fetching submissions: ", error);
            });
            return () => {
                console.log("[Practice.Submissions] Unsubscribing from submissions.");
                unsubscribe();
            };
        } else {
            console.log("[Practice.Submissions] No user, clearing submissions.");
            setSubmissions([]);
        }
    }, [user]);

    // Handle location state for subject filter - No change
    useEffect(() => {
        if (location.state?.subject && location.state.subject !== subjectFilter) {
            console.log(`[Practice] Applying subject filter from navigation state: ${location.state.subject}`);
            setSelectedListId(null);
            setSubjectFilter(location.state.subject);
            window.history.replaceState({}, document.title)
        }
    }, [location.state, subjectFilter]);

    // --- Server-side Pagination Handlers ---
    const handleNextPage = () => {
        const hasMore = filtersAreActive
            ? lastVisible
            : (totalQuestions > 0 && (currentPage * PAGE_SIZE < totalQuestions));

        if (!loadingMore && hasMore && lastVisible) {
            fetchPaginatedQuestions(currentPage + 1, 'next');
        }
    };
    const handlePrevPage = () => {
        if (!loadingMore && firstVisible && currentPage > 1) {
            fetchPaginatedQuestions(currentPage - 1, 'prev');
        }
    };

    // --- Client-side Pagination Handlers ---
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

    // Filter Reset Handler (No change)
    const handleResetFilters = () => {
        console.log("[Practice] Resetting all filters.");
        setSearchQuery('');
        setQuestionTypeFilter('all');
        setTopicFilter('all');
        setSubjectFilter('all');
        setYearFilter('all');
        setTagFilter('all');
        // --- *** NEW: Reset sort order to qIndex-asc *** ---
        setSortOrder('qIndex-asc');
        if (selectedListId !== null) {
            setSelectedListId(null);
        }
    };

    const solvedQuestionIds = useMemo(() =>
        new Set(submissions.filter(s => s.correct).map(s => s.qid)),
        [submissions]
    );

    // --- *** NEW: Updated client-side sort logic *** ---
    const clientFilteredQuestions = useMemo(() => {
        let questionsToFilter = [...listQuestions];

        // ... (filtering logic is unchanged) ...
        if (questionTypeFilter !== 'all') {
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

        // Sort logic updated to use qIndex
        questionsToFilter.sort((a, b) => {
            const aIndex = a.qIndex || 0;
            const bIndex = b.qIndex || 0;
            switch (sortOrder) {
                case 'year-desc': return (b.year || '').localeCompare(a.year || '');
                case 'year-asc': return (a.year || '').localeCompare(b.year || '');
                case 'qIndex-desc': return bIndex - aIndex;
                case 'qIndex-asc': // Default case
                default:
                    return aIndex - bIndex;
            }
        });

        if (!searchQuery) return questionsToFilter;
        const lowerCaseQuery = searchQuery.toLowerCase();
        return questionsToFilter.filter(q =>
            q.id?.toLowerCase().includes(lowerCaseQuery) ||
            q.topic?.toLowerCase().includes(lowerCaseQuery) ||
            q.subject?.toLowerCase().includes(lowerCaseQuery) ||
            q.title?.toLowerCase().includes(lowerCaseQuery) ||
            q.qIndex?.toString().includes(lowerCaseQuery) // Search by number
        );
    }, [listQuestions, sortOrder, searchQuery, questionTypeFilter, subjectFilter, topicFilter, yearFilter, tagFilter]);

    // --- Updated server-side search to include qIndex ---
    const serverPagedAndFilteredQuestions = useMemo(() => {
        if (!searchQuery) return questions;
        const lowerCaseQuery = searchQuery.toLowerCase();
        return questions.filter(q =>
            q.id?.toLowerCase().includes(lowerCaseQuery) ||
            q.topic?.toLowerCase().includes(lowerCaseQuery) ||
            q.subject?.toLowerCase().includes(lowerCaseQuery) ||
            q.title?.toLowerCase().includes(lowerCaseQuery) ||
            q.qIndex?.toString().includes(lowerCaseQuery) // Search by number
        );
    }, [searchQuery, questions]);

    const questionsToDisplay = useMemo(() => {
        if (selectedListId !== null) {
            return clientFilteredQuestions;
        }
        return serverPagedAndFilteredQuestions;
    }, [selectedListId, clientFilteredQuestions, serverPagedAndFilteredQuestions]);


    // getQuestionTypeColor (No change)
    const getQuestionTypeColor = (type: string | undefined) => {
        switch (type) {
            case 'mcq': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50';
            case 'msq': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50';
            case 'nat': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
        }
    };

    const totalPages = Math.max(
        1,
        Math.ceil(
            (listMode)
                ? totalQuestions / CLIENT_PAGE_SIZE
                : baseTotalQuestions / PAGE_SIZE
        )
    );

    if (authLoading || metadataLoading) {
        console.log(`[Practice] Rendering SKELETON (authLoading: ${authLoading}, metadataLoading: ${metadataLoading})`);
        return <PracticeSkeleton />;
    }

    const branchName = availableBranches[selectedBranch] || 'Practice';

    // --- Render Actual Page Content ---
    return (
        <div className="min-h-screen">
            <div className="max-w-full mx-auto flex flex-col md:flex-row">

                <QuestionListsSidebar
                    selectedListId={selectedListId}
                    onSelectList={(listId) => {
                        setSelectedListId(listId);
                    }}
                    userId={user?.uid || null}
                />

                <div className="flex-1 min-w-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                Practice Questions ({branchName})
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {loadingData ? 'Loading...' : (
                                    (totalQuestions > 0 || listMode) && !queryError
                                        ? listMode
                                            ? `Showing ${(currentPage - 1) * CLIENT_PAGE_SIZE + 1}-${Math.min(currentPage * CLIENT_PAGE_SIZE, totalQuestions)} of ${totalQuestions} questions in this list`
                                            : (filtersAreActive && totalQuestions === baseTotalQuestions && questionsToDisplay.length === 0)
                                                ? `Searching questions...`
                                                : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}-${(currentPage - 1) * PAGE_SIZE + questionsToDisplay.length} of ${filtersAreActive ? '~' : ''}${baseTotalQuestions} questions`
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
                                        placeholder="Search by number, title, subject..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <Filter className="w-5 h-5 text-gray-400 flex-shrink-0 hidden sm:inline-block" />

                                    <select disabled={filtersDisabled} value={questionTypeFilter} onChange={(e) => setQuestionTypeFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800">
                                        <option value="all">Type</option>
                                        {(metadata?.questionTypeCounts ? Object.keys(metadata.questionTypeCounts) : ['mcq', 'msq', 'nat']).map((type: string) => (
                                            <option key={type} value={type}>{type.toUpperCase()}</option>
                                        ))}
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

                                    {/* --- *** NEW: Updated Sort Options *** --- */}
                                    <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                                        <ArrowDownUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer">
                                            <option value="qIndex-asc">Sort: Number ↑</option>
                                            <option value="qIndex-desc">Sort: Number ↓</option>
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
                                <h3 className="text-red-800 dark:text-red-300 font-semibold text-lg">Error</h3>
                                <p className="text-red-600 dark:text-red-400 mt-2 max-w-2xl mx-auto text-sm">{queryError}</p>
                            </div>
                        )}

                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative shadow-sm">
                            {(loadingData && !authLoading && !metadataLoading)}

                            {/* Mobile View */}
                            <div className="divide-y divide-gray-200 dark:divide-gray-800 md:hidden">
                                {questionsToDisplay.map((question) => {
                                    const isSolved = solvedQuestionIds.has(question.id);
                                    return (
                                        <div key={question.id} className="block px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <Link to={`/question/${question.id}`} className="block mb-1">
                                                <span className="text-blue-600 dark:text-blue-400 font-medium text-base truncate">
                                                    {/* --- *** NEW: Show qIndex *** --- */}
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 font-normal mr-2">#{question.qIndex}</span>
                                                    {question.title || `Question ${question.id.substring(0, 4)}...`}
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

                            {/* Desktop View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                                            {/* --- *** NEW: Added Q.No. *** --- */}
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Q.No.</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Title</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Topic</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Type</th>
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
                                                    {/* --- *** NEW: Show qIndex *** --- */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{question.qIndex}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap"><Link to={`/question/${question.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">{question.title || `Question ${question.id.substring(0, 4)}...`}</Link></td>
                                                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-gray-900 dark:text-white text-sm">{question.topic || 'N/A'}</span></td>
                                                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${getQuestionTypeColor(question.question_type)}`}>{question.question_type || 'N/A'}</span></td>
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

                        {/* Pagination */}
                        {((listMode && totalQuestions > CLIENT_PAGE_SIZE) || (!listMode && totalPages > 1 && (baseTotalQuestions > questionsToDisplay.length || currentPage > 1))) && !queryError && (
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <button
                                    onClick={listMode ? handleClientPrevPage : handlePrevPage}
                                    disabled={currentPage === 1 || loadingMore || loadingData}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Previous
                                </button>

                                <span className="text-sm text-gray-700 dark:text-gray-400 order-first sm:order-none">
                                    Page {currentPage} {(listMode && totalPages > 1) ? `of ${totalPages}` :
                                        (!listMode && totalPages > 1 && !filtersAreActive) ? `of ${totalPages}` : ''}
                                </span>

                                <button
                                    onClick={listMode ? handleClientNextPage : handleNextPage}
                                    disabled={
                                        loadingMore || loadingData ||
                                        (listMode && currentPage === totalPages) ||
                                        (!listMode && !filtersAreActive && currentPage === totalPages) ||
                                        (!listMode && filtersAreActive && questionsToDisplay.length < PAGE_SIZE && !lastVisible)
                                    }
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
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

