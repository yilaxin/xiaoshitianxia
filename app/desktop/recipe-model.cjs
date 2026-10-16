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
 function withExample(state){
  if(state.recipeExampleVersion>=1)return state;
  const next=structuredClone(state);next.recipeExampleVersion=1;next.recipes=next.recipes||[];
  if(!next.recipes.some(r=>r.id==='example-egg-fried-rice'))next.recipes.push({
   id:'example-egg-fried-rice',name:'家常蛋炒饭 · 示例',cover:'rice',dishId:null,
   description:'一碗米饭、两颗鸡蛋，也能做出香喷喷的家常味。这是一份可以编辑、删除的示例食谱，展示如何记录成品、食材、步骤和心得；成品照片为摆盘参考。',
   servings:'2 人份',duration:'约 15 分钟',created:'2026-10-16',updated:'2026-10-16',
   ingredients:[{name:'熟米饭（冷藏后）',amount:'约 400 克 / 2 小碗'},{name:'鸡蛋',amount:'2 个'},{name:'胡萝卜',amount:'半根，约 50 克'},{name:'豌豆',amount:'约 40 克'},{name:'小葱',amount:'2 根'},{name:'食用油',amount:'约 15 毫升'},{name:'生抽',amount:'约 10 毫升 / 2 小勺'},{name:'盐',amount:'少许，按口味调整'},{name:'白胡椒粉',amount:'少许，可不放'}],
   steps:[
    {id:'example-rice-step-1',text:'备料：米饭用饭勺轻轻拨散。胡萝卜切小丁，小葱切成葱花；鸡蛋打入碗中搅匀。冷藏米饭应妥善保存，取出后尽快烹调。',photos:[]},
    {id:'example-rice-step-2',text:'处理配菜：锅中烧水，将胡萝卜丁和豌豆煮至熟透，捞出沥干。冷冻豌豆按包装说明煮熟。',photos:[]},
    {id:'example-rice-step-3',text:'炒鸡蛋：锅烧热，加入约一半食用油，倒入蛋液。用锅铲推散，炒至凝固后先盛出，避免一直留在锅里炒老。',photos:[]},
    {id:'example-rice-step-4',text:'炒散米饭：锅中加入剩余食用油，放少量葱白炒香，倒入米饭。用锅铲轻压饭团、翻炒至松散；保持中火，锅太干时沿锅边加少量水。',photos:[]},
    {id:'example-rice-step-5',text:'合炒调味：加入熟透的胡萝卜丁、豌豆和鸡蛋，翻炒均匀。沿锅边淋入生抽，再按口味补少许盐和白胡椒，炒至米饭整体热透、冒出热气。',photos:[]},
    {id:'example-rice-step-6',text:'出锅装盘：撒入剩余葱花，翻匀后关火。盛入盘中趁热享用，也可以在食谱中换上自己拍的成品照片，记录这次做法的调整。',photos:[]}
   ],
   tips:'米饭不要过湿，拨散后更容易炒出粒粒分明的口感。\n生抽本身有咸味，先尝味再加盐。\n配菜可换成玉米粒、香菇丁等家里现有的食材，先处理熟再合炒。\n用熟饭时注意冷藏保存，炒制时充分热透。\n我的下次改进：可以试试少一点生抽、多一点葱花。'
  });
  return next;
 }
 const api={validateRecipes,mapPhotos,withExample};root.RecipeModel=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
