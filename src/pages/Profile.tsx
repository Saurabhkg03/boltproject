import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
// Removed Target (Accuracy icon), added BarChart (Rating icon)
import { Calendar, Settings as SettingsIcon, CheckCircle, TrendingUp, Star, Zap, BarChart } from 'lucide-react';
// Corrected import paths to use absolute paths from src or correct relative
import { useAuth } from '../contexts/AuthContext'; // Adjusted relative path
import { db } from '../firebase'; // Adjusted relative path
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { User, Submission, Question } from '../data/mockData';
import { UserNotFound } from './UserNotFound'; // Corrected relative path
import { ProfileSkeleton } from '../components/Skeletons'; // Adjusted relative path

const RATING_SCALING_FACTOR = 100; // Define the scaling factor used in Leaderboard

// --- RATING FUNCTION ---
const calculateRating = (accuracy: number | undefined, correct: number | undefined): number => {
    const safeAccuracy = accuracy ?? 0;
    const safeCorrect = correct ?? 0;
    const rating = Math.max(0, (safeAccuracy / 100) * Math.log10(safeCorrect + 1) * RATING_SCALING_FACTOR);
    return parseFloat(rating.toFixed(2));
};

// --- HELPER COMPONENTS ---

// StatCard remains the same
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


// --- Refactored ActivityCalendar ---
const ActivityCalendar = ({ submissions, availableYears }: { submissions: Submission[]; availableYears: number[] }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Determine years to display in the selector
  const displayYears = useMemo(() => {
    const yearsSet = new Set(availableYears);
    yearsSet.add(currentYear);
    const lastFiveYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
    lastFiveYears.forEach(year => yearsSet.add(year));
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [availableYears, currentYear]);

  // Adjust selectedYear if it becomes invalid
  useEffect(() => {
      if (displayYears.length > 0 && !displayYears.includes(selectedYear)) {
          setSelectedYear(displayYears[0] || currentYear);
      }
  }, [displayYears, selectedYear, currentYear]);


  // Calculate calendar grid data and month labels
  const { yearlySubmissions, calendarData, monthLabels } = useMemo(() => {
    const yearStartDate = new Date(selectedYear, 0, 1);
    const yearEndDate = new Date(selectedYear, 11, 31);

    // Filter submissions for the selected year
    const relevantSubmissions = submissions.filter(sub => {
      if (!sub.timestamp) return false;
      try {
        const subDate = new Date(sub.timestamp);
        return !isNaN(subDate.getTime()) && subDate >= yearStartDate && subDate <= yearEndDate;
      } catch (e) { return false; }
    });
    const yearlySubmissions = relevantSubmissions.length;

    // Count submissions per day
    const submissionCounts = relevantSubmissions.reduce((acc, sub) => {
        if (!sub.timestamp) return acc;
        try {
            const dateStr = new Date(sub.timestamp).toDateString();
            if (dateStr !== "Invalid Date") acc[dateStr] = (acc[dateStr] || 0) + 1;
        } catch(e) {/* ignore */}
        return acc;
    }, {} as Record<string, number>);

    // Generate Calendar Grid Data (max 53 weeks)
    const calendarData: ({ date: Date; count: number } | null)[][] = Array.from({ length: 53 }, () => Array(7).fill(null));
    const firstDayOfYear = new Date(selectedYear, 0, 1);
    const firstDayWeekday = firstDayOfYear.getDay(); // 0 (Sun) - 6 (Sat)

    // Calculate the start date of the grid (Sunday of the week containing Jan 1st)
    let gridStartDate = new Date(firstDayOfYear);
    gridStartDate.setDate(gridStartDate.getDate() - firstDayWeekday);

    let currentDate = new Date(gridStartDate);
    let maxWeekIndex = 0; // Track the actual number of weeks needed

    // Fill the grid
    for (let weekIndex = 0; weekIndex < 53; weekIndex++) {
        let weekHasDayInYear = false;
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            if (currentDate.getFullYear() === selectedYear) {
                const dateStr = currentDate.toDateString();
                calendarData[weekIndex][dayIndex] = {
                    date: new Date(currentDate),
                    count: submissionCounts[dateStr] || 0,
                };
                weekHasDayInYear = true;
            } else {
                 // Explicitly null for days outside the selected year but within the grid structure
                 calendarData[weekIndex][dayIndex] = null;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // If the week contained any day from the selected year, update maxWeekIndex
        if (weekHasDayInYear) {
             maxWeekIndex = weekIndex;
        }
        // Stop if the next day starts a Sunday AND is in the next year (we've covered the full year)
        if (currentDate.getFullYear() > selectedYear && currentDate.getDay() === 0) {
             break;
        }
    }

    // Trim calendarData to only include necessary weeks
    const trimmedCalendarData = calendarData.slice(0, maxWeekIndex + 1);

    // Generate Month Labels
    const monthLabels: { name: string; weekIndex: number }[] = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let lastMonth = -1;

    trimmedCalendarData.forEach((week, weekIndex) => {
        // Find the first day in the week that belongs to the *selected year*
        const firstDayOfYearInWeek = week.find(day => day?.date.getFullYear() === selectedYear);
        if (firstDayOfYearInWeek) {
            const month = firstDayOfYearInWeek.date.getMonth();
            if (month !== lastMonth) {
                 // Place label roughly above the first week where the month appears
                 // Check if it's the first label or if enough space exists (e.g., >2 weeks gap)
                 if (monthLabels.length === 0 || weekIndex > monthLabels[monthLabels.length - 1].weekIndex + 2) {
                    monthLabels.push({ name: monthNames[month], weekIndex });
                    lastMonth = month;
                 } else if (monthLabels.length > 0 && monthLabels[monthLabels.length - 1].name !== monthNames[month]) {
                     // Fallback: If space is tight but it's a new month, add it anyway (might overlap slightly)
                     // This prevents months from being skipped entirely on compressed views
                     const lastLabelWeek = monthLabels[monthLabels.length - 1].weekIndex;
                     if (weekIndex > lastLabelWeek) { // Ensure we don't add duplicate labels for the same week
                        monthLabels.push({ name: monthNames[month], weekIndex });
                        lastMonth = month;
                     }
                 }
            }
        }
    });

    return { yearlySubmissions, calendarData: trimmedCalendarData, monthLabels };

  }, [selectedYear, submissions]);

  // Intensity color function remains the same
  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-slate-200 dark:bg-slate-800 opacity-50 dark:opacity-40'; // Dimmed placeholders
    if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900';
    if (count <= 5) return 'bg-emerald-400 dark:bg-emerald-700';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekColumnWidth = 14; // Width (w-2.5 = 10px) + Gap (gap-1 = 4px)

  return (
    <div>
        {/* Year Selection */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white order-1 sm:order-none">
                 {/* Corrected singular/plural text */}
                {yearlySubmissions} {yearlySubmissions === 1 ? 'submission' : 'submissions'} in {selectedYear}
            </h3>
             <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 order-first sm:order-none">
                {displayYears.map(year => (
                    <button /* ... year button code ... */
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                            selectedYear === year
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        {year}
                    </button>
                ))}
             </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="bg-white dark:bg-slate-900/70 p-4 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-800">
            {/* --- Grid Layout for Labels and Squares --- */}
            <div className="flex gap-3">
                {/* Day Labels (Vertical) */}
                <div className="flex flex-col justify-between pt-5 pr-1 text-xs text-slate-400 dark:text-slate-500 shrink-0" style={{ height: `${7 * 10 + 6 * 4}px` }}> {/* 7 squares (h-2.5=10px) + 6 gaps (gap-1=4px) */}
                    {weekDayLabels.map((day, index) => (
                        <div key={index} className="h-2.5 flex items-center">
                            {(index === 1 || index === 3 || index === 5) ? day.substring(0, 3) : ''}
                        </div>
                    ))}
                </div>

                {/* Main Grid Area (Months + Squares) */}
                <div className="flex flex-col">
                    {/* Month Labels Container (Relative positioning context) */}
                    <div className="relative mb-1" style={{ height: '1em', width: `${calendarData.length * weekColumnWidth}px` }}>
                         {monthLabels.map(({ name, weekIndex }) => (
                            <span
                              key={name}
                              className="absolute top-0 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
                              // Position based on week index * column width
                              style={{ left: `${weekIndex * weekColumnWidth}px` }}
                            >
                              {name}
                            </span>
                        ))}
                    </div>

                    {/* Contribution Squares Grid */}
                    <div className="grid grid-flow-col auto-cols-max gap-1">
                        {calendarData.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-rows-7 gap-1">
                                {week.map((day, dayIndex) => (
                                    <div
                                        key={day ? day.date.toISOString() : `empty-${weekIndex}-${dayIndex}`}
                                        className={`w-2.5 h-2.5 rounded-sm ${day ? getIntensity(day.count) : 'bg-slate-100 dark:bg-slate-800 opacity-40'}`} // Style for null/empty days
                                        title={day ? `${day.count} submission(s) on ${day.date.toLocaleDateString()}` : undefined}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
             {/* Legend */}
             <div className="flex justify-end items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2 pr-2">
                <span>Less</span>
                 {/* Use the getIntensity colors for the legend squares */}
                <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(0)}`}></div>
                <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(1)}`}></div>
                <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(3)}`}></div>
                <div className={`w-2.5 h-2.5 rounded-sm ${getIntensity(6)}`}></div>
                <span>More</span>
             </div>
        </div>
    </div>
  );
};


// --- MAIN PROFILE COMPONENT ---

export function Profile() {
  // ... (State declarations remain the same) ...
  const { username } = useParams<{ username: string }>();
  const { user: authUser, loading: authLoading } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userFound, setUserFound] = useState(true);
  const [userRating, setUserRating] = useState<number>(0);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const isOwnProfile = authUser && profileUser && authUser.uid === profileUser.uid;


  // ... (useEffect to fetch data remains the same) ...
   useEffect(() => {
    if (!username) {
        setLoadingData(false); setUserFound(false); return;
    };
    const fetchProfileData = async () => {
      setLoadingData(true); setUserFound(true);
      setProfileUser(null); setSubmissions([]); setAllQuestions([]); setUserRating(0); setAvailableYears([]);
      try {
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where("username", "==", username));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) { setUserFound(false); setLoadingData(false); return; }
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data() as User;
        if (!userData.stats) { userData.stats = { attempted: 0, correct: 0, accuracy: 0 }; }
        setProfileUser(userData);
        const profileUid = userData.uid;
        const questionsQuerySnapshot = await getDocs(collection(db, 'questions'));
        const questionsData = questionsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setAllQuestions(questionsData);
        const submissionsQuery = query(collection(db, `users/${profileUid}/submissions`), orderBy('timestamp', 'desc'));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissionsData = submissionsSnapshot.docs.map(doc => doc.data() as Submission);
        setSubmissions(submissionsData);
        const yearsWithSubmissions = new Set<number>();
        submissionsData.forEach(sub => {
            if (sub.timestamp) { try { const year = new Date(sub.timestamp).getFullYear(); if (!isNaN(year)) yearsWithSubmissions.add(year); } catch(e) {} }
        });
        setAvailableYears(Array.from(yearsWithSubmissions).sort((a,b) => b-a));
        const rating = calculateRating(userData.stats?.accuracy, userData.stats?.correct);
        setUserRating(rating);
      } catch (error) { console.error("Failed to fetch profile data:", error); setUserFound(false);
      } finally { setLoadingData(false); }
    };
    fetchProfileData();
  }, [username]);


  // ... (useMemo for stats remains the same) ...
  const { difficultyStats, subjectStats, recentActivity, longestStreak } = useMemo(() => {
    if (!profileUser || allQuestions.length === 0) { return { difficultyStats: { Easy: {solved:0, total:0}, Medium: {solved:0, total:0}, Hard: {solved:0, total:0} }, subjectStats: [], recentActivity: [], longestStreak: 0 }; }
    const correctSubmissions = submissions.filter(s => s.correct);
    const solvedQuestionIds = new Set(correctSubmissions.map(s => s.qid));
    const solvedQuestionsData = allQuestions.filter(q => solvedQuestionIds.has(q.id));
    const difficultyStats = { Easy: { solved: solvedQuestionsData.filter(q => q.difficulty === 'Easy').length, total: allQuestions.filter(q => q.difficulty === 'Easy').length }, Medium: { solved: solvedQuestionsData.filter(q => q.difficulty === 'Medium').length, total: allQuestions.filter(q => q.difficulty === 'Medium').length }, Hard: { solved: solvedQuestionsData.filter(q => q.difficulty === 'Hard').length, total: allQuestions.filter(q => q.difficulty === 'Hard').length }, };
    const recentActivity = submissions.slice(0, 5).map(submission => { const question = allQuestions.find(q => q.id === submission.qid); return { ...submission, question }; });
    const calculatedSubjectStats = Object.values(allQuestions.reduce((acc, q) => { const subject = q.subject || 'Uncategorized'; if (!acc[subject]) { acc[subject] = { name: subject, solved: 0, total: 0 }; } acc[subject].total++; if (solvedQuestionIds.has(q.id)) { acc[subject].solved++; } return acc; }, {} as Record<string, { name: string, solved: number, total: number }>));
    let currentStreak = 0;
    if (submissions.length > 0) {
        const submissionDates = [...new Set(submissions.map(s => { try { return new Date(s.timestamp).toDateString(); } catch(e) { return null; } }).filter(d => d))].map(dateStr => new Date(dateStr!)).filter(d => !isNaN(d.getTime())).sort((a, b) => b.getTime() - a.getTime());
        if (submissionDates.length > 0) {
            const today = new Date(); today.setHours(0,0,0,0); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
            const isToday = submissionDates[0].getTime() === today.getTime(); const isYesterday = submissionDates[0].getTime() === yesterday.getTime();
            if (isToday || isYesterday) {
                currentStreak = 1; for (let i = 0; i < submissionDates.length - 1; i++) { const diffDays = (submissionDates[i].getTime() - submissionDates[i+1].getTime()) / (1000 * 3600 * 24); if (diffDays === 1) { currentStreak++; } else if (diffDays > 1) { break; } }
            }
        }
    }
    return { difficultyStats, subjectStats: calculatedSubjectStats, recentActivity, longestStreak: currentStreak };
  }, [profileUser, submissions, allQuestions]);


  // --- Loading / Not Found ---
  if (authLoading || loadingData) {
    return <ProfileSkeleton />;
  }
  if (!userFound || !profileUser) {
    return <UserNotFound />;
  }

  // --- Render ---
  return (
    <div className="min-h-screen w-full p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Info Card */}
            {/* ... (User Info Card JSX remains the same, includes Rating badge) ... */}
             <div className="bg-white dark:bg-slate-900/70 p-6 relative rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col items-center text-center">
                    <div className="relative">
                        <img src={profileUser.avatar || '/user.png'} alt={profileUser.name || 'User Avatar'} className="w-28 h-28 rounded-full shadow-lg border-4 border-white dark:border-slate-700 object-cover" onError={(e) => { e.currentTarget.src = '/user.png'; }} />
                        <span className="absolute bottom-0 right-0 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-full px-2 py-1 text-xs font-bold shadow-md flex items-center gap-1">
                           <BarChart className="w-3 h-3"/> {userRating}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mt-4">{profileUser.name || 'User'}</h1>
                    <p className="text-slate-500 dark:text-slate-400">@{profileUser.username || 'username'}</p>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>Joined {profileUser.joined ? new Date(profileUser.joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : 'N/A'}</span>
                    </div>
                </div>
               {isOwnProfile && (<Link to="/settings" className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" title="Settings"><SettingsIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" /></Link> )}
            </div>

            {/* Difficulty Breakdown Card */}
            {/* ... (Difficulty Breakdown Card JSX remains the same) ... */}
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Difficulty Breakdown</h2>
                <div className="space-y-4">
                    {['Easy', 'Medium', 'Hard'].map(level => { const stats = difficultyStats[level as keyof typeof difficultyStats]; const solved = typeof stats?.solved === 'number' ? stats.solved : 0; const total = typeof stats?.total === 'number' ? stats.total : 0; const percentage = total > 0 ? (solved / total) * 100 : 0; const color = level === 'Easy' ? 'text-emerald-500 dark:text-emerald-400' : level === 'Medium' ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400'; const bgColor = level === 'Easy' ? 'bg-emerald-500' : level === 'Medium' ? 'bg-orange-500' : 'bg-red-500'; return ( <div key={level}> <div className="flex justify-between text-sm mb-1"> <span className={`font-medium ${color}`}>{level}</span> <span className="text-slate-500 dark:text-slate-400">{solved} / {total}</span> </div> <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden"> <div className={`${bgColor} h-2 rounded-full transition-all duration-500 ease-out`} style={{width: `${percentage}%`}}></div> </div> </div> ) })}
                </div>
            </div>

            {/* Subject Mastery Card */}
            {/* ... (Subject Mastery Card JSX remains the same) ... */}
             <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Subject Mastery</h2>
                <div className="p-6 space-y-4 max-h-80 overflow-y-auto">
                    {subjectStats .sort((a,b) => b.total - a.total) .map((data) => { const percentage = data.total > 0 ? (data.solved / data.total) * 100 : 0; return ( <div key={data.name}> <div className="flex justify-between text-sm mb-1"> <span className="font-medium text-slate-700 dark:text-slate-200">{data.name}</span> <span className="text-slate-500 dark:text-slate-400">{data.solved} / {data.total}</span> </div> <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden"> <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" style={{width: `${percentage}%`}}></div> </div> </div> ) })} {subjectStats.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-sm">No subject data available.</p>}
                </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Calendar Card */}
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <ActivityCalendar submissions={submissions} availableYears={availableYears} />
            </div>

             {/* Stat Cards Grid */}
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
                 <StatCard icon={BarChart} value={userRating} label="Rating" colorClass="text-blue-500 dark:text-blue-400" />
                 <StatCard icon={TrendingUp} value={profileUser.stats?.attempted || 0} label="Attempted" colorClass="text-purple-500 dark:text-purple-400" />
                 <StatCard icon={CheckCircle} value={profileUser.stats?.correct || 0} label="Solved" colorClass="text-emerald-500 dark:text-emerald-400" />
                 <StatCard icon={Zap} value={`${longestStreak} Days`} label="Current Streak" colorClass="text-yellow-500 dark:text-yellow-400" />
            </div>

            {/* Recent Submissions Card */}
            {/* ... (Recent Submissions Card JSX remains the same) ... */}
             <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Recent Submissions</h2>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentActivity.length > 0 ? ( recentActivity.map((activity) => ( <div key={activity.timestamp + activity.qid} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-2"> <div> <Link to={`/question/${activity.qid}`} className="font-semibold text-blue-500 dark:text-blue-400 hover:underline"> {activity.question?.title || `Question ${activity.qid.substring(0,6)}...`} </Link> <p className="text-sm text-slate-500 dark:text-slate-400"> {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A'} </p> </div> <span className={`text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap ${activity.correct ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'}`}> {activity.correct ? 'Accepted' : 'Wrong Answer'} </span> </div> )) ) : ( <p className="p-6 text-slate-500 dark:text-slate-400">No recent submissions found.</p> )}
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

