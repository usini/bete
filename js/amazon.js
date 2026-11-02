// Amazon product links are cut down to https://<host>/dp/<ASIN>: no title slug, no tracking
// or affiliate parameters. Other links (and short links like amzn.to) are left unchanged.
export function shortenAmazon(full) {
  const u = new URL(full);
  if (!/^(www\.)?amazon\.[a-z.]+$/i.test(u.hostname)) return full;
  const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? 'https://' + u.hostname + '/dp/' + m[1].toUpperCase() : full;
}

// True for an Amazon address: amazon.<tld>, with or without www, and the short links.
export function isAmazonUrl(url) {
  try {
    return /^(www\.)?(amazon\.[a-z.]+|amzn\.[a-z]+|a\.co)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// True when a block's text is nothing but an Amazon address.
export function isAmazonText(text) {
  const s = String(text).trim();
  return /^https?:\/\/\S+$/i.test(s) && isAmazonUrl(s);
}

// If a block's text is nothing but an Amazon product URL, returns it shortened;
// any other text is returned untouched.
export function shortenAmazonText(text) {
  const s = text.trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return text;
  try {
    const short = shortenAmazon(s);
    return short === s ? text : short;
  } catch {
    return text;
  }
}
