import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../data/mockData';

interface AuthContextType {
  user: FirebaseUser | null;
  userInfo: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
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
        // Fetch user profile from Firestore
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

  const signup = async (name: string, email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser: User = {
      uid: userCredential.user.uid,
      name,
      email: email, // Use the provided email
      joined: new Date().toISOString(),
      stats: {
        attempted: 0,
        correct: 0,
        accuracy: 0
      },
      avatar: userCredential.user.photoURL || ''
    };
    // Save user data to Firestore
    await setDoc(doc(db, 'users', newUser.uid), newUser);
    setUserInfo(newUser);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Check if user already exists in Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // If user is new, create a new document in Firestore
      const newUser: User = {
        uid: user.uid,
        name: user.displayName || 'Anonymous',
        email: user.email || '',
        joined: new Date().toISOString(),
        stats: {
          attempted: 0,
          correct: 0,
          accuracy: 0,
        },
        avatar: user.photoURL || ''
      };
      await setDoc(userDocRef, newUser);
      setUserInfo(newUser);
    }
  };


  const logout = () => {
    signOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userInfo,
      login,
      signup,
      loginWithGoogle,
      logout,
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
