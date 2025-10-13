import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Award, Target, Loader2, Crown } from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, getDocs } from 'firebase/firestore';
import { User } from '../data/mockData.ts';

const PodiumCard = ({ user, rank }: { user: User; rank: number }) => {
  const rankStyles = {
    1: {
      gradient: 'from-amber-400 to-yellow-500',
      shadow: 'shadow-yellow-500/40',
      iconColor: 'text-amber-300',
      ring: 'ring-yellow-400',
      order: 'order-1 md:order-2',
      height: 'mt-0 md:-mt-6'
    },
    2: {
      gradient: 'from-slate-400 to-gray-500',
      shadow: 'shadow-gray-500/40',
      iconColor: 'text-slate-300',
      ring: 'ring-gray-400',
      order: 'order-2 md:order-1',
      height: 'mt-0'
    },
    3: {
      gradient: 'from-orange-400 to-amber-600',
      shadow: 'shadow-orange-600/40',
      iconColor: 'text-orange-300',
      ring: 'ring-orange-500',
      order: 'order-3',
      height: 'mt-0'
    },
  }[rank] || {};

  return (
    <div className={`flex flex-col items-center ${rankStyles.order} ${rankStyles.height}`}>
      <div className={`relative w-full glass-card p-4 rounded-2xl text-center flex flex-col items-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${rankStyles.shadow}`}>
        {rank === 1 && <Crown className="absolute -top-3.5 w-7 h-7 text-yellow-400 drop-shadow-lg" fill="currentColor" />}
        <div className={`absolute top-2 right-2 text-xl font-bold ${rankStyles.iconColor} opacity-20`}>#{rank}</div>
        <img
          src={user.avatar || '/user.png'}
          alt={user.name}
          className={`w-20 h-20 rounded-full object-cover mb-3 ring-4 ${rankStyles.ring}`}
        />
        <Link to={`/profile/${user.username}`} className="font-bold text-white text-base hover:underline truncate w-full">{user.name}</Link>
        <p className="text-xs text-slate-400 truncate w-full">@{user.username}</p>
        <div className={`mt-3 w-full bg-gradient-to-r ${rankStyles.gradient} p-2 rounded-lg`}>
          <div className="flex justify-around items-center text-white">
            <div className="text-center">
              <p className="font-bold text-lg">{user.stats.correct}</p>
              <p className="text-xs opacity-80">Solved</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{user.stats.accuracy.toFixed(1)}%</p>
              <p className="text-xs opacity-80">Accuracy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


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

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      if (sortBy === 'accuracy') {
        if (b.stats.accuracy !== a.stats.accuracy) return b.stats.accuracy - a.stats.accuracy;
        return b.stats.correct - a.stats.correct;
      } else {
        if (b.stats.correct !== a.stats.correct) return b.stats.correct - a.stats.correct;
        return b.stats.accuracy - a.stats.accuracy;
      }
    });
  }, [leaderboard, sortBy]);

  const topThree = sortedLeaderboard.slice(0, 3);
  const restOfLeaderboard = sortedLeaderboard.slice(3);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-1">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
          </div>
          <p className="text-slate-400 text-sm">Top performers in GATE ECE preparation</p>
        </div>
        
        {/* Top 3 Podium */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
            {topThree[1] && <PodiumCard user={topThree[1]} rank={2} />}
            {topThree[0] && <PodiumCard user={topThree[0]} rank={1} />}
            {topThree[2] && <PodiumCard user={topThree[2]} rank={3} />}
          </div>
        )}

        {/* Sort Controls */}
        <div className="flex justify-center mb-4">
          <div className="glass-card p-1 rounded-full flex items-center gap-2">
            <button
              onClick={() => setSortBy('accuracy')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sortBy === 'accuracy'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              Sort by Accuracy
            </button>
            <button
              onClick={() => setSortBy('solved')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sortBy === 'solved'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              Sort by Questions Solved
            </button>
          </div>
        </div>
        
        {/* Rest of the Leaderboard */}
        <div className="glass-card overflow-hidden">
          <div>
            {restOfLeaderboard.map((user, index) => {
              const rank = index + 4;
              return (
                <div key={user.uid} className="flex items-center px-4 py-3 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 transition-colors">
                  <div className="w-10 text-center text-slate-400 font-bold">{rank}</div>
                  <div className="flex-1 flex items-center gap-3">
                    <img
                      src={user.avatar || '/user.png'}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div>
                      <Link to={`/profile/${user.username}`} className="font-medium text-white hover:underline truncate text-sm">{user.name}</Link>
                      <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-right w-2/5">
                    <div className="flex-1 flex items-center justify-end gap-2 text-emerald-400 text-sm">
                      <Target className="w-4 h-4" />
                      <span className="font-semibold">{user.stats.accuracy.toFixed(1)}%</span>
                    </div>
                     <div className="flex-1 flex items-center justify-end gap-2 text-blue-400 text-sm">
                      <Award className="w-4 h-4" />
                      <span className="font-semibold">{user.stats.correct}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

