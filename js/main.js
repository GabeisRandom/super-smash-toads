'use strict';
// ===== Menus, input, online play and the main loop =====
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const STEP = 1000 / 60;
// mode: 'start' (the press-start screen) -> 'title' (the main page) -> 'lobby' -> 'game'
let mode = $('start') ? 'start' : 'title', role = 'local', G = null, paused = false, frameCount = 0, pendingEv = [], resultsShown = false, goT = 0;
let fsBanner = null; // the finale title card: { ch, i, t }
const cam = { x: 0, y: -150, z: 0.8, shake: 0 };
// origami 3D renderer when WebGL is available; the 2D vector renderer stays as a fallback
const USE3D = V3D.init();
if (USE3D) { portrait = V3D.portrait; stageThumb = V3D.stageThumb; }

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H), wrap = $('wrap');
  wrap.style.transform = `scale(${s})`;
  wrap.style.left = (innerWidth - W * s) / 2 + 'px';
  wrap.style.top = (innerHeight - H * s) / 2 + 'px';
}
addEventListener('resize', fit);
fit();
// Keep every menu inside the 1280x720 frame: a screen or an overlay box that grows taller than the frame
// (a long results table, a font that loads bigger) is scaled down to fit instead of getting cut off at the bottom.
function autoFit() {
  for (const id of ['start', 'title', 'lobby']) {
    const s = $(id);
    if (!s || s.classList.contains('hidden')) continue;
    s.style.transform = ''; s.style.height = ''; s.classList.remove('fitScaled');
    const need = s.scrollHeight;
    if (need > H + 1) { const k = H / need; s.classList.add('fitScaled'); s.style.height = need + 'px'; s.style.transform = `scale(${k})`; }
  }
  for (const id of ['help', 'settings', 'pause', 'results']) {
    const o = $(id), b = o && o.querySelector('.box');
    if (!b || o.classList.contains('hidden')) continue;
    b.style.transform = '';
    const need = b.offsetHeight, room = H - 16;
    if (need > room) b.style.transform = `scale(${room / need})`;
  }
}
setInterval(autoFit, 400);

function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }
function cleanName(s) { return String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 12); }
function myName() { return cleanName($('nameIn').value) || 'Toad Fan'; }
$('nameIn').value = store('sst-name') || '';
$('nameIn').addEventListener('change', () => store('sst-name', myName()));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden'); t.style.opacity = 1;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.classList.add('hidden'), 300); }, 2600);
}
function titleMsg(m) { $('titleMsg').textContent = m || ''; }

// ---------- Input ----------
// keys: held right now; tapped: pressed since the last tick, so a tap shorter than a frame still counts
const keys = new Set(), tapped = new Set();
// Default controls. P1: WASD move (S crouches), Q attack, E special, F guard, G grab, 1-4 taunts.
// P2: IJKL move (K crouches; arrows work too), U attack, O special, H guard, Y grab, 7-0 taunts.
// Players can change them in Settings; their choice is saved in this browser.
// U is the up direction (it jumps too); J only jumps, so holding it never turns an attack into an up attack
const DEFAULT_KEYS = [
  { L: ['KeyA'], R: ['KeyD'], U: ['KeyW'], J: ['Space'], D: ['KeyS'], A: ['KeyQ'], B: ['KeyE'], S: ['KeyF'], G: ['KeyG'], T: ['Digit1', 'Digit2', 'Digit3', 'Digit4'] },
  { L: ['KeyJ', 'ArrowLeft'], R: ['KeyL', 'ArrowRight'], U: ['KeyI', 'ArrowUp'], J: [], D: ['KeyK', 'ArrowDown'], A: ['KeyU'], B: ['KeyO'], S: ['KeyH'], G: ['KeyY'], T: ['Digit7', 'Digit8', 'Digit9', 'Digit0'] },
];
const KEY_ACTS = ['L', 'R', 'U', 'J', 'D', 'A', 'B', 'S', 'G'];
let KEYSETS = loadKeys();
function loadKeys() {
  try {
    const k = JSON.parse(store('sst-keys') || 'null');
    if (Array.isArray(k) && k.length === 2) for (const s of k) if (s && !Array.isArray(s.J)) s.J = []; // saves from before the Jump key existed
    const ok = Array.isArray(k) && k.length === 2 && k.every(s => s && KEY_ACTS.every(a => Array.isArray(s[a])) && Array.isArray(s.T) && s.T.length === 4);
    if (ok) return k;
  } catch (e) { /* bad save: use the defaults */ }
  return JSON.parse(JSON.stringify(DEFAULT_KEYS));
}
// keys that never count as "press start"
const NOT_START = ['KeyM', 'Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock'];
let rebinding = null; // Settings: { p, act, n } while waiting for the new key
addEventListener('keydown', e => {
  Snd.init();
  if (rebinding) { e.preventDefault(); if (!e.repeat) setKey(e.code); return; }
  if (mode === 'start' && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && !NOT_START.includes(e.code)) { e.preventDefault(); pressStart(); return; }
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code); tapped.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' && !e.repeat) onEsc();
  if (e.code === 'KeyM' && !e.repeat) toggleMute();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); tapped.clear(); });
addEventListener('pointerdown', () => Snd.init());

function keyBits(set) {
  const s = KEYSETS[set], any = a => a.some(k => keys.has(k) || tapped.has(k));
  let b = 0;
  if (any(s.L)) b |= B_L; if (any(s.R)) b |= B_R; if (any(s.U)) b |= B_U; if (any(s.D)) b |= B_D;
  if (any(s.A)) b |= B_A; if (any(s.B)) b |= B_B; if (any(s.S)) b |= B_S; if (any(s.G)) b |= B_G; if (any(s.J)) b |= B_J;
  s.T.forEach((k, n) => { if (k && (keys.has(k) || tapped.has(k))) b |= B_TAUNTS[n]; });
  return b;
}
function padList() {
  const a = [];
  if (navigator.getGamepads) for (const p of navigator.getGamepads()) if (p && p.connected) a.push(p);
  return a;
}
function padBits(idx) {
  const p = padList()[idx];
  if (!p) return 0;
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0, bt = i => p.buttons[i] && p.buttons[i].pressed;
  let b = 0;
  if (ax < -0.45 || bt(14)) b |= B_L; if (ax > 0.45 || bt(15)) b |= B_R;
  // stick / d-pad up is the up direction; the Y button only jumps
  if (ay < -0.6 || bt(12)) b |= B_U; if (bt(3)) b |= B_J; if (ay > 0.6 || bt(13)) b |= B_D;
  // right bumper grabs; the left bumper and both triggers guard
  if (bt(0)) b |= B_A; if (bt(1) || bt(2)) b |= B_B; if (bt(4) || bt(6) || bt(7)) b |= B_S; if (bt(5)) b |= B_G;
  // right stick flicks taunt: up, right, down, left
  const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
  if (ry < -0.7) b |= B_T1; else if (rx > 0.7) b |= B_T2; else if (ry > 0.7) b |= B_T3; else if (rx < -0.7) b |= B_T4;
  return b;
}
function localBits(which) {
  if (which < 0) return keyBits(0) | keyBits(1) | padBits(0) | padBits(1);
  return keyBits(which) | padBits(which);
}
function getBits(f) {
  switch (f.ctrl) {
    case 'p1': return localBits(0);
    case 'p2': return localBits(1);
    case 'any': return localBits(-1);
    case 'net': { const t = Net.taps[f.pid] | 0; Net.taps[f.pid] = 0; return (Net.inputs[f.pid] | 0) | t; }
    default: return aiBits(G, f);
  }
}

// ---------- Lobby state ----------
const Lobby = { slots: [], stage: 'town', stocks: 3, items: true, hazards: true, music: 'shuffle', active: 0, mySlot: 0 };
// battle music: the four stage themes plus four extra fight tracks; "Shuffle" plays them all in a random order
const BATTLE_SONGS = ['funk', 'hop', 'turbo', 'jazz', 'town', 'diorama', 'turnpike', 'gorge'];
const MUSIC_OPTS = [['shuffle', 'Shuffle'], ['stage', 'Stage theme'], ['funk', 'Spore Funk'], ['hop', 'Toad Hop'], ['turbo', 'Turbo Toad'], ['jazz', 'Shroom Session'],
  ['town', 'Toad Town'], ['diorama', 'Diorama'], ['turnpike', 'Turnpike'], ['gorge', 'Mushroom Gorge']];
const musicName = id => (MUSIC_OPTS.find(m => m[0] === id) || MUSIC_OPTS[0])[1];
function battleOrder(stage) {
  const m = Lobby.music || 'shuffle';
  if (m === 'stage') return [STAGE_SONG[stage] || stage];
  if (m !== 'shuffle') return [m];
  const list = BATTLE_SONGS.slice();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
{ const m = store('sst-music'); if (MUSIC_OPTS.some(o => o[0] === m)) Lobby.music = m; }
let myChar = store('sst-char') || 'toad';
if (!CH[myChar]) myChar = 'toad';
function localDefaults() {
  Lobby.slots = [{ type: 'p1', ch: myChar, lvl: 2 }, { type: 'cpu', ch: 'toadette', lvl: 2 }, { type: 'off', ch: 'captain', lvl: 2 }, { type: 'off', ch: 'yoshi', lvl: 2 }];
  Lobby.active = 0; Lobby.mySlot = 0;
}
function hostDefaults() {
  Lobby.slots = [{ type: 'host', ch: myChar, lvl: 2 }, { type: 'off', ch: 'toadette', lvl: 2 }, { type: 'off', ch: 'captain', lvl: 2 }, { type: 'off', ch: 'yoshi', lvl: 2 }];
  Lobby.active = 0; Lobby.mySlot = 0;
}
function canEditChar(k) {
  const s = Lobby.slots[k];
  if (!s || s.type === 'off') return false;
  if (role === 'local') return true;
  if (role === 'host') return k === 0 || s.type === 'cpu';
  return k === Lobby.mySlot;
}
function canChangeType(k) {
  if (role === 'local') return true;
  if (role === 'host') return k !== 0 && Lobby.slots[k].type !== 'net';
  return false;
}
function slotLabel(s, k) {
  if (role === 'local') return { p1: 'Player 1', p2: 'Player 2', cpu: 'CPU', off: 'Empty' }[s.type];
  if (s.type === 'host') return (role === 'host' ? myName() : s.name || 'Host') + (role === 'host' ? ' (you)' : ' (host)');
  if (s.type === 'net') return (s.name || 'Player') + (role === 'client' && k === Lobby.mySlot ? ' (you)' : '');
  return s.type === 'cpu' ? 'CPU' : 'Open slot';
}
function cycleType(k) {
  const s = Lobby.slots[k];
  const order = role === 'local' ? ['p1', 'p2', 'cpu', 'off'] : ['cpu', 'off'];
  let i = order.indexOf(s.type);
  for (let n = 0; n < order.length; n++) {
    i = (i + 1) % order.length;
    const t = order[i];
    if ((t === 'p1' || t === 'p2') && Lobby.slots.some((o, j) => j !== k && o.type === t)) continue;
    s.type = t;
    break;
  }
  if (s.type === 'off' && Lobby.active === k) Lobby.active = Lobby.slots.findIndex(o => o.type !== 'off');
  if (Lobby.active < 0) Lobby.active = 0;
  lobbyChanged();
}
function lobbyChanged() {
  if (role === 'host') broadcastLobby();
  renderLobby();
}

// ---------- Lobby UI ----------
function el(tag, cls, text) { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; }
function btn(label, cls, fn) { const b = el('button', 'btn sm ' + (cls || ''), label); b.onclick = e => { e.stopPropagation(); Snd.play('select'); fn(); }; return b; }

function buildRoster() {
  const r = $('roster');
  r.innerHTML = '';
  for (const C of CHARS) {
    const d = el('div', 'rc'); d.dataset.ch = C.id;
    const c2 = document.createElement('canvas'); c2.width = c2.height = 130;
    c2.getContext('2d').drawImage(portrait(C.id, 130), 0, 0);
    d.appendChild(c2); d.appendChild(el('div', 'nm', C.name)); d.appendChild(el('div', 'pips'));
    d.onclick = () => pickChar(C.id);
    d.onmouseenter = () => showCharInfo(C.id);
    d.onmouseleave = () => showCharInfo(null);
    r.appendChild(d);
  }
  const st = $('stages');
  st.innerHTML = '';
  for (const S of STAGES) {
    const d = el('div', 'stg'); d.dataset.st = S.id; d.title = S.hazName;
    const c2 = document.createElement('canvas'); c2.width = 156; c2.height = 88;
    c2.getContext('2d').drawImage(stageThumb(S.id, 156, 88), 0, 0);
    d.appendChild(c2); d.appendChild(el('div', 'nm', S.name));
    d.onclick = () => { if (role === 'client') return; Lobby.stage = S.id; Snd.play('select'); lobbyChanged(); };
    st.appendChild(d);
  }
}

function pickChar(id) {
  let k = role === 'client' ? Lobby.mySlot : Lobby.active;
  if (!canEditChar(k)) return;
  Lobby.slots[k].ch = id;
  if (k === Lobby.mySlot || (role === 'local' && Lobby.slots[k].type === 'p1')) { myChar = id; store('sst-char', id); }
  Snd.play('select'); voiceLine(90 + k, id, 'pick');
  if (role === 'client') netSend({ t: 'pick', ch: id });
  lobbyChanged();
}

function showCharInfo(id) {
  const s = Lobby.slots[role === 'client' ? Lobby.mySlot : Lobby.active];
  const C = CH[id || (s && s.ch) || 'toad'];
  const box = $('charInfo');
  box.innerHTML = '';
  box.appendChild(el('h3', '', C.name));
  box.appendChild(el('div', '', C.blurb));
  box.appendChild(el('div', 'moves', `Special: ${SPNAME[C.sp.n]}  ·  Side: ${SPNAME[C.sp.s]}  ·  Up: ${SPNAME[C.sp.u]}  ·  Down: ${SPNAME[C.sp.d]}`));
  const fsl = el('div', 'fsname', `Smash Mushroom finale: ${FSNAME[C.id]}`);
  const E = ELEM_INFO[C.elem];
  if (E) { const sp = el('span', 'elem', `   ·   ${E}`); sp.style.color = (ELEM_COL[C.elem] || ['#fff'])[0]; fsl.appendChild(sp); }
  box.appendChild(fsl);
}
// what each fighter's element does, for the lobby
const ELEM_INFO = {
  fire: 'Fire: hits burn, extra knockback', ice: 'Ice: smash attacks freeze', poison: 'Poison: smashes and combo finishers poison',
  electric: 'Electric: every hit shocks', wind: 'Wind: hits fly flatter and farther', rock: 'Rock: heavier smash attacks', music: 'Music: longer reach',
  shadow: 'Shadow: hits a little harder', light: 'Light: hits a little harder', steel: 'Steel: tough, solid hits',
  spore: 'Spore power', heart: 'Heart power', gold: 'Gold power', leaf: 'Leaf power', water: 'Sea power', heat: 'Kitchen heat',
  magic: 'Magic sparkles', cosmic: 'Cosmic power', dust: 'Desert dust', spirit: 'Spirit power', spark: 'Spark power', egg: 'Egg power', fruit: 'Fruit power',
  sakura: 'Cherry blossoms', storm: 'Northern storm', sand: 'Desert sand', bronze: 'Arena bronze', chi: 'Inner calm', lantern: 'Lantern glow', hymn: 'Choir power',
  joy: 'Pure joy', yin: "Beatrice's magic (her spark follows every hit)", speed: 'Pepper speed', plasma: 'Robo energy',
  fiesta: 'Fiesta confetti', holi: 'Holi colors',
};

function renderLobby() {
  const titles = { local: 'Local Play: pick your Toads', host: 'Online Room: share the code!', client: 'Online Room' };
  $('lbTitle').textContent = titles[role];
  const code = $('lbCode');
  code.classList.toggle('hidden', role === 'local');
  if (role !== 'local') { code.innerHTML = ''; code.append('Room code: '); code.appendChild(el('b', '', Net.code)); }
  // roster pips
  for (const d of $('roster').children) {
    const pips = d.querySelector('.pips');
    pips.innerHTML = '';
    Lobby.slots.forEach((s, k) => {
      if (s.type !== 'off' && s.ch === d.dataset.ch) { const p = el('i', '', String(k + 1)); p.style.background = SLOT_COLORS[k]; pips.appendChild(p); }
    });
  }
  // slots
  const box = $('slots');
  box.innerHTML = '';
  Lobby.slots.forEach((s, k) => {
    const d = el('div', 'slot' + (s.type === 'off' ? ' off' : '') + (k === (role === 'client' ? Lobby.mySlot : Lobby.active) ? ' active' : ''));
    d.style.borderColor = SLOT_COLORS[k];
    const c2 = document.createElement('canvas'); c2.width = c2.height = 96;
    const cc = c2.getContext('2d');
    if (s.type === 'off') { cc.fillStyle = '#3a2d48'; cc.fillRect(0, 0, 96, 96); txt(cc, '?', 48, 66, 54, '#6b5a80', null); }
    else cc.drawImage(portrait(s.ch, 96), 0, 0);
    d.appendChild(c2);
    const info = el('div', 'info');
    const streak = role === 'client' ? s.streak | 0 : s.type !== 'off' ? streakOf(k) : 0;
    const who = el('div', 'who', slotLabel(s, k) + (streak >= 2 ? '  🔥' + streak : '')); who.style.color = SLOT_COLORS[k];
    if (streak >= 2) who.title = streak + ' wins in a row';
    info.appendChild(who);
    info.appendChild(el('div', 'cn', s.type === 'off' ? (role === 'local' ? 'Not playing' : 'Friends can join here') : CH[s.ch].name));
    const row = el('div', 'row');
    if (canChangeType(k)) row.appendChild(btn(s.type === 'off' ? 'Add' : 'Change', 'gray', () => cycleType(k)));
    if (s.type === 'cpu' && canChangeType(k)) row.appendChild(btn('Lv ' + s.lvl, 'blue', () => { s.lvl = (s.lvl % 3) + 1; lobbyChanged(); }));
    else if (s.type === 'cpu') row.appendChild(el('div', 'cn', 'Level ' + s.lvl));
    // the host can remove an online guest from the room
    if (role === 'host' && s.type === 'net') row.appendChild(btn('Kick', '', () => kickPlayer(k)));
    info.appendChild(row);
    d.appendChild(info);
    d.onclick = () => { if (role !== 'client' && canEditChar(k)) { Lobby.active = k; Snd.play('select'); renderLobby(); } };
    box.appendChild(d);
  });
  for (const d of $('stages').children) d.classList.toggle('sel', d.dataset.st === Lobby.stage);
  $('optStocks').textContent = Lobby.stocks;
  $('optItems').textContent = Lobby.items === 'smash' ? 'SMASH ONLY' : Lobby.items ? 'ON' : 'OFF';
  $('optItems').className = 'btn sm ' + (Lobby.items === 'smash' ? 'yellow' : Lobby.items ? 'green' : 'gray');
  $('optItems').title = Lobby.items === 'smash' ? 'Only Smash Mushrooms show up, and much more often' : Lobby.items ? 'All items' : 'No items';
  $('optHaz').textContent = Lobby.hazards ? 'ON' : 'OFF';
  $('optHaz').className = 'btn sm ' + (Lobby.hazards ? 'green' : 'gray');
  $('optMusic').textContent = musicName(Lobby.music);
  for (const b of document.querySelectorAll('[data-opt]')) b.disabled = role === 'client';
  $('lbStart').classList.toggle('hidden', role === 'client');
  $('lbWait').classList.toggle('hidden', role !== 'client');
  $('lbStart').disabled = !Lobby.slots.some(s => s.type !== 'off');
  showCharInfo(null);
}
for (const b of document.querySelectorAll('[data-opt]')) {
  b.addEventListener('click', () => {
    if (role === 'client') return;
    const o = b.dataset.opt;
    if (o === 'stocks-') Lobby.stocks = Math.max(1, Lobby.stocks - 1);
    if (o === 'stocks+') Lobby.stocks = Math.min(9, Lobby.stocks + 1);
    // items: on -> Smash Mushrooms only -> off
    if (o === 'items') Lobby.items = Lobby.items === true ? 'smash' : Lobby.items === 'smash' ? false : true;
    if (o === 'hazards') Lobby.hazards = !Lobby.hazards;
    if (o === 'music') {
      const i = MUSIC_OPTS.findIndex(m => m[0] === Lobby.music);
      Lobby.music = MUSIC_OPTS[(i + 1) % MUSIC_OPTS.length][0];
      store('sst-music', Lobby.music);
    }
    Snd.play('select');
    lobbyChanged();
  });
}

function showScreen(id) {
  for (const s of ['start', 'title', 'lobby']) if ($(s)) $(s).classList.toggle('hidden', s !== id);
  for (const s of ['pause', 'results']) $(s).classList.add('hidden');
  setTimeout(autoFit, 0);
}
// all the way back to the main page (where you host, join with a code, or start local play), leaving any online room
function toMainMenu() { leaveOnline(); toTitle(''); }
// the start menu: the first press also wakes up the sound, so the boot-up sting plays right as you start
function pressStart() {
  if (mode !== 'start') return;
  Snd.init();
  mode = 'title';
  showScreen('title');
}
function showLobby() {
  mode = 'lobby'; G = null; paused = false;
  showScreen('lobby');
  renderLobby();
  Snd.music('lobby'); Snd.duck(false);
}
function toTitle(msg) {
  mode = 'title'; G = null; paused = false;
  showScreen('title');
  titleMsg(msg);
  Snd.music('title'); Snd.duck(false);
}

// ---------- Match flow ----------
function buildCfg() {
  const hasP2 = Lobby.slots.some(s => s.type === 'p2');
  const slots = Lobby.slots.map((s, k) => {
    if (s.type === 'off') return null;
    let ctrl, tag;
    if (role === 'local') {
      ctrl = s.type === 'p1' && !hasP2 ? 'any' : s.type;
      tag = s.type === 'p1' ? 'P1' : s.type === 'p2' ? 'P2' : 'CPU';
    } else if (s.type === 'host') { ctrl = 'any'; tag = myName(); }
    else if (s.type === 'net') { ctrl = 'net'; tag = s.name || 'Player'; }
    else { ctrl = 'cpu'; tag = 'CPU'; }
    return { slot: k, ch: s.ch, name: tag, tag, ctrl, pid: s.pid, lvl: s.lvl };
  });
  return { stage: Lobby.stage, stocks: Lobby.stocks, items: Lobby.items, hazards: Lobby.hazards, slots };
}
function enterGame(stage, songs) {
  mode = 'game'; paused = false; resultsShown = false; goT = 0;
  showScreen(null);
  PT.length = 0;
  cam.x = 0; cam.y = -150; cam.z = 0.8; cam.shake = 0;
  for (const k in hudMem) delete hudMem[k];
  Snd.playlist(songs && songs.length ? songs : [stage], 100); Snd.duck(false);
}
function startMatch() {
  G = makeGame(buildCfg());
  pendingEv = [];
  const songs = battleOrder(G.stage);
  enterGame(G.stage, songs);
  if (role === 'host') netBroadcast({ t: 'start', stage: G.stage, songs });
}
function backToLobby() {
  showLobby();
  if (role === 'host') broadcastLobby();
}
// ---------- Win streaks (for this play session) ----------
// keyed by who sits in each slot: P1/P2, an online guest's connection, the host, or a CPU slot
const Streaks = {};
function streakKey(s, k) {
  if (!s) return 'slot' + k;
  if (s.type === 'net') return 'net:' + s.pid;
  if (s.type === 'cpu' || s.type === 'off') return 'cpu' + k;
  return s.type; // p1, p2, host
}
function streakOf(k) { return Streaks[streakKey(Lobby.slots[k], k)] || 0; }
// a match just ended (host or local): the winner's streak grows, everyone else's resets; results carry the numbers
function updateStreaks(g) {
  for (const f of g.fighters) {
    const key = streakKey(Lobby.slots[f.i], f.i);
    Streaks[key] = f.i === g.winner ? (Streaks[key] || 0) + 1 : 0;
  }
  for (const r of g.results || []) r.streak = Streaks[streakKey(Lobby.slots[r.i], r.i)] || 0;
  const me = Lobby.slots.findIndex(s => s.type === 'p1' || s.type === 'host');
  if (me >= 0 && g.winner === me) { const n = streakOf(me); if (n > (+store('sst-best') || 0)) store('sst-best', String(n)); }
}

function showResults(res, winner) {
  resultsShown = true;
  Snd.music('results'); Snd.duck(false);
  const box = $('resBox');
  box.innerHTML = '';
  if (!res || !res.length) return;
  const w = res[0], C = CH[w.ch] || CH.toad;
  if (winner >= 0) setTimeout(() => voiceLine(80, w.ch, 'win'), 400);
  const who = !w.tag || w.tag === 'CPU' ? `CPU ${C.name}` : w.tag;
  box.appendChild(el('h2', '', winner >= 0 ? `${who} wins!` : 'No contest!'));
  if (winner >= 0) {
    const row = el('div', 'win');
    const c2 = document.createElement('canvas'); c2.width = c2.height = 160;
    c2.getContext('2d').drawImage(portrait(w.ch, 160), 0, 0);
    c2.style.borderColor = SLOT_COLORS[w.i];
    row.appendChild(c2);
    const t = el('div');
    t.appendChild(el('div', '', C.name)).style.cssText = 'font-family:Lilita One;font-size:30px';
    t.appendChild(el('div', 'q', '“' + C.quote + '”'));
    // a win streak gets a banner
    if (w.streak >= 2) t.appendChild(el('div', 'streak', `🔥 ${w.streak} wins in a row!`));
    row.appendChild(t);
    box.appendChild(row);
  }
  const best = +store('sst-best') || 0;
  if (best >= 2) box.appendChild(el('div', 'bestStreak', `Your best win streak: ${best}`));
  const tb = el('table', 'res');
  const hr = el('tr');
  for (const h of ['#', 'Player', 'Fighter', 'KOs', 'Falls', 'Damage dealt', 'Win streak']) hr.appendChild(el('th', '', h));
  tb.appendChild(hr);
  res.forEach((r, n) => {
    const tr = el('tr');
    const cells = [String(n + 1), r.tag || '', (CH[r.ch] || CH.toad).name, String(r.kos), String(r.falls), r.dealt + '%', r.streak ? (r.streak >= 2 ? '🔥 ' : '') + r.streak : '0'];
    cells.forEach((v, j) => { const td = el('td', '', v); if (j === 1) td.style.color = SLOT_COLORS[r.i]; tr.appendChild(td); });
    tb.appendChild(tr);
  });
  box.appendChild(tb);
  const rowB = el('div'); rowB.style.cssText = 'display:flex;gap:14px';
  if (role === 'client') {
    rowB.appendChild(el('div', '', 'Waiting for the host…'));
    rowB.appendChild(btn('Leave room (main menu)', 'gray', toMainMenu));
  } else {
    const a = el('button', 'btn green', 'Rematch!'); a.onclick = () => startMatch();
    const b = el('button', 'btn', 'Character select'); b.onclick = () => backToLobby();
    // the host closes the room for everyone; local play just goes back to the main page
    const c = el('button', 'btn gray', role === 'host' ? 'Close room (main menu)' : 'Main menu'); c.onclick = toMainMenu;
    rowB.append(a, b, c);
  }
  box.appendChild(rowB);
  $('results').classList.remove('hidden');
  setTimeout(autoFit, 0);
}

function onEsc() {
  if (!$('help').classList.contains('hidden')) { $('help').classList.add('hidden'); return; }
  if (!$('settings').classList.contains('hidden')) { $('settings').classList.add('hidden'); return; }
  if (mode !== 'game' || resultsShown) return;
  const p = $('pause');
  if (!p.classList.contains('hidden')) { p.classList.add('hidden'); paused = false; Snd.duck(false); return; }
  $('pauseTitle').textContent = role === 'local' ? 'Paused' : role === 'host' ? 'End the match?' : 'Leave the room?';
  $('pQuit').textContent = role === 'client' ? 'Leave room (main menu)' : 'Character select';
  // the host and local players can also go all the way back to the main page
  $('pMenu').classList.toggle('hidden', role === 'client');
  $('pMenu').textContent = role === 'host' ? 'Close room (main menu)' : 'Main menu';
  p.classList.remove('hidden');
  Snd.duck(true);
  if (role === 'local') paused = true;
}
$('pResume').onclick = () => { $('pause').classList.add('hidden'); paused = false; Snd.duck(false); };
$('pQuit').onclick = () => {
  $('pause').classList.add('hidden');
  Snd.duck(false);
  if (role === 'client') toMainMenu(); else backToLobby();
};
$('pMenu').onclick = () => { $('pause').classList.add('hidden'); Snd.duck(false); toMainMenu(); };

function toggleMute() { const m = Snd.toggleMute(); $('muteBtn').textContent = m ? '✕♪' : '♪'; toast(m ? 'Sound off (M)' : 'Sound on (M)'); }
$('muteBtn').onclick = () => { Snd.init(); toggleMute(); };
$('muteBtn').textContent = Snd.isMuted() ? '✕♪' : '♪';

// ---------- Online (PeerJS, host-authoritative) ----------
// taps: buttons pressed since the host last read them, so a quick tap whose press and release arrive
// in the same frame still registers
const Net = { peer: null, conns: new Map(), conn: null, inputs: {}, taps: {}, lastSent: -1, code: '', banned: new Set(), bannedNames: new Set() };
// the host removes an online guest from the room (they can't come back to this room under the same name)
function kickPlayer(k) {
  const s = Lobby.slots[k];
  if (role !== 'host' || !s || s.type !== 'net') return;
  for (const [pid, e] of Net.conns) {
    if (e.slot !== k) continue;
    Net.banned.add(pid);
    try { e.conn.send({ t: 'kicked' }); } catch (err) { /* already gone */ }
    setTimeout(() => { try { e.conn.close(); } catch (err) { /* already closed */ } }, 300);
    Net.conns.delete(pid); delete Net.inputs[pid]; delete Net.taps[pid];
  }
  if (s.name) Net.bannedNames.add(s.name.toLowerCase());
  toast((s.name || 'The player') + ' was removed from the room.');
  Lobby.slots[k] = { type: 'off', ch: s.ch, lvl: 2 };
  lobbyChanged();
}
const SN = { prev: null, cur: null, at: 0 };
function netSend(m) { if (Net.conn && Net.conn.open) try { Net.conn.send(m); } catch (e) { /* dropped */ } }
function netBroadcast(m) { for (const e of Net.conns.values()) if (e.conn.open) try { e.conn.send(m); } catch (err) { /* dropped */ } }
function lobbyPublic() {
  return {
    slots: Lobby.slots.map((s, k) => ({ type: s.type, ch: s.ch, name: s.type === 'host' ? myName() : s.name || '', lvl: s.lvl, streak: s.type !== 'off' ? streakOf(k) : 0 })),
    stage: Lobby.stage, stocks: Lobby.stocks, items: Lobby.items, hazards: Lobby.hazards, music: Lobby.music, code: Net.code,
  };
}
function broadcastLobby() {
  const L = lobbyPublic();
  for (const e of Net.conns.values()) if (e.conn.open) try { e.conn.send({ t: 'lobby', L, you: e.slot }); } catch (err) { /* dropped */ }
}
function leaveOnline() {
  const old = role;
  role = 'local';
  try { if (Net.conn) Net.conn.close(); } catch (e) { /* already closed */ }
  for (const e of Net.conns.values()) try { e.conn.close(); } catch (err) { /* already closed */ }
  Net.conns.clear();
  try { if (Net.peer) Net.peer.destroy(); } catch (e) { /* already gone */ }
  Net.peer = null; Net.conn = null; Net.inputs = {}; Net.taps = {}; SN.prev = SN.cur = null; Net.banned.clear(); Net.bannedNames.clear();
  return old;
}
function randCode() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
// the online library (PeerJS) loads in the background; if it isn't here yet, wait for it a little instead of failing
const NO_ONLINE = 'Online play could not load: no internet, or this network blocks it. Local Play still works!';
function withPeer(go) {
  if (typeof Peer !== 'undefined') return go();
  if (window.PEER_FAILED || performance.now() > 20000) { titleMsg(NO_ONLINE); return; }
  if (withPeer.wait) return; // already waiting
  titleMsg('Loading online play…');
  const t0 = performance.now();
  withPeer.wait = setInterval(() => {
    if (typeof Peer === 'undefined' && !window.PEER_FAILED && performance.now() - t0 < 12000) return;
    clearInterval(withPeer.wait); withPeer.wait = 0;
    if (typeof Peer === 'undefined') titleMsg(NO_ONLINE); else { titleMsg(''); go(); }
  }, 200);
}

function hostOnline(tries) {
  Snd.init();
  if (typeof Peer === 'undefined') return withPeer(() => hostOnline(tries));
  leaveOnline();
  titleMsg('Opening a room…');
  const code = randCode();
  const peer = new Peer(PEER_PREFIX + code.toLowerCase(), { debug: 1 });
  Net.peer = peer;
  peer.on('open', () => {
    Net.code = code; role = 'host';
    hostDefaults();
    titleMsg('');
    showLobby();
    toast('Room ' + code + ' is open! Share the code with friends.');
  });
  peer.on('error', err => {
    if (err.type === 'unavailable-id' && (tries || 0) < 4) { try { peer.destroy(); } catch (e) { /* ignore */ } hostOnline((tries || 0) + 1); return; }
    if (role === 'host') toast('Online error: ' + err.type);
    else { leaveOnline(); titleMsg('Could not open a room (' + err.type + ').'); }
  });
  peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* ignore */ } });
  peer.on('connection', conn => {
    conn.on('open', () => onClientJoin(conn));
    conn.on('data', d => onHostData(conn, d));
    conn.on('close', () => onClientLeave(conn));
    conn.on('error', () => onClientLeave(conn));
  });
}
function onClientJoin(conn) {
  if (role !== 'host') return;
  // the same guest can arrive twice when the connection handshake is retried: keep its slot, use the new link
  const known = Net.conns.get(conn.peer);
  if (known) {
    const old = known.conn;
    known.conn = conn;
    if (old !== conn) try { old.close(); } catch (e) { /* already closed */ }
    if (mode === 'lobby') lobbyChanged();
    return;
  }
  if (Net.banned.has(conn.peer)) { conn.send({ t: 'kicked' }); setTimeout(() => conn.close(), 400); return; }
  if (mode === 'game') { conn.send({ t: 'busy' }); setTimeout(() => conn.close(), 400); return; }
  let k = Lobby.slots.findIndex((s, i) => i > 0 && s.type === 'off');
  if (k < 0) k = Lobby.slots.findIndex((s, i) => i > 0 && s.type === 'cpu');
  if (k < 0) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 400); return; }
  Lobby.slots[k] = { type: 'net', pid: conn.peer, ch: 'toad', name: 'Player', lvl: 2 };
  Net.conns.set(conn.peer, { conn, slot: k });
  Snd.play('join');
  lobbyChanged();
}
function onHostData(conn, d) {
  const e = Net.conns.get(conn.peer);
  if (!e || !d || typeof d !== 'object') return;
  const s = Lobby.slots[e.slot];
  if (d.t === 'in') {
    const b = (d.b | 0) & B_ALL;
    if (G && G.phase === 'play') Net.taps[conn.peer] = (Net.taps[conn.peer] | 0) | (b & ~(Net.inputs[conn.peer] | 0));
    Net.inputs[conn.peer] = b;
    return;
  }
  if (mode !== 'lobby' || !s || s.type !== 'net') return;
  if (d.t === 'hello') {
    s.name = cleanName(d.name) || 'Player'; if (CH[d.ch]) s.ch = d.ch;
    if (Net.bannedNames.has(s.name.toLowerCase())) { kickPlayer(e.slot); return; } // kicked earlier: still not welcome
    toast(s.name + ' joined!'); lobbyChanged();
  }
  else if (d.t === 'pick' && CH[d.ch]) { s.ch = d.ch; lobbyChanged(); }
}
function onClientLeave(conn) {
  const e = Net.conns.get(conn.peer);
  if (!e || e.conn !== conn) return; // unknown, or an older duplicate link closing
  Net.conns.delete(conn.peer);
  delete Net.inputs[conn.peer]; delete Net.taps[conn.peer];
  const s = Lobby.slots[e.slot];
  toast((s.name || 'A player') + ' left.');
  if (G) for (const f of G.fighters) if (f.pid === conn.peer) { f.ctrl = 'cpu'; f.tag = 'CPU'; f.nm = 'CPU'; }
  Lobby.slots[e.slot] = { type: 'cpu', ch: s.ch, lvl: 2 };
  if (mode === 'lobby') lobbyChanged();
}

function joinOnline(code) {
  Snd.init();
  code = String(code || '').toUpperCase().trim();
  if (!/^[A-Z]{4}$/.test(code)) { titleMsg('Room codes are 4 letters, like TOAD.'); return; }
  if (typeof Peer === 'undefined') return withPeer(() => joinOnline(code));
  leaveOnline();
  titleMsg('Connecting to room ' + code + '…');
  const peer = new Peer({ debug: 1 });
  Net.peer = peer;
  peer.on('open', () => {
    if (Net.conn) return; // PeerJS can report 'open' again after a hiccup; keep the one connection
    const conn = peer.connect(PEER_PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' });
    Net.conn = conn;
    // setting up the direct connection usually takes 5-10 s, so be patient and say so
    const slow = setTimeout(() => { if (!conn.open && Net.conn === conn) titleMsg('Still connecting to room ' + code + '…'); }, 8000);
    const to = setTimeout(() => { if (!conn.open && Net.conn === conn) { leaveOnline(); titleMsg('Could not reach room ' + code + '. Check the code and try again.'); } }, 25000);
    conn.on('open', () => {
      clearTimeout(to); clearTimeout(slow);
      role = 'client'; Net.code = code;
      conn.send({ t: 'hello', name: myName(), ch: myChar });
    });
    conn.on('data', onClientData);
    conn.on('close', () => { if (role === 'client' && Net.conn === conn) { leaveOnline(); toTitle('Disconnected from the host.'); } });
  });
  peer.on('error', err => {
    const was = leaveOnline();
    const m = err.type === 'peer-unavailable' ? 'Room ' + code + ' not found.' : 'Online error: ' + err.type;
    if (was === 'client') toTitle(m); else titleMsg(m);
  });
}
function onClientData(d) {
  if (!d || typeof d !== 'object') return;
  switch (d.t) {
    case 'lobby': {
      const L = d.L || {};
      Lobby.slots = (L.slots || []).slice(0, 4).map(s => ({ type: s.type, ch: CH[s.ch] ? s.ch : 'toad', name: cleanName(s.name), lvl: s.lvl | 0, streak: Math.max(0, s.streak | 0) }));
      Lobby.stage = STG[L.stage] ? L.stage : 'town';
      Lobby.stocks = L.stocks | 0; Lobby.items = L.items === 'smash' ? 'smash' : !!L.items; Lobby.hazards = !!L.hazards;
      Lobby.music = MUSIC_OPTS.some(m => m[0] === L.music) ? L.music : 'shuffle';
      Lobby.mySlot = d.you | 0; Lobby.active = Lobby.mySlot;
      if (mode !== 'lobby') { titleMsg(''); showLobby(); } else renderLobby();
      break;
    }
    case 'start': {
      SN.prev = SN.cur = null;
      const songs = Array.isArray(d.songs) ? d.songs.filter(s => BATTLE_SONGS.includes(s)).slice(0, BATTLE_SONGS.length) : null;
      enterGame(STG[d.stage] ? d.stage : 'town', songs);
      break;
    }
    case 's': onSnap(d.d); break;
    case 'busy': leaveOnline(); toTitle('That room is mid-match. Try again in a moment.'); break;
    case 'kicked': leaveOnline(); toTitle('The host removed you from the room.'); break;
    case 'full': leaveOnline(); toTitle('That room is full.'); break;
  }
}
function onSnap(s) {
  if (!s || !STG[s.stage]) return;
  SN.prev = SN.cur; SN.cur = s; SN.at = performance.now();
  if (s.ev) handleEvents(s.ev);
  if (mode !== 'game') enterGame(s.stage);
}
function clientView() {
  const c = SN.cur, p = SN.prev;
  if (!c) return null;
  if (!p) return c;
  const a = Math.min(1, (performance.now() - SN.at) / (STEP * 2));
  const pf = {}, pp = {}, px = {};
  for (const f of p.fighters) pf[f.i] = f;
  for (const q of p.proj) pp[q.id] = q;
  for (const e of p.fx || []) px[e.id] = e;
  return Object.assign({}, c, {
    frame: p.frame + (c.frame - p.frame) * a,
    fighters: c.fighters.map(f => {
      const o = pf[f.i];
      if (!o || Math.abs(o.x - f.x) > 250 || Math.abs(o.y - f.y) > 250) return f;
      return Object.assign({}, f, { x: o.x + (f.x - o.x) * a, y: o.y + (f.y - o.y) * a });
    }),
    proj: c.proj.map(q => { const o = pp[q.id]; return o ? Object.assign({}, q, { x: o.x + (q.x - o.x) * a, y: o.y + (q.y - o.y) * a }) : q; }),
    fx: (c.fx || []).map(e => { const o = px[e.id]; return o && Math.abs(o.x - e.x) < 400 ? Object.assign({}, e, { x: o.x + (e.x - o.x) * a, y: o.y + (e.y - o.y) * a }) : e; }),
    kart: c.kart && p.kart ? Object.assign({}, c.kart, { x: p.kart.x + (c.kart.x - p.kart.x) * a }) : c.kart,
  });
}

// ---------- Effects from game events (sound + particles, on every machine) ----------
function say(text, x, y, size, color) { addP({ type: 'text', text, x, y, vy: -1.1, size: size || 22, color: color || '#ffffff', life: 70, drag: 0.98 }); }
// each fighter's element flavours their hits: flames, frost, bubbles, sparks, music notes...
const ELEM_FX = {
  fire: ['dot', 'rise'], heat: ['dot', 'rise'], spark: ['spark'], ice: ['flake'], poison: ['bubble', 'rise'], water: ['bubble'], electric: ['spark', 'zap'],
  wind: ['puff'], rock: ['dot', 'fall'], dust: ['puff'], music: ['note', 'rise'], heart: ['heart', 'rise'], shadow: ['puff'], spirit: ['puff'],
  light: ['star'], gold: ['star'], magic: ['star'], cosmic: ['star'], leaf: ['dot', 'fall'], spore: ['dot', 'fall'], egg: ['star'], fruit: ['dot', 'fall'], steel: ['spark'],
  sakura: ['dot', 'fall'], storm: ['spark'], sand: ['puff'], bronze: ['spark'], chi: ['star'], lantern: ['star', 'rise'], hymn: ['note', 'rise'], joy: ['star', 'rise'],
  yin: ['star'], speed: ['spark'], plasma: ['spark'], fiesta: ['dot', 'fall'], holi: ['puff'],
};
function elemBurst(el, x, y, p, n0) {
  const F = ELEM_FX[el], C = ELEM_COL[el];
  if (!F || !C) return;
  const n = n0 || 4 + Math.min(8, Math.round(p * 0.4)), type = F[0], mode = F[1];
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * (2 + p * 0.15), col = k % 2 ? C[1] : C[0];
    const o = { type, x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: col, size: type === 'note' ? 6 : type === 'puff' ? 7 : 5, life: 22 + Math.random() * 12, drag: 0.9 };
    if (mode === 'rise') { o.vy = -1.5 - Math.random() * 2; o.vx *= 0.5; o.drag = 0.96; }
    if (mode === 'fall') o.g = 0.25;
    if (type === 'puff') o.tint = col;
    addP(o);
  }
  if (mode === 'zap' && p > 6) Snd.play('zap');
}
// ---- character voices: each fighter yelps, grunts and cheers in their own voice, but not too often ----
const VO = { last: {}, glob: 0 };
const NO_VOICE_SP = { scream: 1, scold: 1, brigade: 1, cowcharge: 1, moonjump: 1, minya: 1, murak: 1, haunt: 1, crown: 1 };
const BEAKO_VOICE = { k: 'girl', p: 2.05, yo: false };
function voiceLine(i, ch, line, chance) {
  if (!CH[ch] || (chance !== undefined && Math.random() >= chance)) return;
  const now = performance.now(), key = i + ':' + ch, gap = line === 'ko' || line === 'win' ? 0 : line === 'hurt' ? 260 : 330;
  if (now - (VO.last[key] || 0) < gap || (line !== 'ko' && now - VO.glob < 90)) return;
  VO.last[key] = now; VO.glob = now;
  Snd.talk(voiceOf(ch), line);
}
function handleEvents(evs) {
  for (const e of evs) {
    switch (e.t) {
      case 'hit':
        Snd.play('hit', e.p);
        if (e.v !== undefined && e.p >= 5) voiceLine(e.v, e.vch, 'hurt', e.p >= 12 ? 0.9 : 0.45);
        burst(e.x, e.y, 6 + Math.min(14, e.p), '#fff6a0', 4 + e.p * 0.4, 'spark', 4, 16);
        addP({ type: 'ring', x: e.x, y: e.y, size: 30 + e.p * 3, color: '#ffffff', life: 14 });
        if (e.p > 16) cam.shake = Math.max(cam.shake, e.p * 0.7);
        if (e.p > 22) burst(e.x, e.y, 6, '#ffe866', 8, 'star', 7, 30);
        if (e.el) elemBurst(e.el, e.x, e.y, e.p);
        break;
      case 'block': Snd.play('block'); addP({ type: 'ring', x: e.x, y: e.y, size: 40, color: '#9fe4ff', life: 12 }); break;
      case 'break': Snd.play('break'); burst(e.x, e.y, 12, '#ffe866', 6, 'star', 6, 40); say('Shield break!', e.x, e.y - 20, 22, '#ffe866'); break;
      case 'ko':
        Snd.play('ko'); cam.shake = 28; voiceLine(e.i, e.ch, 'ko');
        addP({ type: 'ko', x: e.x, y: e.y, color: SLOT_COLORS[e.i] || '#fff', rot: Math.random(), life: 50 });
        burst(e.x, e.y, 30, SLOT_COLORS[e.i] || '#fff', 14, 'spark', 6, 30);
        break;
      case 'jump': Snd.play('jump'); for (const s of [-1, 1]) addP({ type: 'puff', x: e.x + s * 10, y: e.y - 4, vx: s * 1.5, size: 7, color: 'rgba(255,255,255,0.7)', life: 18 }); break;
      case 'djump': Snd.play('djump'); addP({ type: 'ring', x: e.x, y: e.y - 6, size: 28, color: 'rgba(255,255,255,0.8)', life: 14 }); if (e.i !== undefined) voiceLine(e.i, e.c, 'jump', 0.35); break;
      case 'walljump': Snd.play('djump'); for (let k = 0; k < 4; k++) addP({ type: 'puff', x: e.x, y: e.y + (k - 1.5) * 12, vx: (e.dir || 1) * 1.6, size: 6, color: 'rgba(255,255,255,0.85)', life: 16 }); break;
      case 'uplift': Snd.play('flutter'); addP({ type: 'ring', x: e.x, y: e.y - 6, size: 22, color: 'rgba(255,246,170,0.9)', life: 12 }); break;
      case 'land': for (const s of [-1, 1]) addP({ type: 'puff', x: e.x + s * 12, y: e.y - 3, vx: s * 1.2, size: 5, color: 'rgba(255,255,255,0.55)', life: 14 }); break;
      case 'swing': Snd.play('swing'); if (e.i !== undefined) voiceLine(e.i, e.ch, e.s ? 'smash' : Math.random() < 0.5 ? 'atk' : 'atk2', e.s ? 1 : 0.4); break;
      case 'spc': if (e.sp === 'fs') voiceLine(e.i, e.ch, 'smash'); else if (!NO_VOICE_SP[e.sp]) voiceLine(e.i, e.ch, 'spc', 0.55); break;
      // ---- the v1.7 fighters ----
      case 'beako': // Beatrice calls out her spell from the backpack
        Snd.play('magic'); Snd.talk(BEAKO_VOICE, 'spc'); if (e.s) say(e.s, e.x, e.y, 22, '#d8b0ff');
        for (let k = 0; k < 6; k++) addP({ type: 'star', x: e.x + (Math.random() - 0.5) * 40, y: e.y + 30, vy: -0.8, size: 5, color: k % 2 ? '#c890ff' : '#ff9cd0', life: 24 });
        break;
      case 'beakospark': Snd.play('sparkle'); burst(e.x, e.y, 5, '#c890ff', 4, 'star', 4, 16); break;
      case 'unseen': Snd.play('unseen'); for (let k = 0; k < 6; k++) addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 50, y: e.y + 40, vy: -0.5, size: 8, tint: 'rgba(40,20,60,0.7)', life: 26 }); break;
      case 'slashfx': Snd.play('slash'); break;
      case 'petal': addP({ type: 'dot', x: e.x + (Math.random() - 0.5) * 30, y: e.y, vy: 0.6, size: 5, color: Math.random() < 0.5 ? '#ffc0d8' : '#ffffff', life: 26, g: 0.02 }); break;
      case 'warhorn': break;
      case 'hornblast': Snd.play('hornblast'); cam.shake = Math.max(cam.shake, 8); addP({ type: 'ring', x: e.x, y: e.y, size: (e.r || 120) * 1.1, color: '#e6eef8', life: 20 }); addP({ type: 'ring', x: e.x, y: e.y, size: (e.r || 120) * 0.7, color: '#ffffff', life: 16 }); break;
      case 'scarabfx': Snd.play('scarab'); break;
      case 'sandfx': if (e.dir) Snd.play('sand'); addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 30, y: e.y + 10, vy: -0.4, size: 7, tint: 'rgba(232,207,143,0.85)', life: 22 }); break;
      case 'netcatch': Snd.play('netcatch'); say('Caught!', e.x, e.y - 30, 20, '#ffe0a8'); break;
      case 'chifx': Snd.play('chi'); addP({ type: 'ring', x: e.x, y: e.y, size: 40, color: '#ffe28a', life: 14 }); break;
      case 'chime': Snd.play('chime'); break;
      case 'jellyfx': Snd.play('jelly'); break;
      case 'bikebell': Snd.play('bikebell'); say('Ring ring!', e.x, e.y - 70, 18, '#bfe0ff'); break;
      case 'highnote': Snd.play('choir'); break;
      case 'notefx': addP({ type: 'note', x: e.x + (Math.random() - 0.5) * 30, y: e.y, vy: 1, size: 6, color: Math.random() < 0.5 ? '#9fc8ff' : '#ffffff', life: 26 }); break;
      case 'notesfx': for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + Math.random(); addP({ type: 'note', x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, size: 6, color: k % 2 ? '#ffe066' : '#7dbbff', life: 28, drag: 0.94 }); } addP({ type: 'ring', x: e.x, y: e.y, size: (e.r || 60) * 1.1, color: '#ffe066', life: 14 }); break;
      case 'klezmer': Snd.play('klezmer'); break;
      case 'chairup': Snd.play('chairup'); say('Hey!', e.x, e.y - 90, 22, '#ffe066'); break;
      case 'blasterfx': Snd.play('blaster'); addP({ type: 'ring', x: e.x, y: e.y, size: 18, color: '#7dff9a', life: 10 }); break;
      // Catholic Toad
      case 'bellswing': Snd.play('swing'); break;
      case 'bellring': Snd.play('bell'); say('Ding-dong!', e.x, e.y - 50, 20, '#ffe28a'); addP({ type: 'ring', x: e.x, y: e.y, size: (e.r || 44) * 1.4, color: '#ffe28a', life: 16 }); break;
      case 'popper': Snd.play('popper'); for (let k = 0; k < 14; k++) addP({ type: 'dot', x: e.x + (Math.random() - 0.5) * 30, y: e.y, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 6, g: 0.18, size: 5, color: ['#ff4fa0', '#ffd23a', '#3fbf4a', '#2f7cf6'][k % 4], life: 40 }); break;
      case 'confetti': addP({ type: 'dot', x: e.x + (Math.random() - 0.5) * 30, y: e.y + 10, vy: 0.5, g: 0.05, size: 4, color: ['#ff4fa0', '#ffd23a', '#3fbf4a', '#2f7cf6'][Math.floor(Math.random() * 4)], life: 30 }); break;
      case 'candy':
        Snd.play('candy'); say('Candy!', e.x, e.y - 40, 22, '#ff9cd0'); cam.shake = Math.max(cam.shake, 6);
        for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; addP({ type: k % 3 ? 'dot' : 'star', x: e.x, y: e.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5 - 2, g: 0.2, size: 5, color: ['#ff4fa0', '#ffd23a', '#3fbf4a', '#2f7cf6', '#ff8a1f'][k % 5], life: 40, drag: 0.97 }); }
        break;
      // Hindu Toad
      case 'gulalfx': Snd.play('poof2'); break;
      case 'dandiyafx': Snd.play('clack'); break;
      case 'kitefx': addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 20, y: e.y + 10, vy: 0.6, size: 6, tint: ['rgba(255,120,190,0.7)', 'rgba(120,220,130,0.7)', 'rgba(255,220,90,0.7)', 'rgba(110,160,255,0.7)'][Math.floor(Math.random() * 4)], life: 20 }); break;
      case 'squirt': Snd.play('squirt'); break;
      case 'splashfx': Snd.play('squirt'); for (let k = 0; k < 6; k++) addP({ type: 'dot', x: e.x + (e.dir || 1) * (Math.random() * 30), y: e.y + (Math.random() - 0.5) * 20, vx: (e.dir || 1) * (2 + Math.random() * 3), vy: -1 - Math.random() * 2, g: 0.2, size: 5, color: ['#ff4fa0', '#3fbf4a', '#ffd23a', '#2f7cf6'][k % 4], life: 26 }); break;
      case 'yinfx': addP({ type: 'star', x: e.x + (Math.random() - 0.5) * 30, y: e.y + 10, vy: 0.8, size: 5, color: Math.random() < 0.5 ? '#c890ff' : '#ff9cd0', life: 22 }); break;
      case 'pluck': Snd.play('pluck'); burst(e.x, e.y - 4, 7, '#8a5a2b', 3, 'dot', 4, 20); if (e.s) say(e.s, e.x, e.y - 90, 20, '#ffe866'); break;
      case 'pop': Snd.play('pop'); burst(e.x, e.y, 8, { ice: '#9fe4ff', fire: '#ff8a1f', coin: '#ffd23a', psn: '#9b4fd6', gust: '#ffffff', rock: '#a08a6a', heart: '#ff5aa8', bubble: '#c890ff', shade: '#8a7ad8', lightbolt: '#fff6c8', seed: '#5a4a30', melon: '#5fd04a' }[e.k] || '#f6f2ff', 4, 'dot', 4, 20); break;
      case 'throw': if (e.k) { Snd.play('throwfx'); addP({ type: 'ring', x: e.x, y: e.y, size: 34, color: '#ffe0a8', life: 12 }); } else Snd.play('shoot'); break;
      case 'shoot': Snd.play('shoot'); break;
      case 'grabbreak': Snd.play('breakfree'); for (let k = 0; k < 5; k++) addP({ type: 'puff', x: e.x + (k - 2) * 10, y: e.y, vy: -1, size: 7, life: 18 }); say('Broke free!', e.x, e.y - 40, 18, '#bff4ff'); break;
      // Moo Toad
      case 'moo': Snd.play('moo'); say('Moo!', e.x, e.y - 70, 22, '#ffffff'); break;
      case 'milk': Snd.play('pop'); for (let k = 0; k < 5; k++) addP({ type: 'dot', x: e.x, y: e.y, vx: (e.dir || 1) * (2 + Math.random() * 3), vy: -1 - Math.random() * 2, g: 0.2, size: 5, color: '#ffffff', life: 22 }); break;
      case 'cowbell': Snd.play('cowbell'); break;
      case 'cowbellhit': Snd.play('clang'); cam.shake = Math.max(cam.shake, 6); addP({ type: 'ring', x: e.x, y: e.y, size: (e.r || 74) * 1.2, color: '#ffd23a', life: 18 }); addP({ type: 'ring', x: e.x, y: e.y, size: (e.r || 74) * 0.8, color: '#ffffff', life: 14 }); break;
      case 'scream': Snd.play('scream'); say('WAAAH!', e.x, e.y, 36, '#ffffff'); break;
      case 'spin': case 'prop': Snd.play('spin'); break;
      case 'flutter': Snd.play('flutter'); break;
      case 'float': Snd.play('flutter'); for (let k = 0; k < 5; k++) addP({ type: 'heart', x: e.x + (Math.random() - 0.5) * 40, y: e.y - 30, vy: -1.5, color: '#ff8cc6', life: 40 }); break;
      case 'smoke': addP({ type: 'puff', x: e.x, y: e.y, vy: 2, size: 8, color: 'rgba(200,200,210,0.7)', life: 24 }); break;
      case 'cloud': Snd.play('bounce'); for (let k = 0; k < 6; k++) addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 100, y: e.y + 10, size: 10, color: 'rgba(255,255,255,0.9)', life: 22 }); break;
      case 'boom': {
        const s = e.s || 1, soft = e.k === 'gulal' || e.k === 'gift';
        // a gift box pops into confetti and a puff of Holi powder bursts softly: no big bang for those
        Snd.play(soft ? (e.k === 'gift' ? 'candy' : 'poof2') : 'boom'); if (!soft) cam.shake = Math.max(cam.shake, 12 * s * (e.k === 'quake' ? 1.6 : 1));
        // a few landings and finales carry their own flavour: rocks, feathers, melon bits, hearts...
        const BK = { quake: ['#c0a882', '#8a7a60'], feather: ['#ffffff', '#e6eef8'], melon: ['#5fd04a', '#ff5a5a'], love: ['#ff8cc6', '#ff5aa8'], bubble: ['#c890ff', '#ffffff'], light: ['#fff6c8', '#ffe066'],
          gift: ['#ff4fa0', '#ffd23a'], gulal: ['#ff4fa0', '#3fbf4a'], color: ['#ff4fa0', '#ffd23a'], pyramid: ['#e8cf8f', '#ffd23a'], lantern: ['#ffcf5a', '#fff6c8'], crystal: ['#c8a0ff', '#ff9cd0'] }[e.k];
        burst(e.x, e.y, 16 * s, BK ? BK[0] : '#ff8a1f', 7 * s, 'dot', 10, 28); burst(e.x, e.y, 10 * s, BK ? BK[1] : '#ffe866', 5 * s, 'dot', 8, 22);
        addP({ type: 'ring', x: e.x, y: e.y, size: 90 * s, color: e.k === 'quake' ? '#e6d2a8' : '#ffffff', life: 16 });
        if (e.star) burst(e.x, e.y - 10, 8, '#ffe866', 7, 'star', 8, 34);
        if (e.k === 'fire') elemBurst('fire', e.x, e.y - 10, 20, 14);
        if (e.k === 'quake') for (let k = 0; k < 8; k++) addP({ type: 'puff', x: e.x + (k - 3.5) * 22 * s, y: e.y - 4, vy: -1 - Math.random(), size: 9, tint: 'rgba(214,196,160,0.85)', life: 30 });
        break;
      }
      case 'counter': Snd.play('counter'); say('Counter!', e.x, e.y - 10, 26, '#7dff8a'); break;
      case 'slash': burst(e.x, e.y, 12, '#7dff8a', 9, 'spark', 5, 16); break;
      case 'crown': Snd.play('crown'); say('Peachette!', e.x, e.y - 20, 30, '#ff8cc6'); burst(e.x, e.y, 14, '#ffd23a', 6, 'star', 7, 40); break;
      case 'hearts': Snd.play('crown'); for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; addP({ type: 'heart', x: e.x, y: e.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, color: '#ff6fae', life: 30, drag: 0.93 }); } break;
      case 'say': if (e.snd) Snd.play(e.snd); say(e.s, e.x, e.y, 20); break;
      case 'item': {
        const sn = { mush: 'grow', mini: 'shrink', poison: 'shrink', oneup: 'oneup', gold: 'coin', star: 'star', turnip: 'pluck', chest: 'item' }[e.k];
        Snd.play(sn || 'item');
        if (e.s) say(e.s, e.x, e.y, 22, e.k === 'poison' ? '#c77dff' : '#ffe866');
        burst(e.x, e.y + 20, 8, e.k === 'poison' ? '#9b4fd6' : '#ffe866', 5, 'star', 6, 30);
        break;
      }
      case 'bounce': Snd.play('bounce'); break;
      case 'horn': Snd.play('horn'); break;
      case 'count': Snd.play('count'); break;
      case 'go': Snd.play('go'); goT = 50; break;
      case 'game': Snd.play('game'); Snd.music(null); break;
      case 'respawn': Snd.play('item'); burst(e.x, e.y - 30, 10, '#ffe866', 5, 'star', 6, 30); break;
      case 'ledge': Snd.play('ledge'); break;
      case 'reflect': Snd.play('reflect'); addP({ type: 'ring', x: e.x, y: e.y, size: 30, color: '#9fe4ff', life: 12 }); break;
      case 'coin': Snd.play('coin'); break;
      case 'dodge': Snd.play('dodge'); break;
      case 'pounce': Snd.play('spin'); say('Nyaa!', e.x, e.y - 70, 20, '#d9a8ff'); break;
      // --- combat extras ---
      case 'charge': Snd.play('charge'); break;
      case 'parry':
        Snd.play('parry'); cam.shake = Math.max(cam.shake, 8);
        addP({ type: 'ring', x: e.x, y: e.y, size: 70, color: '#ffffff', life: 16 }); burst(e.x, e.y, 10, '#bff4ff', 8, 'spark', 5, 16);
        say('PARRY!', e.x, e.y - 50, 26, '#bff4ff');
        break;
      case 'taunt': Snd.play(['booty', 'laugh', 'yawn', 'flip'][e.n - 1]); if (e.n === 1) for (let k = 0; k < 3; k++) say('♪', e.x + (k - 1) * 22, e.y - 10 - k * 8, 20, '#ffe866'); if (e.n === 1 || e.n === 4) voiceLine(e.i, e.ch, 'taunt'); break;
      case 'grab': Snd.play('grab'); addP({ type: 'ring', x: e.x, y: e.y, size: 26, color: '#ffe0a8', life: 12 }); break;
      case 'poof':
        if (e.k === 'speed') { Snd.play('dodge'); for (let k = 0; k < 6; k++) addP({ type: 'spark', x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 50, vx: (Math.random() - 0.5) * 10, vy: 0, size: 4, color: k % 2 ? '#ffe066' : '#ff8a1f', life: 14 }); break; }
        Snd.play('poof'); for (let k = 0; k < 7; k++) addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 40, y: e.y + (Math.random() - 0.5) * 40, vy: -0.6, size: 9, color: e.k === 'magic' ? 'rgba(220,190,255,0.9)' : e.k === 'ghost' ? 'rgba(210,225,255,0.8)' : 'rgba(150,150,170,0.85)', life: 26 }); if (e.k === 'magic') burst(e.x, e.y, 8, '#e2c8ff', 4, 'star', 5, 26); break;
      // Dash Yoshi's sonic booms and speed lines
      case 'boomfx': Snd.play('slash'); addP({ type: 'ring', x: e.x, y: e.y, size: 46, color: '#ffe066', life: 12 }); addP({ type: 'ring', x: e.x, y: e.y, size: 28, color: '#ffffff', life: 10 }); break;
      case 'speedfx': addP({ type: 'spark', x: e.x, y: e.y + (Math.random() - 0.5) * 30, vx: -(e.dir || 0) * 6 - (Math.random() - 0.5) * 2, vy: 0, size: 4, color: Math.random() < 0.5 ? '#ffe066' : '#ff8a1f', life: 14 }); break;
      // Hasidic Toad: a seltzer blast and a burrow
      case 'seltzerfx': Snd.play('squirt'); Snd.play('jelly'); for (let k = 0; k < 14; k++) addP({ type: 'bubble', x: e.x + (Math.random() - 0.5) * 34, y: e.y - Math.random() * 20, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 4, size: 3 + Math.random() * 4, color: '#bfe6ff', life: 34 }); say('Fizz!', e.x, e.y - 40, 20, '#bfe6ff'); break;
      case 'digfx': Snd.play('poof2'); for (let k = 0; k < 8; k++) addP({ type: 'dot', x: e.x + (Math.random() - 0.5) * 40, y: e.y - 4, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 3, g: 0.25, size: 5, color: Math.random() < 0.5 ? '#8a5a2b' : '#b08050', life: 26 }); break;
      case 'log': say('*log*', e.x, e.y - 20, 18, '#d8a060'); burst(e.x, e.y, 8, '#a8743c', 4, 'dot', 6, 30); break;
      case 'heal': if (frameCount % 2 === 0) Snd.play('heal'); addP({ type: 'text', text: '+', x: e.x + (Math.random() - 0.5) * 30, y: e.y, vy: -1.4, size: 22, color: '#7dff8a', life: 30, drag: 0.98 }); break;
      case 'rune': Snd.play('magic'); addP({ type: 'ring', x: e.x, y: e.y - 10, size: 80, color: '#c8a0ff', life: 18 }); burst(e.x, e.y - 10, 12, '#e2c8ff', 7, 'star', 6, 30); break;
      case 'soup': Snd.play('pop'); burst(e.x, e.y, 8, '#ffb347', 3, 'dot', 5, 24); say('Hot!', e.x, e.y - 60, 18, '#ffb347'); break;
      case 'flash': Snd.play('reflect'); addP({ type: 'ring', x: e.x, y: e.y, size: 60, color: '#fff6a0', life: 14 }); burst(e.x, e.y, 10, '#fff6a0', 7, 'spark', 4, 14); break;
      case 'dash': case 'pan': Snd.play('swing'); break;
      case 'icetrail': addP({ type: 'dot', x: e.x, y: e.y + 16, vy: -0.5, size: 6, color: '#bff0ff', life: 22 }); break;
      case 'flame': addP({ type: 'dot', x: e.x, y: e.y, vy: -1, size: 7, color: Math.random() < 0.5 ? '#ff8a1f' : '#ffd23a', life: 18 }); break;
      case 'jet': addP({ type: 'puff', x: e.x, y: e.y + 10, vy: 2, size: 7, color: 'rgba(255,190,90,0.85)', life: 16 }); break;
      case 'steam': Snd.play('steam'); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; addP({ type: 'puff', x: e.x, y: e.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, size: 9, color: 'rgba(245,245,250,0.85)', life: 26, drag: 0.94 }); } break;
      case 'dust': addP({ type: 'puff', x: e.x, y: e.y + 20, vy: -0.4, size: 6, color: 'rgba(230,215,190,0.8)', life: 18 }); break;
      case 'parrot': Snd.play('flutter'); say('Squawk!', e.x, e.y - 80, 18, '#7dff8a'); break;
      case 'cannon': Snd.play('cannon'); cam.shake = Math.max(cam.shake, 6); addP({ type: 'puff', x: e.x, y: e.y, size: 12, color: 'rgba(220,220,220,0.9)', life: 20 }); break;
      case 'laser': Snd.play('laser'); break;
      case 'magic': case 'sparkle': if (e.t === 'magic') Snd.play('magic'); addP({ type: 'star', x: e.x + (Math.random() - 0.5) * 24, y: e.y, vy: -0.8, size: 5, color: e.t === 'magic' ? '#e2c8ff' : '#fff2a0', life: 22 }); break;
      // the Yoshi clan's trails
      case 'gustfx': Snd.play('flutter'); for (let k = 0; k < 3; k++) addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 20, vx: -(e.dir || 0) * 1.5, vy: 0.6, size: 7, tint: 'rgba(240,250,255,0.85)', life: 20 }); break;
      case 'heartfx': for (let k = 0; k < 2; k++) addP({ type: 'heart', x: e.x + (Math.random() - 0.5) * 36, y: e.y, vy: 1.2, color: k ? '#ff5aa8' : '#ff8cc6', life: 30 }); break;
      case 'bubblefx': for (let k = 0; k < 2; k++) addP({ type: 'bubble', x: e.x + (Math.random() - 0.5) * 40, y: e.y + 10, vy: -0.8 - Math.random(), size: 4 + Math.random() * 4, color: '#c890ff', life: 34 }); break;
      case 'frostfx': if (e.dir) Snd.play('frost'); for (let k = 0; k < 4; k++) addP({ type: 'flake', x: e.x + (e.dir || 0) * (10 + k * 14) + (Math.random() - 0.5) * 16, y: e.y + (Math.random() - 0.5) * 24, vx: (e.dir || 0) * 2, vy: 0.4, size: 5, color: k % 2 ? '#7fd3ff' : '#e8fbff', life: 30, drag: 0.95 }); break;
      case 'ghostpuff': addP({ type: 'puff', x: e.x, y: e.y + 10, vy: 0.5, size: 8, color: 'rgba(210,225,255,0.6)', life: 22 }); break;
      case 'guitar': Snd.play('guitar'); break;
      case 'cork': Snd.play('cork'); break;
      case 'rocket': Snd.play('rocket'); break;
      case 'zap': Snd.play('zap'); burst(e.x, e.y - 30, 10, '#bff4ff', 6, 'spark', 4, 14); break;
      case 'gravwell': Snd.play('magic'); break;
      case 'lassoswing': Snd.play('spin'); break;
      case 'amp':
        if (e.sub === 'quake') { // Yellow Yoshi's Mega Quake stomps instead of an amp blast
          Snd.play('boom'); cam.shake = Math.max(cam.shake, 22);
          addP({ type: 'ring', x: e.x, y: e.y + 40, size: 600, color: '#e6d2a8', life: 26 });
          for (let k = 0; k < 10; k++) addP({ type: 'puff', x: e.x + (k - 4.5) * 60, y: e.y + 36, vy: -1.2 - Math.random(), size: 10, tint: 'rgba(214,196,160,0.85)', life: 30 });
          break;
        }
        Snd.play('amp'); addP({ type: 'ring', x: e.x, y: e.y, size: e.big ? 600 : 110, color: e.big ? '#ff7088' : '#ffffff', life: e.big ? 26 : 16 }); if (e.big) cam.shake = Math.max(cam.shake, 14);
        break;
      // --- Smash Mushroom ---
      case 'sbspawn': Snd.play('sbspawn'); say('A Smash Mushroom appeared!', e.x, e.y, 26, '#ffe066'); break;
      case 'sbhit': Snd.play('sbhit'); burst(e.x, e.y, 10, '#ffe066', 6, 'star', 6, 24); addP({ type: 'ring', x: e.x, y: e.y, size: 50, color: '#ff7ad9', life: 14 }); break;
      case 'sbgone': say('The Smash Mushroom drifted away...', e.x, e.y - 40, 18, '#ffe9a8'); break;
      case 'fsready': Snd.play('fsready'); burst(e.x, e.y, 26, '#ffe066', 10, 'star', 8, 40); say('SMASH POWER!', e.x, e.y - 40, 28, '#ff7ad9'); break;
      case 'fs': Snd.play('fs'); cam.shake = Math.max(cam.shake, 16); fsBanner = { ch: e.ch, i: e.i, t: 0 }; burst(e.x, e.y, 20, '#ffe066', 9, 'star', 8, 36); break;
      case 'fsgo':
        Snd.play({ petals: 'wind', ship: 'hornblast', legion: 'roar', lotus: 'chime', lantern: 'chime', choir: 'choir', hora: 'mazeltov', crystal: 'magic', dash: 'boostpad', mech: 'laser', parranda: 'parranda', color: 'candy' }[e.sub] ||
          { wave: 'stampede', rain: 'cannon', beam: 'laser', sweep: 'laser', pulses: 'amp', freeze: 'frost', meteor: 'boom', vortex: 'wind', flood: 'steam', burst: 'crown', rush: 'horn', clone: 'poof', lasso: 'spin', swarm: 'boo', fist: 'rocket' }[e.k] || 'fs');
        if (e.sub === 'hora') say('Mazel Tov!', e.x, e.y - 120, 34, '#ffe066');
        if (e.sub === 'parranda') say('¡Feliz Navidad!', e.x, e.y - 120, 30, '#ffe066');
        if (e.sub === 'color') say('Happy Holi!', e.x, e.y - 120, 32, '#ff9cd0');
        if (e.sub === 'crystal') { say('El Minya!', e.x, e.y - 120, 30, '#d8b0ff'); Snd.talk(BEAKO_VOICE, 'spc'); }
        break;
      case 'frost': Snd.play('frost'); break;
      case 'shatter': Snd.play('break'); burst(e.x, e.y, 16, '#bff0ff', 9, 'dot', 7, 30); break;
      // --- stage hazards ---
      case 'spikewarn': Snd.play('ledge'); burst(e.x, e.y - 6, 6, '#ffffff', 3, 'spark', 4, 16); break;
      case 'spike': Snd.play('spike'); break;
      case 'boostpad': Snd.play('boostpad'); for (let k = 0; k < 6; k++) addP({ type: 'spark', x: e.x, y: e.y - 6 - Math.random() * 30, vx: -e.dir * (4 + Math.random() * 4), vy: 0, size: 3, color: '#ffe066', life: 14 }); break;
    }
  }
}
function ambientFx(view) {
  // elemental attacks trail their element on the active frames
  if (frameCount % 3 === 0) for (const f of view.fighters) {
    if (f.st !== 'atk' || !f.at || f.st === 'dead') continue;
    const A = ATK[f.ch] && ATK[f.ch][f.at], el = CH[f.ch] && CH[f.ch].elem, F = ELEM_FX[el], C = ELEM_COL[el];
    if (!A || !F || !C) continue;
    const sc = f.sc || 1;
    for (const hb of A.hb) {
      if (f.t < hb.a || f.t > hb.b) continue;
      const x = f.x + hb.x * (f.fc || 1) * sc, y = f.y + hb.y * sc, col = C[Math.random() < 0.5 ? 0 : 1];
      addP({ type: F[0], x: x + (Math.random() - 0.5) * hb.r, y: y + (Math.random() - 0.5) * hb.r, vy: F[1] === 'fall' ? 0.5 : -1, color: col, tint: F[0] === 'puff' ? col : undefined, size: F[0] === 'note' ? 5 : 4, life: 16 });
      break;
    }
  }
  if (frameCount % 6) return;
  for (const f of view.fighters) {
    if (f.st === 'dead' || f.out) continue;
    if (f.pe > 0) addP({ type: 'star', x: f.x + (Math.random() - 0.5) * 40, y: f.y - f.h * Math.random(), vy: -0.6, size: 4, color: '#ffd23a', life: 24 });
    if (f.psn > 0) addP({ type: 'dot', x: f.x + (Math.random() - 0.5) * 30, y: f.y - f.h * 0.8, vy: -1.2, size: 4, color: '#b06ee0', life: 26 });
    if (f.star > 0) addP({ type: 'star', x: f.x + (Math.random() - 0.5) * 50, y: f.y - f.h * Math.random(), size: 5, color: `hsl(${(frameCount * 14) % 360},100%,65%)`, life: 20 });
    if (f.ch === 'toadette' && f.glide > 0) addP({ type: 'heart', x: f.x, y: f.y - 10, vy: 1, size: 4, color: '#ff8cc6', life: 24 });
  }
}

// ---------- Main loop ----------
function tick() {
  frameCount++;
  // a gamepad button works as "press start" too
  if (mode === 'start' && frameCount > 30 && padList().some(p => p.buttons.some(b => b && b.pressed))) pressStart();
  if (mode === 'game') {
    if (role !== 'client') {
      if (G && !paused) {
        stepGame(G, getBits);
        handleEvents(G.ev);
        if (role === 'host') {
          for (const e of G.ev) pendingEv.push(e);
          if (G.frame % 2 === 0) { netBroadcast({ t: 's', d: snapshot(G, pendingEv) }); pendingEv = []; }
        }
        G.ev = [];
      }
      if (G) {
        updateCam(cam, G); ambientFx(G);
        if (G.phase === 'over' && !G.streaked) { G.streaked = true; updateStreaks(G); }
        if (G.phase === 'over' && G.pt >= 150 && !resultsShown) showResults(G.results, G.winner);
      }
    } else {
      const b = $('pause').classList.contains('hidden') ? localBits(-1) : 0;
      if (b !== Net.lastSent || frameCount % 15 === 0) { netSend({ t: 'in', b }); Net.lastSent = b; }
      const v = clientView();
      if (v) {
        updateCam(cam, v); ambientFx(v);
        if (v.phase === 'over' && v.pt >= 150 && !resultsShown) showResults(v.results, v.winner);
      }
    }
    if (goT > 0) goT--;
    if (fsBanner && ++fsBanner.t > 56) fsBanner = null;
  }
  tapped.clear();
  updParticles();
}

const ATTRACT = CHARS.map((C, k) => ({ i: k % 4, ch: C.id, x: 0, y: 0, fc: 1, st: 'run', t: 0, sc: 1, h: C.h, w: 36, inv: 0, rp: 0, gi: 0, shd: 100 }));
// the title parade without WebGL: one long loop with every fighter in their own spot, so nobody overlaps
function drawAttract() {
  const gap = 84, L = ATTRACT.length * gap;
  ATTRACT.forEach((f, k) => {
    f.x = ((k * gap + frameCount * 1.8) % L) - 510;
    const hp = (frameCount + k * 67) % 240, hop = hp < 30;
    f.y = hop ? -Math.sin((hp / 30) * Math.PI) * 90 : 0;
    f.st = hop ? 'air' : 'run'; f.gi = hop ? -1 : 0;
  });
  const view = { stage: 'town', frame: frameCount, fighters: ATTRACT.filter(f => Math.abs(f.x) < 470), proj: [], items: [], clouds: [] };
  renderScene(ctx, view, { x: 0, y: -200, z: 0.8, shake: 0 }, frameCount, 1, true);
  if (mode === 'lobby') { ctx.fillStyle = 'rgba(20,10,30,0.62)'; ctx.fillRect(0, 0, W, H); }
}

function drawGameText(v) {
  if (v.phase === 'count' && v.pt > 0) {
    const n = Math.ceil(v.pt / 60), k = (v.pt % 60) / 60;
    if (n <= 3) txt(ctx, String(n), W / 2, H / 2 + 40, 140 + k * 60, '#ffffff', OUT, 'center', 12);
    else txt(ctx, STG[v.stage].name, W / 2, H / 2, 60, '#ffffff', OUT, 'center', 8);
  }
  if (goT > 0) txt(ctx, 'GO!', W / 2, H / 2 + 50, 170, '#ffe066', OUT, 'center', 14);
  if (v.phase === 'over' && v.pt < 150) txt(ctx, 'GAME!', W / 2, H / 2 + 50, 170, '#ff4b4b', OUT, 'center', 14);
  if (paused) txt(ctx, 'PAUSED', W / 2, 110, 60, '#ffffff', OUT, 'center', 8);
  if (fsBanner) {
    // the finale's title card sweeps across the top of the screen while the power gathers, gone before the finale hits
    const b = fsBanner, k = b.t < 10 ? b.t / 10 : b.t > 40 ? 1 - (b.t - 40) / 16 : 1, ease = 1 - Math.pow(1 - Math.max(0, k), 3);
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, k) * 1.4);
    ctx.fillStyle = 'rgba(20,10,30,.2)'; ctx.fillRect(0, 0, W, H);
    ctx.translate((1 - ease) * -W, 0);
    ctx.fillStyle = 'rgba(43,26,18,.45)'; ctx.beginPath(); ctx.moveTo(0, 116); ctx.lineTo(W, 86); ctx.lineTo(W, 206); ctx.lineTo(0, 236); ctx.closePath(); ctx.fill();
    ctx.fillStyle = SLOT_COLORS[b.i] || '#ff4b4b'; ctx.beginPath(); ctx.moveTo(0, 104); ctx.lineTo(W, 74); ctx.lineTo(W, 194); ctx.lineTo(0, 224); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let s = 0; s < 14; s++) { const x = ((s * 120 + b.t * 14) % (W + 200)) - 100; ctx.beginPath(); ctx.moveTo(x, 224); ctx.lineTo(x + 40, 224); ctx.lineTo(x + 100, 74); ctx.lineTo(x + 60, 74); ctx.fill(); }
    ctx.drawImage(portrait(b.ch, 160), 110, 86, 128, 128);
    txt(ctx, (CH[b.ch] ? CH[b.ch].name : '').toUpperCase() + "'S SMASH FINALE", 258, 118, 22, '#ffe066', OUT, 'left', 5);
    txt(ctx, FSNAME[b.ch] || 'Smash!', 254, 182, 58, '#ffffff', OUT, 'left', 9);
    ctx.restore();
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mode === 'game') {
    const v = role === 'client' ? clientView() : G;
    if (!v) { ctx.fillStyle = '#1b0f24'; ctx.fillRect(0, 0, W, H); txt(ctx, 'Connecting…', W / 2, H / 2, 40, '#fff', OUT); return; }
    if (USE3D) V3D.frame(v, cam, frameCount);
    else { renderScene(ctx, v, cam, frameCount); drawHUD(ctx, v, frameCount); }
    drawGameText(v);
  } else if (USE3D) V3D.attract(frameCount, mode === 'lobby');
  else drawAttract();
}

let acc = 0, last = performance.now();
function pump() {
  const now = performance.now();
  acc += Math.min(250, now - last);
  last = now;
  let n = 0;
  while (acc >= STEP && n < 8) { tick(); acc -= STEP; n++; }
  Snd.tick();
}
// A worker-driven ticker keeps the host simulating even when its tab is in the background.
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},8)'], { type: 'text/javascript' })));
  wk.onmessage = pump;
} catch (e) { setInterval(pump, 8); }
(function loop() { pump(); draw(); requestAnimationFrame(loop); })();

// ---------- Settings: change the keyboard controls ----------
const ACT_NAMES = [['L', 'Move left'], ['R', 'Move right'], ['U', 'Up (also jumps)'], ['J', 'Jump only'], ['D', 'Crouch / down'], ['A', 'Attack'], ['B', 'Special'], ['S', 'Guard'], ['G', 'Grab'],
  ['T0', 'Taunt 1'], ['T1', 'Taunt 2'], ['T2', 'Taunt 3'], ['T3', 'Taunt 4']];
const keysOf = (p, act) => (act[0] === 'T' ? [KEYSETS[p].T[+act[1]]].filter(Boolean) : KEYSETS[p][act]);
function keyName(c) {
  const M = { Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl',
    ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt', Enter: 'Enter', Backspace: 'Bksp', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', CapsLock: 'Caps' };
  if (M[c]) return M[c];
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  if (/^Numpad/.test(c)) return 'Num ' + c.slice(6);
  return c;
}
function renderSettings() {
  const t = $('keyTable');
  t.innerHTML = '';
  const head = el('tr');
  for (const h of ['', 'Player 1', 'Player 2']) head.appendChild(el('th', '', h));
  t.appendChild(head);
  for (const [act, name] of ACT_NAMES) {
    const tr = el('tr');
    tr.appendChild(el('td', '', name));
    for (const p of [0, 1]) {
      const td = el('td'), wait = rebinding && rebinding.p === p && rebinding.act === act;
      const b = el('button', 'kb' + (wait ? ' wait' : ''), wait ? 'Press a key…' : keysOf(p, act).map(keyName).join(' / ') || '—');
      b.onclick = () => { rebinding = { p, act }; renderSettings(); };
      td.appendChild(b); tr.appendChild(td);
    }
    t.appendChild(tr);
  }
}
// the key just pressed becomes the binding being changed; a key only ever does one thing, so it leaves any other action
function setKey(code) {
  const R = rebinding;
  rebinding = null;
  if (!R || code === 'Escape') { renderSettings(); return; }
  if (code === 'KeyM' || code === 'Tab') { toast(code === 'KeyM' ? 'M is the mute key. Pick another one.' : 'Pick another key.'); renderSettings(); return; }
  for (const s of KEYSETS) { for (const a of KEY_ACTS) s[a] = s[a].filter(k => k !== code); s.T = s.T.map(k => (k === code ? '' : k)); }
  const s = KEYSETS[R.p];
  if (R.act[0] === 'T') s.T[+R.act[1]] = code; else s[R.act] = [code];
  store('sst-keys', JSON.stringify(KEYSETS));
  Snd.play('select');
  renderSettings();
}
$('btnSettings').onclick = () => { $('settings').classList.remove('hidden'); renderSettings(); };
$('setClose').onclick = () => { rebinding = null; $('settings').classList.add('hidden'); };
$('setReset').onclick = () => { rebinding = null; KEYSETS = JSON.parse(JSON.stringify(DEFAULT_KEYS)); store('sst-keys', JSON.stringify(KEYSETS)); toast('Controls reset'); renderSettings(); };

// ---------- Title wiring ----------
if ($('start')) $('start').onclick = pressStart;
$('btnLocal').onclick = () => { Snd.init(); leaveOnline(); role = 'local'; localDefaults(); titleMsg(''); showLobby(); };
$('btnHost').onclick = () => hostOnline(0);
$('btnJoin').onclick = () => joinOnline($('codeIn').value);
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') joinOnline($('codeIn').value); });
$('btnHelp').onclick = () => $('help').classList.remove('hidden');
$('helpClose').onclick = () => $('help').classList.add('hidden');
$('lbBack').onclick = () => { leaveOnline(); toTitle(''); };
$('lbStart').onclick = () => { if (role !== 'client') startMatch(); };
document.fonts && document.fonts.ready.then(() => { for (const k in PORT) delete PORT[k]; buildRoster(); if (mode === 'lobby') renderLobby(); });
buildRoster();
Snd.music('title');
