import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
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
  const { userInfo, loading } = useAuth();
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

  // Once loading is false, handle redirects or render the main app.
  if (userInfo && userInfo.needsSetup && location.pathname !== '/settings') {
    return <Navigate to="/settings" state={{ from: location }} replace />;
  }

  return (
    <>
      <Navbar />
      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/question/:id" element={<QuestionDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/add-question" element={<AddQuestion />} />
          <Route path="/edit-question/:id" element={<AddQuestion />} />
          <Route path="*" element={<NotFound />} /> {/* Add this wildcard route */}
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
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-950 dark:to-slate-800">
            <AppContent />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

