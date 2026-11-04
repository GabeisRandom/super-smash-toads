'use strict';
// ===== G3: a small WebGL renderer for the origami look — folded facets lit one by one, paper creases, ink outlines =====
const G3 = (() => {
  const v = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };
  // column-major 4x4 matrices
  const M4 = {
    I: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    },
    T(x, y, z) { const m = M4.I(); m[12] = x; m[13] = y; m[14] = z; return m; },
    S(x, y, z) { const m = M4.I(); m[0] = x; m[5] = y; m[10] = z; return m; },
    RX(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.I(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
    RY(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.I(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
    RZ(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.I(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f); return m; },
    chain(...ms) { let o = ms[0]; for (let i = 1; i < ms.length; i++) o = M4.mul(o, ms[i]); return o; },
  };

  const VS_LIT = `attribute vec3 aP; attribute vec3 aN; attribute vec3 aC;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vN; varying vec3 vC; varying float vD;
void main(){ vec4 w = uM * vec4(aP, 1.0); gl_Position = uVP * w; vN = (uM * vec4(aN, 0.0)).xyz; vC = aC; vD = gl_Position.w; }`;
  const FS_LIT = `precision mediump float;
uniform vec3 uL; uniform float uAmb; uniform float uDif; uniform float uCool; uniform float uSelf;
uniform vec3 uFog; uniform vec3 uFogR; uniform vec4 uTint; uniform float uA;
varying vec3 vN; varying vec3 vC; varying float vD;
void main(){
  vec3 n = normalize(vN);
  float k = mix(uAmb + uDif * max(0.0, dot(n, uL)), 1.0, uSelf);
  float sh = max(0.0, 1.0 - k) * uCool;
  vec3 c = vC * k * vec3(1.0 - sh * 0.35, 1.0 - sh * 0.12, 1.0 + sh * 0.45);
  c = mix(c, uTint.rgb, uTint.a);
  c = mix(c, uFog, smoothstep(uFogR.x, uFogR.y, vD) * uFogR.z);
  gl_FragColor = vec4(c, uA);
}`;
  const VS_FLAT = `attribute vec3 aP; uniform mat4 uVP; uniform mat4 uM; varying float vD;
void main(){ gl_Position = uVP * uM * vec4(aP, 1.0); vD = gl_Position.w; }`;
  const FS_FLAT = `precision mediump float; uniform vec4 uC; uniform vec3 uFog; uniform vec3 uFogR; varying float vD;
void main(){ gl_FragColor = vec4(mix(uC.rgb, uFog, smoothstep(uFogR.x, uFogR.y, vD) * uFogR.z), uC.a); }`;

  let gl = null, cw = 1280, chh = 720, lit = null, flat = null;
  const NOTINT = new Float32Array([0, 0, 0, 0]);
  const S = { vp: null, cam: [0, 0, 50], fov: 0.52, foc: 1, vw: 1280, vh: 720, fog: [1, 0.93, 0.86], fogR: [60, 140, 0.6], L: v.norm([-0.55, 0.75, 0.45]), amb: 0.6, dif: 0.5, cool: 0.45, ink: [0.43, 0.3, 0.22, 1], inkW: 0.05, crease: 0.28 };
  const alphaQ = [];

  function compileShader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs, attrs, unis) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; for (const n of unis) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }
  function init(canvas) {
    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false }) || canvas.getContext('experimental-webgl');
      if (!gl) return false;
      cw = canvas.width; chh = canvas.height;
      lit = program(VS_LIT, FS_LIT, ['aP', 'aN', 'aC'], ['uVP', 'uM', 'uL', 'uAmb', 'uDif', 'uCool', 'uSelf', 'uFog', 'uFogR', 'uTint', 'uA']);
      flat = program(VS_FLAT, FS_FLAT, ['aP'], ['uVP', 'uM', 'uC', 'uFog', 'uFogR']);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
      return true;
    } catch (e) { console.warn('WebGL unavailable:', e); gl = null; return false; }
  }
  function hashf(i) { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }

  // triangles {p:[a,b,c], fn, col:[r,g,b] 0..255, vary} -> GPU mesh with crease lines
  function compile(tris, o) {
    o = o || {};
    const n = tris.length, buf = new Float32Array(n * 27);
    let k = 0, cx = 0, cy = 0, cz = 0;
    const key = p => Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000) + ',' + Math.round(p[2] * 1000), em = new Map();
    for (let i = 0; i < n; i++) {
      const t = tris[i], fn = t.fn;
      let [a, b, c] = t.p;
      if (v.dot(v.cross(v.sub(b, a), v.sub(c, a)), fn) < 0) { const tmp = b; b = c; c = tmp; }
      const vr = t.vary ? 1 + (hashf(i + (o.seed || 0) * 977) - 0.5) * t.vary : 1;
      const r = Math.min(1, (t.col[0] / 255) * vr), g = Math.min(1, (t.col[1] / 255) * vr), bl = Math.min(1, (t.col[2] / 255) * vr);
      for (const p of [a, b, c]) { buf[k++] = p[0]; buf[k++] = p[1]; buf[k++] = p[2]; buf[k++] = fn[0]; buf[k++] = fn[1]; buf[k++] = fn[2]; buf[k++] = r; buf[k++] = g; buf[k++] = bl; cx += p[0]; cy += p[1]; cz += p[2]; }
      if (o.crease !== false) for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const k1 = key(p), k2 = key(q), ek = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
        let e = em.get(ek); if (!e) { e = []; em.set(ek, e); } e.push({ fn, p, q });
      }
    }
    const m = { n: n * 3, c: n ? [cx / (3 * n), cy / (3 * n), cz / (3 * n)] : [0, 0, 0], r: 0.05, ink: o.ink !== false, nl: 0 };
    for (let i = 0; i < k; i += 9) m.r = Math.max(m.r, Math.hypot(buf[i] - m.c[0], buf[i + 1] - m.c[1], buf[i + 2] - m.c[2]));
    if (!gl) return m;
    m.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    const lines = [], thr = o.creaseMin == null ? 0.004 : o.creaseMin;
    for (const e of em.values()) if (e.length === 2 && 1 - v.dot(e[0].fn, e[1].fn) > thr) lines.push(e[0].p[0], e[0].p[1], e[0].p[2], e[0].q[0], e[0].q[1], e[0].q[2]);
    if (lines.length) { m.lb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.lb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW); m.nl = lines.length / 3; }
    return m;
  }

  function setCommon(prog) {
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.uVP, false, S.vp);
    gl.uniform3fv(prog.u.uFog, S.fog); gl.uniform3fv(prog.u.uFogR, S.fogR);
    if (prog === lit) { gl.uniform3fv(lit.u.uL, S.L); gl.uniform1f(lit.u.uAmb, S.amb); gl.uniform1f(lit.u.uDif, S.dif); gl.uniform1f(lit.u.uCool, S.cool); }
  }
  // o: {cam:[x,y,z], fov (radians), near, far, fog:[r,g,b] 0..1, fogR:[start,end,amount], L, amb, dif, cool, ink, inkW, vw, vh}
  function begin(o) {
    Object.assign(S, o);
    S.vw = o.vw || cw; S.vh = o.vh || chh;
    gl.viewport(0, chh - S.vh, S.vw, S.vh);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, chh - S.vh, S.vw, S.vh);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    S.vp = M4.mul(M4.persp(S.fov, S.vw / S.vh, S.near || 1, S.far || 900), M4.T(-S.cam[0], -S.cam[1], -S.cam[2]));
    S.foc = S.vh / 2 / Math.tan(S.fov / 2);
    alphaQ.length = 0;
    setCommon(lit); setCommon(flat);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
  }
  function bindTris(m, withAll) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    if (withAll) { gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24); }
    else { gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); }
  }
  function blendOn() { gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
  // o: {alpha, tint:[r,g,b,a], self, ink:false, inkW, crease:false, creaseA}
  function draw(m, M, o) {
    if (!gl || !m || !m.vb) return;
    o = o || {};
    if (o.alpha != null && o.alpha < 1) { alphaQ.push({ m, M, o }); return; }
    if (m.ink && o.ink !== false && S.inkW > 0) {
      const k = 1 + (o.inkW == null ? S.inkW : o.inkW) / Math.max(0.05, m.r);
      const Mh = M4.chain(M, M4.T(m.c[0], m.c[1], m.c[2]), M4.S(k, k, k), M4.T(-m.c[0], -m.c[1], -m.c[2]));
      gl.useProgram(flat.p); bindTris(m, false);
      gl.uniformMatrix4fv(flat.u.uM, false, Mh); gl.uniform4fv(flat.u.uC, S.ink);
      gl.cullFace(gl.FRONT); gl.drawArrays(gl.TRIANGLES, 0, m.n);
    }
    gl.useProgram(lit.p); bindTris(m, true);
    gl.uniformMatrix4fv(lit.u.uM, false, M); gl.uniform1f(lit.u.uSelf, o.self || 0); gl.uniform4fv(lit.u.uTint, o.tint || NOTINT); gl.uniform1f(lit.u.uA, 1);
    gl.cullFace(gl.BACK); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if (m.nl && o.crease !== false) {
      gl.useProgram(flat.p); gl.bindBuffer(gl.ARRAY_BUFFER, m.lb);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
      gl.uniformMatrix4fv(flat.u.uM, false, M); gl.uniform4fv(flat.u.uC, [S.ink[0], S.ink[1], S.ink[2], o.creaseA == null ? S.crease : o.creaseA]);
      blendOn(); gl.depthMask(false); gl.drawArrays(gl.LINES, 0, m.nl); gl.depthMask(true); gl.disable(gl.BLEND);
    }
  }
  function depthOf(M, c) { const p = [M[0] * c[0] + M[4] * c[1] + M[8] * c[2] + M[12], M[1] * c[0] + M[5] * c[1] + M[9] * c[2] + M[13], M[2] * c[0] + M[6] * c[1] + M[10] * c[2] + M[14]]; return S.cam[2] - p[2]; }
  function end() {
    if (!gl) return;
    alphaQ.sort((a, b) => depthOf(b.M, b.m.c) - depthOf(a.M, a.m.c));
    gl.useProgram(lit.p); blendOn(); gl.depthMask(false); gl.cullFace(gl.BACK);
    for (const { m, M, o } of alphaQ) {
      bindTris(m, true);
      gl.uniformMatrix4fv(lit.u.uM, false, M); gl.uniform1f(lit.u.uSelf, o.self || 0); gl.uniform4fv(lit.u.uTint, o.tint || NOTINT); gl.uniform1f(lit.u.uA, o.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, m.n);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  // world point -> canvas pixels for the current camera
  function project(p) {
    const m = S.vp, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [((x / w + 1) / 2) * S.vw, ((1 - y / w) / 2) * S.vh, w];
  }

  // ---------- geometry builders (collect triangles into the current list) ----------
  let CUR = [];
  function start() { CUR = []; }
  function take() { const t = CUR; CUR = []; return t; }
  function push(tris) { for (const t of tris) CUR.push(t); }
  function hex(h) { if (Array.isArray(h)) return h; const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function prng(seed) { let s = (Math.imul((seed * 1000 | 0) || 1, 2654435761) ^ 0x9e3779b9) >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const mid3 = (a, b, c) => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  function addTri(a, b, c, col, center, extra) {
    let n = v.cross(v.sub(b, a), v.sub(c, a));
    const L = Math.hypot(n[0], n[1], n[2]);
    if (L < 1e-12) return null;
    n = v.mul(n, 1 / L);
    if (center && v.dot(n, v.sub(mid3(a, b, c), center)) < 0) n = v.mul(n, -1);
    const t = Object.assign({ p: [a, b, c], fn: n, col: hex(col) }, extra || {});
    CUR.push(t);
    return t;
  }
  function ellipsoid(c, r, nLat, nLon, o) {
    const R = prng(o.seed || 7), rows = [], lat0 = o.lat ? o.lat[0] : -90, lat1 = o.lat ? o.lat[1] : 90;
    for (let i = 0; i <= nLat; i++) {
      const la = ((lat0 + ((lat1 - lat0) * i) / nLat) * Math.PI) / 180, pole = Math.abs(Math.abs(la) - Math.PI / 2) < 1e-4, row = [];
      for (let j = 0; j < nLon; j++) {
        const lo = ((j + (i % 2) * 0.5) / nLon) * Math.PI * 2;
        let lx = Math.cos(la) * Math.cos(lo) * r[0], ly = Math.sin(la) * r[1], lz = Math.cos(la) * Math.sin(lo) * r[2];
        if (!pole && o.jit) { lx += (R() - 0.5) * o.jit; ly += (R() - 0.5) * o.jit; lz += (R() - 0.5) * o.jit; }
        const F = o.frame;
        row.push(F ? [c[0] + F.r[0] * lx + F.u[0] * ly + F.n[0] * lz, c[1] + F.r[1] * lx + F.u[1] * ly + F.n[1] * lz, c[2] + F.r[2] * lx + F.u[2] * ly + F.n[2] * lz] : [c[0] + lx, c[1] + ly, c[2] + lz]);
      }
      rows.push(row);
    }
    for (let i = 0; i < nLat; i++) {
      const A = rows[i], B = rows[i + 1], n = nLon;
      for (let j = 0; j < n; j++) {
        const j1 = (j + 1) % n;
        const tr = i % 2 === 0 ? [[A[j], A[j1], B[j]], [A[j1], B[j1], B[j]]] : [[A[j], A[j1], B[j1]], [A[j], B[j1], B[j]]];
        for (const [a, b, cc] of tr) addTri(a, b, cc, o.mat ? o.mat(mid3(a, b, cc)) : o.col, c, o.extra);
      }
    }
  }
  function lathe(prof, segs, o) {
    const R = prng(o.seed || 5), rings = [], c = o.c || [0, 0, 0], rot0 = o.rot0 == null ? Math.PI / 2 - Math.PI / segs : o.rot0;
    const open = !!o.angles, cols = open ? o.angles.length : segs;
    for (let i = 0; i < prof.length; i++) {
      const [r, y] = prof[i], ring = [];
      for (let j = 0; j < cols; j++) {
        const a = open ? o.angles[j] : rot0 + (j / segs) * Math.PI * 2;
        let x = r * Math.cos(a) * (o.sx || 1), z = r * Math.sin(a) * (o.sz || 1), yy = y;
        if (o.jit && r > 0) { x += (R() - 0.5) * o.jit; yy += (R() - 0.5) * o.jit; z += (R() - 0.5) * o.jit; }
        ring.push([c[0] + x, c[1] + yy, c[2] + z]);
      }
      rings.push(ring);
    }
    const center = o.center || [c[0], c[1] + (prof[0][1] + prof[prof.length - 1][1]) / 2, c[2]];
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < (open ? cols - 1 : segs); j++) {
      const j1 = open ? j + 1 : (j + 1) % segs, A = rings[i][j], B = rings[i][j1], Cc = rings[i + 1][j1], D = rings[i + 1][j];
      const m = [(A[0] + B[0] + Cc[0] + D[0]) / 4, (A[1] + B[1] + Cc[1] + D[1]) / 4, (A[2] + B[2] + Cc[2] + D[2]) / 4];
      const col = o.mat ? o.mat(m, i, j) : o.col;
      for (const [a, b, cc] of [[A, B, Cc], [A, Cc, D]]) addTri(a, b, cc, col, center, o.extra);
    }
  }
  function capsule(A, B, r, segs, o) {
    const ax = v.sub(B, A), L = Math.hypot(ax[0], ax[1], ax[2]), u = v.mul(ax, 1 / L);
    const vv = Math.abs(u[1]) < 0.9 ? v.norm(v.cross(u, [0, 1, 0])) : v.norm(v.cross(u, [1, 0, 0])), w = v.cross(u, vv);
    const prof = [], hs = 3, r2 = o.r2 == null ? r : o.r2;
    for (let i = 0; i <= hs; i++) { const a = (Math.PI / 2) * (1 - i / hs); prof.push([r2 * Math.cos(a), L + r2 * Math.sin(a)]); }
    for (let i = 0; i <= hs; i++) { const a = (-Math.PI / 2 * i) / hs; prof.push([r * Math.cos(a), r * Math.sin(a)]); }
    const rings = prof.map(([rad, t]) => { const ring = []; for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2; ring.push(v.add(A, v.add(v.mul(u, t), v.add(v.mul(vv, rad * Math.cos(a)), v.mul(w, rad * Math.sin(a)))))); } return ring; });
    const center = v.add(A, v.mul(ax, 0.5));
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs, a = rings[i][j], b = rings[i][j1], cc = rings[i + 1][j1], d = rings[i + 1][j];
      addTri(a, b, cc, o.col, center, o.extra); addTri(a, cc, d, o.col, center, o.extra);
    }
  }
  function box(c, s, o) {
    const [x0, x1, y0, y1, z0, z1] = [c[0] - s[0], c[0] + s[0], c[1] - s[1], c[1] + s[1], c[2] - s[2], c[2] + s[2]];
    const faces = [[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]],
      [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]],
      [[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]], [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]];
    faces.forEach((f, k) => { const col = o.faceCol ? o.faceCol(k) : o.col; addTri(f[0], f[1], f[2], col, c, o.extra); addTri(f[0], f[2], f[3], col, c, o.extra); });
  }
  function cone(c, r, h, segs, o) { lathe([[0, h], [r, 0], [0, 0]], segs, Object.assign({ c, center: [c[0], c[1] + h * 0.3, c[2]] }, o)); }
  function frameFor(n) { n = v.norm(n); const r = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : v.norm(v.cross([0, 1, 0], n)); return { r, u: v.cross(n, r), n }; }
  function decalAt(p, n, rad, col, o) {
    const F = frameFor(n);
    if (o && o.spin) { const c = Math.cos(o.spin), s = Math.sin(o.spin), r = v.add(v.mul(F.r, c), v.mul(F.u, s)), u = v.add(v.mul(F.r, -s), v.mul(F.u, c)); F.r = r; F.u = u; }
    ellipsoid(v.add(p, v.mul(F.n, rad[2] * 0.3)), rad, (o && o.nLat) || 2, (o && o.nLon) || 8, { col, frame: F, lat: o && o.lat, extra: o && o.extra });
  }
  // a round patch hugging an ellipsoid dome (cc center, cr radii) around direction s
  function spotPatch(cc, cr, s, alpha, col, K, lift, wob, xform) {
    s = v.norm(s);
    const R = prng(s[0] * 7 + s[1] * 3 + s[2] + 2);
    const t1 = v.norm(Math.abs(s[1]) < 0.9 ? v.cross(s, [0, 1, 0]) : v.cross(s, [1, 0, 0])), t2 = v.cross(s, t1);
    const dirAt = (a, th) => v.norm(v.add(v.mul(s, Math.cos(a)), v.mul(v.add(v.mul(t1, Math.cos(th)), v.mul(t2, Math.sin(th))), Math.sin(a))));
    const surf = d => { const n = v.norm([d[0] / cr[0], d[1] / cr[1], d[2] / cr[2]]); const p = v.add([cc[0] + d[0] * cr[0], cc[1] + d[1] * cr[1], cc[2] + d[2] * cr[2]], v.mul(n, lift)); return xform ? xform(p) : p; };
    const ctr = surf(s), A = [], B = [], inside = xform ? xform(cc) : cc;
    for (let k = 0; k < K; k++) {
      const th = (k / K) * Math.PI * 2, w = 1 + (wob ? (R() - 0.5) * wob : 0);
      A.push(surf(dirAt(alpha * 0.55 * w, th + Math.PI / K))); B.push(surf(dirAt(alpha * w, th)));
    }
    for (let k = 0; k < K; k++) {
      const k1 = (k + 1) % K;
      addTri(ctr, A[k], A[k1], col, inside); addTri(B[k], B[k1], A[k], col, inside); addTri(A[k], B[k1], A[k1], col, inside);
    }
  }
  function shift(tris, piv) { for (const t of tris) t.p = t.p.map(p => [p[0] - piv[0], p[1] - piv[1], p[2] - piv[2]]); return tris; }
  function xformTris(tris, fp, fn) { for (const t of tris) { t.p = t.p.map(fp); if (fn) t.fn = v.norm(fn(t.fn)); } return tris; }
  function snapshotTo(ctx2, w, h) { ctx2.drawImage(gl.canvas, 0, 0, w, h, 0, 0, ctx2.canvas.width, ctx2.canvas.height); }

  return {
    v, M4, init, compile, begin, draw, end, project, snapshotTo, ok: () => !!gl, state: S,
    B: { start, take, push, addTri, ellipsoid, lathe, capsule, box, cone, decalAt, spotPatch, frameFor, shift, xformTris, hex, prng },
  };
})();
