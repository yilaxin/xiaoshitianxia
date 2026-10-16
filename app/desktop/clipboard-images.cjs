'use strict';
const {clipboard,ClipboardItem,nativeImage}=require('electron');
async function readClipboardImage(){
 const items=await clipboard.read();
 for(const item of items){
  const type=item.types.find(t=>/^image\/(png|jpeg|webp|bmp)$/.test(t));if(!type)continue;
  const blob=await item.getType(type);if(blob.size>25*1024*1024)throw Error('剪贴板图片过大，请使用 25 MB 以内的图片。');
  const picture=nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));if(picture.isEmpty())continue;
  const bytes=picture.toPNG();if(bytes.length>25*1024*1024)throw Error('剪贴板图片过大，请使用 25 MB 以内的图片。');return 'data:image/png;base64,'+bytes.toString('base64');
 }
 return null;
}
async function copyImage(data){
 if(typeof data!=='string'||data.length>80*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('生成的图片格式不正确或体积过大。');
 const picture=nativeImage.createFromDataURL(data);if(picture.isEmpty())throw Error('生成的图片无法读取，请重试。');
 const size=picture.getSize();if(size.width*size.height>40*1024*1024)throw Error('记录过长，生成的图片超出当前可复制范围。');
 await clipboard.write([new ClipboardItem({'image/png':new Blob([picture.toPNG()],{type:'image/png'})})]);
 return size;
}
module.exports={readClipboardImage,copyImage};
