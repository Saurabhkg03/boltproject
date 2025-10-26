import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DailyChallengeProvider } from './contexts/DailyChallengeContext.tsx';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute.tsx'; // <-- Added .tsx extension
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

const AppContent = () => {
  const { userInfo, loading, isAuthenticated } = useAuth(); // <-- Added isAuthenticated
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

  return (
    <>
      {/* Only show Navbar if not on the login page */}
      {location.pathname !== '/login' && <Navbar />}
      <main className="relative z-10">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile/:username" element={<Profile />} /> {/* Profile might be public? Check logic inside */}
          {/* Make Question Detail public */}
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
         <DailyChallengeProvider>
          {/* Apply gradient/base styles here if needed globally */}
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <AppContent />
          </div>
         </DailyChallengeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

