'use client';

import { useState, type KeyboardEvent } from "react";
import { Search, SlidersHorizontal, Hash, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import CampaignSidebar, { type NavView } from "@/components/CampaignSidebar";
import InfluencerCard, { type Influencer } from "@/components/InfluencerCard";
import HashtagAnalysisPanel from "@/components/HashtagAnalysisPanel";
import SavedView from "@/views/SavedView";
import { useSearch } from "@/hooks/useSearch";
import { useHashtagAnalysis } from "@/hooks/useHashtagAnalysis";

const Index = () => {
  const [activeView, setActiveView] = useState<NavView>('Search');
  const [hashtagInput, setHashtagInput] = useState("");
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("match");
  const [maxResults, setMaxResults] = useState(25);

  const { mutate: runSearch, data: searchResult, isPending, isError, error } = useSearch();
  const { mutate: runAnalysis, data: analysisResult, isPending: isAnalyzing, reset: resetAnalysis } = useHashtagAnalysis();

  const allInfluencers: Influencer[] = searchResult?.influencers ?? [];

  const parseTags = () =>
    hashtagInput
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);

  const handleSearch = () => {
    const tags = parseTags();
    if (tags.length === 0) return;
    resetAnalysis();
    runSearch({ hashtags: tags, maxResults });
  };

  const handleAnalyze = () => {
    const tags = parseTags();
    if (tags.length === 0) return;
    runAnalysis(tags);
  };

  const handleAddSuggestion = (tag: string) => {
    const current = hashtagInput.trim();
    setHashtagInput(current ? `${current}, ${tag}` : tag);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const displayed = allInfluencers
    .filter((i) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        i.username.toLowerCase().includes(q) ||
        i.niche.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "match") return b.matchScore - a.matchScore;
      if (sortBy === "engagement") return parseFloat(b.engagement) - parseFloat(a.engagement);
      if (sortBy === "followers") {
        const parse = (s: string) => {
          if (s.endsWith("M")) return parseFloat(s) * 1_000_000;
          if (s.endsWith("K")) return parseFloat(s) * 1_000;
          return parseFloat(s);
        };
        return parse(b.followers) - parse(a.followers);
      }
      return 0;
    });

  return (
    <div className="flex min-h-screen bg-background">
      <CampaignSidebar activeView={activeView} onNavigate={setActiveView} />

      {/* Saved view */}
      {activeView === 'Saved' && <SavedView />}

      {/* Search view */}
      {activeView === 'Search' && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Nav */}
          <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="miamiinfluencer, miamiblogger..."
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isPending}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || isPending || !hashtagInput.trim()}
                variant="outline"
                className="shrink-0"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Analyze</>
                )}
              </Button>
              <Button
                onClick={handleSearch}
                disabled={isPending || !hashtagInput.trim()}
                className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" /> Search</>
                )}
              </Button>

              <div className="relative shrink-0 hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter results…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow w-44"
                />
              </div>

              <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue placeholder="Posts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 posts</SelectItem>
                  <SelectItem value="25">25 posts</SelectItem>
                  <SelectItem value="50">50 posts</SelectItem>
                  <SelectItem value="100">100 posts</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 shrink-0">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="match">Success Rate</SelectItem>
                    <SelectItem value="followers">Followers</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Discover Influencers</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isPending
                    ? "Searching Instagram…"
                    : !searchResult
                    ? "Enter a hashtag to search for influencers"
                    : `${displayed.length} influencer${displayed.length !== 1 ? "s" : ""} found`}
                </p>
              </div>
              {searchResult && (
                <div className="text-xs text-muted-foreground text-right leading-relaxed">
                  <span className="font-medium">{searchResult.stats.hashtagPostsFound}</span> posts scraped
                  {" → "}<span className="font-medium">{searchResult.stats.afterPreFilter}</span> pre-filtered
                  {" → "}<span className="font-medium">{searchResult.stats.afterProfileFilter}</span> profiled
                  {" → "}<span className="font-medium text-foreground">{searchResult.stats.final}</span> scored
                </div>
              )}
            </div>

            {analysisResult && (
              <HashtagAnalysisPanel
                result={analysisResult}
                onAddSuggestion={handleAddSuggestion}
              />
            )}

            {isError && (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{(error as Error).message}</span>
              </div>
            )}

            {isPending && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-56 rounded-xl border border-border bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}

            {!isPending && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayed.map((influencer) => (
                  <InfluencerCard key={influencer.username} influencer={influencer} />
                ))}
                {displayed.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-16 text-sm">
                    No influencers matched the current filters.
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default Index;
