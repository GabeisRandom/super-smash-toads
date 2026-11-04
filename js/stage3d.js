'use strict';
// ===== S3D: the four stages as folded-paper 3D sets, aligned with the 2D physics surfaces =====
const S3D = (() => {
  const B = G3.B, M4 = G3.M4, PX = 1 / 28, VARY = 0.05;
  const cache = {};
  function mesh(build, o) { B.start(); build(); const tris = B.take(); for (const t of tris) if (t.vary == null) t.vary = VARY; return G3.compile(tris, o); }
  const toW = (x, y) => [x * PX, -y * PX];
  function capPlat(X, Y, half, depth, col, spot, gill) {
    B.lathe([[0, 0.08], [0.8, 0.06], [1.04, -0.12], [1.08, -0.34], [0.9, -0.48], [0, -0.44]], 18, { c: [X, Y, 0], sx: half, sz: depth, center: [X, Y - 0.2, 0], mat: (m, i) => (i >= 3 ? gill : col) });
    for (const [ph, yy, rr] of [[-0.8, -0.14, 0.3], [0, -0.17, 0.36], [0.8, -0.14, 0.3]]) {
      const n = [Math.sin(ph) * 0.6, 0.6, Math.cos(ph) * 0.9];
      B.decalAt([X + Math.sin(ph) * 1.06 * half, Y + yy, Math.cos(ph) * 1.06 * depth], n, [rr * Math.min(half, 3), rr * 0.7 * Math.min(half, 3) * 0.6, 0.03], spot);
    }
    B.decalAt([X - 0.3 * half, Y + 0.08, 0.3 * depth], [0, 1, 0], [0.18 * half, 0.25 * depth, 0.02], spot);
    B.decalAt([X + 0.4 * half, Y + 0.07, -0.35 * depth], [0, 1, 0], [0.13 * half, 0.2 * depth, 0.02], spot);
  }
  function house(x, y, z, s, capCol) {
    B.lathe([[0.55 * s, 1.15 * s], [0.6 * s, 0.55 * s], [0.62 * s, 0]], 10, { c: [x, y, z], center: [x, y + 0.6 * s, z], col: '#f6efe0' });
    B.decalAt([x, y + 0.42 * s, z + 0.61 * s], [0, 0, 1], [0.17 * s, 0.32 * s, 0.03], '#9a6a44');
    for (const sx of [-1, 1]) B.decalAt([x + 0.36 * s * sx, y + 0.8 * s, z + 0.5 * s], [0.55 * sx, 0, 0.83], [0.11 * s, 0.11 * s, 0.03], '#a8d8f0');
    B.lathe([[0, 2.3 * s], [0.65 * s, 2.2 * s], [1.1 * s, 1.92 * s], [1.3 * s, 1.48 * s], [1.22 * s, 1.18 * s], [0, 1.24 * s]], 12, { c: [x, y, z], center: [x, y + 1.7 * s, z], col: capCol });
    for (const d of [[0, 0.45, 1], [-0.85, 0.5, 0.35], [0.85, 0.5, 0.35], [0.1, 1, 0.2]]) B.spotPatch([x, y + 1.5 * s, z], [1.27 * s, 0.8 * s, 1.27 * s], d, 0.32, '#fbf8f1', 8, 0.03 * s, 0.15);
  }
  function paperTree(x, y, z, s, col) {
    B.box([x, y + 0.4 * s, z], [0.12 * s, 0.4 * s, 0.12 * s], { col: '#8a5a34' });
    B.cone([x, y + 0.6 * s, z], 0.9 * s, 2.2 * s, 5, { col, jit: 0.05 * s, seed: x + z });
  }

  // ---------- 2D paper backdrops (drawn on the canvas behind the 3D layer) ----------
  function sky(c, stops) { const g = c.createLinearGradient(0, 0, 0, 720); for (const s of stops) g.addColorStop(s[0], s[1]); c.fillStyle = g; c.fillRect(0, 0, 1280, 720); }
  function foldSun(c, x, y, r, a, b) {
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2, am = (a0 + a1) / 2;
      c.fillStyle = i % 2 ? a : b; c.beginPath(); c.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); c.lineTo(x + Math.cos(am) * r * 1.55, y + Math.sin(am) * r * 1.55); c.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r); c.fill();
      c.fillStyle = i % 2 ? b : a; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); c.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r); c.fill();
    }
  }
  function foldCloud(c, x, y, s, top, bot) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = top; c.beginPath(); c.moveTo(-44, 4); c.lineTo(-34, -10); c.lineTo(-18, -14); c.lineTo(-8, -26); c.lineTo(12, -26); c.lineTo(22, -14); c.lineTo(38, -12); c.lineTo(46, 4); c.fill();
    c.fillStyle = bot; c.beginPath(); c.moveTo(-44, 4); c.lineTo(46, 4); c.lineTo(38, 12); c.lineTo(-36, 12); c.fill();
    c.strokeStyle = 'rgba(150,140,170,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-18, -14); c.lineTo(-10, 4); c.moveTo(12, -26); c.lineTo(4, 4); c.stroke();
    c.restore();
  }
  function crane(c, x, y, s, a, b) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const tri = (p, f) => { c.fillStyle = f; c.beginPath(); p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.fill(); };
    tri([[-18, 2], [0, -4], [4, 6]], b); tri([[0, -4], [18, -2], [4, 6]], a); tri([[0, -4], [-6, -26], [6, 0]], a); tri([[2, -3], [16, -22], [8, 0]], b);
    tri([[-18, 2], [-26, -10], [-12, 0]], a); tri([[18, -2], [26, -16], [14, 0]], b);
    c.restore();
  }
  function stars(c, n, seed, h) { const r = B.prng(seed); for (let i = 0; i < n; i++) { const x = r() * 1280, y = r() * h, s = 1.5 + r() * 2.5; c.fillStyle = `rgba(255,250,220,${0.5 + r() * 0.5})`; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.35, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.35, y); c.fill(); } }
  const par = (cam, k) => -(cam.x || 0) * k;

  const BUILD = {
    town() {
      const st = STG.town, so = st.solids[0], half = (so.w / 2) * PX, S = { statics: [], movers: [] };
      S.statics.push(mesh(() => {
        B.lathe([[0, 0], [0.975, 0], [0.99, -0.05], [1, -0.16], [1, -1.2], [0.97, -1.6]], 28, { sx: half, sz: 2.6, center: [0, -0.8, 0], mat: (m, i) => (i === 0 ? '#a3d985' : i === 1 ? '#8fca72' : '#e3c89c') });
        B.lathe([[0.97, -1.6], [0.8, -2.6], [0.55, -3.6], [0.28, -4.4], [0, -4.8]], 22, { sx: half, sz: 2.6, jit: 0.25, seed: 41, center: [0, -3, 0], mat: m => (m[1] > -2.8 ? '#c9a07a' : '#b08a6a') });
      }));
      S.statics.push(mesh(() => {
        // every mushroom stem reaches all the way down into the ground, set back behind the fighters
        for (const p of st.plats) {
          const [X, Y] = toW(p.x + p.w / 2, p.y), L = Y + 0.4, big = Y > 8;
          B.lathe([[big ? 0.62 : 0.42, -0.44], [big ? 0.66 : 0.48, -L * 0.4], [big ? 0.74 : 0.58, -L + 0.3], [big ? 0.86 : 0.75, -L]], 12, { c: [X, Y, -1.15], center: [X, Y - L / 2, -1.15], col: '#f6efe0' });
          if (big) for (const sx of [-1, 1]) B.decalAt([X + 0.25 * sx, Y - L * 0.55, -1.15 + 0.62], [0.3 * sx, 0, 1], [0.08, 0.14, 0.03], '#3a2a20');
        }
      }));
      S.statics.push(mesh(() => { st.plats.forEach((p, i) => { const [X, Y] = toW(p.x + p.w / 2, p.y); capPlat(X, Y, (p.w / 2) * PX, 1.4, i === 2 ? '#5fbf5a' : '#e64a40', '#fbf8f1', '#efe2c6'); }); }));
      S.statics.push(mesh(() => {
        B.lathe([[0, 0], [1, 0]], 12, { c: [0, -3.2, -60], sx: 160, sz: 58, center: [0, -20, -60], col: '#b5df98' });
        for (const [x, z, s, cc] of [[-26, -16, 2.4, '#5a8ae0'], [-14, -22, 2.6, '#f2c84a'], [-3, -28, 2.3, '#e64a40'], [9, -19, 2.5, '#5fbf5a'], [21, -16, 2.3, '#9b6ad6'], [32, -26, 2.6, '#5a8ae0'], [-36, -27, 2.5, '#e64a40'], [44, -32, 2.8, '#f2c84a']]) house(x, -3.2, z, s, cc);
        for (const [x, z, s] of [[-20, -12, 1.6], [3, -14, 1.5], [15, -24, 1.9], [-31, -18, 1.7], [38, -18, 1.6]]) paperTree(x, -3.2, z, s, '#7cc46a');
        for (const [x, z, r, h] of [[-46, -62, 20, 9], [0, -70, 26, 13], [48, -60, 19, 8]]) B.lathe([[0, h], [r * 0.5, h * 0.88], [r * 0.85, h * 0.5], [r, 0]], 10, { c: [x, -3.2, z], col: '#a6d6a0' });
      }, { ink: false }));
      S.env = { fog: [1, 0.91, 0.84], f0: 6, f1: 80, fa: 0.72, amb: 0.6, dif: 0.5, cool: 0.45 };
      S.backdrop = (c, cam) => {
        sky(c, [[0, '#ffd3b0'], [0.55, '#ffeedc'], [1, '#fff6ea']]);
        foldSun(c, 150 + par(cam, 0.02), 110, 56, '#ffcf4a', '#ffb42e');
        foldCloud(c, 380 + par(cam, 0.03), 120, 1.6, '#ffffff', '#e3e8f5'); foldCloud(c, 760 + par(cam, 0.03), 80, 1.2, '#ffffff', '#e3e8f5'); foldCloud(c, 1110 + par(cam, 0.03), 150, 1.3, '#ffffff', '#e3e8f5');
        crane(c, 560 + par(cam, 0.04), 160, 1.3, '#ff8a99', '#e46478'); crane(c, 980 + par(cam, 0.04), 230, 0.9, '#8ac0ff', '#5e98e8');
      };
      return S;
    },
    diorama() {
      const st = STG.diorama, so = st.solids[0], S = { statics: [], movers: [] };
      const x0 = so.x * PX, x1 = (so.x + so.w) * PX, yb = -so.h * PX, cols = 8, rows = 3, cw = (x1 - x0) / cols, rh = -yb / rows;
      S.statics.push(mesh(() => {
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const cx = x0 + cw * (i + 0.5), cy = -rh * (j + 0.5), dirt = (i + j) % 2 ? '#c08a52' : '#b07a45';
          B.box([cx, cy, 0], [cw / 2, rh / 2, 1.7], { faceCol: k => (k === 0 && j === 0 ? '#8fdc6a' : dirt) });
        }
        B.box([(x0 + x1) / 2, 0.06, 0], [(x1 - x0) / 2 + 0.05, 0.12, 1.75], { col: '#7fd05a' });
        B.capsule([x1 - 1.6, 0, -1], [x1 - 1.6, 3.4, -1], 0.07, 5, { col: '#8a8f99' });
        B.addTri([x1 - 1.6, 3.4, -1], [x1 - 1.6, 2.5, -1], [x1 - 0.3, 2.95, -1], '#ffd23a', [x1 - 1, 2.9, -2]);
        for (let i = 0; i < 4; i++) { const gx = x0 + cw * (1 + i * 2), gy = -rh * (1 + (i % 2)); B.ellipsoid([gx, gy, 1.75], [0.32, 0.45, 0.1], 2, 4, { col: ['#5fe0ff', '#ff6fae', '#ffd23a', '#7dff8a'][i] }); }
      }));
      st.plats.forEach((p, idx) => {
        const n = Math.round((p.w * PX) / 1.2), bw = (p.w * PX) / n, w2 = (p.w * PX) / 2;
        S.movers.push({ idx: st.solids.length + idx, half: w2, mesh: mesh(() => {
          for (let k = 0; k < n; k++) {
            const q = k === Math.floor(n / 2), cx = -w2 + bw * (k + 0.5);
            B.box([cx, -0.58, 0], [bw / 2 - 0.02, 0.58, 0.62], { col: q ? '#ffcf33' : '#d0823f' });
            if (q) { B.box([cx, -0.48, 0.63], [0.09, 0.26, 0.02], { col: '#5a3418' }); B.box([cx, -0.92, 0.63], [0.09, 0.07, 0.02], { col: '#5a3418' }); }
          }
        }) });
      });
      S.statics.push(mesh(() => {
        const r = B.prng(77);
        for (let i = 0; i < 14; i++) {
          const x = (r() - 0.5) * 190, y = -10 + r() * 34, z = -55 - r() * 60, s = 2 + r() * 4;
          B.box([x, y, z], [s, s * 0.9, s], { faceCol: k => (k === 0 ? '#8fdc6a' : k === 1 ? '#7e4f2b' : '#a0673a') });
          if (r() < 0.5) paperTree(x, y + s * 0.9, z, s * 0.4, '#5fbf5a');
        }
      }, { ink: false }));
      S.lift = 0.18; // the grass slab sits a little above the physics surface
      S.env = { fog: [0.96, 0.78, 0.76], f0: 8, f1: 90, fa: 0.7, amb: 0.58, dif: 0.52, cool: 0.5 };
      S.backdrop = (c, cam) => {
        sky(c, [[0, '#3a2a6e'], [0.5, '#9a5a9a'], [0.8, '#f0a07a'], [1, '#ffd3a8']]);
        stars(c, 60, 4, 300);
        foldSun(c, 1090 + par(cam, 0.02), 140, 38, '#ffe28a', '#ffcf4a');
        foldCloud(c, 300 + par(cam, 0.03), 200, 1.3, '#fbe8f0', '#d9c4e0'); foldCloud(c, 820 + par(cam, 0.03), 120, 1.0, '#fbe8f0', '#d9c4e0');
      };
      return S;
    },
    turnpike() {
      const st = STG.turnpike, so = st.solids[0], half = (so.w / 2) * PX, hh = (so.h / 2) * PX, S = { statics: [], movers: [] };
      S.statics.push(mesh(() => {
        B.box([0, -hh, 0], [half, hh, 2.6], { faceCol: k => (k === 0 ? '#4a4d5c' : '#3a3c48') });
        for (let x = -half + 1; x < half - 1.5; x += 3) B.box([x + 0.7, 0.01, 1.2], [0.7, 0.02, 0.09], { col: '#ffd23a' });
        B.box([0, 0.01, 2.3], [half - 0.2, 0.02, 0.05], { col: '#f6f1e6' });
        for (const x of [-14, -5, 5, 14]) B.box([x, -2 * hh - 6, -0.5], [0.8, 6, 0.8], { col: '#8a8fa0' });
        // dash panels set into the road (their arrows light up in the view)
        for (const b of st.boost || []) {
          const cx = (b.x + b.w / 2) * PX, hw = (b.w / 2) * PX;
          B.box([cx, 0.012, 0.4], [hw, 0.012, 1.55], { col: '#2a2c38' });
          for (const sz of [-1, 1]) B.box([cx, 0.02, 0.4 + sz * 1.5], [hw, 0.012, 0.06], { col: '#ff8a1f' });
        }
      }));
      S.statics.push(mesh(() => {
        for (const p of st.plats) {
          const [X, Y] = toW(p.x + p.w / 2, p.y), hw = (p.w / 2) * PX;
          B.box([X, Y - 0.85, 0], [hw, 0.85, 0.15], { col: '#2e8b4a' });
          for (const [dx, dy, sx, sy] of [[0, -0.08, hw, 0.08], [0, -1.62, hw, 0.08], [-hw + 0.08, -0.85, 0.08, 0.85], [hw - 0.08, -0.85, 0.08, 0.85]]) B.box([X + dx, Y + dy, 0.16], [sx, sy, 0.02], { col: '#f6f1e6' });
          const dir = p.x < 0 ? -1 : 1;
          B.box([X - dir * 0.6, Y - 0.85, 0.17], [1.4, 0.16, 0.02], { col: '#f6f1e6' });
          B.addTri([X + dir * 0.8, Y - 0.35, 0.18], [X + dir * 0.8, Y - 1.35, 0.18], [X + dir * 1.7, Y - 0.85, 0.18], '#f6f1e6', [X, Y - 0.85, -1]);
          for (const dx of [-hw + 0.7, hw - 0.7]) B.box([X + dx, (Y - 1.7) / 2, -0.3], [0.12, (Y - 1.7) / 2, 0.12], { col: '#9aa0b0' });
        }
      }));
      S.statics.push(mesh(() => {
        const r = B.prng(31);
        for (let i = 0; i < 26; i++) {
          const x = -70 + i * 5.6 + r() * 2, z = -24 - r() * 34, h = 6 + r() * 18, w = 1.8 + r() * 1.6;
          B.box([x, -6 + h / 2, z], [w, h / 2, 1.8], { col: r() < 0.5 ? '#3a2f6a' : '#2e2656' });
          for (let wy = -6 + 1.5; wy < -6 + h - 1; wy += 1.8) for (let wx = x - w + 0.7; wx < x + w - 0.5; wx += 1.1) if (r() < 0.45) B.box([wx, wy, z + 1.82], [0.28, 0.38, 0.02], { col: '#ffd98a' });
        }
      }, { ink: false }));
      S.env = { fog: [0.26, 0.2, 0.42], f0: 10, f1: 95, fa: 0.75, amb: 0.52, dif: 0.55, cool: 0.6 };
      S.backdrop = (c, cam) => {
        sky(c, [[0, '#120f38'], [0.6, '#2e2266'], [1, '#5a3a86']]);
        stars(c, 90, 9, 420);
        const mx = 1040 + par(cam, 0.015);
        c.fillStyle = '#fff6d6'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; c.lineTo(mx + Math.cos(a) * 52, 120 + Math.sin(a) * 52); } c.fill();
        c.fillStyle = '#efe2b8'; c.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; c.lineTo(mx - 14 + Math.cos(a) * 12, 108 + Math.sin(a) * 12); } c.fill();
      };
      return S;
    },
    gorge() {
      const st = STG.gorge, so = st.solids[0], half = (so.w / 2) * PX, S = { statics: [], movers: [] };
      S.statics.push(mesh(() => {
        B.lathe([[0, 0], [0.98, 0], [1, -0.2], [1.03, -3], [0.97, -8], [0.9, -18]], 24, { sx: half, sz: 2.5, jit: 0.12, seed: 61, center: [0, -6, 0], mat: (m, i) => (i === 0 ? '#9fd57f' : i === 1 ? '#7fc062' : i % 2 ? '#b8703f' : '#a5612f') });
      }));
      S.statics.push(mesh(() => {
        st.plats.forEach((p, i) => {
          const [X, Y] = toW(p.x + p.w / 2, p.y), hw = (p.w / 2) * PX, bounce = !!p.bounce;
          B.lathe([[0.5, -0.44], [0.55, -4], [0.7, bounce ? -24 : -9]], 10, { c: [X, Y, -0.4], center: [X, Y - 5, -0.4], col: '#f3e0bf' });
          capPlat(X, Y, hw * (bounce ? 1.08 : 1), bounce ? 1.9 : 1.4, bounce ? '#ff8a2a' : '#4a8ae6', '#fbf8f1', '#efe2c6');
        });
      }));
      S.statics.push(mesh(() => {
        const r = B.prng(13);
        for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
          const x = sx * (30 + i * 9 + r() * 5), z = -10 - i * 8 - r() * 4, h = 26 + r() * 20, rad = 6 + r() * 5;
          B.lathe([[0, h], [rad * 0.7, h * 0.95], [rad, h * 0.5], [rad * 1.1, 0]], 7, { c: [x, -20, z], jit: 1.2, seed: i + sx * 9, col: i % 2 ? '#c0703e' : '#b0602f' });
        }
        for (const [x, z, h, s, cc] of [[-18, -40, 26, 5, '#e64a40'], [14, -46, 30, 6, '#4a8ae6'], [-2, -58, 34, 7, '#ff8a2a'], [30, -62, 28, 5.5, '#f2c84a']]) {
          B.lathe([[0.9, h], [1.0, h * 0.5], [1.2, 0]], 8, { c: [x, -20, z], col: '#f3e0bf' });
          B.lathe([[0, h + s * 0.9], [s * 0.7, h + s * 0.75], [s, h + s * 0.2], [s * 0.85, h], [0, h + 0.1]], 10, { c: [x, -20, z], col: cc });
        }
      }, { ink: false }));
      S.env = { fog: [1, 0.84, 0.7], f0: 8, f1: 95, fa: 0.72, amb: 0.6, dif: 0.5, cool: 0.45 };
      S.backdrop = (c, cam) => {
        sky(c, [[0, '#ff9e6e'], [0.55, '#ffd0a0'], [1, '#ffe8c0']]);
        foldSun(c, 640 + par(cam, 0.02), 220, 70, '#fff0b0', '#ffd870');
        foldCloud(c, 260 + par(cam, 0.03), 110, 1.4, '#fff4e8', '#f0d8c8'); foldCloud(c, 1020 + par(cam, 0.03), 90, 1.2, '#fff4e8', '#f0d8c8');
        crane(c, 430 + par(cam, 0.04), 200, 1.1, '#ff8a99', '#e46478');
      };
      return S;
    },
  };
  function get(id) { return cache[id] || (cache[id] = (BUILD[id] || BUILD.town)()); }
  return { get };
})();
