'use client';

import { useState, type KeyboardEvent } from "react";
import { Search, SlidersHorizontal, Hash, Loader2, AlertCircle, Sparkles, MapPin, Users, Music2 } from "lucide-react";
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
import { useTikTokToIG } from "@/hooks/useTikTokToIG";
import { useTikTokNative } from "@/hooks/useTikTokNative";
import { useHashtagAnalysis } from "@/hooks/useHashtagAnalysis";

const DEFAULT_TIKTOK_HASHTAGS = 'miamiinfluencer';

type SearchMode = 'hashtag' | 'discovery' | 'tiktok' | 'tiktok-native';

const Index = () => {
  const [activeView, setActiveView]     = useState<NavView>('Search');
  const [searchMode, setSearchMode]     = useState<SearchMode>('tiktok');

  // Hashtag mode state
  const [hashtagInput, setHashtagInput]   = useState("");
  const [mediaType, setMediaType]         = useState<'posts' | 'reels'>('reels');
  const [postsLimit, setPostsLimit]       = useState<number>(100);

  // Discovery mode state
  const [seedInput, setSeedInput]       = useState("");

  // TikTok → IG mode state
  const [tiktokInput, setTiktokInput]   = useState(DEFAULT_TIKTOK_HASHTAGS);

  // TikTok native mode state
  const [tiktokNativeInput, setTiktokNativeInput] = useState(DEFAULT_TIKTOK_HASHTAGS);

  // Shared result controls
  const [filter, setFilter]             = useState("");
  const [sortBy, setSortBy]             = useState("match");
  const [showAll, setShowAll]           = useState(false);

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

  const {
    mutate: runTikTok, data: tiktokResult,
    isPending: isTikToking, isError: isTikTokError, error: tiktokError,
    reset: resetTikTok,
  } = useTikTokToIG();

  const {
    mutate: runTikTokNative, data: tiktokNativeResult,
    isPending: isTikTokingNative, isError: isTikTokNativeError, error: tiktokNativeError,
    reset: resetTikTokNative,
  } = useTikTokNative();

  const { mutate: runAnalysis, data: analysisResult, isPending: isAnalyzing, reset: resetAnalysis } = useHashtagAnalysis();

  const isPending   = isSearching || isDiscovering || isTikToking || isTikTokingNative;
  const isError     = searchMode === 'hashtag'       ? isSearchError
                    : searchMode === 'discovery'     ? isDiscoverError
                    : searchMode === 'tiktok'        ? isTikTokError
                    :                                  isTikTokNativeError;
  const activeError = searchMode === 'hashtag'       ? searchError
                    : searchMode === 'discovery'     ? discoverError
                    : searchMode === 'tiktok'        ? tiktokError
                    :                                  tiktokNativeError;
  const activeResult = searchMode === 'hashtag'      ? searchResult
                     : searchMode === 'discovery'    ? discoverResult
                     : searchMode === 'tiktok'       ? tiktokResult
                     :                                 tiktokNativeResult;
  const allInfluencers: Influencer[] = showAll
    ? (activeResult?.allProfiled ?? [])
    : (activeResult?.influencers ?? []);

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
    runSearch({ hashtags: tags, resultsType: mediaType, postsLimit });
  };

  const handleDiscover = () => {
    runDiscover({ seeds: parseSeeds() });
  };

  const parseTikTokTags = () =>
    tiktokInput
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);

  const handleTikTok = () => {
    runTikTok({ hashtags: parseTikTokTags() });
  };

  const parseTikTokNativeTags = () =>
    tiktokNativeInput
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);

  const handleTikTokNative = () => {
    runTikTokNative({ hashtags: parseTikTokNativeTags() });
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
    setShowAll(false);
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
    ? searchMode === 'hashtag'        ? "Searching Instagram…"
    : searchMode === 'discovery'      ? "Scanning Miami locations…"
    : searchMode === 'tiktok'         ? "Searching TikTok → cross-referencing Instagram…"
    :                                   "Scraping TikTok videos and scoring creators…"
    : !activeResult
    ? searchMode === 'hashtag'        ? "Enter hashtags to search for influencers"
    : searchMode === 'discovery'      ? "Click Discover to scan Miami locations for influencers"
    : searchMode === 'tiktok'         ? "Click Search to find Miami influencers via TikTok"
    :                                   "Enter hashtags to find viral TikTok creators"
    : `${displayed.length} creator${displayed.length !== 1 ? "s" : ""} found`;

  return (
    <div className="flex min-h-screen bg-background">
      <CampaignSidebar activeView={activeView} onNavigate={setActiveView} />

      {/* Saved view */}
      {activeView === 'Saved' && <SavedView />}

      {/* Search view — always mounted to preserve state, hidden when not active */}
      <div className={`flex-1 flex flex-col min-w-0 ${activeView !== 'Search' ? 'hidden' : ''}`}>

          {/* Top Nav */}
          <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 space-y-3">

            {/* Row 1: mode tabs + shared controls */}
            <div className="flex items-center gap-3">
              <Tabs value={searchMode} onValueChange={handleModeChange} className="shrink-0">
                <TabsList>
                  <TabsTrigger value="tiktok" className="gap-1.5 text-xs px-3">
                    <Music2 className="w-3.5 h-3.5" />
                    TikTok → IG!
                  </TabsTrigger>
                   <TabsTrigger value="discovery" className="gap-1.5 text-xs px-3">
                    <MapPin className="w-3.5 h-3.5" />
                    Miami Discovery
                  </TabsTrigger>
                  <TabsTrigger value="hashtag" className="gap-1.5 text-xs px-3">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
                      <circle cx="17.5" cy="6.5" r="1.5" />
                    </svg>
                    Instagram
                  </TabsTrigger>
                  <TabsTrigger value="tiktok-native" className="gap-1.5 text-xs px-3">
                    <Music2 className="w-3.5 h-3.5" />
                    TikTok
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex-1" />

              {/* Filter input — hidden provisionally
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
              */}

              {/* Sort select — hidden provisionally
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
              */}
            </div>

            {/* Row 2: mode-specific search controls */}
            {searchMode === 'hashtag' && (
              <div className="flex flex-col gap-2">
                {/* Input row */}
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
                {/* Options row */}
                <div className="flex items-center gap-3">
                  {/* Reels / Posts toggle */}
                  <div className="flex items-center rounded-md border border-input overflow-hidden text-xs shrink-0">
                    <button
                      onClick={() => setMediaType('reels')}
                      disabled={isPending}
                      className={`px-3 py-1.5 transition-colors ${mediaType === 'reels' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                      Reels
                    </button>
                    <button
                      onClick={() => setMediaType('posts')}
                      disabled={isPending}
                      className={`px-3 py-1.5 transition-colors ${mediaType === 'posts' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                      Posts
                    </button>
                  </div>
                  {/* Posts limit */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <span>Limit:</span>
                    <select
                      value={postsLimit}
                      onChange={(e) => setPostsLimit(Number(e.target.value))}
                      disabled={isPending}
                      className="bg-background border border-input rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    >
                      <option value={50}>50 posts</option>
                      <option value={100}>100 posts</option>
                      <option value={200}>200 posts</option>
                      <option value={300}>300 posts</option>
                    </select>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    More posts → more unique authors → more candidates for AI
                  </span>
                </div>
              </div>
            )}

            {searchMode === 'tiktok' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>TikTok hashtags</span>
                </div>
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="miami, miamilifestyle, miamifashion..."
                    value={tiktokInput}
                    onChange={(e) => setTiktokInput(e.target.value)}
                    disabled={isPending}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                  />
                </div>
                <Button
                  onClick={handleTikTok}
                  disabled={isPending || !tiktokInput.trim()}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isTikToking ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                  ) : (
                    <><Music2 className="w-4 h-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>
            )}

            {searchMode === 'tiktok-native' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>TikTok hashtags</span>
                </div>
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="miami, miamilifestyle, miamifashion..."
                    value={tiktokNativeInput}
                    onChange={(e) => setTiktokNativeInput(e.target.value)}
                    disabled={isPending}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                  />
                </div>
                <Button
                  onClick={handleTikTokNative}
                  disabled={isPending || !tiktokNativeInput.trim()}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isTikTokingNative ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                  ) : (
                    <><Music2 className="w-4 h-4 mr-2" /> Search</>
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
                  {searchMode === 'hashtag' ? 'Hashtag Search' : searchMode === 'discovery' ? 'Miami Discovery' : searchMode === 'tiktok' ? 'TikTok → Instagram' : 'TikTok Creators'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{statusText}</p>
              </div>
              {activeResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAll(false)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      !showAll
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    AI Verified ({activeResult.influencers.length})
                  </button>
                  <button
                    onClick={() => setShowAll(true)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      showAll
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All 30K+ ({activeResult.allProfiled.length})
                  </button>
                </div>
              )}
            </div>

            {activeResult && (
              <div className="text-xs text-muted-foreground leading-relaxed mb-4">
                <span className="font-medium">{activeResult.stats.hashtagPostsFound}</span>{' '}
                {searchMode === 'hashtag' ? 'posts scraped' : searchMode === 'discovery' ? 'location posts' : searchMode === 'tiktok' ? 'TikTok authors' : 'TikTok videos'}
                {" → "}<span className="font-medium">{activeResult.stats.afterPreFilter}</span> pre-filtered
                {" → "}<span className="font-medium">{activeResult.stats.afterProfileFilter}</span> profiled
                {" → "}<span className="font-medium">{activeResult.stats.afterPresetFilter}</span> AI-verified
                {" → "}<span className="font-medium text-foreground">{activeResult.stats.final}</span> ranked
              </div>
            )}

            {searchMode === 'hashtag' && analysisResult && (
              <HashtagAnalysisPanel
                result={analysisResult}
                onAddSuggestion={handleAddSuggestion}
              />
            )}

            {searchMode === 'tiktok' && !isPending && !activeResult && (
              <div className="rounded-xl border border-border bg-muted/30 p-6 mb-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">How TikTok → Instagram works</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Searches TikTok by the entered hashtags and extracts unique authors</li>
                  <li>Cross-references those usernames against Instagram (same handle on both platforms ~80% of the time)</li>
                  <li>Filters by 30K–100K Instagram followers</li>
                  <li>Gemini verifies gender · age 25–60 · Miami and scores each profile</li>
                </ul>
              </div>
            )}

            {searchMode === 'tiktok-native' && !isPending && !activeResult && (
              <div className="rounded-xl border border-border bg-muted/30 p-6 mb-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">How TikTok Creators works</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Scrapes TikTok videos by the entered hashtags and groups them by creator</li>
                  <li>Calculates real engagement from video views, likes, and comments — no Instagram needed</li>
                  <li>Filters creators with 10K+ followers and meaningful view counts</li>
                  <li>Gemini verifies gender · age 25–60 · Miami and scores each TikTok profile</li>
                </ul>
              </div>
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
    </div>
  );
};

export default Index;
