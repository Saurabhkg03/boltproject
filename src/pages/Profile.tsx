import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Loader2, Settings as SettingsIcon, CheckCircle, TrendingUp, Target, Star, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { User, Submission, Question } from '../data/mockData.ts';
import { UserNotFound } from './UserNotFound.tsx';

// --- HELPER COMPONENTS ---

const StatCard = ({ icon: Icon, value, label, colorClass }: { icon: React.ElementType, value: string | number, label: string, colorClass: string }) => (
    <div className="bg-white dark:bg-slate-900/70 p-4 rounded-xl flex items-center gap-4 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
        <Icon className={`w-5 h-5 ${colorClass}`}/>
      </div>
      <div>
        <p className={`text-xl font-bold text-slate-800 dark:text-white`}>{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
);

const ActivityCalendar = ({ submissions }: { submissions: Submission[] }) => {
  const { totalSubmissions, activeDays, maxStreak, calendarData, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setDate(startDate.getDate() + 1);

    const relevantSubmissions = submissions.filter(s => {
      const subDate = new Date(s.timestamp);
      return subDate >= startDate && subDate <= endDate;
    });

    const submissionCounts = relevantSubmissions.reduce((acc, sub) => {
      const date = new Date(sub.timestamp).toDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalSubmissions = relevantSubmissions.length;
    const activeDays = Object.keys(submissionCounts).length;

    let maxStreak = 0;
    if (activeDays > 0) {
      const sortedDates = Object.keys(submissionCounts).map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
      if (sortedDates.length > 0) {
        let currentStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const diff = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 3600 * 24);
          if (diff === 1) {
            currentStreak++;
          } else {
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 1;
          }
        }
        maxStreak = Math.max(maxStreak, currentStreak);
      }
    }

    const calendarData: ({ date: Date; count: number } | null)[][] = Array.from({ length: 53 }, () => Array(7).fill(null));
    let currentDate = new Date(startDate);
    const dayOffset = currentDate.getDay();
    currentDate.setDate(currentDate.getDate() - dayOffset);
    
    for (let weekIndex = 0; weekIndex < 53; weekIndex++) {
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        if (currentDate >= startDate && currentDate <= endDate) {
          calendarData[weekIndex][dayIndex] = {
            date: new Date(currentDate),
            count: submissionCounts[currentDate.toDateString()] || 0,
          };
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    const monthLabels: { name: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    calendarData.forEach((week, weekIndex) => {
      const firstDayOfWeek = week.find(day => day);
      if (firstDayOfWeek) {
        const month = firstDayOfWeek.date.getMonth();
        if (month !== lastMonth) {
          if (monthLabels.length === 0 || weekIndex > monthLabels[monthLabels.length - 1].weekIndex + 3) {
            monthLabels.push({
              name: firstDayOfWeek.date.toLocaleString('default', { month: 'short' }),
              weekIndex,
            });
            lastMonth = month;
          }
        }
      }
    });

    return { totalSubmissions, activeDays, maxStreak, calendarData, monthLabels };
  }, [submissions]);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-slate-200 dark:bg-slate-800';
    if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900';
    if (count <= 5) return 'bg-emerald-400 dark:bg-emerald-700';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                {totalSubmissions} submissions in the past year
            </h3>
            <div className="text-sm text-slate-500 dark:text-slate-400 flex gap-4">
                <span>Active days: <span className="font-bold text-slate-700 dark:text-white">{activeDays}</span></span>
                <span>Max streak: <span className="font-bold text-slate-700 dark:text-white">{maxStreak}</span></span>
            </div>
        </div>
        <div className="bg-white dark:bg-slate-900/70 p-4 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col">
                <div className="flex" style={{ paddingLeft: '28px' }}>
                    {monthLabels.map(({ name, weekIndex }, i) => {
                        const prevWeekIndex = i > 0 ? monthLabels[i-1].weekIndex : 0;
                        const spacing = weekIndex - prevWeekIndex;
                        return (
                             <div key={name} className="text-xs text-slate-500 dark:text-slate-400" style={{ minWidth: `${spacing * 14}px`}}>
                                {name}
                            </div>
                        )
                    })}
                </div>
                <div className="flex gap-2">
                    <div className="flex flex-col gap-1 mt-0.5 text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">
                        {weekDays.map((day, index) => (
                            <div key={index} className="h-2.5 flex items-center justify-center">
                               {index % 2 !== 0 && day.charAt(0)}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-flow-col auto-cols-max gap-1">
                    {calendarData.map((week, weekIndex) => (
                        <div key={weekIndex} className="grid grid-rows-7 gap-1">
                            {week.map((day, dayIndex) => (
                                day ? (
                                    <div
                                        key={day.date.toString()}
                                        className={`w-2.5 h-2.5 rounded-sm ${getIntensity(day.count)}`}
                                        title={`${day.count} submission(s) on ${day.date.toLocaleDateString()}`}
                                    />
                                ) : (
                                    <div key={`${weekIndex}-${dayIndex}`} className="w-2.5 h-2.5 bg-transparent" />
                                )
                            ))}
                        </div>
                    ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};


// --- MAIN PROFILE COMPONENT ---

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

        const questionsQuerySnapshot = await getDocs(collection(db, 'questions'));
        const questionsData = questionsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setAllQuestions(questionsData);

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

  const { solvedQuestions, difficultyStats, subjectStats, recentActivity, longestStreak } = useMemo(() => {
    if (!profileUser || allQuestions.length === 0) {
      return { solvedQuestions: [], difficultyStats: {}, subjectStats: [], recentActivity: [], longestStreak: 0 };
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

    const calculatedSubjectStats = Object.values(allQuestions.reduce((acc, q) => {
        const subject = q.subject || 'Uncategorized';
        if (!acc[subject]) {
          acc[subject] = { name: subject, solved: 0, total: 0 };
        }
        acc[subject].total++;
        if (solvedQuestionIds.has(q.id)) {
          acc[subject].solved++;
        }
        return acc;
    }, {} as Record<string, { name: string, solved: number, total: number }>));
    
    let currentStreak = 0;
    if (submissions.length > 0) {
        const submissionDates = [...new Set(submissions.map(s => new Date(s.timestamp).toDateString()))]
            .map(dateStr => new Date(dateStr))
            .sort((a, b) => b.getTime() - a.getTime());

        if (submissionDates.length > 0) {
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            const isToday = submissionDates[0].toDateString() === today.toDateString();
            const isYesterday = submissionDates[0].toDateString() === yesterday.toDateString();

            if (isToday || isYesterday) {
                currentStreak = 1;
                for (let i = 0; i < submissionDates.length - 1; i++) {
                    const diff = (submissionDates[i].getTime() - submissionDates[i+1].getTime()) / (1000 * 3600 * 24);
                    if (diff <= 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }
    }

    return { solvedQuestions, difficultyStats, subjectStats: calculatedSubjectStats, recentActivity, longestStreak: currentStreak };
  }, [profileUser, submissions, allQuestions]);


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;
  }
  if (!userFound) {
  return <UserNotFound />;
  }
  if (!profileUser) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;
  }
  
  return (
    <div className="min-h-screen w-full p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: User Info & Stats */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900/70 p-6 relative rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col items-center text-center">
                    <div className="relative">
                        <img
                          src={profileUser.avatar || '/user.png'}
                          alt={profileUser.name}
                          className="w-28 h-28 rounded-full shadow-lg border-4 border-white dark:border-slate-700 object-cover"
                        />
                        <span className="absolute bottom-0 right-0 bg-gradient-to-tr from-yellow-400 to-amber-500 text-white rounded-full p-1.5 shadow-md">
                           <Star className="w-5 h-5" />
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mt-4">{profileUser.name}</h1>
                    <p className="text-slate-500 dark:text-slate-400">@{profileUser.username}</p>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>Joined {new Date(profileUser.joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</span>
                    </div>
                </div>
               {isOwnProfile && (
                    <Link to="/settings" className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                        <SettingsIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </Link>
               )}
            </div>
            
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Difficulty Breakdown</h2>
                <div className="space-y-4">
                    {['Easy', 'Medium', 'Hard'].map(level => {
                        const stats = difficultyStats[level as keyof typeof difficultyStats] || { solved: 0, total: 0 };
                        const percentage = stats.total > 0 ? (stats.solved / stats.total) * 100 : 0;
                        const color = level === 'Easy' ? 'text-emerald-500 dark:text-emerald-400' : level === 'Medium' ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400';
                        const bgColor = level === 'Easy' ? 'bg-emerald-500' : level === 'Medium' ? 'bg-orange-500' : 'bg-red-500';
                        return (
                             <div key={level}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className={`font-medium ${color}`}>{level}</span>
                                    <span className="text-slate-500 dark:text-slate-400">{stats.solved} / {stats.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div className={`${bgColor} h-2 rounded-full`} style={{width: `${percentage}%`}}></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Subject Mastery</h2>
                <div className="p-6 space-y-4">
                    {subjectStats.map((data) => {
                        const percentage = data.total > 0 ? (data.solved / data.total) * 100 : 0;
                        return (
                            <div key={data.name}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{data.name}</span>
                                    <span className="text-slate-500 dark:text-slate-400">{data.solved} / {data.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{width: `${percentage}%`}}></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
          </div>

          {/* Right Column: Activity & Submissions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <ActivityCalendar submissions={submissions} />
            </div>
            
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <StatCard icon={TrendingUp} value={profileUser.stats.attempted} label="Attempted" colorClass="text-blue-500 dark:text-blue-400" />
                 <StatCard icon={CheckCircle} value={profileUser.stats.correct} label="Solved" colorClass="text-emerald-500 dark:text-emerald-400" />
                 <StatCard icon={Target} value={`${profileUser.stats.accuracy.toFixed(1)}%`} label="Accuracy" colorClass="text-pink-500 dark:text-pink-400" />
                 <StatCard icon={Zap} value={`${longestStreak} Days`} label="Current Streak" colorClass="text-yellow-500 dark:text-yellow-400" />
            </div>

            <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Recent Submissions</h2>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <div key={activity.timestamp} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-2">
                          <div>
                            <Link to={`/question/${activity.qid}`} className="font-semibold text-blue-500 dark:text-blue-400 hover:underline">
                                {activity.question?.title || 'Question'}
                            </Link>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(activity.timestamp).toLocaleString()}</p>
                          </div>
                          <span className={`text-sm font-bold px-3 py-1 rounded-full ${activity.correct ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'}`}>
                             {activity.correct ? 'Accepted' : 'Wrong Answer'}
                          </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-6 text-slate-500 dark:text-slate-400">No recent submissions.</p>
                  )}
                </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

