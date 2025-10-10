import { createContext, useContext, useState, ReactNode, useEffect, Dispatch, SetStateAction } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  deleteUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../data/mockData';

interface AuthContextType {
  user: FirebaseUser | null;
  userInfo: User | null;
  setUserInfo: Dispatch<SetStateAction<User | null>>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserInfo(userDocSnap.data() as User);
        }
      } else {
        setUserInfo(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (name: string, username: string, email: string, password: string) => {
    const saneUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (saneUsername.length < 3) {
      throw new Error('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
    }
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', saneUsername));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new Error('Username already exists. Please choose another one.');
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser: User = {
      uid: userCredential.user.uid,
      name,
      username: saneUsername,
      email: email,
      joined: new Date().toISOString(),
      stats: {
        attempted: 0,
        correct: 0,
        accuracy: 0
      },
      avatar: userCredential.user.photoURL || '/user.png',
      role: 'user',
      needsSetup: false,
    };
    await setDoc(doc(db, 'users', newUser.uid), newUser);
    setUserInfo(newUser);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      const newUser: User = {
        uid: user.uid,
        name: user.displayName || 'New User',
        username: `user_${user.uid.slice(-6)}`,
        email: user.email || '',
        joined: new Date().toISOString(),
        stats: {
          attempted: 0,
          correct: 0,
          accuracy: 0,
        },
        avatar: user.photoURL || '/user.png',
        role: 'user',
        needsSetup: true
      };
      await setDoc(userDocRef, newUser);
      setUserInfo(newUser);
    } else {
        setUserInfo(userDocSnap.data() as User);
    }
  };

  const logout = () => {
    signOut(auth);
  };

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No user is currently signed in.");
    }
    
    try {
      // Delete user document from Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(userDocRef);

      // Delete the user from Firebase Auth
      await deleteUser(currentUser);
      
      setUserInfo(null);
      setUser(null);

    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  };


  return (
    <AuthContext.Provider value={{
      user,
      userInfo,
      setUserInfo,
      login,
      signup,
      loginWithGoogle,
      logout,
      deleteAccount,
      isAuthenticated: !!user,
      loading
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

