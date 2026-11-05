import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductClipboard, PRODUCT_CLIPBOARD_PREFIX } from '../js/product-clipboard.js';
import { extractAmazonProduct } from '../extension-amazon/extract.js';
const encode = value => PRODUCT_CLIPBOARD_PREFIX + JSON.stringify(value);
const product = { link:'https://www.amazon.fr/title/dp/B0CT2WVY9B?tag=tracking', name:'Acier', price:'13 €', delivery:'Demain', image:'data:image/png;base64,aGVsbG8=', w:400, h:500 };
test('product clipboard preserves product fields, strips tracking and ignores identity fields', () => {
  const block = parseProductClipboard(encode({...product,id:'private',shareId:'secret',x:9000,color:'bad'}));
  assert.equal(block.link,'https://www.amazon.fr/dp/B0CT2WVY9B');
  assert.equal(block.text,block.link); assert.equal(block.name,'Acier');
  assert.equal(block.image,product.image); assert.equal(block.h,500);
  assert.equal(block.id,undefined); assert.equal(block.shareId,undefined); assert.equal(block.x,undefined);
});
test('clipboard rejects malformed and oversized payloads, credentials and unrelated URLs', () => {
  for (const text of ['hello', PRODUCT_CLIPBOARD_PREFIX+'{', encode(null), encode({link:'javascript:alert(1)'}), encode({link:'https://amazon.fr.evil.test/dp/test'}), encode({link:'https://secret@amazon.fr/dp/test'}), encode({link:'http://amazon.fr/dp/test'}), PRODUCT_CLIPBOARD_PREFIX+'x'.repeat(5*1024*1024)]) assert.equal(parseProductClipboard(text),null);
});
test('remote or executable images cannot be imported and missing fields remain empty', () => {
  for (const image of ['https://tracking.test/image','data:image/svg+xml;base64,aGVsbG8=','idb:private']) assert.equal(parseProductClipboard(encode({...product,image})).image,undefined);
  const block = parseProductClipboard(encode({link:product.link,name:'x'.repeat(200)}));
  assert.equal(block.name.length,100); assert.equal(block.price,undefined);
});
test('Amazon extraction uses product fields, skips hidden prices and avoids account delivery address', () => {
  const node = (textContent,visible=true) => ({textContent,hidden:false,getAttribute:()=>null,getClientRects:()=>visible?[{}]:[]});
  const nodes = new Map([
    ['#productTitle',node('  Tôle acier  ')],
    ['#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',node('999 €',false)],
    ['#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',node('13,99 €')],
    ['#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE [data-csa-c-delivery-time]',node('samedi 7 novembre')],
    ['#landingImage, #imgBlkFront, #main-image',{src:'https://m.media-amazon.com/images/I/test.jpg'}],
  ]);
  globalThis.location = {hostname:'www.amazon.fr',origin:'https://www.amazon.fr',pathname:'/article/dp/B0CT2WVY9B'};
  globalThis.document = {querySelector:key=>nodes.get(key)};
  try {
    const result = extractAmazonProduct();
    assert.equal(result.name,'Tôle acier'); assert.equal(result.price,'13,99 €');
    assert.equal(result.delivery,'samedi 7 novembre');
    assert.equal(result.link,'https://www.amazon.fr/dp/B0CT2WVY9B');
    globalThis.location.hostname = 'example.com';
    assert.throws(extractAmazonProduct,/Amazon/);
  } finally { delete globalThis.document; delete globalThis.location; }
});

test('native Windows clipboard headers accept CRLF and an optional BOM', () => {
  for (const header of ['BETE_BLOCK_V1\n', 'BETE_BLOCK_V1\r\n', '\uFEFFBETE_BLOCK_V1\r\n']) {
    const block = parseProductClipboard(header + JSON.stringify(product));
    assert.equal(block?.name, product.name);
    assert.equal(block?.image, product.image);
  }
});

test('pasted products convert delivery dates to calendar days and preserve other delivery text', () => {
  const today = new Date(2026, 10, 5);
  for (const [delivery, expected] of [
    ['Livraison GRATUITE lundi 9 novembre. Commandez dans les 1 h 15 min.', '4 jours'],
    ['Livraison vendredi 6 novembre', '1 jour'],
    ['Livraison jeudi 5 novembre', '0 jours'],
    ['2-3 jours', '2-3 jours'],
    ['Demain', 'Demain'],
  ]) {
    assert.equal(parseProductClipboard(encode({ ...product, delivery }), today).delivery, expected);
  }
});
