import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CampaignSidebar from "@/components/CampaignSidebar";
import InfluencerCard, { type Influencer } from "@/components/InfluencerCard";

const influencers: Influencer[] = [
  {
    name: "Valentina R.",
    username: "@valenstyle",
    followers: "52K",
    engagement: "4.5%",
    requirement: "$500",
    matchScore: 94,
    niche: "Fashion",
    avatar: "VR",
  },
  {
    name: "Sofia Minimal",
    username: "@sofiamin",
    followers: "15K",
    engagement: "7.1%",
    requirement: "Gifting",
    matchScore: 88,
    niche: "Minimalist",
    avatar: "SM",
  },
  {
    name: "Camila Lux",
    username: "@camilux",
    followers: "120K",
    engagement: "1.2%",
    requirement: "$2,000",
    matchScore: 45,
    niche: "Luxury",
    avatar: "CL",
  },
  {
    name: "Martina Vibes",
    username: "@marti_vibes",
    followers: "8K",
    engagement: "9.0%",
    requirement: "$100",
    matchScore: 76,
    niche: "Lifestyle",
    avatar: "MV",
  },
  {
    name: "Lucia Joyas",
    username: "@lu.jewelry",
    followers: "35K",
    engagement: "3.8%",
    requirement: "$400",
    matchScore: 62,
    niche: "Jewelry",
    avatar: "LJ",
  },
];

const Index = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("match");

  const filtered = influencers
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.username.toLowerCase().includes(search.toLowerCase()) ||
        i.niche.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "match") return b.matchScore - a.matchScore;
      if (sortBy === "engagement") return parseFloat(b.engagement) - parseFloat(a.engagement);
      if (sortBy === "followers") {
        const parse = (s: string) => parseFloat(s.replace("K", "")) * 1000;
        return parse(b.followers) - parse(a.followers);
      }
      return 0;
    });

  return (
    <div className="flex min-h-screen bg-background">
      <CampaignSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Nav */}
        <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, username, or niche..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
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

        {/* Main Grid */}
        <main className="flex-1 p-6">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-foreground">Discover Influencers</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} influencer{filtered.length !== 1 ? "s" : ""} match your campaign
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((influencer) => (
              <InfluencerCard key={influencer.username} influencer={influencer} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
