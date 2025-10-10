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
import { Loader2 } from 'lucide-react';

const AppContent = () => {
  const { userInfo, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  // If user info is loaded, their profile needs setup, and they aren't already on the settings page, redirect them.
  if (userInfo && userInfo.needsSetup && location.pathname !== '/settings') {
    return <Navigate to="/settings" state={{ from: location }} replace />;
  }

  return (
    <>
      <Navbar />
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
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <AppContent />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
