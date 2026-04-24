import { InstagramProfile } from '../types';

const BUSINESS_BIO_KEYWORDS = [
  // tiendas
  'shop', 'store', 'boutique', 'jewelry', 'jewels', 'order now',
  'dm to buy', 'dm for price', 'shipping', 'cod', 'wholesale',
  'tienda', 'joyeria', 'joyería',
  // restaurantes / venues
  'restaurant', 'bar', 'grill', 'kitchen', 'café', 'cafe', 'bistro',
  'eatery', 'diner', 'lounge', 'nightclub', 'club', 'venue', 'rooftop',
  'cocktails', 'tapas', 'sushi', 'steakhouse', 'pizzeria', 'bakery',
  'reservations', 'open table', 'happy hour',
];

const BUSINESS_NAME_PATTERNS = [
  /restaurant/i, /\bbar\b/i, /grill/i, /kitchen/i, /lounge/i,
  /nightclub/i, /\bclub\b/i, /venue/i, /hotel/i, /resort/i,
];

// Quality filter — removes bots, venues, and empty profiles.
// Does NOT filter by follower range (that's client-side).
export function postProfileFilter(profiles: InstagramProfile[]): InstagramProfile[] {
  return profiles.filter((p) => {
    const bio      = (p.biography ?? '').toLowerCase();
    const fullName = (p.fullName   ?? '').toLowerCase();
    const username = (p.username   ?? '').toLowerCase();

    if (p.isBusinessAccount) {
      if (BUSINESS_BIO_KEYWORDS.some((kw) => bio.includes(kw)))      return false;
      if (BUSINESS_BIO_KEYWORDS.some((kw) => fullName.includes(kw))) return false;
    }
    if (BUSINESS_NAME_PATTERNS.some((re) => re.test(username) || re.test(fullName))) return false;
    if (p.postsCount < 12) return false;
    if (!p.biography || p.biography.trim().length === 0) return false;

    return true;
  });
}
