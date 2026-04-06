import { GoogleGenerativeAI } from '@google/generative-ai';
import { InstagramProfile } from '../types';

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

SOBRE MONISHA MELWANI:
- Fine jewelry con diamantes naturales y lab-grown
- Everyday luxury, piezas para usar y layerar
- Showroom en Miami, FL
- Audiencia objetivo: mujeres 25-45, poder adquisitivo medio-alto, USA
- Busca influencers auténticos, no marcas ni shops

CRITERIOS DE MATCH:
- Ubicación Miami/USA: +20 puntos
- Nicho lifestyle/fashion/beauty/luxury: +20 puntos
- Seguidores entre 10K-150K: +15 puntos
- Engagement > 3%: +15 puntos
- Bio personal (parece persona real): +15 puntos
- Verificado o URL profesional: +10 puntos
- Mención de familia/maternidad/bridal: +5 puntos

PENALIZACIONES:
- Palabras de shop/tienda en bio: -50 puntos
- Sin bio: -30 puntos
- Menos de 1K o más de 500K seguidores: -20 puntos

Respondé SOLO con JSON válido, sin texto adicional ni bloques markdown:
{
  "score": 0-100,
  "label": "High Match" | "Medium Match" | "Low Match",
  "reason": "brief explanation in English (1 line)",
  "niche": "categoría del perfil (ej: Lifestyle Miami, Fashion Blogger, etc.)"
}`;

  const model = client().getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
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
