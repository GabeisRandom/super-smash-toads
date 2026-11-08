'use strict';
// ===== Simulation: runs on the host (online) or the local machine. Clients only render snapshots. =====
const RND = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const STG = {};
for (const s of STAGES) STG[s.id] = s;
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
function computeSurfaces(stageId, frame, clouds, brk) {
  const st = STG[stageId], out = [];
  for (const s of st.solids) out.push({ x: s.x, y: s.y, w: s.w, h: s.h, solid: true, dx: 0, dy: 0 });
  for (let pi = 0; pi < st.plats.length; pi++) {
    const p = st.plats[pi];
    if (brk && brk[pi] > frame) { out.push({ x: p.x, y: 1e5, w: 0, h: 0, solid: false, gone: true, pi, dx: 0, dy: 0 }); continue; }
    let x = p.x, y = p.y, dx = 0, dy = 0;
    if (p.move) {
      const m = p.move, k = (Math.PI * 2) / m.per;
      const sa = Math.sin(frame * k + m.ph), sb = Math.sin((frame - 1) * k + m.ph);
      x += m.ax * sa; y += m.ay * sa; dx = m.ax * (sa - sb); dy = m.ay * (sa - sb);
    }
    out.push({ x, y, w: p.w, h: 0, solid: false, bounce: !!p.bounce, mv: !!p.move, pi, dx, dy });
  }
  if (clouds) for (const c of clouds) out.push({ x: c.x, y: c.y, w: c.w, h: 0, solid: false, cloud: true, dx: 0, dy: 0 });
  return out;
}

function fighterBy(g, i) { for (const f of g.fighters) if (f.i === i) return f; return null; }
function airJumps(f) { return CH[f.ch].jumps - 1 + (f.pe > 0 ? 1 : 0); }
const alive = v => v.st !== 'dead' && !v.out;
// can `v` be struck right now (by anything other than itself)?
const hittable = v => alive(v) && v.inv <= 0 && v.ig <= 0 && v.rp <= 0;

function makeFighter(s, sp, stocks) {
  const C = CH[s.ch];
  return {
    i: s.slot, ch: s.ch, nm: s.name, tag: s.tag, ctrl: s.ctrl, pid: s.pid, lvl: s.lvl || 2,
    x: sp[0], y: sp[1], vx: 0, vy: 0, fc: sp[0] < 0 ? 1 : -1, st: 'air', t: 0, t2: 0,
    dm: 0, sk: stocks, gi: -1, jl: C.jumps - 1, at: null, sp: null, hits: {}, sh2: {}, hs: 0, hl: 0, inv: 0,
    shd: 100, big: 0, small: 0, star: 0, pe: 0, frz: 0, psn: 0, pick: 0, hold: null, drop: 0, jbuf: 0,
    adUsed: false, upUsed: false, sUsed: false, ledgeCd: 0, dead: 0, rp: 0, glide: 0, ff: false, cd: { n: 0, s: 0, u: 0, d: 0 }, pb: 0,
    sc: 1, h: C.h, w: 36 * C.wide, pm: 1, lastHit: -1, lastHitT: 0, kos: 0, falls: 0, dealt: 0,
    ctr: -1, ctrT: 0, lx: 0, lcx: 0, lcy: 0, lsi: 0, out: false, outAt: 0,
    fs: 0, fsLock: 0, tn: 0, chg: 0, chgMul: 1, parryAt: -99, prT: 0, dirAt: -99, dTap: -99, ig: 0, hide: 0, boostT: 0,
    uaUsed: false, wallT: 0, wall: 0, wj: 0,
    // grabs: gv = the foe I'm holding, gby = who holds me, gt = how long the hold lasts, pmT = pummel cooldown, thr = throw
    gv: -1, gby: -1, gt: 0, pmT: 0, thr: '',
    // anti-spam: parry cooldown, tiring dodges, and the queue of recent moves that landed (stale moves hit softer)
    parryCd: 0, dodgeN: 0, dodgeT: -999, stq: [], use: 0, useHit: -1, useSm: 1,
  };
}

function makeGame(cfg) {
  const st = STG[cfg.stage];
  const g = {
    frame: 0, stage: st.id, fighters: [], proj: [], items: [], clouds: [], fx: [], ev: [], phase: 'count', pt: 200,
    itemsOn: cfg.items, hazOn: cfg.hazards, nextItem: 540, kart: null, surf: [], results: null, winner: -1, pid: 1,
    // items: true = everything, 'smash' = only Smash Mushrooms (and much more often), false = none
    sbT: cfg.items === 'smash' ? 420 + RND() * 300 : 1500 + RND() * 900, haz: initHaz(st),
    // platforms cracked (php: hits taken) and broken (brk: when each comes back) by Subaru's El Minya
    brk: {}, php: {},
  };
  let n = 0;
  for (const s of cfg.slots) {
    if (!s) continue;
    g.fighters.push(makeFighter(s, st.spawn[n++ % st.spawn.length], cfg.stocks));
  }
  g.surf = computeSurfaces(g.stage, g.frame, g.clouds, g.brk);
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
  };
}

function stepGame(g, getBits) {
  g.frame++;
  g.surf = computeSurfaces(g.stage, g.frame, g.clouds, g.brk);
  if (g.phase === 'over') { g.pt++; return; }
  const counting = g.phase === 'count';
  if (counting) {
    g.pt--;
    if (g.pt === 180 || g.pt === 120 || g.pt === 60) g.ev.push({ t: 'count', n: g.pt / 60 });
    if (g.pt <= 0) { g.phase = 'play'; g.ev.push({ t: 'go' }); }
  }
  // broken platforms pop back into place when their time is up
  for (const pi in g.brk) if (g.brk[pi] === g.frame) { const S = STG[g.stage].plats[pi]; g.ev.push({ t: 'platback', x: S.x + S.w / 2, y: S.y, pi: +pi }); }
  for (const f of g.fighters) updateFighter(g, f, counting ? 0 : getBits(f));
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
  // Beatrice's follow-up spark (Subaru Toad), a moment after his hit lands; it fizzles if he gets hit first.
  // It only adds damage (it never knocks anyone, so it can't cut short the launch his hit just gave them)
  if (f.echo && --f.echo.t <= 0) {
    const E = f.echo; f.echo = null;
    if (f.st !== 'hit' && f.st !== 'stun' && f.st !== 'held') {
      const cx = f.x + E.x * f.fc, cy = f.y + E.y;
      for (const v of g.fighters) {
        if (v === f || !hittable(v) || v.inv > 0 || v.star > 0 || v.ig > 0) continue;
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
      f.vx *= onG ? 0.85 : 0.965;
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
  const help = f.st === 'help';
  if (pr & (B_L | B_R | B_U | B_D)) f.dirAt = g.frame;
  // Super Mushroom: slow and mighty; Mini Mushroom: quick and fragile
  const spd = (f.small ? 1.35 : 1) * (f.star ? 1.2 : 1) * (f.big ? 0.72 : 1);
  if (onG) {
    if (!help) for (let n = 0; n < 4; n++) if (pr & B_TAUNTS[n]) { startTaunt(g, f, n + 1); return; }
    if (f.boostT > 0) { f.vx += dirX * 0.3; f.st = 'run'; } // riding a dash panel keeps its speed
    else if (dirX) {
      f.vx += dirX * C.run * 0.22;
      const m = C.run * spd;
      f.vx = clamp(f.vx, -m, m);
      f.fc = dirX; f.st = 'run';
    } else {
      f.vx *= 0.72;
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
  if (pr & B_A) {
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
  const jm = f.small ? 1.18 : f.big ? 0.88 : 1;
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
  g.ev.push({ t: 'taunt', i: f.i, n, ch: f.ch, x: f.x, y: f.y - f.h });
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
      if (v === f || !hittable(v) || v.st === 'held' || v.st === 'ledge' || v.gby >= 0) continue;
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
    if (!s.solid) continue;
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
    if (!s.solid) continue;
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
  f.x = [-150, 150, -50, 50][f.i % 4]; f.y = -330; f.vx = 0; f.vy = 0; f.dm = 0; f.st = 'air';
  f.rp = 180; f.inv = 180; f.jl = airJumps(f); f.upUsed = false; f.adUsed = false; f.sUsed = false; f.uaUsed = false; f.wj = 0; f.hold = null;
  f.sp = null; f.at = null; f.gi = -1; f.shd = 100;
  g.ev.push({ t: 'respawn', x: f.x, y: f.y });
}

function ko(g, f) {
  g.ev.push({ t: 'ko', x: clamp(f.x, BLAST.l + 60, BLAST.r - 60), y: clamp(f.y - f.h / 2, BLAST.t + 60, BLAST.b - 60), i: f.i, ch: f.ch });
  if (f.lastHit >= 0 && g.frame - f.lastHitT < 600) { const a = fighterBy(g, f.lastHit); if (a && a !== f) a.kos++; }
  f.falls++; f.sk--; f.st = 'dead'; f.dead = 100; f.vx = 0; f.vy = 0;
  f.big = f.small = f.star = f.pe = f.frz = f.psn = f.pick = 0; f.hold = null; f.glide = 0; f.lastHit = -1;
  f.fs = 0; f.fsLock = 0; f.hide = 0; f.ig = 0; f.tn = 0; f.boostT = 0;
  f.x = 0; f.y = -2000;
  if (f.sk <= 0) { f.out = true; f.outAt = g.frame; }
}

function checkEnd(g) {
  if (g.phase !== 'play' || g.fighters.length < 2) return;
  const left = g.fighters.filter(f => !f.out);
  if (left.length > 1) return;
  g.phase = 'over'; g.pt = 0;
  g.winner = left.length ? left[0].i : -1;
  const order = g.fighters.slice().sort((a, b) => (b.out ? b.outAt : 1e9) - (a.out ? a.outAt : 1e9));
  g.results = order.map(f => ({ i: f.i, ch: f.ch, nm: f.nm, tag: f.tag, kos: f.kos, falls: f.falls, dealt: Math.round(f.dealt) }));
  g.ev.push({ t: 'game' });
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
    if (v === f || !hittable(v) || !fresh(v.i)) continue;
    if (!circRect(cx, cy, r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) continue;
    map[v.i] = g.frame;
    const dir = o.radial ? (v.x >= cx ? 1 : -1) : f.fc;
    applyHit(g, v, f, d * f.pm, k, gr, ang, dir, o);
    any = true;
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
  if (v.star > 0 || v.inv > 0 || v.ig > 0) return false;
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
  // a fighter caught in a grab is dropped when either of the two gets hit by someone else
  if (v.st === 'hold' || v.st === 'throw') releaseHeld(g, v, 0);
  if (v.gby >= 0) v.gby = -1;
  // Super Mushroom: tougher; Mini Mushroom: fragile
  d *= v.big ? 0.65 : v.small ? 1.4 : 1;
  v.dm = Math.min(999, v.dm + d);
  if (a) { a.dealt += d; v.lastHit = a.i; v.lastHitT = g.frame; }
  if (o.psn) v.psn = 210;
  const wt = CH[v.ch].weight * (v.big ? 1.5 : 1) * (v.small ? 0.55 : 1) * (v.st === 'crouch' ? 1.18 : 1);
  // knockback starts really weak and grows faster and faster with damage: the base part ramps from 20% (at 0%) up to
  // full strength (at 100%), and the damage part curves upward (about half strength at 15%, the same as before at
  // 100%, stronger beyond). Finales always hit at full strength.
  const ramp = o.fs ? 1 : 0.2 + 0.8 * Math.min(1, v.dm / 100);
  const eff = o.fs ? v.dm : v.dm * Math.pow(Math.max(v.dm, 1) / 100, 0.35);
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
    if (p.o === f.i || p.k === 'minion' || p.k === 'trap' || p.k === 'fsdrop') continue;
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
}

function spawnProj(g, f, o) {
  o.o = f.i; o.t = 0; o.pm = f.pm || 1; o.d *= o.pm; o.hits = {}; o.id = g.pid++;
  if (o.fc === undefined) o.fc = f.fc;
  g.proj.push(o);
  g.ev.push({ t: 'shoot', k: o.k, x: o.x, y: o.y, sub: o.sub });
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
    } else {
      if (p.k === 'boom') {
        p.vx -= 0.34 * p.dir0; p.x += p.vx; p.y += p.vy;
        const own = fighterBy(g, p.o);
        if (p.t > 25 && own && Math.abs(own.x - p.x) < 30 && Math.abs(own.y - own.h / 2 - p.y) < 50) kill = true;
        const sg = Math.sign(p.vx);
        if (sg !== p.lastSign) { p.hits = {}; p.lastSign = sg; }
      } else {
        if (p.home) {
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
            }
          }
        }
      }
      for (const v of g.fighters) {
        if (v.i === p.o || !hittable(v)) continue;
        if (p.hits[v.i] !== undefined && (!p.every || g.frame - p.hits[v.i] < p.every)) continue;
        if (circRect(p.x, p.y, p.r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) {
          p.hits[v.i] = g.frame;
          applyHit(g, v, fighterBy(g, p.o), p.d, p.kb, p.gr, p.ang, p.vx >= 0 ? 1 : -1, { proj: true, frz: p.frz, psn: p.psn, daze: p.daze, mv: 'p:' + p.k, use: 'p' + p.id });
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
  // Catholic Toad's piñata: the first foe to bump into it bursts it open, and candy flies everywhere
  if (p.sub === 'pinata') {
    for (const v of g.fighters) {
      if (v.i === p.o || !hittable(v) || !circRect(p.x, p.y, p.r, v.x - v.w / 2, v.y - v.h, v.w, v.h)) continue;
      applyHit(g, v, fighterBy(g, p.o), 9 * p.pm, 9, 0.12, 80, v.x >= p.x ? 1 : -1, { proj: true });
      g.ev.push({ t: 'candy', x: p.x, y: p.y });
      return true;
    }
    return false;
  }
  for (const v of g.fighters) {
    if (v.i === p.o || !hittable(v)) continue;
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
    if (v.i === p.o || !hittable(v)) continue;
    const last = p.hits[v.i];
    if (last !== undefined && (!every || g.frame - last < every)) continue;
    if (circRect(p.x, p.y - 22, 24, v.x - v.w / 2, v.y - v.h, v.w, v.h)) {
      p.hits[v.i] = g.frame;
      applyHit(g, v, fighterBy(g, p.o), d * p.pm, kb, gr, ang, p.sub === 'mail' ? p.fc : v.x >= p.x ? 1 : -1, { proj: true });
    }
  }
}

function updMinion(g, p) {
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
      if (q === p || q.o === p.o || q.k === 'minion' || q.k === 'trap') continue;
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
      if (it.t > it.life) { g.items.splice(n, 1); g.sbT = g.itemsOn === 'smash' ? 300 + RND() * 300 : 1200 + RND() * 900; g.ev.push({ t: 'sbgone', x: it.x, y: it.y }); }
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
  g.sbT = g.itemsOn === 'smash' ? 720 + RND() * 480 : 2400 + RND() * 1200;
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
  // El Minya rains crystals at the same pace as the other rains, but 30% longer (23 crystals instead of 18)
  mormon: { k: 'pulses', sub: 'choir' }, hasidic: { k: 'lasso', sub: 'hora' }, subaru: { k: 'rain', sub: 'crystal', n: 23, every: 8.15 },
  dashyoshi: { k: 'rush', sub: 'dash', spd: 26, laps: 3 }, mechyoshi: { k: 'beam', sub: 'mech' },
  catholic: { k: 'wave', sub: 'parranda' }, hindu: { k: 'vortex', sub: 'color', move: 2.6, life: 210, r: 240 },
};
// finales that keep their user busy until they finish
const FS_LOCK = { burst: 1, rush: 1, clone: 1, beam: 1, pulses: 1, lasso: 1 };

function fsLaunch(g, f) {
  const D = FSDEF[f.ch] || FSDEF.toad, s = STG[g.stage].solids[0];
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
  }
  g.fx.push(e);
  if (FS_LOCK[D.k]) f.fsLock = e.id;
  g.ev.push({ t: 'fsgo', k: D.k, sub: e.sub, i: f.i, x: f.x, y: f.y });
}

function fsFoes(g, e) { return g.fighters.filter(v => v.i !== e.o && alive(v) && v.rp <= 0); }
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
        // El Minya aims half its crystals at the platforms, so they slowly crack and break
        if (e.sub === 'crystal') {
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
          if (v === f || !hittable(v)) continue;
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
    start(g, f, c) { if (!useCd(f, o.slot || 's', o.cd)) return false; if (c.onG) f.vx *= 0.3; f.ctr = -1; },
    upd(g, f, c) {
      f.vx *= 0.8; if (!c.onG) f.vy = Math.min(f.vy, 2);
      const a = o.a || 8, b = o.b || 14, reach = o.range * f.sc, cy = f.y - f.h * 0.55;
      if (f.ctr < 0 && f.t >= a && f.t <= b) {
        const ext = reach * Math.min(1, (f.t - a + 1) / Math.max(1, b - a));
        // off the stage, the line hooks the ledge instead
        if (o.ledge && !c.onG && tetherLedge(g, f, Math.min(ext + 30 * f.sc, o.ledge * f.sc))) return 0;
        for (const v of g.fighters) {
          if (v === f || !hittable(v)) continue;
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
        // the catch is held (reeled in) for `hold` frames, then `fin` lands
        const k = f.t - f.t2, hold = o.hold || 12;
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
// Beatrice's Minya: three crystal shards (the special itself, and a mid-Murak cast). Its knockback grows
// steeply with the foe's damage (gr), so it can KO at high percents
const MINYA = { cd: 30, vys: [-1.2, 0, 1.2], p: { k: 'crystal', vx: 16.5, d: 5.5, kb: 4.5, gr: 0.09, ang: 35, r: 10, life: 54, ghost: 1, oy: 0.75 } };
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
          if (v === f || !hittable(v)) continue;
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
  // Minya flies twice as far and half again as fast as it first did, with a quarter less cooldown
  minya: spCast(spShot({ cd: MINYA.cd, at: 10, end: 24, shots: MINYA.vys.map(vy => Object.assign({ vy }, MINYA.p)) }), 'beako', 'Minya!'),
  // Shamac's black mist stuns for a full second
  shamac: spCast(spShot({ slot: 's', cd: 150, at: 12, end: 26, p: { k: 'shamac', vx: 4.4, d: 1, kb: 0.5, gr: 0, ang: 60, r: 38, life: 150, pierce: 1, every: 70, daze: 60, ghost: 1 } }), 'beako', 'Shamac!'),
  // Murak floats them up (15% longer than before), and Beatrice can still fire Minya on the way: press Special again
  murak: (() => {
    const base = spFloat({ frames: 81, rise: 4.4, drift: 5.5, ev: 'yinfx' });
    return spCast(Object.assign({}, base, {
      upd(g, f, c) {
        if (f.t > 2 && c.pressed & B_B && !(c.bits & (B_U | B_D)) && f.cd.n <= 0) fireMinya(g, f, c);
        return base.upd(g, f, c);
      },
    }), 'beako', 'Murak!');
  })(),
  // the Unseen Hand reaches 180 and holds its catch for 18 frames before the squeeze launches them
  unseenhand: spCast(spTether({ slot: 'd', cd: 70, range: 180, a: 10, b: 18, hold: 18, fin: { d: 7, k: 8, g: 0.11, ang: 70 } }), 'unseen', ''),
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
  'gv', 'gby', 'thr'];
const r1 = v => Math.round(v * 10) / 10;
function snapshot(g, ev) {
  const Hz = g.haz;
  return {
    frame: g.frame, stage: g.stage, phase: g.phase, pt: g.pt, winner: g.winner, results: g.phase === 'over' ? g.results : null,
    fighters: g.fighters.map(f => {
      const o = { x: r1(f.x), y: r1(f.y), dm: r1(f.dm), sc: Math.round(f.sc * 100) / 100 };
      for (const k of FKEYS) o[k] = f[k];
      o.h = r1(f.h); o.w = r1(f.w); o.shd = Math.round(f.shd);
      return o;
    }),
    proj: g.proj.map(p => ({ id: p.id, k: p.k, x: Math.round(p.x), y: Math.round(p.y), vx: r1(p.vx), t: p.t, o: p.o, sub: p.sub, face: p.face, fc: p.fc, life: p.life, r: Math.round(p.r) })),
    items: g.items.map(it => ({ k: it.k, x: Math.round(it.x), y: Math.round(it.y), t: it.t, sprout: it.sprout, life: it.life, hp: it.hp })),
    clouds: g.clouds.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), w: c.w, life: c.life })),
    brk: g.brk, php: g.php,
    kart: g.kart ? { x: Math.round(g.kart.x), dir: g.kart.dir, warn: g.kart.warn, c: g.kart.c } : null,
    fx: g.fx.map(e => ({ id: e.id, k: e.k, sub: e.sub, o: e.o, t: e.t, life: e.life, x: Math.round(e.x), y: Math.round(e.y), x2: e.x2 !== undefined ? Math.round(e.x2) : undefined,
      dir: e.dir, r: e.r, lv: e.lv !== undefined ? Math.round(e.lv) : undefined, vic: e.vic, b: e.b ? e.b.map(b => [Math.round(b[0]), Math.round(b[1])]) : undefined,
      both: e.both || undefined, side: e.side || undefined })),
    haz: { wig: { on: Hz.wig.on, x: Math.round(Hz.wig.x), dir: Hz.wig.dir, angry: Hz.wig.angry, warn: Hz.wig.warn }, spk: Hz.spk.map(k => ({ ph: k.ph, t: k.t })), wind: { ph: Hz.wind.ph, dir: Hz.wind.dir, t: Hz.wind.t },
      rock: { on: Hz.rock.on, x: Math.round(Hz.rock.x), dir: Hz.rock.dir, warn: Hz.rock.warn }, dark: { ph: Hz.dark.ph, t0: Hz.dark.t0 }, lava: { ph: Hz.lava.ph, lv: Math.round(Hz.lava.lv) } },
    ev,
  };
}
