'use client';

import { useState, type KeyboardEvent } from "react";
import { Search, Hash, Loader2, AlertCircle, Sparkles, MapPin, Users, Music2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import CampaignSidebar, { type NavView } from "@/components/CampaignSidebar";
import InfluencerCard, { type Influencer } from "@/components/InfluencerCard";
import HashtagAnalysisPanel from "@/components/HashtagAnalysisPanel";
import SavedView from "@/views/SavedView";
import { useSearch } from "@/hooks/useSearch";
import { useDiscovery, type DiscoverCard } from "@/hooks/useDiscovery";
import { useTikTokToIG } from "@/hooks/useTikTokToIG";
import { useTikTokNative } from "@/hooks/useTikTokNative";
import { useHashtagAnalysis } from "@/hooks/useHashtagAnalysis";

const DEFAULT_TIKTOK_HASHTAGS = 'miamiinfluencer';

type SearchMode = 'hashtag' | 'discovery' | 'tiktok' | 'tiktok-native';

const Index = () => {
  const [activeView, setActiveView]     = useState<NavView>('Search');
  const [searchMode, setSearchMode]     = useState<SearchMode>('tiktok');

  // Hashtag mode state
  const [hashtagInput, setHashtagInput] = useState("");
  const [mediaType, setMediaType]       = useState<'posts' | 'reels'>('reels');
  const [postsLimit, setPostsLimit]     = useState<number>(100);
  const [searchFollMin, setSearchFollMin] = useState(30);
  const [searchFollMax, setSearchFollMax] = useState(100);

  // Discovery mode state
  const [discoverMode, setDiscoverMode]             = useState<'hashtag' | 'username'>('hashtag');
  const [discoverSearchInput, setDiscoverSearchInput] = useState("");
  const [discoverGender, setDiscoverGender]         = useState<'female' | 'male' | 'any'>('female');
  const [discoverAgeMin, setDiscoverAgeMin]         = useState(25);
  const [discoverAgeMax, setDiscoverAgeMax]         = useState(60);
  const [discoverFollMin, setDiscoverFollMin]       = useState(30);
  const [discoverFollMax, setDiscoverFollMax]       = useState(100);
  const [discoverCity, setDiscoverCity]             = useState('miami');
  const [discoverMediaType, setDiscoverMediaType]   = useState<'posts' | 'reels'>('posts');

  // TikTok → IG mode state
  const [tiktokInput, setTiktokInput]       = useState(DEFAULT_TIKTOK_HASHTAGS);
  const [tiktokFollMin, setTiktokFollMin]   = useState(30);
  const [tiktokFollMax, setTiktokFollMax]   = useState(100);

  // TikTok native mode state
  const [tiktokNativeInput, setTiktokNativeInput] = useState(DEFAULT_TIKTOK_HASHTAGS);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter]   = useState("");
  const [sortBy, setSortBy]   = useState("match");
  const [tiktokNativeFollMin, setTiktokNativeFollMin] = useState(1);
  const [tiktokNativeFollMax, setTiktokNativeFollMax] = useState(500);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const {
    runSearch,
    searchCards, searchStats, searchError,
    searchScored, searchTotal,
    isSearching, isSearchScoring, isSearchError, searchStage,
  } = useSearch();

  const {
    runDiscover,
    reset:         resetDiscover,
    stage:         discoverStage,
    activeMode:    discoverActiveMode,
    cards:         discoverCards,
    stats:         discoverStats,
    scoredCount:   discoverScoredCount,
    totalProfiles: discoverTotal,
    isScanning:    isDiscovering,
    isScoring:     isDiscoverScoring,
    isError:       isDiscoverError,
    error:         discoverError,
  } = useDiscovery();

  const {
    runTikTok,
    tiktokCards, tiktokStats, tiktokError,
    tiktokScored, tiktokTotal,
    isTikToking, isTikTokScoring, isTikTokError, tiktokStage,
  } = useTikTokToIG();

  const {
    mutate:        runTikTokNative,
    reset:         resetTikTokNative,
    stage:         tiktokNativeStage,
    cards:         tiktokNativeCards,
    stats:         tiktokNativeStats,
    scoredCount:   tiktokNativeScoredCount,
    totalCreators: tiktokNativeTotal,
    isScanning:    isTikTokingNative,
    isScoring:     isTikTokNativeScoring,
    isError:       isTikTokNativeError,
    error:         tiktokNativeError,
  } = useTikTokNative();

  const { mutate: runAnalysis, data: analysisResult, isPending: isAnalyzing, reset: resetAnalysis } = useHashtagAnalysis();

  // ── Computed states ────────────────────────────────────────────────────────
  const isDiscoverBusy  = isDiscovering || isDiscoverScoring;
  const hasDiscoverData = discoverStage === 'scoring' || discoverStage === 'done';
  const hasSearchData   = searchStage === 'scoring' || searchStage === 'done';
  const hasTiktokData   = tiktokStage === 'scoring' || tiktokStage === 'done';
  const hasTikTokNativeData = tiktokNativeStage === 'scoring' || tiktokNativeStage === 'done';
  const anyBusy             = isSearching || isSearchScoring || isDiscoverBusy || isTikToking || isTikTokScoring || isTikTokingNative || isTikTokNativeScoring;

  const isError =
    searchMode === 'hashtag'    ? isSearchError
    : searchMode === 'discovery'  ? isDiscoverError
    : searchMode === 'tiktok'     ? isTikTokError
    :                               isTikTokNativeError;

  const activeError =
    searchMode === 'hashtag'    ? searchError
    : searchMode === 'discovery'  ? discoverError
    : searchMode === 'tiktok'     ? tiktokError
    :                               (tiktokNativeError as Error | null);

  // ── Client-side filters ────────────────────────────────────────────────────
  const filteredDiscoverCards = discoverCards.filter((card) => {
    if (card.followersCount < discoverFollMin * 1_000) return false;
    if (card.followersCount > discoverFollMax * 1_000) return false;
    if (!card.isScoring) {
      if (discoverGender !== 'any') {
        const g = card.gender;
        if (g && g !== 'unknown' && g !== discoverGender) return false;
      }
      const ageBucketRanges: Record<string, [number, number]> = {
        'under25': [0, 24], '25-34': [25, 34],
        '35-44': [35, 44], '45-60': [45, 60], 'over60': [61, 99],
      };
      if (card.estimatedAge && card.estimatedAge !== 'unknown') {
        const r = ageBucketRanges[card.estimatedAge];
        if (r && (r[1] < discoverAgeMin || r[0] > discoverAgeMax)) return false;
      }
      if (discoverCity) {
        const city = (card.inferredCity ?? '').toLowerCase();
        if (city && city !== 'unknown' && !city.includes(discoverCity.toLowerCase())) return false;
      }
    }
    return true;
  });

  const filteredSearchCards = searchCards.filter((card) => {
    if (card.followersCount < searchFollMin * 1_000) return false;
    if (card.followersCount > searchFollMax * 1_000) return false;
    return true;
  });

  const filteredTiktokCards = tiktokCards.filter((card) => {
    if (card.followersCount < tiktokFollMin * 1_000) return false;
    if (card.followersCount > tiktokFollMax * 1_000) return false;
    return true;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const parseTags = () =>
    hashtagInput.split(/[\s,]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);

  const handleSearch = () => {
    const tags = parseTags();
    if (tags.length === 0) return;
    resetAnalysis();
    runSearch({ hashtags: tags, resultsType: mediaType, postsLimit });
  };

  const handleDiscover = () => {
    const raw = discoverSearchInput.split(/[\s,]+/).map((v) => v.replace(/^[#@]/, '').trim()).filter(Boolean);
    if (discoverMode === 'hashtag') {
      runDiscover({ resultsType: discoverMediaType, mode: 'hashtag', customHashtags: raw });
    } else {
      if (raw.length === 0) return;
      runDiscover({ mode: 'username', usernames: raw });
    }
  };

  const parseTikTokTags = () =>
    tiktokInput.split(/[\s,]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);

  const handleTikTok = () => {
    runTikTok({ hashtags: parseTikTokTags() });
  };

  const parseTikTokNativeTags = () =>
    tiktokNativeInput.split(/[\s,]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);

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

  // ── Sort helper for DiscoverCard lists ────────────────────────────────────
  const sortCards = (cards: DiscoverCard[]) =>
    [...cards].sort((a, b) => {
      if (a.isScoring && !b.isScoring) return 1;
      if (!a.isScoring && b.isScoring) return -1;
      return (b.score ?? 0) - (a.score ?? 0);
    });

  // Preset filter for tiktok-native (mirrors server-side passesPresetFilter)
  const passesNativePreset = (card: (typeof tiktokNativeCards)[0]) => {
    if (card.isScoring) return false;
    const genderOk = !card.gender || card.gender === 'unknown' || card.gender === 'female';
    const ageOk    = !card.estimatedAge || ['25-34', '35-44', '45-60', 'unknown'].includes(card.estimatedAge);
    const city     = (card.inferredCity ?? '').toLowerCase().trim();
    const cityOk   = !city || city === 'unknown' || city.includes('miami');
    if (card.gender === 'unknown' && card.estimatedAge === 'unknown' && (card.score ?? 0) < 40) return false;
    return genderOk && ageOk && cityOk;
  };

  const filteredNativeCards = tiktokNativeCards
    .filter((c) => c.followersCount >= tiktokNativeFollMin * 1_000 && c.followersCount <= tiktokNativeFollMax * 1_000)
    .filter((c) => showAll || c.isScoring || passesNativePreset(c))
    .sort((a, b) => {
      if (a.isScoring && !b.isScoring) return 1;
      if (!a.isScoring && b.isScoring) return -1;
      return (b.score ?? 0) - (a.score ?? 0);
    });

  const aiVerifiedCount = tiktokNativeCards.filter(passesNativePreset).length;

  // ── Status text ───────────────────────────────────────────────────────────
  const statusText =
    searchMode === 'hashtag'
      ? isSearching      ? "Searching Instagram…"
      : isSearchScoring   ? `${searchScored} / ${searchTotal} scored by Gemini…`
      : hasSearchData     ? `${filteredSearchCards.length} of ${searchTotal} profiles match filters`
      :                     "Enter hashtags to search for influencers"
    : searchMode === 'discovery'
      ? isDiscovering        ? "Scraping Miami locations…"
      : isDiscoverScoring     ? `${discoverScoredCount} / ${discoverTotal} scored by Gemini…`
      : hasDiscoverData       ? `${filteredDiscoverCards.length} of ${discoverTotal} profiles match filters`
      :                         "Click Discover to scan Miami locations for influencers"
    : searchMode === 'tiktok'
      ? isTikToking       ? "Searching TikTok → cross-referencing Instagram…"
      : isTikTokScoring    ? `${tiktokScored} / ${tiktokTotal} scored by Gemini…`
      : hasTiktokData      ? `${filteredTiktokCards.length} of ${tiktokTotal} profiles match filters`
      :                      "Click Search to find Miami influencers via TikTok"
    : isTikTokingNative        ? "Scraping TikTok videos…"
    : isTikTokNativeScoring    ? `${tiktokNativeScoredCount} / ${tiktokNativeTotal} scored by Gemini…`
    : hasTikTokNativeData      ? `${filteredNativeCards.length} of ${tiktokNativeTotal} creators match filters`
    :                            "Enter hashtags to find viral TikTok creators";

  // ── Card renderer (DiscoverCard → InfluencerCard) ─────────────────────────
  const renderDiscoverCard = (card: DiscoverCard) => {
    const formatF = (n: number) =>
      n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `${Math.round(n / 1_000)}K`
      : String(n);
    const initials = (card.fullName || card.username)
      .split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
    const loc = [card.city, card.countryCode].filter(Boolean).join(', ') || undefined;
    const inf: Influencer = {
      name:          card.fullName || card.username,
      username:      `@${card.username}`,
      followers:     formatF(card.followersCount),
      followersRaw:  card.followersCount,
      engagement:    card.engagementRate != null ? `${card.engagementRate.toFixed(1)}%` : '—',
      engagementRaw: card.engagementRate ?? null,
      matchScore:    card.score ?? -1,
      niche:         card.niche ?? '—',
      avatar:        initials,
      profileUrl:    `https://www.instagram.com/${card.username}/`,
      profilePicUrl: card.profilePicUrl,
      location:      loc,
    };
    return <InfluencerCard key={card.username} influencer={inf} scoring={card.isScoring} />;
  };

  // ── Card renderer (TikTokCard → InfluencerCard) ───────────────────────────
  const renderTikTokNativeCard = (card: ReturnType<typeof useTikTokNative>['cards'][0]) => {
    const formatF = (n: number) =>
      n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `${Math.round(n / 1_000)}K`
      : String(n);
    const initials = (card.nickname || card.username)
      .split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
    const inf: Influencer = {
      name:          card.nickname || card.username,
      username:      `@${card.username}`,
      followers:     formatF(card.followersCount),
      followersRaw:  card.followersCount,
      engagement:    `${(card.engagementRate ?? 0).toFixed(1)}%`,
      engagementRaw: card.engagementRate ?? null,
      matchScore:    card.score ?? -1,
      niche:         card.niche ?? '—',
      avatar:        initials,
      profileUrl:    `https://www.tiktok.com/@${card.username}`,
      profilePicUrl: card.profilePicUrl,
      location:      card.inferredCity && card.inferredCity !== 'unknown' ? card.inferredCity : undefined,
      platform:      'tiktok',
    };
    return <InfluencerCard key={card.username} influencer={inf} scoring={card.isScoring} />;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <CampaignSidebar activeView={activeView} onNavigate={setActiveView} />

      {/* Saved view */}
      {activeView === 'Saved' && <SavedView />}

      {/* Search view — always mounted to preserve state */}
      <div className={`flex-1 flex flex-col min-w-0 ${activeView !== 'Search' ? 'hidden' : ''}`}>

        {/* Top Nav */}
        <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 space-y-3">

          {/* Row 1: mode tabs */}
          <div className="flex items-center gap-3">
            <Tabs value={searchMode} onValueChange={handleModeChange} className="shrink-0">
              <TabsList>
                <TabsTrigger value="tiktok" className="gap-1.5 text-xs px-3">
                  <Music2 className="w-3.5 h-3.5" />
                  TikTok → IG
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
          </div>

          {/* Row 2: mode-specific controls */}

          {/* ── Instagram Hashtag ── */}
          {searchMode === 'hashtag' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="miamiinfluencer, miamiblogger..."
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={anyBusy}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                  />
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || anyBusy || !hashtagInput.trim()}
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
                  disabled={anyBusy || !hashtagInput.trim()}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSearching ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                  ) : isSearchScoring ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scoring…</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Reels / Posts toggle */}
                <div className="flex items-center rounded-md border border-input overflow-hidden text-xs shrink-0">
                  <button
                    onClick={() => setMediaType('reels')}
                    disabled={anyBusy}
                    className={`px-3 py-1.5 transition-colors ${mediaType === 'reels' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                  >
                    Reels
                  </button>
                  <button
                    onClick={() => setMediaType('posts')}
                    disabled={anyBusy}
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
                    disabled={anyBusy}
                    className="bg-background border border-input rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value={50}>50 posts</option>
                    <option value={100}>100 posts</option>
                    <option value={200}>200 posts</option>
                    <option value={300}>300 posts</option>
                  </select>
                </div>
                {/* Followers slider */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="w-3 h-3 shrink-0" />
                  <span className="shrink-0 tabular-nums w-24">{searchFollMin}K – {searchFollMax}K</span>
                  <Slider
                    value={[searchFollMin, searchFollMax]}
                    onValueChange={(v) => { setSearchFollMin(v[0]); setSearchFollMax(v[1]); }}
                    min={1} max={500} step={5}
                    className="w-36"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TikTok → IG ── */}
          {searchMode === 'tiktok' && (
            <div className="flex flex-col gap-2">
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
                    disabled={anyBusy}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                  />
                </div>
                <Button
                  onClick={handleTikTok}
                  disabled={anyBusy || !tiktokInput.trim()}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isTikToking ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                  ) : isTikTokScoring ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scoring…</>
                  ) : (
                    <><Music2 className="w-4 h-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>
              {/* Followers slider */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3 h-3 shrink-0" />
                <span className="shrink-0 tabular-nums w-24">{tiktokFollMin}K – {tiktokFollMax}K</span>
                <Slider
                  value={[tiktokFollMin, tiktokFollMax]}
                  onValueChange={(v) => { setTiktokFollMin(v[0]); setTiktokFollMax(v[1]); }}
                  min={1} max={500} step={5}
                  className="w-36"
                />
              </div>
            </div>
          )}

          {/* ── TikTok native ── */}
          {searchMode === 'tiktok-native' && (
            <div className="flex flex-col gap-2">
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
                    disabled={anyBusy}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                  />
                </div>
                <Button
                  onClick={handleTikTokNative}
                  disabled={anyBusy || !tiktokNativeInput.trim()}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isTikTokingNative ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                  ) : (
                    <><Music2 className="w-4 h-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>
              {/* Followers slider */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3 h-3 shrink-0" />
                <span className="shrink-0 tabular-nums w-24">{tiktokNativeFollMin}K – {tiktokNativeFollMax}K</span>
                <Slider
                  value={[tiktokNativeFollMin, tiktokNativeFollMax]}
                  onValueChange={(v) => { setTiktokNativeFollMin(v[0]); setTiktokNativeFollMax(v[1]); }}
                  min={1} max={500} step={5}
                  className="w-36"
                />
              </div>
            </div>
          )}

          {/* ── Miami Discovery ── */}
          {searchMode === 'discovery' && (
            <div className="flex items-center gap-3 flex-wrap">

              {/* Gender toggle */}
              <div className="flex items-center rounded-md border border-input bg-background p-0.5 gap-0.5">
                {(['female', 'male', 'any'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setDiscoverGender(g)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      discoverGender === g
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {g === 'female' ? '♀ Female' : g === 'male' ? '♂ Male' : 'All'}
                  </button>
                ))}
              </div>

              {/* Age range */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Age</span>
                <input
                  type="number"
                  value={discoverAgeMin}
                  onChange={(e) => setDiscoverAgeMin(Number(e.target.value))}
                  min={18} max={99}
                  className="w-12 px-1.5 py-1 rounded border border-input bg-background text-center text-xs text-foreground"
                />
                <span>–</span>
                <input
                  type="number"
                  value={discoverAgeMax}
                  onChange={(e) => setDiscoverAgeMax(Number(e.target.value))}
                  min={18} max={99}
                  className="w-12 px-1.5 py-1 rounded border border-input bg-background text-center text-xs text-foreground"
                />
              </div>

              {/* Followers slider */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3 h-3 shrink-0" />
                <span className="shrink-0 tabular-nums w-24">{discoverFollMin}K – {discoverFollMax}K</span>
                <Slider
                  value={[discoverFollMin, discoverFollMax]}
                  onValueChange={(v) => { setDiscoverFollMin(v[0]); setDiscoverFollMax(v[1]); }}
                  min={1} max={500} step={5}
                  className="w-36"
                />
              </div>

              {/* City */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <input
                  type="text"
                  value={discoverCity}
                  onChange={(e) => setDiscoverCity(e.target.value)}
                  placeholder="city"
                  className="w-20 px-1.5 py-1 rounded border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Posts / Reels toggle — solo en modo hashtag */}
              {discoverMode === 'hashtag' && (
                <div className="flex items-center rounded-md border border-input bg-background p-0.5 gap-0.5">
                  {(['posts', 'reels'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDiscoverMediaType(t)}
                      disabled={isDiscoverBusy}
                      className={`px-2.5 py-1 text-xs rounded transition-colors disabled:opacity-50 capitalize ${
                        discoverMediaType === t
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <div className="w-px h-4 bg-border shrink-0" />

              {/* Toggle # / @ */}
              <div className="flex items-center rounded-md border border-input bg-background p-0.5 gap-0.5 shrink-0">
                <button
                  onClick={() => { setDiscoverMode('hashtag'); setDiscoverSearchInput(''); }}
                  disabled={isDiscoverBusy}
                  className={`px-2.5 py-1 text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1 ${
                    discoverMode === 'hashtag'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Hash className="w-3 h-3" /> Hashtags
                </button>
                <button
                  onClick={() => { setDiscoverMode('username'); setDiscoverSearchInput(''); }}
                  disabled={isDiscoverBusy}
                  className={`px-2.5 py-1 text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1 ${
                    discoverMode === 'username'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="font-semibold leading-none">@</span> Usernames
                </button>
              </div>

              {/* Input contextual */}
              <div className="relative flex-1 min-w-40">
                {discoverMode === 'hashtag' ? (
                  <>
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Vacío = Miami defaults, o custom: miamilux, miamifashion…"
                      value={discoverSearchInput}
                      onChange={(e) => setDiscoverSearchInput(e.target.value)}
                      disabled={isDiscoverBusy}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                    />
                  </>
                ) : (
                  <>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">@</span>
                    <input
                      type="text"
                      placeholder="handle1, handle2, handle3…"
                      value={discoverSearchInput}
                      onChange={(e) => setDiscoverSearchInput(e.target.value)}
                      disabled={isDiscoverBusy}
                      className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow disabled:opacity-50"
                    />
                  </>
                )}
              </div>

              <Button
                onClick={handleDiscover}
                disabled={isDiscoverBusy || (discoverMode === 'username' && !discoverSearchInput.trim())}
                className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isDiscovering ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning…</>
                ) : isDiscoverScoring ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scoring…</>
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
                {searchMode === 'hashtag' ? 'Hashtag Search'
                  : searchMode === 'discovery' ? 'Miami Discovery'
                  : searchMode === 'tiktok' ? 'TikTok → Instagram'
                  : 'TikTok Creators'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{statusText}</p>
            </div>

            {/* Top-right counters */}
            <div className="flex items-center gap-2">
              {searchMode === 'discovery' && hasDiscoverData && (
                <span className="text-xs text-muted-foreground">
                  {isDiscoverScoring
                    ? <><Loader2 className="w-3 h-3 inline animate-spin mr-1" />{discoverScoredCount}/{discoverTotal} scored</>
                    : `${discoverTotal} profiled · ${discoverCards.filter(c => !c.isScoring).length} scored`}
                </span>
              )}
              {searchMode === 'hashtag' && hasSearchData && (
                <span className="text-xs text-muted-foreground">
                  {isSearchScoring
                    ? <><Loader2 className="w-3 h-3 inline animate-spin mr-1" />{searchScored}/{searchTotal} scored</>
                    : `${searchTotal} profiled · ${searchCards.filter(c => !c.isScoring).length} scored`}
                </span>
              )}
              {searchMode === 'tiktok' && hasTiktokData && (
                <span className="text-xs text-muted-foreground">
                  {isTikTokScoring
                    ? <><Loader2 className="w-3 h-3 inline animate-spin mr-1" />{tiktokScored}/{tiktokTotal} scored</>
                    : `${tiktokTotal} profiled · ${tiktokCards.filter(c => !c.isScoring).length} scored`}
                </span>
              )}
              {searchMode === 'tiktok-native' && hasTikTokNativeData && (
                <>
                  <button
                    onClick={() => setShowAll(false)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      !showAll ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    AI Verified ({aiVerifiedCount})
                  </button>
                  <button
                    onClick={() => setShowAll(true)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      showAll ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All ({tiktokNativeTotal})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats banners */}
          {searchMode === 'discovery' && hasDiscoverData && discoverStats && (
            <div className="text-xs text-muted-foreground leading-relaxed mb-4">
              {discoverActiveMode === 'username' ? (
                <>
                  <span className="font-medium">{discoverStats.afterPreFilter}</span> usernames
                  {" → "}<span className="font-medium">{discoverStats.afterQualityFilter}</span> profiled
                </>
              ) : (
                <>
                  <span className="font-medium">{discoverStats.hashtagPostsFound}</span> location posts
                  {" → "}<span className="font-medium">{discoverStats.afterPreFilter}</span> pre-filtered
                  {" → "}<span className="font-medium">{discoverStats.afterQualityFilter}</span> profiled
                </>
              )}
              {" → "}
              {isDiscoverScoring
                ? <><Loader2 className="w-3 h-3 inline animate-spin mx-0.5" /><span className="font-medium">{discoverScoredCount}</span>/{discoverTotal} scoring…</>
                : <><span className="font-medium text-foreground">{discoverScoredCount}</span> scored · <span className="font-medium text-foreground">{filteredDiscoverCards.length}</span> visible con filtros actuales</>
              }
            </div>
          )}

          {searchMode === 'hashtag' && hasSearchData && searchStats && (
            <div className="text-xs text-muted-foreground leading-relaxed mb-4">
              <span className="font-medium">{searchStats.hashtagPostsFound}</span> posts scraped
              {" → "}<span className="font-medium">{searchStats.afterPreFilter}</span> pre-filtered
              {" → "}<span className="font-medium">{searchStats.afterQualityFilter}</span> profiled
              {" → "}
              {isSearchScoring
                ? <><Loader2 className="w-3 h-3 inline animate-spin mx-0.5" /><span className="font-medium">{searchScored}</span>/{searchTotal} scoring…</>
                : <><span className="font-medium text-foreground">{searchScored}</span> scored · <span className="font-medium text-foreground">{filteredSearchCards.length}</span> visible with filters</>
              }
            </div>
          )}

          {searchMode === 'tiktok' && hasTiktokData && tiktokStats && (
            <div className="text-xs text-muted-foreground leading-relaxed mb-4">
              <span className="font-medium">{tiktokStats.hashtagPostsFound}</span> TikTok authors
              {" → "}<span className="font-medium">{tiktokStats.afterPreFilter}</span> pre-filtered
              {" → "}<span className="font-medium">{tiktokStats.afterQualityFilter}</span> profiled
              {" → "}
              {isTikTokScoring
                ? <><Loader2 className="w-3 h-3 inline animate-spin mx-0.5" /><span className="font-medium">{tiktokScored}</span>/{tiktokTotal} scoring…</>
                : <><span className="font-medium text-foreground">{tiktokScored}</span> scored · <span className="font-medium text-foreground">{filteredTiktokCards.length}</span> visible with filters</>
              }
            </div>
          )}

          {searchMode === 'tiktok-native' && hasTikTokNativeData && tiktokNativeStats && (
            <div className="text-xs text-muted-foreground leading-relaxed mb-4">
              <span className="font-medium">{tiktokNativeStats.hashtagPostsFound}</span> TikTok videos
              {" → "}<span className="font-medium">{tiktokNativeStats.afterPreFilter}</span> pre-filtered
              {" → "}<span className="font-medium">{tiktokNativeStats.afterProfileFilter}</span> profiled
              {" → "}
              {isTikTokNativeScoring
                ? <><Loader2 className="w-3 h-3 inline animate-spin mx-0.5" /><span className="font-medium">{tiktokNativeScoredCount}</span>/{tiktokNativeTotal} scoring…</>
                : <><span className="font-medium text-foreground">{tiktokNativeScoredCount}</span> scored · <span className="font-medium text-foreground">{aiVerifiedCount}</span> AI verified</>
              }
            </div>
          )}

          {/* Scoring progress banners */}
          {searchMode === 'discovery' && isDiscoverScoring && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm mb-5">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
              <span className="text-primary">
                <span className="font-medium">Gemini analizando {discoverTotal} perfiles</span>
                {" — "}{discoverScoredCount} listos, {discoverTotal - discoverScoredCount} en cola. Los filtros ya funcionan en tiempo real.
              </span>
            </div>
          )}

          {searchMode === 'hashtag' && isSearchScoring && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm mb-5">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
              <span className="text-primary">
                <span className="font-medium">Gemini scoring {searchTotal} profiles</span>
                {" — "}{searchScored} done, {searchTotal - searchScored} in queue. The follower slider works in real time.
              </span>
            </div>
          )}

          {searchMode === 'tiktok' && isTikTokScoring && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm mb-5">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
              <span className="text-primary">
                <span className="font-medium">Gemini scoring {tiktokTotal} profiles</span>
                {" — "}{tiktokScored} done, {tiktokTotal - tiktokScored} in queue. The follower slider works in real time.
              </span>
            </div>
          )}

          {searchMode === 'tiktok-native' && isTikTokNativeScoring && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm mb-5">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
              <span className="text-primary">
                <span className="font-medium">Gemini scoring {tiktokNativeTotal} creators</span>
                {" — "}{tiktokNativeScoredCount} done, {tiktokNativeTotal - tiktokNativeScoredCount} in queue. Creators appear as they're scored.
              </span>
            </div>
          )}

          {/* Hashtag analysis panel */}
          {searchMode === 'hashtag' && analysisResult && (
            <HashtagAnalysisPanel
              result={analysisResult}
              onAddSuggestion={handleAddSuggestion}
            />
          )}

          {/* Info panels (idle states) */}
          {searchMode === 'tiktok' && !isTikToking && !isTikTokScoring && !hasTiktokData && (
            <div className="rounded-xl border border-border bg-muted/30 p-6 mb-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">How TikTok → Instagram works</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Searches TikTok by the entered hashtags and extracts unique authors</li>
                <li>Cross-references those usernames against Instagram (same handle ~80% of the time)</li>
                <li>Use the follower slider to filter results in real time without re-fetching</li>
                <li>Gemini verifies gender · age 25–60 · Miami and scores each profile</li>
              </ul>
            </div>
          )}

          {searchMode === 'tiktok-native' && tiktokNativeStage === 'idle' && (
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

          {searchMode === 'discovery' && discoverStage === 'idle' && (
            <div className="rounded-xl border border-border bg-muted/30 p-6 mb-5 text-sm text-muted-foreground">
              {discoverMode === 'hashtag' ? (
                <>
                  <p className="font-medium text-foreground mb-2">Modo # Hashtags — Miami Discovery</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Dejá el input vacío para usar los hashtags Miami por defecto (miamigirl, wynwoodmiami, southbeachmiami…)</li>
                    <li>O ingresá hashtags propios separados por coma para buscar en otro nicho</li>
                    <li>Los perfiles aparecen en cuanto Apify termina — Gemini los verifica en paralelo</li>
                    <li>El género, edad, ciudad y seguidores filtran en tiempo real sin re-buscar</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground mb-2">Modo @ Usernames — Miami Discovery</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Ingresá usernames de Instagram directamente (handle1, handle2…)</li>
                    <li>Se saltea el scraping de hashtags — Apify va directo al profile scraper</li>
                    <li>Ideal para analizar una lista de cuentas conocidas o candidatos específicos</li>
                    <li>Gemini score, género, edad y ciudad funcionan igual que en el modo hashtag</li>
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Error display */}
          {isError && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{(activeError as Error)?.message}</span>
            </div>
          )}

          {/* Skeleton during initial scan */}
          {(
            (searchMode === 'discovery' && isDiscovering) ||
            (searchMode === 'hashtag' && isSearching) ||
            (searchMode === 'tiktok' && isTikToking) ||
            (searchMode === 'tiktok-native' && isTikTokingNative)
          ) && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 rounded-xl border border-border bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {/* Discovery cards */}
          {searchMode === 'discovery' && hasDiscoverData && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortCards(filteredDiscoverCards).map(renderDiscoverCard)}
              {filteredDiscoverCards.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-16 text-sm">
                  Ningún perfil coincide con los filtros actuales.
                </p>
              )}
            </div>
          )}

          {/* Hashtag cards */}
          {searchMode === 'hashtag' && hasSearchData && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortCards(filteredSearchCards).map(renderDiscoverCard)}
              {filteredSearchCards.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-16 text-sm">
                  No profiles match the current filters.
                </p>
              )}
            </div>
          )}

          {/* TikTok → IG cards */}
          {searchMode === 'tiktok' && hasTiktokData && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortCards(filteredTiktokCards).map(renderDiscoverCard)}
              {filteredTiktokCards.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-16 text-sm">
                  No profiles match the current filters.
                </p>
              )}
            </div>
          )}

          {/* TikTok native cards */}
          {searchMode === 'tiktok-native' && hasTikTokNativeData && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredNativeCards.map(renderTikTokNativeCard)}
              {filteredNativeCards.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-16 text-sm">
                  No creators match the current filters.
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
