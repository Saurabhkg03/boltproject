import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
// --- FIX: Adding .tsx extensions back to all local imports ---
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { DailyChallengeProvider } from './contexts/DailyChallengeContext.tsx';
import { MetadataProvider } from './contexts/MetadataContext.tsx'; 
import { Navbar } from './components/Navbar.tsx';
import { BottomNavbar } from './components/BottomNavbar.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { Home } from './pages/Home.tsx';
import { Practice } from './pages/Practice.tsx';
import { QuestionDetail } from './pages/QuestionDetail.tsx';
import { Leaderboard } from './pages/Leaderboard.tsx';
import { Profile } from './pages/Profile.tsx';
import { Login } from './pages/Login.tsx';
import { AdminPanel } from './pages/AdminPanel.tsx';
import { AddQuestion } from './pages/AddQuestion.tsx';
import { Settings } from './pages/Settings.tsx';
import { useEffect } from 'react';
import { NotFound } from './pages/NotFound.tsx';

const AppContent = () => {
  const { userInfo, loading, isAuthenticated } = useAuth(); 
  const location = useLocation();

  useEffect(() => {
    // This effect runs when the authentication state is resolved.
    if (!loading) {
      const loader = document.getElementById('loader-wrapper');
      if (loader) {
        // Add a class to fade the loader out.
        loader.classList.add('hidden');
        // Optional: remove it from the DOM after the transition so it doesn't interfere.
        setTimeout(() => {
          if (loader) {
            loader.style.display = 'none';
          }
        }, 500); // Match this duration with your CSS transition.
      }
    }
  }, [loading]);

  // While the auth state is loading, we show the static HTML loader,
  // so we can return null here to prevent rendering the main app.
  if (loading) {
    return null;
  }

  // Handle initial profile setup redirect *only if authenticated*
  if (isAuthenticated && userInfo && userInfo.needsSetup && location.pathname !== '/settings') {
    return <Navigate to="/settings" state={{ from: location }} replace />;
  }
  
  const showNav = location.pathname !== '/login';

  return (
    <>
      {/* --- UPDATED: Show Top Nav always, Bottom Nav only on mobile --- */}
      {showNav && (
        <>
          <Navbar /> {/* Always show top navbar */}
          <div className="md:hidden"> {/* Wrapper to hide BottomNavbar on desktop */}
            <BottomNavbar />
          </div>
        </>
      )}
      {/* --- END UPDATED --- */}

      {/* --- UPDATED: Add padding-bottom for mobile nav --- */}
      <main className="relative z-10 pb-16 md:pb-0">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/question/:id" element={<QuestionDetail />} />


          {/* Protected Routes */}
            <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'moderator']}> {/* Restrict by role */}
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-question"
            element={
              <ProtectedRoute allowedRoles={['admin', 'moderator']}> {/* Restrict by role */}
                <AddQuestion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit-question/:id"
            element={
              <ProtectedRoute allowedRoles={['admin', 'moderator']}> {/* Restrict by role */}
                <AddQuestion />
              </ProtectedRoute>
            }
          />

          {/* Fallback Not Found Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
         {/* --- REFACTOR: Removed redundant BranchProvider --- */}
          <MetadataProvider>
            <DailyChallengeProvider>
              <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
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