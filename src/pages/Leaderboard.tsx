import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Award, TrendingUp, Target, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { User } from '../data/mockData';
import { getAvatarUrl } from '../utils';

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<'accuracy' | 'solved'>('accuracy');
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => doc.data() as User);
        setLeaderboard(usersData);
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (sortBy === 'accuracy') {
      if (b.stats.accuracy !== a.stats.accuracy) {
        return b.stats.accuracy - a.stats.accuracy;
      }
      return b.stats.correct - a.stats.correct;
    } else {
      if (b.stats.correct !== a.stats.correct) {
        return b.stats.correct - a.stats.correct;
      }
      return b.stats.accuracy - a.stats.accuracy;
    }
  });

  const getBadge = (rank: number) => {
    if (rank === 1) return { color: 'bg-yellow-500', icon: '🏆', text: 'Gold' };
    if (rank === 2) return { color: 'bg-gray-400', icon: '🥈', text: 'Silver' };
    if (rank === 3) return { color: 'bg-orange-600', icon: '🥉', text: 'Bronze' };
    return { color: 'bg-gray-200 dark:bg-gray-700', icon: '', text: 'Challenger' };
  };

  if (loading) {
     return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="ml-4 text-lg">Loading Leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Leaderboard
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Top performers in GATE ECE preparation
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sort by:
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('accuracy')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'accuracy'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Accuracy
              </button>
              <button
                onClick={() => setSortBy('solved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'solved'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Questions Solved
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Solved
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Attempted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {sortedLeaderboard.map((user, index) => {
                  const badge = getBadge(index + 1);
                  return (
                    <tr
                      key={user.uid}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${badge.color} ${index < 3 ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link to={`/profile/${user.username}`} className="flex items-center gap-3 group">
                           <img src={getAvatarUrl(user)} alt={user.name} className="w-10 h-10 rounded-full"/>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white group-hover:text-blue-500">
                              {user.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              @{user.username}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {user.stats.accuracy.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {user.stats.correct}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">
                            {user.stats.attempted}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
