import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Code2, Mail, Lock, User as UserIcon, AtSign, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-.83 0-1.5.67-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z" fill="#4285F4"/>
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-.83 0-1.5.67-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z" fill="url(#paint0_linear_90_3)"/>
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-.83 0-1.5.67-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z" fill="url(#paint1_linear_90_3)"/>
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-.83 0-1.5.67-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z" fill="url(#paint2_linear_90_3)"/>
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-.83 0-1.5.67-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z" fill="url(#paint3_linear_90_3)"/>
        <defs>
        <linearGradient id="paint0_linear_90_3" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#4285F4"/><stop offset="1" stopColor="#34A853"/></linearGradient>
        <linearGradient id="paint1_linear_90_3" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#FBBC05"/><stop offset="1" stopColor="#EA4335"/></linearGradient>
        <linearGradient id="paint2_linear_90_3" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#34A853"/><stop offset="1" stopColor="#4285F4"/></linearGradient>
        <linearGradient id="paint3_linear_90_3" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#EA4335"/><stop offset="1" stopColor="#FBBC05"/></linearGradient>
        </defs>
    </svg>
);


export function Login() {
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: ''
  });

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        if (!formData.name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        if (!formData.username.trim()) {
            setError('Username is required');
            setLoading(false);
            return;
        }
        await signup(formData.name, formData.username, formData.email, formData.password);
      } else {
        await login(formData.email, formData.password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            <Code2 className="w-8 h-8" />
            <span>GATECode</span>
          </Link>
          <p className="text-gray-600 dark:text-gray-400">
            Master GATE ECE preparation
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {isSignup
                ? 'Start your GATE preparation journey'
                : 'Continue your learning progress'}
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Enter your name"
                    required={isSignup}
                  />
                </div>
              </div>
            )}
            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Choose a unique username"
                    required={isSignup}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
            <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400 text-sm">OR</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon/>}
            <span>Sign in with Google</span>
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isSignup
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
