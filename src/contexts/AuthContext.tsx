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
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
// MODIFIED: Added onSnapshot and limit
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, writeBatch, onSnapshot, limit } from 'firebase/firestore'; 
import { auth, db } from '../firebase';
// MODIFIED: Removed Submission, UserQuestionData as they are no longer needed here
import { User } from '../data/mockData'; 

interface AuthContextType {
  user: FirebaseUser | null;
  userInfo: User | null;
  setUserInfo: Dispatch<SetStateAction<User | null>>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  // MODIFIED: Removed streak, as it's now part of userInfo.streakData
  // streak: number; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // MODIFIED: Removed streak state
  // const [streak, setStreak] = useState(0); 

  useEffect(() => {
    // This outer unsubscribe is for onAuthStateChanged
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        console.log("Auth State Changed:", currentUser ? `UID: ${currentUser.uid}, Verified: ${currentUser.emailVerified}` : 'No User');
        setUser(currentUser);

        // This inner unsubscribe is for onSnapshot
        let unsubscribeSnapshot: () => void = () => {};

        if (currentUser) {
            const isGoogleProvider = currentUser.providerData.some(provider => provider.providerId === GoogleAuthProvider.PROVIDER_ID);
            
            if (currentUser.emailVerified || isGoogleProvider) {
                try {
                    const userDocRef = doc(db, 'users', currentUser.uid);

                    // --- MODIFICATION: Use onSnapshot for real-time updates ---
                    // This one listener will power the entire app (Navbar, Profile, etc.)
                    // with real-time stats updated by our (simulated) Cloud Function.
                    unsubscribeSnapshot = onSnapshot(userDocRef, (userDocSnap) => {
                        if (userDocSnap.exists()) {
                            console.log("Real-time user data received:", userDocSnap.data());
                            const userData = userDocSnap.data() as User;
                            
                            // Ensure data is valid before setting
                            if (!userData.stats) { userData.stats = { attempted: 0, correct: 0, accuracy: 0, subjects: {} }; }
                            if (!userData.streakData) { userData.streakData = { currentStreak: 0, lastSubmissionDate: '' }; }
                            if (!userData.activityCalendar) { userData.activityCalendar = {}; }

                            setUserInfo(userData);

                        } else if (isGoogleProvider) {
                            // This logic only runs if onSnapshot returns no doc AND it's a Google user.
                            // This is a one-time setup for a new Google user.
                            console.log("Google user exists in Auth but not Firestore. Creating Firestore doc.");
                            
                            // This is an async operation, but it's fine as it only runs once.
                            // We do this inside the snapshot callback to avoid a race condition.
                            (async () => {
                                // We can't use the 'loginWithGoogle' logic here as it causes a loop.
                                // We'll just create the user doc.
                                let usernameToSet = currentUser.email ? currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) : `user_${currentUser.uid.slice(-6)}`;
                                if (usernameToSet.length < 3) usernameToSet = `user_${currentUser.uid.slice(-6)}`;
                                
                                // Simple check for username, not as robust as signup, but necessary.
                                const q = query(collection(db, 'users'), where('username', '==', usernameToSet), limit(1));
                                const querySnapshot = await getDocs(q);
                                if (!querySnapshot.empty) {
                                    usernameToSet = `user_${currentUser.uid.slice(-6)}`;
                                }

                                const newUser: User = {
                                    uid: currentUser.uid,
                                    name: currentUser.displayName || 'New User',
                                    username: usernameToSet, 
                                    email: currentUser.email || '',
                                    joined: new Date().toISOString(),
                                    stats: { attempted: 0, correct: 0, accuracy: 0, subjects: {} },
                                    streakData: { currentStreak: 0, lastSubmissionDate: '' },
                                    activityCalendar: {},
                                    avatar: currentUser.photoURL || '/user.png',
                                    role: 'user',
                                    needsSetup: !currentUser.displayName
                                };
                                await setDoc(userDocRef, newUser);
                                setUserInfo(newUser); // Set the new user in state
                            })();
                        } else {
                            console.log("User exists in Auth but not Firestore and is not Google provider. UserInfo not set.");
                            setUserInfo(null); 
                        }
                        setLoading(false); // Set loading to false *after* snapshot resolves
                    }, (error) => {
                        console.error("Error in onSnapshot listener:", error);
                        setUserInfo(null);
                        setLoading(false);
                    });
                    // --- END MODIFICATION ---

                } catch (error) {
                    console.error("Error setting up user listener:", error);
                    setUserInfo(null); 
                    setLoading(false);
                }
            } else {
                console.log("User email not verified. UserInfo not set.");
                setUserInfo(null); // Clear userInfo if email is not verified
                setLoading(false);
            }
        } else {
            setUserInfo(null); // Clear userInfo if no user
            setLoading(false);
        }

        // Return the snapshot unsubscriber
        return () => {
            console.log("[AuthContext] Unsubscribing from user snapshot.");
            unsubscribeSnapshot();
        };
    });

    // Return the auth state unsubscriber
    return () => {
        console.log("[AuthContext] Unsubscribing from auth state changes.");
        unsubscribeAuth();
    };
  }, []); // Run only once on mount

  // --- MODIFIED: REMOVED the entire useEffect for calculateStreak ---
  // This is no longer needed. The streak is provided in real-time
  // by the onSnapshot listener above.

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
        // This is a critical failure, we should probably delete the auth user
        try {
            await deleteUser(userCredential.user);
            console.log("Auth user deleted due to verification email failure.");
        } catch (deleteError) {
            console.error("Failed to delete auth user after verification error:", deleteError);
        }
        throw new Error("Could not send verification email. Please check the email address and try signing up again.");
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
    // This is the "initial" document. The migration script/cloud function
    // will fill in the rest of the data.
    const newUser: User = {
      uid: userCredential.user.uid,
      name,
      username: saneUsername,
      email: email,
      joined: new Date().toISOString(),
      // Initialize all stats objects
      stats: { attempted: 0, correct: 0, accuracy: 0, subjects: {} },
      streakData: { currentStreak: 0, lastSubmissionDate: '' },
      activityCalendar: {},
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
        if (usernameToSet.length < 3) usernameToSet = `user_${googleUser.uid.slice(-6)}`;

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
            // Initialize all stats objects
            stats: { attempted: 0, correct: 0, accuracy: 0, subjects: {} },
            streakData: { currentStreak: 0, lastSubmissionDate: '' },
            activityCalendar: {},
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
        await deleteCollection(`users/${currentUser.uid}/questionLists`); // Also delete question lists

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
        // setStreak(0); // State removed

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
      // streak // REMOVED
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

