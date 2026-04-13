import { HashtagPost } from '../types';

const FULL_NAME_BLOCKLIST = [
  'shop', 'store', 'boutique', 'jewelry', 'jewels', 'jewellery',
  'diamonds', 'diamond', 'gems', 'gold', 'silver', 'studio',
  'official', 'llc', 'ltd', 's.a.', 'inc', 'co.', 'couture',
  'collection', 'collections', 'brand', 'brands', 'fashion house',
  'atelier', 'maison', 'jeweler', 'jeweller', 'goldsmith',
  'accessories', 'accessori', 'bijoux', 'bijouterie',
  'tienda', 'negocio', 'empresa', 'joyeria', 'joyería',
  // Media / non-personal accounts
  'news', 'media', 'magazine', 'channel', 'network', 'tv', 'radio',
  'podcast', 'press', 'digital', 'agency', 'group', 'entertainment',
  'productions', 'production', 'management', 'talent', 'pr ',
];

const USERNAME_BLOCKLIST = [
  'shop', 'store', 'jewel', 'jewelry', 'jewellery', 'diamond',
  'gems', 'boutique', 'official', 'brand', 'studio',
  'design', 'designs', 'collection',
  // Media / non-personal accounts
  'news', 'media', 'magazine', 'channel', 'network', 'tv',
  'radio', 'podcast', 'press', 'agency', 'entertainment',
  'productions', 'management',
];

const USERNAME_SUFFIX_BLOCKLIST = [
  '.store', '.shop', '_store', '_shop', '_official', '_brand',
  '_news', '_media', '_tv', '_live', '_channel', '_network',
];

const LUXURY_NUM_RE = /luxury_\d/;

const CAPTION_SALE_KEYWORDS = [
  'link in bio', 'shop now', 'order now', 'dm to order',
  'dm to buy', 'whatsapp', 'wa.me/', 'click link',
  'free shipping', 'delivery', 'worldwide shipping',
  'cod available', 'cash on delivery', 'discount code',
  'use code', 'promo code', '% off', 'sale now',
  'available at', 'shop at', 'visit our store',
  'precio', 'envío', 'pedido', 'compra ahora',
];

const NON_LATIN_RE =
  /[\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\u0370-\u03FF\u0400-\u04FF\uAC00-\uD7AF]/;

// Applies only username-level blocklists — used when post content isn't available (e.g. TikTok sourced usernames)
export function filterUsernames(usernames: string[]): string[] {
  return usernames.filter((u) => {
    const key = u.toLowerCase();
    if (USERNAME_BLOCKLIST.some((kw) => key.includes(kw))) return false;
    if (USERNAME_SUFFIX_BLOCKLIST.some((s) => key.includes(s))) return false;
    if (LUXURY_NUM_RE.test(key)) return false;
    return true;
  });
}

export function preFilter(posts: HashtagPost[]): string[] {
  const passed = new Map<string, string>();

  for (const post of posts) {
    const { ownerUsername, ownerFullName, caption, likesCount, commentsCount, hashtags } = post;

    if (!ownerUsername) continue;

    const key = ownerUsername.toLowerCase();
    if (passed.has(key)) continue;

    const fullNameLower = (ownerFullName ?? '').toLowerCase();
    const captionRaw = caption ?? '';
    const captionLower = captionRaw.toLowerCase();

    if (FULL_NAME_BLOCKLIST.some((kw) => fullNameLower.includes(kw))) continue;
    if (USERNAME_BLOCKLIST.some((kw) => key.includes(kw))) continue;
    if (USERNAME_SUFFIX_BLOCKLIST.some((s) => key.includes(s))) continue;
    if (LUXURY_NUM_RE.test(key)) continue;
    if (CAPTION_SALE_KEYWORDS.some((kw) => captionLower.includes(kw))) continue;
    if (likesCount === 0 && commentsCount === 0) continue;
    if (captionRaw.length < 10) continue;
    if (Array.isArray(hashtags) && hashtags.length > 25) continue;
    if (NON_LATIN_RE.test(captionRaw)) continue;

    passed.set(key, ownerUsername);
  }

  return Array.from(passed.values());
}
