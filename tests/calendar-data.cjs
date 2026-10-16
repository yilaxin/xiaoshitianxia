const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {dayInfo,validateNotes,dateOk}=require('../app/desktop/calendar-data.cjs');
const {Storage}=require('../app/desktop/storage.cjs');
assert.equal(dayInfo('2026-02-17').festival,'春节');assert.equal(dayInfo('2026-02-16').festival,'除夕');assert.equal(dayInfo('2026-06-19').festival,'端午节');assert.equal(dayInfo('2026-09-25').festival,'中秋节');assert.equal(dayInfo('2025-10-06').festival,'中秋节');assert.equal(dayInfo('2025-07-25').lunar,'闰六月');
for(const date of ['2026-01-04','2026-02-14','2026-02-28','2026-05-09','2026-09-20','2026-10-10'])assert.equal(dayInfo(date).status,'work');
for(const date of ['2026-02-15','2026-02-23','2026-10-01','2026-10-07','2025-01-28','2025-02-04','2025-10-08'])assert.equal(dayInfo(date).status,'rest');
assert.equal(dayInfo('2026-10-08').status,'');assert.equal(dayInfo('2027-10-01').festival,'国庆节');assert.equal(dayInfo('2027-10-01').status,'');assert.equal(dayInfo('2027-10-01').hasSchedule,false);assert.equal(dayInfo('2026-04-05').festival,'清明节');assert.equal(dayInfo('2025-04-04').festival,'清明节');
for(const [year,count] of [[2025,28],[2026,33]]){let rest=0;for(let d=new Date(`${year}-01-01T12:00:00Z`);d.getUTCFullYear()===year;d.setUTCDate(d.getUTCDate()+1))if(dayInfo(d.toISOString().slice(0,10)).status==='rest')rest++;assert.equal(rest,count);}
assert.equal(dateOk('2026-02-30'),false);assert.equal(dateOk('2024-02-29'),true);
const old={version:1,dishes:[],records:[],meals:[],categories:[]};assert.equal(validateNotes(old),true);
const root=fs.mkdtempSync(path.join(__dirname,'../work/calendar-storage-')),store=new Storage(root);store.save(old);assert.deepEqual(store.load(),old);
const state={...old,dayNotes:{'2026-10-16':{title:'今天的感想',body:'没有添加美食，也可以留下日常。\n保留换行。',updated:'2026-10-16T08:00:00.000Z'}}};store.save(state);assert.deepEqual(store.load(),state);assert.deepEqual(store.portable(JSON.parse(fs.readFileSync(store.file,'utf8'))).data,state);assert.deepEqual(JSON.parse(fs.readFileSync(store.beforeDelete(),'utf8')).data,state);
for(const notes of [[],null,{'2026-02-30':state.dayNotes['2026-10-16']},{'2026-10-16':{title:'',body:' ',updated:''}},{'2026-10-16':{title:3,body:'正文',updated:''}}]){assert.equal(validateNotes({dayNotes:notes}),false);assert.throws(()=>store.save({...state,dayNotes:notes}));assert.deepEqual(store.load(),state);}
console.log('PASS: official 2025/2026 ranges, rest totals and makeup days; lunar festivals/Eve/leap month; unsupported-year coverage; strict dates; standalone notes roundtrip/backup/old-data compatibility; invalid notes rejected atomically');
