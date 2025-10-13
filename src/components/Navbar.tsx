import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Code2, LogOut, User, Shield, Settings, ChevronDown, Flame } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useState, useRef, useEffect } from 'react';
import React from 'react';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { userInfo, logout, isAuthenticated, streak } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
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


  return (
    <nav className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg border-b border-white/30 dark:border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-800 dark:text-white">
            <Code2 className="w-6 h-6 text-blue-500" />
            <span>GATECode</span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <NavLinkItem to="/" label="Home" />
            <NavLinkItem to="/practice" label="Practice" />
            <NavLinkItem to="/leaderboard" label="Leaderboard" />
            {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                 <NavLinkItem to="/admin" label="Admin Panel" icon={<Shield className="w-4 h-4" />} />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
            
            {isAuthenticated && streak > 0 && (
              <div className="flex items-center gap-1.5 text-orange-500 dark:text-orange-400 font-bold bg-orange-500/10 dark:bg-orange-400/10 px-3 py-1.5 rounded-full">
                <Flame className="w-5 h-5 fill-current" />
                <span className="text-sm">{streak}</span>
              </div>
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
                  <div className="absolute right-0 mt-2 w-48 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl shadow-lg py-2 border border-slate-200 dark:border-slate-700">
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
                    <div className="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                    <button
                      onClick={() => { logout(); setDropdownOpen(false); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
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

const DropdownLink = ({ to, onClick, icon, label }: { to: string, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300"
    >
      {icon}
      {label}
    </Link>
)

