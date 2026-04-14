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
  const prompt = `Sos un experto en influencer marketing para marcas de fine jewelry.
Analizá este perfil de Instagram y calculá un match score del 0 al 100
para la marca Monisha Melwani Fine Jewelry.

PERFIL:
Username: ${profile.username}
Nombre: ${profile.fullName}
Bio: ${profile.biography}
Seguidores: ${profile.followersCount}
Posts: ${profile.postsCount}
Verificado: ${profile.isVerified}
URL externa: ${profile.externalUrl ?? 'ninguna'}
Engagement estimado: ${engagementRate.toFixed(2)}%
Ciudad (Apify): ${profile.city ?? 'no disponible'}
País (Apify): ${profile.countryCode ?? 'no disponible'}

SOBRE MONISHA MELWANI:
- Fine jewelry con diamantes naturales y lab-grown
- Everyday luxury, piezas para usar y layerar
- Showroom en Miami, FL
- Audiencia objetivo: mujeres entre 25-60 años, poder adquisitivo medio-alto, USA
- Busca influencers auténticos de Miami o zona sur de Florida

CRITERIOS DE MATCH (score 0-100):
- Ubicación Miami/South Florida: +25 puntos
- Género femenino: +20 puntos
- Edad aparente entre 25-60: +15 puntos
- Nicho lifestyle/fashion/beauty/luxury: +15 puntos
- Engagement > 3%: +10 puntos
- Bio personal (parece persona real): +10 puntos
- Mención de familia/maternidad/bridal/wedding: +5 puntos

PENALIZACIONES:
- Palabras de shop/tienda en bio: -50 puntos
- Sin bio: -30 puntos
- Género masculino claramente detectado: -40 puntos
- Edad claramente fuera del rango 25-60: -30 puntos
- Ubicación claramente fuera de Miami/Florida: -20 puntos

CLASIFICACIÓN REQUERIDA — Inferí con la info disponible (nombre, bio, ciudad Apify, estilo):

gender: Determiná si el perfil parece ser de una mujer ("female"), un hombre ("male"), o no se puede determinar ("unknown"). Basate en el nombre completo, pronombres en la bio, estilo de escritura.

estimatedAge: Estimá el rango de edad según lenguaje, intereses y contexto de la bio:
  - "under25": parece menor de 25 (ej: lenguaje muy joven, estudiante universitario)
  - "25-34": adulto joven
  - "35-44": adulto maduro
  - "45-60": adulto senior activo
  - "over60": parece mayor de 60
  - "unknown": no hay información suficiente

inferredCity: Nombre de la ciudad en minúsculas donde vive o está basado el perfil.
  Usá la ciudad de Apify si está disponible. Si no, buscá menciones en la bio (ej: "Miami mom", "NYC based", "living in LA").
  Si no podés determinarlo con razonable certeza, devolvé "unknown".

Respondé SOLO con JSON válido, sin texto adicional ni bloques markdown:
{
  "score": 0-100,
  "label": "High Match" | "Medium Match" | "Low Match",
  "reason": "brief explanation in English (1 line)",
  "niche": "categoría del perfil (ej: Lifestyle Miami, Fashion Blogger, etc.)",
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
  const prompt = `You are an influencer marketing expert for a fine jewelry brand.
Analyze this TikTok creator profile and calculate a match score from 0 to 100
for the brand Monisha Melwani Fine Jewelry.

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

ABOUT MONISHA MELWANI:
- Fine jewelry with natural and lab-grown diamonds
- Everyday luxury, pieces to wear and layer
- Showroom in Miami, FL
- Target audience: women 25-60 years old, mid-to-high purchasing power, USA
- Looking for authentic Miami influencers or South Florida area

MATCH CRITERIA (score 0-100):
- Location Miami/South Florida: +25 points
- Female gender: +20 points
- Apparent age 25-60: +15 points
- Lifestyle/fashion/beauty/luxury niche: +15 points
- Engagement > 3%: +10 points
- Personal bio (seems like a real person): +10 points
- Family/maternity/bridal/wedding mention: +5 points

PENALTIES:
- Shop/store words in bio or captions: -50 points
- No bio: -30 points
- Clearly male gender detected: -40 points
- Age clearly outside 25-60 range: -30 points
- Location clearly outside Miami/Florida: -20 points

REQUIRED CLASSIFICATION:
gender: Determine if the profile seems female ("female"), male ("male"), or undetermined ("unknown"). Base on display name, pronouns, bio style, and caption topics.
estimatedAge: Estimate age range: "under25", "25-34", "35-44", "45-60", "over60", or "unknown"
inferredCity: Lowercase city name where the creator is based, or "unknown"

Respond ONLY with valid JSON, no additional text or markdown blocks:
{
  "score": 0-100,
  "label": "High Match" | "Medium Match" | "Low Match",
  "reason": "brief explanation in English (1 line)",
  "niche": "profile category (e.g. Lifestyle Miami, Fashion Creator, etc.)",
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
