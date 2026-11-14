'use strict';
// ===== Simulation: runs on the host (online) or the local machine. Clients only render snapshots. =====
const RND = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const STG = {};
// (every stage, plus its Double Length version)
for (const s of STAGES.concat(STAGES_2X)) STG[s.id] = s;
const AERIALS = { nair: 1, fair: 1, bair: 1, uair: 1, dair: 1 };
const SMASHES = { fsmash: 1, usmash: 1, dsmash: 1 };
const WIG_LEN = 170; // Wiggler's body length behind its head

function circRect(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

// brk: platforms broken by El Minya ({ plat index: the frame it comes back }). A broken platform stays in the list
// (so every index stays put) but moves far out of reach, and nobody can stand on it
// ice: Emilia Toad's ice pillars and barriers, solid blocks while they stand (with no ledges to grab)
function computeSurfaces(stageId, frame, clouds, brk, ice) {
  const st = STG[stageId], out = [];
  for (const s of st.solids) out.push({ x: s.x, y: s.y, w: s.w, h: s.h, solid: true, dx: 0, dy: 0, icy: !!s.icy });
  for (let pi = 0; pi < st.plats.length; pi++) {
    const p = st.plats[pi];
    if (brk && brk[pi] > frame) { out.push({ x: p.x, y: 1e5, w: 0, h: 0, solid: false, gone: true, pi, dx: 0, dy: 0 }); continue; }
    let x = p.x, y = p.y, dx = 0, dy = 0;
    if (p.move) {
      const m = p.move, k = (Math.PI * 2) / m.per;
      // (circ: round in a circle, like a platform riding a turning gear; otherwise back and forth along a line)
      const sa = Math.sin(frame * k + m.ph), sb = Math.sin((frame - 1) * k + m.ph), ca = m.circ ? Math.cos(frame * k + m.ph) : sa, cb = m.circ ? Math.cos((frame - 1) * k + m.ph) : sb;
      x += m.ax * ca; y += m.ay * sa; dx = m.ax * (ca - cb); dy = m.ay * (sa - sb);
    }
    out.push({ x, y, w: p.w, h: 0, solid: false, bounce: !!p.bounce, mv: !!p.move, pi, dx, dy });
  }
  if (clouds) for (const c of clouds) out.push({ x: c.x, y: c.y, w: c.w, h: 0, solid: false, cloud: true, dx: 0, dy: 0 });
  // (Emilia's ice is solid; a Sea Dragon's Cradle only adds its roof, a platform to stand on, once it has one)
  if (ice) for (const s of ice) {
    if (s.k === 'cradle') { if (s.lv >= 3 && s.h >= WATER.cradle.H) out.push({ x: s.x - s.r, y: s.y - s.h, w: s.r * 2, h: 0, solid: false, ice: s.id, roof: 1, dx: 0, dy: 0 }); continue; }
    for (const R of iceRects(s)) out.push({ x: R.x, y: R.y, w: R.w, h: R.h, solid: true, ice: s.id, noLedge: true, dx: 0, dy: R.dy });
  }
  return out;
}

// a line from (x0,y0) to (x1,y1) against a box: how far along the line it enters the box (0..1), or -1 if it misses
function segRect(x0, y0, x1, y1, l, t, r, b) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - l], [dx, r - x0], [-dy, y0 - t], [dy, b - y0]]) {
    if (p === 0) { if (q < 0) return -1; continue; }
    const u = q / p;
    if (p < 0) { if (u > t1) return -1; if (u > t0) t0 = u; } else { if (u < t0) return -1; if (u < t1) t1 = u; }
  }
  return t0;
}

function fighterBy(g, i) { for (const f of g.fighters) if (f.i === i) return f; return null; }
function airJumps(f) { return CH[f.ch].jumps - 1 + (f.pe > 0 ? 1 : 0); }
const alive = v => v.st !== 'dead' && !v.out;
// can `v` be struck right now (by anything other than itself)?
const hittable = v => alive(v) && v.inv <= 0 && v.ig <= 0 && v.rp <= 0;
// team mode: teammates can't hurt each other, and neither can their shots, soldiers or ice. mineI: is fighter
// number i the owner `o` or on the owner's team? ally: are fighters a and b two different teammates?
const teamOf = (g, i) => { const f = fighterBy(g, i); return f ? f.team : -1; };
const mineI = (g, o, i) => o === i || (!!g.teams && teamOf(g, o) >= 0 && teamOf(g, o) === teamOf(g, i));
const ally = (g, a, b) => !!(g && g.teams && a && b && a !== b && a.team >= 0 && a.team === b.team);

function makeFighter(s, sp, stocks) {
  const C = CH[s.ch];
  return {
    // (CPU levels run 1 to 9, 10 is GOD, 0 is a Dummy that never moves; team is -1 outside team mode)
    i: s.slot, ch: s.ch, nm: s.name, tag: s.tag, ctrl: s.ctrl, pid: s.pid, lvl: s.lvl === undefined ? 5 : s.lvl, team: s.team === undefined ? -1 : s.team,
    x: sp[0], y: sp[1], vx: 0, vy: 0, fc: sp[0] < 0 ? 1 : -1, st: 'air', t: 0, t2: 0,
    dm: 0, sk: stocks, gi: -1, jl: C.jumps - 1, at: null, sp: null, hits: {}, sh2: {}, hs: 0, hl: 0, inv: 0,
    shd: 100, big: 0, small: 0, star: 0, pe: 0, frz: 0, psn: 0, pick: 0, hold: null, drop: 0, jbuf: 0,
    adUsed: false, upUsed: false, sUsed: false, ledgeCd: 0, dead: 0, rp: 0, glide: 0, ff: false, cd: { n: 0, s: 0, u: 0, d: 0, a: 0 }, pb: 0, slow: 0,
    sc: 1, h: C.h, w: 36 * C.wide, pm: 1, lastHit: -1, lastHitT: 0, kos: 0, falls: 0, dealt: 0,
    ctr: -1, ctrT: 0, lx: 0, lcx: 0, lcy: 0, lsi: 0, out: false, outAt: 0,
    fs: 0, fsLock: 0, tn: 0, chg: 0, chgMul: 1, parryAt: -99, prT: 0, dirAt: -99, dTap: -99, ig: 0, hide: 0, boostT: 0,
    uaUsed: false, wallT: 0, wall: 0, wj: 0, bfz: 0, bacc: 0, noPk: 0,
    // Water Yoshi: his Current (0-100) and which Ebb & Flow move he's doing; anyone's Scalded / Sunk timers, a puddle's
    // slipperiness, and lying flat after slipping in one
    cur: 0, ebv: '', ebc: 0, scald: 0, sunk: 0, slick: 0, flat: 0,
    // Nolan Toad: how moldy the Shirt in his hand is (frames held; -1 once thrown) and what he found under his bed;
    // anyone's time left in his stink (a cloud) or his room's reek (his finale)
    mold: 0, find: '', stink: 0, reek: 0,
    // grabs: gv = the foe I'm holding, gby = who holds me, gt = how long the hold lasts, pmT = pummel cooldown, thr = throw
    gv: -1, gby: -1, gt: 0, pmT: 0, thr: '',
    // anti-spam: parry cooldown, tiring dodges, and the queue of recent moves that landed (stale moves hit softer)
    parryCd: 0, dodgeN: 0, dodgeT: -999, stq: [], use: 0, useHit: -1, useSm: 1,
  };
}

// how long until the next Smash Mushroom shows up. Items 'hyper' (Hyper Smash only): very often; 'smash' (Smash
// only): a fifth as often as that; true (all items): now and then. when: 'first' (match start), 'gone' (one floated
// away unclaimed) or 'used' (someone claimed one)
function smashGap(items, when) {
  const H = { first: [420, 300], gone: [300, 300], used: [720, 480] }, N = { first: [1500, 900], gone: [1200, 900], used: [2400, 1200] };
  const [a, b] = (items === 'hyper' || items === 'smash' ? H : N)[when];
  return (a + RND() * b) * (items === 'smash' ? 5 : 1);
}
// where the n-th fighter starts: the stage's own spots, then (5 to 8 players) spots in between them
function spawnPoint(st, n) {
  const S = st.spawn;
  if (n < S.length) return S[n];
  const k = (n - S.length) % 4, L = S.length >= 4 ? S : [S[0], S[1 % S.length], S[0], S[1 % S.length]];
  const x = k < 2 ? (L[k][0] + L[k + 2][0]) / 2 : L[k][0] * 0.3;
  return [Math.round(x), L[k][1]];
}
// respawn spots (in the air above the stage), one per player slot
const RESPAWN_X = [-150, 150, -50, 50, -200, 200, -100, 100];
function makeGame(cfg) {
  const st = STG[cfg.stage], timed = cfg.mode === 'time';
  setBlast(st); // (a Double Length stage has wider blast zones)
  const g = {
    // rules: 'stock' (lose your lives and you're out) or 'time' (endless lives; when the clock runs out, the most KOs
    // wins; timeLeft is in frames), and team mode on or off
    mode: timed ? 'time' : 'stock', timeLeft: timed ? Math.round((cfg.time || 3) * 3600) : 0, teams: !!cfg.teams,
    frame: 0, stage: st.id, fighters: [], proj: [], items: [], clouds: [], fx: [], ev: [], phase: 'count', pt: 200,
    itemsOn: cfg.items, hazOn: cfg.hazards, nextItem: 540, kart: null, surf: [], results: null, winner: -1, pid: 1,
    // items: true = everything, 'smash' = only Smash Mushrooms (and much more often), false = none
    sbT: smashGap(cfg.items, 'first'), haz: initHaz(st),
    // platforms cracked (php: hits taken) and broken (brk: when each comes back) by Subaru's El Minya
    brk: {}, php: {},
    // Emilia Toad's ice pillars and barriers
    ice: [],
  };
  let n = 0;
  for (const s of cfg.slots) {
    if (!s) continue;
    g.fighters.push(makeFighter(s, spawnPoint(st, n++), timed ? 99 : cfg.stocks));
  }
  g.surf = computeSurfaces(g.stage, g.frame, g.clouds, g.brk, g.ice);
  return g;
}

const LAVA_LOW = 640; // where Bowser's Castle lava sits between rises (far below the stage, just for show)
function initHaz(st) {
  return {
    chestT: 900, sproutT: 500, kartT: 650,
    wig: { on: false, next: 900 + RND() * 500, warn: 0, x: 0, dir: 1, hp: 3, angry: 0, hits: {} },
    spk: (st.spikes || []).map((s, i) => ({ ph: 'idle', t: 260 + i * 210, hits: {} })),
    wind: { ph: 'idle', t: 700 + RND() * 400, dir: 1 },
    rock: { on: false, t: 700 + RND() * 400, x: 0, dir: 1, warn: 0, hits: {} },
    dark: { ph: 'idle', t: 800 + RND() * 400, t0: 0, hits: {} },
    lava: { ph: 'idle', t: 900 + RND() * 400, lv: LAVA_LOW, hits: {} },
    // v1.15 stages: icicles, conveyor belts, the pendulum, the tide, low gravity, falling stars
    icicle: { ph: 'idle', t: 700 + RND() * 400, list: [], hits: {} },
    conv: { ph: 'run', t: 600 + RND() * 300, dir: 1 },
    pend: { ph: 'idle', t: 800 + RND() * 400, a: RND() < 0.5 ? -PEND_A : PEND_A, warn: 0, k: 0, from: 1, hits: {} },
    tide: { ph: 'low', t: 700 + RND() * 400, lv: TIDE_LOW },
    grav: { ph: 'idle', t: 800 + RND() * 400 },
    star: { t: 300, list: [] },
  };
}

function stepGame(g, getBits) {
  g.frame++;
  updIce(g);
  g.surf = computeSurfaces(g.stage, g.frame, g.clouds, g.brk, g.ice);
  if (g.phase === 'over') { g.pt++; return; }
  const counting = g.phase === 'count';
  if (counting) {
    g.pt--;
    if (g.pt === 180 || g.pt === 120 || g.pt === 60) g.ev.push({ t: 'count', n: g.pt / 60 });
    if (g.pt <= 0) { g.phase = 'play'; g.ev.push({ t: 'go' }); }
  }
  // a timed match's clock (it beeps for the last ten seconds)
  if (g.phase === 'play' && g.mode === 'time' && g.timeLeft > 0) {
    g.timeLeft--;
    if (g.timeLeft > 0 && g.timeLeft <= 600 && g.timeLeft % 60 === 0) g.ev.push({ t: 'clock', n: g.timeLeft / 60 });
    if (g.timeLeft === 0) g.ev.push({ t: 'timeup' });
  }
  // broken platforms pop back into place when their time is up
  // (where the platform is right now: some ride round on gears)
  for (const pi in g.brk) if (g.brk[pi] === g.frame) { const S = g.surf[STG[g.stage].solids.length + +pi] || STG[g.stage].plats[pi]; g.ev.push({ t: 'platback', x: S.x + S.w / 2, y: S.y, pi: +pi }); }
  for (const f of g.fighters) updateFighter(g, f, counting ? 0 : getBits(f));
  // Emilia Toad's spirit Puck follows her around and fires ice every 7 seconds
  for (const f of g.fighters) if (CH[f.ch].puck && !f.out) updPuck(g, f);
  updateProj(g);
  updateItems(g);
  updateFx(g);
  for (let k = g.clouds.length - 1; k >= 0; k--) if (--g.clouds[k].life <= 0) g.clouds.splice(k, 1);
  if (!counting) { hazards(g); spawnItems(g); }
  for (const f of g.fighters) {
    if (f.st === 'dead' || f.out) continue;
    if (f.x < BLAST.l || f.x > BLAST.r || f.y > BLAST.b || f.y < BLAST.t) ko(g, f);
  }
  checkEnd(g);
}

function updateFighter(g, f, bits) {
  const C = CH[f.ch];
  if (f.out) return;
  // caught in the Beast of the End's storm: time runs slower and slower for this fighter (moving, falling,
  // attacking, everything), down to a crawl just before it freezes solid
  if (f.bfz > 0 && f.st !== 'dead') { f.bacc = (f.bacc || 0) + 1 - 0.94 * Math.min(1, f.bfz); if (f.bacc < 1) return; f.bacc -= 1; }
  const pressed = bits & ~f.pb;
  f.pb = bits;
  if (f.st === 'dead') { if (--f.dead <= 0) respawn(g, f); return; }
  if (f.hl > 0) { f.hl--; return; }
  if (f.inv > 0) f.inv--;
  if (f.big > 0) f.big--;
  if (f.small > 0) f.small--;
  if (f.star > 0) f.star--;
  if (f.pe > 0) f.pe--;
  if (f.frz > 0) f.frz--;
  if (f.pick > 0) f.pick--;
  if (f.drop > 0) f.drop--;
  if (f.ledgeCd > 0) f.ledgeCd--;
  if (f.prT > 0) f.prT--;
  if (f.ig > 0) f.ig--;
  if (f.hide > 0) f.hide--;
  if (f.boostT > 0) f.boostT--;
  if (f.wallT > 0) f.wallT--;
  if (f.parryCd > 0) f.parryCd--;
  if (f.slow > 0) f.slow--; // chilled by Emilia Toad's ice weapons: slower on the move
  // Water Yoshi's statuses: Scalded burns 2% a second; Sunk wears off; a puddle's slipperiness fades as you leave it
  if (f.scald > 0) { f.scald--; if (f.scald % 60 === 0) { f.dm = Math.min(999, f.dm + 2); g.ev.push({ t: 'scald', x: f.x, y: f.y - f.h * 0.7 }); } }
  if (f.sunk > 0) f.sunk--;
  if (f.slick > 0) f.slick--;
  if (f.flat > 0 && f.st !== 'stun') f.flat = 0;
  // standing in Nolan Toad's stink (a cloud, or his room in his finale) slows you down while you're in it
  if (f.stink > 0) f.stink--;
  if (f.reek > 0) f.reek--;
  // Beatrice's follow-up spark (Subaru Toad), a moment after his hit lands; it fizzles if he gets hit first.
  // It only adds damage (it never knocks anyone, so it can't cut short the launch his hit just gave them)
  if (f.echo && --f.echo.t <= 0) {
    const E = f.echo; f.echo = null;
    if (f.st !== 'hit' && f.st !== 'stun' && f.st !== 'held') {
      const cx = f.x + E.x * f.fc, cy = f.y + E.y;
      for (const v of g.fighters) {
        if (v === f || ally(g, f, v) || !hittable(v) || v.inv > 0 || v.star > 0 || v.ig > 0) continue;
        if (!circRect(cx, cy, E.r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) continue;
        const d = E.d * f.pm;
        if (v.st === 'shield') v.shd -= d; else { v.dm = Math.min(999, v.dm + d); f.dealt += d; }
        g.ev.push({ t: 'beakospark', x: v.x, y: v.y - v.h * 0.55 });
      }
    }
  }
  for (const k in f.cd) if (f.cd[k] > 0) f.cd[k]--;
  if (f.psn > 0) { f.psn--; if (f.psn % 30 === 0) f.dm += 1; }
  const tsc = f.big ? 1.45 : f.small ? 0.6 : 1;
  f.sc += (tsc - f.sc) * 0.15;
  f.h = C.h * f.sc * (f.st === 'crouch' ? 0.64 : 1); f.w = 36 * C.wide * f.sc;
  f.pm = C.pow * (f.big ? 1.35 : 1) * (f.small ? 0.65 : 1) * (f.pe ? 1.2 : 1);
  const dirX = (bits & B_R ? 1 : 0) - (bits & B_L ? 1 : 0);
  const onG = f.gi >= 0;
  const c = { onG, dirX, bits, pressed, C };
  if (f.rp > 0) {
    f.rp--;
    if (bits) f.rp = 0; else { f.vx = 0; f.vy = 0; return; }
  }
  if (f.star > 0) hitArea(g, f, 0, -f.h * 0.5, Math.max(f.w, f.h) * 0.6, 5, 7, 0.08, 45, { every: 30, radial: true, map: f.sh2, mv: '' });

  switch (f.st) {
    case 'hit':
      f.hs--;
      f.vx *= onG ? (g.surf[f.gi] && g.surf[f.gi].icy ? 0.95 : 0.85) : 0.965;
      if (dirX && f.frz <= 0) f.vx += dirX * 0.06;
      if (f.hs <= 0 && f.frz <= 0) f.st = onG ? 'idle' : 'air';
      break;
    case 'stun': case 'land':
      f.t--; f.vx *= 0.8;
      if (f.t <= 0) f.st = onG ? 'idle' : 'air';
      break;
    case 'atk': updAttack(g, f, c); break;
    case 'charge': updCharge(g, f, c); break;
    case 'taunt': updTaunt(g, f, c); break;
    case 'spc': {
      f.t++;
      const r = SP[f.sp].upd(g, f, c);
      if (r) { f.sp = null; f.st = r === 2 && f.gi < 0 ? 'help' : f.gi >= 0 ? 'idle' : 'air'; }
      break;
    }
    case 'dodge':
      f.t--;
      if (onG) f.vx *= 0.9; else { f.vx *= 0.9; f.vy *= 0.88; }
      if (f.t <= 0) f.st = onG ? 'idle' : 'air';
      break;
    case 'ledge': updLedge(g, f, c); return;
    case 'grab': updGrab(g, f, c); break;
    case 'hold': updHold(g, f, c); break;
    case 'throw': updThrow(g, f, c); break;
    case 'held': updHeld(g, f, c); return; // the grabber moves me
    case 'shield': {
      if (!(bits & B_S) || !onG) { f.st = onG ? 'idle' : 'air'; break; }
      f.vx *= 0.7; f.shd -= 0.2;
      if (f.shd <= 0) { f.shd = 30; f.st = 'stun'; f.t = 160; g.ev.push({ t: 'break', x: f.x, y: f.y - f.h }); break; }
      // dodging over and over tires you out: less invincibility, more time stuck in the roll
      const tired = () => { f.dodgeN = g.frame - f.dodgeT < 110 ? Math.min(4, f.dodgeN + 1) : 0; f.dodgeT = g.frame; return f.dodgeN; };
      if (pressed & (B_A | B_G)) { startGrab(g, f); break; } // grab straight out of a shield
      if (pressed & (B_U | B_J)) { f.st = 'idle'; doJump(g, f); }
      else if (pressed & (B_L | B_R)) { const n = tired(); f.st = 'dodge'; f.t = 22 + n * 5; f.inv = Math.max(f.inv, 18 - n * 3); f.vx = dirX * 8.5; f.fc = -dirX; g.ev.push({ t: 'dodge', x: f.x, y: f.y }); }
      else if (pressed & B_D) { const n = tired(); f.st = 'dodge'; f.t = 20 + n * 5; f.inv = Math.max(f.inv, 18 - n * 3); f.vx = 0; g.ev.push({ t: 'dodge', x: f.x, y: f.y }); }
      break;
    }
    default: control(g, f, c);
  }
  if (f.st !== 'shield' && f.shd < 100) f.shd = Math.min(100, f.shd + 0.1);
  physics(g, f, bits);
}

function control(g, f, c) {
  const C = c.C, dirX = c.dirX, pr = c.pressed, bits = c.bits;
  let onG = c.onG;
  // (slippery footing: 2 = Frostbite Glacier's ice floor, 1 = a Water Yoshi puddle, a little less slippery)
  const help = f.st === 'help', slip = !onG ? 0 : g.surf[f.gi] && g.surf[f.gi].icy ? 2 : f.slick > 0 ? 1 : 0;
  if (pr & (B_L | B_R | B_U | B_D)) f.dirAt = g.frame;
  // Super Mushroom: slow and mighty; Mini Mushroom: quick and fragile; chilled by ice: slowed down
  const spd = (f.small ? 1.35 : 1) * (f.star ? 1.2 : 1) * (f.big ? 0.72 : 1) * (f.slow > 0 ? 0.55 : 1) * (f.sunk > 0 ? 0.75 : 1) * (f.reek > 0 ? NOLAN.room.slow : f.stink > 0 ? NOLAN.cloud.slow : 1);
  if (onG) {
    if (!help) for (let n = 0; n < 4; n++) if (pr & B_TAUNTS[n]) { startTaunt(g, f, n + 1); return; }
    if (f.boostT > 0) { f.vx += dirX * 0.3; f.st = 'run'; } // riding a dash panel keeps its speed
    else if (dirX) {
      f.vx += dirX * C.run * (slip === 2 ? 0.075 : slip ? 0.13 : 0.22); // (on ice you get going slowly)
      const m = C.run * spd;
      f.vx = clamp(f.vx, -m, m);
      f.fc = dirX; f.st = 'run';
    } else {
      f.vx *= slip === 2 ? 0.965 : slip ? 0.9 : 0.72; // (and you slide to a stop)
      if (Math.abs(f.vx) < 0.1) f.vx = 0;
      f.st = bits & B_D ? 'crouch' : 'idle';
    }
  } else {
    const m = C.air * spd * (help ? 0.85 : 1); // after an up special you can still steer back toward the stage
    if (dirX) {
      if (Math.abs(f.vx) > m && Math.sign(f.vx) === dirX) f.vx *= 0.96;
      else f.vx = clamp(f.vx + dirX * 0.55, -m, m);
    } else f.vx *= 0.985;
    if (!help) f.st = 'air';
  }
  if (help && !onG) return;
  // the jump button jumps at once; Up waits 2 frames so Up + Attack can mean an up attack instead (pressing Up again
  // doesn't restart the wait)
  if (pr & B_J) { f.jbuf = 0; doJump(g, f); onG = f.gi >= 0; } // jump + attack together gives an air attack
  else if (pr & B_U && f.jbuf <= 0) f.jbuf = 3;
  if (f.jbuf > 0) {
    if (pr & (B_A | B_B)) f.jbuf = 0;
    else if (--f.jbuf === 0) doJump(g, f);
  }
  // grab: the Grab button, or Guard + Attack together (on the ground)
  if (onG && !help && (pr & B_G || (bits & B_S && pr & B_A))) {
    if (f.hold) { throwItem(g, f, c); return; }
    startGrab(g, f);
    return;
  }
  if (pr & B_A && C.volley && !f.hold) {
    // Emilia Toad: every Attack, in any direction, fires her homing ice volley (once every 3.5 seconds).
    // Up + Attack off the stage still gives the lift everyone's first up-air gets, even while the volley recharges
    if (!onG && bits & B_U && !f.uaUsed && offStage(g, f)) { f.uaUsed = true; f.vy = Math.min(f.vy, -9.5); f.ff = false; g.ev.push({ t: 'uplift', x: f.x, y: f.y }); }
    if (f.cd.a > 0) g.ev.push({ t: 'fizzle', x: f.x + f.fc * 16, y: f.y - f.h * 0.6 });
    else { f.cd.a = EMI.volleyCd; if (dirX) f.fc = dirX; startAttack(g, f, 'volley'); return; }
  } else if (pr & B_A) {
    if (f.hold) { throwItem(g, f, c); return; }
    // tapping a direction together with attack makes a (chargeable) smash attack
    const smash = g.frame - f.dirAt <= 4 && (bits & (B_L | B_R | B_U | B_D));
    let kind;
    if (onG) {
      if (f.pick > 0) kind = 'pick';
      else if (smash && bits & B_U) kind = 'usmash';
      else if (smash && bits & B_D) kind = 'dsmash';
      else if (smash && dirX) { kind = 'fsmash'; f.fc = dirX; }
      else if (bits & B_U) kind = 'up';
      else if (bits & B_D) kind = 'down';
      else if (dirX) { kind = 'side'; f.fc = dirX; }
      else kind = 'jab';
      if (SMASHES[kind]) { f.st = 'charge'; f.at = kind; f.t = 0; f.chg = 0; f.jbuf = 0; f.vx *= 0.5; g.ev.push({ t: 'charge', x: f.x, y: f.y }); return; }
    } else {
      if (bits & B_U) kind = 'uair';
      else if (bits & B_D) kind = 'dair';
      else if (dirX && dirX !== f.fc) kind = 'bair';
      else if (dirX) kind = 'fair';
      else kind = 'nair';
    }
    startAttack(g, f, kind);
    return;
  }
  if (pr & B_B) {
    f.t = 0; f.t2 = 0; f.hits = {};
    if (f.fs) { f.st = 'spc'; f.sp = 'fs'; f.jbuf = 0; SP.fs.start(g, f, c); return; }
    const which = bits & B_U ? 'u' : bits & B_D ? 'd' : dirX ? 's' : 'n';
    if (which === 's' || (which === 'n' && dirX)) f.fc = dirX || f.fc;
    const id = C.sp[which];
    if (SP[id] && SP[id].start(g, f, c) !== false) { f.st = 'spc'; f.sp = id; f.jbuf = 0; f.use++; g.ev.push({ t: 'spc', i: f.i, ch: f.ch, sp: id }); }
    return;
  }
  if (bits & B_S) {
    if (onG) {
      // guard: pressing it just before a hit lands is a parry. A parry try then needs 45 frames to recharge
      // (a successful one is ready again at once), so mashing Guard doesn't work
      if (pr & B_S && f.parryCd <= 0) { f.parryAt = g.frame; f.parryCd = 45; }
      f.st = 'shield'; f.vx *= 0.5;
    } else if (pr & B_S && !f.adUsed) {
      const n = g.frame - f.dodgeT < 110 ? Math.min(4, f.dodgeN + 1) : 0;
      f.dodgeN = n; f.dodgeT = g.frame;
      f.adUsed = true; f.st = 'dodge'; f.t = 24 + n * 4; f.inv = Math.max(f.inv, 20 - n * 3);
      f.vx = dirX * 7; f.vy = bits & B_U ? -7 : bits & B_D ? 7 : dirX ? 0 : -1; f.glide = 0;
      g.ev.push({ t: 'dodge', x: f.x, y: f.y });
    }
    return;
  }
  // double-tap down to drop through a soft platform (holding down crouches)
  if (onG && pr & B_D) {
    const s = g.surf[f.gi];
    if (s && !s.solid && g.frame - f.dTap < 16) { f.drop = 14; f.gi = -1; f.st = 'air'; f.vy = 1; }
    f.dTap = g.frame;
  }
  if (!onG && pr & B_D && f.vy > -3) { f.ff = true; f.glide = 0; }
}

function doJump(g, f) {
  const C = CH[f.ch];
  if (f.pick > 0) return;
  const jm = (f.small ? 1.18 : f.big ? 0.88 : 1) * (f.slow > 0 ? 0.88 : 1) * (f.sunk > 0 ? 0.9 : 1);
  if (f.gi >= 0) {
    f.vy = -C.jump * jm; f.gi = -1; f.st = 'air';
    g.ev.push({ t: 'jump', x: f.x, y: f.y });
  } else if (f.wallT > 0 && f.wj < 2) {
    // wall jump: kick off the side of the stage (saves your double jump), twice per trip through the air
    f.wj++; f.wallT = 0; f.vy = -Math.max(12.5, C.djump * 0.95) * jm; f.vx = -f.wall * 4.5; f.fc = -f.wall; f.ff = false; f.glide = 0;
    g.ev.push({ t: 'walljump', x: f.x + f.wall * f.w * 0.5, y: f.y - f.h * 0.5, dir: -f.wall });
  } else if (f.jl > 0) {
    f.jl--; f.vy = -C.djump * jm; f.ff = false; f.glide = 0;
    g.ev.push({ t: 'djump', x: f.x, y: f.y, c: f.ch, i: f.i });
  }
}

function startAttack(g, f, kind) {
  f.st = 'atk'; f.at = kind; f.t = 0; f.hits = {}; f.hitsB = null; f.jbuf = 0; f.use++;
  // off the stage, the first up-air of each trip carries you upward: an extra way back. Over the stage it's just an attack
  if (kind === 'uair' && !f.uaUsed && offStage(g, f)) { f.uaUsed = true; f.vy = Math.min(f.vy, -9.5); f.ff = false; g.ev.push({ t: 'uplift', x: f.x, y: f.y }); }
  if (kind !== 'throw') g.ev.push({ t: 'swing', x: f.x, y: f.y, k: kind, s: SMASHES[kind] ? 1 : 0, i: f.i, ch: f.ch });
}

// outside the main stage's edges, or below its top
function offStage(g, f) {
  const s = STG[g.stage].solids[0];
  return f.x < s.x - 4 || f.x > s.x + s.w + 4 || f.y > s.y + 4;
}

function updAttack(g, f, c) {
  const A = ATK[f.ch][f.at], C = c.C, t0 = f.t;
  // Dash Yoshi's attacks play out faster (aspd); `crossed(n)` is true on the frame the move reaches frame n
  f.t += C.aspd || 1;
  const crossed = n => t0 < n && f.t >= n;
  // tap attack again during a jab for the second and third hits
  if ((f.at === 'jab' || f.at === 'jab2') && c.pressed & B_A && f.t >= 4 && !(c.bits & (B_L | B_R | B_U | B_D))) { startAttack(g, f, f.at === 'jab' ? 'jab2' : 'jab3'); return; }
  if (c.onG) f.vx *= 0.82;
  else if (c.dirX) f.vx = clamp(f.vx + c.dirX * 0.35, -C.air, C.air);
  if (A.lunge && c.onG && A.hb.length && crossed(A.hb[0].a)) f.vx += f.fc * A.lunge;
  // Hasidic Toad's burst of Hanukkah gelt shoots him upward
  if (A.rise && crossed(A.rise.at)) { f.vy = -A.rise.vy; f.gi = -1; g.ev.push({ t: 'risefx', x: f.x, y: f.y, k: A.tpl }); }
  // Emilia Toad's ice volley
  if (A.volley && crossed(A.volley)) fireVolley(g, f);
  // a thrown projectile: Yoshi's egg drop, the Bob-omb
  if (A.drop && crossed(A.drop.at)) {
    spawnProj(g, f, Object.assign({ grav: 0.5, life: 90 }, JSON.parse(JSON.stringify(A.drop.p)), { x: f.x + f.fc * 6, y: f.y + 4, vx: f.vx * 0.3, fc: f.fc }));
    g.ev.push({ t: 'throw', x: f.x, y: f.y });
  }
  // burrowing: under the ground nobody can touch you; you tunnel forward (never past the edge) and pop up at the end
  if (A.dig && f.t >= A.dig.a && f.t <= A.dig.b) {
    const s = g.surf[f.gi];
    if (!c.onG || !s) f.t = Math.max(f.t, A.dig.b);
    else {
      f.ig = Math.max(f.ig, 2);
      f.vx = f.fc * A.dig.speed * (f.sc || 1);
      if (f.x + f.vx < s.x + 14 || f.x + f.vx > s.x + s.w - 14) f.vx = 0;
      if (Math.floor(f.t) % 3 === 0) g.ev.push({ t: 'dust', x: f.x, y: f.y - 20 });
    }
    if (crossed(A.dig.a)) g.ev.push({ t: 'digfx', x: f.x, y: f.y });
  }
  const mul = A.smash ? f.chgMul : 1;
  A.hb.forEach((hb, n) => {
    if (f.t < hb.a || f.t > hb.b) return;
    // a finisher after a flurry keeps its own hit list, so it still lands on foes the flurry already hit
    const map = hb.sep ? ((f.hitsB || (f.hitsB = {}))[n] || (f.hitsB[n] = {})) : f.hits;
    const hit = hitArea(g, f, hb.x * f.sc, hb.y * f.sc, hb.r * f.sc, hb.d * mul, hb.k * (A.smash ? 0.8 + 0.2 * mul : 1), hb.g, hb.ang,
      { map, every: hb.every, frz: hb.frz, psn: hb.psn, stun: hb.stun });
    // Ice Climbers style: Beatrice follows each landed attack with a little spark of her own (a quarter of the damage)
    if (hit && C.duo && !f.echo && !hb.every) f.echo = { t: 7, x: hb.x * f.sc, y: hb.y * f.sc, r: hb.r * f.sc * 0.85, d: hb.d * mul * 0.25, ang: hb.ang, at: f.at, use: f.use };
  });
  if (f.t >= A.dur) { f.at = null; f.chgMul = 1; f.st = c.onG ? 'idle' : 'air'; }
}

// smash attacks charge while the attack button stays held (up to a second)
function updCharge(g, f, c) {
  f.t++;
  if (c.onG) f.vx *= 0.75;
  if (c.bits & B_A && f.chg < 60) { f.chg++; return; }
  f.chgMul = 1 + f.chg / 100;
  startAttack(g, f, f.at);
}

function startTaunt(g, f, n) {
  f.st = 'taunt'; f.tn = n; f.t = 0; f.vx *= 0.3;
  // (k picks a line for a fighter whose taunts are things they say, the same on every screen)
  g.ev.push({ t: 'taunt', i: f.i, n, ch: f.ch, x: f.x, y: f.y - f.h, k: g.frame % 3 });
}
function updTaunt(g, f, c) {
  f.t++;
  if (c.onG) f.vx *= 0.8;
  if (f.tn === 4 && f.t === 4 && c.onG) { f.vy = -10.5; f.gi = -1; } // the backflip hop
  if (f.t >= TAUNTS[f.tn - 1].dur && (c.onG || f.tn !== 4)) { f.st = c.onG ? 'idle' : 'air'; f.tn = 0; }
}

function throwItem(g, f, c) {
  f.hold = null;
  const up = c.bits & B_U, dn = c.bits & B_D;
  spawnProj(g, f, {
    k: 'turnip', face: 'turnip', x: f.x + f.fc * 14, y: f.y - f.h * 0.7,
    vx: up ? f.fc * 2 : dn ? f.fc * 1 : f.fc * 12, vy: up ? -15 : dn ? 8 : -4,
    d: 9, kb: 6, gr: 0.1, ang: up ? 85 : 40, r: 14, grav: 0.42, life: 200,
  });
  startAttack(g, f, 'throw');
  g.ev.push({ t: 'throw', x: f.x, y: f.y });
}

// ---------- Grabs ----------
// Grab (the Grab button, Guard + Attack, or Attack while shielding) catches a foe right in front, even one hiding
// behind a shield. Then Attack pummels and a direction throws. The hold lasts longer at high damage, and the held
// foe can mash any button to break free sooner.
const THROWS = {
  f: { at: 6, d: 8, k: 6.5, g: 0.11, ang: 40, end: 18 },
  b: { at: 10, d: 9, k: 7, g: 0.12, ang: 40, end: 20 },
  u: { at: 9, d: 7, k: 6.5, g: 0.1, ang: 88, end: 20 },
  d: { at: 9, d: 6, k: 5, g: 0.07, ang: 70, end: 22 },
};
function startGrab(g, f) {
  const dash = Math.abs(f.vx) > 3;
  f.st = 'grab'; f.t = 0; f.at = null; f.jbuf = 0; f.use++;
  f.vx = dash ? f.fc * Math.min(Math.abs(f.vx), 6) : f.vx * 0.3; // a running grab slides in
  g.ev.push({ t: 'swing', x: f.x, y: f.y, k: 'grab' });
}
function updGrab(g, f, c) {
  f.t++;
  f.vx *= c.onG ? 0.84 : 0.95;
  if (f.t >= 6 && f.t <= 9) {
    const reach = f.w / 2 + 30 * CH[f.ch].reach * f.sc;
    for (const v of g.fighters) {
      if (v === f || ally(g, f, v) || !hittable(v) || v.st === 'held' || v.st === 'ledge' || v.gby >= 0) continue;
      const dx = (v.x - f.x) * f.fc;
      if (dx < -6 || dx > reach + v.w / 2 || v.y < f.y - f.h * 0.9 || v.y - v.h > f.y + 4) continue;
      catchFoe(g, f, v);
      return;
    }
  }
  if (f.t >= 28) f.st = c.onG ? 'idle' : 'air'; // missed: a grab whiff is easy to punish
}
function catchFoe(g, f, v) {
  if (v.st === 'hold' || v.st === 'throw') releaseHeld(g, v, 0);
  f.st = 'hold'; f.t = 0; f.gv = v.i; f.pmT = 8; f.vx = 0;
  f.gt = Math.min(150, 70 + v.dm * 0.5);
  v.st = 'held'; v.gby = f.i; v.t = 0; v.at = null; v.sp = null; v.vx = 0; v.vy = 0; v.hs = 0; v.glide = 0; v.tn = 0; v.chg = 0; v.chgMul = 1;
  holdPos(f, v);
  g.ev.push({ t: 'grab', x: v.x, y: v.y - v.h / 2 });
}
function holdPos(f, v) {
  v.x = f.x + f.fc * (f.w / 2 + v.w / 2 - 8 * f.sc); v.y = f.y; v.vx = 0; v.vy = 0; v.fc = -f.fc; v.gi = -1;
}
// let go of whoever `f` holds (push > 0 shoves them away)
function releaseHeld(g, f, push) {
  const v = f.gv >= 0 ? fighterBy(g, f.gv) : null;
  f.gv = -1;
  if (v && v.st === 'held' && v.gby === f.i) {
    v.gby = -1; v.st = 'air'; v.gi = -1; v.vx = f.fc * push; v.vy = push ? -5 : 0; v.inv = Math.max(v.inv, 8);
  }
}
function updHold(g, f, c) {
  const v = fighterBy(g, f.gv);
  if (!v || !alive(v) || v.st !== 'held' || v.gby !== f.i) { f.gv = -1; f.st = c.onG ? 'idle' : 'air'; return; }
  f.t++; f.vx = 0;
  if (f.pmT > 0) f.pmT--;
  holdPos(f, v);
  const p = c.pressed, held = f.t >= 12 ? c.bits : 0, dirs = (p | held) & (B_U | B_D | B_L | B_R);
  // a direction throws (pressed, or held for a moment)
  if (dirs) { startThrow(g, f, dirs & B_U ? 'u' : dirs & B_D ? 'd' : ((dirs & B_R ? 1 : -1) === f.fc ? 'f' : 'b')); return; }
  if (p & (B_A | B_G) && f.pmT <= 0) {
    // pummel
    const d = 1.3 * f.pm;
    f.pmT = 14; v.dm = Math.min(999, v.dm + d); f.dealt += d; v.lastHit = f.i; v.lastHitT = g.frame; v.t = 8;
    g.ev.push({ t: 'hit', x: v.x, y: v.y - v.h * 0.55, p: 2, c: f.i });
  }
  if (--f.gt <= 0) {
    // they broke free: both are pushed apart
    releaseHeld(g, f, 5);
    f.st = 'land'; f.t = 10; f.vx = -f.fc * 2;
    g.ev.push({ t: 'grabbreak', x: v.x, y: v.y - v.h / 2 });
  }
}
function updHeld(g, f, c) {
  const a = fighterBy(g, f.gby);
  if (!a || !alive(a) || (a.st !== 'hold' && a.st !== 'throw') || a.gv !== f.i) { f.gby = -1; f.st = 'air'; f.gi = -1; return; }
  if (f.t > 0) f.t--;
  // mash to break free sooner
  if (c.pressed && a.st === 'hold') a.gt -= 5;
}
function startThrow(g, f, dir) {
  f.st = 'throw'; f.thr = dir; f.t = 0; f.use++;
  g.ev.push({ t: 'swing', x: f.x, y: f.y, k: 'throw' });
}
function updThrow(g, f, c) {
  const v = fighterBy(g, f.gv), T = THROWS[f.thr] || THROWS.f;
  f.t++; f.vx = 0;
  if (v && v.st === 'held' && v.gby === f.i) {
    // carry the foe through the throw: forward toss, a swing over the head for back, lifted overhead for up, a slam for down
    const k = Math.min(1, f.t / T.at), fw = f.w / 2 + v.w / 2 - 8 * f.sc;
    if (f.thr === 'f') { v.x = f.x + f.fc * fw * (1 + 0.35 * k); v.y = f.y - 12 * k; }
    else if (f.thr === 'b') { const an = k * Math.PI; v.x = f.x + f.fc * fw * Math.cos(an); v.y = f.y - Math.sin(an) * 46 * f.sc; }
    else if (f.thr === 'u') { v.x = f.x + f.fc * fw * (1 - k); v.y = f.y - f.h * 1.05 * k; }
    else { v.x = f.x + f.fc * fw * (1 - 0.4 * k); v.y = f.y; }
    v.vx = 0; v.vy = 0;
    if (f.t >= T.at) {
      const dir = f.thr === 'b' ? -f.fc : f.fc;
      v.gby = -1; f.gv = -1; v.st = 'air';
      if (f.thr === 'b') f.fc = -f.fc; // turned around while swinging them
      applyHit(g, v, f, T.d * f.pm, T.k, T.g, T.ang, dir, { mv: 't:' + f.thr, use: f.use });
      g.ev.push({ t: 'throw', x: v.x, y: v.y - v.h / 2, k: f.thr });
    }
  } else if (f.gv >= 0) { f.gv = -1; f.st = c.onG ? 'idle' : 'air'; return; } // someone knocked them out of my hands
  if (f.t >= T.end) { f.gv = -1; f.st = c.onG ? 'idle' : 'air'; }
}

function updLedge(g, f, c) {
  f.t--; f.vx = 0; f.vy = 0;
  const pr = c.pressed, toward = f.lx;
  const dirPress = pr & (B_L | B_R) ? c.dirX : 0;
  if (pr & (B_U | B_J) || pr & B_A || (dirPress && dirPress === toward)) {
    f.x = f.lcx + toward * (f.w * 0.6 + 4); f.y = f.lcy; f.vy = 0; f.gi = f.lsi; f.st = 'idle';
    f.inv = Math.max(f.inv, 10);
    if (pr & B_A) startAttack(g, f, 'getup');
    return;
  }
  if (pr & B_D || (dirPress && dirPress === -toward) || f.t <= 0) {
    f.st = 'air'; f.ledgeCd = 45; f.x -= toward * 6;
  }
}

function physics(g, f, bits) {
  const C = CH[f.ch];
  let grav = (f.st === 'hit' ? 0.55 : GRAV) * (C.fall < 1 && f.st !== 'hit' ? 0.8 + C.fall * 0.2 : 1), maxf = (f.ff ? FASTFALL : MAXFALL) * (f.st === 'hit' ? 1 : C.fall);
  if (f.glide > 0 && f.vy > 0 && f.st !== 'hit') { grav = f.glide; maxf = 2.4; }
  if (f.st === 'spc' && f.sp && SP[f.sp].fall) maxf = SP[f.sp].fall;
  if (f.small) grav *= 0.9;
  // Starlight Observatory's low gravity; Tidal Lagoon's water (floaty, slow, and you sink gently)
  if (g.gravK < 1) { grav *= g.gravK; maxf *= 0.62; }
  f.wet = g.water !== undefined && f.y - f.h * 0.35 > g.water ? 1 : 0;
  if (f.wet) { grav *= 0.38; maxf = Math.min(maxf, 3.4); f.vx *= 0.955; }
  f.vy += grav;
  if (f.st !== 'hit') f.vy = Math.min(f.vy, maxf);
  else f.vy = Math.min(f.vy, 22);
  const cur = f.gi >= 0 ? g.surf[f.gi] : null;
  if (cur) { f.x += cur.dx; f.y += cur.dy; }
  const wasG = f.gi >= 0;
  const prevY = f.y, prevTop = f.y - f.h;
  f.x += f.vx; f.y += f.vy;
  f.gi = -1;
  const hw = f.w / 2;
  for (let k = 0; k < g.surf.length; k++) {
    const s = g.surf[k];
    if (s.solid) {
      const l = s.x, r = s.x + s.w, t = s.y, b = s.y + s.h;
      if (f.x + hw <= l || f.x - hw >= r || f.y < t || f.y - f.h >= b) continue;
      if (prevY <= t + 1 && f.vy >= 0) landOn(f, k, t);
      else if (prevTop >= b - 1 && f.vy < 0) {
        f.y = b + f.h;
        // rising into the underside close to the edge slides you out around the corner and you keep going up, so an
        // up special from below still reaches the ledge; deeper underneath you just bump your head
        const inL = f.x + hw - l, inR = r - (f.x - hw), near = Math.min(inL, inR);
        if (near < hw * 2 + 34) f.x += (inL < inR ? -1 : 1) * Math.min(9, near + 1);
        else f.vy = 0;
      } else {
        f.x = f.x < (l + r) / 2 ? l - hw : r + hw;
        f.vx = f.st === 'hit' ? -f.vx * 0.5 : 0;
        // touching the side of the stage: a jump now kicks off the wall
        f.wallT = 8; f.wall = f.x < (l + r) / 2 ? 1 : -1;
      }
    } else {
      if (f.vy < 0 || f.drop > 0) continue;
      if (f.x < s.x - 4 || f.x > s.x + s.w + 4) continue;
      if (prevY <= s.y + Math.abs(s.dy) + 1 && f.y >= s.y) {
        if (s.bounce && !(bits & B_D) && f.st !== 'hit') {
          f.y = s.y; f.vy = -22; f.jl = airJumps(f); f.upUsed = false; f.adUsed = false; f.sUsed = false; f.uaUsed = false; f.wj = 0; f.glide = 0; f.ff = false;
          if (f.st === 'help') f.st = 'air';
          g.ev.push({ t: 'bounce', x: f.x, y: f.y });
        } else landOn(f, k, s.y);
      }
    }
  }
  if (f.gi >= 0 && !wasG) land(g, f);
  if (f.gi < 0 && wasG && (f.st === 'idle' || f.st === 'run' || f.st === 'shield' || f.st === 'crouch')) f.st = 'air';
  if (f.gi < 0) tryLedge(g, f);
}

function landOn(f, k, y) {
  if (f.st === 'hit' && f.vy > 9) { f.y = y; f.vy = -f.vy * 0.45; return; }
  f.y = y; f.vy = 0; f.gi = k;
}

function land(g, f) {
  f.jl = airJumps(f); f.upUsed = false; f.adUsed = false; f.sUsed = false; f.uaUsed = false; f.wj = 0; f.ff = false; f.glide = 0;
  if (f.st === 'air') f.st = 'idle';
  else if (f.st === 'help') { f.st = 'land'; f.t = 10; }
  else if (f.st === 'atk' && AERIALS[f.at]) { f.st = 'land'; f.t = 7; f.at = null; }
  else if (f.st === 'dodge') { f.st = 'land'; f.t = 5; }
  g.ev.push({ t: 'land', x: f.x, y: f.y });
}

// ledges are generous: grab one while falling past it, or even while rising through an up special
function tryLedge(g, f) {
  if (f.ledgeCd > 0) return;
  if (!(f.st === 'air' || f.st === 'help' || (f.st === 'spc' && f.t > 8 && f.sp !== 'fs'))) return;
  if (f.vy < (f.st === 'air' ? 0 : -7)) return;
  for (let k = 0; k < g.surf.length; k++) {
    const s = g.surf[k];
    if (!s.solid || s.noLedge) continue;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? s.x : s.x + s.w;
      if (side < 0 ? f.x >= cx : f.x <= cx) continue;
      const hx = f.x - side * f.w * 0.5, hy = f.y - f.h * 0.85;
      if (Math.abs(hx - cx) < 40 && Math.abs(hy - s.y) < 48 && grabLedge(g, f, k, side)) return;
    }
  }
}
function grabLedge(g, f, k, side) {
  const s = g.surf[k], cx = side < 0 ? s.x : s.x + s.w, toward = -side;
  for (const o of g.fighters) if (o !== f && o.st === 'ledge' && o.lcx === cx) return false;
  f.st = 'ledge'; f.t = 200; f.lx = toward; f.lcx = cx; f.lcy = s.y; f.lsi = k;
  f.x = cx + side * f.w * 0.5; f.y = s.y + f.h * 0.85; f.vx = 0; f.vy = 0; f.fc = toward;
  f.sp = null; f.at = null; f.jl = airJumps(f); f.upUsed = false; f.adUsed = false; f.sUsed = false; f.uaUsed = false; f.wj = 0; f.glide = 0; f.ff = false;
  f.inv = Math.max(f.inv, 30);
  g.ev.push({ t: 'ledge', x: cx, y: s.y });
  return true;
}
// tether recoveries (Cowboy Toad's lasso, Toadsworth's cane): latch onto a ledge within reach
function tetherLedge(g, f, reach) {
  if (f.gi >= 0 || f.ledgeCd > 0) return false;
  let best = null, bd = reach;
  for (let k = 0; k < g.surf.length; k++) {
    const s = g.surf[k];
    if (!s.solid || s.noLedge) continue;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? s.x : s.x + s.w;
      if (side < 0 ? f.x >= cx : f.x <= cx) continue;
      const dy = s.y - (f.y - f.h * 0.6), d = Math.hypot(cx - f.x, dy);
      if (dy > 30 || d > bd) continue;
      best = [k, side]; bd = d;
    }
  }
  if (!best || !grabLedge(g, f, best[0], best[1])) return false;
  g.ev.push({ t: 'grab', x: f.x, y: f.y - f.h });
  return true;
}

function respawn(g, f) {
  f.x = RESPAWN_X[f.i % 8]; f.y = -330; f.vx = 0; f.vy = 0; f.dm = 0; f.st = 'air';
  f.rp = 180; f.inv = 180; f.jl = airJumps(f); f.upUsed = false; f.adUsed = false; f.sUsed = false; f.uaUsed = false; f.wj = 0; f.hold = null;
  f.sp = null; f.at = null; f.gi = -1; f.shd = 100;
  g.ev.push({ t: 'respawn', x: f.x, y: f.y });
}

function ko(g, f) {
  const kx = clamp(f.x, BLAST.l + 60, BLAST.r - 60), ky = clamp(f.y - f.h / 2, BLAST.t + 60, BLAST.b - 60);
  g.ev.push({ t: 'ko', x: kx, y: ky, i: f.i, ch: f.ch });
  const a = f.lastHit >= 0 && g.frame - f.lastHitT < 600 ? fighterBy(g, f.lastHit) : null;
  if (a && a !== f) {
    a.kos++;
    // Nolan Toad stamps everyone he KOs: LOW-TIER HUMAN
    if (CH[a.ch] && CH[a.ch].lowtier) g.ev.push({ t: 'lowtier', x: kx, y: ky, i: f.i, by: a.i });
  } else f.sds = (f.sds || 0) + 1; // (no one to credit: a self-destruct)
  // (in a timed match lives never run out)
  f.falls++; if (g.mode !== 'time') f.sk--; f.st = 'dead'; f.dead = 100; f.vx = 0; f.vy = 0;
  f.big = f.small = f.star = f.pe = f.frz = f.psn = f.pick = 0; f.hold = null; f.glide = 0; f.lastHit = -1;
  f.fs = 0; f.fsLock = 0; f.hide = 0; f.ig = 0; f.tn = 0; f.boostT = 0; f.slow = 0; f.scald = 0; f.sunk = 0; f.slick = 0; f.flat = 0;
  f.stink = 0; f.reek = 0; f.mold = 0; f.find = '';
  f.x = 0; f.y = -2000;
  if (f.sk <= 0) {
    f.out = true; f.outAt = g.frame;
    // out of the match: Emilia Toad's ice soldiers, pillar and barrier go with her
    for (const s of g.ice.slice()) if (s.o === f.i) breakIce(g, s);
    for (const q of g.proj) if (q.k === 'minion' && q.sub === 'icesoldier' && q.o === f.i) q.hp = 0;
  }
}

// is the match over? Stock: one fighter (or one team) left. Timed: the clock ran out. Either way the Beast of the
// End always finishes its storm first. Then the results: g.winner (a fighter, or -1 for a tie / no contest),
// g.winTeam (team mode), and g.results in ranking order with everyone's stats
function checkEnd(g) {
  if (g.phase !== 'play' || g.fighters.length < 2) return;
  if (beastOn(g)) return;
  const left = g.fighters.filter(f => !f.out), timed = g.mode === 'time';
  if (timed ? g.timeLeft > 0 : left.length > 1 && !(g.teams && left.every(f => f.team >= 0 && f.team === left[0].team))) return;
  g.phase = 'over'; g.pt = 0; g.winTeam = -1;
  const teamKos = t => g.fighters.reduce((n, f) => n + (f.team === t ? f.kos : 0), 0), teamFalls = t => g.fighters.reduce((n, f) => n + (f.team === t ? f.falls : 0), 0);
  let order;
  if (timed) {
    // most KOs first (for teams, the team's KOs added up), then the fewest falls
    const key = f => (g.teams && f.team >= 0 ? [teamKos(f.team), -teamFalls(f.team), f.kos, -f.falls] : [f.kos, -f.falls, 0, 0]);
    order = g.fighters.slice().sort((a, b) => { const A = key(a), B = key(b); for (let k = 0; k < 4; k++) if (A[k] !== B[k]) return B[k] - A[k]; return b.dealt - a.dealt; });
    const top = order[0], next = order.find(f => !(g.teams && f.team >= 0 && f.team === top.team) && f !== top), kt = key(top), kn = next ? key(next) : null;
    const tie = kn && kt[0] === kn[0] && kt[1] === kn[1] && (g.teams || (kt[2] === kn[2] && kt[3] === kn[3]));
    g.winner = tie ? -1 : top.i;
    if (g.teams && !tie && top.team >= 0) g.winTeam = top.team;
  } else {
    order = g.fighters.slice().sort((a, b) => (b.out ? b.outAt : 1e9) - (a.out ? a.outAt : 1e9));
    if (g.teams && left.length && left[0].team >= 0) {
      g.winTeam = left[0].team; g.winner = left[0].i;
      order = order.filter(f => f.team === g.winTeam).concat(order.filter(f => f.team !== g.winTeam));
    } else g.winner = left.length ? left[0].i : -1;
  }
  g.results = order.map(f => ({ i: f.i, ch: f.ch, nm: f.nm, tag: f.tag, kos: f.kos, falls: f.falls, sds: f.sds || 0, dealt: Math.round(f.dealt), taken: Math.round(f.taken || 0), team: f.team }));
  g.ev.push({ t: 'game', time: timed ? 1 : 0 });
}

// ---------- Combat ----------
function hitArea(g, f, ox, oy, r, d, k, gr, ang, o) {
  o = o || {};
  const cx = f.x + ox * f.fc, cy = f.y + oy, map = o.map || f.hits;
  const fresh = key => map[key] === undefined || (o.every && g.frame - map[key] >= o.every);
  let any = false;
  // which move this is (for stale-move tracking), unless the caller said
  if (o.mv === undefined) o = Object.assign({}, o, { mv: f.st === 'atk' ? 'a:' + f.at : f.st === 'spc' ? 's:' + f.sp : f.st === 'throw' ? 't:' + f.thr : '', use: f.use });
  for (const v of g.fighters) {
    if (v === f || ally(g, f, v) || !hittable(v) || !fresh(v.i)) continue;
    if (!circRect(cx, cy, r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) continue;
    map[v.i] = g.frame;
    // an ice barrier between the attacker and the target takes the blow instead
    const B = g.ice.length ? iceShield(g, f, v) : null;
    if (B) { if (fresh('ice' + B.id)) { map['ice' + B.id] = g.frame; hurtIce(g, B, d * f.pm); } any = true; continue; }
    const dir = o.radial ? (v.x >= cx ? 1 : -1) : f.fc;
    applyHit(g, v, f, d * f.pm, k, gr, ang, dir, o);
    any = true;
  }
  // Emilia Toad's ice: foes' blows chip her pillars and barriers, and break her ice soldiers
  for (const s of g.ice.slice()) {
    if (mineI(g, f.i, s.o) || !fresh('ice' + s.id) || !iceCircle(s, cx, cy, r)) continue;
    if (s.k === 'cradle' && insideCradle(s, f)) continue; // (blows from inside a Cradle don't wear its wall)
    map['ice' + s.id] = g.frame; hurtIce(g, s, d * f.pm); any = true;
  }
  for (const q of g.proj) {
    if (q.k !== 'minion' || q.sub !== 'icesoldier' || mineI(g, f.i, q.o) || q.hp <= 0 || !fresh('m' + q.id)) continue;
    if (!circRect(cx, cy, r, q.x - 15, q.y - 52, 30, 52)) continue;
    map['m' + q.id] = g.frame; hurtSoldier(g, q, o.radial ? (q.x >= cx ? 1 : -1) : f.fc); any = true;
  }
  // things in the world that can be struck: the Smash Mushroom, and Wiggler (who gets angry)
  for (const it of g.items) {
    if (it.k !== 'smash' || !fresh('sb' + it.id) || Math.hypot(it.x - cx, it.y - cy) > r + 26) continue;
    map['sb' + it.id] = g.frame; hitSmash(g, it, f, f.fc); any = true; break;
  }
  const W = g.haz && g.haz.wig;
  if (W && W.on && fresh('wig')) {
    const x0 = W.dir > 0 ? W.x - WIG_LEN : W.x;
    if (cx + r > x0 && cx - r < x0 + WIG_LEN && cy + r > -54 && cy - r < 0) { map.wig = g.frame; hitWiggler(g, W); }
  }
  return any;
}

function applyHit(g, v, a, d, k, gr, ang, dir, o) {
  o = o || {};
  if (v.star > 0 || v.inv > 0 || v.ig > 0 || ally(g, a, v)) return false;
  const S = v.st === 'spc' && SP[v.sp];
  if (!o.fs && S && S.counter && v.ctrT === 0 && v.t >= S.counter[0] && v.t <= S.counter[1] && a) {
    v.ctr = a.i; v.ctrT = 1; v.inv = 24;
    g.ev.push({ t: 'counter', x: v.x, y: v.y - v.h, ch: v.ch });
    return false;
  }
  // front guards (Shield Bash, Frying Pan) stop hits that come from the way the user faces
  if (!o.fs && S && S.guard && v.t >= S.guard[0] && v.t <= S.guard[1] && a && (a.x - v.x) * v.fc > 0) {
    v.vx = -v.fc * 2; g.ev.push({ t: 'block', x: v.x + v.fc * 20, y: v.y - v.h / 2 });
    return false;
  }
  if (!o.fs && v.st === 'shield') {
    // parry: guard pressed in the six frames before the hit
    if (g.frame - v.parryAt <= 6) {
      v.prT = 16; v.inv = Math.max(v.inv, 12); v.hl = 6; v.parryCd = 0; v.parryAt = -99;
      if (a && !o.proj) { a.st = 'stun'; a.t = 34; a.at = null; a.sp = null; a.vx = -dir * 4; a.hl = 8; a.chgMul = 1; }
      g.ev.push({ t: 'parry', x: v.x, y: v.y - v.h / 2 });
      return false;
    }
    v.shd -= d * 1.5 + 2;
    v.vx = dir * Math.min(9, 2 + d * 0.35);
    v.hl = Math.floor(3 + d * 0.2);
    g.ev.push({ t: 'block', x: v.x, y: v.y - v.h / 2 });
    if (v.shd <= 0) {
      v.shd = 30; v.st = 'stun'; v.t = 160; v.vy = -10; v.gi = -1;
      g.ev.push({ t: 'break', x: v.x, y: v.y - v.h });
    }
    return false;
  }
  // stale moves: spamming one move makes it weaker. The last nine moves that landed are remembered; a move already
  // among them loses 1-9% per copy (newer copies count more), and a fresh move gets a small bonus
  if (a && o.mv && !o.fs) {
    if (a.useHit !== o.use) { a.useSm = staleMul(a, o.mv); a.stq.unshift(o.mv); if (a.stq.length > 9) a.stq.length = 9; a.useHit = o.use; }
    d *= a.useSm; k *= 0.7 + 0.3 * a.useSm;
  }
  // a GOD-level CPU is a little tougher (20% less damage, 15% less knockback) and hits 15% harder
  if (v.ctrl === 'cpu' && v.lvl === 10) { d *= 0.8; k *= 0.85; }
  if (a && a.ctrl === 'cpu' && a.lvl === 10) d *= 1.15;
  // Water Yoshi's statuses: a Scalded attacker hits 20% softer (damage and knockback); a Sunk victim takes 10% more
  if (a && a.scald > 0) { d *= 0.8; k *= 0.8; }
  if (v.sunk > 0) d *= 1.1;
  // chip damage (Emilia Toad's ice pellets): damage only. No flinch, no knockback, nothing interrupted
  if (o.chip) {
    d *= v.big ? 0.65 : v.small ? 1.4 : 1;
    v.dm = Math.min(999, v.dm + d);
    if (a) { a.dealt += d; v.lastHit = a.i; v.lastHitT = g.frame; }
    v.taken = (v.taken || 0) + d; g.ev.push({ t: 'chip', x: v.x, y: v.y - v.h * 0.55, v: v.i });
    return true;
  }
  // a fighter caught in a grab is dropped when either of the two gets hit by someone else
  if (v.st === 'hold' || v.st === 'throw') releaseHeld(g, v, 0);
  if (v.gby >= 0) v.gby = -1;
  // Super Mushroom: tougher; Mini Mushroom: fragile
  d *= v.big ? 0.65 : v.small ? 1.4 : 1;
  v.dm = Math.min(999, v.dm + d);
  if (a) { a.dealt += d; v.lastHit = a.i; v.lastHitT = g.frame; }
  v.taken = (v.taken || 0) + d; if (o.psn) v.psn = 210; // (damage taken, for the scoreboard)
  // Emilia Toad's ice weapons chill: slower on the move for a while
  if (o.slow) v.slow = Math.max(v.slow || 0, o.slow);
  const wt = CH[v.ch].weight * (v.big ? 1.5 : 1) * (v.small ? 0.55 : 1) * (v.st === 'crouch' ? 1.18 : 1);
  // knockback starts really weak and grows faster and faster with damage: the base part ramps from 20% (at 0%) up to
  // full strength (at 100%), and the damage part curves upward (about half strength at 15%, the same as before at
  // 100%, stronger beyond). Finales always hit at full strength.
  // (`fixed` knockback, the Unseen Hand's slam throw, is the same at any damage)
  const ramp = o.fs || o.fixed ? 1 : 0.2 + 0.8 * Math.min(1, v.dm / 100);
  const eff = o.fixed ? 0 : o.fs ? v.dm : v.dm * Math.pow(Math.max(v.dm, 1) / 100, 0.35);
  const K = (k * ramp + eff * gr * (0.55 + d / 14)) / wt;
  const lag = Math.floor(3 + d * 0.33);
  if (a && !o.proj) a.hl = Math.max(a.hl, lag);
  g.ev.push({ t: 'hit', x: v.x, y: v.y - v.h * 0.55, p: Math.round(K), c: a ? a.i : -1, el: a && !o.proj ? CH[a.ch].elem : undefined, v: v.i, vch: v.ch });
  if (v.tn) v.tn = 0;
  // super armor: Pickaxe Frenzy and armored charges shrug off lighter hits
  if ((v.pick > 0 && K < 26) || (S && S.armor && K < 40)) { v.hl = lag; return true; }
  if (o.daze) {
    v.st = 'stun'; v.t = o.daze; v.vx = 0; v.vy = Math.min(v.vy, 0); v.at = null; v.sp = null; v.hl = lag; v.glide = 0;
    return true;
  }
  const rad = (ang * Math.PI) / 180;
  v.vx = Math.cos(rad) * K * dir;
  v.vy = -Math.sin(rad) * K;
  if (v.gi >= 0 && v.vy > 0) v.vy = -v.vy * 0.6;
  if (v.vy < 0) v.gi = -1;
  v.hs = Math.floor(K * 1.7 + 6 + (o.stun || 0));
  v.st = 'hit'; v.at = null; v.sp = null; v.glide = 0; v.ff = false; v.hl = lag; v.chgMul = 1; v.hide = 0;
  if (o.frz) v.frz = 45;
  // getting hit gives back every jump and recovery move, so a launch off the stage isn't the end
  v.upUsed = false; v.sUsed = false; v.adUsed = false; v.uaUsed = false; v.wj = 0;
  v.jl = airJumps(v);
  return true;
}

const STALE = [0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01];
function staleMul(a, mv) {
  let m = 1, seen = false;
  a.stq.forEach((x, n) => { if (x === mv) { m -= STALE[n]; seen = true; } });
  return seen ? m : 1.05;
}

function reflect(g, f, x, y, rad) {
  for (const p of g.proj) {
    if (mineI(g, f.i, p.o) || p.k === 'minion' || p.k === 'trap' || p.k === 'fsdrop' || (p.k === 'icespear' && p.vic >= 0)) continue;
    if (Math.hypot(p.x - x, p.y - y) < rad) {
      p.o = f.i; p.vx = -p.vx * 1.1; p.vy = -Math.abs(p.vy) - 2; p.hits = {}; p.t = Math.min(p.t, 10);
      if (p.k === 'boom') p.dir0 = -p.dir0;
      g.ev.push({ t: 'reflect', x: p.x, y: p.y });
    }
  }
}

// radial blast from a point (explosions, traps, pulses); `o` is the owner's slot
function blastAt(g, x, y, owner, r, d, k, gr, ang, extra) {
  const a = fighterBy(g, owner);
  for (const v of g.fighters) {
    if (v.i === owner || !hittable(v)) continue;
    if (circRect(x, y, r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) applyHit(g, v, a, d, k, gr, ang, v.x >= x ? 1 : -1, Object.assign({ proj: true }, extra));
  }
  // blasts crack Emilia Toad's ice and break her soldiers too
  for (const s of g.ice.slice()) if (s.k !== 'cradle' && !mineI(g, owner, s.o) && iceCircle(s, x, y, r)) hurtIce(g, s, d);
  for (const q of g.proj) if (q.k === 'minion' && q.sub === 'icesoldier' && !mineI(g, owner, q.o) && q.hp > 0 && circRect(x, y, r, q.x - 15, q.y - 52, 30, 52)) hurtSoldier(g, q, q.x >= x ? 1 : -1);
}

// (`quiet`: no firing sound of its own, for shots fired in a bunch)
function spawnProj(g, f, o) {
  o.o = f.i; o.t = 0; o.pm = f.pm || 1; o.d *= o.pm; o.hits = {}; o.id = g.pid++;
  if (o.fc === undefined) o.fc = f.fc;
  g.proj.push(o);
  if (!o.quiet) g.ev.push({ t: 'shoot', k: o.k, x: o.x, y: o.y, sub: o.sub });
  return o;
}

function landPoint(g, o, py) {
  for (const s of g.surf) {
    if (o.x < s.x || o.x > s.x + s.w) continue;
    if (o.vy >= 0 && py <= s.y + Math.abs(s.dy) + 1 && o.y >= s.y) { o.y = s.y; return s; }
    if (s.solid && o.y > s.y + 1 && o.y < s.y + s.h) return 'wall';
  }
  return null;
}

function nearestFoe(g, owner, x, y) {
  let best = null, bd = 1e9;
  for (const v of g.fighters) {
    if (v.i === owner || !alive(v)) continue;
    const d = Math.hypot(v.x - x, v.y - v.h / 2 - y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function updateProj(g) {
  // (shots only need checking against Emilia Toad's ice and soldiers when there are some)
  const iceOut = g.ice.length > 0 || g.proj.some(q => q.sub === 'icesoldier');
  for (let n = g.proj.length - 1; n >= 0; n--) {
    const p = g.proj[n];
    if (!p) continue;
    p.t++;
    // a fused projectile (Lantern Light) bursts when its time runs out too
    let kill = p.t > p.life, boom = kill && !!p.fuse;
    if (p.k === 'minion') {
      if (updMinion(g, p)) kill = true;
    } else if (p.k === 'trap') {
      if (updTrap(g, p)) kill = true;
    } else if (p.k === 'icespear') {
      if (updSpear(g, p, iceOut)) kill = true;
    } else {
      if (p.k === 'boom') {
        p.vx -= 0.34 * p.dir0; p.x += p.vx; p.y += p.vy;
        const own = fighterBy(g, p.o);
        if (p.t > 25 && own && Math.abs(own.x - p.x) < 30 && Math.abs(own.y - own.h / 2 - p.y) < 50) kill = true;
        const sg = Math.sign(p.vx);
        if (sg !== p.lastSign) { p.hits = {}; p.lastSign = sg; }
      } else {
        if (p.k === 'icepel') steerIcePel(g, p);
        else if (p.home) {
          // homing (Star Bolt, Boo Buddy): steer toward the nearest foe
          const tg = nearestFoe(g, p.o, p.x, p.y);
          if (tg) {
            const ax = tg.x - p.x, ay = tg.y - tg.h / 2 - p.y, L = Math.hypot(ax, ay) || 1, mx = p.vmax || 8;
            p.vx += (ax / L) * p.home; p.vy += (ay / L) * p.home;
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > mx) { p.vx *= mx / sp; p.vy *= mx / sp; }
          }
        }
        p.vy += p.grav;
        const py = p.y;
        p.x += p.vx; p.y += p.vy;
        if (p.grow) p.r += p.grow;
        if (!p.ghost) {
          const s = landPoint(g, p, py);
          if (s === 'wall') {
            if (p.k === 'psn') { p.vx = -p.vx; p.x += p.vx * 2; } else { kill = true; boom = true; }
          } else if (s) {
            if (p.bounce && (p.bounces === undefined || p.bounces-- > 0)) p.vy = -p.bounce;
            else if (p.k === 'psn') p.vy = 0;
            else {
              kill = true; boom = true;
              // El Minya's crystals chip away at the platforms they land on
              if (p.k === 'fsdrop' && p.sub === 'crystal' && s.pi !== undefined) damagePlat(g, s.pi);
              // Water Yoshi's spout leaves a slippery puddle where it splashes down (for 3 seconds)
              if (p.k === 'wspout') {
                const own = fighterBy(g, p.o);
                if (own) spawnProj(g, own, { k: 'trap', sub: 'wpuddle', x: p.x, y: s.y, vx: 0, vy: 0, d: 0, kb: 0, gr: 0, ang: 0, r: WATER.puddle.r, life: WATER.puddle.life, landed: 1, in: {}, quiet: 1 });
                g.ev.push({ t: 'splash', x: p.x, y: s.y });
              }
              // Nolan Toad's rotten leftover goes splat and leaves a stink cloud where it lands (4 seconds)
              if (p.k === 'rot') { const own = fighterBy(g, p.o); if (own) spawnStink(g, own, p.x, s.y, 0); }
            }
          }
        }
      }
      // Emilia Toad's ice pillars, barriers and soldiers soak up foes' shots
      const iced = !kill && iceOut && shotVsIce(g, p);
      if (iced) { kill = true; boom = true; }
      for (const v of g.fighters) {
        if (iced) break;
        if (mineI(g, p.o, v.i) || !hittable(v)) continue;
        if (p.hits[v.i] !== undefined && (!p.every || g.frame - p.hits[v.i] < p.every)) continue;
        if (circRect(p.x, p.y, p.r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) {
          p.hits[v.i] = g.frame;
          // (chip shots, Emilia's ice pellets, only add damage and don't count toward stale moves)
          applyHit(g, v, fighterBy(g, p.o), p.d, p.kb, p.gr, p.ang, p.vx >= 0 ? 1 : -1, { proj: true, frz: p.frz, psn: p.psn, daze: p.daze, chip: p.chip, mv: p.chip ? '' : 'p:' + p.k, use: 'p' + p.id });
          if (p.k !== 'boom' && !p.pierce) { kill = true; boom = true; break; }
        }
      }
      // projectiles can pop the Smash Mushroom too
      if (!kill) for (const it of g.items) {
        if (it.k !== 'smash' || p.hits['sb' + it.id] || Math.hypot(it.x - p.x, it.y - p.y) > p.r + 24) continue;
        p.hits['sb' + it.id] = 1;
        const own = fighterBy(g, p.o);
        if (own) hitSmash(g, it, own, p.vx >= 0 ? 1 : -1);
        if (!p.pierce) { kill = true; boom = true; }
        break;
      }
    }
    if (p.x < BLAST.l || p.x > BLAST.r || p.y > BLAST.b) { kill = true; boom = false; }
    if (kill) {
      // (a finale's raining drop bursts in its own colours: El Minya's crystals in pink and lavender, melons, lanterns, fire)
      if (boom && p.explode) { const E = p.explode; g.ev.push({ t: 'boom', x: p.x, y: p.y, s: E.r / 55, k: p.k === 'fsdrop' ? p.sub : p.k }); blastAt(g, p.x, p.y, p.o, E.r, E.d * p.pm, E.k, E.g, 55); }
      else if (boom && (p.k === 'bomb' || p.k === 'egg')) explode(g, p);
      // the Shirt at full mold bursts into a stink you can smell from 10 feet away, wherever it ends up
      else if (boom && p.k === 'shirt' && p.burst) { const own = fighterBy(g, p.o); if (own) spawnStink(g, own, p.x, p.y, 1); }
      else if (boom) g.ev.push({ t: 'pop', x: p.x, y: p.y, k: p.k });
      const idx = g.proj.indexOf(p);
      if (idx >= 0) g.proj.splice(idx, 1);
    }
  }
}

// a platform takes a hit: it crystallizes a little more, and on the third hit it shatters (anyone on it falls)
// for fifteen seconds. The view grows pink crystals on it hit by hit (php) and bursts it into shards
const PLAT_HP = 3, PLAT_DOWN = 900;
function damagePlat(g, pi) {
  if (g.brk[pi] > g.frame) return;
  const idx = STG[g.stage].solids.length + pi, S = g.surf[idx];
  g.php[pi] = (g.php[pi] || 0) + 1;
  if (g.php[pi] < PLAT_HP) { g.ev.push({ t: 'platcrack', x: S.x + S.w / 2, y: S.y, n: g.php[pi], pi }); return; }
  g.php[pi] = 0; g.brk[pi] = g.frame + PLAT_DOWN;
  for (const f of g.fighters) if (f.gi === idx) { f.gi = -1; if (f.st === 'idle' || f.st === 'run' || f.st === 'crouch' || f.st === 'shield') f.st = 'air'; }
  g.ev.push({ t: 'platbreak', x: S.x + S.w / 2, y: S.y, w: S.w, pi });
}
function explode(g, p) {
  const big = p.k === 'bomb', r = big ? 85 : 55;
  g.ev.push({ t: 'boom', x: p.x, y: p.y, s: big ? 1.6 : 1 });
  const a = fighterBy(g, p.o);
  for (const v of g.fighters) {
    if (v.st === 'dead' || v.out || v.rp > 0) continue;
    if (!big && v.i === p.o) continue;
    if (circRect(p.x, p.y, r, v.x - v.w / 2, v.y - v.h, v.w, v.h))
      applyHit(g, v, a, (big ? 16 : 7) * p.pm, big ? 8 : 5, big ? 0.14 : 0.08, 55, v.x >= p.x ? 1 : -1, { proj: true });
  }
}

// traps sit where they land: Hot Soup trips, a Magic Rune launches, the amp pulses
function updTrap(g, p) {
  if (!p.landed) {
    p.vy += 0.6;
    const py = p.y;
    p.y += p.vy;
    const s = landPoint(g, p, py);
    if (s && s !== 'wall') { p.landed = 1; p.vy = 0; }
  }
  if (p.sub === 'amp') {
    if (p.t === 20 || p.t === 50 || p.t === 80) { blastAt(g, p.x, p.y - 24, p.o, 110, 5 * p.pm, 7, 0.07, 55); g.ev.push({ t: 'amp', x: p.x, y: p.y - 24 }); }
    return false;
  }
  // Nolan Toad's mattress and bed are just for show (his moves do the work)
  if (p.sub === 'mattress' || p.sub === 'bed') return false;
  // ... and his stink: a cloud of rotten smell round (x, cy). Foes inside get worn down (1% every `every` frames, no
  // flinching) and move slower while they're in it
  if (p.sub === 'stink') {
    const own = fighterBy(g, p.o);
    for (const v of g.fighters) {
      if (mineI(g, p.o, v.i) || !alive(v) || v.rp > 0) continue;
      if (Math.hypot(v.x - p.x, v.y - v.h / 2 - p.cy) > p.r + v.w / 2) continue;
      v.stink = 2;
      if (p.hits[v.i] === undefined || g.frame - p.hits[v.i] >= p.every) { p.hits[v.i] = g.frame; applyHit(g, v, own, p.d, 0, 0, 0, 1, { proj: true, chip: true }); }
    }
    return false;
  }
  // Water Yoshi's puddle: slippery underfoot for everyone; a foe who steps in has a 1 in 100 chance to slip and fall
  // flat on their face (40% and 6 seconds stunned)
  if (p.sub === 'wpuddle') {
    const P = WATER.puddle;
    for (const v of g.fighters) {
      const inside = alive(v) && v.gi >= 0 && Math.abs(v.x - p.x) < p.r && Math.abs(v.y - p.y) < 6;
      if (inside) v.slick = 2;
      if (inside && !p.in[v.i] && !mineI(g, p.o, v.i) && hittable(v) && v.st !== 'stun' && RND() < P.slip) {
        applyHit(g, v, fighterBy(g, p.o), P.slipD, 0, 0, 0, 1, { proj: true, chip: true });
        v.st = 'stun'; v.t = P.slipStun; v.flat = P.slipStun; v.vx = 0; v.at = null; v.sp = null;
        g.ev.push({ t: 'slip', x: v.x, y: v.y - 30 });
      }
      p.in[v.i] = inside ? 1 : 0;
    }
    return false;
  }
  // ... and his whirlpool: it drags foes who touch it toward the middle and wears them down (no flinching)
  if (p.sub === 'whirl') {
    const Wh = WATER.whirl, own = fighterBy(g, p.o);
    for (const v of g.fighters) {
      if (mineI(g, p.o, v.i) || !alive(v) || v.rp > 0 || Math.abs(v.x - p.x) > p.r + v.w / 2 || v.y < p.y - 30 || v.y > p.y + 8 || v.st === 'ledge') continue;
      const dx = p.x - v.x;
      v.x += Math.sign(dx) * Math.min(Math.abs(dx), Wh.pull);
      if (p.hits[v.i] === undefined || g.frame - p.hits[v.i] >= Wh.every) { p.hits[v.i] = g.frame; applyHit(g, v, own, p.d, 0, 0, 0, 1, { proj: true, chip: true }); }
    }
    return false;
  }
  // Catholic Toad's piñata: the first foe to bump into it bursts it open, and candy flies everywhere
  if (p.sub === 'pinata') {
    for (const v of g.fighters) {
      if (mineI(g, p.o, v.i) || !hittable(v) || !circRect(p.x, p.y, p.r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) continue;
      applyHit(g, v, fighterBy(g, p.o), 9 * p.pm, 9, 0.12, 80, v.x >= p.x ? 1 : -1, { proj: true });
      g.ev.push({ t: 'candy', x: p.x, y: p.y });
      return true;
    }
    return false;
  }
  for (const v of g.fighters) {
    if (mineI(g, p.o, v.i) || !hittable(v)) continue;
    if (Math.abs(v.x - p.x) > p.r + v.w / 2 || v.y < p.y - 30 || v.y > p.y + 8) continue;
    const own = fighterBy(g, p.o);
    if (p.sub === 'rune') {
      applyHit(g, v, own, 14 * p.pm, 11, 0.14, 85, v.x >= p.x ? 1 : -1, { proj: true });
      g.ev.push({ t: 'rune', x: p.x, y: p.y });
      return true;
    }
    if ((p.sub === 'soup' || p.sub === 'casserole') && (p.hits[v.i] === undefined || g.frame - p.hits[v.i] > 50)) {
      p.hits[v.i] = g.frame;
      applyHit(g, v, own, 3 * p.pm, 2, 0.01, 70, v.x >= p.x ? 1 : -1, { proj: true, daze: 30 });
      g.ev.push({ t: 'soup', x: v.x, y: v.y });
    }
    // Gladiator Toad's net tangles the first foe to step in
    if (p.sub === 'net') {
      applyHit(g, v, own, 4 * p.pm, 1, 0, 60, v.x >= p.x ? 1 : -1, { proj: true, daze: 70 });
      g.ev.push({ t: 'netcatch', x: v.x, y: v.y - 24 });
      return true;
    }
    // Dash Yoshi's burning skid marks
    if (p.sub === 'flames' && (p.hits[v.i] === undefined || g.frame - p.hits[v.i] > 30)) {
      p.hits[v.i] = g.frame;
      applyHit(g, v, own, 3 * p.pm, 4, 0.03, 80, v.x >= p.x ? 1 : -1, { proj: true });
      g.ev.push({ t: 'flame', x: v.x, y: v.y - 20 });
    }
    // Light Blue Yoshi's frost patch freezes whoever steps on it, then melts
    if (p.sub === 'frost') {
      applyHit(g, v, own, 6 * p.pm, 4, 0.04, 70, v.x >= p.x ? 1 : -1, { proj: true, frz: true });
      g.ev.push({ t: 'shatter', x: p.x, y: p.y - 10 });
      return true;
    }
    // Purple Yoshi's toxic puddle poisons anyone wading through
    if (p.sub === 'toxic' && (p.hits[v.i] === undefined || g.frame - p.hits[v.i] > 45)) {
      p.hits[v.i] = g.frame;
      applyHit(g, v, own, 3 * p.pm, 3, 0.02, 75, v.x >= p.x ? 1 : -1, { proj: true, psn: true });
      g.ev.push({ t: 'pop', x: v.x, y: v.y - 10, k: 'psn' });
    }
  }
  return false;
}

function minionTouch(g, p, d, kb, gr, ang, every) {
  for (const v of g.fighters) {
    if (mineI(g, p.o, v.i) || !hittable(v)) continue;
    const last = p.hits[v.i];
    if (last !== undefined && (!every || g.frame - last < every)) continue;
    if (circRect(p.x, p.y - 22, 24, v.x - v.w / 2, v.y - v.h, v.w, v.h)) {
      p.hits[v.i] = g.frame;
      applyHit(g, v, fighterBy(g, p.o), d * p.pm, kb, gr, ang, p.sub === 'mail' ? p.fc : v.x >= p.x ? 1 : -1, { proj: true });
    }
  }
}

function updMinion(g, p) {
  if (p.sub === 'icesoldier') return updSoldier(g, p);
  p.vy += 0.6;
  const py = p.y;
  p.y += p.vy; p.x += p.vx;
  const s = landPoint(g, p, py);
  if (s === 'wall') { p.vx = -p.vx; p.fc = -p.fc; p.x += p.vx * 2; }
  else if (s) p.vy = 0;
  if (p.sub === 'mail') {
    p.vx = p.fc * 6;
    minionTouch(g, p, 8, 6, 0.1, 45, 0);
  } else if (p.sub === 'bank') {
    p.vx = 0;
    if (p.t % 28 === 14) {
      let tg = null, bd = 1e9;
      for (const v of g.fighters) if (v.i !== p.o && alive(v)) { const dd = Math.abs(v.x - p.x); if (dd < bd) { bd = dd; tg = v; } }
      if (tg) p.fc = tg.x >= p.x ? 1 : -1;
      const own = fighterBy(g, p.o) || { i: p.o, pm: p.pm, fc: p.fc };
      const coin = spawnProj(g, own, { k: 'coin', x: p.x, y: p.y - 34, vx: p.fc * 7.5, vy: -7, d: 3, kb: 3, gr: 0.03, ang: 50, r: 10, grav: 0.4, life: 120, fc: p.fc });
      coin.d = 3 * p.pm;
      g.ev.push({ t: 'coin', x: p.x, y: p.y - 30 });
    }
  } else if (p.sub === 'hint') {
    p.vx = 0;
    for (const q of g.proj) {
      if (q === p || mineI(g, p.o, q.o) || q.k === 'minion' || q.k === 'trap') continue;
      if (Math.abs(q.x - p.x) < 28 && q.y > p.y - 70 && q.y < p.y + 4) { q.t = q.life + 1; g.ev.push({ t: 'reflect', x: q.x, y: q.y }); }
    }
    minionTouch(g, p, 2, 8, 0.02, 35, 40);
  }
  return p.y > BLAST.b;
}

// ---------- Items ----------
function updateItems(g) {
  for (let n = g.items.length - 1; n >= 0; n--) {
    const it = g.items[n];
    if (!it) continue;
    it.t++;
    if (it.k === 'smash') {
      // the Smash Mushroom drifts around the arena until someone breaks it open
      const s = STG[g.stage].solids[0];
      it.x += it.vx; it.y += it.vy + Math.sin(it.t * 0.06) * 0.6;
      it.vx *= 0.99; it.vy *= 0.99;
      if (it.t % 80 === 0) { it.vx += (RND() - 0.5) * 2.4; it.vy += (RND() - 0.5) * 1.6; }
      if (it.x < s.x - 40) it.vx = Math.abs(it.vx) + 0.3;
      if (it.x > s.x + s.w + 40) it.vx = -Math.abs(it.vx) - 0.3;
      if (it.y < -430) it.vy = Math.abs(it.vy) + 0.2;
      if (it.y > -80) it.vy = -Math.abs(it.vy) - 0.2;
      if (it.t > it.life) { g.items.splice(n, 1); g.sbT = smashGap(g.itemsOn, 'gone'); g.ev.push({ t: 'sbgone', x: it.x, y: it.y }); }
      continue;
    }
    it.vy = Math.min((it.vy || 0) + 0.5, 10);
    const py = it.y;
    it.y += it.vy; it.x += it.vx || 0;
    const s = landPoint(g, it, py);
    if (s === 'wall') it.vx = -(it.vx || 0);
    else if (s) { it.vy = 0; it.vx = 0; }
    if (it.y > BLAST.b || it.t > it.life) { g.items.splice(n, 1); continue; }
    for (const f of g.fighters) {
      if (f.st === 'dead' || f.out || f.rp > 0) continue;
      if (Math.abs(f.x - it.x) < f.w / 2 + 16 && it.y > f.y - f.h - 10 && it.y < f.y + 14) {
        if (it.k === 'turnip' && f.hold) continue;
        grabItem(g, f, it);
        g.items.splice(n, 1);
        break;
      }
    }
  }
}

function hitSmash(g, it, a, dir) {
  if (!a || it.k !== 'smash') return;
  it.hp--; it.vx = dir * 4; it.vy = -2.5;
  g.ev.push({ t: 'sbhit', x: it.x, y: it.y });
  if (it.hp > 0) return;
  a.fs = 1;
  const idx = g.items.indexOf(it);
  if (idx >= 0) g.items.splice(idx, 1);
  g.sbT = smashGap(g.itemsOn, 'used');
  g.ev.push({ t: 'fsready', i: a.i, ch: a.ch, x: it.x, y: it.y });
}

function grabItem(g, f, it) {
  const e = { t: 'item', k: it.k, x: f.x, y: f.y - f.h - 10, s: ITEMS[it.k] ? ITEMS[it.k].name : '' };
  switch (it.k) {
    case 'mush': f.big = 720; f.small = 0; break;
    case 'mini': f.small = 600; f.big = 0; break;
    case 'poison': f.small = 420; f.big = 0; f.dm += 12; break;
    case 'oneup': f.sk = Math.min(f.sk + 1, 9); break;
    case 'gold': f.dm = Math.max(0, f.dm - 35); break;
    case 'star': f.star = 480; break;
    case 'turnip': f.hold = 'turnip'; e.s = it.sprout ? 'Plucked!' : ''; break;
    case 'chest':
      e.s = 'Treasure!';
      for (let q = 0; q < 2; q++) g.items.push({ k: randItem(true), x: it.x, y: it.y - 20, vx: (q ? 3 : -3) + RND() - 0.5, vy: -10, t: 0, life: 900, id: g.pid++ });
      break;
  }
  g.ev.push(e);
}

function randItem(noTurnip) {
  const keys = Object.keys(ITEMS).filter(k => !(noTurnip && k === 'turnip'));
  let tot = 0;
  for (const k of keys) tot += ITEMS[k].w;
  let r = RND() * tot;
  for (const k of keys) { r -= ITEMS[k].w; if (r <= 0) return k; }
  return keys[0];
}

function spawnItems(g) {
  if (!g.itemsOn) return;
  const s = STG[g.stage].solids[0];
  if (g.itemsOn === true && --g.nextItem <= 0) {
    g.nextItem = 480 + RND() * 480;
    g.items.push({ k: randItem(false), x: s.x + 40 + RND() * (s.w - 80), y: -700, vy: 0, t: 0, life: 900, id: g.pid++ });
  }
  // a Smash Mushroom now and then, never while someone is holding its power
  if (--g.sbT <= 0) {
    if (g.items.some(it => it.k === 'smash') || g.fighters.some(f => f.fs || f.fsLock)) { g.sbT = 300; return; }
    g.sbT = 99999;
    g.items.push({ k: 'smash', x: s.x + 80 + RND() * (s.w - 160), y: -380, vx: (RND() < 0.5 ? -1 : 1) * 1.6, vy: 0.6, t: 0, life: 1500, hp: 3, id: g.pid++ });
    g.ev.push({ t: 'sbspawn', x: 0, y: -360 });
  }
}

// ---------- Stage hazards ----------
function hazards(g) {
  if (!g.hazOn) return;
  const st = STG[g.stage], Hz = g.haz;
  for (const hz of st.haz) {
    if (hz === 'kart') updKart(g, Hz);
    else if (hz === 'chest') {
      if (g.itemsOn !== true) continue; // chests and sprouts are items, so they follow the Items setting
      if (--Hz.chestT <= 0) {
        Hz.chestT = 1100 + RND() * 700;
        g.items.push({ k: 'chest', x: -300 + RND() * 600, y: -650, vy: 0, t: 0, life: 1500, id: g.pid++ });
        g.ev.push({ t: 'say', x: 0, y: -330, s: 'A Toad House chest!' });
      }
    } else if (hz === 'sprouts') {
      if (g.itemsOn !== true) continue;
      if (--Hz.sproutT <= 0) {
        Hz.sproutT = 360 + RND() * 360;
        const s = st.solids[0];
        g.items.push({ k: 'turnip', sprout: 1, x: s.x + 40 + RND() * (s.w - 80), y: s.y, vy: 0, t: 0, life: 1200, id: g.pid++ });
      }
    } else if (hz === 'wiggler') updWiggler(g, Hz.wig);
    else if (hz === 'spikes') updSpikes(g, Hz, st);
    else if (hz === 'boost') updBoost(g, st);
    else if (hz === 'wind') updWind(g, Hz.wind);
    else if (hz === 'rock') updRock(g, Hz.rock, st);
    else if (hz === 'dark') updDark(g, Hz.dark);
    else if (hz === 'lava') updLava(g, Hz.lava, st);
    else if (hz === 'icicles') updIcicles(g, Hz.icicle, st);
    else if (hz === 'conveyor') updConveyor(g, Hz.conv, st);
    else if (hz === 'pendulum') updPendulum(g, Hz.pend);
    else if (hz === 'tide') updTide(g, Hz.tide);
    else if (hz === 'lowgrav') updLowGrav(g, Hz.grav);
    else if (hz === 'stars') updStars(g, Hz.star, st);
  }
}

// Yoshi's Island: a giant boulder comes rolling across the island (a warning first); jump over it!
function updRock(g, R, st) {
  const s = st.solids[0];
  if (!R.on) {
    if (--R.t === 120) { R.dir = RND() < 0.5 ? 1 : -1; R.warn = 120; g.ev.push({ t: 'say', x: 0, y: -340, s: R.dir > 0 ? 'Boulder! >>>' : '<<< Boulder!', snd: 'wind' }); }
    if (R.warn > 0) R.warn--;
    if (R.t <= 0) { R.on = true; R.x = R.dir > 0 ? s.x - 120 : s.x + s.w + 120; R.hits = {}; }
    return;
  }
  R.x += R.dir * 9;
  for (const f of g.fighters) {
    if (!hittable(f) || R.hits[f.i]) continue;
    if (Math.abs(f.x - R.x) < 66 && f.y > s.y - 118 && f.y <= s.y + 6) {
      R.hits[f.i] = 1;
      applyHit(g, f, null, 14, 9, 0.12, 50, R.dir, { proj: true });
      g.ev.push({ t: 'boom', x: f.x, y: f.y - 30, s: 0.6, k: 'quake' });
    }
  }
  if ((R.dir > 0 && R.x > s.x + s.w + 160) || (R.dir < 0 && R.x < s.x - 160)) { R.on = false; R.t = 1100 + RND() * 600; }
}

// Boo Mansion: the lights flicker, then go out for six seconds while Boos swoop across in the dark
function updDark(g, D) {
  if (--D.t <= 0) {
    if (D.ph === 'idle') { D.ph = 'warn'; D.t = 90; g.ev.push({ t: 'say', x: 0, y: -340, s: 'The lights are flickering...', snd: 'boo' }); }
    else if (D.ph === 'warn') { D.ph = 'dark'; D.t = 360; D.t0 = g.frame; }
    else { D.ph = 'idle'; D.t = 1000 + RND() * 500; }
  }
  if (D.ph !== 'dark') return;
  for (const b of booPath(g.frame - D.t0)) {
    for (const f of g.fighters) {
      if (!hittable(f) || Math.hypot(f.x - b.x, f.y - f.h / 2 - b.y) > 36) continue;
      if (D.hits[f.i] && g.frame - D.hits[f.i] < 50) continue;
      D.hits[f.i] = g.frame;
      applyHit(g, f, null, 7, 6, 0.06, 60, b.vx >= 0 ? 1 : -1, { proj: true });
    }
  }
}
// where the three Boos are at frame t of the darkness (it depends only on t, so online guests see them in the same spots)
function booPath(t) {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const dir = k % 2 ? -1 : 1, u = t - k * 70;
    if (u < 0 || u > 300) continue;
    out.push({ x: dir * (-700 + u * 4.6), y: -60 - k * 90 + Math.sin(u * 0.05) * 50, vx: dir * 4.6 });
  }
  return out;
}

// Bowser's Castle: the lava below rises over the floor for four seconds (with a warning), then sinks back down
function updLava(g, L, st) {
  const top = st.solids[0].y - 34;
  if (--L.t <= 0) {
    if (L.ph === 'idle') { L.ph = 'warn'; L.t = 120; g.ev.push({ t: 'say', x: 0, y: -340, s: 'The lava is rising! Get up high!', snd: 'angry' }); }
    else if (L.ph === 'warn') { L.ph = 'rise'; L.t = 60; }
    else if (L.ph === 'rise') { L.ph = 'up'; L.t = 240; }
    else if (L.ph === 'up') { L.ph = 'fall'; L.t = 90; }
    else { L.ph = 'idle'; L.t = 1200 + RND() * 600; }
  }
  const k = L.ph === 'rise' ? 1 - L.t / 60 : L.ph === 'up' ? 1 : L.ph === 'fall' ? L.t / 90 : 0;
  L.lv = LAVA_LOW + (top - LAVA_LOW) * k;
  if (L.ph === 'idle' || L.ph === 'warn') return;
  for (const f of g.fighters) {
    if (!hittable(f) || f.y < L.lv) continue;
    if (L.hits[f.i] && g.frame - L.hits[f.i] < 45) continue;
    L.hits[f.i] = g.frame;
    applyHit(g, f, null, 10, 10, 0.08, 88, f.x >= 0 ? 1 : -1, { proj: true });
    g.ev.push({ t: 'flame', x: f.x, y: f.y - 10 });
  }
}

function updKart(g, Hz) {
  if (!g.kart) {
    if (--Hz.kartT <= 0) {
      const dir = RND() < 0.5 ? 1 : -1;
      g.kart = { dir, x: dir > 0 ? -1350 : 1350, warn: 120, hits: {}, c: Math.floor(RND() * 4) };
      g.ev.push({ t: 'horn' });
    }
    return;
  }
  const k = g.kart;
  if (k.warn > 0) { k.warn--; if (k.warn === 50) g.ev.push({ t: 'horn' }); return; }
  k.x += k.dir * 24;
  for (const f of g.fighters) {
    if (!hittable(f) || k.hits[f.i]) continue;
    if (Math.abs(f.x - k.x) < 60 && f.y > -55 && f.y <= 4) {
      k.hits[f.i] = 1;
      applyHit(g, f, null, 16, 9, 0.13, 42, k.dir, {});
      g.ev.push({ t: 'say', x: f.x, y: f.y - f.h - 20, s: 'Beep beep!' });
    }
  }
  if (Math.abs(k.x) > 1450) { g.kart = null; Hz.kartT = 480 + RND() * 420; }
}

// Wiggler strolls across Toad Town; touching him hurts, and three hits make him angry (faster, harder)
function updWiggler(g, W) {
  const s = STG[g.stage].solids[0];
  if (!W.on) {
    W.next--;
    if (W.next === 150) { W.dir = RND() < 0.5 ? 1 : -1; W.warn = 150; g.ev.push({ t: 'say', x: 0, y: -360, s: 'Wiggler is coming!', snd: 'wiggle' }); }
    if (W.warn > 0) W.warn--;
    if (W.next <= 0) { W.on = true; W.x = W.dir > 0 ? s.x : s.x + s.w; W.hp = 3; W.angry = 0; W.hits = {}; W.warn = 0; }
    return;
  }
  W.x += W.dir * (W.angry ? 4.6 : 2.2);
  const x0 = W.dir > 0 ? W.x - WIG_LEN : W.x, x1 = x0 + WIG_LEN;
  for (const f of g.fighters) {
    if (!hittable(f)) continue;
    if (f.x + f.w / 2 < Math.max(x0, s.x) || f.x - f.w / 2 > Math.min(x1, s.x + s.w) || f.y < s.y - 52 || f.y > s.y + 4) continue;
    if (W.hits[f.i] && g.frame - W.hits[f.i] < 45) continue;
    W.hits[f.i] = g.frame;
    applyHit(g, f, null, W.angry ? 13 : 8, W.angry ? 10 : 7, 0.09, 62, f.x >= (x0 + x1) / 2 ? 1 : -1, { proj: true });
  }
  if ((W.dir > 0 && x0 > s.x + s.w) || (W.dir < 0 && x1 < s.x)) { W.on = false; W.next = 1500 + RND() * 700; }
}
function hitWiggler(g, W) {
  if (W.angry) return;
  W.hp--;
  g.ev.push({ t: 'say', x: W.x, y: -70, s: W.hp > 0 ? 'Ow!' : 'Wiggler is ANGRY!', snd: W.hp > 0 ? 'pop' : 'angry' });
  if (W.hp <= 0) W.angry = 1;
}

// Captain Toad Diorama spike tiles: idle, a warning glint, then up for a while
function updSpikes(g, Hz, st) {
  Hz.spk.forEach((k, i) => {
    const tile = st.spikes[i];
    if (--k.t <= 0) {
      if (k.ph === 'idle') { k.ph = 'warn'; k.t = 60; g.ev.push({ t: 'spikewarn', x: tile.x + tile.w / 2, y: 0 }); }
      else if (k.ph === 'warn') { k.ph = 'up'; k.t = 100; g.ev.push({ t: 'spike', x: tile.x + tile.w / 2, y: 0 }); }
      else { k.ph = 'idle'; k.t = 300 + RND() * 220; }
    }
    if (k.ph !== 'up') return;
    for (const f of g.fighters) {
      if (!hittable(f) || f.x < tile.x || f.x > tile.x + tile.w || f.y < -10 || f.y > 6) continue;
      if (k.hits[f.i] && g.frame - k.hits[f.i] < 40) continue;
      k.hits[f.i] = g.frame;
      applyHit(g, f, null, 12, 9, 0.1, 85, f.x >= tile.x + tile.w / 2 ? 1 : -1, { proj: true });
    }
  });
}

// ---------- v1.15 stage hazards ----------
// Frostbite Glacier: now and then a row of icicles shakes loose from the ceiling. Their spots are marked first,
// then they drop and shatter on whatever they land on (a hit chills you for a moment)
function updIcicles(g, I, st) {
  const s = st.solids[0];
  if (I.ph === 'idle') {
    if (--I.t > 0) return;
    I.ph = 'warn'; I.t = 96; I.list = []; I.hits = {};
    const n = 4 + Math.floor(RND() * 3) + (st.big ? 3 : 0), span = (s.w - 120) / n;
    for (let k = 0; k < n; k++) I.list.push({ x: Math.round(s.x + 60 + span * (k + 0.2 + RND() * 0.6)), y: -720, vy: 0, on: 1, d: Math.floor(RND() * 20) });
    g.ev.push({ t: 'say', x: 0, y: -340, s: 'Icicles!', snd: 'frost' });
    return;
  }
  if (I.ph === 'warn') { if (--I.t <= 0) I.ph = 'fall'; return; }
  let any = false;
  for (const c of I.list) {
    if (!c.on) continue;
    any = true;
    if (c.d > 0) { c.d--; continue; } // (they don't all let go at once)
    const py = c.y;
    c.vy = Math.min(c.vy + 0.9, 22); c.y += c.vy;
    for (const f of g.fighters) {
      if (!hittable(f) || I.hits[f.i + ':' + c.x]) continue;
      if (Math.abs(f.x - c.x) < f.w / 2 + 14 && c.y > f.y - f.h && c.y - 70 < f.y) {
        I.hits[f.i + ':' + c.x] = 1;
        applyHit(g, f, null, 9, 7, 0.08, 75, f.x >= c.x ? 1 : -1, { proj: true, slow: 90 });
      }
    }
    const gy = groundBelow(g, c.x, py, c.vy + 3);
    if (gy !== null && c.y >= gy) { c.on = 0; g.ev.push({ t: 'iceshatter', x: c.x, y: gy - 24, w: 26, h: 56, k: 'pillar' }); }
    else if (c.y > 800) c.on = 0;
  }
  if (!any) { I.ph = 'idle'; I.t = 840 + RND() * 600; I.list = []; }
}
// Gearworks Clocktower: the conveyor belts carry whoever stands on them, stop for a moment, then switch direction
function updConveyor(g, Cv, st) {
  if (--Cv.t <= 0) {
    if (Cv.ph === 'run') { Cv.ph = 'warn'; Cv.t = 90; g.ev.push({ t: 'say', x: 0, y: -340, s: 'The belts are switching!', snd: 'clack' }); }
    else { Cv.ph = 'run'; Cv.t = 540 + RND() * 300; Cv.dir = -Cv.dir; }
  }
  if (Cv.ph !== 'run') return;
  const push = (o, gi) => { if (gi !== 0) return; for (const b of st.conveyors || []) if (o.x > b.x && o.x < b.x + b.w) o.x += b.dir * Cv.dir * 1.7; };
  for (const f of g.fighters) if (alive(f) && f.st !== 'ledge') push(f, f.gi);
  for (const q of g.proj) if (isSoldier(q)) push(q, q.gi);
}
// ... and its giant pendulum: latched high on one side, it lets go and sweeps across the floor to the other side
const PEND_Y = -700, PEND_L = 662, PEND_A = 1.05; // pivot height above the middle, rod length (the bob skims the floor), the latched angle
function updPendulum(g, P) {
  if (P.ph === 'idle') {
    if (--P.t === 110) { P.warn = 110; g.ev.push({ t: 'say', x: 0, y: -340, s: P.a < 0 ? 'Pendulum! >>>' : '<<< Pendulum!', snd: 'bell' }); }
    if (P.warn > 0) P.warn--;
    if (P.t <= 0) { P.ph = 'swing'; P.k = 0; P.hits = {}; P.from = P.a < 0 ? -1 : 1; }
    return;
  }
  // (an easing swing: slow at the ends, fastest at the bottom)
  P.k = Math.min(1, P.k + 1 / 140);
  P.a = -P.from * PEND_A * Math.cos(Math.PI * P.k);
  const bx = Math.sin(P.a) * PEND_L, by = PEND_Y + Math.cos(P.a) * PEND_L;
  for (const f of g.fighters) {
    if (!hittable(f) || P.hits[f.i]) continue;
    if (circRect(bx, by, 54, f.x - f.w / 2, f.y - f.h, f.w, f.h)) {
      P.hits[f.i] = 1;
      applyHit(g, f, null, 13, 10, 0.12, 40, -P.from, { proj: true });
      g.ev.push({ t: 'boom', x: f.x, y: f.y - 30, s: 0.7 });
    }
  }
  for (const q of g.proj) if (isSoldier(q) && circRect(bx, by, 54, q.x - 15, q.y - 52, 30, 52)) hurtSoldier(g, q, -P.from);
  if (P.k >= 1) { P.ph = 'idle'; P.t = 960 + RND() * 600; P.warn = 0; g.ev.push({ t: 'pendlatch' }); }
}
// Tidal Lagoon: the tide rolls in over the sandbar, stays a while, and goes back out (lv: the water's surface)
const TIDE_LOW = 70, TIDE_HIGH = -72;
function updTide(g, T) {
  if (--T.t <= 0) {
    if (T.ph === 'low') { T.ph = 'warn'; T.t = 120; g.ev.push({ t: 'say', x: 0, y: -340, s: 'The tide is coming in!', snd: 'wind' }); }
    else if (T.ph === 'warn') { T.ph = 'rise'; T.t = 180; }
    else if (T.ph === 'rise') { T.ph = 'high'; T.t = 420; }
    else if (T.ph === 'high') { T.ph = 'fall'; T.t = 180; }
    else { T.ph = 'low'; T.t = 900 + RND() * 500; }
  }
  const k = T.ph === 'rise' ? 1 - T.t / 180 : T.ph === 'high' ? 1 : T.ph === 'fall' ? T.t / 180 : 0;
  T.lv = TIDE_LOW + (TIDE_HIGH - TIDE_LOW) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  g.water = T.lv;
}
// Starlight Observatory: now and then gravity fades to almost nothing for eight seconds
function updLowGrav(g, L) {
  if (--L.t <= 0) {
    if (L.ph === 'idle') { L.ph = 'warn'; L.t = 120; g.ev.push({ t: 'say', x: 0, y: -340, s: 'Gravity is fading...', snd: 'magic' }); }
    else if (L.ph === 'warn') { L.ph = 'low'; L.t = 480; g.ev.push({ t: 'lowgrav', on: 1 }); }
    else { L.ph = 'idle'; L.t = 1100 + RND() * 600; g.ev.push({ t: 'lowgrav', on: 0 }); }
  }
  g.gravK = L.ph === 'low' ? 0.42 : 1;
}
// ... and falling stars that streak down across the stage
function updStars(g, S, st) {
  const s = st.solids[0];
  if (--S.t <= 0) {
    S.t = 220 + RND() * 220;
    const dir = RND() < 0.5 ? 1 : -1, x0 = s.x + 40 + RND() * (s.w - 80);
    S.list.push({ x: x0 - dir * 500, y: -760, vx: dir * 5, vy: 7.6, on: 1, hits: {} });
  }
  for (const m of S.list) {
    const py = m.y;
    m.x += m.vx; m.y += m.vy;
    for (const f of g.fighters) {
      if (!hittable(f) || m.hits[f.i]) continue;
      if (circRect(m.x, m.y, 24, f.x - f.w / 2, f.y - f.h, f.w, f.h)) {
        m.hits[f.i] = 1;
        applyHit(g, f, null, 7, 7, 0.09, 55, m.vx > 0 ? 1 : -1, { proj: true });
        g.ev.push({ t: 'starhit', x: m.x, y: m.y });
      }
    }
    const gy = groundBelow(g, m.x, py, m.vy + 3);
    if (gy !== null && m.y >= gy) { m.on = 0; g.ev.push({ t: 'starhit', x: m.x, y: gy - 6, land: 1 }); }
    else if (m.y > 800) m.on = 0;
  }
  S.list = S.list.filter(m => m.on);
}

// Toad's Turnpike dash panels fling you along the road
function updBoost(g, st) {
  for (const f of g.fighters) {
    if (!alive(f) || f.gi !== 0 || f.boostT > 0 || f.st === 'hit') continue;
    for (const p of st.boost) {
      if (f.x < p.x || f.x > p.x + p.w) continue;
      f.vx = p.dir * 15; f.boostT = 26; f.fc = p.dir;
      g.ev.push({ t: 'boostpad', x: f.x, y: f.y, dir: p.dir });
      break;
    }
  }
}

// Mushroom Gorge gusts push everyone sideways for a few seconds
function updWind(g, w) {
  if (--w.t <= 0) {
    if (w.ph === 'idle') { w.ph = 'warn'; w.t = 90; w.dir = RND() < 0.5 ? 1 : -1; g.ev.push({ t: 'say', x: 0, y: -340, s: w.dir > 0 ? 'Gust incoming! >>>' : '<<< Gust incoming!', snd: 'wind' }); }
    else if (w.ph === 'warn') { w.ph = 'blow'; w.t = 300; }
    else { w.ph = 'idle'; w.t = 900 + RND() * 500; }
  }
  if (w.ph !== 'blow') return;
  for (const f of g.fighters) {
    if (!alive(f) || f.st === 'ledge' || f.rp > 0) continue;
    if (f.vx * w.dir < 6) f.vx += w.dir * (f.gi >= 0 ? 0.2 : 0.36) * (f.big ? 0.6 : f.small ? 1.5 : 1);
  }
}

// ---------- Final smashes (Smash Mushroom finales) ----------
const FSDEF = {
  toad: { k: 'wave', sub: 'toads' }, toadsworth: { k: 'wave', sub: 'guards', both: 1 },
  blue: { k: 'freeze' }, yellow: { k: 'meteor', sub: 'sun', r: 250, d: 36 }, chef: { k: 'meteor', sub: 'cake', r: 210, d: 30, pies: 10 },
  green: { k: 'vortex', sub: 'leaf', move: 3.2, life: 210, r: 230 }, wizard: { k: 'vortex', sub: 'rune', move: 0, life: 170, r: 330 },
  purple: { k: 'flood' }, toadette: { k: 'burst', crown: 1 }, captain: { k: 'rush' },
  redyoshi: { k: 'rain', sub: 'fire', n: 18 }, blueyoshi: { k: 'vortex', sub: 'feather', move: 3, life: 200, r: 240 }, yellowyoshi: { k: 'pulses', sub: 'quake' },
  pinkyoshi: { k: 'burst', sub: 'love' }, iceyoshi: { k: 'freeze', sub: 'blizzard' }, purpleyoshi: { k: 'flood', sub: 'bubble' },
  blackyoshi: { k: 'clone', sub: 'shadow' }, whiteyoshi: { k: 'beam', sub: 'light' }, orangeyoshi: { k: 'rain', sub: 'melon', n: 14, cols: 1 },
  babyyoshi: { k: 'wave', sub: 'yoshis' },
  yoshi: { k: 'rain', sub: 'egg', n: 16 }, pirate: { k: 'rain', sub: 'cannon', n: 14, side: 1 }, doctor: { k: 'rain', sub: 'pill', n: 18, cols: 1 },
  ninja: { k: 'clone' }, knight: { k: 'beam' }, astro: { k: 'sweep' }, rocker: { k: 'pulses' },
  cowboy: { k: 'lasso' }, ghost: { k: 'swarm', n: 10 }, robo: { k: 'fist' },
  cowtoad: { k: 'wave', sub: 'cows', both: 1 },
  samurai: { k: 'sweep', sub: 'petals' }, viking: { k: 'rush', sub: 'ship' }, pharaoh: { k: 'meteor', sub: 'pyramid', r: 240, d: 32 },
  gladiator: { k: 'wave', sub: 'legion' }, buddhist: { k: 'burst', sub: 'lotus' }, muslim: { k: 'rain', sub: 'lantern', n: 16, cols: 1 },
  // El Minya rains crystals twice as fast as the other rains (one every 4.075 frames), for 40% longer than it used to
  mormon: { k: 'pulses', sub: 'choir' }, hasidic: { k: 'lasso', sub: 'hora' }, subaru: { k: 'rain', sub: 'crystal', n: 64, every: 4.075 },
  dashyoshi: { k: 'rush', sub: 'dash', spd: 26, laps: 3 }, mechyoshi: { k: 'beam', sub: 'mech' },
  emilia: { k: 'storm', sub: 'absolute' },
  // Water Yoshi's finale is a placeholder for now: a healing tide (70%)
  wateryoshi: { k: 'heal', sub: 'tide' },
  // Nolan Toad's finale: the gap year that never ends (the stage turns into his room)
  nolan: { k: 'room', sub: 'gapyear' },
  catholic: { k: 'wave', sub: 'parranda' }, hindu: { k: 'vortex', sub: 'color', move: 2.6, life: 210, r: 240 },
};
// finales that keep their user busy until they finish (the Beast of the End only for its opening)
const FS_LOCK = { burst: 1, rush: 1, clone: 1, beam: 1, pulses: 1, lasso: 1, storm: 1, beast: 1 };
// Emilia Toad's super finale, when she uses her finale at 250% or more: the Beast of the End. Its timeline in
// frames: Puck vanishes, the beast rises (rise), roars (roar), its storm freezes her foes bit by bit for 20 seconds
// (storm to frozen), they stay frozen solid for 2 seconds and shatter (shatter), then the beast sinks away (gone)
const FS_BEAST = { k: 'beast', sub: 'end' };
const BEAST = { rise: 30, roar: 110, storm: 170, frozen: 1370, shatter: 1490, sink: 1520, gone: 1600 };
const beastOn = (g, i) => g.fx.some(e => e.k === 'beast' && (i === undefined || e.o === i));

function fsLaunch(g, f) {
  // (a second finale while her beast is still out is a normal Absolute Zero)
  const D = f.ch === 'emilia' && f.dm >= 250 && !beastOn(g, f.i) ? FS_BEAST : FSDEF[f.ch] || FSDEF.toad, s = STG[g.stage].solids[0];
  const e = { id: g.pid++, k: D.k, sub: D.sub || '', o: f.i, t: 0, x: f.x, y: f.y - f.h * 0.5, dir: f.fc, hits: {}, vic: [], life: 400 };
  switch (D.k) {
    case 'wave': e.life = 260; e.both = D.both || 0; e.x = f.fc > 0 ? s.x - 140 : s.x + s.w + 140; e.x2 = f.fc > 0 ? s.x + s.w + 140 : s.x - 140; break;
    case 'freeze': e.life = 132; break;
    case 'meteor': e.life = 200; e.r = D.r; e.d = D.d; e.pies = D.pies || 0; break;
    case 'vortex': e.life = D.life; e.r = D.r; e.move = D.move; e.y = s.y - 130; if (!D.move) e.x = s.x + s.w / 2; break;
    case 'flood': e.life = 250; e.lv = s.y + 260; break;
    case 'burst': e.life = 84; e.crown = D.crown || 0; break;
    case 'rush': e.laps = D.laps || 1; e.life = 130 * e.laps; e.spd = D.spd || 17; break;
    // (a rain with its own pace, `every` frames per drop, lives long enough for its last drop to land)
    case 'rain': e.life = D.every ? Math.ceil(D.every * D.n) + 100 : 240; e.n = D.n; e.every = D.every || 0; e.cnt = 0; e.side = D.side || 0; e.cols = D.cols || 0; break;
    case 'clone': e.life = 400; break;
    case 'beam': e.life = 80; break;
    case 'sweep': e.life = 146; e.x = e.dir > 0 ? s.x - 150 : s.x + s.w + 150; break;
    case 'pulses': e.life = 120; break;
    case 'lasso': e.life = 90; break;
    case 'swarm': e.life = 230; e.b = []; for (let k = 0; k < D.n; k++) { const a = (k / D.n) * Math.PI * 2; e.b.push([f.x, f.y - 40, Math.cos(a) * 6, Math.sin(a) * 6 - 2]); } break;
    case 'fist': e.life = 200; e.vx = 2; e.y = f.y - 44; break;
    case 'storm': e.life = 320; e.ox = f.x; e.oy = f.y; break;
    case 'beast': e.life = BEAST.gone + 20; e.ox = f.x; e.oy = f.y; e.x = s.x + s.w / 2; e.y = s.y; e.pos = {}; break;
    case 'heal': e.life = 60; break;
    case 'room': e.life = NOLAN.room.life + NOLAN.room.card; break;
  }
  g.fx.push(e);
  if (FS_LOCK[D.k]) f.fsLock = e.id;
  g.ev.push({ t: 'fsgo', k: D.k, sub: e.sub, i: f.i, x: f.x, y: f.y });
}

function fsFoes(g, e) { return g.fighters.filter(v => !mineI(g, e.o, v.i) && alive(v) && v.rp <= 0); }
function fsHit(g, e, v, d, k, gr, ang, dir, extra) {
  if (v.inv > 0 && v.rp > 0) return;
  v.inv = 0; v.ig = 0;
  applyHit(g, v, fighterBy(g, e.o), d, k, gr, ang, dir, Object.assign({ proj: true, fs: true }, extra));
}
// hold a victim in place for a finale's cinematic part
function fsHold(v, x, y) { v.x = x; v.y = y; v.vx = 0; v.vy = 0; v.st = 'hit'; v.hs = Math.max(v.hs, 6); v.gi = -1; v.at = null; v.sp = null; }

function updateFx(g) {
  for (let n = g.fx.length - 1; n >= 0; n--) {
    const e = g.fx[n], own = fighterBy(g, e.o);
    e.t++;
    if (FXU[e.k](g, e, own) || e.t > e.life) {
      if (own && own.fsLock === e.id) own.fsLock = 0;
      g.fx.splice(n, 1);
    }
  }
}

const FXU = {
  // a crowd charges across the stage carrying everyone along (Toad Brigade, Royal Guards from both sides)
  wave(g, e) {
    const s = STG[g.stage].solids[0], spd = 9, mid = s.x + s.w / 2;
    e.x += e.dir * spd;
    if (e.both) e.x2 -= e.dir * spd;
    for (const v of fsFoes(g, e)) {
      for (const [fx, dir] of e.both ? [[e.x, e.dir], [e.x2, -e.dir]] : [[e.x, e.dir]]) {
        if (Math.abs(v.x - fx) > 70 || v.y < s.y - 230 || v.y > s.y + 80) continue;
        if (!e.hits[v.i] || g.frame - e.hits[v.i] >= 8) { e.hits[v.i] = g.frame; fsHit(g, e, v, 2, 0.4, 0, 20, dir); }
        v.vx = dir * spd; v.vy = Math.min(v.vy, -1.5); v.x = fx + dir * 40;
        if (!e.vic.includes(v.i)) e.vic.push(v.i);
      }
    }
    const done = e.both ? e.dir * (e.x - mid) >= 0 : e.dir * (e.x - (e.dir > 0 ? s.x + s.w + 150 : s.x - 150)) >= 0;
    if (!done) return false;
    if (e.both) { g.ev.push({ t: 'boom', x: mid, y: s.y - 40, s: 3 }); for (const v of fsFoes(g, e)) if (Math.abs(v.x - mid) < 280) fsHit(g, e, v, 18, 13, 0.18, 75, v.x >= mid ? 1 : -1); }
    else for (const i of e.vic) { const v = fighterBy(g, i); if (v && alive(v)) fsHit(g, e, v, 12, 13, 0.17, 40, e.dir); }
    return true;
  },
  // Absolute Zero (Emilia Toad): she stands locked in place, arms raised, while a huge ice storm roars across the
  // stage for five seconds. Its ice pellets only chip away (no flinching), and its wind slowly blows every foe the
  // way the storm goes; a last strong gust shoves them along (it still doesn't stun)
  storm(g, e, own) {
    if (own && alive(own) && !e.free) { own.x = e.ox; own.y = e.oy; own.vx = 0; own.vy = 0; own.inv = Math.max(own.inv, 2); }
    if (e.t % 100 === 0 && e.t < 300) g.ev.push({ t: 'stormgust', x: e.ox, y: e.oy });
    // (chip hits go straight to applyHit, so they never wipe a dodge's invincibility the way finale hits do)
    const chip = (v, d) => applyHit(g, v, fighterBy(g, e.o), d, 0, 0, 0, e.dir, { proj: true, fs: true, chip: true });
    if (e.t >= 20 && e.t < 300) for (const v of fsFoes(g, e)) {
      if (e.t % 7 === 0) chip(v, 0.715);
      if (v.st !== 'ledge' && v.vx * e.dir < 4.5) v.vx += e.dir * (v.gi >= 0 ? 0.19 : 0.28) * (v.big ? 0.6 : v.small ? 1.5 : 1);
    }
    if (e.t === 300) for (const v of fsFoes(g, e)) {
      chip(v, 5.85);
      if (v.st !== 'ledge') v.vx = e.dir * 9 * (v.big ? 0.6 : 1);
      g.ev.push({ t: 'shatter', x: v.x, y: v.y - v.h / 2 });
    }
    return e.t >= 306;
  },
  // the Beast of the End (Emilia Toad's super finale): Puck vanishes and comes back as an enormous black beast that
  // rises behind the stage and roars. Its storm freezes every foe a little more each moment (time runs slower and
  // slower for them) until, after twenty seconds, they're frozen solid; two seconds later they shatter, a KO for
  // Emilia. Nothing stops it, not even Emilia getting KO'd or knocked out of the match. Then the beast sinks away
  // and Puck comes back (if she's still in the match)
  beast(g, e, own) {
    const B = BEAST, foes = g.fighters.filter(v => !mineI(g, e.o, v.i) && alive(v));
    if (own) own.noPk = 1; // (Puck is the beast now; if she gets KO'd, she comes back without him until it's over)
    if (e.t === 1) g.ev.push({ t: 'puckgone', i: e.o, x: own ? own.pkx : e.ox, y: own ? own.pky : e.oy - 80 });
    if (e.t === B.rise) g.ev.push({ t: 'beastrise', x: e.x, y: e.y });
    if (e.t === B.roar) g.ev.push({ t: 'beastroar', x: e.x, y: e.y });
    if (e.t < B.storm && own && alive(own) && own.fsLock === e.id) { own.x = e.ox; own.y = e.oy; own.vx = 0; own.vy = 0; own.inv = Math.max(own.inv, 2); }
    if (e.t === B.storm && own && own.fsLock === e.id) own.fsLock = 0;
    if (e.t >= B.storm && e.t < B.frozen) { const k = Math.round(((e.t - B.storm) / (B.frozen - B.storm)) * 100) / 100; for (const v of foes) v.bfz = k; }
    if (e.t >= B.frozen && e.t < B.shatter) {
      if (e.t === B.frozen) g.ev.push({ t: 'beastfrozen' });
      for (const v of foes) {
        if (!e.pos[v.i]) e.pos[v.i] = [v.x, v.y]; // (frozen where they stand; someone who just came back freezes too)
        v.bfz = 1; v.frz = Math.max(v.frz, 2); v.inv = Math.max(v.inv, 2); fsHold(v, e.pos[v.i][0], e.pos[v.i][1]);
      }
    }
    if (e.t === B.shatter) for (const v of foes) {
      g.ev.push({ t: 'beastshatter', x: v.x, y: v.y - v.h / 2, i: v.i });
      v.bfz = 0; v.frz = 0; v.inv = 0; v.lastHit = e.o; v.lastHitT = g.frame; ko(g, v);
    }
    if (e.t === B.sink) g.ev.push({ t: 'beastsink', x: e.x, y: e.y });
    if (e.t < B.gone) return false;
    for (const v of g.fighters) v.bfz = 0;
    if (own) { own.noPk = 0; if (!own.out) g.ev.push({ t: 'puckback', i: e.o }); }
    return true;
  },
  // a healing tide washes over the user: 70% of their damage, gone (Water Yoshi's placeholder finale)
  heal(g, e, own) {
    if (e.t === 2 && own && alive(own)) { own.dm = Math.max(0, own.dm - 70); g.ev.push({ t: 'fsheal', x: own.x, y: own.y - own.h, i: own.i }); }
    return e.t >= 50;
  },
  // Nolan Toad's finale, the gap year that never ends: the stage turns into his room for 8 seconds. The stink in there
  // wears every foe down (1% every 40 frames: 1.5% a second, no flinching) and slows them 20%; he heals 1% a second
  // (he's at home). Then the title card: GAP YEAR: DAY 1,096
  room(g, e, own) {
    const R = NOLAN.room;
    if (e.t < R.life) {
      // (from its first frame on: 12% over the 8 seconds, and 8% healed)
      for (const v of fsFoes(g, e)) {
        v.reek = 2;
        if ((e.t - 1) % R.every === 0) applyHit(g, v, own, R.d, 0, 0, 0, e.dir, { proj: true, fs: true, chip: true });
      }
      if (own && alive(own) && (e.t - 1) % R.heal === 0 && own.dm > 0) { own.dm = Math.max(0, own.dm - 1); g.ev.push({ t: 'heal', x: own.x, y: own.y - own.h }); }
    }
    if (e.t === R.life) g.ev.push({ t: 'gapyear', i: e.o });
    return e.t >= R.life + R.card;
  },
  // everyone else freezes solid, then shatters
  freeze(g, e) {
    if (e.t === 1) { e.pos = {}; for (const v of fsFoes(g, e)) { e.vic.push(v.i); e.pos[v.i] = [v.x, v.y]; v.frz = 125; } g.ev.push({ t: 'frost' }); }
    for (const i of e.vic) {
      const v = fighterBy(g, i);
      if (!v || !alive(v)) continue;
      if (e.t < 120) { fsHold(v, e.pos[i][0], e.pos[i][1]); v.frz = Math.max(v.frz, 2); }
      else if (e.t === 120) { v.frz = 0; fsHit(g, e, v, 26, 11, 0.18, 78, v.x >= e.x ? 1 : -1); g.ev.push({ t: 'shatter', x: v.x, y: v.y - v.h / 2 }); }
    }
    return e.t >= 122;
  },
  // something enormous falls on the stage (Solar Flare sun, a banquet cake)
  meteor(g, e) {
    const s = STG[g.stage].solids[0];
    if (e.t === 1) {
      const fs = fsFoes(g, e), tx = fs.length ? fs.reduce((a, v) => a + v.x, 0) / fs.length : s.x + s.w / 2;
      e.x = clamp(tx, s.x + 60, s.x + s.w - 60); e.y = -900; e.vy = 9;
    }
    e.vy += 0.4; e.y += e.vy;
    if (e.y < s.y - 30) return false;
    g.ev.push({ t: 'boom', x: e.x, y: s.y - 30, s: e.r / 60, k: e.sub });
    for (const v of fsFoes(g, e)) if (Math.hypot(v.x - e.x, (v.y - v.h / 2) - (s.y - 40)) < e.r) fsHit(g, e, v, e.d, 13, 0.18, 65, v.x >= e.x ? 1 : -1);
    const own = fighterBy(g, e.o) || { i: e.o, pm: 1, fc: 1 };
    for (let k = 0; k < e.pies; k++) {
      const a = Math.PI * (0.1 + (0.8 * k) / Math.max(1, e.pies - 1));
      spawnProj(g, own, { k: 'pie', x: e.x, y: s.y - 60, vx: -Math.cos(a) * 9, vy: -Math.sin(a) * 11, grav: 0.4, d: 6, kb: 6, gr: 0.08, ang: 50, r: 16, life: 140 });
    }
    return true;
  },
  // a whirlwind (Leaf Storm) or magic circle (Arcane Vortex) pulls foes in, then blows them away
  vortex(g, e) {
    const s = STG[g.stage].solids[0];
    if (e.move) { e.x += e.dir * e.move; if (e.x < s.x || e.x > s.x + s.w) e.dir = -e.dir; }
    for (const v of fsFoes(g, e)) {
      const dx = e.x - v.x, dy = e.y - (v.y - v.h / 2), L = Math.hypot(dx, dy);
      if (L > e.r) continue;
      if (e.t < e.life - 2) {
        v.vx = clamp(v.vx + (dx / (L || 1)) * 1.6, -9, 9); v.vy = clamp(v.vy + (dy / (L || 1)) * 1.3 - 0.4, -9, 9);
        v.st = 'hit'; v.hs = Math.max(v.hs, 8); v.gi = -1;
        if (!e.hits[v.i] || g.frame - e.hits[v.i] >= 10) { e.hits[v.i] = g.frame; v.dm = Math.min(999, v.dm + 2); g.ev.push({ t: 'hit', x: v.x, y: v.y - v.h / 2, p: 3, c: e.o }); }
      } else if (e.t === e.life - 2) fsHit(g, e, v, 18, 13, 0.18, 75, v.x >= e.x ? 1 : -1);
    }
    if (e.t === e.life - 2) g.ev.push({ t: 'boom', x: e.x, y: e.y, s: e.r / 90, k: e.sub });
    return false;
  },
  // a poison tide rises over the stage, then bursts
  flood(g, e) {
    const s = STG[g.stage].solids[0], top = s.y - 150, bot = s.y + 260;
    e.lv = e.t < 90 ? bot + (top - bot) * (e.t / 90) : e.t < 200 ? top : top + (bot - top) * ((e.t - 200) / 50);
    for (const v of fsFoes(g, e)) {
      if (v.y < e.lv) continue;
      v.psn = Math.max(v.psn, 90);
      if (v.st !== 'hit' || v.vy > -2) v.vy -= 0.9;
      if (!e.hits[v.i] || g.frame - e.hits[v.i] >= 8) { e.hits[v.i] = g.frame; v.dm = Math.min(999, v.dm + 1.5); }
      if (e.t === 200) fsHit(g, e, v, 12, 12, 0.16, 88, v.x >= 0 ? 1 : -1);
    }
    return false;
  },
  // Peachette's royal heart bursts, three rings wide
  burst(g, e, own) {
    if (!own) return true;
    e.x = own.x; e.y = own.y - own.h * 0.5;
    if (e.t === 1 && e.crown) own.pe = 900; // only Toadette becomes Peachette
    for (const [t0, r, d, k] of [[10, 150, 9, 8], [40, 235, 10, 9], [70, 340, 15, 13]]) {
      if (e.t !== t0) continue;
      g.ev.push({ t: 'hearts', x: e.x, y: e.y, r });
      for (const v of fsFoes(g, e)) if (Math.hypot(v.x - e.x, v.y - v.h / 2 - e.y) < r) fsHit(g, e, v, d, k, 0.16, 60, v.x >= e.x ? 1 : -1);
    }
    return false;
  },
  // Captain Toad rides a mine cart across the stage, scooping everyone up
  rush(g, e, own) {
    if (!own || !alive(own)) return true;
    const s = STG[g.stage].solids[0];
    own.vx = e.dir * (e.spd || 17); own.vy = Math.min(own.vy, 2); own.fc = e.dir; own.inv = Math.max(own.inv, 2);
    if (e.sub === 'dash' && e.t % 2 === 0) g.ev.push({ t: 'flame', x: own.x - e.dir * 24, y: own.y - 24 - (e.t % 4) * 6 });
    for (const v of fsFoes(g, e)) {
      if (!e.vic.includes(v.i) && (Math.abs(v.x - own.x) > 60 || Math.abs(v.y - own.y) > 90)) continue;
      if (!e.vic.includes(v.i)) e.vic.push(v.i);
      fsHold(v, own.x + e.dir * 46, own.y);
      if (!e.hits[v.i] || g.frame - e.hits[v.i] >= 6) { e.hits[v.i] = g.frame; v.dm = Math.min(999, v.dm + 3); g.ev.push({ t: 'hit', x: v.x, y: v.y - 30, p: 4, c: e.o }); }
    }
    const edge = e.dir > 0 ? s.x + s.w - 40 : s.x + 40;
    if (e.dir * (own.x - edge) < 0 && e.t < e.life - 20) return false;
    // Supersonic Lap: turn round at the edge and go again, carrying everyone along
    if (e.laps > 1) { e.laps--; e.dir = -e.dir; own.fc = e.dir; g.ev.push({ t: 'boomfx', x: own.x, y: own.y - 30, dir: e.dir }); return false; }
    own.vx = -e.dir * 3; own.vy = -8; own.gi = -1;
    g.ev.push({ t: 'boom', x: own.x + e.dir * 40, y: own.y - 30, s: 2.2 });
    for (const i of e.vic) { const v = fighterBy(g, i); if (v && alive(v)) fsHit(g, e, v, 18, 13, 0.18, 42, e.dir); }
    return true;
  },
  // eggs, cannonballs or megavitamins pour down all over the stage
  rain(g, e, own) {
    // one drop every `every` frames, starting on the first frame (the pace can be fractional, as El Minya's is)
    const s = STG[g.stage].solids[0], every = e.every || Math.floor(160 / e.n);
    if (e.cnt < e.n && e.t >= 1 + e.cnt * every) {
      e.cnt++;
      const shooter = own || { i: e.o, pm: 1, fc: 1 }, P = { k: 'fsdrop', sub: e.sub, grav: 0.32, d: 9, kb: 8, gr: 0.11, ang: 60, r: 22, life: 320, explode: { r: 72, d: 9, k: 9, g: 0.12 } };
      if (e.side) {
        // cannonballs lob in from a ship offstage
        const x0 = e.dir > 0 ? s.x - 620 : s.x + s.w + 620, tx = s.x + 40 + RND() * (s.w - 80), T = 70, y0 = -260;
        Object.assign(P, { x: x0, y: y0, vx: (tx - x0) / T, vy: (s.y - y0 - 0.5 * 0.32 * T * T) / T });
      } else {
        let tx = e.cols ? s.x + 30 + ((e.cnt * 97) % (s.w - 60)) : s.x - 80 + RND() * (s.w + 160);
        // El Minya aims half its crystals at the platforms, so they slowly crack and break. Each crystal hits for
        // 8.19 (30% more than the 6.3 it was)
        if (e.sub === 'crystal') {
          P.d = 8.19; P.explode = { r: 72, d: 8.19, k: 9, g: 0.12 };
          const up = g.surf.filter(q => !q.solid && !q.gone && !q.cloud && q.pi !== undefined);
          if (up.length && RND() < 0.55) { const q = up[Math.floor(RND() * up.length)]; tx = q.x + 20 + RND() * (q.w - 40); }
        }
        Object.assign(P, { x: tx, y: -760, vx: 0, vy: 6 });
        // Lantern Night: glowing lanterns drift down slowly
        if (e.sub === 'lantern') Object.assign(P, { vy: 2.5, grav: 0.06 });
      }
      spawnProj(g, shooter, P);
    }
    return e.cnt >= e.n && e.t > every * e.n + 90;
  },
  // Ninja Toad blinks from foe to foe, slashing, then sends them all flying
  clone(g, e, own) {
    if (!own || !alive(own)) return true;
    if (e.t === 1) { e.home = [own.x, own.y]; e.vic = fsFoes(g, e).map(v => v.i); e.pos = {}; for (const i of e.vic) { const v = fighterBy(g, i); e.pos[i] = [v.x, v.y]; } }
    own.inv = Math.max(own.inv, 2); own.vx = 0; own.vy = 0;
    const per = 14, total = e.vic.length * 3, step = Math.floor((e.t - 1) / per);
    for (const i of e.vic) { const v = fighterBy(g, i); if (v && alive(v)) fsHold(v, e.pos[i][0], e.pos[i][1]); }
    if (step < total && (e.t - 1) % per === 0) {
      const v = fighterBy(g, e.vic[step % e.vic.length]);
      if (v && alive(v)) {
        const side = step % 2 ? 1 : -1;
        own.x = v.x + side * 46; own.y = v.y; own.fc = -side; own.gi = -1;
        v.dm = Math.min(999, v.dm + 4);
        g.ev.push({ t: 'slash', x: v.x, y: v.y - v.h / 2 }); g.ev.push({ t: 'hit', x: v.x, y: v.y - v.h / 2, p: 6, c: e.o });
      }
    }
    if (step < total || !e.vic.length) return !e.vic.length;
    own.x = e.home[0]; own.y = e.home[1]; // back to where the strike began
    g.ev.push({ t: 'poof', x: own.x, y: own.y - 30, k: 'smoke' });
    for (const i of e.vic) { const v = fighterBy(g, i); if (v && alive(v)) fsHit(g, e, v, 14, 12, 0.18, 55, v.x >= own.x ? 1 : -1); }
    return true;
  },
  // Knight Toad's Excalibur fires a wall of light across the screen
  beam(g, e, own) {
    if (!own || !alive(own)) return true;
    e.x = own.x; e.y = own.y - own.h * 0.55; e.dir = own.fc;
    own.vx = 0; own.vy = Math.min(own.vy, 0.5);
    if (e.t < 24) return false;
    for (const v of fsFoes(g, e)) {
      if (e.dir * (v.x - e.x) < -30 || Math.abs(v.y - v.h / 2 - e.y) > 95) continue;
      if (e.t < 70) {
        v.vx = e.dir * 1.6; v.vy = -0.6; v.st = 'hit'; v.hs = Math.max(v.hs, 8); v.gi = -1;
        if (!e.hits[v.i] || g.frame - e.hits[v.i] >= 6) { e.hits[v.i] = g.frame; v.dm = Math.min(999, v.dm + 2.5); g.ev.push({ t: 'hit', x: v.x, y: v.y - v.h / 2, p: 3, c: e.o }); }
      } else if (e.t === 70) fsHit(g, e, v, 16, 13, 0.18, 30, e.dir);
    }
    return false;
  },
  // Astro Toad's orbital laser sweeps the stage from one side to the other
  sweep(g, e) {
    const s = STG[g.stage].solids[0], x0 = s.x - 150, x1 = s.x + s.w + 150, k = clamp((e.t - 16) / 110, 0, 1);
    e.x = e.dir > 0 ? x0 + (x1 - x0) * k : x1 - (x1 - x0) * k;
    if (e.t < 16) return false;
    for (const v of fsFoes(g, e)) {
      if (Math.abs(v.x - e.x) > 72) continue;
      if (!e.vic.includes(v.i)) e.vic.push(v.i);
      v.vx = e.dir * 3.2; v.vy = Math.max(-3, v.vy - 1.2); v.st = 'hit'; v.hs = Math.max(v.hs, 8); v.gi = -1;
      if (!e.hits[v.i] || g.frame - e.hits[v.i] >= 6) { e.hits[v.i] = g.frame; v.dm = Math.min(999, v.dm + 3); g.ev.push({ t: 'hit', x: v.x, y: v.y - v.h / 2, p: 3, c: e.o }); }
    }
    if (e.t === 136) for (const i of e.vic) { const v = fighterBy(g, i); if (v && alive(v)) fsHit(g, e, v, 13, 12, 0.17, 80, e.dir); }
    return e.t >= 140;
  },
  // Rocker Toad's amp stack: four shockwaves that reach every corner of the stage
  pulses(g, e, own) {
    if (own) { e.x = own.x; e.y = own.y - 40; own.vx = 0; }
    for (const t0 of [22, 52, 82, 112]) {
      if (e.t !== t0) continue;
      const last = t0 === 112;
      g.ev.push({ t: 'amp', x: e.x, y: e.y, big: 1, sub: e.sub });
      for (const v of fsFoes(g, e)) fsHit(g, e, v, last ? 14 : 6, last ? 13 : 6, last ? 0.18 : 0.04, 50, v.x >= e.x ? 1 : -1);
    }
    return e.t >= 116;
  },
  // Cowboy Toad lassos everyone nearby, spins them round and flings them
  lasso(g, e, own) {
    if (!own || !alive(own)) return true;
    own.vx = 0; own.vy = Math.min(own.vy, 0.5);
    e.x = own.x; e.y = own.y - 40;
    if (e.t === 10) e.vic = fsFoes(g, e).filter(v => Math.hypot(v.x - own.x, v.y - own.y) < 420).map(v => v.i);
    if (e.t < 10) return false;
    const k = e.t - 10;
    e.vic.forEach((i, n) => {
      const v = fighterBy(g, i);
      if (!v || !alive(v)) return;
      const a = k * 0.24 + (n * Math.PI * 2) / Math.max(1, e.vic.length), tx = own.x + Math.cos(a) * 70, ty = own.y - 30 + Math.sin(a) * 34;
      if (k < 20) fsHold(v, v.x + (tx - v.x) * 0.18, v.y + (ty - v.y) * 0.18);
      else if (k < 70) fsHold(v, tx, ty);
      else if (k === 70) fsHit(g, e, v, 20, 13, 0.18, 45, v.x >= own.x ? 1 : -1);
    });
    return k >= 74;
  },
  // a swarm of Boos hunts down every foe
  swarm(g, e) {
    for (const b of e.b) {
      const tg = nearestFoe(g, e.o, b[0], b[1]);
      if (tg && e.t < e.life - 20) {
        const ax = tg.x - b[0], ay = tg.y - tg.h / 2 - b[1], L = Math.hypot(ax, ay) || 1;
        b[2] = clamp(b[2] + (ax / L) * 0.6, -7, 7); b[3] = clamp(b[3] + (ay / L) * 0.6, -7, 7);
      } else b[3] -= 0.3;
      b[0] += b[2]; b[1] += b[3];
      for (const v of fsFoes(g, e)) {
        const key = v.i + ':' + e.b.indexOf(b);
        if (Math.hypot(v.x - b[0], v.y - v.h / 2 - b[1]) > 30 || (e.hits[key] && g.frame - e.hits[key] < 26)) continue;
        e.hits[key] = g.frame;
        fsHit(g, e, v, 3.5, 4, 0.05, 60, b[2] >= 0 ? 1 : -1);
      }
    }
    return false;
  },
  // Robo Toad's gigantic rocket fist punches clean across the stage
  fist(g, e) {
    e.vx = Math.min(e.vx + 1.2, 24); e.x += e.dir * e.vx;
    for (const v of fsFoes(g, e)) {
      if (e.hits[v.i] || Math.abs(v.x - e.x) > 90 || Math.abs(v.y - v.h / 2 - e.y) > 85) continue;
      e.hits[v.i] = 1;
      fsHit(g, e, v, 30, 14, 0.2, 32, e.dir);
    }
    return e.x < BLAST.l - 120 || e.x > BLAST.r + 120;
  },
};

// ---------- Special-move templates ----------
function airDrift(f, c, max) {
  if (c.dirX) f.vx = clamp(f.vx + c.dirX * 0.45, -max, max); else f.vx *= 0.95;
}
function useCd(f, slot, n) { if (!n) return true; if (f.cd[slot] > 0) return false; f.cd[slot] = n; return true; }

// throw or fire projectile(s) at frame `at`; each entry of `shots` is a projectile template
function spShot(o) {
  return {
    start(g, f, c) { if (!useCd(f, o.slot || 'n', o.cd)) return false; if (c.onG) f.vx *= 0.4; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, o.hover || 3);
      if (f.t === (o.at || 8)) {
        for (const P of o.shots || [o.p]) {
          spawnProj(g, f, Object.assign({ grav: 0, r: 12, life: 120 }, P, {
            x: f.x + f.fc * (P.ox || 22) * f.sc, y: f.y - f.h * (P.oy || 0.5), vx: f.fc * P.vx, vy: P.vy || 0, fc: f.fc,
          }));
        }
        if (o.recoil) f.vx -= f.fc * o.recoil;
        if (o.ev) g.ev.push({ t: o.ev, x: f.x + f.fc * 26, y: f.y - f.h * 0.5, dir: f.fc });
      }
      return f.t >= (o.end || 20) ? 1 : 0;
    },
  };
}
// lunge forward with a hitbox; `intang` passes through attacks, `armor` won't flinch, `guard` blocks from the front
function spDash(o) {
  return {
    armor: o.armor, guard: o.guard,
    start(g, f, c) {
      if (!useCd(f, o.slot || 's', o.cd)) return false;
      if (!c.onG && !o.slot) { if (f.sUsed) return false; f.sUsed = true; }
      f.vx *= 0.3;
      if (o.hop && c.onG) { f.vy = -o.hop; f.gi = -1; }
      if (o.ev) g.ev.push({ t: o.ev, x: f.x, y: f.y - f.h * 0.5, dir: f.fc });
    },
    upd(g, f, c) {
      const st = o.startup || 4, len = o.frames || 14;
      if (f.t < st) { f.vx *= 0.6; if (!c.onG) f.vy = Math.min(f.vy, 1); return 0; }
      if (f.t < st + len) {
        f.vx = f.fc * o.speed;
        if (!c.onG && !o.arc) f.vy = Math.min(f.vy, 1.5);
        if (o.intang) f.ig = Math.max(f.ig, 2);
        if (o.reflect) reflect(g, f, f.x + f.fc * 30, f.y - f.h * 0.5, 44);
        if (o.trail && f.t % 3 === 0) g.ev.push({ t: o.trail, x: f.x - f.fc * 14, y: f.y - f.h * 0.4, dir: f.fc });
        const H = o.hb;
        if (H) hitArea(g, f, (H.x || 24) * f.sc, -f.h * (H.y || 0.5), (H.r || 28) * f.sc, H.d, H.k, H.g, H.ang, { every: H.every, daze: H.daze, frz: H.frz });
        if (o.endOnLand && f.t > st + 3 && f.gi >= 0) { f.vx *= 0.4; return 1; }
        return 0;
      }
      if (f.t === st + len && o.fin) { f.hits = {}; const F = o.fin; hitArea(g, f, (F.x || 30) * f.sc, -f.h * (F.y || 0.5), (F.r || 32) * f.sc, F.d, F.k, F.g, F.ang, { daze: F.daze }); }
      f.vx *= 0.75;
      return f.t >= st + len + (o.lag || 10) ? 1 : 0;
    },
  };
}
// an up special that launches the user; helpless afterwards unless `free`
function spRise(o) {
  return {
    fall: o.fall,
    start(g, f) {
      if (f.upUsed) return false;
      f.upUsed = true; f.gi = -1; f.vy = -(o.vy || 15); f.vx *= 0.5;
      if (o.ev) g.ev.push({ t: o.ev, x: f.x, y: f.y });
    },
    upd(g, f, c) {
      if (o.tether && f.t >= 3 && tetherLedge(g, f, o.tether * f.sc)) return 0;
      airDrift(f, c, o.drift || 5);
      if (o.hold && f.t < o.hold) f.vy = -(o.vy || 15);
      const H = o.hb;
      if (H && f.t >= (H.a || 0) && f.t <= H.b) hitArea(g, f, 0, -f.h * (H.y !== undefined ? H.y : 0.8), (H.r || 30) * f.sc, H.d, H.k, H.g, H.ang, { every: H.every, radial: H.radial });
      if (o.fin && f.t === o.fin.at) { f.hits = {}; const F = o.fin; hitArea(g, f, 0, -f.h * 0.6, (F.r || 40) * f.sc, F.d, F.k, F.g, F.ang, { radial: true }); }
      if (o.trail && f.t % 3 === 0 && f.t < (o.hold || 16)) g.ev.push({ t: o.trail, x: f.x, y: f.y - 8, dir: 0 });
      return f.t >= (o.end || 26) ? (o.free ? 1 : 2) : 0;
    },
  };
}
// plunge down (or hop and slam on the ground) with a landing shockwave
function spSlam(o) {
  return {
    fall: o.fallV || 20,
    start(g, f, c) { f.vx = 0; f.vy = c.onG ? -9 : -3; f.gi = -1; f.t2 = 0; },
    upd(g, f) {
      if (f.t < 14) { f.vy *= 0.6; f.vx = 0; return 0; }
      if (f.gi < 0 && !f.t2) {
        f.vy = o.fallV || 18; f.vx *= 0.8;
        const D = o.dive;
        hitArea(g, f, 0, -6, 28 * f.sc, D.d, D.k, D.g, D.ang);
        return f.t > 150 ? 2 : 0;
      }
      if (!f.t2) {
        f.t2 = 1; f.hits = {};
        const S = o.wave;
        hitArea(g, f, 0, -12, S.r * f.sc, S.d, S.k, S.g, S.ang, { radial: true });
        g.ev.push({ t: 'boom', x: f.x, y: f.y, s: S.r / 100, star: !!CH[f.ch].yoshi, k: o.ev });
      }
      f.t2++;
      return f.t2 > 14 ? 1 : 0;
    },
  };
}
// area blasts around the user at the listed frames (optionally pulling foes in first)
function spPulse(o) {
  return {
    start(g, f) { if (!useCd(f, o.slot || 'd', o.cd)) return false; f.vx *= 0.3; if (o.ev) g.ev.push({ t: o.ev, x: f.x, y: f.y - f.h * 0.5, dir: f.fc }); },
    upd(g, f, c) {
      f.vx *= 0.8; if (!c.onG) f.vy = Math.min(f.vy, o.hover || 2);
      if (o.reflect && f.t >= o.reflect[0] && f.t <= o.reflect[1]) reflect(g, f, f.x, f.y - f.h * 0.5, 54);
      if (o.pull && f.t >= o.pull[0] && f.t < o.pull[1]) {
        for (const v of g.fighters) {
          if (v === f || ally(g, f, v) || !hittable(v)) continue;
          const dx = f.x - v.x, dy = f.y - f.h / 2 - (v.y - v.h / 2), L = Math.hypot(dx, dy);
          if (L < o.pr && L > 14) { v.vx = clamp(v.vx + (dx / L) * 1.1, -8, 8); v.vy = clamp(v.vy + (dy / L) * 0.8, -8, 8); }
        }
      }
      for (const P of o.at) {
        if (f.t !== P.t) continue;
        f.hits = {};
        hitArea(g, f, (P.x || 0) * f.sc, -f.h * 0.5, P.r * f.sc, P.d, P.k, P.g, P.ang, { radial: !P.fwd, daze: P.daze, psn: P.psn, frz: P.frz });
        if (P.ev) g.ev.push({ t: P.ev, x: f.x + f.fc * (P.x || 0), y: f.y - f.h * 0.5, r: P.r, dir: f.fc });
      }
      return f.t >= (o.end || 30) ? 1 : 0;
    },
  };
}
// vanish and reappear some distance away
function spBlink(o) {
  return {
    start(g, f) {
      if (o.up) { if (f.upUsed) return false; f.upUsed = true; }
      else if (!useCd(f, o.slot || 's', o.cd || 40)) return false;
      f.vx = 0; f.vy = Math.min(f.vy, 0);
      g.ev.push({ t: 'poof', x: f.x, y: f.y - f.h / 2, k: o.puff });
    },
    upd(g, f, c) {
      f.ig = Math.max(f.ig, 2); f.vx = 0; f.vy = -GRAV;
      if (f.t === (o.at || 8)) {
        const dx = o.up ? c.dirX * (o.dx || 110) : f.fc * (o.dx || 170), dy = o.up ? -(o.dy || 190) : 0;
        f.x = clamp(f.x + dx, BLAST.l + 140, BLAST.r - 140); f.y = Math.max(BLAST.t + 160, f.y + dy); f.gi = -1;
        g.ev.push({ t: 'poof', x: f.x, y: f.y - f.h / 2, k: o.puff });
      }
      return f.t >= (o.end || 16) ? (o.up ? 2 : 1) : 0;
    },
  };
}
// slow, steerable rise; not helpless afterwards
function spFloat(o) {
  return {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.gi = -1; f.vy = Math.min(f.vy, -2); },
    upd(g, f, c) {
      airDrift(f, c, o.drift || 5);
      if (f.t < o.frames) {
        f.vy = Math.max(f.vy - 0.9, -(o.rise || 4));
        if (o.ig && f.t < o.ig) f.ig = Math.max(f.ig, 2);
        if (f.t % 6 === 0) g.ev.push({ t: o.ev || 'sparkle', x: f.x, y: f.y - f.h * 0.4 });
        return 0;
      }
      return 1;
    },
  };
}
// reach out (lasso, cane, bandage); a catch reels the foe in, then `fin` lands
function spTether(o) {
  return {
    start(g, f, c) { if (!useCd(f, o.slot || 's', o.cd)) return false; if (c.onG) f.vx *= 0.3; f.ctr = -1; f.slamT = 0; },
    upd(g, f, c) {
      f.vx *= 0.8; if (!c.onG) f.vy = Math.min(f.vy, 2);
      const a = o.a || 8, b = o.b || 14, reach = o.range * f.sc, cy = f.y - f.h * 0.55;
      if (f.ctr < 0 && f.t >= a && f.t <= b) {
        const ext = reach * Math.min(1, (f.t - a + 1) / Math.max(1, b - a));
        // off the stage, the line hooks the ledge instead
        if (o.ledge && !c.onG && tetherLedge(g, f, Math.min(ext + 30 * f.sc, o.ledge * f.sc))) return 0;
        for (const v of g.fighters) {
          if (v === f || ally(g, f, v) || !hittable(v)) continue;
          const dx = (v.x - f.x) * f.fc;
          if (dx < -10 || dx > ext + v.w / 2 || Math.abs(v.y - v.h / 2 - cy) > v.h / 2 + 16) continue;
          f.ctr = v.i; f.t2 = f.t; fsHold(v, v.x, v.y);
          g.ev.push({ t: 'grab', x: v.x, y: v.y - v.h / 2 });
          break;
        }
      }
      if (f.ctr >= 0) {
        const v = fighterBy(g, f.ctr);
        if (!v || !alive(v)) { f.ctr = -1; return 1; }
        // the catch is held (reeled in) for `hold` frames, then `fin` lands. With `slam`, still holding Special
        // when the hold ends turns it into the slam instead
        const k = f.t - f.t2, hold = o.hold || 12;
        if (o.slam && k === hold && c.bits & B_B) f.slamT = 1;
        if (f.slamT) return tetherSlam(g, f, v, o.slam);
        if (k < hold) fsHold(v, v.x + (f.x + f.fc * 34 - v.x) * 0.3, v.y + (f.y - v.y) * 0.3);
        else if (k === hold) {
          const F = o.fin;
          if (F.daze) applyHit(g, v, f, F.d * f.pm, 0.5, 0, 30, f.fc, { daze: F.daze });
          else applyHit(g, v, f, F.d * f.pm, F.k, F.g, F.ang, F.back ? -f.fc : f.fc, { psn: F.psn });
        }
        if (k >= hold + 10) { f.ctr = -1; return 1; }
        return 0;
      }
      return f.t >= (o.end || 30) ? 1 : 0;
    },
  };
}
// Subaru's Unseen Hand slam: lift the caught foe and smash them into the ground S.n times (S.d damage each),
// then throw them a set distance away (the throw's knockback doesn't grow with their damage)
function tetherSlam(g, f, v, S) {
  const t = f.slamT++, n = Math.floor(t / S.every), q = (t % S.every) / S.every;
  const gx = f.x + f.fc * 44, gy = f.y;
  if (n < S.n) {
    // up for most of each beat, then down hard
    const lift = q < 0.65 ? 70 * Math.sin(((q / 0.65) * Math.PI) / 2) : 70 * (1 - (q - 0.65) / 0.35);
    fsHold(v, gx, gy - lift);
    if (t % S.every === S.every - 1) {
      const d = S.d * f.pm;
      v.dm = Math.min(999, v.dm + d); f.dealt += d; v.lastHit = f.i; v.lastHitT = g.frame;
      g.ev.push({ t: 'slam', x: gx, y: gy, n: n + 1 });
    }
    return 0;
  }
  if (t === S.n * S.every) {
    applyHit(g, v, f, S.throwD * f.pm, S.k, 0, S.ang, f.fc, { fixed: true, mv: 's:unseenslam', use: f.use });
    g.ev.push({ t: 'slamthrow', x: v.x, y: v.y - v.h / 2 });
  }
  if (t >= S.n * S.every + 12) { f.ctr = -1; f.slamT = 0; return 1; }
  return 0;
}
// drop a trap on the ground in front
function spTrap(o) {
  return {
    start(g, f) { if (!useCd(f, o.slot || 'd', o.cd || 120)) return false; f.vx *= 0.3; },
    upd(g, f) {
      f.vx *= 0.8;
      if (f.t === (o.at || 10)) {
        if (o.one) for (const p of g.proj) if (p.k === 'trap' && p.o === f.i && p.sub === o.sub) p.t = p.life + 1;
        // a hanging trap (the piñata) stays up in the air where it was hung
        spawnProj(g, f, { k: 'trap', sub: o.sub, x: f.x + f.fc * (o.ox || 40) * f.sc, y: f.y - (o.hang || 12), landed: o.hang ? 1 : 0, vx: 0, vy: 0, grav: 0, d: 1, kb: 0, gr: 0, ang: 0, r: o.r || 40, life: o.life || 360 });
      }
      return f.t >= (o.end || 22) ? 1 : 0;
    },
  };
}
// block and riposte; `behind` teleports behind the attacker first (Log Substitution)
function spCounter(o) {
  return {
    counter: [3, o.win || 30],
    start(g, f) { f.vx *= 0.2; f.ctr = -1; f.ctrT = 0; },
    upd(g, f, c) {
      f.vx *= 0.8; if (!c.onG) f.vy = Math.min(f.vy, 1.5);
      if (f.ctrT > 0) {
        f.ctrT++;
        if (f.ctrT === (o.behind ? 3 : 5)) {
          const a = fighterBy(g, f.ctr);
          if (a) {
            if (o.behind) { g.ev.push({ t: 'log', x: f.x, y: f.y - f.h / 2 }); f.x = a.x - a.fc * 46; f.y = a.y; f.gi = -1; f.vy = 0; }
            f.fc = a.x >= f.x ? 1 : -1;
          }
          f.hits = {};
          hitArea(g, f, 36 * f.sc, -f.h * 0.5, 50 * f.sc, o.d || 13, o.k || 8, o.g || 0.16, o.ang || 38);
          g.ev.push({ t: 'slash', x: f.x + f.fc * 36, y: f.y - f.h * 0.5 });
        }
        return f.ctrT >= 24 ? 1 : 0;
      }
      return f.t >= (o.win || 30) + 14 ? 1 : 0;
    },
  };
}
// Beatrice's Minya: five crystal shards in a fan (the special itself, and a mid-Murak cast), 2.2 damage each.
// Its knockback grows with the foe's damage (gr), so it can still KO at high percents
const MINYA = { cd: 30, vys: [-2.4, -1.2, 0, 1.2, 2.4], p: { k: 'crystal', vx: 16.5, d: 2.2, kb: 4.5, gr: 0.072, ang: 35, r: 10, life: 54, ghost: 1, oy: 0.75 } };
function fireMinya(g, f, c) {
  f.cd.n = MINYA.cd;
  if (c.dirX) f.fc = c.dirX;
  for (const vy of MINYA.vys) {
    const P = MINYA.p;
    spawnProj(g, f, Object.assign({ grav: 0 }, P, { x: f.x + f.fc * 22 * f.sc, y: f.y - f.h * P.oy, vx: f.fc * P.vx, vy, fc: f.fc }));
  }
  g.ev.push({ t: 'beako', x: f.x, y: f.y - f.h - 34, s: 'Minya!', i: f.i });
}
// announce a special as it starts (Beatrice calling out her spell, Subaru's Unseen Hand)
function spCast(sp, ev, say) {
  const s0 = sp.start;
  return Object.assign({}, sp, {
    start(g, f, c) { const r = s0(g, f, c); if (r !== false) g.ev.push({ t: ev, x: f.x, y: f.y - f.h - 34, s: say, i: f.i }); return r; },
  });
}
// ---------- Emilia Toad (with the great spirit Puck) ----------
const EMI = {
  volleyCd: 126,                                          // 2.1 s between ice volleys
  pel: { n: 9, spd: 8.6, life: 600, d: 0.2, r: 9 },       // her pellets: 0.2 damage each, they last 10 s
  puck: { every: 420, shots: 3, gap: 7, range: 680, spd: 13 },
  soldierCd: 480, maxSoldiers: 4,
  pillar: { w: 54, H: 227, grow: 14, hp: 50, cd: 240 },
  barrier: { H: 124, hp: 30, cd: 300 },
};
// Emilia's Attack: nine ice pellets burst out in a fan, then each one hunts the foe nearest to it
function fireVolley(g, f) {
  const x0 = f.x + f.fc * 22 * f.sc, y0 = f.y - f.h * 0.62;
  for (let k = 0; k < EMI.pel.n; k++) {
    const a = ((-84 + k * 21) * Math.PI) / 180, sp = 6 + (k % 3) * 0.8;
    spawnProj(g, f, { k: 'icepel', x: x0, y: y0, vx: Math.cos(a) * f.fc * sp, vy: Math.sin(a) * sp, grav: 0, d: EMI.pel.d, kb: 0, gr: 0, ang: 0,
      r: EMI.pel.r, life: EMI.pel.life, ghost: 1, chip: 1, quiet: 1, ph: k * 0.9, sw: k % 2 ? 1 : -1 });
  }
  g.ev.push({ t: 'volley', x: x0, y: y0, i: f.i });
}
// the foe nearest to a point (not the owner, not someone still respawning)
function pelTarget(g, p) {
  let best = null, bd = 1e9;
  for (const v of g.fighters) {
    if (mineI(g, p.o, v.i) || !alive(v) || v.rp > 0) continue;
    const d = Math.hypot(v.x - p.x, v.y - v.h / 2 - p.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
// a way round the first platform or block between a pellet and its target: the nearest end of the platform, or
// a corner of the block, that the pellet can reach in a straight line (null when the way is clear)
function iceDetour(g, x0, y0, x1, y1) {
  let best = null, bt = 2;
  for (const s of g.surf) {
    if (s.gone || s.w <= 0) continue;
    if (s.solid) {
      const t = segRect(x0, y0, x1, y1, s.x - 6, s.y - 6, s.x + s.w + 6, s.y + s.h + 6);
      if (t >= 0 && t < bt) { bt = t; best = s; }
    } else {
      const dy = y1 - y0;
      if (Math.abs(dy) < 1e-6) continue;
      const t = (s.y - y0) / dy;
      if (t <= 0 || t >= 1) continue;
      const xc = x0 + (x1 - x0) * t;
      if (xc > s.x - 10 && xc < s.x + s.w + 10 && t < bt) { bt = t; best = s; }
    }
  }
  if (!best) return null;
  const s = best, m = 30;
  const C = s.solid ? [[s.x - m, s.y - m], [s.x + s.w + m, s.y - m], [s.x - m, s.y + s.h + m], [s.x + s.w + m, s.y + s.h + m]] : [[s.x - m, s.y], [s.x + s.w + m, s.y]];
  let w = null, wd = 1e9;
  for (const c of C) {
    if (Math.hypot(c[0] - x0, c[1] - y0) < 20) continue; // already at this corner: head for the next one
    if (s.solid && segRect(x0, y0, c[0], c[1], s.x, s.y, s.x + s.w, s.y + s.h) >= 0) continue;
    const d = Math.hypot(c[0] - x0, c[1] - y0) + Math.hypot(x1 - c[0], y1 - c[1]);
    if (d < wd) { wd = d; w = c; }
  }
  return w;
}
// each pellet homes on whichever foe is nearest to it right now (so they switch targets mid-flight), weaving from
// side to side as it flies, and steers round platforms and the stage instead of through them
function steerIcePel(g, p) {
  const tg = pelTarget(g, p);
  let tx, ty;
  if (tg) { tx = tg.x; ty = tg.y - tg.h * 0.5; }
  else { const own = fighterBy(g, p.o); tx = own ? own.x + Math.cos(p.t * 0.05 + p.ph) * 120 : p.x; ty = own ? own.y - 130 + Math.sin(p.t * 0.05 + p.ph) * 50 : p.y; }
  const w = iceDetour(g, p.x, p.y, tx, ty);
  if (w) { tx = w[0]; ty = w[1]; }
  const dx = tx - p.x, dy = ty - p.y, L = Math.hypot(dx, dy) || 1, early = p.t < 12;
  const spd = early ? 6.5 : EMI.pel.spd, turn = early ? 0.04 : 0.15;
  p.vx += ((dx / L) * spd - p.vx) * turn; p.vy += ((dy / L) * spd - p.vy) * turn;
  const s = Math.hypot(p.vx, p.vy) || 1, ux = -p.vy / s, uy = p.vx / s, wv = Math.sin(p.t * 0.21 + p.ph) * 0.85 * p.sw * Math.min(1, L / 90);
  p.vx += ux * wv; p.vy += uy * wv;
  const s2 = Math.hypot(p.vx, p.vy) || 1;
  p.vx *= spd / s2; p.vy *= spd / s2;
}
// Puck floats behind Emilia Toad's shoulder; every 7 seconds he holds out his paws and fires three quick ice shots
// at the nearest foe in range (his shots are snowflakes, hers are icicles)
function updPuck(g, f) {
  if (f.st === 'dead' || f.noPk) { f.pkx = undefined; return; } // (gone while he's the Beast of the End)
  const tx = f.x - f.fc * 46 * f.sc, ty = f.y - f.h - 22 + Math.sin(g.frame * 0.06 + f.i) * 6;
  if (f.pkx === undefined || Math.hypot(tx - f.pkx, ty - f.pky) > 420) { f.pkx = tx; f.pky = ty; f.pkc = Math.max(f.pkc || 0, 120); f.pks = 0; f.pkt = 99; }
  f.pkx += (tx - f.pkx) * 0.1; f.pky += (ty - f.pky) * 0.1;
  f.pkt++;
  if (f.pkc > 0) f.pkc--;
  if (g.phase !== 'play' || f.rp > 0) return;
  const me = { o: f.i, x: f.pkx, y: f.pky };
  if (f.pkc <= 0 && f.pks <= 0) {
    const tg = pelTarget(g, me);
    if (tg && Math.hypot(tg.x - f.pkx, tg.y - tg.h / 2 - f.pky) < EMI.puck.range) { f.pkc = EMI.puck.every; f.pks = EMI.puck.shots; f.pkt = 0; g.ev.push({ t: 'puck', x: f.pkx, y: f.pky, i: f.i }); }
  }
  if (f.pks > 0 && f.pkt >= 8 && (f.pkt - 8) % EMI.puck.gap === 0) {
    f.pks--;
    const tg = pelTarget(g, me);
    if (tg) {
      const dx = tg.x - f.pkx, dy = tg.y - tg.h * 0.5 - f.pky, L = Math.hypot(dx, dy) || 1, s = EMI.puck.spd;
      spawnProj(g, f, { k: 'puckpel', x: f.pkx + (dx / L) * 14, y: f.pky + (dy / L) * 14, vx: (dx / L) * s, vy: (dy / L) * s, grav: 0, d: 2.5, kb: 3, gr: 0.03, ang: 35, r: 9,
        life: 60, ghost: 1, home: 0.25, vmax: s, quiet: 1, fc: dx >= 0 ? 1 : -1 });
      g.ev.push({ t: 'puckshot', x: f.pkx, y: f.pky });
    }
  }
}
// Ice Spear: it flies straight until it skewers a foe, then carries them along, stunned, for 0.7 s and bursts.
// A foe who's on the ground when it bursts is frozen solid for a second; one in the air is blown away
function updSpear(g, p, iceOut) {
  const own = fighterBy(g, p.o) || { i: p.o, pm: p.pm, fc: p.fc, dealt: 0 }, dir = p.vx >= 0 ? 1 : -1;
  if (p.vic < 0) {
    p.x += p.vx;
    for (const s of g.surf) if (s.solid && !s.noLedge && p.x > s.x && p.x < s.x + s.w && p.y > s.y + 2 && p.y < s.y + s.h) { g.ev.push({ t: 'spearburst', x: p.x, y: p.y }); return true; }
    if (iceOut && shotVsIce(g, p)) { g.ev.push({ t: 'spearburst', x: p.x, y: p.y }); return true; }
    for (const v of g.fighters) {
      if (mineI(g, p.o, v.i) || !hittable(v) || !circRect(p.x, p.y, p.r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) continue;
      // a shield or a counter stops it cold
      if (!applyHit(g, v, own, p.d, 1, 0, 0, dir, { proj: true, mv: 'p:icespear', use: 'p' + p.id })) { g.ev.push({ t: 'spearburst', x: p.x, y: p.y }); return true; }
      p.vic = v.i; p.ct = 0; p.vx = dir * 7; p.life = p.t + 90;
      g.ev.push({ t: 'skewer', x: v.x, y: v.y - v.h * 0.5 });
      return false;
    }
    if (p.t > p.life) { g.ev.push({ t: 'spearburst', x: p.x, y: p.y }); return true; }
    return false;
  }
  const v = fighterBy(g, p.vic);
  if (!v || !alive(v)) { g.ev.push({ t: 'spearburst', x: p.x, y: p.y }); return true; }
  p.ct++;
  // driving them back, stunned
  if (v.st !== 'held' && v.st !== 'ledge') { v.st = 'hit'; v.hs = Math.max(v.hs, 4); v.at = null; v.sp = null; v.glide = 0; v.vx = p.vx; }
  p.x = v.x - dir * 18; p.y = v.y - v.h * 0.5;
  if (p.ct < 42) return false;
  if (v.gi >= 0) {
    applyHit(g, v, own, 6 * p.pm, 2, 0.01, 70, dir, { proj: true, mv: 'p:icespear2', use: 'p' + p.id });
    v.frz = 60; v.vx = 0; v.vy = 0;
    g.ev.push({ t: 'frozen', x: v.x, y: v.y - v.h * 0.5 });
  } else applyHit(g, v, own, 6 * p.pm, 7, 0.09, 40, dir, { proj: true, mv: 'p:icespear2', use: 'p' + p.id });
  g.ev.push({ t: 'spearburst', x: p.x, y: p.y });
  return true;
}
// ---- Emilia's ice pillar (lifts her up) and ice barrier (a wall that curves over her head). Both are solid while
// they stand. Foes' blows and shots chip away their HP (50 and 30), then they shatter. One of each per Emilia
function iceRects(s) {
  if (s.k === 'cradle') return [];
  if (s.k === 'pillar') return [{ x: s.x - s.w / 2, y: s.y - s.h, w: s.w, h: s.h, dy: s.t < EMI.pillar.grow ? -EMI.pillar.H / EMI.pillar.grow : 0 }];
  const H = s.h, R = [{ x: s.fc > 0 ? s.x + 30 : s.x - 48, y: s.y - H, w: 18, h: H, dy: 0 }];
  if (H > EMI.barrier.H * 0.85) R.push({ x: s.fc > 0 ? s.x - 26 : s.x - 52, y: s.y - H, w: 78, h: 16, dy: 0 });
  return R;
}
// (a Cradle is struck anywhere on its round wall, once it has risen)
const iceCircle = (s, cx, cy, r) => (s.k === 'cradle' ? s.h > 0 && circRect(cx, cy, r, s.x - s.r, s.y - s.h, s.r * 2, s.h) : iceRects(s).some(R => circRect(cx, cy, r, R.x, R.y, R.w, R.h)));
function updIce(g) {
  for (const s of g.ice.slice()) if (s.k === 'cradle') updCradle(g, s);
  for (const s of g.ice) {
    s.t++;
    if (s.k === 'cradle') { const C = WATER.cradle; s.h = s.t < C.rise ? 0 : C.H * Math.min(1, (s.t - C.rise) / 10); continue; }
    s.h = s.k === 'pillar' ? EMI.pillar.H * Math.min(1, s.t / EMI.pillar.grow) : EMI.barrier.H * Math.min(1, s.t / 10);
  }
}
function makeIce(g, f, k, x, y) {
  for (const s of g.ice.slice()) if (s.o === f.i && s.k === k) breakIce(g, s);
  const hp = k === 'pillar' ? EMI.pillar.hp : EMI.barrier.hp;
  const s = { id: g.pid++, k, o: f.i, x, y, fc: f.fc, w: k === 'pillar' ? EMI.pillar.w : 96, h: 0, t: 0, hp, max: hp };
  g.ice.push(s);
  return s;
}
function hurtIce(g, s, d) {
  if (s.hp <= 0) return;
  s.hp = Math.max(0, s.hp - d);
  g.ev.push({ t: 'icehit', x: s.k === 'pillar' || s.k === 'cradle' ? s.x : s.x + s.fc * 39, y: s.y - s.h * 0.6, k: s.k });
  if (s.hp <= 0) breakIce(g, s);
}
// (how: 'drain' = a Cradle running out or replaced, 'crystal' = shattered by El Minya)
function breakIce(g, s, how) {
  const i = g.ice.indexOf(s);
  if (i >= 0) g.ice.splice(i, 1);
  if (s.k === 'cradle') { g.ev.push({ t: 'cradleend', x: s.x, y: s.y, r: s.r, h: s.h, how: how || 'break' }); return; }
  g.ev.push({ t: 'iceshatter', x: s.k === 'pillar' ? s.x : s.x + s.fc * 18, y: s.y - s.h * 0.5, w: s.w, h: s.h, k: s.k });
}
// an ice barrier standing between an attacker and their target takes the blow (Emilia's own blows pass)
function iceShield(g, a, v) {
  for (const s of g.ice) {
    if (mineI(g, a.i, s.o)) continue;
    // a Cradle stops blows between someone inside it and someone outside
    if (s.k === 'cradle') { if (s.h >= WATER.cradle.H * 0.8 && insideCradle(s, a) !== insideCradle(s, v)) return s; continue; }
    if (s.k !== 'barrier') continue;
    for (const R of iceRects(s)) if (segRect(a.x, a.y - a.h * 0.5, v.x, v.y - v.h * 0.5, R.x, R.y, R.x + R.w, R.y + R.h) >= 0) return s;
  }
  return null;
}
// a shot that runs into a foe's ice or ice soldier damages it (and stops, unless it pierces)
function shotVsIce(g, p) {
  for (const s of g.ice) {
    if (mineI(g, p.o, s.o) || p.hits['ice' + s.id] !== undefined || !iceCircle(s, p.x, p.y, p.r)) continue;
    // a Cradle soaks up foes' shots and heals 2 (El Minya's crystals crystallize it instead)
    if (s.k === 'cradle') {
      p.hits['ice' + s.id] = g.frame;
      if (p.k === 'fsdrop' && p.sub === 'crystal') { crystalCradle(g, s); return true; }
      s.hp = Math.min(s.max, s.hp + 2); g.ev.push({ t: 'cradleheal', x: p.x, y: p.y });
      return true;
    }
    p.hits['ice' + s.id] = g.frame; hurtIce(g, s, p.d);
    return !p.pierce;
  }
  for (const q of g.proj) {
    if (q.k !== 'minion' || q.sub !== 'icesoldier' || mineI(g, p.o, q.o) || q.hp <= 0 || p.hits['m' + q.id] !== undefined) continue;
    if (!circRect(p.x, p.y, p.r, q.x - 15, q.y - 52, 30, 52)) continue;
    p.hits['m' + q.id] = g.frame; hurtSoldier(g, q, p.vx >= 0 ? 1 : -1);
    return !p.pierce;
  }
  return false;
}
// the highest ground right under (x, y), no more than maxD below it (not counting ice)
function groundBelow(g, x, y, maxD) {
  let best = null;
  for (const s of g.surf) {
    if (s.gone || s.ice || s.w <= 0 || x < s.x || x > s.x + s.w) continue;
    if (s.y >= y - 2 && s.y - y <= maxD && (best === null || s.y < best)) best = s.y;
  }
  return best;
}
// ---- Ice Soldiers: ice copies of Subaru Toad (no Beatrice) that fight on their own. One has two ice blades, the
// other a great ice axe; only those swings do damage. Their specials are all for moving: an ice dash (side), a leap
// (up), a slide that dodges (down; a fast fall in the air) and a blink that flanks behind the foe (neutral). Each
// one gets its own fighting style (which side it flanks from, how close it likes to stand, how fast it reacts), so
// the two don't move as one. They break after three hits (or a fall off the stage) and never melt on their own
const SOLDIER = {
  blades: { spd: 3.6, reach: 44, end: 30, cd: 40, hits: [{ a: 8, b: 10, x: 34, y: -28, r: 26, d: 3.5, k: 3, g: 0.02, ang: 45 }, { a: 16, b: 18, x: 36, y: -30, r: 27, d: 4, k: 6, g: 0.06, ang: 40 }] },
  axe: { spd: 3.0, reach: 52, end: 38, cd: 54, hits: [{ a: 14, b: 18, x: 40, y: -26, r: 32, d: 7, k: 7, g: 0.09, ang: 50 }] },
};
const isSoldier = q => q.k === 'minion' && q.sub === 'icesoldier' && q.hp > 0;
function spawnSoldiers(g, f) {
  for (const [dx, wp] of [[48, 'blades'], [-48, 'axe']]) {
    let x = f.x + f.fc * dx, gy = groundBelow(g, x, f.y - 40, 240);
    if (gy === null) { x = f.x; gy = groundBelow(g, x, f.y - 40, 240); }
    // its style: the side it flanks from, the spacing it keeps, how many frames it takes to react, how pushy it is
    const pers = { side: wp === 'blades' ? 1 : -1, off: 10 + Math.floor(RND() * 26), react: 4 + Math.floor(RND() * 7), aggro: 0.55 + RND() * 0.4 };
    spawnProj(g, f, { k: 'minion', sub: 'icesoldier', wp, x, y: gy !== null ? gy : f.y, vx: 0, vy: 0, d: 1, kb: 0, gr: 0, ang: 0, r: 22, grav: 0, life: 1e9,
      hp: 3, ms: 'spawn', mt: 0, gi: -1, acd: 20, ig: 26, rec: 0, adash: 0, drop: 0, hm: {}, fc: f.fc, quiet: 1,
      pers, think: 0, mv: 0, dcd: 60, scd: 30, bcd: 90, stuck: 0 });
  }
  g.ev.push({ t: 'icesummon', x: f.x, y: f.y, i: f.i });
}
function hurtSoldier(g, q, dir) {
  if (q.hp <= 0 || q.ig > 0 || q.inv > 0) return; // (a sliding or blinking soldier slips past hits)
  q.hp--; q.ig = 20; // (a moment between hits, so one blow or one quick combo can't break it all at once)
  q.ms = 'hurt'; q.mt = 0; q.vx = dir * 5; q.vy = -5; q.gi = -1; q.ff = 0;
  g.ev.push({ t: 'soldierhit', x: q.x, y: q.y - 26, hp: q.hp });
}
function soldierTarget(g, p) {
  let best = null, bd = 1000;
  for (const v of g.fighters) {
    if (mineI(g, p.o, v.i) || !alive(v) || v.rp > 0) continue;
    const d = Math.abs(v.x - p.x) + Math.abs(v.y - p.y) * 0.7;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function soldierStrike(g, p, own, n, h) {
  const cx = p.x + h.x * p.fc, cy = p.y + h.y, key = n + ':';
  for (const v of g.fighters) {
    if (mineI(g, p.o, v.i) || !hittable(v) || p.hm[key + v.i] || !circRect(cx, cy, h.r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) continue;
    p.hm[key + v.i] = 1; p.lhT = 30; // (so it can chase a foe it just launched)
    applyHit(g, v, own, h.d * p.pm, h.k, h.g, h.ang, p.fc, { proj: true });
  }
  for (const q of g.proj) {
    if (q === p || !isSoldier(q) || mineI(g, p.o, q.o) || p.hm[key + 'm' + q.id] || !circRect(cx, cy, h.r, q.x - 15, q.y - 52, 30, 52)) continue;
    p.hm[key + 'm' + q.id] = 1; hurtSoldier(g, q, p.fc);
  }
  for (const s of g.ice.slice()) if (!mineI(g, p.o, s.o) && !p.hm[key + 'i' + s.id] && iceCircle(s, cx, cy, h.r)) { p.hm[key + 'i' + s.id] = 1; hurtIce(g, s, h.d * p.pm); }
}
// a soldier's body: gravity, then the ground, platforms (it can drop through soft ones) and walls. Emilia's ice
// pillars and barriers only hold it up from above, like platforms, so it never gets stuck against them
function soldierPhysics(g, p) {
  p.vy = Math.min(p.vy + 0.6 * (g.gravK || 1), p.ff ? 14 : 11);
  const py = p.y, hw = 14, h = 50;
  p.x += p.vx; p.y += p.vy; p.gi = -1;
  for (let k = 0; k < g.surf.length; k++) {
    const s = g.surf[k];
    if (s.gone) continue;
    if (s.ice) {
      if (p.vy < 0 || p.drop > 0 || p.x < s.x - 4 || p.x > s.x + s.w + 4) continue;
      if (py <= s.y + 1 && p.y >= s.y) { p.y = s.y; p.vy = 0; p.gi = k; }
    } else if (s.solid) {
      if (p.x + hw <= s.x || p.x - hw >= s.x + s.w || p.y < s.y || p.y - h >= s.y + s.h) continue;
      if (py <= s.y + 1 && p.vy >= 0) { p.y = s.y; p.vy = 0; p.gi = k; }
      else if (py - h >= s.y + s.h - 1 && p.vy < 0) { p.y = s.y + s.h + h; p.vy = 0; }
      else { p.x = p.x < s.x + s.w / 2 ? s.x - hw : s.x + s.w + hw; p.vx = 0; }
    } else {
      if (p.vy < 0 || p.drop > 0 || p.x < s.x - 4 || p.x > s.x + s.w + 4) continue;
      if (py <= s.y + Math.abs(s.dy) + 1 && p.y >= s.y) { p.y = s.y; p.vy = 0; p.gi = k; }
    }
  }
}
// what a soldier sees coming at it: a foe winding up close by and facing it, or a shot flying its way. It
// answers with the side the danger comes from (-1 left, 1 right), or 0 when it's safe
function soldierThreat(g, p) {
  for (const v of g.fighters) {
    if (mineI(g, p.o, v.i) || !alive(v) || v.rp > 0) continue;
    const dx = p.x - v.x, busy = v.st === 'atk' || v.st === 'charge' || v.st === 'grab' || (v.st === 'spc' && v.t < 20);
    if (busy && Math.abs(dx) < 90 && Math.abs(v.y - p.y) < 70 && dx * v.fc >= 0) return dx > 0 ? -1 : 1;
  }
  for (const q of g.proj) {
    if (mineI(g, p.o, q.o) || q.k === 'minion' || !(q.d > 0) || Math.abs(q.vx) < 1) continue;
    const dx = p.x - q.x, dy = p.y - 26 - q.y;
    if (Math.abs(dy) < 46 && Math.abs(dx) < 130 && dx * q.vx > 0) return dx > 0 ? -1 : 1;
  }
  return 0;
}
// a spot on the floor on one side of someone, for a blink to land on (null when there's no floor there)
function blinkSpot(g, v, side) {
  for (const dx of [44, 70, 26]) {
    const x = v.x + side * dx, gy = groundBelow(g, x, v.y - 90, 280);
    if (gy !== null) return { x, y: gy };
  }
  return null;
}
// (it won't dash or slide off the main stage)
const edgeSafe = (p, under, dir, dist) => !under || !under.solid || (dir > 0 ? p.x + dist < under.x + under.w : p.x - dist > under.x);
// start one of a soldier's moves. Only its swing ('atk') hurts anyone; the rest just move it around
function soldierMove(g, p, kind, dir) {
  if (dir) p.fc = dir;
  p.ms = kind; p.mt = 0;
  switch (kind) {
    case 'atk': p.hm = {}; break;
    case 'jump': p.ms = 'air'; p.vy = -14.6; p.gi = -1; g.ev.push({ t: 'soldierhop', x: p.x, y: p.y }); break;
    case 'leap': if (p.gi < 0) p.rec = 1; p.vy = -16; p.gi = -1; if (dir) p.vx = dir * Math.max(Math.abs(p.vx), 2.5); g.ev.push({ t: 'soldierhop', x: p.x, y: p.y, big: 1 }); break;
    case 'dash': p.dcd = 64; if (p.gi < 0) p.adash = 1; p.vy = Math.min(p.vy, 0); g.ev.push({ t: 'soldierdash', x: p.x, y: p.y - 22, fc: p.fc }); break;
    case 'slide': p.scd = 46; g.ev.push({ t: 'soldierslide', x: p.x, y: p.y, fc: p.fc }); break;
    case 'ff': p.ms = 'air'; p.ff = 1; p.vy = Math.max(p.vy, 10); break;
    case 'blink': p.bcd = 210; g.ev.push({ t: 'soldierblink', x: p.x, y: p.y - 26 }); break;
  }
}
// the brain, every few frames (each soldier at its own pace): dodge what's coming, keep its own spacing on its
// own side of the foe (never the same side as its partner), and use its moves to get around the stage
function soldierThink(g, p, A, P, own, onG, under, tg) {
  p.think = P.react + Math.floor(RND() * 5);
  p.mv = 0;
  // stuck against something: hop, and if that doesn't work, blink back next to Emilia
  if (p.stuck > 50 && p.bcd <= 0) { const s = blinkSpot(g, own, -own.fc || 1); if (s) { p.bx = s.x; p.by = s.y; p.stuck = 0; return soldierMove(g, p, 'blink'); } }
  if (p.stuck > 20 && onG) { p.stuck = 0; return soldierMove(g, p, 'jump'); }
  if (!tg) { const dx = own.x + P.side * 50 - p.x; p.mv = Math.abs(dx) > 30 ? Math.sign(dx) : 0; return; } // nobody to fight: stay by Emilia
  const dx = tg.x - p.x, dy = tg.y - p.y, adx = Math.abs(dx), mate = g.proj.find(q => q !== p && isSoldier(q) && q.o === p.o);
  let side = Math.sign(-dx) || P.side;
  if (mate && p.wp === 'blades' && Math.sign(mate.x - tg.x) === side && Math.abs(mate.x - p.x) < 110) side = -side; // the blades go around
  // (both stand well inside their reach: the blades up close, the axe out near the tip)
  const spot = tg.x + side * (A.reach * (p.wp === 'blades' ? 0.42 : 0.68) + P.off * 0.15), sx = spot - p.x;
  // a foe it just hit is flying up: leap after it
  if (p.lhT > 0 && dy < -50 && adx < 170 && (onG || !p.rec)) return soldierMove(g, p, 'leap', Math.sign(dx) || p.fc);
  // far away, or on the wrong side: blink over to its spot (or dash in along the floor)
  if (p.bcd <= 0 && (adx > 360 || (side !== Math.sign(-dx) && adx < 200)) && RND() < 0.7) {
    const s = blinkSpot(g, tg, side);
    if (s) { p.bx = s.x; p.by = s.y; return soldierMove(g, p, 'blink'); }
  }
  if (onG && p.dcd <= 0 && adx > 170 && adx < 420 && Math.abs(dy) < 70 && edgeSafe(p, under, Math.sign(dx), 130)) return soldierMove(g, p, 'dash', Math.sign(dx));
  // up and down
  if (onG && dy < -150 && adx < 200) return soldierMove(g, p, 'leap', Math.sign(dx) || p.fc);
  if (onG && dy < -70 && adx < 170) return soldierMove(g, p, 'jump');
  if (!onG && dy < -90 && adx < 160 && p.vy > -2 && !p.rec) return soldierMove(g, p, 'leap');
  if (onG && dy > 60 && adx < 230 && !under.solid) { p.drop = 14; p.gi = -1; return; }
  if (!onG && dy > 140 && adx < 90 && !p.ff) return soldierMove(g, p, 'ff');
  // walk to its spot; while its swing recharges, the axe backs off to the tip of its reach and the blades bob about
  p.mv = Math.abs(sx) > 8 ? Math.sign(sx) : 0;
  if (p.acd > 14 && adx < A.reach + 10) {
    if (p.wp === 'axe') p.mv = -Math.sign(dx);
    else if (onG && RND() < 0.25) soldierMove(g, p, 'jump');
  }
}
// getting out of the way (th = the side the danger comes from): sometimes a blink right behind whoever is
// attacking it, to hit back from there; otherwise a slide or a jump away on the ground, an ice dash in the air
function soldierDodge(g, p, th, tg, onG, under) {
  if (p.bcd <= 0 && tg && RND() < 0.4) { const s = blinkSpot(g, tg, Math.sign(tg.x - p.x) || 1); if (s) { p.bx = s.x; p.by = s.y; return soldierMove(g, p, 'blink'); } }
  if (onG && p.scd <= 0 && edgeSafe(p, under, -th, 90)) return soldierMove(g, p, 'slide', -th);
  if (onG) { soldierMove(g, p, 'jump'); p.vx = -th * 3; return; }
  if (!p.adash && p.dcd <= 0) soldierMove(g, p, 'dash', -th);
}
const SOLD_T = ['acd', 'drop', 'ig', 'inv', 'dcd', 'scd', 'bcd', 'lhT'];
const SOLD_FREE = { idle: 1, run: 1, air: 1 };
function updSoldier(g, p) {
  const own = fighterBy(g, p.o);
  // broken (three hits, or Emilia is out of the match): it shatters into ice
  if (!own || own.out || p.hp <= 0) { g.ev.push({ t: 'soldierbreak', x: p.x, y: p.y - 26 }); return true; }
  const A = SOLDIER[p.wp] || SOLDIER.blades, main = STG[g.stage].solids[0], P = p.pers || { side: 1, off: 20, react: 6, aggro: 0.7 };
  p.mt++;
  for (const k of SOLD_T) if (p[k] > 0) p[k]--;
  // riding a moving platform
  const under = p.gi >= 0 ? g.surf[p.gi] : null, onG = !!under;
  if (under) { p.x += under.dx; p.y += under.dy; p.adash = 0; p.rec = 0; p.ff = 0; }
  const end = n => { if (p.mt >= n) { p.ms = 'idle'; p.mt = 0; } };
  // neutral move, the blink: it melts into mist for a moment, then forms again on its new spot
  if (p.ms === 'blink' && p.mt < 8) {
    p.inv = 2;
    if (p.mt === 7) { p.x = p.bx; p.y = p.by; p.vx = 0; p.vy = 0; p.gi = -1; g.ev.push({ t: 'soldierblink', x: p.x, y: p.y - 26, back: 1 }); }
    return false;
  }
  switch (p.ms) {
    case 'spawn': end(26); break;
    case 'hurt': end(16); break;
    case 'blink': p.inv = 2; end(14); break;
    case 'atk':
      A.hits.forEach((h, n) => { if (p.mt >= h.a && p.mt <= h.b) soldierStrike(g, p, own, n, h); });
      if (p.mt === A.hits[0].a) g.ev.push({ t: 'soldierswing', x: p.x, y: p.y - 26, w: p.wp });
      if (p.mt >= A.end) { p.ms = 'idle'; p.mt = 0; p.acd = A.cd + Math.floor(RND() * 12); }
      break;
    case 'dash': p.vx = p.fc * (p.mt < 9 ? 11.5 : 6); if (p.mt < 9) p.vy = Math.min(p.vy, 0.4); end(14); break; // side: a burst of speed (once in the air)
    case 'slide': p.vx = p.fc * Math.max(2.5, 10.5 - p.mt * 0.5); if (p.mt < 15) p.inv = 2; end(18); break; // down: a low slide under attacks
    case 'leap': end(12); break; // up: a big leap, also its way back to the stage
    default: {
      const tg = soldierTarget(g, p);
      // danger coming: it reacts a moment later (each soldier at its own speed), once per danger
      const th = soldierThreat(g, p);
      // (p.seen: 0 = all clear, > 0 = the frame it will react on, < 0 = it reacted on frame -p.seen; a foe that
      // keeps on swinging gets a fresh reaction after a while)
      if (!th || (p.seen < 0 && g.frame + p.seen > 24)) p.seen = 0;
      if (th && !p.seen) p.seen = g.frame + Math.ceil(P.react / 2);
      else if (th && p.seen > 0 && g.frame >= p.seen) { p.seen = -g.frame; if (RND() < 0.85) soldierDodge(g, p, th, tg, onG, under); }
      if (SOLD_FREE[p.ms] && p.think-- <= 0) soldierThink(g, p, A, P, own, onG, under, tg);
      if (SOLD_FREE[p.ms]) {
        if (tg) {
          const dx = tg.x - p.x, adx = Math.abs(dx);
          if (adx < 240 && adx > 4) p.fc = dx > 0 ? 1 : -1; else if (p.mv) p.fc = p.mv;
          if (adx < A.reach && Math.abs(tg.y - p.y) < 50 && p.acd <= 0 && RND() < P.aggro * 0.45) soldierMove(g, p, 'atk', dx > 0 ? 1 : dx < 0 ? -1 : 0);
        } else if (p.mv) p.fc = p.mv;
      }
    }
  }
  let mv = SOLD_FREE[p.ms] ? p.mv || 0 : 0;
  // (they won't walk off the main stage)
  if (under && under.solid && ((mv < 0 && p.x < under.x + 22) || (mv > 0 && p.x > under.x + under.w - 22))) mv = 0;
  if (p.ms === 'atk' || p.ms === 'spawn' || p.ms === 'blink') p.vx *= 0.75;
  else if (p.ms !== 'hurt' && p.ms !== 'dash' && p.ms !== 'slide') p.vx += (mv * A.spd - p.vx) * (onG ? 0.3 : 0.08);
  // knocked off the stage: steer home, with a leap up and then an ice dash on the way
  const off = p.x < main.x - 2 || p.x > main.x + main.w + 2 || p.y > main.y + 6;
  if (!onG && off && p.ms !== 'hurt' && p.ms !== 'dash') {
    const home = p.x < main.x + main.w / 2 ? 1 : -1, edge = home > 0 ? main.x : main.x + main.w;
    if (p.ms !== 'leap') { p.vx += (home * 3.6 - p.vx) * 0.12; p.fc = home; }
    if (!p.rec && p.vy > 1 && p.y > main.y - 40) soldierMove(g, p, 'leap', home);
    else if (p.rec && !p.adash && p.vy > -3 && Math.abs(p.x - edge) > 50 && p.y > main.y - 120) soldierMove(g, p, 'dash', home);
  }
  // stuck: walking, but not getting anywhere
  p.stuck = mv && onG && Math.abs(p.x - (p.lx === undefined ? p.x : p.lx)) < 0.3 ? (p.stuck || 0) + 1 : 0; p.lx = p.x;
  soldierPhysics(g, p);
  if (p.gi >= 0) p.rec = 0;
  if (SOLD_FREE[p.ms]) p.ms = p.gi < 0 ? 'air' : Math.abs(p.vx) > 0.5 ? 'run' : 'idle';
  if (p.x < BLAST.l || p.x > BLAST.r || p.y > BLAST.b) { g.ev.push({ t: 'soldierbreak', x: clamp(p.x, BLAST.l + 60, BLAST.r - 60), y: clamp(p.y, BLAST.t + 60, BLAST.b - 60) }); return true; }
  return false;
}
// Ice Brand Arts: each use makes the next ice weapon in turn: a long sword, a great axe, a great hammer, a spear
const BRAND = ['sword', 'axe', 'hammer', 'spear'];
// a "not ready yet" puff when a move is still recharging
const fizzle = (g, f, s) => { g.ev.push({ t: 'fizzle', x: f.x, y: f.y - f.h * 0.6, s }); return false; };

// heal over time while holding still (Check-up)
function spHeal(o) {
  return {
    start(g, f) { if (!useCd(f, 'd', o.cd || 1200)) return false; f.vx *= 0.2; },
    upd(g, f, c) {
      f.vx *= 0.7; if (!c.onG) f.vy = Math.min(f.vy, 1);
      if (f.t % 5 === 0 && f.t <= o.frames) { f.dm = Math.max(0, f.dm - o.heal / (o.frames / 5)); g.ev.push({ t: 'heal', x: f.x, y: f.y - f.h }); }
      return f.t >= o.frames + 8 ? 1 : 0;
    },
  };
}

// ---------- Water Yoshi (Early Access) ----------
// Ebb & Flow builds Current (f.cur, 0 to 100). With none, holding Special charges it (5 seconds to full; you keep
// what you have when you let go or get hit). With any Current, Special releases ALL of it as one of five moves,
// picked by how much there is. Sea Dragon's Cradle uses it up too, for extra effects. Statuses: Scalded (10 s:
// burns 2% a second, and the victim's own hits do 20% less damage and knockback) and Sunk (5 s: 25% slower, and
// takes 10% more damage)
const WATER = {
  charge: 300, // frames from 0 to 100% Current
  spout: { vx: 11, vy: 0.8, grav: 0.16, d: 4, kb: 3, gr: 0.02, ang: 30, r: 9, life: 100 },
  puddle: { life: 180, r: 36, slip: 0.01, slipD: 40, slipStun: 360 },
  blast: { vx: 8.5, d: 12, kb: 4.5, gr: 0.035, ang: 12, r: 24, life: 80 },
  beam: { at: 12, on: 5, end: 34, len: 620, h: 22, d0: 18, d1: 25, kb: 6.5, gr: 0.07, grHi: 0.17, hiAt: 140, ang: 10 },
  whirl: { life: 420, d: 30, every: 15, pull: 1.7 },
  kame: { wind: 90, fire: 240, every: 6, d: 50, fin: 3.2, kb: 10, gr: 0.13, ang: 8, exec: 150, top: 142, scald: 600 },
  cradle: { r: 62, H: 112, rise: 30, life: 600, cd: 900, hp: 10, heal: 4, sunk: 300 },
  scald: 600, sunk: 300,
};
// the Release move for an amount of Current
const waterTier = c => (c >= 100 ? 'kame' : c >= 75 ? 'whirl' : c >= 50 ? 'beam' : c >= 25 ? 'blast' : 'spout');
// the 100% beam's box: from his hands, 1.2 times the main platform long, from the floor up to just under Toad Town's
// side platforms (used by the sim and the view)
function kameBox(g, f) {
  const s = STG[g.stage].solids[0], len = s.w * 1.2, x0 = f.x + f.fc * 26 * (f.sc || 1), K = WATER.kame;
  return { x: f.fc > 0 ? x0 : x0 - len, y: f.y - K.top, w: len, h: K.top + 4 };
}
// the 50-74% jet: a thin line straight out in front of him
function wbeamBox(f) {
  const B = WATER.beam, x0 = f.x + f.fc * 22 * (f.sc || 1), y0 = f.y - f.h * 0.56;
  return { x: f.fc > 0 ? x0 : x0 - B.len, y: y0 - B.h / 2, w: B.len, h: B.h };
}
const boxHits = (B, v) => v.x + v.w / 2 > B.x && v.x - v.w / 2 < B.x + B.w && v.y > B.y && v.y - v.h < B.y + B.h;
// 100% Current: he plants his feet for 1.5 s with his hands drawn back to his right hip, then pushes both palms forward
// and fires a huge, glowing, steaming beam for 4 s. It hits every 0.1 s (each tick stuns and holds foes in the beam),
// up to 50% in all, then a last blast sends them flying, and a foe over 150% by then is knocked out on the spot.
// Anyone it hurts is left Scalded
function kameUpd(g, f) {
  const K = WATER.kame, ft = f.t - K.wind;
  f.vx = 0; f.vy = 0;
  if (f.t === K.wind) g.ev.push({ t: 'kamefire', x: f.x, y: f.y - 70, dir: f.fc, i: f.i });
  if (ft < 0) return 0;
  const B = kameBox(g, f), ticks = Math.floor(K.fire / K.every), per = (K.d - K.fin) / ticks;
  if (ft < K.fire && ft % K.every === 0) {
    for (const v of g.fighters) {
      if (mineI(g, f.i, v.i) || !alive(v) || v.rp > 0 || !boxHits(B, v)) continue;
      if (applyHit(g, v, f, per * f.pm, 2.2, 0, 6, f.fc, { proj: true, fixed: true, mv: '', use: f.use }) !== false) {
        v.vx = f.fc * 0.9; v.vy = Math.min(v.vy, 0) * 0.3; v.scald = Math.max(v.scald || 0, K.scald);
        (f.kvic || (f.kvic = {}))[v.i] = 1;
      }
    }
  }
  if (ft === K.fire) {
    for (const i in f.kvic || {}) {
      const v = fighterBy(g, +i);
      if (!v || !alive(v)) continue;
      applyHit(g, v, f, K.fin * f.pm, K.kb, K.gr, K.ang, f.fc, { proj: true, mv: '', use: f.use });
      v.scald = Math.max(v.scald || 0, K.scald);
      if (v.dm > K.exec) { v.lastHit = f.i; v.lastHitT = g.frame; g.ev.push({ t: 'execute', x: v.x, y: v.y - v.h / 2 }); ko(g, v); }
    }
    f.kvic = null;
  }
  return ft >= K.fire + 16 ? 1 : 0;
}
// the lowest floor under someone in the air (or where they stand), for the whirlpool
function lowestBelow(g, f) {
  if (f.gi >= 0 && g.surf[f.gi]) return g.surf[f.gi].y;
  let best = null;
  for (const s of g.surf) if (!s.gone && !s.ice && !s.cloud && s.w > 0 && f.x >= s.x && f.x <= s.x + s.w && s.y >= f.y - 2 && (best === null || s.y > best)) best = s.y;
  return best;
}
// a Sea Dragon's Cradle: is this fighter inside its circle?
const insideCradle = (s, v) => Math.abs(v.x - s.x) < s.r && v.y > s.y - s.h - 4 && v.y <= s.y + 12;
function updCradle(g, s) {
  const C = WATER.cradle;
  if (s.t >= s.life) { breakIce(g, s, 'drain'); return; }
  if (s.h < C.H * 0.5) return;
  for (const v of g.fighters) {
    if (!alive(v) || Math.abs(v.x - s.x) > s.r + v.w / 2 || v.y < s.y - s.h - 4 || v.y - v.h > s.y + 4) continue;
    // (25%+ Current: foes who touch it are Sunk; 100%: healing water for Water Yoshi inside, 4% a second)
    if (s.lv >= 2 && !mineI(g, s.o, v.i)) v.sunk = Math.max(v.sunk || 0, C.sunk);
    if (s.lv >= 5 && v.i === s.o && (s.t - C.rise) % 60 === 0 && insideCradle(s, v) && v.dm > 0) { v.dm = Math.max(0, v.dm - C.heal); g.ev.push({ t: 'heal', x: v.x, y: v.y - v.h }); }
  }
}
// El Minya's crystals crystallize the Cradle the way they do platforms: the third one shatters it
function crystalCradle(g, s) {
  s.cr = (s.cr || 0) + 1;
  if (s.cr >= PLAT_HP) breakIce(g, s, 'crystal');
  else g.ev.push({ t: 'cradlecrack', x: s.x, y: s.y - s.h, n: s.cr });
}

// ---------- Nolan Toad (the player's own character: a deadbeat after college) ----------
// Rot Toss lobs a rotten leftover from under his bed; where it lands it leaves a stink cloud. Forbidden Dagger throws
// the Shirt (a year at the bottom of his backpack hardened it with mold): hold Special and it grows more mold and hits
// harder; at full mold it bursts into a stink you can smell from 10 feet away (about two and a half Toads round), but
// keep holding past that and the mold starts growing onto him. Mattress Launch springs him up off his old mattress.
// Under the Bed: he dives under it and pops out with whatever he finds down there. Everyone he KOs gets stamped
// LOW-TIER HUMAN. His finale turns the stage into his room
const NOLAN = {
  rot: { vx: 7, vy: -7.5, grav: 0.42, d: 5, kb: 4, gr: 0.05, ang: 45, r: 13, life: 160 },
  // a stink cloud: 1% every half second to foes inside (no flinching), and they move 15% slower in it
  cloud: { r: 46, life: 240, every: 30, d: 1, slow: 0.85 },
  // the Shirt: `full` frames of holding for full mold, `max` frames at the most (it's thrown by itself then); past full
  // mold he takes 1% every `self` frames (2% a second). The full-mold burst: radius `burst`, 1% a second for 3 seconds
  shirt: { full: 120, max: 240, self: 30, vx: 13.5, grav: 0.04, ang: 35, r: 16, life: 56, cd: 180, burst: 155, burstLife: 180, burstEvery: 60 },
  // Under the Bed: hidden (can't be touched) from `hide[0]` to `hide[1]`, pops out at `pop`; the finds' odds
  bed: { hide: [4, 34], pop: 34, end: 52, cd: 360, heal: 5, odds: [0.4, 0.75],
    ctrl: { vx: 10, vy: -4, grav: 0.32, d: 8, kb: 6, gr: 0.1, ang: 40, r: 14, life: 90 } },
  // the finale: 8 seconds in his room (1% every 40 frames to foes = 1.5% a second, 20% slower; he heals 1% a second),
  // then the title card for `card` frames
  room: { life: 480, card: 100, every: 40, d: 1, heal: 60, slow: 0.8 },
};
// the Shirt's damage and knockback for m frames of mold: a tap 5%, 1 second 10%, full mold (2 s) 16%, up to 20% at 4 s
function shirtHit(m) {
  const N = NOLAN.shirt, d = m <= 60 ? 5 + (5 * m) / 60 : m <= N.full ? 10 + (6 * (m - 60)) / (N.full - 60) : 16 + 4 * Math.min(1, (m - N.full) / (N.max - N.full));
  const k = Math.min(1, m / N.full);
  return { d, kb: 4 + 4 * k, gr: 0.06 + 0.1 * k };
}
// a stink cloud on the floor at (x, y) (or, `big`, the Shirt's burst, round the point where it hit)
function spawnStink(g, own, x, y, big) {
  const N = NOLAN, S = N.shirt;
  spawnProj(g, own, { k: 'trap', sub: 'stink', x, y, vx: 0, vy: 0, d: N.cloud.d, kb: 0, gr: 0, ang: 0, r: big ? S.burst : N.cloud.r, life: big ? S.burstLife : N.cloud.life,
    every: big ? S.burstEvery : N.cloud.every, big: big ? 1 : 0, cy: big ? y : y - 28, landed: 1, quiet: 1 });
  g.ev.push({ t: big ? 'shirtburst' : 'stinkcloud', x, y, r: big ? S.burst : N.cloud.r });
}

// ---------- Specials ----------
const SP = {
  // --- Toad ---
  turnip: {
    start(g, f, c) { if (c.onG) f.vx *= 0.3; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8;
      if (f.t === 12) {
        const r = RND(), kind = r < 0.04 ? 'bomb' : r < 0.16 ? 'stitch' : 'turnip';
        spawnProj(g, f, { k: kind === 'bomb' ? 'bomb' : 'turnip', face: kind, x: f.x + f.fc * 16 * f.sc, y: f.y - f.h * 0.7,
          vx: f.fc * 10.5 + c.dirX * 1.5, vy: -6, d: kind === 'stitch' ? 18 : 8, kb: 5, gr: 0.1, ang: 40, r: 14, grav: 0.42, life: 200 });
        g.ev.push({ t: 'pluck', x: f.x, y: f.y, s: kind === 'stitch' ? 'Stitchface!' : kind === 'bomb' ? 'Bob-omb!?' : '' });
      }
      return f.t >= 26 ? 1 : 0;
    },
  },
  toaddash: spDash({ cd: 30, speed: 11, startup: 5, frames: 14, hb: { x: 22, y: 0.62, r: 28, d: 10, k: 7, g: 0.12, ang: 40 }, lag: 12, ev: 'dash' }),
  sporespin: {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.vy = -16.5; f.vx *= 0.5; f.gi = -1; g.ev.push({ t: 'spin', x: f.x, y: f.y }); },
    upd(g, f, c) {
      airDrift(f, c, 4.5);
      if (f.t < 28) { f.vy = Math.min(f.vy, -16.5 + f.t * 0.45); hitArea(g, f, 0, -f.h * 0.6, 38 * f.sc, 2.5, 3, 0.01, 80, { every: 6 }); }
      if (f.t === 28) { f.hits = {}; hitArea(g, f, 0, -f.h * 0.6, 44 * f.sc, 5, 6, 0.12, 70, { radial: true }); }
      return f.t >= 34 ? 2 : 0;
    },
  },
  scream: {
    start(g, f) { f.vx *= 0.2; g.ev.push({ t: 'scream', x: f.x, y: f.y - f.h - 10, ch: f.ch }); },
    upd(g, f, c) {
      f.vx *= 0.85;
      if (!c.onG) f.vy = Math.min(f.vy, 2);
      if (f.t >= 6 && f.t <= 42) {
        const rad = Math.min(150, 40 + (f.t - 6) * 4) * f.sc;
        hitArea(g, f, 0, -f.h * 0.5, rad, 2, 8, 0.035, 35, { every: 14, radial: true });
        reflect(g, f, f.x, f.y - f.h * 0.5, rad);
      }
      return f.t >= 50 ? 1 : 0;
    },
  },
  // --- Blue Toad ---
  iceball: {
    start(g, f) { if (f.cd.n > 0) return false; f.cd.n = 35; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8;
      if (f.t === 8) spawnProj(g, f, { k: 'ice', x: f.x + f.fc * 20 * f.sc, y: f.y - f.h * 0.5, vx: f.fc * 7.5, vy: -2, d: 6, kb: 3, gr: 0.06, ang: 50, r: 13, grav: 0.45, life: 110, frz: true, bounce: 6 });
      return f.t >= 22 ? 1 : 0;
    },
  },
  iceslide: spDash({ cd: 40, speed: 10, startup: 4, frames: 22, hb: { x: 18, y: 0.25, r: 26, d: 6, k: 4, g: 0.05, ang: 60, frz: true }, lag: 10, trail: 'icetrail' }),
  propeller: {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.vy = -19; f.vx *= 0.4; f.gi = -1; g.ev.push({ t: 'prop', x: f.x, y: f.y }); },
    upd(g, f, c) {
      airDrift(f, c, 4.5);
      if (f.t < 14) hitArea(g, f, 0, -f.h - 10 * f.sc, 30 * f.sc, 5, 6, 0.1, 85);
      if (f.t >= 18 && f.vy >= 0) { f.glide = 0.18; return 2; }
      return f.t > 60 ? 2 : 0;
    },
  },
  pound: spSlam({ dive: { d: 11, k: 4, g: 0.13, ang: -75 }, wave: { r: 85, d: 6, k: 6, g: 0.09, ang: 55 } }),
  // --- Yellow Toad ---
  fireball: {
    start(g, f) { if (f.cd.n > 0) return false; f.cd.n = 24; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8;
      if (f.t === 6) spawnProj(g, f, { k: 'fire', x: f.x + f.fc * 20 * f.sc, y: f.y - f.h * 0.5, vx: f.fc * 8, vy: 1, d: 5, kb: 3, gr: 0.05, ang: 45, r: 12, grav: 0.5, life: 120, bounce: 7 });
      return f.t >= 18 ? 1 : 0;
    },
  },
  firedash: spDash({ cd: 40, speed: 12, startup: 4, frames: 14, hb: { x: 20, y: 0.5, r: 30, d: 4, k: 3, g: 0.02, ang: 50, every: 5 }, fin: { x: 30, d: 7, k: 8, g: 0.12, ang: 40 }, lag: 10, trail: 'flame' }),
  superjump: {
    start(g, f, c) { if (f.upUsed) return false; f.upUsed = true; f.vy = -20; f.vx = c.dirX * 3; f.gi = -1; g.ev.push({ t: 'djump', x: f.x, y: f.y }); },
    upd(g, f, c) {
      airDrift(f, c, 4);
      if (f.t < 16) hitArea(g, f, 0, -f.h, 28 * f.sc, 7, 6, 0.11, 85);
      return f.t >= 24 ? 2 : 0;
    },
  },
  // --- Green Toad ---
  boomerang: {
    start(g, f) { if (f.cd.n > 0) return false; f.cd.n = 70; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8;
      if (f.t === 8) spawnProj(g, f, { k: 'boom', x: f.x + f.fc * 20, y: f.y - f.h * 0.55, vx: f.fc * 13, vy: 0, d: 6, kb: 4, gr: 0.07, ang: 40, r: 16, grav: 0, life: 120, dir0: f.fc });
      return f.t >= 20 ? 1 : 0;
    },
  },
  tailwhip: spPulse({ slot: 's', cd: 30, reflect: [4, 14], at: [{ t: 7, r: 48, d: 8, k: 8, g: 0.12, ang: 40 }], end: 22 }),
  tanooki: {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.gi = -1; },
    upd(g, f, c) {
      airDrift(f, c, 5);
      if (f.t === 1 || f.t === 15 || f.t === 29 || f.t === 43) { f.vy = -11; f.hits = {}; g.ev.push({ t: 'flutter', x: f.x, y: f.y }); }
      if (f.t % 15 < 8) hitArea(g, f, -22 * f.sc, -f.h * 0.3, 32 * f.sc, 4, 5, 0.08, 60, { radial: true });
      return f.t >= 58 ? 2 : 0;
    },
  },
  counter: spCounter({ win: 32 }),
  // --- Purple Toad ---
  poison: {
    start(g, f) { if (f.cd.n > 0) return false; f.cd.n = 50; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8;
      if (f.t === 8) spawnProj(g, f, { k: 'psn', x: f.x + f.fc * 20, y: f.y - f.h * 0.5, vx: f.fc * 6.5, vy: -3, d: 4, kb: 3, gr: 0.04, ang: 45, r: 14, grav: 0.5, life: 160, psn: true });
      return f.t >= 20 ? 1 : 0;
    },
  },
  haze: spShot({ slot: 's', cd: 80, at: 10, end: 24, p: { k: 'haze', vx: 1.6, d: 2, kb: 0.5, gr: 0, ang: 60, r: 34, life: 200, pierce: 1, every: 40, psn: true, ghost: 1 } }),
  cloud: {
    start(g, f) {
      if (f.upUsed) return false;
      f.upUsed = true; f.gi = -1;
      if (f.cd.u <= 0) { g.clouds.push({ x: f.x - 60, y: f.y + 6, w: 120, life: 300, o: f.i }); f.cd.u = 420; f.vy = -15; f.t2 = 1; }
      else { f.vy = -15; f.t2 = 0; }
      g.ev.push({ t: 'cloud', x: f.x, y: f.y });
    },
    upd(g, f, c) { airDrift(f, c, 5); return f.t >= 12 ? (f.t2 ? 1 : 2) : 0; },
  },
  pounce: {
    start(g, f, c) { if (f.cd.d > 0) return false; f.cd.d = 40; f.vx = f.fc * 11; f.vy = c.onG ? -7 : 3; f.gi = -1; g.ev.push({ t: 'pounce', x: f.x, y: f.y }); },
    upd(g, f) {
      if (f.t >= 3 && f.t <= 24) hitArea(g, f, 26 * f.sc, -f.h * 0.45, 30 * f.sc, 9, 5, 0.11, 38);
      if (f.t > 6 && f.gi >= 0) { f.vx *= 0.5; return 1; }
      return f.t >= 30 ? 1 : 0;
    },
  },
  // --- Toadette ---
  pigspin: {
    start() {},
    upd(g, f, c) {
      f.vx = f.fc * 3.2 + c.dirX * 0.8;
      if (!c.onG) f.vy = Math.min(f.vy, 1.5);
      if (f.t < 36) hitArea(g, f, 0, -f.h * 0.5, 40 * f.sc, 2, 2.5, 0.008, 70, { every: 7 });
      if (f.t === 36) { f.hits = {}; hitArea(g, f, 0, -f.h * 0.5, 46 * f.sc, 5, 6, 0.12, 45, { radial: true }); }
      if (f.t >= 36) f.vx *= 0.5;
      return f.t >= 42 ? 1 : 0;
    },
  },
  pigwhip: spPulse({ slot: 's', cd: 20, at: [{ t: 10, x: 58, r: 26, d: 11, k: 8, g: 0.13, ang: 38, fwd: 1 }], end: 26 }),
  float: {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.vy = f.pe ? -19 : -17; f.gi = -1; g.ev.push({ t: 'float', x: f.x, y: f.y }); },
    upd(g, f, c) {
      airDrift(f, c, 4.5);
      if (f.t < 12) hitArea(g, f, 0, -f.h, 30 * f.sc, 6, 6, 0.1, 85);
      if (f.t >= 16 && f.vy >= 0) { f.glide = 0.12; return f.pe ? 1 : 2; }
      return f.t > 60 ? 2 : 0;
    },
  },
  crown: {
    start(g, f) {
      if (f.pe > 0) f.t2 = 1;
      else { if (f.cd.d > 0) return false; f.t2 = 0; f.cd.d = 1500; }
      f.vx *= 0.2;
    },
    upd(g, f, c) {
      f.vx *= 0.85;
      if (!c.onG) f.vy = Math.min(f.vy, 1);
      if (!f.t2) {
        if (f.t === 24) { f.pe = 720; f.jl = airJumps(f); g.ev.push({ t: 'crown', x: f.x, y: f.y - f.h }); }
        return f.t >= 36 ? 1 : 0;
      }
      if (f.t === 8) { hitArea(g, f, 0, -f.h * 0.5, 100 * f.sc, 7, 7, 0.1, 50, { radial: true }); g.ev.push({ t: 'hearts', x: f.x, y: f.y - f.h * 0.5 }); }
      return f.t >= 28 ? 1 : 0;
    },
  },
  // --- Captain Toad ---
  turnips: {
    start() {},
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8;
      if (f.t === 6) spawnProj(g, f, { k: 'turnip', face: 'turnip', x: f.x + f.fc * 16, y: f.y - f.h * 0.7, vx: f.fc * 9.5, vy: -6, d: 6, kb: 4, gr: 0.08, ang: 40, r: 13, grav: 0.42, life: 200 });
      return f.t >= 16 ? 1 : 0;
    },
  },
  // the headlamp dazzles anyone in front of Captain Toad
  headlamp: {
    start(g, f) { if (!useCd(f, 's', 140)) return false; f.vx *= 0.2; },
    upd(g, f) {
      f.vx *= 0.8;
      if (f.t === 10) {
        g.ev.push({ t: 'flash', x: f.x + f.fc * 30, y: f.y - f.h * 0.85, dir: f.fc });
        for (const v of g.fighters) {
          if (v === f || ally(g, f, v) || !hittable(v)) continue;
          const dx = (v.x - f.x) * f.fc, dy = Math.abs(v.y - v.h / 2 - (f.y - f.h * 0.75));
          if (dx > 0 && dx < 200 && dy < 34 + dx * 0.45) applyHit(g, v, f, 3 * f.pm, 1, 0, 30, f.fc, { daze: 55 });
        }
      }
      return f.t >= 28 ? 1 : 0;
    },
  },
  boost: {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.gi = -1; },
    upd(g, f, c) {
      airDrift(f, c, 6);
      if (f.t < 22) {
        f.vy = -13;
        if (f.t % 3 === 0) g.ev.push({ t: 'smoke', x: f.x - f.fc * 16, y: f.y - 14 });
        hitArea(g, f, 0, 8, 26 * f.sc, 4, 4, 0.04, -60, { every: 8 });
      }
      return f.t >= 26 ? 2 : 0;
    },
  },
  pickaxe: {
    start(g, f) { if (f.cd.d > 0 || f.pick > 0) return false; f.cd.d = 1000; f.vx *= 0.2; },
    upd(g, f) {
      f.vx *= 0.8;
      if (f.t === 14) { f.pick = 300; g.ev.push({ t: 'say', x: f.x, y: f.y - f.h - 20, s: 'Pickaxe!' }); }
      return f.t >= 20 ? 1 : 0;
    },
  },
  // --- Toadsworth ---
  scold: {
    start(g, f) { if (f.cd.n > 0) return false; f.cd.n = 45; },
    upd(g, f) {
      f.vx *= 0.8;
      if (f.t === 8) g.ev.push({ t: 'say', x: f.x + f.fc * 30, y: f.y - f.h - 20, s: 'Oh my!', snd: 'scold' });
      if (f.t >= 10 && f.t <= 18) hitArea(g, f, 56 * f.sc, -f.h * 0.5, 48 * f.sc, 5, 8, 0.05, 28, { stun: 22 });
      return f.t >= 30 ? 1 : 0;
    },
  },
  canehook: spTether({ cd: 36, range: 84, ledge: 120, a: 9, b: 13, fin: { d: 9, k: 8, g: 0.12, ang: 40 } }),
  parasol: {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.vy = -17.5; f.gi = -1; g.ev.push({ t: 'float', x: f.x, y: f.y }); },
    upd(g, f, c) {
      airDrift(f, c, 4);
      if (f.t < 14) hitArea(g, f, 0, -f.h - 8, 32 * f.sc, 6, 6, 0.1, 85, { every: 5 });
      if (f.t >= 18 && f.vy >= 0) { f.glide = 0.16; return 2; }
      return f.t > 60 ? 2 : 0;
    },
  },
  brigade: {
    start(g, f) { if (f.cd.d > 0) return false; f.cd.d = 540; f.vx *= 0.2; },
    upd(g, f) {
      f.vx *= 0.8;
      if (f.t === 10) {
        const kinds = ['mail', 'bank', 'hint'], sub = kinds[Math.floor(RND() * 3)];
        spawnProj(g, f, { k: 'minion', sub, x: f.x + f.fc * 34, y: f.y - 2, vx: sub === 'mail' ? f.fc * 6 : 0, vy: -4, d: 1, kb: 0, gr: 0, ang: 0, r: 20, grav: 0.6,
          life: sub === 'hint' ? 300 : sub === 'bank' ? 200 : 170, fc: f.fc });
        const lines = { mail: 'Mailtoad: Special delivery!', bank: 'Banktoad: Coins away!', hint: 'Hint Toad: Stand back!' };
        g.ev.push({ t: 'say', x: f.x, y: f.y - f.h - 20, s: 'Brigade, assemble!', snd: 'brigade' });
        g.ev.push({ t: 'say', x: f.x + f.fc * 40, y: f.y - f.h - 50, s: lines[sub] });
      }
      return f.t >= 22 ? 1 : 0;
    },
  },
  // --- Yoshi ---
  egg: {
    start(g, f) { if (f.cd.n > 0) return false; f.cd.n = 30; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8;
      if (f.t === 10) spawnProj(g, f, { k: 'egg', x: f.x + f.fc * 16, y: f.y - f.h * 0.75, vx: f.fc * 8 + c.dirX * 2, vy: -9, d: 9, kb: 6, gr: 0.1, ang: 60, r: 14, grav: 0.45, life: 200 });
      return f.t >= 24 ? 1 : 0;
    },
  },
  // roll along inside an egg; steer with left/right, jump out with up
  eggroll: {
    start(g, f) { if (!useCd(f, 's', 50)) return false; f.vx = f.fc * 4; },
    upd(g, f, c) {
      if (f.t < 8) return 0;
      if (c.dirX) f.fc = c.dirX;
      f.vx = clamp(f.vx + f.fc * 0.7, -10, 10);
      hitArea(g, f, 0, -f.h * 0.4, 32 * f.sc, 8, 7, 0.1, 45, { every: 18 });
      if (f.t > 16 && c.pressed & B_U && c.onG) { f.vy = -12; f.gi = -1; }
      if (f.t > 16 && c.pressed & B_B) return 1;
      return f.t >= 70 ? 1 : 0;
    },
  },
  flutter: {
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.gi = -1; if (f.vy > 0) f.vy = 0; },
    upd(g, f, c) {
      airDrift(f, c, 5);
      if (f.t < 42) {
        f.vy = Math.max(f.vy - 1.4, -7);
        if (f.t % 8 === 0) { hitArea(g, f, 0, 0, 28 * f.sc, 3, 4, 0.05, 70, { every: 8 }); g.ev.push({ t: 'flutter', x: f.x, y: f.y }); }
      }
      return f.t >= 46 ? 1 : 0;
    },
  },
  yoshipound: spSlam({ dive: { d: 11, k: 4, g: 0.13, ang: -75 }, wave: { r: 85, d: 6, k: 6, g: 0.09, ang: 55 } }),
  // --- Pirate Toad ---
  cannon: spShot({ cd: 50, at: 14, end: 32, recoil: 3, ev: 'cannon', p: { k: 'cannon', vx: 7.5, vy: -5, grav: 0.3, d: 12, kb: 8, gr: 0.13, ang: 40, r: 16, life: 160, explode: { r: 50, d: 6, k: 6, g: 0.08 } } }),
  cutlass: spDash({ cd: 30, speed: 12, startup: 4, frames: 12, hb: { x: 30, y: 0.5, r: 26, d: 3, k: 2, g: 0.01, ang: 60, every: 4 }, fin: { x: 34, d: 7, k: 8, g: 0.12, ang: 40 }, lag: 10 }),
  parrot: spRise({ vy: 7, hold: 50, drift: 5, end: 54, ev: 'parrot' }),
  anchor: spSlam({ fallV: 21, dive: { d: 12, k: 5, g: 0.12, ang: -75 }, wave: { r: 84, d: 9, k: 8, g: 0.1, ang: 60 }, ev: 'anchor' }),
  // --- Ninja Toad ---
  shuriken: spShot({ cd: 26, at: 6, end: 16, shots: [-1.3, 0, 1.3].map(vy => ({ k: 'shuriken', vx: 13, vy, d: 3, kb: 3, gr: 0.03, ang: 30, r: 10, life: 45, ghost: 1 })) }),
  shadowdash: spDash({ cd: 40, speed: 16, startup: 3, frames: 10, intang: true, hb: { x: 0, y: 0.5, r: 32, d: 9, k: 7, g: 0.11, ang: 40 }, lag: 12, ev: 'poof' }),
  smokeleap: spBlink({ up: true, dx: 110, dy: 200, at: 8, end: 18, puff: 'smoke' }),
  substitute: spCounter({ win: 28, behind: true, d: 12, k: 9, ang: 45 }),
  // --- Knight Toad ---
  shieldbash: spDash({ slot: 'n', cd: 30, speed: 5, startup: 4, frames: 16, guard: [1, 22], reflect: true, hb: { x: 30, y: 0.5, r: 30, d: 8, k: 8, g: 0.11, ang: 30 }, lag: 10 }),
  lance: spDash({ cd: 40, speed: 9, startup: 6, frames: 22, armor: true, hb: { x: 36, y: 0.5, r: 30, d: 13, k: 9, g: 0.15, ang: 35 }, lag: 14, trail: 'dust' }),
  swordspin: spRise({ vy: 15.5, hold: 6, end: 30, hb: { a: 2, b: 22, y: 0.5, r: 42, d: 2.5, k: 3, g: 0.01, ang: 80, every: 5 }, fin: { at: 24, r: 46, d: 6, k: 7, g: 0.12, ang: 70 } }),
  swordplant: spSlam({ fallV: 22, dive: { d: 13, k: 5, g: 0.13, ang: -80 }, wave: { r: 92, d: 10, k: 8, g: 0.11, ang: 60 }, ev: 'sword' }),
  // --- Chef Toad ---
  pancake: spShot({ cd: 24, at: 8, end: 20, p: { k: 'pancake', vx: 7.5, vy: -9, grav: 0.45, bounce: 5, bounces: 1, d: 7, kb: 5, gr: 0.08, ang: 50, r: 15, life: 120 } }),
  panswing: spDash({ cd: 26, speed: 1.5, startup: 6, frames: 8, guard: [3, 14], reflect: true, hb: { x: 36, y: 0.55, r: 32, d: 14, k: 9, g: 0.16, ang: 40 }, lag: 14, ev: 'pan' }),
  souffle: spRise({ vy: 15, hold: 8, end: 28, hb: { a: 1, b: 12, y: 1.0, r: 30, d: 7, k: 6, g: 0.1, ang: 85 }, trail: 'steam' }),
  soup: spTrap({ sub: 'soup', life: 360, r: 44, cd: 200, at: 12, ox: 46 }),
  // --- Wizard Toad ---
  starbolt: spShot({ cd: 34, at: 10, end: 24, ev: 'magic', p: { k: 'star', vx: 7, home: 0.35, vmax: 8, d: 8, kb: 6, gr: 0.09, ang: 45, r: 14, life: 130, ghost: 1 } }),
  blink: spBlink({ dx: 170, cd: 40, at: 6, end: 14, puff: 'magic' }),
  levitate: spFloat({ frames: 70, rise: 4.3, drift: 5, ev: 'sparkle' }),
  rune: spTrap({ sub: 'rune', life: 480, r: 34, cd: 150, one: true, at: 10, ox: 30 }),
  // --- Astro Toad ---
  raygun: spShot({ cd: 12, at: 5, end: 14, ev: 'laser', p: { k: 'laser', vx: 18, d: 3, kb: 2, gr: 0.02, ang: 20, r: 9, life: 40, ghost: 1 } }),
  jetdash: spDash({ cd: 30, speed: 13, startup: 3, frames: 14, hb: { x: 20, y: 0.5, r: 28, d: 6, k: 6, g: 0.08, ang: 40 }, lag: 10, trail: 'jet' }),
  jetlift: spRise({ vy: 13, hold: 22, end: 28, drift: 4.5, trail: 'jet', hb: { a: 0, b: 20, y: -0.15, r: 26, d: 3, k: 3, g: 0.04, ang: -70, every: 8 } }),
  gravwell: spPulse({ slot: 'd', cd: 150, pull: [6, 36], pr: 190, at: [{ t: 38, r: 80, d: 9, k: 8, g: 0.1, ang: 60, ev: 'pop' }], end: 50, hover: 1, ev: 'gravwell' }),
  // --- Doctor Toad ---
  vitamin: spShot({ cd: 28, at: 8, end: 20, p: { k: 'pill', vx: 6.5, vy: -5, grav: 0.5, bounce: 6, bounces: 3, d: 6, kb: 5, gr: 0.07, ang: 45, r: 12, life: 150 } }),
  bandage: spTether({ cd: 40, range: 62, a: 8, b: 13, fin: { d: 4, daze: 70 } }),
  pulsehop: spRise({ vy: 16, hold: 6, end: 28, hb: { a: 2, b: 10, y: 0.5, r: 40, d: 7, k: 7, g: 0.1, ang: 80, radial: true }, ev: 'zap' }),
  checkup: spHeal({ frames: 50, heal: 12, cd: 1200 }),
  // --- Rocker Toad ---
  powerchord: spShot({ cd: 40, at: 10, end: 26, ev: 'guitar', p: { k: 'note', vx: 9, d: 7, kb: 6, gr: 0.08, ang: 35, r: 22, grow: 0.4, life: 50, pierce: 1, ghost: 1 } }),
  stagedive: spDash({ cd: 40, speed: 10, startup: 6, frames: 30, hop: 8, arc: true, endOnLand: true, hb: { x: 16, y: 0.45, r: 30, d: 12, k: 8, g: 0.13, ang: 50 }, lag: 12 }),
  ampblast: spRise({ vy: 17, hold: 5, end: 28, fin: { at: 2, r: 62, d: 8, k: 8, g: 0.1, ang: 70 }, ev: 'amp' }),
  feedback: spTrap({ sub: 'amp', life: 95, r: 30, cd: 200, at: 12, ox: 36 }),
  // --- Cowboy Toad ---
  cork: spShot({ cd: 18, at: 5, end: 16, ev: 'cork', p: { k: 'cork', vx: 15, vy: -0.5, grav: 0.08, d: 5, kb: 6, gr: 0.06, ang: 30, r: 8, life: 34 } }),
  lasso: spTether({ cd: 50, range: 150, ledge: 180, a: 10, b: 16, fin: { d: 9, k: 9, g: 0.12, ang: 45, back: 1 } }),
  lassoswing: spRise({ vy: 15, hold: 8, end: 30, drift: 6, tether: 160, ev: 'lassoswing', hb: { a: 4, b: 14, y: 1.1, r: 32, d: 5, k: 6, g: 0.08, ang: 80 } }),
  tumbleweed: spShot({ slot: 'd', cd: 60, at: 10, end: 22, p: { k: 'tumble', vx: 6.5, vy: -2, grav: 0.5, bounce: 6.5, d: 6, kb: 5, gr: 0.06, ang: 50, r: 17, life: 160, pierce: 1, every: 30 } }),
  // --- Ghost Toad ---
  boo: spShot({ cd: 50, at: 10, end: 22, p: { k: 'boo', vx: 3.5, home: 0.18, vmax: 4.5, d: 7, kb: 5, gr: 0.07, ang: 50, r: 16, life: 160, ghost: 1 } }),
  phase: spDash({ cd: 40, speed: 9, startup: 3, frames: 24, intang: true, fin: { x: 26, d: 4, k: 2, g: 0.01, ang: 30, daze: 45 }, lag: 10, ev: 'poof' }),
  spiritfloat: spFloat({ frames: 60, rise: 4.5, drift: 5.5, ig: 20, ev: 'ghostpuff' }),
  // vanish for a moment (free to drift), then reappear with a BOO! that leaves foes dizzy
  haunt: {
    start(g, f) { if (!useCd(f, 'd', 360)) return false; f.vx *= 0.3; g.ev.push({ t: 'poof', x: f.x, y: f.y - f.h / 2, k: 'ghost' }); },
    upd(g, f, c) {
      if (f.t < 70) { f.hide = 2; f.ig = 2; f.vx = c.dirX * 4.5; f.vy = (c.bits & B_U ? -3.5 : c.bits & B_D ? 3 : 0) - GRAV; return 0; }
      if (f.t === 70) {
        f.hits = {};
        hitArea(g, f, 0, -f.h * 0.5, 110 * f.sc, 6, 3, 0.02, 60, { radial: true, daze: 50 });
        g.ev.push({ t: 'say', x: f.x, y: f.y - f.h - 10, s: 'BOO!', snd: 'boo' });
      }
      return f.t >= 84 ? 1 : 0;
    },
  },
  // --- Robo Toad ---
  rocketfist: spShot({ cd: 40, at: 12, end: 28, ev: 'rocket', p: { k: 'fist', vx: 11, d: 11, kb: 8, gr: 0.12, ang: 35, r: 16, life: 70, explode: { r: 40, d: 4, k: 5, g: 0.05 } } }),
  turbo: spDash({ cd: 40, speed: 12, startup: 6, frames: 20, armor: true, hb: { x: 24, y: 0.5, r: 30, d: 10, k: 8, g: 0.12, ang: 35 }, lag: 14, trail: 'jet' }),
  jetboots: spRise({ vy: 20, hold: 10, end: 22, trail: 'jet', hb: { a: 0, b: 10, y: -0.1, r: 28, d: 6, k: 5, g: 0.07, ang: -60 } }),
  steam: spPulse({ slot: 'd', cd: 60, at: [{ t: 12, r: 92, d: 8, k: 9, g: 0.1, ang: 55, ev: 'steam' }], end: 30 }),
  // --- Red Yoshi: fire ---
  firespit: spShot({ cd: 22, at: 7, end: 18, ev: 'flame', p: { k: 'fire', vx: 10, vy: 0, grav: 0, d: 7, kb: 5, gr: 0.07, ang: 40, r: 13, life: 70, ghost: 1 } }),
  flamerush: spDash({ cd: 36, speed: 12.5, startup: 4, frames: 16, hb: { x: 22, y: 0.5, r: 28, d: 3, k: 2, g: 0.01, ang: 50, every: 4 }, fin: { x: 30, d: 7, k: 8, g: 0.12, ang: 40 }, lag: 10, trail: 'flame' }),
  blazejump: spRise({ vy: 18, hold: 4, end: 26, trail: 'flame', hb: { a: 0, b: 12, y: 0.3, r: 32, d: 8, k: 6, g: 0.1, ang: 80 } }),
  magmapound: spSlam({ fallV: 22, dive: { d: 12, k: 5, g: 0.12, ang: -75 }, wave: { r: 96, d: 10, k: 8, g: 0.1, ang: 60 }, ev: 'fire' }),
  // --- Blue Yoshi: wings and wind ---
  gust: spShot({ cd: 30, at: 8, end: 20, ev: 'gustfx', p: { k: 'gust', vx: 8.5, d: 3, kb: 9, gr: 0.06, ang: 25, r: 24, life: 60, pierce: 1, every: 30, ghost: 1 } }),
  swoop: spDash({ cd: 34, speed: 12, startup: 4, frames: 18, hop: 6, arc: true, hb: { x: 20, y: 0.5, r: 28, d: 9, k: 7, g: 0.11, ang: 40 }, lag: 10, trail: 'gustfx' }),
  wingflight: spFloat({ frames: 84, rise: 5.2, drift: 6.5, ev: 'gustfx' }),
  divebomb: spSlam({ fallV: 25, dive: { d: 12, k: 5, g: 0.12, ang: -70 }, wave: { r: 84, d: 8, k: 7, g: 0.1, ang: 55 } }),
  // --- Yellow Yoshi: rock and quakes ---
  rockspit: spShot({ cd: 34, at: 9, end: 22, p: { k: 'rock', vx: 8, vy: -4, grav: 0.45, bounce: 4, bounces: 1, d: 10, kb: 7, gr: 0.1, ang: 45, r: 15, life: 120 } }),
  stampede: spDash({ cd: 40, speed: 9.5, startup: 6, frames: 22, armor: true, hb: { x: 28, y: 0.45, r: 30, d: 12, k: 8, g: 0.13, ang: 35 }, lag: 14, trail: 'dust' }),
  springjump: spRise({ vy: 21, end: 26, drift: 4.5, hb: { a: 0, b: 10, y: 1.0, r: 28, d: 8, k: 6, g: 0.1, ang: 88 } }),
  quakestomp: spSlam({ fallV: 22, dive: { d: 10, k: 5, g: 0.11, ang: -75 }, wave: { r: 130, d: 9, k: 9, g: 0.11, ang: 70 }, ev: 'quake' }),
  // --- Pink Yoshi: love ---
  heartkiss: spShot({ cd: 40, at: 10, end: 22, ev: 'sparkle', p: { k: 'heart', vx: 4.5, home: 0.15, vmax: 5, d: 4, kb: 1, gr: 0, ang: 40, r: 16, life: 150, ghost: 1, daze: 55 } }),
  cartwheel: spDash({ cd: 30, speed: 10, startup: 3, frames: 18, hb: { x: 0, y: 0.5, r: 32, d: 3, k: 2, g: 0.01, ang: 60, every: 5 }, fin: { x: 26, d: 6, k: 8, g: 0.12, ang: 45 }, lag: 10 }),
  heartfloat: spFloat({ frames: 66, rise: 4.6, drift: 5.5, ev: 'heartfx' }),
  sweetcounter: spCounter({ win: 30, d: 11, k: 8, ang: 40 }),
  // --- Light Blue Yoshi: ice ---
  frostbreath: spPulse({ slot: 'n', cd: 34, ev: 'frostfx', at: [{ t: 8, x: 44, r: 34, d: 3, k: 2, g: 0.02, ang: 40, fwd: 1 }, { t: 14, x: 52, r: 36, d: 5, k: 5, g: 0.06, ang: 40, fwd: 1, frz: 1 }], end: 26 }),
  iceskate: spDash({ cd: 34, speed: 13, startup: 3, frames: 20, hb: { x: 20, y: 0.3, r: 26, d: 7, k: 6, g: 0.09, ang: 40, frz: true }, lag: 10, trail: 'icetrail' }),
  snowtwirl: spRise({ vy: 15, hold: 8, end: 30, drift: 5.5, trail: 'frostfx', hb: { a: 2, b: 22, y: 0.5, r: 38, d: 2, k: 2, g: 0.01, ang: 80, every: 5 }, fin: { at: 24, r: 42, d: 5, k: 7, g: 0.11, ang: 75 } }),
  frostpatch: spTrap({ sub: 'frost', life: 420, r: 44, cd: 180, at: 12, ox: 46 }),
  // --- Purple Yoshi: poison ---
  sporespit: spShot({ cd: 36, at: 9, end: 20, p: { k: 'bubble', vx: 5, vy: -1, home: 0.08, vmax: 5, d: 5, kb: 4, gr: 0.05, ang: 50, r: 16, life: 140, ghost: 1, psn: true } }),
  venomlash: spTether({ cd: 40, range: 130, a: 9, b: 15, ledge: 160, fin: { d: 8, k: 7, g: 0.11, ang: 40, psn: true } }),
  bubblelift: spFloat({ frames: 72, rise: 4.4, drift: 5.5, ig: 16, ev: 'bubblefx' }),
  toxicpuddle: spTrap({ sub: 'toxic', life: 420, r: 46, cd: 200, at: 12, ox: 44 }),
  // --- Black Yoshi: shadow ---
  shadowball: spShot({ cd: 40, at: 12, end: 24, ev: 'magic', p: { k: 'shade', vx: 6, home: 0.25, vmax: 7, d: 9, kb: 7, gr: 0.1, ang: 45, r: 16, life: 130, ghost: 1 } }),
  nightdash: spDash({ cd: 40, speed: 15, startup: 3, frames: 12, intang: true, hb: { x: 0, y: 0.5, r: 32, d: 10, k: 8, g: 0.12, ang: 40 }, lag: 12, ev: 'poof' }),
  shadowleap: spBlink({ up: true, dx: 120, dy: 210, at: 8, end: 18, puff: 'smoke' }),
  heavystomp: spSlam({ fallV: 24, dive: { d: 15, k: 6, g: 0.14, ang: -80 }, wave: { r: 100, d: 12, k: 9, g: 0.12, ang: 60 } }),
  // --- White Yoshi: light ---
  lightbolt: spShot({ cd: 16, at: 6, end: 16, ev: 'laser', p: { k: 'lightbolt', vx: 16, d: 4, kb: 3, gr: 0.03, ang: 25, r: 10, life: 44, ghost: 1 } }),
  angeldash: spDash({ cd: 34, speed: 12, startup: 3, frames: 16, reflect: true, hb: { x: 22, y: 0.5, r: 28, d: 8, k: 7, g: 0.1, ang: 40 }, lag: 10, trail: 'sparkle' }),
  halorise: spRise({ vy: 17, hold: 6, end: 28, drift: 6, trail: 'sparkle', hb: { a: 0, b: 14, y: 0.8, r: 32, d: 7, k: 6, g: 0.1, ang: 85 } }),
  holyshine: spPulse({ slot: 'd', cd: 50, reflect: [2, 22], at: [{ t: 8, r: 64, d: 7, k: 8, g: 0.1, ang: 60, ev: 'zap' }], end: 26 }),
  // --- Orange Yoshi: fruit ---
  seedspit: spShot({ cd: 18, at: 5, end: 16, shots: [-0.8, 0, 0.8].map(vy => ({ k: 'seed', vx: 12, vy, grav: 0.05, d: 2.5, kb: 2, gr: 0.02, ang: 30, r: 8, life: 42 })) }),
  fruitroll: spDash({ cd: 34, speed: 11, startup: 5, frames: 18, hb: { x: 18, y: 0.35, r: 30, d: 9, k: 7, g: 0.11, ang: 40 }, lag: 12, trail: 'dust' }),
  melonhop: spRise({ vy: 17, hold: 5, end: 28, drift: 5.5, hb: { a: 0, b: 10, y: 0.9, r: 30, d: 7, k: 6, g: 0.1, ang: 85 } }),
  fruitbomb: spShot({ slot: 'd', cd: 60, at: 10, end: 24, p: { k: 'melon', vx: 6, vy: -7, grav: 0.45, d: 9, kb: 7, gr: 0.1, ang: 50, r: 18, life: 150, explode: { r: 64, d: 8, k: 8, g: 0.1 } } }),
  // --- Baby Yoshi ---
  gobble: spTether({ slot: 'n', cd: 30, range: 56, a: 6, b: 10, fin: { d: 9, k: 8, g: 0.12, ang: 40 } }),
  babyroll: spDash({ cd: 28, speed: 10.5, startup: 3, frames: 16, hb: { x: 14, y: 0.3, r: 26, d: 7, k: 6, g: 0.09, ang: 40 }, lag: 8, trail: 'dust' }),
  babyflutter: spFloat({ frames: 52, rise: 5.2, drift: 6, ev: 'sparkle' }),
  tantrum: spPulse({ slot: 'd', cd: 40, at: [{ t: 6, r: 40, d: 3, k: 3, g: 0.02, ang: 60 }, { t: 14, r: 44, d: 3, k: 3, g: 0.02, ang: 60 }, { t: 22, r: 50, d: 6, k: 8, g: 0.11, ang: 55 }], end: 32 }),
  // --- Moo Toad, riding Buttercup the cow ---
  milkshot: spShot({ cd: 22, at: 8, end: 20, ev: 'milk', shots: [-1.8, -0.4, 1].map(vy => ({ k: 'milk', vx: 9.5, vy, grav: 0.2, d: 3, kb: 3, gr: 0.03, ang: 35, r: 11, life: 55, oy: 0.6 })) }),
  cowcharge: spDash({ cd: 40, speed: 12.5, startup: 6, frames: 22, armor: true, hb: { x: 34, y: 0.35, r: 34, d: 13, k: 9, g: 0.14, ang: 38 }, lag: 14, trail: 'dust', ev: 'moo' }),
  moonjump: spRise({ vy: 20, hold: 7, end: 28, drift: 5.5, trail: 'sparkle', ev: 'moo', hb: { a: 0, b: 12, y: 0.2, r: 40, d: 9, k: 6, g: 0.1, ang: 85 } }),
  cowbell: spPulse({ slot: 'd', cd: 50, ev: 'cowbell', at: [{ t: 10, r: 74, d: 4, k: 2, g: 0, ang: 60, daze: 40, ev: 'cowbellhit' }], end: 26 }),
  // --- Samurai Toad ---
  windslash: spShot({ cd: 40, at: 9, end: 24, ev: 'slashfx', p: { k: 'crescent', vx: 12, d: 7, kb: 6, gr: 0.08, ang: 35, r: 20, life: 38, pierce: 1, ghost: 1 } }),
  quickdraw: spDash({ cd: 50, speed: 18, startup: 8, frames: 8, intang: true, hb: { x: 0, y: 0.5, r: 32, d: 11, k: 8, g: 0.12, ang: 40 }, lag: 16, ev: 'slashfx' }),
  cranerise: spRise({ vy: 16.5, hold: 5, end: 30, drift: 5, trail: 'petal', hb: { a: 1, b: 14, y: 0.9, r: 34, d: 2.5, k: 3, g: 0.01, ang: 85, every: 4 }, fin: { at: 16, r: 44, d: 6, k: 8, g: 0.12, ang: 80 } }),
  iaicounter: spCounter({ win: 26, d: 14, k: 9, ang: 40 }),
  // --- Viking Toad ---
  axethrow: spShot({ cd: 45, at: 11, end: 26, p: { k: 'axe', vx: 8.5, vy: -7.5, grav: 0.38, d: 10, kb: 7, gr: 0.1, ang: 45, r: 16, life: 120 } }),
  shieldrush: spDash({ cd: 40, speed: 10, startup: 6, frames: 18, guard: [1, 24], hb: { x: 28, y: 0.5, r: 30, d: 10, k: 8, g: 0.12, ang: 35 }, lag: 14, trail: 'dust' }),
  berserk: spRise({ vy: 16.5, hold: 6, end: 30, drift: 4.5, hb: { a: 0, b: 18, y: 0.6, r: 40, d: 2.5, k: 2.5, g: 0.01, ang: 80, every: 5 }, fin: { at: 20, r: 48, d: 7, k: 8, g: 0.12, ang: 75 } }),
  warhorn: spPulse({ slot: 'd', cd: 90, ev: 'warhorn', at: [{ t: 14, r: 120, d: 3, k: 11, g: 0.04, ang: 30, ev: 'hornblast' }], end: 34 }),
  // --- Pharaoh Toad ---
  scarab: spShot({ cd: 40, at: 10, end: 22, ev: 'scarabfx', p: { k: 'scarab', vx: 5.5, home: 0.22, vmax: 6.5, d: 7, kb: 5, gr: 0.08, ang: 45, r: 14, life: 140, ghost: 1 } }),
  sandsurge: spShot({ slot: 's', cd: 50, at: 10, end: 24, ev: 'sandfx', p: { k: 'sandwave', vx: 7, d: 7, kb: 6, gr: 0.09, ang: 60, r: 26, life: 55, pierce: 1, every: 30, oy: 0.25, ghost: 1 } }),
  sunrise: spRise({ vy: 17.5, hold: 6, end: 28, drift: 5, trail: 'sandfx', hb: { a: 0, b: 12, y: 0.8, r: 34, d: 8, k: 7, g: 0.1, ang: 85 } }),
  sarcophagus: spCounter({ win: 30, d: 12, k: 9, ang: 50 }),
  // --- Gladiator Toad ---
  tridenttoss: spShot({ cd: 50, at: 12, end: 26, p: { k: 'trident', vx: 14, vy: -1, grav: 0.08, d: 9, kb: 7, gr: 0.1, ang: 30, r: 12, life: 55 } }),
  tridentlunge: spDash({ cd: 36, speed: 11, startup: 7, frames: 12, hb: { x: 48, y: 0.5, r: 24, d: 12, k: 8, g: 0.13, ang: 32 }, lag: 14, trail: 'dust' }),
  polevault: spRise({ vy: 18, hold: 4, end: 28, drift: 5, hb: { a: 0, b: 10, y: 0.2, r: 34, d: 8, k: 7, g: 0.1, ang: 80 } }),
  nettrap: spTrap({ sub: 'net', life: 420, r: 42, cd: 220, at: 12, ox: 46, one: true }),
  // --- Buddhist Toad: a kung fu monk ---
  chipalm: spShot({ cd: 36, at: 10, end: 24, ev: 'chifx', p: { k: 'chi', vx: 8, d: 7, kb: 7, gr: 0.08, ang: 40, r: 18, grow: 0.35, life: 40, pierce: 1, ghost: 1 } }),
  staffwhirl: spDash({ cd: 36, speed: 6.5, startup: 4, frames: 22, hb: { x: 10, y: 0.5, r: 38, d: 2, k: 2, g: 0.01, ang: 60, every: 5 }, fin: { x: 26, d: 6, k: 8, g: 0.12, ang: 45 }, lag: 10 }),
  lotusfloat: spFloat({ frames: 66, rise: 4.6, drift: 5, ev: 'petal' }),
  stillmind: spCounter({ win: 34, d: 12, k: 9, ang: 50 }),
  // --- Muslim Toad: Eid treats and lanterns ---
  datetoss: spShot({ cd: 24, at: 8, end: 20, shots: [-6.5, -4.5, -2.5].map((vy, n) => ({ k: 'date', vx: 7 + n, vy, grav: 0.35, d: 3.5, kb: 3, gr: 0.04, ang: 45, r: 9, life: 70 })) }),
  lantern: spShot({ slot: 's', cd: 70, at: 10, end: 24, ev: 'chime', p: { k: 'lantern', vx: 3.2, vy: -0.6, d: 6, kb: 6, gr: 0.08, ang: 55, r: 18, life: 110, ghost: 1, fuse: 1, explode: { r: 54, d: 6, k: 7, g: 0.09 } } }),
  lanternlift: spRise({ vy: 16, hold: 10, end: 30, drift: 5, trail: 'sparkle', hb: { a: 0, b: 12, y: 0.9, r: 32, d: 7, k: 7, g: 0.1, ang: 85 } }),
  eidsweets: spHeal({ frames: 44, heal: 10, cd: 1100 }),
  // --- Mormon Toad: a missionary on a bike ---
  jelly: spShot({ cd: 30, at: 9, end: 22, ev: 'jellyfx', p: { k: 'jelly', vx: 6.5, vy: -6, grav: 0.45, bounce: 7, bounces: 3, d: 6, kb: 5, gr: 0.07, ang: 50, r: 14, life: 160 } }),
  bikeride: spDash({ cd: 40, speed: 11.5, startup: 5, frames: 26, hb: { x: 26, y: 0.35, r: 30, d: 10, k: 8, g: 0.12, ang: 38 }, lag: 12, ev: 'bikebell', trail: 'dust' }),
  highnote: spRise({ vy: 17, hold: 6, end: 28, drift: 5, trail: 'notefx', ev: 'highnote', hb: { a: 0, b: 12, y: 0.8, r: 34, d: 7, k: 7, g: 0.1, ang: 85 } }),
  potluck: spTrap({ sub: 'casserole', life: 360, r: 44, cd: 200, at: 12, ox: 46 }),
  // --- Hasidic Toad: wedding joy ---
  latke: spShot({ cd: 26, at: 7, end: 18, p: { k: 'latke', vx: 10, vy: -0.5, grav: 0.04, d: 6, kb: 5, gr: 0.07, ang: 40, r: 13, life: 60 } }),
  dreidel: spDash({ cd: 40, speed: 8, startup: 4, frames: 26, hb: { x: 0, y: 0.5, r: 34, d: 2.5, k: 2, g: 0.01, ang: 60, every: 5 }, fin: { x: 20, d: 7, k: 8, g: 0.12, ang: 40 }, lag: 10 }),
  chairlift: spRise({ vy: 18, hold: 8, end: 30, drift: 5, ev: 'chairup', hb: { a: 0, b: 14, y: 0, r: 34, d: 8, k: 7, g: 0.1, ang: 80 } }),
  klezmer: spPulse({ slot: 'd', cd: 60, ev: 'klezmer', at: [{ t: 10, r: 56, d: 3, k: 3, g: 0.02, ang: 60, ev: 'notesfx' }, { t: 20, r: 64, d: 3, k: 3, g: 0.02, ang: 60, ev: 'notesfx' },
    { t: 30, r: 76, d: 6, k: 8, g: 0.1, ang: 55, ev: 'notesfx' }], end: 40 }),
  // --- Catholic Toad: Christmas, Three Kings Day and fiesta fun ---
  kingsgift: spShot({ cd: 32, at: 9, end: 22, p: { k: 'gift', vx: 7, vy: -6, grav: 0.42, bounce: 5, bounces: 1, d: 7, kb: 6, gr: 0.08, ang: 50, r: 14, life: 140, explode: { r: 44, d: 4, k: 5, g: 0.05 } } }),
  bellring: spPulse({ slot: 's', cd: 40, ev: 'bellswing', at: [{ t: 10, x: 50, r: 44, d: 10, k: 8, g: 0.12, ang: 40, fwd: 1, ev: 'bellring' }], end: 28 }),
  partypopper: spRise({ vy: 17.5, hold: 5, end: 28, drift: 5, ev: 'popper', trail: 'confetti', hb: { a: 0, b: 10, y: 0.2, r: 36, d: 8, k: 7, g: 0.1, ang: 85 } }),
  pinata: spTrap({ sub: 'pinata', life: 420, r: 30, cd: 200, at: 12, ox: 44, one: true, hang: 58 }),
  // --- Hindu Toad: Holi colors, the dandiya dance and festival kites ---
  colorthrow: spShot({ cd: 28, at: 8, end: 20, ev: 'gulalfx', p: { k: 'gulal', vx: 8, vy: -1, grav: 0.05, d: 5, kb: 5, gr: 0.07, ang: 45, r: 18, grow: 0.25, life: 45, ghost: 1, fuse: 1, explode: { r: 40, d: 3, k: 4, g: 0.04 } } }),
  dandiya: spDash({ cd: 36, speed: 8.5, startup: 4, frames: 22, hb: { x: 14, y: 0.5, r: 34, d: 2, k: 2, g: 0.01, ang: 60, every: 5 }, fin: { x: 28, d: 7, k: 8, g: 0.12, ang: 40 }, lag: 10, ev: 'dandiyafx' }),
  kitefly: spFloat({ frames: 70, rise: 4.8, drift: 6, ev: 'kitefx' }),
  pichkari: spPulse({ slot: 'd', cd: 40, ev: 'squirt', at: [{ t: 8, x: 46, r: 30, d: 3, k: 3, g: 0.02, ang: 40, fwd: 1, ev: 'splashfx' }, { t: 14, x: 60, r: 32, d: 3, k: 3, g: 0.02, ang: 40, fwd: 1, ev: 'splashfx' },
    { t: 20, x: 74, r: 34, d: 5, k: 7, g: 0.09, ang: 35, fwd: 1, ev: 'splashfx' }], end: 30 }),
  // --- Subaru Toad: Beatrice casts from the backpack (the Unseen Hand is his own) ---
  // Minya flies far and fast; the crystals fly out half a beat after the cast (frame 5)
  minya: spCast(spShot({ cd: MINYA.cd, at: 5, end: 19, shots: MINYA.vys.map(vy => Object.assign({ vy }, MINYA.p)) }), 'beako', 'Minya!'),
  // Shamac's black mist stuns for a full second, and the cloud is half again as big as it was
  shamac: spCast(spShot({ slot: 's', cd: 150, at: 12, end: 26, p: { k: 'shamac', vx: 4.4, d: 1, kb: 0.5, gr: 0, ang: 60, r: 57, life: 150, pierce: 1, every: 70, daze: 60, ghost: 1 } }), 'beako', 'Shamac!'),
  // Murak (two seconds of it): hold Up to rise, Down to sink, neither to hover. Beatrice can still fire Minya on
  // the way: press Special again
  murak: spCast({
    start(g, f) { if (f.upUsed) return false; f.upUsed = true; f.gi = -1; f.vy = Math.min(f.vy, -2); },
    upd(g, f, c) {
      if (f.t > 2 && c.pressed & B_B && !(c.bits & (B_U | B_D)) && f.cd.n <= 0) fireMinya(g, f, c);
      airDrift(f, c, 5.5);
      if (f.t >= 122) return 1;
      // (gravity adds 0.62 a frame after this, so a target of -0.62 holds still)
      const want = c.bits & B_U ? -5 : c.bits & B_D ? 3 : -0.62;
      f.vy += clamp(want - f.vy, -0.9, 0.9);
      if (f.t % 6 === 0) g.ev.push({ t: 'yinfx', x: f.x, y: f.y - f.h * 0.4 });
      return 0;
    },
  }, 'beako', 'Murak!'),
  // the Unseen Hand reaches 270 and holds its catch for 18 frames before the squeeze launches them. Keep holding
  // Special and it slams them into the ground three times instead, then throws them a fixed distance (`slam`)
  unseenhand: spCast(spTether({ slot: 'd', cd: 70, range: 270, a: 10, b: 18, hold: 18, fin: { d: 7, k: 8, g: 0.11, ang: 70 }, slam: { n: 3, every: 14, d: 3, throwD: 5, k: 10, ang: 38 } }), 'unseen', ''),
  // --- Emilia Toad: ice magic (her Attack button is the ice volley; Puck fires on his own) ---
  // Ice Soldiers: two at a time, four at most; a new pair needs room for both (8 s to recharge)
  icesoldiers: {
    start(g, f, c) {
      if (g.proj.filter(q => isSoldier(q) && q.o === f.i).length > EMI.maxSoldiers - 2) return fizzle(g, f, 'Four soldiers at most!');
      if (!useCd(f, 'n', EMI.soldierCd)) return fizzle(g, f);
      if (c.onG) f.vx *= 0.3;
      g.ev.push({ t: 'icecast', x: f.x, y: f.y - f.h * 0.5, i: f.i });
    },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2);
      if (f.t === 12) spawnSoldiers(g, f);
      return f.t >= 30 ? 1 : 0;
    },
  },
  // Ice Brand Arts: she forms the next ice weapon in turn (sword, great axe, great hammer, spear) and uses it
  icebrand: {
    start(g, f, c) {
      f.wpn = f.brand || 0; f.brand = (f.wpn + 1) % BRAND.length;
      if (c.onG) f.vx *= 0.3;
      g.ev.push({ t: 'icebrand', x: f.x + f.fc * 24, y: f.y - f.h * 0.6, w: f.wpn, i: f.i });
    },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2.5);
      const t = f.t, o = { mv: 's:icebrand' + f.wpn, use: f.use };
      switch (f.wpn) {
        case 0: // the Ice Long Sword: a quick swing with a long reach that chills the foe (slower for 3 s)
          if (t >= 7 && t <= 12) hitArea(g, f, 62 * f.sc, -f.h * 0.5, 44 * f.sc, 9, 6, 0.1, 38, Object.assign({ slow: 180 }, o));
          return t >= 26 ? 1 : 0;
        case 1: // the Ice Great Axe: a full circle round her that knocks foes away and chills them for 1 s
          if (t >= 8 && t <= 20) hitArea(g, f, 0, -f.h * 0.45, 66 * f.sc, 5, 8.5, 0.08, 40, Object.assign({ radial: true, slow: 60 }, o));
          return t >= 30 ? 1 : 0;
        case 2: // the Ice Great Hammer: up over her head, then down: a heavy smash that launches foes upward
          if (t === 18) g.ev.push({ t: 'hammersmash', x: f.x + f.fc * 46 * f.sc, y: f.y - 8 });
          if (t >= 18 && t <= 22) hitArea(g, f, 46 * f.sc, -f.h * 0.35, 40 * f.sc, 15, 6, 0.16, 82, o);
          return t >= 42 ? 1 : 0;
        default: // the Ice Spear: wind up and hurl it straight ahead
          if (t === 14) {
            spawnProj(g, f, { k: 'icespear', x: f.x + f.fc * 30 * f.sc, y: f.y - f.h * 0.55, vx: f.fc * 13, vy: 0, grav: 0, d: 4, kb: 0, gr: 0, ang: 0, r: 12, life: 46, ghost: 1, vic: -1, quiet: 1, fc: f.fc });
            g.ev.push({ t: 'spearthrow', x: f.x, y: f.y - f.h * 0.55 });
          }
          return t >= 30 ? 1 : 0;
      }
    },
  },
  // Ice Pillar: near the ground, a pillar of ice shoots up under her and lifts her high (4 s to recharge);
  // higher up in the air, an ice blast from her feet propels her upward instead
  icepillar: {
    start(g, f, c) {
      const gy = groundBelow(g, f.x, f.y, 64);
      if (gy !== null) {
        if (!useCd(f, 'u', EMI.pillar.cd)) return fizzle(g, f);
        f.icep = makeIce(g, f, 'pillar', f.x, gy).id; f.t2 = 1; f.vx = 0; f.vy = 0;
        g.ev.push({ t: 'pillar', x: f.x, y: gy });
        return;
      }
      if (f.upUsed) return false;
      f.upUsed = true; f.t2 = 0; f.gi = -1; f.vy = -17; f.vx *= 0.5;
      g.ev.push({ t: 'iceblast', x: f.x, y: f.y });
    },
    upd(g, f, c) {
      if (f.t2) {
        // riding the pillar up as it grows
        const s = g.ice.find(q => q.id === f.icep);
        if (!s) return 1;
        f.x = s.x; f.y = s.y - s.h - 0.5; f.vx = 0; f.vy = 0; f.gi = -1;
        return s.t >= EMI.pillar.grow ? 1 : 0;
      }
      airDrift(f, c, 5);
      if (f.t < 6) f.vy = -17;
      // the blast under her feet knocks foes below her downward
      if (f.t <= 8) hitArea(g, f, 0, 4, 34 * f.sc, 6, 6, 0.08, -80);
      if (f.t % 3 === 0 && f.t < 15) g.ev.push({ t: 'icetrail', x: f.x, y: f.y });
      return f.t >= 28 ? 2 : 0;
    },
  },
  // Ice Barrier: a wall of ice in front of her that curves up and over her head (5 s to recharge)
  icebarrier: {
    start(g, f, c) {
      if (!useCd(f, 'd', EMI.barrier.cd)) return fizzle(g, f);
      if (c.onG) f.vx *= 0.2;
      const gy = groundBelow(g, f.x, f.y, 30);
      makeIce(g, f, 'barrier', f.x, gy !== null ? gy : f.y);
      g.ev.push({ t: 'barrier', x: f.x + f.fc * 39, y: f.y - 30 });
    },
    upd(g, f, c) { f.vx *= 0.75; if (!c.onG) f.vy = Math.min(f.vy, 1.5); return f.t >= 22 ? 1 : 0; },
  },
  // --- Dash Yoshi: pure speed ---
  // a kick so fast it sends a sonic boom across the stage
  boomkick: spShot({ cd: 28, at: 6, end: 16, ev: 'boomfx', p: { k: 'gust', vx: 15, d: 7, kb: 7, gr: 0.09, ang: 32, r: 22, life: 36, pierce: 1, ghost: 1 } }),
  // straight through everyone in a blur
  blitzdash: spDash({ cd: 26, speed: 22, startup: 2, frames: 10, intang: true, hb: { x: 10, y: 0.5, r: 32, d: 9, k: 8, g: 0.12, ang: 40 }, lag: 8, trail: 'speedfx', ev: 'boomfx' }),
  cycloneclimb: spRise({ vy: 19, hold: 8, end: 26, drift: 7.5, trail: 'speedfx', hb: { a: 0, b: 16, y: 0.5, r: 38, d: 2.5, k: 2.5, g: 0.01, ang: 85, every: 4 }, fin: { at: 18, r: 42, d: 6, k: 8, g: 0.12, ang: 80 } }),
  // vanish, leaving an afterimage, and strike the nearest foe from behind
  afterimage: {
    start(g, f) { if (!useCd(f, 'd', 70)) return false; f.vx *= 0.3; g.ev.push({ t: 'poof', x: f.x, y: f.y - f.h / 2, k: 'speed' }); },
    upd(g, f, c) {
      f.ig = Math.max(f.ig, 2);
      if (!c.onG) f.vy = Math.min(f.vy, 1);
      if (f.t === 6) {
        const tg = nearestFoe(g, f.i, f.x, f.y - f.h / 2);
        if (tg && Math.abs(tg.x - f.x) < 320 && Math.abs(tg.y - f.y) < 170) { f.x = tg.x - (tg.fc || 1) * 46; f.y = tg.y; f.fc = tg.x >= f.x ? 1 : -1; f.gi = -1; f.vy = 0; }
        else f.x += f.fc * 140;
        f.x = clamp(f.x, BLAST.l + 140, BLAST.r - 140);
        g.ev.push({ t: 'poof', x: f.x, y: f.y - f.h / 2, k: 'speed' });
      }
      if (f.t === 9) { f.hits = {}; hitArea(g, f, 30 * f.sc, -f.h * 0.5, 36 * f.sc, 11, 8, 0.13, 40); g.ev.push({ t: 'slash', x: f.x + f.fc * 30, y: f.y - f.h / 2 }); }
      return f.t >= 22 ? 1 : 0;
    },
  },
  // --- Mech Yoshi: a three-shot blaster, an air dash, boosters and bombs ---
  blaster: {
    start(g, f, c) { if (!useCd(f, 'n', 40)) return false; if (c.onG) f.vx *= 0.4; },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2);
      if (f.t === 6 || f.t === 11 || f.t === 16) {
        spawnProj(g, f, { k: 'plasma', x: f.x + f.fc * 26 * f.sc, y: f.y - f.h * 0.5, vx: f.fc * 15, vy: 0, fc: f.fc, grav: 0, d: 3, kb: 2.5, gr: 0.03, ang: 25, r: 9, life: 40, ghost: 1 });
        g.ev.push({ t: 'blasterfx', x: f.x + f.fc * 26, y: f.y - f.h * 0.5, dir: f.fc });
      }
      return f.t >= 24 ? 1 : 0;
    },
  },
  airdash: spDash({ cd: 30, speed: 15, startup: 3, frames: 12, hb: { x: 18, y: 0.5, r: 28, d: 7, k: 6, g: 0.09, ang: 40 }, lag: 8, trail: 'jet' }),
  booster: spRise({ vy: 13.5, hold: 24, end: 30, drift: 5.5, trail: 'jet', hb: { a: 0, b: 22, y: -0.1, r: 26, d: 3, k: 3, g: 0.04, ang: -70, every: 8 } }),
  bomblob: spShot({ slot: 'd', cd: 70, at: 10, end: 24, p: { k: 'mbomb', vx: 6, vy: -8, grav: 0.45, d: 8, kb: 7, gr: 0.1, ang: 50, r: 14, life: 150, explode: { r: 60, d: 7, k: 8, g: 0.1 } } }),
  // --- Water Yoshi (Early Access) ---
  // Ebb & Flow. With no Current: Rising Tide, hold Special to charge it (his hands sweep like the sea; let go to
  // stop). With any Current: Release, all of it at once: 1-24% a water spout that leaves a slippery puddle, 25-49%
  // a round water blast, 50-74% a piercing high-pressure jet, 75-99% a whirlpool, 100% the giant beam
  ebbflow: {
    start(g, f, c) {
      f.kvic = null;
      f.ebv = f.cur > 0 ? waterTier(f.cur) : 'charge';
      if (f.ebv === 'charge') { if (c.onG) f.vx *= 0.4; return; }
      f.ebc = f.cur; f.cur = 0;
      if (c.onG) f.vx *= 0.3;
      if (f.ebv === 'kame' || f.ebv === 'beam') { f.vx = 0; f.vy = 0; }
      g.ev.push({ t: 'wrelease', x: f.x, y: f.y - f.h * 0.5, k: f.ebv, i: f.i, dir: f.fc });
    },
    upd(g, f, c) {
      const W = WATER;
      switch (f.ebv) {
        case 'charge': {
          if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2.5);
          if (!(c.bits & B_B) || f.cur >= 100) return 1;
          const was = f.cur;
          f.cur = Math.min(100, f.cur + 100 / W.charge);
          for (const q of [25, 50, 75, 100]) if (was < q && f.cur >= q) g.ev.push({ t: 'wtick', i: f.i, q, x: f.x, y: f.y - f.h * 0.6 });
          return 0;
        }
        case 'spout':
          if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2);
          if (f.t === 8) spawnProj(g, f, Object.assign({ k: 'wspout', x: f.x + f.fc * 24 * f.sc, y: f.y - f.h * 0.62 }, W.spout, { vx: f.fc * W.spout.vx, fc: f.fc }));
          return f.t >= 20 ? 1 : 0;
        case 'blast':
          if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2);
          if (f.t === 10) spawnProj(g, f, Object.assign({ k: 'wblast', x: f.x + f.fc * 30 * f.sc, y: f.y - f.h * 0.55, vy: 0, grav: 0, ghost: 1 }, W.blast, { vx: f.fc * W.blast.vx, fc: f.fc }));
          return f.t >= 24 ? 1 : 0;
        case 'beam': {
          // locked in place (even in the air) while the high-pressure jet fires straight through everyone in its path
          f.vx = 0; f.vy = 0;
          const B = W.beam;
          if (f.t >= B.at && f.t < B.at + B.on) {
            const box = wbeamBox(f), d = B.d0 + (B.d1 - B.d0) * clamp((f.ebc - 50) / 24, 0, 1);
            for (const v of g.fighters) {
              if (mineI(g, f.i, v.i) || !hittable(v) || f.hits[v.i] || !boxHits(box, v)) continue;
              f.hits[v.i] = 1;
              // (its knockback grows a lot more once a foe is past 140%)
              applyHit(g, v, f, d * f.pm, B.kb, v.dm > B.hiAt ? B.grHi : B.gr, B.ang, f.fc, { proj: true, mv: 's:wbeam', use: f.use });
            }
          }
          return f.t >= B.end ? 1 : 0;
        }
        case 'whirl':
          if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2);
          if (f.t === 12) {
            // a quarter of the main platform across, on the floor he stands on (or, in the air, the lowest one below)
            const s = STG[g.stage].solids[0], r = s.w / 8, ws = W.whirl;
            let gy = lowestBelow(g, f), x = f.x;
            if (gy === null) { x = clamp(f.x, s.x + r, s.x + s.w - r); gy = s.y; }
            spawnProj(g, f, { k: 'trap', sub: 'whirl', x, y: gy, vx: 0, vy: 0, d: ws.d / (ws.life / ws.every), kb: 0, gr: 0, ang: 0, r, life: ws.life, landed: 1, quiet: 1 });
            g.ev.push({ t: 'whirlpool', x, y: gy });
          }
          return f.t >= 26 ? 1 : 0;
        case 'kame': return kameUpd(g, f);
      }
      return 1;
    },
  },
  // Undertow (a placeholder side special): a wave rolls out in front of him, then the tide turns and it washes back,
  // pushing foes away on the way out and dragging them back toward him on the way in. With 25% Current or more it
  // takes 25% of it for a wave twice as big that hits harder
  undertow: {
    start(g, f, c) {
      if (!useCd(f, 's', 60)) return false;
      if (!c.onG) { if (f.sUsed) return false; f.sUsed = true; f.vy = Math.min(f.vy, -3); }
      f.vx *= 0.3;
    },
    upd(g, f, c) {
      if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2.5);
      if (f.t === 9) {
        const big = f.cur >= 25;
        if (big) f.cur -= 25;
        spawnProj(g, f, { k: 'boom', sub: 'wave', x: f.x + f.fc * 26 * f.sc, y: f.y - f.h * 0.35, vx: f.fc * 12, vy: 0, d: big ? 7 : 4, kb: big ? 5 : 3.5, gr: 0.04, ang: 25,
          r: big ? 34 : 22, grav: 0, life: 110, dir0: f.fc, big: big ? 1 : 0 });
      }
      return f.t >= 22 ? 1 : 0;
    },
  },
  // Geyser Rise (a placeholder up special): a geyser bursts up under him and carries him high, splashing anyone at
  // his feet. A big, steerable climb back to the stage
  geyserrise: spRise({ vy: 14, hold: 10, drift: 5.5, end: 30, ev: 'wgeyser', trail: 'wtrail', hb: { a: 0, b: 8, y: 0.15, r: 36, d: 6, k: 7, g: 0.07, ang: 80 } }),
  // Sea Dragon's Cradle: a ring of water on the floor; half a second later water rises from it into a round wall for
  // 10 seconds (15 s to recharge). Blows from outside (or out from inside) hit the wall instead of whoever is behind
  // it, and wear it down (10 HP); shots soak into it and heal it 2. It uses up ALL his Current for extras, which
  // stack: 1%+ +10 HP, 25%+ foes who touch it are Sunk, 50%+ a roof you can stand on, 75%+ +30 HP, 100% healing
  // water (4% a second while he's inside). El Minya's crystals shatter it like a platform
  cradle: {
    start(g, f, c) {
      const C = WATER.cradle, gy = c.onG ? f.y : groundBelow(g, f.x, f.y - 2, 320);
      if (gy === null) return fizzle(g, f, 'No floor to put it on!');
      if (!useCd(f, 'd', C.cd)) return false;
      f.vx *= 0.3;
      const cur = f.cur, lv = cur >= 100 ? 5 : cur >= 75 ? 4 : cur >= 50 ? 3 : cur >= 25 ? 2 : cur > 0 ? 1 : 0;
      f.cur = 0;
      for (const s of g.ice.slice()) if (s.o === f.i && s.k === 'cradle') breakIce(g, s, 'drain');
      const hp = C.hp + (lv >= 1 ? 10 : 0) + (lv >= 4 ? 30 : 0);
      g.ice.push({ id: g.pid++, k: 'cradle', o: f.i, x: f.x, y: gy, fc: f.fc, w: C.r * 2, r: C.r, h: 0, t: 0, hp, max: hp, life: C.life, lv, cr: 0 });
      g.ev.push({ t: 'cradle', x: f.x, y: gy, lv });
    },
    upd(g, f, c) { if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2); return f.t >= 20 ? 1 : 0; },
  },
  // --- Nolan Toad ---
  // Rot Toss: he lobs a rotten leftover from under his bed (5%); where it lands it leaves a stink cloud for 4 seconds
  rottoss: spShot({ slot: 'n', cd: 120, at: 9, end: 22, p: Object.assign({ k: 'rot', ox: 18, oy: 0.75 }, NOLAN.rot) }),
  // Forbidden Dagger: the Shirt. Hold Special to grow mold on it (f.mold counts the frames), let go to throw it: a tap
  // hits for 5%, a second for 10%, full mold (2 s) for 16% and a burst of stink. Past full mold it keeps growing (up to
  // 20%), but it creeps onto him too: 2% a second until he throws it (at 4 seconds he throws it anyway)
  forbidden: {
    start(g, f, c) {
      if (f.cd.s > 0) return false;
      if (!c.onG) { if (f.sUsed) return false; f.sUsed = true; }
      f.mold = 0; f.vx *= 0.4;
      g.ev.push({ t: 'shirtout', x: f.x, y: f.y - f.h * 0.75, i: f.i });
    },
    upd(g, f, c) {
      const N = NOLAN.shirt;
      if (c.onG) f.vx *= 0.8; else f.vy = Math.min(f.vy, 2.5);
      if (f.mold >= 0) {
        if (c.bits & B_B && f.mold < N.max) {
          f.mold++;
          if (f.mold === N.full) g.ev.push({ t: 'moldfull', x: f.x, y: f.y - f.h * 0.9, i: f.i });
          if (f.mold > N.full && (f.mold - N.full) % N.self === 0) { f.dm = Math.min(999, f.dm + 1); f.taken = (f.taken || 0) + 1; g.ev.push({ t: 'moldme', x: f.x, y: f.y - f.h * 0.6, i: f.i }); }
          f.t2 = 0;
          return 0;
        }
        // let go (or it's as moldy as it gets): throw it. (mold -1 = his hand is empty now)
        const H = shirtHit(f.mold), full = f.mold >= N.full ? 1 : 0;
        spawnProj(g, f, { k: 'shirt', x: f.x + f.fc * 24 * f.sc, y: f.y - f.h * 0.65, vx: f.fc * N.vx, vy: -0.5, grav: N.grav, d: H.d, kb: H.kb, gr: H.gr, ang: N.ang,
          r: N.r + 6 * Math.min(1, f.mold / N.full), life: N.life, mold: f.mold, burst: full, fuse: full, fc: f.fc });
        f.mold = -1; f.t2 = 0; f.cd.s = N.cd;
      }
      f.t2++;
      return f.t2 >= 16 ? 1 : 0;
    },
  },
  // Mattress Launch: his old mattress flops down under him and he springs high off it (anyone under it takes 7%). In the
  // air the mattress falls away beneath him
  mattress: (() => {
    const R = spRise({ vy: 15.5, hold: 8, drift: 5, end: 30, ev: 'mattress', hb: { a: 0, b: 6, y: 0.08, r: 38, d: 7, k: 7, g: 0.08, ang: 82 } });
    return {
      fall: R.fall, upd: R.upd,
      start(g, f, c) {
        if (R.start(g, f, c) === false) return false;
        spawnProj(g, f, { k: 'trap', sub: 'mattress', x: f.x, y: f.y + 2, vx: 0, vy: 0, d: 0, kb: 0, gr: 0, ang: 0, r: 40, life: 44, landed: c.onG ? 1 : 0, quiet: 1, fc: f.fc });
      },
    };
  })(),
  // Under the Bed: his bed appears, he dives under it (nothing can touch him for half a second) and pops out with
  // whatever he finds down there: old leftovers (a stink cloud), a broken controller (he throws it, 8%) or a
  // half-eaten bag of spicy chips (he eats them: 5% healed)
  underbed: {
    start(g, f, c) {
      if (!c.onG) return fizzle(g, f, 'No bed up here!');
      if (!useCd(f, 'd', NOLAN.bed.cd)) return false;
      f.vx = 0; f.find = '';
      spawnProj(g, f, { k: 'trap', sub: 'bed', x: f.x, y: f.y, vx: 0, vy: 0, d: 0, kb: 0, gr: 0, ang: 0, r: 50, life: NOLAN.bed.end + 16, landed: 1, quiet: 1, fc: f.fc });
      g.ev.push({ t: 'bed', x: f.x, y: f.y });
    },
    upd(g, f) {
      const B = NOLAN.bed;
      f.vx *= 0.6;
      if (f.t >= B.hide[0] && f.t < B.hide[1]) f.ig = Math.max(f.ig, 2);
      if (f.t === B.pop) {
        const r = RND(), find = r < B.odds[0] ? 'leftovers' : r < B.odds[1] ? 'controller' : 'chips';
        f.find = find;
        if (find === 'leftovers') spawnStink(g, f, f.x + f.fc * 34, f.y, 0);
        else if (find === 'controller') spawnProj(g, f, Object.assign({ k: 'controller', x: f.x + f.fc * 22 * f.sc, y: f.y - f.h * 0.6, fc: f.fc }, B.ctrl, { vx: f.fc * B.ctrl.vx }));
        else f.dm = Math.max(0, f.dm - B.heal);
        g.ev.push({ t: 'bedfind', k: find, x: f.x, y: f.y - f.h, i: f.i });
      }
      return f.t >= B.end ? 1 : 0;
    },
  },
  // --- the Smash Mushroom finale (every fighter; see FSDEF) ---
  fs: {
    fall: 2,
    start(g, f) { f.fs = 0; f.vx = 0; f.vy = Math.min(f.vy, 0); f.inv = Math.max(f.inv, 40); f.fsLock = 0; g.ev.push({ t: 'fs', i: f.i, ch: f.ch, x: f.x, y: f.y - f.h }); },
    upd(g, f) {
      f.inv = Math.max(f.inv, 2);
      if (f.t < 36) { f.vx *= 0.7; f.vy = Math.min(f.vy, 0.6); return 0; }
      if (f.t === 36) fsLaunch(g, f);
      if (f.fsLock && g.fx.some(x => x.id === f.fsLock)) return 0;
      f.fsLock = 0;
      return 1;
    },
  },
};

// ---------- Snapshots (host -> clients) ----------
const FKEYS = ['i', 'ch', 'nm', 'tag', 'fc', 'st', 't', 'at', 'sp', 'sk', 'h', 'w', 'inv', 'star', 'pe', 'frz', 'psn', 'pick', 'hold',
  'shd', 'glide', 'rp', 'hs', 'gi', 'out', 'big', 'small', 'ctrT', 'ctr', 'lx', 'kos', 'falls', 'fs', 'fsLock', 'tn', 'chg', 'prT', 'ig', 'hide', 'boostT', 'jl',
  'gv', 'gby', 'thr',
  // Emilia Toad: Puck's position and paw-raise timer, the ice weapon in her hand, the chill on a foe, and her cooldowns
  'pkx', 'pky', 'pkt', 'wpn', 'slow', 'cd',
  // how frozen a fighter is in the Beast of the End's storm (0 to 1)
  'bfz',
  // team mode: which team a fighter is on (-1 = none)
  'team',
  // Water Yoshi: his Current and Ebb & Flow move, and anyone's Scalded / Sunk / flat-on-their-face timers
  'cur', 'ebv', 'scald', 'sunk', 'flat',
  // Nolan Toad: the Shirt's mold, what he found under the bed, and anyone's time in his stink or his room's reek
  'mold', 'find', 'stink', 'reek'];
const r1 = v => Math.round(v * 10) / 10;
function snapshot(g, ev) {
  const Hz = g.haz;
  return {
    frame: g.frame, stage: g.stage, phase: g.phase, pt: g.pt, winner: g.winner, results: g.phase === 'over' ? g.results : null,
    mode: g.mode, timeLeft: g.timeLeft, teams: g.teams, winTeam: g.winTeam,
    fighters: g.fighters.map(f => {
      const o = { x: r1(f.x), y: r1(f.y), dm: r1(f.dm), sc: Math.round(f.sc * 100) / 100 };
      for (const k of FKEYS) o[k] = f[k];
      o.h = r1(f.h); o.w = r1(f.w); o.shd = Math.round(f.shd);
      return o;
    }),
    // (vy aims Emilia's icicles; ms/mt/wp/hp are an ice soldier's state, timer, weapon and hits left)
    proj: g.proj.map(p => ({ id: p.id, k: p.k, x: Math.round(p.x), y: Math.round(p.y), vx: r1(p.vx), vy: r1(p.vy || 0), t: p.t, o: p.o, sub: p.sub, face: p.face, fc: p.fc, life: p.life, r: Math.round(p.r),
      ms: p.ms, mt: p.mt, wp: p.wp, hp: p.hp, vic: p.vic, mold: p.mold, big: p.big })),
    items: g.items.map(it => ({ k: it.k, x: Math.round(it.x), y: Math.round(it.y), t: it.t, sprout: it.sprout, life: it.life, hp: it.hp })),
    clouds: g.clouds.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), w: c.w, life: c.life })),
    brk: g.brk, php: g.php,
    ice: g.ice.map(s => ({ id: s.id, k: s.k, o: s.o, x: Math.round(s.x), y: Math.round(s.y), w: s.w, h: Math.round(s.h), hp: Math.ceil(s.hp), max: s.max, fc: s.fc, t: s.t, r: s.r, lv: s.lv, cr: s.cr, life: s.life })),
    kart: g.kart ? { x: Math.round(g.kart.x), dir: g.kart.dir, warn: g.kart.warn, c: g.kart.c } : null,
    fx: g.fx.map(e => ({ id: e.id, k: e.k, sub: e.sub, o: e.o, t: e.t, life: e.life, x: Math.round(e.x), y: Math.round(e.y), x2: e.x2 !== undefined ? Math.round(e.x2) : undefined,
      dir: e.dir, r: e.r, lv: e.lv !== undefined ? Math.round(e.lv) : undefined, vic: e.vic, b: e.b ? e.b.map(b => [Math.round(b[0]), Math.round(b[1])]) : undefined,
      both: e.both || undefined, side: e.side || undefined })),
    haz: { wig: { on: Hz.wig.on, x: Math.round(Hz.wig.x), dir: Hz.wig.dir, angry: Hz.wig.angry, warn: Hz.wig.warn }, spk: Hz.spk.map(k => ({ ph: k.ph, t: k.t })), wind: { ph: Hz.wind.ph, dir: Hz.wind.dir, t: Hz.wind.t },
      rock: { on: Hz.rock.on, x: Math.round(Hz.rock.x), dir: Hz.rock.dir, warn: Hz.rock.warn }, dark: { ph: Hz.dark.ph, t0: Hz.dark.t0 }, lava: { ph: Hz.lava.ph, lv: Math.round(Hz.lava.lv) },
      // (v1.15 stages)
      icl: { ph: Hz.icicle.ph, l: Hz.icicle.list.filter(c => c.on).map(c => [c.x, Math.round(c.y)]) }, conv: { ph: Hz.conv.ph, dir: Hz.conv.dir },
      pend: { ph: Hz.pend.ph, a: Math.round(Hz.pend.a * 1000) / 1000, warn: Hz.pend.warn }, tide: { ph: Hz.tide.ph, lv: Math.round(Hz.tide.lv) }, grav: { ph: Hz.grav.ph },
      star: Hz.star.list.map(m => [Math.round(m.x), Math.round(m.y), m.vx > 0 ? 1 : -1]) },
    ev,
  };
}
