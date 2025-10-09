import { useState, useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Calendar, Target, Award, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { User, Submission, Question } from '../data/mockData';

export function Profile() {
  const { uid } = useParams<{ uid: string }>();
  const { user: authUser, isAuthenticated } = useAuth();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const fetchProfileData = async () => {
      setLoading(true);

      // Fetch user profile
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setProfileUser(userDocSnap.data() as User);
      }

      // Fetch all questions for calculations
      const questionsQuerySnapshot = await getDocs(collection(db, 'questions'));
      const questionsData = questionsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions(questionsData);

      // Fetch user submissions
      const submissionsCollectionRef = collection(db, `users/${uid}/submissions`);
      const submissionsSnapshot = await getDocs(submissionsCollectionRef);
      const submissionsData = submissionsSnapshot.docs.map(doc => doc.data() as Submission);
      setSubmissions(submissionsData);
      
      setLoading(false);
    };

    fetchProfileData();
  }, [uid]);

  if (!isAuthenticated && !loading) {
    return <Navigate to="/login" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">User not found</h2>
          <Link to="/" className="text-blue-600 dark:text-blue-400 mt-4 inline-block">Go Home</Link>
        </div>
      </div>
    );
  }

  const correctSubmissions = submissions.filter(s => s.correct);
  const solvedQuestions = questions.filter(q =>
    correctSubmissions.some(s => s.qid === q.id)
  );

  const topicStats = solvedQuestions.reduce((acc, q) => {
    acc[q.topic] = (acc[q.topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const difficultyStats = {
    Easy: solvedQuestions.filter(q => q.difficulty === 'Easy').length,
    Medium: solvedQuestions.filter(q => q.difficulty === 'Medium').length,
    Hard: solvedQuestions.filter(q => q.difficulty === 'Hard').length
  };

  const recentActivity = submissions
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5)
    .map(submission => {
      const question = questions.find(q => q.id === submission.qid);
      return { ...submission, question };
    });
    
  const getBadgeLevel = (correct: number) => {
    if (correct >= 100) return { name: 'Gold Master', color: 'from-yellow-400 to-yellow-600', icon: '🏆' };
    if (correct >= 50) return { name: 'Silver Expert', color: 'from-gray-300 to-gray-500', icon: '🥈' };
    if (correct >= 20) return { name: 'Bronze Scholar', color: 'from-orange-400 to-orange-600', icon: '🥉' };
    return { name: 'Beginner', color: 'from-blue-400 to-blue-600', icon: '🎓' };
  };

  const badge = getBadgeLevel(profileUser.stats.correct);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {profileUser.avatar ? (
              <img src={profileUser.avatar} alt={profileUser.name} className="w-24 h-24 rounded-full shadow-lg" />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {profileUser.name.charAt(0)}
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {profileUser.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {profileUser.email}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    Joined {new Date(profileUser.joined).toLocaleDateString()}
                  </span>
                </div>
                <div className={`px-4 py-2 bg-gradient-to-r ${badge.color} text-white rounded-full text-sm font-semibold flex items-center gap-2`}>
                  <span>{badge.icon}</span>
                  <span>{badge.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The rest of the profile JSX remains the same, but using 'profileUser' and calculated stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Attempted</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profileUser.stats.attempted}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-950 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Solved</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profileUser.stats.correct}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profileUser.stats.accuracy.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Difficulty Breakdown
            </h2>
            <div className="space-y-4">
              {Object.entries(difficultyStats).map(([difficulty, count]) => {
                const totalInDb = questions.filter(q => q.difficulty === difficulty).length;
                const percentage = totalInDb > 0 ? (count / totalInDb) * 100 : 0;

                const color =
                  difficulty === 'Easy' ? 'bg-green-600' :
                  difficulty === 'Medium' ? 'bg-orange-600' :
                  'bg-red-600';

                return (
                  <div key={difficulty}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {difficulty}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {count} / {totalInDb}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                      <div
                        className={`${color} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Topics Mastered
            </h2>
            <div className="space-y-3">
              {Object.entries(topicStats).length > 0 ? (
                Object.entries(topicStats)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([topic, count]) => (
                    <div
                      key={topic}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {topic}
                      </span>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {count} solved
                      </span>
                    </div>
                  ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No topics solved yet. Start practicing!
                </p>
              )}
            </div>
          </div>
          
           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h2>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    key={activity.qid + activity.timestamp}
                    className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    {activity.correct ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {activity.question?.topic || activity.qid}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(activity.timestamp).toLocaleDateString()} at{' '}
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ${activity.correct ? 'text-green-600' : 'text-red-600'}`}>
                      {activity.correct ? 'Solved' : 'Attempted'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No activity yet. Start solving questions!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
