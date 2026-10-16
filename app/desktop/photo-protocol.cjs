'use strict';
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const LOCAL_NAME=/^[a-f0-9]{64}\.(?:jpg|png|webp)$/;
const ASSET_NAMES=new Set(['brunch.jpg','dumplings.jpg','logo.png','noodles.jpg','pasta.jpg','pizza.jpg','rice.jpg','salad.jpg','soup.jpg']);

function resolvePhoto(url,assetDir,photoDir){
 const parsed=new URL(url);
 if(parsed.protocol!=='xstx-media:'||parsed.username||parsed.password||parsed.port||parsed.search||parsed.hash)return null;
 const name=parsed.pathname.slice(1);
 if(parsed.host==='assets'&&ASSET_NAMES.has(name))return path.join(assetDir,name);
 if(parsed.host==='photos'&&LOCAL_NAME.test(name))return path.join(photoDir,name);
 return null;
}
function registerPhotos(protocol,net,assetDir,photoDir){
 protocol.handle('xstx-media',async request=>{
  const target=resolvePhoto(request.url,assetDir,photoDir);
  if(!target||!['GET','HEAD'].includes(request.method))return new Response(null,{status:404});
  try{
   const source=await net.fetch(pathToFileURL(target).href,{method:request.method,signal:request.signal});
   if(!source.ok)return new Response(null,{status:404});
   const headers=new Headers(source.headers);
   headers.set('Access-Control-Allow-Origin','*');
   headers.set('Content-Type',target.endsWith('.png')?'image/png':target.endsWith('.webp')?'image/webp':'image/jpeg');
   headers.set('X-Content-Type-Options','nosniff');
   return new Response(request.method==='HEAD'?null:source.body,{status:source.status,headers});
  }catch{return new Response(null,{status:404});}
 });
}
module.exports={resolvePhoto,registerPhotos};
