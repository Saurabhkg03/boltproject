import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Code2, LogOut, User, Shield, Settings, ChevronDown, Flame, Bell, CheckCircle, X } from 'lucide-react';
// Corrected import paths relative to src/components/
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useDailyChallenge } from '../contexts/DailyChallengeContext';
import { useState, useRef, useEffect } from 'react';
import React from 'react';

// --- Notification Structure ---
interface AppNotification {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    link?: string;
}

// --- Hardcoded Notifications ---
const hardcodedNotifications: AppNotification[] = [
    {
        id: 'welcome-20251027',
        title: 'Welcome to GATECode!',
        message: 'Start practicing today to ace your GATE ECE preparation. Good luck!',
        timestamp: '2025-10-27T10:00:00Z',
        link: '/practice'
    },
    {
        id: 'new-feature-rating-20251026',
        title: 'New Feature: Performance Rating',
        message: 'Check out the updated leaderboard ranking based on our new performance rating system!',
        timestamp: '2025-10-26T15:30:00Z',
        link: '/leaderboard'
    },
    // --- ADD MORE NOTIFICATIONS BELOW ---
    // {
    //     id: 'unique-id-here',
    //     title: 'Your Notification Title',
    //     message: 'Your detailed message for the user.',
    //     timestamp: 'YYYY-MM-DDTHH:mm:ssZ',
    //     link: '/optional-link'
    // },
    // --- END OF NOTIFICATIONS ---
];

// --- LocalStorage Key for Read Status ---
const LAST_READ_NOTIFICATIONS_KEY = 'gatecode_last_read_notifications';

// --- Navbar Component ---
export function Navbar() {
    const { theme, toggleTheme } = useTheme();
    const { userInfo, logout, isAuthenticated, streak } = useAuth();
    const { dailyChallengeId, loadingChallenge } = useDailyChallenge();

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const notificationsPanelRef = useRef<HTMLDivElement>(null);
    const notificationsButtonRef = useRef<HTMLButtonElement>(null);

    const location = useLocation();

    // --- Notification Logic ---
    useEffect(() => {
        if (!isAuthenticated) {
             setHasUnreadNotifications(false);
             return;
        }
        try {
            const lastReadTimestamp = localStorage.getItem(LAST_READ_NOTIFICATIONS_KEY);
            const lastReadDate = lastReadTimestamp ? new Date(lastReadTimestamp) : new Date(0);
            const unread = hardcodedNotifications.some( (notif) => new Date(notif.timestamp) > lastReadDate );
            setHasUnreadNotifications(unread);
        } catch (error) {
            console.error("Error checking notification read status:", error);
            setHasUnreadNotifications(false);
        }
    }, [isAuthenticated, userInfo]);


    const handleNotificationsToggle = () => {
        const currentlyOpening = !isNotificationsOpen;
        setIsNotificationsOpen(currentlyOpening);
        setDropdownOpen(false); // Close user dropdown

        if (currentlyOpening && isAuthenticated) {
            try {
                localStorage.setItem(LAST_READ_NOTIFICATIONS_KEY, new Date().toISOString());
                setHasUnreadNotifications(false);
            } catch (error) {
                console.error("Error updating last read notification timestamp:", error);
            }
        }
    };


    // --- Click Outside Handlers ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Close User Dropdown
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
            // Close Notifications Panel
             if (notificationsPanelRef.current && !notificationsPanelRef.current.contains(event.target as Node) &&
                 notificationsButtonRef.current && !notificationsButtonRef.current.contains(event.target as Node))
            {
                 const mobileNotificationsButton = document.querySelector('[aria-label="Mobile Notifications"]');
                 if (!mobileNotificationsButton || !mobileNotificationsButton.contains(event.target as Node)) {
                     setIsNotificationsOpen(false);
                 }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Close dropdowns on route change
    useEffect(() => {
        setDropdownOpen(false);
        setIsNotificationsOpen(false);
    }, [location]);


    return (
        // Removed z-index from nav itself
        <nav className="sticky top-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg border-b border-white/30 dark:border-slate-800/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-800 dark:text-white">
                        <Code2 className="w-6 h-6 text-blue-500" />
                        <span>GATECode</span>
                    </Link>

                    {/* Desktop Nav Links */}
                    <div className="hidden md:flex items-center gap-2">
                        <NavLinkItem to="/" label="Home" />
                        <NavLinkItem to="/practice" label="Practice" />
                        <NavLinkItem to="/leaderboard" label="Leaderboard" />
                        {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && (
                            <NavLinkItem to="/admin" label="Admin Panel" icon={<Shield className="w-4 h-4" />} />
                        )}
                    </div>

                    {/* Right Side Icons/Buttons */}
                    <div className="flex items-center gap-3 md:gap-4">

                        {/* Streak Indicator */}
                        {isAuthenticated && streak > 0 && (
                            <Link
                                to={!loadingChallenge && dailyChallengeId ? `/question/${dailyChallengeId}` : '/practice'}
                                className={`flex items-center gap-1.5 text-orange-500 dark:text-orange-400 font-bold bg-orange-500/10 dark:bg-orange-400/10 px-3 py-1.5 rounded-full transition-colors ${!loadingChallenge && dailyChallengeId ? 'hover:bg-orange-500/20 dark:hover:bg-orange-400/20 cursor-pointer' : 'cursor-default'}`}
                                title={!loadingChallenge && dailyChallengeId ? "Go to Daily Challenge" : "Practice Questions"}
                            >
                                <Flame className="w-5 h-5 fill-current" />
                                <span className="text-sm">{streak}</span>
                            </Link>
                        )}

                        {/* Notifications Button (Desktop) */}
                        {isAuthenticated && (
                            // Removed z-index from this container
                             <div className="relative hidden md:block">
                                <button
                                    ref={notificationsButtonRef}
                                    onClick={handleNotificationsToggle}
                                    className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors relative"
                                    aria-label="Notifications"
                                >
                                    <Bell className="w-5 h-5" />
                                    {hasUnreadNotifications && (
                                        <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900/60"></span>
                                    )}
                                </button>
                                {/* Panel retains its z-index */}
                                <NotificationsPanel
                                    ref={notificationsPanelRef}
                                    isOpen={isNotificationsOpen}
                                    notifications={hardcodedNotifications}
                                    onClose={() => setIsNotificationsOpen(false)}
                                />
                            </div>
                        )}


                        {/* User Menu / Login Button */}
                        {isAuthenticated && userInfo ? (
                             // Removed z-index from this container
                            <div className="relative" ref={dropdownRef}>
                                <button onClick={() => { setDropdownOpen(!dropdownOpen); setIsNotificationsOpen(false); }} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <img src={userInfo.avatar || '/user.png'} alt={userInfo.name} className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 group-hover:border-blue-500 transition-colors" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden lg:block pr-1">{userInfo.name}</span>
                                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {/* User Dropdown Panel - Retains its z-index */}
                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-lg py-2 border border-slate-200 dark:border-slate-700 z-[70]">
                                        {/* Mobile-Only Dropdown */}
                                        <div className="md:hidden">
                                            <DropdownLink to="/" onClick={() => setDropdownOpen(false)} label="Home" />
                                            <DropdownLink to="/practice" onClick={() => setDropdownOpen(false)} label="Practice" />
                                            <DropdownLink to="/leaderboard" onClick={() => setDropdownOpen(false)} label="Leaderboard" />
                                             <DropdownButton
                                                onClick={handleNotificationsToggle}
                                                icon={<Bell className="w-4 h-4" />}
                                                label="Notifications"
                                                badge={hasUnreadNotifications}
                                                aria-label="Mobile Notifications"
                                             />
                                             {(userInfo?.role === 'admin' || userInfo?.role === 'moderator') && ( <DropdownLink to="/admin" onClick={() => setDropdownOpen(false)} icon={<Shield className="w-4 h-4" />} label="Admin Panel" /> )}
                                            <div className="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                            <DropdownLink to={userInfo.username ? `/profile/${userInfo.username}` : '#'} onClick={() => setDropdownOpen(false)} icon={<User className="w-4 h-4" />} label="My Profile" />
                                            <DropdownLink to="/settings" onClick={() => setDropdownOpen(false)} icon={<Settings className="w-4 h-4" />} label="Settings" />
                                            <DropdownButton onClick={toggleTheme} icon={theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} label={theme === 'light' ? 'Dark Mode' : 'Light Mode'} />
                                            <div className="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                            <button onClick={() => { logout(); setDropdownOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md mx-2"> <LogOut className="w-4 h-4" /> Logout </button>
                                        </div>
                                        {/* Desktop-Only Dropdown */}
                                        <div className="hidden md:block">
                                            <DropdownLink to={userInfo.username ? `/profile/${userInfo.username}` : '#'} onClick={() => setDropdownOpen(false)} icon={<User className="w-4 h-4" />} label="My Profile" />
                                            <DropdownLink to="/settings" onClick={() => setDropdownOpen(false)} icon={<Settings className="w-4 h-4" />} label="Settings" />
                                            <DropdownButton onClick={toggleTheme} icon={theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} label={theme === 'light' ? 'Dark Mode' : 'Light Mode'} />
                                            <div className="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                            <button onClick={() => { logout(); setDropdownOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md mx-2"> <LogOut className="w-4 h-4" /> Logout </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link to="/login" className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm hover:shadow-md" >
                                Login / Sign Up
                            </Link>
                        )}

                        {/* Theme Toggle */}
                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} >
                            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>
             {/* Mobile Notifications Panel (Keep z-80) */}
             {isAuthenticated && (
                 <NotificationsPanel
                    ref={notificationsPanelRef}
                    isOpen={isNotificationsOpen}
                    notifications={hardcodedNotifications}
                    onClose={() => setIsNotificationsOpen(false)}
                    isMobile={true}
                 />
            )}
        </nav>
    );
}


// --- Sub Components ---
const NavLinkItem = ({ to, label, icon }: { to: string, label: string, icon?: React.ReactNode }) => { const location = useLocation(); const isActive = location.pathname === to; return ( <Link to={to} className={`flex items-center gap-2 text-sm font-medium transition-all duration-200 px-3 py-2 rounded-full ${isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}`} > {icon}{label} </Link> ) }
const DropdownLink = ({ to, onClick, icon, label }: { to: string, onClick?: () => void, icon?: React.ReactNode, label: string }) => ( <Link to={to} onClick={onClick} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300 rounded-md mx-2 whitespace-nowrap" > {icon}{label} </Link> )
const DropdownButton = ({ onClick, icon, label, badge, ...props }: { onClick: () => void, icon: React.ReactNode, label: string, badge?: boolean, 'aria-label'?: string }) => ( <button onClick={onClick} className="w-full text-left flex items-center justify-between gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300 rounded-md mx-2 whitespace-nowrap" {...props} > <span className="flex items-center gap-3">{icon}{label}</span> {badge && <span className="block h-2 w-2 rounded-full bg-red-500"></span>} </button> )


// --- Notifications Panel Component ---
// (Keep z-index values on the panel itself)
const NotificationsPanel = React.forwardRef<HTMLDivElement, { isOpen: boolean; notifications: AppNotification[]; onClose: () => void; isMobile?: boolean }>(
    ({ isOpen, notifications, onClose, isMobile = false }, ref) => {
    if (!isOpen) return null;

    const sortedNotifications = [...notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const timeAgo = (timestamp: string): string => {
        const now = new Date(); const past = new Date(timestamp); const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000); const diffInMinutes = Math.floor(diffInSeconds / 60); const diffInHours = Math.floor(diffInMinutes / 60); const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays > 1) return `${diffInDays}d ago`; if (diffInDays === 1) return `1d ago`; if (diffInHours > 1) return `${diffInHours}h ago`; if (diffInHours === 1) return `1h ago`; if (diffInMinutes > 1) return `${diffInMinutes}m ago`; if (diffInMinutes === 1) return `1m ago`; return `just now`;
    };

    // Keep high z-index values here
    const panelClasses = isMobile
        ? "fixed inset-x-0 bottom-0 z-[80] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg rounded-t-xl p-4 max-h-[60vh] overflow-y-auto"
        : "absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-[70] max-h-[70vh] overflow-y-auto";

    return (
        <div ref={ref} className={panelClasses}>
            <div className="flex justify-between items-center mb-3 px-2 pt-1">
                <h3 className="text-base font-semibold text-slate-800 dark:text-white">Notifications</h3>
                 {isMobile && ( <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"> <X className="w-5 h-5" /> </button> )}
            </div>
            {sortedNotifications.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6 px-2">No new notifications.</p>
            ) : (
                <div className="space-y-2">
                    {sortedNotifications.map((notif) => (
                        <div key={notif.id} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg group" >
                             <Link to={notif.link || '#'} onClick={onClose} className={notif.link ? 'block cursor-pointer' : 'block pointer-events-none'} >
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{notif.title}</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 pt-0.5">{timeAgo(notif.timestamp)}</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300">{notif.message}</p>
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
NotificationsPanel.displayName = 'NotificationsPanel';

