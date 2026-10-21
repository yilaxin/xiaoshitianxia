from pathlib import Path
import json,re,shutil
from build_icon import build_icon
root=Path(__file__).resolve().parents[1]
out=root/'dist-app'
out.mkdir(exist_ok=True)
source=(root/'app/renderer.html').read_text(encoding='utf-8')
source=source.replace('__BASE_CSS__',(root/'app/base.css').read_text(encoding='utf-8').rstrip()).replace('__CORE_JS__',(root/'app/core.js').read_text(encoding='utf-8').rstrip())
assets={p.stem:'xstx-media://assets/'+p.name for p in (root/'assets').iterdir() if p.suffix.lower() in {'.jpg','.png'}}
shutil.copytree(root/'assets',out/'assets',dirs_exist_ok=True)
s=source.replace('__ASSETS__',json.dumps(assets,ensure_ascii=False))
s=s.replace('__STARTUP_LOGO__',assets['logo'])
s=s.replace('<title>笑食天下 · 我的私人菜单</title>','<title>笑食天下</title>')
s=s.replace('<meta name="description"', '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' data:; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob: xstx-media:; connect-src xstx-media:; object-src \'none\'; base-uri \'none\'; frame-src \'none\'">\n<meta name="description"',1)
s=s.replace("const TODAY='2026-10-15';", "const now=new Date();const TODAY=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');")
start=s.index('let state;try{')
end=s.index("let view=",start)
s=s[:start]+'''let desktopReadOnly=false,desktopFirstRun=false,state;
try{state=window.desktop.load();if(!state){state=seed();desktopFirstRun=true}}catch(e){desktopReadOnly=true;state=seed();setTimeout(()=>toast('资料读取失败，当前仅展示示例。原资料已保留，请恢复备份。'),500)}
state.preferences={startupAnimation:true,...(state.preferences||{})};
'''+s[end:]
s=s.replace('month=9,year=2026,selectedDate=TODAY','month=now.getMonth(),year=now.getFullYear(),selectedDate=TODAY')
s=s.replace("selectedDate=TODAY;year=2026;month=9;render()", "selectedDate=TODAY;year=now.getFullYear();month=now.getMonth();render()")
start=s.index('function save(){')
end=s.index('function commit(',start)
s=s[:start]+'''function save(){try{if(desktopReadOnly)throw Error('资料读取未成功，暂时不能覆盖原资料。请先在设置中恢复备份。');const result=window.desktop.save(state);if(result?.state)state=result.state;updateCounts();if(result?.backupWarning)setTimeout(()=>toast(result.backupWarning),0);return true}catch(e){toast('保存未完成：'+e.message);return false}}
'''+s[end:]
start=s.index('function renderSettings(){')
end=s.index('function showRandom()',start)
s=s[:start]+'''function renderSettings(){const meta=window.desktop.metadata();return pageHead('设置与备份','KEEP YOUR MEMORIES SAFE','好好收藏，也好好保存。','<span class="prototype-tag">桌面体验版 v0.1.0</span>')+`<div class="notice">记录与照片保存在这台电脑。修改后自动保存；每天保留一份自动备份，并保留最近 7 天的版本。换电脑前，请导出包含照片的完整备份。</div><div class="settings-grid"><div><section class="setting-card"><h2>启动与阅读</h2><p>打开应用时，用一段小仪式慢慢进入菜单。</p><div class="setting-row"><div><h3>启动时播放翻书动画</h3><p>冷启动时先翻开封面，再进入「我的菜单」。</p></div><label class="setting-switch"><input type="checkbox" data-action="toggleStartupAnimation" ${state.preferences.startupAnimation?'checked':''}><span>启动时播放翻书动画</span></label></div></section><section class="setting-card"><h2>收藏与备份</h2><p>把照片和文字一起收好，换一个地方也能继续回味。</p><div class="setting-row"><div><h3>导出完整备份</h3><p>${state.lastBackup?'最近导出：'+esc(state.lastBackup):'还没有手动导出过备份'}</p></div><button class="btn outline small" data-action="export">${icon('download')} 导出备份</button></div><div class="setting-row"><div><h3>从备份恢复</h3><p>恢复前会保存当前资料，便于找回。</p></div><button class="btn outline small" data-action="import">${icon('upload')} 导入备份</button></div><div class="setting-row"><div><h3>自动备份 · 已开启</h3><p>${meta.lastBackup?'最近备份：'+esc(meta.lastBackup):'保存记录后自动生成'}<br>已保留 ${meta.backupCount} 份每日备份。</p></div><button class="btn outline small" data-action="openAutoBackups">${icon('folder')} 查看备份</button></div><p class="status-note">需要恢复某个自动备份时，点击「导入备份」，选择自动备份文件夹中的日期文件。</p></section><section class="setting-card"><h2>分类与标签</h2><p>按自己的习惯整理，每道菜都能找到合适的位置。</p><div class="setting-cats">${state.categories.map(c=>`<button data-action="categoryFromSettings" data-category="${esc(c)}">${esc(c)}<span>${state.dishes.filter(d=>d.category===c).length}</span></button>`).join('')}</div><div style="margin-top:18px;display:flex;gap:13px"><button class="btn text small" data-action="manageCats">管理分类 ${icon('arrow')}</button><button class="btn text small" data-action="manageTags">管理标签 ${icon('arrow')}</button></div></section></div><div><section class="setting-card"><h2>这份私人菜单</h2><p>不用注册账号，慢慢收集属于自己的好味道。</p><div class="setting-row"><div><h3>菜品收藏与用餐回忆</h3><p>${state.dishes.length} 道菜 · ${state.records.length} 次品尝 · ${state.meals.length} 顿饭</p></div>${icon('book')}</div><div class="setting-row"><div><h3>导入的照片</h3><p>${meta.photos} 张独立照片，约 ${(meta.photoBytes/1024/1024).toFixed(1)} MB。</p></div>${icon('camera')}</div><div class="setting-row"><div><h3>本机资料库</h3><p style="overflow-wrap:anywhere">${esc(meta.root)}</p></div></div><button class="btn outline small" data-action="openDataFolder">${icon('folder')} 打开资料文件夹</button></section><section class="setting-card" style="background:#ece5d8"><div class="eyebrow">A TASTE OF YOUR LIFE</div>${logoHtml('about-logo')}<p>收藏喜欢的味道，<br>记住每一餐的美好。</p><p style="font-size:9px;margin-top:19px">笑食天下 · Windows 桌面体验版 v0.1.0<br>示例照片来自 Unsplash，Logo 使用你提供的原图。</p></section></div></div>`+foot()}
'''+s[end:]
start=s.index('function exportBackup(){')
end=s.index('function validBackup(',start)
s=s[:start]+'''function exportBackup(){try{const backup=structuredClone(state);backup.lastBackup=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});const result=window.desktop.exportBackup({app:'笑食天下',format:'prototype-1',data:backup});if(result.canceled)return;state.lastBackup=backup.lastBackup;save();render();toast('完整备份已保存，照片和记录都在里面。')}catch(e){toast('导出未完成：'+e.message)}}
'''+s[end:]
s=s.replace('if(f.size>30*1024*1024)', 'if(f.size>200*1024*1024)')
s=s.replace('当前原型支持 30 MB 以内的备份','当前版本支持 200 MB 以内的备份')
s=s.replace('next.bookIndex=0;if(commit(next))','next.bookIndex=0;try{window.desktop.prepareRestore()}catch(e){toast("恢复未完成："+e.message);return}if(restoreState(next))')
s=s.replace('function importBackup(){', 'function restoreState(next){const wasReadOnly=desktopReadOnly;desktopReadOnly=false;const ok=commit(next);if(!ok)desktopReadOnly=wasReadOnly;return ok}\nfunction importBackup(){')
s=s.replace('export:exportBackup,import:importBackup,','export:exportBackup,import:importBackup,openDataFolder:()=>window.desktop.openData(),openAutoBackups:()=>window.desktop.openBackups(),')
s=s.replace('交互原型 · 浏览器本地保存','离线使用 · 本机资料库')
s=s.replace('原型记录保存在当前浏览器，可在设置中导出。','自动保存到本机，也可以导出完整备份。')
s=s.replace('恢复会替换当前浏览器内的资料。','恢复会替换当前资料，恢复前将自动保留当前版本。')
s=s.replace('文件不是有效的「笑食天下」原型备份。','文件不是有效的「笑食天下」备份。')
s=s.replace('笑食天下 · 示例内容 / 交互原型','笑食天下 · 桌面体验版 v0.1.0')
s=s.replace("render();\n</script>","render();\nif(desktopFirstRun)save();\n</script>")
s=s.replace('v0.1.0','v'+json.loads((root/'package.json').read_text(encoding='utf-8'))['version'])
extra_css=(root/'app/refinements.css').read_text(encoding='utf-8')
data_actions=(root/'app/data-actions.js').read_text(encoding='utf-8')
refinements=(root/'app/refinements.js').read_text(encoding='utf-8')
visual_css=(root/'app/visual-polish.css').read_text(encoding='utf-8')
visual_js=(root/'app/visual-polish.js').read_text(encoding='utf-8')
motion_css=(root/'app/motion.css').read_text(encoding='utf-8')
motion_js=(root/'app/motion.js').read_text(encoding='utf-8')
book_css=(root/'app/book-turn.css').read_text(encoding='utf-8')
book_js=(root/'app/book-turn.js').read_text(encoding='utf-8')
sort_css=(root/'app/category-sort.css').read_text(encoding='utf-8')
sort_js=(root/'app/category-sort.js').read_text(encoding='utf-8')
favorites_css=(root/'app/favorites.css').read_text(encoding='utf-8')
hero_css=(root/'app/hero-carousel.css').read_text(encoding='utf-8')
hero_js=(root/'app/hero-carousel.js').read_text(encoding='utf-8')
paste_css=(root/'app/photo-paste.css').read_text(encoding='utf-8')
paste_js=(root/'app/photo-paste.js').read_text(encoding='utf-8')
fullscreen_css=(root/'app/book-fullscreen.css').read_text(encoding='utf-8')
fullscreen_js=(root/'app/book-fullscreen.js').read_text(encoding='utf-8')
meal_photos_css=(root/'app/meal-photos.css').read_text(encoding='utf-8')
meal_photos_js=(root/'app/meal-photos.js').read_text(encoding='utf-8')
startup_css=(root/'app/startup.css').read_text(encoding='utf-8')
startup_js=(root/'app/startup.js').read_text(encoding='utf-8')
s=s.replace('__STARTUP_CSS__',startup_css)
s=s.replace('</style>',extra_css+'\n'+visual_css+'\n'+motion_css+'\n'+book_css+'\n'+sort_css+'\n'+favorites_css+'\n'+hero_css+'\n'+paste_css+'\n'+fullscreen_css+'\n'+meal_photos_css+'\n</style>',1)
s=s.replace('</body>','<script>\n'+data_actions+'\n</script>\n<script>\n'+refinements+'\n</script>\n<script>\n'+visual_js+'\n</script>\n<script>\n'+motion_js+'\n</script>\n<script>\n'+book_js+'\n</script>\n<script>\n'+sort_js+'\n</script>\n<script>\n'+hero_js+'\n</script>\n<script>\n'+paste_js+'\n</script>\n<script>\n'+fullscreen_js+'\n</script>\n<script>\n'+meal_photos_js+'\n</script>\n</body>',1)
books_css=(root/'app/food-books.css').read_text(encoding='utf-8')
books_js=(root/'app/food-books.js').read_text(encoding='utf-8')
recipe_model=(root/'app/desktop/recipe-model.cjs').read_text(encoding='utf-8')
s=s.replace('</style>',books_css+'\n</style>',1)
s=s.replace('</body>','<script>\n'+recipe_model+'\n</script>\n<script>\n'+books_js+'\n</script>\n</body>',1)
(out/'recipe-model.cjs').write_text(recipe_model,encoding='utf-8')
calendar_data=(root/'app/desktop/calendar-data.cjs').read_text(encoding='utf-8')
calendar_js=(root/'app/calendar-journal.js').read_text(encoding='utf-8')
calendar_css=(root/'app/calendar-journal.css').read_text(encoding='utf-8')
s=s.replace('</style>',calendar_css+'\n</style>',1)
s=s.replace('</body>','<script>\n'+calendar_data+'\n</script>\n<script>\n'+calendar_js+'\n</script>\n</body>',1)
dish_image_js=(root/'app/dish-image.js').read_text(encoding='utf-8')
s=s.replace('</body>','<script>\n'+dish_image_js+'\n</script>\n</body>',1)
readability_css=(root/'app/readability.css').read_text(encoding='utf-8')
s=s.replace('</head>','<style id="readability-styles">\n'+readability_css+'\n</style>\n</head>',1)
lifecycle_js=(root/'app/resource-lifecycle.js').read_text(encoding='utf-8')
s=s.replace('</body>','<script>\n'+lifecycle_js+'\n</script>\n</body>',1)
pdf_js=(root/'app/book-pdf.js').read_text(encoding='utf-8')
s=s.replace('</body>','<script>\n'+pdf_js+'\n</script>\n</body>',1)
s=s.replace('</body>','<script>\n'+startup_js+'\n</script>\n</body>',1)
(out/'index.html').write_text(s,encoding='utf-8')
build_icon(root/'assets/logo.png', out)
for p in (root/'app/desktop').glob('*.cjs'):
 shutil.copy2(p,out/p.name)
metadata=json.loads((root/'package.json').read_text(encoding='utf-8'))
metadata={key:metadata[key] for key in ['name','productName','version','description','author']}
metadata['main']='main.cjs'
(out/'package.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
scripts=re.findall(r'<script>([\s\S]*?)</script>',s)
for i,script in enumerate(scripts):
 check=root/'work'/f'renderer-check-{i}.js'
 check.parent.mkdir(exist_ok=True)
 check.write_text(script,encoding='utf-8')
print('Desktop app assets ready')
