import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, CheckCircle, Circle, Loader2, Edit, ArrowDownUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Question, Submission } from '../data/mockData.ts';

export function Practice() {
  const { user, userInfo } = useAuth();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>(location.state?.subject || 'all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('default');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.state?.subject) {
      setSubjectFilter(location.state.subject);
    }
  }, [location.state]);


  useEffect(() => {
    const fetchQuestionsAndSubmissions = async () => {
      setLoading(true);
      try {
        // Show only verified questions to users. Admins/mods can see all.
        const questionsQuery = (userInfo?.role === 'admin' || userInfo?.role === 'moderator') 
          ? collection(db, "questions")
          : query(collection(db, "questions"), where("verified", "==", true));

        const querySnapshot = await getDocs(questionsQuery);
        const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setQuestions(questionsData);

        if (user) {
          const subsCollection = collection(db, `users/${user.uid}/submissions`);
          const subsSnapshot = await getDocs(subsCollection);
          const subsData = subsSnapshot.docs.map(doc => doc.data() as Submission);
          setSubmissions(subsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionsAndSubmissions();
  }, [user, userInfo]);

  const topics = useMemo(() => {
    const topicSet = new Set(questions.map(q => q.topic));
    return Array.from(topicSet).sort();
  }, [questions]);

  const subjects = useMemo(() => {
    const subjectSet = new Set(questions.map(q => q.subject));
    return Array.from(subjectSet).sort();
  }, [questions]);

  const years = useMemo(() => {
      const yearSet = new Set(questions.map(q => q.year));
      return Array.from(yearSet).sort((a, b) => b.localeCompare(a)); // Sort descending
  }, [questions]);

  const tags = useMemo(() => {
      const tagSet = new Set(questions.flatMap(q => q.tags || []));
      return Array.from(tagSet).sort();
  }, [questions]);

  const filteredAndSortedQuestions = useMemo(() => {
    let filtered = questions.filter(q => {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const matchesSearch =
        q.id.toLowerCase().includes(lowerCaseQuery) ||
        q.topic.toLowerCase().includes(lowerCaseQuery) ||
        q.subject.toLowerCase().includes(lowerCaseQuery) ||
        q.title.toLowerCase().includes(lowerCaseQuery);

      const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
      const matchesTopic = topicFilter === 'all' || q.topic === topicFilter;
      const matchesSubject = subjectFilter === 'all' || q.subject === subjectFilter;
      const matchesYear = yearFilter === 'all' || q.year === yearFilter;
      const matchesTag = tagFilter === 'all' || (q.tags && q.tags.includes(tagFilter));

      return matchesSearch && matchesDifficulty && matchesTopic && matchesSubject && matchesYear && matchesTag;
    });

    const difficultyOrder: { [key: string]: number } = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };

    switch (sortOrder) {
        case 'difficulty-asc':
            filtered.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
            break;
        case 'difficulty-desc':
            filtered.sort((a, b) => difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty]);
            break;
        case 'year-desc':
            filtered.sort((a, b) => b.year.localeCompare(a.year));
            break;
        case 'year-asc':
            filtered.sort((a, b) => a.year.localeCompare(b.year));
            break;
        case 'default':
        default:
             // Default sort by the numeric part of the title
            filtered.sort((a, b) => {
                const numA = parseInt(a.title.replace('Question ', ''), 10);
                const numB = parseInt(b.title.replace('Question ', ''), 10);
                return numA - numB;
            });
            break;
    }

    return filtered;

  }, [searchQuery, difficultyFilter, topicFilter, subjectFilter, yearFilter, tagFilter, sortOrder, questions]);

  const solvedQuestionIds = new Set(
    submissions.filter(s => s.correct).map(s => s.qid)
  );

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
      case 'Medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950';
      case 'Hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950';
    }
  };

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
            {filteredAndSortedQuestions.length} of {questions.length} questions available
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search questions by ID, topic, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center flex-wrap gap-4">
               <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">All Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">All Subjects</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">All Topics</option>
                {topics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">All Years</option>
                {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">All Tags</option>
                {tags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <div className="flex-grow"></div>
              <div className="flex items-center gap-2">
                <ArrowDownUp className="w-5 h-5 text-gray-400" />
                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
                >
                    <option value="default">Default</option>
                    <option value="difficulty-asc">Difficulty: Easy to Hard</option>
                    <option value="difficulty-desc">Difficulty: Hard to Easy</option>
                    <option value="year-desc">Year: Newest First</option>
                    <option value="year-asc">Year: Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Topic
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Difficulty
                  </th>
                  {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Verified
                     </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Details
                  </th>
                  {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredAndSortedQuestions.map((question) => {
                  const isSolved = solvedQuestionIds.has(question.id);
                  return (
                    <tr
                      key={question.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isSolved ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 dark:text-gray-700" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                         <Link
                          to={`/question/${question.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {question.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="text-gray-900 dark:text-white"
                        >
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
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${question.verified ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                {question.verified ? 'Yes' : 'No'}
                            </span>
                        </td>
                      )}
                       <td className="px-6 py-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium">
                            {question.subject}
                          </span>
                           <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs">
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

        {filteredAndSortedQuestions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No questions found matching your filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

