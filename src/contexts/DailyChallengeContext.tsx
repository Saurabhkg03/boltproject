import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// *** No longer need direct db access ***
import { useMetadata } from './MetadataContext'; // *** ADDED: Import metadata hook ***

interface DailyChallengeContextType {
  dailyChallengeId: string | null;
  loadingChallenge: boolean;
}

const DailyChallengeContext = createContext<DailyChallengeContextType | undefined>(undefined);

export function DailyChallengeProvider({ children }: { children: ReactNode }) {
  const [dailyChallengeId, setDailyChallengeId] = useState<string | null>(null);

  // *** ADDED: Get metadata from our optimized context ***
  const { metadata, loading: metadataLoading, selectedBranch } = useMetadata(); // <-- ADDED selectedBranch

  // *** MODIFIED: loadingChallenge now depends on metadataLoading ***
  const [loadingChallenge, setLoadingChallenge] = useState(true);

  // *** MODIFIED: This effect now reads from metadata, not Firestore ***
  useEffect(() => {
    // Wait until metadata is loaded before trying to calculate
    if (metadataLoading || !metadata) {
      console.log(`[DailyChallenge] Waiting for metadata for branch ${selectedBranch}...`);
      setLoadingChallenge(true);
      return;
    }

    console.log(`[DailyChallenge] Metadata loaded for ${selectedBranch}. Calculating challenge...`);
    setLoadingChallenge(true);

    try {
      // *** REMOVED: All Firestore getDocs() logic ***

      // *** ADDED: Get the sorted ID list directly from metadata ***
      const questionIds = metadata.allQuestionIds || [];

      if (questionIds.length > 0) {
        // Calculate the day of the year (1-366)
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff =
          now.getTime() -
          start.getTime() +
          (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        // Use modulo to get a consistent index based on the day
        const challengeIndex = (dayOfYear - 1) % questionIds.length; // Use dayOfYear - 1 for 0-based index

        console.log(
          `[DailyChallenge] Branch: ${selectedBranch}, Day ${dayOfYear}, Index ${challengeIndex}, ID: ${questionIds[challengeIndex]}`
        );
        setDailyChallengeId(questionIds[challengeIndex]);
      } else {
        console.warn(
          `[DailyChallenge] Metadata loaded for ${selectedBranch}, but 'allQuestionIds' array is empty.`
        );
        setDailyChallengeId(null);
      }
    } catch (error) {
      console.error(
        `[DailyChallenge] Error calculating daily challenge for ${selectedBranch}:`,
        error
      );
      setDailyChallengeId(null);
    } finally {
      setLoadingChallenge(false);
    }
    // *** MODIFIED: Runs when metadata is ready OR when branch changes ***
  }, [metadata, metadataLoading, selectedBranch]);

  return (
    <DailyChallengeContext.Provider
      value={{ dailyChallengeId, loadingChallenge }}
    >
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
