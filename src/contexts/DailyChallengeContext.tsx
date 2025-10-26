import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../firebase'; // Assuming firebase setup is correct
import { collection, getDocs } from 'firebase/firestore';
import { Question } from '../data/mockData'; // Assuming types are correct

interface DailyChallengeContextType {
  dailyChallengeId: string | null;
  loadingChallenge: boolean;
}

const DailyChallengeContext = createContext<DailyChallengeContextType | undefined>(undefined);

export function DailyChallengeProvider({ children }: { children: ReactNode }) {
  const [dailyChallengeId, setDailyChallengeId] = useState<string | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);

  useEffect(() => {
    const fetchDailyChallenge = async () => {
      setLoadingChallenge(true);
      try {
        // Fetch all questions - needed for the day-of-year calculation consistency
        const questionsSnapshot = await getDocs(collection(db, 'questions'));
        // Map to include IDs and sort consistently by title (numeric part)
        const questionsData = questionsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Question))
          .sort((a, b) => {
            const numA = parseInt((a.title || '0').replace(/\D/g,''), 10); // Extract number from title
            const numB = parseInt((b.title || '0').replace(/\D/g,''), 10); // Extract number from title
            return numA - numB;
          });

        if (questionsData.length > 0) {
          // Calculate the day of the year (1-366)
          const now = new Date();
          const start = new Date(now.getFullYear(), 0, 0);
          const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
          const oneDay = 1000 * 60 * 60 * 24;
          const dayOfYear = Math.floor(diff / oneDay);
          
          // Use modulo to get a consistent index based on the day
          const challengeIndex = (dayOfYear - 1) % questionsData.length; // Use dayOfYear - 1 for 0-based index
          setDailyChallengeId(questionsData[challengeIndex].id);
        } else {
          setDailyChallengeId(null);
        }
      } catch (error) {
        console.error("Error fetching daily challenge:", error);
        setDailyChallengeId(null);
      } finally {
        setLoadingChallenge(false);
      }
    };

    fetchDailyChallenge();
  }, []); // Run only once on mount

  return (
    <DailyChallengeContext.Provider value={{ dailyChallengeId, loadingChallenge }}>
      {children}
    </DailyChallengeContext.Provider>
  );
}

export function useDailyChallenge() {
  const context = useContext(DailyChallengeContext);
  if (context === undefined) {
    throw new Error('useDailyChallenge must be used within a DailyChallengeProvider');
  }
  return context;
}
