export interface HashtagPost {
  ownerUsername: string;
  ownerFullName: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  hashtags: string[];
  timestamp: string;
  url?: string;
}

export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified: boolean;
  isBusinessAccount: boolean;
  externalUrl: string | null;
  profilePicUrl?: string;
  city?: string;
  countryCode?: string;
}

export interface ScoredInfluencer extends InstagramProfile {
  score: number;
  label: 'High Match' | 'Medium Match' | 'Low Match';
  reason: string;
  niche: string;
  engagementRate: number;
  gender?: 'female' | 'male' | 'unknown';
  estimatedAge?: string;
  inferredCity?: string;
}

export interface UserPost {
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  timestamp?: string;
  caption?: string;
  hashtags?: string[];
}

export interface SearchRequest {
  hashtags: string | string[];
  maxResults?: number;
  resultsType?: 'posts' | 'reels';
  postsLimit?: number;
}

export interface DiscoverRequest {
  seeds?: string[];
  resultsType?: 'posts' | 'reels';
  mode?: 'hashtag' | 'username';
  customHashtags?: string[];
  usernames?: string[];
  seedUsername?: string;
}

export interface TikTokRequest {
  hashtags?: string[];  // TikTok hashtags to search (defaults to Miami preset)
}

export interface TikTokCreator {
  username: string;
  nickname: string;
  bio: string;
  followersCount: number;
  videosCount: number;
  profilePicUrl?: string;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  topCaptions: string[];
}

export interface ScoredTikTokCreator extends TikTokCreator {
  score: number;
  label: 'High Match' | 'Medium Match' | 'Low Match';
  reason: string;
  niche: string;
  gender?: 'female' | 'male' | 'unknown';
  estimatedAge?: string;
  inferredCity?: string;
}

export interface TikTokNativeRequest {
  hashtags?: string[];
}

export interface SearchResponse {
  influencers: ScoredInfluencer[];
  stats: {
    hashtagPostsFound: number;
    afterPreFilter: number;
    afterProfileFilter: number;
    final: number;
  };
}
