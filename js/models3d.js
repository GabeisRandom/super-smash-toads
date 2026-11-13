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
      // Samurai Toad's kabuto: a lacquered brow band, a flared neck guard round the back and a golden crest
      case 'kabuto': {
        band('#2b2b3a', 1.42, 1.62, CAP_R[0]);
        const ang = [];
        for (let q = 0; q <= 12; q++) ang.push(Math.PI / 2 + 0.75 + ((Math.PI * 2 - 1.5) * q) / 12);
        [[1.42, 0.9], [1.3, 0.98], [1.18, 1.05]].forEach(([y, r], k) => B.lathe([[r - 0.13, y + 0.11], [r, y - 0.02], [r - 0.02, y - 0.07], [r - 0.15, y + 0.05]], 0, { angles: ang, col: k % 2 ? '#c8202a' : '#2b2b3a' }));
        for (const sx of [-1, 1]) B.capsule([0.06 * sx, 1.6, 0.86], [0.36 * sx, 2.2, 0.76], 0.042, 4, { col: '#ffd23a', r2: 0.016 });
        B.ellipsoid([0, 1.58, 0.88], [0.09, 0.09, 0.045], 2, 7, { col: '#ffd23a' });
        break;
      }
      // Viking Toad: a riveted steel band and two big curved horns
      case 'horned':
        band('#a9b2c0', 1.44, 1.64, CAP_R[0]);
        for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; B.ellipsoid([Math.cos(a) * 0.872, 1.54, Math.sin(a) * 0.872], [0.035, 0.035, 0.035], 2, 5, { col: '#6a7280' }); }
        for (const sx of [-1, 1]) {
          const P = [[0.8 * sx, 1.62, 0.08], [1.08 * sx, 1.72, 0.1], [1.24 * sx, 1.98, 0.06], [1.2 * sx, 2.28, -0.02]];
          for (let q = 0; q < 3; q++) B.capsule(P[q], P[q + 1], 0.13 - q * 0.035, 6, { col: '#f3ead2', r2: 0.095 - q * 0.035 });
        }
        break;
      // Pharaoh Toad's nemes: the striped cloth is the cap itself; a gold brow band, the rearing cobra and a tail at the back
      case 'nemes':
        band('#ffd23a', 1.4, 1.5, CAP_R[0] - 0.01);
        B.capsule([0, 1.5, 0.86], [0, 1.68, 0.9], 0.04, 5, { col: '#ffd23a' });
        B.ellipsoid([0, 1.7, 0.905], [0.065, 0.05, 0.035], 2, 6, { col: '#ffd23a' });
        B.capsule([0, 1.42, -0.8], [0, 1.0, -0.9], 0.11, 6, { col: '#ffd23a', r2: 0.06 });
        break;
      // Gladiator Toad's bronze helmet: a band, a little brim and a red brush crest from front to back
      case 'galea':
        band('#c8903a', 1.44, 1.62, CAP_R[0]);
        B.lathe([[0.84, 1.47], [0.99, 1.43], [0.98, 1.4], [0.84, 1.42]], 18, { col: '#c8903a' });
        for (let q = 0; q <= 9; q++) {
          const a = -1.15 + (q / 9) * 2.3, y = CAP_C[1] + (CAP_R[1] + 0.05) * Math.cos(a), z = (CAP_R[2] + 0.05) * Math.sin(a);
          B.ellipsoid([0, y + 0.06, z], [0.075, 0.14, 0.12], 2, 6, { col: q % 2 ? '#e8343f' : '#c8202a', seed: 120 + q });
        }
        break;
      // Muslim Toad's kufi: a round white cap with an embroidered band
      case 'kufi':
        B.lathe([[0, T + 0.08], [0.3, T + 0.06], [0.5, T - 0.08], [0.66, T - 0.26], [0.71, T - 0.34], [0, T - 0.34]], 16, { col: '#fbfbf6', seed: 77 });
        band(trim, T - 0.33, T - 0.25, 0.69);
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; B.decalAt([Math.cos(a) * 0.62, T - 0.17, Math.sin(a) * 0.62], [Math.cos(a), 0.6, Math.sin(a)], [0.04, 0.04, 0.015], L.vest); }
        break;
      // Emilia Toad's white hood: two pointed cat ears on top, lavender with a white band near the tip
      case 'hood':
        for (const sx of [-1, 1]) sub(() => {
          B.cone([0, 0, 0], 0.2, 0.5, 5, { col: '#9a6ad8' });
          B.lathe([[0.075, 0.34], [0.085, 0.31], [0.1, 0.27], [0.112, 0.24]], 5, { col: '#fbfaff' });
        }, p => { const c = Math.cos(sx * 0.42), s = Math.sin(sx * 0.42); return [0.42 * sx + p[0] * c + p[1] * s, T - 0.17 + -p[0] * s + p[1] * c, -0.08 + p[2]]; },
        n => { const c = Math.cos(sx * 0.42), s = Math.sin(sx * 0.42); return [n[0] * c + n[1] * s, -n[0] * s + n[1] * c, n[2]]; });
        break;
      // Hasidic Toad's wide-brimmed black hat
      case 'blackhat':
        B.lathe([[0, T - 0.04], [0.92, T - 0.1], [1.02, T - 0.04], [1.0, T - 0.14], [0, T - 0.16]], 18, { col: '#141418' });
        B.lathe([[0, T + 0.52], [0.3, T + 0.55], [0.46, T + 0.48], [0.5, T + 0.1], [0.52, T - 0.1], [0, T - 0.1]], 14, { col: '#1c1c22' });
        band('#3a3a44', T - 0.08, T + 0.08, 0.52);
        break;
    }
  }
  // Beatrice's little gold crown sits on top of her cap
  function tiaraGeo() {
    const T = CAP_T;
    B.lathe([[0.2, T + 0.08], [0.23, T - 0.03], [0.2, T - 0.05], [0.18, T + 0.06]], 12, { col: '#ffd23a' });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3; B.cone([Math.cos(a) * 0.2, T + 0.06, Math.sin(a) * 0.2], 0.06, 0.14, 4, { col: '#ffd23a' }); }
    B.ellipsoid([0, T + 0.02, 0.23], [0.04, 0.04, 0.02], 2, 6, { col: '#ff4fa0' });
  }
  // a finer cap outline for a striped cap (Pharaoh Toad's nemes), so the stripes come out thin
  const CAP_FINE = [90, 78, 66, 54, 42, 30, 18, 6, -2, -16, -30].map(a => [CAP_R[0] * Math.cos((a * Math.PI) / 180), CAP_C[1] + CAP_R[1] * Math.sin((a * Math.PI) / 180)]).concat([[0.55, 1.2], [0.3, 1.29], [0, 1.33]]);
  // the radius of the shirt and the vest at height y (for things that lie on them: a tie, a sash, a name tag)
  const profR = (pr, y) => { for (let k = 0; k < pr.length - 1; k++) { const [r0, y0] = pr[k], [r1, y1] = pr[k + 1]; if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1); } return pr[pr.length - 1][0]; };
  const SHIRT_P = [[0, 0.97], [0.19, 0.95], [0.31, 0.87], [0.385, 0.73], [0.395, 0.58], [0.35, 0.46], [0, 0.43]], VEST_P = [[0.21, 0.965], [0.35, 0.885], [0.435, 0.735], [0.445, 0.585], [0.4, 0.495], [0.39, 0.462]];
  // a ringed spiral curl hanging down from `top` (Beatrice's drills, the Hasidic Toad's payot)
  function curl(top, len, r, col, tip) {
    const prof = [[0, 0]], n = 6;
    for (let k = 1; k <= n; k++) { const q = k / n; prof.push([r * (1 - q * 0.55) * (k % 2 ? 1 : 0.7), -len * q * 0.92]); }
    prof.push([0, -len]);
    B.lathe(prof, 7, { c: top, mat: m => (tip && m[1] < top[1] - len * 0.72 ? tip : col) });
  }
  function toadRig(id, override) {
    const C = CH[id], L = Object.assign({}, C.look, override || {});
    const rig = { kind: 'toad', id, parts: {}, LU: 0.24, handY: -0.27, h: 2.3, wide: C.wide || 1, toadette: !!L.pigtails, captain: !!L.lamp, old: !!L.old,
      ghost: !!L.ghost, robo: !!L.robo, prop: L.prop || null, shield: L.shield || false, look: L,
      blade: ['cutlass', 'sword', 'pan', 'wand'].includes(L.prop), parrot: L.hat === 'tricorn', eyeY: 0.123, mount: L.mount || null };
    const wd = rig.wide, vest = L.vest, trim = paper(L.trim || '#f4c430'), capCol = paper(L.cap), spot = paper(L.spot);
    const skin = rig.robo ? '#a4adba' : rig.ghost ? '#e2ebfb' : PAPER.skin, metal = '#7a8494';
    part(rig, 'body', BODY_PIV, () => {
      if (rig.toadette) B.lathe([[0, 0.6], [0.36, 0.58], [0.46, 0.42], [0.54, 0.24], [0.52, 0.18], [0, 0.18]], 12, { sx: wd, sz: wd, jit: 0.02, seed: 3, mat: m => (m[1] < 0.25 ? PAPER.white : '#ff7ab4') });
      else if (L.robe || L.coat) B.lathe([[0, 0.6], [0.36, 0.58], [0.47, 0.42], [0.54, 0.2], [0.52, 0.15], [0, 0.15]], 12, { sx: wd, sz: wd, jit: 0.02, seed: 3, mat: m => (m[1] < 0.22 ? trim : L.coat ? '#fbfbf8' : L.robeCol || vest) });
      else B.lathe([[0, 0.56], [0.33, 0.54], [0.42, 0.44], [0.43, 0.32], [0.35, 0.21], [0, 0.18]], 12, { sx: wd, sz: wd, jit: 0.02, seed: 3, col: rig.robo ? metal : L.pants || PAPER.pants });
      B.lathe(SHIRT_P, 12, { sx: wd, sz: wd, jit: 0.01, seed: 4, col: rig.robo ? '#8e98a8' : L.shirt || PAPER.shirt });
      const a0 = Math.PI / 2 + 0.3, a1 = Math.PI / 2 + Math.PI * 2 - 0.3, n = 10, tw = 0.14, angles = [a0];
      for (let k = 0; k <= n; k++) angles.push(a0 + tw + ((a1 - a0 - 2 * tw) * k) / n);
      angles.push(a1);
      const last = angles.length - 2;
      B.lathe([[0.21, 0.965], [0.35, 0.885], [0.435, 0.735], [0.445, 0.585], [0.4, 0.495], [0.39, 0.462]], 0, { angles, sx: wd, sz: wd, jit: 0.01, seed: 14, center: [0, 0.7, 0],
        mat: (m, i, j) => (L.sleeves && i === 0 ? L.sleeves : L.stripes ? (i % 2 || j === 0 || j === last ? trim : vest) : i === 4 || j === 0 || j === last ? trim : vest) });
      // ---- the newer Toads' outfits ----
      const onShirt = (x, y, sz, col, lift) => { const r = profR(SHIRT_P, y) * wd + (lift || 0.012), z = Math.sqrt(Math.max(0.001, r * r - x * x)); B.decalAt([x, y, z], [x, 0, z], sz, col); };
      const onVest = (x, y, sz, col) => { const r = profR(VEST_P, y) * wd + 0.014, z = Math.sqrt(Math.max(0.001, r * r - x * x)); B.decalAt([x, y, z], [x, 0, z], sz, col); };
      // Samurai Toad's shoulder plates: stacked lacquered lames
      if (L.sode) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) B.box([0.45 * sx * wd, 0.9 - k * 0.075, 0.02], [0.1, 0.036, 0.17], { col: k % 2 ? trim : vest });
      // Pharaoh Toad's broad collar of gold and lapis
      if (L.collar) B.lathe([[0.2, 1.0], [0.33, 0.95], [0.43, 0.87], [0.475, 0.8], [0.42, 0.82], [0.2, 0.93]], 16, { sx: wd, sz: wd, mat: (m, i) => (i % 2 ? '#2f6bd8' : '#ffd23a') });
      // Gladiator Toad: a wide bronze belt, and a tall guard on the near shoulder
      if (L.belt) { B.lathe([[0.41, 0.54], [0.45, 0.51], [0.45, 0.42], [0.41, 0.39]], 14, { sx: wd, sz: wd, col: trim }); B.decalAt([0, 0.465, 0.452 * wd], [0, 0, 1], [0.07, 0.05, 0.02], '#fff0c8'); }
      if (L.galerus) B.box([-0.47 * wd, 0.99, 0], [0.04, 0.14, 0.17], { col: trim });
      // Buddhist Toad's robe drapes over one shoulder in a maroon sash
      if (L.sash) for (let q = 0; q <= 7; q++) { const k = q / 7, th = Math.PI / 2 + 0.95 - 1.9 * k, y = 0.92 - 0.42 * k, r = profR(VEST_P, y) * wd + 0.018; B.decalAt([Math.cos(th) * r, y, Math.sin(th) * r], [Math.cos(th), 0, Math.sin(th)], [0.085, 0.075, 0.025], L.sash); }
      // Muslim Toad: gold embroidery down the front of the vest
      if (L.robeCol && L.hat === 'kufi') for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) onVest(0.2 * sx, 0.86 - k * 0.1, [0.03, 0.03, 0.012], trim);
      // Mormon Toad: a tie and a name tag on a white shirt
      if (L.tie) {
        onShirt(0, 0.9, [0.07, 0.05, 0.024], L.tie, 0.03);
        [[0.83, 0.06, 0.07], [0.72, 0.075, 0.07], [0.61, 0.085, 0.06], [0.53, 0.05, 0.04]].forEach(([y, w, h]) => onShirt(0, y, [w, h, 0.022], L.tie, 0.03));
        onVest(-0.22, 0.8, [0.11, 0.046, 0.018], '#1d1d24'); onVest(-0.22, 0.8, [0.075, 0.01, 0.012], '#f6f1e6');
      }
      // Catholic Toad: a small gold cross on a chain over his choir robes
      if (L.cross) {
        const zr = y => profR(SHIRT_P, y) * wd + 0.03;
        for (const sx of [-1, 1]) B.capsule([0.13 * sx, 0.93, zr(0.93) - 0.04], [0.02 * sx, 0.8, zr(0.8)], 0.008, 3, { col: '#ffd23a' });
        B.box([0, 0.74, zr(0.74)], [0.022, 0.075, 0.014], { col: '#ffd23a' });
        B.box([0, 0.765, zr(0.765) + 0.004], [0.055, 0.02, 0.014], { col: '#ffd23a' });
      }
      // Hindu Toad: his white kurta is splashed with Holi colours
      // (each splash is a few overlapping round dabs, so it looks like thrown powder)
      const dab = (p, n, s, c) => B.decalAt(p, n, [s, s * 0.86, 0.016], c, { nLat: 3, nLon: 10 });
      const splash = (x, y, s, c) => { for (const [ox, oy, k] of [[0, 0, 1], [s * 0.7, s * 0.4, 0.55], [-s * 0.5, -s * 0.55, 0.5]]) { const r = profR(VEST_P, y + oy) * wd + 0.016, xx = x + ox, z = Math.sqrt(Math.max(0.001, r * r - xx * xx)); dab([xx, y + oy, z], [xx, 0, z], s * k, c); } };
      if (L.holi) for (const [x, y, c, s] of [[-0.24, 0.84, '#ff4fa0', 0.1], [0.18, 0.66, '#3fbf4a', 0.11], [-0.1, 0.55, '#ffd23a', 0.09], [0.27, 0.86, '#2f7cf6', 0.08], [-0.32, 0.66, '#a05ad8', 0.08], [0.34, 0.56, '#ff8a1f', 0.07]]) splash(x, y, s, c);
      if (L.holi) for (const [a, y, c] of [[2.2, 0.36, '#ff4fa0'], [0.9, 0.3, '#3fbf4a'], [3.6, 0.32, '#2f7cf6'], [4.9, 0.4, '#ffd23a'], [1.5, 0.42, '#a05ad8']]) dab([Math.cos(a) * 0.5 * wd, y, Math.sin(a) * 0.5 * wd], [Math.cos(a), 0, Math.sin(a)], 0.11, c);
      // Subaru Toad: a zipped tracksuit with a stand-up collar
      if (L.zip) { B.lathe([[0.19, 1.02], [0.23, 1.0], [0.25, 0.93], [0.21, 0.92]], 12, { col: vest }); B.lathe([[0.19, 1.035], [0.235, 1.02], [0.23, 1.0], [0.19, 1.015]], 12, { col: trim }); for (let k = 0; k < 5; k++) onShirt(0, 0.88 - k * 0.09, [0.012, 0.05, 0.01], '#5a5a64'); }
      // Emilia Toad: a fluffy white capelet and a gold brooch (her long cape is a part of its own, below)
      if (L.cape) {
        B.lathe([[0.2, 1.01], [0.36, 0.96], [0.45, 0.87], [0.41, 0.82], [0.22, 0.9]], 14, { sx: wd, sz: wd, jit: 0.025, seed: 31, col: L.cape });
        for (const [x, z] of [[-0.2, 0.36], [0, 0.42], [0.2, 0.36]]) B.ellipsoid([x * wd, 0.85, z * wd], [0.12, 0.08, 0.06], 2, 7, { col: L.cape, seed: 32 + x * 10 });
      }
      if (L.brooch) {
        B.ellipsoid([0, 0.9, 0.45 * wd], [0.075, 0.075, 0.03], 2, 9, { col: '#ffd23a' });
        B.ellipsoid([0, 0.9, 0.475 * wd], [0.04, 0.04, 0.02], 2, 7, { col: '#ff9a1f' });
      }
      // ...and Beatrice's backpack carrier with its straps
      if (L.beako) {
        B.box([0, 0.37, -0.72], [0.25, 0.1, 0.32], { col: '#ff8cc6' });
        B.box([0, 0.48, -0.72], [0.265, 0.025, 0.335], { col: '#ffffff' });
        for (const sx of [-1, 1]) { B.capsule([0.17 * sx, 0.48, -0.42], [0.24 * sx, 0.95, -0.14], 0.03, 4, { col: '#3a3a44' }); B.capsule([0.24 * sx, 0.95, -0.14], [0.27 * sx, 0.78, 0.35], 0.03, 4, { col: '#3a3a44' }); }
      }
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
    // Emilia Toad's long cape, white outside and lavender inside, hanging from her shoulders. It's two thin
    // layers, which the ink outline can't handle (the inner layer's outline pokes through), so it has none
    if (L.cape) part(rig, 'cape', BODY_PIV, () => {
      const ang = [];
      for (let q = 0; q <= 14; q++) ang.push(Math.PI - 0.3 + ((Math.PI + 0.6) * q) / 14);
      const prof = [[0.31, 1.0], [0.47, 0.86], [0.57, 0.6], [0.65, 0.34], [0.73, 0.08]];
      B.lathe(prof, 0, { angles: ang, sx: wd, sz: wd, center: [0, 0.5, 0], col: L.cape });
      sub(() => B.lathe(prof.map(([r, y]) => [r - 0.025, y]), 0, { angles: ang, sx: wd, sz: wd, center: [0, 0.5, 0], col: L.capeIn || L.cape }), p => p, n => [-n[0], -n[1], -n[2]]);
    }, { ink: false });
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
      // beards (Viking Toad's is long and braided; the Hasidic Toad's is round), with a mustache and sideburns
      if (L.beard) {
        const bc = L.beard, long = !L.payot;
        B.ellipsoid([0, 0.75, 0.27], [0.29, 0.15, 0.15], 3, 9, { col: bc, seed: 81, jit: 0.02 });
        if (long) B.ellipsoid([0, 0.63, 0.31], [0.19, 0.12, 0.11], 3, 8, { col: bc, seed: 82, jit: 0.02 });
        for (const sx of [-1, 1]) {
          headDecal([0.15 * sx, -0.3, 0.94], [0.14, 0.055, 0.045], bc);
          B.ellipsoid([0.36 * sx, 0.9, 0.12], [0.07, 0.15, 0.1], 2, 6, { col: bc });
          if (long) { B.capsule([0.1 * sx, 0.6, 0.36], [0.11 * sx, 0.42, 0.37], 0.042, 5, { col: bc }); B.lathe([[0.05, 0.5], [0.055, 0.47], [0.05, 0.44]], 7, { c: [0.105 * sx, 0, 0.365], col: '#a9b2c0' }); }
        }
      }
      // Holi powder on the Hindu Toad's cheeks
      if (L.holi) { headDecal([0.66, -0.32, 0.68], [0.07, 0.05, 0.015], '#ff4fa0'); headDecal([-0.7, -0.26, 0.66], [0.06, 0.045, 0.015], '#3fbf4a'); }
      // the Hasidic Toad's side curls
      if (L.payot) for (const sx of [-1, 1]) curl([0.41 * sx, 1.02, 0.12], 0.32, 0.055, L.payot);
      // Pharaoh Toad: the nemes's striped flaps hang down beside the face
      if (L.hat === 'nemes') for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) B.box([0.445 * sx, 1.13 - k * 0.1, 0.12], [0.03, 0.05, 0.12], { col: k % 2 ? '#2f6bd8' : '#ffd23a' });
      // Subaru Toad: spiky dark-brown bangs falling from under the cap onto his forehead, spikes over his ears, and brows
      if (L.hair) {
        const spike = (base, dir, len, r) => sub(() => B.cone([0, 0, 0], r, len, 5, { col: L.hair }), p => { const F = B.frameFor(dir); return v.add(base, v.add(v.mul(F.r, p[0]), v.add(v.mul(F.n, p[1]), v.mul(F.u, p[2])))); },
          n => { const F = B.frameFor(dir); return v.add(v.mul(F.r, n[0]), v.add(v.mul(F.n, n[1]), v.mul(F.u, n[2]))); });
        for (const [x, len, tilt] of [[-0.27, 0.13, -0.35], [-0.14, 0.17, -0.15], [0, 0.15, 0.08], [0.13, 0.18, 0.2], [0.26, 0.12, 0.4]]) {
          const z = HC[2] + HR[2] * Math.sqrt(Math.max(0.05, 1 - (x / HR[0]) ** 2 - ((1.21 - HC[1]) / HR[1]) ** 2));
          spike([x, 1.22, z - 0.02], [tilt, -1, 0.55], len, 0.06);
        }
        for (const sx of [-1, 1]) { spike([0.39 * sx, 1.15, 0.1], [0.35 * sx, -1, 0.15], 0.14, 0.055); spike([0.36 * sx, 1.2, -0.12], [0.5 * sx, -0.6, -0.4], 0.13, 0.05); }
        for (const sx of [-1, 1]) headDecal([0.31 * sx, 0.2, 0.93], [0.095, 0.02, 0.012], L.hair, { spin: 0.2 * sx });
      }
      const headTris = B.take();
      // a striped cap (nemes) uses a finer outline so each band is thin; Pharaoh Toad has no spots
      const fine = !!L.capBands, gillAt = fine ? 10 : 6;
      B.lathe(fine ? CAP_FINE : CAP_PROFILE, 16, { jit: fine ? 0.004 : 0.012, seed: 10, center: [0, 1.55, 0], mat: (m, i) => (i >= gillAt ? PAPER.gill : fine ? L.capBands[i % 2] : capCol) });
      // (the Hindu Toad's spots are four different Holi colours)
      if (L.spot !== null) SPOTS.forEach(([d, a], k) => B.spotPatch(CAP_C, CAP_R, d, a, L.spotCols ? L.spotCols[k % L.spotCols.length] : spot, 10, 0.022, 0.25));
      if (rig.captain) { const d = v.norm([0, 0.28, 1]); B.decalAt([CAP_C[0] + d[0] * CAP_R[0], CAP_C[1] + d[1] * CAP_R[1], CAP_C[2] + d[2] * CAP_R[2]], [d[0] / CAP_R[0], d[1] / CAP_R[1], d[2] / CAP_R[2]], [0.15, 0.15, 0.06], '#8a8f99'); }
      hatGeo(L, trim);
      if (L.tiara) tiaraGeo();
      const capTris = B.xformTris(B.take(), tiltP, tiltN);
      B.push(headTris); B.push(capTris);
      // Toadette's round braids hang from the sides of her cap, framing her face, with white bands at the ends
      if (rig.toadette && L.drills) for (const sx of [-1, 1]) {
        // Beatrice: long spiral drills with pink tips, tied with pink ribbons
        curl([0.6 * sx, 1.14, -0.05], 0.95, 0.2, capCol, '#ff8cc6');
        for (const k of [-1, 1]) B.ellipsoid([0.6 * sx + k * 0.1, 1.17, -0.04], [0.1, 0.07, 0.04], 2, 6, { col: '#ff5aa8' });
      } else if (rig.toadette) for (const sx of [-1, 1]) {
        B.capsule([0.44 * sx, 1.17, -0.05], [0.58 * sx, 1.04, -0.06], 0.08, 6, { col: capCol });
        B.ellipsoid([0.62 * sx, 0.94, -0.06], [0.2, 0.23, 0.2], 4, 9, { col: capCol, seed: 40 + sx, jit: 0.01 });
        B.ellipsoid([0.63 * sx, 0.75, -0.06], [0.13, 0.055, 0.13], 2, 8, { col: PAPER.white, seed: 44 + sx });
      }
      // Emilia Toad's long silver braid hangs down her back from under the hood, tied with a lavender band
      if (L.braid) {
        curl([0, 1.2, -0.6], 1.02, 0.13, L.braid, '#d6cbee');
        B.lathe([[0.075, 0.43], [0.09, 0.41], [0.09, 0.37], [0.075, 0.35]], 8, { c: [0, 0, -0.6], col: '#9a6ad8' });
      }
    });
    const er = rig.old ? [0.046, 0.075, 0.025] : [0.058 * (L.bigEyes || 1), 0.105 * (L.bigEyes || 1), 0.03];
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
        } else if (L.eyes === 'sharp') {
          // Subaru's eyes: narrow and sharp, a small dark-brown iris with white showing below it, under a heavy upper lid
          const c = [0.32 * sx, -0.02, 0.95];
          headDecal(c, [0.078, 0.084, 0.028], PAPER.eye);
          headDecal(c, [0.066, 0.072, 0.03], '#ffffff', { off: [0, 0, 0.004] });
          headDecal(c, [0.031, 0.038, 0.014], '#5a3418', { off: [-0.006 * sx, 0.012, 0.026] });
          headDecal(c, [0.016, 0.021, 0.012], PAPER.eye, { off: [-0.006 * sx, 0.012, 0.03] });
          headDecal(c, [0.007, 0.008, 0.01], '#ffffff', { off: [-0.014 * sx, 0.026, 0.034] });
          headDecal(c, [0.084, 0.02, 0.016], PAPER.eye, { off: [0, 0.064, 0.034], spin: -0.16 * sx });
        } else if (L.eyes === 'violet') {
          // Emilia's big violet eyes, darker at the bottom, with a bright highlight
          const c = [0.32 * sx, -0.02, 0.95];
          headDecal(c, [er[0] * 1.12, er[1] * 1.06, 0.03], '#34245e');
          headDecal(c, [er[0] * 0.94, er[1] * 0.9, 0.032], '#a274e6', { off: [0, 0, 0.004] });
          headDecal(c, [er[0] * 0.6, er[1] * 0.42, 0.012], '#6a44b0', { off: [0, -er[1] * 0.36, 0.03] });
          headDecal(c, [er[0] * 0.32, er[1] * 0.26, 0.01], '#ffffff', { off: [-0.026, er[1] * 0.42, 0.04] });
          headDecal(c, [er[0] * 0.14, er[1] * 0.11, 0.01], '#ffffff', { off: [0.022, -er[1] * 0.1, 0.04] });
        } else if (L.eyes === 'butterfly') {
          // Beatrice's blue eyes with pink butterflies in them
          const c = [0.32 * sx, -0.02, 0.95];
          headDecal(c, [er[0] * 1.1, er[1] * 1.04, 0.03], '#2a4a9a');
          headDecal(c, [er[0] * 0.92, er[1] * 0.88, 0.032], '#8fd0ff', { off: [0, 0, 0.004] });
          for (const [ox, oy, rx, ry] of [[-0.028, 0.022, 0.03, 0.036], [0.028, 0.022, 0.03, 0.036], [-0.02, -0.03, 0.02, 0.026], [0.02, -0.03, 0.02, 0.026]]) headDecal(c, [rx, ry, 0.012], '#ff4fa0', { off: [ox, oy, 0.03] });
          headDecal(c, [0.008, 0.045, 0.01], '#5a1a4a', { off: [0, 0, 0.036] });
          headDecal(c, [er[0] * 0.26, er[1] * 0.2, 0.01], '#ffffff', { off: [-0.03, er[1] * 0.5, 0.04] });
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
      // (Subaru Toad's is a wide, toothy grin)
      const gw = L.grin ? 1.2 : 1, gt = L.grin ? 1.45 : 1;
      part(rig, 'mouth', HEAD_PIV, () => {
        headDecal([0.02, -0.38, 0.92], [0.135 * gw, 0.095, 0.026], PAPER.mouth, { lat: [-90, 0] });
        headDecal([0.02, -0.38, 0.92], [0.11 * gw, 0.026 * gt, 0.018], '#ffffff', { off: [0, -0.006, 0.01], lat: [-90, 0] });
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
    // (Emilia Toad wears white boots with lavender soles)
    const shoeC = L.shoe || PAPER.shoe, soleC = L.sole || PAPER.sole;
    for (const [nm, x, z, seed] of [['shoeL', -0.22, 0.08, 12], ['shoeR', 0.22, 0.03, 13]]) {
      const c = [x * wd, 0.115, z];
      part(rig, nm, c, () => B.ellipsoid(c, [0.17, 0.115, 0.28], 4, 9, { seed, jit: 0.01, mat: m => (rig.robo ? (m[1] < 0.05 ? '#4a525e' : metal) : m[1] < 0.05 ? soleC : shoeC) }));
    }
    for (const [k, sx] of [['N', -1], ['F', 1]]) {
      const s = [0.36 * sx * wd, 0.84, 0.02], e = [s[0], s[1] - rig.LU, s[2]], h = [e[0], e[1] - 0.27, e[2]];
      // tracksuit sleeves (Subaru Toad): dark, with an orange line down the outside and orange cuffs.
      // Emilia Toad's long white sleeves have no line, just pink cuffs (`cuff`)
      const slv = L.sleeves, side = (a, b) => { if (!L.cuff) B.capsule([a[0] + sx * 0.068, a[1], a[2]], [b[0] + sx * 0.068, b[1], b[2]], 0.016, 4, { col: trim }); };
      part(rig, 'uarm' + k, s, () => { B.capsule(s, e, slv ? 0.085 : 0.075, 6, { col: slv || skin }); if (slv) side(s, e); });
      part(rig, 'farm' + k, e, () => {
        B.capsule(e, [e[0], e[1] - 0.22, e[2]], slv ? 0.082 : 0.072, 6, { col: slv || skin });
        if (slv) { side(e, [e[0], e[1] - 0.16, e[2]]); B.lathe([[0.075, e[1] - 0.16], [0.092, e[1] - 0.17], [0.092, e[1] - 0.22], [0.075, e[1] - 0.23]], 8, { c: [e[0], 0, e[2]], col: L.cuff || trim }); }
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
      // Mech Yoshi's armour: blue shoulder pads, a red chest core and twin thrusters on the back
      if (L.mech) {
        for (const sx of [-1, 1]) B.ellipsoid([0.37 * sx, 0.93, 0.1], [0.15, 0.1, 0.15], 3, 8, { col: L.saddle, seed: 90 + sx });
        B.decalAt([0, 0.74, 0.43], [0, 0.2, 1], [0.09, 0.09, 0.03], '#e8343f');
        B.decalAt([0, 0.74, 0.445], [0, 0.2, 1], [0.04, 0.04, 0.02], '#ffd0d0');
        for (const sx of [-1, 1]) B.lathe([[0.075, 1.02], [0.09, 0.8], [0.11, 0.7], [0.07, 0.68], [0, 0.68]], 8, { c: [0.15 * sx, 0, -0.4], col: '#8a93a3' });
        B.lathe([[0.36, 0.5], [0.41, 0.48], [0.41, 0.42], [0.36, 0.4]], 12, { col: L.saddle });
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
      // Mech Yoshi's helmet: a blue dome over the crown with a gold V-fin and a red gem, and cheek vents
      if (L.mech) {
        B.ellipsoid([0, 1.66, -0.04], [0.31, 0.28, 0.3], 4, 10, { col: L.saddle, seed: 92, lat: [-5, 90] });
        for (const sx of [-1, 1]) B.capsule([0.03 * sx, 1.88, 0.16], [0.25 * sx, 2.14, 0.08], 0.032, 4, { col: '#ffd23a', r2: 0.012 });
        B.ellipsoid([0, 1.88, 0.18], [0.055, 0.055, 0.04], 2, 6, { col: '#e8343f' });
        for (const sx of [-1, 1]) for (const k of [0, 1]) B.box([0.315 * sx, 1.37 - k * 0.07, 0.12], [0.015, 0.02, 0.08], { col: '#3a4250' });
      }
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
    // ---- Buttercup, Moo Toad's cow (built facing +z, feet on y = 0; the saddle top is COW_SADDLE high) ----
    PROPS.cowBody = mesh(() => {
      const W = '#fbfbf6', K = '#2b2b2b', P = '#ffb3bd';
      B.ellipsoid([0, 0.95, 0], [0.42, 0.36, 0.86], 5, 12, { col: W, jit: 0.01, seed: 70 });
      for (const [d, a] of [[[1, 0.3, 0.4], 0.5], [[1, -0.1, -0.5], 0.42], [[-1, 0.25, -0.1], 0.55], [[-1, -0.2, 0.55], 0.36], [[0.2, 1, -0.6], 0.4]]) B.spotPatch([0, 0.95, 0], [0.42, 0.36, 0.86], d, a, K, 9, 0.012, 0.25);
      // head with a pink snout, black eyes, cream horns and floppy ears
      B.ellipsoid([0, 1.16, 0.95], [0.27, 0.26, 0.3], 4, 10, { col: W, seed: 71 });
      B.spotPatch([0, 1.16, 0.95], [0.27, 0.26, 0.3], [0.6, 0.6, -0.2], 0.45, K, 7, 0.01, 0.2);
      B.ellipsoid([0, 1.03, 1.2], [0.21, 0.15, 0.13], 3, 9, { col: P, seed: 72 });
      for (const sx of [-1, 1]) {
        B.decalAt([0.08 * sx, 1.04, 1.32], [0.3 * sx, 0, 1], [0.025, 0.03, 0.01], '#7a3a40');
        B.decalAt([0.14 * sx, 1.24, 1.16], [0.5 * sx, 0.2, 1], [0.035, 0.045, 0.012], PAPER.eye);
        B.cone([0.15 * sx, 1.36, 0.9], 0.05, 0.16, 5, { col: '#f6ecd6' });
        B.ellipsoid([0.3 * sx, 1.25, 0.88], [0.12, 0.05, 0.08], 2, 6, { col: W, frame: { r: [Math.cos(0.5 * sx), Math.sin(0.5 * sx), 0], u: [-Math.sin(0.5 * sx), Math.cos(0.5 * sx), 0], n: [0, 0, 1] } });
      }
      // cowbell on a red strap, and a saddle with a blanket for the rider
      B.lathe([[0.27, 0.06], [0.3, 0.02], [0.3, -0.02], [0.27, -0.06]], 10, { c: [0, 0.98, 0.72], col: '#d8343a' });
      B.lathe([[0, 0.05], [0.05, 0.04], [0.08, -0.06], [0.07, -0.08], [0, -0.08]], 8, { c: [0, 0.78, 0.86], col: '#ffd23a' });
      B.box([0, 1.27, -0.05], [0.44, 0.03, 0.42], { col: '#d8343a' });
      B.box([0, 1.31, -0.05], [0.3, 0.04, 0.3], { col: '#8a5a2b' });
    });
    // a leg hangs down from its hip at the origin; the hoof sits at y = -0.72
    PROPS.cowLeg = mesh(() => { B.capsule([0, 0, 0], [0, -0.62, 0], 0.11, 6, { col: '#fbfbf6' }); B.ellipsoid([0, -0.68, 0.02], [0.12, 0.07, 0.14], 2, 7, { col: '#2b2b2b' }); });
    PROPS.cowTail = mesh(() => { B.capsule([0, 0, 0], [0, -0.42, -0.12], 0.035, 5, { col: '#fbfbf6' }); B.ellipsoid([0, -0.47, -0.14], [0.07, 0.1, 0.07], 2, 6, { col: '#2b2b2b' }); });
    // Moo Toad's milk splash
    PROJ.milk = mesh(() => { B.ellipsoid([0, 0, 0], [0.16, 0.13, 0.13], 3, 8, { col: '#ffffff', seed: 73 }); B.ellipsoid([0.1, 0.06, 0], [0.07, 0.06, 0.06], 2, 6, { col: '#ffffff' }); }, { ink: false });
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
  // ---- the v1.7 fighters' gear, shots, traps and finale pieces ----
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [p => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c], n => [n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c]]; };
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [p => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c], n => [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]]; };
  const ringProf = (R, r, n) => { const ring = []; for (let k = 0; k <= (n || 8); k++) { const a = (k / (n || 8)) * Math.PI * 2; ring.push([R + Math.cos(a) * r, Math.sin(a) * r]); } return ring; };
  function buildNew() {
    // held weapons run along +y out of the fist
    PROPS.katana = mesh(() => {
      B.capsule([0, -0.14, 0], [0, 0.06, 0], 0.036, 5, { col: '#1d1d24' });
      for (const y of [-0.1, -0.04, 0.02]) B.lathe([[0.04, y + 0.012], [0.042, y], [0.04, y - 0.012]], 6, { col: '#ffd23a' });
      B.lathe([[0, 0.09], [0.09, 0.085], [0.095, 0.068], [0, 0.068]], 10, { col: '#ffd23a' });
      B.capsule([0, 0.1, 0], [0.025, 0.52, 0], 0.03, 4, { col: '#eef4fb', r2: 0.026 });
      B.capsule([0.025, 0.52, 0], [0.08, 0.92, 0], 0.026, 4, { col: '#eef4fb', r2: 0.007 });
    });
    PROPS.axe = mesh(() => {
      B.capsule([0, -0.12, 0], [0, 0.62, 0], 0.035, 5, { col: '#8a5a2b' });
      B.box([0.09, 0.55, 0], [0.09, 0.065, 0.022], { col: '#a9b2c0' });
      B.ellipsoid([0.19, 0.52, 0], [0.06, 0.15, 0.024], 2, 7, { col: '#e8eef6' });
    });
    PROPS.trident = mesh(() => {
      B.capsule([0, -0.5, 0], [0, 0.85, 0], 0.025, 5, { col: '#8a5a2b' });
      B.box([0, 0.86, 0], [0.13, 0.022, 0.022], { col: '#d8a040' });
      for (const x of [-0.12, 0, 0.12]) { const y1 = x ? 1.06 : 1.12; B.capsule([x, 0.86, 0], [x, y1, 0], 0.02, 4, { col: '#d8a040' }); B.cone([x, y1, 0], 0.04, 0.09, 4, { col: '#f0c870' }); }
    });
    PROPS.sunstaff = mesh(() => {
      B.capsule([0, -0.4, 0], [0, 0.76, 0], 0.028, 5, { col: '#ffd23a' });
      for (const sx of [-1, 1]) B.capsule([0, 0.74, 0], [0.13 * sx, 0.82, 0], 0.022, 4, { col: '#ffd23a' });
      sub(() => B.lathe([[0, 0.03], [0.14, 0.03], [0.15, 0], [0.14, -0.03], [0, -0.03]], 12, { col: '#ffd23a' }), ...toZ(0, 0.92, 0));
      B.decalAt([0, 0.92, 0.035], [0, 0, 1], [0.075, 0.075, 0.02], '#e8343f');
    });
    PROPS.bostaff = mesh(() => { B.capsule([0, -0.62, 0], [0, 0.8, 0], 0.03, 5, { col: '#a8743c' }); for (const y of [-0.58, 0.76]) B.lathe([[0.038, y + 0.05], [0.042, y], [0.038, y - 0.05]], 7, { col: '#c8d0dc' }); });
    // Viking Toad's round shield (faces sideways like the Knight's): painted quarters and an iron boss
    PROPS.roundShield = mesh(() => sub(() => {
      B.lathe([[0, 0.05], [0.34, 0.04], [0.37, 0], [0.33, -0.02], [0, -0.02]], 16, { mat: (m, i, j) => (i === 0 ? (Math.floor(j / 4) % 2 ? '#d8343c' : '#f3ead2') : '#8a5a2b') });
      B.lathe([[0.33, 0.056], [0.378, 0.03], [0.378, 0], [0.33, 0.02]], 16, { col: '#8a8f99' });
      B.ellipsoid([0, 0.055, 0], [0.1, 0.05, 0.1], 2, 7, { col: '#a9b2c0' });
    }, p => [-p[1], p[0], p[2]], n => [-n[1], n[0], n[2]]));
    // a curved war horn, mouthpiece at the origin, bell out in front and up
    PROPS.warhorn = mesh(() => {
      const P = [[0, 0, 0], [0, 0.04, 0.16], [0, 0.14, 0.3], [0, 0.32, 0.38]], R = [0.03, 0.05, 0.075, 0.11];
      for (let q = 0; q < 3; q++) B.capsule(P[q], P[q + 1], R[q], 6, { col: '#f3ead2', r2: R[q + 1] });
      B.lathe([[0.052, 0.07], [0.058, 0.05], [0.052, 0.03]], 8, { c: [0, 0, 0.17], col: '#ffd23a' });
    });
    // a clarinet held at the mouth, pointing forward and down
    PROPS.clarinet = mesh(() => sub(() => {
      B.lathe([[0, 0], [0.022, 0.01], [0.03, 0.06], [0.035, 0.07], [0.035, 0.42], [0.05, 0.47], [0.085, 0.52], [0, 0.52]], 10, { mat: m => (m[1] > 0.06 && m[1] < 0.42 ? '#8a5a34' : '#e0e6ee') });
      for (const y of [0.15, 0.24, 0.33]) B.lathe([[0.037, y + 0.01], [0.04, y], [0.037, y - 0.01]], 8, { col: '#c8d0dc' });
    }, ...rotX(2.3)));
    // Mormon Toad's bicycle (wheels roll along z), Hasidic Toad's wedding chair
    PROPS.bike = mesh(() => {
      for (const z of [-0.52, 0.52]) {
        sub(() => B.lathe(ringProf(0.31, 0.035), 16, { col: '#26262e' }), p => [p[1], 0.33 + p[0], z + p[2]], n => [n[1], n[0], n[2]]);
        for (const a of [0, Math.PI / 2]) B.capsule([0, 0.33 + Math.cos(a) * 0.29, z + Math.sin(a) * 0.29], [0, 0.33 - Math.cos(a) * 0.29, z - Math.sin(a) * 0.29], 0.008, 3, { col: '#c8d0dc' });
      }
      const fc = '#2557d6';
      for (const [a, b] of [[[0, 0.33, -0.52], [0, 0.72, -0.12]], [[0, 0.72, -0.12], [0, 0.36, 0.04]], [[0, 0.36, 0.04], [0, 0.86, 0.4]], [[0, 0.72, -0.12], [0, 0.86, 0.4]], [[0, 0.86, 0.4], [0, 0.33, 0.52]], [[0, 0.36, 0.04], [0, 0.33, -0.52]]]) B.capsule(a, b, 0.03, 5, { col: fc });
      B.ellipsoid([0, 0.77, -0.14], [0.08, 0.035, 0.13], 2, 7, { col: '#26262e' });
      B.capsule([-0.24, 0.96, 0.4], [0.24, 0.96, 0.4], 0.025, 5, { col: '#c8d0dc' });
      B.capsule([0, 0.86, 0.4], [0, 0.96, 0.4], 0.025, 4, { col: '#c8d0dc' });
      B.ellipsoid([0.15, 0.99, 0.42], [0.035, 0.03, 0.035], 2, 6, { col: '#ffd23a' });
    });
    PROPS.chair = mesh(() => {
      B.box([0, 0.42, 0], [0.3, 0.035, 0.28], { col: '#b8844c' });
      for (const [x, z] of [[-0.25, -0.23], [0.25, -0.23], [-0.25, 0.23], [0.25, 0.23]]) B.box([x, 0.2, z], [0.03, 0.2, 0.03], { col: '#8a5a2b' });
      for (const x of [-0.25, 0.25]) B.box([x, 0.78, -0.25], [0.03, 0.36, 0.03], { col: '#8a5a2b' });
      for (const y of [0.72, 0.96]) B.box([0, y, -0.25], [0.26, 0.04, 0.02], { col: '#b8844c' });
    });
    // Muslim Toad's plate of Eid sweets
    PROPS.sweets = mesh(() => {
      B.lathe([[0, 0.02], [0.2, 0.03], [0.24, 0.05], [0.25, 0.04], [0.21, 0], [0, 0]], 12, { col: '#fbfbf6' });
      for (const [x, z] of [[-0.08, 0.02], [0.07, -0.05], [0.04, 0.09]]) { B.ellipsoid([x, 0.07, z], [0.065, 0.04, 0.065], 2, 4, { col: '#d89a3a' }); B.ellipsoid([x, 0.11, z], [0.022, 0.012, 0.022], 2, 4, { col: '#7ac04a' }); }
    });
    // Pharaoh Toad's golden sarcophagus, open at the front so he shows inside
    PROPS.sarco = mesh(() => {
      const ang = []; for (let q = 0; q <= 14; q++) ang.push(Math.PI / 2 + 0.55 + ((Math.PI * 2 - 1.1) * q) / 14);
      B.lathe([[0.62, 0], [0.74, 0.25], [0.8, 0.9], [0.98, 1.5], [1.0, 1.95], [0.86, 2.38], [0.5, 2.64], [0, 2.72]], 0, { angles: ang, mat: (m, i) => (i % 2 ? '#2f6bd8' : '#ffd23a') });
    });
    // Viking Toad's longship, bow toward +z: shields along the sides, a dragon prow and a striped sail
    PROPS.longship = mesh(() => {
      const hw = z => 0.51 * 1.1 * Math.sqrt(Math.max(0, 1 - (z / (0.51 * 3.4)) ** 2));
      B.lathe([[0, 0.55], [0.52, 0.55], [0.5, 0.34], [0.34, 0.08], [0, 0.02]], 14, { sx: 1.1, sz: 3.4, col: '#8a5a2b', seed: 66 });
      B.lathe([[0.49, 0.59], [0.545, 0.57], [0.545, 0.5], [0.49, 0.52]], 14, { sx: 1.1, sz: 3.4, col: '#6a4a2e' });
      for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const z = -0.8 + k * 0.4; B.decalAt([(hw(z) + 0.02) * sx, 0.4, z], [sx, 0, 0], [0.13, 0.13, 0.03], k % 2 ? '#ffd23a' : '#d8343c'); }
      for (const [a, b, r] of [[[0, 0.5, 1.7], [0, 0.95, 1.92], 0.09], [[0, 0.95, 1.92], [0, 1.32, 1.9], 0.07]]) B.capsule(a, b, r, 6, { col: '#6a4a2e' });
      B.ellipsoid([0, 1.38, 2.0], [0.09, 0.09, 0.17], 3, 7, { col: '#6a4a2e' });
      for (const sx of [-1, 1]) B.decalAt([0.08 * sx, 1.42, 2.06], [sx, 0.3, 0.4], [0.03, 0.03, 0.01], '#ffd23a');
      B.capsule([0, 0.5, -1.7], [0, 0.98, -1.95], 0.08, 6, { col: '#6a4a2e', r2: 0.05 });
      B.capsule([0, 0.5, 0.1], [0, 2.75, 0.1], 0.05, 5, { col: '#6a4a2e' });
      sub(() => { for (let k = 0; k < 5; k++) B.box([0, 1.32 + k * 0.24, 0], [0.88, 0.12, 0.02], { col: k % 2 ? '#f3ead2' : '#d8343c' }); }, p => { const q = rotY(0.65)[0](p); return [q[0], q[1], q[2] + 0.1]; }, rotY(0.65)[1]);
    });
    // a Roman legionary's big red shield
    PROPS.scutum = mesh(() => {
      B.box([0, 0, 0], [0.3, 0.44, 0.045], { col: '#b8202a' });
      for (const [x, y, w, h] of [[0, 0.42, 0.3, 0.025], [0, -0.42, 0.3, 0.025], [0.28, 0, 0.025, 0.44], [-0.28, 0, 0.025, 0.44]]) B.box([x, y, 0.05], [w, h, 0.01], { col: '#d8a040' });
      B.ellipsoid([0, 0, 0.05], [0.09, 0.09, 0.05], 2, 7, { col: '#d8a040' });
    });
    // Mech Yoshi's arm cannon (continues the forearm out past the fist)
    PROPS.mechgun = mesh(() => {
      B.capsule([0, -0.08, 0], [0, 0.2, 0], 0.075, 7, { col: '#8a93a3' });
      B.lathe([[0.085, 0.2], [0.09, 0.16], [0.085, 0.12]], 8, { col: '#2f6bd8' });
      B.lathe([[0.05, 0.27], [0.06, 0.24], [0.05, 0.2]], 8, { col: '#3a4250' });
      B.ellipsoid([0, 0.27, 0], [0.035, 0.02, 0.035], 2, 6, { col: '#7dff9a' });
    });
    // Catholic Toad's festive gear: a hand bell, a party popper, maracas for the parranda
    PROPS.handbell = mesh(() => {
      B.capsule([0, -0.05, 0], [0, 0.16, 0], 0.03, 5, { col: '#8a5a2b' });
      B.lathe([[0, 0.42], [0.06, 0.41], [0.1, 0.34], [0.12, 0.24], [0.17, 0.17], [0.17, 0.15], [0, 0.17]], 12, { col: '#ffd23a' });
      B.ellipsoid([0, 0.14, 0], [0.035, 0.035, 0.035], 2, 6, { col: '#c8902a' });
    });
    PROPS.popper = mesh(() => { B.lathe([[0, 0], [0.24, 0.7], [0.22, 0.72], [0, 0.66]], 10, { mat: (m, i, j) => (j % 2 ? '#ff4fa0' : '#ffd23a') }); });
    PROPS.maraca = mesh(() => { B.capsule([0, -0.08, 0], [0, 0.12, 0], 0.02, 4, { col: '#8a5a2b' }); B.ellipsoid([0, 0.2, 0], [0.08, 0.1, 0.08], 3, 7, { mat: m => (m[1] > 0.2 ? '#ff4fa0' : '#3fbf4a') }); });
    // Hindu Toad's: striped dandiya sticks, a festival kite, a brass pichkari
    PROPS.dandiya = mesh(() => { for (let k = 0; k < 5; k++) B.capsule([0, -0.1 + k * 0.1, 0], [0, k * 0.1, 0], 0.028, 5, { col: ['#ff4fa0', '#ffd23a', '#3fbf4a', '#2f7cf6', '#ff8a1f'][k] }); });
    PROPS.kite = mesh(() => {
      const P = [[0, 0.5], [0.36, 0.06], [0, -0.46], [-0.36, 0.06]], cols = ['#ff4fa0', '#ffd23a', '#3fbf4a', '#2f7cf6'], c = [0, 0.06, 0];
      for (let k = 0; k < 4; k++) { const a = P[k], b = P[(k + 1) % 4]; B.addTri(c, [a[0], a[1], 0.012], [b[0], b[1], 0.012], cols[k], [0, 0.06, -1]); B.addTri(c, [b[0], b[1], -0.012], [a[0], a[1], -0.012], cols[k], [0, 0.06, 1]); }
      B.capsule([0, 0.5, 0], [0, -0.46, 0], 0.012, 3, { col: '#8a5a2b' }); B.capsule([-0.36, 0.06, 0], [0.36, 0.06, 0], 0.012, 3, { col: '#8a5a2b' });
      for (let k = 0; k < 4; k++) B.ellipsoid([Math.sin(k * 1.3) * 0.05, -0.56 - k * 0.12, 0], [0.04, 0.04, 0.012], 2, 5, { col: cols[k] });
    });
    PROPS.string = mesh(() => B.capsule([0, 0, 0], [0, 1, 0], 0.014, 3, { col: '#f6f1e6' }), { ink: false });
    // a little blue net bag of Hanukkah gelt, gold and silver coins peeking out of the top
    PROPS.geltbag = mesh(() => {
      B.ellipsoid([0, 0.1, 0], [0.13, 0.15, 0.12], 3, 8, { mat: m => (Math.floor((m[1] + 1) * 22) % 2 ? '#2f6bd8' : '#7fb0ff') });
      B.lathe([[0.05, 0.27], [0.06, 0.24], [0.05, 0.21]], 8, { col: '#ffd23a' });
      for (const [x, z, c] of [[-0.05, 0.03, '#ffd23a'], [0.045, -0.02, '#d8dde6'], [0.0, 0.07, '#ffd23a']]) B.ellipsoid([x, 0.27, z], [0.055, 0.055, 0.014], 2, 8, { col: c });
    });
    // a seltzer siphon: blue glass with a silver head and spout (along +y out of the fist)
    PROPS.siphon = mesh(() => {
      B.lathe([[0, -0.3], [0.1, -0.29], [0.11, -0.05], [0.1, 0.02], [0, 0.02]], 10, { col: '#5aa8e8' });
      B.lathe([[0, 0.14], [0.06, 0.13], [0.075, 0.06], [0.07, 0.02], [0, 0.02]], 8, { col: '#c8d0dc' });
      B.capsule([0, 0.1, 0], [0, 0.12, 0.12], 0.02, 4, { col: '#c8d0dc' });
    });
    PROPS.pichkari = mesh(() => { B.capsule([0, -0.04, 0], [0, 0.3, 0], 0.055, 7, { col: '#d8a040' }); B.cone([0, 0.3, 0], 0.03, 0.1, 6, { col: '#c8902a' }); B.capsule([0, -0.12, 0], [0, -0.04, 0], 0.02, 4, { col: '#8a5a2b' }); B.lathe([[0.04, -0.12], [0.06, -0.14], [0.04, -0.16]], 6, { col: '#c8902a' }); });
    // ---- shots (centred on the origin; the view spins or flips them) ----
    PROJ.gift = mesh(() => {
      B.box([0, 0, 0], [0.16, 0.14, 0.16], { col: '#d8343c' });
      B.box([0, 0, 0], [0.165, 0.145, 0.04], { col: '#ffd23a' }); B.box([0, 0, 0], [0.04, 0.145, 0.165], { col: '#ffd23a' });
      for (const sx of [-1, 1]) B.ellipsoid([0.06 * sx, 0.18, 0], [0.07, 0.05, 0.035], 2, 6, { col: '#ffd23a' });
    });
    // a star piñata hanging on a string: paper points of every colour
    TRAP.pinata = mesh(() => {
      B.ellipsoid([0, 0, 0], [0.32, 0.32, 0.3], 4, 10, { col: '#ff4fa0', seed: 151 });
      const cols = ['#ffd23a', '#3fbf4a', '#2f7cf6', '#ff8a1f', '#a05ad8', '#ff4fa0', '#3fbf4a'];
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; sub(() => B.cone([0, 0.26, 0], 0.11, 0.38, 6, { col: cols[k] }), ...rz(a)); for (const sz of [-1, 1]) B.capsule([Math.sin(a) * -0.6, Math.cos(a) * 0.6, 0], [Math.sin(a) * -0.66, Math.cos(a) * 0.66 - 0.25, 0.03 * sz], 0.012, 3, { col: cols[(k + 2) % 7] }); }
      B.capsule([0, 0.62, 0], [0, 1.6, 0], 0.012, 3, { col: '#f6f1e6' });
    });
    PROJ.crescent = mesh(() => { for (let q = -3; q <= 3; q++) { const a = q * 0.36; B.ellipsoid([Math.cos(a) * 0.3 - 0.2, Math.sin(a) * 0.3, 0], [0.06, 0.11 - Math.abs(q) * 0.024, 0.03], 2, 6, { col: q % 2 ? '#ffe6f0' : '#ffffff', frame: { r: [Math.cos(a), Math.sin(a), 0], u: [-Math.sin(a), Math.cos(a), 0], n: [0, 0, 1] } }); } }, { ink: false, crease: false });
    PROJ.axe = mesh(() => { B.capsule([0, -0.32, 0], [0, 0.3, 0], 0.03, 5, { col: '#8a5a2b' }); B.box([0.08, 0.24, 0], [0.08, 0.06, 0.02], { col: '#a9b2c0' }); B.ellipsoid([0.17, 0.21, 0], [0.055, 0.13, 0.022], 2, 7, { col: '#e8eef6' }); });
    PROJ.scarab = mesh(() => {
      B.ellipsoid([0, 0, 0], [0.17, 0.09, 0.13], 3, 8, { col: '#ffd23a', seed: 131 });
      B.ellipsoid([0.16, 0.0, 0], [0.06, 0.05, 0.07], 2, 6, { col: '#d8a020' });
      B.decalAt([-0.02, 0.085, 0], [0, 1, 0], [0.15, 0.012, 0.01], '#2f6bd8');
      for (const sz of [-1, 1]) for (const x of [-0.08, 0, 0.08]) B.capsule([x, -0.04, 0.1 * sz], [x + 0.03, -0.09, 0.17 * sz], 0.012, 3, { col: '#8a6a10' });
    });
    PROJ.sandwave = mesh(() => { for (const [x, y, r] of [[-0.3, -0.08, 0.2], [-0.05, 0.02, 0.28], [0.22, -0.04, 0.24], [0.4, -0.12, 0.15]]) B.ellipsoid([x, y, 0], [r, r * 0.8, r * 0.7], 3, 8, { col: '#e8cf8f', jit: 0.03, seed: 140 + x * 10 }); }, { crease: false });
    PROJ.trident = mesh(() => sub(() => {
      B.capsule([0, -0.4, 0], [0, 0.3, 0], 0.022, 5, { col: '#8a5a2b' });
      B.box([0, 0.3, 0], [0.11, 0.02, 0.02], { col: '#d8a040' });
      for (const x of [-0.1, 0, 0.1]) { const y1 = x ? 0.46 : 0.5; B.capsule([x, 0.3, 0], [x, y1, 0], 0.018, 4, { col: '#d8a040' }); B.cone([x, y1, 0], 0.035, 0.08, 4, { col: '#f0c870' }); }
    }, p => [p[1], -p[0], p[2]], n => [n[1], -n[0], n[2]]));
    PROJ.chi = mesh(() => { sub(() => B.lathe(ringProf(0.22, 0.045), 16, { col: '#ffe28a' }), ...toZ(0, 0, 0)); B.ellipsoid([0, 0, 0], [0.12, 0.12, 0.05], 2, 8, { col: '#fff6c8' }); }, { ink: false, crease: false });
    PROJ.date = mesh(() => { B.ellipsoid([0, 0, 0], [0.11, 0.07, 0.07], 3, 7, { col: '#6a3a1a', seed: 133 }); B.decalAt([-0.03, 0.05, 0.05], [-0.3, 0.6, 1], [0.03, 0.015, 0.01], '#a8642c'); });
    // a fanous lantern: a gold frame round glowing glass
    PROJ.lantern = mesh(() => {
      B.lathe([[0, 0.34], [0.05, 0.3], [0.09, 0.24], [0.17, 0.12], [0.17, -0.1], [0.12, -0.17], [0.05, -0.21], [0, -0.23]], 6, { mat: (m, i) => (i === 3 ? '#ffd86a' : '#c8902a') });
      sub(() => B.lathe(ringProf(0.06, 0.014, 6), 8, { col: '#c8902a' }), ...toZ(0, 0.41, 0));
    });
    PROJ.jelly = mesh(() => { B.lathe([[0, 0.2], [0.12, 0.19], [0.19, 0.13], [0.22, 0.02], [0.2, 0], [0, 0]], 10, { col: '#5fd04a' }); B.decalAt([-0.07, 0.15, 0.1], [-0.4, 0.6, 0.6], [0.05, 0.03, 0.01], '#d8ffc8'); }, { crease: false });
    PROJ.latke = mesh(() => { B.lathe([[0, 0.045], [0.19, 0.04], [0.22, 0.01], [0.2, -0.03], [0, -0.035]], 10, { mat: (m, i) => (i === 0 ? '#e0a040' : '#a8641c'), jit: 0.02, seed: 135 }); });
    PROJ.pepper = mesh(() => { B.capsule([-0.16, -0.03, 0], [0.04, 0.02, 0], 0.07, 6, { col: '#e8262b', r2: 0.075 }); B.capsule([0.04, 0.02, 0], [0.16, 0.08, 0], 0.075, 6, { col: '#e8262b', r2: 0.02 }); B.capsule([-0.2, -0.04, 0], [-0.26, 0.02, 0], 0.02, 4, { col: '#3fae3a' }); });
    PROJ.plasma = mesh(() => { B.capsule([-0.34, 0, 0], [0.34, 0, 0], 0.08, 6, { col: '#7dff9a' }); B.ellipsoid([0.3, 0, 0], [0.12, 0.12, 0.12], 2, 6, { col: '#e8fff0' }); }, { ink: false, crease: false });
    PROJ.crystal = mesh(() => { B.cone([0, 0, 0], 0.1, 0.3, 4, { col: '#c8a0ff' }); B.cone([0, 0, 0], 0.1, -0.16, 4, { col: '#9a6ae8' }); B.xformTris(B.take(), p => [p[1], -p[0], p[2]], n => [n[1], -n[0], n[2]]).forEach(t => B.push([t])); });
    PROJ.dbomb = PROJ.bomb; // the Hasidic Toad's down air drops a Bob-omb
    PROJ.mbomb = mesh(() => { B.ellipsoid([0, 0, 0], [0.2, 0.2, 0.2], 4, 9, { col: '#8a93a3', seed: 136 }); B.lathe([[0.2, 0.04], [0.205, 0], [0.2, -0.04]], 12, { col: '#2f6bd8' }); B.ellipsoid([0, 0.2, 0], [0.05, 0.04, 0.05], 2, 6, { col: '#ff4a4a' }); });
    // ---- traps (on the ground, y = 0 at the surface) ----
    TRAP.net = mesh(() => {
      for (let k = -4; k <= 4; k++) { B.capsule([k * 0.28 - 0.12, 0.03, -0.5], [k * 0.28 + 0.12, 0.03, 0.5], 0.022, 3, { col: '#c8a060' }); B.capsule([-1.15, 0.03, k * 0.12], [1.15, 0.03, k * 0.12 + 0.05], 0.02, 3, { col: '#b08850' }); }
      for (const [x, z] of [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]]) B.ellipsoid([x, 0.05, z], [0.06, 0.05, 0.06], 2, 6, { col: '#6a7280' });
    });
    TRAP.casserole = mesh(() => {
      B.box([0, 0.09, 0], [0.62, 0.09, 0.34], { col: '#fbfbf6' });
      B.box([0, 0.185, 0], [0.56, 0.02, 0.29], { col: '#f0c060' });
      for (const [x, z, c] of [[-0.3, 0.1, '#e0a040'], [0.2, -0.12, '#e0a040'], [0.4, 0.15, '#7ac04a'], [-0.05, 0.2, '#e0a040'], [-0.45, -0.15, '#7ac04a'], [0.05, -0.05, '#c8862a']]) B.ellipsoid([x, 0.21, z], [0.06, 0.025, 0.06], 2, 5, { col: c });
      for (const sx of [-1, 1]) B.box([0.67 * sx, 0.14, 0], [0.05, 0.025, 0.12], { col: '#fbfbf6' });
    });
    TRAP.flames = mesh(() => { for (const [x, z, h] of [[-0.6, 0.1, 0.55], [-0.25, -0.15, 0.75], [0.1, 0.12, 0.65], [0.45, -0.05, 0.8], [0.75, 0.15, 0.5]]) { B.cone([x, 0, z], 0.16, h, 6, { col: '#ff8a1f' }); B.cone([x, 0, z + 0.04], 0.09, h * 0.6, 5, { col: '#ffe066' }); } }, { ink: false });
    // ---- finale pieces ----
    FXM.pyramid = mesh(() => {
      B.lathe([[0, 1.0], [1.0, 0], [0, 0]], 4, { rot0: Math.PI / 4, center: [0, 0.3, 0], mat: m => (Math.floor(m[1] * 6) % 2 ? '#e8cf8f' : '#d9b874') });
      B.lathe([[0, 1.02], [0.17, 0.85], [0, 0.85]], 4, { rot0: Math.PI / 4, col: '#ffd23a' });
    });
    FXM.petal = mesh(() => B.ellipsoid([0, 0, 0], [0.13, 0.025, 0.085], 2, 6, { col: '#ffc0d8' }), { ink: false });
    FXM.lotus = mesh(() => {
      for (const [n, R, t, rr, col] of [[8, 0.5, 0.45, 0.42, '#ffb0d0'], [6, 0.3, 0.9, 0.34, '#ffd8e8']]) for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (n === 6 ? 0.4 : 0), Rd = [Math.cos(a), 0, Math.sin(a)], Tg = [-Math.sin(a), 0, Math.cos(a)];
        const r = [Rd[0] * Math.cos(t), Math.sin(t), Rd[2] * Math.cos(t)], u = [-Rd[0] * Math.sin(t), Math.cos(t), -Rd[2] * Math.sin(t)];
        B.ellipsoid([Rd[0] * R, 0.08 + Math.sin(t) * rr * 0.6, Rd[2] * R], [rr, 0.05, rr * 0.45], 2, 7, { col, frame: { r, u, n: Tg } });
      }
      B.ellipsoid([0, 0.12, 0], [0.16, 0.08, 0.16], 2, 8, { col: '#ffd23a' });
      B.ellipsoid([0, 0.01, 0], [0.75, 0.03, 0.75], 2, 10, { col: '#5fbf5a' });
    });
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

  // ---------- Emilia Toad's ice (weapons, pellets, pillar, barrier) and Puck ----------
  // ice colours: pale, light, mid, deep; faces alternate so the facets catch the light
  const ICEC = ['#f2fcff', '#c4ecff', '#92d4f6', '#62b2e2'];
  // Ice Brand Arts' weapons in turn (as in sim.js)
  const BRAND_W = ['sword', 'axe', 'hammer', 'spear'];
  const iceMat = (m, i, j) => ICEC[(i + j) % 2 ? 1 : i === 0 ? 0 : 2];
  // a faceted ice blade running up +y from the fist: flat (sz), pointed at the tip
  function iceBladeGeo(len, w, flat) {
    B.capsule([0, -0.1, 0], [0, 0.06, 0], 0.04, 5, { col: ICEC[2] });
    B.box([0, 0.08, 0], [w * 1.7, 0.03, 0.05], { col: ICEC[1] });
    B.lathe([[0, len], [w * 0.9, len * 0.86], [w, len * 0.3], [w * 0.8, 0.1], [0, 0.1]], 4, { sz: flat, center: [0, len * 0.5, 0], mat: iceMat });
  }
  // a pellet of ice: a small faceted icicle along +x
  function icicleGeo(r, len, back) {
    sub(() => { B.cone([0, 0, 0], r, len, 5, { col: ICEC[0] }); B.cone([0, 0, 0], r, -back, 5, { col: ICEC[2] }); }, p => [p[1], -p[0], p[2]], n => [n[1], -n[0], n[2]]);
  }
  // a slab of ice from (x0,y0) to (x1,y1) (world units), th thick and dz deep, with a little crystal on top
  function iceSlab(x0, y0, x1, y1, th, dz, col) {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), c = Math.cos(a), s = Math.sin(a), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    sub(() => B.box([0, 0, 0], [L / 2 + th * 0.3, th / 2, dz], { faceCol: k => (k === 2 ? ICEC[0] : k % 2 ? col : ICEC[1]) }), p => [mx + p[0] * c - p[1] * s, my + p[0] * s + p[1] * c, p[2]], n => [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]]);
  }
  const PUCK = {};
  function buildIce() {
    PROPS.ice_sword = mesh(() => iceBladeGeo(1.6, 0.15, 0.55));
    PROPS.ice_blade = mesh(() => iceBladeGeo(0.66, 0.085, 0.55));
    PROPS.ice_axe = mesh(() => {
      B.capsule([0, -0.15, 0], [0, 1.15, 0], 0.045, 5, { col: ICEC[2] });
      for (const sx of [-1, 1]) B.lathe([[0, 0.3], [0.2, 0.26], [0.3, 0.05], [0.28, -0.22], [0, -0.3]], 4, { c: [0.24 * sx, 0.98, 0], sx: 1, sz: 0.18, center: [0.24 * sx, 0.98, 0], mat: iceMat });
      B.cone([0, 1.15, 0], 0.07, 0.25, 4, { col: ICEC[0] });
    });
    PROPS.ice_hammer = mesh(() => {
      B.capsule([0, -0.15, 0], [0, 1.05, 0], 0.05, 5, { col: ICEC[2] });
      B.box([0, 1.12, 0], [0.34, 0.2, 0.2], { faceCol: k => ICEC[k % 3] });
      for (const [x, z] of [[-0.18, 0.1], [0.18, 0.1], [-0.18, -0.1], [0.18, -0.1]]) B.cone([x, 1.3, z], 0.06, 0.16, 4, { col: ICEC[0] });
    });
    PROPS.ice_spear = mesh(() => {
      B.capsule([0, -0.45, 0], [0, 1.15, 0], 0.035, 5, { col: ICEC[2] });
      B.lathe([[0, 1.62], [0.09, 1.3], [0.11, 1.18], [0.05, 1.12], [0, 1.12]], 4, { sz: 0.5, center: [0, 1.35, 0], mat: iceMat });
      B.lathe([[0, -0.45], [0.06, -0.5], [0, -0.62]], 4, { col: ICEC[1] });
    });
    // a little ice spike, for the soldiers' icy shoulders
    PROPS.ice_spike = mesh(() => { B.cone([0, 0, 0], 0.07, 0.24, 4, { col: ICEC[1] }); });
    // Emilia's pellets are icicles; Puck's are snowflakes
    PROJ.icepel = mesh(() => icicleGeo(0.07, 0.3, 0.12));
    PROJ.puckpel = mesh(() => {
      B.ellipsoid([0, 0, 0], [0.07, 0.07, 0.05], 2, 6, { col: '#ffffff' });
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, e = [Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0]; B.capsule([0, 0, 0], e, 0.026, 4, { col: k % 2 ? '#bff2ff' : '#ffffff' }); B.capsule([e[0] * 0.6, e[1] * 0.6, 0], [e[0] * 0.6 + Math.cos(a + 0.8) * 0.08, e[1] * 0.6 + Math.sin(a + 0.8) * 0.08, 0], 0.018, 3, { col: '#ffffff' }); }
    });
    // the ice pillar: a unit column (1 wide, 1 tall from its base), and a little cluster of crystals for its edges
    FXM.icePillar = mesh(() => B.lathe([[0, 1.0], [0.3, 0.98], [0.5, 0.95], [0.52, 0.5], [0.5, 0.04], [0.46, 0], [0, 0]], 6, { center: [0, 0.5, 0], mat: iceMat }));
    FXM.iceCrys = mesh(() => {
      for (const [a, tl, len] of [[0, 0.1, 0.5], [2.1, 0.55, 0.34], [4.2, 0.5, 0.3]]) sub(() => B.lathe([[0, len], [0.07, len * 0.75], [0.08, 0], [0, -0.05]], 5, { center: [0, len * 0.4, 0], mat: iceMat }),
        p => { const c = Math.cos(tl), s = Math.sin(tl), x = p[0] * c + p[1] * s, y = -p[0] * s + p[1] * c; return [x * Math.cos(a) - p[2] * Math.sin(a), y, x * Math.sin(a) + p[2] * Math.cos(a)]; },
        n => { const c = Math.cos(tl), s = Math.sin(tl), x = n[0] * c + n[1] * s, y = -n[0] * s + n[1] * c; return [x * Math.cos(a) - n[2] * Math.sin(a), y, x * Math.sin(a) + n[2] * Math.cos(a)]; });
    });
    // the ice barrier, in sim pixels round Emilia's feet (facing +x): a wall in front that curves over her head
    FXM.iceShell = mesh(() => {
      const P = PX, pts = [[39, 0], [39, -70]];
      for (let q = 1; q <= 5; q++) { const a = (q / 5) * (Math.PI / 2); pts.push([9 + 30 * Math.cos(a), -86 - 30 * Math.sin(a)]); }
      pts.push([-26, -116]);
      for (let k = 0; k < pts.length - 1; k++) iceSlab(pts[k][0] * P, -pts[k][1] * P, pts[k + 1][0] * P, -pts[k + 1][1] * P, 17 * P, 1.05, k % 2 ? ICEC[2] : ICEC[1]);
      // icicles along the outside
      for (const [x, y, a] of [[47, -20, 0], [47, -54, 0.15], [44, -94, 0.7], [24, -118, 1.3], [-6, -124, 1.57], [-22, -124, 1.6]]) sub(() => B.cone([0, 0, 0], 0.14, 0.42, 4, { col: ICEC[0] }), p => { const c = Math.cos(a), s = Math.sin(a); return [x * P + p[1] * c - p[0] * s, -y * P + p[1] * s + p[0] * c, p[2] + 0.4]; }, n => { const c = Math.cos(a), s = Math.sin(a); return [n[1] * c - n[0] * s, n[1] * s + n[0] * c, n[2]]; });
    });
    // shards for an ice shatter
    for (const k of [0, 1, 2]) FXM['iceShard' + k] = mesh(() => { const h = 0.4 + k * 0.12, r = 0.16 + (k % 2) * 0.06; B.lathe([[0, h], [r, 0], [0, -h * 0.55]], 3 + (k % 2), { center: [0, 0, 0], jit: 0.05, seed: 60 + k, mat: (m, i, j) => ICEC[(i + j + k) % 3] }); });
    // Puck: a little grey cat spirit with a white chest, blue eyes, pink cheeks, a gold earring, a long tail
    // and a small purple satchel. His paws and tail are separate so he can hold out his paws and swish his tail
    const grey = '#b9bdc8', pale = '#f4f5fa';
    PUCK.body = mesh(() => {
      B.ellipsoid([0, 0.42, 0], [0.25, 0.31, 0.23], 4, 10, { col: grey, seed: 81 });
      B.ellipsoid([0, 0.46, 0.13], [0.16, 0.24, 0.12], 3, 9, { col: pale, seed: 82, jit: 0.015 });
      for (const sx of [-1, 1]) B.ellipsoid([0.12 * sx, 0.1, 0.04], [0.09, 0.1, 0.11], 2, 7, { col: pale });
      // head
      B.ellipsoid([0, 0.92, 0], [0.33, 0.29, 0.29], 4, 12, { col: grey, seed: 83 });
      B.decalAt([0, 0.84, 0.27], [0, -0.2, 1], [0.17, 0.12, 0.03], pale);
      B.decalAt([0, 1.08, 0.25], [0, 0.5, 1], [0.07, 0.05, 0.02], pale);
      for (const sx of [-1, 1]) {
        B.decalAt([0.14 * sx, 0.94, 0.26], [0.35 * sx, 0, 1], [0.065, 0.08, 0.03], '#1d2a3a');
        B.decalAt([0.14 * sx, 0.94, 0.27], [0.35 * sx, 0, 1], [0.05, 0.065, 0.03], '#4ab6e8');
        B.decalAt([0.13 * sx, 0.965, 0.29], [0.35 * sx, 0, 1], [0.02, 0.022, 0.01], '#ffffff');
        B.decalAt([0.22 * sx, 0.84, 0.21], [0.6 * sx, -0.2, 0.8], [0.05, 0.03, 0.01], '#ffa0b4');
        // ears, pink inside
        sub(() => { B.cone([0, 0, 0], 0.12, 0.26, 4, { col: grey }); B.cone([0, 0.01, 0.04], 0.07, 0.18, 4, { col: '#ffb8c8' }); },
          p => { const c = Math.cos(sx * 0.5), s = Math.sin(sx * 0.5); return [0.2 * sx + p[0] * c + p[1] * s, 1.08 - p[0] * s + p[1] * c, p[2]]; },
          n => { const c = Math.cos(sx * 0.5), s = Math.sin(sx * 0.5); return [n[0] * c + n[1] * s, -n[0] * s + n[1] * c, n[2]]; });
      }
      B.ellipsoid([0, 0.88, 0.29], [0.025, 0.02, 0.02], 2, 6, { col: '#ff8aa0' });
      B.ellipsoid([0.27, 1.18, 0.02], [0.035, 0.035, 0.035], 2, 6, { col: '#ffd23a' }); // gold earring
      // the satchel on a strap
      B.capsule([-0.2, 0.68, 0.12], [0.22, 0.24, 0.16], 0.025, 4, { col: '#8a5ad0' });
      B.ellipsoid([0.27, 0.22, 0.1], [0.11, 0.09, 0.07], 2, 8, { col: '#9a6ad8' });
      B.ellipsoid([0.3, 0.24, 0.17], [0.025, 0.025, 0.012], 2, 5, { col: '#ffd23a' });
    });
    for (const sx of [-1, 1]) PUCK['arm' + (sx < 0 ? 'L' : 'R')] = mesh(() => { B.capsule([0, 0, 0], [0, -0.2, 0.02], 0.06, 5, { col: grey }); B.ellipsoid([0, -0.22, 0.03], [0.065, 0.06, 0.065], 2, 6, { col: pale }); });
    PUCK.tail = mesh(() => {
      const pts = [[0, 0, 0], [0.08, 0.25, -0.05], [0.12, 0.55, -0.06], [0.1, 0.85, -0.04], [0.04, 1.08, 0]];
      for (let k = 0; k < pts.length - 1; k++) B.capsule(pts[k], pts[k + 1], 0.05 - k * 0.004, 5, { col: k === 3 ? pale : grey });
    });
    // the Beast of the End: Puck's true form, an enormous black shaggy cat with glowing yellow eyes and a snarl of
    // fangs, its great paws on the stage. Built facing the camera, chin near y = 0; the eyes are their own mesh so
    // they can glow
    const tuft = (base, dir, len, r, col) => sub(() => B.cone([0, 0, 0], r, len, 4, { col }), p => { const F = B.frameFor(dir); return v.add(base, v.add(v.mul(F.r, p[0]), v.add(v.mul(F.n, p[1]), v.mul(F.u, p[2])))); },
      n => { const F = B.frameFor(dir); return v.add(v.mul(F.r, n[0]), v.add(v.mul(F.n, n[1]), v.mul(F.u, n[2]))); });
    const FUR = ['#141419', '#1d1d25', '#26262f', '#0e0e12'];
    PUCK.beast = mesh(() => {
      // shoulders and chest, the head, the muzzle and nose
      B.ellipsoid([0, -1.15, -0.5], [2.4, 1.15, 1.4], 5, 14, { col: FUR[0], seed: 91, jit: 0.06 });
      B.ellipsoid([0, 0.55, 0.15], [1.3, 1.1, 1.05], 5, 14, { col: FUR[1], seed: 92, jit: 0.04 });
      B.ellipsoid([0, 0.12, 0.95], [0.6, 0.4, 0.38], 3, 10, { col: FUR[2], seed: 93 });
      B.ellipsoid([0, 0.3, 1.31], [0.13, 0.09, 0.07], 2, 6, { col: '#3a3440' });
      // the mouth, open in a snarl, with long fangs
      B.decalAt([0, -0.05, 1.29], [0, -0.35, 1], [0.36, 0.13, 0.04], '#4a0f1a');
      for (const sx of [-1, 1]) { tuft([0.2 * sx, 0.06, 1.28], [0.08 * sx, -1, 0.15], 0.24, 0.05, '#f4f0e6'); tuft([0.1 * sx, -0.16, 1.27], [0, 1, 0.1], 0.1, 0.035, '#f4f0e6'); }
      // big pointed ears
      for (const sx of [-1, 1]) sub(() => { B.cone([0, 0, 0], 0.42, 0.95, 4, { col: FUR[1] }); B.cone([0, 0.02, 0.14], 0.26, 0.7, 4, { col: '#3a2440' }); },
        p => { const c = Math.cos(sx * 0.45), s = Math.sin(sx * 0.45); return [0.78 * sx + p[0] * c + p[1] * s, 1.35 - p[0] * s + p[1] * c, p[2] - 0.05]; },
        n => { const c = Math.cos(sx * 0.45), s = Math.sin(sx * 0.45); return [n[0] * c + n[1] * s, -n[0] * s + n[1] * c, n[2]]; });
      // shaggy fur: a mane of tufts all round the head and over the shoulders (from a fixed seed)
      let sd = 7;
      const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      for (let k = 0; k < 46; k++) {
        const a = (k / 46) * Math.PI * 2 + rnd() * 0.2, r = 1.15 + rnd() * 0.15, x = Math.cos(a) * r, y = 0.5 + Math.sin(a) * r * 0.9;
        if (y > 1.25 && Math.abs(x) > 0.5 && Math.abs(x) < 1.1) continue; // (room for the ears)
        tuft([x, y, 0.1 + rnd() * 0.3], [Math.cos(a), Math.sin(a) * 0.9, 0.35 + rnd() * 0.3], 0.45 + rnd() * 0.35, 0.16 + rnd() * 0.06, FUR[k % 4]);
      }
      for (let k = 0; k < 40; k++) {
        const a = Math.PI * (0.05 + rnd() * 0.9), x = Math.cos(a) * 2.4, y = -1.0 + Math.sin(a) * 1.1 + rnd() * 0.2;
        tuft([x * 0.95, y, 0.2 + rnd() * 0.5], [Math.cos(a) * 0.8, 0.6 + rnd() * 0.3, 0.5], 0.5 + rnd() * 0.4, 0.2, FUR[(k + 1) % 4]);
      }
      // cheek tufts sweeping out to the sides
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) tuft([1.05 * sx, 0.15 - k * 0.14, 0.45], [sx, -0.35 - k * 0.15, 0.25], 0.55, 0.14, FUR[k % 4]);
      // a shaggy fringe along the bottom, so it never ends in a hard edge
      for (let k = 0; k <= 20; k++) { const x = -2.25 + k * 0.225; tuft([x, -2.0 + Math.abs(x) * 0.12, 0.1 + rnd() * 0.4], [x * 0.25, -1, 0.3], 0.55 + rnd() * 0.3, 0.2, FUR[k % 4]); }
      // great front paws with pale claws
      for (const sx of [-1, 1]) {
        B.ellipsoid([1.9 * sx, -1.95, 0.9], [0.6, 0.42, 0.7], 3, 10, { col: FUR[0], seed: sx > 0 ? 95 : 94 });
        for (let k = -1; k <= 1; k++) tuft([1.9 * sx + k * 0.24, -2.1, 1.5], [0, -0.3, 1], 0.24, 0.06, '#e8e2d4');
      }
    });
    PUCK.beastEyes = mesh(() => {
      for (const sx of [-1, 1]) {
        B.ellipsoid([0.46 * sx, 0.72, 1.06], [0.27, 0.15, 0.1], 3, 10, { col: '#ffd21f' });
        B.ellipsoid([0.46 * sx, 0.72, 1.15], [0.045, 0.13, 0.04], 2, 6, { col: '#2a1a00' }); // slit pupils
      }
    });
  }

  // ---------- rigs registry ----------
  const RIGS = {}, MINIONS = {};
  const CROWD = [], YCROWD = [], CHOIR = [];
  // Water Yoshi's things: the Sea Dragon's Cradle (a ring on the floor, its round water wall in two halves so the front
  // can fade by itself, and a roof) and his whirlpool (three arms of water spiralling into a dark middle). All radius 1
  function buildWater() {
    const arc = (a0, a1) => { const A = []; for (let k = 0; k <= 16; k++) A.push(a0 + ((a1 - a0) * k) / 16); return A; };
    const prof = [[1, 0], [1, 0.33], [1, 0.66], [1, 1]], band = (m, i) => (i === 2 ? '#bff4ff' : i === 1 ? '#6fd8f4' : '#4fc4ec');
    // (both halves face the camera, so the back one shows its inside and the front one its outside)
    FXM.cradleBack = mesh(() => B.lathe(prof, 16, { angles: arc(Math.PI, Math.PI * 2), center: [0, 0.5, -6], mat: band }), { ink: false, crease: false });
    FXM.cradleFront = mesh(() => B.lathe(prof, 16, { angles: arc(0, Math.PI), center: [0, 0.5, -6], mat: band }), { ink: false, crease: false });
    FXM.cradleRing = mesh(() => B.lathe([[0.86, 0.03], [1.04, 0.03], [1.04, 0], [0.86, 0]], 28, { col: '#7fe8ff' }), { ink: false, crease: false });
    FXM.cradleRoof = mesh(() => B.lathe([[0, 0.05], [1.02, 0.05], [1.02, -0.03], [0, -0.03]], 28, { col: '#8fe0ff' }), { ink: false, crease: false });
    FXM.whirl = mesh(() => {
      B.lathe([[0, 0.012], [0.34, 0.012], [0.34, 0], [0, 0]], 16, { col: '#1d4f8a' });
      for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 10; k++) {
        const q = k / 9, a = arm * ((Math.PI * 2) / 3) + q * 3.6, r = 0.22 + 0.78 * q;
        B.ellipsoid([Math.cos(a) * r, 0.025, Math.sin(a) * r], [0.07 + 0.04 * q, 0.025, 0.13 + 0.08 * q], 2, 6, { col: k % 2 ? '#7fd8ff' : '#e6fbff', frame: B.frameFor([-Math.sin(a), 0, Math.cos(a)]) });
      }
    }, { ink: false });
  }
  function build() {
    buildProps(); buildItems(); buildFx(); buildNew(); buildIce(); buildWater();
    // Emilia Toad's Ice Soldiers: Subaru Toad without Beatrice's backpack (drawn tinted to ice)
    MINIONS.icesoldier = toadRig('subaru', { beako: false });
    // Beatrice (in Subaru Toad's backpack): a mini Toadette with cream drills, a crown and butterfly eyes
    BEAKO = toadRig('toadette', { cap: '#f5e6b8', spot: '#ff9cc8', vest: '#ff6fae', trim: '#ffffff', drills: true, eyes: 'butterfly', bigEyes: 1.45, tiara: true });
    // Legion March soldiers and the Grand Choir
    MINIONS.legion = toadRig('toad', { spot: '#c0392b', vest: '#b5442b', trim: '#d8a040', hat: 'galea', belt: true });
    for (const spot of ['#e8262b', '#2f7cf6', '#ffc81a', '#29b34a', '#9b4fd6', '#ff8a1f', '#2557d6']) CHOIR.push(toadRig('toad', { spot, vest: '#2a3f8f', trim: '#ffd23a', robe: true, robeCol: '#2a3f8f', shirt: '#ffffff' }));
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
    // Emilia Toad's ice volley: both hands thrown forward as the pellets fly, glowing ice-blue
    icevolley(P, F, c) {
      const k = clamp01(c.t / 6), back = c.t > 12 ? clamp01((c.t - 12) / 6) : 0;
      P.an = [lerp(0.2, -1.55, k) + back * 0.9, -0.3 - 0.25 * k, -0.15, 0]; P.af = [lerp(0.2, -1.55, k) + back * 0.9, 0.3 + 0.25 * k, -0.15, 0];
      P.lean = 0.12 * k; c.profile(0.25); F.mouthO = c.t >= 5 && c.t < 12;
      if (c.t >= 3 && c.t < 12) F.tint = [0.75, 0.93, 1, 0.3];
    },
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
    // air attacks get whole-body flips and spins, so they never look like the ground moves
    axe(P, F, c) { P.af = [lerp(-2.7, -0.45, c.q), 0.2, 0, 0]; P.an = [lerp(-2.7, -0.45, c.q), -0.2, 0, 0]; P.lean = 0.2; P.slY = 0.2; P.srY = 0.18; P.grip = 0.9; P.tumble = (c.fc || 1) * Math.sin(c.q * Math.PI) * 0.9; c.profile(0.35 * c.q); },
    meteoraxe(P, F, c) { P.af = [lerp(-2.9, 0.2, c.q), 0.25, 0, 0]; P.an = [lerp(-2.9, 0.2, c.q), -0.25, 0, 0]; P.lean = lerp(-0.2, 0.4, c.q); P.slY = 0.12; P.srY = 0.1; P.grip = 0.9; c.profile(0.3 * c.q); },
    drill(P, F, c) { const on = c.t >= 6 && c.t <= 26; P.lean = on ? 1.1 : 0.3; P.spin = on ? c.t * 1.1 : 0; ARMS_UP(P, 2.7); P.an[0] = -0.6; P.af[0] = -0.6; P.slY = 0.1; P.srY = 0.1; },
    // a sword cartwheel: one full forward spin with the blade out
    airslash(P, F, c) { P.af = [-1.6, 0.1, 0, 0]; P.grip = 0.15; P.an = [-1.2, -0.5, -0.3, 0]; P.tumble = (c.fc || 1) * c.q * Math.PI * 2; P.slY = 0.2; P.srY = 0.2; },
    // a forward somersault that ends head-first
    headbonkair(P, F, c) { P.tumble = (c.fc || 1) * Math.sin(c.q * Math.PI) * 1.5; P.lean = 0.5 * c.kp; P.hx = 0.3 * c.kp; P.slY = 0.22; P.srY = 0.2; ARMS_UP(P, 1.4); F.mouthO = c.on; },
    backkick(P, F, c) { P.srZ = -0.45 * c.kp; P.srY = 0.16 * c.kp; P.srR = 0.85 * c.kp; P.slZ = 0.08; P.slY = 0.2; P.lean = 0.32 * c.kp; P.tumble = -(c.fc || 1) * 0.45 * c.kp; P.an = [-0.8, -0.3, -0.3, 0]; P.af = [-0.8, 0.3, -0.3, 0]; c.profile(-0.45 * c.kp); },
    tailbair(P, F, c) { P.spin = (c.fc || 1) * Math.sin(c.q * Math.PI) * 1.2; P.lean = 0.25 * c.kp; ARMS_UP(P, 1.0); P.slY = 0.1; P.srY = 0.1; },
    backslash(P, F, c) { P.af = [lerp(-1.6, 1.5, c.q), 0.2, 0, 0]; P.grip = 0.9; P.an = [-0.4, -0.5, -0.4, 0]; P.lean = 0.15; c.profile(-0.5 * c.kp); },
    flipkick(P, F, c) { P.tumble = (c.fc || 1) * Math.sin(c.q * Math.PI) * 1.4; P.slY = 0.2 * c.kp; P.srY = 0.24 * c.kp; P.srZ = 0.3 * c.kp; ARMS_UP(P, 1.6); },
    scissor(P, F, c) { const w = Math.sin(c.t * 0.9); P.slZ = w * 0.4; P.srZ = -w * 0.4; P.slY = 0.3; P.srY = 0.3; P.lean = -0.35; ARMS_UP(P, 1.2); },
    // a full backflip with the blade sweeping overhead
    upslashair(P, F, c) { P.af = [-2.9, 0.1, 0, 0]; P.grip = 0.2; P.an = [-1.5, -0.5, -0.3, 0]; P.tumble = -(c.fc || 1) * c.q * Math.PI * 2; P.slY = 0.25; P.srY = 0.25; },
    // a corkscrew straight up, head first
    headbuttup(P, F, c) { P.spin = c.q * Math.PI * 2; P.hx = -0.5 * c.kp; P.sy = 1 + 0.12 * c.kp; ARMS_UP(P, 2.6); P.slY = 0.2; P.srY = 0.2; P.slZ = -0.15; P.srZ = -0.1; },
    stomp(P, F, c) { P.slY = -0.14; P.srY = -0.14; P.slZ = 0.05; ARMS_UP(P, 2.4); P.sy = 1 + 0.06 * c.kp; },
    drilldown(P, F, c) { const on = c.t >= 8 && c.t <= 28; P.spin = on ? c.t * 1.1 : 0; P.slY = -0.16; P.srY = -0.16; ARMS_UP(P, 2.6); P.sy = on ? 1.08 : 1; },
    plunge(P, F, c) { P.af = [-0.2, 0.15, 0, 0]; P.grip = 0; P.an = [-0.25, -0.15, 0, 0]; P.slY = -0.12; P.srY = -0.12; P.sy = 1.04; },
    // ---- the Yoshi clan's own moves (v1.9) ----
    // lift an egg overhead, then smash it down in front
    eggshell(P, F, c) { if (c.k < 0) { ARMS_UP(P, 2.7); P.lean = -0.2; P.sy = 1.05; F.eggHold = 1; } else { P.an = [-1.5 + 0.4 * c.q, -0.3, 0, 0]; P.af = [-1.5 + 0.4 * c.q, 0.3, 0, 0]; P.lean = 0.5 * c.kp; P.hx = 0.3 * c.kp; F.mouthO = c.on; } c.profile(0.4 * c.kp); },
    eggdrop(P, F, c) { P.sy = 0.86; P.slY = 0.26; P.srY = 0.26; P.hx = 0.35; P.an = [0.6, -0.5, -0.3, 0]; P.af = [0.6, 0.5, -0.3, 0]; F.mouthO = c.t > 6 && c.t < 12; },
    firebreath(P, F, c) { const on = c.t >= 6 && c.t <= 22; P.hx = 0.22; P.lean = 0.2; F.mouthO = on; P.side = on ? Math.sin(c.t * 2) * 0.03 : 0; P.an = [0.3, -0.4, -0.5, 0]; P.af = [0.3, 0.4, -0.5, 0]; c.profile(0.35); },
    wingslap(P, F, c) { P.af = [lerp(0.6, -1.4, c.kp), 0.9, 0, 0]; P.an = [lerp(0.6, -1.2, c.kp), -0.9, 0, 0]; P.lean = 0.25 * c.kp; F.wingFlap = c.on ? 1 : 0; c.profile(0.4 * c.kp); },
    bootstomp(P, F, c) { if (c.k < 0) { P.srY = 0.36; P.srZ = 0.22; P.lean = -0.1; } else { P.srY = -0.04; P.srZ = 0.32; P.sy = 0.92; P.lean = 0.12; } ARMS_UP(P, 1.0); c.profile(0.3); },
    bootkick(P, F, c) { if (c.k < 0) { P.srZ = -0.35; P.srY = 0.1; P.lean = 0.15; } else { P.srZ = 0.55 * c.kp; P.srY = 0.35 * c.kp; P.srR = -0.9 * c.kp; P.lean = -0.18 * c.kp; } P.an = [0.7, -0.5, -0.3, 0]; P.af = [0.7, 0.5, -0.3, 0]; c.profile(0.5 * c.kp); F.mouthO = c.on; },
    heartslap(P, F, c) { P.af = [lerp(0.05, -1.5, c.kp) + Math.min(0, c.k) * -1.2, 0.45, lerp(-0.4, 0, c.kp), 0]; P.an = [0.4, -0.3, -0.5, 0]; P.lean = 0.14 * c.kp; c.profile(0.3 * c.kp); F.mouthO = c.on; },
    cartkick(P, F, c) { P.tumble = -(c.fc || 1) * c.q * Math.PI * 2; ARMS_UP(P, 2.6); P.slY = 0.22 * c.kp; P.srY = 0.22 * c.kp; P.slZ = -0.25; P.srZ = 0.25; },
    skatekick(P, F, c) { P.lean = -0.55 * c.kp; P.sy = 0.86; P.slZ = 0.5 * c.kp; P.slY = 0.16 * c.kp; P.slR = -0.6 * c.kp; P.srZ = -0.2; P.an = [0.9, -0.6, 0, 0]; P.af = [0.9, 0.6, 0, 0]; c.profile(0.45 * c.kp); },
    airkick(P, F, c) { P.srZ = 0.55 * c.kp; P.srY = 0.3 * c.kp; P.srR = -0.9 * c.kp; P.slY = 0.25; P.lean = -0.25 * c.kp; P.tumble = (c.fc || 1) * 0.3 * c.kp; ARMS_UP(P, 1.0); c.profile(0.4 * c.kp); },
    tonguewhip(P, F, c) { P.lean = 0.3 * c.kp - 0.15 * Math.max(0, -c.k); F.mouthO = true; P.tongue = 1.75 * c.kp; P.hx = 0.1 * c.kp; c.profile(0.55 * c.kp); },
    clawswipe(P, F, c) { P.af = [lerp(-2.5, -0.4, c.q), lerp(0.6, -0.1, c.q), 0, 0]; P.an = [0.4, -0.4, -0.5, 0]; P.lean = 0.22 * c.kp; c.profile(0.35 * c.kp); F.mouthO = c.on; },
    bigbite(P, F, c) { P.lean = 0.45 * c.kp - 0.2 * Math.max(0, -c.k); P.hx = 0.4 * c.kp - 0.25 * Math.max(0, -c.k); F.mouthO = c.k < 0 || c.on; P.an = [0.4, -0.4, -0.6, 0]; P.af = [0.4, 0.4, -0.6, 0]; c.profile(0.45 * c.kp); },
    gulp(P, F, c) { TPOSE.bigbite(P, F, c); P.sy = 1 + 0.08 * c.kp; P.slZ = 0.2 * c.kp; P.srZ = -0.24 * c.kp; },
    bellyflop(P, F, c) { P.tumble = (c.fc || 1) * 1.35 * clamp01(c.t / 8); ARMS_UP(P, 1.7); P.slZ = -0.2; P.srZ = -0.2; P.slY = 0.1; P.srY = 0.1; F.mouthO = c.on; },
    tantrumsmash(P, F, c) {
      if (c.t < 14) { P.sy = 0.84; P.hx = 0.2; P.an = [0.5, -0.6, -0.4, 0]; P.af = [0.5, 0.6, -0.4, 0]; return; }
      const w = Math.sin(c.t * 2.2); P.an = [-1.6 + w * 0.9, -0.5, -0.4, 0]; P.af = [-1.6 - w * 0.9, 0.5, -0.4, 0]; P.side = w * 0.06; P.lean = 0.2; F.mouthO = true; P.slZ = w * 0.15; P.srZ = -w * 0.15;
    },
    rapidkick(P, F, c) { const on = c.t >= 3 && c.t <= 20, w = Math.sin(c.t * 2.4); P.srZ = on ? 0.3 + w * 0.3 : 0.1; P.srY = on ? 0.25 : 0.05; P.slZ = on ? 0.2 - w * 0.3 : 0; P.slY = on ? 0.15 : 0.05; P.lean = -0.15; ARMS_UP(P, 0.9); c.profile(0.4); },
    blitzkick(P, F, c) { TPOSE.dropkick(P, F, c); },
    jetkick(P, F, c) { TPOSE.dropkick(P, F, c); P.lean = -1.05 * c.kp; F.elemGlow = c.on ? 0.5 : 0; },
    cyclone(P, F, c) { P.spin = c.t >= 6 ? (c.t - 6) * 0.9 : 0; ARMS_UP(P, 1.4); P.sy = 1 + 0.06 * c.kp; },
    // Hasidic Toad: dig in, tunnel along with just his hat showing, then burst out of the ground
    burrow(P, F, c) {
      const D = c.A.dig || { a: 8, b: 34 }, t = c.t;
      if (t < D.a) { P.sy = 0.8; P.sx = 1.1; P.hx = 0.3; P.an = [0.9, -0.5, -0.6, 0]; P.af = [0.9, 0.5, -0.6, 0]; P.bob = -0.25 * (t / D.a); }
      else if (t <= D.b) { P.bob = -2.05; P.side = Math.sin(t * 1.4) * 0.05; F.digging = 1; }
      else { const k = clamp01((t - D.b) / 6); P.bob = lerp(-2.05, 0.25, k); ARMS_UP(P, 2.7); P.sy = 1.12; F.mouthO = true; }
    },
    // holding a bag of Hanukkah gelt, then a burst of it rockets him upward
    gelt(P, F, c) { if (c.k < 0) { P.sy = 0.84; P.sx = 1.08; P.af = [-1.0, 0.3, -0.6, 0]; P.an = [-1.0, -0.3, -0.6, 0]; F.geltBag = 1; } else { ARMS_UP(P, 2.5); P.sy = 1.1; P.slY = 0.12; P.srY = 0.12; F.mouthO = c.on; } },
    bombdrop(P, F, c) { P.hx = 0.4; P.af = [lerp(-1.2, 0.4, clamp01(c.t / 9)), 0.2, 0, 0]; P.an = [0.3, -0.5, -0.3, 0]; P.slY = 0.22; P.srY = 0.22; F.bombHand = c.t < 9; },
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
    // every air attack tucks the legs up a little
    if (AERIALS[f.at]) { P.slY = Math.max(P.slY, 0.14); P.srY = Math.max(P.srY, 0.12); }
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
      case 'beam': P.af = [-1.6, 0.05, 0, 0]; P.grip = 0.1; P.an = [-1.5, -0.1, -0.2, 0]; P.lean = 0.1; P.yaw = fc * 1.4; F.mouthO = true; if (D.sub === 'mech') F.jetBack = 1; break;
      case 'rush':
        if (D.sub === 'dash') {
          // Dash Yoshi's Supersonic Lap: a blur of legs
          const w = t * 2.2;
          P.lean = 0.9; P.hx = 0.3; P.yaw = fc * 1.45; P.slZ = Math.sin(w) * 0.4; P.srZ = -Math.sin(w) * 0.4; P.slY = Math.max(0, Math.cos(w)) * 0.2; P.srY = Math.max(0, -Math.cos(w)) * 0.2;
          P.an = [1.2, -0.3, -0.2, 0]; P.af = [1.2, 0.3, -0.2, 0]; F.tint = [1, 0.45, 0.1, 0.3]; F.mouthO = true; break;
        }
        F.cart = D.sub === 'ship' ? 2 : 1; P.sy = 0.9; P.an = [-1.2, -0.3, -0.4, 0]; P.af = [-1.2, 0.3, -0.4, 0]; P.lean = 0.2; P.yaw = fc * 1.45; F.mouthO = true;
        if (D.sub === 'ship') { P.af = [-2.6, 0.3, 0, 0]; P.grip = 1.0; }
        break;
      case 'pulses':
        if (D.sub === 'choir') { P.an = [-1.6, -0.8, -0.2, 0]; P.af = [-2.2 + Math.sin(t * 0.3) * 0.5, 0.6, -0.3, 0]; F.mouthO = true; P.hx = -0.15; break; } // conducting the choir
        if (D.sub) { ARMS_UP(P, 2.6); P.sy = 1 + Math.abs(Math.sin(t * 0.2)) * 0.1; break; }
        F.guitarPlay = 1; P.af = [-1.2, 0.5, -0.8, 0]; P.an = [-0.9 + Math.sin(t * 0.9) * 0.4, -0.2, -0.8, 0]; P.hx = Math.sin(t * 0.45) * 0.3; break;
      case 'lasso':
        if (D.sub === 'hora') { // the wedding dance: arms up, bouncing round and round
          ARMS_UP(P, 2.5 + Math.sin(t * 0.4) * 0.3); P.bob = Math.abs(Math.sin(t * 0.3)) * 0.12; P.spin = t * 0.08; F.mouthO = true;
          P.slY = Math.max(0, Math.sin(t * 0.3)) * 0.15; P.srY = Math.max(0, -Math.sin(t * 0.3)) * 0.15; break;
        }
        P.af = [-2.95, 0.15, 0, 0]; F.loopUp = 2.2; P.an = [0.2, -0.5, -0.4, 0]; break;
      case 'clone': P.af = [-1.4, 0.4, 0, 0]; P.lean = 0.3; break;
      // Absolute Zero: locked in place with both arms raised to the storm, calling it in
      case 'storm': ARMS_UP(P, 2.9 + Math.sin(t * 0.25) * 0.08); P.sy = 1.05; P.hx = -0.25; F.mouthO = t % 40 < 26; F.tint = [0.78, 0.94, 1, 0.3 + 0.1 * Math.sin(t * 0.3)]; return;
      case 'burst':
        if (D.sub === 'lotus') { P.slY = P.srY = 0.3; P.slZ = P.srZ = 0.2; P.an = [-0.9, -0.35, -1.6, 0]; P.af = [-0.9, 0.35, -1.6, 0]; P.bob = 0.4 + Math.sin(t * 0.1) * 0.05; F.noProp = true; break; }
        ARMS_UP(P, 2.5); P.spin = t * 0.2; break;
      default: ARMS_UP(P, 2.6); P.hx = -0.15; F.mouthO = true;
    }
    if (f.ch === 'subaru') F.bkCast = 1;
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
      // --- Water Yoshi ---
      case 'ebbflow': {
        const v = f.ebv;
        // charging: his hands sweep out in front of him like the tide
        if (v === 'charge') { const w = Math.sin(fr * 0.12); P.af = [-1.3 + w * 0.25, 0.3 + w * 0.15, -0.3, 0]; P.an = [-1.3 - w * 0.25, -0.3 + w * 0.15, -0.3, 0]; P.lean = 0.05 + w * 0.04; P.yaw = fc * 1.2; P.bob = Math.abs(w) * 0.03; }
        // the big beam: hands drawn back to his right hip for the wind-up, then both palms thrust forward
        else if (v === 'kame') {
          if (t < 90) { const k = clamp01(t / 18); P.af = [lerp(-0.6, 0.95, k), lerp(0.2, -0.55, k), -0.6, 0]; P.an = [lerp(-0.6, 0.95, k), lerp(-0.2, -0.95, k), -0.6, 0]; P.lean = -0.12 * k; P.yaw = fc * 1.4; P.sy = 0.95; }
          else { P.af = [-1.55, 0.18, 0, 0]; P.an = [-1.55, -0.18, 0, 0]; P.lean = 0.2; P.yaw = fc * 1.25; F.mouthO = true; P.hz = Math.sin(fr * 1.3) * 0.03; }
        }
        // the high-pressure jet: one hand drawn back, then thrust straight out
        else if (v === 'beam') { if (t < 12) { P.af = [0.4, 0.5, -0.4, 0]; P.an = [0.4, -0.4, -0.5, 0]; P.lean = -0.1; } else { P.af = [-1.6, 0.08, 0, 0]; P.an = [0.4, -0.4, -0.5, 0]; P.lean = 0.14; } P.yaw = fc * 1.3; P.grip = 0.15; }
        // the whirlpool: arms sweep down and round
        else if (v === 'whirl') { const k = clamp01(t / 12); P.an = [lerp(-1, 0.5, k), -0.6, -0.3, 0]; P.af = [lerp(-1, 0.5, k), 0.6, -0.3, 0]; P.spin = fc * k * 0.8; P.sy = 1 - 0.06 * k; }
        // the water blast: a two-handed push; the spout: spat from his mouth
        else if (v === 'blast') { const k = clamp01((t - 4) / 6); P.af = [lerp(0.3, -1.5, k), 0.15, 0, 0]; P.an = [lerp(0.3, -1.5, k), -0.15, 0, 0]; P.lean = 0.15 * k; P.yaw = fc * 1.25; }
        else spit(8);
        break;
      }
      case 'undertow': { const k = clamp01(t / 9); P.af = [lerp(-0.3, -1.4, k), 0.4, lerp(-0.6, 0.2, k), 0]; P.an = [0.4, -0.5, -0.4, 0]; P.lean = 0.15 * k; P.yaw = fc * 1.25; break; }
      case 'geyserrise': ARMS_UP(P, 2.8); P.sy = 1.06; P.slY = 0.1; P.srY = 0.1; break;
      case 'cradle': { const k = clamp01(t / 10); ARMS_UP(P, lerp(0.8, 2.6, k)); P.sy = 1 + 0.04 * k; break; }
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
      // --- Samurai Toad ---
      case 'windslash': P.af = [t < 9 ? -2.7 : lerp(-2.7, -0.3, clamp01((t - 9) / 4)), 0.3, 0, 0]; P.grip = t < 9 ? 1.3 : 0.4; P.lean = t >= 9 ? 0.35 : -0.12; P.an = [0.3, -0.4, -0.4, 0]; P.yaw = fc * 1.3; break;
      case 'quickdraw':
        if (t < 8) { P.sy = 0.9; P.lean = 0.3; P.af = [0.6, 0.4, -0.6, 0]; P.grip = 2.6; P.an = [-0.4, -0.3, -1.0, 0]; P.yaw = fc * 1.4; }
        else { dash(0.7); P.af = [-1.6, 0.7, 0, 0]; P.grip = 0.1; F.alpha = t < 16 ? 0.55 : 1; }
        break;
      case 'cranerise': ARMS_UP(P, 2.8); P.grip = 0.3; P.spin = t < 16 ? t * 0.6 : 0; P.slY = 0.15; P.srY = 0.1; break;
      case 'iaicounter':
        P.sy = 0.9; P.lean = 0.15; P.af = [0.5, 0.35, -0.7, 0]; P.grip = 2.5; P.an = [-0.5, -0.3, -1.2, 0];
        if (f.ctrT === 0 && t >= 3 && t <= 26) F.tint = [1, 0.75, 0.85, 0.3];
        if (f.ctrT > 0) { P.af = [-1.6, 0.3, 0, 0]; P.grip = 0.1; P.lean = 0.4; }
        break;
      // --- Viking Toad ---
      case 'axethrow': throwArm(-2.8, -0.9, 11); F.noProp = t >= 11 && t < 26; P.lean = t >= 11 ? 0.25 : -0.15; break;
      case 'shieldrush': P.an = [-1.45, -0.15, -0.1, 0]; F.shieldFwd = 1; P.lean = t >= 6 ? 0.45 : 0.05; P.af = [0.6, 0.3, -0.4, 0]; P.yaw = fc * 1.35; P.slZ = 0.15; P.srZ = -0.2; break;
      case 'berserk': P.spin = t * 0.7; P.af = [-1.5, 1.0, 0, 0]; P.grip = 0.6; P.an = [-1.4, -1.0, 0, 0]; F.mouthO = true; break;
      case 'warhorn': P.af = [-2.3, 0.45, -1.3, 0]; P.an = [0.2, -0.4, -0.4, 0]; P.hx = t >= 10 && t < 30 ? -0.28 : 0; F.horn = 1; F.noProp = true; P.sy = t >= 12 && t < 20 ? 1.05 : 1; break;
      // --- Pharaoh Toad ---
      case 'scarab': aim(); P.grip = 0.2; break;
      case 'sandsurge': P.af = [t < 10 ? -2.6 : -0.2, 0.2, 0, 0]; P.grip = t < 10 ? 1.4 : 0.3; P.lean = t >= 10 ? 0.4 : -0.1; P.an = [0.3, -0.4, -0.4, 0]; P.yaw = fc * 1.3; break;
      case 'sunrise': ARMS_UP(P, 2.9); P.grip = 0.2; P.sy = 1.06; F.tint = [1, 0.9, 0.5, 0.25]; break;
      case 'sarcophagus':
        P.an = [-0.9, -0.15, -1.9, 0]; P.af = [-0.9, 0.15, -1.9, 0]; P.grip = 1.6; F.sarco = f.ctrT === 0;
        if (f.ctrT > 0) { ARMS_UP(P, 2.4); P.lean = 0.3; }
        break;
      // --- Gladiator Toad ---
      case 'tridenttoss': throwArm(-2.7, -0.8, 12); F.noProp = t >= 12; P.lean = t >= 12 ? 0.3 : -0.2; break;
      case 'tridentlunge': P.af = [-1.55, 0.05, 0, 0]; P.grip = 0.08; P.an = [-0.4, -0.4, -0.6, 0]; P.lean = t >= 7 ? 0.5 : 0; P.yaw = fc * 1.4; P.slZ = 0.18; P.srZ = -0.22; break;
      case 'polevault':
        if (t < 8) { P.af = [-1.2, 0.2, 0, 0]; P.grip = 2.9; P.sy = 0.9; }
        else { ARMS_UP(P, 2.6); P.grip = 3.0; P.tumble = -fc * clamp01((t - 8) / 18) * Math.PI * 1.2; }
        break;
      case 'nettrap': P.lean = 0.3; P.an = [-0.8, -0.3, -0.5, 0]; P.af = [-0.8, 0.3, -0.5, 0]; P.grip = 2.8; break;
      // --- Buddhist Toad ---
      case 'chipalm': P.af = [t < 10 ? -0.6 : -1.6, 0.15, t < 10 ? -1.8 : 0, 0]; P.an = [-0.6, -0.3, -1.6, 0]; P.lean = t >= 10 ? 0.2 : -0.1; P.yaw = fc * 1.3; P.sy = 0.94; F.noProp = true; break;
      case 'staffwhirl': P.spin = t * 0.85; P.af = [-1.5, 0.9, 0, 0]; P.grip = 0.2; P.an = [-0.4, -0.6, -0.3, 0]; break;
      case 'lotusfloat': P.slY = 0.3; P.srY = 0.3; P.slZ = 0.2; P.srZ = 0.2; P.an = [-0.9, -0.35, -1.6, 0]; P.af = [-0.9, 0.35, -1.6, 0]; F.noProp = true; F.lotusSeat = 1; P.bob = Math.sin(t * 0.15) * 0.04; break;
      case 'stillmind':
        P.slY = 0.3; P.srY = 0.3; P.slZ = 0.2; P.srZ = 0.2; P.sy = 0.92; P.an = [-0.9, -0.35, -1.6, 0]; P.af = [-0.9, 0.35, -1.6, 0]; F.noProp = true;
        if (f.ctrT === 0 && t >= 3 && t <= 34) F.tint = [1, 0.95, 0.7, 0.3];
        if (f.ctrT > 0) { P.af = [-1.6, 0.3, 0, 0]; P.lean = 0.3; P.slY = P.srY = 0; P.slZ = P.srZ = 0; F.noProp = false; }
        break;
      // --- Muslim Toad ---
      case 'datetoss': throwArm(-2.6, -1.0, 8); F.dateHand = t < 8; break;
      case 'lantern': P.af = [t < 10 ? lerp(0.2, -1.4, t / 10) : -1.4, 0.15, 0, 0]; P.an = [0.3, -0.4, -0.4, 0]; F.lanternHand = t < 10; P.yaw = fc * 1.2; break;
      case 'lanternlift': P.af = [-2.95, 0.1, 0, 0]; P.an = [0.3, -0.5, -0.4, 0]; F.lanternUp = 1; P.slY = 0.08; P.srY = 0.04; break;
      case 'eidsweets': P.an = [-1.1, -0.2, -0.9, 0]; P.af = [t % 20 < 10 ? -2.0 : -1.2, 0.25, -1.4, 0]; P.hx = 0.1; F.sweets = 1; F.mouthO = t % 20 > 8 && t % 20 < 14; break;
      // --- Mormon Toad ---
      case 'jelly': throwArm(-2.7, -1.0, 9); F.jellyHand = t < 9; break;
      case 'bikeride': {
        const w = t * 0.6;
        F.bike = 1; P.bob = 0.32; P.lean = 0.2; P.an = [-1.3, -0.25, -0.3, 0]; P.af = [-1.3, 0.25, -0.3, 0]; P.yaw = fc * 1.4;
        P.slY = 0.12 + Math.max(0, Math.sin(w)) * 0.12; P.srY = 0.12 + Math.max(0, -Math.sin(w)) * 0.12; P.slZ = Math.cos(w) * 0.18 + 0.1; P.srZ = -Math.cos(w) * 0.18 + 0.1;
        break;
      }
      case 'highnote': ARMS_UP(P, 2.4); P.an[0] = -0.4; P.af[0] = -0.4; P.hx = -0.25; F.mouthO = true; P.sy = 1.05; break;
      case 'potluck': P.lean = 0.3; P.an = [-1.1, -0.3, -0.6, 0]; P.af = [-1.1, 0.3, -0.6, 0]; F.dishHand = t < 12; break;
      // --- Hasidic Toad ---
      case 'latke': throwArm(-2.4, -0.8, 7); P.yaw = fc * 1.3; break;
      case 'dreidel': P.spin = t * 1.0; ARMS_UP(P, 1.2); P.sy = 0.95; F.mouthO = true; break;
      case 'chairlift': F.chair = 1; P.bob = 0.3; P.slY = 0.28; P.srY = 0.28; P.slZ = 0.3; P.srZ = 0.3; ARMS_UP(P, 2.5 + Math.sin(t * 0.5) * 0.25); F.mouthO = true; break;
      case 'klezmer': F.clarinet = 1; P.an = [-1.6, -0.15, -1.0, 0]; P.af = [-1.4, 0.15, -1.3, 0]; P.hx = 0.25 + Math.sin(t * 0.5) * 0.08; P.side = Math.sin(t * 0.25) * 0.08; P.bob = Math.abs(Math.sin(t * 0.25)) * 0.04; break;
      // --- Subaru Toad (Beatrice casts Minya and Murak from the backpack) ---
      case 'minya': aim(); F.bkCast = 1; break;
      case 'shamac': P.an = [-1.5, -0.3, -0.3, 0]; P.af = [-1.5, 0.3, -0.3, 0]; P.lean = 0.12; P.yaw = fc * 1.3; F.mouthO = t > 8 && t < 18; break;
      case 'murak': ARMS_UP(P, 1.3); P.slY = 0.08; P.srY = 0.08; F.bkCast = 1; break;
      case 'unseenhand': P.af = [t < 10 ? lerp(0.3, -1.55, t / 10) : -1.55, 0.1, 0, 0]; P.an = [-1.2, -0.1, -1.7, 0]; P.hx = 0.15; P.lean = 0.12; P.yaw = fc * 1.3; F.hurt = t > 6 && t < 26; break;
      // --- Emilia Toad: ice magic ---
      case 'icesoldiers': { const k = clamp01(t / 10); P.an = [lerp(-0.4, -1.3, k), -0.9 * k, -0.2, 0]; P.af = [lerp(-0.4, -1.3, k), 0.9 * k, -0.2, 0]; P.sy = 1 + 0.04 * k; F.tint = [0.75, 0.93, 1, 0.3 * k]; F.mouthO = t > 8 && t < 16; break; }
      case 'icebrand': {
        const w = BRAND_W[f.wpn || 0];
        F.iceWpn = w;
        if (w === 'sword') { const k = clamp01((t - 5) / 7); P.af = [lerp(-2.6, -0.45, k), lerp(0.6, 0.15, k), 0, 0]; P.grip = 0.9; P.an = [0.4, -0.35, -0.5, 0]; P.lean = 0.2 * k; P.yaw = fc * (1.0 + 0.4 * k); }
        else if (w === 'axe') { P.spin = t >= 6 && t <= 22 ? ((t - 6) / 16) * Math.PI * 2 * -fc : 0; P.af = [-1.5, 1.2, 0, 0]; P.an = [-1.5, -1.2, 0, 0]; P.grip = 1.4; P.sy = 0.94; }
        else if (w === 'hammer') { if (t < 16) { ARMS_UP(P, lerp(1.2, 2.95, clamp01(t / 12))); P.grip = 0.3; P.hx = -0.15; P.lean = -0.12; P.sy = 1.04; } else { const k = clamp01((t - 16) / 5); P.af = [lerp(-2.95, -0.7, k), 0.15, 0, 0]; P.an = [lerp(-2.95, -0.7, k), -0.15, 0, 0]; P.grip = 0.3; P.lean = 0.45 * k; P.hx = 0.2 * k; P.sy = 1 - 0.08 * k; } F.mouthO = t >= 16 && t < 26; }
        else { if (t < 13) { P.af = [lerp(-0.6, 1.3, clamp01(t / 10)), 0.25, -0.4, 0]; P.grip = 1.6; P.lean = -0.15; P.yaw = fc * 1.25; } else { const k = clamp01((t - 13) / 4); P.af = [lerp(1.3, -1.6, k), 0.15, 0, 0]; P.lean = 0.2 * k; P.yaw = fc * 1.3; F.iceWpn = null; } P.an = [-0.4, -0.4, -0.6, 0]; }
        break;
      }
      case 'icepillar':
        if (f.t2) { ARMS_UP(P, 2.4 + Math.sin(t * 0.6) * 0.2); P.sy = 1.04; F.mouthO = true; }
        else { ARMS_UP(P, 0.9); P.slY = 0.16; P.srY = 0.16; P.sy = 1.06; F.tint = t < 12 ? [0.75, 0.93, 1, 0.3] : null; }
        break;
      case 'icebarrier': { const k = clamp01(t / 7); P.an = [lerp(0, -1.5, k), -0.3, -0.25, 0]; P.af = [lerp(0, -1.5, k), 0.3, -0.25, 0]; P.lean = 0.1 * k; P.yaw = fc * 1.25; F.tint = [0.75, 0.93, 1, 0.25 * k]; break; }
      // --- Dash Yoshi: speed ---
      case 'boomkick': if (t < 6) { P.srZ = -0.3; P.lean = 0.15; } else { P.srZ = 0.62; P.srY = 0.36; P.srR = -0.95; P.lean = -0.25; } P.an = [0.6, -0.5, -0.3, 0]; P.af = [0.6, 0.5, -0.3, 0]; P.yaw = fc * 1.3; break;
      case 'blitzdash': dash(0.85); P.hx = 0.25; F.alpha = t >= 2 && t < 12 ? 0.55 : 1; P.slZ = Math.sin(t * 2.4) * 0.4; P.srZ = -Math.sin(t * 2.4) * 0.4; break;
      case 'cycloneclimb': P.spin = t * 0.95; ARMS_UP(P, 1.6); P.slY = 0.12; P.srY = 0.12; break;
      case 'afterimage':
        F.alpha = t < 6 ? 1 - t / 6 : clamp01((t - 6) / 3);
        if (t >= 8) { P.srZ = 0.6; P.srY = 0.34; P.srR = -0.9; P.lean = -0.2; P.yaw = fc * 1.3; }
        break;
      // --- Mech Yoshi ---
      case 'blaster': P.af = [-1.55, 0.12, 0, 0]; P.an = [0.3, -0.35, -0.4, 0]; P.yaw = fc * 1.3; P.lean = t === 7 || t === 12 || t === 17 ? -0.12 : 0.05; break;
      case 'airdash': dash(0.75); F.jetBack = 1; break;
      case 'booster': ARMS_UP(P, 0.8); P.slY = 0.06; P.srY = 0.06; F.jetBack = t < 24; break;
      case 'bomblob': throwArm(-2.6, -0.6, 10); P.lean = -0.1; break;
      // --- Catholic Toad ---
      case 'kingsgift': throwArm(-2.7, -1.0, 9); F.giftHand = t < 9; break;
      case 'bellring': P.af = [t < 10 ? lerp(0.3, -2.5, t / 10) : lerp(-2.5, -1.1, clamp01((t - 10) / 4)), 0.2, 0, 0]; P.grip = 0.2; P.an = [0.3, -0.4, -0.4, 0]; P.lean = t >= 10 ? 0.3 : -0.1; P.yaw = fc * 1.3; F.bellHand = 1; break;
      case 'partypopper': ARMS_UP(P, 2.8); P.sy = 1.06; F.popper = t < 10; F.mouthO = t < 14; break;
      case 'pinata': P.af = [-1.5, 0.15, 0, 0]; P.an = [-1.3, -0.15, 0, 0]; P.hx = 0.1; P.yaw = fc * 1.2; F.pinataHand = t < 12; break;
      // --- Hindu Toad ---
      case 'colorthrow': throwArm(-2.6, -0.9, 8); F.gulalHand = t < 8; break;
      case 'dandiya': { const w = Math.sin(t * 1.1); P.spin = t * 0.75; P.an = [-1.6 - w * 0.4, -0.7, -0.6, 0]; P.af = [-1.6 + w * 0.4, 0.7, -0.6, 0]; P.bob = Math.abs(w) * 0.05; F.dandiya = 1; break; }
      case 'kitefly': P.af = [-2.95, 0.15, 0, 0]; P.an = [0.3, -0.5, -0.4, 0]; F.kite = 1; P.slY = 0.08; P.srY = 0.04; break;
      case 'pichkari': aim(); P.grip = 0.2; F.pichkari = 1; P.lean = t % 6 < 3 ? -0.04 : 0.06; break;
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
      case 'grace': P.an = [-0.75, -0.45, -1.45, 0]; P.af = [-0.75, 0.45, -1.45, 0]; P.hz += Math.sin(fr * 0.03 + f.i) * 0.04; break; // hands together at her chest
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
      // (slipped in Water Yoshi's puddle: flat on their face for a while)
      case 'stun': if (f.flat > 0) { P.tumble = (f.fc || 1) * 1.5; P.bob = -0.42; ARMS_UP(P, 2.8); F.hurt = true; break; } P.hz = Math.sin(fr * 0.2) * 0.25; P.an = [0, -0.3, 0, 0]; P.af = [0, 0.3, 0, 0]; F.hurt = true; break;
      case 'hit':
        F.hurt = true; F.mouthO = true;
        if (f.hs > 18) { ARMS_UP(P, 1.8); P.slY = 0.12; P.slZ = 0.1; P.srY = 0.12; P.srZ = -0.1; P.tumble = fr * 0.35 * (f.fc || 1); }
        else { P.hx = -0.3; P.lean = -0.25; P.an = [-0.6, -1.0, -0.4, 0]; P.af = [-0.6, 1.0, -0.4, 0]; P.slZ = 0.14; P.srZ = 0.06; } // a quick flinch
        break;
      case 'atk': attackPose(P, F, f, rig); break;
      case 'charge': chargePose(P, F, f, fr, rig); break;
      case 'taunt': tauntPose(P, F, f, fr); break;
      case 'spc': specialPose(P, F, f, fr, rig); break;
      // grabs: reach out with both hands, hold the foe up front, then throw
      case 'grab': {
        const t = f.t || 0, k = t < 6 ? t / 6 : t <= 10 ? 1 : Math.max(0, 1 - (t - 10) / 12);
        P.an = [lerp(0.3, -1.55, k), -0.28, -0.1, 0]; P.af = [lerp(0.3, -1.55, k), 0.28, -0.1, 0]; P.lean = 0.35 * k; P.yaw = (f.fc || 1) * (0.95 + 0.4 * k); P.slZ = 0.12 * k; P.srZ = -0.14 * k;
        break;
      }
      case 'hold': P.an = [-1.3, -0.4, -0.5, 0]; P.af = [-1.3, 0.4, -0.5, 0]; P.lean = 0.12; P.yaw = (f.fc || 1) * 1.3; P.bob = Math.abs(Math.sin(fr * 0.2)) * 0.02; F.mouthO = (f.t || 0) % 28 < 6; break;
      case 'held': {
        const w = Math.sin(fr * 0.9);
        F.hurt = true; F.mouthO = true; P.side = w * 0.06; ARMS_UP(P, 1.3 + w * 0.3); P.slZ = w * 0.15; P.srZ = -w * 0.15; P.slY = 0.08; P.srY = 0.08;
        if (f.t > 0) { P.hx = -0.35; P.lean = -0.3; } // flinching from a pummel
        break;
      }
      case 'throw': {
        const t = f.t || 0, fc = f.fc || 1;
        if (f.thr === 'b') { const k = clamp01(t / 10); P.yaw = t < 10 ? lerp(fc * 0.95, -fc * 0.95, k) : fc * 0.95; ARMS_UP(P, 1.5); P.lean = -0.1; }
        else if (f.thr === 'u') { ARMS_UP(P, lerp(1.2, 2.9, clamp01(t / 9))); P.sy = 1 + 0.06 * clamp01(t / 9); P.hx = -0.3; }
        else if (f.thr === 'd') { const k = clamp01(t / 9); P.lean = 0.55 * k; P.an = [lerp(-1.3, -0.2, k), -0.3, 0, 0]; P.af = [lerp(-1.3, -0.2, k), 0.3, 0, 0]; P.sy = t >= 8 && t <= 11 ? 0.9 : 1; }
        else { const k = clamp01(t / 6); P.lean = lerp(-0.2, 0.4, k); P.an = [lerp(0.4, -1.65, k), -0.2, 0, 0]; P.af = [lerp(0.4, -1.65, k), 0.2, 0, 0]; P.yaw = fc * 1.3; }
        F.mouthO = t >= 5 && t <= 12;
        break;
      }
    }
    // riding a cow: sit still in the saddle (the cow does the running)
    if (rig && rig.mount) { P.slY = P.srY = 0.05; P.slZ = P.srZ = 0; P.slR = P.srR = 0; if (f.st === 'run') { P.lean *= 0.4; P.bob = Math.abs(Math.sin(fr * 0.42)) * 0.03; P.an = [0.3, -0.5, -0.6, 0]; P.af = [0.3, 0.5, -0.6, 0]; } }
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
  const HELD = { cutlass: 1, sword: 1, pan: 1, wand: 1, raygun: 1, katana: 1, axe: 1, trident: 1, sunstaff: 1, bostaff: 1 };
  const HELD_S = { pan: 1.6, trident: 1.15, bostaff: 1.2, sunstaff: 1.3 };
  // Beatrice, riding in Subaru Toad's backpack: she rests her hands on the rim, and throws them up to cast
  let BEAKO = null;
  function beakoPose(F0, fr) {
    const P = pose0(1), F = { props: {}, mouthO: false, hurt: !!F0.hurt, tint: F0.tint || null, alpha: F0.alpha };
    P.yaw = 0; P.hz = Math.sin(fr * 0.05 + 1) * 0.12; P.hx = 0.06 + Math.sin(fr * 0.07) * 0.04;
    if (F0.bkCast) { ARMS_UP(P, 2.3); P.an[0] = -0.7; P.af[0] = -0.7; F.mouthO = fr % 16 < 10; }
    else { P.an = [-0.5, -0.55, -1.2, 0]; P.af = [-0.5, 0.55, -1.2, 0]; }
    F.blink = !F.hurt && (fr + 97) % 260 < 6;
    return { P, F };
  }
  const jitter = () => 0.8 + Math.random() * 0.5;
  function drawRig(rig, M0, P, F, fr, o) {
    const p = rig.parts, al = F.alpha != null ? F.alpha : 1;
    if (al <= 0.02) return;
    // (F.self makes the whole rig glow a little: Emilia Toad's ice soldiers)
    const d = al < 0.99 ? { tint: F.tint, alpha: al, self: F.self } : { tint: F.tint, self: F.self };
    const Mb = M4.chain(M0, M4.T(p.body.pivot[0], p.body.pivot[1], p.body.pivot[2]), M4.RX(P.lean), M4.RZ(P.side));
    G3.draw(p.body.mesh, Mb, d);
    if (p.cape) G3.draw(p.cape.mesh, Mb, d);
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
      // Dash Yoshi burns: flames on the crest and the tail tip; Mech Yoshi's back thrusters fire
      if (L.dash) {
        G3.draw(PROPS.flame, M4.chain(Mh, M4.T(0, 0.86, -0.3), M4.RX(Math.PI + 0.9), M4.S(0.42, 0.6 * jitter(), 0.42)), { self: 1, alpha: al < 0.99 ? al : undefined });
        G3.draw(PROPS.flame, M4.chain(Mb, M4.T(0, -0.1, -0.84), M4.RX(Math.PI / 2 + 0.2), M4.S(0.4, 0.55 * jitter(), 0.4)), { self: 1, alpha: al < 0.99 ? al : undefined });
      }
      if (L.mech && F.jetBack) for (const sx of [-1, 1]) G3.draw(PROPS.flame, M4.chain(Mb, M4.T(0.15 * sx, 0.2, -0.42), M4.S(0.5, 0.75 * jitter(), 0.5)), { self: 1 });
      // Yoshi's Egg Smash: the egg held up overhead before it comes down
      if (F.eggHold) G3.draw(PROJ.egg, M4.chain(Mh, M4.T(0, 0.78, 0.12), M4.S(2.2, 2.2, 2.2)), d);
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
        const ws = HELD_S[rig.prop] || 1.45, Mw = M4.chain(Mhand, M4.RX(P.grip), M4.S(ws, ws, ws));
        if (rig.look && rig.look.mech) G3.draw(PROPS.mechgun, Mhand, d);
        if (F.dateHand) G3.draw(PROJ.date, M4.chain(Mhand, M4.T(0, 0.04, 0), M4.S(1.4, 1.4, 1.4)), d);
        if (F.jellyHand) G3.draw(PROJ.jelly, M4.chain(Mhand, M4.T(0, 0.08, 0), M4.S(1.2, 1.2, 1.2)), d);
        if (F.lanternHand) G3.draw(PROJ.lantern, M4.chain(Mhand, M4.T(0, -0.2, 0), M4.S(1.3, 1.3, 1.3)), { self: 0.6, tint: d.tint, alpha: d.alpha });
        if (F.dishHand) G3.draw(TRAP.casserole, M4.chain(Mhand, M4.T(0, 0.06, 0.1), M4.S(0.32, 0.32, 0.32)), d);
        if (F.giftHand) G3.draw(PROJ.gift, M4.chain(Mhand, M4.T(0, 0.12, 0), M4.S(1.3, 1.3, 1.3)), d);
        if (F.siphon) G3.draw(PROPS.siphon, M4.chain(Mhand, M4.S(1.6, 1.6, 1.6)), d);
        if (F.geltBag) G3.draw(PROPS.geltbag, M4.chain(Mhand, M4.T(0, 0.06, 0.05), M4.S(1.5, 1.5, 1.5)), d);
        if (F.bombHand) G3.draw(PROJ.bomb, M4.chain(Mhand, M4.T(0, 0.12, 0), M4.S(1.15, 1.15, 1.15)), d);
        if (F.bellHand) G3.draw(PROPS.handbell, M4.chain(Mhand, M4.RX(P.grip), M4.S(1.5, 1.5, 1.5)), d);
        if (F.gulalHand) G3.draw(PROJ.haze, M4.chain(Mhand, M4.T(0, 0.08, 0), M4.S(0.18, 0.18, 0.18)), { tint: [1, 0.3, 0.65, 0.9], alpha: 0.85 });
        if (F.dandiya) G3.draw(PROPS.dandiya, M4.chain(Mhand, M4.S(1.4, 1.4, 1.4)), d);
        if (F.pichkari) G3.draw(PROPS.pichkari, M4.chain(Mhand, M4.S(1.4, 1.4, 1.4)), d);
        if (HELD[rig.prop] && !F.props.pick && !F.noProp) {
          G3.draw(PROPS[rig.prop], Mw, d);
          if (rig.prop === 'wand') G3.draw(PROPS.wandStar, M4.chain(Mw, M4.T(0, 0.44, 0), M4.RZ(fr * 0.08), M4.S(0.26, 0.26, 0.26), M4.T(0, -0.42, 0)), { self: F.wandGlow ? 1 : 0.45 });
          if (F.panCake) G3.draw(PROJ.pancake, M4.chain(Mw, M4.T(0, 0.52, 0.06), M4.RX(Math.PI / 2), M4.S(0.8, 0.8, 0.8)), d);
        }
        if (F.popgun) G3.draw(PROPS.popgun, Mw, d);
        if (F.pillHand) G3.draw(PROPS.pill, M4.chain(Mhand, M4.T(0, 0.02, 0)), d);
        // Emilia Toad's ice weapons (and an ice soldier's blade or axe) glow a little
        const ice = { tint: d.tint, alpha: d.alpha, self: 0.35 };
        if (F.iceWpn) G3.draw(PROPS['ice_' + F.iceWpn], M4.chain(Mhand, M4.RX(P.grip), M4.S(1.45, 1.45, 1.45)), ice);
        if (F.iceDual) G3.draw(PROPS.ice_blade, M4.chain(Mhand, M4.RX(P.grip), M4.S(1.45, 1.45, 1.45)), ice);
      } else {
        if (F.iceDual) G3.draw(PROPS.ice_blade, M4.chain(Mhand, M4.RX(P.grip), M4.S(1.45, 1.45, 1.45)), { tint: d.tint, alpha: d.alpha, self: 0.35 });
        if (F.props.parasol) { const w = 0.2 + 0.8 * (F.props.parasol === true ? 1 : F.props.parasol); G3.draw(PROPS.parasol, M4.chain(Mhand, M4.S(w, 1, w)), d); }
        if (F.dandiya) G3.draw(PROPS.dandiya, M4.chain(Mhand, M4.S(1.4, 1.4, 1.4)), d);
        // Knight Toad's shield rides the near forearm, turning to face forward when raised
        if (rig.shield) { const s = F.shieldFwd || 0; G3.draw(rig.shield === 'round' ? PROPS.roundShield : PROPS.shield, M4.chain(Mf, M4.T(lerp(-0.12, 0, s), rig.handY + lerp(0.08, -0.12, s), 0.02), M4.RZ((s * Math.PI) / 2)), d); }
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
    if (F.cart === 2) G3.draw(PROPS.longship, M4.chain(M0, M4.T(0, -P.bob - 0.2, 0), M4.S(1.6, 1.6, 1.6)), { inkW: 0.06 / 1.6 });
    else if (F.cart) G3.draw(PROPS.cart, M4.chain(M0, M4.RY(Math.PI / 2), M4.T(0, -0.1, 0), M4.S(1.5, 1.5, 1.5)));
    // the newer Toads' special-move gear
    if (F.horn) G3.draw(PROPS.warhorn, M4.chain(Mh, M4.T(0.04, -0.02, 0.38)), d);
    if (F.clarinet) G3.draw(PROPS.clarinet, M4.chain(Mh, M4.T(0.02, -0.04, 0.4)), d);
    if (F.bike) G3.draw(PROPS.bike, M4.chain(M0, M4.T(0, -P.bob, 0)), d);
    if (F.chair) G3.draw(PROPS.chair, M4.chain(M0, M4.T(0, -0.02, -0.08)), d);
    if (F.sweets) G3.draw(PROPS.sweets, M4.chain(Mb, M4.T(-0.08, 0.22, 0.52)), d);
    if (F.sarco) G3.draw(PROPS.sarco, M0, d);
    if (F.lotusSeat) G3.draw(FXM.lotus, M4.chain(M0, M4.T(0, -P.bob + 0.04, 0), M4.S(0.75, 0.75, 0.75)), { self: 0.25, tint: d.tint, alpha: d.alpha });
    if (F.lanternUp) G3.draw(PROJ.lantern, M4.chain(M0, M4.T(0, 2.95 + Math.sin(fr * 0.3) * 0.04, 0.12), M4.S(2.4, 2.4, 2.4)), { self: 0.7 });
    // a party popper blasts him upward; a festival kite flies high above on its string
    if (F.popper) G3.draw(PROPS.popper, M4.chain(M0, M4.T(0, -0.55, 0), M4.S(1.6, 1.6, 1.6)), d);
    // the piñata, held out in front by its string before he hangs it up
    if (F.pinataHand) G3.draw(TRAP.pinata, M4.chain(M0, M4.T(0, 0.72, 0.8), M4.S(0.5, 0.5, 0.5)), d);
    if (F.kite) {
      const sw = Math.sin(fr * 0.12) * 0.25;
      G3.draw(PROPS.kite, M4.chain(M0, M4.T(0.25 + sw * 0.4, 4.2, 0.2), M4.RY(-P.yaw), M4.RZ(sw), M4.S(2.4, 2.4, 2.4)), d);
      const sx0 = 0.12, sy0 = 2.25, ex = 0.25 + sw * 0.4, ey = 3.1, L = Math.hypot(ex - sx0, ey - sy0);
      G3.draw(PROPS.string, M4.chain(M0, M4.T(sx0, sy0, 0.17), M4.RZ(-Math.asin((ex - sx0) / L)), M4.S(1, L, 1)), d);
    }
    // Subaru Toad's backpack: Beatrice sits in the carrier and turns to look out at you
    if (rig.look && rig.look.beako && BEAKO) {
      const bp = beakoPose(F, fr), s = 0.42;
      drawRig(BEAKO, M4.chain(Mb, M4.T(0, -0.21 + Math.abs(Math.sin(fr * 0.09)) * 0.012, -0.86), M4.RY(-P.yaw * 0.85), M4.S(s, s, s)), bp.P, bp.F, fr);
    }
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
    if (f.bfz > 0 && !(f.frz > 0)) F.tint = [0.7, 0.92, 1, 0.12 + 0.5 * f.bfz]; // frosting over in the Beast of the End's storm
    if (f.slow > 0 && !F.tint) F.tint = [0.72, 0.9, 1, 0.2 + 0.08 * Math.sin(fr * 0.3)]; // chilled by Emilia Toad's ice
    // Water Yoshi's statuses: Scalded glows a hot red, Sunk a soaked blue
    if (f.scald > 0 && !F.tint) F.tint = [1, 0.42, 0.28, 0.2 + 0.07 * Math.sin(fr * 0.35)];
    if (f.sunk > 0 && !F.tint) F.tint = [0.28, 0.52, 1, 0.24];
    if (f.prT > 0) F.tint = [0.8, 0.97, 1, 0.65 * (f.prT / 16)]; // a parry flashes white-blue
    if (rig.ghost && F.alpha == null) F.alpha = 0.88;
    if (f.hide > 0) F.alpha = 0.07; // haunting: all but invisible
    if (f.fade != null && f.fade < 1) F.alpha = (F.alpha == null ? 1 : F.alpha) * f.fade; // title parade fading in and out
    const unit = (((C.drawH || C.h) * 1.05) * PX) / rig.h, scale = unit * (f.sc || 1) * (f.pe > 0 ? 1.06 : 1);
    const X = f.x * PX, Y = -f.y * PX;
    if (rig.mount) {
      // Moo Toad: the cow and her rider turn and tumble together; the Toad sits in the saddle
      const fc = f.fc || 1, cyaw = fc * 1.15, pv = 0.9 * scale, al = F.alpha != null ? F.alpha : 1;
      const Mcow = M4.chain(M4.T(X, Y, 0), M4.T(0, pv, 0), M4.RZ(P.tumble), M4.T(0, -pv, 0), M4.RY(cyaw), M4.S(scale, scale, scale));
      const legs = f.st === 'run' ? 'run' : f.gi < 0 && f.st !== 'ledge' ? 'air' : f.st === 'atk' && (f.at === 'bair' || f.at === 'dsmash') ? 'kick' : 'idle';
      drawCow(M4.chain(Mcow, M4.S(COW_K, COW_K, COW_K)), fr * 0.42 + f.i * 1.7, legs, fr, al < 0.99 ? { tint: F.tint, alpha: al } : { tint: F.tint });
      drawRig(rig, M4.chain(Mcow, M4.T(0, COW_SADDLE * COW_K, -0.05), M4.RY(P.yaw + P.spin - cyaw), M4.S(P.sx, P.sy, P.sx), M4.T(0, P.bob, 0)), P, F, fr);
      if (f.st === 'shield') { const r = (f.h * 0.62 * PX) * (0.45 + 0.55 * ((f.shd || 100) / 100)); G3.draw(PROJ.ball, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(r, r, r)), { alpha: 0.32, tint: [...hexF(SLOT_COLORS[f.i]), 0.6], self: 0.4 }); }
      if (f.frz > 0) G3.draw(PROJ.ice3, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(f.w * 0.75 * PX, f.h * 0.6 * PX, 0.9)), { alpha: 0.4, self: 0.5 });
      if (f.rp > 0) G3.draw(PROJ.halo, M4.chain(M4.T(X, Y - 0.06, 0), M4.S(1.5, 1, 0.8)), { self: 0.3 });
      return;
    }
    // Yoshi's Egg Roll: curl up inside a big rolling egg
    if (F.egg) {
      const s = 6 * F.egg * (f.sc || 1);
      G3.draw(PROJ.egg, M4.chain(M4.T(X, Y + 0.22 * s, 0.1), M4.RZ(-(f.t || 0) * 0.22 * (f.fc || 1)), M4.S(s, s, s)), F.egg < 1 ? { alpha: 0.5 + 0.5 * F.egg } : null);
      if (F.egg >= 1) return;
    }
    drawRig(rig, rootMatrix(X, Y, P, scale), P, F, fr);
    // Water Yoshi's Current: a thin water aura that starts to glow at 20%, glows brighter as it builds, and shines at 100%
    if (f.cur > 0) {
      const k = clamp01(f.cur / 100), full = k >= 1, s = 1 + 0.03 * Math.sin(fr * 0.15);
      const glow = full ? 0.9 + 0.1 * Math.sin(fr * 0.4) : k < 0.2 ? 0.04 : 0.15 + 0.7 * ((k - 0.2) / 0.8);
      G3.draw(PROJ.ball, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(f.w * 0.95 * PX * s, f.h * 0.62 * PX * s, 0.95 * s)),
        { alpha: 0.08 + 0.16 * k + (full ? 0.08 * Math.sin(fr * 0.3) : 0), tint: [0.45, 0.85, 1, 0.9], self: glow });
    }
    // Emilia Toad's spirit Puck floats behind her
    if (rig.look && rig.look.puck && f.pkx != null) drawPuck(f, fr);
    if (f.rp > 0) G3.draw(PROJ.halo, M4.chain(M4.T(X, Y - 0.06, 0), M4.S(1.15, 1, 0.7)), { self: 0.3 });
    if (f.st === 'shield') { const r = (f.h * 0.62 * PX) * (0.45 + 0.55 * ((f.shd || 100) / 100)); G3.draw(PROJ.ball, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(r, r, r)), { alpha: rig.shield ? 0.16 : 0.32, tint: [...hexF(SLOT_COLORS[f.i]), 0.6], self: 0.4 }); }
    if (f.frz > 0) G3.draw(PROJ.ice3, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(f.w * 0.75 * PX, f.h * 0.6 * PX, 0.9)), { alpha: 0.4, self: 0.5 });
    // ice creeping over a fighter in the Beast of the End's storm, thicker as they freeze
    else if (f.bfz > 0.35) { const k = (f.bfz - 0.35) / 0.65; G3.draw(PROJ.ice3, M4.chain(M4.T(X, Y + f.h * 0.5 * PX, 0), M4.S(f.w * 0.75 * PX * (0.6 + 0.4 * k), f.h * 0.6 * PX * (0.5 + 0.5 * k), 0.9)), { alpha: 0.12 + 0.28 * k, self: 0.5 }); }
  }
  // the Beast of the End, risen behind the middle of the stage (sy = the stage's top): it rises, breathes, roars
  // (rearing its head back) and sinks away at the end. Its eyes glow
  function drawBeast(e, fr, sy) {
    const t = e.t || 0, R = 30, ROAR = 110, SINK = 1520, GONE = 1600, ez = q => 1 - Math.pow(1 - clamp01(q), 3);
    const up = t < R ? 0 : t < ROAR ? ez((t - R) / (ROAR - R)) : t < SINK ? 1 : 1 - ez((t - SINK) / (GONE - SINK - 10));
    if (up <= 0.001) return;
    const sc = 7.4, br = 1 + Math.sin(fr * 0.05) * 0.015, roar = t >= ROAR && t < ROAR + 70 ? Math.sin(((t - ROAR) / 70) * Math.PI) : 0;
    const y = sy - 250 * up + 820 * (1 - up);
    const M = M4.chain(M4.T(e.x * PX, -y * PX, -12), M4.RX(-0.05 - roar * 0.16), M4.S(sc * (1 + roar * 0.04), sc * br, sc * 0.5));
    G3.draw(PUCK.beast, M, { inkW: 0.012 });
    G3.draw(PUCK.beastEyes, M, { self: 1, ink: false });
  }
  function hexF(h) { const c = B.hex(h); return [c[0] / 255, c[1] / 255, c[2] / 255]; }
  // Buttercup the cow at matrix M (feet on the ground, facing +z). legs: 'run' gallops, 'air' tucks, 'kick' bucks the back legs
  // COW_K: the cow is drawn this much bigger than the rider's units
  const COW_SADDLE = 1.35, COW_K = 1.4, COW_HIPS = [[-0.24, 0.74, 0.55, 0], [0.24, 0.74, 0.55, Math.PI], [-0.24, 0.74, -0.55, Math.PI], [0.24, 0.74, -0.55, 0]];
  function drawCow(M, ph, legs, fr, d) {
    const run = legs === 'run', s = Math.sin(ph), bob = run ? Math.abs(s) * 0.05 : 0;
    const Mb = M4.chain(M, M4.T(0, bob, 0));
    G3.draw(PROPS.cowBody, Mb, d);
    COW_HIPS.forEach(([x, y, z, off], n) => {
      const front = z > 0;
      const a = run ? Math.sin(ph + off) * 0.75 : legs === 'air' ? (front ? -0.55 : 0.55) : legs === 'kick' && !front ? 1.25 : Math.sin(fr * 0.05 + n) * 0.04;
      G3.draw(PROPS.cowLeg, M4.chain(Mb, M4.T(x, y, z), M4.RX(a)), d);
    });
    G3.draw(PROPS.cowTail, M4.chain(Mb, M4.T(0, 1.12, -0.84), M4.RX(0.35 + (run ? 0.5 : 0)), M4.RZ(Math.sin(fr * 0.15) * 0.45)), d);
  }
  // Puck at his spot behind Emilia Toad (smoothed here too, so he glides on a guest's screen): bobbing, swishing
  // his tail, and holding his paws out with a snowflake between them while he fires
  const PMEM = {};
  function drawPuck(f, fr) {
    let m = PMEM[f.i];
    if (!m || Math.hypot(m.x - f.pkx, m.y - f.pky) > 200) m = PMEM[f.i] = { x: f.pkx, y: f.pky };
    m.x += (f.pkx - m.x) * 0.5; m.y += (f.pky - m.y) * 0.5;
    const s = 0.95, fc = f.fc || 1, shoot = (f.pkt == null ? 99 : f.pkt) < 34, al = f.hide > 0 ? 0.07 : undefined;
    const M = M4.chain(M4.T(m.x * PX, -m.y * PX - 0.5, -0.35), M4.RY(fc * 0.45 + Math.sin(fr * 0.04) * 0.15), M4.RZ(Math.sin(fr * 0.05) * 0.06), M4.S(s, s, s));
    const o = { inkW: 0.06 / s, self: 0.18, alpha: al };
    G3.draw(PUCK.body, M, o);
    for (const [nm, sx] of [['armL', -1], ['armR', 1]]) G3.draw(PUCK[nm], M4.chain(M, M4.T(0.22 * sx, 0.62, 0.04), M4.RX(shoot ? -1.45 : -0.25), M4.RZ(sx * (shoot ? 0.25 : 0.35))), o);
    G3.draw(PUCK.tail, M4.chain(M, M4.T(0.1, 0.22, -0.2), M4.RZ(-0.5 + Math.sin(fr * 0.09) * 0.35), M4.RX(-0.3)), o);
    if (shoot && !al) G3.draw(PROJ.puckpel, M4.chain(M, M4.T(0, 0.45, 0.45), M4.RZ(fr * 0.2), M4.S(0.9, 0.9, 0.9)), { self: 0.8 });
  }
  // Emilia Toad's Ice Soldiers: Subaru Toad made of ice, with two ice blades or a great ice axe
  function drawIceSoldier(p, fr) {
    const rig = MINIONS.icesoldier, fc = p.fc || 1, t = p.mt || 0, ms = p.ms || 'idle', blades = p.wp === 'blades';
    const P = pose0(fc), F = { props: {}, mouthO: false, hurt: false, tint: [0.62, 0.87, 1, 0.6], self: 0.22 };
    if (blades) F.iceDual = true; else F.iceWpn = 'axe';
    switch (ms) {
      case 'run': {
        const s = Math.sin(fr * 0.42 + p.id), c = Math.cos(fr * 0.42 + p.id);
        P.lean = 0.2; P.bob = Math.abs(s) * 0.07; P.slY = Math.max(0, c) * 0.13; P.slZ = s * 0.24; P.slR = -s * 0.5; P.srY = Math.max(0, -c) * 0.13; P.srZ = -s * 0.24; P.srR = s * 0.5;
        P.an = [-0.9, -0.25, -0.5, 0]; P.af = [-0.9, 0.25, -0.5, 0]; P.grip = 1.4;
        break;
      }
      case 'air': P.slY = 0.12; P.srY = 0.08; P.an = [-0.5, -0.9, -0.4, 0]; P.af = [-0.5, 0.9, -0.4, 0]; P.grip = 1.2; break;
      case 'hurt': P.hx = -0.3; P.lean = -0.25; P.an = [-0.6, -1.0, -0.4, 0]; P.af = [-0.6, 1.0, -0.4, 0]; F.hurt = true; F.tint = [0.88, 0.97, 1, 0.78]; break;
      // its moves: an ice dash (leaning in, weapons trailing), a low slide (feet first), a leap (arms up)
      case 'dash': P.lean = 0.5; P.an = [0.7, -0.5, -0.3, 0]; P.af = [0.7, 0.5, -0.3, 0]; P.slZ = -0.2; P.srZ = 0.25; P.slY = 0.1; F.tint = [0.8, 0.95, 1, 0.7]; F.self = 0.4; break;
      case 'slide': P.sy = 0.72; P.lean = -0.55; P.slZ = 0.42; P.srZ = 0.3; P.slY = 0.06; P.an = [0.3, -1.1, -0.3, 0]; P.af = [0.3, 1.1, -0.3, 0]; F.tint = [0.8, 0.95, 1, 0.7]; break;
      case 'leap': ARMS_UP(P, 2.6); P.slY = 0.22; P.srY = 0.16; P.grip = 0.6; F.self = 0.35; break;
      case 'blink': if (t < 8) return; F.tint = [0.92, 0.99, 1, 0.85]; F.self = 0.6; break; // (gone while it blinks over)
      case 'atk':
        if (blades) {
          // two quick slashes, one with each blade
          const q1 = clamp01((t - 6) / 4), q2 = clamp01((t - 14) / 4);
          P.af = [lerp(-2.4, -0.5, q1), 0.3, 0, 0]; P.an = [t < 14 ? -0.6 : lerp(-2.4, -0.5, q2), -0.3, 0, 0]; P.grip = 0.9; P.lean = 0.15; P.yaw = fc * 1.2;
        } else if (t < 13) { ARMS_UP(P, lerp(1.0, 2.9, clamp01(t / 10))); P.grip = 0.3; P.lean = -0.12; P.yaw = fc * 1.25; }
        else { const k = clamp01((t - 13) / 4); P.af = [lerp(-2.9, -0.6, k), 0.2, 0, 0]; P.an = [lerp(-2.9, -0.6, k), -0.2, 0, 0]; P.grip = 0.3; P.lean = 0.4 * k; P.yaw = fc * 1.25; } // a big overhead chop
        break;
      default: P.an = [-0.9, -0.25, -0.5, 0]; P.af = [-0.9, 0.25, -0.5, 0]; P.grip = 1.4; P.bob = Math.abs(Math.sin(fr * 0.12 + p.id)) * 0.04; P.lean = 0.08;
    }
    // rising up out of the ice when summoned
    const grow = ms === 'spawn' ? clamp01(t / 22) : ms === 'blink' ? clamp01((t - 7) / 6) : 1, scale = ((62 * 0.9 * PX) / rig.h) * (0.25 + 0.75 * grow);
    drawRig(rig, rootMatrix(p.x * PX, -p.y * PX, P, scale), P, F, fr, {
      extraProp: Mb => { for (const [x, z, a] of [[-0.38, -0.02, 0.6], [0.38, -0.02, -0.6], [0, -0.42, 0]]) G3.draw(PROPS.ice_spike, M4.chain(Mb, M4.T(x, 0.44, z), M4.RZ(a)), { self: 0.4 }); },
    });
  }
  // a small Toad Brigade helper (projectile kind 'minion')
  function drawMinion(p, fr) {
    if (p.sub === 'icesoldier') return drawIceSoldier(p, fr);
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
    if (e.sub === 'cows') {
      // Moo Toad's Cattle Stampede: a herd of cows with cheering Toad riders
      for (const [x0, dir] of fronts) for (let k = 0; k < 6; k++) {
        const x = x0 - dir * (k * 56 + (k % 2) * 14), rig = CROWD[(k + (dir > 0 ? 0 : 3)) % CROWD.length], sc = (46 * 1.05 * PX) / rig.h;
        const Mcow = M4.chain(M4.T(x * PX, -sy * PX, CROWD_Z[k]), M4.RY(dir * 1.35), M4.S(sc, sc, sc));
        drawCow(M4.chain(Mcow, M4.S(COW_K, COW_K, COW_K)), fr * 0.6 + k * 1.1, 'run', fr, {});
        const P = pose0(dir), F = { props: {}, mouthO: k % 2 === 0, hurt: false, tint: null };
        ARMS_UP(P, 2.4 + Math.sin(fr * 0.4 + k) * 0.3); P.slY = P.srY = 0.05; P.yaw = 0;
        drawRig(rig, M4.chain(Mcow, M4.T(0, COW_SADDLE * COW_K, -0.05)), P, F, fr);
      }
      return;
    }
    // Legion March: Gladiator Toad's Roman soldiers march in step behind big red shields.
    // Christmas Parranda: a parade of Toads dances across shaking maracas
    const legion = e.sub === 'legion', parranda = e.sub === 'parranda';
    if (parranda) {
      for (const [x0, dir] of fronts) for (let k = 0; k < 7; k++) {
        const rig = CROWD[(k + 2) % CROWD.length], ph = fr * 0.6 + k * 1.1, s = Math.sin(ph), x = x0 - dir * (k * 32 + (k % 2) * 12);
        const P = pose0(dir), F = { props: {}, mouthO: k % 2 === 0, hurt: false, tint: null };
        P.lean = 0.15; P.bob = Math.abs(s) * 0.16; P.slY = Math.max(0, s) * 0.18; P.srY = Math.max(0, -s) * 0.18; P.yaw = dir * 1.0;
        P.an = [0, -1.45 + s * 0.3, 0, 0]; P.af = [0, 1.45 - s * 0.3, 0, 0];
        const scale = (62 * 0.86 * PX) / rig.h;
        drawRig(rig, M4.chain(M4.T(0, 0, CROWD_Z[k]), rootMatrix(x * PX, -sy * PX, P, scale)), P, F, fr, {
          extraProp: Mb => { for (const sx of [-1, 1]) G3.draw(PROPS.maraca, M4.chain(Mb, M4.T(0.86 * sx, 0.4 + s * sx * 0.06, 0.05), M4.RZ(sx * (0.3 + s * 0.4)), M4.S(1.6, 1.6, 1.6))); },
        });
      }
      return;
    }
    for (const [x0, dir] of fronts) for (let k = 0; k < 7; k++) {
      const rig = guards ? MINIONS.guard : legion ? MINIONS.legion : yo ? YCROWD[(k * 3 + (dir > 0 ? 0 : 5)) % YCROWD.length] : CROWD[(k + (dir > 0 ? 0 : 3)) % CROWD.length];
      if (!rig) continue;
      const ph = legion ? fr * 0.35 : fr * 0.55 + k * 1.3, s = Math.sin(ph), c = Math.cos(ph), x = x0 - dir * (k * (legion ? 38 : 30) + (k % 2) * 10);
      const P = pose0(dir), F = { props: {}, mouthO: legion ? s > 0.6 : k % 3 === 0, hurt: false, tint: null };
      P.lean = legion ? 0.12 : 0.28; P.bob = Math.abs(s) * (legion ? 0.06 : 0.12); P.slY = Math.max(0, c) * 0.15; P.slZ = s * 0.28; P.slR = -s * 0.5; P.srY = Math.max(0, -c) * 0.15; P.srZ = -s * 0.28; P.srR = s * 0.5;
      const armed = guards || legion;
      P.an = armed ? [-0.9, -0.2, -0.4, 0] : [s * 1.1, -0.2, -0.55, 0]; P.af = armed ? [-1.2, 0.2, -0.3, 0] : [-s * 1.1, 0.2, -0.55, 0]; P.yaw = dir * 1.25;
      const scale = ((yo ? 66 : 62) * 0.86 * PX) / rig.h;
      drawRig(rig, M4.chain(M4.T(0, 0, CROWD_Z[k]), rootMatrix(x * PX, -sy * PX, P, scale)), P, F, fr, guards ? {
        extraProp: (Mb, Mh) => {
          G3.draw(PROPS.helmet, M4.chain(Mh, M4.T(CAP_TOP[0], CAP_TOP[1] - 0.5, CAP_TOP[2]), M4.S(1.7, 1.2, 1.7)));
          G3.draw(PROPS.spear, M4.chain(Mb, M4.T(0.45, 0.15, 0.3), M4.RX(1.1)));
        },
      } : legion ? {
        extraProp: Mb => {
          G3.draw(PROPS.scutum, M4.chain(Mb, M4.T(-0.05, 0.05, 0.55), M4.S(1.5, 1.5, 1.5)));
          G3.draw(PROPS.spear, M4.chain(Mb, M4.T(0.45, 0.2, 0.2), M4.RX(0.25)));
        },
      } : null);
    }
  }
  // Grand Choir: a choir of Toads in blue robes on risers behind the stage, singing out with every shockwave
  function drawChoir(e, sy, fr) {
    CHOIR.forEach((rig, k) => {
      const P = pose0(1), F = { props: {}, mouthO: true, hurt: false, tint: null }, row = k % 2, x = (k - 3) * 62;
      const pump = [22, 52, 82, 112].reduce((a, t0) => a + Math.max(0, 1 - Math.abs(e.t - t0) / 8), 0);
      P.yaw = 0; P.hx = -0.1 - pump * 0.2; P.sy = 1 + pump * 0.05; P.side = Math.sin(fr * 0.08 + k) * 0.04;
      P.an = [-1.0, -0.25, -1.2, 0]; P.af = [-1.0, 0.25, -1.2, 0];
      F.blink = false;
      drawRig(rig, M4.chain(M4.T(0, 0, -2.6 - row * 1.1), rootMatrix(x * PX, -(sy - 40 - row * 46) * PX, P, (62 * 0.9 * PX) / rig.h)), P, F, fr);
    });
  }
  // Mazel Tov!: wedding guests of every colour dance in a ring around the Hasidic Toad
  function drawHora(e, own, fr) {
    if (!own) return;
    const n = 8, R = 3.1, cx = own.x * PX, cy = -own.y * PX;
    for (let k = 0; k < n; k++) {
      const a = fr * 0.045 + (k / n) * Math.PI * 2, rig = CROWD[k % CROWD.length], ph = fr * 0.3 + k;
      const P = pose0(1), F = { props: {}, mouthO: k % 2 === 0, hurt: false, tint: null };
      P.yaw = -a; P.bob = Math.abs(Math.sin(ph)) * 0.14; P.slY = Math.max(0, Math.sin(ph)) * 0.18; P.srY = Math.max(0, -Math.sin(ph)) * 0.18;
      ARMS_UP(P, 2.2 + Math.sin(ph) * 0.25);
      drawRig(rig, M4.chain(M4.T(cx + Math.cos(a) * R, cy, Math.sin(a) * R * 0.55), rootMatrix(0, 0, P, (62 * 0.85 * PX) / rig.h)), P, F, fr);
    }
  }
  // portrait / attract helpers draw a rig at an arbitrary pose without a sim fighter
  function drawPreview(id, M0, fr, st) {
    const rig = RIGS[id]; if (!rig) return;
    const f = { ch: id, i: 9, fc: 1, st: st || 'idle', t: fr, gi: 0 }, { P, F } = targetPose(f, fr, rig);
    if (id === 'toadsworth') F.props.cane = true;
    F.blink = false;
    // Moo Toad's portrait shows Buttercup below, turned side-on
    if (rig.mount) drawCow(M4.chain(M0, M4.T(0, -COW_SADDLE * COW_K, 0.05), M4.RY(0.95), M4.S(COW_K, COW_K, COW_K)), 0, 'idle', fr, {});
    drawRig(rig, M4.chain(M0, M4.RY(P.spin), M4.T(0, P.bob, 0)), Object.assign(P, { yaw: 0 }), F, fr);
  }
  return { PX, build, RIGS, ITEM, PROJ, PROPS, KARTS, TRAP, FXM, drawFighter, drawMinion, drawBeast, drawCrowd, drawChoir, drawHora, drawRig, drawPreview, rootMatrix, pose0, targetPose, MEM, hexF, hueTint, CAP_TOP };
})();
