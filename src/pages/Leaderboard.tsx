import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Target, Crown, ChevronLeft, ChevronRight, BarChart, Info, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, getCountFromServer, DocumentSnapshot, endBefore, limitToLast } from 'firebase/firestore';
import { User } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
// --- NEW: Import metadata context to get the selected branch ---
import { useMetadata } from '../contexts/MetadataContext';
import { LeaderboardSkeleton } from '../components/Skeletons';

const PAGE_SIZE = 10;
const RATING_SCALING_FACTOR = 100; // Only used for modal text

// --- PODIUM CARD COMPONENT (Unchanged) ---
// This component is generic and just displays the user data it's given.
// Since we will pass it a user object with branch-specific stats/rating,
// it will work correctly without any changes.
const PodiumCard = ({ user, rank }: { user: User; rank: number }) => {
  const rankStyles: Record<number, any> = {
    1: { gradient: 'from-amber-400 to-yellow-500', shadow: 'shadow-yellow-500/40', iconColor: 'text-amber-600 dark:text-amber-300', ring: 'ring-yellow-400', order: 'order-1 md:order-2', height: 'mt-0 md:-mt-6' },
    2: { gradient: 'from-zinc-400 to-gray-500', shadow: 'shadow-gray-500/40', iconColor: 'text-gray-600 dark:text-zinc-300', ring: 'ring-gray-400', order: 'order-2 md:order-1', height: 'mt-0' },
    3: { gradient: 'from-orange-400 to-amber-600', shadow: 'shadow-orange-600/40', iconColor: 'text-orange-600 dark:text-orange-300', ring: 'ring-orange-500', order: 'order-3', height: 'mt-0' },
  };
  const styles = rankStyles[rank] || {};

  return (
    <div className={`flex flex-col items-center ${styles.order} ${styles.height}`}>
      <div className={`relative w-full glass-card p-4 rounded-2xl text-center flex flex-col items-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${styles.shadow}`}>
        {rank === 1 && <Crown className="absolute -top-3.5 w-7 h-7 text-yellow-400 drop-shadow-lg" fill="currentColor" />}
        <div className={`absolute top-2 right-2 text-xl font-bold ${styles.iconColor} opacity-70`}>#{rank}</div>
        <img
          src={user.avatar || '/user.png'}
          alt={user.name}
          className={`w-20 h-20 rounded-full object-cover mb-3 ring-4 ${styles.ring}`}
          onError={(e) => { (e.target as HTMLImageElement).src = '/user.png'; }}
        />
        <Link to={`/profile/${user.username}`} className="font-bold text-zinc-800 dark:text-white text-base hover:underline truncate w-full">{user.name}</Link>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate w-full">@{user.username}</p>
        <div className={`mt-3 w-full bg-gradient-to-r ${styles.gradient} p-2 rounded-lg`}>
          <div className="flex justify-around items-center text-white">
            <div className="text-center">
              {/* This now correctly shows the branch-specific rating */}
              <p className="font-bold text-lg">{user.rating ?? 0}</p>
              <p className="text-xs opacity-80">Rating</p>
            </div>
            <div className="text-center">
              {/* This now correctly shows the branch-specific solve count */}
              <p className="font-bold text-lg">{user.stats?.correct ?? 0}</p>
              <p className="text-xs opacity-80">Solved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Rating Explanation Modal Component (Unchanged) ---
const RatingInfoModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose} // Close modal when clicking backdrop
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full relative transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          aria-label="Close rating explanation"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-500" />
          How Rating Works
        </h3>

        {/* Explanation */}
        <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
          <p>
            The rating aims to provide a balanced measure of your performance on GATECode, considering both accuracy and the number of questions you solve correctly.
          </p>
          <p>It is calculated using the following formula:</p>
          <div className="bg-zinc-100 dark:bg-zinc-700 p-3 rounded text-center my-2">
            <code className="text-sm font-mono text-zinc-800 dark:text-zinc-200 block whitespace-normal">
              Rating = (Accuracy / 100) * log<sub>10</sub>(Correct + 1) * {RATING_SCALING_FACTOR}
            </code>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li><strong className="dark:text-white">Accuracy / 100:</strong> Your overall percentage of correct answers, normalized to a value between 0 and 1.</li>
            <li><strong className="dark:text-white">log<sub>10</sub>(Correct + 1):</strong> This part rewards solving more questions. Using a logarithm (base 10) means solving your first few questions correctly gives a bigger boost than solving more questions when you've already solved many.</li>
            <li><strong className="dark:text-white">{RATING_SCALING_FACTOR}:</strong> This simply scales the result to make the rating number easier to read (e.g., 150 instead of 1.5).</li>
          </ul>
          <p className="text-xs pt-2 text-zinc-500 dark:text-zinc-400">
            Note: This rating is pre-calculated for each branch and updated with every submission to ensure the leaderboard is always accurate.
          </p>
        </div>
      </div>
    </div>
  );
};


// --- MAIN LEADERBOARD COMPONENT ---
export function Leaderboard() {
  const { loading: authLoading } = useAuth();
  // --- NEW: Get branch info from context ---
  const { selectedBranch, availableBranches, loading: metadataLoading } = useMetadata();

  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);

  // --- UPDATED: Fetch Leaderboard Data ---
  const fetchLeaderboard = useCallback(async (page: number, direction: 'next' | 'prev' | 'first' = 'first') => {
    // --- NEW: Wait for branch to be selected ---
    if (!selectedBranch) {
      console.log("[Leaderboard] Waiting for selectedBranch...");
      setLoadingData(true);
      return;
    }

    // Authenticated `user` check is NOT needed for fetching public leaderboard
    console.log(`[Leaderboard] Fetching page ${page} for branch ${selectedBranch}`);
    if (direction === 'first') setLoadingData(true);
    else setLoadingMore(true);

    try {
      const usersCollection = collection(db, 'users');

      // Fetch total count only on first load
      if (direction === 'first') {
        // This costs 1 read regardless of user count
        const countSnapshot = await getCountFromServer(query(usersCollection));
        setTotalUsers(countSnapshot.data().count);
      }

      // --- *** THE FIX *** ---
      // Sort directly by the branch-specific rating field (e.g., 'ratings.ece')
      let q = query(usersCollection, orderBy(`ratings.${selectedBranch}`, 'desc'));

      // Apply pagination logic based on cursors
      if (direction === 'next' && lastVisible) {
        q = query(q, startAfter(lastVisible), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisible) {
        q = query(q, endBefore(firstVisible), limitToLast(PAGE_SIZE));
      } else { // 'first' or initial load
        q = query(q, limit(PAGE_SIZE));
      }

      const usersSnapshot = await getDocs(q);

      // --- NEW: Map Firestore data to include branch-specific stats/rating ---
      const usersData = usersSnapshot.docs.map(doc => {
        const data = doc.data() as User;

        // Get the stats for the *currently selected branch*, or default to 0
        const branchStats = data.branchStats?.[selectedBranch] || { attempted: 0, correct: 0, accuracy: 0, subjects: {} };
        // Get the rating for the *currently selected branch*, or default to 0
        const branchRating = data.ratings?.[selectedBranch] || 0;

        // Return a user object where 'stats' and 'rating' are overridden
        // with the branch-specific values for the components to use.
        return {
          ...data,
          stats: branchStats,
          rating: branchRating,
        };
      });
      // --- *** END OF FIX *** ---

      console.log(`Firestore Leaderboard: Fetched ${usersSnapshot.docs.length} users for branch ${selectedBranch}.`);

      setLeaderboard(direction === 'prev' ? usersData.reverse() : usersData);

      // Update Firestore cursors
      if (usersSnapshot.docs.length > 0) {
        if (direction === 'prev') {
          setFirstVisible(usersSnapshot.docs[0]);
          setLastVisible(usersSnapshot.docs[usersSnapshot.docs.length - 1]);
        } else {
          setFirstVisible(usersSnapshot.docs[0]);
          setLastVisible(usersSnapshot.docs[usersSnapshot.docs.length - 1]);
        }
      } else if (direction !== 'prev') {
        setFirstVisible(null);
        setLastVisible(null);
      }

      setCurrentPage(page);

    } catch (error) {
      console.error("Error fetching leaderboard data:", error);
      if ((error as any).code === 'failed-precondition') {
        console.error(`INDEXING ERROR: Please create a descending index on the 'ratings.${selectedBranch}' field in the 'users' collection.`);
      }
      setLeaderboard([]); setTotalUsers(0); setFirstVisible(null); setLastVisible(null);
    } finally {
      setLoadingData(false); setLoadingMore(false);
    }
  }, [firstVisible, lastVisible, selectedBranch]); // --- NEW: Added selectedBranch dependency ---

  // --- UPDATED: Initial fetch on component mount ---
  useEffect(() => {
    // Only fetch if branch is ready
    if (selectedBranch) {
      setFirstVisible(null); setLastVisible(null); // Reset cursors for initial load
      fetchLeaderboard(1, 'first');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]); // --- NEW: Runs when selectedBranch changes ---

  // Pagination handlers
  const handleNextPage = () => {
    if (!loadingMore && lastVisible && currentPage < totalPages) {
      fetchLeaderboard(currentPage + 1, 'next');
    }
  };
  const handlePrevPage = () => {
    if (!loadingMore && firstVisible && currentPage > 1) {
      fetchLeaderboard(currentPage - 1, 'prev');
    }
  };


  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const topThreePodium = !loadingData && currentPage === 1 ? leaderboard.slice(0, 3) : [];
  const listUsers = !loadingData && currentPage === 1 ? leaderboard.slice(topThreePodium.length) : leaderboard;

  // --- NEW: Get branch name for display ---
  const branchName = availableBranches[selectedBranch] || 'Overall';

  // Show skeleton if auth is loading OR initial data is loading OR metadata is loading
  if (authLoading || loadingData || metadataLoading) {
    return <LeaderboardSkeleton />;
  }

  // --- Render Actual Page ---
  return (
    <div className="min-h-screen w-full px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-3 mb-1">
            <Trophy className="w-8 h-8 text-yellow-400" />
            {/* --- UPDATED: Title now includes branch name --- */}
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Leaderboard ({branchName})</h1>
            {/* Info Button */}
            <button
              onClick={() => setIsInfoModalOpen(true)}
              className="p-1 rounded-full text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              aria-label="How rating is calculated"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            {totalUsers > 0
              ? `Showing ranks ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalUsers)} of ${totalUsers} total users`
              : `Top performers for ${branchName}`
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

        {/* Leaderboard List Container */}
        <div className="glass-card overflow-hidden relative mt-4">
          {/* Loading overlay for pagination */}
          {loadingMore && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <div>
            {listUsers.map((user, index) => {
              const rankOffset = currentPage === 1 ? topThreePodium.length : 0;
              const rank = (currentPage - 1) * PAGE_SIZE + rankOffset + index + 1;

              return (
                <div key={user.uid} className={`flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors`}>
                  {/* Rank */}
                  <div className="w-12 text-center font-bold text-zinc-500 dark:text-zinc-400 text-sm">
                    {rank}
                  </div>
                  {/* User Info */}
                  <div className="flex-1 flex items-center gap-3 overflow-hidden">
                    <img
                      src={user.avatar || '/user.png'}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0 border dark:border-zinc-700"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/user.png'; }}
                    />
                    <div className="overflow-hidden">
                      <Link to={`/profile/${user.username}`} className="font-medium text-zinc-800 dark:text-white hover:underline truncate text-sm block">{user.name}</Link>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{user.username}</p>
                    </div>
                  </div>
                  {/* Stats: Rating and Accuracy */}
                  <div className="flex items-center justify-end gap-3 sm:gap-4 md:gap-6 text-right flex-shrink-0 pl-2">
                    {/* Rating */}
                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-blue-600 dark:text-blue-400 text-xs sm:text-sm min-w-[60px] sm:min-w-[70px]" title="Performance Rating">
                      <BarChart className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      {/* This now correctly shows the branch-specific rating */}
                      <span className="font-semibold">{user.rating ?? 0}</span>
                    </div>
                    {/* Accuracy */}
                    <div className="flex items-center justify-end gap-1 sm:gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm min-w-[50px] sm:min-w-[60px]" title="Accuracy">
                      <Target className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      {/* This now correctly shows the branch-specific accuracy */}
                      <span className="font-semibold">{(user.stats?.accuracy ?? 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* No Users Message */}
            {listUsers.length === 0 && !loadingData && (
              <p className="text-center py-10 text-zinc-500 dark:text-zinc-400">No users found for this page.</p>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalUsers > PAGE_SIZE && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || loadingMore}
              className="pagination-button"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-400 order-first sm:order-none">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || loadingMore || leaderboard.length < PAGE_SIZE || !lastVisible}
              className="pagination-button"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Rating Info Modal */}
      <RatingInfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />

      {/* Reusable pagination button style */}
      <style>{`
            .pagination-button {
                @apply w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed;
            }
      `}</style>
    </div>
  );
}

  
export default Leaderboard; 
