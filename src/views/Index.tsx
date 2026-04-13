'use client';

import { useState, type KeyboardEvent } from "react";
import { Search, SlidersHorizontal, Hash, Loader2, AlertCircle, Sparkles, MapPin, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CampaignSidebar, { type NavView } from "@/components/CampaignSidebar";
import InfluencerCard, { type Influencer } from "@/components/InfluencerCard";
import HashtagAnalysisPanel from "@/components/HashtagAnalysisPanel";
import SavedView from "@/views/SavedView";
import { useSearch } from "@/hooks/useSearch";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useHashtagAnalysis } from "@/hooks/useHashtagAnalysis";

type SearchMode = 'hashtag' | 'discovery';

const Index = () => {
  const [activeView, setActiveView]     = useState<NavView>('Search');
  const [searchMode, setSearchMode]     = useState<SearchMode>('hashtag');

  // Hashtag mode state
  const [hashtagInput, setHashtagInput] = useState("");

  // Discovery mode state
  const [seedInput, setSeedInput]       = useState("");

  // Shared result controls
  const [filter, setFilter]             = useState("");
  const [sortBy, setSortBy]             = useState("match");

  const {
    mutate: runSearch, data: searchResult,
    isPending: isSearching, isError: isSearchError, error: searchError,
    reset: resetSearch,
  } = useSearch();

  const {
    mutate: runDiscover, data: discoverResult,
    isPending: isDiscovering, isError: isDiscoverError, error: discoverError,
    reset: resetDiscover,
  } = useDiscovery();

  const { mutate: runAnalysis, data: analysisResult, isPending: isAnalyzing, reset: resetAnalysis } = useHashtagAnalysis();

  const isPending  = isSearching || isDiscovering;
  const isError    = searchMode === 'hashtag' ? isSearchError : isDiscoverError;
  const activeError = searchMode === 'hashtag' ? searchError  : discoverError;
  const activeResult = searchMode === 'hashtag' ? searchResult : discoverResult;
  const allInfluencers: Influencer[] = activeResult?.influencers ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const parseTags = () =>
    hashtagInput
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);

  const parseSeeds = () =>
    seedInput
      .split(/[\s,]+/)
      .map((s) => s.replace(/^@/, "").trim())
      .filter(Boolean);

  const handleSearch = () => {
    const tags = parseTags();
    if (tags.length === 0) return;
    resetAnalysis();
    runSearch({ hashtags: tags });
  };

  const handleDiscover = () => {
    runDiscover({ seeds: parseSeeds() });
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
    if (e.key === "Enter" && searchMode === 'hashtag') handleSearch();
  };

  const handleModeChange = (mode: string) => {
    setSearchMode(mode as SearchMode);
    setFilter("");
    resetSearch();
    resetDiscover();
    resetAnalysis();
  };

  // ── Displayed results ─────────────────────────────────────────────────────

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

  // ── Status text ───────────────────────────────────────────────────────────

  const statusText = isPending
    ? searchMode === 'hashtag' ? "Searching Instagram…" : "Scanning Miami locations…"
    : !activeResult
    ? searchMode === 'hashtag'
      ? "Enter hashtags to search for influencers"
      : "Click Discover to scan Miami locations for influencers"
    : `${displayed.length} influencer${displayed.length !== 1 ? "s" : ""} found`;

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

            {/* Row 1: mode tabs + shared controls */}
            <div className="flex items-center gap-3">
              <Tabs value={searchMode} onValueChange={handleModeChange} className="shrink-0">
                <TabsList>
                  <TabsTrigger value="hashtag" className="gap-1.5 text-xs px-3">
                    <Hash className="w-3.5 h-3.5" />
                    Hashtag
                  </TabsTrigger>
                  <TabsTrigger value="discovery" className="gap-1.5 text-xs px-3">
                    <MapPin className="w-3.5 h-3.5" />
                    Miami Discovery
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex-1" />

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

            {/* Row 2: mode-specific search controls */}
            {searchMode === 'hashtag' && (
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
                  {isSearching ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>
            )}

            {searchMode === 'discovery' && (
              <div className="flex items-center gap-3">
                {/* Preset badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Users className="w-3 h-3" /> Female
                  </Badge>
                  <Badge variant="secondary" className="text-xs">25–60 yrs</Badge>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <MapPin className="w-3 h-3" /> Miami
                  </Badge>
                  <Badge variant="secondary" className="text-xs">30K–100K</Badge>
                </div>

                <div className="w-px h-4 bg-border shrink-0" />

                {/* Optional seeds */}
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">@</span>
                  <input
                    type="text"
                    placeholder="Seed accounts (optional): miamiinfluencer1, username2..."
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    disabled={isPending}
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                  />
                </div>

                <Button
                  onClick={handleDiscover}
                  disabled={isPending}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isDiscovering ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning…</>
                  ) : (
                    <><MapPin className="w-4 h-4 mr-2" /> Discover</>
                  )}
                </Button>
              </div>
            )}

          </header>

          <main className="flex-1 p-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {searchMode === 'hashtag' ? 'Hashtag Search' : 'Miami Discovery'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{statusText}</p>
              </div>
              {activeResult && (
                <div className="text-xs text-muted-foreground text-right leading-relaxed">
                  <span className="font-medium">{activeResult.stats.hashtagPostsFound}</span>{' '}
                  {searchMode === 'hashtag' ? 'posts scraped' : 'location posts'}
                  {" → "}<span className="font-medium">{activeResult.stats.afterPreFilter}</span> pre-filtered
                  {" → "}<span className="font-medium">{activeResult.stats.afterProfileFilter}</span> profiled
                  {" → "}<span className="font-medium">{activeResult.stats.afterPresetFilter}</span> AI-verified
                  {" → "}<span className="font-medium text-foreground">{activeResult.stats.final}</span> ranked
                </div>
              )}
            </div>

            {searchMode === 'hashtag' && analysisResult && (
              <HashtagAnalysisPanel
                result={analysisResult}
                onAddSuggestion={handleAddSuggestion}
              />
            )}

            {searchMode === 'discovery' && !isPending && !activeResult && (
              <div className="rounded-xl border border-border bg-muted/30 p-6 mb-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Cómo funciona Miami Discovery</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Escanea posts geotaggeados en Miami, Wynwood, Brickell, Coral Gables y Miami Beach</li>
                  <li>Filtra automáticamente por mujeres · 25–60 años · 30K–100K seguidores</li>
                  <li>Optionally add known Miami influencer handles as seeds to boost discovery</li>
                  <li>La IA de Gemini verifica y puntúa cada perfil antes de mostrarlo</li>
                </ul>
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{(activeError as Error).message}</span>
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
                {activeResult && displayed.length === 0 && (
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
