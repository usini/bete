import { extractAmazonProduct, extractAliExpressProduct } from './extract.js';
const button = document.getElementById('copy');
const status = document.getElementById('status');

async function embeddedImage(url) {
  const source = new URL(url);
  const amazonImage = ['m.media-amazon.com', 'images-na.ssl-images-amazon.com', 'images-eu.ssl-images-amazon.com'].includes(source.hostname);
  const aliExpressImage = /^(?:ae\d+\.alicdn\.com|ae-pic-[a-z0-9-]+\.aliexpress-media\.com)$/.test(source.hostname)
    && source.pathname.startsWith('/kf/');
  if (source.protocol !== 'https:' || source.username || source.password || source.port || !(amazonImage || aliExpressImage)) return null;
  const response = await fetch(source.href, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size > 10 * 1024 * 1024) return null;
  const image = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return { image: canvas.toDataURL('image/jpeg', .88), w: 400, h: Math.round(400 * canvas.height / canvas.width) + 76 };
  } finally { image.close(); }
}

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Lecture du produit…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const hostname = new URL(tab?.url || 'about:blank').hostname;
    const aliExpress = /^(?:[a-z]{2}\.|www\.|m\.)?aliexpress\.(?:com|us)$/i.test(hostname);
    const extract = aliExpress ? extractAliExpressProduct : extractAmazonProduct;
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extract });
    const product = injection.result;
    if (!product?.link) throw new Error('Impossible de lire cette fiche produit.');
    let picture = null;
    try { if (product.imageUrl) picture = await embeddedImage(product.imageUrl); } catch { /* Metadata can still be copied. */ }
    const block = { kind: 'rect', text: product.link, link: product.link, name: product.name, price: product.price, delivery: product.delivery, w: 400, h: 300, ...picture };
    await navigator.clipboard.writeText('BETE_BLOCK_V1\n' + JSON.stringify(block));
    status.textContent = 'Bloc copié ! Colle-le dans Bête avec Ctrl+V.' + (!picture ? '\nImage indisponible : les autres informations sont copiées.' : '') + (!product.price ? '\nPrix non trouvé.' : '') + (!product.delivery ? '\nLivraison non trouvée.' : '');
  } catch (error) {
    status.textContent = error.message || 'Copie impossible. Réessaie depuis une fiche Amazon ou AliExpress.';
  } finally { button.disabled = false; }
});
