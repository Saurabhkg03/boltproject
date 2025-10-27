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
  updateProfile,         // Import updateProfile
  sendPasswordResetEmail // Import sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, orderBy, writeBatch } from 'firebase/firestore'; // Added writeBatch
// Attempting to fix import path by removing extension
import { auth, db } from '../firebase';
import { User, Submission, UserQuestionData } from '../data/mockData';

interface AuthContextType {
  user: FirebaseUser | null;
  userInfo: User | null;
  setUserInfo: Dispatch<SetStateAction<User | null>>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>; // Added resetPassword
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
        console.log("Auth State Changed:", currentUser ? `UID: ${currentUser.uid}, Verified: ${currentUser.emailVerified}` : 'No User');
        setUser(currentUser);
        if (currentUser) {
            // Check if email verified OR if it's a Google Sign-in
            const isGoogleProvider = currentUser.providerData.some(provider => provider.providerId === GoogleAuthProvider.PROVIDER_ID);
            if (currentUser.emailVerified || isGoogleProvider) {
                try {
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        console.log("User data found in Firestore:", userDocSnap.data());
                        setUserInfo(userDocSnap.data() as User);
                    } else if (isGoogleProvider) {
                         // Handle case where Google user exists in Auth but not Firestore (might happen on first login with existing Auth account)
                        console.log("Google user exists in Auth but not Firestore. Creating Firestore doc.");
                        const newUser: User = {
                            uid: currentUser.uid,
                            name: currentUser.displayName || 'New User',
                            username: `user_${currentUser.uid.slice(-6)}`, // Temporary username
                            email: currentUser.email || '',
                            joined: new Date().toISOString(),
                            stats: { attempted: 0, correct: 0, accuracy: 0 },
                            avatar: currentUser.photoURL || '/user.png',
                            role: 'user',
                            needsSetup: !currentUser.displayName // Needs setup if no display name from Google
                        };
                         await setDoc(userDocRef, newUser);
                         setUserInfo(newUser);
                    } else {
                        console.log("User exists in Auth but not Firestore and is not Google provider. UserInfo not set.");
                        setUserInfo(null); // Explicitly set to null if Firestore doc doesn't exist for non-Google users
                    }
                } catch (error) {
                    console.error("Error fetching user data from Firestore:", error);
                    setUserInfo(null); // Clear userInfo on error
                }
            } else {
                 console.log("User email not verified. UserInfo not set.");
                 setUserInfo(null); // Clear userInfo if email is not verified (for email/password users)
            }
        } else {
            setUserInfo(null); // Clear userInfo if no user
        }
        setLoading(false);
    });
    return unsubscribe;
  }, []); // Run only once on mount

   useEffect(() => {
    const calculateStreak = async () => {
      // Calculate streak only if we have a valid user and userInfo
      if (user && userInfo) {
        try {
          // ... (streak calculation logic remains the same) ...
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

                  const isToday = submissionDates[0].getTime() === today.getTime();
                  const isYesterday = submissionDates[0].getTime() === yesterday.getTime();

                  if (isToday || isYesterday) {
                      currentStreak = 1;
                      for (let i = 0; i < submissionDates.length - 1; i++) {
                          const diff = (submissionDates[i].getTime() - submissionDates[i+1].getTime()) / (1000 * 3600 * 24);
                          if (diff === 1) { // Check for exactly 1 day difference
                              currentStreak++;
                          } else if (diff > 1) { // Break if gap is larger than 1 day
                              break;
                          }
                          // Ignore if diff <= 0 (same day submissions)
                      }
                  }
              }
          }
          console.log("Calculated Streak:", currentStreak);
          setStreak(currentStreak);
        } catch (error) {
          console.error("Failed to calculate streak:", error);
          setStreak(0);
        }
      } else {
        setStreak(0); // Reset streak if no user or userInfo
      }
    };

    calculateStreak();
  }, [user, userInfo]); // Depend on both user and userInfo


  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Check verification status AFTER successful sign-in
    if (!userCredential.user.emailVerified) {
        // If not verified, sign the user out immediately and throw specific error
        await signOut(auth);
        console.log("Login attempt failed: Email not verified.");
        throw new Error('auth/email-not-verified'); // Throw specific error message
    }
     console.log("Login successful, email verified.");
     // No need to set user/userInfo here, onAuthStateChanged handles it
  };

  const signup = async (name: string, username: string, email: string, password: string) => {
    const saneUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (saneUsername.length < 3) {
      throw new Error('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
    }
    // Check if username exists
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', saneUsername));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new Error('Username already exists. Please choose another one.');
    }

    // Create user in Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("User created in Auth:", userCredential.user.uid);

     // --- Send verification email ---
    try {
        await sendEmailVerification(userCredential.user);
        console.log("Verification email sent to:", email);
    } catch (verificationError) {
         console.error("Error sending verification email:", verificationError);
         // Decide how to handle this - maybe delete the user or just inform them?
         // For now, let's proceed but maybe add a flag to the user doc later
         // Consider deleting the auth user if verification email fails critically
         // await deleteUser(userCredential.user); // Uncomment carefully
         // throw new Error("Could not send verification email. Please try signing up again.");
    }

    // --- Update Auth profile (Display Name) ---
     try {
         await updateProfile(userCredential.user, { displayName: name });
         console.log("Auth profile display name updated.");
     } catch (profileError) {
         console.error("Error updating Auth profile display name:", profileError);
         // Non-critical, proceed but log error
     }

    // --- Create user document in Firestore ---
    const newUser: User = {
      uid: userCredential.user.uid,
      name,
      username: saneUsername,
      email: email,
      joined: new Date().toISOString(),
      stats: { attempted: 0, correct: 0, accuracy: 0 },
      avatar: userCredential.user.photoURL || '/user.png',
      role: 'user',
      needsSetup: false, // Set to false as name/username are provided
    };
    await setDoc(doc(db, 'users', newUser.uid), newUser);
    console.log("User document created in Firestore for:", newUser.uid);

    // Don't setUserInfo here. Let onAuthStateChanged handle it after verification.
    // Sign the user out immediately after signup to force verification before login
    await signOut(auth);
    console.log("User signed out pending email verification.");
  };

   // --- Added resetPassword function ---
   const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
        console.log("Password reset email sent to:", email);
   };


  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const googleUser = userCredential.user;

    const userDocRef = doc(db, 'users', googleUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        console.log("Google Sign-in: First time user. Creating Firestore doc.");
        let usernameToSet = googleUser.email ? googleUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) : `user_${googleUser.uid.slice(-6)}`;
        if (usernameToSet.length < 3) usernameToSet = `user_${googleUser.uid.slice(-6)}`; // Ensure min length

        // Check if generated username exists
        let usernameExists = true;
        let finalUsername = usernameToSet;
        let counter = 1;
        while(usernameExists) {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', finalUsername));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                usernameExists = false;
            } else {
                finalUsername = `${usernameToSet}_${counter}`;
                counter++;
                console.log(`Username exists, trying: ${finalUsername}`);
            }
        }

        const newUser: User = {
            uid: googleUser.uid,
            name: googleUser.displayName || 'New User',
            username: finalUsername, // Use the unique username
            email: googleUser.email || '',
            joined: new Date().toISOString(),
            stats: { attempted: 0, correct: 0, accuracy: 0 },
            avatar: googleUser.photoURL || '/user.png',
            role: 'user',
            needsSetup: !googleUser.displayName // Needs setup if no display name from Google
        };
        await setDoc(userDocRef, newUser);
        // setUserInfo(newUser); // Let onAuthStateChanged handle this
        console.log("Firestore doc created for Google user:", newUser.uid);
    } else {
        console.log("Google Sign-in: Existing user. Firestore doc exists.");
        // setUserInfo(userDocSnap.data() as User); // Let onAuthStateChanged handle this
    }
     // No need to navigate here, onAuthStateChanged will trigger update and AppContent handles redirect if needed
  };

  const logout = () => {
    signOut(auth);
    console.log("User signed out.");
  };

  // Helper function to delete subcollections
  async function deleteCollection(collectionPath: string) {
    const q = query(collection(db, collectionPath));
    const snapshot = await getDocs(q);

    // Use chunks if the collection might be very large
    const MAX_WRITES_PER_BATCH = 500;
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnapshot of snapshot.docs) {
        batch.delete(docSnapshot.ref);
        count++;
        if (count === MAX_WRITES_PER_BATCH) {
            await batch.commit();
            batch = writeBatch(db); // Start a new batch
            count = 0;
        }
    }
    // Commit the remaining deletes
    if (count > 0) {
        await batch.commit();
    }
    console.log(`Deleted ${snapshot.size} documents from subcollection: ${collectionPath}`);
  }


  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No user is currently signed in.");
    }

    try {
        console.log("Attempting to delete account for user:", currentUser.uid);
        // 1. Delete Firestore subcollections first
        await deleteCollection(`users/${currentUser.uid}/submissions`);
        await deleteCollection(`users/${currentUser.uid}/userQuestionData`);

        // 2. Delete main user document
        const userDocRef = doc(db, 'users', currentUser.uid);
        await deleteDoc(userDocRef);
        console.log("Firestore user document and subcollections deleted.");

        // 3. Delete Auth user
        await deleteUser(currentUser);
        console.log("Firebase Auth user deleted.");

        // Clear local state immediately
        setUserInfo(null);
        setUser(null);
        setStreak(0);

    } catch (error: any) {
        console.error("Error deleting account:", error);
        // Re-throw the error for the component to handle specific cases like re-authentication
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
      resetPassword, // Added resetPassword
      logout,
      deleteAccount,
      // User is authenticated IF firebase auth user exists AND userInfo is loaded (implies verification for email/pass)
      isAuthenticated: !!user && !!userInfo,
      loading,
      streak
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

