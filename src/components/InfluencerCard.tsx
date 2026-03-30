import { Users, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import MatchRing from "@/components/MatchRing";
import { Badge } from "@/components/ui/badge";

export interface Influencer {
  name: string;
  username: string;
  followers: string;
  engagement: string;
  requirement: string;
  matchScore: number;
  niche: string;
  avatar: string;
}

const InfluencerCard = ({ influencer }: { influencer: Influencer }) => {
  return (
    <div className="group bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground overflow-hidden">
            {influencer.avatar}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-card-foreground truncate">{influencer.name}</h3>
          <p className="text-sm text-muted-foreground">{influencer.username}</p>
          <Badge variant="secondary" className="mt-1.5 text-xs font-medium">
            {influencer.niche}
          </Badge>
        </div>
        <MatchRing score={influencer.matchScore} size={56} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
          <Users className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="text-sm font-semibold text-card-foreground">{influencer.followers}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className="text-sm font-semibold text-card-foreground">{influencer.engagement}</p>
          </div>
        </div>
      </div>

      {/* Requirement */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <DollarSign className="w-3.5 h-3.5" />
        <span>Min. fee: {influencer.requirement}</span>
      </div>

      {/* Action */}
      <Button className="w-full mt-auto bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
        View Profile
      </Button>
    </div>
  );
};

export default InfluencerCard;
