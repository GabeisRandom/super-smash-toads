'use strict';
// ===== M3D: rigged origami fighters, their props, items and projectiles, plus pose animation =====
const M3D = (() => {
  const B = G3.B, v = G3.v, M4 = G3.M4;
  const PX = 1 / 28; // world units per sim pixel
  const PAPER = { skin: '#f6c99a', shoe: '#8d4f2a', sole: '#6a3618', pants: '#f3efe6', shirt: '#f6f1e6', white: '#f6f1e6', eye: '#1d1622', mouth: '#7a1c2c', tongue: '#ff7b8b', blush: '#ff9aa6', gill: '#eadfc4' };
  const paper = c => (!c || c.toLowerCase() === '#ffffff' ? PAPER.white : c);
  const VARY = 0.05;

  // round cap: one ellipsoid dome tipped back slightly, rim curling under its widest point
  const CAP_C = [0, 1.54, 0], CAP_R = [0.84, 0.76, 0.84], CAP_TILT = -0.11, CAP_PIV = [0, 1.4, 0];
  const CAP_PROFILE = [90, 66, 42, 18, -2, -16, -30].map(a => [CAP_R[0] * Math.cos((a * Math.PI) / 180), CAP_C[1] + CAP_R[1] * Math.sin((a * Math.PI) / 180)]).concat([[0.55, 1.2], [0.3, 1.29], [0, 1.33]]);
  const tiltP = p => { const c = Math.cos(CAP_TILT), s = Math.sin(CAP_TILT), y = p[1] - CAP_PIV[1], z = p[2] - CAP_PIV[2]; return [p[0], CAP_PIV[1] + y * c - z * s, CAP_PIV[2] + y * s + z * c]; };
  const tiltN = n => { const c = Math.cos(CAP_TILT), s = Math.sin(CAP_TILT); return [n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c]; };
  const SPOTS = [[[0, 0.42, 1], 0.42], [[-1, 0.4, 0.12], 0.35], [[1, 0.4, 0.12], 0.35], [[0, 0.4, -1], 0.37]];
  const HC = [0, 1.08, 0.04], HR = [0.4, 0.34, 0.37];
  const HEAD_PIV = [0, 0.95, 0.02], BODY_PIV = [0, 0.45, 0];
  const CAP_TOP = v.sub(tiltP([0, CAP_C[1] + CAP_R[1], 0]), HEAD_PIV);

  function part(rig, name, pivot, build, o) {
    B.start(); build();
    const tris = B.take();
    for (const t of tris) if (t.vary == null) t.vary = VARY;
    B.shift(tris, pivot);
    rig.parts[name] = { mesh: G3.compile(tris, Object.assign({ seed: Object.keys(rig.parts).length + 1 }, o)), pivot };
  }
  function mesh(build, o) { B.start(); build(); const tris = B.take(); for (const t of tris) if (t.vary == null) t.vary = VARY; return G3.compile(tris, o); }
  // build a piece and transform only that piece (B.take() would otherwise grab everything built so far)
  function sub(build, fp, fn) { const keep = B.take(); build(); const t = B.xformTris(B.take(), fp, fn); B.push(keep); B.push(t); }
  // a wheel or disc lying in the x-y plane (lathe axis turned to z)
  const toZ = (x, y, z) => [p => [x + p[0], y + p[2], z + p[1]], n => [n[0], n[2], n[1]]];
  function headDecal(d, rad, col, o) {
    o = o || {};
    d = v.norm(d);
    const p = [HC[0] + d[0] * HR[0], HC[1] + d[1] * HR[1], HC[2] + d[2] * HR[2]], n = v.norm([d[0] / HR[0], d[1] / HR[1], d[2] / HR[2]]);
    const F = B.frameFor(n), off = o.off || [0, 0, 0];
    const c = v.add(p, v.add(v.mul(F.r, off[0]), v.add(v.mul(F.u, off[1]), v.mul(F.n, (off[2] || 0)))));
    B.decalAt(c, n, rad, col, { lat: o.lat, spin: o.spin, nLon: o.nLon || 8, nLat: o.nLat || 3 });
  }

  // ---------- Toad family ----------
  // hats sit on the top of the cap; they are built in the cap's frame and tilted with it
  const CAP_T = CAP_C[1] + CAP_R[1];
  const domeY = z => CAP_C[1] + CAP_R[1] * Math.sqrt(Math.max(0, 1 - (z / CAP_R[2]) ** 2));
  function hatGeo(L, trim) {
    const T = CAP_T;
    const band = (col, y0, y1, r) => B.lathe([[r - 0.04, y1 + 0.03], [r + 0.03, y1], [r + 0.03, y0], [r - 0.04, y0 - 0.03]], 18, { col });
    switch (L.hat) {
      case 'tricorn':
        B.lathe([[0, T - 0.04], [0.64, T - 0.06], [0.72, T - 0.02], [0.66, T - 0.11], [0, T - 0.1]], 14, { col: '#2b2b34' });
        B.lathe([[0, T + 0.34], [0.24, T + 0.32], [0.34, T + 0.14], [0.37, T - 0.05], [0, T - 0.05]], 12, { col: '#26262e' });
        for (const a of [0.5, 2.6, 4.7]) B.cone([Math.cos(a) * 0.58, T - 0.06, Math.sin(a) * 0.58], 0.18, 0.2, 4, { col: '#2b2b34' });
        B.decalAt([0, T + 0.16, 0.35], [0, 0.1, 1], [0.1, 0.09, 0.03], '#f6f1e6');
        for (const sx of [-1, 1]) B.decalAt([0.035 * sx, T + 0.17, 0.375], [0, 0.1, 1], [0.022, 0.022, 0.01], '#1d1622');
        break;
      case 'ninja':
        band(trim, 1.46, 1.6, CAP_R[0]);
        for (const [x0, x1] of [[0.12, 0.32], [-0.04, 0.06]]) B.capsule([x0, 1.53, -0.84], [x1, 1.12, -1.1], 0.05, 5, { col: trim, r2: 0.02 });
        break;
      case 'plume':
        band('#c8d0dc', 1.44, 1.6, CAP_R[0]);
        B.lathe([[0, T + 0.1], [0.07, T + 0.08], [0.08, T - 0.04], [0, T - 0.04]], 6, { col: '#c8d0dc' });
        B.ellipsoid([0, T + 0.2, -0.04], [0.09, 0.2, 0.12], 3, 7, { col: '#d8343c', seed: 71 });
        B.ellipsoid([0, T + 0.22, -0.26], [0.08, 0.17, 0.15], 3, 7, { col: '#e8473f', seed: 72 });
        B.ellipsoid([0, T + 0.1, -0.46], [0.07, 0.12, 0.13], 3, 7, { col: '#d8343c', seed: 73 });
        break;
      case 'toque':
        B.lathe([[0.3, T - 0.08], [0.33, T + 0.24], [0.35, T + 0.42], [0, T + 0.42]], 12, { col: '#ffffff' });
        B.ellipsoid([0, T + 0.5, 0], [0.45, 0.22, 0.45], 4, 12, { col: '#fbfbf6', jit: 0.03, seed: 33 });
        band('#f0ebe0', T - 0.08, T + 0.02, 0.3);
        break;
      case 'wizard':
        B.lathe([[0, T + 1.0], [0.08, T + 0.84], [0.2, T + 0.5], [0.33, T + 0.12], [0.36, T - 0.03], [0, T - 0.03]], 12, { col: L.vest });
        B.lathe([[0, T - 0.03], [0.7, T - 0.07], [0.74, T - 0.11], [0, T - 0.11]], 14, { col: L.vest });
        band(trim, T - 0.02, T + 0.06, 0.35);
        for (const [x, y, z, s] of [[0.12, 0.42, 0.24, 0.06], [-0.18, 0.2, 0.26, 0.05], [0.04, 0.68, 0.14, 0.04]]) B.decalAt([x, T + y, z], [x, 0.2, z], [s, s, 0.02], trim);
        break;
      case 'mirror':
        band('#f6f1e6', 1.44, 1.56, CAP_R[0]);
        B.decalAt([-0.3, 1.5, 0.8], [-0.36, 0, 1], [0.16, 0.16, 0.035], '#dfe6ee');
        B.decalAt([-0.31, 1.5, 0.84], [-0.36, 0, 1], [0.045, 0.045, 0.02], '#2b2b34');
        break;
      case 'shades':
        for (const z of [-0.5, -0.25, 0, 0.25, 0.5]) B.cone([0, domeY(z) - 0.06, z], 0.09, 0.3, 4, { col: '#e8262b' });
        break;
      case 'cowboy':
        B.lathe([[0, T - 0.04], [0.74, T - 0.08], [0.88, T + 0.02], [0.84, T - 0.1], [0, T - 0.12]], 16, { col: '#8a5a2b' });
        B.lathe([[0, T + 0.3], [0.18, T + 0.36], [0.32, T + 0.3], [0.37, T + 0.04], [0.36, T - 0.07], [0, T - 0.07]], 12, { col: '#9a6a3a' });
        band('#5a3418', T - 0.06, T + 0.04, 0.36);
        break;
      case 'antenna':
        B.capsule([0, T - 0.05, 0], [0, T + 0.42, 0], 0.025, 5, { col: '#8a8f99' });
        B.ellipsoid([0, T + 0.46, 0], [0.06, 0.06, 0.06], 2, 6, { col: '#ff4a4a' });
        for (const [x, z] of [[0.5, 0.45], [-0.5, 0.45], [0, 0.66]]) B.ellipsoid([x, domeY(z) - 0.05 - Math.abs(x) * 0.4, z], [0.06, 0.06, 0.06], 2, 6, { col: '#8a8f99' });
        break;
      case 'dome':
        B.capsule([0, 2.48, -0.1], [0, 2.84, -0.1], 0.022, 5, { col: '#8a8f99' });
        B.ellipsoid([0, 2.88, -0.1], [0.065, 0.065, 0.065], 2, 6, { col: '#ff4a4a' });
        break;
    }
  }
  function toadRig(id, override) {
    const C = CH[id], L = Object.assign({}, C.look, override || {});
    const rig = { kind: 'toad', id, parts: {}, LU: 0.24, handY: -0.27, h: 2.3, wide: C.wide || 1, toadette: !!L.pigtails, captain: !!L.lamp, old: !!L.old,
      ghost: !!L.ghost, robo: !!L.robo, prop: L.prop || null, shield: !!L.shield, look: L,
      blade: ['cutlass', 'sword', 'pan', 'wand'].includes(L.prop), parrot: L.hat === 'tricorn', eyeY: 0.123 };
    const wd = rig.wide, vest = L.vest, trim = paper(L.trim || '#f4c430'), capCol = paper(L.cap), spot = paper(L.spot);
    const skin = rig.robo ? '#a4adba' : rig.ghost ? '#e2ebfb' : PAPER.skin, metal = '#7a8494';
    part(rig, 'body', BODY_PIV, () => {
      if (rig.toadette) B.lathe([[0, 0.6], [0.36, 0.58], [0.46, 0.42], [0.54, 0.24], [0.52, 0.18], [0, 0.18]], 12, { sx: wd, sz: wd, jit: 0.02, seed: 3, mat: m => (m[1] < 0.25 ? PAPER.white : '#ff7ab4') });
      else if (L.robe || L.coat) B.lathe([[0, 0.6], [0.36, 0.58], [0.47, 0.42], [0.54, 0.2], [0.52, 0.15], [0, 0.15]], 12, { sx: wd, sz: wd, jit: 0.02, seed: 3, mat: m => (m[1] < 0.22 ? trim : L.coat ? '#fbfbf8' : vest) });
      else B.lathe([[0, 0.56], [0.33, 0.54], [0.42, 0.44], [0.43, 0.32], [0.35, 0.21], [0, 0.18]], 12, { sx: wd, sz: wd, jit: 0.02, seed: 3, col: rig.robo ? metal : L.pants || PAPER.pants });
      B.lathe([[0, 0.97], [0.19, 0.95], [0.31, 0.87], [0.385, 0.73], [0.395, 0.58], [0.35, 0.46], [0, 0.43]], 12, { sx: wd, sz: wd, jit: 0.01, seed: 4, col: rig.robo ? '#8e98a8' : PAPER.shirt });
      const a0 = Math.PI / 2 + 0.3, a1 = Math.PI / 2 + Math.PI * 2 - 0.3, n = 10, tw = 0.14, angles = [a0];
      for (let k = 0; k <= n; k++) angles.push(a0 + tw + ((a1 - a0 - 2 * tw) * k) / n);
      angles.push(a1);
      const last = angles.length - 2;
      B.lathe([[0.21, 0.965], [0.35, 0.885], [0.435, 0.735], [0.445, 0.585], [0.4, 0.495], [0.39, 0.462]], 0, { angles, sx: wd, sz: wd, jit: 0.01, seed: 14, center: [0, 0.7, 0],
        mat: (m, i, j) => (L.stripes ? (i % 2 || j === 0 || j === last ? trim : vest) : i === 4 || j === 0 || j === last ? trim : vest) });
      if (rig.captain) {
        B.box([0, 0.74, -0.46], [0.3, 0.3, 0.14], { col: '#c0472f' });
        B.box([0, 0.99, -0.46], [0.31, 0.07, 0.155], { col: '#8a5a2b' });
        B.ellipsoid([0.12, 1.13, -0.44], [0.05, 0.12, 0.04], 2, 5, { col: '#3fae3a' });
      }
      if (L.armor) {
        for (const sx of [-1, 1]) B.ellipsoid([0.37 * sx * wd, 0.88, 0.02], [0.18, 0.12, 0.18], 3, 8, { col: '#c8d0dc', seed: 60 + sx });
        B.decalAt([0, 0.72, 0.44], [0, 0, 1], [0.11, 0.11, 0.03], trim);
      }
      if (L.apron) { B.decalAt([0, 0.5, 0.41], [0, -0.1, 1], [0.27, 0.28, 0.03], '#ffffff'); B.decalAt([0.1, 0.44, 0.44], [0.2, -0.1, 1], [0.07, 0.05, 0.02], trim); }
      if (L.coat) B.decalAt([-0.2, 0.68, 0.4], [-0.4, 0, 1], [0.07, 0.06, 0.02], trim);
      if (L.robe) for (const [x, y] of [[0.22, 0.32], [-0.26, 0.24], [0.06, 0.2]]) B.decalAt([x, y, 0.5], [x, 0, 1], [0.05, 0.05, 0.02], trim);
      if (L.scarf) {
        B.lathe([[0.18, 1.0], [0.33, 0.95], [0.35, 0.88], [0.2, 0.86]], 10, { col: '#d8343c' });
        B.ellipsoid([0.08, 0.84, 0.34], [0.1, 0.13, 0.04], 2, 6, { col: '#d8343c' });
        B.decalAt([-0.19, 0.66, 0.41], [-0.4, 0, 1], [0.08, 0.08, 0.02], '#ffd23a');
      }
      if (L.jetpack) {
        B.box([0, 0.74, -0.44], [0.27, 0.28, 0.12], { col: '#e6e6e6' });
        B.box([0, 0.88, -0.565], [0.2, 0.04, 0.01], { col: trim });
        for (const sx of [-1, 1]) B.lathe([[0.075, 0.5], [0.09, 0.42], [0.06, 0.36], [0, 0.36]], 7, { c: [0.14 * sx, 0, -0.5], col: '#8a8f99' });
      }
      if (rig.ghost) B.capsule([0, 0.32, -0.28], [0.06, 0.12, -0.62], 0.17, 6, { col: '#d4e0f6', r2: 0.03 });
      if (rig.robo) {
        B.box([0, 0.7, 0.42], [0.14, 0.1, 0.02], { col: '#3a4250' });
        [-1, 0, 1].forEach(k => B.decalAt([0.075 * k, 0.72, 0.445], [0, 0, 1], [0.026, 0.026, 0.01], ['#ff5a5a', '#ffd23a', '#7dff8a'][k + 1]));
      }
    });
    part(rig, 'head', HEAD_PIV, () => {
      B.ellipsoid(HC, HR, 6, 12, { col: skin, jit: 0.01, seed: 9 });
      if (!rig.robo && !L.mask) for (const sx of [-1, 1]) headDecal([0.6 * sx, -0.42, 0.7], [0.05, 0.028, 0.01], PAPER.blush);
      if (rig.old) {
        for (const sx of [-1, 1]) { headDecal([0.17 * sx, -0.3, 0.94], [0.13, 0.065, 0.045], PAPER.white); headDecal([0.32 * sx, 0.2, 0.93], [0.075, 0.03, 0.02], PAPER.white); }
        headDecal([0, -0.14, 1], [0.06, 0.06, 0.05], '#f0b88a');
      }
      // Ninja's face mask covers everything below the eyes
      if (L.mask) B.ellipsoid([0, 0.92, 0.06], [0.425, 0.13, 0.395], 3, 12, { col: vest, seed: 19 });
      if (L.eyepatch) headDecal([0.02, 0.22, 0.97], [0.36, 0.016, 0.012], '#1d1622', { spin: 0.55 });
      const headTris = B.take();
      B.lathe(CAP_PROFILE, 16, { jit: 0.012, seed: 10, center: [0, 1.55, 0], mat: (m, i) => (i >= 6 ? PAPER.gill : capCol) });
      for (const [d, a] of SPOTS) B.spotPatch(CAP_C, CAP_R, d, a, spot, 10, 0.022, 0.25);
      if (rig.captain) { const d = v.norm([0, 0.28, 1]); B.decalAt([CAP_C[0] + d[0] * CAP_R[0], CAP_C[1] + d[1] * CAP_R[1], CAP_C[2] + d[2] * CAP_R[2]], [d[0] / CAP_R[0], d[1] / CAP_R[1], d[2] / CAP_R[2]], [0.15, 0.15, 0.06], '#8a8f99'); }
      hatGeo(L, trim);
      const capTris = B.xformTris(B.take(), tiltP, tiltN);
      B.push(headTris); B.push(capTris);
      // Toadette's round braids hang from the sides of her cap, framing her face, with white bands at the ends
      if (rig.toadette) for (const sx of [-1, 1]) {
        B.capsule([0.44 * sx, 1.17, -0.05], [0.58 * sx, 1.04, -0.06], 0.08, 6, { col: capCol });
        B.ellipsoid([0.62 * sx, 0.94, -0.06], [0.2, 0.23, 0.2], 4, 9, { col: capCol, seed: 40 + sx, jit: 0.01 });
        B.ellipsoid([0.63 * sx, 0.75, -0.06], [0.13, 0.055, 0.13], 2, 8, { col: PAPER.white, seed: 44 + sx });
      }
    });
    const er = rig.old ? [0.046, 0.075, 0.025] : [0.058, 0.105, 0.03];
    part(rig, 'eyes', HEAD_PIV, () => {
      for (const sx of [-1, 1]) {
        if (L.hat === 'shades') {
          // Rocker's shades: dark lenses over both eyes with a glint
          headDecal([0.31 * sx, -0.01, 0.95], [0.12, 0.085, 0.035], '#141418');
          headDecal([0.31 * sx, -0.01, 0.95], [0.035, 0.02, 0.015], '#ffffff', { off: [-0.04, 0.035, 0.03] });
        } else if (L.eyepatch && sx > 0) {
          headDecal([0.32 * sx, -0.02, 0.95], [0.1, 0.11, 0.035], '#1d1622');
        } else if (rig.robo) {
          headDecal([0.3 * sx, -0.02, 0.95], [0.09, 0.05, 0.03], '#5ff0ff');
        } else {
          headDecal([0.32 * sx, -0.02, 0.95], er, PAPER.eye);
          headDecal([0.32 * sx, -0.02, 0.95], [er[0] * 0.36, er[1] * 0.32, 0.012], '#ffffff', { off: [-0.016, er[1] * 0.4, 0.03] });
        }
      }
      if (L.hat === 'shades') headDecal([0, 0.02, 1], [0.08, 0.016, 0.02], '#141418');
    }, { ink: false, crease: false });
    part(rig, 'eyesHurt', HEAD_PIV, () => {
      for (const sx of [-1, 1]) for (const k of [-1, 1]) headDecal([0.32 * sx, -0.02, 0.95], [0.062, 0.014, 0.014], rig.robo ? '#5ff0ff' : PAPER.eye, { off: [0, k * 0.028, 0.004], spin: -0.5 * k * sx });
    }, { ink: false, crease: false });
    if (rig.robo) {
      // a speaker grille for a mouth
      part(rig, 'mouth', HEAD_PIV, () => { headDecal([0.02, -0.4, 0.92], [0.12, 0.05, 0.024], '#2b3038'); for (const k of [-1, 0, 1]) headDecal([0.02, -0.4, 0.92], [0.1, 0.007, 0.01], '#8e98a8', { off: [0, k * 0.022, 0.012] }); }, { ink: false, crease: false });
      part(rig, 'mouthO', HEAD_PIV, () => headDecal([0.02, -0.42, 0.9], [0.09, 0.08, 0.026], '#2b3038'), { ink: false, crease: false });
    } else if (!L.mask) {
      part(rig, 'mouth', HEAD_PIV, () => {
        headDecal([0.02, -0.38, 0.92], [0.135, 0.095, 0.026], PAPER.mouth, { lat: [-90, 0] });
        headDecal([0.02, -0.38, 0.92], [0.11, 0.026, 0.018], '#ffffff', { off: [0, -0.006, 0.01], lat: [-90, 0] });
        headDecal([0.02, -0.38, 0.92], [0.065, 0.034, 0.016], PAPER.tongue, { off: [0, -0.055, 0.013] });
      }, { ink: false, crease: false });
      part(rig, 'mouthO', HEAD_PIV, () => {
        headDecal([0.02, -0.42, 0.9], [0.08, 0.09, 0.026], PAPER.mouth);
        headDecal([0.02, -0.42, 0.9], [0.05, 0.03, 0.016], PAPER.tongue, { off: [0, -0.045, 0.012] });
      }, { ink: false, crease: false });
    }
    if (rig.captain) part(rig, 'lamp', HEAD_PIV, () => { const d = v.norm([0, 0.28, 1]), n = [d[0] / CAP_R[0], d[1] / CAP_R[1], d[2] / CAP_R[2]]; const p = [CAP_C[0] + d[0] * CAP_R[0], CAP_C[1] + d[1] * CAP_R[1], CAP_C[2] + d[2] * CAP_R[2]]; B.decalAt(v.add(p, v.mul(v.norm(n), 0.05)), n, [0.1, 0.1, 0.03], '#fff2a0'); B.xformTris(B.take(), tiltP, tiltN).forEach(t => B.push([t])); }, { ink: false, crease: false });
    // Astro Toad's glass bubble helmet (drawn see-through)
    if (L.hat === 'dome') part(rig, 'dome', HEAD_PIV, () => B.ellipsoid([0, 1.56, -0.02], [1.0, 0.98, 1.0], 6, 14, { col: '#dff6ff' }), { ink: false, crease: false });
    for (const [nm, x, z, seed] of [['shoeL', -0.22, 0.08, 12], ['shoeR', 0.22, 0.03, 13]]) {
      const c = [x * wd, 0.115, z];
      part(rig, nm, c, () => B.ellipsoid(c, [0.17, 0.115, 0.28], 4, 9, { seed, jit: 0.01, mat: m => (rig.robo ? (m[1] < 0.05 ? '#4a525e' : metal) : m[1] < 0.05 ? PAPER.sole : PAPER.shoe) }));
    }
    for (const [k, sx] of [['N', -1], ['F', 1]]) {
      const s = [0.36 * sx * wd, 0.84, 0.02], e = [s[0], s[1] - rig.LU, s[2]], h = [e[0], e[1] - 0.27, e[2]];
      part(rig, 'uarm' + k, s, () => B.capsule(s, e, 0.075, 6, { col: skin }));
      part(rig, 'farm' + k, e, () => {
        B.capsule(e, [e[0], e[1] - 0.22, e[2]], 0.072, 6, { col: skin });
        if (rig.robo) B.ellipsoid(h, [0.135, 0.125, 0.135], 3, 7, { col: metal, seed: 21 + sx });
        else {
          B.ellipsoid(h, [0.1, 0.095, 0.1], 3, 7, { col: skin, seed: 21 + sx });
          B.ellipsoid([h[0] - sx * 0.04, h[1] + 0.04, h[2] + 0.075], [0.045, 0.045, 0.045], 3, 6, { col: skin });
        }
      });
    }
    return rig;
  }

  // ---------- Yoshi ----------
  function yoshiRig(id) {
    const L = CH[id].look, G = L.body, spine = L.spines || '#e8342f', belly = L.belly || PAPER.white;
    const rig = { kind: 'yoshi', id, parts: {}, LU: 0.16, handY: -0.17, h: 1.95, wide: 1, look: L, hs: L.baby ? 1.26 : 1, eyeY: 0.71 };
    part(rig, 'body', BODY_PIV, () => {
      B.ellipsoid([0, 0.66, 0], [0.4, 0.42, 0.38], 5, 11, { col: G, jit: 0.01, seed: 50 });
      B.ellipsoid([0, 0.6, 0.17], [0.3, 0.34, 0.26], 4, 9, { col: belly, seed: 51 });
      B.ellipsoid([0, 1.0, -0.17], [0.32, 0.12, 0.28], 3, 9, { col: L.saddle, seed: 52 });
      B.capsule([0, 0.55, -0.3], [0, 0.36, -0.8], 0.15, 7, { col: G, r2: 0.04 });
      B.lathe([[0, 0.3], [0.2, 0.28], [0.25, 0.1], [0.2, 0], [0, 0]], 8, { c: [0, 0.02, 0], col: G });
      if (L.spots) {
        for (const [x, y, z] of [[0.3, 0.75, -0.18], [-0.3, 0.72, -0.2], [0.12, 0.85, -0.33], [-0.18, 0.5, -0.3], [0.05, 0.47, -0.62]]) B.decalAt([x, y, z], [x, 0.1, z], [0.07, 0.06, 0.02], L.spots);
        for (const sx of [-1, 1]) { B.decalAt([0.4 * sx, 0.62, 0.02], [sx, 0, 0], [0.065, 0.055, 0.02], L.spots); B.decalAt([0.325 * sx, 0.45, -0.118], [0.8 * sx, -0.4, -0.3], [0.06, 0.05, 0.02], L.spots); }
      }
    });
    part(rig, 'head', HEAD_PIV, () => {
      B.ellipsoid([0, 1.38, 0.02], [0.32, 0.33, 0.34], 5, 11, { col: G, jit: 0.01, seed: 53 });
      // the top of the head rises up behind the eyes: a crown plus a bulge cupping each eye
      B.ellipsoid([0, 1.6, 0.03], [0.27, 0.25, 0.27], 4, 10, { col: G, seed: 59 });
      for (const sx of [-1, 1]) B.ellipsoid([0.145 * sx, 1.66, 0.16], [0.16, 0.245, 0.15], 4, 9, { col: G, seed: 60 + sx });
      B.ellipsoid([0, 1.3, 0.42], [0.3, 0.25, 0.27], 4, 10, { col: G, seed: 54 });
      B.ellipsoid([0, 1.14, 0.28], [0.28, 0.11, 0.24], 3, 9, { col: belly, seed: 55 });
      // big egg-shaped eyes peek out of the front of those bulges, just above the snout
      for (const sx of [-1, 1]) {
        B.ellipsoid([0.145 * sx, 1.67, 0.25], [0.135, 0.225, 0.12], 4, 9, { col: PAPER.white, seed: 56 + sx });
        B.decalAt([0.1 * sx, 1.38, 0.672], [0.13 * sx, 0.3, 1], [0.028, 0.036, 0.01], PAPER.eye, { nLat: 3 });
      }
      for (const [y, z] of [[1.78, -0.16], [1.6, -0.28], [1.42, -0.34]]) B.ellipsoid([0, y, z], [0.05, 0.08, 0.08], 2, 6, { col: spine });
      if (L.spots) {
        for (const [x, y, z] of [[0.24, 1.44, -0.2], [-0.26, 1.3, -0.16], [0.02, 1.55, -0.25]]) B.decalAt([x, y, z], [x, 0.2, z], [0.06, 0.05, 0.02], L.spots);
        // more on the cheeks and crown, where the camera can see them
        for (const sx of [-1, 1]) { B.decalAt([0.315 * sx, 1.34, 0.08], [sx, 0, 0.25], [0.055, 0.045, 0.02], L.spots); B.decalAt([0.215 * sx, 1.62, -0.13], [0.7 * sx, 0.3, -0.5], [0.05, 0.045, 0.02], L.spots); }
      }
    });
    // eyelids, drawn only for a blink
    part(rig, 'lids', HEAD_PIV, () => { for (const sx of [-1, 1]) B.ellipsoid([0.145 * sx, 1.67, 0.262], [0.143, 0.233, 0.126], 4, 9, { col: G }); });
    part(rig, 'eyes', HEAD_PIV, () => {
      for (const sx of [-1, 1]) {
        B.ellipsoid([0.15 * sx, 1.66, 0.345], [0.075, 0.135, 0.04], 3, 8, { col: PAPER.eye });
        B.ellipsoid([0.13 * sx, 1.72, 0.38], [0.026, 0.04, 0.012], 2, 6, { col: '#ffffff' });
      }
    }, { ink: false, crease: false });
    part(rig, 'mouth', HEAD_PIV, () => B.ellipsoid([0, 1.16, 0.52], [0.12, 0.02, 0.06], 2, 7, { col: PAPER.mouth }), { ink: false, crease: false });
    part(rig, 'mouthO', HEAD_PIV, () => B.ellipsoid([0, 1.15, 0.55], [0.14, 0.07, 0.1], 3, 8, { col: '#ff6f9a' }), { ink: false, crease: false });
    for (const [nm, x, z, seed] of [['shoeL', -0.2, 0.12, 57], ['shoeR', 0.2, 0.08, 58]]) {
      const c = [x, 0.13, z];
      // Yellow Yoshi stomps around in big boots
      part(rig, nm, c, () => {
        if (L.boots) { B.ellipsoid([c[0], 0.17, c[2]], [0.23, 0.17, 0.35], 4, 9, { seed, col: L.shoe }); B.ellipsoid([c[0], 0.05, c[2] + 0.02], [0.24, 0.06, 0.37], 2, 9, { col: '#3a2a20' }); }
        else B.ellipsoid(c, [0.18, 0.13, 0.3], 4, 9, { seed, col: L.shoe });
      });
    }
    for (const [k, sx] of [['N', -1], ['F', 1]]) {
      const s = [0.34 * sx, 0.86, 0.14], e = [s[0], s[1] - rig.LU, s[2]], h = [e[0], e[1] - 0.17, e[2]];
      part(rig, 'uarm' + k, s, () => B.capsule(s, e, 0.07, 6, { col: G }));
      part(rig, 'farm' + k, e, () => { B.capsule(e, [e[0], e[1] - 0.12, e[2]], 0.068, 6, { col: G }); B.ellipsoid(h, [0.085, 0.085, 0.085], 3, 7, { col: G }); });
    }
    return rig;
  }

  // ---------- props (shared) ----------
  const PROPS = {};
  function buildProps() {
    PROPS.propeller = mesh(() => { B.lathe([[0, 0.12], [0.05, 0.12], [0.06, 0], [0, 0]], 6, { col: '#ff9a1f' }); B.box([0, 0.13, 0], [0.42, 0.015, 0.06], { col: '#ffb43a' }); B.box([0, 0.13, 0], [0.06, 0.015, 0.42], { col: '#ffb43a' }); });
    PROPS.crown = mesh(() => { B.lathe([[0.2, 0.1], [0.21, 0], [0.19, 0], [0.18, 0.1]], 10, { col: '#ffd23a' }); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; B.cone([Math.cos(a) * 0.17, 0.08, Math.sin(a) * 0.17], 0.06, 0.16, 4, { col: '#ffd23a' }); } B.ellipsoid([0, 0.07, 0.2], [0.04, 0.04, 0.02], 2, 6, { col: '#e8342f' }); });
    PROPS.parasol = mesh(() => { B.capsule([0, 0, 0], [0, 1.0, 0], 0.025, 5, { col: '#6a4a2e' }); B.lathe([[0, 1.26], [0.32, 1.21], [0.55, 1.06], [0.62, 0.95], [0, 1.0]], 10, { mat: (m) => (Math.floor(((Math.atan2(m[2], m[0]) + Math.PI) / (Math.PI * 2)) * 10) % 2 ? '#7b3fb0' : PAPER.white) }); });
    PROPS.pickaxe = mesh(() => { B.capsule([0, -0.05, 0], [0, 0.72, 0], 0.036, 5, { col: '#8a5a2b' }); B.capsule([0, 0.72, 0], [0.36, 0.6, 0], 0.055, 5, { col: '#b8c0cc', r2: 0.016 }); B.capsule([0, 0.72, 0], [-0.36, 0.6, 0], 0.055, 5, { col: '#b8c0cc', r2: 0.016 }); });
    PROPS.cane = mesh(() => { B.capsule([0, 0, 0], [0, 0.66, 0], 0.03, 5, { col: '#8a5326' }); B.capsule([0, -0.02, 0], [0.04, -0.1, 0], 0.03, 5, { col: '#8a5326' }); B.capsule([0.04, -0.1, 0], [0.12, -0.08, 0], 0.03, 5, { col: '#8a5326' }); });
    PROPS.tail = mesh(() => { B.capsule([0, 0, 0], [0, -0.15, -0.55], 0.14, 7, { col: '#c47a2c', r2: 0.08 }); for (const t of [0.4, 0.7]) B.ellipsoid([0, -0.15 * t, -0.55 * t], [0.13, 0.05, 0.06], 2, 7, { col: '#5a3418' }); });
    PROPS.turnip = mesh(() => turnipGeo([0, 0.17, 0]));
    // rocket flame: a wide yellow collar at the nozzle over a long orange tail
    PROPS.flame = mesh(() => { B.cone([0, 0, 0], 0.25, -0.3, 7, { col: '#ffe066' }); B.cone([0, 0, 0], 0.2, -0.9, 7, { col: '#ff8a1f' }); }, { ink: false });
    PROPS.tongue = mesh(() => { B.capsule([0, 0, 0], [0, 0, 1], 0.045, 6, { col: '#ff6f9a' }); B.ellipsoid([0, 0, 1], [0.09, 0.09, 0.09], 3, 7, { col: '#ff4f86' }); }, { ink: false });
    PROPS.bag = mesh(() => { B.box([0, 0, 0], [0.16, 0.14, 0.08], { col: '#c88a3a' }); B.box([0, 0.06, 0.085], [0.1, 0.04, 0.01], { col: PAPER.white }); });
    PROPS.hat = mesh(() => { B.lathe([[0, 0.3], [0.16, 0.3], [0.16, 0.04], [0.28, 0.03], [0.28, 0], [0, 0]], 10, { col: '#2b2b2b' }); });
    PROPS.sign = mesh(() => { B.capsule([0, 0, 0], [0, 0.9, 0], 0.03, 5, { col: '#6a4a2e' }); B.box([0, 1.05, 0], [0.3, 0.2, 0.03], { col: '#fff7c2' }); B.box([0, 1.08, 0.035], [0.035, 0.11, 0.01], { col: '#e8342f' }); B.box([0, 0.91, 0.035], [0.035, 0.03, 0.01], { col: '#e8342f' }); });
    // gear for the new Toads; held props run along +y out of the fist
    PROPS.cutlass = mesh(() => {
      B.capsule([0, -0.08, 0], [0, 0.05, 0], 0.035, 5, { col: '#6a4a2e' });
      B.lathe([[0, 0.09], [0.09, 0.08], [0.1, 0.05], [0, 0.05]], 8, { col: '#ffd23a' });
      B.capsule([0, 0.08, 0], [0.03, 0.42, 0], 0.042, 4, { col: '#e8eef6', r2: 0.03 });
      B.capsule([0.03, 0.42, 0], [0.13, 0.63, 0], 0.03, 4, { col: '#e8eef6', r2: 0.008 });
    });
    PROPS.sword = mesh(() => {
      B.capsule([0, -0.1, 0], [0, 0.05, 0], 0.035, 5, { col: '#5a3a8a' });
      B.ellipsoid([0, -0.12, 0], [0.05, 0.05, 0.05], 2, 6, { col: '#ffd23a' });
      B.box([0, 0.08, 0], [0.17, 0.028, 0.04], { col: '#ffd23a' });
      B.capsule([0, 0.1, 0], [0, 0.82, 0], 0.046, 4, { col: '#eef4fb', r2: 0.012 });
    });
    PROPS.shield = mesh(() => sub(() => {
      B.lathe([[0, 0.04], [0.28, 0.035], [0.31, 0], [0.27, -0.02], [0, -0.02]], 14, { col: '#2f6bd8' });
      B.lathe([[0.26, 0.05], [0.315, 0.03], [0.315, 0.005], [0.26, 0.02]], 14, { col: '#ffd23a' });
      B.ellipsoid([0, 0.045, 0], [0.09, 0.03, 0.09], 2, 7, { col: '#ffd23a' });
    }, p => [-p[1], p[0], p[2]], n => [-n[1], n[0], n[2]]));
    PROPS.pan = mesh(() => {
      B.capsule([0, -0.06, 0], [0, 0.3, 0], 0.03, 5, { col: '#3a2a20' });
      B.ellipsoid([0, 0.52, 0], [0.24, 0.24, 0.045], 3, 12, { col: '#2b2b30' });
      B.ellipsoid([0, 0.52, 0.03], [0.19, 0.19, 0.025], 2, 12, { col: '#46464e' });
    });
    PROPS.wand = mesh(() => { B.capsule([0, -0.06, 0], [0, 0.4, 0], 0.025, 5, { col: '#5a3a8a' }); B.ellipsoid([0, 0.4, 0], [0.04, 0.04, 0.04], 2, 6, { col: '#ffd23a' }); });
    PROPS.wandStar = mesh(() => starGeo('#ffe066'), { ink: false });
    PROPS.raygun = mesh(() => {
      B.box([0, 0, 0], [0.035, 0.07, 0.05], { col: '#3a3a44' });
      B.capsule([0, 0.04, 0], [0, 0.34, 0], 0.07, 7, { col: '#d8dde6', r2: 0.045 });
      for (const y of [0.13, 0.22]) B.lathe([[0.075, y + 0.02], [0.088, y], [0.075, y - 0.02]], 8, { col: '#e8343f' });
      B.cone([0, 0.33, 0], 0.05, 0.1, 6, { col: '#5ff0ff' });
    });
    PROPS.pill = mesh(() => { B.capsule([0, 0.02, 0], [0, 0.12, 0], 0.065, 6, { col: '#e8343f' }); B.capsule([0, 0.12, 0], [0, 0.22, 0], 0.065, 6, { col: '#ffd23a' }); });
    PROPS.popgun = mesh(() => {
      B.box([0, 0, 0], [0.03, 0.08, 0.05], { col: '#8a5a2b' });
      B.capsule([0, 0.05, 0.02], [0, 0.32, 0.02], 0.045, 6, { col: '#c8a060' });
      B.lathe([[0.05, 0.33], [0.06, 0.3], [0.05, 0.27]], 7, { c: [0, 0, 0.02], col: '#ffd23a' });
    });
    // Pirate Toad's little deck cannon, barrel along +z (forward) tipped up
    PROPS.minicannon = mesh(() => {
      const c = Math.cos(1.05), s = Math.sin(1.05);
      sub(() => B.lathe([[0, -0.06], [0.15, -0.06], [0.16, 0.08], [0.12, 0.44], [0.145, 0.48], [0.1, 0.5], [0.06, 0.48], [0, 0.48]], 10, { col: '#2b2b34' }),
        p => [p[0], 0.24 + p[1] * c - p[2] * s, p[1] * s + p[2] * c], n => [n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c]);
      for (const sx of [-1, 1]) sub(() => B.lathe([[0, 0.04], [0.17, 0.04], [0.19, 0], [0.17, -0.04], [0, -0.04]], 10, { col: '#8a5a2b' }), p => [0.19 * sx + p[1], 0.17 + p[0], p[2]], n => [n[1], n[0], n[2]]);
      B.box([0, 0.12, -0.06], [0.16, 0.05, 0.2], { col: '#6a4a2e' });
    });
    PROPS.guitar = mesh(() => {
      B.ellipsoid([0, -0.12, 0], [0.24, 0.2, 0.06], 3, 10, { col: '#e8343f' });
      B.ellipsoid([0.04, 0.08, 0], [0.18, 0.15, 0.06], 3, 9, { col: '#e8343f' });
      B.box([0, -0.06, 0.06], [0.12, 0.03, 0.012], { col: '#f6f1e6' });
      B.box([0, 0.5, 0], [0.035, 0.36, 0.025], { col: '#8a5a2b' });
      B.box([0, 0.9, 0], [0.06, 0.07, 0.03], { col: '#26262e' });
    });
    PROPS.lasso = mesh(() => {
      const ring = [];
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push([0.17 + Math.cos(a) * 0.03, 0.12 + Math.sin(a) * 0.03]); }
      B.lathe(ring, 12, { col: '#c8a060' });
    });
    PROPS.parrot = mesh(() => {
      B.ellipsoid([0, 0, 0], [0.13, 0.17, 0.13], 3, 8, { col: '#3fbf4a' });
      B.ellipsoid([0, 0.17, 0.05], [0.1, 0.1, 0.1], 3, 7, { col: '#e8343f' });
      B.ellipsoid([0, 0.15, 0.15], [0.035, 0.05, 0.06], 2, 5, { col: '#ffd23a' });
      for (const sx of [-1, 1]) B.decalAt([0.06 * sx, 0.2, 0.13], [0.4 * sx, 0, 1], [0.02, 0.02, 0.01], PAPER.eye);
      B.capsule([0, -0.12, -0.05], [0, -0.32, -0.12], 0.035, 4, { col: '#2f7cf6', r2: 0.01 });
    });
    PROPS.wing = mesh(() => B.ellipsoid([0.14, 0, 0], [0.15, 0.04, 0.09], 2, 7, { col: '#2f7cf6' }));
    PROPS.anchor = mesh(() => {
      B.ellipsoid([0, 0, 0], [0.07, 0.07, 0.03], 2, 7, { col: '#6a7280' });
      B.capsule([0, 0.05, 0], [0, 0.62, 0], 0.035, 5, { col: '#6a7280' });
      B.box([0, 0.14, 0], [0.16, 0.025, 0.025], { col: '#6a7280' });
      for (const sx of [-1, 1]) { B.capsule([0, 0.62, 0], [0.22 * sx, 0.48, 0], 0.035, 5, { col: '#6a7280' }); B.ellipsoid([0.23 * sx, 0.5, 0], [0.05, 0.08, 0.03], 2, 5, { col: '#6a7280' }); }
    });
    PROPS.spear = mesh(() => { B.capsule([0, -0.4, 0], [0, 0.85, 0], 0.025, 5, { col: '#8a5a2b' }); B.cone([0, 0.85, 0], 0.06, 0.18, 4, { col: '#dfe6ee' }); });
    PROPS.helmet = mesh(() => B.lathe([[0, 0.3], [0.32, 0.26], [0.48, 0.1], [0.52, 0], [0, 0.02]], 12, { col: '#c8d0dc' }));
    PROPS.cart = mesh(() => {
      B.box([0, 0.42, 0], [0.62, 0.26, 0.42], { col: '#8a5a2b' });
      B.box([0, 0.69, 0], [0.66, 0.04, 0.46], { col: '#6a7280' });
      for (const [x, z] of [[-0.4, 0.44], [0.4, 0.44], [-0.4, -0.44], [0.4, -0.44]]) sub(() => B.lathe([[0, 0.08], [0.18, 0.08], [0.2, 0], [0.18, -0.08], [0, -0.08]], 10, { col: '#3a3a44' }), ...toZ(x, 0.18, z));
      for (const [x, z] of [[-0.2, 0.1], [0.15, -0.1], [0.35, 0.15]]) B.ellipsoid([x, 0.74, z], [0.12, 0.09, 0.12], 2, 6, { col: '#ffd23a' });
    });
    // ---- Yoshi gear ----
    // a feathered wing that fans out along +x from the shoulder
    PROPS.ywing = mesh(() => {
      for (let k = 0; k < 4; k++) { const a = -0.15 + k * 0.25, L = 0.42 - k * 0.06; B.ellipsoid([Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.55, -k * 0.02], [L * 0.55, 0.07, 0.035], 2, 7, { col: k % 2 ? '#e6eef8' : '#ffffff', frame: { r: [Math.cos(a), Math.sin(a), 0], u: [-Math.sin(a), Math.cos(a), 0], n: [0, 0, 1] } }); }
      B.ellipsoid([0.04, 0, 0], [0.09, 0.08, 0.06], 2, 6, { col: '#ffffff' });
    });
    PROPS.bow = mesh(() => {
      for (const sx of [-1, 1]) B.ellipsoid([0.1 * sx, 0, 0], [0.11, 0.08, 0.04], 2, 7, { col: '#ff3a8a', frame: { r: [Math.cos(0.3 * sx), Math.sin(0.3 * sx), 0], u: [-Math.sin(0.3 * sx), Math.cos(0.3 * sx), 0], n: [0, 0, 1] } });
      B.ellipsoid([0, 0, 0.01], [0.04, 0.045, 0.045], 2, 6, { col: '#e8262b' });
    });
    PROPS.scarf = mesh(() => {
      B.lathe([[0.27, 0.06], [0.33, 0.04], [0.33, -0.04], [0.27, -0.06]], 12, { col: '#ff5a5a' });
      B.capsule([0.12, 0, 0.27], [0.2, -0.3, 0.3], 0.06, 5, { col: '#ff5a5a', r2: 0.05 });
      for (const y of [-0.12, -0.24]) B.box([0.17, y, 0.31], [0.06, 0.012, 0.012], { col: '#ffffff' });
    });
    PROPS.shades = mesh(() => {
      for (const sx of [-1, 1]) B.ellipsoid([0.15 * sx, 0, 0], [0.13, 0.08, 0.03], 2, 8, { col: '#141418' });
      B.box([0, 0.03, 0], [0.06, 0.012, 0.012], { col: '#141418' });
      for (const sx of [-1, 1]) B.ellipsoid([0.12 * sx, 0.03, 0.03], [0.03, 0.015, 0.01], 2, 5, { col: '#8a8f99' });
    });
    // White Yoshi's halo: a thin glowing ring
    PROPS.haloRing = mesh(() => {
      const ring = [];
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push([0.2 + Math.cos(a) * 0.032, Math.sin(a) * 0.032]); }
      B.lathe(ring, 14, { col: '#ffe680' });
    }, { ink: false });
    PROPS.sprout = mesh(() => {
      B.capsule([0, 0, 0], [0, 0.14, 0], 0.02, 4, { col: '#3f8a2a' });
      for (const sx of [-1, 1]) B.ellipsoid([0.08 * sx, 0.16, 0], [0.09, 0.03, 0.05], 2, 6, { col: '#5fd04a', frame: { r: [Math.cos(0.5 * sx), Math.sin(0.5 * sx), 0], u: [-Math.sin(0.5 * sx), Math.cos(0.5 * sx), 0], n: [0, 0, 1] } });
    });
  }
  function turnipGeo(c) {
    B.ellipsoid(c, [0.16, 0.17, 0.16], 3, 8, { mat: m => (m[1] > c[1] + 0.07 ? '#b780e0' : '#f6f2ff') });
    for (const a of [-0.55, 0, 0.55]) B.ellipsoid([c[0] + Math.sin(a) * 0.08, c[1] + 0.24, c[2]], [0.035, 0.11, 0.025], 2, 5, { col: '#3fae3a', frame: { r: [Math.cos(a), -Math.sin(a), 0], u: [Math.sin(a), Math.cos(a), 0], n: [0, 0, 1] } });
  }
  function mushGeo(capCol, spot, angry) {
    B.lathe([[0, 0.3], [0.17, 0.3], [0.2, 0.12], [0.19, 0], [0, 0]], 8, { col: '#f6ecd6' });
    for (const sx of [-1, 1]) B.decalAt([0.07 * sx, 0.17, 0.19], [0, 0, 1], [0.025, 0.05, 0.015], PAPER.eye);
    if (angry) for (const sx of [-1, 1]) B.decalAt([0.08 * sx, 0.24, 0.185], [0, 0, 1], [0.045, 0.012, 0.01], PAPER.eye, { spin: 0.5 * sx });
    B.lathe([[0, 0.62], [0.22, 0.6], [0.36, 0.52], [0.43, 0.4], [0.42, 0.3], [0.3, 0.27], [0, 0.29]], 10, { col: capCol, seed: 3 });
    for (const [d, a] of [[[0, 0.55, 1], 0.42], [[-1, 0.5, 0.2], 0.36], [[1, 0.5, 0.2], 0.36], [[0, 1, -0.2], 0.3]]) B.spotPatch([0, 0.32, 0], [0.43, 0.3, 0.43], d, a, spot, 8, 0.015, 0.2);
  }
  function starGeo(col) {
    const pts = [], z = 0.08;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.19 : 0.42; pts.push([Math.cos(a) * r, -Math.sin(a) * r + 0.42]); }
    const ctrF = [0, 0.42, z + 0.05], ctrB = [0, 0.42, -z - 0.05], cen = [0, 0.42, 0];
    for (let i = 0; i < 10; i++) {
      const a = pts[i], b = pts[(i + 1) % 10];
      B.addTri(ctrF, [a[0], a[1], z], [b[0], b[1], z], col, cen); B.addTri(ctrB, [b[0], b[1], -z], [a[0], a[1], -z], col, cen);
      B.addTri([a[0], a[1], z], [a[0], a[1], -z], [b[0], b[1], -z], col, cen); B.addTri([a[0], a[1], z], [b[0], b[1], -z], [b[0], b[1], z], col, cen);
    }
    for (const sx of [-1, 1]) B.decalAt([0.08 * sx, 0.46, z + 0.04], [0, 0, 1], [0.03, 0.065, 0.015], PAPER.eye);
  }
  const ITEM = {}, PROJ = {};
  function buildItems() {
    ITEM.mush = mesh(() => mushGeo('#e8342f', PAPER.white));
    ITEM.mini = mesh(() => mushGeo('#2f7cf6', PAPER.white));
    ITEM.poison = mesh(() => mushGeo('#5b2a86', '#2b1a4a', true));
    ITEM.oneup = mesh(() => mushGeo('#2fb24a', PAPER.white));
    ITEM.gold = mesh(() => mushGeo('#f2c23a', '#fff3a0'));
    ITEM.star = mesh(() => starGeo('#ffd23a'));
    ITEM.turnip = mesh(() => turnipGeo([0, 0.17, 0]));
    ITEM.sprout = mesh(() => { for (const a of [-0.5, 0, 0.5]) B.ellipsoid([Math.sin(a) * 0.08, 0.14, 0], [0.04, 0.13, 0.03], 2, 5, { col: '#3fae3a', frame: { r: [Math.cos(a), -Math.sin(a), 0], u: [Math.sin(a), Math.cos(a), 0], n: [0, 0, 1] } }); B.ellipsoid([0, 0.02, 0], [0.12, 0.05, 0.1], 2, 7, { col: '#f6f2ff' }); });
    ITEM.chest = mesh(() => { B.box([0, 0.2, 0], [0.4, 0.2, 0.26], { col: '#b0632b' }); B.box([0, 0.46, 0], [0.42, 0.08, 0.28], { col: '#d0833f' }); B.box([0, 0.32, 0.27], [0.07, 0.09, 0.02], { col: '#ffd23a' }); B.decalAt([-0.24, 0.24, 0.265], [0, 0, 1], [0.08, 0.06, 0.01], '#e8342f'); });
    PROJ.turnip = ITEM.turnip;
    PROJ.bomb = mesh(() => { B.ellipsoid([0, 0, 0], [0.22, 0.22, 0.22], 4, 9, { col: '#26262e' }); B.capsule([0, 0.2, 0], [0.05, 0.34, 0], 0.025, 5, { col: '#c8b48a' }); for (const sx of [-1, 1]) B.decalAt([0.07 * sx, 0.04, 0.2], [0.3 * sx, 0.1, 1], [0.04, 0.07, 0.015], PAPER.white); });
    PROJ.ice = mesh(() => B.ellipsoid([0, 0, 0], [0.24, 0.24, 0.24], 3, 6, { col: '#9fe4ff', jit: 0.05, seed: 5 }));
    PROJ.fire = mesh(() => { B.ellipsoid([0, 0, 0], [0.22, 0.22, 0.22], 3, 6, { col: '#ff7a1a', jit: 0.05, seed: 6 }); }, { ink: false });
    PROJ.boom = mesh(() => { B.box([-0.13, 0, 0], [0.18, 0.05, 0.03], { col: '#3fae3a' }); B.box([0.13, 0, 0], [0.18, 0.05, 0.03], { col: '#2f8a34' }); });
    PROJ.psn = mesh(() => mushGeo('#5b2a86', '#2b1a4a', true));
    PROJ.egg = mesh(() => { B.ellipsoid([0, 0, 0], [0.18, 0.22, 0.18], 4, 9, { col: PAPER.white, seed: 7 }); for (const [d, a] of [[[0.3, 0.6, 1], 0.4], [[-0.8, -0.2, 0.6], 0.4], [[0.6, -0.6, 0.5], 0.35]]) B.spotPatch([0, 0, 0], [0.18, 0.22, 0.18], d, a, '#3dbb3d', 7, 0.01, 0.2); });
    PROJ.coin = mesh(() => { B.lathe([[0, 0.04], [0.17, 0.04], [0.19, 0], [0.17, -0.04], [0, -0.04]], 10, { col: '#ffd23a' }); B.xformTris(B.take(), p => [p[0], p[2], p[1]], n => [n[0], n[2], n[1]]).forEach(t => B.push([t])); });
    PROJ.cloud = mesh(() => { for (const [x, y, r] of [[-1.4, 0.05, 0.75], [-0.5, 0.25, 0.95], [0.5, 0.2, 0.9], [1.4, 0.05, 0.7], [0, -0.1, 0.8]]) B.ellipsoid([x, y, 0], [r, r * 0.6, r * 0.7], 3, 8, { col: PAPER.white, jit: 0.04, seed: x + 3 }); });
    PROJ.halo = mesh(() => B.lathe([[0, 0.05], [0.9, 0.05], [1.0, 0], [0.9, -0.05], [0, -0.05]], 14, { col: '#fff1b8' }));
    PROJ.ball = mesh(() => B.ellipsoid([0, 0, 0], [1, 1, 1], 5, 14, { col: '#ffffff' }), { ink: false, crease: false });
    PROJ.ice3 = mesh(() => B.box([0, 0, 0], [1, 1, 1], { col: '#bdeeff' }), { ink: false, crease: false });
    // ---- the new Toads' projectiles (all centred on the origin) ----
    PROJ.cannon = mesh(() => { B.ellipsoid([0, 0, 0], [0.22, 0.22, 0.22], 4, 10, { col: '#2b2b34', seed: 81 }); B.decalAt([-0.08, 0.09, 0.19], [-0.4, 0.4, 1], [0.06, 0.045, 0.01], '#8a8f99'); });
    PROJ.shuriken = mesh(() => {
      const z = 0.03, pts = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 0.08 : 0.26; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      for (let i = 0; i < 8; i++) {
        const a = pts[i], b = pts[(i + 1) % 8], col = i % 2 ? '#8a93a3' : '#c8d0dc', o = [0, 0, 0];
        B.addTri([0, 0, z + 0.02], [a[0], a[1], z], [b[0], b[1], z], col, o); B.addTri([0, 0, -z - 0.02], [b[0], b[1], -z], [a[0], a[1], -z], col, o);
        B.addTri([a[0], a[1], z], [a[0], a[1], -z], [b[0], b[1], -z], col, o); B.addTri([a[0], a[1], z], [b[0], b[1], -z], [b[0], b[1], z], col, o);
      }
      B.ellipsoid([0, 0, 0], [0.045, 0.045, 0.05], 2, 6, { col: '#3a3a44' });
    });
    PROJ.haze = mesh(() => { for (const [x, y, r] of [[-0.45, 0, 0.5], [0.1, 0.18, 0.6], [0.5, -0.05, 0.45], [0, -0.2, 0.5]]) B.ellipsoid([x, y, 0], [r, r * 0.8, r * 0.7], 3, 8, { col: '#a05ad8', jit: 0.05, seed: 90 + x * 10 }); }, { ink: false, crease: false });
    PROJ.pancake = mesh(() => {
      for (const [y, s] of [[-0.07, 1], [0, 0.95], [0.07, 0.9]]) B.lathe([[0, y + 0.035], [0.22 * s, y + 0.035], [0.25 * s, y], [0.22 * s, y - 0.035], [0, y - 0.035]], 12, { col: '#e8a64a', seed: 91 + y * 9 });
      B.lathe([[0, 0.12], [0.19, 0.115], [0.2, 0.1], [0, 0.1]], 12, { col: '#9a4f1c' });
      B.box([0, 0.14, 0], [0.06, 0.03, 0.06], { col: '#fff1a0' });
    });
    PROJ.star = mesh(() => starGeo('#ffe98a'));
    PROJ.laser = mesh(() => B.capsule([-0.42, 0, 0], [0.42, 0, 0], 0.09, 6, { col: '#9ffcff' }), { ink: false, crease: false });
    PROJ.pill = mesh(() => { B.capsule([-0.14, 0, 0], [0, 0, 0], 0.1, 8, { col: '#e8343f' }); B.capsule([0, 0, 0], [0.14, 0, 0], 0.1, 8, { col: '#ffd23a' }); });
    PROJ.note = mesh(() => {
      const fr = { r: [Math.cos(0.4), Math.sin(0.4), 0], u: [-Math.sin(0.4), Math.cos(0.4), 0], n: [0, 0, 1] };
      B.ellipsoid([-0.08, -0.17, 0], [0.13, 0.095, 0.07], 3, 8, { col: '#ff4f9a', frame: fr });
      B.capsule([0.03, -0.15, 0], [0.03, 0.26, 0], 0.028, 5, { col: '#ff4f9a' });
      B.capsule([0.03, 0.26, 0], [0.19, 0.08, 0], 0.032, 5, { col: '#ff4f9a' });
    });
    PROJ.cork = mesh(() => sub(() => B.lathe([[0, 0.12], [0.07, 0.12], [0.09, -0.1], [0, -0.1]], 8, { col: '#c8935a' }), p => [p[1], -p[0], p[2]], n => [n[1], -n[0], n[2]]));
    PROJ.tumble = mesh(() => {
      const R = B.prng(17);
      for (let k = 0; k < 6; k++) {
        const a = R() * Math.PI, b = R() * Math.PI, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const rot = p => { const y = p[1] * ca - p[2] * sa, z = p[1] * sa + p[2] * ca; return [p[0] * cb - y * sb, p[0] * sb + y * cb, z]; };
        const ring = [];
        for (let q = 0; q <= 6; q++) { const t = (q / 6) * Math.PI * 2; ring.push([0.26 + Math.cos(t) * 0.025, Math.sin(t) * 0.025]); }
        sub(() => B.lathe(ring, 12, { col: k % 2 ? '#b08850' : '#8a6a3a', seed: 30 + k }), rot, rot);
      }
      B.ellipsoid([0, 0, 0], [0.17, 0.17, 0.17], 2, 6, { col: '#9a7640', jit: 0.05, seed: 18 });
    });
    PROJ.boo = mesh(() => {
      B.ellipsoid([0, 0, 0], [0.26, 0.25, 0.25], 4, 10, { col: '#f6f6fb', seed: 95 });
      B.ellipsoid([0, -0.17, -0.16], [0.09, 0.11, 0.08], 2, 6, { col: '#f6f6fb' });
      for (const sx of [-1, 1]) {
        B.ellipsoid([0.25 * sx, -0.03, 0.06], [0.08, 0.055, 0.06], 2, 6, { col: '#f6f6fb' });
        B.decalAt([0.09 * sx, 0.07, 0.235], [0.3 * sx, 0.2, 1], [0.035, 0.06, 0.015], PAPER.eye);
      }
      B.decalAt([0, -0.07, 0.245], [0, -0.2, 1], [0.1, 0.065, 0.015], '#3a1a2a');
      B.decalAt([0, -0.1, 0.255], [0, -0.3, 1], [0.05, 0.03, 0.012], '#ff6f9a');
    });
    PROJ.fist = mesh(() => {
      B.ellipsoid([0.06, 0, 0], [0.2, 0.17, 0.17], 3, 9, { col: '#a4adba', seed: 96 });
      for (const y of [-0.1, -0.035, 0.035, 0.1]) B.ellipsoid([0.23, y, 0.05], [0.05, 0.04, 0.06], 2, 6, { col: '#b6bfcc' });
      B.ellipsoid([0.08, 0.1, 0.14], [0.09, 0.045, 0.05], 2, 6, { col: '#a4adba' });
      sub(() => B.lathe([[0.15, 0.06], [0.17, 0.03], [0.17, -0.03], [0.15, -0.06]], 10, { col: '#ffd23a' }), p => [p[1] - 0.14, p[0], p[2]], n => [n[1], n[0], n[2]]);
      sub(() => B.lathe([[0, 0.05], [0.14, 0.05], [0.12, -0.06], [0, -0.06]], 10, { col: '#727c8c' }), p => [p[1] - 0.22, p[0], p[2]], n => [n[1], n[0], n[2]]);
    });
    PROJ.pie = mesh(() => {
      B.lathe([[0, 0.1], [0.2, 0.1], [0.25, 0.06], [0.22, 0], [0, 0]], 12, { col: '#d8944a' });
      B.ellipsoid([0, 0.11, 0], [0.19, 0.06, 0.19], 2, 10, { col: '#fff6ea' });
      B.ellipsoid([0, 0.18, 0], [0.05, 0.05, 0.05], 2, 6, { col: '#e8343f' });
    });
    // traps sit on the ground (y = 0 at the surface)
    TRAP.soup = mesh(() => {
      B.ellipsoid([0, 0.02, 0], [1.25, 0.05, 0.55], 2, 14, { col: '#e0a040', seed: 97 });
      for (const [x, z, c] of [[-0.5, 0.1, '#e8343f'], [0.3, -0.15, '#3fae3a'], [0.7, 0.2, '#ffd23a'], [-0.1, 0.25, '#f6f1e6'], [-0.8, -0.1, '#3fae3a']]) B.ellipsoid([x, 0.07, z], [0.09, 0.04, 0.09], 2, 6, { col: c });
      sub(() => B.lathe([[0, 0.02], [0.3, 0.02], [0.34, 0.3], [0.38, 0.32], [0.36, 0.36], [0.31, 0.36], [0.29, 0.06], [0, 0.06]], 12, { col: '#8a8f99' }),
        p => [-1.55 + p[1], 0.36 + p[0], p[2]], n => [n[1], n[0], n[2]]);
    });
    TRAP.rune = mesh(() => {
      const ring = (r0, r1, col) => B.lathe([[r0, 0.035], [r1, 0.035], [r1, 0.01], [r0, 0.01]], 28, { col });
      ring(1.02, 1.14, '#ffd23a'); ring(0.74, 0.8, '#d8b0ff');
      const P = [];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; P.push([Math.cos(a) * 0.76, 0.04, Math.sin(a) * 0.76]); }
      for (let k = 0; k < 5; k++) B.capsule(P[k], P[(k + 2) % 5], 0.028, 4, { col: '#ffe98a' });
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; B.box([Math.cos(a) * 0.91, 0.03, Math.sin(a) * 0.91], [0.035, 0.015, 0.035], { col: '#d8b0ff' }); }
    }, { ink: false, crease: false });
    TRAP.amp = mesh(() => {
      B.box([0, 0.5, 0], [0.48, 0.5, 0.28], { col: '#26262e' });
      B.box([0, 0.46, 0.285], [0.42, 0.4, 0.012], { col: '#3a3a44' });
      for (const y of [0.3, 0.64]) sub(() => B.lathe([[0, 0.02], [0.17, 0.02], [0.19, 0], [0.06, -0.05], [0, -0.05]], 12, { col: '#141418' }), ...toZ(0, y, 0.3));
      B.box([0, 0.93, 0.29], [0.44, 0.045, 0.012], { col: '#c0c6d0' });
      for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) B.ellipsoid([x, 0.93, 0.31], [0.025, 0.025, 0.025], 2, 6, { col: '#ffd23a' });
      B.box([0, 1.02, 0], [0.12, 0.025, 0.04], { col: '#8a8f99' });
    });
    ITEM.smash = mesh(smashMushGeo);
    // ---- the Yoshi clan's projectiles ----
    PROJ.gust = mesh(() => { for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 0.08 + k * 0.035; B.ellipsoid([Math.cos(a) * r, Math.sin(a) * r, 0], [0.09 - k * 0.006, 0.05, 0.05], 2, 6, { col: k % 2 ? '#e6f6ff' : '#ffffff' }); } }, { ink: false, crease: false });
    PROJ.rock = mesh(() => { B.ellipsoid([0, 0, 0], [0.24, 0.21, 0.22], 3, 7, { col: '#a08a6a', jit: 0.07, seed: 31 }); B.decalAt([-0.08, 0.1, 0.18], [-0.3, 0.4, 1], [0.06, 0.04, 0.01], '#c8b090'); });
    PROJ.heart = mesh(() => {
      for (const sx of [-1, 1]) B.ellipsoid([0.1 * sx, 0.06, 0], [0.13, 0.13, 0.1], 3, 8, { col: '#ff5aa8' });
      sub(() => B.cone([0, 0, 0], 0.2, 0.26, 8, { col: '#ff5aa8' }), p => [p[0], 0.02 - p[1], p[2] * 0.6], n => [n[0], -n[1], n[2]]);
      B.decalAt([-0.1, 0.12, 0.1], [-0.3, 0.4, 1], [0.04, 0.03, 0.01], '#ffd0e6');
    });
    PROJ.bubble = mesh(() => { B.ellipsoid([0, 0, 0], [0.24, 0.24, 0.24], 4, 10, { col: '#c890ff' }); B.decalAt([-0.09, 0.1, 0.2], [-0.4, 0.4, 1], [0.05, 0.04, 0.01], '#ffffff'); }, { ink: false });
    PROJ.shade = mesh(() => {
      B.ellipsoid([0, 0, 0], [0.22, 0.22, 0.22], 4, 10, { col: '#2b2440', jit: 0.03, seed: 41 });
      for (const sx of [-1, 1]) B.decalAt([0.07 * sx, 0.04, 0.21], [0.3 * sx, 0.1, 1], [0.04, 0.05, 0.012], '#ff5a7a');
    });
    PROJ.lightbolt = mesh(() => { B.capsule([-0.36, 0, 0], [0.36, 0, 0], 0.07, 6, { col: '#fff6c8' }); B.ellipsoid([0.3, 0, 0], [0.12, 0.12, 0.12], 2, 6, { col: '#ffffff' }); }, { ink: false, crease: false });
    PROJ.seed = mesh(() => B.ellipsoid([0, 0, 0], [0.1, 0.065, 0.06], 2, 6, { col: '#2b2216' }));
    PROJ.melon = mesh(() => {
      B.lathe([[0, 0.26], [0.16, 0.22], [0.26, 0.1], [0.27, -0.04], [0.22, -0.16], [0.1, -0.24], [0, -0.25]], 14, { mat: (m, i, j) => (j % 2 ? '#2f8a2a' : '#5fd04a') });
      B.capsule([0, 0.25, 0], [0.03, 0.33, 0], 0.02, 4, { col: '#6a4a2e' });
    });
    TRAP.frost = mesh(() => {
      B.ellipsoid([0, 0.02, 0], [1.2, 0.04, 0.55], 2, 14, { col: '#cdf2ff', seed: 33 });
      for (const [x, z, h] of [[-0.6, 0.1, 0.32], [-0.2, -0.2, 0.42], [0.3, 0.15, 0.36], [0.75, -0.05, 0.28], [0.05, 0.3, 0.25]]) B.cone([x, 0, z], 0.09, h, 5, { col: '#a8e8ff' });
    }, { ink: false });
    TRAP.toxic = mesh(() => {
      B.ellipsoid([0, 0.02, 0], [1.25, 0.05, 0.55], 2, 14, { col: '#7a2aa8', seed: 34 });
      for (const [x, z, r] of [[-0.5, 0.1, 0.1], [0.2, -0.15, 0.08], [0.6, 0.2, 0.12], [-0.1, 0.25, 0.07]]) B.ellipsoid([x, 0.08, z], [r, r, r], 2, 6, { col: '#c890ff' });
    });
  }
  // the Smash Mushroom: a rainbow-capped mushroom with a star badge and a determined look
  const RAINBOW = ['#ff4b4b', '#ff9a1f', '#ffd23a', '#4fd36b', '#3f8cff', '#a05ad8'];
  function flatStar(p, n, r, col, z) {
    const F = B.frameFor(n), pts = [], at = (x, y, d) => v.add(p, v.add(v.mul(F.r, x), v.add(v.mul(F.u, y), v.mul(F.n, d))));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.45 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    const top = at(0, 0, z * 1.6), base = at(0, 0, -z);
    for (let i = 0; i < 10; i++) { const a = pts[i], b = pts[(i + 1) % 10]; B.addTri(top, at(a[0], a[1], z), at(b[0], b[1], z), col, base); }
  }
  function smashMushGeo() {
    B.lathe([[0, 0.3], [0.17, 0.3], [0.2, 0.12], [0.19, 0], [0, 0]], 10, { col: '#fff3c8' });
    for (const sx of [-1, 1]) {
      B.decalAt([0.07 * sx, 0.165, 0.19], [0, 0, 1], [0.03, 0.058, 0.015], PAPER.eye);
      B.decalAt([0.065 * sx, 0.18, 0.205], [0, 0, 1], [0.01, 0.016, 0.008], '#ffffff');
      B.decalAt([0.08 * sx, 0.245, 0.187], [0, 0, 1], [0.048, 0.012, 0.01], PAPER.eye, { spin: -0.4 * sx });
    }
    B.lathe([[0, 0.68], [0.24, 0.66], [0.4, 0.56], [0.48, 0.42], [0.47, 0.3], [0.33, 0.27], [0, 0.29]], 12, { seed: 4, mat: (m, i, j) => (i >= 5 ? '#f6ecd6' : RAINBOW[Math.floor(j / 2) % 6]) });
    for (const d of [[0, 0.62, 1], [0.92, 0.45, 0.3], [-0.92, 0.45, 0.3], [0, 0.5, -1]]) {
      const dd = v.norm(d), n = v.norm([dd[0] / 0.5, dd[1] / 0.39, dd[2] / 0.5]);
      flatStar([dd[0] * 0.5, 0.32 + dd[1] * 0.39, dd[2] * 0.5], n, 0.13, '#ffffff', 0.02);
    }
    B.ellipsoid([0, 0.7, 0], [0.06, 0.05, 0.06], 2, 6, { col: '#ffd23a' });
  }
  // ---- finale and hazard set pieces ----
  const TRAP = {}, FXM = {};
  const rz = a => { const c = Math.cos(a), s = Math.sin(a), f = p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; return [f, f]; };
  function buildFx() {
    FXM.sun = mesh(() => {
      B.ellipsoid([0, 0, 0], [1, 1, 1], 6, 16, { col: '#ffb02e', seed: 98 });
      for (let k = 0; k < 12; k++) sub(() => B.cone([0, 0.92, 0], 0.24, 0.5, 5, { col: k % 2 ? '#ff7a1a' : '#ffd23a' }), ...rz((k / 12) * Math.PI * 2));
      for (const sx of [-1, 1]) { B.decalAt([0.3 * sx, 0.18, 0.93], [0.3 * sx, 0.18, 1], [0.1, 0.16, 0.03], '#5a2a10'); B.decalAt([0.48 * sx, -0.12, 0.86], [0.5 * sx, -0.1, 1], [0.12, 0.07, 0.02], '#ff7a6a'); }
      B.decalAt([0, -0.3, 0.95], [0, -0.3, 1], [0.3, 0.14, 0.03], '#5a2a10', { lat: [-90, 0] });
    }, { ink: false });
    FXM.cake = mesh(() => {
      for (const [r, y, h, col] of [[1.0, 0, 0.45, '#f6c8dc'], [0.74, 0.45, 0.4, '#fbfbf6'], [0.5, 0.85, 0.35, '#f6c8dc']]) {
        B.lathe([[0, y + h], [r, y + h], [r, y], [0, y]], 18, { col, seed: 60 + r * 10 });
        B.lathe([[r - 0.05, y + h + 0.03], [r + 0.04, y + h - 0.02], [r + 0.045, y + h - 0.1], [r, y + h - 0.12]], 18, { col: '#ffffff' });
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; B.ellipsoid([Math.cos(a) * (r - 0.12), y + h + 0.06, Math.sin(a) * (r - 0.12)], [0.07, 0.07, 0.07], 2, 6, { col: '#e8343f' }); }
      }
      for (const [x, z] of [[-0.2, 0.1], [0.15, -0.15], [0.05, 0.25]]) { B.capsule([x, 1.2, z], [x, 1.45, z], 0.035, 5, { col: '#7dbbff' }); B.ellipsoid([x, 1.52, z], [0.045, 0.08, 0.045], 2, 6, { col: '#ffd23a' }); }
    });
    FXM.leaf = mesh(() => { B.ellipsoid([0, 0, 0], [0.32, 0.03, 0.16], 2, 8, { col: '#4fbf3a', seed: 61 }); B.capsule([-0.3, 0, 0], [-0.42, 0, 0], 0.015, 4, { col: '#2f7a24' }); });
    FXM.feather = mesh(() => { B.ellipsoid([0, 0, 0], [0.34, 0.025, 0.11], 2, 8, { col: '#ffffff', seed: 62 }); B.capsule([-0.36, 0, 0], [0.3, 0, 0], 0.012, 4, { col: '#c8d0dc' }); });
    // Wiggler: a flowered head and four body segments with little feet
    FXM.wigHead = mesh(() => {
      B.ellipsoid([0, 0.95, 0], [0.82, 0.8, 0.78], 5, 12, { col: '#ffc21f', seed: 62 });
      B.ellipsoid([0.72, 0.82, 0], [0.32, 0.26, 0.3], 3, 9, { col: '#ff9a1f', seed: 63 });
      for (const sz of [-1, 1]) {
        B.ellipsoid([0.56, 1.2, 0.3 * sz], [0.16, 0.22, 0.12], 3, 8, { col: '#ffffff' });
        B.decalAt([0.7, 1.18, 0.31 * sz], [1, 0, 0.35 * sz], [0.06, 0.1, 0.02], PAPER.eye);
      }
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; B.ellipsoid([Math.cos(a) * 0.18, 1.86, Math.sin(a) * 0.18], [0.14, 0.05, 0.14], 2, 6, { col: '#ff6f9a' }); }
      B.ellipsoid([0, 1.9, 0], [0.09, 0.06, 0.09], 2, 6, { col: '#ffd23a' });
      B.capsule([0, 1.7, 0], [0, 1.84, 0], 0.03, 4, { col: '#3fae3a' });
      for (const sz of [-1, 1]) B.ellipsoid([0.1, 0.12, 0.38 * sz], [0.24, 0.12, 0.16], 2, 7, { col: '#ff7a1a' });
    });
    FXM.wigSeg = mesh(() => {
      B.ellipsoid([0, 0.78, 0], [0.62, 0.64, 0.66], 4, 11, { col: '#ffc21f', seed: 64 });
      for (const sz of [-1, 1]) { B.decalAt([0, 0.86, 0.6 * sz], [0, 0.1, sz], [0.16, 0.16, 0.03], '#ff9a1f'); B.ellipsoid([0, 0.1, 0.34 * sz], [0.2, 0.1, 0.14], 2, 7, { col: '#ff7a1a' }); }
    });
    // a strip of spikes, one sim pixel wide per unit so it can be stretched to a tile
    FXM.spikes = mesh(() => {
      for (let k = 0; k < 6; k++) for (const z of [-0.9, 0, 0.9]) B.cone([-0.42 + k * 0.168, 0, z + (k % 2) * 0.3 - 0.15], 0.12, 0.62, 5, { col: '#dfe6ee' });
    });
    FXM.spikePlate = mesh(() => {
      B.box([0, 0.025, 0], [0.5, 0.03, 1.25], { col: '#8a8f99' });
      for (let k = 0; k < 5; k++) B.box([-0.4 + k * 0.2, 0.06, 1.2], [0.05, 0.012, 0.05], { col: k % 2 ? '#26262e' : '#ffd23a' });
    });
    // a dash-panel arrow lying flat on the road, pointing +x
    FXM.chev = mesh(() => { for (const s of [-1, 1]) B.capsule([-0.28, 0.03, 0.4 * s], [0.22, 0.03, 0], 0.09, 5, { col: '#ffd23a' }); }, { ink: false });
    FXM.ship = mesh(() => {
      B.lathe([[0, 0.9], [1.0, 0.9], [1.05, 0.5], [0.8, 0], [0, 0.05]], 14, { sx: 2.6, sz: 1, col: '#8a5a2b', seed: 65 });
      B.box([0, 0.95, 0], [2.4, 0.06, 0.9], { col: '#c8935a' });
      B.capsule([0, 0.95, 0], [0, 3.4, 0], 0.08, 6, { col: '#6a4a2e' });
      B.box([0.15, 2.4, 0], [0.04, 0.85, 1.0], { col: '#f6f1e6' });
      B.decalAt([0.2, 2.5, 0], [1, 0, 0], [0.34, 0.3, 0.05], '#1f1f2a');
      for (const sz of [-1, 1]) B.decalAt([0.3, 2.55, 0.12 * sz], [1, 0, 0], [0.06, 0.07, 0.02], '#f6f1e6');
      for (const x of [-1.4, -0.4, 0.6, 1.6]) sub(() => B.lathe([[0, 0.1], [0.12, 0.1], [0.13, -0.1], [0, -0.1]], 8, { col: '#26262e' }), ...toZ(x, 0.62, 1.0));
      B.box([-2.2, 0.6, 0], [0.12, 0.12, 0.12], { col: '#8a8f99' });
    });
    FXM.propblade = mesh(() => { B.box([0, 0, 0], [0.06, 1.1, 0.14], { col: '#c8d0dc' }); B.box([0, 0, 0], [0.06, 0.14, 1.1], { col: '#c8d0dc' }); });
  }
  function kartMesh(col) {
    return mesh(() => {
      B.box([0, 0.38, 0], [1.25, 0.22, 0.62], { col });
      B.box([0.9, 0.55, 0], [0.32, 0.12, 0.55], { col });
      B.box([-1.05, 0.62, 0], [0.18, 0.18, 0.55], { col: '#3a3a44' });
      for (const [x, z] of [[-0.8, 0.62], [0.8, 0.62], [-0.8, -0.62], [0.8, -0.62]]) sub(() => B.lathe([[0, 0.14], [0.34, 0.14], [0.36, 0], [0.34, -0.14], [0, -0.14]], 10, { col: '#26262e' }), ...toZ(x, 0.36, z));
      B.ellipsoid([-0.15, 1.2, 0], [0.32, 0.28, 0.3], 4, 9, { col: PAPER.skin });
      B.lathe([[0, 1.95], [0.35, 1.88], [0.55, 1.6], [0.58, 1.38], [0.45, 1.26], [0, 1.3]], 10, { c: [-0.15, 0, 0], col: PAPER.white });
      B.spotPatch([-0.15, 1.5, 0], [0.58, 0.45, 0.58], [0.4, 0.5, 1], 0.5, col, 8, 0.02, 0.1);
      for (const sz of [-1, 1]) B.decalAt([0.1, 1.2, 0.12 * sz], [1, 0, 0.3 * sz], [0.04, 0.08, 0.02], PAPER.eye);
    });
  }
  const KARTS = [];

  // ---------- rigs registry ----------
  const RIGS = {}, MINIONS = {};
  const CROWD = [], YCROWD = [];
  function build() {
    buildProps(); buildItems(); buildFx();
    for (const C of CHARS) RIGS[C.id] = C.yoshi ? yoshiRig(C.id) : toadRig(C.id);
    for (const C of CHARS) if (C.yoshi) YCROWD.push(RIGS[C.id]);
    MINIONS.mail = toadRig('toad', { spot: '#2f9e4a', vest: '#3a6bd6' });
    MINIONS.bank = toadRig('toad', { spot: '#ffc81a', vest: '#6b3fb0' });
    MINIONS.hint = toadRig('toad', { spot: '#e8262b', vest: '#2557d6' });
    MINIONS.guard = toadRig('toad', { spot: '#2f6bd8', vest: '#c8d0dc', trim: '#ffd23a' });
    // the Toad Brigade stampede: Toads of every colour
    for (const [spot, vest] of [['#e8262b', '#2557d6'], ['#2f7cf6', '#f2c12e'], ['#ffc81a', '#1f9e8f'], ['#29b34a', '#8a5a2b'], ['#9b4fd6', '#ff6fae'], ['#ff8a1f', '#3a6bd6']]) CROWD.push(toadRig('toad', { spot, vest }));
    for (const c of ['#e8262b', '#2f7cf6', '#ffc81a', '#29b34a']) KARTS.push(kartMesh(c));
  }

  // ---------- poses ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  // held weapons: GRIP is the blade's angle from the forearm (about pi/2 holds it out in front, 0 points it straight out of the fist)
  const GRIP = 1.75;
  function pose0(fc) {
    return { bob: 0, lean: 0, side: 0, sx: 1, sy: 1, hx: 0, hz: 0, tumble: 0, spin: 0, yaw: (fc || 1) * 0.95, grip: GRIP,
      slY: 0, slZ: 0, slR: 0, srY: 0, srZ: 0, srR: 0, an: [0.05, -0.22, -0.2, 0], af: [0.05, 0.22, -0.2, 0], tongue: 0 };
  }
  const ARMS_UP = (P, a) => { P.an = [0, -a, 0, 0]; P.af = [0, a, 0, 0]; };
  function atkK(f, A) {
    const hb = (A && A.hb[0]) || { a: 6, b: 10 }, t = f.t || 0;
    if (t < hb.a) return { k: -0.35 * (t / hb.a), q: 0, on: false };
    if (t <= hb.b + 2) return { k: 1, q: clamp01((t - hb.a) / Math.max(1, hb.b - hb.a + 2)), on: true };
    return { k: 1 - clamp01((t - hb.b - 2) / Math.max(1, A.dur - hb.b - 2)), q: 1, on: false };
  }
  // the hit progress of a hitbox other than the first (flurry finishers etc.)
  const hbQ = (t, hb) => clamp01((t - hb.a) / Math.max(1, hb.b - hb.a));

  // ---- normal attacks: every move template has its own animation ----
  // c: { k (wind-up < 0 .. strike 1 .. recovery), kp = max(0, k), q (0..1 across the active frames), on, t, fc, A, rig, profile(a) }
  const TPOSE = {
    punch(P, F, c) { P.af = [lerp(0.05, -1.7, c.kp) + Math.min(0, c.k) * -1.4, 0.12, lerp(-0.2, 0, c.kp), 0]; P.an = [0.4 + 0.3 * c.kp, -0.3, -0.5, 0]; P.lean = 0.16 * c.kp; P.grip = 0.35; c.profile(0.35 * c.kp); },
    punch2(P, F, c) { P.an = [lerp(0.05, -1.7, c.kp) + Math.min(0, c.k) * -1.4, -0.12, lerp(-0.2, 0, c.kp), 0]; P.af = [0.45 + 0.3 * c.kp, 0.3, -0.5, 0]; P.lean = 0.18 * c.kp; c.profile(0.15 * c.kp); },
    kick3(P, F, c) { P.srZ = 0.45 * c.kp; P.srY = 0.22 * c.kp; P.srR = -0.7 * c.kp; P.lean = -0.12 * c.kp; P.an = [0.6, -0.6, -0.3, 0]; P.af = [0.6, 0.6, -0.3, 0]; c.profile(0.45 * c.kp); },
    flurry(P, F, c) {
      const on = c.t >= 4 && c.t <= 23, alt = Math.floor(c.t / 2) % 2;
      if (on) { P.af = [alt ? -1.75 : -0.5, 0.12, alt ? 0 : -0.7, 0]; P.an = [alt ? -0.5 : -1.75, -0.12, alt ? -0.7 : 0, 0]; P.side = Math.sin(c.t * 1.7) * 0.05; }
      else { P.af = [lerp(0.05, -1.8, c.t > 23 ? 1 : 0), 0.12, 0, 0]; P.an = [0.4, -0.3, -0.5, 0]; }
      P.lean = 0.22; c.profile(0.3); F.mouthO = on;
    },
    palm3(P, F, c) { P.an = [lerp(0.3, -1.6, c.kp), -0.28, 0, 0]; P.af = [lerp(0.3, -1.6, c.kp), 0.28, 0, 0]; P.lean = 0.28 * c.kp + Math.min(0, c.k) * 0.4; P.slZ = 0.12 * c.kp; P.srZ = -0.14 * c.kp; c.profile(0.3 * c.kp); },
    uppercut3(P, F, c) { P.af = [lerp(0.7, -2.9, c.kp), 0.15, lerp(-0.6, 0, c.kp), 0]; P.an = [0.4, -0.4, -0.5, 0]; P.sy = 1 + 0.1 * c.kp; P.hx = -0.25 * c.kp; P.bob = 0.08 * c.kp; },
    chop(P, F, c) { P.af = [lerp(-2.3, -0.8, c.q), 0.35, -0.2, 0]; P.an = [0.5, -0.3, -0.6, 0]; P.lean = 0.12; c.profile(0.3); },
    slash1(P, F, c) { P.af = [lerp(-2.1, -0.5, c.q), lerp(0.5, 0.1, c.q), 0, 0]; P.grip = 0.9; P.an = [0.4, -0.35, -0.5, 0]; P.lean = 0.12 * c.kp; c.profile(0.3 * c.kp); },
    slash2(P, F, c) { P.af = [lerp(-0.6, -2.0, c.q), lerp(-0.2, 0.9, c.q), 0, 0]; P.grip = 0.9; P.an = [0.4, -0.35, -0.5, 0]; P.lean = 0.1 * c.kp; c.profile(0.25 * c.kp); },
    slash3(P, F, c) { P.af = [lerp(-2.9, -0.4, c.q), 0.1, 0, 0]; P.grip = 0.9; P.an = [0.5, -0.4, -0.4, 0]; P.lean = 0.3 * c.kp; P.sx = 1 + 0.05 * c.kp; P.slZ = 0.14 * c.kp; P.srZ = -0.16 * c.kp; c.profile(0.4 * c.kp); },
    bite(P, F, c) { P.lean = 0.3 * c.kp; P.hx = 0.28 * c.kp - 0.15 * Math.max(0, -c.k) * 3; F.mouthO = c.k < 0 || c.on; c.profile(0.4 * c.kp); P.an = [0.3, -0.4, -0.6, 0]; P.af = [0.3, 0.4, -0.6, 0]; },
    tailjab(P, F, c) { P.spin = -Math.sin(c.q * Math.PI) * 2.6 * (c.fc || 1); P.lean = 0.12; P.an = [-0.4, -0.6, -0.4, 0]; P.af = [-0.4, 0.6, -0.4, 0]; },
    headbutt3(P, F, c) { P.lean = 0.5 * c.kp + Math.min(0, c.k) * 0.6; P.hx = 0.3 * c.kp; P.slZ = 0.16 * c.kp; P.srZ = -0.18 * c.kp; c.profile(0.45 * c.kp); P.an = [0.7, -0.4, -0.3, 0]; P.af = [0.7, 0.4, -0.3, 0]; },
    shove(P, F, c) { P.lean = lerp(0, 0.42, c.kp) + Math.min(0, c.k) * 0.5; P.af = [lerp(0.6, -1.45, c.kp), 0.08, 0, 0]; P.an = [lerp(0.6, -1.25, c.kp), -0.1, 0, 0]; P.slZ = -0.12; P.srZ = 0.18 * c.kp; P.sx = 1 + 0.06 * c.kp; c.profile(0.4 * c.kp); },
    roundhouse(P, F, c) { P.spin = (c.fc || 1) * -c.q * Math.PI * 2; P.srZ = 0.42 * Math.sin(c.q * Math.PI); P.srY = 0.28 * Math.sin(c.q * Math.PI); P.srR = -0.8 * Math.sin(c.q * Math.PI); ARMS_UP(P, 1.3); P.lean = -0.08; },
    dropkick(P, F, c) { P.lean = -0.95 * c.kp; P.slZ = 0.46 * c.kp; P.srZ = 0.5 * c.kp; P.slY = 0.32 * c.kp; P.srY = 0.28 * c.kp; P.slR = -0.9 * c.kp; P.srR = -0.9 * c.kp; P.bob = 0.3 * c.kp; P.an = [1.1, -0.4, 0, 0]; P.af = [1.1, 0.4, 0, 0]; c.profile(0.5 * c.kp); },
    swing(P, F, c) { P.lean = lerp(0, 0.4, c.kp) + Math.min(0, c.k) * 0.5; P.af = [lerp(0.6, -1.45, c.kp), 0.08, 0, 0]; P.an = [lerp(0.6, -1.0, c.kp), -0.2, 0, 0]; P.grip = 0.9; P.slZ = -0.12; P.srZ = 0.18 * c.kp; c.profile(0.4 * c.kp); },
    // the arm lifts by as much as the body leans, so the blade stays level
    thrust(P, F, c) { P.lean = 0.4 * c.kp + Math.min(0, c.k) * 0.4; P.af = [lerp(0.3, -1.55, c.kp) - P.lean * 0.9, 0.05, 0, 0]; P.grip = 0.12; P.an = [0.8 * c.kp, -0.4, -0.3, 0]; P.slZ = 0.22 * c.kp; P.srZ = -0.26 * c.kp; c.profile(0.55 * c.kp); },
    tailwhip(P, F, c) { P.spin = (c.fc || 1) * -c.q * Math.PI * 2; P.lean = 0.1; P.sy = 0.94; ARMS_UP(P, 0.8); },
    tongue(P, F, c) { P.lean = 0.2 * c.kp; F.mouthO = true; P.tongue = c.kp; c.profile(0.55 * c.kp); },
    zapside(P, F, c) { const on = c.t >= 7 && c.t <= 19; P.an = [-1.5, -0.32, -0.3, 0]; P.af = [-1.5, 0.32, -0.3, 0]; P.lean = 0.2; P.side = on ? Math.sin(c.t * 2.3) * 0.05 : 0; c.profile(0.35); F.elemGlow = on ? 0.5 : 0; },
    headbutt(P, F, c) { ARMS_UP(P, lerp(0.3, 1.6, c.kp)); P.hx = -0.55 * c.kp; P.sy = 1 + 0.12 * c.kp; P.bob = 0.08 * c.kp; },
    antiair(P, F, c) { P.af = [lerp(0.2, -2.95, c.kp), 0.15, 0, 0]; P.an = [0.3, -0.4, -0.5, 0]; P.sy = 1 + 0.06 * c.kp; P.hx = -0.25 * c.kp; },
    flipup(P, F, c) { P.tumble = (c.fc || 1) * Math.sin(c.q * Math.PI) * 1.6; P.slY = 0.22 * c.kp; P.srY = 0.22 * c.kp; ARMS_UP(P, 1.8); P.bob = 0.12 * c.kp; },
    upslash(P, F, c) { P.af = [lerp(1.0, -3.0, c.q), 0.12, 0, 0]; P.grip = 1.2; P.sy = 1 + 0.06 * c.kp; P.hx = -0.2 * c.kp; P.an = [0.3, -0.5, -0.4, 0]; },
    tongueup(P, F, c) { P.hx = -1.25 * c.kp; F.mouthO = true; P.tongue = c.kp * 1.05; P.sy = 1 + 0.05 * c.kp; },
    sweep(P, F, c) { P.sy = 0.8; P.sx = 1.14; P.srZ = 0.4 * c.kp; P.srY = 0.04; P.slZ = -0.25 * c.kp; ARMS_UP(P, 1.2); P.grip = 0.4; },
    lowpoke(P, F, c) { P.sy = 0.82; P.sx = 1.08; P.af = [lerp(0.2, -1.0, c.kp), 0.1, 0, 0]; P.grip = 0.15; P.lean = 0.3 * c.kp; P.an = [0.4, -0.4, -0.5, 0]; c.profile(0.5 * c.kp); },
    tailsweep(P, F, c) { P.sy = 0.8; P.sx = 1.1; P.spin = (c.fc || 1) * -Math.sin(c.q * Math.PI) * 2.8; ARMS_UP(P, 0.7); },
    crouchjab(P, F, c) { P.sy = 0.78; P.sx = 1.1; P.af = [lerp(0.2, -1.4, c.kp), 0.1, 0, 0]; P.an = [0.4, -0.4, -0.6, 0]; P.lean = 0.2 * c.kp; c.profile(0.35 * c.kp); },
    haymaker(P, F, c) { P.lean = lerp(-0.15, 0.5, c.kp); P.af = [lerp(1.0, -1.65, c.kp), 0.1, 0, 0]; P.an = [lerp(-0.6, 0.9, c.kp), -0.3, -0.3, 0]; P.sx = 1 + 0.08 * c.kp; P.slZ = 0.18 * c.kp; P.srZ = -0.2 * c.kp; P.grip = 0.3; c.profile(0.5 * c.kp); F.mouthO = c.on; },
    bigslash(P, F, c) { P.af = [lerp(-2.9, -0.45, c.q), 0.08, 0, 0]; P.grip = 0.9; P.an = [0.5, -0.4, -0.4, 0]; P.lean = 0.42 * c.kp; P.slZ = 0.18; P.srZ = -0.2; c.profile(0.45 * c.kp); F.mouthO = c.on; },
    lungethrust(P, F, c) { TPOSE.thrust(P, F, c); P.lean = 0.6 * c.kp; P.af[0] = lerp(0.3, -1.55, c.kp) - P.lean * 0.9; P.slZ = 0.32 * c.kp; P.srZ = -0.36 * c.kp; P.sy = 1 - 0.06 * c.kp; F.mouthO = c.on; },
    capslam(P, F, c) { P.lean = lerp(-0.3, 0.8, c.kp); P.hx = lerp(-0.25, 0.5, c.kp); P.an = [lerp(-0.5, 1.2, c.kp), -0.3, -0.2, 0]; P.af = [lerp(-0.5, 1.2, c.kp), 0.3, -0.2, 0]; P.slZ = 0.2 * c.kp; P.srZ = -0.24 * c.kp; c.profile(0.5 * c.kp); F.mouthO = c.on; },
    energypalm(P, F, c) { P.an = [lerp(0.6, -1.6, c.kp), -0.3, 0, 0]; P.af = [lerp(0.6, -1.6, c.kp), 0.3, 0, 0]; P.lean = lerp(-0.2, 0.3, c.kp); P.slZ = 0.16 * c.kp; P.srZ = -0.2 * c.kp; c.profile(0.4 * c.kp); F.elemGlow = c.on ? 0.6 : 0; F.mouthO = c.on; },
    headbonk(P, F, c) { P.lean = lerp(-0.25, 0.75, c.kp); P.hx = lerp(-0.2, 0.4, c.kp); P.slZ = 0.24 * c.kp; P.srZ = -0.3 * c.kp; P.an = [0.9, -0.4, -0.3, 0]; P.af = [0.9, 0.4, -0.3, 0]; c.profile(0.5 * c.kp); F.mouthO = c.on; },
    rising(P, F, c) { ARMS_UP(P, lerp(0.5, 3.0, c.kp)); P.sy = 1 + 0.14 * c.kp; P.sx = 1 - 0.05 * c.kp; P.hx = -0.45 * c.kp; P.bob = 0.12 * c.kp; P.grip = 1.4; F.mouthO = c.on; },
    skyslash(P, F, c) { P.af = [lerp(1.0, -3.0, c.q), 0.12, 0, 0]; P.grip = 1.1; P.an = [0.3, -0.5, -0.4, 0]; P.sy = 1 + 0.1 * c.kp; P.bob = 0.1 * c.kp; P.hx = -0.25 * c.kp; F.mouthO = c.on; },
    geyser(P, F, c) { ARMS_UP(P, lerp(0.4, 2.9, c.kp)); P.sy = lerp(0.82, 1.16, c.kp); P.sx = lerp(1.1, 0.94, c.kp); P.bob = 0.1 * c.kp; P.hx = -0.35 * c.kp; F.elemGlow = c.on ? 0.6 : 0; F.mouthO = c.on; },
    capbounce(P, F, c) { P.sy = lerp(0.74, 1.22, c.kp); P.sx = lerp(1.14, 0.92, c.kp); P.bob = 0.22 * c.kp; P.hx = -0.45 * c.kp; ARMS_UP(P, lerp(0.4, 1.4, c.kp)); F.mouthO = c.on; },
    tailflip(P, F, c) { P.tumble = (c.fc || 1) * Math.sin(c.q * Math.PI) * 1.5; P.sy = 0.9; ARMS_UP(P, 1.6); F.mouthO = c.on; },
    splitkick(P, F, c) { P.sy = 0.72; P.sx = 1.12; P.slZ = -0.4 * c.kp; P.srZ = 0.4 * c.kp; P.slY = 0.1 * c.kp; P.srY = 0.1 * c.kp; ARMS_UP(P, 1.5); P.hx = 0.1; F.mouthO = c.on; },
    spinsweep(P, F, c) { P.spin = c.t >= 12 && c.t <= 24 ? (c.t - 12) * 0.75 : 0; P.sy = 0.74; P.sx = 1.12; P.slZ = 0.3; P.srZ = -0.3; P.slY = 0.06; ARMS_UP(P, 1.5); P.grip = 0.4; },
    groundslam(P, F, c) { if (c.k < 0) { ARMS_UP(P, 2.9); P.sy = 1.06; P.bob = 0.08; } else { P.an = [-0.5, -0.4, -0.4, 0]; P.af = [-0.5, 0.4, -0.4, 0]; P.sy = 0.8; P.sx = 1.14; P.lean = 0.2 * c.kp; } F.elemGlow = c.on ? 0.5 : 0; F.mouthO = c.on; },
    tailspin(P, F, c) { P.spin = (c.fc || 1) * -c.q * Math.PI * 2; P.sy = 0.82; P.sx = 1.08; ARMS_UP(P, 0.8); },
    spin(P, F, c) { P.spin = (c.t / Math.max(1, c.A.dur)) * Math.PI * 2; ARMS_UP(P, 1.45); P.slY = 0.1; P.srY = 0.1; P.grip = 0.4; },
    sexkick(P, F, c) { P.srZ = 0.45 * c.kp; P.srY = 0.24 * c.kp; P.srR = -0.8 * c.kp; P.slY = 0.16; P.lean = -0.18 * c.kp; ARMS_UP(P, 1.2); c.profile(0.4 * c.kp); },
    aura(P, F, c) { ARMS_UP(P, lerp(0.8, 1.7, c.kp)); P.sx = 1 + 0.08 * c.kp; P.sy = 1 + 0.08 * c.kp; P.slY = 0.14; P.srY = 0.14; F.elemGlow = c.on ? 0.55 : 0; },
    flutterkick(P, F, c) { const on = c.t >= 5 && c.t <= 26, w = Math.sin(c.t * 1.5); P.slZ = on ? w * 0.38 : 0.1; P.srZ = on ? -w * 0.38 : -0.1; P.slY = 0.12; P.srY = 0.12; ARMS_UP(P, 1.4 + (on ? w * 0.25 : 0)); },
    axe(P, F, c) { P.af = [lerp(-2.7, -0.45, c.q), 0.2, 0, 0]; P.an = [0.3, -0.6, -0.3, 0]; P.lean = 0.2; P.slY = 0.08; P.srY = 0.06; P.grip = 0.9; c.profile(0.35 * c.q); },
    meteoraxe(P, F, c) { P.af = [lerp(-2.9, 0.2, c.q), 0.25, 0, 0]; P.an = [lerp(-2.9, 0.2, c.q), -0.25, 0, 0]; P.lean = lerp(-0.2, 0.4, c.q); P.slY = 0.12; P.srY = 0.1; P.grip = 0.9; c.profile(0.3 * c.q); },
    drill(P, F, c) { const on = c.t >= 6 && c.t <= 26; P.lean = on ? 1.1 : 0.3; P.spin = on ? c.t * 1.1 : 0; ARMS_UP(P, 2.7); P.an[0] = -0.6; P.af[0] = -0.6; P.slY = 0.1; P.srY = 0.1; },
    airslash(P, F, c) { TPOSE.axe(P, F, c); P.grip = 0.9; },
    headbonkair(P, F, c) { P.lean = 0.6 * c.kp; P.hx = 0.32 * c.kp; P.slY = 0.12; P.srY = 0.1; P.slZ = -0.1; P.srZ = -0.12; ARMS_UP(P, 1.0); c.profile(0.4 * c.kp); F.mouthO = c.on; },
    backkick(P, F, c) { P.srZ = -0.45 * c.kp; P.srY = 0.16 * c.kp; P.srR = 0.85 * c.kp; P.slZ = 0.08; P.lean = 0.32 * c.kp; P.an = [-0.8, -0.3, -0.3, 0]; P.af = [-0.8, 0.3, -0.3, 0]; c.profile(-0.45 * c.kp); },
    tailbair(P, F, c) { P.spin = (c.fc || 1) * Math.sin(c.q * Math.PI) * 1.2; P.lean = 0.25 * c.kp; ARMS_UP(P, 1.0); P.slY = 0.1; P.srY = 0.1; },
    backslash(P, F, c) { P.af = [lerp(-1.6, 1.5, c.q), 0.2, 0, 0]; P.grip = 0.9; P.an = [-0.4, -0.5, -0.4, 0]; P.lean = 0.15; c.profile(-0.5 * c.kp); },
    flipkick(P, F, c) { P.tumble = (c.fc || 1) * Math.sin(c.q * Math.PI) * 1.4; P.slY = 0.2 * c.kp; P.srY = 0.24 * c.kp; P.srZ = 0.3 * c.kp; ARMS_UP(P, 1.6); },
    scissor(P, F, c) { const w = Math.sin(c.t * 0.9); P.slZ = w * 0.4; P.srZ = -w * 0.4; P.slY = 0.3; P.srY = 0.3; P.lean = -0.35; ARMS_UP(P, 1.2); },
    upslashair(P, F, c) { TPOSE.upslash(P, F, c); P.slY = 0.1; P.srY = 0.1; },
    headbuttup(P, F, c) { P.hx = -0.6 * c.kp; P.sy = 1 + 0.1 * c.kp; ARMS_UP(P, 1.2); P.slZ = -0.18; P.srZ = -0.1; P.slY = 0.1; },
    stomp(P, F, c) { P.slY = -0.14; P.srY = -0.14; P.slZ = 0.05; ARMS_UP(P, 2.4); P.sy = 1 + 0.06 * c.kp; },
    drilldown(P, F, c) { const on = c.t >= 8 && c.t <= 28; P.spin = on ? c.t * 1.1 : 0; P.slY = -0.16; P.srY = -0.16; ARMS_UP(P, 2.6); P.sy = on ? 1.08 : 1; },
    plunge(P, F, c) { P.af = [-0.2, 0.15, 0, 0]; P.grip = 0; P.an = [-0.25, -0.15, 0, 0]; P.slY = -0.12; P.srY = -0.12; P.sy = 1.04; },
    pick(P, F, c) { P.af = [lerp(-2.9, -0.6, c.q), 0.1, 0, 0]; P.an = [0.2, -0.3, -0.3, 0]; P.lean = 0.25 * c.q; c.profile(0.35 * c.q); },
    getup(P, F, c) { TPOSE.punch(P, F, c); },
    throw(P, F, c) { P.af = [lerp(-2.8, -1.1, clamp01(c.t / 6)), 0.2, 0, 0]; P.lean = 0.1; },
  };
  function attackPose(P, F, f, rig) {
    const A = ATK[f.ch] && ATK[f.ch][f.at], K = atkK(f, A), fc = f.fc || 1;
    const c = { k: K.k, kp: Math.max(0, K.k), q: K.q, on: K.on, t: f.t || 0, fc, A: A || { dur: 20, hb: [] }, rig,
      profile: a => { P.yaw = fc * (0.95 + a); } };
    const fn = A && TPOSE[A.tpl];
    if (fn) fn(P, F, c);
    // Toads shout as they strike
    if (rig && rig.kind === 'toad' && K.on && !F.mouthO) F.mouthO = true;
  }
  // holding a smash attack: wind up and tremble, glowing brighter in the fighter's element colour
  function chargePose(P, F, f, fr, rig) {
    const c = clamp01((f.chg || 0) / 60), fc = f.fc || 1, A = ATK[f.ch] && ATK[f.ch][f.at], tpl = A ? A.tpl : '';
    switch (f.at) {
      case 'fsmash':
        P.lean = -0.2; P.sy = 0.92; P.sx = 1.06; P.slZ = 0.12; P.srZ = -0.12; P.yaw = fc * 0.75;
        if (tpl === 'bigslash' || tpl === 'lungethrust') { P.af = [-2.7, 0.15, 0, 0]; P.grip = 0.9; P.an = [0.4, -0.4, -0.4, 0]; }
        else if (tpl === 'capslam' || tpl === 'headbonk') { P.lean = -0.35; P.hx = -0.3; P.an = [-0.6, -0.4, -0.3, 0]; P.af = [-0.6, 0.4, -0.3, 0]; }
        else if (tpl === 'energypalm') { P.an = [0.7, -0.35, -0.6, 0]; P.af = [0.7, 0.35, -0.6, 0]; F.elemGlow = 0.3 + 0.4 * c; }
        else { P.af = [0.9, 0.25, -0.6, 0]; P.an = [-0.5, -0.4, -0.5, 0]; }
        break;
      case 'usmash': P.sy = 0.8; P.sx = 1.12; P.an = [0.5, -0.5, -0.4, 0]; P.af = [0.5, 0.5, -0.4, 0]; P.hx = 0.15; if (tpl === 'skyslash') { P.af = [1.0, 0.3, 0, 0]; P.grip = 1.1; } break;
      default: P.sy = 0.78; P.sx = 1.14; ARMS_UP(P, 0.9); P.an[0] = 0.4; P.af[0] = 0.4; if (tpl === 'groundslam') { ARMS_UP(P, 2.6); P.sy = 0.96; }
    }
    P.side = Math.sin(fr * 1.7) * 0.025 * (0.3 + c);
    const ec = hexF((ELEM_COL[CH[f.ch].elem] || ['#fff2a0'])[0]);
    F.tint = [ec[0], ec[1], ec[2], 0.12 + 0.32 * c * (0.6 + 0.4 * Math.sin(fr * 0.9))];
  }
  function tauntPose(P, F, f, fr) {
    const t = f.t || 0, fc = f.fc || 1;
    switch (f.tn) {
      case 1: { // Booty Shake: turn around, bend over and wiggle
        const w = Math.sin(t * 0.55);
        P.yaw = Math.PI + fc * 0.35; P.lean = 0.42; P.side = w * 0.22; P.bob = Math.abs(w) * 0.04; P.hz = w * 0.12;
        P.an = [-0.5, -0.2, -0.3, 0]; P.af = [-0.5, 0.2, -0.3, 0]; P.slZ = 0.05; P.srZ = 0.05;
        break;
      }
      case 2: // Laugh: lean back holding the belly
        P.hx = -0.3 + Math.sin(t * 0.9) * 0.06; P.lean = -0.15; P.bob = Math.abs(Math.sin(t * 0.45)) * 0.05; F.mouthO = true;
        P.an = [-0.7, -0.6, -1.6, 0]; P.af = [-0.7, 0.6, -1.6, 0];
        break;
      case 3: // Yawn: a big stretch, then nodding off
        if (t < 44) { ARMS_UP(P, lerp(0.3, 2.9, clamp01(t / 16))); P.hx = -0.3; F.mouthO = t > 6; P.sy = 1.05; }
        else { P.hx = 0.3 + Math.sin(t * 0.1) * 0.05; P.hz = 0.12; F.hurt = true; P.sy = 0.97; }
        break;
      case 4: // Backflip
        if (t < 4) { P.sy = 0.8; P.sx = 1.1; ARMS_UP(P, 0.6); }
        else if (t < 32) { P.tumble = fc * clamp01((t - 4) / 26) * Math.PI * 2; ARMS_UP(P, 2.4); P.slY = 0.15; P.srY = 0.15; P.sy = 0.9; }
        else { ARMS_UP(P, 2.7); P.sy = 1.04; }
        break;
    }
  }
  function fsPose(P, F, f, fr) {
    const t = f.t || 0, fc = f.fc || 1, D = (typeof FSDEF !== 'undefined' && FSDEF[f.ch]) || {};
    const h = (fr * 12) % 360, rad = a => ((h + a) * Math.PI) / 180;
    F.tint = [0.6 + 0.4 * Math.cos(rad(0)), 0.6 + 0.4 * Math.cos(rad(-120)), 0.6 + 0.4 * Math.cos(rad(120)), 0.22];
    if (t < 36) { ARMS_UP(P, lerp(0.4, 2.7, clamp01(t / 14))); P.sy = 1 + 0.05 * Math.sin(t * 0.5); P.hx = -0.2; F.mouthO = t > 10; return; }
    switch (D.k) {
      case 'beam': P.af = [-1.6, 0.05, 0, 0]; P.grip = 0.1; P.an = [-1.5, -0.1, -0.2, 0]; P.lean = 0.1; P.yaw = fc * 1.4; F.mouthO = true; break;
      case 'rush': F.cart = 1; P.sy = 0.9; P.an = [-1.2, -0.3, -0.4, 0]; P.af = [-1.2, 0.3, -0.4, 0]; P.lean = 0.2; P.yaw = fc * 1.45; F.mouthO = true; break;
      case 'pulses': if (D.sub) { ARMS_UP(P, 2.6); P.sy = 1 + Math.abs(Math.sin(t * 0.2)) * 0.1; break; }
        F.guitarPlay = 1; P.af = [-1.2, 0.5, -0.8, 0]; P.an = [-0.9 + Math.sin(t * 0.9) * 0.4, -0.2, -0.8, 0]; P.hx = Math.sin(t * 0.45) * 0.3; break;
      case 'lasso': P.af = [-2.95, 0.15, 0, 0]; F.loopUp = 2.2; P.an = [0.2, -0.5, -0.4, 0]; break;
      case 'clone': P.af = [-1.4, 0.4, 0, 0]; P.lean = 0.3; break;
      case 'burst': ARMS_UP(P, 2.5); P.spin = t * 0.2; break;
      default: ARMS_UP(P, 2.6); P.hx = -0.15; F.mouthO = true;
    }
  }
  function specialPose(P, F, f, fr, rig) {
    const t = f.t || 0, fc = f.fc || 1, yo = rig && rig.kind === 'yoshi';
    const throwArm = (a, b, n) => { P.af = [lerp(a, b, clamp01(t / n)), 0.2, 0, 0]; P.an = [0.3, -0.4, -0.4, 0]; };
    const aim = () => { P.af = [-1.55, 0.12, 0, 0]; P.an = [0.3, -0.35, -0.4, 0]; P.grip = 0.2; P.yaw = fc * 1.3; };
    const dash = lean => { P.lean = lean; P.an = [1.1, -0.25, -0.2, 0]; P.af = [1.1, 0.25, -0.2, 0]; P.slZ = -0.12; P.srZ = 0.1; P.yaw = fc * 1.35; };
    // a Yoshi spits from the mouth: rear back, then lunge the head forward
    const spit = at => { const k = clamp01(t / at); P.hx = lerp(-0.2, 0.25, k); P.lean = lerp(-0.1, 0.22, k); F.mouthO = t > at - 4 && t < at + 6; P.yaw = fc * 1.2; P.an = [0.4, -0.4, -0.5, 0]; P.af = [0.4, 0.4, -0.5, 0]; };
    const roll = sp => { P.tumble = -fc * t * sp; P.sy = 0.82; ARMS_UP(P, 0.6); P.slY = 0.2; P.srY = 0.2; };
    const plunge = () => { if (t < 14) { P.tumble = -fc * (t / 14) * Math.PI * 2; P.sy = 0.9; } else { P.slY = -0.12; P.srY = -0.12; ARMS_UP(P, 2.5); } };
    switch (f.sp) {
      // --- the original crew ---
      case 'turnip': if (t < 12) { P.sy = 0.86; P.sx = 1.08; P.af = [-0.6, 0.15, -0.2, 0]; P.an = [-0.5, -0.15, -0.2, 0]; F.props.turnipLow = t > 6; } else throwArm(-2.6, -1.2, 18); break;
      case 'turnips': case 'iceball': case 'fireball': case 'poison': case 'boomerang': throwArm(-2.7, -1.1, 9); break;
      case 'egg': throwArm(-2.7, -1.1, 9); F.mouthO = t < 12; break;
      case 'sporespin': case 'pigspin': P.spin = t * 0.9; ARMS_UP(P, 1.4); break;
      case 'scream': ARMS_UP(P, 1.95); P.an[0] = 0.35; P.af[0] = 0.35; P.hx = -0.32; F.mouthO = true; break;
      case 'scold': P.an = [-2.1, -0.25, 0.3 + Math.sin(fr * 0.8) * 0.3, 0]; P.af = [0.2, 0.3, -0.4, 0]; P.hx = 0.12; F.mouthO = t > 6 && t < 22; break;
      case 'brigade': P.af = [-1.5, 0.1, 0, 0]; F.mouthO = t < 14; break;
      case 'propeller': case 'superjump': case 'cloud': ARMS_UP(P, f.sp === 'superjump' ? 2.9 : 2.5); P.sy = 1.06; F.props.propeller = f.sp === 'propeller'; break;
      case 'parasol': P.an = [0, -2.85, 0, 0]; P.af = [0.1, 0.5, -0.3, 0]; F.props.parasol = clamp01((t - 2) / 8); break; // unfolds as it rises
      case 'float': ARMS_UP(P, 1.6); break;
      case 'boost': P.an = [0.6, -0.5, 0, 0]; P.af = [0.6, 0.5, 0, 0]; F.props.flame = t < 20; break;
      case 'tanooki': ARMS_UP(P, 1.2 + Math.sin(t * 0.6) * 0.5); F.props.tail = true; break;
      case 'flutter': case 'babyflutter': P.slZ = Math.sin(t * 1.3) * 0.3; P.srZ = -Math.sin(t * 1.3) * 0.3; P.slY = 0.1; P.srY = 0.1; ARMS_UP(P, 1.5 + Math.sin(t * 0.9) * 0.3); break;
      case 'pound': case 'yoshipound': case 'magmapound': case 'divebomb': case 'quakestomp': case 'heavystomp': plunge(); if (f.sp === 'divebomb') F.wingFlap = 1; break;
      case 'counter': P.sy = 0.9; P.an = [-1.2, -0.3, -1.0, 0]; P.af = [-1.2, 0.3, -1.0, 0]; if (f.ctrT === 0 && t >= 3 && t <= 32) F.tint = [0.55, 1, 0.6, 0.3]; break;
      case 'pounce': P.lean = 1.1; P.an = [-2.6, -0.2, 0, 0]; P.af = [-2.6, 0.2, 0, 0]; P.slZ = -0.2; P.srZ = -0.25; break;
      case 'crown': ARMS_UP(P, 2.6); break;
      // raise the pickaxe forward and up, clear of the cap
      case 'pickaxe': P.af = [-1.5, 0.1, -0.6, 0]; P.an = [-0.4, -0.9, -0.3, 0]; P.lean = -0.08; F.props.pick = t > 4; break;
      case 'toaddash': dash(0.6); P.hx = 0.25; break;
      case 'pigwhip': P.spin = clamp01((t - 4) / 10) * Math.PI * 2; ARMS_UP(P, 1.3); break;
      case 'headlamp': P.hx = 0.2; P.an = [-2.5, -0.35, 0.9, 0]; P.af = [0.2, 0.3, -0.3, 0]; F.lampHot = t >= 8 && t <= 18; break;
      case 'canehook': P.af = [t < 9 ? lerp(0.2, -1.55, t / 9) : -1.55, 0.1, 0, 0]; P.an = [0.3, -0.3, -0.4, 0]; P.lean = 0.15; P.yaw = fc * 1.3; break;
      case 'iceslide': P.lean = -0.55; P.sy = 0.85; P.slZ = 0.32; P.srZ = 0.38; P.slY = 0.12; P.srY = 0.14; P.an = [0.9, -0.5, 0, 0]; P.af = [0.9, 0.5, 0, 0]; P.yaw = fc * 1.4; break;
      case 'firedash': dash(0.55); F.tint = [1, 0.5, 0.1, 0.3]; break;
      case 'tailwhip': P.spin = clamp01(t / 14) * Math.PI * 2; F.props.tail = true; ARMS_UP(P, 1.1); break;
      case 'haze': P.an = [-1.7, -0.25, -1.3, 0]; P.af = [-1.7, 0.25, -1.3, 0]; F.mouthO = true; P.lean = 0.12; P.yaw = fc * 1.25; break;
      case 'eggroll': F.egg = t < 8 ? t / 8 : 1; P.sy = 0.8; P.slY = 0.1; P.srY = 0.1; ARMS_UP(P, 0.6); break;
      // --- Pirate Toad ---
      case 'cannon': F.minicannon = true; P.af = [t < 14 ? -0.9 : -0.4, 0.3, -0.5, 0]; P.an = [0.2, -0.4, -0.4, 0]; P.lean = t >= 14 && t < 22 ? -0.15 : 0.1; break;
      case 'cutlass': P.lean = 0.45; P.af = [-1.6, 0.05, 0, 0]; P.grip = 0.15; P.an = [0.9, -0.4, 0, 0]; P.slZ = 0.15; P.srZ = -0.2; P.yaw = fc * 1.4; break;
      case 'parrot': ARMS_UP(P, 2.85); F.parrotLift = true; P.slY = 0.06; P.srY = 0.02; break;
      case 'anchor': if (t < 14) { ARMS_UP(P, 2.4); P.sy = 0.92; } else { P.an = [-0.9, -0.3, -0.6, 0]; P.af = [-0.9, 0.3, -0.6, 0]; } F.anchor = true; break;
      // --- Ninja Toad ---
      case 'shuriken': throwArm(-2.4, -0.8, 6); P.yaw = fc * 1.3; break;
      case 'shadowdash': dash(0.75); F.alpha = 0.45; break;
      case 'smokeleap': case 'shadowleap': ARMS_UP(P, 2.6); F.alpha = t < 8 ? 1 - t / 8 : clamp01((t - 8) / 6); break;
      case 'substitute':
        P.an = [-1.25, -0.55, -1.5, 0]; P.af = [-1.25, 0.55, -1.5, 0]; P.sy = 0.94;
        if (f.ctrT === 0 && t >= 3 && t <= 28) F.tint = [0.75, 0.75, 1, 0.3];
        if (f.ctrT > 0) { P.af = [-1.6, 0.1, 0, 0]; P.lean = 0.3; }
        break;
      // --- Knight Toad ---
      case 'shieldbash': P.an = [-1.45, -0.15, -0.1, 0]; F.shieldFwd = 1; P.lean = t >= 4 ? 0.3 : 0; P.af = [0.5, 0.3, -0.4, 0]; P.yaw = fc * 1.3; break;
      case 'lance': P.af = [-1.55, 0.05, 0, 0]; P.grip = 0.12; P.an = [-1.2, -0.2, -0.3, 0]; F.shieldFwd = 1; P.lean = 0.35; P.yaw = fc * 1.4; P.slZ = 0.16; P.srZ = -0.2; break;
      case 'swordspin': P.spin = t * 0.75; P.af = [-1.5, 1.1, 0, 0]; P.grip = 0.4; P.an = [-0.3, -0.6, -0.3, 0]; break;
      case 'swordplant': if (t < 14) { P.af = [-2.9, 0.1, 0, 0]; P.grip = 1.0; P.sy = 0.92; } else { P.af = [-0.25, 0.15, 0, 0]; P.grip = 0; P.an = [-0.25, -0.15, 0, 0]; P.slY = -0.1; P.srY = -0.1; } break;
      // --- Chef Toad ---
      case 'pancake': P.af = [lerp(0.2, -2.4, clamp01(t / 8)), 0.15, 0, 0]; P.grip = 0.6; F.panCake = t < 8; P.an = [0.3, -0.4, -0.4, 0]; break;
      case 'panswing': P.af = [t < 6 ? lerp(-0.6, -2.8, t / 6) : lerp(-2.8, -0.5, clamp01((t - 6) / 5)), 0.15, 0, 0]; P.grip = 0.9; P.lean = t >= 6 ? 0.3 : -0.1; P.yaw = fc * 1.25; break;
      case 'souffle': ARMS_UP(P, 2.9); P.grip = 1.4; P.sy = 1.06; break;
      case 'soup': P.lean = 0.25; P.an = [-1.0, -0.3, -0.6, 0]; P.af = [-1.0, 0.3, -0.6, 0]; P.grip = 1.2; break;
      // --- Wizard Toad ---
      case 'starbolt': aim(); P.grip = 0.3; F.wandGlow = 1; break;
      case 'blink': ARMS_UP(P, 2.4); P.spin = t * 0.5; F.alpha = t < 6 ? 1 - t / 6 : clamp01((t - 6) / 6); break;
      case 'levitate': ARMS_UP(P, 1.25); P.slY = 0.08; P.srY = 0.08; P.bob = Math.sin(t * 0.15) * 0.05; F.wandGlow = 1; break;
      case 'rune': P.af = [-0.55, 0.15, 0, 0]; P.grip = 0.15; P.lean = 0.2; P.an = [-0.6, -0.4, -0.5, 0]; F.wandGlow = 1; break;
      // --- Astro Toad ---
      case 'raygun': aim(); break;
      case 'jetdash': P.lean = 1.25; P.an = [-2.9, -0.2, 0, 0]; P.af = [-2.9, 0.2, 0, 0]; P.slY = 0.1; P.srY = 0.1; P.yaw = fc * 1.45; F.jet = 1; break;
      case 'jetlift': P.an = [0.15, -0.35, -0.2, 0]; P.af = [0.15, 0.35, -0.2, 0]; P.slY = 0.06; P.srY = 0.06; F.jet = t < 22 ? 1 : 0; break;
      case 'gravwell': P.an = [-1.35, -0.45, -0.9, 0]; P.af = [-1.35, 0.45, -0.9, 0]; P.lean = -0.05; F.orb = t <= 38 ? clamp01(t / 36) : 0; break;
      // --- Doctor Toad ---
      case 'vitamin': throwArm(-2.6, -1.0, 8); F.pillHand = t < 8; break;
      case 'bandage': P.af = [t < 8 ? lerp(0.3, -1.55, t / 8) : -1.55, 0.1, 0, 0]; P.an = [0.3, -0.3, -0.4, 0]; P.yaw = fc * 1.3; break;
      case 'pulsehop': ARMS_UP(P, 2.85); P.sy = 1.06; if (t < 10) F.tint = [0.7, 1, 1, 0.35]; break;
      case 'checkup': P.an = [-1.0, -0.15, -1.7, 0]; P.af = [-1.0, 0.15, -1.7, 0]; P.hx = 0.12; F.tint = [0.55, 1, 0.65, 0.18 + 0.12 * Math.sin(fr * 0.3)]; break;
      // --- Rocker Toad ---
      case 'powerchord': F.guitarPlay = 1; P.af = [-1.2, 0.5, -0.8, 0]; P.an = [t < 10 ? -0.3 : -0.9, -0.2, -0.8, 0]; P.hx = Math.sin(t * 0.7) * 0.25; break;
      case 'stagedive': P.lean = 1.1; P.an = [-2.8, -0.35, 0, 0]; P.af = [-2.8, 0.35, 0, 0]; P.slY = 0.14; P.srY = 0.12; P.yaw = fc * 1.45; break;
      case 'ampblast': ARMS_UP(P, 2.7); P.slZ = 0.1; P.srZ = -0.1; P.sy = 1.05; break;
      case 'feedback':
        if (t < 12) { P.lean = 0.25; P.an = [-0.9, -0.3, -0.5, 0]; P.af = [-0.9, 0.3, -0.5, 0]; }
        else { F.guitarPlay = 1; P.af = [-1.2, 0.5, -0.8, 0]; P.an = [-0.9 + Math.sin(t * 0.8) * 0.3, -0.2, -0.8, 0]; }
        break;
      // --- Cowboy Toad ---
      case 'cork': aim(); F.popgun = true; if (t >= 5 && t < 9) P.af[0] = -1.85; break;
      case 'lasso': if (t < 10) { P.af = [-2.9, 0.25, 0, 0]; F.loopUp = 1; } else P.af = [-1.5, 0.15, 0, 0]; P.an = [0.3, -0.35, -0.4, 0]; P.yaw = fc * 1.25; break;
      case 'lassoswing': P.af = [-2.95, 0.15, 0, 0]; F.loopUp = 1.5; P.an = [0.2, -0.5, -0.4, 0]; break;
      case 'tumbleweed': P.af = [lerp(1.0, -0.8, clamp01(t / 10)), 0.2, 0, 0]; P.lean = 0.3; P.yaw = fc * 1.25; break;
      // --- Ghost Toad ---
      case 'boo': P.an = [-1.5, -0.45, -0.5, 0]; P.af = [-1.5, 0.45, -0.5, 0]; F.mouthO = t > 6; P.lean = 0.1; break;
      case 'phase': dash(0.5); F.alpha = 0.4; break;
      case 'spiritfloat': ARMS_UP(P, 1.4); F.alpha = 0.6; break;
      case 'haunt': if (t >= 70) { ARMS_UP(P, 2.4); F.mouthO = true; P.sx = 1.1; } break;
      // --- Robo Toad ---
      case 'rocketfist': P.af = [-1.55, 0.1, 0, 0]; P.an = [0.4, -0.4, -0.4, 0]; P.yaw = fc * 1.35; P.lean = t >= 12 && t < 18 ? -0.2 : 0.1; break;
      case 'turbo': P.lean = 0.5; P.an = [0.9, -0.3, -0.3, 0]; P.af = [0.9, 0.3, -0.3, 0]; P.yaw = fc * 1.4; F.bootJet = t >= 6; break;
      case 'jetboots': ARMS_UP(P, 2.7); F.bootJet = t < 12; break;
      case 'steam': if (t < 12) { P.sy = 0.86; P.sx = 1.08; } else { ARMS_UP(P, 1.6); P.sy = 1.04; } break;
      // --- the Yoshi clan ---
      case 'firespit': spit(7); break;
      case 'rockspit': spit(9); break;
      case 'sporespit': spit(9); break;
      case 'shadowball': spit(12); break;
      case 'lightbolt': spit(6); break;
      case 'seedspit': spit(5); F.mouthO = t < 16 && t % 4 < 2; break;
      case 'heartkiss': P.an = [t < 10 ? -2.2 : -1.4, -0.2, t < 10 ? -1.6 : 0, 0]; P.hx = 0.15; P.lean = 0.12; P.yaw = fc * 1.2; F.mouthO = t > 6 && t < 14; break;
      case 'gust': F.wingFlap = 1; P.lean = t < 8 ? -0.25 : 0.2; P.an = [-1.2, -0.6, -0.3, 0]; P.af = [-1.2, 0.6, -0.3, 0]; P.yaw = fc * 1.25; break;
      case 'frostbreath': P.hx = 0.2; P.lean = 0.18; F.mouthO = t > 5 && t < 20; P.yaw = fc * 1.25; P.side = Math.sin(t * 2) * 0.02; break;
      case 'flamerush': dash(0.62); P.hx = 0.25; F.tint = [1, 0.45, 0.1, 0.3]; F.mouthO = true; break;
      case 'swoop': dash(0.8); F.wingFlap = 1; break;
      case 'stampede': dash(0.55); P.hx = 0.35; break;
      case 'cartwheel': P.tumble = -fc * t * 0.55; ARMS_UP(P, 2.6); P.slY = 0.1; P.srY = 0.1; break;
      case 'iceskate': P.lean = 0.35; P.an = [-0.4, -1.1, -0.2, 0]; P.af = [-0.4, 1.1, -0.2, 0]; P.slZ = 0.18; P.srZ = -0.3; P.srY = 0.12; P.yaw = fc * 1.4; break;
      case 'nightdash': dash(0.72); F.alpha = 0.45; break;
      case 'angeldash': dash(0.55); F.tint = [1, 1, 0.85, 0.3]; break;
      case 'fruitroll': case 'babyroll': roll(0.6); break;
      case 'blazejump': ARMS_UP(P, 2.8); P.sy = 1.08; F.tint = [1, 0.5, 0.1, 0.25]; break;
      case 'springjump': ARMS_UP(P, 2.9); P.sy = t < 6 ? 1.2 : 1.05; P.sx = t < 6 ? 0.88 : 1; break;
      case 'snowtwirl': P.spin = t * 0.8; ARMS_UP(P, 1.5); break;
      case 'halorise': ARMS_UP(P, 2.8); P.sy = 1.06; F.tint = [1, 1, 0.8, 0.25]; break;
      case 'melonhop': ARMS_UP(P, 2.4); P.sy = 1.08; P.spin = t < 12 ? t * 0.5 : 0; break;
      case 'wingflight': F.wingFlap = 1; ARMS_UP(P, 1.0); P.slY = 0.1; P.srY = 0.1; P.lean = 0.15; break;
      case 'heartfloat': ARMS_UP(P, 2.7); F.balloon = 1; P.slY = 0.1; P.srY = 0.08; break;
      case 'bubblelift': ARMS_UP(P, 1.2); F.bubble = 1; P.sy = 0.92; P.slY = 0.15; P.srY = 0.15; break;
      case 'sweetcounter': P.sy = 0.92; P.an = [-1.3, -0.4, -1.3, 0]; P.af = [-1.3, 0.4, -1.3, 0]; if (f.ctrT === 0 && t >= 3 && t <= 30) F.tint = [1, 0.6, 0.85, 0.32]; break;
      case 'venomlash': case 'gobble': P.lean = 0.2; F.mouthO = true; P.tongue = f.ctr >= 0 ? 0.6 : clamp01((t - 4) / 6) * (f.sp === 'gobble' ? 0.6 : 1.4); P.yaw = fc * 1.4; break;
      case 'frostpatch': case 'toxicpuddle': P.hx = clamp01(t / 10) * 0.5; P.lean = 0.28; F.mouthO = t > 6 && t < 16; break;
      case 'holyshine': ARMS_UP(P, 1.7); P.sy = 1.04; if (t >= 2 && t <= 22) F.tint = [1, 1, 0.85, 0.35 + Math.sin(fr * 0.9) * 0.15]; break;
      case 'tantrum': P.spin = t * 0.9; P.an = [Math.sin(t * 1.3) * 1.2, -1.2, 0, 0]; P.af = [-Math.sin(t * 1.3) * 1.2, 1.2, 0, 0]; F.mouthO = true; break;
      case 'fruitbomb': P.hx = lerp(0.2, -0.45, clamp01(t / 10)); F.mouthO = t > 6 && t < 14; P.sy = t < 10 ? 0.9 : 1.04; break;
      case 'fs': fsPose(P, F, f, fr); break;
    }
    if (yo && (f.sp === 'egg' || f.sp === 'turnips')) F.mouthO = t < 12;
  }
  // ---- standing around: each fighter has their own idle ----
  function idlePose(P, F, f, fr, rig) {
    const C = CH[f.ch], s = Math.sin(fr * 0.07 + f.i), b = Math.sin(fr * 0.14 + f.i);
    P.bob = s * 0.025; P.sy = 1 + s * 0.015; P.sx = 1 - s * 0.008; // breathing
    P.hz = Math.sin(fr * 0.013 + f.i * 2) * 0.06; // glancing around
    switch (C.idle) {
      case 'fight': P.bob = Math.abs(b) * 0.05; P.an = [-1.1, -0.25, -1.5, 0]; P.af = [-0.9, 0.25, -1.6, 0]; P.lean = 0.08; P.slZ = 0.1; P.srZ = -0.08; break; // boxer bounce, fists up
      case 'cheer': P.side = Math.sin(fr * 0.12 + f.i) * 0.06; P.an = [0.1, -0.5 - b * 0.1, -0.4, 0]; P.af = [0.1, 0.5 + b * 0.1, -0.4, 0]; break; // a happy sway
      case 'proud': P.an = [0.25, -0.7, -1.9, 0]; P.af = [0.25, 0.7, -1.9, 0]; P.hx = -0.06; break; // hands on hips
      case 'elder': P.lean = 0.12; P.hx = 0.08; P.an = [0.6, -0.15, -1.2, 0]; P.af = [-0.55, 0.15, -0.3, 0]; break; // leaning on the cane
      case 'blade': P.af = [-0.7, 0.2, -0.5, 0]; P.grip = 1.4; P.an = [-0.9, -0.2, -0.6, 0]; F.shieldFwd = 0.5; break; // sword and shield ready
      case 'ninja': P.sy = 0.92; P.lean = 0.18; P.an = [-0.6, -0.35, -1.4, 0]; P.af = [0.6, 0.3, -0.2, 0]; P.slZ = 0.14; P.srZ = -0.12; break; // low stance
      case 'mage': P.af = [-0.7 + Math.sin(fr * 0.09) * 0.2, 0.2, -0.8, 0]; P.grip = 1.2; F.wandGlow = Math.sin(fr * 0.09) > 0.6 ? 1 : 0; break; // twirling the wand
      case 'groove': { const g = Math.abs(Math.sin(fr * 0.18)); P.hx = g * 0.16; P.bob = g * 0.03; P.an = [-0.4, -0.3, -0.9, 0]; break; } // nodding to the beat
      case 'float': P.an = [-0.5, -0.5, -0.6, 0]; P.af = [-0.5, 0.5, -0.6, 0]; P.side = Math.sin(fr * 0.05) * 0.05; break;
      case 'robot': P.bob = 0; P.sy = 1; P.sx = 1; P.hz = Math.round(Math.sin(fr * 0.02) * 2) * 0.06; P.an = [0, -0.2, -0.3, 0]; P.af = [0, 0.2, -0.3, 0]; break; // stiff, head clicking round
      case 'dino': P.side = Math.sin(fr * 0.1 + f.i) * 0.04; P.bob = Math.abs(Math.sin(fr * 0.1)) * 0.03; P.an = [-0.3, -0.3, -0.8, 0]; P.af = [-0.3, 0.3, -0.8, 0]; P.hx = Math.sin(fr * 0.05) * 0.05; break; // shifting weight
      default: P.an = [0.08, -0.25, -0.25, 0]; P.af = [0.08, 0.25, -0.25, 0];
    }
  }
  function runPose(P, F, f, fr) {
    const C = CH[f.ch], heavy = C.gait === 'heavy', ph = (fr * 0.42 + f.i * 1.7) * (heavy ? 0.72 : 1), s = Math.sin(ph), c = Math.cos(ph);
    P.lean = 0.2; P.bob = Math.abs(s) * 0.07; P.sy = 1 + Math.abs(c) * 0.04 - 0.02;
    P.slY = Math.max(0, c) * 0.13; P.slZ = s * 0.24; P.slR = -s * 0.5; P.srY = Math.max(0, -c) * 0.13; P.srZ = -s * 0.24; P.srR = s * 0.5;
    P.an = [s * 0.95, -0.2, -0.55, 0]; P.af = [-s * 0.95, 0.2, -0.55, 0];
    switch (C.gait) {
      case 'ninja': P.lean = 0.5; P.an = [1.3, -0.15, -0.1, 0]; P.af = [1.3, 0.15, -0.1, 0]; P.hx = 0.2; break; // arms swept back
      case 'float': P.lean = 0.3; P.slY = P.srY = 0; P.slZ = P.srZ = 0; P.slR = P.srR = 0; P.bob = Math.sin(ph * 0.5) * 0.04; P.an = [0.6, -0.4, -0.3, 0]; P.af = [0.6, 0.4, -0.3, 0]; break;
      case 'heavy': P.lean = 0.12; P.bob = Math.abs(s) * 0.1; P.side = s * 0.05; P.an = [s * 0.6, -0.25, -0.5, 0]; P.af = [-s * 0.6, 0.25, -0.5, 0]; break; // stomping
      case 'dino': P.lean = 0.3; P.hx = -0.1; P.bob = Math.abs(s) * 0.06; P.side = s * 0.04; P.an = [s * 0.4 - 0.4, -0.3, -0.8, 0]; P.af = [-s * 0.4 - 0.4, 0.3, -0.8, 0]; break; // a scampering trot
    }
  }
  // anim: render-side extras from drawFighter { vy (estimated), flip, land, lag }
  function targetPose(f, fr, rig, anim) {
    rig = rig || RIGS[f.ch];
    anim = anim || {};
    const P = pose0(f.fc), F = { mouthO: false, hurt: false, props: {}, tint: null };
    switch (f.st) {
      case 'idle': idlePose(P, F, f, fr, rig); break;
      case 'run': runPose(P, F, f, fr); break;
      case 'air': {
        const vy = anim.vy || 0;
        if (anim.flip > 0) {
          // the double jump: Toads flip, Yoshis pedal their legs, Ghost Toad spins
          const k = 1 - anim.flip / 20;
          if (rig && rig.kind === 'yoshi') { P.slZ = Math.sin(fr * 1.4) * 0.35; P.srZ = -Math.sin(fr * 1.4) * 0.35; P.slY = 0.12; P.srY = 0.12; ARMS_UP(P, 1.6); }
          else if (rig && rig.ghost) { P.spin = k * Math.PI * 2; ARMS_UP(P, 1.4); }
          else { P.tumble = -(f.fc || 1) * k * Math.PI * 2; P.sy = 0.86; ARMS_UP(P, 1.0); P.slY = 0.22; P.srY = 0.22; }
        } else if (vy < -3) { P.sy = 1.07; P.sx = 0.95; P.slY = 0.02; P.srY = 0.06; P.slZ = 0.04; P.an = [-0.5, -0.8, -0.4, 0]; P.af = [-0.5, 0.8, -0.4, 0]; }
        else if (vy > 3) { const w = Math.sin(fr * 0.45); P.slY = 0.16; P.slZ = 0.12; P.slR = -0.4; P.srY = 0.08; P.srZ = -0.1; P.srR = 0.3; P.an = [-0.3, -1.6 - w * 0.25, -0.5, 0]; P.af = [-0.3, 1.6 + w * 0.25, -0.5, 0]; }
        else { P.slY = 0.1; P.slZ = 0.08; P.slR = -0.4; P.srY = 0.06; P.srZ = -0.06; P.srR = 0.3; P.an = [-0.3, -1.0, -0.6, 0]; P.af = [-0.3, 1.0, -0.6, 0]; }
        break;
      }
      case 'help': ARMS_UP(P, 2.5); P.an[1] -= Math.sin(fr * 0.5) * 0.3; P.af[1] += Math.sin(fr * 0.5) * 0.3; P.slY = 0.1; P.srY = 0.1; F.hurt = (fr % 60) < 30; break;
      case 'land': P.sy = 0.86; P.sx = 1.12; break;
      case 'crouch': P.sy = 0.74; P.sx = 1.1; P.lean = 0.14; P.hx = 0.12; P.bob = -0.02; P.an = [0.35, -0.38, -0.7, 0]; P.af = [0.35, 0.38, -0.7, 0]; P.slZ = 0.06; P.srZ = -0.05; break;
      case 'shield':
        P.sy = 0.92; P.sx = 1.05; P.an = [-1.1, -0.3, -1.2, 0]; P.af = [-1.1, 0.3, -1.2, 0];
        if (rig && rig.shield) { P.an = [-1.35, -0.15, -0.1, 0]; F.shieldFwd = 1; }
        break;
      case 'dodge': P.spin = (f.t || 0) * 0.6; break;
      case 'ledge': ARMS_UP(P, 2.85); P.slY = -0.05; P.slZ = 0.12 + Math.sin(fr * 0.1) * 0.08; P.srZ = 0.1 - Math.sin(fr * 0.1) * 0.08; P.lean = 0.15; break;
      case 'stun': P.hz = Math.sin(fr * 0.2) * 0.25; P.an = [0, -0.3, 0, 0]; P.af = [0, 0.3, 0, 0]; F.hurt = true; break;
      case 'hit':
        F.hurt = true; F.mouthO = true;
        if (f.hs > 18) { ARMS_UP(P, 1.8); P.slY = 0.12; P.slZ = 0.1; P.srY = 0.12; P.srZ = -0.1; P.tumble = fr * 0.35 * (f.fc || 1); }
        else { P.hx = -0.3; P.lean = -0.25; P.an = [-0.6, -1.0, -0.4, 0]; P.af = [-0.6, 1.0, -0.4, 0]; P.slZ = 0.14; P.srZ = 0.06; } // a quick flinch
        break;
      case 'atk': attackPose(P, F, f, rig); break;
      case 'charge': chargePose(P, F, f, fr, rig); break;
      case 'taunt': tauntPose(P, F, f, fr); break;
      case 'spc': specialPose(P, F, f, fr, rig); break;
    }
    // landing squash, and a little head nod
    if (anim.land > 0 && (f.st === 'idle' || f.st === 'run' || f.st === 'land' || f.st === 'crouch')) { const k = anim.land / 8; P.sy *= 1 - 0.16 * k; P.sx *= 1 + 0.1 * k; P.hx += 0.14 * k; }
    // the head lags behind sudden starts and stops
    if (anim.lag) P.hz += anim.lag;
    // a held turnip rides on top of the head, arms up, Super Mario Bros. 2 style
    if (f.hold) { ARMS_UP(P, 2.6); F.props.turnip = true; }
    // carrying the pickaxe: hold it out in front, head down, so it stays visible below the cap
    if (f.pick > 0) { F.props.pick = true; if (!f.hold && (f.st === 'idle' || f.st === 'run' || f.st === 'air' || f.st === 'land')) P.af = [-0.75, 0.2, -0.45, 0]; }
    if (f.glide > 0 && f.st !== 'spc') {
      if (f.ch === 'blue') { F.props.propeller = true; ARMS_UP(P, 1.2); }
      else if (f.ch === 'toadsworth') { F.props.parasol = true; P.an = [0, -2.85, 0, 0]; }
      else ARMS_UP(P, 1.6);
    }
    if (f.pe > 0) F.props.crown = true;
    if (f.ch === 'toadsworth') F.props.cane = !F.props.parasol;
    // Ghost Toad never quite touches the ground
    if (rig && rig.ghost) P.bob += 0.1 + Math.sin(fr * 0.07 + f.i) * 0.05;
    // blinking now and then
    F.blink = !F.hurt && f.st !== 'hit' && f.st !== 'stun' && (fr + f.i * 61) % 230 < 6;
    return { P, F };
  }
  const SMOOTH = ['bob', 'lean', 'side', 'sx', 'sy', 'hx', 'hz', 'slY', 'slZ', 'slR', 'srY', 'srZ', 'srR', 'yaw', 'tongue', 'grip'];
  function smoothPose(mem, P, rate) {
    if (!mem) return P;
    for (const k of SMOOTH) P[k] = mem[k] + (P[k] - mem[k]) * rate;
    for (const a of ['an', 'af']) for (let i = 0; i < 4; i++) P[a][i] = mem[a][i] + (P[a][i] - mem[a][i]) * rate;
    return P;
  }

  // ---------- drawing a rig ----------
  const HELD = { cutlass: 1, sword: 1, pan: 1, wand: 1, raygun: 1 };
  const jitter = () => 0.8 + Math.random() * 0.5;
  function drawRig(rig, M0, P, F, fr, o) {
    const p = rig.parts, al = F.alpha != null ? F.alpha : 1;
    if (al <= 0.02) return;
    const d = al < 0.99 ? { tint: F.tint, alpha: al } : { tint: F.tint };
    const Mb = M4.chain(M0, M4.T(p.body.pivot[0], p.body.pivot[1], p.body.pivot[2]), M4.RX(P.lean), M4.RZ(P.side));
    G3.draw(p.body.mesh, Mb, d);
    if (F.props.tail) G3.draw(PROPS.tail, M4.chain(Mb, M4.T(0, 0.08, -0.34), M4.RX(Math.sin(fr * 0.5) * 0.4)), d);
    if (F.props.flame) G3.draw(PROPS.flame, M4.chain(Mb, M4.T(0, 0.02, -0.46), M4.RX(0.45), M4.S(1, jitter(), 1)), { self: 1 });
    // Astro Toad's jetpack nozzles
    if (F.jet) for (const sx of [-1, 1]) G3.draw(PROPS.flame, M4.chain(Mb, M4.T(0.14 * sx, -0.1, -0.5), M4.S(0.45, 0.6 * jitter(), 0.45)), { self: 1 });
    const hp = v.sub(p.head.pivot, p.body.pivot), hs = rig.hs || 1;
    const Mh = M4.chain(Mb, M4.T(hp[0], hp[1], hp[2]), M4.RX(P.hx), M4.RZ(P.hz), M4.S(hs, hs, hs));
    G3.draw(p.head.mesh, Mh, d);
    // nobody blinks behind sunglasses (Rocker Toad, Black Yoshi)
    const eyes = F.hurt && p.eyesHurt ? p.eyesHurt : p.eyes, L0 = rig.look || {}, blink = F.blink && !F.hurt && L0.hat !== 'shades' && !L0.shades;
    const eo = rig.robo ? Object.assign({ self: 1 }, d) : d;
    // a Yoshi blinks by closing green (or pink, or...) eyelids over the eyes
    if (rig.kind === 'yoshi') { if (blink && p.lids) G3.draw(p.lids.mesh, Mh, d); else G3.draw(eyes.mesh, Mh, eo); }
    else G3.draw(eyes.mesh, blink ? M4.chain(Mh, M4.T(0, rig.eyeY, 0), M4.S(1, 0.12, 1), M4.T(0, -rig.eyeY, 0)) : Mh, eo);
    const mo = F.mouthO && p.mouthO ? p.mouthO : p.mouth;
    if (mo) G3.draw(mo.mesh, Mh, d);
    if (p.lamp) G3.draw(p.lamp.mesh, Mh, { self: 1, tint: F.lampHot ? [1, 1, 0.85, 0.7] : null });
    if (rig.kind === 'toad') {
      if (F.props.propeller) G3.draw(PROPS.propeller, M4.chain(Mh, M4.T(CAP_TOP[0], CAP_TOP[1] - 0.03, CAP_TOP[2]), M4.RY(fr * 0.9)), d);
      if (F.props.crown) G3.draw(PROPS.crown, M4.chain(Mh, M4.T(CAP_TOP[0], CAP_TOP[1] - 0.06, CAP_TOP[2]), M4.RX(-0.1)), d);
    } else {
      // each Yoshi's own look
      const L = rig.look || {};
      if (L.wings) { const fl = F.wingFlap ? Math.sin(fr * 0.75) * 0.7 : Math.sin(fr * 0.08) * 0.12; for (const sx of [-1, 1]) G3.draw(PROPS.ywing, M4.chain(Mb, M4.T(0.17 * sx, 0.52, -0.27), M4.RY(sx > 0 ? 0.5 : Math.PI - 0.5), M4.RZ(0.35 + fl)), d); }
      // a big bow on top of the head, so it shows whichever way she faces
      if (L.bow) G3.draw(PROPS.bow, M4.chain(Mh, M4.T(0, 0.93, -0.1), M4.RX(-0.35), M4.S(1.35, 1.35, 1.35)), d);
      if (L.scarf) G3.draw(PROPS.scarf, M4.chain(Mb, M4.T(0, 0.52, 0.02)), d);
      if (L.shades) G3.draw(PROPS.shades, M4.chain(Mh, M4.T(0, 0.72, 0.385)), d);
      if (L.halo) G3.draw(PROPS.haloRing, M4.chain(Mh, M4.T(0, 1.08 + Math.sin(fr * 0.06) * 0.02, -0.04), M4.RX(-0.25)), { self: 0.9, alpha: al < 0.99 ? al : undefined });
      if (L.sprout) G3.draw(PROPS.sprout, M4.chain(Mh, M4.T(0, 0.9, -0.02), M4.RZ(Math.sin(fr * 0.08) * 0.15)), d);
      if (F.props.crown) G3.draw(PROPS.crown, M4.chain(Mh, M4.T(0, 0.92, 0)), d);
    }
    if (F.props.turnip) { const tp = rig.kind === 'toad' ? CAP_TOP : [0, 0.98, 0.02]; G3.draw(PROPS.turnip, M4.chain(Mh, M4.T(tp[0], tp[1] - 0.04, tp[2]), M4.S(1.5, 1.5, 1.5)), d); }
    if (P.tongue > 0.02) G3.draw(PROPS.tongue, M4.chain(Mh, M4.T(0, 0.2, 0.55), M4.S(1, 1, P.tongue * 2.6)), d);
    // Ghost Toad floats on a wisp instead of feet
    if (!rig.ghost) for (const [nm, y, z, r] of [['shoeL', P.slY, P.slZ, P.slR], ['shoeR', P.srY, P.srZ, P.srR]]) {
      const s = p[nm]; G3.draw(s.mesh, M4.chain(M0, M4.T(s.pivot[0], s.pivot[1] + y, s.pivot[2] + z), M4.RX(r)), d);
      if (F.bootJet) G3.draw(PROPS.flame, M4.chain(M0, M4.T(s.pivot[0], s.pivot[1] + y - 0.08, s.pivot[2] + z), M4.S(0.55, 0.75 * jitter(), 0.55)), { self: 1 });
    }
    for (const k of ['N', 'F']) {
      const ua = p['uarm' + k], A = k === 'N' ? P.an : P.af, sp = v.sub(ua.pivot, p.body.pivot);
      const Mu = M4.chain(Mb, M4.T(sp[0], sp[1], sp[2]), M4.RZ(A[1]), M4.RX(A[0]));
      G3.draw(ua.mesh, Mu, d);
      const Mf = M4.chain(Mu, M4.T(0, -rig.LU, 0), M4.RZ(A[3]), M4.RX(A[2]));
      G3.draw(p['farm' + k].mesh, Mf, d);
      const Mhand = M4.chain(Mf, M4.T(0, rig.handY - 0.02, 0), M4.RZ(Math.PI));
      if (k === 'F') {
        if (F.props.pick) G3.draw(PROPS.pickaxe, Mhand, d);
        if (F.props.cane) G3.draw(PROPS.cane, M4.chain(Mf, M4.T(0, rig.handY, 0), M4.RZ(Math.PI), M4.RX(-0.1)), d);
        const ws = rig.prop === 'pan' ? 1.6 : 1.45, Mw = M4.chain(Mhand, M4.RX(P.grip), M4.S(ws, ws, ws));
        if (HELD[rig.prop] && !F.props.pick) {
          G3.draw(PROPS[rig.prop], Mw, d);
          if (rig.prop === 'wand') G3.draw(PROPS.wandStar, M4.chain(Mw, M4.T(0, 0.44, 0), M4.RZ(fr * 0.08), M4.S(0.26, 0.26, 0.26), M4.T(0, -0.42, 0)), { self: F.wandGlow ? 1 : 0.45 });
          if (F.panCake) G3.draw(PROJ.pancake, M4.chain(Mw, M4.T(0, 0.52, 0.06), M4.RX(Math.PI / 2), M4.S(0.8, 0.8, 0.8)), d);
        }
        if (F.popgun) G3.draw(PROPS.popgun, Mw, d);
        if (F.pillHand) G3.draw(PROPS.pill, M4.chain(Mhand, M4.T(0, 0.02, 0)), d);
      } else {
        if (F.props.parasol) { const w = 0.2 + 0.8 * (F.props.parasol === true ? 1 : F.props.parasol); G3.draw(PROPS.parasol, M4.chain(Mhand, M4.S(w, 1, w)), d); }
        // Knight Toad's shield rides the near forearm, turning to face forward when raised
        if (rig.shield) { const s = F.shieldFwd || 0; G3.draw(PROPS.shield, M4.chain(Mf, M4.T(lerp(-0.12, 0, s), rig.handY + lerp(0.08, -0.12, s), 0.02), M4.RZ((s * Math.PI) / 2)), d); }
      }
      if (k === 'F' && F.props.turnipLow) G3.draw(PROPS.turnip, M4.chain(Mhand, M4.T(0, -0.05, 0), M4.S(1.35, 1.35, 1.35)), d);
    }
    // body-mounted gear (Mb is centred on the body pivot, half a unit above the feet)
    if (rig.prop === 'guitar') G3.draw(PROPS.guitar, F.guitarPlay ? M4.chain(Mb, M4.T(0.02, 0.12, 0.48), M4.RZ(-1.2), M4.S(0.72, 0.72, 0.72)) : M4.chain(Mb, M4.T(0.02, 0.15, 0.47), M4.RZ(-0.85), M4.S(0.72, 0.72, 0.72)), d);
    if (rig.prop === 'lasso' && !F.loopUp) G3.draw(PROPS.lasso, M4.chain(Mb, M4.T(-0.44 * rig.wide, -0.02, 0.06), M4.RZ(Math.PI / 2), M4.S(0.85, 0.85, 0.85)), d);
    // a raised Toad hand disappears under the big cap, so the lasso loop twirls above the hat
    if (F.loopUp && rig.kind === 'toad') { const s = F.loopUp * 2.2; G3.draw(PROPS.lasso, M4.chain(Mh, M4.T(CAP_TOP[0], CAP_TOP[1] + 0.35, CAP_TOP[2]), M4.RY(fr * 0.45), M4.S(s, 1, s)), d); }
    if (rig.parrot) {
      if (F.parrotLift) {
        const Mp = M4.chain(M0, M4.T(0, 3.15 + Math.sin(fr * 0.5) * 0.05, 0), M4.S(2.3, 2.3, 2.3)), fl = Math.sin(fr * 0.8) * 0.7;
        G3.draw(PROPS.parrot, Mp, d);
        G3.draw(PROPS.wing, M4.chain(Mp, M4.T(0.1, 0.05, 0), M4.RZ(fl)), d);
        G3.draw(PROPS.wing, M4.chain(Mp, M4.T(-0.1, 0.05, 0), M4.RY(Math.PI), M4.RZ(fl)), d);
      } else G3.draw(PROPS.parrot, M4.chain(Mh, M4.T(CAP_TOP[0], CAP_TOP[1] + 0.5, CAP_TOP[2] - 0.05), M4.S(0.9, 0.9, 0.9)), d); // perched on the tricorn
    }
    if (F.anchor) G3.draw(PROPS.anchor, M4.chain(M0, M4.T(0, 0.75, 0.48), M4.RZ(Math.PI), M4.S(1.8, 1.8, 1.8)), d);
    if (F.minicannon) G3.draw(PROPS.minicannon, M4.chain(M0, M4.T(0, 0, 0.62), M4.S(1.4, 1.4, 1.4)), d);
    if (F.cart) G3.draw(PROPS.cart, M4.chain(M0, M4.RY(Math.PI / 2), M4.T(0, -0.1, 0), M4.S(1.5, 1.5, 1.5)));
    if (F.orb) G3.draw(PROJ.ball, M4.chain(M0, M4.T(0, 0.95, 0.7), M4.S(0.12 + 0.22 * F.orb, 0.12 + 0.22 * F.orb, 0.12 + 0.22 * F.orb)), { tint: [0.35, 0.12, 0.6, 0.85], self: 0.6 });
    // Pink Yoshi's heart balloon, Purple Yoshi's bubble
    if (F.balloon) { G3.draw(PROJ.heart, M4.chain(M0, M4.T(0, 2.75 + Math.sin(fr * 0.2) * 0.05, 0.1), M4.RZ(Math.sin(fr * 0.1) * 0.15), M4.S(2.6, 2.6, 2.6)), { self: 0.2 }); }
    if (F.bubble) G3.draw(PROJ.bubble, M4.chain(M0, M4.T(0, 1.0, 0.05), M4.S(4.6, 4.6, 4.6)), { alpha: 0.32 * al, self: 0.3 });
    // Astro Toad's glass helmet goes on last so it can be see-through
    if (p.dome) G3.draw(p.dome.mesh, Mh, { alpha: 0.26 * al, self: 0.35 });
    if (o && o.extraProp) o.extraProp(Mb, Mh);
  }
  function rootMatrix(X, Y, P, scale) {
    return M4.chain(M4.T(X, Y, 0), M4.T(0, 1.0 * scale, 0), M4.RZ(P.tumble), M4.T(0, -1.0 * scale, 0), M4.RY(P.yaw + P.spin), M4.S(scale * P.sx, scale * P.sy, scale * P.sx), M4.T(0, P.bob, 0));
  }
  // fighter from a sim snapshot -> world
  const MEM = {};
  function hueTint(fr, a, speed) { const h = (fr * (speed || 14)) % 360, r = x => ((h + x) * Math.PI) / 180; return [0.5 + 0.5 * Math.cos(r(0)), 0.5 + 0.5 * Math.cos(r(-120)), 0.5 + 0.5 * Math.cos(r(120)), a]; }
  function drawFighter(f, fr) {
    const rig = RIGS[f.ch];
    if (!rig) return;
    const C = CH[f.ch], mem = MEM[f.i] && MEM[f.i].ch === f.ch ? MEM[f.i] : null;
    // render-side animation memory: estimated speed, double-jump flip, landing squash, head lag
    const A = mem ? mem.A : { flip: 0, land: 0, lag: 0 }, vy = mem ? f.y - mem.y : 0, vx = mem ? f.x - mem.x : 0;
    if (mem) {
      if (f.gi >= 0 && mem.gi < 0) A.land = 8;
      if (f.gi < 0 && f.jl != null && mem.jl != null && f.jl < mem.jl) A.flip = 20;
      if (f.st === 'hit' || f.st === 'dead') A.flip = 0;
      A.lag += (Math.max(-0.3, Math.min(0.3, -(vx - mem.vx) * 0.06)) - A.lag) * 0.25;
    }
    const { P, F } = targetPose(f, fr, rig, { vy, flip: A.flip, land: A.land, lag: A.lag });
    if (A.flip > 0) A.flip--;
    if (A.land > 0) A.land--;
    // attacks and hits snap into place so the strike shows on its active frames; everything else eases
    smoothPose(mem ? mem.P : null, P, f.st === 'atk' ? 0.72 : f.st === 'hit' || f.st === 'spc' ? 0.55 : f.st === 'taunt' ? 0.3 : 0.38);
    MEM[f.i] = { ch: f.ch, P: JSON.parse(JSON.stringify(P)), x: f.x, y: f.y, vx, gi: f.gi, jl: f.jl, A };
    if (F.elemGlow) { const ec = hexF((ELEM_COL[C.elem] || ['#ffffff'])[0]); F.tint = [ec[0], ec[1], ec[2], F.elemGlow * 0.5]; }
    if (f.fs && f.st !== 'spc') F.tint = hueTint(fr, 0.3, 10); // holding the Smash Mushroom's power
    if (f.inv > 0 && f.rp <= 0 && Math.floor(fr / 3) % 2 === 0) F.tint = [1, 1, 1, 0.45];
    if (f.star > 0) F.tint = hueTint(fr, 0.4);
    if (f.psn > 0) F.tint = [0.6, 0.3, 0.8, 0.22 + Math.sin(fr * 0.3) * 0.1];
    if (f.frz > 0) F.tint = [0.7, 0.92, 1, 0.5];
    if (f.prT > 0) F.tint = [0.8, 0.97, 1, 0.65 * (f.prT / 16)]; // a parry flashes white-blue
    if (rig.ghost && F.alpha == null) F.alpha = 0.88;
    if (f.hide > 0) F.alpha = 0.07; // haunting: all but invisible
    if (f.fade != null && f.fade < 1) F.alpha = (F.alpha == null ? 1 : F.alpha) * f.fade; // title parade fading in and out
    const unit = ((C.h * 1.05) * PX) / rig.h, scale = unit * (f.sc || 1) * (f.pe > 0 ? 1.06 : 1);
    const X = f.x * PX, Y = -f.y * PX;
    // Yoshi's Egg Roll: curl up inside a big rolling egg
    if (F.egg) {
      const s = 6 * F.egg * (f.sc || 1);
      G3.draw(PROJ.egg, M4.chain(M4.T(X, Y + 0.22 * s, 0.1), M4.RZ(-(f.t || 0) * 0.22 * (f.fc || 1)), M4.S(s, s, s)), F.egg < 1 ? { alpha: 0.5 + 0.5 * F.egg } : null);
      if (F.egg >= 1) return;
    }
    drawRig(rig, rootMatrix(X, Y, P, scale), P, F, fr);
    if (f.rp > 0) G3.draw(PROJ.halo, M4.chain(M4.T(X, Y - 0.06, 0), M4.S(1.15, 1, 0.7)), { self: 0.3 });
    if (f.st === 'shield') { const r = (f.h * 0.62 * PX) * (0.45 + 0.55 * ((f.shd || 100) / 100)); G3.draw(PROJ.ball, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(r, r, r)), { alpha: rig.shield ? 0.16 : 0.32, tint: [...hexF(SLOT_COLORS[f.i]), 0.6], self: 0.4 }); }
    if (f.frz > 0) G3.draw(PROJ.ice3, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(f.w * 0.75 * PX, f.h * 0.6 * PX, 0.9)), { alpha: 0.4, self: 0.5 });
  }
  function hexF(h) { const c = B.hex(h); return [c[0] / 255, c[1] / 255, c[2] / 255]; }
  // a small Toad Brigade helper (projectile kind 'minion')
  function drawMinion(p, fr) {
    const rig = MINIONS[p.sub] || MINIONS.mail;
    const P = pose0(p.fc), F = { props: {}, mouthO: false, hurt: false, tint: null };
    if (p.sub === 'mail') { const s = Math.sin(fr * 0.5 + p.id), c = Math.cos(fr * 0.5 + p.id); P.lean = 0.2; P.slZ = s * 0.24; P.srZ = -s * 0.24; P.slY = Math.max(0, c) * 0.12; P.srY = Math.max(0, -c) * 0.12; P.an = [s, -0.2, -0.5, 0]; P.af = [-s, 0.2, -0.5, 0]; }
    if (p.sub === 'bank') { P.af = [-1.2 - Math.max(0, Math.sin(fr * 0.22)) * 0.6, 0.2, 0, 0]; }
    if (p.sub === 'hint') { P.af = [-0.4, 0.6, -0.6, 0]; }
    const scale = ((62 * 0.78 * PX) / rig.h);
    drawRig(rig, rootMatrix(p.x * PX, -p.y * PX, P, scale), P, F, fr, {
      extraProp: (Mb, Mh) => {
        if (p.sub === 'mail') G3.draw(PROPS.bag, M4.chain(Mb, M4.T(-0.3, 0.2, -0.2)));
        if (p.sub === 'bank') G3.draw(PROPS.hat, M4.chain(Mh, M4.T(CAP_TOP[0], CAP_TOP[1] - 0.05, CAP_TOP[2])));
        if (p.sub === 'hint') G3.draw(PROPS.sign, M4.chain(Mb, M4.T(0.55, -0.45, 0.2)));
      },
    });
  }
  // the Toad Brigade Stampede / Royal Guard Charge / Yoshi Stampede: a crowd running across the stage
  const CROWD_Z = [0.9, -0.7, 0.3, -1.3, 1.5, -0.2, 0.7];
  function drawCrowd(e, sy, fr) {
    const guards = e.sub === 'guards', yo = e.sub === 'yoshis', fronts = e.both ? [[e.x, e.dir], [e.x2, -e.dir]] : [[e.x, e.dir]];
    for (const [x0, dir] of fronts) for (let k = 0; k < 7; k++) {
      const rig = guards ? MINIONS.guard : yo ? YCROWD[(k * 3 + (dir > 0 ? 0 : 5)) % YCROWD.length] : CROWD[(k + (dir > 0 ? 0 : 3)) % CROWD.length];
      if (!rig) continue;
      const ph = fr * 0.55 + k * 1.3, s = Math.sin(ph), c = Math.cos(ph), x = x0 - dir * (k * 30 + (k % 2) * 10);
      const P = pose0(dir), F = { props: {}, mouthO: k % 3 === 0, hurt: false, tint: null };
      P.lean = 0.28; P.bob = Math.abs(s) * 0.12; P.slY = Math.max(0, c) * 0.15; P.slZ = s * 0.28; P.slR = -s * 0.5; P.srY = Math.max(0, -c) * 0.15; P.srZ = -s * 0.28; P.srR = s * 0.5;
      P.an = guards ? [-0.9, -0.2, -0.4, 0] : [s * 1.1, -0.2, -0.55, 0]; P.af = guards ? [-1.2, 0.2, -0.3, 0] : [-s * 1.1, 0.2, -0.55, 0]; P.yaw = dir * 1.25;
      const scale = ((yo ? 66 : 62) * 0.86 * PX) / rig.h;
      drawRig(rig, M4.chain(M4.T(0, 0, CROWD_Z[k]), rootMatrix(x * PX, -sy * PX, P, scale)), P, F, fr, guards ? {
        extraProp: (Mb, Mh) => {
          G3.draw(PROPS.helmet, M4.chain(Mh, M4.T(CAP_TOP[0], CAP_TOP[1] - 0.5, CAP_TOP[2]), M4.S(1.7, 1.2, 1.7)));
          G3.draw(PROPS.spear, M4.chain(Mb, M4.T(0.45, 0.15, 0.3), M4.RX(1.1)));
        },
      } : null);
    }
  }
  // portrait / attract helpers draw a rig at an arbitrary pose without a sim fighter
  function drawPreview(id, M0, fr, st) {
    const rig = RIGS[id]; if (!rig) return;
    const f = { ch: id, i: 9, fc: 1, st: st || 'idle', t: fr, gi: 0 }, { P, F } = targetPose(f, fr, rig);
    if (id === 'toadsworth') F.props.cane = true;
    F.blink = false;
    drawRig(rig, M4.chain(M0, M4.RY(P.spin), M4.T(0, P.bob, 0)), Object.assign(P, { yaw: 0 }), F, fr);
  }
  return { PX, build, RIGS, ITEM, PROJ, PROPS, KARTS, TRAP, FXM, drawFighter, drawMinion, drawCrowd, drawRig, drawPreview, rootMatrix, pose0, targetPose, MEM, hexF, hueTint, CAP_TOP };
})();
