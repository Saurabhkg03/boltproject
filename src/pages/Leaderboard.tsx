import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Award, Target, Crown, ChevronLeft, ChevronRight } from 'lucide-react'; // Removed Loader2
import { db } from '../firebase.ts';
import { collection, getDocs, query, orderBy, limit, startAfter, getCountFromServer, DocumentSnapshot, endBefore, limitToLast } from 'firebase/firestore';
import { User } from '../data/mockData.ts';
import { useAuth } from '../contexts/AuthContext.tsx'; // Import useAuth
import { LeaderboardSkeleton } from '../components/Skeletons.tsx'; // Import skeleton

const PAGE_SIZE = 10; // Set page size to 10

// --- PODIUM CARD COMPONENT ---
const PodiumCard = ({ user, rank }: { user: User; rank: number }) => {
  const rankStyles = {
    1: { gradient: 'from-amber-400 to-yellow-500', shadow: 'shadow-yellow-500/40', iconColor: 'text-amber-600 dark:text-amber-300', ring: 'ring-yellow-400', order: 'order-1 md:order-2', height: 'mt-0 md:-mt-6' },
    2: { gradient: 'from-slate-400 to-gray-500', shadow: 'shadow-gray-500/40', iconColor: 'text-gray-600 dark:text-slate-300', ring: 'ring-gray-400', order: 'order-2 md:order-1', height: 'mt-0' },
    3: { gradient: 'from-orange-400 to-amber-600', shadow: 'shadow-orange-600/40', iconColor: 'text-orange-600 dark:text-orange-300', ring: 'ring-orange-500', order: 'order-3', height: 'mt-0' },
  }[rank] || {};

  return (
    <div className={`flex flex-col items-center ${rankStyles.order} ${rankStyles.height}`}>
      <div className={`relative w-full glass-card p-4 rounded-2xl text-center flex flex-col items-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${rankStyles.shadow}`}>
        {rank === 1 && <Crown className="absolute -top-3.5 w-7 h-7 text-yellow-400 drop-shadow-lg" fill="currentColor" />}
        <div className={`absolute top-2 right-2 text-xl font-bold ${rankStyles.iconColor} opacity-70`}>#{rank}</div>
        <img
          src={user.avatar || '/user.png'}
          alt={user.name}
          className={`w-20 h-20 rounded-full object-cover mb-3 ring-4 ${rankStyles.ring}`}
          onError={(e) => { e.currentTarget.src = '/user.png'; }} // Fallback image
        />
        <Link to={`/profile/${user.username}`} className="font-bold text-slate-800 dark:text-white text-base hover:underline truncate w-full">{user.name}</Link>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-full">@{user.username}</p>
        <div className={`mt-3 w-full bg-gradient-to-r ${rankStyles.gradient} p-2 rounded-lg`}>
          <div className="flex justify-around items-center text-white">
            <div className="text-center">
              <p className="font-bold text-lg">{user.stats?.correct ?? 0}</p> {/* Nullish coalescing for safety */}
              <p className="text-xs opacity-80">Solved</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{(user.stats?.accuracy ?? 0).toFixed(1)}%</p> {/* Nullish coalescing for safety */}
              <p className="text-xs opacity-80">Accuracy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN LEADERBOARD COMPONENT ---
export function Leaderboard() {
  const { loading: authLoading } = useAuth(); // Get auth loading state
  const [sortBy, setSortBy] = useState<'accuracy' | 'solved'>('accuracy');
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Renamed loading state
  const [loadingMore, setLoadingMore] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);

  // Fetch Leaderboard Data with Pagination
  const fetchLeaderboard = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
    if (direction === 'first') setLoadingData(true); // Use data loading state
    else setLoadingMore(true);

    try {
      const usersCollection = collection(db, 'users');

      // Only fetch total count on the first load or when sorting changes
      if (direction === 'first') {
          const countSnapshot = await getCountFromServer(query(usersCollection)); // Count all users
          setTotalUsers(countSnapshot.data().count);
      }

      // Base query
      let q = query(usersCollection);

      // Apply sorting
      if (sortBy === 'accuracy') {
        q = query(q, orderBy('stats.accuracy', 'desc'), orderBy('stats.correct', 'desc'));
      } else { // sortBy === 'solved'
        q = query(q, orderBy('stats.correct', 'desc'), orderBy('stats.accuracy', 'desc'));
      }

      // Apply pagination logic
      if (direction === 'next' && lastVisible) {
        q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisible) {
         q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      } else { // 'first' or initial load
        q = query(q, limit(PAGE_SIZE));
      }

      const usersSnapshot = await getDocs(q);
       // Add null checks for stats when mapping
      const usersData = usersSnapshot.docs.map(doc => {
          const data = doc.data() as User;
          // Ensure stats object and its properties exist
          if (!data.stats) {
              data.stats = { attempted: 0, correct: 0, accuracy: 0 };
          } else {
               data.stats.attempted = data.stats.attempted ?? 0;
               data.stats.correct = data.stats.correct ?? 0;
               data.stats.accuracy = data.stats.accuracy ?? 0;
          }
          return data;
      });


      console.log(`Firestore Leaderboard: Fetched ${usersSnapshot.docs.length} documents.`);

      setLeaderboard(direction === 'prev' ? usersData.reverse() : usersData);

      // Update cursors
      if (usersSnapshot.docs.length > 0) {
        setFirstVisible(usersSnapshot.docs[0]);
        setLastVisible(usersSnapshot.docs[usersSnapshot.docs.length - 1]);
      } else if (direction !== 'prev') {
        setFirstVisible(null);
        setLastVisible(null);
      }
      setCurrentPage(page);

    } catch (error) {
      console.error("Error fetching leaderboard data:", error);
      setLeaderboard([]);
      setTotalUsers(0);
      setFirstVisible(null);
      setLastVisible(null);
    } finally {
      setLoadingData(false); // Use data loading state
      setLoadingMore(false);
    }
  }, [sortBy, firstVisible, lastVisible]); // Depend on sortBy and cursors

  // Initial fetch and refetch when sortBy changes
  useEffect(() => {
    setFirstVisible(null);
    setLastVisible(null);
    fetchLeaderboard(1, 'first');
   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]); // Rerun only when sortBy changes

  const handleNextPage = () => {
    // Check total users and if lastVisible exists
    if (!loadingMore && lastVisible && currentPage < totalPages) {
      fetchLeaderboard(currentPage + 1, 'next');
    }
  };

  const handlePrevPage = () => {
     // Check if firstVisible exists
    if (!loadingMore && firstVisible && currentPage > 1) {
       fetchLeaderboard(currentPage - 1, 'prev');
    }
  };


  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

  // Extract top 3 *only* if on the first page and data is loaded
  const topThreePodium = !loadingData && currentPage === 1 ? leaderboard.slice(0, 3) : [];
  // Adjust the rest of the list based on whether the podium is shown
  const listUsers = !loadingData && currentPage === 1 ? leaderboard.slice(topThreePodium.length) : leaderboard;

  // Show skeleton if auth is loading OR initial data is loading
  if (authLoading || loadingData) {
    return <LeaderboardSkeleton />;
  }

  // --- Render Actual Page ---
  return (
    <div className="min-h-screen w-full px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-1">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Leaderboard</h1>
          </div>
           <p className="text-slate-600 dark:text-slate-400 text-sm">
             {totalUsers > 0
                ? `Showing ${ (currentPage - 1) * PAGE_SIZE + 1 }-${ Math.min(currentPage * PAGE_SIZE, totalUsers) } of ${totalUsers} users`
                : 'Top performers in GATE ECE preparation'
             }
           </p>
        </div>

        {/* --- CONDITIONAL PODIUM SECTION --- */}
        {currentPage === 1 && topThreePodium.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
            {topThreePodium[1] && <PodiumCard user={topThreePodium[1]} rank={2} />}
            {topThreePodium[0] && <PodiumCard user={topThreePodium[0]} rank={1} />}
            {topThreePodium[2] && <PodiumCard user={topThreePodium[2]} rank={3} />}
          </div>
        )}
        {/* --- END PODIUM SECTION --- */}

        {/* Sort Controls */}
        <div className="flex justify-center mb-4">
          <div className="glass-card p-1 rounded-full flex items-center gap-2">
            <button
              onClick={() => { if (sortBy !== 'accuracy') setSortBy('accuracy'); }} // Prevent refetch if already sorted
              disabled={loadingMore}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sortBy === 'accuracy'
                  ? 'bg-blue-600 text-white shadow-sm' // Added shadow
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              } disabled:opacity-50`}
            >
              Sort by Accuracy
            </button>
            <button
              onClick={() => { if (sortBy !== 'solved') setSortBy('solved'); }} // Prevent refetch if already sorted
              disabled={loadingMore}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sortBy === 'solved'
                  ? 'bg-blue-600 text-white shadow-sm' // Added shadow
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              } disabled:opacity-50`}
            >
              Sort by Questions Solved
            </button>
          </div>
        </div>

        {/* Leaderboard List Container */}
        <div className="glass-card overflow-hidden relative">
           {/* Loading overlay for pagination */}
           {loadingMore && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <div>
            {listUsers.map((user, index) => {
              // Calculate rank based on current page and index
              const rankOffset = currentPage === 1 ? topThreePodium.length : 0;
              const rank = (currentPage - 1) * PAGE_SIZE + rankOffset + index + 1;

              return (
                <div key={user.uid} className={`flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors`}>
                   {/* Rank */}
                  <div className="w-10 text-center font-bold text-slate-500 dark:text-slate-400">
                    {rank}
                  </div>
                  {/* User Info */}
                  <div className="flex-1 flex items-center gap-3 overflow-hidden">
                    <img
                      src={user.avatar || '/user.png'}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0 border dark:border-slate-700" // Added border
                      onError={(e) => { e.currentTarget.src = '/user.png'; }} // Fallback
                    />
                    <div className="overflow-hidden">
                      <Link to={`/profile/${user.username}`} className="font-medium text-slate-800 dark:text-white hover:underline truncate text-sm block">{user.name}</Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{user.username}</p>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center justify-end gap-3 sm:gap-4 md:gap-6 text-right flex-shrink-0 pl-2">
                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]">
                      <Target className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="font-semibold">{(user.stats?.accuracy ?? 0).toFixed(1)}%</span> {/* Nullish coalescing */}
                    </div>
                     <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-blue-600 dark:text-blue-400 text-xs sm:text-sm min-w-[50px] sm:min-w-[60px]">
                      <Award className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="font-semibold">{user.stats?.correct ?? 0}</span> {/* Nullish coalescing */}
                    </div>
                  </div>
                </div>
              );
            })}
             {/* No Users Message */}
             {listUsers.length === 0 && !loadingData && (
                 <p className="text-center py-10 text-slate-500 dark:text-slate-400">No users found for this page.</p>
             )}
          </div>
        </div>

         {/* Pagination Controls */}
        {totalUsers > PAGE_SIZE && (
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
                disabled={currentPage === totalPages || loadingMore || leaderboard.length < PAGE_SIZE || !lastVisible /* Disable if no next cursor */}
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

