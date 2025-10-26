import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Settings as SettingsIcon, CheckCircle, TrendingUp, Target, Star, Zap } from 'lucide-react'; // Removed Loader2
import { useAuth } from '../contexts/AuthContext.tsx'; // Keep useAuth import
import { db } from '../firebase.ts';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { User, Submission, Question } from '../data/mockData.ts';
import { UserNotFound } from './UserNotFound.tsx';
import { ProfileSkeleton } from '../components/Skeletons.tsx'; // Import skeleton

// --- HELPER COMPONENTS (StatCard, ActivityCalendar) ---

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
    startDate.setDate(startDate.getDate() + 1); // Start from exactly one year ago

    // Fix 1: Use 'sub' instead of 's'
    const relevantSubmissions = submissions.filter(sub => {
      // Ensure timestamp is valid before creating Date object
      if (!sub.timestamp) return false; // FIX: check sub.timestamp
      try {
        const subDate = new Date(sub.timestamp); // FIX: use sub.timestamp
        return !isNaN(subDate.getTime()) && subDate >= startDate && subDate <= endDate;
      } catch (e) {
        console.error("Invalid date timestamp:", sub.timestamp, e); // FIX: log sub.timestamp
        return false;
      }
    });

    const submissionCounts = relevantSubmissions.reduce((acc, sub) => {
      // Ensure timestamp is valid before creating Date object
      if (!sub.timestamp) return acc; // FIX: check sub.timestamp
      try {
        const dateStr = new Date(sub.timestamp).toDateString(); // FIX: use sub.timestamp
        if (dateStr !== "Invalid Date") { // Check if date is valid
            acc[dateStr] = (acc[dateStr] || 0) + 1;
        }
      } catch (e) {
         console.error("Error processing date:", sub.timestamp, e); // FIX: log sub.timestamp
      }
      return acc;
    }, {} as Record<string, number>);


    const totalSubmissions = relevantSubmissions.length;
    const activeDays = Object.keys(submissionCounts).length;

    let maxStreak = 0;
    if (activeDays > 0) {
      const sortedDates = Object.keys(submissionCounts)
        .map(d => new Date(d))
        .filter(d => !isNaN(d.getTime())) // Filter out invalid dates
        .sort((a, b) => a.getTime() - b.getTime());

      if (sortedDates.length > 0) {
        let currentStreak = 1;
        maxStreak = 1; // Initialize maxStreak to 1 if there's at least one date
        for (let i = 1; i < sortedDates.length; i++) {
          const diff = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 3600 * 24);
          if (diff === 1) {
            currentStreak++;
          } else if (diff > 1) { // Reset only if the gap is more than a day
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 1;
          }
           // else if diff is 0 or less, it's the same day or an error, don't increment/reset
        }
        maxStreak = Math.max(maxStreak, currentStreak); // Final check
      }
    }

    // Calendar Grid Calculation
    const calendarData: ({ date: Date; count: number } | null)[][] = Array.from({ length: 53 }, () => Array(7).fill(null));
    let gridStartDate = new Date(startDate);
    const dayOffset = gridStartDate.getDay(); // 0 for Sunday, 1 for Monday...
    gridStartDate.setDate(gridStartDate.getDate() - dayOffset); // Adjust start date to the beginning of the week

    let currentDate = new Date(gridStartDate);

    for (let weekIndex = 0; weekIndex < 53; weekIndex++) {
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        // Only add data for dates within the one-year range
        if (currentDate >= startDate && currentDate <= endDate) {
            const dateStr = currentDate.toDateString();
            calendarData[weekIndex][dayIndex] = {
                date: new Date(currentDate),
                count: submissionCounts[dateStr] || 0,
            };
        }
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate > endDate && dayIndex < 6) { // Stop if we go past the end date
            break;
        }
      }
       if (currentDate > endDate) break; // Stop outer loop too
    }

    // Month Label Calculation
    const monthLabels: { name: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    calendarData.forEach((week, weekIndex) => {
      const firstDayOfWeekWithData = week.find(day => day);
      if (firstDayOfWeekWithData) {
        const month = firstDayOfWeekWithData.date.getMonth();
        if (month !== lastMonth) {
           // Show month label if it's the first one or enough space has passed
          if (monthLabels.length === 0 || weekIndex > monthLabels[monthLabels.length - 1].weekIndex + 3) {
            monthLabels.push({
              name: firstDayOfWeekWithData.date.toLocaleString('default', { month: 'short' }),
              weekIndex,
            });
            lastMonth = month;
          }
        }
      }
    });

    return { totalSubmissions, activeDays, maxStreak, calendarData, monthLabels };
  }, [submissions]);

  // Intensity color based on submission count
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
                {/* Month Labels */}
                <div className="flex" style={{ paddingLeft: '28px' }}>
                    {monthLabels.map(({ name, weekIndex }, i) => {
                        // Calculate spacing based on previous label's index
                        const prevWeekIndex = i > 0 ? monthLabels[i-1].weekIndex : -1; // Use -1 for first item
                        const spacingWeeks = weekIndex - (prevWeekIndex + 1); // Number of weeks between end of prev label and start of current
                        const minWidth = Math.max(1, spacingWeeks + 1) * 14; // Each week takes 12px width + 2px gap = 14px

                        return (
                             <div key={name} className="text-xs text-slate-500 dark:text-slate-400 shrink-0" style={{ minWidth: `${minWidth}px`, lineHeight: '12px' }}>
                                {name}
                            </div>
                        )
                    })}
                </div>
                 {/* Calendar Grid */}
                <div className="flex gap-2 mt-1">
                    {/* Day Labels (Sun, Mon...) */}
                    <div className="flex flex-col gap-1 pt-[1px] text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">
                        {weekDays.map((day, index) => (
                            <div key={index} className="h-2.5 flex items-center justify-start">
                               {index % 2 !== 0 ? day.charAt(0) : ''} {/* Show S, T, T, S */}
                            </div>
                        ))}
                    </div>
                     {/* Contribution Squares */}
                    <div className="grid grid-flow-col auto-cols-max gap-1">
                    {calendarData.map((week, weekIndex) => (
                        <div key={weekIndex} className="grid grid-rows-7 gap-1">
                            {week.map((day, dayIndex) => (
                                day ? (
                                    <div
                                        key={day.date.toISOString()} // Use ISO string for unique key
                                        className={`w-2.5 h-2.5 rounded-sm ${getIntensity(day.count)}`}
                                        title={`${day.count} submission(s) on ${day.date.toLocaleDateString()}`}
                                    />
                                ) : (
                                    // Render a placeholder for days outside the year range but within the grid structure
                                    <div key={`empty-${weekIndex}-${dayIndex}`} className="w-2.5 h-2.5 bg-transparent" />
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
  const { user: authUser, loading: authLoading } = useAuth(); // Get auth loading state

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Renamed loading state
  const [userFound, setUserFound] = useState(true);

  const isOwnProfile = authUser && profileUser && authUser.uid === profileUser.uid;

  // Effect to fetch all profile data (user info, questions, submissions)
  useEffect(() => {
    if (!username) {
        setLoadingData(false);
        setUserFound(false);
        return;
    };

    const fetchProfileData = async () => {
      setLoadingData(true);
      setUserFound(true);
      setProfileUser(null); // Reset profile user on new username
      setSubmissions([]); // Reset submissions
      setAllQuestions([]); // Reset questions

      try {
        // Find user by username
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where("username", "==", username));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
          setUserFound(false);
          setLoadingData(false);
          return;
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data() as User;
         // Ensure stats object exists
        if (!userData.stats) {
            userData.stats = { attempted: 0, correct: 0, accuracy: 0 };
        }
        setProfileUser(userData);
        const profileUid = userData.uid;

        // Fetch all questions (needed for stats calculation)
        const questionsQuerySnapshot = await getDocs(collection(db, 'questions'));
        const questionsData = questionsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setAllQuestions(questionsData);

        // Fetch user's submissions
        const submissionsQuery = query(
          collection(db, `users/${profileUid}/submissions`),
          orderBy('timestamp', 'desc') // Order by timestamp for recent activity and streak calculation
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissionsData = submissionsSnapshot.docs.map(doc => doc.data() as Submission);
        setSubmissions(submissionsData);

      } catch (error) {
        console.error("Failed to fetch profile data:", error);
        setUserFound(false); // Set user not found on error
      } finally {
        setLoadingData(false);
      }
    };

    fetchProfileData();
  }, [username]); // Refetch when username changes

  // Memoized calculation for derived stats based on fetched data
  // FIX 2: Removed unused 'solvedQuestions' from destructuring
  const { difficultyStats, subjectStats, recentActivity, longestStreak } = useMemo(() => {
    // Return default empty values if data isn't ready
    if (!profileUser || allQuestions.length === 0) {
      return { difficultyStats: { Easy: {solved:0, total:0}, Medium: {solved:0, total:0}, Hard: {solved:0, total:0} }, subjectStats: [], recentActivity: [], longestStreak: 0 };
    }

    // Filter submissions for correct ones and get unique solved question IDs
    const correctSubmissions = submissions.filter(s => s.correct);
    const solvedQuestionIds = new Set(correctSubmissions.map(s => s.qid));
    const solvedQuestionsData = allQuestions.filter(q => solvedQuestionIds.has(q.id)); // Renamed to avoid conflict

    // Calculate stats per difficulty
    const difficultyStats = {
      Easy: { solved: solvedQuestionsData.filter(q => q.difficulty === 'Easy').length, total: allQuestions.filter(q => q.difficulty === 'Easy').length },
      Medium: { solved: solvedQuestionsData.filter(q => q.difficulty === 'Medium').length, total: allQuestions.filter(q => q.difficulty === 'Medium').length },
      Hard: { solved: solvedQuestionsData.filter(q => q.difficulty === 'Hard').length, total: allQuestions.filter(q => q.difficulty === 'Hard').length },
    };

     // Get the 5 most recent submissions and find their corresponding question data
    const recentActivity = submissions.slice(0, 5).map(submission => {
      const question = allQuestions.find(q => q.id === submission.qid);
      return { ...submission, question }; // Combine submission and question info
    });

    // Calculate stats per subject
    const calculatedSubjectStats = Object.values(allQuestions.reduce((acc, q) => {
        const subject = q.subject || 'Uncategorized'; // Group questions without subject
        if (!acc[subject]) {
          acc[subject] = { name: subject, solved: 0, total: 0 };
        }
        acc[subject].total++;
        if (solvedQuestionIds.has(q.id)) { // Increment solved count if ID is in the solved set
          acc[subject].solved++;
        }
        return acc;
    }, {} as Record<string, { name: string, solved: number, total: number }>)); // Define accumulator type

    // Calculate current activity streak
    let currentStreak = 0;
    if (submissions.length > 0) {
        // Get unique submission dates, sort descending
        const submissionDates = [...new Set(submissions.map(s => new Date(s.timestamp).toDateString()))]
            .map(dateStr => new Date(dateStr))
            .filter(d => !isNaN(d.getTime())) // Filter invalid dates
            .sort((a, b) => b.getTime() - a.getTime()); // Sort most recent first

        if (submissionDates.length > 0) {
            const today = new Date(); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

            // Check if most recent submission was today or yesterday
            const isToday = submissionDates[0].getTime() === today.getTime();
            const isYesterday = submissionDates[0].getTime() === yesterday.getTime();

            if (isToday || isYesterday) {
                currentStreak = 1; // Start streak if active today/yesterday
                // Iterate through older dates to extend streak
                for (let i = 0; i < submissionDates.length - 1; i++) {
                    const diffDays = (submissionDates[i].getTime() - submissionDates[i+1].getTime()) / (1000 * 3600 * 24);
                    if (diffDays === 1) { // If consecutive days
                        currentStreak++;
                    } else if (diffDays > 1) { // If gap larger than 1 day
                        break; // Streak broken
                    }
                    // Ignore if diffDays <= 0 (same day submissions)
                }
            }
        }
    }

    // FIX 2: Removed solvedQuestions from return
    return { difficultyStats, subjectStats: calculatedSubjectStats, recentActivity, longestStreak: currentStreak };
  }, [profileUser, submissions, allQuestions]); // Recalculate when data changes


  // Show skeleton if auth check is ongoing OR profile data is loading
  if (authLoading || loadingData) {
    return <ProfileSkeleton />;
  }

  // Show UserNotFound component if user doesn't exist
  if (!userFound) {
    return <UserNotFound />;
  }

  // Should ideally not happen if userFound is true, but good safety check
  if (!profileUser) {
     return <UserNotFound />; // Or a different error state
  }

  // --- Render the actual profile page ---
  return (
    <div className="min-h-screen w-full p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: User Info & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Info Card */}
            <div className="bg-white dark:bg-slate-900/70 p-6 relative rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col items-center text-center">
                    <div className="relative">
                        <img
                          src={profileUser.avatar || '/user.png'}
                          alt={profileUser.name || 'User Avatar'}
                          className="w-28 h-28 rounded-full shadow-lg border-4 border-white dark:border-slate-700 object-cover"
                          onError={(e) => { e.currentTarget.src = '/user.png'; }} // Fallback image
                        />
                        <span className="absolute bottom-0 right-0 bg-gradient-to-tr from-yellow-400 to-amber-500 text-white rounded-full p-1.5 shadow-md">
                           <Star className="w-5 h-5" />
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mt-4">{profileUser.name || 'User'}</h1>
                    <p className="text-slate-500 dark:text-slate-400">@{profileUser.username || 'username'}</p>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>Joined {profileUser.joined ? new Date(profileUser.joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : 'N/A'}</span>
                    </div>
                </div>
               {/* Link to settings only if it's the logged-in user's profile */}
               {isOwnProfile && (
                    <Link to="/settings" className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" title="Settings">
                        <SettingsIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </Link>
               )}
            </div>

            {/* Difficulty Breakdown Card */}
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Difficulty Breakdown</h2>
                <div className="space-y-4">
                    {['Easy', 'Medium', 'Hard'].map(level => {
                        const stats = difficultyStats[level as keyof typeof difficultyStats];
                        // Ensure stats are valid numbers before calculating percentage
                        const solved = typeof stats?.solved === 'number' ? stats.solved : 0;
                        const total = typeof stats?.total === 'number' ? stats.total : 0;
                        const percentage = total > 0 ? (solved / total) * 100 : 0;
                        const color = level === 'Easy' ? 'text-emerald-500 dark:text-emerald-400' : level === 'Medium' ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400';
                        const bgColor = level === 'Easy' ? 'bg-emerald-500' : level === 'Medium' ? 'bg-orange-500' : 'bg-red-500';
                        return (
                             <div key={level}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className={`font-medium ${color}`}>{level}</span>
                                    <span className="text-slate-500 dark:text-slate-400">{solved} / {total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden"> {/* Added overflow-hidden */}
                                    <div className={`${bgColor} h-2 rounded-full transition-all duration-500 ease-out`} style={{width: `${percentage}%`}}></div> {/* Added transition */}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Subject Mastery Card */}
            <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Subject Mastery</h2>
                <div className="p-6 space-y-4 max-h-80 overflow-y-auto"> {/* Added max-height and scroll */}
                    {subjectStats
                        .sort((a,b) => b.total - a.total) // Sort by total questions descending
                        .map((data) => {
                        const percentage = data.total > 0 ? (data.solved / data.total) * 100 : 0;
                        return (
                            <div key={data.name}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{data.name}</span>
                                    <span className="text-slate-500 dark:text-slate-400">{data.solved} / {data.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden"> {/* Added overflow-hidden */}
                                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" style={{width: `${percentage}%`}}></div> {/* Added transition */}
                                </div>
                            </div>
                        )
                    })}
                    {subjectStats.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-sm">No subject data available.</p>}
                </div>
            </div>
          </div>

          {/* Right Column: Activity & Submissions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Calendar Card */}
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <ActivityCalendar submissions={submissions} />
            </div>

             {/* Stat Cards Grid */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <StatCard icon={TrendingUp} value={profileUser.stats?.attempted || 0} label="Attempted" colorClass="text-blue-500 dark:text-blue-400" />
                 <StatCard icon={CheckCircle} value={profileUser.stats?.correct || 0} label="Solved" colorClass="text-emerald-500 dark:text-emerald-400" />
                 <StatCard icon={Target} value={`${(profileUser.stats?.accuracy || 0).toFixed(1)}%`} label="Accuracy" colorClass="text-pink-500 dark:text-pink-400" />
                 <StatCard icon={Zap} value={`${longestStreak} Days`} label="Current Streak" colorClass="text-yellow-500 dark:text-yellow-400" />
            </div>

            {/* Recent Submissions Card */}
            <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Recent Submissions</h2>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <div key={activity.timestamp + activity.qid} /* Combine timestamp and qid for key */ className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-2">
                          <div>
                            <Link to={`/question/${activity.qid}`} className="font-semibold text-blue-500 dark:text-blue-400 hover:underline">
                                {activity.question?.title || `Question ${activity.qid.substring(0,6)}...` /* Fallback title */}
                            </Link>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                          <span className={`text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap ${activity.correct ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'}`}>
                             {activity.correct ? 'Accepted' : 'Wrong Answer'}
                          </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-6 text-slate-500 dark:text-slate-400">No recent submissions found.</p>
                  )}
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

