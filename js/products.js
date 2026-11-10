import { isAmazonHome, isAmazonUrl, shortenAmazon } from './amazon.js?v=mwag82om';

const brands = {
  amazon: { id: 'amazon', name: 'Amazon' },
  aliexpress: { id: 'aliexpress', name: 'AliExpress' },
};

function aliExpressItem(url) {
  if (!/^(?:[a-z]{2}\.|www\.|m\.)?aliexpress\.(?:com|us)$/i.test(url.hostname)) return null;
  return url.pathname.match(/^\/item\/(\d+)\.html\/?$/i)?.[1] || null;
}

export function productBrand(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
    if (aliExpressItem(url)) return brands.aliexpress;
    if (!isAmazonHome(url) && isAmazonUrl(value)) return brands.amazon;
  } catch { /* Not an address. */ }
  return null;
}

export const isProductUrl = value => !!productBrand(value);
export const isProductText = text => /^https?:\/\/\S+$/i.test(String(text).trim()) && isProductUrl(String(text).trim());

export function shortenProduct(full) {
  const url = new URL(full);
  const brand = productBrand(full);
  if (brand === brands.aliexpress) return 'https://' + url.hostname + '/item/' + aliExpressItem(url) + '.html';
  return brand === brands.amazon ? shortenAmazon(full) : full;
}

export function shortenProductText(text) {
  if (!isProductText(text)) return text;
  const trimmed = text.trim();
  const short = shortenProduct(trimmed);
  return short === trimmed ? text : short;
}

// Keep the badge geometry shared by rendering, grouping and placement.
export function productBadgeLayout(node) {
  if (node.kind === 'group') return null;
  const brand = productBrand(node.link || String(node.text || '').trim());
  if (!brand) return null;
  const w = Math.min(node.w, node.h) * 0.16;
  return { x: node.x - w, y: node.y, w, h: w * 1.25, brand };
}
