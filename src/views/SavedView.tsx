'use client';

import { BookmarkCheck, Loader2, AlertCircle } from "lucide-react";
import InfluencerCard from "@/components/InfluencerCard";
import { useSavedInfluencers } from "@/hooks/useSavedInfluencers";

export default function SavedView() {
  const { data: influencers, isLoading, isError, error } = useSavedInfluencers(true);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Saved Influencers</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        {/* Subtitle */}
        <p className="text-sm text-muted-foreground mb-5">
          {isLoading
            ? "Loading…"
            : isError
            ? "Could not load saved influencers."
            : `${influencers?.length ?? 0} influencer${influencers?.length !== 1 ? "s" : ""} saved to your campaign`}
        </p>

        {/* Error */}
        {isError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{(error as Error).message}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Fetching saved profiles…</span>
          </div>
        )}

        {/* Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {influencers?.map((influencer) => (
              <InfluencerCard key={influencer.username} influencer={influencer} />
            ))}
            {!isError && influencers?.length === 0 && (
              <div className="col-span-full text-center py-24">
                <BookmarkCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No saved influencers yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Search for influencers and click Save on the ones you like.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
