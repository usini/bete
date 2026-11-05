// Runs only in the active tab, after the user clicks the extension button.
export function extractAmazonProduct() {
  if (!/^(www\.)?amazon\.(?:com(?:\.(?:au|br|mx|be|tr))?|co\.(?:uk|jp|za)|fr|de|it|es|nl|se|pl|ca|in|ae|sa|sg|eg|ie)$/i.test(location.hostname)) throw new Error('Ouvre une fiche produit Amazon.');
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
