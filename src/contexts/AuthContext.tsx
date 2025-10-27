import { createContext, useContext, useState, ReactNode, useEffect, Dispatch, SetStateAction } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  deleteUser,
  sendEmailVerification, // Import sendEmailVerification
  updateProfile // Import updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, orderBy } from 'firebase/firestore';
// Correct the import path for firebase
import { auth, db } from '../firebase.ts';
import { User, Submission } from '../data/mockData';

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
  streak: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Only fetch user info if email is verified for email/password users
        // Google users are considered verified by default through the provider
        if (currentUser.providerData.some(p => p.providerId === 'google.com') || currentUser.emailVerified) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserInfo(userDocSnap.data() as User);
          } else {
             // Handle case where Firestore doc might be missing for a verified user (e.g., deleted manually)
             console.warn("User document not found in Firestore for verified user:", currentUser.uid);
             setUserInfo(null); // Or attempt to recreate it
          }
        } else {
          // If email/password user exists but email is not verified, don't set userInfo
          console.log("User email not verified:", currentUser.email);
          setUserInfo(null);
          // Optional: You could trigger a re-send verification email UI here if needed
        }
      } else {
        setUserInfo(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Recalculate streak when userInfo changes (after login/verification)
   useEffect(() => {
    const calculateStreak = async () => {
      if (user && userInfo) { // Only calculate if both user and userInfo are available
        try {
          const submissionsQuery = query(
            collection(db, `users/${user.uid}/submissions`),
            orderBy('timestamp', 'desc')
          );
          const submissionsSnapshot = await getDocs(submissionsQuery);
          const submissionsData = submissionsSnapshot.docs.map(doc => doc.data() as Submission);

          let currentStreak = 0;
          if (submissionsData.length > 0) {
              const submissionDates = [...new Set(submissionsData.map(s => new Date(s.timestamp).toDateString()))]
                  .map(dateStr => new Date(dateStr))
                  .filter(d => !isNaN(d.getTime())) // Filter invalid dates
                  .sort((a, b) => b.getTime() - a.getTime()); // Sort most recent first

              if (submissionDates.length > 0) {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

                  // Check if most recent submission was today or yesterday
                  const isToday = submissionDates[0].getTime() === today.getTime();
                  const isYesterday = submissionDates[0].getTime() === yesterday.getTime();

                  if (isToday || isYesterday) {
                      currentStreak = 1; // Start streak if active today/yesterday
                      // Iterate through older dates to extend streak
                      for (let i = 0; i < submissionDates.length - 1; i++) {
                          const diffDays = (submissionDates[i].getTime() - submissionDates[i+1].getTime()) / (1000 * 3600 * 24);
                          if (diffDays === 1) { // If consecutive days
                              currentStreak++;
                          } else if (diffDays > 1) { // If gap larger than 1 day
                              break; // Streak broken
                          }
                          // Ignore if diffDays <= 0 (same day submissions)
                      }
                  }
              }
          }
          setStreak(currentStreak);
        } catch (error) {
          console.error("Failed to calculate streak:", error);
          setStreak(0);
        }
      } else {
        setStreak(0); // Reset streak if user logs out or userInfo is not loaded
      }
    };

    calculateStreak();
  }, [user, userInfo]); // Depend on user and userInfo

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Check if email is verified after successful sign-in
    if (!userCredential.user.emailVerified) {
       // Log out the user immediately if email is not verified
      await signOut(auth);
      // Throw a specific error to be caught in the UI
      throw new Error('auth/email-not-verified');
    }
     // If verified, onAuthStateChanged will handle setting user and userInfo
  };

  const signup = async (name: string, username: string, email: string, password: string) => {
    // --- Username validation ---
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

    // --- Create user account ---
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // --- Send verification email ---
    try {
      await sendEmailVerification(firebaseUser);
       console.log("Verification email sent to:", firebaseUser.email);
    } catch (error) {
        console.error("Error sending verification email:", error);
        // Decide how to handle this - maybe delete the user or just log the error?
        // For now, let's log and continue, but inform the user potentially.
        // If critical, you might want to delete the created user: await deleteUser(firebaseUser);
        throw new Error("Could not send verification email. Please try signing up again later.");
    }

     // --- Update Auth Profile (Display Name) ---
    try {
        await updateProfile(firebaseUser, { displayName: name });
    } catch (error) {
        console.error("Error updating auth profile display name:", error);
        // Non-critical, continue profile creation
    }


    // --- Create user document in Firestore ---
    const newUser: User = {
      uid: firebaseUser.uid,
      name,
      username: saneUsername,
      email: email,
      joined: new Date().toISOString(),
      stats: {
        attempted: 0,
        correct: 0,
        accuracy: 0
      },
      avatar: firebaseUser.photoURL || '/user.png',
      role: 'user',
      needsSetup: false, // User provided name/username during signup
    };
    try {
      await setDoc(doc(db, 'users', newUser.uid), newUser);
      // Don't set userInfo here, let onAuthStateChanged handle it after verification
      // setUserInfo(newUser);
    } catch (error) {
       console.error("Error creating user document in Firestore:", error);
       // Critical error - might want to delete the auth user if Firestore fails
       // await deleteUser(firebaseUser); // Consider this for consistency
       throw new Error("Failed to save user data. Please try signing up again.");
    }
    // Note: User is created but cannot log in until verified.
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const googleUser = userCredential.user; // Renamed to avoid conflict

    const userDocRef = doc(db, 'users', googleUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // --- Check if username needs generation (avoid collisions) ---
      let potentialUsername = googleUser.email ? googleUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) : `user_${googleUser.uid.slice(-6)}`;
      if (potentialUsername.length < 3) potentialUsername = `user_${googleUser.uid.slice(-6)}`; // Ensure min length

      // Check if generated username exists
      const usersRef = collection(db, 'users');
      let usernameExists = true;
      let finalUsername = potentialUsername;
      let counter = 1;
      while (usernameExists) {
        const q = query(usersRef, where('username', '==', finalUsername));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          usernameExists = false;
        } else {
          finalUsername = `${potentialUsername}_${counter++}`; // Append counter if exists
          if (finalUsername.length > 20) finalUsername = `user_${googleUser.uid.slice(-6)}_${counter-1}`; // Fallback if too long
        }
      }

      // --- Create user document ---
      const newUser: User = {
        uid: googleUser.uid,
        name: googleUser.displayName || 'New User',
        username: finalUsername,
        email: googleUser.email || '',
        joined: new Date().toISOString(),
        stats: {
          attempted: 0,
          correct: 0,
          accuracy: 0,
        },
        avatar: googleUser.photoURL || '/user.png',
        role: 'user',
        needsSetup: !googleUser.displayName, // Mark for setup if name is missing
      };
      await setDoc(userDocRef, newUser);
      // setUserInfo(newUser); // Let onAuthStateChanged handle this
    } else {
      // User exists, update avatar/name if changed? (Optional)
      const existingData = userDocSnap.data() as User;
      const updates: Partial<User> = {};
      if (googleUser.photoURL && existingData.avatar !== googleUser.photoURL) {
          updates.avatar = googleUser.photoURL;
      }
      if (googleUser.displayName && existingData.name !== googleUser.displayName) {
          updates.name = googleUser.displayName;
           // If name was missing, mark setup as complete if user didn't set it manually yet
          if (existingData.needsSetup) {
              updates.needsSetup = false;
          }
      }
      if (Object.keys(updates).length > 0) {
          await setDoc(userDocRef, updates, { merge: true });
      }
      // setUserInfo(userDocSnap.data() as User); // Let onAuthStateChanged handle this
    }
     // onAuthStateChanged will trigger and update user/userInfo state correctly
  };

  const logout = () => {
    signOut(auth);
    // State (user, userInfo, streak) will be cleared by onAuthStateChanged
  };

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No user is currently signed in.");
    }

    try {
      // 1. Delete Firestore user document
      const userDocRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(userDocRef);

      // 2. Delete associated submissions (Optional but recommended for cleanup)
      // This can be slow if there are many submissions. Consider a Cloud Function for large scale deletion.
      const submissionsQuery = query(collection(db, `users/${currentUser.uid}/submissions`));
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const deletePromises: Promise<void>[] = [];
      submissionsSnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, `users/${currentUser.uid}/submissions`, docSnap.id)));
      });
      await Promise.all(deletePromises);
      console.log(`Deleted ${deletePromises.length} submissions for user ${currentUser.uid}`);
      // Also delete userQuestionData if it exists
       const userQuestionDataQuery = query(collection(db, `users/${currentUser.uid}/userQuestionData`));
       const userQuestionDataSnapshot = await getDocs(userQuestionDataQuery);
       const deleteDataPromises: Promise<void>[] = [];
       userQuestionDataSnapshot.forEach((docSnap) => {
         deleteDataPromises.push(deleteDoc(doc(db, `users/${currentUser.uid}/userQuestionData`, docSnap.id)));
       });
       await Promise.all(deleteDataPromises);
       console.log(`Deleted ${deleteDataPromises.length} userQuestionData entries for user ${currentUser.uid}`);


      // 3. Delete Firebase Auth user
      await deleteUser(currentUser);

      // State is cleared automatically by onAuthStateChanged after deleteUser triggers it
      // setUserInfo(null);
      // setUser(null);

    } catch (error) {
      console.error("Error deleting account:", error);
      throw error; // Re-throw to handle in UI (e.g., prompt re-authentication)
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
      isAuthenticated: !!user && !!userInfo, // User is authenticated AND has profile info (implies verified for email/pass)
      loading,
      streak
    }}>
      {children} {/* Render children immediately, UI might show loader based on loading state */}
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

