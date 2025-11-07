import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, AtSign, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
// Correcting the import path again, adding the .tsx extension explicitly
import { useAuth } from '../contexts/AuthContext.tsx';
// --- REMOVED: useTheme no longer needed for logo ---


// Correct Google Icon SVG
const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.16H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.84l3.66-2.75z" fill="#FBBC05"/>
        <path d="M12 5.38c1.63 0 3.09.58 4.23 1.62l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.16l3.66 2.75c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        <path d="M1 1h22v22H1z" fill="none"/>
    </svg>
);

// Define different view modes
type AuthMode = 'login' | 'signup' | 'forgotPassword';

export function Login() {
    const navigate = useNavigate();
    const { login, signup, loginWithGoogle, resetPassword } = useAuth();
    // --- REMOVED: theme state no longer needed ---

    const [mode, setMode] = useState<AuthMode>('login');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showVerificationMessage, setShowVerificationMessage] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        password: ''
    });
    const [signupEmail, setSignupEmail] = useState('');
    const [resetEmail, setResetEmail] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
        setSuccessMessage('');
        setShowVerificationMessage(false);
    };

    const handleResetEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setResetEmail(e.target.value);
        setError('');
        setSuccessMessage('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setShowVerificationMessage(false);
        setLoading(true);

        try {
            if (mode === 'signup') {
                if (!formData.name.trim()) throw new Error('Full Name is required.');
                if (!formData.username.trim()) throw new Error('Username is required.');
                if (formData.username.length < 3) throw new Error('Username must be at least 3 characters.');
                if (!/^[a-z0-9_]+$/i.test(formData.username)) throw new Error('Username can only contain letters, numbers, and underscores.');
                if (formData.password.length < 6) throw new Error('Password must be at least 6 characters.');

                const currentEmail = formData.email;
                await signup(formData.name, formData.username, currentEmail, formData.password);

                setSignupEmail(currentEmail);
                setShowVerificationMessage(true);
                setMode('login');
                setFormData({ name: '', username: '', email: '', password: '' });

            } else if (mode === 'login') {
                await login(formData.email, formData.password);
                navigate('/');

            } else if (mode === 'forgotPassword') {
                if (!resetEmail.trim()) throw new Error('Please enter your email address.');
                await resetPassword(resetEmail);
                setSuccessMessage('Password reset email sent! Check your inbox (and spam folder).');
                setResetEmail('');
            }
        } catch (err: any) {
            console.error("Authentication Error:", err);
            if (mode === 'signup') {
                if (err.code === 'auth/email-already-in-use') {
                    setError('This email is already registered. Please sign in or use a different email.');
                } else {
                    setError(err.message || 'Signup failed. Please try again.');
                }
            } else if (mode === 'login') {
                if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                    setError('Invalid email or password. Please try again.');
                } else if (err.message === 'auth/email-not-verified') {
                    setError('Please verify your email address. Check your inbox (and spam folder) for the verification link.');
                } else {
                    setError(err.message || 'Login failed. Please try again.');
                }
            } else if (mode === 'forgotPassword') {
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
                    setError('Could not find an account with that email address.');
                } else {
                    setError(err.message || 'Failed to send password reset email. Please try again.');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setSuccessMessage('');
        setShowVerificationMessage(false);
        setGoogleLoading(true);
        try {
            await loginWithGoogle();
            navigate('/');
        } catch (err: any) {
            console.error("Google Sign-in Error:", err);
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Google sign-in cancelled.');
            } else if (err.code === 'auth/account-exists-with-different-credential') {
                setError('An account already exists with this email address using a different sign-in method.');
            } else {
                setError(err.message || 'Google sign-in failed. Please try again.');
            }
        } finally {
            setGoogleLoading(false);
        }
    };

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setError('');
        setSuccessMessage('');
        setShowVerificationMessage(false);
        setFormData({ name: '', username: '', email: '', password: '' });
        setResetEmail('');
    };

    let title = 'Welcome Back';
    let subTitle = 'Continue your learning progress';
    if (mode === 'signup') {
        title = 'Create Account';
        subTitle = 'Start your GATE preparation journey';
    } else if (mode === 'forgotPassword') {
        title = 'Reset Password';
        subTitle = 'Enter your email to receive a reset link';
    }

    // Define reusable Tailwind classes
    const inputFieldClasses = "w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm";
    const submitButtonClasses = "w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg";
    const googleButtonClasses = "w-full py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow";
    const toggleLinkClasses = "text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none";

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-50 dark:from-gray-900 dark:via-gray-950 dark:to-black flex items-center justify-center p-4 selection:bg-blue-200 dark:selection:bg-blue-900">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2 transition-transform duration-200 hover:scale-105">
                        {/* --- UPDATED LOGO --- */}
                        <img 
                          src="/logo.png" 
                          alt="GATECode Logo" 
                          className="w-12 h-12"
                        />
                        {/* --- END UPDATED LOGO --- */}
                        <span>GATECode</span>
                    </Link>
                    <p className="text-gray-600 dark:text-gray-400">Master GATE ECE preparation</p>
                </div>

                {/* Main Auth Card */}
                <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700/50 p-6 md:p-8 backdrop-blur-sm">
                    {/* Title and Subtitle */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{title}</h2>
                        {!showVerificationMessage && !successMessage && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{subTitle}</p>
                        )}
                    </div>

                    {/* Messages */}
                    {showVerificationMessage && (
                         <div className="mb-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/50 rounded-lg p-4 text-center">
                            {/* ... verification message content ... */}
                            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-1">Verification Email Sent!</h3>
                            <p className="text-sm text-green-700 dark:text-green-300">
                                Please check your inbox at <span className="font-medium">{signupEmail}</span> and click the verification link.
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                (If you don't see it, please check your spam or junk folder).
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-3">
                                Then, you can sign in below.
                            </p>
                        </div>
                    )}
                    {successMessage && mode === 'forgotPassword' && (
                        <div className="mb-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/50 rounded-lg p-4 flex items-start gap-2">
                             <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                             <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
                         </div>
                    )}
                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Main Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <>
                                {/* Full Name */}
                                <div>
                                    <label className="sr-only" htmlFor="name">Full Name</label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                                        <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className={inputFieldClasses} placeholder="Full Name" required aria-label="Full Name" />
                                    </div>
                                </div>
                                {/* Username */}
                                <div>
                                    <label className="sr-only" htmlFor="username">Username</label>
                                    <div className="relative">
                                        <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                                        <input type="text" id="username" name="username" value={formData.username} onChange={handleInputChange} className={inputFieldClasses} placeholder="Username (letters, numbers, _)" required aria-label="Username" pattern="^[a-zA-Z0-9_]{3,}$" title="Username must be at least 3 characters and contain only letters, numbers, or underscores." />
                                    </div>
                                </div>
                            </>
                        )}

                        {mode !== 'forgotPassword' && (
                            <div>
                                <label className="sr-only" htmlFor="email">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                                    <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className={inputFieldClasses} placeholder="Email Address" required aria-label="Email Address" />
                                </div>
                            </div>
                        )}

                        {mode !== 'forgotPassword' && (
                            <div>
                                <label className="sr-only" htmlFor="password">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                                    <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange} className={inputFieldClasses} placeholder="Password (min. 6 characters)" required minLength={6} aria-label="Password" />
                                </div>
                                {mode === 'login' && (
                                    <div className="text-right mt-1.5">
                                        <button type="button" onClick={() => switchMode('forgotPassword')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none">
                                            Forgot Password?
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === 'forgotPassword' && (
                             <div>
                                <label className="sr-only" htmlFor="resetEmail">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                                    <input type="email" id="resetEmail" name="resetEmail" value={resetEmail} onChange={handleResetEmailChange} className={inputFieldClasses} placeholder="Enter your account email" required aria-label="Email Address for password reset" />
                                </div>
                             </div>
                        )}

                        {/* Submit Button */}
                        <button type="submit" disabled={loading || googleLoading} className={submitButtonClasses}>
                            {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>Processing...</span></>)
                                : mode === 'signup' ? 'Create Account'
                                : mode === 'login' ? 'Sign In'
                                : 'Send Reset Link'
                            }
                        </button>
                    </form>

                    {/* Divider and Google Button */}
                    {mode !== 'forgotPassword' && (
                        <>
                            <div className="my-6 flex items-center">
                                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                                <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">Or continue with</span>
                                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                            </div>
                            <button onClick={handleGoogleLogin} disabled={loading || googleLoading} className={googleButtonClasses}>
                                {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon/>}
                                <span className="text-sm">{mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
                            </button>
                        </>
                    )}

                    {/* Toggle Links */}
                    <div className="mt-6 text-center">
                        {mode === 'login' && (
                            <button onClick={() => switchMode('signup')} className={toggleLinkClasses}>
                                Don't have an account? Sign up
                            </button>
                        )}
                        {mode === 'signup' && (
                            <button onClick={() => switchMode('login')} className={toggleLinkClasses}>
                                Already have an account? Sign in
                            </button>
                        )}
                         {mode === 'forgotPassword' && (
                             <button onClick={() => switchMode('login')} className={`${toggleLinkClasses} inline-flex items-center gap-1`}>
                                <ArrowLeft className="w-4 h-4" /> Back to Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}