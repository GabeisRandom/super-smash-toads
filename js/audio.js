'use strict';
// ===== Synthesized sound effects and music (no audio files needed) =====
const Snd = (() => {
  let ac = null, master, sfx, fx = null, muted = false, noiseBuf = null;
  try { muted = localStorage.getItem('sst-muted') === '1'; } catch (e) { /* storage blocked */ }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    // soft limiter on the output: linear up to 0.75, then rounds off instead of clipping
    const lim = ac.createWaveShaper(), curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) {
      const x = i / 1024 - 1, a = Math.abs(x);
      curve[i] = a <= 0.75 ? x : Math.sign(x) * (0.75 + 0.25 * Math.tanh((a - 0.75) / 0.25));
    }
    lim.curve = curve; lim.connect(ac.destination);
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(lim);
    sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    noiseBuf = kit(ac).nb;
    fx = makeFx(ac, master);
    setInterval(tick, 40);
    if (want) startSong(want);
  }

  function tone(f0, f1, dur, type, vol, delay, dest) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, freq, delay, q) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // Toad's trademark "WAAAH!" — a vibrato sawtooth through a vocal-ish bandpass
  function voice(f0, peak, end, dur, vib, vol) {
    if (!ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = vib || 9; lg.gain.value = f0 * 0.07;
    lfo.connect(lg); lg.connect(o.frequency);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(peak, t + dur * 0.2);
    o.frequency.linearRampToValueAtTime(end, t + dur);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = peak * 1.4; bp.Q.value = 1.1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol || 0.4, t + 0.04);
    g.gain.setValueAtTime(vol || 0.4, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(bp); bp.connect(g); g.connect(sfx);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  const S = {
    jump() { tone(330, 660, 0.11, 'square', 0.09); },
    djump() { tone(440, 990, 0.13, 'square', 0.08); },
    swing() { noise(0.07, 0.12, 2600, 0, 1.5); },
    hit(p) {
      p = p || 6;
      noise(0.07 + p * 0.006, Math.min(0.55, 0.18 + p * 0.014), Math.max(400, 2000 - p * 45));
      tone(220 - Math.min(150, p * 4), 50, 0.1 + p * 0.006, 'triangle', 0.35);
      if (p > 18) tone(880, 110, 0.35, 'sawtooth', 0.12);
    },
    block() { tone(700, 500, 0.12, 'sine', 0.2); },
    break() { tone(900, 100, 0.6, 'square', 0.15); noise(0.4, 0.3, 900); },
    ko() { noise(0.8, 0.55, 500); tone(1000, 70, 0.9, 'sawtooth', 0.18); tone(1500, 300, 0.6, 'square', 0.08, 0.06); },
    scream() { voice(720, 1180, 920, 0.8, 9, 0.38); },
    scold() { voice(260, 340, 200, 0.45, 5, 0.3); },
    brigade() { voice(520, 700, 600, 0.35, 7, 0.22); },
    pluck() { tone(260, 900, 0.09, 'sine', 0.3); },
    pop() { tone(500, 180, 0.09, 'triangle', 0.25); },
    shoot() { tone(600, 300, 0.08, 'square', 0.07); },
    boom() { noise(0.5, 0.6, 300, 0, 0.6); tone(120, 40, 0.5, 'sine', 0.5); },
    coin() { tone(988, 988, 0.07, 'square', 0.09); tone(1319, 1319, 0.25, 'square', 0.09, 0.07); },
    item() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.1, 'square', 0.08, i * 0.06)); },
    grow() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.02, 0.08, 'square', 0.09, i * 0.05)); },
    shrink() { [1047, 784, 659, 523, 392].forEach((f, i) => tone(f, f, 0.08, 'square', 0.09, i * 0.05)); },
    oneup() { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone(f, f, 0.1, 'square', 0.08, i * 0.08)); },
    star() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.08, 'triangle', 0.14, i * 0.05)); },
    bounce() { tone(180, 640, 0.18, 'sine', 0.3); },
    horn() { tone(392, 392, 0.18, 'square', 0.1); tone(330, 330, 0.25, 'square', 0.1, 0.2); },
    count() { tone(660, 660, 0.18, 'square', 0.12); },
    go() { tone(1320, 1320, 0.4, 'square', 0.12); tone(990, 990, 0.4, 'square', 0.08); },
    game() { [784, 659, 523, 392].forEach((f, i) => tone(f, f, 0.18, 'square', 0.1, i * 0.12)); },
    ledge() { tone(1200, 900, 0.05, 'square', 0.06); },
    reflect() { tone(1600, 2400, 0.12, 'sine', 0.15); },
    counter() { tone(1400, 600, 0.2, 'sawtooth', 0.12); noise(0.15, 0.3, 3000); },
    crown() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, f, 0.15, 'triangle', 0.15, i * 0.06)); },
    flutter() { tone(500, 700, 0.06, 'triangle', 0.12); },
    spin() { tone(300, 1200, 0.3, 'triangle', 0.15); },
    dodge() { noise(0.12, 0.12, 4000, 0, 2); },
    select() { tone(880, 1320, 0.06, 'square', 0.07); },
    join() { tone(523, 523, 0.08, 'square', 0.08); tone(784, 784, 0.15, 'square', 0.08, 0.08); },
    // combat extras
    charge() { tone(180, 620, 0.45, 'triangle', 0.12); },
    parry() { tone(1800, 2600, 0.12, 'square', 0.1); tone(2400, 3300, 0.22, 'sine', 0.15, 0.03); noise(0.08, 0.25, 6000, 0, 1.2); },
    grab() { tone(420, 200, 0.12, 'square', 0.1); },
    poof() { noise(0.25, 0.25, 800, 0, 0.6); },
    heal() { tone(880, 1320, 0.15, 'sine', 0.1); },
    magic() { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, f, 0.1, 'sine', 0.08, i * 0.04)); },
    steam() { noise(0.5, 0.3, 3000, 0, 0.5); },
    cannon() { noise(0.4, 0.6, 250, 0, 0.5); tone(90, 40, 0.4, 'sine', 0.5); },
    laser() { tone(1800, 300, 0.18, 'sawtooth', 0.09); },
    guitar() { [110, 165, 220].forEach(f => tone(f, f * 0.98, 0.55, 'sawtooth', 0.07)); },
    cork() { tone(900, 400, 0.06, 'square', 0.12); noise(0.05, 0.3, 3000); },
    rocket() { noise(0.6, 0.35, 600, 0, 0.7); tone(200, 900, 0.5, 'sawtooth', 0.06); },
    zap() { tone(1200, 200, 0.15, 'square', 0.1); noise(0.12, 0.2, 5000); },
    amp() { tone(70, 50, 0.45, 'sawtooth', 0.25); noise(0.3, 0.3, 400); },
    // taunts
    booty() { [0, 0.16, 0.32].forEach(d => tone(120, 80, 0.13, 'sawtooth', 0.16, d)); },
    laugh() { [0, 0.13, 0.26, 0.39].forEach((d, i) => tone(660 - i * 30, 520 - i * 30, 0.09, 'square', 0.08, d)); },
    yawn() { voice(300, 430, 170, 1.0, 4, 0.25); },
    flip() { noise(0.22, 0.15, 2200, 0, 1); [523, 784].forEach((f, i) => tone(f, f, 0.13, 'triangle', 0.15, 0.26 + i * 0.1)); },
    // the Smash Mushroom
    sbspawn() { [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.1, i * 0.07)); },
    sbhit() { tone(1500, 900, 0.12, 'square', 0.12); },
    fsready() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.14, 'square', 0.1, i * 0.08)); tone(1568, 2093, 0.5, 'sine', 0.1, 0.4); },
    fs() { tone(220, 880, 0.6, 'sawtooth', 0.12); noise(0.6, 0.3, 1500); tone(110, 110, 0.8, 'square', 0.1); },
    stampede() { noise(1.4, 0.45, 300, 0, 0.6); [0, 0.2, 0.4, 0.6, 0.8].forEach(d => tone(140, 70, 0.15, 'triangle', 0.25, d)); },
    frost() { tone(2000, 3000, 0.3, 'sine', 0.1); noise(0.4, 0.2, 6000); },
    // stage hazards
    spike() { tone(600, 1200, 0.08, 'square', 0.12); noise(0.1, 0.3, 4000); },
    boostpad() { tone(400, 1600, 0.25, 'square', 0.1); },
    wiggle() { [392, 440, 392, 349].forEach((f, i) => tone(f, f, 0.1, 'triangle', 0.12, i * 0.12)); },
    angry() { tone(300, 150, 0.5, 'sawtooth', 0.15); voice(200, 280, 160, 0.5, 6, 0.25); },
    wind() { noise(1.2, 0.25, 600, 0, 0.3); },
    boo() { voice(520, 300, 200, 0.6, 3, 0.3); },
  };

  // ---------- Music: original tunes, sequenced live with Web Audio ----------
  // Songs are written in C and transposed by `tr`. A bar holds 8 or 16 steps: a note (E5), '-' holds, '.' rests.
  // `sec` names each bar's section (lowercase = that section with a drum fill). Bass steps are chord-relative
  // (R 3 5 7 8, L = fifth below, A = approach the next chord); comp steps play the chord (x) or one chord tone (1-4);
  // drum lanes are 16 steps (x hit, X accent, g ghost). `dbl` doubles the lead; `odd` parts join on every other loop.
  const SONGS = {
    // Menus: the main theme
    title: {
      bpm: 140, tr: -2, loop: 4, crash: true,
      sec: 'IIIiAAAAAAAaBBBBBBBbCCCCCCCc',
      ch: ['C', 'Ab', 'Bb', 'C',
        'C', 'Am', 'F', 'G', 'C', 'Am', 'Dm7 G7', 'C',
        'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C/E F', 'G7',
        'Am', 'Em', 'F', 'C', 'Dm7', 'Em7', 'F', 'G7'],
      li: { I: 'brass', A: 'sq', B: 'brass', C: 'flute' },
      lead: `G4 C5 E5 G5 - . E5 G5 | Ab5 - - - Eb5 - C5 Eb5 | Bb5 - - - F5 - D5 F5 | C6 - - - - - . . |
        E5 F5 G5 - C6 - G5 . | A5 G5 E5 - C5 - D5 E5 | F5 E5 F5 A5 - . G5 F5 | E5 - D5 - . B4 C5 D5 |
        E5 F5 G5 - C6 - G5 . | A5 G5 A5 C6 - . B5 A5 | F5 - A5 - G5 - F5 D5 | C5 - - - . . . . |
        A5 - - - C6 - A5 - | B5 - - - D6 - B5 - | G5 - - E5 G5 - B5 - | A5 - - - . . C6 B5 |
        A5 - F5 - D5 - F5 A5 | G5 - D5 - B4 - D5 G5 | G5 - E5 - A5 - F5 - | G5 - - - A5 - B5 - |
        C6 - - - B5 - A5 - | G5 - - - - - E5 - | A5 - - - G5 - F5 - | E5 - - - - - . . |
        D5 - F5 - A5 - C6 - | B5 - - - G5 - E5 - | F5 - A5 - C6 - - - | B5 - - - G5 - F5 D5`,
      ai: 'brass', av: 0.6,
      alt: 'E4 G4 C5 E5 - . C5 E5 | C5 - - - C5 - Ab4 C5 | D5 - - - D5 - Bb4 D5 | E5 - - - - - . .',
      dbl: { i: 'bell', oct: 12, v: 0.3, sec: 'A' },
      bass: { i: 'sbass', p: { I: 'R - - - - - - -', A: 'R . 5 R 8 . 5 A', B: 'R - - 5 8 - 5 -', C: 'R - - - 5 - - -' } },
      comp: [
        { i: { I: 'pad', A: 'organ', B: 'pad', C: 'pad' }, p: { I: 'x - - - - - - -', A: '. x . x . x . x', B: 'x - - - x - - -', C: 'x - - - - - - -' } },
        { i: 'marimba', lo: 60, v: 0.6, p: { B: '1 2 3 2 1 2 3 2', C: '1 . 2 . 3 . 2 .' } },
      ],
      dr: {
        I: { k: 'X.......X.......', s: '............g.xx' },
        i: { k: 'X.......X.......', s: 'g.g.g.g.x.x.xxXX' },
        A: { k: 'X.....x.X.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x...', o: '..............x.' },
        a: { k: 'X.....x.X.......', s: '....X.......XxXX', h: 'x.x.x.x.x.x.....' },
        B: { k: 'X.......X.....x.', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
        b: { k: 'X.......X.......', s: '....X...........', t: '........X.x.x.xx' },
        C: { k: 'X...............', s: '........x.......', z: 'g.x.g.x.g.x.g.x.' },
        c: { k: 'X.......X.......', s: '........x...xxXX', z: 'g.x.g.x.........' },
      },
    },
    // Toad Town: a swinging stroll with calliope organ
    town: {
      bpm: 138, sw: 0.2, tr: -5, crash: true,
      sec: 'AAAAAAAaBBBBBBBb',
      ch: ['C', 'G', 'F', 'G', 'C', 'Am', 'Dm7 G7', 'C', 'F', 'Fm', 'C', 'A7', 'Dm', 'G7', 'E7 Am', 'D7 G7'],
      li: 'sq',
      lead: `E5 E5 . G5 . E5 C5 . | D5 . E5 . D5 - . . | F5 F5 . A5 . F5 D5 . | E5 . D5 . B4 - . . |
        E5 E5 . G5 . E5 C5 . | C6 . B5 . A5 - G5 . | F5 . A5 . G5 . F5 . | E5 . C5 - . E5 F5 G5 |
        A5 - - - G5 - F5 - | Ab5 - - - G5 - F5 - | G5 - - - E5 - C5 - | C#5 - E5 - A5 - G5 - |
        F5 - - - E5 - D5 - | B4 - D5 - F5 - G5 - | G#5 - - - A5 - - - | F#5 - A5 - G5 - F5 -`,
      dbl: { i: 'bell', oct: 12, v: 0.3, odd: true },
      bass: { i: 'tbass', p: { A: 'R . . . L . . .', B: 'R . 5 . 8 . 5 .' } },
      comp: [{ i: 'organ', p: { A: '. . x . . . x .', B: '. x . x . x . x' } }],
      dr: {
        A: { k: 'X.......X.......', s: '....x.......x...', h: 'x.g.x.g.x.g.x.g.' },
        a: { k: 'X.......X...X...', s: '....x...x.x.xxXX', h: 'x.g.x.g.........' },
        B: { k: 'X.......X.......', s: '....x.......x...', h: 'x.g.x.g.x.g.x.g.', w: '..x.......x.....' },
        b: { k: 'X.......X.......', s: '....x.......x...', t: '........x.x.X.X.' },
      },
    },
    // Captain Toad Diorama: a tiptoeing treasure hunt in pizzicato and music box
    diorama: {
      bpm: 122, tr: -5, vol: 1.5,
      sec: 'AAAAAAAaBBBBBBBb',
      ch: ['Am', 'Am', 'Dm', 'E7', 'Am', 'F', 'Dm E7', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'E7', 'F E7', 'Am'],
      li: { A: 'pizz', B: 'bell' },
      lead: `A4 . C5 E5 . D5 C5 . | B4 . G#4 . A4 - . . | D5 . F5 A5 . G5 F5 . | E5 . G#5 . B5 . D6 . |
        C6 . B5 A5 . E5 C5 . | F5 . E5 F5 . A5 C6 . | D6 . C6 . B5 . G#5 . | A5 . E5 . A4 . . . |
        C5 . F5 . A5 . C6 . | B5 . A5 . G5 . D5 . | E5 . G5 . C6 - B5 C6 | A5 - . . E5 . C5 . |
        D5 . F5 . A5 . F5 . | E5 . G#5 . B5 . G#5 . | A5 . F5 . E5 . D5 . | C5 . B4 . A4 . . .`,
      dbl: { i: 'bell', oct: 12, v: 0.25, odd: true, sec: 'A' },
      bass: { i: 'ubass', p: { A: 'R . . . 5 . . .', B: 'R . 5 . R . 5 .' } },
      comp: [{ i: 'pizz', lo: 52, v: 0.5, p: '. x . x . x . x' }],
      dr: {
        A: { k: 'x.......x.......', w: '....x.......x...', z: 'g.g.g.g.g.g.g.g.' },
        a: { k: 'x.......x.......', w: '....x...x.x.x.x.', t: '............x.x.' },
        B: { k: 'x.....x.x.......', w: '....x.......x...', z: 'g.g.g.g.g.g.g.g.', n: '..x.......x.....' },
        b: { k: 'x.....x.x.......', w: '....x.......x...', t: '........x.x.x.x.' },
      },
    },
    // Toad's Turnpike: driving rock for the kart road
    turnpike: {
      bpm: 156, tr: -3, loop: 4, crash: true,
      sec: 'IIIiAAAAAAAaBBBBBBBb',
      ch: ['C', 'Bb', 'F', 'G',
        'C', 'Bb', 'F', 'C', 'C', 'Bb', 'F', 'G',
        'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm7', 'G'],
      li: 'saw',
      lead: `. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . . |
        C5 . E5 G5 . C6 . G5 | Bb5 - A5 F5 - D5 F5 . | A5 . A5 G5 . F5 . A5 | G5 - - - . . . . |
        C5 . E5 G5 . C6 . G5 | Bb5 - A5 F5 - D5 F5 . | A5 . C6 . A5 . F5 . | G5 - - - B4 - D5 - |
        E5 - - - A5 - - - | A5 - G5 - F5 - - - | G5 - - - E5 - - - | D5 - - - - - . . |
        E5 - - - A5 - - - | C6 - B5 - A5 - - - | F5 - A5 - C6 - A5 - | B5 - G5 - D5 - B4 -`,
      dbl: { i: 'sq', oct: -12, v: 0.5, odd: true },
      bass: { i: 'sbass', p: { I: 'R R 8 R R R 8 R', A: 'R R 8 R R R 8 R', B: 'R R R R R R R A' } },
      comp: [{ i: 'power', pw: true, lo: 50, p: { I: 'x . . x . . x .', A: 'x . . x . . x .', B: 'x - - - x - - -' } }],
      dr: {
        I: { k: 'X.......X.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
        i: { k: 'X.......X.......', s: '....X...X.X.XXXX', h: 'x.x.x.x.........' },
        A: { k: 'X.....X.X.......', s: '....X.......X...', h: 'xgxgxgxgxgxgxgxg' },
        a: { k: 'X.....X.X.......', s: '....X.....X.XXXX', h: 'xgxgxgxgxg......' },
        B: { k: 'X...X...X...X...', s: '....X.......X...', o: '..x...x...x...x.' },
        b: { k: 'X...X...X...X...', s: '....X.......xxXX', t: '........X.X.....', o: '..x...x.........' },
      },
    },
    // Mushroom Gorge: breezy calypso with steel drum and marimba
    gorge: {
      bpm: 132, sw: 0.12, tr: -3,
      sec: 'AAAAAAAaBBBBBBBb',
      ch: ['C', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'G7'],
      li: 'steel',
      lead: `G5 . G5 E5 - . C5 . | A5 . A5 F5 - . D5 . | B5 . B5 G5 - . D5 . | E5 . D5 . C5 - - . |
        C6 . C6 A5 - . G5 . | D6 . D6 A5 - . F5 . | G5 . F5 . E5 . D5 . | C5 - - - . . . . |
        A5 - - G5 A5 - C6 - | B5 - - A5 B5 - D6 - | B5 - - A5 G5 - E5 - | C6 - - B5 A5 - - - |
        F5 - - E5 F5 - A5 - | G5 - - F5 G5 - B5 - | C6 - - - G5 - E5 - | D5 - B4 - G4 - B4 D5`,
      dbl: { i: 'flute', oct: 0, v: 0.45, odd: true, sec: 'B' },
      bass: { i: 'tbass', p: 'R . . 5 R . 5 .' },
      comp: [{ i: 'marimba', v: 0.6, p: { A: '1 3 2 3 1 3 2 3', B: '1 2 3 2 1 2 3 2' } }],
      dr: {
        A: { k: 'X.....x.X.....x.', z: 'g.x.g.x.g.x.g.x.', w: 'x..x...x..x.x...', n: '......x.......x.' },
        B: { k: 'X.....x.X.....x.', z: 'g.x.g.x.g.x.g.x.', w: 'x..x...x..x.x...', b: 'g...g...g...g...' },
        f: { k: 'X.....x.X.......', z: 'g.x.g.x.........', n: '........x.x.x.xx', w: 'x..x...x........' },
      },
    },
    // Results: victory fanfare, then a happy loop
    results: {
      bpm: 120, sw: 0.1, loop: 4, crash: true, vol: 0.85,
      sec: 'IIIiAAAAAAAa',
      ch: ['C', 'F', 'G', 'C', 'C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm7 G7', 'C'],
      li: { I: 'brass', A: 'flute' },
      lead: `C5 . C5 C5 C5 . E5 . | F5 . F5 F5 F5 . A5 . | G5 . G5 G5 B5 . D6 . | C6 - - - - - . . |
        E5 - - D5 E5 - G5 - | A5 - - G5 E5 - C5 - | F5 - - E5 F5 - A5 - | G5 - - - - - . . |
        G5 - - F#5 G5 - B5 - | C6 - - B5 A5 - E5 - | F5 - A5 - G5 - F5 - | E5 - - - . . . .`,
      ai: 'brass', av: 0.6,
      alt: 'E4 . E4 E4 E4 . G4 . | A4 . A4 A4 A4 . C5 . | B4 . B4 B4 D5 . G5 . | E5 - - - - - . .',
      dbl: { i: 'bell', oct: 12, v: 0.3, odd: true, sec: 'A' },
      bass: { i: 'tbass', p: { I: 'R . R R R . R .', A: 'R - - 5 8 - 5 -' } },
      comp: [
        { i: 'pad', p: 'x - - - - - - -' },
        { i: 'marimba', lo: 60, v: 0.5, p: { A: '1 2 3 2 1 2 3 2' } },
      ],
      dr: {
        I: { k: 'X.......X.......', s: '....x.......x.xx' },
        i: { k: 'X...............', s: 'ggggxxxxxxxxXXXX' },
        A: { k: 'X.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
        a: { k: 'X.......x.......', s: '....x.......x.gx', h: 'x.x.x.x.x.x.x...' },
      },
    },
  };

  // ---- song compiler: turns the notation into per-step events ----
  const NT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9] };
  const VEL = { x: 0.8, X: 1, g: 0.38 };
  const acc = a => (a === '#' ? 1 : a === 'b' ? -1 : 0);
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const BUILT = {};
  function build(id) {
    if (BUILT[id]) return BUILT[id];
    const S = SONGS[id], nb = S.ch.length, N = nb * 16, tr = S.tr || 0, loop = (S.loop || 0) * 16;
    const fail = m => { throw new Error(`music ${id}: ${m}`); };
    if (S.sec.length !== nb) fail('sections and chords differ in length');
    const up = b => S.sec[b].toUpperCase();
    const pick = (o, b) => (o == null || typeof o === 'string' ? o : o[up(b)]);
    const midiOf = s => {
      const m = /^([A-G])([#b]?)(\d)$/.exec(s);
      if (!m) fail('bad note ' + s);
      return 12 * (+m[3] + 1) + NT[m[1]] + acc(m[2]);
    };
    const chordOf = s => {
      const m = /^([A-G])([#b]?)(maj7|m7|m6|m|7|6)?(?:\/([A-G])([#b]?))?$/.exec(s);
      if (!m) fail('bad chord ' + s);
      const r = (NT[m[1]] + acc(m[2]) + 12) % 12;
      return { r, iv: QUAL[m[3] || ''], b: m[4] ? (NT[m[4]] + acc(m[5]) + 12) % 12 : r };
    };
    const steps = (pat, b) => {
      const t = pat.trim().split(/\s+/);
      if (t.length !== 8 && t.length !== 16) fail(`bar ${b + 1} has ${t.length} steps`);
      return t;
    };
    const chordAt = [];
    S.ch.forEach(s => {
      const cs = s.split(' ').map(chordOf);
      for (let k = 0; k < 16; k++) chordAt.push(cs[Math.floor(k * cs.length / 16)]);
    });
    const next = st => (st >= N ? loop : st);
    const ev = Array.from({ length: N }, () => []), used = new Set();
    const put = (st, e) => { ev[st].push(e); used.add(e.I); return e; };

    // melodic lines; a hold may carry a note across the bar line
    function line(src, inst, v, shift, odd) {
      const bars = src.split('|');
      if (bars.length > nb || (src === S.lead && bars.length !== nb)) fail('line length');
      let last = null;
      bars.forEach((bs, b) => {
        const tk = steps(bs, b), k = 16 / tk.length, I = pick(inst, b);
        tk.forEach((tok, i) => {
          if (tok === '-') { if (last) last.len += k; return; }
          last = null;
          if (tok !== '.' && I) last = put(b * 16 + i * k, { I, f: hz(midiOf(tok) + tr + shift), len: k, v, odd });
        });
      });
    }
    line(S.lead, S.li, 1, 0);
    if (S.alt) line(S.alt, S.ai, S.av || 0.7, 0);
    if (S.dbl) {
      const D = S.dbl, inst = {};
      for (const c of D.sec || S.sec.toUpperCase()) inst[c] = D.i;
      line(S.lead, inst, D.v, D.oct || 0, D.odd);
    }

    // bass follows the chords, kept in E2..D#3 so it carries on small speakers
    const bassM = p => 40 + ((p + tr - 4) % 12 + 12) % 12;
    for (let b = 0; b < nb; b++) {
      const pat = pick(S.bass.p, b), I = pick(S.bass.i, b);
      if (!pat || !I) continue;
      const tk = steps(pat, b), k = 16 / tk.length;
      let last = null;
      tk.forEach((tok, i) => {
        const st = b * 16 + i * k, c = chordAt[st], rm = bassM(c.r), nx = chordAt[next(st + k)];
        if (tok === '-') { if (last) last.len += k; return; }
        last = null;
        if (tok === '.') return;
        const m = { R: bassM(c.b), 3: rm + c.iv[1], 5: rm + c.iv[2], 7: rm + (c.iv[3] || 12), 8: rm + 12, L: rm + c.iv[2] - 12,
          A: nx === c ? rm + c.iv[2] : bassM(nx.r) - 1 }[tok];
        if (m === undefined) fail('bass step ' + tok);
        last = put(st, { I, f: hz(m), len: k, v: 1 });
      });
    }

    // chord parts: close voicings from `lo` up (power chords for rock)
    const voicing = (c, lo, pw) => {
      if (pw) { const r = lo + ((c.r + tr - lo) % 12 + 12) % 12; return [r, r + 7, r + 12]; }
      return c.iv.map(i => lo + ((c.r + tr + i - lo) % 12 + 12) % 12).sort((a, z) => a - z);
    };
    for (const T of S.comp || []) {
      for (let b = 0; b < nb; b++) {
        const pat = pick(T.p, b), I = pick(T.i, b);
        if (!pat || !I) continue;
        const tk = steps(pat, b), k = 16 / tk.length;
        let last = null;
        tk.forEach((tok, i) => {
          const st = b * 16 + i * k;
          if (tok === '-') { if (last) for (const e of last) e.len += k; return; }
          last = null;
          if (tok === '.') return;
          const vo = voicing(chordAt[st], T.lo || 55, T.pw), n = +tok - 1;
          const ms = tok === 'x' ? vo : [vo[n % vo.length] + 12 * Math.floor(n / vo.length)];
          last = ms.map(m => put(st, { I, f: hz(m), len: k, v: T.v || 1 }));
        });
      }
    }

    // drums; a crash marks each new section
    for (let b = 0; b < nb; b++) {
      const s = S.sec[b], U = up(b), D = S.dr[s] || (s !== U && S.dr.f) || S.dr[U];
      if (D) for (const lane in D) {
        if (D[lane].length !== 16) fail(`drum lane ${lane} in bar ${b + 1}`);
        for (let k = 0; k < 16; k++) if (VEL[D[lane][k]]) put(b * 16 + k, { I: lane, f: 0, len: 1, v: VEL[D[lane][k]] });
      }
      if (S.crash && (b === 0 || U !== up(b - 1))) put(b * 16, { I: 'y', f: 0, len: 1, v: 0.7 });
    }
    return (BUILT[id] = { N, loop, d16: 60 / S.bpm / 4, sw: S.sw || 0, ev, used: [...used] });
  }

  // ---- synth voices ----
  function kit(cx) {
    if (cx.sstKit) return cx.sstKit;
    const nb = cx.createBuffer(1, cx.sampleRate, cx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const re = new Float32Array(40), im = new Float32Array(40);
    for (let n = 1; n < 40; n++) { re[n] = Math.sin(Math.PI * n / 2) / (Math.PI * n); im[n] = (1 - Math.cos(Math.PI * n / 2)) / (Math.PI * n); }
    const org = Float32Array.from([0, 1, 0.55, 0.3, 0.22, 0, 0.12, 0, 0.07]);
    cx.sstKit = { cx, nb, p25: cx.createPeriodicWave(re, im), org: cx.createPeriodicWave(new Float32Array(org.length), org) };
    return cx.sstKit;
  }
  function osc(X, type, f, t, end, to, det) {
    const o = X.cx.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f, t);
    if (det) o.detune.setValueAtTime(det, t);
    o.connect(to); o.start(t); o.stop(end);
    return o;
  }
  function filt(X, to, type, f, q) { const n = X.cx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.connect(to); return n; }
  function amp(X, to, v) { const g = X.cx.createGain(); g.gain.value = v; g.connect(to); return g; }
  // held note: attack, decay toward the sustain level, release after the note; returns [gain, stop time]
  function adsr(X, to, t, len, pk, a, d, s, r) {
    const g = X.cx.createGain(), p = g.gain, off = t + Math.max(len, a + 0.02);
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + a);
    p.setTargetAtTime(pk * s, t + a, d); p.setTargetAtTime(0, off, r);
    g.connect(to);
    return [g, off + r * 6];
  }
  // struck note: quick attack, exponential decay
  function hit(X, to, t, pk, a, dec) {
    const g = X.cx.createGain(), p = g.gain;
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(pk, t + a); p.exponentialRampToValueAtTime(0.0001, t + a + dec);
    g.connect(to);
    return g;
  }
  function vib(X, os, t, end, rate, cents, delay) {
    const l = X.cx.createOscillator(), g = X.cx.createGain();
    l.frequency.value = rate; g.gain.value = 0;
    g.gain.setValueAtTime(0, t + delay); g.gain.linearRampToValueAtTime(cents, t + delay + 0.25);
    l.connect(g); for (const o of os) g.connect(o.detune);
    l.start(t); l.stop(end);
  }
  function nhit(X, to, t, dec, type, f, q, pk, a) {
    const s = X.cx.createBufferSource(); s.buffer = X.nb;
    s.connect(filt(X, hit(X, to, t, pk, a || 0.001, dec), type, f, q));
    s.start(t, Math.random() * 0.5); s.stop(t + (a || 0.001) + dec + 0.02);
  }
  function drop(X, to, t, f0, f1, fall, pk, dec, type) {
    const o = X.cx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + fall);
    o.connect(hit(X, to, t, pk, 0.002, dec)); o.start(t); o.stop(t + dec + 0.03);
  }
  function sweep(n, t, f0, f1, fall) { n.frequency.setValueAtTime(f0, t); n.frequency.setTargetAtTime(f1, t + 0.004, fall); }

  // channel level, stereo pan, reverb and echo sends per instrument; fn(kit, time, freq, length, velocity, out)
  const INST = {
    sq: { lvl: 1.4, rv: 0.22, ec: 0.16, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.9, 0.3 * v, 0.006, 0.09, 0.6, 0.03);
      const x = osc(X, X.p25, f, t, end, filt(X, g, 'lowpass', Math.min(9000, f * 9), 0.7));
      if (L > 0.24) vib(X, [x], t, end, 5.6, 14, 0.16);
    } },
    brass: { lvl: 1, rv: 0.25, ec: 0.1, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.95, 0.3 * v, 0.022, 0.15, 0.72, 0.05);
      const lp = filt(X, g, 'lowpass', f, 1.4), c = Math.min(8000, f * 7);
      lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.linearRampToValueAtTime(c, t + 0.05); lp.frequency.setTargetAtTime(c * 0.55, t + 0.05, 0.2);
      const xs = [osc(X, 'sawtooth', f, t, end, lp, -6), osc(X, 'sawtooth', f, t, end, lp, 6)];
      if (L > 0.3) vib(X, xs, t, end, 5.2, 12, 0.2);
    } },
    flute: { lvl: 1.1, rv: 0.32, ec: 0.15, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.95, 0.34 * v, 0.03, 0.12, 0.85, 0.05);
      const x = osc(X, 'triangle', f, t, end, g);
      osc(X, 'sine', f * 2, t, end, amp(X, g, 0.12));
      if (L > 0.24) vib(X, [x], t, end, 5, 16, 0.14);
    } },
    saw: { lvl: 1.8, rv: 0.2, ec: 0.18, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.92, 0.16 * v, 0.006, 0.12, 0.7, 0.04);
      const lp = filt(X, g, 'lowpass', f, 1.8), c = Math.min(9000, f * 6);
      lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(c, t + 0.03); lp.frequency.setTargetAtTime(c * 0.6, t + 0.03, 0.15);
      const xs = [-12, 0, 12].map(d => osc(X, 'sawtooth', f, t, end, lp, d));
      if (L > 0.3) vib(X, xs, t, end, 6, 10, 0.2);
    } },
    bell: { lvl: 1.6, rv: 0.35, ec: 0.2, fn(X, t, f, L, v, o) {
      const d = Math.min(1.6, 0.5 + L);
      osc(X, 'sine', f, t, t + d + 0.05, hit(X, o, t, 0.3 * v, 0.002, d));
      osc(X, 'sine', f * 4, t, t + 0.3, hit(X, o, t, 0.06 * v, 0.002, 0.25));
    } },
    marimba: { lvl: 1, rv: 0.2, fn(X, t, f, L, v, o) {
      osc(X, 'sine', f, t, t + 0.6, hit(X, o, t, 0.36 * v, 0.003, 0.5));
      osc(X, 'sine', f * 4, t, t + 0.1, hit(X, o, t, 0.1 * v, 0.001, 0.07));
    } },
    steel: { lvl: 1.8, rv: 0.25, ec: 0.12, fn(X, t, f, L, v, o) {
      const d = Math.min(1.2, 0.35 + L * 1.2);
      osc(X, 'sine', f, t, t + d + 0.05, hit(X, o, t, 0.26 * v, 0.005, d));
      osc(X, 'sine', f * 2, t, t + d, hit(X, o, t, 0.14 * v, 0.03, d * 0.6), 4);
      osc(X, 'sine', f * 3, t, t + 0.3, hit(X, o, t, 0.05 * v, 0.004, 0.25));
    } },
    pizz: { lvl: 2.2, rv: 0.3, fn(X, t, f, L, v, o) {
      const lp = filt(X, hit(X, o, t, 0.3 * v, 0.003, 0.32), 'lowpass', f, 1);
      sweep(lp, t, Math.min(7000, f * 9), Math.max(220, f * 1.5), 0.05);
      osc(X, 'sawtooth', f, t, t + 0.36, lp);
    } },
    organ: { lvl: 1, rv: 0.2, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.85, 0.15 * v, 0.004, 0.06, 0.8, 0.025);
      osc(X, X.org, f, t, end, g);
    } },
    pad: { lvl: 0.63, rv: 0.45, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L, 0.08 * v, 0.2, 0.4, 0.8, 0.3);
      const lp = filt(X, g, 'lowpass', 1500, 0.4);
      osc(X, 'sawtooth', f, t, end, lp, -9); osc(X, 'sawtooth', f, t, end, lp, 9);
    } },
    power: { lvl: 0.63, rv: 0.12, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.9, 0.12 * v, 0.004, 0.12, 0.55, 0.03);
      const lp = filt(X, g, 'lowpass', 1800, 1);
      osc(X, 'sawtooth', f, t, end, lp, -5); osc(X, 'square', f, t, end, lp, 5);
    } },
    tbass: { lvl: 1, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.9, 0.45 * v, 0.004, 0.12, 0.75, 0.03);
      osc(X, 'triangle', f, t, end, g);
      osc(X, 'sine', f * 2, t, end, amp(X, g, 0.3));
    } },
    sbass: { lvl: 0.8, fn(X, t, f, L, v, o) {
      const [g, end] = adsr(X, o, t, L * 0.85, 0.32 * v, 0.003, 0.15, 0.6, 0.03);
      const lp = filt(X, g, 'lowpass', f, 4);
      sweep(lp, t, f * 14, f * 3, 0.06);
      osc(X, 'sawtooth', f, t, end, lp);
      osc(X, 'sine', f, t, end, amp(X, g, 0.5));
    } },
    ubass: { lvl: 2.8, rv: 0.05, fn(X, t, f, L, v, o) {
      const d = Math.min(0.9, L + 0.15), lp = filt(X, hit(X, o, t, 0.5 * v, 0.006, d), 'lowpass', 750, 0.8);
      osc(X, 'triangle', f, t, t + d + 0.02, lp);
      osc(X, 'sine', f * 2, t, t + d + 0.02, amp(X, lp, 0.35));
    } },
    // drum kit (the frequency argument is unused)
    k: { lvl: 1.25, fn(X, t, f, L, v, o) { drop(X, o, t, 150, 46, 0.11, 0.9 * v, 0.3); nhit(X, o, t, 0.012, 'highpass', 2500, 0.7, 0.18 * v); } },
    s: { lvl: 2.6, rv: 0.12, fn(X, t, f, L, v, o) {
      nhit(X, o, t, 0.16, 'bandpass', 1900, 0.6, 0.5 * v); nhit(X, o, t, 0.08, 'highpass', 5000, 0.7, 0.22 * v);
      drop(X, o, t, 200, 150, 0.08, 0.32 * v, 0.1, 'triangle');
    } },
    h: { lvl: 2.5, pan: 0.18, rv: 0.04, fn(X, t, f, L, v, o) { nhit(X, o, t, 0.035, 'highpass', 7500, 0.8, 0.3 * v); } },
    o: { lvl: 2.6, pan: 0.18, rv: 0.06, fn(X, t, f, L, v, o) { nhit(X, o, t, 0.22, 'highpass', 7000, 0.8, 0.25 * v); } },
    z: { lvl: 1.6, pan: -0.2, rv: 0.05, fn(X, t, f, L, v, o) { nhit(X, o, t, 0.05, 'highpass', 6000, 0.8, 0.22 * v, 0.012); } },
    w: { lvl: 1.4, pan: -0.15, rv: 0.15, fn(X, t, f, L, v, o) {
      osc(X, 'sine', 1250, t, t + 0.08, hit(X, o, t, 0.45 * v, 0.001, 0.06)); osc(X, 'sine', 1900, t, t + 0.05, hit(X, o, t, 0.12 * v, 0.001, 0.03));
    } },
    t: { lvl: 1.2, rv: 0.15, fn(X, t, f, L, v, o) { drop(X, o, t, 170, 95, 0.2, 0.6 * v, 0.3); } },
    y: { lvl: 1.6, pan: -0.1, rv: 0.2, fn(X, t, f, L, v, o) { nhit(X, o, t, 1.4, 'highpass', 4500, 0.5, 0.28 * v); } },
    n: { lvl: 1.4, pan: 0.2, rv: 0.12, fn(X, t, f, L, v, o) { drop(X, o, t, 340, 285, 0.05, 0.45 * v, 0.18); } },
    b: { lvl: 1, pan: 0.25, rv: 0.1, fn(X, t, f, L, v, o) {
      const bp = filt(X, hit(X, o, t, 0.28 * v, 0.001, 0.16), 'bandpass', 820, 1.5);
      osc(X, 'square', 545, t, t + 0.18, bp); osc(X, 'square', 815, t, t + 0.18, bp);
    } },
  };

  // ---- mixer and sequencer ----
  function makeFx(cx, dest) {
    const bus = cx.createGain(), duckG = cx.createGain(), comp = cx.createDynamicsCompressor();
    bus.gain.value = 0.4;
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    bus.connect(duckG); duckG.connect(comp); comp.connect(dest);
    // small room: a generated, softened noise tail
    const rv = cx.createConvolver(), len = Math.floor(cx.sampleRate * 1.8), ir = cx.createBuffer(2, len, cx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.45; d[i] = lp * Math.pow(1 - i / len, 2.6); }
    }
    rv.buffer = ir; rv.connect(bus);
    // dotted-eighth echo, darkened on every repeat
    const dl = cx.createDelay(1), fb = cx.createGain(), dlf = cx.createBiquadFilter();
    fb.gain.value = 0.32; dlf.type = 'lowpass'; dlf.frequency.value = 2600;
    dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(bus);
    return { bus, duck: duckG, rv, dl };
  }
  function player(cx, F, id, solo) {
    const C = build(id), mix = SONGS[id].mix || {}, vol = SONGS[id].vol || 1;
    const out = cx.createGain(), rs = cx.createGain(), es = cx.createGain();
    out.connect(F.bus); rs.connect(F.rv); es.connect(F.dl);
    const ch = {};
    for (const I of C.used) {
      const d = INST[I], g = cx.createGain();
      g.gain.value = d.lvl * (mix[I] || 1) * vol;
      let n = g;
      if (d.pan && cx.createStereoPanner) { n = cx.createStereoPanner(); n.pan.value = d.pan; g.connect(n); }
      n.connect(out);
      if (d.rv) n.connect(amp({ cx }, rs, d.rv));
      if (d.ec) n.connect(amp({ cx }, es, d.ec));
      ch[I] = g;
    }
    F.dl.delayTime.setValueAtTime(C.d16 * 3, cx.currentTime);
    return { id, C, ch, X: kit(cx), pos: 0, pass: 0, t: cx.currentTime + 0.06, gains: [out, rs, es], solo };
  }
  function run(P, until) {
    const C = P.C;
    while (P.t < until) {
      const j = P.pos & 3, t = P.t + C.sw * C.d16 * 2 * (j === 2 ? 1 : j ? 0.5 : 0);
      for (const e of C.ev[P.pos]) {
        if ((e.odd && !(P.pass & 1)) || (P.solo && !P.solo.includes(e.I))) continue;
        INST[e.I].fn(P.X, t, e.f, e.len * C.d16, e.v, P.ch[e.I]);
      }
      P.t += C.d16;
      if (++P.pos >= C.N) { P.pos = C.loop; P.pass++; }
    }
  }

  let want = null, cur = null;
  function startSong(id) {
    const now = ac.currentTime;
    if (cur) {
      const old = cur;
      for (const g of old.gains) g.gain.setTargetAtTime(0, now, 0.12);
      setTimeout(() => { for (const g of old.gains) g.disconnect(); }, 1500);
      cur = null;
    }
    if (!id || !SONGS[id]) return;
    try { cur = player(ac, fx, id); } catch (e) { cur = null; console.warn(e); }
  }
  function tick() { if (cur) run(cur, ac.currentTime + 0.22); }
  // switch to a song (null = silence); before the first click it waits for the browser to allow audio
  function music(id) {
    want = id || null;
    if (ac && (cur ? cur.id : null) !== want) startSong(want);
  }
  function duck(on) { if (fx) fx.duck.gain.setTargetAtTime(on ? 0.35 : 1, ac.currentTime, 0.08); }

  // renders a song offline and measures it, for balancing the mix during development
  async function render(id, secs, solo) {
    const cx = new OfflineAudioContext(2, Math.ceil(44100 * secs), 44100);
    const P = player(cx, makeFx(cx, cx.destination), id, solo);
    run(P, secs);
    const buf = await cx.startRendering(), d = buf.getChannelData(0);
    let pk = 0, sq = 0;
    for (let i = 0; i < d.length; i++) { pk = Math.max(pk, Math.abs(d[i])); sq += d[i] * d[i]; }
    return { peak: pk, rms: Math.sqrt(sq / d.length) };
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('sst-muted', muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }
  return {
    init, music, duck, tick, toggleMute,
    isMuted: () => muted,
    play(name, a) { if (!ac || muted) return; if (S[name]) S[name](a); },
    dev: { SONGS, build, render, state: () => ({ ctx: ac && ac.state, song: cur && cur.id, pos: cur && cur.pos }) },
  };
})();
