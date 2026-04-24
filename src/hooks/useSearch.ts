import { useStreamingCards } from './useStreamingCards';

export function useSearch() {
  const s = useStreamingCards('/api/search', 'crown_last_hashtag_search');
  return {
    runSearch:     s.run,
    resetSearch:   s.reset,
    searchCards:   s.cards,
    searchStats:   s.stats,
    searchError:   s.error,
    searchScored:  s.scoredCount,
    searchTotal:   s.totalProfiles,
    isSearching:   s.isScanning,
    isSearchScoring: s.isScoring,
    isSearchError: s.isError,
    searchStage:   s.stage,
  };
}
