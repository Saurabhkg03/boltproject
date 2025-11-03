import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
// We don't need cache here anymore, moved to Practice.tsx logic if needed
// import { getCache, setCache } from '../utils/cache';

// --- THIS IS THE FIX ---
// Updated to include all fields from the seeder script
export interface AppMetadata {
  subjects: string[];
  topics: string[];
  years: string[];
  tags: string[];
  branches: string[];
  questionTypes: string[];
  
  questionCount: number;
  
  subjectCounts: Record<string, number>;
  topicCounts: Record<string, number>;
  yearCounts: Record<string, number>;
  branchCounts: Record<string, number>;
  questionTypeCounts: Record<string, number>;
  
  subjectTopicMap: Record<string, string[]>;
  branchSubjectMap: Record<string, string[]>;
  
  allQuestionIds: string[]; // <-- ADDED FOR DAILY CHALLENGE
  
  lastUpdated: string;
}

interface MetadataContextType {
  metadata: AppMetadata | null;
  loading: boolean;
}

const MetadataContext = createContext<MetadataContextType | undefined>(undefined);

export function MetadataProvider({ children }: { children: ReactNode }) {
  const [metadata, setMetadata] = useState<AppMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    console.log("[MetadataContext] Subscribing to 'metadata/filterOptions'...");

    const metadataRef = doc(db, "metadata", "filterOptions");

    // Use onSnapshot to get real-time updates if metadata is ever changed
    const unsubscribe = onSnapshot(metadataRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppMetadata;
        console.log(`[MetadataContext] SUCCESS: Metadata loaded. Total Questions: ${data.questionCount}`);
        setMetadata(data);
      } else {
        console.error("[MetadataContext] CRITICAL ERROR: 'metadata/filterOptions' document not found!");
        setMetadata(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("[MetadataContext] FATAL ERROR fetching metadata:", error);
      setMetadata(null);
      setLoading(false);
    });

    // Detach listener on cleanup
    return () => {
      console.log("[MetadataContext] Unsubscribing from metadata.");
      unsubscribe();
    };
  }, []); // Runs once on mount

  return (
    <MetadataContext.Provider value={{ metadata, loading }}>
      {children}
    </MetadataContext.Provider>
  );
}

export function useMetadata() {
  const context = useContext(MetadataContext);
  if (context === undefined) {
    throw new Error('useMetadata must be used within a MetadataProvider');
  }
  return context;
}

