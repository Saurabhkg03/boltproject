import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Settings as SettingsIcon, CheckCircle, TrendingUp, Zap, BarChart, Loader2 } from 'lucide-react'; // Removed ChevronDown
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    documentId, 
    doc, 
    onSnapshot, // Import onSnapshot for real-time user data
    limit,
    startAfter,
    DocumentSnapshot,
    DocumentData
} from 'firebase/firestore';
import { User, Submission, Question } from '../data/mockData';
import { UserNotFound } from './UserNotFound';
import { ProfileSkeleton } from '../components/Skeletons';
// Import the metadata hook
import { useMetadata } from '../contexts/MetadataContext';

const RATING_SCALING_FACTOR = 100;
const SUBMISSIONS_PAGE_SIZE = 5; // How many submissions to load at a time

// --- RATING FUNCTION ---
const calculateRating = (accuracy: number | undefined, correct: number | undefined): number => {
    const safeAccuracy = accuracy ?? 0;
    const safeCorrect = correct ?? 0;
    const rating = Math.max(0, (safeAccuracy / 100) * Math.log10(safeCorrect + 1) * RATING_SCALING_FACTOR);
    return parseFloat(rating.toFixed(2));
};

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

// --- ActivityCalendar ---
// This component now receives the pre-calculated calendar data directly
const ActivityCalendar = ({ calendarData, availableYears }: { calendarData: Record<string, number>; availableYears: number[] }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const displayYears = useMemo(() => {
    const yearsSet = new Set(availableYears);
    yearsSet.add(currentYear);
    const lastFiveYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
    lastFiveYears.forEach(year => yearsSet.add(year));
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [availableYears, currentYear]);

  useEffect(() => {
      if (displayYears.length > 0 && !displayYears.includes(selectedYear)) {
          setSelectedYear(displayYears[0] || currentYear);
      }
  }, [displayYears, selectedYear, currentYear]);


  // --- FIX: Renamed calendarGrid to calendarData ---
  const { yearlySubmissions, calendarData: calendarGrid, monthLabels } = useMemo(() => {
    let submissionCount = 0;
    const submissionCounts: Record<string, number> = {};

    // Filter the pre-calculated data for the selected year
    for (const dateStr in calendarData) {
        if (dateStr.startsWith(selectedYear.toString())) {
            // Use 'YYYY-MM-DD' key from our new data structure
            const count = calendarData[dateStr] || 0;
            // FIX: Ensure correct date object parsing for cross-browser safety
            const dateObj = new Date(dateStr + 'T00:00:00'); // Assume local time
            submissionCounts[dateObj.toDateString()] = count;
            submissionCount += count;
        }
    }

    const calendarGrid: ({ date: Date; count: number } | null)[][] = Array.from({ length: 53 }, () => Array(7).fill(null));
    const firstDayOfYear = new Date(selectedYear, 0, 1);
    const firstDayWeekday = firstDayOfYear.getDay(); 

    let gridStartDate = new Date(firstDayOfYear);
    gridStartDate.setDate(gridStartDate.getDate() - firstDayWeekday);

    let currentDate = new Date(gridStartDate);
    let maxWeekIndex = 0; 

    for (let weekIndex = 0; weekIndex < 53; weekIndex++) {
        let weekHasDayInYear = false;
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            if (currentDate.getFullYear() === selectedYear) {
                const dateStr = currentDate.toDateString();
                calendarGrid[weekIndex][dayIndex] = {
                    date: new Date(currentDate),
                    count: submissionCounts[dateStr] || 0,
                };
                weekHasDayInYear = true;
            } else {
                calendarGrid[weekIndex][dayIndex] = null;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        if (weekHasDayInYear) {
            maxWeekIndex = weekIndex;
        }
        if (currentDate.getFullYear() > selectedYear && currentDate.getDay() === 0) {
            break;
        }
    }

    const trimmedCalendarGrid = calendarGrid.slice(0, maxWeekIndex + 1);
    const monthLabels: { name: string; weekIndex: number }[] = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let lastMonth = -1;

    trimmedCalendarGrid.forEach((week, weekIndex) => {
        const firstDayOfYearInWeek = week.find(day => day?.date.getFullYear() === selectedYear);
        if (firstDayOfYearInWeek) {
            const month = firstDayOfYearInWeek.date.getMonth();
            if (month !== lastMonth) {
                if (monthLabels.length === 0 || weekIndex > monthLabels[monthLabels.length - 1].weekIndex + 2) {
                    monthLabels.push({ name: monthNames[month], weekIndex });
                    lastMonth = month;
                } else if (monthLabels.length > 0 && monthLabels[monthLabels.length - 1].name !== monthNames[month]) {
                    const lastLabelWeek = monthLabels[monthLabels.length - 1].weekIndex;
                    if (weekIndex > lastLabelWeek) { 
                        monthLabels.push({ name: monthNames[month], weekIndex });
                        lastMonth = month;
                    }
                }
            }
        }
    });

    return { yearlySubmissions: submissionCount, calendarData: trimmedCalendarGrid, monthLabels };

  // --- FIX: Changed circular dependency from calendarData to submissions ---
  }, [selectedYear, calendarData]); // This should be calendarData (the prop), not submissions

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-slate-200 dark:bg-slate-800 opacity-50 dark:opacity-40';
    if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900';
    if (count <= 5) return 'bg-emerald-400 dark:bg-emerald-700';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekColumnWidth = 14; 

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white order-1 sm:order-none">
                {yearlySubmissions} {yearlySubmissions === 1 ? 'submission' : 'submissions'} in {selectedYear}
            </h3>
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 order-first sm:order-none">
                {displayYears.map(year => (
                    <button
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

        <div className="bg-white dark:bg-slate-900/70 p-4 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-800">
            <div className="flex gap-3">
                <div className="flex flex-col justify-between pt-5 pr-1 text-xs text-slate-400 dark:text-slate-500 shrink-0" style={{ height: `${7 * 10 + 6 * 4}px` }}>
                    {weekDayLabels.map((day, index) => (
                        <div key={index} className="h-2.5 flex items-center">
                            {(index === 1 || index === 3 || index === 5) ? day.substring(0, 3) : ''}
                        </div>
                    ))}
                </div>

                <div className="flex flex-col">
                    <div className="relative mb-1" style={{ height: '1em', width: `${calendarGrid.length * weekColumnWidth}px` }}>
                        {monthLabels.map(({ name, weekIndex }) => (
                            <span
                                key={name}
                                className="absolute top-0 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
                                style={{ left: `${weekIndex * weekColumnWidth}px` }}
                            >
                                {name}
                            </span>
                        ))}
                    </div>

                    <div className="grid grid-flow-col auto-cols-max gap-1">
                        {/* --- FIX: Added types to map params --- */}
                        {calendarGrid.map((week: ({ date: Date; count: number } | null)[], weekIndex: number) => (
                            <div key={weekIndex} className="grid grid-rows-7 gap-1">
                                {week.map((day: { date: Date; count: number } | null, dayIndex: number) => (
                                    <div
                                        key={day ? day.date.toISOString() : `empty-${weekIndex}-${dayIndex}`}
                                        className={`w-2.5 h-2.5 rounded-sm ${day ? getIntensity(day.count) : 'bg-slate-100 dark:bg-slate-800 opacity-40'}`}
                                        title={day ? `${day.count} submission(s) on ${day.date.toLocaleDateString()}` : undefined}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex justify-end items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2 pr-2">
                <span>Less</span>
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
    const { username } = useParams<{ username: string }>();
    const { user: authUser, loading: authLoading } = useAuth();
    const { metadata, loading: metadataLoading } = useMetadata();

    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [userFound, setUserFound] = useState(true);

    // Pagination for recent submissions
    const [recentSubmissions, setRecentSubmissions] = useState<(Submission & { question?: Question })[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);
    const [submissionsLastDoc, setSubmissionsLastDoc] = useState<DocumentSnapshot<DocumentData> | null>(null);
    const [hasMoreSubmissions, setHasMoreSubmissions] = useState(false);
    
    const isOwnProfile = authUser && profileUser && authUser.uid === profileUser.uid;

    // --- Real-time listener for the profile user's document ---
    useEffect(() => {
        if (!username) {
            setLoadingUser(false); setUserFound(false); return;
        };
        
        setLoadingUser(true);
        setUserFound(true);
        setProfileUser(null);
        setRecentSubmissions([]);
        setSubmissionsLastDoc(null);
        setHasMoreSubmissions(false);

        // Find the user by username
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where("username", "==", username), limit(1));
        
        let unsubscribe: () => void = () => {};

        getDocs(userQuery).then(userSnapshot => {
            if (userSnapshot.empty) {
                setUserFound(false);
                setLoadingUser(false);
                return;
            }
            
            const userDoc = userSnapshot.docs[0];
            const profileUid = userDoc.id;

            // --- Now, create a real-time listener for this user ---
            console.log(`[Profile] Subscribing to user document: ${profileUid}`);
            const userDocRef = doc(db, 'users', profileUid);
            
            unsubscribe = onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) {
                    const userData = doc.data() as User;
                    // Ensure stats exist
                    if (!userData.stats) { userData.stats = { attempted: 0, correct: 0, accuracy: 0 }; }
                    if (!userData.streakData) { userData.streakData = { currentStreak: 0, lastSubmissionDate: '' }; }
                    if (!userData.activityCalendar) { userData.activityCalendar = {}; }
                    
                    setProfileUser(userData);
                    setUserFound(true);
                } else {
                    setUserFound(false);
                }
                setLoadingUser(false);
            }, (error) => {
                console.error("[Profile] Error listening to user document:", error);
                setUserFound(false);
                setLoadingUser(false);
            });

            // --- Also fetch the *first page* of submissions ---
            fetchSubmissions(profileUid, true);

        }).catch(error => {
            console.error("[Profile] Error fetching user by username:", error);
            setUserFound(false);
            setLoadingUser(false);
        });

        // Cleanup listener
        return () => {
            console.log("[Profile] Unsubscribing from user document.");
            unsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username]);


    // --- Paginated function to fetch submissions ---
    const fetchSubmissions = async (profileUid: string, isFirstPage: boolean = false) => {
        if (!isFirstPage && !hasMoreSubmissions) return; // Stop if no more

        setLoadingSubmissions(true);

        try {
            let submissionsQuery = query(
                collection(db, `users/${profileUid}/submissions`), 
                orderBy('timestamp', 'desc'), 
                limit(SUBMISSIONS_PAGE_SIZE)
            );

            // If not the first page, start after the last doc
            if (!isFirstPage && submissionsLastDoc) {
                submissionsQuery = query(submissionsQuery, startAfter(submissionsLastDoc));
            }

            const submissionsSnapshot = await getDocs(submissionsQuery);
            const submissionsData = submissionsSnapshot.docs.map(doc => doc.data() as Submission);
            
            // Store the last doc for pagination
            const lastDoc = submissionsSnapshot.docs[submissionsSnapshot.docs.length - 1];
            setSubmissionsLastDoc(lastDoc || null);
            setHasMoreSubmissions(submissionsData.length === SUBMISSIONS_PAGE_SIZE);

            // --- Get question titles for these submissions ---
            const questionIds = [...new Set(submissionsData.map(s => s.qid))];
            const fetchedQuestions = new Map<string, Question>();

            if (questionIds.length > 0) {
                // We only need to fetch 5 (max) questions, so one chunk is fine
                const qQuery = query(collection(db, 'questions'), where(documentId(), 'in', questionIds));
                const qSnapshot = await getDocs(qQuery);
                qSnapshot.forEach(doc => {
                    fetchedQuestions.set(doc.id, { id: doc.id, ...doc.data() } as Question);
                });
            }

            // Combine submissions with question data
            const submissionsWithData = submissionsData.map(submission => ({
                ...submission,
                question: fetchedQuestions.get(submission.qid)
            }));
            
            // Append to existing list or set new list
            setRecentSubmissions(prev => isFirstPage ? submissionsWithData : [...prev, ...submissionsWithData]);

        } catch (error) {
            console.error("[Profile] Error fetching submissions:", error);
        } finally {
            setLoadingSubmissions(false);
        }
    };


    // --- Memoized values derived from the (real-time) profileUser ---
    const { 
        userRating, 
        availableYears, 
        subjectStats 
    } = useMemo(() => {
        if (!profileUser || !metadata) {
            return { userRating: 0, availableYears: [], subjectStats: [] };
        }

        // 1. Calculate Rating
        const rating = calculateRating(profileUser.stats?.accuracy, profileUser.stats?.correct);

        // 2. Get available years from calendar
        const years = new Set<number>();
        if (profileUser.activityCalendar) {
            Object.keys(profileUser.activityCalendar).forEach(dateStr => {
                years.add(parseInt(dateStr.substring(0, 4), 10));
            });
        }
        
        // 3. Calculate Subject Stats
        // We get TOTALS from metadata, SOLVED from user doc
        const solvedCounts = profileUser.stats?.subjects || {};
        const subjectStats = Object.entries(metadata.subjectCounts || {}).map(([subjectName, total]) => ({
            name: subjectName,
            solved: solvedCounts[subjectName] || 0,
            total: total
        }));

        return {
            userRating: rating,
            availableYears: Array.from(years).sort((a,b) => b-a),
            subjectStats: subjectStats
        };
    }, [profileUser, metadata]);


    // --- Loading / Not Found ---
    if (authLoading || metadataLoading || (loadingUser && !profileUser)) {
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

                        {/* Subject Mastery Card */}
                        <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Subject Mastery</h2>
                            <div className="p-6 space-y-4 max-h-80 overflow-y-auto">
                                {subjectStats.length > 0 ? (
                                    subjectStats.sort((a,b) => b.total - a.total)
                                        .filter(data => data.total > 0) // Only show subjects with questions
                                        .map((data) => { 
                                            const percentage = data.total > 0 ? (data.solved / data.total) * 100 : 0; 
                                            return ( 
                                                <div key={data.name}> 
                                                    <div className="flex justify-between text-sm mb-1"> 
                                                        <span className="font-medium text-slate-700 dark:text-slate-200">{data.name}</span> 
                                                        <span className="text-slate-500 dark:text-slate-400">{data.solved} / {data.total}</span> 
                                                    </div> 
                                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden"> 
                                                        <div className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" style={{width: `${percentage}%`}}></div> 
                                                    </div> 
                                                </div> 
                                            ) 
                                        })
                                ) : (
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading subject data...</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Activity Calendar Card */}
                        <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <ActivityCalendar 
                                calendarData={profileUser.activityCalendar || {}} 
                                availableYears={availableYears} 
                            />
                        </div>

                        {/* Stat Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
                            <StatCard icon={BarChart} value={userRating} label="Rating" colorClass="text-blue-500 dark:text-blue-400" />
                            <StatCard icon={TrendingUp} value={profileUser.stats?.attempted || 0} label="Attempted" colorClass="text-purple-500 dark:text-purple-400" />
                            <StatCard icon={CheckCircle} value={profileUser.stats?.correct || 0} label="Solved" colorClass="text-emerald-500 dark:text-emerald-400" />
                            <StatCard icon={Zap} value={`${profileUser.streakData?.currentStreak || 0} Days`} label="Current Streak" colorClass="text-yellow-500 dark:text-yellow-400" />
                        </div>

                        {/* Recent Submissions Card */}
                        <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h2 className="text-lg font-semibold p-6 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">Recent Submissions</h2>
                            <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                {recentSubmissions.length > 0 ? ( 
                                    recentSubmissions.map((activity) => ( 
                                        <div key={activity.timestamp + activity.qid} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-2"> 
                                            <div> 
                                                <Link to={`/question/${activity.qid}`} className="font-semibold text-blue-500 dark:text-blue-400 hover:underline"> 
                                                    {/* This now works, as we fetched the question data */}
                                                    {activity.question?.title || `Question ${activity.qid.substring(0,6)}...`} 
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
                                    !loadingSubmissions && <p className="p-6 text-slate-500 dark:text-slate-400">No recent submissions found.</p> 
                                )}
                                
                                {loadingSubmissions && (
                                    <div className="p-4 text-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
                                    </div>
                                )}

                                {hasMoreSubmissions && !loadingSubmissions && (
                                    <button 
                                        onClick={() => fetchSubmissions(profileUser.uid, false)}
                                        className="w-full p-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                        Load More
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

