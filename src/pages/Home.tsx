import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, TrendingUp, Award, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Question, User } from '../data/mockData';

export function Home() {
  const { userInfo, isAuthenticated } = useAuth();
  const [dailyChallenge, setDailyChallenge] = useState<Question | null>(null);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch a single question for the daily challenge
        const questionsQuery = query(collection(db, 'questions'), limit(1));
        const questionSnapshot = await getDocs(questionsQuery);
        if (!questionSnapshot.empty) {
          const firstDoc = questionSnapshot.docs[0];
          setDailyChallenge({ id: firstDoc.id, ...firstDoc.data() } as Question);
        }

        // Fetch top 5 users for the leaderboard, ordered by accuracy
        const usersQuery = query(
          collection(db, 'users'),
          orderBy('stats.accuracy', 'desc'),
          limit(5)
        );
        const usersSnapshot = await getDocs(usersQuery);
        const leaderboardData = usersSnapshot.docs.map(doc => doc.data() as User);
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error("Error fetching home page data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const subjects = [
    { name: 'Network Theory', count: 8, color: 'bg-blue-500' },
    { name: 'Signals & Systems', count: 0, color: 'bg-green-500' },
    { name: 'Control Systems', count: 0, color: 'bg-purple-500' },
    { name: 'Digital Electronics', count: 0, color: 'bg-orange-500' },
    { name: 'Communication', count: 0, color: 'bg-pink-500' },
    { name: 'EMFT', count: 0, color: 'bg-teal-500' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Practice. Analyze. Master GATE ECE.
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Your complete platform for GATE Electronics & Communication preparation
          </p>
          {isAuthenticated && userInfo && (
            <div className="inline-block">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
                Welcome back, <span className="font-semibold text-blue-600 dark:text-blue-400">{userInfo.name}</span>!
              </p>
            </div>
          )}
        </div>

        {isAuthenticated && dailyChallenge && (
          <div className="mb-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-6 h-6" fill="currentColor" />
              <h2 className="text-2xl font-bold">Daily Challenge</h2>
            </div>
            <p className="text-blue-100 mb-4">
              "{dailyChallenge.title}"
            </p>
            <Link
              to={`/question/${dailyChallenge.id}`}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Start Now
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Subjects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((subject) => (
                <Link
                  key={subject.name}
                  to="/practice"
                  className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${subject.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {subject.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {subject.count} questions
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Leaderboard
              </h2>
              <Link
                to="/leaderboard"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              {loading ? (
                <div className="p-4 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
                </div>
              ) : (
                leaderboard.map((leader, index) => (
                  <div
                    key={leader.uid}
                    className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {leader.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {leader.stats.correct}/{leader.stats.attempted} solved
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Award className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        {leader.stats.accuracy.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {!isAuthenticated && (
          <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-8 text-center border border-blue-200 dark:border-blue-800">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to start your GATE preparation?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Join thousands of students preparing for GATE ECE
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
