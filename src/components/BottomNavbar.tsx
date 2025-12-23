import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, BarChart3, User } from 'lucide-react';
// --- FIX: Removing .tsx extension ---
import { useAuth } from '../contexts/AuthContext';
import React from 'react';

// Reusable Nav Link Component
const BottomNavLink = ({ to, label, icon: Icon }: { to: string, label: string, icon: React.ElementType }) => {
  const location = useLocation();
  // Match base path, so /profile/username matches /profile
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      // --- FIX: Make smaller (h-14) ---
      className={`flex flex-col items-center justify-center gap-0.5 w-full h-14 transition-colors ${isActive
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
        }`}
    >
      <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
};

export function BottomNavbar() {
  const { userInfo, isAuthenticated } = useAuth();

  // Determine profile link
  const profileLink = isAuthenticated && userInfo?.username
    ? `/profile/${userInfo.username}`
    : '/login'; // Send to login if not authenticated

  return (
    // --- UPDATED: Show only on mobile (md:hidden), make opaque, make smaller (h-14) ---
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 md:hidden">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-around items-center h-full">
          <BottomNavLink to="/" label="Home" icon={Home} />
          <BottomNavLink to="/practice" label="Practice" icon={ClipboardList} />
          <BottomNavLink to="/leaderboard" label="Leaderboard" icon={BarChart3} />
          <BottomNavLink to={profileLink} label="Profile" icon={User} />
        </div>
      </div>
    </nav>
  );
}