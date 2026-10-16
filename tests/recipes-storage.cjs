const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Storage}=require('../app/desktop/storage.cjs');
const root=fs.mkdtempSync(path.join(__dirname,'../work/recipes-storage-')),store=new Storage(root);
const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(__dirname,'../assets/rice.jpg')).toString('base64');
const legacy={version:1,dishes:[],records:[],meals:[],categories:[]};store.save(legacy);assert.deepEqual(store.load(),legacy);
const state={...legacy,recipes:[{id:'recipe-1',name:'自家炒饭',cover:image,description:'',servings:'2 人份',duration:'20 分钟',tips:'',dishId:null,created:'2026-10-16',updated:'2026-10-16',ingredients:[{name:'米饭',amount:'两碗'}],steps:[{id:'step-1',text:'炒香配菜，加入米饭。',photos:[image]}]}]};
store.save(state);assert.deepEqual(store.load(),state);const disk=JSON.parse(fs.readFileSync(store.file,'utf8'));assert.match(disk.recipes[0].cover,/^local:/);assert.equal(disk.recipes[0].steps[0].photos[0],disk.recipes[0].cover);assert.equal(store.metadata().photos,1);
assert.deepEqual(store.portable(disk).data,state);assert.deepEqual(JSON.parse(fs.readFileSync(store.beforeDelete(),'utf8')).data,state);
for(const mutate of [r=>r.name='',r=>r.steps=null,r=>r.steps[0].photos=[''],r=>r.cover='https://remote/image',r=>r.ingredients=[{name:4,amount:''}],r=>r.steps.push({...r.steps[0]})]){const bad=structuredClone(state);mutate(bad.recipes[0]);assert.throws(()=>store.save(bad));assert.deepEqual(store.load(),state);}
const optional=structuredClone(state);optional.recipes[0].cover='';optional.recipes[0].ingredients=[];optional.recipes[0].steps=[];store.save(optional);assert.deepEqual(store.load(),optional);
const orphan=structuredClone(optional);orphan.recipes[0].dishId='deleted-dish';store.save(orphan);assert.deepEqual(store.load(),orphan,'A deleted linked dish must not destroy the independent recipe');
const target=new Storage(fs.mkdtempSync(path.join(__dirname,'../work/recipes-restore-')));target.save(store.portable(JSON.parse(fs.readFileSync(store.file,'utf8'))).data);assert.deepEqual(target.load(),orphan);
console.log('PASS: old data compatibility; recipe cover/step image roundtrip/dedup; portable backup and restore; optional fields; deleted dish link; invalid structures/photos rejected atomically');
