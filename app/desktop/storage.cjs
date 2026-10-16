'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateRecipes,mapPhotos}=require('./recipe-model.cjs');
const {validateNotes,dateOk}=require('./calendar-data.cjs');
const SEEDS=new Set(['dumplings','noodles','rice','salad','soup','pizza','pasta','brunch','logo']);
const idOk=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);
function validate(s){
 if(!s||s.version!==1||!Array.isArray(s.dishes)||!Array.isArray(s.records)||!Array.isArray(s.meals)||!Array.isArray(s.categories))throw Error('资料格式不完整。');
 if(s.dishes.length>20000||s.records.length>100000)throw Error('资料数量超过当前版本可处理范围。');
 if(!s.categories.every(c=>typeof c==='string'&&c.length<=60)||new Set(s.categories).size!==s.categories.length)throw Error('分类资料不正确。');
 if(s.tagOrder!==undefined&&(!Array.isArray(s.tagOrder)||!s.tagOrder.every(t=>typeof t==='string'&&t.trim()&&t.length<=150)||new Set(s.tagOrder).size!==s.tagOrder.length))throw Error('标签顺序资料不正确。');
 const ids=new Set(s.dishes.map(d=>d.id)),meals=new Set(s.meals.map(m=>m.id));
 if(ids.size!==s.dishes.length||meals.size!==s.meals.length||new Set(s.records.map(r=>r.id)).size!==s.records.length)throw Error('资料中存在重复编号。');
 for(const d of s.dishes)if(!idOk(d.id)||typeof d.name!=='string'||!d.name.trim()||d.name.length>60||typeof d.category!=='string'||!Array.isArray(d.tags)||!d.tags.every(t=>typeof t==='string')||typeof d.description!=='string'||typeof d.cover!=='string'||!dateOk(d.created))throw Error('有一份菜品资料不完整。');
 for(const m of s.meals)if(!idOk(m.id)||!dateOk(m.date)||!['title','type','place','maker','note'].every(k=>typeof m[k]==='string')||(m.photos!==undefined&&(!Array.isArray(m.photos)||m.photos.length>100||!m.photos.every(p=>typeof p==='string'&&p.length>0))))throw Error('有一份用餐资料不完整。');
 for(const r of s.records)if(!idOk(r.id)||!ids.has(r.dishId)||(r.mealId&&!meals.has(r.mealId))||!dateOk(r.date)||typeof r.note!=='string'||!Array.isArray(r.photos)||r.photos.length>100||!r.photos.every(p=>typeof p==='string'&&p.length>0))throw Error('有一份品尝记录不完整。');
 if(!validateRecipes(s))throw Error('有一份食谱资料不完整。');
 if(!validateNotes(s))throw Error('有一份日常随记资料不完整。');
 return s;
}
function atomic(file,data){const tmp=file+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';try{if(typeof data==='function')data(tmp);else fs.writeFileSync(tmp,data);fs.renameSync(tmp,file)}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}}
function mapAllPhotos(s,fn){s.dishes.forEach(d=>d.cover=fn(d.cover));s.records.forEach(r=>r.photos=r.photos.map(fn));s.meals.forEach(m=>{if(m.photos)m.photos=m.photos.map(fn)});mapPhotos(s,fn);return s;}
function contentHash(s){const {bookIndex,readingPositions,lastBackup,...content}=s;return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');}
function stamp(){const d=new Date();const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
class Storage{
 constructor(root,{assetDir=path.resolve(__dirname,'../../assets')}={}){this.root=root;this.assetDir=assetDir;this.photoDir=path.join(root,'照片');this.backupDir=path.join(root,'自动备份');this.file=path.join(root,'菜单资料.json');this.backedUpHash=null;for(const p of [root,this.photoDir,this.backupDir])fs.mkdirSync(p,{recursive:true})}
 encodePhoto(photo){
  if(photo==='')return '';
  if(SEEDS.has(photo))return photo;
  if(/^local:[a-f0-9]{64}\.(jpg|png|webp)$/.test(photo)){if(!fs.existsSync(path.join(this.photoDir,photo.slice(6))))throw Error('有一张照片找不到了，请先保留当前资料。');return photo}
  const match=/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(photo);
  if(!match)throw Error('照片格式不受支持。');
  const bytes=Buffer.from(match[2],'base64');if(bytes.length>30*1024*1024)throw Error('单张照片不能超过 30 MB。');
  const ext=match[1]==='jpeg'?'jpg':match[1];
  const name=crypto.createHash('sha256').update(bytes).digest('hex')+'.'+ext;
  const full=path.join(this.photoDir,name);if(!fs.existsSync(full))atomic(full,bytes);
  return 'local:'+name;
 }
 decodePhoto(photo,cache){
  if(photo==='')return '';
  if(SEEDS.has(photo)||photo.startsWith('data:image/'))return photo;
  if(!/^local:[a-f0-9]{64}\.(jpg|png|webp)$/.test(photo))throw Error('照片引用无效。');
  if(cache.has(photo))return cache.get(photo);
  const name=photo.slice(6),ext=path.extname(name).slice(1),data=fs.readFileSync(path.join(this.photoDir,name));
  const result='data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+data.toString('base64');cache.set(photo,result);return result;
 }
 hydrate(data){const s=structuredClone(data),cache=new Map();validate(s);return mapAllPhotos(s,p=>this.decodePhoto(p,cache));}
 load(){if(!fs.existsSync(this.file))return null;try{return this.hydrate(JSON.parse(fs.readFileSync(this.file,'utf8')))}catch(e){throw Error('本机资料暂时无法读取。原文件已保留，请通过设置恢复备份。\n'+e.message)}}
 loadReferences(){
  if(!fs.existsSync(this.file))return null;
  try{const s=validate(JSON.parse(fs.readFileSync(this.file,'utf8')));mapAllPhotos(s,p=>this.encodePhoto(p));return s;}
  catch(e){throw Error('本机资料暂时无法读取。原文件已保留，请通过设置恢复备份。\n'+e.message);}
 }
 portable(state){return {app:'笑食天下',format:'prototype-1',data:this.hydrate(state)}}
 writePortable(file,state,{includeSeeds=false}={}){
  validate(state);
  // Write one photo at a time: never hold the complete base64 photo library or JSON in RAM.
  const marker=Symbol('photo'),data=mapAllPhotos(structuredClone(state),p=>({[marker]:p}));
  atomic(file,tmp=>{
   const fd=fs.openSync(tmp,'wx'),parents=new Set();
   const emit=value=>fs.writeFileSync(fd,value);
   const photo=p=>{
    if(includeSeeds&&SEEDS.has(p)){const ext=p==='logo'?'png':'jpg';return 'data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+fs.readFileSync(path.join(this.assetDir,p+'.'+ext)).toString('base64');}
    return this.decodePhoto(p,new Map());
   };
   const write=value=>{
    if(value&&typeof value==='object'&&Object.hasOwn(value,marker)){emit(JSON.stringify(photo(value[marker])));return;}
    if(value===null||typeof value!=='object'){emit(JSON.stringify(value)??'null');return;}
    if(parents.has(value))throw Error('资料中出现循环引用。');parents.add(value);
    if(Array.isArray(value)){emit('[');value.forEach((v,i)=>{if(i)emit(',');write(v)});emit(']');}
    else {emit('{');let comma=false;for(const [key,v] of Object.entries(value)){if(v===undefined)continue;if(comma)emit(',');emit(JSON.stringify(key)+':');write(v);comma=true;}emit('}');}
    parents.delete(value);
   };
   try{write({app:'笑食天下',format:'prototype-1',data});}finally{fs.closeSync(fd);}
  });
 }
 save(input){
  validate(input);let normalized=false;const s=mapAllPhotos(structuredClone(input),p=>{const value=this.encodePhoto(p);if(value!==p)normalized=true;return value;});
  atomic(this.file,JSON.stringify(s));
  let backupWarning=null;
  try{const hash=contentHash(s),daily=path.join(this.backupDir,stamp()+'.json');if(hash!==this.backedUpHash||!fs.existsSync(daily)){this.writePortable(daily,s);this.backedUpHash=hash;}const names=fs.readdirSync(this.backupDir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();for(const n of names.slice(7))fs.unlinkSync(path.join(this.backupDir,n))}catch(e){backupWarning='资料已保存，但自动备份未完成：'+e.message}
  return {backupWarning,...(normalized?{state:s}:{})};
 }
 snapshotBeforeChange(label){if(fs.existsSync(this.file)){const file=path.join(this.backupDir,label+'-'+stamp()+'-'+Date.now()+'.json');const original=fs.readFileSync(this.file);try{this.writePortable(file,JSON.parse(original.toString('utf8')))}catch{atomic(file,original)}return file}return null}
 beforeRestore(){return this.snapshotBeforeChange('恢复前')}
 beforeDelete(){return this.snapshotBeforeChange('删除前')}
 metadata(){let bytes=0;for(const f of fs.readdirSync(this.photoDir)){const s=fs.statSync(path.join(this.photoDir,f));if(s.isFile())bytes+=s.size}const backups=fs.readdirSync(this.backupDir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();return {root:this.root,photoBytes:bytes,photos:fs.readdirSync(this.photoDir).length,backupCount:backups.length,lastBackup:backups.at(-1)?.replace('.json','')||null}}
}
module.exports={Storage,validate,atomic};
