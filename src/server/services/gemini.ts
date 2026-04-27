import { GoogleGenerativeAI } from '@google/generative-ai';
import { InstagramProfile, TikTokCreator } from '../types';

let _client: GoogleGenerativeAI | null = null;

function client() {
  if (!_client) {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error('GOOGLE_API_KEY is not set');
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

export interface ScoreResult {
  score: number;
  label: 'High Match' | 'Medium Match' | 'Low Match';
  reason: string;
  niche: string;
  gender: 'female' | 'male' | 'unknown';
  estimatedAge: 'under25' | '25-34' | '35-44' | '45-60' | 'over60' | 'unknown';
  inferredCity: string;
}

export async function scoreInfluencer(
  profile: InstagramProfile,
  engagementRate: number
): Promise<ScoreResult> {
  const prompt = `You are an influencer marketing expert for a wellness, beauty, and spa brand.
Analyze this Instagram profile and calculate a match score from 0 to 100
for Ciao Bella Salon, Day Spa & Wellness Center.

PROFILE:
Username: ${profile.username}
Full Name: ${profile.fullName}
Bio: ${profile.biography}
Followers: ${profile.followersCount}
Posts: ${profile.postsCount}
Verified: ${profile.isVerified}
External URL: ${profile.externalUrl ?? 'none'}
Estimated Engagement: ${engagementRate.toFixed(2)}%
City (Apify): ${profile.city ?? 'not available'}
Country (Apify): ${profile.countryCode ?? 'not available'}

ABOUT CIAO BELLA:
- Voted #1 Salon, Day Spa & Wellness Center in Islamorada, Florida Keys
- 20+ years delivering premium beauty and holistic self-care
- Services: therapeutic massage, anti-aging skincare, infrared yoga, sound therapy,
  salt infrared sauna, red light therapy, compression therapy, hair care,
  nail services, organic spray tanning, clean waxing, day retreats
- WeddingWire award winner for destination wedding hair & makeup
- Target audience: women 25-60 who value wellness, self-care, and beauty
- Seeking authentic influencers in Florida Keys, South Florida, or wellness/travel niches

MATCH CRITERIA (score 0-100):
- Location Florida Keys / South Florida / Miami: +25 points
- Female gender: +20 points
- Apparent age 25-60: +15 points
- Wellness / beauty / self-care / spa / lifestyle niche: +15 points
- Engagement > 3%: +10 points
- Personal bio (seems like a real person): +10 points
- Mention of bridal/wedding, travel/destination, holistic health, or yoga: +5 points

PENALTIES:
- Shop/store/business service words in bio: -50 points
- No bio: -30 points
- Clearly male gender detected: -40 points
- Age clearly outside 25-60 range: -30 points
- Location clearly outside Florida/USA: -20 points

REQUIRED CLASSIFICATION — Infer from name, bio, Apify city, and writing style:

gender: Determine if the profile seems female ("female"), male ("male"), or undetermined ("unknown"). Base on full name, pronouns, bio style.

estimatedAge: Estimate age range from language, interests, and bio context:
  - "under25": appears under 25 (very young language, college student)
  - "25-34": young adult
  - "35-44": mature adult
  - "45-60": active senior adult
  - "over60": appears over 60
  - "unknown": insufficient information

inferredCity: Lowercase city name where the profile is based.
  Use Apify city if available. Otherwise look for bio mentions (e.g. "Keys girl", "Miami based", "living in Florida").
  If not determinable with reasonable certainty, return "unknown".

Respond ONLY with valid JSON, no additional text or markdown blocks:
{
  "score": 0-100,
  "label": "High Match" | "Medium Match" | "Low Match",
  "reason": "brief explanation in English (1 line)",
  "niche": "profile category (e.g. Wellness Florida Keys, Beauty Blogger, Lifestyle Miami, etc.)",
  "gender": "female" | "male" | "unknown",
  "estimatedAge": "under25" | "25-34" | "35-44" | "45-60" | "over60" | "unknown",
  "inferredCity": "city name in lowercase or unknown"
}`;

  const model = client().getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`Gemini returned non-JSON for @${profile.username}: ${text}`);
  }

  return JSON.parse(jsonMatch[0]) as ScoreResult;
}

export async function scoreTikTokCreator(creator: TikTokCreator): Promise<ScoreResult> {
  const prompt = `You are an influencer marketing expert for a wellness, beauty, and spa brand.
Analyze this TikTok creator profile and calculate a match score from 0 to 100
for Ciao Bella Salon, Day Spa & Wellness Center.

PROFILE:
Username: ${creator.username}
Display Name: ${creator.nickname}
Bio: ${creator.bio || 'no bio'}
Followers: ${creator.followersCount}
Videos: ${creator.videosCount}
Avg Views per video: ${Math.round(creator.avgViews)}
Avg Likes per video: ${Math.round(creator.avgLikes)}
Engagement Rate: ${creator.engagementRate.toFixed(2)}%
Sample captions: ${creator.topCaptions.slice(0, 3).join(' | ') || 'none'}

ABOUT CIAO BELLA:
- Voted #1 Salon, Day Spa & Wellness Center in Islamorada, Florida Keys
- 20+ years delivering premium beauty and holistic self-care
- Services: therapeutic massage, anti-aging skincare, infrared yoga, sound therapy,
  salt infrared sauna, red light therapy, compression therapy, hair care,
  nail services, organic spray tanning, clean waxing, day retreats
- WeddingWire award winner for destination wedding hair & makeup
- Target audience: women 25-60 who value wellness, self-care, and beauty
- Seeking authentic influencers in Florida Keys, South Florida, or wellness/travel niches

MATCH CRITERIA (score 0-100):
- Location Florida Keys / South Florida / Miami: +25 points
- Female gender: +20 points
- Apparent age 25-60: +15 points
- Wellness / beauty / self-care / spa / lifestyle niche: +15 points
- Engagement > 3%: +10 points
- Personal bio (seems like a real person): +10 points
- Mention of bridal/wedding, travel/destination, holistic health, or yoga: +5 points

PENALTIES:
- Shop/store/business service words in bio or captions: -50 points
- No bio: -30 points
- Clearly male gender detected: -40 points
- Age clearly outside 25-60 range: -30 points
- Location clearly outside Florida/USA: -20 points

REQUIRED CLASSIFICATION:
gender: Determine if the profile seems female ("female"), male ("male"), or undetermined ("unknown"). Base on display name, pronouns, bio style, and caption topics.
estimatedAge: Estimate age range: "under25", "25-34", "35-44", "45-60", "over60", or "unknown"
inferredCity: Lowercase city name where the creator is based, or "unknown"

Respond ONLY with valid JSON, no additional text or markdown blocks:
{
  "score": 0-100,
  "label": "High Match" | "Medium Match" | "Low Match",
  "reason": "brief explanation in English (1 line)",
  "niche": "profile category (e.g. Wellness Florida Keys, Beauty Creator, Lifestyle Travel, etc.)",
  "gender": "female" | "male" | "unknown",
  "estimatedAge": "under25" | "25-34" | "35-44" | "45-60" | "over60" | "unknown",
  "inferredCity": "city name in lowercase or unknown"
}`;

  const model = client().getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`Gemini returned non-JSON for @${creator.username}: ${text}`);
  }

  return JSON.parse(jsonMatch[0]) as ScoreResult;
}
