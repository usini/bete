import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanXtool, xtoolSummary } from '../js/xtool.js';
test('bitmap preview resolves image settings and preserves the device identifier',()=>{
 const data={format:'xtool-studio-processing-settings',version:1,payload:{deviceCode:'GS002',displayData:{ignored:true,graph:{processingType:'BITMAP_ENGRAVING',profiles:[{id:'p',values:{power:10,bitmapMode:'grayscale'}}],patches:[{id:'a',profileId:'p',overrides:{power:50,bitmapMode:'Jarvis',bitmapEngraveMode:'dot',dotDuration:290,frequency:60,dpi:762,processingLightSource:'red',powerMinMaxRange:[1,50]}}],activeBinding:{baseProfileId:'p',patchIds:['a']}}}}};
 const clean=cleanXtool(data),text=xtoolSummary(clean);
 for(const value of ['F1 Ultra','Gravure d’image','Puissance : 50 %','Tramage : Jarvis','Durée du point : 290','Fréquence : 60','DPI : 762','Traitement : Ignoré','Source laser : Fibre'])assert.ok(text.includes(value),value);
 assert.equal(clean.payload.deviceCode,'GS002');
});
