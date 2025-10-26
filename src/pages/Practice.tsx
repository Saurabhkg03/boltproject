import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, CheckCircle, Circle, Loader2, Edit, ArrowDownUp, ChevronLeft, ChevronRight, AlertTriangle, RotateCcw } from 'lucide-react'; // Added RotateCcw for reset
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, DocumentSnapshot, endBefore, limitToLast } from 'firebase/firestore';
import { Question, Submission } from '../data/mockData.ts';

const PAGE_SIZE = 10;

export function Practice() {
  const { user, userInfo } = useAuth();
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
  const [loading, setLoading] = useState(true);
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

  // Effect to populate filter dropdowns once on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        // This query can be optimized further by storing metadata in a separate document
        const questionsQuery = query(collection(db, "questions"), where("verified", "==", true));
        const querySnapshot = await getDocs(questionsQuery);
        const questionsData = querySnapshot.docs.map(doc => doc.data() as Question);

        const topicSet = new Set(questionsData.map(q => q.topic));
        setTopics(Array.from(topicSet).sort());

        const subjectSet = new Set(questionsData.map(q => q.subject));
        setSubjects(Array.from(subjectSet).sort());

        const yearSet = new Set(questionsData.map(q => q.year));
        setYears(Array.from(yearSet).sort((a, b) => b.localeCompare(a)));

        const tagSet = new Set(questionsData.flatMap(q => q.tags || []));
        setTags(Array.from(tagSet).sort());
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    };
    fetchFilterOptions();
  }, []);

  const fetchQuestions = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
    if (direction === 'first') setLoading(true);
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
      const countQuery = query(q); // Create count query *after* applying filters
      const snapshot = await getCountFromServer(countQuery);
      setTotalQuestions(snapshot.data().count);

      // Add sorting to the query *before* pagination cursors/limits
      switch (sortOrder) {
          case 'difficulty-asc':
              q = query(q, orderBy('difficulty'));
              break;
          case 'difficulty-desc':
              q = query(q, orderBy('difficulty', 'desc'));
              break;
          case 'year-desc':
              q = query(q, orderBy('year', 'desc'));
              break;
          case 'year-asc':
              q = query(q, orderBy('year', 'asc'));
              break;
          case 'default':
          default:
              // Ensure the default orderBy field exists if needed for pagination cursors
              q = query(q, orderBy('title')); // Default sort by title
              break;
      }

      // Add pagination logic to the query
      if (direction === 'next' && lastVisible) {
        q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisible) {
        q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      } else { // 'first' or initial load
        q = query(q, limit(PAGE_SIZE));
      }

      const documentSnapshots = await getDocs(q);
      const questionsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

      // Log the number of documents fetched
      console.log(`Firestore: Fetched ${documentSnapshots.docs.length} documents.`);

      // Handle potential empty results or reverse order for 'prev'
       if (direction === 'prev' && questionsData.length > 0) {
           // Firestore returns in ascending order for limitToLast, reverse for UI
           setQuestions(questionsData.reverse());
       } else {
           setQuestions(questionsData);
       }

      if(documentSnapshots.docs.length > 0) {
         // Adjust visible markers based on direction
         if (direction === 'prev') {
            setFirstVisible(documentSnapshots.docs[0]); // First of the reversed set
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]); // Last of the reversed set
          } else {
            setFirstVisible(documentSnapshots.docs[0]);
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
          }
      } else {
          // If no documents, clear cursors (especially important for 'first'/'next')
          if (direction !== 'prev') { // Don't clear on prev if no results (stay on last page)
              setFirstVisible(null);
              setLastVisible(null);
          }
      }
      setCurrentPage(page);

    } catch (error: any) {
      console.error("Error fetching questions:", error);
      if (error.code === 'failed-precondition') {
        setQueryError(`Firestore query failed because a database index is missing. This usually happens when you combine filters and sorting. Open your browser's developer console for a link to create the required index automatically.`);
        console.error(error.message);
      } else {
        setQueryError('An unexpected error occurred while fetching questions.');
      }
      setQuestions([]);
      setTotalQuestions(0);
       setFirstVisible(null); // Clear cursors on error too
       setLastVisible(null);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [difficultyFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo, lastVisible, firstVisible]); // Include cursors

  // Initial data fetch and re-fetch on filter/sort change
  useEffect(() => {
    // Reset pagination when filters change
    setLastVisible(null);
    setFirstVisible(null);
    fetchQuestions(1, 'first');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter, subjectFilter, topicFilter, yearFilter, tagFilter, sortOrder, userInfo]); // Don't depend on fetchQuestions directly here

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
      }
    };
    fetchSubmissions();
  }, [user]);

  // Handle location state for subject filter
  useEffect(() => {
    if (location.state?.subject && location.state.subject !== subjectFilter) {
      setSubjectFilter(location.state.subject);
      // Let the main filter/sort useEffect handle the refetch
    }
  }, [location.state, subjectFilter]);

  const handleNextPage = () => {
    // Check if there *might* be a next page based on current count vs page size
    if (questions.length === PAGE_SIZE && !loadingMore) {
      fetchQuestions(currentPage + 1, 'next');
    }
  };

  const handlePrevPage = () => {
     if (currentPage > 1 && !loadingMore) {
        // We need the *first* visible document of the *current* page to go *before* it
        fetchQuestions(currentPage - 1, 'prev');
    }
  };

  // Function to reset filters
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

  // Client-side search on the current page's data
  const pagedAndFilteredQuestions = useMemo(() => {
    if (!searchQuery) return questions;
    const lowerCaseQuery = searchQuery.toLowerCase();
    return questions.filter(q =>
        q.id.toLowerCase().includes(lowerCaseQuery) ||
        q.topic.toLowerCase().includes(lowerCaseQuery) ||
        q.subject.toLowerCase().includes(lowerCaseQuery) ||
        q.title.toLowerCase().includes(lowerCaseQuery)
    );
  }, [searchQuery, questions]);

  const solvedQuestionIds = useMemo(() =>
    new Set(submissions.filter(s => s.correct).map(s => s.qid)),
    [submissions]
  );

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50';
      case 'Medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50';
      case 'Hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalQuestions / PAGE_SIZE)); // Ensure at least 1 page

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="ml-4 text-lg">Loading Questions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Practice Questions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {totalQuestions > 0
                ? `Showing ${ (currentPage - 1) * PAGE_SIZE + 1 }-${ Math.min(currentPage * PAGE_SIZE, totalQuestions) } of ${totalQuestions} questions`
                : '0 questions found'
            }
          </p>
        </div>

        {/* Filter Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search questions on this page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Filters Row - Use flex-wrap, adjust padding/width for compactness */}
            <div className="flex flex-wrap items-center gap-2 text-sm"> {/* Reduced gap */}
                <Filter className="w-5 h-5 text-gray-400 flex-shrink-0 hidden sm:inline-block" /> {/* Hide icon on mobile */}

              {/* Reduced padding (px-2 py-1), added sm:w-auto */}
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">Subject</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">Topic</option>
                {topics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                 className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">Year</option>
                {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">Tag</option>
                {tags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>

              {/* Spacer */}
              <div className="flex-grow"></div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                <ArrowDownUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full sm:w-auto px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
                >
                    <option value="default">Sort: Title</option>
                    <option value="difficulty-asc">Difficulty ↑</option>
                    <option value="difficulty-desc">Difficulty ↓</option>
                    <option value="year-desc">Year ↓</option>
                    <option value="year-asc">Year ↑</option>
                </select>
              </div>
                {/* Reset Button */}
               <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto mt-2 sm:mt-0 justify-center"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                   <span className="sm:hidden">Reset Filters</span> {/* Show text only on mobile */}
                </button>
            </div>
          </div>
        </div>

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
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
            {loadingMore && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500"/></div>}

            {/* Use div for mobile list items, table for desktop */}
            <div className="divide-y divide-gray-200 dark:divide-gray-800 md:hidden">
              {/* Mobile List View */}
              {pagedAndFilteredQuestions.map((question) => {
                  const isSolved = solvedQuestionIds.has(question.id);
                  return (
                      <div key={question.id} className="block px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <Link to={`/question/${question.id}`} className="block mb-1">
                              <span className="text-blue-600 dark:text-blue-400 font-medium text-base truncate">
                                  {question.title}
                              </span>
                          </Link>
                           <div className="flex items-center gap-2 mb-2"> {/* Moved Status Below Title */}
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
                                {question.difficulty}
                              </span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded font-medium">
                                  {question.subject}
                              </span>
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded">
                                  {question.year}
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

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto"> {/* Added overflow-x-auto for safety */}
                {/* Ensure no whitespace directly inside table */}
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          Title
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          Topic
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          Difficulty
                      </th>
                      {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Verified
                          </th>
                      )}
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          Details
                      </th>
                      {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Actions
                          </th>
                      )}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {pagedAndFilteredQuestions.map((question) => {
                      const isSolved = solvedQuestionIds.has(question.id);
                      return (
                          <tr key={question.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                {isSolved ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                <Circle className="w-5 h-5 text-gray-300 dark:text-gray-700" />
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <Link
                                    to={`/question/${question.id}`}
                                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm"
                                >
                                {question.title}
                                </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-gray-900 dark:text-white text-sm">
                                {question.topic}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                                {question.difficulty}
                                </span>
                            </td>
                            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${question.verified ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'}`}>
                                        {question.verified ? 'Yes' : 'No'}
                                    </span>
                                </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded text-xs font-medium">
                                    {question.subject}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded text-xs">
                                    {question.year}
                                </span>
                                </div>
                            </td>
                            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <Link to={`/edit-question/${question.id}`} className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-sm font-medium">
                                        <Edit className="w-4 h-4" /> Edit
                                    </Link>
                                </td>
                            )}
                          </tr>
                      );
                      })}
                  </tbody>
                </table>
            </div>
        </div>

        {pagedAndFilteredQuestions.length === 0 && !loading && !queryError && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No questions found matching your criteria.
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalQuestions > 0 && !queryError &&(
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                onClick={handlePrevPage}
                disabled={currentPage === 1 || loadingMore}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                <ChevronLeft className="w-4 h-4" />
                Previous
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-400 order-first sm:order-none">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages || loadingMore || questions.length < PAGE_SIZE}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                Next
                <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        )}

      </div>
    </div>
  );
}

