import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight, BookOpen, BarChart } from 'lucide-react';
// Corrected import paths to be relative
import { useAuth } from '../contexts/AuthContext';
import { useDailyChallenge } from '../contexts/DailyChallengeContext'; // Import the Daily Challenge hook
import { useMetadata } from '../contexts/MetadataContext'; // Import the Metadata hook
import { db } from '../firebase';
import { collection, getDocs, query, limit, orderBy, doc, getDoc } from 'firebase/firestore'; // <-- Import doc and getDoc
import { User, Question } from '../data/mockData'; // <-- Re-added 'Question' type
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

// --- RATING FUNCTION REMOVED ---
// No longer needed, as rating is pre-calculated and read from the user document.

export function Home() {
  const { userInfo, isAuthenticated, loading: authLoading } = useAuth(); // Use auth loading state
  const { metadata, loading: metadataLoading } = useMetadata(); // Get metadata and loading state
  const { dailyChallengeId, loadingChallenge } = useDailyChallenge(); // <-- Get ID and loading state
  
  const [dailyChallenge, setDailyChallenge] = useState<Question | null>(null); // <-- State for the full challenge object
  const [leaderboardPreview, setLeaderboardPreview] = useState<User[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true); // Separate loading state for leaderboard

  // --- DERIVE SUBJECTS FROM METADATA ---
  // This is now instant and costs 0 reads, as metadata is already loaded.
  const subjectStats: SubjectStats[] = useMemo(() => { // <-- Added explicit type
    if (!metadata?.subjectCounts) {
      return [];
    }
    return Object.entries(metadata.subjectCounts)
      .map(([name, count]) => ({
        name,
        count: count || 0, // Ensure count is a number
        color: getColorForString(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [metadata]);


  // --- FETCH LEADERBOARD DATA ---
  // This useEffect is now *only* responsible for fetching the leaderboard preview.
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoadingLeaderboard(true);
      try {
        // --- *** FIX: Query by 'rating' field *** ---
        // This is now consistent with Leaderboard.tsx and is accurate.
        const usersQuery = query(collection(db, 'users'), orderBy('rating', 'desc'), limit(5));
        const usersSnapshot = await getDocs(usersQuery);
        
        const fetchedUsers = usersSnapshot.docs.map(doc => {
            const data = doc.data() as User;
            // Ensure stats and rating exist for display
            if (!data.stats) {
                data.stats = { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
            }
            if (data.rating === undefined) {
                data.rating = 0;
            }
            return data;
        });

        // --- REMOVED: Client-side calculation and sorting ---
        // The query is already sorted by rating.

        setLeaderboardPreview(fetchedUsers); // Already the top 5
        // --- End Leaderboard Preview Update ---

      } catch (error) {
        console.error("Error fetching leaderboard preview:", error);
        setLeaderboardPreview([]);
      } finally {
        setLoadingLeaderboard(false); // Finish data loading
      }
    };

    fetchLeaderboard();
  }, []); // Run only once on mount

  // --- FETCH DAILY CHALLENGE OBJECT ---
  // This useEffect fetches the single daily challenge question *after* its ID is loaded.
  useEffect(() => {
    const fetchChallenge = async () => {
      if (dailyChallengeId) {
        try {
          const docRef = doc(db, 'questions', dailyChallengeId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setDailyChallenge({ id: docSnap.id, ...docSnap.data() } as Question);
          } else {
            console.warn("Daily challenge document not found:", dailyChallengeId);
            setDailyChallenge(null);
          }
        } catch (error) {
          console.error("Error fetching daily challenge object:", error);
          setDailyChallenge(null);
        }
      } else {
        setDailyChallenge(null); // No ID, so no challenge
      }
    };

    if (!loadingChallenge) { // Only run once the challenge ID has been determined
      fetchChallenge();
    }
  }, [dailyChallengeId, loadingChallenge]);

  // Show skeleton if either auth, metadata, or challenge ID is loading
  if (authLoading || metadataLoading || loadingChallenge) {
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
            {/* --- FIX: Use pre-calculated rating from userInfo --- */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Current Rating: <span className="font-semibold text-blue-600 dark:text-blue-400">{userInfo.rating ?? 0}</span>
            </p>
          </div>
        )}
      </div>

      {/* Daily Challenge Section */}
      {isAuthenticated && dailyChallenge && ( // <-- This 'dailyChallenge' now refers to our local state
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
                state={{ subject: subject.name }} // Pass subject to Practice page
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
            {subjectStats.length === 0 && (
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
            {loadingLeaderboard ? (
              // Simple skeleton for leaderboard
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded bg-slate-200 dark:bg-slate-700 w-3/4"></div>
                    <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-1/2"></div>
                  </div>
                  <div className="h-4 rounded bg-slate-200 dark:bg-slate-700 w-1/4"></div>
                </div>
              ))
            ) : leaderboardPreview.length === 0 ? (
              <p className="p-4 text-center text-slate-500 dark:text-slate-400">No users yet.</p>
            ) : (
              // Display users (already sorted by rating from query)
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
                  <img src={leader.avatar || '/user.png'} alt={leader.name} className="w-10 h-10 rounded-full object-cover border dark:border-slate-700" onError={(e) => { (e.target as HTMLImageElement).src = '/user.png'; }}/>
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

