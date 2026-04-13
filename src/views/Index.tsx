'use client';

import { useState, type KeyboardEvent } from "react";
import { Search, SlidersHorizontal, Hash, Loader2, AlertCircle, Sparkles, MapPin, Users } from "lucide-react";
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
  const [minFollowers, setMinFollowers] = useState(0);
  const [maxFollowers, setMaxFollowers] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");

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

  const activeFilterCount = [
    minFollowers > 0,
    maxFollowers > 0,
    locationFilter.trim().length > 0,
  ].filter(Boolean).length;

  const displayed = allInfluencers
    .filter((i) => {
      if (filter) {
        const q = filter.toLowerCase();
        const matchesText =
          i.name.toLowerCase().includes(q) ||
          i.username.toLowerCase().includes(q) ||
          i.niche.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      if (minFollowers > 0 && i.followersRaw < minFollowers) return false;
      if (maxFollowers > 0 && i.followersRaw > maxFollowers) return false;
      if (locationFilter.trim()) {
        const loc = (i.location ?? '').toLowerCase();
        if (!loc.includes(locationFilter.toLowerCase().trim())) return false;
      }
      return true;
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
          <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 space-y-3">
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

            {/* Advanced filters row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Users className="w-3.5 h-3.5" />
                <span>Followers</span>
              </div>
              <Select value={String(minFollowers)} onValueChange={(v) => setMinFollowers(Number(v))}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any min</SelectItem>
                  <SelectItem value="1000">1K+</SelectItem>
                  <SelectItem value="5000">5K+</SelectItem>
                  <SelectItem value="10000">10K+</SelectItem>
                  <SelectItem value="25000">25K+</SelectItem>
                  <SelectItem value="50000">50K+</SelectItem>
                  <SelectItem value="100000">100K+</SelectItem>
                  <SelectItem value="250000">250K+</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">–</span>
              <Select value={String(maxFollowers)} onValueChange={(v) => setMaxFollowers(Number(v))}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Max" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any max</SelectItem>
                  <SelectItem value="10000">Up to 10K</SelectItem>
                  <SelectItem value="25000">Up to 25K</SelectItem>
                  <SelectItem value="50000">Up to 50K</SelectItem>
                  <SelectItem value="100000">Up to 100K</SelectItem>
                  <SelectItem value="250000">Up to 250K</SelectItem>
                  <SelectItem value="500000">Up to 500K</SelectItem>
                </SelectContent>
              </Select>

              <div className="w-px h-4 bg-border shrink-0" />

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <MapPin className="w-3.5 h-3.5" />
                <span>Location</span>
              </div>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="City or country…"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 h-8 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow w-40"
                />
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setMinFollowers(0); setMaxFollowers(0); setLocationFilter(''); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-1"
                >
                  Clear filters ({activeFilterCount})
                </button>
              )}
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
