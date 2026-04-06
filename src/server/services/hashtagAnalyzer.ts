import { GoogleGenerativeAI } from '@google/generative-ai';

let _client: GoogleGenerativeAI | null = null;

function client() {
  if (!_client) {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error('GOOGLE_API_KEY is not set');
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

export interface HashtagAnalysisResult {
  analysis: string;
  warnings: string[];
  suggestions: string[];
  efficiency_score: number;
}

export async function analyzeHashtags(hashtags: string[]): Promise<HashtagAnalysisResult> {
  const prompt = `You are a Senior Influencer Marketing Strategist specialized in Luxury and Fine Jewelry in the USA.

Task: Analyze the following hashtags and score their effectiveness for finding real INFLUENCERS (people), NOT competitors (stores, brands, shops).

Hashtags to analyze: [${hashtags.map((h) => `#${h}`).join(', ')}]

SCORING RULES — be generous when tags match these criteria:
- Tags containing "influencer", "blogger", "creator", "contentcreator" → +25 pts each, HIGH efficiency
- Tags that are location-specific to Miami/Florida/USA lifestyle → +20 pts each
- Tags combining location + lifestyle (e.g. #miamiblogger, #miamilifestyleblogger) → HIGH efficiency, 80-100 score
- Tags that are broad lifestyle (e.g. #miamilifestyle, #miamiluxury) → MEDIUM efficiency, warn about noise but do NOT penalize heavily
- Tags that are pure product/jewelry (e.g. #jewelry, #diamonds) → LOW efficiency, heavy warning
- Tags with "boutique", "shop", "store", "brand" → LOW efficiency, warn strongly

WARNINGS: Only warn about a hashtag if it is clearly a product/store tag. Do NOT warn about lifestyle or influencer tags.

SUGGESTIONS: Provide 3-5 hashtags that are STRICTLY influencer/creator/blogger tags for Miami.
NEVER suggest tags containing: boutique, shop, store, jewelry, jewel, diamond, brand, collection.
ONLY suggest tags like: miamiluxuryinfluencer, miamifashionblogger, southfloridacreator, miamilifestyleblogger, miamicontentcreator, brickellblogger, coralgablesblogger, miamimomblogger.

IMPORTANT: If ALL input hashtags are influencer/blogger/lifestyle tags with no product/store tags, the efficiency_score MUST be between 80-100.

Respond ONLY with valid JSON, no additional text or markdown blocks. All text fields must be in English:
{
  "analysis": "Brief 2-line strategic explanation in English",
  "warnings": ["Only list hashtags that are clearly store/product tags — omit this array if none"],
  "suggestions": ["3 to 5 strictly influencer/blogger hashtags for Miami, without the # symbol"],
  "efficiency_score": 0-100
}`;

  const model = client().getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Gemini returned non-JSON: ${text}`);
  }

  return JSON.parse(jsonMatch[0]) as HashtagAnalysisResult;
}
