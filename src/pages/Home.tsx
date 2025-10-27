import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight, BookOpen, BarChart } from 'lucide-react'; // Changed Award to BarChart
// Corrected import paths to be relative
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { Question, User } from '../data/mockData'; // User interface includes 'rating'
import { HomeSkeleton } from '../components/Skeletons'; // Import skeleton

interface SubjectStats {
  name: string;
  count: number;
  color: string;
}

const COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
  'bg-yellow-500', 'bg-cyan-500'
];

const getColorForString = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return COLORS[0];
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};

// --- RATING FUNCTION (copied from Leaderboard.tsx) ---
const RATING_SCALING_FACTOR = 100;
const calculateRating = (accuracy: number | undefined, correct: number | undefined): number => {
    const safeAccuracy = accuracy ?? 0;
    const safeCorrect = correct ?? 0;
    const rating = Math.max(0, (safeAccuracy / 100) * Math.log10(safeCorrect + 1) * RATING_SCALING_FACTOR);
    return parseFloat(rating.toFixed(2));
};

export function Home() {
  const { userInfo, isAuthenticated, loading: authLoading } = useAuth(); // Use auth loading state
  const [dailyChallenge, setDailyChallenge] = useState<Question | null>(null);
  const [leaderboardPreview, setLeaderboardPreview] = useState<User[]>([]); // Renamed state
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Separate loading state for page data

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true); // Start data loading
      try {
        // Fetch questions for subjects and daily challenge
        const questionsQuery = query(collection(db, 'questions'), orderBy('title')); // Consistent ordering
        const questionsSnapshot = await getDocs(questionsQuery);
        const questionsData = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

        // Calculate Subject Stats
        const subjectMap = questionsData.reduce((acc, q) => {
          const subjectName = q.subject || 'Uncategorized';
          acc[subjectName] = (acc[subjectName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const updatedSubjects = Object.entries(subjectMap)
            .map(([name, count]) => ({
                name,
                count,
                color: getColorForString(name),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        setSubjectStats(updatedSubjects);

        // Determine Daily Challenge
        if (questionsData.length > 0) {
          const now = new Date();
          const start = new Date(now.getFullYear(), 0, 0);
          const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
          const oneDay = 1000 * 60 * 60 * 24;
          const dayOfYear = Math.floor(diff / oneDay);
          const challengeIndex = (dayOfYear - 1 + questionsData.length) % questionsData.length; // Ensure positive index
          setDailyChallenge(questionsData[challengeIndex]);
        }

        // --- Fetch and Process Top Users for Leaderboard Preview ---
        // Query ordered primarily by correct count
        const usersQuery = query(collection(db, 'users'), orderBy('stats.correct', 'desc'), orderBy('stats.accuracy', 'desc'), limit(5));
        const usersSnapshot = await getDocs(usersQuery);
        const fetchedUsers = usersSnapshot.docs.map(doc => {
             const data = doc.data() as User;
             // Ensure stats exist
            if (!data.stats) {
                data.stats = { attempted: 0, correct: 0, accuracy: 0 };
            } else {
                 data.stats.attempted = data.stats.attempted ?? 0;
                 data.stats.correct = data.stats.correct ?? 0;
                 data.stats.accuracy = data.stats.accuracy ?? 0;
            }
            return data;
        });

        // Calculate rating for each fetched user
        const usersWithRating = fetchedUsers.map(user => ({
            ...user,
            rating: calculateRating(user.stats?.accuracy, user.stats?.correct)
        }));

        // Re-sort client-side based on the calculated rating
        usersWithRating.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

        // Set the top 5 (or fewer) based on the calculated rating
        setLeaderboardPreview(usersWithRating.slice(0, 5));
        // --- End Leaderboard Preview Update ---

      } catch (error) {
        console.error("Error fetching home page data:", error);
        setSubjectStats([]);
        setLeaderboardPreview([]);
        setDailyChallenge(null);
      } finally {
        setLoadingData(false); // Finish data loading
      }
    };

    fetchData();
  }, []); // Run only once on mount

  // Show skeleton if either auth is loading OR page data is loading
  if (authLoading || loadingData) {
    return <HomeSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      {/* Header Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          Practice. Analyze. <span className="text-blue-500">Master GATE.</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
          Your complete platform for GATE Electronics & Communication preparation, with curated questions, performance tracking, and community leaderboards.
        </p>
        {/* Welcome Message */}
        {isAuthenticated && userInfo && (
          <div className="mt-8 inline-block glass-card p-4">
            <p className="text-lg text-slate-700 dark:text-slate-300">
              Welcome back, <span className="font-semibold text-blue-600 dark:text-blue-300">{userInfo.name}</span>!
            </p>
            {/* Display Rating instead of Accuracy */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
               Current Rating: <span className="font-semibold text-blue-600 dark:text-blue-400">{calculateRating(userInfo.stats.accuracy, userInfo.stats.correct)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Daily Challenge Section */}
      {isAuthenticated && dailyChallenge && (
        <div className="mb-16 glass-card p-6 md:p-8 border-blue-500/20">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Daily Challenge</h2>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                  "{dailyChallenge.title}" from {dailyChallenge.subject}. Give it a shot!
                </p>
              </div>
              <Link
                to={`/question/${dailyChallenge.id}`}
                className="inline-flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-full font-semibold hover:bg-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                Start Now
                <ArrowRight className="w-5 h-5" />
              </Link>
          </div>
        </div>
      )}

      {/* Main Grid: Subjects & Leaderboard Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Subjects Section */}
        <div className="lg:col-span-2">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
            Subjects Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subjectStats.map((subject) => (
              <Link
                key={subject.name}
                to="/practice"
                state={{ subject: subject.name }}
                className={`glass-card p-6 transition-all duration-300 group ${
                  subject.count > 0
                    ? 'hover:shadow-xl hover:-translate-y-1'
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={(e) => { if (subject.count === 0) e.preventDefault(); }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform ${subject.color} ${subject.count > 0 ? 'group-hover:scale-110' : ''} shadow-md`}>
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-white">
                      {subject.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {subject.count} questions
                    </p>
                  </div>
                  {subject.count > 0 && (
                    <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  )}
                </div>
              </Link>
            ))}
             {/* Placeholder if no subjects */}
             {subjectStats.length === 0 && !loadingData && (
                <p className="md:col-span-2 text-center text-slate-500 dark:text-slate-400 py-6">
                    No subjects found. Add questions in the admin panel.
                </p>
             )}
          </div>
        </div>

        {/* Leaderboard Preview Section */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Top Performers
            </h2>
            <Link to="/leaderboard" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {leaderboardPreview.length === 0 ? (
              <p className="p-4 text-center text-slate-500 dark:text-slate-400">No users yet.</p>
            ) : (
              // Display users sorted by calculated rating
              leaderboardPreview.map((leader, index) => (
                <div key={leader.uid} className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                    index === 0 ? 'bg-yellow-400 text-white' :
                    index === 1 ? 'bg-slate-400 text-white' :
                    index === 2 ? 'bg-orange-500 text-white' :
                    'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {index + 1}
                  </div>
                  {/* Avatar */}
                  <img src={leader.avatar || '/user.png'} alt={leader.name} className="w-10 h-10 rounded-full object-cover border dark:border-slate-700" onError={(e) => { e.currentTarget.src = '/user.png'; }}/>
                  {/* Name & Solved */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-white truncate">{leader.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {leader.stats.correct || 0} solved
                    </p>
                  </div>
                  {/* Rating */}
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Performance Rating">
                    <BarChart className="w-4 h-4" />
                    <span className="font-semibold text-sm">{leader.rating ?? 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Call to Action (if not logged in) */}
      {!isAuthenticated && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 md:pb-20">
            <div className="glass-card p-8 text-center">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                Ready to start?
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                Create an account or log in to track your progress.
                </p>
                <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                Get Started <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
      )}
    </div>
  );
}

