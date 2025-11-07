import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, LogOut, User, Shield, Settings, ChevronDown, Flame, BookCopy } from 'lucide-react';
// --- FIX: Re-added .tsx extension to context imports ---
import { useTheme } from '../contexts/ThemeContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useDailyChallenge } from '../contexts/DailyChallengeContext.tsx';
// --- IMPORT METADATA HOOK ---
import { useMetadata } from '../contexts/MetadataContext.tsx';
import { useState, useRef, useEffect } from 'react';
import React from 'react';

// --- NEW: Branch Selector Component ---
const BranchSelector = () => {
  const { selectedBranch, setSelectedBranch, availableBranches, loading } = useMetadata();
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectorRef]);

  if (loading) {
     return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50 animate-pulse">
            <BookCopy className="w-4 h-4 text-slate-400" />
            <div className="h-4 w-12 rounded bg-slate-400/50"></div>
            <ChevronDown className="w-5 h-5 text-slate-400" />
        </div>
     );
  }
  
  return (
    <div className="relative" ref={selectorRef}>
        <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors group"
        >
            <BookCopy className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {availableBranches[selectedBranch] || 'Select'}
            </span>
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
            <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-lg py-2 border border-slate-200 dark:border-slate-700">
                {Object.entries(availableBranches).map(([key, name]) => (
                    <button
                        key={key}
                        onClick={() => {
                            setSelectedBranch(key);
                            setIsOpen(false);
                        }}
                        className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${
                            selectedBranch === key 
                            ? 'font-semibold text-blue-600 dark:text-blue-300' 
                            : 'text-slate-700 dark:text-slate-200'
                        } hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300`}
                    >
                        {name}
                    </button>
                ))}
            </div>
        )}
    </div>
  );
};


export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { userInfo, logout, isAuthenticated } = useAuth();
  const streak = userInfo?.streakData?.currentStreak || 0;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { dailyChallengeId, loadingChallenge } = useDailyChallenge();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  // Close profile dropdown when location changes
  const location = useLocation();
  useEffect(() => {
    setDropdownOpen(false);
  }, [location]);


  return (
    <nav className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg border-b border-white/30 dark:border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-800 dark:text-white">
            {/* --- UPDATED LOGO --- */}
            <img 
              src="/logo.png"
              alt="GATECode Logo" 
              className="w-10 h-10" 
            />
            {/* --- END UPDATED LOGO --- */}
            <span>GATECode</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-2">
            <NavLinkItem to="/" label="Home" />
            <NavLinkItem to="/practice" label="Practice" />
            <NavLinkItem to="/leaderboard" label="Leaderboard" />
            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                 <NavLinkItem to="/admin" label="Admin Panel" icon={<Shield className="w-4 h-4" />} />
            )}
          </div>

          {/* Right side icons/buttons */}
          <div className="flex items-center gap-2">
            
            {/* --- NEW: BRANCH SELECTOR --- */}
            <BranchSelector />
            
           {isAuthenticated && streak > 0 && (
             <Link
               to={!loadingChallenge && dailyChallengeId ? `/question/${dailyChallengeId}` : '/practice'}
               className={`flex items-center gap-1.5 text-orange-500 dark:text-orange-400 font-bold bg-orange-500/10 dark:bg-orange-400/10 px-3 py-1.5 rounded-full transition-colors ${
                 !loadingChallenge && dailyChallengeId ? 'hover:bg-orange-500/20 dark:hover:bg-orange-400/20 cursor-pointer' : 'cursor-default'
               }`}
               title={!loadingChallenge && dailyChallengeId ? "Go to Daily Challenge" : "Practice Questions"}
             >
               <Flame className="w-5 h-5 fill-current" />
               <span className="text-sm">{streak}</span>
             </Link>
           )}

            {isAuthenticated && userInfo ? (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <img
                      src={userInfo.avatar || '/user.png'}
                      alt={userInfo.name}
                      className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 group-hover:border-blue-500 transition-colors"
                    />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden lg:block pr-1">
                    {userInfo.name}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-lg py-2 border border-slate-200 dark:border-slate-700">
                    
                    {/* Mobile-Only Dropdown Menu */}
                    <div className="md:hidden">
                      <DropdownLink
                        to="/"
                        onClick={() => setDropdownOpen(false)}
                        label="Home"
                      />
                      <DropdownLink
                        to="/practice"
                        onClick={() => setDropdownOpen(false)}
                        label="Practice"
                      />
                      <DropdownLink
                        to="/leaderboard"
                        onClick={() => setDropdownOpen(false)}
                        label="Leaderboard"
                      />
                      {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                        <DropdownLink
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          icon={<Shield className="w-4 h-4" />}
                          label="Admin Panel"
                        />
                      )}
                      <div className="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                      <DropdownLink
                        to={userInfo.username ? `/profile/${userInfo.username}` : '#'}
                        onClick={() => setDropdownOpen(false)}
                        icon={<User className="w-4 h-4" />}
                        label="My Profile"
                      />
                      <DropdownLink
                        to="/settings"
                        onClick={() => setDropdownOpen(false)}
                        icon={<Settings className="w-4 h-4" />}
                        label="Settings"
                      />
                      <DropdownButton
                        onClick={toggleTheme}
                        icon={theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        label={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                      />
                      <div className="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                      <button
                        onClick={() => { logout(); setDropdownOpen(false); }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md mx-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>

                    {/* Desktop-Only Dropdown Menu */}
                    <div className="hidden md:block">
                      <DropdownLink
                        to={userInfo.username ? `/profile/${userInfo.username}` : '#'}
                        onClick={() => setDropdownOpen(false)}
                        icon={<User className="w-4 h-4" />}
                        label="My Profile"
                      />
                      <DropdownLink
                        to="/settings"
                        onClick={() => setDropdownOpen(false)}
                        icon={<Settings className="w-4 h-4" />}
                        label="Settings"
                      />
                      <DropdownButton
                        onClick={toggleTheme}
                        icon={theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        label={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                      />
                      <div className="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                      <button
                        onClick={() => { logout(); setDropdownOpen(false); }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md mx-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
              >
                Login / Sign Up
              </Link>
            )}

          </div>
        </div>
      </div>
      
    </nav>
  );
}

const NavLinkItem = ({ to, label, icon }: { to: string, label: string, icon?: React.ReactNode }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <Link
            to={to}
            className={`flex items-center gap-2 text-sm font-medium transition-all duration-200 px-3 py-2 rounded-full ${
                isActive
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
            {icon}
            {label}
        </Link>
    )
}

const DropdownLink = ({ to, onClick, icon, label }: { to: string, onClick: () => void, icon?: React.ReactNode, label: string }) => (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300 rounded-md mx-2"
    >
      {icon}
      {label}
    </Link>
)

const DropdownButton = ({ onClick, icon, label }: { onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300 rounded-md mx-2"
  >
    {icon}
    {label}
  </button>
)