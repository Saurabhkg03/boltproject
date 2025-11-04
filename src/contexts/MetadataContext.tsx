import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
// --- FIX: Add .ts extension ---
import { db } from '../firebase.ts';
import { doc, onSnapshot } from 'firebase/firestore';
// --- OPTIMIZATION: Import cache utilities ---
// --- FIX: Add .ts extension ---
import { getCache, setCache } from '../utils/cache.ts';

// A map of available branches from your seeder script
const BRANCH_MAP: Record<string, string> = {
  ece: 'ECE',
  cse: 'CSE',
  me: 'ME',
  ce: 'CE',
  ee: 'EE',
};
const DEFAULT_BRANCH = 'ece';
const BRANCH_CACHE_KEY = 'gatecode_selected_branch';
// --- OPTIMIZATION: Cache TTL (Time-To-Live) in seconds. 1 hour = 3600s ---
const METADATA_CACHE_TTL = 3600;

// This interface matches the output of your NEW scraper (scrape10.py)
export interface BranchMetadata {
  branch: string;
  questionCount: number;
  allQuestionIds: string[];
  subjects: string[];
  topics: string[];
  years: string[];
  tags: string[];
  subjectCounts: Record<string, number>;
  questionTypeCounts: Record<string, number>;
  yearCounts: Record<string, number>;
  difficultyCounts: Record<string, number>;
  subjectTopicMap: Record<string, string[]>;
  branchSubjectMap: Record<string, string[]>; // This might be empty in branch-specific doc
  lastUpdated: string;
}

interface MetadataContextType {
  metadata: BranchMetadata | null;
  loading: boolean;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  availableBranches: Record<string, string>;
  // These paths are derived from the selected branch
  questionCollectionPath: string;
  metadataDocPath: string;
}

const MetadataContext = createContext<MetadataContextType | undefined>(undefined);

export function MetadataProvider({ children }: { children: ReactNode }) {
  const [availableBranches] = useState(BRANCH_MAP);

  // Get saved branch from localStorage or use default
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    const savedBranch = localStorage.getItem(BRANCH_CACHE_KEY);
    if (savedBranch && BRANCH_MAP[savedBranch]) {
      return savedBranch;
    }
    return DEFAULT_BRANCH;
  });

  const [metadata, setMetadata] = useState<BranchMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  // Memoize paths derived from the selected branch
  const { questionCollectionPath, metadataDocPath } = useMemo(() => {
    return {
      questionCollectionPath: `questions_${selectedBranch}`,
      metadataDocPath: `metadata/${selectedBranch}`,
    };
  }, [selectedBranch]);

  // Save selected branch to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(BRANCH_CACHE_KEY, selectedBranch);
  }, [selectedBranch]);

  // Re-fetch metadata whenever the selected branch changes
  useEffect(() => {
    setLoading(true);
    setMetadata(null); // Clear old metadata
    
    const cacheKey = `metadata_${selectedBranch}`;
    
    // --- OPTIMIZATION 1: Try to load from cache first ---
    const cachedData = getCache<BranchMetadata>(cacheKey);
    if (cachedData) {
      console.log(`[MetadataContext] CACHE HIT: Loaded metadata for ${selectedBranch} from cache.`);
      setMetadata(cachedData);
      setLoading(false); 
      // We still set up the snapshot below to get background updates
    } else {
      console.log(`[MetadataContext] CACHE MISS: No cache for ${selectedBranch}.`);
    }

    // --- OPTIMIZATION 2: Use onSnapshot to listen for real-time updates ---
    console.log(`[MetadataContext] Subscribing to: ${metadataDocPath}`);
    const metadataRef = doc(db, 'metadata', selectedBranch);

    const unsubscribe = onSnapshot(
      metadataRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as BranchMetadata;
          console.log(
            `[MetadataContext] SNAPSHOT: Metadata loaded for ${data.branch.toUpperCase()}. Total Questions: ${
              data.questionCount
            }`
          );
          setMetadata(data);
          
          // --- OPTIMIZATION 3: Save new data to cache ---
          setCache(cacheKey, data, METADATA_CACHE_TTL);
          
        } else {
          console.error(
            `[MetadataContext] CRITICAL ERROR: '${metadataDocPath}' document not found!`
          );
          setMetadata(null);
        }
        setLoading(false); // Set loading false after first snapshot (or cache)
      },
      (error) => {
        console.error(
          `[MetadataContext] FATAL ERROR fetching metadata from '${metadataDocPath}':`,
          error
        );
        setMetadata(null);
        setLoading(false);
      }
    );

    // Detach listener on cleanup
    return () => {
      console.log(
        `[MetadataContext] Unsubscribing from ${metadataDocPath}.`
      );
      unsubscribe();
    };
  }, [selectedBranch, metadataDocPath]); // Re-run when branch changes

  const value = {
    metadata,
    loading,
    selectedBranch,
    setSelectedBranch,
    availableBranches,
    questionCollectionPath,
    metadataDocPath,
  };

  return (
    <MetadataContext.Provider value={value}>
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

