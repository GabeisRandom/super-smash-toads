'use strict';
// ===== V3D: one game frame in the origami style — 3D world on WebGL, paper effects and HUD on the 2D overlay =====
const V3D = (() => {
  let ok = false, bgc = null, bgx = null, glc = null, cv2 = null, cx2 = null;
  const PX = 1 / 28, FOV = (30 * Math.PI) / 180, M4 = G3.M4, I = G3.M4.I();
  const FOC = 360 / Math.tan(FOV / 2);
  const LIGHT = G3.v.norm([-0.55, 0.75, 0.45]), INK = [0.43, 0.3, 0.22, 1];
  const PAPER = '#fbf6ec', INKC = '#5a3a26';

  function init() {
    bgc = document.getElementById('bgc'); glc = document.getElementById('glc'); cv2 = document.getElementById('cv');
    if (!bgc || !glc || !cv2) return false;
    if (!G3.init(glc)) { glc.style.display = 'none'; return false; }
    try { M3D.build(); } catch (e) { console.warn('3D models failed to build', e); glc.style.display = 'none'; return false; }
    bgx = bgc.getContext('2d'); cx2 = cv2.getContext('2d');
    ok = true;
    grainOverlay();
    // render every portrait size up front so nothing draws into the shared GL canvas mid-frame
    for (const C of CHARS) for (const s of [64, 96, 130, 160]) portrait3(C.id, s);
    for (const st of STAGES) stageThumb3(st.id, 156, 88);
    return true;
  }
  function grainOverlay() {
    const g = document.getElementById('grain');
    if (!g) return;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), r = G3.B.prng(5);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const v = 200 + r() * 55; x.fillStyle = `rgb(${v},${v - 6},${v - 14})`; x.fillRect(r() * 256, r() * 256, 1, 1); }
    x.strokeStyle = 'rgba(150,120,90,.18)'; x.lineWidth = 0.6;
    for (let i = 0; i < 160; i++) { const px = r() * 256, py = r() * 256, a = r() * Math.PI * 2, l = 3 + r() * 9; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    g.style.backgroundImage = `url(${c.toDataURL()})`;
    g.classList.remove('hidden');
  }

  // ---------- world ----------
  const PSCALE = { turnip: 2.4, bomb: 1.9, ice: 1.9, fire: 1.9, boom: 2.3, psn: 1.5, egg: 2.1, coin: 2.2,
    cannon: 2.6, shuriken: 1.8, pancake: 2.2, star: 1.4, laser: 1.5, pill: 2.2, cork: 2.0, tumble: 2.1, boo: 2.2, fist: 2.4, pie: 2.3,
    gust: 2.4, rock: 2.2, heart: 2.4, bubble: 2.4, shade: 2.6, lightbolt: 2.0, seed: 2.6, melon: 2.4 };
  const FSDROP = { egg: 3.8, cannon: 3.6, pill: 3.4, fire: 4.4, melon: 3.4 };
  const fighterOf = (view, i) => (view.fighters || []).find(f => f.i === i);
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  // a mesh drawn s times larger keeps the same ink-line width as everything else
  const ink = (s, o) => Object.assign({ inkW: 0.06 / s }, o || {});
  function drawProj(p, fr) {
    const X = p.x * PX, Y = -p.y * PX, dir = p.vx >= 0 ? 1 : -1, t = p.t || 0, P = M3D.PROJ;
    if (p.k === 'trap') {
      const T = M3D.TRAP[p.sub]; if (!T) return;
      if (p.sub === 'soup') G3.draw(T, M4.chain(M4.T(X, Y, 0.35), M4.S(1.26, 1.26, 1.26)), ink(1.26));
      else if (p.sub === 'rune') G3.draw(T, M4.chain(M4.T(X, Y + 0.02, 0.35), M4.RY(fr * 0.03), M4.S(1.06, 1.06, 1.06)), { self: 0.55 + 0.35 * Math.sin(fr * 0.15) });
      // Light Blue Yoshi's frost patch glints; Purple Yoshi's toxic puddle bubbles
      else if (p.sub === 'frost') G3.draw(T, M4.chain(M4.T(X, Y + 0.02, 0.35), M4.S(1.3, 1.3, 1.3)), ink(1.3, { self: 0.25 + 0.15 * Math.sin(fr * 0.12) }));
      else if (p.sub === 'toxic') G3.draw(T, M4.chain(M4.T(X, Y + 0.02, 0.35), M4.S(1.3, 1.3 * (1 + 0.12 * Math.sin(t * 0.3)), 1.3)), ink(1.3, { self: 0.15 }));
      else {
        // the amp thumps on each of its three pulses
        const pump = 1 + [20, 50, 80].reduce((a, t0) => a + Math.max(0, 1 - Math.abs(t - t0) / 5) * 0.14, 0);
        G3.draw(T, M4.chain(M4.T(X, Y, 0.35), M4.RY(-0.35 * (p.fc || 1)), M4.S(1.3, 1.3 * pump, 1.3)), ink(1.3));
      }
      return;
    }
    if (p.k === 'fsdrop') {
      const s = FSDROP[p.sub] || 3.5;
      G3.draw(P[p.sub] || P.egg, M4.chain(M4.T(X, Y, 0.4), M4.RZ(-t * 0.12 * dir), M4.S(s, s, s)), ink(s, p.sub === 'pill' ? { self: 0.15 } : p.sub === 'fire' ? { self: 1 } : null));
      // Volcano Rain: each fireball trails flames
      if (p.sub === 'fire') G3.draw(M3D.PROPS.flame, M4.chain(M4.T(X, Y + 0.5, 0.4), M4.RZ(Math.PI), M4.S(2.6, 2.2 + Math.random() * 0.8, 2.6)), { self: 1 });
      return;
    }
    if (p.k === 'haze') {
      const s = (p.r || 34) * PX;
      G3.draw(P.haze, M4.chain(M4.T(X, Y, 0.35), M4.RZ(t * 0.02), M4.S(s, s * (0.9 + 0.1 * Math.sin(t * 0.2)), s)), { alpha: 0.5 * clamp01(((p.life || 200) - t) / 30), self: 0.2 });
      return;
    }
    const m = P[p.k]; if (!m) return;
    let s = PSCALE[p.k] || 2, R = I, dy = 0, o = null;
    switch (p.k) {
      case 'turnip': R = M4.RZ(-t * 0.25 * dir); dy = -0.17 * s; break;
      case 'psn': dy = -0.3 * s; break;
      case 'boom': R = M4.RZ(t * 0.5); break;
      case 'egg': case 'bomb': case 'tumble': case 'pie': R = M4.RZ(-t * 0.2 * dir); break;
      case 'coin': R = M4.RY(t * 0.3); break;
      case 'fire':
        o = { self: 1 };
        G3.draw(M3D.PROPS.flame, M4.chain(M4.T(X - dir * 0.2, Y, 0.3), M4.RZ(dir > 0 ? -Math.PI / 2 : Math.PI / 2), M4.S(0.9, 0.7 + Math.random() * 0.4, 0.9)), { self: 1 });
        break;
      // the Yoshi clan's shots
      case 'gust': R = M4.RZ(t * 0.35 * dir); o = { alpha: 0.8, self: 0.4 }; break;
      case 'rock': case 'melon': R = M4.RZ(-t * 0.22 * dir); break;
      case 'heart': R = M4.RZ(Math.sin(t * 0.2) * 0.25); s *= 1 + 0.08 * Math.sin(t * 0.4); o = { self: 0.35 }; break;
      case 'bubble': dy = Math.sin(t * 0.2) * 0.08; o = { alpha: 0.65, self: 0.35 }; break;
      case 'shade':
        R = M4.RZ(t * 0.1); o = { self: 0.2 };
        G3.draw(P.ball, M4.chain(M4.T(X, Y, 0.3), M4.S(0.85, 0.85, 0.85)), { alpha: 0.22 + 0.08 * Math.sin(t * 0.3), tint: [0.35, 0.2, 0.55, 0.9], self: 0.3 });
        break;
      case 'lightbolt': R = M4.RY(dir > 0 ? 0 : Math.PI); o = { self: 1 }; break;
      case 'shuriken': R = M4.RZ(t * 0.9 * dir); break;
      case 'pancake': case 'pill': R = M4.RZ(-t * 0.3 * dir); break;
      case 'star': R = M4.RZ(t * 0.15); dy = -0.42 * s; o = { self: 0.75 }; break;
      case 'laser': R = M4.RY(dir > 0 ? 0 : Math.PI); o = { self: 1 }; break;
      case 'note': s = ((p.r || 22) / 22) * 2.2; R = M4.RZ(Math.sin(t * 0.3) * 0.3); o = { self: 0.4 }; break;
      case 'cork': R = M4.RY(dir > 0 ? 0 : Math.PI); break;
      case 'boo': R = M4.RY(dir * 0.45); dy = Math.sin(t * 0.15) * 0.08; o = { alpha: 0.92 }; break;
      case 'fist':
        R = M4.RY(dir > 0 ? 0 : Math.PI);
        G3.draw(M3D.PROPS.flame, M4.chain(M4.T(X - dir * 0.6, Y, 0.3), M4.RZ(dir > 0 ? -Math.PI / 2 : Math.PI / 2), M4.S(1.4, 1.6 + Math.random() * 0.6, 1.4)), { self: 1 });
        break;
    }
    G3.draw(m, M4.chain(M4.T(X, Y, 0.3), R, M4.T(0, dy, 0), M4.S(s, s, s)), ink(s, o));
  }
  // stage hazards: Wiggler, spike tiles, dash panels
  function drawHazards(view, fr) {
    const st = STG[view.stage], H = view.haz, F = M3D.FXM, top = -st.solids[0].y * PX + (S3D.get(view.stage).lift || 0);
    if (H && H.wig && H.wig.on) {
      const W = H.wig, dir = W.dir, ry = M4.RY(dir > 0 ? -0.5 : Math.PI + 0.5), sp = W.angry ? 0.5 : 0.25, tint = W.angry ? [1, 0.22, 0.12, 0.6] : null;
      for (let k = 4; k >= 1; k--) G3.draw(F.wigSeg, M4.chain(M4.T((W.x - dir * (20 + k * 34)) * PX, top + Math.abs(Math.sin(fr * sp + k * 0.9)) * 0.22, 0.25), ry), { tint });
      G3.draw(F.wigHead, M4.chain(M4.T(W.x * PX, top + Math.abs(Math.sin(fr * sp)) * 0.18, 0.25), ry), { tint });
    }
    if (st.spikes) st.spikes.forEach((tl, k) => {
      const s = H && H.spk && H.spk[k], ph = s ? s.ph : 'idle', cx = (tl.x + tl.w / 2) * PX, w = tl.w * PX;
      G3.draw(F.spikePlate, M4.chain(M4.T(cx, top + 0.005, 0.2), M4.S(w, 1, 1)));
      if (ph === 'idle') return;
      const h = ph === 'up' ? -0.85 * clamp01(((s.t || 0) - 95) / 5) : -0.66 + 0.05 * Math.sin(fr * 1.9);
      G3.draw(F.spikes, M4.chain(M4.T(cx, top + h, 0.2), M4.S(w, 1.35, 1)));
    });
    if (st.boost) for (const b of st.boost) for (let k = 0; k < 3; k++) {
      const x = (b.x + b.w * (0.2 + k * 0.3)) * PX, glow = Math.max(0, Math.sin(fr * 0.22 - k * 1.1));
      G3.draw(F.chev, M4.chain(M4.T(x, top + 0.02, 0.4), M4.RY(b.dir > 0 ? 0 : Math.PI), M4.S(1.2, 1, 1.4)), { self: 0.25 + 0.75 * glow, tint: [1, 0.9, 0.3, 0.3 * glow] });
    }
  }
  // Smash Mushroom finales
  function drawFx3(e, view, fr) {
    const s0 = STG[view.stage].solids[0], X = e.x * PX, Y = -e.y * PX, F = M3D.FXM;
    switch (e.k) {
      case 'wave': M3D.drawCrowd(e, s0.y, fr); break;
      case 'meteor': {
        if (e.sub === 'cake') { const r = (e.r || 210) * PX * 0.42; G3.draw(F.cake, M4.chain(M4.T(X, Y - 30 * PX, 0), M4.RY(fr * 0.02), M4.S(r, r, r)), ink(r)); }
        else { const r = (e.r || 250) * PX * 0.4; G3.draw(F.sun, M4.chain(M4.T(X, Y - 30 * PX + r, -0.5), M4.RZ(fr * 0.03), M4.S(r, r, r)), { self: 0.85 }); }
        break;
      }
      case 'vortex': {
        const R = (e.r || 230) * PX;
        if (e.sub === 'rune') G3.draw(M3D.TRAP.rune, M4.chain(M4.T(X, Y, -1.0), M4.RX(Math.PI / 2), M4.RY(fr * 0.04), M4.S(R * 0.7, R * 0.7, R * 0.7)), { self: 1 });
        else for (let q = 0; q < 26; q++) {
          // Leaf Storm whirls leaves; Blue Yoshi's Feather Cyclone whirls feathers
          const a = fr * 0.13 + q * 0.83, rr = R * (0.22 + ((q * 37) % 26) / 26 * 0.75), h = (((q * 53) % 20) - 10) * 0.045 * R;
          const fe = e.sub === 'feather';
          G3.draw(fe ? F.feather : F.leaf, M4.chain(M4.T(X + Math.cos(a) * rr, Y + h * 0.5 + Math.sin(a * 0.5) * 0.3, Math.sin(a) * rr * 0.45), M4.RY(a), M4.RZ(a * 2), M4.S(1.7, 1.7, 1.7)), fe ? { ink: false, self: 0.45 } : ink(1.7));
        }
        break;
      }
      case 'flood': {
        const top = -e.lv * PX, bot = -(BLAST.b + 300) * PX;
        G3.draw(M3D.PROJ.ice3, M4.chain(M4.T(0, (top + bot) / 2, 0.2), M4.S(60, (top - bot) / 2, 3.4)), { alpha: 0.5, tint: [0.5, 0.15, 0.7, 0.9], self: 0.3 });
        break;
      }
      case 'beam': if (e.t >= 24) {
        const L = 46, cx = X + e.dir * L / 2, w = clamp01((e.t - 24) / 6) * (e.t > 70 ? clamp01(1 - (e.t - 70) / 10) : 1) + 0.01;
        G3.draw(M3D.PROJ.ball, M4.chain(M4.T(cx, Y, 0.2), M4.S(L / 2, 2.4 * w, 1.3 * w)), { alpha: 0.5, tint: [1, 0.96, 0.7, 0.9], self: 1 });
        G3.draw(M3D.PROJ.ball, M4.chain(M4.T(cx, Y, 0.25), M4.S(L / 2, 1.1 * w, 0.6 * w)), { alpha: 0.85, tint: [1, 1, 1, 1], self: 1 });
      } break;
      case 'sweep': if (e.t >= 16) {
        const k = clamp01((e.t - 16) / 8) * clamp01((146 - e.t) / 10) + 0.01, gy = -s0.y * PX;
        G3.draw(M3D.PROJ.ice3, M4.chain(M4.T(X, gy + 20, 0), M4.S(2.3 * k, 20, 1.2)), { alpha: 0.45, tint: [0.5, 1, 1, 0.9], self: 1 });
        G3.draw(M3D.PROJ.ice3, M4.chain(M4.T(X, gy + 20, 0.1), M4.S(0.9 * k, 20, 0.6)), { alpha: 0.85, tint: [0.92, 1, 1, 1], self: 1 });
      } break;
      case 'pulses': {
        const own = fighterOf(view, e.o); if (!own) break;
        if (e.sub === 'quake') {
          // Mega Quake: every stomp throws boulders up out of the ground all along the stage
          const gy = -s0.y * PX;
          for (const t0 of [22, 52, 82, 112]) {
            const q = (e.t - t0) / 18; if (q < 0 || q > 1) continue;
            for (let n = 0; n < 9; n++) {
              const x = (s0.x + 40 + ((n * 131 + t0 * 7) % (s0.w - 80))) * PX, h = 4 * q * (1 - q) * (1.6 + (n % 3) * 0.7), sc = 2.6 + (n % 2) * 1.2;
              G3.draw(M3D.PROJ.rock, M4.chain(M4.T(x, gy + h, 0.2 + (n % 3) * 0.35), M4.RZ(q * 4 + n), M4.S(sc, sc, sc)), ink(sc));
            }
          }
          break;
        }
        const pump = 1 + [22, 52, 82, 112].reduce((a, t0) => a + Math.max(0, 1 - Math.abs(e.t - t0) / 6) * 0.15, 0);
        for (const [dx, dz, sc] of [[-1.7, -1.3, 1.5], [1.7, -1.3, 1.5], [0, -1.8, 1.9]]) G3.draw(M3D.TRAP.amp, M4.chain(M4.T(own.x * PX + dx, -own.y * PX, dz), M4.S(sc, sc * pump, sc)), ink(sc));
        break;
      }
      case 'swarm': if (e.b) e.b.forEach((b, q) => G3.draw(M3D.PROJ.boo, M4.chain(M4.T(b[0] * PX, -b[1] * PX + Math.sin(fr * 0.2 + q) * 0.1, 0.3 + (q % 3) * 0.2), M4.RY(Math.sin(fr * 0.05 + q) * 0.6), M4.S(2.6, 2.6, 2.6)), { alpha: 0.9 })); break;
      case 'fist': {
        const s = 11;
        G3.draw(M3D.PROJ.fist, M4.chain(M4.T(X, Y, 0.3), M4.RY(e.dir > 0 ? 0 : Math.PI), M4.S(s, s, s)), ink(s));
        G3.draw(M3D.PROPS.flame, M4.chain(M4.T(X - e.dir * 0.3 * s, Y, 0.3), M4.RZ(e.dir > 0 ? -Math.PI / 2 : Math.PI / 2), M4.S(s * 0.9, s * (0.8 + Math.random() * 0.5), s * 0.9)), { self: 1 });
        break;
      }
      case 'rain': if (e.side) {
        // Pirate Toad's airship lobs cannonballs from offstage
        const sx = (e.dir > 0 ? s0.x - 620 : s0.x + s0.w + 620) * PX, sy = 270 * PX + Math.sin(fr * 0.05) * 0.3, Ms = M4.chain(M4.T(sx, sy, -2), M4.RY(e.dir > 0 ? 0 : Math.PI), M4.S(2.2, 2.2, 2.2));
        G3.draw(F.ship, Ms, ink(2.2));
        G3.draw(F.propblade, M4.chain(Ms, M4.T(-2.45, 0.6, 0), M4.RX(fr * 0.6), M4.S(0.6, 0.6, 0.6)), ink(1.3));
      } break;
    }
  }
  function drawWorld(view, fr) {
    const S = S3D.get(view.stage);
    for (const m of S.statics) G3.draw(m, I);
    if (S.movers.length) {
      const surf = computeSurfaces(view.stage, view.frame, view.clouds);
      for (const mv of S.movers) { const s = surf[mv.idx]; if (s) G3.draw(mv.mesh, M4.T((s.x + s.w / 2) * PX, -s.y * PX, 0)); }
    }
    for (const cl of view.clouds || []) G3.draw(M3D.PROJ.cloud, M4.chain(M4.T((cl.x + cl.w / 2) * PX, -(cl.y + 8) * PX, 0), M4.S(cl.w / 120, 0.8, 0.8)), cl.life < 60 ? { alpha: cl.life / 60 } : null);
    const k = view.kart;
    // karts burst onto the road at its ends rather than floating in from the sky beyond it
    if (k && k.warn <= 0 && Math.abs(k.x) < STG[view.stage].solids[0].w / 2 + 50) G3.draw(M3D.KARTS[k.c || 0], M4.chain(M4.T(k.x * PX, 0, 0.6), M4.RY(k.dir > 0 ? 0 : Math.PI), M4.S(1.15, 1.15, 1.15)));
    drawHazards(view, fr);
    for (const it of view.items || []) {
      if (it.life - it.t < 120 && Math.floor(fr / 5) % 2) continue;
      if (it.k === 'smash') {
        // the Smash Mushroom floats in a rainbow bubble
        const X = it.x * PX, Y = -it.y * PX + Math.sin(fr * 0.08) * 0.15, sc = 2.5, hit = it.hp < 3 ? 1 + (3 - it.hp) * 0.04 : 1;
        G3.draw(M3D.ITEM.smash, M4.chain(M4.T(X, Y - 0.35 * sc, 0.4), M4.RY(fr * 0.04), M4.S(sc * hit, sc * hit, sc * hit)), ink(sc, { self: 0.22 }));
        G3.draw(M3D.PROJ.ball, M4.chain(M4.T(X, Y, 0.4), M4.S(1.25, 1.25, 1.25)), { alpha: 0.2 + 0.06 * Math.sin(fr * 0.2), tint: M3D.hueTint(fr, 0.9, 6), self: 0.9 });
        continue;
      }
      const kind = it.k === 'turnip' && it.sprout ? 'sprout' : it.k, m = M3D.ITEM[kind];
      if (!m) continue;
      const sc = kind === 'chest' ? 1.6 : kind === 'star' ? 1.5 : 1.75, bob = kind === 'star' ? Math.sin(fr * 0.2) * 0.12 : 0;
      G3.draw(m, M4.chain(M4.T(it.x * PX, -it.y * PX + bob, 0.25), M4.RY(Math.sin(fr * 0.03 + it.x) * 0.7 + (kind === 'star' ? fr * 0.05 : 0)), M4.S(sc, sc, sc)), ink(sc));
    }
    for (const p of view.proj || []) { if (p.k === 'minion') M3D.drawMinion(p, fr); else drawProj(p, fr); }
    for (const f of view.fighters || []) if (f.st !== 'dead' && !f.out) M3D.drawFighter(f, fr);
    for (const e of view.fx || []) drawFx3(e, view, fr);
  }
  function frame(view, cam, fr, opts) {
    opts = opts || {};
    const S = S3D.get(view.stage), z = cam.z || 0.8;
    const sh = cam.shake ? [((Math.random() - 0.5) * cam.shake) / z, ((Math.random() - 0.5) * cam.shake) / z] : [0, 0];
    const D = (FOC * PX) / z, E = S.env;
    bgx.setTransform(1, 0, 0, 1, 0, 0); S.backdrop(bgx, cam, fr);
    G3.begin({ cam: [(cam.x + sh[0]) * PX, -(cam.y + sh[1]) * PX, D], fov: FOV, near: 1, far: 1400, fog: E.fog, fogR: [D + E.f0, D + E.f1, E.fa], L: LIGHT, amb: E.amb, dif: E.dif, cool: E.cool, ink: INK, inkW: 0.055, crease: 0.3 });
    drawWorld(view, fr);
    G3.end();
    cx2.setTransform(1, 0, 0, 1, 0, 0); cx2.clearRect(0, 0, 1280, 720);
    cx2.setTransform(z, 0, 0, z, 640 - (cam.x + sh[0]) * z, 360 - (cam.y + sh[1]) * z);
    paperFx(cx2, view, fr);
    paperParticles(cx2);
    if (opts.tags !== false) for (const f of view.fighters || []) if (f.st !== 'dead' && !f.out && f.tag) paperTag(cx2, f);
    cx2.setTransform(1, 0, 0, 1, 0, 0);
    screenFx(cx2, view, fr);
    if (view.kart && view.kart.warn > 0 && Math.floor(fr / 8) % 2) kartWarning(cx2, view.kart.dir);
    const W = view.haz && view.haz.wig;
    if (W && !W.on && W.warn > 0 && Math.floor(fr / 8) % 2) kartWarning(cx2, W.dir, 'WIGGLER!');
    if (opts.hud !== false) paperHUD(cx2, view);
  }
  // screen-space weather: Mushroom Gorge gusts and the Absolute Zero frost
  function screenFx(c, view, fr) {
    const w = view.haz && view.haz.wind;
    if (w && w.ph === 'blow' && view.stage === 'gorge') {
      c.save(); c.lineCap = 'round';
      for (let k = 0; k < 16; k++) {
        const len = 90 + (k % 4) * 40, x = (((fr * 26 + k * 173) % 1500) + 1500) % 1500, xx = w.dir > 0 ? x - 110 : 1390 - x, y = 70 + ((k * 97) % 520);
        c.globalAlpha = 0.35 + (k % 3) * 0.15; c.strokeStyle = k % 2 ? '#ffffff' : '#e8f4ff'; c.lineWidth = 3 + (k % 3);
        c.beginPath(); c.moveTo(xx, y); c.quadraticCurveTo(xx - w.dir * len * 0.5, y - 8, xx - w.dir * len, y); c.stroke();
      }
      c.restore();
    }
    if (w && w.ph === 'warn' && view.stage === 'gorge' && Math.floor(fr / 8) % 2) {
      c.save(); c.font = `40px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round'; c.strokeStyle = INKC; c.lineWidth = 7;
      const txt = w.dir > 0 ? 'GUST >>>' : '<<< GUST', x = w.dir > 0 ? 200 : 1080;
      c.strokeText(txt, x, 140); c.fillStyle = '#dff3ff'; c.fillText(txt, x, 140); c.restore();
    }
    if ((view.fx || []).some(e => e.k === 'freeze')) {
      const g = c.createRadialGradient(640, 360, 220, 640, 360, 760); g.addColorStop(0, 'rgba(190,240,255,0)'); g.addColorStop(1, 'rgba(190,240,255,0.55)');
      c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    }
  }

  // ---------- paper effects on the overlay (world coordinates, sim pixels) ----------
  function pshadow(c, fn, dx, dy) { c.save(); c.translate(dx || 1.5, dy || 2); c.globalAlpha *= 0.28; fn('#3a2414'); c.restore(); fn(null); }
  function paperRing(c, x, y, r, col, w) {
    pshadow(c, sc => { c.strokeStyle = sc || col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); });
  }
  function paperStar(c, x, y, r, a, b, rot) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const an = rot + (i / n) * Math.PI * 2 - Math.PI / 2, a0 = an - Math.PI / n, a1 = an + Math.PI / n;
      c.fillStyle = a; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a0) * r * 0.42, y + Math.sin(a0) * r * 0.42); c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); c.fill();
      c.fillStyle = b; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); c.lineTo(x + Math.cos(a1) * r * 0.42, y + Math.sin(a1) * r * 0.42); c.fill();
    }
  }
  function shade(hex, k) { const c = G3.B.hex(hex); return `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`; }
  function paperFx(c, view, fr) {
    for (const f of view.fighters || []) {
      if (f.st === 'dead' || f.out) continue;
      const sc = f.sc || 1, cx = f.x, cy = f.y - f.h * 0.5, top = f.y - f.h;
      if (f.sp === 'scream' && f.t >= 6 && f.t <= 42) {
        const r = Math.min(150, 40 + (f.t - 6) * 4) * sc, a = 1 - (f.t - 6) / 40;
        c.save(); c.globalAlpha = 0.75 * a; paperRing(c, cx, cy, r, '#fff6c8', 6); paperRing(c, cx, cy, r * 0.7, '#ffffff', 3); c.restore();
      }
      if (f.sp === 'scold' && f.t >= 10 && f.t <= 18) {
        c.save(); c.globalAlpha = 0.85;
        for (let k = 0; k < 3; k++) pshadow(c, s => { c.strokeStyle = s || '#ffffff'; c.lineWidth = 4; c.beginPath(); c.arc(cx + f.fc * (20 + k * 18) * sc, cy, (16 + k * 10) * sc, f.fc > 0 ? -0.9 : Math.PI - 0.9, f.fc > 0 ? 0.9 : Math.PI + 0.9); c.stroke(); });
        c.restore();
      }
      if (f.sp === 'pigspin' && f.t < 38) { c.save(); c.globalAlpha = 0.7; pshadow(c, s => { c.strokeStyle = s || '#ff9ccb'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, 40 * sc, fr * 0.6, fr * 0.6 + 4); c.stroke(); }); c.restore(); }
      if (f.sp === 'counter' && f.ctrT === 0 && f.t >= 3 && f.t <= 32) { c.save(); c.globalAlpha = 0.6 + Math.sin(fr * 0.8) * 0.2; paperRing(c, cx, cy, f.h * 0.66, '#8dffa0', 4); c.restore(); }
      // Spore Spin flings red and white spores around Toad
      if (f.sp === 'sporespin' && f.t < 30) for (let k = 0; k < 6; k++) {
        const a = fr * 0.5 + k * 1.047, x = cx + Math.cos(a) * 36 * sc, y = cy - 6 + Math.sin(a) * 14 * sc;
        pshadow(c, s => { c.fillStyle = s || (k % 2 ? '#e8262b' : PAPER); c.beginPath(); c.arc(x, y, 4.5 * sc, 0, Math.PI * 2); c.fill(); if (!s) { c.strokeStyle = INKC; c.lineWidth = 1.2; c.stroke(); } });
      }
      // Captain Toad's pickaxe wind-up
      if (f.sp === 'pickaxe' && f.t < 14) {
        c.save(); c.font = `28px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
        c.strokeStyle = INKC; c.lineWidth = 5; c.strokeText('!', cx, top - 50); c.fillStyle = '#ffe866'; c.fillText('!', cx, top - 50);
        c.restore();
      }
      if (f.st === 'stun') for (let k = 0; k < 3; k++) { const a = fr * 0.15 + k * 2.1; paperStar(c, cx + Math.cos(a) * 20, top - 10 + Math.sin(a) * 5, 7, '#ffe066', '#ffb52e', a); }
      if (f.hide > 0) continue; // haunting Ghost Toad gives nothing away
      // taunts: dance notes, a laughing face, sleepy Zs
      if (f.st === 'taunt') {
        const t = f.t || 0;
        if (f.tn === 1 && t % 24 < 14) { c.save(); c.globalAlpha = 1 - (t % 24) / 14; inkText(c, '♪', cx - (f.fc || 1) * 30 + Math.sin(t * 0.3) * 6, top - (t % 24) * 1.5, 22, '#ffe066'); c.restore(); }
        if (f.tn === 2) laughFace(c, cx + 42 * (f.fc || 1), top - 30 - Math.abs(Math.sin(t * 0.3)) * 8, 19 * sc, t);
        if (f.tn === 3 && t > 36) for (let k = 0; k < 3; k++) { const q = ((t - 36) / 26 + k / 3) % 1; c.save(); c.globalAlpha = 1 - q; inkText(c, 'Z', cx + 18 + q * 30, top - 6 - q * 46, 12 + q * 14, '#ffffff'); c.restore(); }
      }
      // holding a smash attack: sparks gather, and flash when fully charged
      if (f.st === 'charge') {
        const q = Math.min(1, (f.chg || 0) / 60);
        for (let k = 0; k < 3; k++) { const a = fr * 0.4 + k * 2.1; paperStar(c, cx + Math.cos(a) * (28 - q * 8) * sc, cy + Math.sin(a) * (24 - q * 6) * sc, 4 + q * 5, '#fff6a0', '#ffd23a', a); }
        if (q >= 1 && fr % 8 < 4) paperRing(c, cx, cy, 42 * sc, '#fff6a0', 3);
      }
      // the Smash Mushroom's power waiting to be unleashed: a rainbow aura
      if (f.fs) {
        const h = (fr * 8) % 360;
        c.save(); c.globalAlpha = 0.65;
        for (let k = 0; k < 2; k++) paperRing(c, cx, cy, f.h * 0.62 + k * 7 + Math.sin(fr * 0.2) * 3, `hsl(${(h + k * 90) % 360},95%,62%)`, 3);
        c.restore();
        for (let k = 0; k < 4; k++) { const a = fr * 0.09 + k * 1.57; paperStar(c, cx + Math.cos(a) * f.h * 0.72, cy + Math.sin(a) * f.h * 0.56, 5, `hsl(${(h + k * 60) % 360},95%,65%)`, '#ffffff', a); }
      }
      // cane hook, bandage and lasso reach out on a line
      const TT = f.st === 'spc' && TETHER[f.sp];
      if (TT) {
        const t = f.t || 0, hx = cx + (f.fc || 1) * 16 * sc, hy = f.y - f.h * 0.58;
        let tx = null, ty = null;
        if (f.ctr >= 0) { const v = fighterOf(view, f.ctr); if (v) { tx = v.x; ty = v.y - v.h * 0.5; } }
        else if (t >= TT.a && t <= TT.b + 6) { const ext = TT.range * sc * Math.min(1, (t - TT.a + 1) / Math.max(1, TT.b - TT.a)) * (t > TT.b ? clamp01(1 - (t - TT.b) / 6) : 1); tx = hx + (f.fc || 1) * ext; ty = hy; }
        if (tx !== null) paperRope(c, hx, hy, tx, ty, TT.col, TT.w, TT.end);
      }
      if (f.sp === 'gravwell' && f.t >= 4 && f.t <= 38) {
        const gx = cx + (f.fc || 1) * 20 * sc;
        c.save(); for (let k = 0; k < 3; k++) { const q = (f.t * 0.05 + k / 3) % 1; c.globalAlpha = 0.25 + 0.5 * q; paperRing(c, gx, cy, (12 + 170 * (1 - q)) * sc, '#b07dff', 2.5); } c.restore();
      }
      if (f.sp === 'headlamp' && f.t >= 8 && f.t <= 18) {
        const d = f.fc || 1, x0 = cx + d * 12, y0 = top + 16;
        c.save(); c.globalAlpha = 0.45 * (1 - Math.abs(f.t - 11) / 9); c.fillStyle = '#fff6a8';
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + d * 200, y0 - 56); c.lineTo(x0 + d * 200, y0 + 96); c.closePath(); c.fill(); c.restore();
      }
      if (f.sp === 'checkup' && f.t % 10 < 5) paperRing(c, cx, cy, f.h * 0.55, '#7dff8a', 2.5);
      if (f.st === 'atk' && f.at) {
        const A = ATK[f.ch] && ATK[f.ch][f.at];
        if (A && A.fx !== 'tongue') for (const hb of A.hb) {
          if (f.t < hb.a - 1 || f.t > hb.b + 3) continue;
          swoosh(c, f, A, hb, sc, cx, cy);
        }
      }
    }
    // the Smash Mushroom twinkles as it drifts
    for (const it of view.items || []) if (it.k === 'smash') for (let k = 0; k < 5; k++) {
      const a = fr * 0.06 + k * 1.2566, r = 44 + Math.sin(fr * 0.1 + k) * 5;
      paperStar(c, it.x + Math.cos(a) * r, it.y + Math.sin(a) * r * 0.8, 5 + (k % 2) * 2, `hsl(${(fr * 6 + k * 72) % 360},95%,65%)`, '#ffffff', a);
    }
    // stage hazards
    const st = STG[view.stage], s0 = st.solids[0], H = view.haz;
    if (H && st.spikes) st.spikes.forEach((tl, k) => {
      const s = H.spk && H.spk[k];
      if (s && s.ph === 'warn' && fr % 10 < 6) { c.save(); inkText(c, '!', tl.x + tl.w / 2, s0.y - 24, 26, '#ff5a4a'); c.restore(); }
    });
    // finale overlays
    for (const e of view.fx || []) {
      switch (e.k) {
        case 'wave': for (const [x0, d] of e.both ? [[e.x, e.dir], [e.x2, -e.dir]] : [[e.x, e.dir]]) for (let k = 0; k < 4; k++) {
          const x = x0 - d * (60 + k * 50) + Math.sin(fr * 0.3 + k) * 8, r = 14 + ((fr + k * 7) % 14);
          c.save(); c.globalAlpha = 0.55; c.fillStyle = '#f4ead6'; c.beginPath(); c.arc(x, s0.y - r * 0.6, r, 0, Math.PI * 2); c.fill(); c.restore();
        } break;
        case 'meteor': {
          const d = clamp01(1 - (s0.y - 30 - e.y) / 900);
          c.save(); c.globalAlpha = 0.35 * d; c.fillStyle = '#3a2414'; c.beginPath(); c.ellipse(e.x, s0.y - 2, (e.r || 200) * 0.6 * d + 8, 10 * d + 2, 0, 0, Math.PI * 2); c.fill(); c.restore();
          break;
        }
        case 'vortex': {
          c.save(); c.lineCap = 'round';
          for (let k = 0; k < 5; k++) { c.globalAlpha = 0.5; c.strokeStyle = e.sub === 'rune' ? '#d8b0ff' : '#ffffff'; c.lineWidth = 4; c.beginPath(); c.arc(e.x, e.y, (e.r || 230) * (0.3 + k * 0.15), fr * 0.15 + k, fr * 0.15 + k + 1.6); c.stroke(); }
          c.restore();
          break;
        }
        case 'flood': {
          c.save(); c.strokeStyle = '#c890ff'; c.lineWidth = 6; c.beginPath();
          for (let x = -1400; x <= 1400; x += 40) { const y = e.lv + Math.sin(x * 0.02 + fr * 0.12) * 7; if (x === -1400) c.moveTo(x, y); else c.lineTo(x, y); }
          c.stroke();
          for (let k = 0; k < 10; k++) { const bx = -600 + ((k * 137 + fr * 2) % 1200), by = e.lv + 20 + ((k * 53 + fr * 1.5) % 120); paperRing(c, bx, by, 4 + (k % 3) * 2, '#e2c8ff', 2); }
          c.restore();
          break;
        }
        case 'burst': for (const [t0, r] of [[10, 150], [40, 235], [70, 340]]) { const q = (e.t - t0) / 16; if (q >= 0 && q <= 1) { c.save(); c.globalAlpha = 1 - q * 0.6; paperRing(c, e.x, e.y, r * q, '#ff8cc6', 10 * (1 - q) + 2); c.restore(); } } break;
        case 'sweep': if (e.t < 140) { c.save(); c.globalAlpha = 0.8; paperRing(c, e.x, s0.y - 4, 30 + Math.sin(fr * 0.5) * 4, '#7dfcff', 3); c.restore(); } break;
        case 'lasso': {
          const own = fighterOf(view, e.o); if (!own || !e.vic) break;
          for (const i of e.vic) { const v = fighterOf(view, i); if (v && v.st !== 'dead' && !v.out) paperRope(c, own.x, own.y - own.h * 0.9, v.x, v.y - v.h * 0.5, '#c8a060', 3, 'loop'); }
          break;
        }
        case 'rush': {
          const own = fighterOf(view, e.o); if (!own) break;
          c.save(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3;
          for (let k = 0; k < 5; k++) { const y = own.y - 10 - k * 14, x = own.x - e.dir * (50 + ((fr * 9 + k * 37) % 80)); c.beginPath(); c.moveTo(x, y); c.lineTo(x - e.dir * 50, y); c.stroke(); }
          c.restore();
          break;
        }
        case 'clone': if (e.vic) for (const i of e.vic) {
          const v = fighterOf(view, i); if (!v || (e.t - 1) % 14 > 6) continue;
          c.save(); c.globalAlpha = 0.85; c.strokeStyle = e.sub === 'shadow' ? '#ff5a7a' : '#b8b8ff'; c.lineWidth = 5; c.lineCap = 'round';
          const x = v.x, y = v.y - v.h * 0.5; c.beginPath(); c.moveTo(x - 30, y - 30); c.lineTo(x + 30, y + 30); c.moveTo(x + 30, y - 30); c.lineTo(x - 30, y + 30); c.stroke(); c.restore();
        } break;
        case 'freeze': for (let k = 0; k < 18; k++) { const x = -700 + ((k * 151 + fr * 1.2) % 1400), y = -620 + ((k * 89 + fr * 2.2) % 760); paperStar(c, x, y, 5, '#e8fbff', '#bfeeff', fr * 0.02 + k); } break;
      }
    }
  }
  // every move template leaves its own trail, in the fighter's element colours; a finisher after a flurry bursts
  function swoosh(c, f, A, hb, sc, cx, cy) {
    const fc = f.fc || 1, k = clamp01((f.t - hb.a + 1) / (hb.b - hb.a + 4)), x = f.x + hb.x * fc * sc, y = f.y + hb.y * sc, r = hb.r * sc, d = Math.hypot(x - cx, y - cy);
    const C = CH[f.ch], E = ELEM_COL[C.elem], main = E ? E[0] : C.swoosh || '#ffffff', acc = E ? E[1] : '#fff2a0';
    const col = A.smash ? acc : main, blade = C.style === 'blade', fx = hb.sep ? 'burst' : A.fx;
    c.save(); c.globalAlpha = 0.9 * (1 - k * 0.6); c.lineCap = 'round'; c.lineJoin = 'round';
    switch (fx) {
      case 'stab': // a straight thrust with a sharp tip
        pshadow(c, s => {
          c.strokeStyle = s || col; c.lineWidth = Math.max(4, r * 0.32);
          c.beginPath(); c.moveTo(cx + fc * 12 * sc, y); c.lineTo(x + fc * r * 0.7, y); c.stroke();
          c.fillStyle = s || main; c.beginPath(); c.moveTo(x + fc * r * 1.25, y); c.lineTo(x + fc * r * 0.45, y - r * 0.32); c.lineTo(x + fc * r * 0.45, y + r * 0.32); c.closePath(); c.fill();
        });
        break;
      case 'ring': // a ring that swells outward
        pshadow(c, s => { c.strokeStyle = s || col; c.lineWidth = 7 * (1 - k) + 2; c.beginPath(); c.arc(x, y, r * (0.45 + k * 0.75), 0, Math.PI * 2); c.stroke(); });
        if (k < 0.8) { c.strokeStyle = main; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * (0.25 + k * 0.5), 0, Math.PI * 2); c.stroke(); }
        break;
      case 'burst': // rays burst from the hit point
        for (let n = 0; n < 8; n++) {
          const a = n * 0.785 + f.t * 0.12, L0 = r * (0.2 + k * 0.3), L1 = r * (0.65 + k * 0.6);
          pshadow(c, s => { c.strokeStyle = s || (n % 2 ? main : col); c.lineWidth = n % 2 ? 3 : 5; c.beginPath(); c.moveTo(x + Math.cos(a) * L0, y + Math.sin(a) * L0); c.lineTo(x + Math.cos(a) * L1, y + Math.sin(a) * L1); c.stroke(); });
        }
        break;
      case 'flurry': // a blur of fists hammering away
        for (let n = 0; n < 3; n++) {
          const q = ((f.t * 5 + n * 7) % 9) / 9, px = x - fc * (1 - q) * r * 0.8, py = y + (n - 1) * r * 0.45;
          pshadow(c, s => { c.strokeStyle = s || (n === 1 ? col : main); c.lineWidth = 4; c.beginPath(); c.moveTo(px - fc * r * 0.6, py); c.lineTo(px, py); c.stroke(); c.fillStyle = s || main; c.beginPath(); c.arc(px, py, r * 0.22, 0, Math.PI * 2); c.fill(); });
        }
        break;
      case 'kick': { // a crescent where the foot swings through, with an impact star
        const ang = Math.atan2(y - cy, x - cx), rr = Math.max(d, r * 0.8);
        pshadow(c, s => { c.strokeStyle = s || col; c.lineWidth = r * 0.42; c.beginPath(); c.arc(cx, cy, rr, ang - 0.35 - k * 0.7, ang + 0.35); c.stroke(); });
        if (k < 0.6) paperStar(c, x, y, r * 0.35 * (1 - k) + 2, main, acc, f.t * 0.3);
        break;
      }
      case 'chomp': { // jaws snapping shut on the spot
        const open = r * 0.55 * (1 - k);
        for (const sg of [-1, 1]) pshadow(c, s => {
          c.strokeStyle = s || col; c.lineWidth = 4; c.beginPath();
          for (let n = 0; n <= 4; n++) { const px = x - r * 0.6 + n * r * 0.3, py = y + sg * (open + (n % 2 ? 0 : r * 0.22)); if (n === 0) c.moveTo(px, py); else c.lineTo(px, py); }
          c.stroke();
        });
        break;
      }
      case 'stomp': // impact lines under the feet
        pshadow(c, s => {
          c.strokeStyle = s || col; c.lineWidth = 4;
          for (const sg of [-1, 0, 1]) { c.beginPath(); c.moveTo(x + sg * r * 0.55, y - r * 0.5); c.lineTo(x + sg * r * 0.8, y + r * (0.3 + k * 0.4)); c.stroke(); }
          c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + r * 0.35, r * (0.5 + k * 0.6), r * 0.18, 0, 0, Math.PI * 2); c.stroke();
        });
        break;
      case 'spin': { // a full circle around the body
        const rr = Math.max(r, d);
        pshadow(c, s => { c.strokeStyle = s || col; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, rr, k * 6, k * 6 + 4.2); c.stroke(); });
        c.strokeStyle = main; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, rr * 0.78, k * 6 + 0.5, k * 6 + 3.4); c.stroke();
        break;
      }
      default: { // arc / pick: a crescent through the hit point; blades leave a long, thin trail
        if (d < 12) { pshadow(c, s => { c.strokeStyle = s || col; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, r, k * 6, k * 6 + 4.2); c.stroke(); }); break; }
        const ang = Math.atan2(y - cy, x - cx), sw = blade ? 1.05 : 0.75;
        pshadow(c, s => { c.strokeStyle = s || col; c.lineWidth = r * (blade ? 0.3 : A.smash ? 0.6 : 0.45); c.beginPath(); c.arc(cx, cy, d, ang - sw, ang + sw); c.stroke(); });
        if (blade || A.smash) { c.strokeStyle = blade ? '#ffffff' : main; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, d + r * 0.12, ang - sw * 0.85, ang + sw * 0.85); c.stroke(); }
      }
    }
    c.restore();
  }
  const TETHER = { canehook: { range: 84, a: 9, b: 13, col: '#8a5326', w: 5, end: 'hook' }, bandage: { range: 62, a: 8, b: 13, col: '#fbfbf6', w: 7, end: 'wrap' }, lasso: { range: 150, a: 10, b: 16, col: '#c8a060', w: 3, end: 'loop' } };
  function paperRope(c, x0, y0, x1, y1, col, w, end) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + Math.min(18, Math.abs(x1 - x0) * 0.08);
    pshadow(c, s => {
      c.strokeStyle = s || col; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.stroke();
      if (end === 'loop') { c.lineWidth = Math.max(2, w - 0.5); c.beginPath(); c.ellipse(x1, y1, 16, 10, 0, 0, Math.PI * 2); c.stroke(); }
      if (end === 'hook') { c.beginPath(); c.arc(x1, y1 - 8, 8, Math.PI * 0.5, Math.PI * 1.9); c.stroke(); }
      if (end === 'wrap') { c.lineWidth = 3; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x1 - 10, y1 + k * 7 - 4); c.lineTo(x1 + 10, y1 + k * 7 + 4); c.stroke(); } }
    });
  }
  function inkText(c, text, x, y, size, col) {
    c.font = `${size}px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
    c.strokeStyle = INKC; c.lineWidth = Math.max(3, size / 5); c.strokeText(text, x + 1.5, y + 2); c.strokeText(text, x, y);
    c.fillStyle = col; c.fillText(text, x, y);
  }
  // a paper laughing-face sticker with happy eyes, a big grin and tears of joy
  function laughFace(c, x, y, r, t) {
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.35) * 0.18);
    c.fillStyle = 'rgba(58,36,20,.3)'; c.beginPath(); c.arc(2, 3, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INKC; c.lineWidth = 2; c.stroke();
    c.lineWidth = 2.4; c.lineCap = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.38, -r * 0.18, r * 0.2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    c.fillStyle = '#7a2a1a'; c.beginPath(); c.moveTo(-r * 0.58, r * 0.08); c.quadraticCurveTo(0, r * 0.12, r * 0.58, r * 0.08); c.quadraticCurveTo(r * 0.45, r * 0.75, 0, r * 0.78); c.quadraticCurveTo(-r * 0.45, r * 0.75, -r * 0.58, r * 0.08); c.fill(); c.stroke();
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(0, r * 0.55, r * 0.24, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7fd3ff'; for (const s of [-1, 1]) { const dy = ((t * 0.8) % 10) * 0.5; c.beginPath(); c.ellipse(s * r * 0.82, -r * 0.05 + dy, r * 0.16, r * 0.26, s * 0.4, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  function paperParticles(c) {
    for (const p of PT) {
      const k = p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.5);
      switch (p.type) {
        case 'dot': { const s = p.size * (0.6 + k * 0.6); c.translate(p.x, p.y); c.rotate(p.life * 0.3); c.fillStyle = 'rgba(58,36,20,.25)'; c.fillRect(-s / 2 + 1, -s / 2 + 1.5, s, s * 0.7); c.fillStyle = p.color; c.fillRect(-s / 2, -s / 2, s, s * 0.7); break; }
        case 'puff': { const s = p.size * (1.5 - k * 0.5); c.fillStyle = p.tint || 'rgba(255,250,240,.85)'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.lineTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s); } c.fill(); break; }
        // element particles: bubbles, snowflakes, music notes
        case 'bubble': { const s = p.size * (0.8 + (1 - k) * 0.5); c.strokeStyle = p.color; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, s, 0, Math.PI * 2); c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.25, 0, Math.PI * 2); c.fill(); break; }
        case 'flake': { const s = p.size; c.translate(p.x, p.y); c.rotate(p.life * 0.08); c.strokeStyle = p.color; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; c.moveTo(Math.cos(a) * s, Math.sin(a) * s); c.lineTo(-Math.cos(a) * s, -Math.sin(a) * s); } c.stroke(); break; }
        case 'note': { c.font = `${p.size * 3}px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round'; c.strokeStyle = INKC; c.lineWidth = 3; c.strokeText('♪', p.x, p.y); c.fillStyle = p.color; c.fillText('♪', p.x, p.y); break; }
        case 'spark': { const L = Math.hypot(p.vx, p.vy) * 3 + 2, a = Math.atan2(p.vy, p.vx), w = p.size * k * 0.8; c.translate(p.x, p.y); c.rotate(a); c.fillStyle = 'rgba(58,36,20,.3)'; c.beginPath(); c.moveTo(1, 1.5 - w); c.lineTo(-L + 1, 1.5); c.lineTo(1, 1.5 + w); c.fill(); c.fillStyle = p.color; c.beginPath(); c.moveTo(0, -w); c.lineTo(-L, 0); c.lineTo(0, w); c.fill(); break; }
        case 'ring': paperRing(c, p.x, p.y, p.size * (1 - k) + 6, p.color, 3 * k + 1.5); break;
        case 'star': paperStar(c, p.x, p.y, p.size, p.color, shade(p.color.startsWith('#') ? p.color : '#ffe066', 0.8), p.life * 0.2); break;
        case 'heart': c.fillStyle = p.color; c.beginPath(); c.moveTo(p.x, p.y + 8); c.lineTo(p.x - 8, p.y - 1); c.lineTo(p.x - 4, p.y - 6); c.lineTo(p.x, p.y - 2); c.lineTo(p.x + 4, p.y - 6); c.lineTo(p.x + 8, p.y - 1); c.closePath(); c.fill(); break;
        case 'text': {
          c.font = `${p.size}px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
          c.strokeStyle = INKC; c.lineWidth = Math.max(3, p.size / 5); c.strokeText(p.text, p.x + 1.5, p.y + 2); c.strokeText(p.text, p.x, p.y);
          c.fillStyle = p.color === '#ffffff' ? PAPER : p.color; c.fillText(p.text, p.x, p.y);
          break;
        }
        case 'ko': {
          c.globalAlpha = k;
          for (let j = 0; j < 14; j++) {
            const a = (j / 14) * Math.PI * 2 + p.rot, len = (1 - k) * 420 + 80, w = (20 * k + 5) / 2;
            c.save(); c.translate(p.x, p.y); c.rotate(a); c.fillStyle = j % 2 ? PAPER : p.color;
            c.beginPath(); c.moveTo(30, -w); c.lineTo(len, -w * 0.4); c.lineTo(len, w * 0.4); c.lineTo(30, w); c.fill(); c.restore();
          }
          break;
        }
      }
      c.restore();
    }
  }
  function paperTag(c, f) {
    const x = f.x, y = f.y - f.h - 16 - (f.hold ? 30 : 0), col = SLOT_COLORS[f.i];
    c.save(); c.font = `13px ${FONT}`;
    const w = Math.max(24, c.measureText(f.tag).width + 12);
    const tag = () => { c.beginPath(); c.moveTo(x - w / 2, y - 18); c.lineTo(x + w / 2, y - 18); c.lineTo(x + w / 2, y - 4); c.lineTo(x + 4, y - 4); c.lineTo(x, y + 2); c.lineTo(x - 4, y - 4); c.lineTo(x - w / 2, y - 4); c.closePath(); };
    c.translate(1.5, 2); c.fillStyle = 'rgba(58,36,20,.3)'; tag(); c.fill(); c.translate(-1.5, -2);
    c.fillStyle = col; tag(); c.fill();
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.fillText(f.tag, x, y - 6.5);
    c.restore();
  }
  function kartWarning(c, dir, label) {
    const x = dir > 0 ? 80 : 1200, y = 420;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(58,36,20,.3)'; c.beginPath(); c.moveTo(3, -44); c.lineTo(48, 4); c.lineTo(3, 48); c.lineTo(-42, 4); c.fill();
    c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(0, -46); c.lineTo(46, 0); c.lineTo(0, 46); c.lineTo(-46, 0); c.fill();
    c.fillStyle = '#ffbf1e'; c.beginPath(); c.moveTo(0, -46); c.lineTo(46, 0); c.lineTo(0, 0); c.fill(); c.beginPath(); c.moveTo(0, 46); c.lineTo(-46, 0); c.lineTo(0, 0); c.fill();
    c.font = `44px ${FONT}`; c.textAlign = 'center'; c.fillStyle = INKC; c.fillText('!', 0, 16);
    c.font = `22px ${FONT}`; c.lineJoin = 'round'; c.strokeStyle = INKC; c.lineWidth = 5; c.strokeText(label || 'KART!', 0, 78); c.fillStyle = PAPER; c.fillText(label || 'KART!', 0, 78);
    c.restore();
  }

  // ---------- paper HUD ----------
  function paperHUD(c, view) {
    const fs = view.fighters || [], n = fs.length, pw = 236, gap = 16, x0 = (1280 - (n * pw + (n - 1) * gap)) / 2, y = 720 - 96;
    fs.forEach((f, k) => {
      const x = x0 + k * (pw + gap), m = hudMem[f.i] || (hudMem[f.i] = { dm: 0, shake: 0 });
      if (f.dm > m.dm + 0.5) m.shake = 14;
      m.dm = f.dm; if (m.shake > 0) m.shake--;
      c.save(); if (f.out) c.globalAlpha = 0.5;
      const card = new Path2D(); card.moveTo(x, y); card.lineTo(x + pw - 18, y); card.lineTo(x + pw, y + 18); card.lineTo(x + pw, y + 84); card.lineTo(x, y + 84); card.closePath();
      c.save(); c.translate(3, 5); c.fillStyle = 'rgba(58,36,20,.32)'; c.fill(card); c.restore();
      c.fillStyle = PAPER; c.fill(card);
      c.fillStyle = '#e4d8c2'; c.beginPath(); c.moveTo(x + pw - 18, y); c.lineTo(x + pw - 18, y + 18); c.lineTo(x + pw, y + 18); c.closePath(); c.fill();
      c.fillStyle = SLOT_COLORS[f.i]; c.fillRect(x, y, pw - 24, 7);
      c.save(); c.beginPath(); c.arc(x + 40, y + 47, 31, 0, Math.PI * 2); c.clip(); c.drawImage(portrait3(f.ch, 64), x + 8, y + 15, 64, 64); c.restore();
      c.strokeStyle = SLOT_COLORS[f.i]; c.lineWidth = 3.5; c.beginPath(); c.arc(x + 40, y + 47, 31, 0, Math.PI * 2); c.stroke();
      // a Smash Mushroom finale is ready: rainbow ring and badge
      if (f.fs) {
        const h = (performance.now() / 6) % 360;
        c.strokeStyle = `hsl(${h},95%,60%)`; c.lineWidth = 5; c.beginPath(); c.arc(x + 40, y + 47, 35, 0, Math.PI * 2); c.stroke();
        c.save(); c.translate(x + pw - 46, y + 40); c.rotate(-0.12); c.font = `15px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
        c.strokeStyle = INKC; c.lineWidth = 4; c.strokeText('SMASH!', 0, 0); c.fillStyle = `hsl(${(h + 60) % 360},95%,68%)`; c.fillText('SMASH!', 0, 0); c.restore();
      }
      c.font = `14px ${FONT}`; c.textAlign = 'left'; c.fillStyle = '#6a4a34';
      c.fillText(((f.tag ? f.tag + '  ' : '') + CH[f.ch].name).toUpperCase(), x + 80, y + 26);
      const ox = m.shake ? (Math.random() - 0.5) * 6 : 0, oy = m.shake ? (Math.random() - 0.5) * 6 : 0, txt = f.out ? 'OUT' : Math.floor(f.dm) + '%';
      c.font = `40px ${FONT}`; c.lineJoin = 'round'; c.strokeStyle = INKC; c.lineWidth = 7;
      c.strokeText(txt, x + 80 + ox + 2, y + 66 + oy + 2); c.strokeText(txt, x + 80 + ox, y + 66 + oy);
      c.fillStyle = f.out ? '#b0a090' : dmgColor(f.dm); c.fillText(txt, x + 80 + ox, y + 66 + oy);
      const col = CH[f.ch].look.spot && CH[f.ch].look.spot.toLowerCase() !== '#ffffff' ? CH[f.ch].look.spot : CH[f.ch].look.body || '#ff8cc6';
      for (let s = 0; s < Math.min(f.sk, 5); s++) { const sx = x + pw - 18 - s * 18, sy = y + 72; c.fillStyle = '#f6ecd6'; c.fillRect(sx - 3, sy - 2, 6, 6); c.fillStyle = col; c.beginPath(); c.moveTo(sx - 8, sy - 1); c.lineTo(sx - 5, sy - 7); c.lineTo(sx, sy - 9); c.lineTo(sx + 5, sy - 7); c.lineTo(sx + 8, sy - 1); c.closePath(); c.fill(); }
      if (f.sk > 5) { c.font = `14px ${FONT}`; c.textAlign = 'right'; c.fillStyle = '#6a4a34'; c.fillText('x' + f.sk, x + pw - 104, y + 77); }
      c.restore();
    });
  }

  // ---------- portraits, stage thumbnails, title scene ----------
  const PCACHE = {}, TCACHE = {};
  function portrait3(ch, size) {
    const key = ch + ':' + size;
    if (PCACHE[key]) return PCACHE[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'), C = CH[ch], base = C.look.spot && C.look.spot.toLowerCase() !== '#ffffff' ? C.look.spot : C.look.body || C.look.cap;
    const g = c.createRadialGradient(size / 2, size * 0.45, size * 0.1, size / 2, size / 2, size * 0.75); g.addColorStop(0, '#fff8ec'); g.addColorStop(1, base);
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    if (ok) {
      const rig = M3D.RIGS[ch], ty = rig && rig.kind === 'yoshi' ? 1.42 : 1.5;
      G3.begin({ cam: [0, ty, 2.75], fov: (40 * Math.PI) / 180, vw: size, vh: size, near: 0.5, far: 50, fog: [1, 1, 1], fogR: [1e4, 2e4, 0], L: LIGHT, amb: 0.62, dif: 0.5, cool: 0.45, ink: INK, inkW: 0.035, crease: 0.3 });
      M3D.drawPreview(ch, M4.chain(M4.RY(0.42)), 0, 'idle');
      G3.end();
      c.drawImage(glc, 0, 0, size, size, 0, 0, size, size);
    }
    PCACHE[key] = cv;
    return cv;
  }
  function stageThumb3(id, w, h) {
    const key = id + ':' + w;
    if (TCACHE[key]) return TCACHE[key];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), S = S3D.get(id), cam = { x: 0, y: -120, z: 0.62 };
    c.save(); c.scale(w / 1280, h / 720); S.backdrop(c, cam, 0); c.restore();
    const z = cam.z, D = (FOC * PX) / z, E = S.env;
    G3.begin({ cam: [0, -cam.y * PX, D], fov: FOV, vw: w, vh: h, near: 1, far: 1400, fog: E.fog, fogR: [D + E.f0, D + E.f1, E.fa], L: LIGHT, amb: E.amb, dif: E.dif, cool: E.cool, ink: INK, inkW: 0.08, crease: 0.3 });
    drawWorld({ stage: id, frame: 0, fighters: [], items: [], proj: [], clouds: [] }, 0);
    G3.end();
    c.drawImage(glc, 0, 0, w, h, 0, 0, w, h);
    TCACHE[key] = cv;
    return cv;
  }
  const ATT = CHARS.map((C, k) => ({ i: 100 + k, ch: C.id, x: 0, y: 0, fc: 1, st: 'run', t: 0, sc: 1, h: C.h, w: 36, inv: 0, rp: 0, gi: 0, shd: 100, dm: 0, sk: 0 }));
  function attract(fr, dim) {
    ATT.forEach((f, k) => {
      const cyc = (k * 110 + fr * 1.8) % 990;
      f.x = cyc - 495;
      const hop = (fr + k * 40) % 200 < 30;
      f.y = hop ? -Math.sin((((fr + k * 40) % 200) / 30) * Math.PI) * 80 : 0;
      f.st = hop ? 'air' : 'run'; f.gi = hop ? -1 : 0;
      f.inv = Math.abs(f.x) > 470 ? 1 : 0;
    });
    const view = { stage: 'town', frame: fr, fighters: ATT.filter(f => Math.abs(f.x) < 470), proj: [], items: [], clouds: [] };
    frame(view, { x: 0, y: -170, z: 0.8, shake: 0 }, fr, { hud: false, tags: false });
    if (dim) { cx2.fillStyle = 'rgba(30,18,10,.58)'; cx2.fillRect(0, 0, 1280, 720); }
  }
  return { init, frame, attract, portrait: portrait3, stageThumb: stageThumb3, get ok() { return ok; } };
})();
