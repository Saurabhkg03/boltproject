import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DailyChallengeProvider } from './contexts/DailyChallengeContext';
import { MetadataProvider } from './contexts/MetadataContext';
import { Navbar } from './components/Navbar';
import { BottomNavbar } from './components/BottomNavbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Practice } from './pages/Practice';
import { QuestionDetail } from './pages/QuestionDetail';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { AdminPanel } from './pages/AdminPanel';
import { AddQuestion } from './pages/AddQuestion';
import { Settings } from './pages/Settings';
import { useEffect } from 'react';
import { NotFound } from './pages/NotFound';

import { AnimatePresence } from 'framer-motion';
import { PageTransition } from './components/PageTransition';
import { ScrollToTop } from './components/ScrollToTop';

const AppContent = () => {
  const { userInfo, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated && userInfo && userInfo.needsSetup && location.pathname !== '/settings') {
    return <Navigate to="/settings" state={{ from: location }} replace />;
  }

  const showNav = location.pathname !== '/login';

  return (
    <>
      {showNav && (
        <>
          <Navbar />
          <div className="md:hidden">
            <BottomNavbar />
          </div>
        </>
      )}

      <main className="relative z-10 pb-16 md:pb-0">
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
      </main>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <MetadataProvider>
            <DailyChallengeProvider>
              <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <ScrollToTop />
                <AppContent />
              </div>
            </DailyChallengeProvider>
          </MetadataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;