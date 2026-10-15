// Reuse a visually verified transcription only while the linked image bytes still match.
const crypto=require('node:crypto');
const registry=require('./verified-image-evidence.json');
function linkedImages(document){
 const urls=[...document.html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>new URL(m[1].replace(/&amp;/g,'&'),document.url).href);
 return registry.images.filter(i=>urls.includes(i.url));
}
async function fetchVerifiedImagePage(page){
 const item=registry.images.find(i=>i.url===page.url);if(!item)throw Error('image-extraction-unavailable');
 const response=await fetch(page.url,{signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error('image-fetch-failed:http-'+response.status);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>2e6)throw Error('image-response-too-large');chunks.push(Buffer.from(chunk));}
 const sha256=crypto.createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
 if(sha256!==item.sha256)throw Error('image-extraction-unavailable:changed-image');
 return {url:page.url,role:'evidence-image',html:'',fingerprint:sha256,verifiedImageText:item.text};
}
module.exports={linkedImages,fetchVerifiedImagePage};
