import { useStreamingCards } from './useStreamingCards';

export function useTikTokToIG() {
  const s = useStreamingCards('/api/tiktok-to-ig', 'crown_last_tiktok_search');
  return {
    runTikTok:     s.run,
    resetTikTok:   s.reset,
    tiktokCards:   s.cards,
    tiktokStats:   s.stats,
    tiktokError:   s.error,
    tiktokScored:  s.scoredCount,
    tiktokTotal:   s.totalProfiles,
    isTikToking:   s.isScanning,
    isTikTokScoring: s.isScoring,
    isTikTokError: s.isError,
    tiktokStage:   s.stage,
  };
}
