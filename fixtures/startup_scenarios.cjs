'use strict';
// 笑食天下 startup animation contract — Electron scenario dispatcher.
// Runs a single scenario (chosen via XSTX_STARTUP_SCENARIO) against the real
// built desktop app in a native offscreen main window. Each scenario records
// named checks and prints them as "CHECK <name> PASS|FAIL". Exit code is 0
// only when every recorded check passed.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Offscreen rendering is more stable without hardware GPU acceleration, and the
// startup contract explicitly forbids changing the desktop app itself.
app.disableHardwareAcceleration();

const scenario = process.env.XSTX_STARTUP_SCENARIO || 'interface';
const profile = process.env.XSTX_STARTUP_PROFILE;
const project = process.env.XSTX_BUILD_PROJECT;

const HARD_TIMEOUT_MS = 55000;
const hardTimer = setTimeout(() => {
  console.error('SCENARIO_HARD_TIMEOUT ' + scenario);
  process.exit(9);
}, HARD_TIMEOUT_MS);

const ALLOWED_PHASES = ['arriving', 'opening', 'settling', 'revealing'];
const col = [];

function chk(name, ok, detail) {
  col.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  console.log('CHECK ' + name + ' ' + (ok ? 'PASS' : 'FAIL') + (detail ? ' :: ' + detail : ''));
}

function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }
function run(win, script) { return win.webContents.executeJavaScript(script, true); }

async function waitUntil(win, expr, timeout = 4000, step = 40) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    let v = false;
    try { v = await run(win, expr); } catch (e) { /* poll again */ }
    if (v) return true;
    await pause(step);
  }
  return false;
}

function waitLoad(win, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('did-finish-load timeout after ' + timeout + 'ms')), timeout);
    win.webContents.once('did-finish-load', () => { clearTimeout(timer); resolve(); });
    win.webContents.once('did-fail-load', (_e, code, desc) => {
      clearTimeout(timer);
      reject(Error('did-fail-load ' + code + ': ' + desc));
    });
  });
}

function startupInfo(win) {
  return run(win, `(()=>{const s=globalThis.StartupIntro;if(!s)return {exists:false};return {exists:true,active:!!s.active,phase:s.phase,duration:s.duration,startType:typeof s.start,skipType:typeof s.skip}})()`);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenario_interface(win) {
  const appeared = await waitUntil(win, `typeof globalThis.StartupIntro === 'object' && globalThis.StartupIntro !== null`, 2500);
  chk('startup_intro_defined', appeared);
  const info = await startupInfo(win);
  chk('start_method_function', info.startType === 'function', 'typeof start=' + info.startType);
  chk('skip_method_function', info.skipType === 'function', 'typeof skip=' + info.skipType);
  chk('duration_is_2600', info.duration === 2600, 'duration=' + info.duration);
  chk('active_getter_boolean', typeof info.active === 'boolean', 'active=' + info.active + ' typeof=' + typeof info.active);
  chk('phase_getter_string', typeof info.phase === 'string', 'phase=' + info.phase + ' typeof=' + typeof info.phase);
}

async function scenario_dom(win) {
  const overlaySeen = await waitUntil(win, `!!document.getElementById('startupIntro')`, 5000);
  chk('overlay_appears', overlaySeen);
  const dom = await run(win, `(()=>({
    intro: !!document.getElementById('startupIntro'),
    book: !!document.querySelector('.startup-book'),
    cover: !!document.querySelector('.startup-cover'),
    page: !!document.querySelector('.startup-page'),
    skip: !!document.querySelector('[data-action="skipStartup"]')
  }))()`);
  chk('dom_startupIntro', dom.intro);
  chk('dom_startup_book', dom.book);
  chk('dom_startup_cover', dom.cover);
  chk('dom_startup_page', dom.page);
  chk('dom_skip_button', dom.skip);
}

async function scenario_auto(win) {
  const appeared = await waitUntil(win, `typeof globalThis.StartupIntro === 'object' && globalThis.StartupIntro !== null`, 2500);
  chk('startup_intro_defined', appeared);
  if (!appeared) {
    chk('becomes_active', false, 'StartupIntro undefined');
    chk('phase_allowed_value', false, 'no phase');
    chk('overlay_present_during', false, 'no overlay');
    chk('html_startup_active_during', false, 'no startup-active');
    chk('app_inert_during', false, 'no inert');
    chk('phase_progresses_to_opening', false, 'no progression');
    chk('still_active_at_1500ms', false, 'no full-duration path');
    chk('completes', false, 'no animation');
    chk('overlay_removed_after', false, 'feature missing');
    chk('html_class_removed_after', false, 'feature missing');
    chk('inert_removed_after', false, 'feature missing');
    chk('focus_restored_after', false, 'feature missing');
    chk('scroll_not_locked_after', false, 'feature missing');
    return;
  }

  const activeSeen = await waitUntil(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('becomes_active', activeSeen);
  if (!activeSeen) return;

  // First-active contract: the original Logo must already be fully decoded
  // (complete && naturalWidth>0) the instant the intro becomes active — not
  // swapped in later. The startup cover is the only place the overlay shows a
  // logo image, and its src must already be the real injected asset rather
  // than the un-resolved __STARTUP_LOGO__ placeholder.
  const logoReady = await run(win, `(()=>{const img=document.querySelector('#startupIntro .startup-cover img');if(!img)return {found:false,complete:false,naturalWidth:0,placeholder:false,src:''};const src=img.getAttribute('src')||'';return {found:true,complete:!!img.complete,naturalWidth:img.naturalWidth||0,placeholder:src.indexOf('__STARTUP_LOGO__')!==-1,src:src}})()`);
  chk('original_logo_complete_decoded_at_first_active', logoReady.found && logoReady.complete === true && logoReady.naturalWidth > 0 && !logoReady.placeholder, 'found=' + logoReady.found + ' complete=' + logoReady.complete + ' naturalWidth=' + logoReady.naturalWidth + ' placeholder=' + logoReady.placeholder + ' src=' + logoReady.src);

  const during = await run(win, `(()=>({
    phase: globalThis.StartupIntro.phase,
    dataPhase: document.getElementById('startupIntro') ? document.getElementById('startupIntro').getAttribute('data-phase') : null,
    htmlActive: document.documentElement.classList.contains('startup-active'),
    appInert: !!document.querySelector('.app') && !!document.querySelector('.app').inert,
    overlay: !!document.getElementById('startupIntro')
  }))()`);
  chk('phase_allowed_value', ALLOWED_PHASES.includes(during.phase), 'phase=' + during.phase);
  chk('data_phase_allowed', during.dataPhase === null || ALLOWED_PHASES.includes(during.dataPhase), 'dataPhase=' + during.dataPhase);
  chk('overlay_present_during', during.overlay);
  chk('html_startup_active_during', during.htmlActive);
  chk('app_inert_during', during.appInert);

  await pause(500);
  const mid = await run(win, `globalThis.StartupIntro.phase`);
  chk('phase_progresses_to_opening', mid === 'opening' || mid === 'settling', 'phase@500ms=' + mid);

  await pause(1000);
  const stillActive = await run(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active)`);
  chk('still_active_at_1500ms', stillActive);

  const finished = await waitUntil(win, `!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('completes', finished);

  const after = await run(win, `(()=>({
    overlay: !!document.getElementById('startupIntro'),
    htmlActive: document.documentElement.classList.contains('startup-active'),
    appInert: !!document.querySelector('.app') && !!document.querySelector('.app').inert,
    bodyOverflow: getComputedStyle(document.body).overflow,
    skipLeftover: !!document.querySelector('[data-action="skipStartup"]')
  }))()`);
  chk('overlay_removed_after', !after.overlay);
  chk('html_class_removed_after', !after.htmlActive);
  chk('inert_removed_after', !after.appInert);
  chk('skip_button_removed_after', !after.skipLeftover);
  const focusable = await run(win, `(()=>{const el=document.getElementById('globalSearch');if(!el)return false;el.focus();return document.activeElement===el})()`);
  chk('focus_restored_after', focusable);
  chk('scroll_not_locked_after', after.bodyOverflow !== 'hidden', 'bodyOverflow=' + after.bodyOverflow);
}

async function scenario_skip(win) {
  const activeSeen = await waitUntil(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('anim_active_before_skip', activeSeen);
  if (!activeSeen) return;
  const clicked = await run(win, `(()=>{const el=document.querySelector('[data-action="skipStartup"]');if(!el)return false;el.click();return true})()`);
  chk('skip_button_clickable', clicked);
  const finished = await waitUntil(win, `!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 3000);
  chk('skip_finishes_early', finished);
  const after = await run(win, `(()=>({overlay: !!document.getElementById('startupIntro'), appInert: !!document.querySelector('.app') && !!document.querySelector('.app').inert}))()`);
  chk('cleanup_after_skip', !after.overlay && !after.appInert);
  const skipErr = await run(win, `(()=>{try{globalThis.StartupIntro.skip('again');return null}catch(e){return e.message}})()`);
  chk('skip_idempotent', skipErr === null, 'err=' + skipErr);
  const startErr = await run(win, `(()=>{try{globalThis.StartupIntro.start();return null}catch(e){return e.message}})()`);
  chk('start_repeat_no_error', startErr === null, 'err=' + startErr);
  await pause(600);
  const replay = await run(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active) || !!document.getElementById('startupIntro')`);
  chk('start_repeat_no_replay', !replay);
}

async function scenario_esc(win) {
  const activeSeen = await waitUntil(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('anim_active_before_esc', activeSeen);
  if (!activeSeen) return;
  await run(win, `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}))`);
  const finished = await waitUntil(win, `!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 3000);
  chk('esc_finishes', finished);
  const after = await run(win, `(()=>({overlay: !!document.getElementById('startupIntro'), appInert: !!document.querySelector('.app') && !!document.querySelector('.app').inert}))()`);
  chk('cleanup_after_esc', !after.overlay && !after.appInert);
}

async function scenario_reduce_initial(win) {
  const reduced = await run(win, `matchMedia('(prefers-reduced-motion: reduce)').matches`);
  chk('reduce_media_applied', reduced === true, 'reduced=' + reduced);
  const info = await startupInfo(win);
  chk('startup_intro_defined', info.exists);
  chk('duration_still_2600', info.duration === 2600, 'duration=' + info.duration);
  await pause(1200);
  const st = await run(win, `(()=>({active: !!(globalThis.StartupIntro && globalThis.StartupIntro.active), overlay: !!document.getElementById('startupIntro')}))()`);
  chk('reduce_completes_quickly', !st.active && !st.overlay, 'active=' + st.active + ' overlay=' + st.overlay);
  chk('reduce_no_lingering_overlay', !st.overlay);
}

async function scenario_reduce_runtime(win) {
  const activeSeen = await waitUntil(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('anim_active_before_switch', activeSeen);
  if (!activeSeen) return;
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const finished = await waitUntil(win, `!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 4000);
  chk('finishes_after_reduce_switch', finished);
  const after = await run(win, `(()=>({overlay: !!document.getElementById('startupIntro'), appInert: !!document.querySelector('.app') && !!document.querySelector('.app').inert, htmlActive: document.documentElement.classList.contains('startup-active')}))()`);
  chk('cleaned_up_after_switch', !after.overlay && !after.appInert && !after.htmlActive);
}

async function scenario_pref_toggle(win) {
  await waitUntil(win, `!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 8000);
  await run(win, `setView('settings')`);
  await waitUntil(win, `!!document.querySelector('[data-action="toggleStartupAnimation"]')`, 5000);
  const info = await run(win, `(()=>{const el=document.querySelector('[data-action="toggleStartupAnimation"]');if(!el)return {exists:false};const scope=el.closest('.setting-row,.setting-card,label')||el.parentElement||el;const hasPref=(typeof state!=='undefined'&&state.preferences&&typeof state.preferences.startupAnimation==='boolean');return {exists:true,label:scope?scope.textContent:'',checked:(typeof el.checked==='boolean')?el.checked:null,pref:hasPref?state.preferences.startupAnimation:null}})()`);
  chk('toggle_exists', info.exists);
  chk('toggle_label_text', /启动时播放翻书动画/.test(info.label), 'label=' + (info.label || '').slice(0, 80));
  // Missing preference is the documented default (true): animation enabled,
  // checkbox checked. The contract does not require old data to gain a field.
  chk('default_or_true_pref_enables', info.pref === true || info.pref === null, 'pref=' + info.pref);
  chk('checkbox_checked_by_default', info.checked === true, 'checked=' + info.checked);
  if (!info.exists) return;
  await run(win, `(()=>{const el=document.querySelector('[data-action="toggleStartupAnimation"]');el.click();if(el instanceof HTMLInputElement)el.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await pause(500);
  const after = await run(win, `(()=>({pref:(typeof state!=='undefined'&&state.preferences&&typeof state.preferences.startupAnimation==='boolean')?state.preferences.startupAnimation:null,checked:(()=>{const el=document.querySelector('[data-action="toggleStartupAnimation"]');return (el&&typeof el.checked==='boolean')?el.checked:null})()}))()`);
  chk('toggle_sets_pref_false', after.pref === false, 'pref=' + after.pref);
  chk('checkbox_updated', after.checked === false, 'checked=' + after.checked);
  let persisted = false;
  try {
    const disk = JSON.parse(fs.readFileSync(path.join(profile, '菜单资料.json'), 'utf8'));
    persisted = !!(disk.preferences && disk.preferences.startupAnimation === false);
  } catch (e) { persisted = false; }
  chk('toggle_persisted_to_disk', persisted);
}

async function scenario_bootstrap_pref_off(win) {
  const ready = await waitUntil(win, `typeof state !== 'undefined' && Array.isArray(state.dishes)`, 8000);
  if (!ready) throw Error('renderer state not ready for bootstrap');
  const r = await run(win, `(()=>{state.preferences = state.preferences || {}; state.preferences.startupAnimation = false; return save();})()`);
  if (r !== true) throw Error('bootstrap save() returned ' + r);
  const onDisk = JSON.parse(fs.readFileSync(path.join(profile, '菜单资料.json'), 'utf8'));
  if (!(onDisk.preferences && onDisk.preferences.startupAnimation === false)) throw Error('preferences not persisted to disk');
}

async function scenario_pref_off(win) {
  const feature = await waitUntil(win, `typeof globalThis.StartupIntro === 'object' && globalThis.StartupIntro !== null`, 6000);
  chk('startup_feature_present', feature);
  await pause(300);
  const st = await run(win, `(()=>({
    active: !!(globalThis.StartupIntro && globalThis.StartupIntro.active),
    overlay: !!document.getElementById('startupIntro'),
    appInert: !!document.querySelector('.app') && !!document.querySelector('.app').inert,
    pref: (typeof state !== 'undefined' && state.preferences) ? state.preferences.startupAnimation : null
  }))()`);
  chk('pref_false_from_storage', st.pref === false, 'pref=' + st.pref);
  chk('no_animation_when_disabled', !st.active && !st.overlay, 'active=' + st.active + ' overlay=' + st.overlay);
  chk('app_not_inert_when_disabled', !st.appInert);
  await pause(500);
  const later = await run(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active) || !!document.getElementById('startupIntro')`);
  chk('no_late_animation', !later);
}

async function scenario_pref_fail(win) {
  const readOnly = await run(win, `typeof desktopReadOnly !== 'undefined' && desktopReadOnly === true`);
  chk('read_only_detected', readOnly);
  await run(win, `setView('settings')`);
  await waitUntil(win, `!!document.querySelector('[data-action="toggleStartupAnimation"]')`, 5000);
  const exists = await run(win, `!!document.querySelector('[data-action="toggleStartupAnimation"]')`);
  chk('toggle_exists', exists);
  if (!exists) return;
  await run(win, `(()=>{const el=document.querySelector('[data-action="toggleStartupAnimation"]');el.click();if(el instanceof HTMLInputElement)el.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await pause(400);
  const after = await run(win, `(typeof state!=='undefined' && state.preferences && typeof state.preferences.startupAnimation==='boolean') ? state.preferences.startupAnimation : null`);
  chk('pref_not_silently_false', after !== false, 'pref after=' + after);
  const file = path.join(profile, '菜单资料.json');
  const orig = path.join(profile, '菜单资料.json.original');
  const diskSame = fs.existsSync(orig) && fs.readFileSync(file, 'utf8') === fs.readFileSync(orig, 'utf8');
  chk('no_fake_success_on_disk', diskSame, 'corrupt file untouched by failed save');
}

async function scenario_reload(win) {
  const activeSeen = await waitUntil(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('first_cold_start_animates', activeSeen);
  if (!activeSeen) return;
  const finished = await waitUntil(win, `!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('first_animation_completes', finished);
  win.webContents.reload();
  await waitLoad(win);
  await pause(400);
  const st = await run(win, `(()=>({overlay: !!document.getElementById('startupIntro'), active: !!(globalThis.StartupIntro && globalThis.StartupIntro.active)}))()`);
  chk('reload_does_not_replay_overlay', !st.overlay, 'overlay=' + st.overlay);
  chk('reload_does_not_replay_active', !st.active, 'active=' + st.active);
}

async function scenario_restore(win) {
  const activeSeen = await waitUntil(win, `!!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('first_cold_start_animates', activeSeen);
  if (!activeSeen) return;
  const finished = await waitUntil(win, `!(globalThis.StartupIntro && globalThis.StartupIntro.active)`, 5000);
  chk('first_animation_completes', finished);
  win.minimize();
  await pause(400);
  win.restore();
  await pause(500);
  const st = await run(win, `(()=>({overlay: !!document.getElementById('startupIntro'), active: !!(globalThis.StartupIntro && globalThis.StartupIntro.active)}))()`);
  chk('restore_does_not_replay_overlay', !st.overlay, 'overlay=' + st.overlay);
  chk('restore_does_not_replay_active', !st.active, 'active=' + st.active);
}

async function scenario_headless_only(win) {
  await pause(300);
  const st = await run(win, `(()=>({
    overlay: !!document.getElementById('startupIntro'),
    appInert: !!document.querySelector('.app') && !!document.querySelector('.app').inert,
    htmlActive: document.documentElement.classList.contains('startup-active'),
    introActive: !!(globalThis.StartupIntro && globalThis.StartupIntro.active)
  }))()`);
  chk('no_overlay_in_headless_only', !st.overlay);
  chk('app_not_inert_in_headless_only', !st.appInert);
  chk('no_startup_active_class', !st.htmlActive);
  chk('intro_not_active_or_absent', !st.introActive, 'introActive=' + st.introActive);
}

const scenarios = {
  interface: scenario_interface,
  dom: scenario_dom,
  auto: scenario_auto,
  skip: scenario_skip,
  esc: scenario_esc,
  reduce_initial: scenario_reduce_initial,
  reduce_runtime: scenario_reduce_runtime,
  pref_toggle: scenario_pref_toggle,
  bootstrap_pref_off: scenario_bootstrap_pref_off,
  pref_off: scenario_pref_off,
  pref_fail: scenario_pref_fail,
  reload: scenario_reload,
  restore: scenario_restore,
  headless_only: scenario_headless_only,
};

function finish(code) {
  clearTimeout(hardTimer);
  const passed = col.filter((c) => c.ok).length;
  const failed = col.filter((c) => !c.ok).length;
  const effective = (code !== 0) ? code : (failed > 0 ? 1 : 0);
  console.log('SUMMARY ' + JSON.stringify({ scenario, passed, total: col.length, code: effective }));
  setTimeout(() => app.exit(effective), 60);
}

let booted = false;
try {
  process.env.XSTX_HEADLESS_TEST = '1';
  process.argv.push('--data-dir=' + profile);
  require(path.join(project, 'dist-app', 'main.cjs'));
  booted = true;
} catch (e) {
  console.error('BOOT_ERROR ' + (e && e.stack || e));
  chk('boot_main_requires', false, (e && e.message || e));
  finish(2);
}

async function main() {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw Error('no BrowserWindow created');
    if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3');
    const media = scenario === 'reduce_initial' ? 'reduce' : 'no-preference';
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: media }] });
    await waitLoad(win);
    const fn = scenarios[scenario];
    if (!fn) throw Error('unknown scenario: ' + scenario);
    await fn(win);
    finish(0);
  } catch (e) {
    console.error('SCENARIO_ERROR ' + (e && e.stack || e));
    chk('scenario_completed_without_error', false, (e && e.message || e));
    finish(3);
  }
}

if (booted) {
  app.whenReady().then(main).catch((e) => {
    console.error('READY_REJECT ' + (e && e.stack || e));
    finish(4);
  });
}
