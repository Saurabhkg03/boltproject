import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DailyChallengeProvider } from './contexts/DailyChallengeContext';
import { MetadataProvider } from './contexts/MetadataContext';
import { Navbar } from './components/Navbar';
import { BottomNavbar } from './components/BottomNavbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { lazy, Suspense } from 'react';
import { NotFound } from './pages/NotFound';
import { QueryCacheProvider } from './contexts/QueryCacheContext';

import { AnimatePresence } from 'framer-motion';
import { PageTransition } from './components/PageTransition';
import { ScrollToTop } from './components/ScrollToTop';

// --- OPTIMIZATION: Route-based Code Splitting (Next.js style) ---
const Home = lazy(() => import('./pages/Home'));
const Practice = lazy(() => import('./pages/Practice'));
const QuestionDetail = lazy(() => import('./pages/QuestionDetail'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Login = lazy(() => import('./pages/Login'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AddQuestion = lazy(() => import('./pages/AddQuestion'));
const Settings = lazy(() => import('./pages/Settings'));

// Loading component for Suspense
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const AppContent = () => {
  const { userInfo, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated && userInfo && userInfo.needsSetup && location.pathname !== '/settings') {
    return <Navigate to="/settings" state={{ from: location }} replace />;
  }

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="flex flex-col min-h-screen">
      {/* --- PERSISTENT LAYOUT: Navbars stay mounted across transitions --- */}
      {!isLoginPage && (
        <>
          <Navbar />
          <div className="md:hidden">
            <BottomNavbar />
          </div>
        </>
      )}

      <main className={cn("flex-1 relative z-10", !isLoginPage && "pb-16 md:pb-0")}>
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition><Home /></PageTransition>} />
              <Route path="/practice" element={<PageTransition><Practice /></PageTransition>} />
              <Route path="/leaderboard" element={<PageTransition><Leaderboard /></PageTransition>} />
              <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
              <Route path="/profile/:username" element={<PageTransition><Profile /></PageTransition>} />
              <Route path="/question/:id" element={<PageTransition><QuestionDetail /></PageTransition>} />

              <Route
                path="/settings"
                element={
                  <PageTransition>
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  </PageTransition>
                }
              />
              <Route
                path="/admin"
                element={
                  <PageTransition>
                    <ProtectedRoute allowedRoles={['admin', 'moderator']}>
                      <AdminPanel />
                    </ProtectedRoute>
                  </PageTransition>
                }
              />
              <Route
                path="/add-question"
                element={
                  <PageTransition>
                    <ProtectedRoute allowedRoles={['admin', 'moderator']}>
                      <AddQuestion />
                    </ProtectedRoute>
                  </PageTransition>
                }
              />
              <Route
                path="/edit-question/:id"
                element={
                  <PageTransition>
                    <ProtectedRoute allowedRoles={['admin', 'moderator']}>
                      <AddQuestion />
                    </ProtectedRoute>
                  </PageTransition>
                }
              />

              <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
}

// Helper for cn (already exists in project, but imported here for safety)
import { cn } from './lib/utils';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <MetadataProvider>
            <QueryCacheProvider>
              <DailyChallengeProvider>
                <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-foreground">
                  <ScrollToTop />
                  <AppContent />
                </div>
              </DailyChallengeProvider>
            </QueryCacheProvider>
          </MetadataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
