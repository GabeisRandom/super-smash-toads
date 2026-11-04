'use strict';
// ===== Menus, input, online play and the main loop =====
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const STEP = 1000 / 60;
let mode = 'title', role = 'local', G = null, paused = false, frameCount = 0, pendingEv = [], resultsShown = false, goT = 0;
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
// P1: WASD move (S crouches), Q attack, E special, F guard, 1-4 taunts.
// P2: IJKL move (K crouches; arrows work too), U attack, O special, H guard, 7-0 taunts.
const KEYSETS = [
  { L: ['KeyA'], R: ['KeyD'], U: ['KeyW', 'Space'], D: ['KeyS'], A: ['KeyQ'], B: ['KeyE'], S: ['KeyF'], T: ['Digit1', 'Digit2', 'Digit3', 'Digit4'] },
  { L: ['KeyJ', 'ArrowLeft'], R: ['KeyL', 'ArrowRight'], U: ['KeyI', 'ArrowUp'], D: ['KeyK', 'ArrowDown'], A: ['KeyU'], B: ['KeyO'], S: ['KeyH'], T: ['Digit7', 'Digit8', 'Digit9', 'Digit0'] },
];
addEventListener('keydown', e => {
  Snd.init();
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
  if (any(s.A)) b |= B_A; if (any(s.B)) b |= B_B; if (any(s.S)) b |= B_S;
  s.T.forEach((k, n) => { if (keys.has(k) || tapped.has(k)) b |= B_TAUNTS[n]; });
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
  if (ay < -0.6 || bt(12) || bt(3)) b |= B_U; if (ay > 0.6 || bt(13)) b |= B_D;
  if (bt(0)) b |= B_A; if (bt(1) || bt(2)) b |= B_B; if (bt(4) || bt(5) || bt(6) || bt(7)) b |= B_S;
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
  if (m === 'stage') return [stage];
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
  Snd.play('select');
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
  box.appendChild(el('div', 'fsname', `Smash Mushroom finale: ${FSNAME[C.id]}`));
}

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
    const who = el('div', 'who', slotLabel(s, k)); who.style.color = SLOT_COLORS[k];
    info.appendChild(who);
    info.appendChild(el('div', 'cn', s.type === 'off' ? (role === 'local' ? 'Not playing' : 'Friends can join here') : CH[s.ch].name));
    const row = el('div', 'row');
    if (canChangeType(k)) row.appendChild(btn(s.type === 'off' ? 'Add' : 'Change', 'gray', () => cycleType(k)));
    if (s.type === 'cpu' && canChangeType(k)) row.appendChild(btn('Lv ' + s.lvl, 'blue', () => { s.lvl = (s.lvl % 3) + 1; lobbyChanged(); }));
    else if (s.type === 'cpu') row.appendChild(el('div', 'cn', 'Level ' + s.lvl));
    info.appendChild(row);
    d.appendChild(info);
    d.onclick = () => { if (role !== 'client' && canEditChar(k)) { Lobby.active = k; Snd.play('select'); renderLobby(); } };
    box.appendChild(d);
  });
  for (const d of $('stages').children) d.classList.toggle('sel', d.dataset.st === Lobby.stage);
  $('optStocks').textContent = Lobby.stocks;
  $('optItems').textContent = Lobby.items ? 'ON' : 'OFF';
  $('optItems').className = 'btn sm ' + (Lobby.items ? 'green' : 'gray');
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
    if (o === 'items') Lobby.items = !Lobby.items;
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
  for (const s of ['title', 'lobby']) $(s).classList.toggle('hidden', s !== id);
  for (const s of ['pause', 'results']) $(s).classList.add('hidden');
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

function showResults(res, winner) {
  resultsShown = true;
  Snd.music('results'); Snd.duck(false);
  const box = $('resBox');
  box.innerHTML = '';
  if (!res || !res.length) return;
  const w = res[0], C = CH[w.ch] || CH.toad;
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
    row.appendChild(t);
    box.appendChild(row);
  }
  const tb = el('table', 'res');
  const hr = el('tr');
  for (const h of ['#', 'Player', 'Fighter', 'KOs', 'Falls', 'Damage dealt']) hr.appendChild(el('th', '', h));
  tb.appendChild(hr);
  res.forEach((r, n) => {
    const tr = el('tr');
    const cells = [String(n + 1), r.tag || '', (CH[r.ch] || CH.toad).name, String(r.kos), String(r.falls), r.dealt + '%'];
    cells.forEach((v, j) => { const td = el('td', '', v); if (j === 1) td.style.color = SLOT_COLORS[r.i]; tr.appendChild(td); });
    tb.appendChild(tr);
  });
  box.appendChild(tb);
  const rowB = el('div'); rowB.style.cssText = 'display:flex;gap:14px';
  if (role === 'client') {
    rowB.appendChild(el('div', '', 'Waiting for the host…'));
    rowB.appendChild(btn('Leave room', 'gray', () => { leaveOnline(); toTitle(''); }));
  } else {
    const a = el('button', 'btn green', 'Rematch!'); a.onclick = () => startMatch();
    const b = el('button', 'btn', 'Back to lobby'); b.onclick = () => backToLobby();
    rowB.append(a, b);
  }
  box.appendChild(rowB);
  $('results').classList.remove('hidden');
}

function onEsc() {
  if (!$('help').classList.contains('hidden')) { $('help').classList.add('hidden'); return; }
  if (mode !== 'game' || resultsShown) return;
  const p = $('pause');
  if (!p.classList.contains('hidden')) { p.classList.add('hidden'); paused = false; Snd.duck(false); return; }
  $('pauseTitle').textContent = role === 'local' ? 'Paused' : role === 'host' ? 'End the match?' : 'Leave the room?';
  $('pQuit').textContent = role === 'client' ? 'Leave room' : 'Quit to lobby';
  p.classList.remove('hidden');
  Snd.duck(true);
  if (role === 'local') paused = true;
}
$('pResume').onclick = () => { $('pause').classList.add('hidden'); paused = false; Snd.duck(false); };
$('pQuit').onclick = () => {
  $('pause').classList.add('hidden');
  Snd.duck(false);
  if (role === 'client') { leaveOnline(); toTitle(''); } else backToLobby();
};

function toggleMute() { const m = Snd.toggleMute(); $('muteBtn').textContent = m ? '✕♪' : '♪'; toast(m ? 'Sound off (M)' : 'Sound on (M)'); }
$('muteBtn').onclick = () => { Snd.init(); toggleMute(); };
$('muteBtn').textContent = Snd.isMuted() ? '✕♪' : '♪';

// ---------- Online (PeerJS, host-authoritative) ----------
// taps: buttons pressed since the host last read them, so a quick tap whose press and release arrive
// in the same frame still registers
const Net = { peer: null, conns: new Map(), conn: null, inputs: {}, taps: {}, lastSent: -1, code: '' };
const SN = { prev: null, cur: null, at: 0 };
function netSend(m) { if (Net.conn && Net.conn.open) try { Net.conn.send(m); } catch (e) { /* dropped */ } }
function netBroadcast(m) { for (const e of Net.conns.values()) if (e.conn.open) try { e.conn.send(m); } catch (err) { /* dropped */ } }
function lobbyPublic() {
  return {
    slots: Lobby.slots.map(s => ({ type: s.type, ch: s.ch, name: s.type === 'host' ? myName() : s.name || '', lvl: s.lvl })),
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
  Net.peer = null; Net.conn = null; Net.inputs = {}; Net.taps = {}; SN.prev = SN.cur = null;
  return old;
}
function randCode() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }

function hostOnline(tries) {
  Snd.init();
  if (typeof Peer === 'undefined') { titleMsg('Online library failed to load. Check your internet connection.'); return; }
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
  if (d.t === 'hello') { s.name = cleanName(d.name) || 'Player'; if (CH[d.ch]) s.ch = d.ch; toast(s.name + ' joined!'); lobbyChanged(); }
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
  if (typeof Peer === 'undefined') { titleMsg('Online library failed to load. Check your internet connection.'); return; }
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
      Lobby.slots = (L.slots || []).slice(0, 4).map(s => ({ type: s.type, ch: CH[s.ch] ? s.ch : 'toad', name: cleanName(s.name), lvl: s.lvl | 0 }));
      Lobby.stage = STG[L.stage] ? L.stage : 'town';
      Lobby.stocks = L.stocks | 0; Lobby.items = !!L.items; Lobby.hazards = !!L.hazards;
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
function handleEvents(evs) {
  for (const e of evs) {
    switch (e.t) {
      case 'hit':
        Snd.play('hit', e.p);
        burst(e.x, e.y, 6 + Math.min(14, e.p), '#fff6a0', 4 + e.p * 0.4, 'spark', 4, 16);
        addP({ type: 'ring', x: e.x, y: e.y, size: 30 + e.p * 3, color: '#ffffff', life: 14 });
        if (e.p > 16) cam.shake = Math.max(cam.shake, e.p * 0.7);
        if (e.p > 22) burst(e.x, e.y, 6, '#ffe866', 8, 'star', 7, 30);
        break;
      case 'block': Snd.play('block'); addP({ type: 'ring', x: e.x, y: e.y, size: 40, color: '#9fe4ff', life: 12 }); break;
      case 'break': Snd.play('break'); burst(e.x, e.y, 12, '#ffe866', 6, 'star', 6, 40); say('Shield break!', e.x, e.y - 20, 22, '#ffe866'); break;
      case 'ko':
        Snd.play('ko'); cam.shake = 28;
        addP({ type: 'ko', x: e.x, y: e.y, color: SLOT_COLORS[e.i] || '#fff', rot: Math.random(), life: 50 });
        burst(e.x, e.y, 30, SLOT_COLORS[e.i] || '#fff', 14, 'spark', 6, 30);
        break;
      case 'jump': Snd.play('jump'); for (const s of [-1, 1]) addP({ type: 'puff', x: e.x + s * 10, y: e.y - 4, vx: s * 1.5, size: 7, color: 'rgba(255,255,255,0.7)', life: 18 }); break;
      case 'djump': Snd.play('djump'); addP({ type: 'ring', x: e.x, y: e.y - 6, size: 28, color: 'rgba(255,255,255,0.8)', life: 14 }); break;
      case 'walljump': Snd.play('djump'); for (let k = 0; k < 4; k++) addP({ type: 'puff', x: e.x, y: e.y + (k - 1.5) * 12, vx: (e.dir || 1) * 1.6, size: 6, color: 'rgba(255,255,255,0.85)', life: 16 }); break;
      case 'uplift': Snd.play('flutter'); addP({ type: 'ring', x: e.x, y: e.y - 6, size: 22, color: 'rgba(255,246,170,0.9)', life: 12 }); break;
      case 'land': for (const s of [-1, 1]) addP({ type: 'puff', x: e.x + s * 12, y: e.y - 3, vx: s * 1.2, size: 5, color: 'rgba(255,255,255,0.55)', life: 14 }); break;
      case 'swing': Snd.play('swing'); break;
      case 'pluck': Snd.play('pluck'); burst(e.x, e.y - 4, 7, '#8a5a2b', 3, 'dot', 4, 20); if (e.s) say(e.s, e.x, e.y - 90, 20, '#ffe866'); break;
      case 'pop': Snd.play('pop'); burst(e.x, e.y, 8, { ice: '#9fe4ff', fire: '#ff8a1f', coin: '#ffd23a', psn: '#9b4fd6' }[e.k] || '#f6f2ff', 4, 'dot', 4, 20); break;
      case 'throw': case 'shoot': Snd.play('shoot'); break;
      case 'scream': Snd.play('scream'); say('WAAAH!', e.x, e.y, 36, '#ffffff'); break;
      case 'spin': case 'prop': Snd.play('spin'); break;
      case 'flutter': Snd.play('flutter'); break;
      case 'float': Snd.play('flutter'); for (let k = 0; k < 5; k++) addP({ type: 'heart', x: e.x + (Math.random() - 0.5) * 40, y: e.y - 30, vy: -1.5, color: '#ff8cc6', life: 40 }); break;
      case 'smoke': addP({ type: 'puff', x: e.x, y: e.y, vy: 2, size: 8, color: 'rgba(200,200,210,0.7)', life: 24 }); break;
      case 'cloud': Snd.play('bounce'); for (let k = 0; k < 6; k++) addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 100, y: e.y + 10, size: 10, color: 'rgba(255,255,255,0.9)', life: 22 }); break;
      case 'boom': {
        const s = e.s || 1;
        Snd.play('boom'); cam.shake = Math.max(cam.shake, 12 * s);
        burst(e.x, e.y, 16 * s, '#ff8a1f', 7 * s, 'dot', 10, 28); burst(e.x, e.y, 10 * s, '#ffe866', 5 * s, 'dot', 8, 22);
        addP({ type: 'ring', x: e.x, y: e.y, size: 90 * s, color: '#ffffff', life: 16 });
        if (e.star) burst(e.x, e.y - 10, 8, '#ffe866', 7, 'star', 8, 34);
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
      case 'taunt': Snd.play(['booty', 'laugh', 'yawn', 'flip'][e.n - 1]); if (e.n === 1) for (let k = 0; k < 3; k++) say('♪', e.x + (k - 1) * 22, e.y - 10 - k * 8, 20, '#ffe866'); break;
      case 'grab': Snd.play('grab'); addP({ type: 'ring', x: e.x, y: e.y, size: 26, color: '#ffe0a8', life: 12 }); break;
      case 'poof': Snd.play('poof'); for (let k = 0; k < 7; k++) addP({ type: 'puff', x: e.x + (Math.random() - 0.5) * 40, y: e.y + (Math.random() - 0.5) * 40, vy: -0.6, size: 9, color: e.k === 'magic' ? 'rgba(220,190,255,0.9)' : e.k === 'ghost' ? 'rgba(210,225,255,0.8)' : 'rgba(150,150,170,0.85)', life: 26 }); if (e.k === 'magic') burst(e.x, e.y, 8, '#e2c8ff', 4, 'star', 5, 26); break;
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
      case 'magic': case 'sparkle': if (e.t === 'magic') Snd.play('magic'); addP({ type: 'star', x: e.x + (Math.random() - 0.5) * 24, y: e.y, vy: -0.8, size: 5, color: '#e2c8ff', life: 22 }); break;
      case 'ghostpuff': addP({ type: 'puff', x: e.x, y: e.y + 10, vy: 0.5, size: 8, color: 'rgba(210,225,255,0.6)', life: 22 }); break;
      case 'guitar': Snd.play('guitar'); break;
      case 'cork': Snd.play('cork'); break;
      case 'rocket': Snd.play('rocket'); break;
      case 'zap': Snd.play('zap'); burst(e.x, e.y - 30, 10, '#bff4ff', 6, 'spark', 4, 14); break;
      case 'gravwell': Snd.play('magic'); break;
      case 'lassoswing': Snd.play('spin'); break;
      case 'amp': Snd.play('amp'); addP({ type: 'ring', x: e.x, y: e.y, size: e.big ? 600 : 110, color: e.big ? '#ff7088' : '#ffffff', life: e.big ? 26 : 16 }); if (e.big) cam.shake = Math.max(cam.shake, 14); break;
      // --- Smash Mushroom ---
      case 'sbspawn': Snd.play('sbspawn'); say('A Smash Mushroom appeared!', e.x, e.y, 26, '#ffe066'); break;
      case 'sbhit': Snd.play('sbhit'); burst(e.x, e.y, 10, '#ffe066', 6, 'star', 6, 24); addP({ type: 'ring', x: e.x, y: e.y, size: 50, color: '#ff7ad9', life: 14 }); break;
      case 'sbgone': say('The Smash Mushroom drifted away...', e.x, e.y - 40, 18, '#ffe9a8'); break;
      case 'fsready': Snd.play('fsready'); burst(e.x, e.y, 26, '#ffe066', 10, 'star', 8, 40); say('SMASH POWER!', e.x, e.y - 40, 28, '#ff7ad9'); break;
      case 'fs': Snd.play('fs'); cam.shake = Math.max(cam.shake, 16); fsBanner = { ch: e.ch, i: e.i, t: 0 }; burst(e.x, e.y, 20, '#ffe066', 9, 'star', 8, 36); break;
      case 'fsgo': Snd.play({ wave: 'stampede', rain: 'cannon', beam: 'laser', sweep: 'laser', pulses: 'amp', freeze: 'frost', meteor: 'boom', vortex: 'wind', flood: 'steam', burst: 'crown', rush: 'horn', clone: 'poof', lasso: 'spin', swarm: 'boo', fist: 'rocket' }[e.k] || 'fs'); break;
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
function drawAttract() {
  for (const f of ATTRACT) {
    const k = CHARS.findIndex(C => C.id === f.ch);
    f.x = ((k * 200 + frameCount * 2.2) % 1800) - 900;
    const hop = (frameCount + k * 40) % 200 < 30;
    f.y = hop ? -Math.sin((((frameCount + k * 40) % 200) / 30) * Math.PI) * 90 : 0;
    f.st = hop ? 'air' : 'run'; f.gi = hop ? -1 : 0;
  }
  const view = { stage: 'town', frame: frameCount, fighters: ATTRACT, proj: [], items: [], clouds: [] };
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

// ---------- Title wiring ----------
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
