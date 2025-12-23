import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Target, Trophy, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Reusable Nav Link Component
const BottomNavLink = ({ to, label, icon: Icon }: { to: string, label: string, icon: React.ElementType }) => {
  const location = useLocation();
  // Match base path, so /profile/username matches /profile
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 h-full flex-1 min-w-[64px] rounded-2xl transition-colors duration-300 z-10",
        isActive
          ? "text-blue-600 dark:text-blue-400"
          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="bottom-nav-active"
          className="absolute inset-0 bg-blue-100/50 dark:bg-blue-900/30 rounded-2xl -z-10"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      <div className="relative">
        <Icon
          className={cn(
            "w-6 h-6 transition-all duration-300",
            isActive ? "scale-110 drop-shadow-sm" : "scale-100"
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />
        {isActive && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full ring-2 ring-white dark:ring-zinc-900"
          />
        )}
      </div>

      <span className={cn(
        "text-[10px] font-medium transition-all duration-300",
        isActive ? "opacity-100 font-bold" : "opacity-80"
      )}>
        {label}
      </span>
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
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none md:hidden">
      <nav className="flex items-center justify-between p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/20 dark:border-zinc-800/50 rounded-full shadow-xl shadow-zinc-200/50 dark:shadow-black/50 ring-1 ring-black/5 dark:ring-white/10 pointer-events-auto max-w-sm w-full h-16">
        <BottomNavLink to="/" label="Home" icon={LayoutGrid} />
        <BottomNavLink to="/practice" label="Practice" icon={Target} />
        <BottomNavLink to="/leaderboard" label="Leader" icon={Trophy} />
        <BottomNavLink to={profileLink} label="Profile" icon={User} />
      </nav>
    </div>
  );
}