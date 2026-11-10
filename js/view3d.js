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
    try { M3D.build(); cryMeshes(); } catch (e) { console.warn('3D models failed to build', e); glc.style.display = 'none'; return false; }
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
    gust: 2.4, rock: 2.2, heart: 2.4, bubble: 2.4, shade: 2.6, lightbolt: 2.0, seed: 2.6, melon: 2.4, milk: 2.4,
    dbomb: 1.8, gift: 2.4, crescent: 2.4, axe: 2.0, scarab: 2.9, sandwave: 2.3, trident: 1.8, chi: 2.6, date: 2.9, lantern: 2.3, jelly: 2.3, latke: 2.1, pepper: 2.1, plasma: 1.5, crystal: 1.8, mbomb: 2.5 };
  const FSDROP = { egg: 3.8, cannon: 3.6, pill: 3.4, fire: 4.4, melon: 3.4, lantern: 4.2, crystal: 3.8 };
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
      // Gladiator Toad's net, Mormon Toad's potluck dish, Dash Yoshi's burning skid marks
      else if (p.sub === 'net') G3.draw(T, M4.chain(M4.T(X, Y + 0.01, 0.35), M4.S(1.25, 1, 1.25)), ink(1.25));
      else if (p.sub === 'casserole') G3.draw(T, M4.chain(M4.T(X, Y, 0.35), M4.S(1.1, 1.1, 1.1)), ink(1.1));
      else if (p.sub === 'flames') { const k = clamp01(((p.life || 200) - t) / 30); G3.draw(T, M4.chain(M4.T(X, Y, 0.35), M4.S(1.2, (1.1 + Math.sin(fr * 0.6) * 0.15) * k, 1.2)), { self: 1, alpha: 0.4 + 0.6 * k }); }
      // Catholic Toad's piñata sways on its string
      else if (p.sub === 'pinata') G3.draw(T, M4.chain(M4.T(X, Y + 2.08, 0.35), M4.RZ(Math.sin(fr * 0.07 + p.id) * 0.12), M4.T(0, -2.08, 0), M4.RY(fr * 0.01), M4.S(1.3, 1.3, 1.3)), ink(1.3));
      else {
        // the amp thumps on each of its three pulses
        const pump = 1 + [20, 50, 80].reduce((a, t0) => a + Math.max(0, 1 - Math.abs(t - t0) / 5) * 0.14, 0);
        G3.draw(T, M4.chain(M4.T(X, Y, 0.35), M4.RY(-0.35 * (p.fc || 1)), M4.S(1.3, 1.3 * pump, 1.3)), ink(1.3));
      }
      return;
    }
    if (p.k === 'fsdrop') {
      const s = FSDROP[p.sub] || 3.5;
      const glow = { pill: 0.15, fire: 1, lantern: 0.8, crystal: 0.45 }[p.sub], rot = p.sub === 'lantern' ? M4.RZ(Math.sin(t * 0.08 + p.id) * 0.2) : M4.RZ(-t * 0.12 * dir);
      G3.draw(P[p.sub] || P.egg, M4.chain(M4.T(X, Y, 0.4), rot, M4.S(s, s, s)), ink(s, glow ? { self: glow } : null));
      // Volcano Rain: each fireball trails flames
      if (p.sub === 'fire') G3.draw(M3D.PROPS.flame, M4.chain(M4.T(X, Y + 0.5, 0.4), M4.RZ(Math.PI), M4.S(2.6, 2.2 + Math.random() * 0.8, 2.6)), { self: 1 });
      return;
    }
    // Hindu Toad's Holi powder: a puff of bright colour (each throw picks the next colour)
    if (p.k === 'gulal') {
      const s = (p.r || 18) * PX * 0.95, C = [[1, 0.3, 0.65], [0.3, 0.85, 0.35], [1, 0.85, 0.2], [0.25, 0.55, 1]][(p.id || 0) % 4];
      G3.draw(P.haze, M4.chain(M4.T(X, Y, 0.35), M4.RZ(t * 0.05), M4.S(s, s * 0.9, s)), { alpha: 0.85, self: 0.35, tint: [C[0], C[1], C[2], 0.95] });
      return;
    }
    if (p.k === 'haze' || p.k === 'shamac') {
      // Purple Haze, and Subaru's Shamac: a cloud of black mist
      const s = (p.r || 34) * PX, dark = p.k === 'shamac';
      G3.draw(P.haze, M4.chain(M4.T(X, Y, 0.35), M4.RZ(t * 0.02), M4.S(s, s * (0.9 + 0.1 * Math.sin(t * 0.2)), s)), { alpha: (dark ? 0.72 : 0.5) * clamp01(((p.life || 200) - t) / 30), self: 0.2, tint: dark ? [0.1, 0.07, 0.16, 0.93] : undefined });
      return;
    }
    // Emilia Toad's icicle pellets point the way they fly; Puck's snowflakes spin; her ice spear flies flat
    if (p.k === 'icepel') { G3.draw(P.icepel, M4.chain(M4.T(X, Y, 0.3), M4.RZ(Math.atan2(-(p.vy || 0), p.vx || 1e-6)), M4.RX(t * 0.3), M4.S(2.3, 2.3, 2.3)), ink(2.3, { self: 0.5 })); return; }
    if (p.k === 'puckpel') { G3.draw(P.puckpel, M4.chain(M4.T(X, Y, 0.3), M4.RZ(t * 0.35), M4.S(2.1, 2.1, 2.1)), ink(2.1, { self: 0.7 })); return; }
    if (p.k === 'icespear') { const fd = p.fc || dir; G3.draw(M3D.PROPS.ice_spear, M4.chain(M4.T(X - fd * 0.9, Y, 0.3), M4.RZ(fd > 0 ? -Math.PI / 2 : Math.PI / 2), M4.S(1.7, 1.7, 1.7)), ink(1.7, { self: 0.4 })); return; }
    const m = P[p.k]; if (!m) return;
    let s = PSCALE[p.k] || 2, R = I, dy = 0, o = null;
    switch (p.k) {
      case 'turnip': R = M4.RZ(-t * 0.25 * dir); dy = -0.17 * s; break;
      case 'psn': dy = -0.3 * s; break;
      case 'boom': R = M4.RZ(t * 0.5); break;
      case 'egg': case 'bomb': case 'dbomb': case 'tumble': case 'pie': R = M4.RZ(-t * 0.2 * dir); break;
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
      case 'milk': R = M4.RZ(t * 0.3 * dir); s *= 1 + 0.12 * Math.sin(t * 0.6); o = { self: 0.35 }; break;
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
      // the v1.7 fighters' shots
      case 'crescent': R = M4.RY(dir > 0 ? 0 : Math.PI); o = { self: 0.9, alpha: 0.9 }; break;
      case 'axe': case 'mbomb': R = M4.RZ(-t * 0.35 * dir); break;
      case 'scarab': R = M4.chain(M4.RY(dir > 0 ? 0 : Math.PI), M4.RX(0.3)); dy = Math.sin(t * 0.5) * 0.04; o = { self: 0.3 }; break;
      case 'sandwave': R = M4.RY(dir > 0 ? 0 : Math.PI); s *= 1 + 0.1 * Math.sin(t * 0.5); break;
      case 'trident': R = M4.RY(dir > 0 ? 0 : Math.PI); break;
      case 'plasma': R = M4.RY(dir > 0 ? 0 : Math.PI); o = { self: 1 }; break;
      case 'chi': s = ((p.r || 18) / 18) * 2.6; R = M4.RZ(t * 0.2); o = { self: 1, alpha: 0.85 }; break;
      case 'date': case 'pepper': R = M4.RZ(-t * 0.3 * dir); break;
      case 'lantern': R = M4.RZ(Math.sin(t * 0.1) * 0.15); o = { self: 0.75 }; break;
      case 'jelly': R = M4.RZ(Math.sin(t * 0.4) * 0.2); s *= 1 + 0.1 * Math.sin(t * 0.8); break;
      case 'latke': R = M4.chain(M4.RX(0.5), M4.RY(t * 0.5)); break;
      case 'crystal': R = M4.chain(M4.RY(dir > 0 ? 0 : Math.PI), M4.RX(t * 0.3)); o = { self: 0.45 }; break;
      case 'gift': R = M4.RZ(-t * 0.2 * dir); break;
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
    // Yoshi's Island's rolling boulder
    if (H && H.rock && H.rock.on) {
      const R = H.rock, s = 60 * PX / 0.23;
      G3.draw(M3D.PROJ.rock, M4.chain(M4.T(R.x * PX, top + 60 * PX, 0.4), M4.RZ((-R.x * PX) / (60 * PX)), M4.S(s, s, s)), ink(s));
    }
    // Bowser's Castle lava: a glowing sea that rises over the floor
    if (H && H.lava && st.haz.includes('lava')) {
      const ly = -H.lava.lv * PX, bot = -(BLAST.b + 400) * PX, wob = Math.sin(fr * 0.08) * 0.06;
      G3.draw(M3D.PROJ.ice3, M4.chain(M4.T(0, (ly + bot) / 2 + wob, 0.2), M4.S(60, (ly - bot) / 2, 3.9)), { tint: [1, 0.42, 0.08, 0.96], self: 0.95 });
      G3.draw(M3D.PROJ.ice3, M4.chain(M4.T(0, ly + wob - 0.04, 0.25), M4.S(60, 0.07, 3.95)), { tint: [1, 0.85, 0.3, 0.96], self: 1 });
    }
    // Boo Mansion: Boos swoop through the dark
    if (H && H.dark && H.dark.ph === 'dark') for (const b of booPath((view.frame || 0) - (H.dark.t0 || 0))) {
      G3.draw(M3D.PROJ.boo, M4.chain(M4.T(b.x * PX, -b.y * PX, 0.6), M4.RY(b.vx > 0 ? 0.5 : -0.5), M4.S(3.2, 3.2, 3.2)), { self: 0.55, alpha: 0.92 });
    }
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
        // Pharaoh Toad's Great Pyramid drops onto the stage
        else if (e.sub === 'pyramid') { const r = (e.r || 240) * PX * 0.5; G3.draw(F.pyramid, M4.chain(M4.T(X, Y - r * 0.42, 0), M4.RY(0.5 + fr * 0.006), M4.S(r, r * 0.9, r)), ink(r)); }
        else { const r = (e.r || 250) * PX * 0.4; G3.draw(F.sun, M4.chain(M4.T(X, Y - 30 * PX + r, -0.5), M4.RZ(fr * 0.03), M4.S(r, r, r)), { self: 0.85 }); }
        break;
      }
      case 'vortex': {
        const R = (e.r || 230) * PX;
        if (e.sub === 'rune') G3.draw(M3D.TRAP.rune, M4.chain(M4.T(X, Y, -1.0), M4.RX(Math.PI / 2), M4.RY(fr * 0.04), M4.S(R * 0.7, R * 0.7, R * 0.7)), { self: 1 });
        // Festival of Colors: a whirlwind of Holi powder in every colour
        else if (e.sub === 'color') for (let q = 0; q < 30; q++) {
          const a = fr * 0.13 + q * 0.83, rr = R * (0.2 + ((q * 37) % 26) / 26 * 0.78), h = (((q * 53) % 20) - 10) * 0.045 * R, C = [[1, 0.3, 0.65], [0.3, 0.85, 0.35], [1, 0.85, 0.2], [0.25, 0.55, 1], [0.65, 0.35, 0.9]][q % 5];
          G3.draw(M3D.PROJ.haze, M4.chain(M4.T(X + Math.cos(a) * rr, Y + h * 0.5 + Math.sin(a * 0.5) * 0.3, Math.sin(a) * rr * 0.45), M4.RZ(a), M4.S(0.75, 0.75, 0.75)), { alpha: 0.8, self: 0.35, tint: [C[0], C[1], C[2], 0.95] });
        }
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
        // Mech Yoshi's Full Burst fires green energy
        const L = 46, cx = X + e.dir * L / 2, w = clamp01((e.t - 24) / 6) * (e.t > 70 ? clamp01(1 - (e.t - 70) / 10) : 1) + 0.01;
        G3.draw(M3D.PROJ.ball, M4.chain(M4.T(cx, Y, 0.2), M4.S(L / 2, 2.4 * w, 1.3 * w)), { alpha: 0.5, tint: e.sub === 'mech' ? [0.45, 1, 0.6, 0.9] : [1, 0.96, 0.7, 0.9], self: 1 });
        G3.draw(M3D.PROJ.ball, M4.chain(M4.T(cx, Y, 0.25), M4.S(L / 2, 1.1 * w, 0.6 * w)), { alpha: 0.85, tint: [1, 1, 1, 1], self: 1 });
      } break;
      // Lotus Bloom: a giant lotus opens beneath the Buddhist Toad
      case 'burst': if (e.sub === 'lotus') {
        const own = fighterOf(view, e.o);
        if (own) { const k = clamp01(e.t / 30), s = 2.2 + 3.4 * k; G3.draw(F.lotus, M4.chain(M4.T(own.x * PX, -own.y * PX + 0.05, 0), M4.RY(fr * 0.01), M4.S(s, s * (0.4 + 0.6 * k), s)), { self: 0.35 }); }
      } break;
      // Mazel Tov!: a ring of dancing wedding guests
      case 'lasso': if (e.sub === 'hora') M3D.drawHora(e, fighterOf(view, e.o), fr); break;
      case 'sweep': if (e.t >= 16 && e.sub === 'petals') {
        // Cherry Blossom Storm: a whirling column of petals sweeps the stage
        const gy = -s0.y * PX, k = clamp01((e.t - 16) / 8) * clamp01((146 - e.t) / 10) + 0.05;
        for (let q = 0; q < 64; q++) {
          const h = ((q * 37 + fr * 3) % 160) / 160, a = fr * 0.22 + q * 1.7, rr = (0.6 + (q % 6) * 0.45) * k;
          G3.draw(F.petal, M4.chain(M4.T(X + Math.cos(a) * rr, gy + h * 15, Math.sin(a) * rr), M4.RY(a * 2), M4.RX(a), M4.S(4, 4, 4)), { self: 0.5 });
        }
      } else if (e.t >= 16) {
        const k = clamp01((e.t - 16) / 8) * clamp01((146 - e.t) / 10) + 0.01, gy = -s0.y * PX;
        G3.draw(M3D.PROJ.ice3, M4.chain(M4.T(X, gy + 20, 0), M4.S(2.3 * k, 20, 1.2)), { alpha: 0.45, tint: [0.5, 1, 1, 0.9], self: 1 });
        G3.draw(M3D.PROJ.ice3, M4.chain(M4.T(X, gy + 20, 0.1), M4.S(0.9 * k, 20, 0.6)), { alpha: 0.85, tint: [0.92, 1, 1, 1], self: 1 });
      } break;
      case 'pulses': {
        const own = fighterOf(view, e.o); if (!own) break;
        if (e.sub === 'choir') { M3D.drawChoir(e, s0.y, fr); break; }
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
      case 'storm': drawStorm(e); break;
      case 'beast': M3D.drawBeast(e, fr, s0.y); break;
      case 'rain': if (e.side) {
        // Pirate Toad's airship lobs cannonballs from offstage
        const sx = (e.dir > 0 ? s0.x - 620 : s0.x + s0.w + 620) * PX, sy = 270 * PX + Math.sin(fr * 0.05) * 0.3, Ms = M4.chain(M4.T(sx, sy, -2), M4.RY(e.dir > 0 ? 0 : Math.PI), M4.S(2.2, 2.2, 2.2));
        G3.draw(F.ship, Ms, ink(2.2));
        G3.draw(F.propblade, M4.chain(Ms, M4.T(-2.45, 0.6, 0), M4.RX(fr * 0.6), M4.S(0.6, 0.6, 0.6)), ink(1.3));
      } break;
    }
  }
  // ---------- El Minya's crystal corruption ----------
  // Every crystal that lands on a platform turns it a little more to pink crystal: its colour drains toward pink,
  // crystals grow out of it (two clusters on the first hit, five more on the second, when it also trembles and
  // pulses), and the third hit shatters it into a burst of crystal shards. All of it is worked out from the hit
  // counts (view.php) and break times (view.brk) the host sends, so every player sees the same thing.
  const CORR = {}, LAY = {}, CRY = {}, SHARDS = [];
  // faceted crystal colours, the same lavender and purple as Minya's crystals: [tip, body, lower, base] x [two faces]
  const CRYCOL = [['#efe2ff', '#e4d6ff'], ['#c8a0ff', '#b48cf4'], ['#a47ae8', '#9a6ae8'], ['#8858d0', '#7a4ac4']];
  const PINK = [0.78, 0.63, 1];
  const easeBack = x => { const u = x - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; };
  // when each platform took each of its hits (C.at[0] = the first), so the crystals can grow in over time
  function corrOf(view, pi) {
    const n = (view.php && view.php[pi]) || 0, now = view.frame || 0, key = view.stage + ':' + pi;
    let C = CORR[key];
    if (!C || n < C.n || now < C.last) C = CORR[key] = { n: 0, at: [], last: now };
    while (C.n < n) C.at[C.n++] = now;
    C.last = now;
    return C;
  }
  // how far a platform has turned to crystal (0..1): it creeps up to the new level over 45 frames after each hit
  function corrAmt(C, now) {
    if (!C.n) return 0;
    const LV = [0, 0.45, 0.82, 0.82], a = LV[C.n - 1], b = LV[C.n];
    return a + (b - a) * clamp01((now - C.at[C.n - 1]) / 45);
  }
  // one faceted crystal: a five-sided column with a pointed tip, rooted at `base` and pointing along `dir`
  function crystalInto(out, base, dir, len, r, seed) {
    const B = G3.B;
    B.start();
    B.lathe([[0, len], [r * 0.92, len * 0.72], [r, len * 0.12], [r * 0.55, -0.06], [0, -0.1]], 5, { center: [0, len * 0.4, 0], rot0: seed * 0.9, mat: (m, i, j) => CRYCOL[Math.min(i, 3)][j % 2] });
    const F = B.frameFor(dir), T = B.take(), tr = q => [F.r[0] * q[0] + F.n[0] * q[1] + F.u[0] * q[2], F.r[1] * q[0] + F.n[1] * q[1] + F.u[1] * q[2], F.r[2] * q[0] + F.n[2] * q[1] + F.u[2] * q[2]];
    B.xformTris(T, p => { const q = tr(p); return [base[0] + q[0], base[1] + q[1], base[2] + q[2]]; }, tr);
    for (const t of T) { t.vary = 0.16; out.push(t); }
  }
  // a cluster of crystals splaying out from one root (up from a platform's top, or hanging under it)
  function clusterMesh(seed, down, small) {
    const R = G3.B.prng(seed), out = [], n = small ? 2 + (seed % 2) : 3 + Math.floor(R() * 2), sg = down ? -1 : 1;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R() * 0.8, tilt = k === 0 ? 0.08 + R() * 0.1 : 0.4 + R() * 0.4;
      const dir = [Math.cos(a) * Math.sin(tilt), sg * Math.cos(tilt), Math.sin(a) * Math.sin(tilt) * 0.7];
      const len = (small ? 0.5 : down ? 0.85 : 1.0) * (k === 0 ? 1.35 : 0.65 + R() * 0.45), r = len * (0.2 + R() * 0.07);
      crystalInto(out, [k ? Math.cos(a) * 0.07 : 0, 0, k ? Math.sin(a) * 0.05 : 0], dir, len, r, seed * 7 + k);
    }
    return G3.compile(out);
  }
  // a jagged crystal shard for the shatter
  function shardMesh(seed) {
    const R = G3.B.prng(seed), B = G3.B, h = 0.45 + R() * 0.28, r = 0.18 + R() * 0.1;
    B.start();
    B.lathe([[0, h], [r, 0], [0, -h * (0.45 + R() * 0.3)]], 3 + (seed % 2), { center: [0, 0, 0], jit: 0.05, seed: seed + 3, rot0: R() * 3, mat: (m, i, j) => CRYCOL[i ? 2 : 1][(j + seed) % 2] });
    const T = B.take(); for (const t of T) t.vary = 0.2;
    return G3.compile(T);
  }
  function cryMeshes() {
    if (!CRY.up) Object.assign(CRY, { up: [11, 12, 13].map(s => clusterMesh(s, false, false)), down: [21, 22].map(s => clusterMesh(s, true, false)),
      small: [31, 32].map(s => clusterMesh(s, false, true)), shard: [41, 42, 43, 44].map(shardMesh) });
    return CRY;
  }
  // where a platform's crystals grow (fixed for each platform, so they always come up in the same places):
  // hit 1: two big clusters on top at the back and one hanging underneath; hit 2: six more all over it.
  // mv.dz is how deep the platform's top is (front to back), mv.bot how far down its underside is (world units)
  function layoutFor(key, half, mv) {
    if (LAY[key]) return LAY[key];
    let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    const R = G3.B.prng(h), dz = mv.dz || 0.8, bot = mv.bot == null ? -0.4 : mv.bot, L = [];
    [[1, -0.35, 'up'], [1, 0.55, 'up'], [1, 0.1, 'down'], [2, 0.1, 'up'], [2, -0.8, 'up'], [2, -0.6, 'small'], [2, 0.75, 'small'], [2, -0.45, 'down'], [2, 0.6, 'down']].forEach(([lv, fx, kind], k) => {
      const z = kind === 'up' ? -dz * (0.45 + R() * 0.2) : kind === 'small' ? dz * (0.55 + R() * 0.15) : (R() - 0.3) * dz * 0.4;
      L.push({ lv, kind, x: (fx + (R() - 0.5) * 0.15) * half, y: kind === 'down' ? bot + 0.12 : -0.05, z, m: Math.floor(R() * 4), ry: R() * Math.PI * 2, s: kind === 'small' ? 0.8 + R() * 0.3 : 0.9 + R() * 0.4, d: k * 3 });
    });
    return (LAY[key] = L);
  }
  // a platform El Minya has hit: tinted toward pink, glowing, trembling when it's about to go, and growing crystals
  function drawCorrupt(view, mv, s, C, M0) {
    const now = view.frame || 0, amt = corrAmt(C, now), K = cryMeshes(), half = (s.w / 2) * PX;
    const shake = C.n >= 2 ? [Math.sin(now * 1.7) * 0.03, Math.cos(now * 2.3) * 0.018] : [0, 0];
    const X = (s.x + s.w / 2) * PX + shake[0], Y = -s.y * PX + shake[1];
    const glow = C.n >= 2 ? 0.14 + 0.1 * Math.sin(now * 0.25) : 0.05 * amt / 0.3;
    G3.draw(mv.mesh, M4.chain(M4.T(shake[0], shake[1], 0), M0), Object.assign({}, mv.o, { tint: [PINK[0], PINK[1], PINK[2], amt * 0.75], self: Math.min(1, ((mv.o && mv.o.self) || 0) + glow) }));
    for (const c of layoutFor(view.stage + ':' + (mv.idx - STG[view.stage].solids.length), half, mv)) {
      if (c.lv > C.n) continue;
      const g = clamp01((now - C.at[c.lv - 1] - c.d) / 16); if (g <= 0) continue;
      const k = easeBack(g) * c.s, list = K[c.kind];
      G3.draw(list[c.m % list.length], M4.chain(M4.T(X + c.x, Y + c.y, c.z), M4.RY(c.ry), M4.S(k, k, k)), ink(Math.max(0.3, k), { self: 0.4 + 0.12 * Math.sin(now * 0.12 + c.ry) }));
    }
  }
  // the third hit: the platform flashes pink-white and bursts into glowing crystal shards (called on 'platbreak').
  // With e.ice it's ice instead (Emilia Toad's pillar, barrier or an ice soldier breaking): blue-white shards,
  // up to a height e.h, smaller ones for e.small
  function shatter(e) {
    const R = G3.B.prng((e.x * 13 + e.y * 7 + (e.pi || 0)) % 9973 + 1), n = 14 + Math.min(12, Math.round((e.w || 160) / 22)), half = ((e.w || 160) / 2) * PX, list = [];
    const tall = e.ice ? ((e.h || 40) * PX) / 2 : 0, sz = e.small ? 0.45 : 1;
    for (let k = 0; k < n; k++) {
      const ox = (R() - 0.5) * 2 * half * 0.92;
      list.push({ ox, oy: e.ice ? (R() - 0.5) * 2 * tall : -R() * 0.35, oz: (R() - 0.5) * 0.9, vx: ox * 0.03 + (R() - 0.5) * 0.05, vy: 0.06 + R() * 0.13, vz: (R() - 0.3) * 0.06,
        r0: [R() * 6, R() * 6, R() * 6], w: [(R() - 0.5) * 0.45, (R() - 0.5) * 0.35, (R() - 0.5) * 0.45], m: k % (e.ice ? 3 : 4), s: (0.8 + R() * 0.8) * sz, life: 55 + Math.floor(R() * 30) });
    }
    SHARDS.push({ x: e.x, y: e.y, pi: e.ice ? null : e.pi, ice: !!e.ice, f0: null, st: null, list });
    if (SHARDS.length > 10) SHARDS.shift();
  }
  function drawShards(view, S) {
    const now = view.frame || 0;
    for (let i = SHARDS.length - 1; i >= 0; i--) {
      const B = SHARDS[i];
      if (B.f0 === null) { B.f0 = now; B.st = view.stage; }
      const t = now - B.f0;
      if (B.st !== view.stage || t < 0 || t > 90) { SHARDS.splice(i, 1); continue; }
      const X = B.x * PX, Y = -B.y * PX, K = cryMeshes();
      // the platform itself flashes and swells for a moment as it bursts
      const mv = B.pi != null && S.movers.find(m => m.idx === STG[view.stage].solids.length + B.pi);
      if (mv && t < 12) { const k = 1 + t * 0.012; G3.draw(mv.mesh, M4.chain(M4.T(X, Y, 0), M4.S(k, k, k)), { alpha: 0.85 * (1 - t / 12), tint: [1, 0.78, 0.94, 0.7], self: 0.9 }); }
      for (const p of B.list) {
        if (t > p.life) continue;
        const fade = clamp01((p.life - t) / 18), k = p.s * (0.5 + 0.5 * fade);
        const M = M4.chain(M4.T(X + p.ox + p.vx * t, Y + p.oy + p.vy * t - 0.0045 * t * t, p.oz + p.vz * t), M4.RX(p.r0[0] + p.w[0] * t), M4.RY(p.r0[1] + p.w[1] * t), M4.RZ(p.r0[2] + p.w[2] * t), M4.S(k, k, k));
        G3.draw(B.ice ? M3D.FXM['iceShard' + p.m] : K.shard[p.m], M, ink(k, { self: 0.5, alpha: fade < 1 ? fade : undefined }));
      }
    }
  }
  // Emilia Toad's ice: a pillar (with crystals round its top) or a barrier curving over where she stood. Both get
  // whiter as they take damage (the cracks and HP bar are drawn on the overlay, in paperFx)
  function drawIce(s, fr) {
    const X = s.x * PX, Y = -s.y * PX, dmg = 1 - clamp01((s.hp || 0) / (s.max || 1));
    const o = { self: 0.3 + 0.08 * Math.sin(fr * 0.05 + s.id), tint: dmg > 0.05 ? [0.92, 0.98, 1, dmg * 0.4] : undefined };
    if (s.k === 'pillar') {
      const w = s.w * PX, h = Math.max(0.02, s.h * PX);
      G3.draw(M3D.FXM.icePillar, M4.chain(M4.T(X, Y, 0), M4.S(w, h, 1.15)), o);
      for (const [dx, dz, a, k] of [[-0.42, 0.45, 0.4, 1], [0.44, -0.3, -0.5, 0.85], [0.1, 0.55, 0.1, 0.7]]) G3.draw(M3D.FXM.iceCrys, M4.chain(M4.T(X + dx * w, Y + h - 0.05, dz), M4.RZ(a), M4.S(k * 1.5, k * 1.5, k * 1.5)), ink(1.5 * k, { self: 0.35 }));
    } else G3.draw(M3D.FXM.iceShell, M4.chain(M4.T(X, Y, 0), M4.RY(s.fc > 0 ? 0 : Math.PI), M4.S(1, Math.max(0.02, s.h / 124), 1)), o);
  }
  // Absolute Zero's storm: big ice pellets roaring in from upwind, across the whole stage (worked out from the
  // finale's clock, so it looks the same on every screen)
  const hash01 = j => { const s = Math.sin(j * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function drawStorm(e) {
    const t = e.t || 0, dir = e.dir || 1, rate = 1.15;
    if (t > 304) return;
    for (let j = Math.max(0, Math.floor((t - 95) * rate)); j < Math.floor(Math.min(t, 290) * rate); j++) {
      const h1 = hash01(j * 3 + 1), h2 = hash01(j * 3 + 2), h3 = hash01(j * 3 + 3), age = t - j / rate, vx = 24 + h1 * 9, vy = 5 + h3 * 4;
      const x = -dir * 1450 + dir * age * vx, y = -760 + h2 * 820 + age * vy;
      if (Math.abs(x) > 1350 || y > 700) continue;
      const s = 2.8 + h3 * 2.4;
      G3.draw(M3D.PROJ.icepel, M4.chain(M4.T(x * PX, -y * PX, -1.2 + h1 * 3.4), M4.RZ(Math.atan2(-vy, dir * vx)), M4.RX(age * 0.3), M4.S(s, s, s)), { self: 0.55, ink: false });
    }
  }
  function drawWorld(view, fr) {
    const S = S3D.get(view.stage);
    // (a static can carry draw options, e.g. Rainbow Road glows: { mesh, o })
    for (const m of S.statics) G3.draw(m.mesh || m, I, m.o);
    if (S.movers.length) {
      // (a platform broken by El Minya is gone until it comes back, and pops back into place when it does;
      // one it has hit is turning to pink crystal)
      const surf = computeSurfaces(view.stage, view.frame, view.clouds, view.brk), nS = STG[view.stage].solids.length;
      for (const mv of S.movers) {
        const s = surf[mv.idx]; if (!s || s.gone) continue;
        const pi = mv.idx - nS, back = view.brk && view.brk[pi] != null ? (view.frame || 0) - view.brk[pi] : 99;
        let M = M4.T((s.x + s.w / 2) * PX, -s.y * PX, 0);
        if (back >= 0 && back < 14) { const k = 0.4 + 0.6 * easeBack(back / 14); M = M4.chain(M, M4.S(k, k, k)); }
        const C = view.php ? corrOf(view, pi) : null;
        if (C && C.n) drawCorrupt(view, mv, s, C, M); else G3.draw(mv.mesh, M, mv.o);
      }
    }
    if (SHARDS.length) drawShards(view, S);
    // Emilia Toad's ice pillars and barriers
    for (const s of view.ice || []) drawIce(s, fr);
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
    darkness(cx2, view, cam, z, fr);
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
  // Boo Mansion lights-out: the screen goes dark except a little light around each fighter (and each Boo).
  // It's drawn first on the overlay, so hit sparks, name tags and the HUD stay visible on top
  function darkness(c, view, cam, z, fr) {
    const D = view.haz && view.haz.dark;
    if (!D || (D.ph !== 'dark' && D.ph !== 'warn')) return;
    if (D.ph === 'warn' && Math.floor(fr / 5) % 3) return; // flickering
    const at = (x, y) => [640 + (x - cam.x) * z, 360 + (y - cam.y) * z];
    c.save(); c.fillStyle = D.ph === 'warn' ? 'rgba(8,4,18,0.55)' : 'rgba(8,4,18,0.9)'; c.fillRect(0, 0, 1280, 720);
    c.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { const g = c.createRadialGradient(x, y, r * 0.3, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
    for (const f of view.fighters || []) if (f.st !== 'dead' && !f.out) { const [x, y] = at(f.x, f.y - f.h * 0.5); hole(x, y, 115 * z); }
    if (D.ph === 'dark') for (const b of booPath((view.frame || 0) - (D.t0 || 0))) { const [x, y] = at(b.x, b.y); hole(x, y, 60 * z); }
    c.restore();
  }
  // the Beast of the End's frame of jagged ice round the screen's edges (k = how far it has grown in, 0 to 1)
  function beastIceBorder(c, k, fr) {
    c.save();
    const E = [[0, 0, 1280, 0, 0, 1], [1280, 720, 0, 720, 0, -1], [0, 720, 0, 0, 1, 0], [1280, 0, 1280, 720, -1, 0]];
    for (const [pass, depth, fill] of [[0, 30 + 80 * k, 'rgba(196,230,255,0.85)'], [1, 14 + 40 * k, 'rgba(238,248,255,0.9)']]) {
      for (let ei = 0; ei < 4; ei++) {
        const [x0, y0, x1, y1, nx, ny] = E[ei], n = Math.round(Math.hypot(x1 - x0, y1 - y0) / (pass ? 30 : 44));
        c.beginPath(); c.moveTo(x0, y0);
        for (let j = 0; j <= n; j++) {
          const q = j / n, d = depth * (0.3 + 0.7 * hash01(ei * 97 + j * 3 + pass * 500)) * (j % 2 ? 1 : 0.4) * (1 + 0.04 * Math.sin(fr * 0.05 + j));
          c.lineTo(x0 + (x1 - x0) * q + nx * d, y0 + (y1 - y0) * q + ny * d);
        }
        c.lineTo(x1, y1); c.closePath();
        c.fillStyle = fill; c.fill();
        if (!pass) { c.strokeStyle = '#f4fbff'; c.lineWidth = 2.5; c.stroke(); }
      }
    }
    c.restore();
  }
  // screen-space weather: Mushroom Gorge gusts and the Absolute Zero frost
  function screenFx(c, view, fr) {
    // Bowser's Castle: the lava's warning glow, and the boulder warning on Yoshi's Island
    const L = view.haz && view.haz.lava;
    if (L && L.ph === 'warn' && STG[view.stage].haz.includes('lava')) {
      const g = c.createLinearGradient(0, 720, 0, 420); g.addColorStop(0, `rgba(255,90,20,${0.35 + 0.2 * Math.sin(fr * 0.3)})`); g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    }
    const R = view.haz && view.haz.rock;
    if (R && !R.on && R.warn > 0 && Math.floor(fr / 8) % 2) kartWarning(c, R.dir, 'BOULDER!');
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
    // the Beast of the End: the stage goes dark, ice grows in round the edges of the screen, and snow rages
    const BE = (view.fx || []).find(e => e.k === 'beast');
    if (BE) {
      const t = BE.t || 0, k = clamp01((t - 20) / 60) * clamp01((1600 - t) / 70), ice = clamp01((t - 110) / 240) * clamp01((1600 - t) / 70);
      if (k > 0) {
        c.fillStyle = `rgba(6,8,22,${0.5 * k})`; c.fillRect(0, 0, 1280, 720);
        const g = c.createRadialGradient(640, 360, 200, 640, 360, 780); g.addColorStop(0, 'rgba(10,14,40,0)'); g.addColorStop(1, `rgba(10,14,40,${0.55 * k})`);
        c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
      }
      if (ice > 0) beastIceBorder(c, ice, fr);
      if (k > 0 && t > 110) {
        const s = clamp01((t - 110) / 40) * k;
        c.save(); c.lineCap = 'round';
        for (let q = 0; q < 140; q++) {
          const sp = 18 + (q % 7) * 6, len = 18 + (q % 5) * 16, x = (((fr * sp + q * 211) % 1560) + 1560) % 1560 - 140, y = ((q * 71 + fr * (5 + (q % 5))) % 820) - 50;
          c.globalAlpha = s * (0.4 + (q % 3) * 0.2); c.strokeStyle = q % 4 ? '#ffffff' : '#cfe8ff'; c.lineWidth = 1.5 + (q % 3);
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - len, y - len * 0.35 + Math.sin(fr * 0.07 + q) * 4); c.stroke();
        }
        c.restore();
      }
    }
    // Absolute Zero: a cold blue haze, frost round the edges, and snow streaking across with the wind
    const ST = (view.fx || []).find(e => e.k === 'storm');
    if (ST) {
      const k = clamp01((ST.t || 0) / 20) * clamp01((306 - (ST.t || 0)) / 14), dir = ST.dir || 1;
      if (k > 0) {
        c.fillStyle = `rgba(140,190,255,${0.14 * k})`; c.fillRect(0, 0, 1280, 720);
        const g = c.createRadialGradient(640, 360, 240, 640, 360, 760); g.addColorStop(0, 'rgba(225,246,255,0)'); g.addColorStop(1, `rgba(225,246,255,${0.62 * k})`);
        c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
        c.save(); c.lineCap = 'round';
        for (let q = 0; q < 70; q++) {
          const sp = 26 + (q % 6) * 7, len = 40 + (q % 5) * 26, x = (((fr * sp + q * 197) % 1560) + 1560) % 1560, xx = dir > 0 ? x - 140 : 1420 - x, y = ((q * 83 + fr * (3 + (q % 4))) % 800) - 40;
          c.globalAlpha = k * (0.35 + (q % 3) * 0.2); c.strokeStyle = q % 3 ? '#ffffff' : '#d8f2ff'; c.lineWidth = 1.5 + (q % 3);
          c.beginPath(); c.moveTo(xx, y); c.lineTo(xx - dir * len, y - len * 0.22); c.stroke();
        }
        c.restore();
      }
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
    // platforms El Minya has hit show glowing pink crystal veins (two more with every hit), which creep down the
    // front of the platform as the crystal spreads (no deeper than the platform is thick)
    if (view.php) {
      const surf = computeSurfaces(view.stage, view.frame, view.clouds, view.brk), nS = STG[view.stage].solids.length, S3 = S3D.get(view.stage), now = view.frame || 0;
      for (const pi in view.php) {
        const n = view.php[pi]; if (!n) continue;
        const s = surf[nS + +pi]; if (!s || s.gone) continue;
        const C = corrOf(view, +pi), mv = S3.movers.find(m => m.idx === nS + +pi), deep = Math.min(22, Math.max(8, -((mv && mv.bot) || -0.8) / PX - 2)) / 22;
        c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
        for (let k = 0; k < n * 2; k++) {
          const g = clamp01((now - (C.at[k < 2 ? 0 : 1] || 0) - (k % 2) * 6) / 26); if (g <= 0) continue;
          const x0 = s.x + s.w * (0.2 + ((k * 0.37 + +pi * 0.13) % 0.6)), dir = k % 2 ? 1 : -1;
          const P = [[x0, s.y - 2], [x0 + dir * 8, s.y + 6 * deep], [x0 - dir * 4, s.y + 13 * deep], [x0 + dir * 10, s.y + 22 * deep]];
          const vein = () => {
            c.beginPath(); c.moveTo(P[0][0], P[0][1]);
            for (let q = 1; q < 4; q++) { const u = clamp01(g * 3 - (q - 1)); if (u <= 0) break; c.lineTo(P[q - 1][0] + (P[q][0] - P[q - 1][0]) * u, P[q - 1][1] + (P[q][1] - P[q - 1][1]) * u); }
          };
          c.globalAlpha = 0.5; c.strokeStyle = '#a878f0'; c.lineWidth = 6; vein(); c.stroke();
          c.globalAlpha = 1; c.strokeStyle = '#efe2ff'; c.lineWidth = 1.8; vein(); c.stroke();
        }
        c.restore();
      }
    }
    // Emilia Toad's ice: cracks that spread as it takes damage, and a little health bar with the HP left
    for (const s of view.ice || []) {
      const frac = clamp01((s.hp || 0) / (s.max || 1)), n = Math.round((1 - frac) * 7), fc = s.fc || 1;
      const L = s.k === 'pillar' ? s.x - s.w / 2 + 8 : s.x + fc * 39 - 7, W = s.k === 'pillar' ? s.w - 16 : 14, T = s.y - s.h + 10, Hh = s.h - 16;
      c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
      for (let k = 0; k < n && Hh > 10; k++) {
        const x0 = L + W * hash01(s.id * 7 + k), y0 = T + Hh * hash01(s.id * 13 + k * 3), d = k % 2 ? 1 : -1;
        const vein = () => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + d * 7, y0 + 9); c.lineTo(x0 - d * 3, y0 + 17); c.lineTo(x0 + d * 6, y0 + 26); };
        c.strokeStyle = 'rgba(40,90,140,0.55)'; c.lineWidth = 4; vein(); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = 1.6; vein(); c.stroke();
      }
      const bw = 44, bx = (s.k === 'pillar' ? s.x : s.x + fc * 39) - bw / 2, by = s.k === 'pillar' ? s.y - s.h + 26 : s.y - s.h * 0.55;
      if (s.h > 30) {
        c.fillStyle = 'rgba(20,32,56,0.78)'; c.fillRect(bx - 2, by - 2, bw + 4, 10);
        c.fillStyle = frac > 0.5 ? '#8fe6ff' : frac > 0.25 ? '#ffd23a' : '#ff6a5a'; c.fillRect(bx, by, bw * frac, 6);
        inkText(c, String(Math.ceil(s.hp || 0)), bx + bw / 2, by - 4, 14, '#e8f8ff');
      }
      c.restore();
    }
    for (const f of view.fighters || []) {
      if (f.st === 'dead' || f.out) continue;
      const sc = f.sc || 1, cx = f.x, cy = f.y - f.h * 0.5, top = f.y - f.h;
      // chilled by Emilia Toad's ice weapons: frost sparkles swirl round them
      if (f.slow > 0) for (let k = 0; k < 4; k++) {
        const a = fr * 0.09 + k * 1.57, x = cx + Math.cos(a) * 22 * sc, y = cy + Math.sin(a * 1.4) * 26 * sc;
        c.save(); c.globalAlpha = 0.85; c.strokeStyle = k % 2 ? '#ffffff' : '#bfeaff'; c.lineWidth = 1.6; c.lineCap = 'round';
        for (let q = 0; q < 3; q++) { const b = a + (q * Math.PI) / 3; c.beginPath(); c.moveTo(x - Math.cos(b) * 4.5, y - Math.sin(b) * 4.5); c.lineTo(x + Math.cos(b) * 4.5, y + Math.sin(b) * 4.5); c.stroke(); }
        c.restore();
      }
      // Emilia Toad's ice volley recharging: a ring at her feet fills up (and glints when it's ready)
      if (CH[f.ch] && CH[f.ch].volley && f.cd && f.rp <= 0) {
        const q = 1 - clamp01((f.cd.a || 0) / EMI.volleyCd);
        c.save(); c.lineWidth = 2.5; c.lineCap = 'round';
        c.globalAlpha = 0.35; c.strokeStyle = '#2a4a70'; c.beginPath(); c.ellipse(f.x, f.y + 3, 22 * sc, 6 * sc, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = q >= 1 ? 0.55 + 0.25 * Math.sin(fr * 0.15) : 0.8; c.strokeStyle = q >= 1 ? '#dff8ff' : '#8fe6ff';
        c.beginPath(); c.ellipse(f.x, f.y + 3, 22 * sc, 6 * sc, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q); c.stroke();
        c.restore();
      }
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
      if ((f.sp === 'checkup' || f.sp === 'eidsweets') && f.t % 10 < 5) paperRing(c, cx, cy, f.h * 0.55, '#7dff8a', 2.5);
      // burrowing: a mound of dirt moves along the ground above him
      if (f.st === 'atk' && f.at) {
        const A = ATK[f.ch] && ATK[f.ch][f.at], D = A && A.dig;
        if (D && f.t >= D.a && f.t <= D.b + 2) {
          pshadow(c, s => { c.fillStyle = s || '#8a5a2b'; c.beginPath(); c.ellipse(f.x, f.y + 2, 30 * sc, (12 + Math.sin(fr * 0.6) * 2) * sc, 0, Math.PI, 0); c.fill(); });
          c.fillStyle = '#b08050'; for (let k = -1; k <= 1; k++) { c.beginPath(); c.arc(f.x + k * 12 * sc, f.y - 6 * sc, 5 * sc, 0, Math.PI * 2); c.fill(); }
        }
      }
      // Beatrice's magic circle glows over the backpack while she casts
      if (f.ch === 'subaru' && f.st === 'spc' && (f.sp === 'minya' || f.sp === 'murak' || f.sp === 'fs')) {
        const bx = cx - (f.fc || 1) * 20 * sc, by = top + 26 * sc;
        c.save(); c.globalAlpha = 0.55 + 0.25 * Math.sin(fr * 0.4); paperRing(c, bx, by, (17 + Math.sin(fr * 0.3) * 2) * sc, '#c890ff', 3); paperRing(c, bx, by, 9 * sc, '#ff9cd0', 2); c.restore();
      }
      // the Samurai's and the Buddhist Toad's counters glow while they wait
      if ((f.sp === 'iaicounter' || f.sp === 'stillmind' || f.sp === 'sarcophagus') && f.ctrT === 0 && f.t >= 3 && f.t <= 30) { c.save(); c.globalAlpha = 0.55 + Math.sin(fr * 0.8) * 0.2; paperRing(c, cx, cy, f.h * 0.66, f.sp === 'iaicounter' ? '#ffc0d8' : '#ffe28a', 4); c.restore(); }
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
          for (let k = 0; k < 5; k++) { c.globalAlpha = 0.5; c.strokeStyle = e.sub === 'rune' ? '#d8b0ff' : e.sub === 'color' ? ['#ff9cd0', '#9fe8a0', '#ffe28a', '#9fc8ff', '#d8b0ff'][k] : '#ffffff'; c.lineWidth = 4; c.beginPath(); c.arc(e.x, e.y, (e.r || 230) * (0.3 + k * 0.15), fr * 0.15 + k, fr * 0.15 + k + 1.6); c.stroke(); }
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
        case 'burst': for (const [t0, r] of [[10, 150], [40, 235], [70, 340]]) { const q = (e.t - t0) / 16; if (q >= 0 && q <= 1) { c.save(); c.globalAlpha = 1 - q * 0.6; paperRing(c, e.x, e.y, r * q, e.sub === 'lotus' ? '#ffe28a' : '#ff8cc6', 10 * (1 - q) + 2); c.restore(); } } break;
        case 'sweep': if (e.t < 140) { c.save(); c.globalAlpha = 0.8; paperRing(c, e.x, s0.y - 4, 30 + Math.sin(fr * 0.5) * 4, e.sub === 'petals' ? '#ffc0d8' : '#7dfcff', 3); c.restore(); } break;
        case 'lasso': {
          const own = fighterOf(view, e.o); if (!own || !e.vic || e.sub === 'hora') break;
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
      case 'breath': { // puffs pouring out of the mouth in a cone (Red Yoshi's fire breath)
        for (let n = 0; n < 6; n++) {
          const q = (f.t * 0.3 + n / 6) % 1, px = cx + fc * (16 + q * (Math.abs(x - cx) + r * 0.6)), py = y + Math.sin(n * 2.1 + f.t * 0.5) * r * 0.35 * q, rr = r * (0.2 + q * 0.55);
          pshadow(c, s => { c.fillStyle = s || (n % 2 ? main : col); c.beginPath(); c.arc(px, py, rr, 0, Math.PI * 2); c.fill(); });
        }
        break;
      }
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
  const TETHER = { canehook: { range: 84, a: 9, b: 13, col: '#8a5326', w: 5, end: 'hook' }, bandage: { range: 62, a: 8, b: 13, col: '#fbfbf6', w: 7, end: 'wrap' }, lasso: { range: 150, a: 10, b: 16, col: '#c8a060', w: 3, end: 'loop' },
    unseenhand: { range: 180, a: 10, b: 18, col: '#2a1a3a', w: 9, end: 'hand' } };
  function paperRope(c, x0, y0, x1, y1, col, w, end) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + Math.min(18, Math.abs(x1 - x0) * 0.08);
    // Subaru's Unseen Hand: a shadowy arm that ends in grasping fingers
    if (end === 'hand') {
      c.save(); c.globalAlpha *= 0.82;
      pshadow(c, s => {
        c.strokeStyle = s || col; c.lineCap = 'round'; c.lineWidth = w;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my - 20, x1, y1); c.stroke();
        const a0 = Math.atan2(y1 - (my - 20), x1 - mx); c.lineWidth = Math.max(3, w * 0.5);
        for (let k = -1.5; k <= 1.5; k++) { const a = a0 + k * 0.34; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + Math.cos(a) * 18, y1 + Math.sin(a) * 18); c.stroke(); }
      });
      c.restore();
      return;
    }
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
        // Hanukkah gelt: chocolate coins in gold or silver foil, spinning (some unwrapped, showing the chocolate)
        case 'gelt': {
          const s = p.size, w = Math.abs(Math.cos(p.life * 0.35 + p.x)) * s + 1.5, foil = p.color;
          c.fillStyle = 'rgba(58,36,20,.3)'; c.beginPath(); c.ellipse(p.x + 1, p.y + 1.5, w, s, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = foil; c.beginPath(); c.ellipse(p.x, p.y, w, s, 0, 0, Math.PI * 2); c.fill();
          if (p.choc) { c.fillStyle = '#6a3a1a'; c.beginPath(); c.ellipse(p.x, p.y, w * 0.8, s * 0.8, 0, -1.2, 1.9); c.fill(); }
          c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(p.x, p.y, w * 0.62, s * 0.62, 0, 0, Math.PI * 2); c.stroke();
          break;
        }
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
      const rig = M3D.RIGS[ch], mount = rig && rig.mount, ty = mount ? 1.0 : rig && rig.kind === 'yoshi' ? 1.42 : 1.5;
      G3.begin({ cam: [0.35 * (mount ? 1 : 0), ty, mount ? 5.3 : 2.75], fov: (40 * Math.PI) / 180, vw: size, vh: size, near: 0.5, far: 50, fog: [1, 1, 1], fogR: [1e4, 2e4, 0], L: LIGHT, amb: 0.62, dif: 0.5, cool: 0.45, ink: INK, inkW: 0.035, crease: 0.3 });
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
  // the title screen parade: every fighter gets their own place in one long loop, ATT_GAP px apart, so nobody
  // overlaps; they fade in at the stage's left edge and out at the right, then loop round out of sight
  const ATT = CHARS.map((C, k) => ({ i: 100 + k, ch: C.id, x: 0, y: 0, fc: 1, st: 'run', t: 0, sc: 1, h: C.h, w: 36, inv: 0, rp: 0, gi: 0, shd: 100, dm: 0, sk: 0, fade: 1 }));
  const ATT_GAP = 84, ATT_EDGE = 470;
  function attract(fr, dim) {
    const L = ATT.length * ATT_GAP;
    ATT.forEach((f, k) => {
      f.x = ((k * ATT_GAP + fr * 1.8) % L) - ATT_EDGE - 40;
      // a little hop now and then, never two neighbours at once
      const hp = (fr + k * 67) % 240, hop = hp < 30;
      f.y = hop ? -Math.sin((hp / 30) * Math.PI) * 80 : 0;
      f.st = hop ? 'air' : 'run'; f.gi = hop ? -1 : 0;
      f.fade = clamp01((ATT_EDGE - Math.abs(f.x)) / 50);
      if (f.fade <= 0) delete M3D.MEM[f.i]; // start fresh (no leftover easing) each time round
    });
    const view = { stage: 'town', frame: fr, fighters: ATT.filter(f => f.fade > 0), proj: [], items: [], clouds: [] };
    frame(view, { x: 0, y: -170, z: 0.8, shake: 0 }, fr, { hud: false, tags: false });
    if (dim) { cx2.fillStyle = 'rgba(30,18,10,.58)'; cx2.fillRect(0, 0, 1280, 720); }
  }
  return { init, frame, attract, shatter, portrait: portrait3, stageThumb: stageThumb3, get ok() { return ok; } };
})();
