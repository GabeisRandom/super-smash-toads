'use strict';
// ===== Drawing: everything is vector-drawn on the canvas =====
const FONT = "'Lilita One', 'Arial Black', Impact, sans-serif";
const OUT = '#2b1a12', SKIN = '#ffe1b8', SHOE = '#7a4321';

function E(c, x, y, rx, ry, fill, stroke, lw) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, Math.abs(rx)), Math.max(0.1, Math.abs(ry)), 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
}
function RR(c, x, y, w, h, r, fill, stroke, lw) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
}
function capPath(c, cx, cy, rx, ry) {
  c.beginPath(); c.moveTo(cx - rx, cy);
  c.bezierCurveTo(cx - rx, cy - ry * 1.35, cx + rx, cy - ry * 1.35, cx + rx, cy);
  c.quadraticCurveTo(cx, cy + ry * 0.42, cx - rx, cy); c.closePath();
}
function cap(c, cx, cy, rx, ry, col, spot, spots) {
  capPath(c, cx, cy, rx, ry); c.fillStyle = col; c.fill();
  c.save(); c.clip();
  for (const s of spots) E(c, cx + s[0] * rx, cy + s[1] * ry, s[2] * rx, s[2] * rx * 0.9, spot);
  c.restore();
  capPath(c, cx, cy, rx, ry); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
}
const TOAD_SPOTS = [[0.6, -0.45, 0.3], [-0.08, -0.85, 0.28], [-0.72, -0.3, 0.26]];
function starPath(c, x, y, r1, r2, rot) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? r2 : r1;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
function txt(c, s, x, y, size, fill, stroke, align, lw) {
  c.font = `${size}px ${FONT}`; c.textAlign = align || 'center'; c.textBaseline = 'alphabetic';
  if (stroke) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = lw || Math.max(3, size / 6); c.strokeText(s, x, y); }
  c.fillStyle = fill; c.fillText(s, x, y);
}
function hexLerp(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * k);
  const g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * k);
  const bl = (pa & 255) + (((pb & 255) - (pa & 255)) * k);
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}
function dmgColor(d) {
  const st = [[0, '#ffffff'], [50, '#ffe066'], [100, '#ff9a2a'], [150, '#ff3b2a'], [230, '#a00c18']];
  for (let i = 1; i < st.length; i++) if (d <= st[i][0]) return hexLerp(st[i - 1][1], st[i][1], (d - st[i - 1][0]) / (st[i][0] - st[i - 1][0]));
  return '#a00c18';
}
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

// ---------- Characters ----------
function pigtail(c, x, y, L) { E(c, x, y + 4, 3, 5, SKIN, OUT, 1.5); E(c, x, y, 9, 7.5, L.cap, OUT, 2); E(c, x - 2, y - 2, 3, 2.6, L.spot); }
function crown(c, x, y) {
  c.beginPath(); c.moveTo(x - 10, y + 6); c.lineTo(x - 12, y - 6); c.lineTo(x - 5, y); c.lineTo(x, y - 10); c.lineTo(x + 5, y);
  c.lineTo(x + 12, y - 6); c.lineTo(x + 10, y + 6); c.closePath();
  c.fillStyle = '#ffd23a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  E(c, x, y + 1.5, 2.2, 2.2, '#e8262b'); E(c, x - 7, y + 2, 1.6, 1.6, '#3f8cff'); E(c, x + 7, y + 2, 1.6, 1.6, '#3f8cff');
}
function pickaxe(c, x, y, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -30); c.stroke();
  c.strokeStyle = '#9a6a3a'; c.lineWidth = 3.5; c.stroke();
  c.beginPath(); c.moveTo(-17, -24); c.quadraticCurveTo(0, -40, 17, -24); c.quadraticCurveTo(0, -32, -17, -24);
  c.fillStyle = '#c9d1dc'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  c.restore();
}
function turnipShape(c, face) {
  c.fillStyle = '#3fae3a'; c.strokeStyle = OUT; c.lineWidth = 1.5;
  for (const a of [-0.5, 0, 0.5]) { c.save(); c.rotate(a); c.beginPath(); c.ellipse(0, -16, 3.5, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore(); }
  E(c, 0, 0, 11, 11, '#f6f2ff', OUT, 2);
  c.save(); c.beginPath(); c.ellipse(0, 0, 11, 11, 0, 0, Math.PI * 2); c.clip(); E(c, 0, -10, 13, 7, '#c9a7f0'); c.restore();
  if (face === 'stitch') {
    c.strokeStyle = OUT; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-6, -2); c.lineTo(-2, 2); c.moveTo(-2, -2); c.lineTo(-6, 2); c.moveTo(2, -2); c.lineTo(6, 2); c.moveTo(6, -2); c.lineTo(2, 2); c.stroke();
    c.beginPath(); c.moveTo(-6, 6); c.lineTo(6, 6); for (let i = -5; i <= 5; i += 3) { c.moveTo(i, 4); c.lineTo(i, 8); } c.stroke();
  } else { E(c, -3.5, 0, 1.4, 2.4, OUT); E(c, 3.5, 0, 1.4, 2.4, OUT); c.beginPath(); c.arc(0, 4, 2.5, 0.2, Math.PI - 0.2); c.stroke(); }
}

function drawToad(c, L, p) {
  const t = p.t || 0, st = p.st;
  const run = st === 'run' ? Math.sin(t * 0.55) : 0;
  const bob = st === 'idle' ? Math.sin(t * 0.1) * 1.2 : st === 'run' ? -Math.abs(run) * 2 : 0;
  const crouch = st === 'shield' || st === 'land' || p.at === 'down' || (p.sp === 'turnip' && p.ft < 12) ||
    (p.sp === 'turnips' && p.ft < 6) || ((p.sp === 'pound' || p.sp === 'yoshipound') && p.ft < 14) ? 1 : 0;
  const hy = -36 + bob + crouch * 5, by = -23 + bob + crouch * 3, cy = hy - 6;
  let hb = [-13, by + 2], hf = [13, by + 1];
  if (st === 'run') { hb[0] -= run * 4; hf[0] += run * 4; }
  if (p.at === 'jab' || p.at === 'side' || p.at === 'fair' || p.at === 'getup' || p.at === 'throw' || p.at === 'pick') hf = [25, by - 5];
  if (p.at === 'up' || p.at === 'uair' || st === 'ledge' || p.hold || (p.sp === 'turnip' && p.ft >= 12 && p.ft < 22) ||
    p.sp === 'parasol' || (p.glide && L.old)) { hf = [12, cy - 22]; hb = [-8, cy - 22]; }
  if (p.at === 'down' || p.at === 'dair') hf = [18, -6];
  if (p.sp === 'scream' || p.sp === 'scold' || p.sp === 'brigade' || p.sp === 'crown') { hf = [22, by - 8]; hb = [-22, by - 8]; }
  const fy = p.air ? -7 : -4;
  const f1 = p.air ? -7 : -7 + run * 9, f2 = p.air ? 9 : 7 - run * 9;

  if (L.lamp && !p.portrait) {
    c.save(); const gr = c.createLinearGradient(22, 0, 200, 0);
    gr.addColorStop(0, 'rgba(255,240,150,0.32)'); gr.addColorStop(1, 'rgba(255,240,150,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(22, cy - 6); c.lineTo(200, cy - 70); c.lineTo(200, cy + 50); c.closePath(); c.fill(); c.restore();
  }
  if (L.pack) {
    RR(c, -29, by - 20, 19, 31, 6, '#c0472f', OUT, 2); RR(c, -27, by - 26, 15, 8, 3, '#8a5a2b', OUT, 1.5);
    E(c, -19.5, by - 3, 3.5, 3.5, '#ffd34d', OUT, 1.5);
    c.fillStyle = '#f6f2ff'; E(c, -24, by - 28, 4, 4, '#f6f2ff', OUT, 1); E(c, -24, by - 33, 2, 3, '#3fae3a');
  }
  if (L.pigtails) pigtail(c, -22, hy + 2, L);
  E(c, f1, fy, 8, 5, SHOE, OUT, 2);
  E(c, hb[0], hb[1], 4.5, 4.5, SKIN, OUT, 2);
  if (L.dress) {
    c.beginPath(); c.moveTo(-11, by - 4); c.lineTo(11, by - 4); c.lineTo(17, -8); c.quadraticCurveTo(0, -3, -17, -8); c.closePath();
    c.fillStyle = L.vest; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  } else E(c, 0, -12, 11, 6.5, '#ffffff', OUT, 2);
  E(c, f2, fy, 8, 5, SHOE, OUT, 2);
  E(c, 0, by, 13, 11, L.dress ? '#ffc2df' : L.vest, OUT, 2);
  if (L.dress) { E(c, 0, by + 2, 13, 5, L.vest); }
  c.strokeStyle = L.trim; c.lineWidth = 2.5; c.beginPath(); c.moveTo(7, by - 10); c.lineTo(9, by + 8); c.stroke();
  // head + face
  E(c, 3, hy, 13.5, 12.5, SKIN, OUT, 2);
  c.strokeStyle = '#1a1a1a'; c.lineWidth = 2;
  if (p.hurt) {
    c.beginPath(); c.moveTo(4, hy - 5); c.lineTo(8, hy - 2); c.lineTo(4, hy + 1); c.moveTo(15, hy - 5); c.lineTo(11, hy - 2); c.lineTo(15, hy + 1); c.stroke();
  } else {
    const ey = L.old ? 3 : 4.4;
    E(c, 6.5, hy - 2, 2.6, ey, '#1a1a1a'); E(c, 12.5, hy - 2, 2.4, ey * 0.95, '#1a1a1a');
    E(c, 7.2, hy - 3.6, 1, 1.4, '#fff'); E(c, 13.1, hy - 3.6, 0.9, 1.3, '#fff');
  }
  if (L.old) {
    E(c, 7, hy - 8, 4, 1.8, '#ffffff', OUT, 1); E(c, 13.5, hy - 8, 3.5, 1.8, '#ffffff', OUT, 1);
    E(c, 4, hy + 5, 6.5, 3.4, '#ffffff', OUT, 1.5); E(c, 13, hy + 5, 6.5, 3.4, '#ffffff', OUT, 1.5); E(c, 9, hy + 2, 2.6, 2.2, '#f0b890', OUT, 1);
  } else if (p.yell) E(c, 10, hy + 6, 3.6, 4, '#7a1f2a', OUT, 1.5);
  else { c.beginPath(); c.arc(10, hy + 4, 3.2, 0.2, Math.PI - 0.2); c.stroke(); }
  if (!L.old) E(c, 16, hy + 3, 2.3, 1.4, 'rgba(255,120,120,0.55)');
  cap(c, 0, cy, 27, 19, L.cap, L.spot, TOAD_SPOTS);
  if (L.pigtails) pigtail(c, 21, hy + 5, L);
  if (p.pe) crown(c, 0, cy - 22);
  if (L.lamp) { E(c, 22, cy - 6, 5.5, 5.5, '#ffe866', OUT, 2); E(c, 22, cy - 6, 2.4, 2.4, '#ffffff'); }
  if (p.pick) pickaxe(c, hf[0], hf[1], p.at === 'pick' ? -1.9 + Math.min(1, p.ft / 9) * 2.8 : -0.5);
  E(c, hf[0], hf[1], 4.5, 4.5, SKIN, OUT, 2);
  if (L.old && !p.at && !(p.glide || p.sp === 'parasol')) {
    c.strokeStyle = OUT; c.lineWidth = 5.5; c.beginPath(); c.moveTo(hf[0] + 1, hf[1] - 4); c.lineTo(hf[0] + 4, 0); c.stroke();
    c.strokeStyle = '#8a5326'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.arc(hf[0] - 3, hf[1] - 4, 4, 0, Math.PI, true); c.stroke();
  }
  if (p.hold) { c.save(); c.translate(2, cy - 34); turnipShape(c, 'turnip'); c.restore(); }
}

function drawYoshi(c, L, p) {
  const t = p.t || 0, st = p.st;
  const run = st === 'run' ? Math.sin(t * 0.5) : 0;
  const bob = st === 'idle' ? Math.sin(t * 0.1) * 1.2 : st === 'run' ? -Math.abs(run) * 2 : 0;
  const crouch = st === 'shield' || st === 'land' || p.at === 'down' ? 4 : 0;
  const fl = p.sp === 'flutter' ? Math.sin(t * 1.3) * 9 : 0;
  const B = bob + crouch;
  const fy = p.air ? -7 : -5;
  c.beginPath(); c.moveTo(-13, -20 + B); c.quadraticCurveTo(-32, -16 + B, -27, -6 + B); c.quadraticCurveTo(-19, -10 + B, -11, -12 + B); c.closePath();
  c.fillStyle = L.body; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  E(c, (p.air ? -6 : -7 + run * 9) + fl, fy, 9.5, 5.5, L.shoe, OUT, 2);
  E(c, -1, -24 + B, 15, 15, L.body, OUT, 2);
  E(c, 4, -21 + B, 9, 10, '#ffffff');
  E(c, -10, -36 + B, 10, 5, L.saddle, OUT, 2); E(c, -10, -37 + B, 6, 2.5, '#ffffff');
  E(c, (p.air ? 9 : 7 - run * 9) - fl, fy, 9.5, 5.5, L.shoe, OUT, 2);
  for (const s of [[-7, -56], [-9, -48], [-8, -41]]) E(c, s[0], s[1] + B, 4.5, 4, '#e8262b', OUT, 1.5);
  E(c, 5, -48 + B, 13, 13, L.body, OUT, 2);
  E(c, 13, -38 + B, 11, 5.5, '#ffffff', OUT, 1.5);
  E(c, 21, -45 + B, 12.5, 10.5, L.body, OUT, 2);
  E(c, 27, -49 + B, 1.6, 2.2, '#1a1a1a'); E(c, 22, -50 + B, 1.6, 2.2, '#1a1a1a');
  E(c, 2, -61 + B, 5, 8, '#ffffff', OUT, 2); E(c, 10, -60 + B, 5, 8, '#ffffff', OUT, 2);
  if (p.hurt) {
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -62 + B); c.lineTo(5, -60 + B); c.moveTo(8, -61 + B); c.lineTo(13, -59 + B); c.stroke();
  } else { E(c, 4, -59 + B, 2.2, 4, '#111'); E(c, 12, -58 + B, 2.2, 4, '#111'); }
  if (p.yell || p.sp === 'egg') E(c, 16, -36 + B, 5, 3, '#ff6f9a', OUT, 1.5);
  const hx = p.at === 'jab' || p.at === 'throw' ? 22 : 12, hyy = p.at === 'up' || p.at === 'uair' || p.hold ? -62 : -27;
  E(c, hx, hyy + B, 4.5, 4, L.body, OUT, 2);
  if (p.hold) { c.save(); c.translate(6, -82 + B); turnipShape(c, 'turnip'); c.restore(); }
  if (p.pe) crown(c, 6, -66 + B);
}

function drawFigure(c, ch, p) {
  const C = CH[ch];
  if (C.yoshi) drawYoshi(c, C.look, p); else drawToad(c, C.look, p);
}

function poseOf(f, fr) {
  return {
    t: fr + f.i * 17, st: f.st, air: f.gi < 0 && f.st !== 'ledge', at: f.st === 'atk' ? f.at : null, ft: f.t,
    sp: f.st === 'spc' ? f.sp : null, pe: f.pe > 0, pick: f.pick > 0, glide: f.glide > 0, hold: f.hold,
    yell: f.st === 'spc' && (f.sp === 'scream' || f.sp === 'scold'), hurt: f.st === 'hit' || f.st === 'stun',
  };
}

function drawFighter(c, f, fr) {
  if (f.st === 'dead' || f.out) return;
  const C = CH[f.ch], sc = f.sc || 1, mid = -C.h / 2;
  c.save();
  c.translate(f.x, f.y);
  if (f.rp > 0) { RR(c, -36, 0, 72, 10, 5, '#fff7c2', OUT, 2); E(c, 0, 14, 26, 4, 'rgba(255,210,60,0.5)'); }
  if (f.inv > 0 && f.rp <= 0 && Math.floor(fr / 3) % 2 === 0) c.globalAlpha = 0.5;
  c.scale(sc, sc);
  if (f.st === 'hit' && f.hs > 18) { c.translate(0, mid); c.rotate(fr * 0.4 * f.fc); c.translate(0, -mid); }
  if ((f.sp === 'pound' || f.sp === 'yoshipound') && f.t < 14) { c.translate(0, mid); c.rotate((f.t / 14) * Math.PI * 2 * f.fc); c.translate(0, -mid); }
  if (f.st === 'atk' && f.at === 'nair') { c.translate(0, mid); c.rotate((f.t / ATK[f.ch].nair.dur) * Math.PI * 2 * f.fc); c.translate(0, -mid); }
  if (f.sp === 'pounce') { c.translate(0, mid); c.rotate(0.6 * f.fc); c.translate(0, -mid); }
  if (f.st === 'ledge') c.translate(0, -4);
  let sx = f.fc;
  if (f.sp === 'sporespin' || f.sp === 'pigspin') { sx = Math.cos(fr * 0.9); if (Math.abs(sx) < 0.18) sx = sx < 0 ? -0.18 : 0.18; }
  c.scale(sx, 1);
  drawFigure(c, f.ch, poseOf(f, fr));
  c.restore();
  drawFighterFx(c, f, fr);
}

function drawFighterFx(c, f, fr) {
  const sc = f.sc || 1, cx = f.x, cy = f.y - f.h * 0.5, top = f.y - f.h;
  c.save();
  if (f.ch === 'blue' && (f.sp === 'propeller' || f.glide > 0)) {
    const w = Math.abs(Math.cos(fr * 0.8)) * 28 * sc + 4;
    c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, top + 2); c.lineTo(cx, top - 10 * sc); c.stroke();
    E(c, cx, top - 12 * sc, w, 4 * sc, '#ffb02e', OUT, 2); E(c, cx, top - 12 * sc, 3, 3, '#e8262b');
  }
  if (f.ch === 'toadsworth' && (f.sp === 'parasol' || f.glide > 0)) {
    const px = cx + f.fc * 8 * sc, py = top - 26 * sc, r = 36 * sc;
    c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(px, py); c.lineTo(cx + f.fc * 12 * sc, top + 14 * sc); c.stroke();
    c.beginPath(); c.arc(px, py, r, Math.PI, 0); c.quadraticCurveTo(px, py - 8 * sc, px - r, py); c.fillStyle = '#7b3fb0'; c.fill();
    c.save(); c.clip(); for (let i = -3; i <= 3; i += 2) { c.fillStyle = '#ffffff'; c.fillRect(px + i * r / 3.5 - r / 7, py - r, r / 3.5, r); } c.restore();
    c.beginPath(); c.arc(px, py, r, Math.PI, 0); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  }
  if (f.sp === 'tanooki') {
    c.save(); c.translate(cx - f.fc * 20 * sc, f.y - 18 * sc); c.rotate(f.fc * (0.6 + Math.sin(fr * 0.8) * 0.6));
    E(c, -f.fc * 10 * sc, 0, 14 * sc, 6 * sc, '#c47a2c', OUT, 2);
    E(c, -f.fc * 18 * sc, 0, 4 * sc, 5 * sc, '#2b1a12'); c.restore();
    E(c, cx - 10 * sc, top - 4 * sc, 5 * sc, 7 * sc, '#c47a2c', OUT, 2); E(c, cx + 10 * sc, top - 4 * sc, 5 * sc, 7 * sc, '#c47a2c', OUT, 2);
  }
  if (f.sp === 'boost' && f.t < 16) {
    const bx = cx - f.fc * 19 * sc, by = f.y - 8 * sc, l = (18 + Math.random() * 12) * sc;
    c.beginPath(); c.moveTo(bx - 7 * sc, by); c.lineTo(bx, by + l); c.lineTo(bx + 7 * sc, by); c.closePath(); c.fillStyle = '#ff8a1f'; c.fill();
    c.beginPath(); c.moveTo(bx - 3 * sc, by); c.lineTo(bx, by + l * 0.6); c.lineTo(bx + 3 * sc, by); c.closePath(); c.fillStyle = '#ffe866'; c.fill();
  }
  if (f.sp === 'scream' && f.t >= 6 && f.t <= 42) {
    const rad = Math.min(150, 40 + (f.t - 6) * 4) * sc;
    c.globalAlpha = 0.5 * (1 - (f.t - 6) / 40);
    c.strokeStyle = '#fff6a0'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, rad * 0.7, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
  }
  if (f.sp === 'scold' && f.t >= 10 && f.t <= 18) {
    c.globalAlpha = 0.6; c.strokeStyle = '#ffffff'; c.lineWidth = 4;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(cx + f.fc * (20 + k * 18) * sc, cy, (16 + k * 10) * sc, f.fc > 0 ? -0.9 : Math.PI - 0.9, f.fc > 0 ? 0.9 : Math.PI + 0.9); c.stroke(); }
    c.globalAlpha = 1;
  }
  if (f.sp === 'pigspin' && f.t < 38) { c.globalAlpha = 0.45; c.strokeStyle = '#ff8cc6'; c.lineWidth = 7; c.beginPath(); c.arc(cx, cy, 40 * sc, fr * 0.6, fr * 0.6 + 4); c.stroke(); c.globalAlpha = 1; }
  if (f.sp === 'sporespin' && f.t < 30) {
    for (let k = 0; k < 6; k++) { const a = fr * 0.5 + k * 1.047; E(c, cx + Math.cos(a) * 36 * sc, cy - 6 + Math.sin(a) * 14 * sc, 4, 4, k % 2 ? '#e8262b' : '#ffffff', OUT, 1); }
  }
  if (f.sp === 'counter' && f.ctrT === 0 && f.t >= 3 && f.t <= 32) {
    c.globalAlpha = 0.5 + Math.sin(fr * 0.8) * 0.2; c.strokeStyle = '#7dff8a'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, f.h * 0.65, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
  }
  if (f.sp === 'pickaxe' && f.t < 14) txt(c, '!', cx, top - 18, 28, '#ffe866', OUT);
  if (f.st === 'shield') {
    const r = f.h * 0.62 * (0.45 + 0.55 * (f.shd / 100));
    c.globalAlpha = 0.38; E(c, cx, cy, r, r, SLOT_COLORS[f.i]); c.globalAlpha = 0.75; E(c, cx, cy, r, r, null, '#ffffff', 2); c.globalAlpha = 1;
  }
  if (f.frz > 0) { c.globalAlpha = 0.55; RR(c, f.x - f.w * 0.75, top - 6, f.w * 1.5, f.h + 8, 8, '#a8e8ff', '#ffffff', 2); c.globalAlpha = 1; }
  if (f.star > 0) { c.globalAlpha = 0.35; E(c, cx, cy, f.h * 0.7, f.h * 0.7, `hsl(${(fr * 14) % 360},100%,60%)`); c.globalAlpha = 1; }
  if (f.st === 'stun') { for (let k = 0; k < 3; k++) { const a = fr * 0.15 + k * 2.1; c.save(); starPath(c, cx + Math.cos(a) * 18, top - 8 + Math.sin(a) * 5, 6, 3, a); c.fillStyle = '#ffe866'; c.fill(); c.restore(); } }
  drawAtkFx(c, f);
  if (f.tag && f.rp <= 0) {
    const ty = top - 14 - (f.hold ? 34 * sc : 0) - (f.pe ? 10 : 0);
    c.beginPath(); c.moveTo(f.x - 6, ty - 4); c.lineTo(f.x + 6, ty - 4); c.lineTo(f.x, ty + 3); c.closePath(); c.fillStyle = SLOT_COLORS[f.i]; c.fill();
    txt(c, f.tag, f.x, ty - 8, 15, SLOT_COLORS[f.i], OUT, 'center', 3);
  } else if (f.rp > 0) txt(c, f.tag || '', f.x, top - 16, 15, SLOT_COLORS[f.i], OUT, 'center', 3);
  c.restore();
}

function drawAtkFx(c, f) {
  if (f.st !== 'atk' || !f.at) return;
  const A = ATK[f.ch][f.at];
  if (!A) return;
  const sc = f.sc || 1, cx = f.x, cy = f.y - f.h * 0.5;
  for (const hb of A.hb) {
    if (f.t < hb.a - 1 || f.t > hb.b + 3) continue;
    const k = clamp((f.t - hb.a + 1) / (hb.b - hb.a + 4), 0, 1);
    const x = f.x + hb.x * f.fc * sc, y = f.y + hb.y * sc, r = hb.r * sc;
    c.save();
    c.globalAlpha = 0.9 * (1 - k * 0.7);
    c.lineCap = 'round';
    if (A.fx === 'tongue') {
      c.strokeStyle = '#ff6f9a'; c.lineWidth = 7 * sc; c.beginPath(); c.moveTo(f.x + f.fc * 20 * sc, f.y - 40 * sc); c.lineTo(x, y); c.stroke();
      E(c, x, y, 9 * sc, 9 * sc, '#ff4f86', OUT, 2);
    } else if (A.fx === 'cane') {
      c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(f.x + f.fc * 14 * sc, f.y - 26 * sc); c.lineTo(x + f.fc * r * 0.7, y); c.stroke();
      c.strokeStyle = '#8a5326'; c.lineWidth = 3.5; c.stroke();
    }
    if (A.fx !== 'tongue') {
      const d = Math.hypot(x - cx, y - cy);
      c.strokeStyle = '#ffffff';
      if (d < 12 || A.fx === 'spin') { c.lineWidth = 7; c.beginPath(); c.arc(cx, cy, r, k * 6, k * 6 + 4.2); c.stroke(); }
      else {
        const ang = Math.atan2(y - cy, x - cx);
        c.lineWidth = r * 0.5; c.beginPath(); c.arc(cx, cy, d, ang - 0.8, ang + 0.8); c.stroke();
        c.globalAlpha *= 0.5; E(c, x, y, r * 0.8, r * 0.8, '#fffbe0');
      }
    }
    c.restore();
  }
}

// ---------- Projectiles, items, hazards ----------
const MINION_LOOK = {
  mail: { cap: '#ffffff', spot: '#2f9e4a', vest: '#3a6bd6', trim: '#f4c430' },
  bank: { cap: '#ffffff', spot: '#ffc81a', vest: '#6b3fb0', trim: '#f4c430' },
  hint: { cap: '#ffffff', spot: '#e8262b', vest: '#2557d6', trim: '#f4c430' },
};
function mushItem(c, col, spot, angry) {
  RR(c, -9, -16, 18, 16, 5, '#fff2d8', OUT, 2);
  E(c, -3.5, -9, 1.6, 3, '#111'); E(c, 3.5, -9, 1.6, 3, '#111');
  if (angry) { c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -14); c.lineTo(-2, -12); c.moveTo(6, -14); c.lineTo(2, -12); c.stroke(); }
  cap(c, 0, -14, 17, 13, col, spot, [[0, -0.95, 0.3], [-0.7, -0.35, 0.25], [0.7, -0.35, 0.25]]);
}
function drawProj(c, p, fr) {
  c.save(); c.translate(p.x, p.y);
  const s = p.vx >= 0 ? 1 : -1;
  switch (p.k) {
    case 'turnip': c.rotate(p.t * 0.25 * s); turnipShape(c, p.face); break;
    case 'bomb':
      c.rotate(p.t * 0.15 * s);
      c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(4, -18, 2, -22); c.stroke();
      E(c, 2, -23, 3.5, 3.5, fr % 6 < 3 ? '#ffe866' : '#ff8a1f');
      E(c, 0, 0, 13, 13, '#26262e', OUT, 2); E(c, -4, -5, 3, 2, '#7a7a88');
      E(c, 4, -1, 2, 3.4, '#fff'); E(c, 9, -1, 2, 3.4, '#fff');
      break;
    case 'ice': E(c, 0, 0, 12, 12, '#9fe4ff', OUT, 2); E(c, -4, -4, 4, 3, '#ffffff'); break;
    case 'fire': { const fl = Math.sin(fr * 0.9) * 1.5; E(c, 0, 0, 11 + fl, 11 + fl, '#ff6a1a', OUT, 2); E(c, 1, 1, 6.5, 6.5, '#ffd23a'); break; }
    case 'boom':
      c.rotate(p.t * 0.5);
      c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 9; c.beginPath(); c.moveTo(-15, 7); c.quadraticCurveTo(0, -16, 15, 7); c.stroke();
      c.strokeStyle = '#3fae3a'; c.lineWidth = 5; c.stroke();
      break;
    case 'psn': c.translate(0, 13); mushItem(c, '#6a2fa0', '#2b1a4a', true); break;
    case 'egg': c.rotate(p.t * 0.2 * s); E(c, 0, 0, 11, 13, '#ffffff', OUT, 2); E(c, -4, -4, 3, 3, '#3dbb3d'); E(c, 4, 3, 3.2, 3.2, '#3dbb3d'); E(c, -2, 7, 2.2, 2.2, '#3dbb3d'); break;
    case 'coin': { const w = Math.abs(Math.cos(p.t * 0.3)) * 9 + 1; E(c, 0, 0, w, 10, '#ffd23a', OUT, 2); if (w > 4) RR(c, -1.5, -5, 3, 10, 1.5, '#e0a810'); break; }
    case 'minion': {
      c.scale((p.fc || 1) * 0.75, 0.75);
      drawToad(c, MINION_LOOK[p.sub] || MINION_LOOK.mail, { t: fr + p.id * 9, st: p.sub === 'mail' ? 'run' : 'idle', air: false });
      if (p.sub === 'mail') { RR(c, -24, -32, 14, 14, 3, '#c88a3a', OUT, 2); RR(c, -21, -29, 8, 5, 1, '#ffffff'); }
      if (p.sub === 'bank') { RR(c, -12, -82, 24, 14, 3, '#2b2b2b', OUT, 2); RR(c, -18, -70, 36, 5, 2, '#2b2b2b', OUT, 2); }
      if (p.sub === 'hint') {
        c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(18, -20); c.lineTo(18, -96); c.stroke();
        RR(c, 0, -122, 40, 30, 5, '#fff7c2', OUT, 2); txt(c, '!', 20, -98, 24, '#e8262b', null);
      }
      break;
    }
    default: {
      // the newer projectiles get a simple coloured token in the 2D fallback
      const col = { cannon: '#2b2b34', shuriken: '#c8d0dc', haze: 'rgba(160,90,216,0.5)', pancake: '#e8a64a', star: '#ffe066', laser: '#9ffcff', pill: '#e8343f',
        note: '#ff4f9a', cork: '#c8935a', tumble: '#a07a44', boo: '#f6f6fb', fist: '#a4adba', pie: '#d8944a', fsdrop: '#ffffff', trap: '#d8b0ff' }[p.k] || '#ffffff';
      const r = Math.max(6, p.r || 12);
      if (p.k === 'trap') c.scale(1, 0.3);
      else c.rotate(p.t * 0.2 * s);
      E(c, 0, 0, r, r, col, OUT, 2);
      if (p.k === 'boo') { E(c, -4, -3, 2, 3.5, '#111'); E(c, 4, -3, 2, 3.5, '#111'); }
    }
  }
  c.restore();
}
// 2D fallback for stage hazards and Smash Mushroom finales
function drawHaz2D(c, view, fr) {
  const st = STG[view.stage], s0 = st.solids[0], H = view.haz;
  if (H && H.wig && H.wig.on) {
    const Wg = H.wig;
    for (let k = 4; k >= 0; k--) { const x = Wg.x - Wg.dir * (k ? 20 + k * 34 : 0), r = k ? 18 : 24; E(c, x, s0.y - r - Math.abs(Math.sin(fr * 0.25 + k)) * 6, r, r, Wg.angry ? '#e8402a' : '#ffc21f', OUT, 2); }
  }
  if (st.spikes) st.spikes.forEach((tl, k) => {
    const s = H && H.spk && H.spk[k];
    RR(c, tl.x, s0.y - 3, tl.w, 5, 2, '#8a8f99', OUT, 1.5);
    if (!s || s.ph === 'idle') return;
    const h = s.ph === 'up' ? 22 : 6;
    c.fillStyle = '#dfe6ee'; c.strokeStyle = OUT; c.lineWidth = 1.5;
    for (let x = tl.x + 8; x < tl.x + tl.w - 4; x += 14) { c.beginPath(); c.moveTo(x - 6, s0.y); c.lineTo(x, s0.y - h); c.lineTo(x + 6, s0.y); c.closePath(); c.fill(); c.stroke(); }
  });
  if (st.boost) for (const b of st.boost) {
    RR(c, b.x, s0.y - 3, b.w, 5, 2, '#2a2c38');
    for (let k = 0; k < 3; k++) {
      const x = b.x + b.w * (0.2 + k * 0.3);
      c.strokeStyle = Math.sin(fr * 0.22 - k * 1.1) > 0 ? '#ffd23a' : '#8a6a20'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(x - b.dir * 8, s0.y - 12); c.lineTo(x + b.dir * 4, s0.y - 5); c.lineTo(x - b.dir * 8, s0.y + 2); c.stroke();
    }
  }
}
function drawFx2D(c, view, fr) {
  const s0 = STG[view.stage].solids[0];
  for (const e of view.fx || []) {
    c.save();
    switch (e.k) {
      case 'wave':
        for (const [x0, d] of e.both ? [[e.x, e.dir], [e.x2, -e.dir]] : [[e.x, e.dir]]) for (let k = 0; k < 6; k++) {
          c.save(); c.translate(x0 - d * k * 30, s0.y); c.scale(d * 0.8, 0.8); drawToad(c, MINION_LOOK[['mail', 'bank', 'hint'][k % 3]], { t: fr + k * 9, st: 'run', air: false }); c.restore();
        }
        break;
      case 'meteor': E(c, e.x, e.y - 60, (e.r || 200) * 0.4, (e.r || 200) * 0.4, e.sub === 'cake' ? '#f6c8dc' : '#ffb02e', OUT, 3); break;
      case 'vortex': c.globalAlpha = 0.5; for (let k = 0; k < 4; k++) { c.strokeStyle = e.sub === 'rune' ? '#d8b0ff' : '#7fd05a'; c.lineWidth = 5; c.beginPath(); c.arc(e.x, e.y, (e.r || 200) * (0.3 + k * 0.18), fr * 0.15 + k, fr * 0.15 + k + 2); c.stroke(); } break;
      case 'flood': c.globalAlpha = 0.5; c.fillStyle = '#7a2aa8'; c.fillRect(-1500, e.lv, 3000, 1200); break;
      case 'beam': if (e.t >= 24) { c.globalAlpha = 0.7; c.fillStyle = '#fff6c8'; c.fillRect(e.dir > 0 ? e.x : e.x - 1400, e.y - 60, 1400, 120); } break;
      case 'sweep': if (e.t >= 16) { c.globalAlpha = 0.6; c.fillStyle = '#9ffcff'; c.fillRect(e.x - 50, -1200, 100, 1200 + s0.y); } break;
      case 'swarm': if (e.b) for (const b of e.b) E(c, b[0], b[1], 16, 16, '#f6f6fb', OUT, 2); break;
      case 'fist': E(c, e.x, e.y, 70, 60, '#a4adba', OUT, 3); break;
    }
    c.restore();
  }
}

function drawItem(c, it, fr) {
  if (it.life - it.t < 120 && Math.floor(fr / 5) % 2) return;
  c.save(); c.translate(it.x, it.y);
  switch (it.k) {
    case 'mush': mushItem(c, '#e8262b', '#ffffff'); break;
    case 'mini': c.scale(0.7, 0.7); mushItem(c, '#2f7cf6', '#ffffff'); break;
    case 'poison': mushItem(c, '#5b2a86', '#2b1a4a', true); break;
    case 'oneup': mushItem(c, '#29b34a', '#ffffff'); break;
    case 'gold': mushItem(c, '#ffc21f', '#fff3a0'); if (fr % 20 < 10) { starPath(c, 12, -28, 5, 2, 0); c.fillStyle = '#fff'; c.fill(); } break;
    case 'star': {
      const b = Math.sin(fr * 0.2) * 4;
      starPath(c, 0, -18 + b, 17, 8, Math.sin(fr * 0.1) * 0.2); c.fillStyle = `hsl(${50 + Math.sin(fr * 0.3) * 10},100%,58%)`; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      E(c, -4, -19 + b, 1.8, 3.4, '#111'); E(c, 4, -19 + b, 1.8, 3.4, '#111');
      break;
    }
    case 'turnip':
      if (it.sprout && it.vy === 0) {
        c.fillStyle = '#3fae3a'; c.strokeStyle = OUT; c.lineWidth = 1.5;
        for (const a of [-0.5, 0, 0.5]) { c.save(); c.translate(0, -2); c.rotate(a + Math.sin(fr * 0.1) * 0.08); c.beginPath(); c.ellipse(0, -9, 4, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore(); }
        E(c, 0, -1, 8, 3, '#f6f2ff', OUT, 1.5);
      } else { c.translate(0, -12); turnipShape(c, 'turnip'); }
      break;
    case 'chest':
      RR(c, -22, -30, 44, 30, 5, '#b0632b', OUT, 2); RR(c, -22, -30, 44, 12, 5, '#d0833f', OUT, 2);
      RR(c, -4, -23, 8, 10, 2, '#ffd23a', OUT, 1.5);
      cap(c, -12, -6, 6, 4, '#e8262b', '#fff', [[0, -0.8, 0.35]]);
      break;
    case 'smash':
      c.globalAlpha = 0.35; E(c, 0, 0, 30, 30, `hsl(${(fr * 6) % 360},95%,70%)`); c.globalAlpha = 1;
      c.translate(0, 15); mushItem(c, `hsl(${(fr * 6) % 360},90%,58%)`, '#ffffff');
      break;
  }
  c.restore();
}

function drawCloud(c, cl, fr) {
  c.save(); c.globalAlpha = cl.life < 60 ? cl.life / 60 : 1;
  const x = cl.x + cl.w / 2, y = cl.y + 10;
  for (const b of [[-40, 4, 22], [-14, -4, 26], [16, -2, 24], [42, 5, 18]]) E(c, x + b[0], y + b[1], b[2], b[2] * 0.75, '#ffffff', OUT, 2);
  E(c, x - 50, y + 8, 14, 10, '#ffffff'); E(c, x, y + 6, 54, 12, '#ffffff');
  E(c, x - 6, y - 2, 1.8, 3, '#2b1a12'); E(c, x + 6, y - 2, 1.8, 3, '#2b1a12');
  c.restore();
}

function drawKart(c, k, fr) {
  if (k.warn > 0) return;
  const col = ['#e8262b', '#2f7cf6', '#ffc81a', '#29b34a'][k.c || 0];
  c.save(); c.translate(k.x, 0); c.scale(k.dir, 1);
  c.save(); c.translate(-8, -30); c.scale(0.72, 0.72); drawToad(c, { cap: '#fff', spot: col, vest: '#2557d6', trim: '#f4c430' }, { t: fr, st: 'idle', air: false }); c.restore();
  c.beginPath(); c.moveTo(-58, -12); c.lineTo(-52, -38); c.lineTo(-20, -40); c.lineTo(10, -24); c.lineTo(52, -24); c.lineTo(60, -10); c.lineTo(-58, -10); c.closePath();
  c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
  RR(c, 30, -30, 26, 8, 3, '#d9dde6', OUT, 2);
  for (const wx of [-36, 36]) { E(c, wx, -10, 13, 13, '#222', OUT, 2); E(c, wx, -10, 5, 5, '#bbb'); }
  for (let n = 0; n < 3; n++) E(c, -64 - n * 14 - (fr % 6), -12 - n * 2, 6 + n * 2, 5 + n * 2, 'rgba(200,200,210,0.5)');
  c.restore();
}

// ---------- Backgrounds (screen space, parallax) ----------
function skyGrad(c, a, b) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); }
function hills(c, cam, k, base, amp, freq, col, off) {
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) c.lineTo(x, base - cam.y * k * 0.4 + Math.sin((x + cam.x * k + off) * freq) * amp + Math.sin((x + cam.x * k) * freq * 2.3 + off) * amp * 0.4);
  c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill();
}
function puff(c, x, y, s, col) { c.fillStyle = col; for (const b of [[-1.2, 0.2, 0.7], [-0.4, -0.3, 1], [0.6, -0.1, 0.85], [1.3, 0.25, 0.6]]) { c.beginPath(); c.ellipse(x + b[0] * 30 * s, y + b[1] * 30 * s, b[2] * 32 * s, b[2] * 24 * s, 0, 0, Math.PI * 2); c.fill(); } }
function mushHouse(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s);
  RR(c, -34, -62, 68, 62, 10, '#fff3dc', OUT, 2.5);
  RR(c, -10, -34, 20, 34, 9, '#a0602c', OUT, 2); E(c, 5, -16, 1.8, 1.8, '#ffd23a');
  E(c, -21, -40, 7, 7, '#7fd0ff', OUT, 2); E(c, 21, -40, 7, 7, '#7fd0ff', OUT, 2);
  cap(c, 0, -58, 58, 38, col, '#ffffff', [[-0.5, -0.5, 0.2], [0.15, -0.95, 0.24], [0.62, -0.35, 0.18]]);
  c.restore();
}
function isoCube(c, x, y, s, top, left, right) {
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y - s / 2); c.lineTo(x, y); c.lineTo(x - s, y - s / 2); c.closePath(); c.fillStyle = top; c.fill();
  c.beginPath(); c.moveTo(x - s, y - s / 2); c.lineTo(x, y); c.lineTo(x, y + s); c.lineTo(x - s, y + s / 2); c.closePath(); c.fillStyle = left; c.fill();
  c.beginPath(); c.moveTo(x + s, y - s / 2); c.lineTo(x, y); c.lineTo(x, y + s); c.lineTo(x + s, y + s / 2); c.closePath(); c.fillStyle = right; c.fill();
}
function drawBG(c, id, cam, fr) {
  if (id === 'town') {
    skyGrad(c, '#5cb6ff', '#dff4ff');
    E(c, 1060, 120, 80, 80, 'rgba(255,250,200,0.35)'); E(c, 1060, 120, 52, 52, '#fff6b0');
    for (let k = 0; k < 5; k++) puff(c, ((k * 330 + fr * 0.25 - cam.x * 0.05) % (W + 300) + W + 300) % (W + 300) - 150, 90 + hash(k) * 120, 0.8 + hash(k + 3) * 0.6, 'rgba(255,255,255,0.9)');
    hills(c, cam, 0.06, 470, 28, 0.006, '#a6e083', 10);
    for (let k = -7; k <= 7; k++) {
      const sx = W / 2 + k * 250 - cam.x * 0.22, sy = 545 - cam.y * 0.1;
      if (sx < -150 || sx > W + 150) continue;
      mushHouse(c, sx, sy, 0.85 + hash(k + 20) * 0.35, ['#e8262b', '#2f7cf6', '#29b34a', '#ffc81a', '#9b4fd6'][(k + 14) % 5]);
    }
    hills(c, cam, 0.4, 590, 18, 0.01, '#6cc24a', 50);
  } else if (id === 'diorama') {
    skyGrad(c, '#2a1d5a', '#f39a72');
    for (let k = 0; k < 40; k++) { const x = hash(k) * W, y = hash(k + 99) * 300; E(c, x, y, 1.4, 1.4, `rgba(255,255,255,${0.4 + 0.4 * Math.sin(fr * 0.05 + k)})`); }
    for (let k = 0; k < 9; k++) {
      const sx = ((hash(k + 5) * 1600 - cam.x * 0.15) % 1600 + 1600) % 1600 - 160, sy = 140 + hash(k + 40) * 380 + Math.sin(fr * 0.02 + k) * 8 - cam.y * 0.08;
      const s = 18 + hash(k + 7) * 34;
      isoCube(c, sx, sy, s, '#8fdc6a', '#a0673a', '#7e4f2b');
      if (k % 3 === 0) { RR(c, sx - 2, sy - s - 18, 4, 14, 2, '#7a4a22'); E(c, sx, sy - s - 22, 8, 8, '#2f9e4a'); }
    }
  } else if (id === 'turnpike') {
    skyGrad(c, '#0c0f33', '#4a2f7a');
    for (let k = 0; k < 50; k++) E(c, hash(k) * W, hash(k + 50) * 280, 1.2, 1.2, 'rgba(255,255,255,0.7)');
    E(c, 980, 110, 46, 46, '#fff6d6'); E(c, 966, 100, 8, 8, '#efe2b8'); E(c, 994, 124, 6, 6, '#efe2b8');
    for (const layer of [[0.1, '#241c4d', 300, 0], [0.25, '#171236', 360, 7]]) {
      for (let k = -12; k <= 12; k++) {
        const bw = 70 + hash(k + layer[3]) * 60, bh = 120 + hash(k + 30 + layer[3]) * 220;
        const sx = W / 2 + k * 110 - cam.x * layer[0], base = H - 60 - cam.y * layer[0] * 0.5;
        if (sx < -150 || sx > W + 150) continue;
        c.fillStyle = layer[1]; c.fillRect(sx, base - bh, bw, bh + 80);
        for (let wy = base - bh + 12; wy < base - 10; wy += 18) for (let wx = sx + 8; wx < sx + bw - 10; wx += 16)
          if (hash(wx * 3 + wy) > 0.55) { c.fillStyle = 'rgba(255,220,120,0.75)'; c.fillRect(wx, wy, 7, 9); }
      }
    }
  } else {
    skyGrad(c, '#ff9e5e', '#ffe6b0');
    E(c, 640 - cam.x * 0.03, 300, 120, 120, 'rgba(255,240,190,0.6)');
    c.fillStyle = '#c0703e';
    c.beginPath(); c.moveTo(0, H); c.lineTo(0, 120); c.lineTo(160 - cam.x * 0.08, 200); c.lineTo(230 - cam.x * 0.08, 420); c.lineTo(120 - cam.x * 0.08, H); c.fill();
    c.beginPath(); c.moveTo(W, H); c.lineTo(W, 140); c.lineTo(1110 - cam.x * 0.08, 230); c.lineTo(1050 - cam.x * 0.08, 450); c.lineTo(1160 - cam.x * 0.08, H); c.fill();
    for (let k = -5; k <= 5; k++) {
      const sx = W / 2 + k * 240 - cam.x * 0.2, h = 220 + hash(k + 60) * 200, sy = H - cam.y * 0.1 + 40;
      if (sx < -200 || sx > W + 200) continue;
      RR(c, sx - 14, sy - h, 28, h, 10, '#f3e0bf', 'rgba(0,0,0,0.2)', 2);
      cap(c, sx, sy - h + 10, 70 + hash(k) * 30, 44, ['#ff7a2a', '#e8262b', '#3a8bff', '#ffc21f'][(k + 10) % 4], '#ffffff', TOAD_SPOTS);
    }
  }
}

// ---------- Stage foreground (world space) ----------
function drawStageFG(c, id, surf, fr) {
  const st = STG[id];
  if (id === 'diorama') {
    c.save(); c.setLineDash([6, 10]); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 3;
    for (const p of st.plats) if (p.move) { c.beginPath(); c.moveTo(p.x + p.w / 2 - p.move.ax, p.y - p.move.ay + 15); c.lineTo(p.x + p.w / 2 + p.move.ax, p.y + p.move.ay + 15); c.stroke(); }
    c.restore();
  }
  for (const s of surf) {
    if (s.cloud) continue;
    const cx = s.x + s.w / 2;
    if (id === 'town') {
      if (s.solid) {
        c.beginPath(); c.moveTo(s.x + 30, s.y + s.h); c.lineTo(cx, s.y + s.h + 110); c.lineTo(s.x + s.w - 30, s.y + s.h); c.closePath(); c.fillStyle = '#9a6a3c'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
        RR(c, s.x, s.y, s.w, s.h, 18, '#d9a86c', OUT, 2.5);
        for (let row = 0; row < 3; row++) for (let x = s.x + 20 + (row % 2) * 24; x < s.x + s.w - 20; x += 48) E(c, x, s.y + 32 + row * 26, 18, 9, '#c4935a');
        RR(c, s.x - 6, s.y - 4, s.w + 12, 16, 8, '#5ac83a', OUT, 2.5);
      } else {
        RR(c, cx - 13, s.y + 10, 26, 110, 8, '#fff3dc', OUT, 2);
        c.beginPath(); c.ellipse(cx, s.y + 12, s.w / 2 + 8, 17, 0, 0, Math.PI * 2); c.fillStyle = '#e8262b'; c.fill();
        c.save(); c.clip(); for (const k of [-0.6, 0, 0.6]) E(c, cx + k * s.w / 2, s.y + 6 - Math.abs(k) * -4, 14, 7, '#ffffff'); c.restore();
        c.beginPath(); c.ellipse(cx, s.y + 12, s.w / 2 + 8, 17, 0, 0, Math.PI * 2); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
      }
    } else if (id === 'diorama') {
      if (s.solid) {
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + 26, s.y - 22); c.lineTo(s.x + s.w + 26, s.y - 22); c.lineTo(s.x + s.w, s.y); c.closePath(); c.fillStyle = '#a8ec7a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.moveTo(s.x + s.w, s.y); c.lineTo(s.x + s.w + 26, s.y - 22); c.lineTo(s.x + s.w + 26, s.y + s.h - 22); c.lineTo(s.x + s.w, s.y + s.h); c.closePath(); c.fillStyle = '#6e4424'; c.fill(); c.stroke();
        c.fillStyle = '#b9773e'; c.fillRect(s.x, s.y, s.w, s.h); c.strokeRect(s.x, s.y, s.w, s.h);
        c.strokeStyle = 'rgba(80,40,10,0.35)'; c.lineWidth = 2;
        for (let x = s.x + 76; x < s.x + s.w; x += 76) { c.beginPath(); c.moveTo(x, s.y + 16); c.lineTo(x, s.y + s.h); c.stroke(); }
        for (let y = s.y + 76; y < s.y + s.h; y += 70) { c.beginPath(); c.moveTo(s.x, y); c.lineTo(s.x + s.w, y); c.stroke(); }
        RR(c, s.x - 2, s.y - 2, s.w + 4, 18, 4, '#6fd04a', OUT, 2);
        for (let k = 0; k < 4; k++) { const gx = s.x + 90 + k * 190, gy = s.y + 60 + (k % 2) * 70; c.beginPath(); c.moveTo(gx, gy - 12); c.lineTo(gx + 9, gy); c.lineTo(gx, gy + 12); c.lineTo(gx - 9, gy); c.closePath(); c.fillStyle = ['#5fe0ff', '#ff6fae', '#ffd23a', '#7dff8a'][k]; c.fill(); c.strokeStyle = OUT; c.stroke(); }
        c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(s.x + s.w - 40, s.y - 2); c.lineTo(s.x + s.w - 40, s.y - 60); c.stroke();
        c.beginPath(); c.moveTo(s.x + s.w - 40, s.y - 60); c.lineTo(s.x + s.w - 10, s.y - 52); c.lineTo(s.x + s.w - 40, s.y - 44); c.closePath(); c.fillStyle = '#ffd23a'; c.fill(); c.lineWidth = 2; c.stroke();
        starPath(c, s.x + s.w - 30, s.y - 52, 4, 2, 0); c.fillStyle = '#e8262b'; c.fill();
      } else {
        const n = Math.round(s.w / 34);
        for (let k = 0; k < n; k++) {
          const bx = s.x + k * (s.w / n), bw = s.w / n;
          const q = k === Math.floor(n / 2);
          RR(c, bx, s.y, bw, 32, 4, q ? '#ffcf33' : '#c8742f', OUT, 2);
          if (q) txt(c, '!', bx + bw / 2, s.y + 26, 24, '#ffffff', OUT);
          else { c.strokeStyle = 'rgba(60,25,5,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx, s.y + 16); c.lineTo(bx + bw, s.y + 16); c.moveTo(bx + bw / 2, s.y); c.lineTo(bx + bw / 2, s.y + 16); c.stroke(); }
        }
      }
    } else if (id === 'turnpike') {
      if (s.solid) {
        for (let x = s.x + 80; x < s.x + s.w; x += 220) RR(c, x, s.y + s.h - 4, 40, 400, 4, '#6f7385', OUT, 2);
        RR(c, s.x, s.y, s.w, s.h, 6, '#3d3f4c', OUT, 2.5);
        c.fillStyle = '#6a6d7c'; c.fillRect(s.x + 3, s.y + 2, s.w - 6, 6);
        c.fillStyle = '#ffd23a'; for (let x = s.x + 20; x < s.x + s.w - 40; x += 70) c.fillRect(x, s.y + 34, 40, 5);
        c.fillStyle = '#ffffff'; c.fillRect(s.x + 4, s.y + 60, s.w - 8, 3);
        for (const ex of [s.x + 6, s.x + s.w - 12]) RR(c, ex, s.y - 26, 6, 26, 2, '#d9dde6', OUT, 1.5);
      } else {
        c.strokeStyle = '#9aa0b0'; c.lineWidth = 6;
        for (const px of [s.x + 24, s.x + s.w - 24]) { c.beginPath(); c.moveTo(px, s.y + 48); c.lineTo(px, 0); c.stroke(); }
        RR(c, s.x, s.y, s.w, 48, 6, '#1e7d3a', '#ffffff', 3);
        RR(c, s.x, s.y, s.w, 48, 6, null, OUT, 1.5);
        txt(c, s.x < 0 ? '◀ TOAD TOWN' : 'MUSHROOM CITY ▶', cx, s.y + 32, 19, '#ffffff', null);
      }
    } else if (id === 'gorge') {
      if (s.solid) {
        RR(c, s.x, s.y, s.w, 600, 20, '#9a5b34', OUT, 2.5);
        c.strokeStyle = 'rgba(60,25,5,0.35)'; c.lineWidth = 3;
        for (let y = s.y + 40; y < s.y + 600; y += 46) { c.beginPath(); c.moveTo(s.x + 10, y); c.quadraticCurveTo(cx, y + 14, s.x + s.w - 10, y); c.stroke(); }
        RR(c, s.x - 6, s.y - 4, s.w + 12, 18, 9, '#5ac83a', OUT, 2.5);
      } else if (s.bounce) {
        RR(c, cx - 20, s.y + 18, 40, 600, 12, '#f3e0bf', OUT, 2.5);
        c.beginPath(); c.ellipse(cx, s.y + 16, s.w / 2 + 12, 24, 0, 0, Math.PI * 2); c.fillStyle = '#ff7a2a'; c.fill();
        c.save(); c.clip(); for (const k of [-0.6, 0, 0.6]) E(c, cx + k * s.w / 2, s.y + 6, 16, 9, '#ffffff'); c.restore();
        c.beginPath(); c.ellipse(cx, s.y + 16, s.w / 2 + 12, 24, 0, 0, Math.PI * 2); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
      } else {
        RR(c, cx - 12, s.y + 10, 24, 120, 8, '#f3e0bf', OUT, 2);
        c.beginPath(); c.ellipse(cx, s.y + 12, s.w / 2 + 8, 17, 0, 0, Math.PI * 2); c.fillStyle = '#3a8bff'; c.fill();
        c.save(); c.clip(); for (const k of [-0.6, 0, 0.6]) E(c, cx + k * s.w / 2, s.y + 6, 14, 7, '#ffffff'); c.restore();
        c.beginPath(); c.ellipse(cx, s.y + 12, s.w / 2 + 8, 17, 0, 0, Math.PI * 2); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
      }
    }
  }
}

// ---------- Particles (local only; spawned from events) ----------
const PT = [];
function addP(o) { PT.push(Object.assign({ vx: 0, vy: 0, life: 30, size: 6, color: '#fff', type: 'dot', g: 0, drag: 1 }, o, { max: o.life || 30 })); if (PT.length > 600) PT.shift(); }
function updParticles() {
  for (let i = PT.length - 1; i >= 0; i--) {
    const p = PT[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag;
    if (--p.life <= 0) PT.splice(i, 1);
  }
}
function drawParticles(c) {
  for (const p of PT) {
    const k = p.life / p.max;
    c.save(); c.globalAlpha = Math.min(1, k * 1.5);
    switch (p.type) {
      case 'dot': E(c, p.x, p.y, p.size * k, p.size * k, p.color); break;
      case 'puff': E(c, p.x, p.y, p.size * (1.5 - k * 0.5), p.size * (1.5 - k * 0.5), p.color); break;
      case 'spark': c.strokeStyle = p.color; c.lineWidth = p.size * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); c.stroke(); break;
      case 'ring': c.strokeStyle = p.color; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k) + 6, 0, Math.PI * 2); c.stroke(); break;
      case 'star': starPath(c, p.x, p.y, p.size, p.size * 0.45, p.life * 0.2); c.fillStyle = p.color; c.fill(); break;
      case 'heart': c.fillStyle = p.color; c.beginPath(); c.arc(p.x - 4, p.y, 4.5, Math.PI, 0); c.arc(p.x + 4, p.y, 4.5, Math.PI, 0); c.lineTo(p.x, p.y + 9); c.closePath(); c.fill(); break;
      case 'text': txt(c, p.text, p.x, p.y, p.size, p.color, OUT); break;
      case 'ko': {
        c.globalAlpha = k; const n = 14;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2 + p.rot, len = (1 - k) * 420 + 80;
          c.strokeStyle = j % 2 ? '#ffffff' : p.color; c.lineWidth = 18 * k + 4;
          c.beginPath(); c.moveTo(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30); c.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len); c.stroke();
        }
        break;
      }
    }
    c.restore();
  }
}
function burst(x, y, n, col, spd, type, size, life) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
    addP({ type: type || 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: col, size: size || 4, life: life || 18, drag: 0.92 });
  }
}

// ---------- HUD ----------
const PORT = {};
function portrait(ch, size) {
  const key = ch + size;
  if (PORT[key]) return PORT[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'), C = CH[ch];
  const g = c.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size * 0.7);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, C.look.spot && C.look.spot !== '#ffffff' ? C.look.spot : C.look.body || C.look.cap);
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  c.translate(size / 2 - 2, size * 0.9); c.scale(size / 74, size / 74);
  drawFigure(c, ch, { t: 0, st: 'idle', air: false, portrait: true });
  PORT[key] = cv;
  return cv;
}
const hudMem = {};
function drawHUD(c, view, fr) {
  const fs = view.fighters, n = fs.length, pw = 236, gap = 16;
  const x0 = (W - (n * pw + (n - 1) * gap)) / 2;
  fs.forEach((f, k) => {
    const x = x0 + k * (pw + gap), y = H - 90;
    const m = hudMem[f.i] || (hudMem[f.i] = { dm: 0, shake: 0 });
    if (f.dm > m.dm + 0.5) m.shake = 14;
    m.dm = f.dm;
    if (m.shake > 0) m.shake--;
    c.save();
    if (f.out) c.globalAlpha = 0.45;
    RR(c, x, y, pw, 80, 18, 'rgba(24,14,36,0.8)', SLOT_COLORS[f.i], 3);
    c.save(); RR(c, x + 6, y + 5, 70, 70, 12); c.clip(); c.drawImage(portrait(f.ch, 70), x + 6, y + 5); c.restore();
    RR(c, x + 6, y + 5, 70, 70, 12, null, OUT, 2);
    txt(c, (f.tag || '') + '  ' + CH[f.ch].name, x + 84, y + 22, 15, '#ffffff', OUT, 'left', 3);
    const ox = m.shake ? (Math.random() - 0.5) * 6 : 0, oy = m.shake ? (Math.random() - 0.5) * 6 : 0;
    txt(c, f.out ? 'OUT' : Math.floor(f.dm) + '%', x + 84 + ox, y + 68 + oy, 40, f.out ? '#999' : dmgColor(f.dm), OUT, 'left', 5);
    const col = CH[f.ch].look.spot && CH[f.ch].look.spot !== '#ffffff' ? CH[f.ch].look.spot : CH[f.ch].look.body || '#ff8cc6';
    const shown = Math.min(f.sk, 5);
    for (let s = 0; s < shown; s++) { const sx = x + pw - 16 - s * 17, sy = y + 40; E(c, sx, sy + 6, 4, 4, '#fff3dc', OUT, 1.2); cap(c, sx, sy + 3, 8, 6, col, '#ffffff', [[0, -0.9, 0.3]]); }
    if (f.sk > 5) txt(c, 'x' + f.sk, x + pw - 100, y + 50, 16, '#ffffff', OUT, 'right');
    const icons = [];
    if (f.big > 0) icons.push('BIG'); if (f.small > 0) icons.push('MINI'); if (f.star > 0) icons.push('STAR'); if (f.pe > 0) icons.push('PEACHETTE'); if (f.pick > 0) icons.push('PICKAXE'); if (f.hold) icons.push('TURNIP');
    if (icons.length) txt(c, icons.join(' '), x + pw - 12, y + 72, 11, '#ffe866', OUT, 'right', 2);
    c.restore();
  });
}

// ---------- Scene ----------
function renderScene(c, view, cam, fr, bs, noFx) {
  bs = bs || 1;
  c.setTransform(bs, 0, 0, bs, 0, 0);
  drawBG(c, view.stage, cam, fr);
  const sh = cam.shake || 0;
  const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
  c.setTransform(bs * cam.z, 0, 0, bs * cam.z, bs * (W / 2 - cam.x * cam.z + shx), bs * (H / 2 - cam.y * cam.z + shy));
  const surf = computeSurfaces(view.stage, view.frame, view.clouds);
  drawStageFG(c, view.stage, surf, fr);
  for (const cl of view.clouds || []) drawCloud(c, cl, fr);
  drawHaz2D(c, view, fr);
  for (const it of view.items || []) drawItem(c, it, fr);
  if (view.kart) drawKart(c, view.kart, fr);
  for (const p of view.proj || []) drawProj(c, p, fr);
  for (const f of view.fighters || []) if (!(f.hide > 0)) drawFighter(c, f, fr);
  drawFx2D(c, view, fr);
  if (!noFx) drawParticles(c);
  c.setTransform(bs, 0, 0, bs, 0, 0);
  if (view.kart && view.kart.warn > 0 && Math.floor(fr / 8) % 2) {
    const x = view.kart.dir > 0 ? 70 : W - 70, y = H / 2 + 60;
    c.beginPath(); c.moveTo(x, y - 40); c.lineTo(x + 40, y + 30); c.lineTo(x - 40, y + 30); c.closePath(); c.fillStyle = '#ffd23a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
    txt(c, '!', x, y + 22, 48, OUT, null);
    txt(c, 'KART!', x, y + 64, 24, '#ffffff', OUT);
  }
}

function updateCam(cam, view) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, any = false;
  for (const f of view.fighters) {
    if (f.st === 'dead' || f.out) continue;
    any = true;
    x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x); y0 = Math.min(y0, f.y - f.h); y1 = Math.max(y1, f.y);
  }
  if (!any) { x0 = -300; x1 = 300; y0 = -200; y1 = 0; }
  // Smash Mushroom finales pull the camera out to show the whole stage
  if (view.fx && view.fx.length) {
    const s = STG[view.stage].solids[0];
    x0 = Math.min(x0, s.x - 120); x1 = Math.max(x1, s.x + s.w + 120); y0 = Math.min(y0, -380);
    for (const e of view.fx) if (e.k === 'rain' && e.side) { if (e.dir > 0) x0 = Math.min(x0, s.x - 640); else x1 = Math.max(x1, s.x + s.w + 640); }
  }
  x0 = Math.max(Math.min(x0, -250), BLAST.l + 200); x1 = Math.min(Math.max(x1, 250), BLAST.r - 200);
  y0 = Math.max(Math.min(y0, -160), BLAST.t + 150); y1 = Math.min(Math.max(y1, 30), BLAST.b - 100);
  const z = clamp(Math.min(W / (x1 - x0 + 420), H / (y1 - y0 + 380)), 0.48, 1.05);
  const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2 - 10;
  cam.x += (tx - cam.x) * 0.08; cam.y += (ty - cam.y) * 0.08; cam.z += (z - cam.z) * 0.06;
  if (cam.shake > 0) cam.shake *= 0.86;
  if (cam.shake < 0.5) cam.shake = 0;
}

const THUMBS = {};
function stageThumb(id, w, h) {
  if (THUMBS[id]) return THUMBS[id];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  renderScene(cv.getContext('2d'), { stage: id, frame: 0, fighters: [], proj: [], items: [], clouds: [] }, { x: 0, y: -150, z: 0.62, shake: 0 }, 0, w / W, true);
  THUMBS[id] = cv;
  return cv;
}
