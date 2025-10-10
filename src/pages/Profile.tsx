import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { User, Submission, Question } from '../data/mockData';

// Helper for activity calendar
const ActivityCalendar = ({ submissions }: { submissions: Submission[] }) => {
  const submissionCounts = submissions.reduce((acc, sub) => {
    const date = new Date(sub.timestamp).toDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count <= 2) return 'bg-green-200 dark:bg-green-900';
    if (count <= 5) return 'bg-green-400 dark:bg-green-700';
    return 'bg-green-600 dark:bg-green-500';
  };
  
  // Create a simple grid for the last 91 days (13 weeks)
  const days = Array.from({ length: 91 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  }).reverse();

  return (
    <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Contribution Activity</h3>
        <div className="grid grid-flow-col grid-rows-7 gap-1 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-x-auto">
        {days.map((date, index) => {
            const count = submissionCounts[date.toDateString()] || 0;
            return (
            <div 
                key={index} 
                className={`w-4 h-4 rounded-sm ${getIntensity(count)}`}
                title={`${count} submissions on ${date.toLocaleDateString()}`}
            />
            );
        })}
        </div>
    </div>
  );
};


export function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: authUser } = useAuth();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFound, setUserFound] = useState(true);

  const isOwnProfile = authUser && profileUser && authUser.uid === profileUser.uid;

  useEffect(() => {
    if (!username) {
        setLoading(false);
        setUserFound(false);
        return;
    };

    const fetchProfileData = async () => {
      setLoading(true);
      setUserFound(true);
      setProfileUser(null);

      try {
        // Fetch user profile by username
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setUserFound(false);
          setLoading(false);
          return;
        }
        
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as User;
        setProfileUser(userData);
        const profileUid = userData.uid;

        // Fetch all questions once for stats
        const questionsQuerySnapshot = await getDocs(collection(db, 'questions'));
        const questionsData = questionsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setAllQuestions(questionsData);

        // Fetch user submissions using the found UID
        const submissionsQuery = query(
          collection(db, `users/${profileUid}/submissions`),
          orderBy('timestamp', 'desc')
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissionsData = submissionsSnapshot.docs.map(doc => doc.data() as Submission);
        setSubmissions(submissionsData);

      } catch (error) {
        console.error("Failed to fetch profile data:", error);
        setUserFound(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!userFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">User not found</h2>
          <p className="text-gray-500">The user @{username} could not be found.</p>
          <Link to="/" className="text-blue-600 dark:text-blue-400 mt-4 inline-block">Go Home</Link>
        </div>
      </div>
    );
  }

  if (!profileUser) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      )
  }
  
  const correctSubmissions = submissions.filter(s => s.correct);
  const solvedQuestionIds = new Set(correctSubmissions.map(s => s.qid));
  
  const solvedQuestions = allQuestions.filter(q => solvedQuestionIds.has(q.id));

  const difficultyStats = {
    Easy: { solved: solvedQuestions.filter(q => q.difficulty === 'Easy').length, total: allQuestions.filter(q => q.difficulty === 'Easy').length },
    Medium: { solved: solvedQuestions.filter(q => q.difficulty === 'Medium').length, total: allQuestions.filter(q => q.difficulty === 'Medium').length },
    Hard: { solved: solvedQuestions.filter(q => q.difficulty === 'Hard').length, total: allQuestions.filter(q => q.difficulty === 'Hard').length },
  };

  const recentActivity = submissions.slice(0, 5).map(submission => {
    const question = allQuestions.find(q => q.id === submission.qid);
    return { ...submission, question };
  });

  const subjectStats = allQuestions.reduce((acc, q) => {
    const subject = q.subject || 'Uncategorized';
    if (!acc[subject]) {
      acc[subject] = { solved: 0, total: 0 };
    }
    acc[subject].total++;
    if (solvedQuestionIds.has(q.id)) {
      acc[subject].solved++;
    }
    return acc;
  }, {} as Record<string, { solved: number, total: number }>);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: User Info & Stats */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 relative">
                <div className="flex flex-col items-center text-center">
                    <img 
                      src={profileUser.avatar || `https://placehold.co/96x96/60A5FA/FFFFFF?text=${profileUser.name.charAt(0)}`}
                      alt={profileUser.name} 
                      className="w-24 h-24 rounded-full shadow-lg border-4 border-white dark:border-gray-800" 
                    />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
                      {profileUser.name}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      @{profileUser.username}
                    </p>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>Joined {new Date(profileUser.joined).toLocaleDateString()}</span>
                    </div>
                </div>
               {isOwnProfile && (
                    <Link to="/settings" className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                        <SettingsIcon className="w-5 h-5 text-gray-500" />
                    </Link>
               )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Stats</h2>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-green-500">Easy</span>
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-gray-900 dark:text-white">{difficultyStats.Easy.solved}</span>
                           <span className="text-gray-500 text-sm">/ {difficultyStats.Easy.total}</span>
                        </div>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-medium text-orange-500">Medium</span>
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-gray-900 dark:text-white">{difficultyStats.Medium.solved}</span>
                           <span className="text-gray-500 text-sm">/ {difficultyStats.Medium.total}</span>
                        </div>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-medium text-red-500">Hard</span>
                         <div className="flex items-center gap-2">
                           <span className="font-bold text-gray-900 dark:text-white">{difficultyStats.Hard.solved}</span>
                           <span className="text-gray-500 text-sm">/ {difficultyStats.Hard.total}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                 <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Subjects</h2>
                 <div className="space-y-3">
                    {Object.entries(subjectStats).map(([subject, data]) => {
                        const percentage = data.total > 0 ? (data.solved / data.total) * 100 : 0;
                        return (
                            <div key={subject}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{subject}</span>
                                    <span className="text-gray-500">{data.solved} / {data.total}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{width: `${percentage}%`}}></div>
                                </div>
                            </div>
                        )
                    })}
                 </div>
            </div>

          </div>

          {/* Right Column: Activity & Submissions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <ActivityCalendar submissions={submissions} />
            </div>

             <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold p-6 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">Recent Submissions</h2>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => (
                      <div key={index} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <div>
                            <Link to={`/question/${activity.qid}`} className="font-semibold text-blue-600 hover:underline">
                                {activity.question?.title || 'Question'}
                            </Link>
                            <p className="text-sm text-gray-500">{new Date(activity.timestamp).toLocaleString()}</p>
                          </div>
                          <span className={`text-sm font-bold ${activity.correct ? 'text-green-500' : 'text-red-500'}`}>
                             {activity.correct ? 'Accepted' : 'Wrong Answer'}
                          </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-6 text-gray-500">No recent submissions.</p>
                  )}
                </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
