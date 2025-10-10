import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, updateProfile } from 'firebase/auth';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { user, userInfo, setUserInfo, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const needsSetup = userInfo?.needsSetup;

  useEffect(() => {
    if (userInfo) {
      setDisplayName(userInfo.name || '');
      setUsername(userInfo.username || '');
    }
  }, [userInfo]);

  // Debounced username check
  useEffect(() => {
    const checkUsername = async () => {
        if (!username || (userInfo && username === userInfo.username)) {
            setUsernameAvailable(true);
            return;
        }
        setUsernameLoading(true);
        const saneUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (saneUsername.length < 3) {
            setUsernameAvailable(false);
            setUsernameLoading(false);
            return
        }
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', saneUsername));
        const querySnapshot = await getDocs(q);
        setUsernameAvailable(querySnapshot.empty);
        setUsernameLoading(false);
    };

    const handler = setTimeout(() => {
        checkUsername();
    }, 500);

    return () => {
        clearTimeout(handler);
    };
  }, [username, userInfo?.username]);

  const handleSave = async () => {
    if (!user || !userInfo) return;
     if (!usernameAvailable || username.length < 3) {
        setError("Username is not available or is too short (min 3 chars, letters, numbers, _).");
        return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const saneUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name: displayName,
        username: saneUsername,
        needsSetup: false,
      });

      const auth = getAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName,
        });
      }

      if (setUserInfo) {
        setUserInfo(prev => prev ? { ...prev, name: displayName, username: saneUsername, needsSetup: false } : null);
      }
      
      setSuccess('Profile updated successfully!');
       if (needsSetup) {
        setTimeout(() => navigate('/'), 1500);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userInfo) return;

    const confirmation = window.confirm(
      'Are you sure you want to delete your account? This action is irreversible and will delete all your data.'
    );

    if (confirmation) {
      setIsDeleting(true);
      setError('');
      try {
        await deleteAccount();
        navigate('/login');
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          setError('This is a sensitive operation. Please log out and log back in before deleting your account.');
        } else {
          setError('Failed to delete account. Please try again.');
        }
        setIsDeleting(false);
      }
    }
  };

  if (!userInfo) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!needsSetup && (
            <button onClick={() => navigate(userInfo?.username ? `/profile/${userInfo.username}` : '/')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6">
                <ArrowLeft className="w-5 h-5" />
                Back to Profile
            </button>
        )}
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Profile Settings</h1>
        
        {needsSetup && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
                <strong className="font-bold">Welcome!</strong>
                <span className="block sm:inline"> Please complete your profile to continue. A unique username is required.</span>
            </div>
        )}

        <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-md space-y-6 border border-gray-200 dark:border-gray-800">
          
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <img 
                src={userInfo.avatar || '/user.png'}
                alt="Avatar" 
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
            <input 
              type="text" 
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <input 
              type="text" 
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
            />
             <div className="mt-2 text-xs text-gray-500 h-4">
                {usernameLoading ? (
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Checking...</span>
                ) : username !== userInfo?.username && (
                    username.length >= 3 ? (
                        usernameAvailable ? (
                           <span className="text-green-500">@{username} is available!</span>
                        ) : (
                           <span className="text-red-500">@{username} is already taken.</span>
                        )
                    ) : (
                         <span className="text-red-500">Must be at least 3 characters.</span>
                    )
                )}
             </div>
             <p className="mt-2 text-xs text-gray-500">Allowed characters: letters, numbers, and underscores.</p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input 
              type="email" 
              id="email"
              value={userInfo.email}
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 text-gray-500"
            />
             <p className="mt-2 text-xs text-gray-500">Email address cannot be changed.</p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}

          <button 
            onClick={handleSave}
            disabled={loading || usernameLoading || !usernameAvailable}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5"/>}
            Save Changes
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-red-200 dark:border-red-900/50">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Deleting your account is permanent and cannot be undone. All your practice history and stats will be lost.
          </p>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="mt-4 w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-red-400 flex items-center justify-center gap-2"
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

