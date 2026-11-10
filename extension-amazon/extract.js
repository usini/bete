// Runs only in the active tab, after the user clicks the extension button.
export function extractAmazonProduct() {
  if (!/^(www\.)?amazon\.(?:com(?:\.(?:au|br|mx|be|tr))?|co\.(?:uk|jp|za)|fr|de|it|es|nl|se|pl|ca|in|ae|sa|sg|eg|ie)$/i.test(location.hostname)) throw new Error('Ouvre une fiche produit Amazon ou AliExpress.');
  const text = selectors => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node || node.hidden || node.getAttribute('aria-hidden') === 'true' || !node.getClientRects().length) continue;
      const value = node.textContent.replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
    return '';
  };
  const asin = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]
    || document.querySelector('#ASIN')?.value;
  const name = text(['#productTitle', '#title']);
  if (!/^[A-Z0-9]{10}$/i.test(asin || '') || !name) throw new Error('Fiche produit introuvable. Attends son chargement et réessaie.');
  const price = text(['#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen', '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen', '#apex_desktop .a-price:not(.a-text-price) .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice']);
  const delivery = text(['#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE [data-csa-c-delivery-time]', '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE', '#deliveryBlockMessage']);
  const image = document.querySelector('#landingImage, #imgBlkFront, #main-image');
  const imageUrl = image?.currentSrc || image?.src || '';
  return { link: location.origin + '/dp/' + asin.toUpperCase(), name: name.slice(0,100), price: price.slice(0,100), delivery: delivery.slice(0,100), imageUrl };
}
// Chrome injects this function by value, so it must not use module-level helpers.
export function extractAliExpressProduct() {
  const item = location.pathname.match(/^\/item\/(\d+)\.html\/?$/i);
  if (!/^(?:[a-z]{2}\.|www\.|m\.)?aliexpress\.(?:com|us)$/i.test(location.hostname) || !item) {
    throw new Error('Ouvre une fiche produit AliExpress.');
  }

  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const visible = (selectors, accept = Boolean) => {
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (node.closest('[hidden], [aria-hidden="true"]') || !node.getClientRects().length
          || getComputedStyle(node).visibility !== 'visible') continue;
        const value = clean(node.textContent);
        if (accept(value)) return value;
      }
    }
    return '';
  };
  const meta = property => clean(document.querySelector('meta[property="' + property + '"]')?.content);
  const name = visible(['h1[data-pl="product-title"]', '[class*="title--wrap"] h1', 'h1[itemprop="name"]', 'h1'])
    || meta('og:title');
  if (!name) throw new Error('Fiche produit introuvable. Attends son chargement et réessaie.');

  // Read the displayed variant price first, excluding strike-through and promotional estimates.
  const price = visible([
    '[class*="price--currentPriceText"]',
    '[class*="product-price-current"]',
    '[class*="price-default--current"]',
  ], value => /\d/.test(value));
  // Only read the estimated date itself, never the enclosing shipping or address panel.
  const delivery = visible([
    '[class*="dynamic-shipping"] [class*="deliveryDate"]',
    '[class*="shipping"] [class*="delivery-date"]',
    '[class*="delivery--date"]',
    '[data-testid="delivery-date"]',
  ], value => /\d/.test(value)) || visible(
    ['[class*="dynamic-shipping"] strong', '[class*="dynamic-shipping"] b'],
    value => /^(?:\d{1,2}(?:er)?\s*[-–]\s*)?\d{1,2}(?:er)?\s+(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)/i.test(value)
      && value.length <= 45,
  );

  const image = document.querySelector(
    'img[class*="magnifier--image"], [class*="image-view--wrap"] img, img[itemprop="image"]',
  );
  const imageUrl = image?.currentSrc || image?.src || meta('og:image');
  return {
    link: location.origin + '/item/' + item[1] + '.html',
    name: name.slice(0, 100),
    price: price.slice(0, 100),
    delivery: delivery.slice(0, 100),
    imageUrl,
  };
}
