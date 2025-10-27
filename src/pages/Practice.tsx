import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, CheckCircle, Circle, Edit, ArrowDownUp, ChevronLeft, ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react'; // Removed Loader2
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, DocumentSnapshot, endBefore, limitToLast } from 'firebase/firestore';
import { Question, Submission } from '../data/mockData.ts';
import { PracticeSkeleton } from '../components/Skeletons.tsx'; // Import skeleton
import { getCache, setCache } from '../utils/cache.ts'; // Import cache utilities

const PAGE_SIZE = 10;

// Interface for the cached filter options
interface FilterOptionsCache {
    topics: string[];
    subjects: string[];
    years: string[];
    tags: string[];
}

export function Practice() {
  const { user, userInfo, loading: authLoading } = useAuth(); // Use auth loading state
  const location = useLocation();

  // Filter and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>(location.state?.subject || 'all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('default');

  // Data State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Separate loading state for page data
  const [loadingMore, setLoadingMore] = useState(false);
  const [queryError, setQueryError] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Filter Options State
  const [topics, setTopics] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true); // State for loading filter options

  // Effect to populate filter dropdowns once on mount, using cache
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
        console.log("[Cache] Used cached filter options.");
        return;
      }

      console.log("[Cache] Fetching fresh filter options.");
      try {
        // Fetch all questions - needed for comprehensive filter options
        // Consider optimizing this if 'questions' collection becomes very large
        const questionsQuery = query(collection(db, "questions"));
        const querySnapshot = await getDocs(questionsQuery);
        const questionsData = querySnapshot.docs.map(doc => doc.data() as Question);

        const topicSet = new Set<string>();
        const subjectSet = new Set<string>();
        const yearSet = new Set<string>();
        const tagSet = new Set<string>();

        questionsData.forEach(q => {
            // Add checks for potentially undefined properties
            if(q.topic) topicSet.add(q.topic);
            if(q.subject) subjectSet.add(q.subject);
            if(q.year) yearSet.add(q.year);
            if(q.tags) q.tags.forEach(tag => tag && tagSet.add(tag));
        });

        const newTopics = Array.from(topicSet).sort();
        const newSubjects = Array.from(subjectSet).sort();
        const newYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a)); // Descending years
        const newTags = Array.from(tagSet).sort();

        setTopics(newTopics);
        setSubjects(newSubjects);
        setYears(newYears);
        setTags(newTags);

        // Cache the fetched options for 24 hours
        setCache<FilterOptionsCache>(cacheKey, { topics: newTopics, subjects: newSubjects, years: newYears, tags: newTags }, 86400);

      } catch (error) {
        console.error("Error fetching filter options:", error);
        // Set empty arrays on error? Or keep potentially stale data if needed?
        setTopics([]);
        setSubjects([]);
        setYears([]);
        setTags([]);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchFilterOptions();
  }, []); // Run only once on mount

  // Fetch paginated questions based on filters/sorting
  const fetchQuestions = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
    if (direction === 'first') setLoadingData(true); // Use data loading state
    else setLoadingMore(true);
    setQueryError('');

    try {
      let q = query(collection(db, "questions"));

      // Base filter for verified questions for non-admins
      if (userInfo?.role !== 'admin' && userInfo?.role !== 'moderator') {
        q = query(q, where("verified", "==", true));
      }

      // Add filters to the query
      if (difficultyFilter !== 'all') q = query(q, where('difficulty', '==', difficultyFilter));
      if (subjectFilter !== 'all') q = query(q, where('subject', '==', subjectFilter));
      if (topicFilter !== 'all') q = query(q, where('topic', '==', topicFilter));
      if (yearFilter !== 'all') q = query(q, where('year', '==', yearFilter));
      if (tagFilter !== 'all') q = query(q, where('tags', 'array-contains', tagFilter));

      // Get total count for pagination based on current filters
      const countQuery = query(q);
      const snapshot = await getCountFromServer(countQuery);
      setTotalQuestions(snapshot.data().count);

      // Add sorting *before* pagination
      switch (sortOrder) {
          case 'difficulty-asc': q = query(q, orderBy('difficulty')); break;
          case 'difficulty-desc': q = query(q, orderBy('difficulty', 'desc')); break;
          case 'year-desc': q = query(q, orderBy('year', 'desc')); break;
          case 'year-asc': q = query(q, orderBy('year', 'asc')); break;
          case 'default': default: q = query(q, orderBy('title')); break; // Ensure a default stable order
      }

      // Add pagination logic
      if (direction === 'next' && lastVisible) q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
      else if (direction === 'prev' && firstVisible) q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      else q = query(q, limit(PAGE_SIZE)); // 'first' or initial load

      const documentSnapshots = await getDocs(q);
      const questionsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

      console.log(`Firestore: Fetched ${documentSnapshots.docs.length} documents.`);

      setQuestions(direction === 'prev' ? questionsData.reverse() : questionsData);

      // Update cursors carefully
        if (documentSnapshots.docs.length > 0) {
            // Adjust visible markers based on direction for correct cursor setting with reversed data
            if (direction === 'prev') {
                setFirstVisible(documentSnapshots.docs[0]); // First doc BEFORE reversal is the new first
                setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]); // Last doc BEFORE reversal is the new last
            } else {
                setFirstVisible(documentSnapshots.docs[0]);
                setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            }
        } else if (direction !== 'prev') {
            // Only clear cursors if moving forward/first results in empty page
            setFirstVisible(null);
            setLastVisible(null);
        }
        // If direction is 'prev' and results are empty, keep existing cursors (stay on the last valid page)

      setCurrentPage(page);

    } catch (error: any) {
      console.error("Error fetching questions:", error);
      if (error.code === 'failed-precondition') {
        setQueryError(`Firestore query failed because a database index is missing. This usually happens when you combine filters and sorting. Open your browser's developer console for a link to create the required index automatically.`);
        console.error(error.message); // Log the full error message
      } else {
        setQueryError('An unexpected error occurred while fetching questions.');
      }
      setQuestions([]);
      setTotalQuestions(0);
      setFirstVisible(null);
      setLastVisible(null);
    } finally {
      setLoadingData(false); // Use data loading state
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, lastVisible, firstVisible]); // Include role and cursors

  // Initial data fetch and re-fetch on filter/sort change
  useEffect(() => {
    // Check if filters are loaded before fetching questions
    if (!loadingFilters) {
        setLastVisible(null);
        setFirstVisible(null);
        fetchQuestions(1, 'first');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo?.role, loadingFilters]); // Re-fetch if role or filters change, or when filters finish loading

   // Fetch user submissions
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (user) {
        try {
          const subsCollection = collection(db, `users/${user.uid}/submissions`);
          const subsSnapshot = await getDocs(subsCollection);
          const subsData = subsSnapshot.docs.map(doc => doc.data() as Submission);
          setSubmissions(subsData);
        } catch(e) {
            console.error("Could not fetch submissions: ", e);
        }
      } else {
        setSubmissions([]); // Clear submissions if user logs out
      }
    };
    fetchSubmissions();
  }, [user]);

  // Handle location state for subject filter (passed from Home page)
  useEffect(() => {
    if (location.state?.subject && location.state.subject !== subjectFilter) {
      setSubjectFilter(location.state.subject);
      // Let the main filter/sort useEffect handle the refetch
       // Clear location state after applying it to prevent re-applying on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state, subjectFilter]); // Rerun only if location.state or subjectFilter changes

  // Pagination Handlers
  const handleNextPage = () => {
    // Check total questions and if lastVisible exists
    if (!loadingMore && lastVisible && (currentPage * PAGE_SIZE < totalQuestions)) {
      fetchQuestions(currentPage + 1, 'next');
    }
  };

  const handlePrevPage = () => {
     // Check if firstVisible exists
     if (!loadingMore && firstVisible && currentPage > 1) {
        fetchQuestions(currentPage - 1, 'prev');
    }
  };

  // Filter Reset Handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setDifficultyFilter('all');
    setTopicFilter('all');
    setSubjectFilter('all');
    setYearFilter('all');
    setTagFilter('all');
    setSortOrder('default');
    // The useEffect listening to these state changes will trigger the refetch
  };

  // Client-side search (applies only to the currently displayed page of questions)
  const pagedAndFilteredQuestions = useMemo(() => {
    if (!searchQuery) return questions;
    const lowerCaseQuery = searchQuery.toLowerCase();
    return questions.filter(q =>
        // Add null/undefined checks for safety
        q.id?.toLowerCase().includes(lowerCaseQuery) ||
        q.topic?.toLowerCase().includes(lowerCaseQuery) ||
        q.subject?.toLowerCase().includes(lowerCaseQuery) ||
        q.title?.toLowerCase().includes(lowerCaseQuery)
    );
  }, [searchQuery, questions]);

  // Memoized set of solved question IDs for quick lookup
  const solvedQuestionIds = useMemo(() =>
    new Set(submissions.filter(s => s.correct).map(s => s.qid)),
    [submissions]
  );

  // Helper function for difficulty styling
  const getDifficultyColor = (difficulty: string | undefined) => { // Added undefined check
    switch (difficulty) {
      case 'Easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50';
      case 'Medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50';
      case 'Hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalQuestions / PAGE_SIZE));

  // Show skeleton if auth is loading OR filter options are loading OR initial page data is loading
  if (authLoading || loadingFilters || loadingData) {
    return <PracticeSkeleton />;
  }

  // --- Render Actual Page Content ---
  return (
    <div className="min-h-screen"> {/* Removed bg classes, handled globally */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Practice Questions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {totalQuestions > 0
                ? `Showing ${ (currentPage - 1) * PAGE_SIZE + 1 }-${ Math.min(currentPage * PAGE_SIZE, totalQuestions) } of ${totalQuestions} questions`
                : queryError ? 'Error loading questions' : '0 questions found' // Show error state
            }
          </p>
        </div>

        {/* Filter Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:p-6 mb-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search questions on this page (title, subject, topic...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Filter Dropdowns & Sort */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <Filter className="w-5 h-5 text-gray-400 flex-shrink-0 hidden sm:inline-block" />

              {/* Difficulty Dropdown */}
              <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer">
                <option value="all">Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              {/* Subject Dropdown */}
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer">
                <option value="all">Subject</option>
                {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
              </select>

              {/* Topic Dropdown */}
              <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer">
                <option value="all">Topic</option>
                {topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
              </select>

              {/* Year Dropdown */}
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer">
                <option value="all">Year</option>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>

              {/* Tag Dropdown */}
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer">
                <option value="all">Tag</option>
                {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>

              {/* Spacer */}
              <div className="flex-grow"></div>

              {/* Sort Dropdown */}
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
              {/* Reset Button */}
               <button onClick={handleResetFilters} className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto mt-2 sm:mt-0 justify-center" title="Reset Filters">
                  <RotateCcw className="w-4 h-4" />
                   <span className="sm:hidden">Reset</span> {/* Short text for mobile */}
                </button>
            </div>
          </div>
        </div>

        {/* Query Error Display */}
        {queryError && (
          <div className="text-center py-8 px-4 my-6 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400"/>
              <h3 className="text-red-800 dark:text-red-300 font-semibold text-lg">Database Query Error</h3>
            </div>
            <p className="text-red-600 dark:text-red-400 mt-2 max-w-2xl mx-auto text-sm">{queryError}</p>
          </div>
        )}

        {/* Question List/Table Container */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative shadow-sm">
            {/* Loading Overlay for Pagination */}
            {loadingMore && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}

            {/* Mobile List View */}
            <div className="divide-y divide-gray-200 dark:divide-gray-800 md:hidden">
              {pagedAndFilteredQuestions.map((question) => {
                  const isSolved = solvedQuestionIds.has(question.id);
                  return (
                      <div key={question.id} className="block px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <Link to={`/question/${question.id}`} className="block mb-1">
                              <span className="text-blue-600 dark:text-blue-400 font-medium text-base truncate">
                                  {question.title || `Question ${question.id.substring(0,4)}...`} {/* Fallback */}
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
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded font-medium">
                                  {question.subject || 'N/A'}
                              </span>
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded">
                                  {question.year || '?'}
                              </span>
                              {/* Show verification status only to admins/mods */}
                              {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                                <span className={`px-2 py-0.5 rounded-full font-medium ${question.verified ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'}`}>
                                    {question.verified ? 'Verified' : 'Pending'}
                                </span>
                              )}
                          </div>
                           {/* Show edit button only to admins/mods */}
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

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Title</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Topic</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Difficulty</th>
                        {/* Show verified column only to admins/mods */}
                        {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Verified</th>}
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Details</th>
                        {/* Show actions column only to admins/mods */}
                        {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Actions</th>}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {pagedAndFilteredQuestions.map((question) => {
                      const isSolved = solvedQuestionIds.has(question.id);
                      return (
                          <tr key={question.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-center">{isSolved ? <CheckCircle className="w-5 h-5 text-green-500 inline-block" /> : <Circle className="w-5 h-5 text-gray-300 dark:text-gray-700 inline-block" />}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><Link to={`/question/${question.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">{question.title || `Question ${question.id.substring(0,4)}...`}</Link></td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className="text-gray-900 dark:text-white text-sm">{question.topic || 'N/A'}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>{question.difficulty || '?'}</span></td>
                            {/* Verified column */}
                            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-xs font-medium ${question.verified ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'}`}>{question.verified ? 'Yes' : 'No'}</span></td>}
                            {/* Details column */}
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex flex-wrap gap-1"><span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded text-xs font-medium">{question.subject || 'N/A'}</span><span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded text-xs">{question.year || '?'}</span></div></td>
                            {/* Actions column */}
                            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && <td className="px-6 py-4 whitespace-nowrap"><Link to={`/edit-question/${question.id}`} className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-sm font-medium"><Edit className="w-4 h-4" /> Edit</Link></td>}
                          </tr>
                      );
                      })}
                  </tbody>
                </table>
            </div>
        </div>

        {/* No Questions Message */}
        {pagedAndFilteredQuestions.length === 0 && !loadingData && !queryError && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No questions found matching your criteria. Try adjusting the filters.
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalQuestions > PAGE_SIZE && !queryError && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button onClick={handlePrevPage} disabled={currentPage === 1 || loadingMore} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-400 order-first sm:order-none">
                    Page {currentPage} of {totalPages}
                </span>
                <button onClick={handleNextPage} disabled={currentPage === totalPages || loadingMore || questions.length < PAGE_SIZE || !lastVisible /* Disable if no next cursor */} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Next <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

