import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, LogOut, User, Shield, Settings, ChevronDown, Flame, BookCopy } from 'lucide-react';
import { motion } from 'framer-motion';

import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useDailyChallenge } from '../contexts/DailyChallengeContext';
import { useMetadata } from '../contexts/MetadataContext';
import { cn } from '@/lib/utils'; // Updated import
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// --- Branch Selector Component ---
const BranchSelector = () => {
  const { selectedBranch, setSelectedBranch, availableBranches, loading } = useMetadata();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 animate-pulse">
        <BookCopy className="w-4 h-4 text-zinc-400" />
        <div className="h-4 w-12 rounded bg-zinc-400/50"></div>
        <ChevronDown className="w-5 h-5 text-zinc-400" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-8 gap-2 px-3 font-normal text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
        >
          <BookCopy className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">
            {availableBranches[selectedBranch] || 'Select'}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-500 alpha-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Select Branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(availableBranches).map(([key, name]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setSelectedBranch(key)}
            className={cn(
              "cursor-pointer",
              selectedBranch === key && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
            )}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// --- Nav Link Component with Framer Motion ---
const NavLinkItem = ({ to, label, icon }: { to: string, label: string, icon?: React.ReactNode }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        "relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-full z-10",
        isActive ? "text-blue-600 dark:text-blue-300" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
      )}
    >
      {isActive && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 bg-blue-100 dark:bg-blue-900/40 rounded-full -z-10"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      {icon}
      {label}
    </Link>
  );
};

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { userInfo, logout, isAuthenticated } = useAuth();
  const { selectedBranch } = useMetadata();
  const streak = (userInfo?.branchStreakData?.[selectedBranch] || userInfo?.streakData)?.currentStreak || 0;
  const { dailyChallengeId, loadingChallenge } = useDailyChallenge();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white shrink-0">
            <img src="/logo.png" alt="GATECode Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-xl tracking-tight hidden sm:inline-block">GATECode</span>
            <span className="text-xl tracking-tight sm:hidden">GC</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-100/50 dark:bg-zinc-900/50 p-1 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
            <NavLinkItem to="/" label="Home" />
            <NavLinkItem to="/practice" label="Practice" />
            <NavLinkItem to="/leaderboard" label="Leaderboard" />
            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
              <NavLinkItem to="/admin" label="Admin" icon={<Shield className="w-3.5 h-3.5" />} />
            )}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            <BranchSelector />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full w-9 h-9 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            {isAuthenticated && streak > 0 && (
              <Link
                to={!loadingChallenge && dailyChallengeId ? `/question/${dailyChallengeId}` : '/practice'}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all border",
                  !loadingChallenge && dailyChallengeId
                    ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 cursor-default border-transparent"
                )}
                title={!loadingChallenge && dailyChallengeId ? "Daily Challenge" : "Practice Questions"}
              >
                <Flame className={cn("w-4 h-4 fill-current", !loadingChallenge && dailyChallengeId && "animate-pulse")} />
                <span className="text-sm font-bold tabular-nums">{streak}</span>
              </Link>
            )}

            {isAuthenticated && userInfo ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 border border-zinc-200 dark:border-zinc-800 p-0 overflow-hidden hover:opacity-90 transition-opacity">
                    <img
                      src={userInfo.avatar || '/user.png'}
                      alt={userInfo.name}
                      className="w-full h-full object-cover"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userInfo.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{userInfo.username ? `@${userInfo.username}` : ''}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={userInfo.username ? `/profile/${userInfo.username}` : '#'} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                    <DropdownMenuItem asChild className="md:hidden">
                      <Link to="/admin" className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                    {theme === 'light' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                    <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 cursor-pointer focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="rounded-full px-4">
                <Link to="/login">
                  Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav is handled in BottomNavbar.tsx, but we hide parts of this navbar on mobile via CSS if needed */}
    </nav>
  );
}