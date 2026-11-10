const storeHost = /^(www\.)?amazon\.(?:com(?:\.(?:au|br|mx|be|tr))?|co\.(?:uk|jp|za)|fr|de|it|es|nl|se|pl|ca|in|ae|sa|sg|eg|ie)$/i;

// Amazon product links are cut down to https://<host>/dp/<ASIN>: no title slug, no tracking
// or affiliate parameters. Other links (and short links like amzn.to) are left unchanged.
export function shortenAmazon(full) {
  const u = new URL(full);
  if (!storeHost.test(u.hostname)) return full;
  const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? 'https://' + u.hostname + '/dp/' + m[1].toUpperCase() : full;
}

// True for an Amazon address: amazon.<tld>, with or without www, and the short links.
export function isAmazonUrl(url) {
  try {
    const { hostname } = new URL(url);
    return storeHost.test(hostname) || /^(?:www\.)?(?:amzn\.[a-z]+|a\.co)$/i.test(hostname);
  } catch {
    return false;
  }
}

export function isAmazonHome(url) {
  return url.protocol === 'https:' && url.pathname === '/' && storeHost.test(url.hostname);
}
