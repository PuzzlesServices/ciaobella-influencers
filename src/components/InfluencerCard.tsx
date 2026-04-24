'use client';

import { useState } from "react";
import { Users, TrendingUp, Loader2, Bookmark, BookmarkCheck, ExternalLink, BarChart2, Zap, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import MatchRing from "@/components/MatchRing";
import { Badge } from "@/components/ui/badge";
import { useSaveInfluencer, useUnsaveInfluencer } from "@/hooks/useSaveInfluencer";
import { useEngagementScrape } from "@/hooks/useEngagementScrape";

export interface Influencer {
  name: string;
  username: string;       // includes @ prefix
  followers: string;
  followersRaw: number;
  engagement: string;
  engagementRaw: number | null;  // numeric rate from DB/search, null if unknown
  matchScore: number;
  niche: string;
  avatar: string;
  profileUrl: string;
  profilePicUrl?: string;
  location?: string;
  platform?: 'instagram' | 'tiktok';
}

function EngagementLabel({ rate }: { rate: number }) {
  const { label, classes } =
    rate >= 6 ? { label: 'Excellent', classes: 'bg-green-100 text-green-700' } :
    rate >= 3 ? { label: 'Good',      classes: 'bg-blue-100 text-blue-700'  } :
    rate >= 1 ? { label: 'Average',   classes: 'bg-yellow-100 text-yellow-700' } :
                { label: 'Low',       classes: 'bg-red-100 text-red-700'    };

  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

const InfluencerCard = ({
  influencer,
  defaultSaved = false,
  scoring = false,
}: {
  influencer: Influencer;
  defaultSaved?: boolean;
  scoring?: boolean;
}) => {
  const [isSaved, setIsSaved] = useState(defaultSaved);
  const [realEngagement, setRealEngagement] = useState<string | null>(
    influencer.engagementRaw != null ? `${influencer.engagementRaw.toFixed(1)}%` : null
  );
  const [viralPosts, setViralPosts] = useState(0);

  const { mutate: save, isPending: isSaving } = useSaveInfluencer();
  const { mutate: unsave, isPending: isUnsaving } = useUnsaveInfluencer();
  const { mutate: scrapeEngagement, isPending: isScraping } = useEngagementScrape();

  const rawUsername = influencer.username.replace(/^@/, '');
  const isTikTok = influencer.platform === 'tiktok';

  const handleSave = () => {
    if (isSaved) return;
    save(
      {
        username:      rawUsername,
        name:          influencer.name,
        profilePicUrl: influencer.profilePicUrl,
        followersRaw:  influencer.followersRaw,
        engagementRaw: influencer.engagementRaw,
        matchScore:    influencer.matchScore,
        niche:         influencer.niche,
      },
      { onSuccess: () => setIsSaved(true) }
    );
  };

  const handleUnsave = () => {
    unsave(rawUsername, { onSuccess: () => setIsSaved(false) });
  };

  const handleCalculateEngagement = () => {
    scrapeEngagement({ username: rawUsername, followersCount: influencer.followersRaw }, {
      onSuccess: ({ engagementRate, postsAnalyzed, viralPostsCount }) => {
        setRealEngagement(`${engagementRate.toFixed(1)}% · ${postsAnalyzed}p`);
        setViralPosts(viralPostsCount);
      },
    });
  };

  const hasCachedEngagement = influencer.engagementRaw != null;

  return (
    <div className={`group bg-card rounded-xl border p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col ${
      scoring ? 'border-primary/30 animate-pulse-border' : 'border-border'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground shrink-0 overflow-hidden">
          {influencer.profilePicUrl ? (
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(influencer.profilePicUrl)}`}
              alt={influencer.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
              }}
            />
          ) : null}
          <span
            className="w-full h-full flex items-center justify-center"
            style={{ display: influencer.profilePicUrl ? 'none' : 'flex' }}
          >
            {influencer.avatar}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-card-foreground truncate">{influencer.name}</h3>
          <p className="text-sm text-muted-foreground">{influencer.username}</p>
          <Badge variant="secondary" className="mt-1.5 text-xs font-medium">
            {influencer.niche}
          </Badge>
          {influencer.location && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{influencer.location}</span>
            </div>
          )}
        </div>
        <MatchRing score={influencer.matchScore} size={56} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Followers */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="text-sm font-semibold text-card-foreground">{influencer.followers}</p>
          </div>
        </div>

        {/* Engagement */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
          <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Engagement</p>
            {realEngagement ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-card-foreground">{realEngagement}</p>
                <EngagementLabel rate={parseFloat(realEngagement)} />
                {viralPosts > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                    <Zap className="w-2.5 h-2.5" />
                    {viralPosts} viral
                  </span>
                )}
                {!isTikTok && (
                  <button
                    onClick={handleCalculateEngagement}
                    disabled={isScraping}
                    title={hasCachedEngagement ? 'Recalculate from last 5 posts' : 'Calculate from last 5 posts'}
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {isScraping ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <BarChart2 className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            ) : !isTikTok ? (
              <button
                onClick={handleCalculateEngagement}
                disabled={isScraping}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 mt-0.5"
              >
                {isScraping ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</>
                ) : (
                  <><BarChart2 className="w-3 h-3" /> Calculate</>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {isSaved ? (
          <Button
            onClick={handleUnsave}
            disabled={isUnsaving}
            variant="outline"
            className="flex-1 font-medium border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            {isUnsaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Removing…</>
            ) : (
              <><BookmarkCheck className="w-4 h-4 mr-2" /> Unsave</>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              <><Bookmark className="w-4 h-4 mr-2" /> Save</>
            )}
          </Button>
        )}

        <Button
          onClick={() => window.open(influencer.profileUrl, '_blank', 'noopener,noreferrer')}
          variant="outline"
          size="icon"
          className="shrink-0"
          title={isTikTok ? 'View TikTok profile' : 'View Instagram profile'}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default InfluencerCard;
