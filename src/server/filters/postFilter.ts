import { InstagramProfile } from '../types';

const SHOP_BIO_KEYWORDS = [
  'shop', 'store', 'boutique', 'jewelry', 'jewels', 'order now',
  'dm to buy', 'dm for price', 'shipping', 'cod', 'wholesale',
  'tienda', 'joyeria', 'joyería',
];

export function postProfileFilter(
  profiles: InstagramProfile[],
  followersMin = 30_000,
  followersMax = 100_000,
): InstagramProfile[] {
  return profiles.filter((p) => {
    const bio = (p.biography ?? '').toLowerCase();

    if (p.isBusinessAccount && SHOP_BIO_KEYWORDS.some((kw) => bio.includes(kw))) return false;
    if (p.followersCount < followersMin) return false;
    if (p.followersCount > followersMax) return false;
    if (p.postsCount < 12) return false;
    if (!p.biography || p.biography.trim().length === 0) return false;

    return true;
  });
}
