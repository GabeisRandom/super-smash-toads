'use strict';
// ===== CPU Toads =====
// side specials that travel, handy for getting back to the stage
const AI_DASH = { toaddash: 1, iceslide: 1, firedash: 1, cutlass: 1, shadowdash: 1, lance: 1, jetdash: 1, turbo: 1, phase: 1, stagedive: 1,
  flamerush: 1, swoop: 1, stampede: 1, cartwheel: 1, iceskate: 1, nightdash: 1, angeldash: 1, fruitroll: 1, babyroll: 1, cowcharge: 1,
  quickdraw: 1, shieldrush: 1, tridentlunge: 1, staffwhirl: 1, bikeride: 1, dreidel: 1, blitzdash: 1, airdash: 1, dandiya: 1 };
// fighters whose neutral special is a projectile worth throwing from range
const AI_SHOOT = { turnip: 1, iceball: 1, fireball: 1, boomerang: 1, poison: 1, turnips: 1, egg: 1, cannon: 1, shuriken: 1, pancake: 1, starbolt: 1, raygun: 1, vitamin: 1, powerchord: 1, cork: 1, boo: 1, rocketfist: 1,
  firespit: 1, gust: 1, rockspit: 1, heartkiss: 1, sporespit: 1, shadowball: 1, lightbolt: 1, seedspit: 1, milkshot: 1,
  windslash: 1, axethrow: 1, scarab: 1, tridenttoss: 1, chipalm: 1, datetoss: 1, jelly: 1, latke: 1, minya: 1, boomkick: 1, blaster: 1, kingsgift: 1, colorthrow: 1 };
// side specials that can hook the ledge from this far away (px)
const AI_TETHER = { lasso: 160, canehook: 105, venomlash: 140 };
// finales that reach most of the stage, fine to fire right away
const AI_FS_WIDE = { wave: 1, freeze: 1, rain: 1, flood: 1, sweep: 1, pulses: 1, swarm: 1, clone: 1, meteor: 1, storm: 1 };

// CPU levels. 1 to 9 get steadily better (there used to be only 1 to 3: the old 1, 2 and 3 are about the new 2, 5
// and 8), 10 is GOD, and 0 is a Dummy that never moves. Each level has a skill q on the old scale (1 = the old
// level 1, 3 = the old level 3), how often it rethinks what to do (every `think` frames, so low levels react slowly,
// keeping on with what they were doing in between) and how often it just hesitates for a moment (`idle`). The top
// levels also learn GOD's tricks a bit at a time: reading attacks to parry them (`read`: the chance per attack),
// punishing a stunned foe (`punish`) and guarding the ledge (`edge`: the chance per time a foe is knocked off)
const AI_LEVELS = [null,
  { q: 0.55, think: 9, idle: 0.3 }, { q: 1.0, think: 6, idle: 0.14 }, { q: 1.3, think: 5, idle: 0.08 },
  { q: 1.65, think: 4, idle: 0.04 }, { q: 2.0, think: 3, idle: 0.02 }, { q: 2.35, think: 2, idle: 0 },
  { q: 2.7, think: 2, idle: 0, read: 0.1, punish: 0.25, edge: 0.15 }, { q: 3.0, think: 1, idle: 0, read: 0.25, punish: 0.5, edge: 0.35 },
  { q: 3.45, think: 1, idle: 0, read: 0.45, punish: 0.75, edge: 0.6 },
  { q: 4.6, think: 1, idle: 0, god: true, read: 1, punish: 1, edge: 1 }];
const AI_GOD = 10, AI_MAX = 10, AI_DEFAULT = 5;
const aiLevel = lvl => AI_LEVELS[Math.max(1, Math.min(AI_MAX, Math.round(lvl) || AI_DEFAULT))];
// how often (each frame) a CPU in reach attacks: the old levels' 0.05 / 0.11 / 0.22, smoothly in between and beyond
const aiAggr = q => (q <= 1 ? 0.05 * q : q <= 2 ? 0.05 + 0.06 * (q - 1) : 0.11 + 0.11 * (q - 2));
// the chance it parries an attack it sees coming (the old 0 / 0.22 / 0.45)
const aiParry = q => (q < 1.6 ? 0 : Math.min(0.97, 0.22 + 0.23 * (q - 2)));
// GOD reads everything: is a foe's attack, grab or shot about to land on f in the next few frames?
function godThreat(g, f) {
  for (const o of g.fighters) {
    if (o === f || ally(g, f, o) || !alive(o)) continue;
    const dx = o.x - f.x, ady = Math.abs(o.y - f.y);
    if (Math.abs(dx) > 170 || ady > 130) continue;
    if (o.st === 'atk' && o.at) {
      const A = ATK[o.ch][o.at], sp = CH[o.ch].aspd || 1;
      if (A && A.hb.length && o.t >= A.hb[0].a - 4 * sp && o.t < A.hb[0].a) return 'atk';
    }
    if (o.st === 'spc' && o.t < 7 && Math.abs(dx) < 150) return 'atk';
    if (o.st === 'grab' && o.t < 5 && Math.abs(dx) < 95) return 'grab';
  }
  for (const q of g.proj) {
    if (mineI(g, f.i, q.o) || q.k === 'minion' || q.k === 'trap' || !(q.d > 0)) continue;
    const vx = q.vx || 0, vy = q.vy || 0, nx = q.x + vx * 5, ny = q.y + vy * 5;
    if (Math.abs(nx - f.x) < 46 + f.w / 2 && Math.abs(ny - (f.y - f.h / 2)) < 62 && (f.x - q.x) * vx >= 0) return 'shot';
  }
  return null;
}

function aiBits(g, f) {
  // a Dummy (CPU level 0) never moves or does anything
  if (f.lvl === 0) return 0;
  const a = f.ai || (f.ai = { prev: 0, shieldT: 0, seq: [], tauntCd: 300, wait: 0, last: 0 });
  const S = aiLevel(f.lvl || AI_DEFAULT), q = S.q, god = !!S.god;
  const C = CH[f.ch];
  const main = STG[g.stage].solids[0];
  const L = main.x, R = main.x + main.w, T = main.y;
  const out = x => {
    let r = x;
    for (const m of [B_A, B_B, B_U, B_G, B_T1, B_T2, B_T3, B_T4]) if (a.prev & m && x & m) r &= ~m; // buttons must be re-pressed
    a.prev = r;
    return r;
  };
  // scripted inputs (a charging smash attack) pass straight through
  if (a.seq.length) { const b = a.seq.shift(); a.prev = b; return b; }
  if (a.tauntCd > 0) a.tauntCd--;
  if (f.st === 'dead') return out(0);
  if (f.rp > 0) return out(f.rp < 120 ? B_D : 0);
  if (f.st === 'ledge') return out(RND() < (god ? 0.2 : 0.05) ? (RND() < 0.3 ? B_A : B_U) : 0);
  if (f.st === 'taunt' || f.st === 'charge' || f.st === 'grab' || f.st === 'throw' || (f.st === 'spc' && f.sp === 'fs')) return out(0);
  // grabbed: mash to break free (better CPUs mash faster)
  if (f.st === 'held') return out(RND() < 0.25 + q * 0.2 ? (RND() < 0.5 ? B_A : B_B) : 0);
  // holding someone: a pummel or two, then a throw that suits their damage and the nearer edge
  if (f.st === 'hold') {
    const v = g.fighters.find(o => o.i === f.gv);
    if (!v) return out(0);
    if (q >= 1.6 && f.t < 8 * q && RND() < 0.5) return out(B_A);
    if (f.t < 6) return out(0);
    const fwd = f.fc > 0 ? B_R : B_L, back = f.fc > 0 ? B_L : B_R, toEdge = f.x > (L + R) / 2 ? 1 : -1, edgeThrow = toEdge === f.fc ? fwd : back;
    return out(v.dm > 85 ? edgeThrow : v.dm < 45 ? (RND() < 0.5 ? B_D : B_U) : RND() < 0.6 ? edgeThrow : B_U);
  }

  let b = 0;
  const over = f.x > L - 5 && f.x < R + 5;
  if (!over || f.y > T + 10) {
    // recovery: head home; wall-jump, double jump, the rising up-air, a lasso or cane at the ledge,
    // a travelling side special, then the up special
    const side = f.x < (L + R) / 2 ? -1 : 1, edgeX = side < 0 ? L : R;
    let home = side < 0 ? B_R : B_L;
    // below the top, line up just outside the ledge first, so the stage's underside doesn't block the way up
    if (f.y > T + 20) { const tx = edgeX + side * 34; home = f.x < tx - 6 ? B_R : f.x > tx + 6 ? B_L : 0; }
    b |= home;
    if (f.st !== 'air') return out(b);
    // a jump takes two frames to leave the ground; pressing anything else meanwhile would cancel it
    if (a.jw > 0) { a.jw--; return out(b); }
    // below the top, a fighter only rises past the ledge once its whole body is clear of the stage's side;
    // any closer and it bonks its head on the underside
    const gap = f.x < L ? L - f.x : f.x - R, below = f.y - T, outside = below < 20 ? f.x > R + 8 || f.x < L - 8 : gap > f.w / 2 + 4;
    // press a button combo cleanly: if any of it is still held from last frame, let go first
    const press = m => {
      if (a.prev & m) return out(b);
      a.jw = m === B_U ? 3 : 0;
      return out(b | m);
    };
    if (f.wallT > 0 && f.wj < 2 && f.vy > -3) return press(B_U);
    if (f.jl > 0 && f.vy > 1) return press(B_U);
    if (!f.uaUsed && f.jl === 0 && f.vy > 1 && below > -60 && (outside || below < 20 || below > 220)) return press(B_U | B_A);
    if (AI_TETHER[C.sp.s] && gap < AI_TETHER[C.sp.s] && below > -10 && below < 140 && f.vy > 0) return press(B_B);
    if (gap > 170 && AI_DASH[C.sp.s] && !f.sUsed && f.y < T + 40) return press(B_B);
    // save the up special until it can reach: close enough, or getting dangerously low
    if (f.jl === 0 && !f.upUsed && f.vy > 0 && f.y > T - 80 && ((gap < 240 && (outside || below < 20)) || below > 330)) return press(B_U | B_B);
    return out(b);
  }

  // reading attacks (GOD sees every one coming): a perfectly timed parry (or an air dodge in the air), a jump away
  // from grabs. Lower levels that can read decide once per attack whether they caught it
  const th = S.read ? godThreat(g, f) : null;
  if (!th) a.thr = 0;
  else if (!a.thr) a.thr = RND() < S.read ? 1 : -1;
  if (th && a.thr > 0) {
    {
      if (th === 'grab') { if (f.gi >= 0 && !(a.prev & B_U)) { a.jw = 2; return out(B_U); } }
      // (on the ground: a fresh press parries; while the parry recharges it just blocks)
      else if (f.gi >= 0) { if (!(a.prev & B_S)) a.shieldT = f.parryCd <= 0 ? 6 : 12; return out(B_S); }
      else if (!f.adUsed && !(a.prev & B_S)) return out(B_S);
    }
  }

  let tg = null, bd = 1e9;
  for (const o of g.fighters) {
    if (o === f || o.st === 'dead' || o.out || ally(g, f, o)) continue; // (never a teammate)
    // (GOD goes after whoever it can finish off: a high-damage foe counts as closer)
    const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.7 - (god ? Math.min(250, o.dm * 1.2) : 0);
    if (d < bd) { bd = d; tg = o; }
  }
  // nobody left standing nearby: a little showing off (never for GOD)
  if (!god && (!tg || bd > 520) && f.gi >= 0 && a.tauntCd === 0 && RND() < 0.01) { a.tauntCd = 700; return out(B_TAUNTS[Math.floor(RND() * 4)]); }
  if (!tg) return out(0);

  // the Smash Mushroom finale
  if (f.fs) {
    const D = FSDEF[f.ch] || {}, dx0 = tg.x - f.x, ady = Math.abs(tg.y - f.y);
    const inFront = Math.abs(dx0) < 620 && ady < 90;
    if (AI_FS_WIDE[D.k] || (D.k === 'beam' || D.k === 'fist' || D.k === 'rush' ? inFront : Math.abs(dx0) < 300 && ady < 160)) {
      if (D.k === 'beam' || D.k === 'fist' || D.k === 'rush') b |= dx0 > 0 ? B_R : B_L;
      return out(b | B_B);
    }
  }

  if (a.shieldT > 0) { a.shieldT--; return out(B_S); }

  // Emilia Toad: loose the ice volley whenever it's ready and a foe is in sight, keep a pair of ice soldiers out,
  // and put up an ice barrier when a shot is coming in
  if (C.volley && f.st !== 'atk' && f.st !== 'spc') {
    if (f.cd.a <= 0 && bd < 700 && RND() < 0.05 * q) return out(B_A);
    if (f.gi >= 0 && f.cd.n <= 0 && bd < 900 && RND() < 0.01 * q && g.proj.filter(p => p.sub === 'icesoldier' && p.o === f.i && p.hp > 0).length <= 2) return out(B_B);
    // (only for a shot coming at the side she faces, since the barrier goes up in front of her)
    if (f.gi >= 0 && f.cd.d <= 0 && q >= 1.6 && RND() < 0.2 && g.proj.some(p => p.o !== f.i && p.k !== 'minion' && p.k !== 'trap' && Math.abs(p.x - f.x) < 220 &&
      Math.abs(p.y - (f.y - f.h / 2)) < 90 && (p.x - f.x) * p.vx < 0 && (p.x - f.x) * f.fc > 0)) return out(B_B | B_D);
  }

  // stage hazards: hop over Wiggler and karts, step off spike tiles
  if (f.gi >= 0 && g.haz) {
    const W = g.haz.wig;
    if (W && W.on) {
      const x0 = W.dir > 0 ? W.x - WIG_LEN : W.x, near = f.x > x0 - 70 && f.x < x0 + WIG_LEN + 70;
      if (near && RND() < 0.25 + q * 0.2) return out(B_U | (W.dir > 0 ? B_R : B_L));
    }
    if (g.kart && g.kart.warn <= 0 && Math.abs(g.kart.x - f.x) < 280 && (f.x - g.kart.x) * g.kart.dir > 0 && RND() < 0.3 + q * 0.2) return out(B_U);
    const tiles = STG[g.stage].spikes;
    if (tiles) for (let k = 0; k < tiles.length; k++) {
      const s = g.haz.spk[k], tl = tiles[k];
      if (s && s.ph !== 'idle' && f.x > tl.x - 10 && f.x < tl.x + tl.w + 10) return out(f.x < tl.x + tl.w / 2 ? B_L : B_R);
    }
  }

  // slower CPUs only rethink every few frames (in between they keep moving the way they were) and the easiest
  // ones sometimes hesitate for a moment
  if (a.wait > 0) { a.wait--; return out(a.last & (B_L | B_R)); }
  a.wait = S.think - 1;
  if (S.idle && RND() < S.idle) { a.last = 0; a.wait += S.think; return out(0); }
  const act = x => { a.last = x; return out(x); };

  const dx = tg.x - f.x, dy = tg.y - tg.h / 2 - (f.y - f.h / 2), adx = Math.abs(dx);
  const reach = 70 * C.reach * f.sc;
  const aggr = aiAggr(q);
  const toward = dx > 0 ? B_R : B_L, away = dx > 0 ? B_L : B_R;
  // punishing: a foe stunned (after a parry or a broken shield) or in landing lag gets a charged smash or a grab
  if (S.punish && RND() < (god ? 1 : S.punish * 0.25) && f.gi >= 0 && (tg.st === 'stun' || tg.st === 'land') && adx < reach * 1.25 && Math.abs(dy) < 60) {
    if ((dx > 0) !== (f.fc > 0)) return act(toward);
    if (tg.dm > 70 || tg.st === 'stun') {
      const dir = dy < -40 ? B_U : toward, hold = Math.max(4, Math.min(28, (tg.t || 12) - 14));
      a.seq = [dir | B_A]; for (let k = 0; k < hold; k++) a.seq.push(B_A); a.seq.push(0);
      return act(0);
    }
    return act(B_G);
  }
  // guarding the edge: a foe trying to get back gets met at the ledge with a low attack (decided once per trip)
  const tgOff = (tg.x < L - 10 || tg.x > R + 10) && tg.y > T - 160;
  if (!tgOff) a.eg = 0; else if (!a.eg) a.eg = S.edge && RND() < S.edge ? 1 : -1;
  if (tgOff && a.eg > 0 && f.gi >= 0) {
    const edgeX = tg.x < L ? L + 26 : R - 26, ex = edgeX - f.x;
    if (Math.abs(ex) > 14) return act(ex > 0 ? B_R : B_L);
    if (Math.abs(tg.x - edgeX) < 150 && tg.y > T - 90 && RND() < 0.5) return act(B_D | B_A | (tg.x < f.x ? B_L : B_R));
    return act(0);
  }
  // go for the Smash Mushroom, otherwise a nearby helpful item, otherwise the target
  let goal = tg.x, sb = null;
  for (const it of g.items) {
    if (it.k === 'smash') { sb = it; continue; }
    if (it.k === 'poison' || (it.k === 'turnip' && f.hold)) continue;
    if (Math.abs(it.x - f.x) < 260 && Math.abs(it.y - f.y) < 120 && adx > 140) { goal = it.x; break; }
  }
  if (sb && !f.fs && (adx > 120 || q >= 1.6)) {
    goal = sb.x;
    const sdx = sb.x - f.x, sdy = sb.y - (f.y - f.h / 2);
    if (Math.abs(sdx) < 80 && Math.abs(sdy) < 70 && RND() < 0.3) return act(sdy < -30 ? B_U | B_A : B_A | (sdx > 0 ? B_R : B_L));
    if (Math.abs(sdx) < 120 && sdy < -60 && f.vy >= -2 && RND() < 0.12) return act(B_U | (sdx > 0 ? B_R : B_L));
  }
  const gdx = goal - f.x;
  if (Math.abs(gdx) > reach * 0.8) b |= gdx > 0 ? B_R : B_L;
  if (f.gi >= 0 && ((b & B_L && f.x < L + 40) || (b & B_R && f.x > R - 40))) b &= ~(B_L | B_R);
  if (dy < -80 && adx < 180 && RND() < 0.05 * q) b |= B_U;
  // drop through a soft platform (double-tap down) to chase someone below
  const under = f.gi >= 0 ? g.surf[f.gi] : null;
  if (under && !under.solid && dy > 60 && adx < 260 && RND() < 0.05 * Math.max(1, q)) { a.seq = [B_D, 0, B_D, 0]; return act(0); }
  // short jumpers (Captain Toad) use their up special to reach high targets
  if (dy < -110 && adx < 120 && f.jl === 0 && f.gi < 0 && f.vy > -2 && !f.upUsed && RND() < 0.1) return act(B_U | B_B);

  // parry: guard right as a nearby attack is about to land
  if (!god && f.gi >= 0 && !(a.prev & B_S) && q >= 1.6) {
    for (const o of g.fighters) {
      if (o === f || ally(g, f, o) || o.st !== 'atk' || !o.at || Math.abs(o.x - f.x) > 120) continue;
      const A = ATK[o.ch][o.at];
      if (A && A.hb.length && o.t >= A.hb[0].a - 3 && o.t < A.hb[0].a && RND() < aiParry(q)) { a.shieldT = 8; return act(B_S); }
    }
  }

  // someone turtling in their shield up close gets grabbed
  if (f.gi >= 0 && tg.gi >= 0 && tg.st === 'shield' && adx < reach * 0.85 && Math.abs(dy) < 30 && RND() < (god ? 0.6 : 0.05 * q)) {
    if ((dx > 0) !== (f.fc > 0)) return act(toward); // turn to face them first
    return act(B_G);
  }
  if (adx < reach && Math.abs(dy) < 70 * f.sc + 20 && RND() < aggr) {
    b &= ~(B_L | B_R);
    const r = RND();
    // (GOD only throws a smash attack when it can finish, and keeps up a stream of quick hits otherwise)
    const smashOk = q >= 1.6 && f.gi >= 0 && (god ? tg.dm > 95 : tg.dm > 60);
    if (f.gi >= 0 && tg.gi >= 0 && !f.hold && adx < reach * 0.7 && r < 0.09 && (dx > 0) === (f.fc > 0)) return act(B_G);
    if (f.hold) b |= B_A | toward;
    else if (smashOk && r < (god ? 0.55 : 0.3)) {
      // a charged smash attack: release, then tap direction + attack together and hold attack
      const dir = dy < -40 ? B_U : RND() < 0.25 ? B_D : toward, hold = god ? 4 + Math.floor(RND() * 8) : 6 + Math.floor(RND() * 24);
      a.seq = [dir | B_A];
      for (let k = 0; k < hold; k++) a.seq.push(B_A);
      a.seq.push(0);
      return act(0);
    } else if (dy < -40) b |= B_U | B_A;
    else if (dy > 40 && f.gi < 0) b |= B_D | B_A;
    else if (r < 0.3) b |= B_A | toward;
    else if (r < 0.5) b |= B_A;
    else if (r < 0.62) b |= B_B | B_D;
    else if (r < 0.76) b |= B_B | toward;
    else if (r < 0.84) b |= B_B;
    else if (r < 0.92 && f.gi < 0 && (dx > 0) !== (f.fc > 0)) b |= B_A | toward;
    else b |= B_A | B_D;
  } else if (adx > 200 && Math.abs(dy) < 120 && AI_SHOOT[C.sp.n] && RND() < 0.012 * q) {
    b = toward | B_B;
  } else if (adx > 160 && adx < 330 && Math.abs(dy) < 60 && f.gi >= 0 && AI_DASH[C.sp.s] && RND() < 0.006 * q) {
    b = toward | B_B;
  } else if (f.hold && adx < 420 && Math.abs(dy) < 100 && RND() < 0.04) {
    b = toward | B_A;
  }
  if (!god && tg.st === 'atk' && adx < 100 && f.gi >= 0 && RND() < 0.03 * q) {
    a.shieldT = 14 + Math.floor(RND() * 10);
    return act(B_S);
  }
  if (f.gi >= 0 && RND() < 0.004 * q) b |= B_U;
  if (b & away && f.gi >= 0 && RND() < 0.02) b &= ~away;
  return act(b);
}
