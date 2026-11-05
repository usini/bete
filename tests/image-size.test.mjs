import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fittedImageSize } from '../js/image-size.js';
test('image insertion preserves width and fits landscape, portrait and Amazon captions immediately',()=>{
 assert.deepEqual(fittedImageSize({w:300,text:''},600,300),{w:300,h:150});
 assert.deepEqual(fittedImageSize({w:300,text:''},300,600),{w:300,h:600});
 const product=fittedImageSize({w:300,text:'https://amazon.fr/dp/B0GLN63H3V'},600,300);
 assert.equal(product.w,300);assert.ok(Math.abs(product.w/(product.h*.84)-2)<1e-9);
});
test('invalid image dimensions leave sizing unchanged and valid extreme sizes remain bounded',()=>{
 assert.equal(fittedImageSize({w:300},0,100),null);
 assert.equal(fittedImageSize({w:300},Infinity,100),null);
 const size=fittedImageSize({w:1000},100,10000);assert.equal(size.h,100000);assert.equal(size.w,1000);
});
