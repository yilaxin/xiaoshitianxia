(function(root){
 'use strict';
 const string=(v,n)=>typeof v==='string'&&v.length<=n;
 const id=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);
 function validateRecipes(state,photo=p=>typeof p==='string'){
  if(state.recipes===undefined)return true;
  if(!Array.isArray(state.recipes)||state.recipes.length>20000)return false;
  const ids=new Set();
  for(const r of state.recipes){
   if(!r||!id(r.id)||ids.has(r.id)||!string(r.name,60)||!r.name.trim()||!string(r.description,4000)||!string(r.servings,60)||!string(r.duration,60)||!string(r.tips,8000)||!photo(r.cover)||!(r.dishId===null||id(r.dishId))||!string(r.created,30)||!string(r.updated,40)||!Array.isArray(r.ingredients)||r.ingredients.length>200||!r.ingredients.every(i=>i&&string(i.name,120)&&string(i.amount,120))||!Array.isArray(r.steps)||r.steps.length>200||!r.steps.every(s=>s&&id(s.id)&&string(s.text,8000)&&Array.isArray(s.photos)&&s.photos.length<=12&&s.photos.every(p=>p&&photo(p)))||new Set(r.steps.map(s=>s.id)).size!==r.steps.length)return false;
   ids.add(r.id);
  }
  return true;
 }
 function mapPhotos(state,fn){for(const r of state.recipes||[]){r.cover=fn(r.cover);for(const step of r.steps)step.photos=step.photos.map(fn)}}
 const api={validateRecipes,mapPhotos};root.RecipeModel=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
