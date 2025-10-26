// Skeleton component library for loading states

const SkeletonBase = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

// --- Home Page Skeletons ---
export const HomeSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-16">
    {/* Header Skeleton */}
    <div className="text-center">
      <SkeletonBase className="h-10 md:h-16 w-3/4 mx-auto mb-4" />
      <SkeletonBase className="h-5 md:h-6 w-full max-w-2xl mx-auto" />
      <SkeletonBase className="h-16 w-48 mx-auto mt-8 glass-card" />
    </div>

    {/* Daily Challenge Skeleton */}
    <div className="glass-card p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
        <SkeletonBase className="w-16 h-16 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2 text-center md:text-left">
          <SkeletonBase className="h-6 w-48 mx-auto md:mx-0" />
          <SkeletonBase className="h-4 w-3/4 mx-auto md:mx-0" />
        </div>
        <SkeletonBase className="h-12 w-36 rounded-full" />
      </div>
    </div>

    {/* Subjects & Leaderboard Skeletons */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <SkeletonBase className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <div className="flex items-center gap-4">
                <SkeletonBase className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonBase className="h-5 w-3/4" />
                  <SkeletonBase className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-card p-6 space-y-4">
        <SkeletonBase className="h-7 w-48 mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonBase className="w-8 h-8 rounded-full" />
            <SkeletonBase className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <SkeletonBase className="h-4 w-3/4" />
              <SkeletonBase className="h-3 w-1/2" />
            </div>
            <SkeletonBase className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- Practice Page Skeletons ---
const PracticeListItemSkeleton = () => (
    <>
        {/* Mobile Skeleton */}
        <div className="block md:hidden px-4 py-4">
            <SkeletonBase className="h-5 w-3/4 mb-2" />
            <div className="flex items-center gap-2 mb-2">
                <SkeletonBase className="w-4 h-4 rounded-full" />
                <SkeletonBase className="h-3 w-16" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <SkeletonBase className="h-5 w-12 rounded-full" />
                <SkeletonBase className="h-5 w-20 rounded-full" />
                <SkeletonBase className="h-5 w-10 rounded" />
            </div>
        </div>
        {/* Desktop Skeleton */}
        <tr className="hidden md:table-row">
            <td className="px-6 py-4"><SkeletonBase className="w-5 h-5 rounded-full mx-auto" /></td>
            <td className="px-6 py-4"><SkeletonBase className="h-4 w-3/5" /></td>
            <td className="px-6 py-4"><SkeletonBase className="h-4 w-4/5" /></td>
            <td className="px-6 py-4"><SkeletonBase className="h-5 w-16 rounded-full" /></td>
            <td className="px-6 py-4 space-x-1"><SkeletonBase className="inline-block h-4 w-16 rounded" /> <SkeletonBase className="inline-block h-4 w-10 rounded" /></td>
        </tr>
    </>
);

export const PracticeSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="mb-8">
      <SkeletonBase className="h-8 w-1/3 mb-2" />
      <SkeletonBase className="h-4 w-1/4" />
    </div>
    {/* Filters Skeleton */}
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:p-6 mb-6">
        <div className="space-y-4">
            <SkeletonBase className="h-10 w-full rounded-lg" />
            <div className="flex flex-wrap items-center gap-2">
                <SkeletonBase className="h-8 w-24 rounded-md" />
                <SkeletonBase className="h-8 w-32 rounded-md" />
                <SkeletonBase className="h-8 w-28 rounded-md" />
                <SkeletonBase className="h-8 w-20 rounded-md" />
                <SkeletonBase className="h-8 w-24 rounded-md" />
                <div className="flex-grow"></div>
                <SkeletonBase className="h-8 w-36 rounded-md" />
                <SkeletonBase className="h-8 w-10 rounded-md" />
            </div>
        </div>
    </div>
    {/* List Skeleton */}
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Mobile */}
        <div className="divide-y divide-gray-200 dark:divide-gray-800 md:hidden">
            {[...Array(5)].map((_, i) => <PracticeListItemSkeleton key={i} />)}
        </div>
        {/* Desktop */}
        <div className="hidden md:block">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        {[...Array(6)].map((_, i) => ( // Adjust column count if needed
                            <th key={i} scope="col" className="px-6 py-3">
                                <SkeletonBase className="h-4 w-16" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {[...Array(5)].map((_, i) => <PracticeListItemSkeleton key={i} />)}
                </tbody>
            </table>
        </div>
    </div>
     {/* Pagination Skeleton */}
     <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <SkeletonBase className="h-9 w-28 rounded-md" />
        <SkeletonBase className="h-4 w-24 rounded" />
        <SkeletonBase className="h-9 w-24 rounded-md" />
    </div>
  </div>
);


// --- Question Detail Page Skeletons ---
export const QuestionDetailSkeleton = () => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
     {/* Nav Skeleton */}
     <div className="flex justify-between items-center mb-6">
        <SkeletonBase className="h-6 w-24 rounded" />
        <SkeletonBase className="h-4 w-32 rounded" />
        <SkeletonBase className="h-6 w-20 rounded" />
     </div>
     {/* Login Prompt Skeleton (optional, could be simpler) */}
     <SkeletonBase className="h-16 w-full rounded-lg mb-6" />

    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-lg">
      {/* Header Skeleton */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-4">
            <SkeletonBase className="h-7 w-3/4" />
            <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                <SkeletonBase className="h-8 w-24 rounded-lg" />
                <SkeletonBase className="h-8 w-28 rounded-lg" />
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SkeletonBase className="h-5 w-16 rounded-full" />
          <SkeletonBase className="h-5 w-24 rounded" />
          <SkeletonBase className="h-5 w-20 rounded" />
          <SkeletonBase className="h-5 w-28 rounded" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SkeletonBase className="h-5 w-12 rounded" />
            <SkeletonBase className="h-5 w-16 rounded" />
        </div>
      </div>

      {/* Body Skeleton */}
      <div className="p-6 space-y-4">
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-5/6" />
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-3/4" />
        <SkeletonBase className="h-32 w-full rounded-lg my-4" /> {/* Image Placeholder */}

        {/* Options Skeleton */}
        <div className="space-y-3 pt-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700">
                    <SkeletonBase className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                        <SkeletonBase className="h-4 w-full" />
                        <SkeletonBase className="h-4 w-2/3" />
                    </div>
                </div>
            ))}
        </div>
        <SkeletonBase className="h-12 w-full rounded-lg mt-6" />
      </div>

      {/* Notes Skeleton */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-800">
        <SkeletonBase className="h-6 w-1/4 mb-3" />
        <SkeletonBase className="h-24 w-full rounded-lg" />
        <SkeletonBase className="h-10 w-32 rounded-lg mt-3" />
      </div>
    </div>
  </div>
);

// --- Leaderboard Page Skeletons ---
const LeaderboardListItemSkeleton = () => (
    <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 last:border-b-0">
        <SkeletonBase className="w-10 h-6 rounded mr-3" /> {/* Rank */}
        <div className="flex-1 flex items-center gap-3 overflow-hidden">
            <SkeletonBase className="w-9 h-9 rounded-full flex-shrink-0" />
            <div className="overflow-hidden space-y-1.5">
                <SkeletonBase className="h-4 w-32 rounded" />
                <SkeletonBase className="h-3 w-24 rounded" />
            </div>
        </div>
        <div className="flex items-center justify-end gap-4 md:gap-6 flex-shrink-0 pl-2">
            <SkeletonBase className="h-5 w-16 rounded-full" />
            <SkeletonBase className="h-5 w-12 rounded-full" />
        </div>
    </div>
);

export const LeaderboardSkeleton = () => (
    <div className="min-h-screen w-full px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
            <SkeletonBase className="h-8 w-48 mx-auto mb-2" />
            <SkeletonBase className="h-4 w-64 mx-auto" />
        </div>
        {/* Podium Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
            {[...Array(3)].map((_, i) => (
                <div key={i} className={`flex flex-col items-center ${i === 1 ? 'md:order-2 md:-mt-6' : (i === 0 ? 'md:order-1' : 'md:order-3')}`}>
                    <div className="w-full glass-card p-4 rounded-2xl text-center flex flex-col items-center">
                        <SkeletonBase className="w-20 h-20 rounded-full mb-3" />
                        <SkeletonBase className="h-5 w-3/4 mb-1" />
                        <SkeletonBase className="h-3 w-1/2 mb-3" />
                        <SkeletonBase className="h-12 w-full rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
        {/* Filters Skeleton */}
         <div className="flex justify-center mb-4">
            <SkeletonBase className="h-10 w-64 rounded-full glass-card p-1" />
         </div>
        {/* List Skeleton */}
        <div className="glass-card overflow-hidden">
            <div>
                {[...Array(7)].map((_, i) => <LeaderboardListItemSkeleton key={i} />)}
            </div>
        </div>
        {/* Pagination Skeleton */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <SkeletonBase className="h-9 w-28 rounded-md" />
            <SkeletonBase className="h-4 w-24 rounded" />
            <SkeletonBase className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
);


// --- Profile Page Skeletons ---
export const ProfileSkeleton = () => (
  <div className="min-h-screen w-full p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column Skeleton */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Info Card */}
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col items-center text-center">
                    <SkeletonBase className="w-28 h-28 rounded-full mb-4" />
                    <SkeletonBase className="h-6 w-3/4 mb-1" />
                    <SkeletonBase className="h-4 w-1/2 mb-2" />
                    <SkeletonBase className="h-4 w-3/5" />
                </div>
            </div>
            {/* Difficulty Breakdown */}
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                <SkeletonBase className="h-6 w-1/2 mb-4" />
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                         <div key={i}>
                            <div className="flex justify-between mb-1">
                                <SkeletonBase className="h-4 w-16" />
                                <SkeletonBase className="h-4 w-20" />
                            </div>
                            <SkeletonBase className="h-2 w-full rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
             {/* Subject Mastery */}
             <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                <SkeletonBase className="h-6 w-1/2 mb-4" />
                <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                         <div key={i}>
                            <div className="flex justify-between mb-1">
                                <SkeletonBase className="h-4 w-24" />
                                <SkeletonBase className="h-4 w-16" />
                            </div>
                            <SkeletonBase className="h-2 w-full rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
          </div>
          {/* Right Column Skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Calendar */}
            <div className="bg-white dark:bg-slate-900/70 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-center mb-2">
                    <SkeletonBase className="h-6 w-1/2" />
                    <SkeletonBase className="h-4 w-1/4" />
                </div>
                <SkeletonBase className="h-32 w-full rounded-lg" /> {/* Placeholder for calendar grid */}
            </div>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900/70 p-4 rounded-xl flex items-center gap-4 border border-gray-200 dark:border-gray-800">
                        <SkeletonBase className="w-10 h-10 rounded-lg" />
                        <div className="space-y-1.5">
                            <SkeletonBase className="h-5 w-12" />
                            <SkeletonBase className="h-3 w-20" />
                        </div>
                    </div>
                 ))}
            </div>
            {/* Recent Submissions */}
            <div className="bg-white dark:bg-slate-900/70 rounded-xl border border-gray-200 dark:border-gray-800">
                <SkeletonBase className="h-6 w-1/3 m-6 mb-0 border-b border-gray-200 dark:border-gray-800 pb-6" />
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                     {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="space-y-1.5">
                                <SkeletonBase className="h-4 w-48" />
                                <SkeletonBase className="h-3 w-32" />
                            </div>
                            <SkeletonBase className="h-6 w-24 rounded-full" />
                        </div>
                     ))}
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
);
