(function(root){
 'use strict';
 // 国务院办公厅年度通知，核对日期 2026-10-16。休假区间包含调休及连休，班表示补班。
 const schedules={
  2025:{document:'国办发明电〔2024〕12号',source:'https://www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm',breaks:[['元旦','01-01','01-01'],['春节','01-28','02-04'],['清明节','04-04','04-06'],['劳动节','05-01','05-05'],['端午节','05-31','06-02'],['国庆、中秋','10-01','10-08']],work:['01-26','02-08','04-27','09-28','10-11']},
  2026:{document:'国办发明电〔2025〕7号',source:'https://www.gov.cn/zhengce/content/202511/content_7047090.htm',breaks:[['元旦','01-01','01-03'],['春节','02-15','02-23'],['清明节','04-04','04-06'],['劳动节','05-01','05-05'],['端午节','06-19','06-21'],['中秋节','09-25','09-27'],['国庆节','10-01','10-07']],work:['01-04','02-14','02-28','05-09','09-20','10-10']}
 };
 const dateOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 function validateNotes(state){
  if(state.dayNotes===undefined)return true;
  const notes=state.dayNotes;if(!notes||typeof notes!=='object'||Array.isArray(notes)||Object.keys(notes).length>100000)return false;
  return Object.entries(notes).every(([date,n])=>dateOk(date)&&n&&typeof n==='object'&&typeof n.title==='string'&&n.title.length<=80&&typeof n.body==='string'&&!!n.body.trim()&&n.body.length<=20000&&typeof n.updated==='string'&&n.updated.length<=40);
 }
 const lunarFormatter=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Shanghai'});
 const nums=['','一','二','三','四','五','六','七','八','九','十'];
 const lunarDay=d=>d<=10?'初'+nums[d]:d<20?'十'+nums[d-10]:d===20?'二十':d<30?'廿'+nums[d-20]:'三十';
 function lunarParts(date){const parts=lunarFormatter.formatToParts(new Date(date+'T12:00:00+08:00'));return {month:parts.find(p=>p.type==='month').value,day:+parts.find(p=>p.type==='day').value};}
 const fixed={'01-01':'元旦','03-08':'妇女节','05-01':'劳动节','05-04':'青年节','06-01':'儿童节','08-01':'建军节','09-10':'教师节','10-01':'国庆节'};
 const traditional={'正月-1':'春节','正月-15':'元宵节','五月-5':'端午节','七月-7':'七夕','八月-15':'中秋节','九月-9':'重阳节','腊月-8':'腊八节'};
 const memo=new Map();
 function dayInfo(date){
  if(memo.has(date))return memo.get(date);if(!dateOk(date))return null;
  const year=+date.slice(0,4),md=date.slice(5),schedule=schedules[year],lunar=lunarParts(date);
  let festival=traditional[lunar.month+'-'+lunar.day]||fixed[md]||'';
  if(date==='2025-04-04'||date==='2026-04-05')festival='清明节';
  if(!festival){const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const following=lunarParts(next.toISOString().slice(0,10));if(following.month==='正月'&&following.day===1)festival='除夕';}
  const holiday=schedule?.breaks.find(([,from,to])=>md>=from&&md<=to)?.[0]||'';
  const status=schedule?.work.includes(md)?'work':holiday?'rest':'';
  const info={festival,lunar:lunar.day===1?lunar.month:lunarDay(lunar.day),lunarFull:lunar.month+lunarDay(lunar.day),holiday,status,hasSchedule:!!schedule};memo.set(date,info);if(memo.size>512)memo.delete(memo.keys().next().value);return info;
 }
 const api={schedules,dateOk,validateNotes,dayInfo};root.FoodCalendarData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
