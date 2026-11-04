'use strict';
// ===== Super Smash Toads: shared data =====
const W = 1280, H = 720;
const BLAST = { l: -1150, r: 1150, t: -800, b: 620 };
const GRAV = 0.62, MAXFALL = 11, FASTFALL = 16;
// buttons: move, jump, down/crouch, attack (Q), special (E), guard (F) and the four taunts
const B_L = 1, B_R = 2, B_U = 4, B_D = 8, B_A = 16, B_B = 32, B_S = 64, B_T1 = 128, B_T2 = 256, B_T3 = 512, B_T4 = 1024;
const B_TAUNTS = [B_T1, B_T2, B_T3, B_T4], B_ALL = 2047;
const SLOT_COLORS = ['#ff4b4b', '#3f8cff', '#ffc21f', '#3bd16b'];
const PEER_PREFIX = 'supersmashtoads-';
const TAUNTS = [{ n: 'Booty Shake', dur: 72 }, { n: 'Laugh', dur: 64 }, { n: 'Yawn', dur: 84 }, { n: 'Backflip', dur: 46 }];

function defChar(o) {
  return Object.assign({ weight: 1, run: 6.2, air: 5, jump: 15, djump: 13.5, jumps: 2, pow: 1, reach: 1, h: 62, wide: 1, fall: 1, swoosh: '#ffffff' }, o);
}

// sp: neutral / side / up / down specials; fs: the Smash Mushroom finale (see FSDEF in sim.js)
const CHARS = [
  defChar({ id: 'toad', name: 'Toad', look: { cap: '#ffffff', spot: '#e8262b', vest: '#2557d6', trim: '#f4c430' },
    weight: 0.85, run: 6.9, air: 5.4, sp: { n: 'turnip', s: 'toaddash', u: 'sporespin', d: 'scream' },
    blurb: 'The original Mushroom retainer. Plucks turnips and screams the house down.',
    quote: 'Thank you! But your victory is in THIS castle!' }),
  defChar({ id: 'toadette', name: 'Toadette', look: { cap: '#ff8cc6', spot: '#ffffff', vest: '#ff4f9a', trim: '#ffffff', dress: true, pigtails: true },
    weight: 0.8, run: 6.5, air: 5.6, sp: { n: 'pigspin', s: 'pigwhip', u: 'float', d: 'crown' },
    blurb: 'Pigtail spins, and a Super Crown that turns her into the floaty, powerful Peachette.',
    quote: 'Ta-da! Toadette takes the crown!' }),
  defChar({ id: 'captain', name: 'Captain Toad', look: { cap: '#ffffff', spot: '#e8262b', vest: '#2557d6', trim: '#f4c430', lamp: true, pack: true },
    weight: 1.15, run: 5.4, air: 4.4, jump: 11, djump: 0, jumps: 1, pow: 1.1, sp: { n: 'turnips', s: 'headlamp', u: 'boost', d: 'pickaxe' },
    blurb: "Can't jump much, but his backpack is full of turnips and his pickaxe hits like a truck.",
    quote: 'Treasure... secured! Onward!' }),
  defChar({ id: 'toadsworth', name: 'Toadsworth', look: { cap: '#ffffff', spot: '#8a5326', vest: '#7b3fb0', trim: '#f4c430', old: true },
    weight: 1.25, run: 5.2, air: 4.6, jump: 13.5, djump: 12, reach: 1.25, pow: 1.1, wide: 1.1, sp: { n: 'scold', s: 'canehook', u: 'parasol', d: 'brigade' },
    blurb: 'Elderly steward with a long cane, a stern scolding, and the Toad Brigade on call.',
    quote: 'Oh my! Back in my day, we won with dignity!' }),
  defChar({ id: 'blue', name: 'Blue Toad', look: { cap: '#ffffff', spot: '#2f7cf6', vest: '#f2c12e', trim: '#ffffff' },
    weight: 0.95, run: 6.2, sp: { n: 'iceball', s: 'iceslide', u: 'propeller', d: 'pound' },
    blurb: 'Cool-headed adventurer. Freezes foes with Ice Balls and soars on a Propeller Mushroom.',
    quote: 'Chill out. You never stood a chance.' }),
  defChar({ id: 'yellow', name: 'Yellow Toad', look: { cap: '#ffffff', spot: '#ffc81a', vest: '#1f9e8f', trim: '#ffffff' },
    weight: 0.9, run: 6.5, jump: 15.5, sp: { n: 'fireball', s: 'firedash', u: 'superjump', d: 'pound' },
    blurb: 'Hot-headed and hopping mad. Bouncing fireballs and a mighty Super Jump.',
    quote: 'Too hot to handle! Yahoo!' }),
  defChar({ id: 'green', name: 'Green Toad', look: { cap: '#ffffff', spot: '#29b34a', vest: '#8a5a2b', trim: '#f4c430' },
    weight: 0.9, run: 6.4, sp: { n: 'boomerang', s: 'tailwhip', u: 'tanooki', d: 'counter' },
    blurb: 'Patient and tricky. Boomerangs, a Tanooki tail, and a sharp Leaf Counter.',
    quote: 'Patience is the greenest virtue.' }),
  defChar({ id: 'purple', name: 'Purple Toad', look: { cap: '#ffffff', spot: '#9b4fd6', vest: '#ff6fae', trim: '#ffffff' },
    weight: 0.85, run: 6.7, sp: { n: 'poison', s: 'haze', u: 'cloud', d: 'pounce' },
    blurb: 'Mischief-maker. Tosses Poison Mushrooms, makes cloud platforms, pounces like a cat.',
    quote: 'Purple reigns! Nyaa~' }),
  defChar({ id: 'yoshi', name: 'Yoshi', yoshi: true, look: { body: '#3dbb3d', saddle: '#e8262b', shoe: '#ff8a1f' },
    weight: 1.05, run: 7.0, air: 5.4, jump: 15.5, djump: 16.5, h: 66, sp: { n: 'egg', s: 'eggroll', u: 'flutter', d: 'yoshipound' },
    blurb: "Toad's dino pal. Egg tosses, an Egg Roll, flutter jumps, and a starry Yoshi Bomb.",
    quote: 'Yoshi! (He says Toads are the best.)' }),
  defChar({ id: 'pirate', name: 'Pirate Toad', look: { cap: '#ffffff', spot: '#1f1f2a', vest: '#d8343c', trim: '#f6f1e6', hat: 'tricorn', eyepatch: true, stripes: true, prop: 'cutlass' },
    weight: 1.0, run: 6.4, pow: 1.05, swoosh: '#eef4ff', sp: { n: 'cannon', s: 'cutlass', u: 'parrot', d: 'anchor' },
    blurb: 'Scourge of the Sunshine Seas. Cannonballs, a cutlass lunge and a parrot to carry him home.',
    quote: "Yo ho ho! That loot's mine now!" }),
  defChar({ id: 'ninja', name: 'Ninja Toad', look: { cap: '#ffffff', spot: '#272744', vest: '#272744', trim: '#d8343c', hat: 'ninja', mask: true, prop: 'shuriken' },
    weight: 0.8, run: 7.4, air: 5.8, jump: 16, djump: 14.5, jumps: 3, pow: 0.92, swoosh: '#b8b8ff', sp: { n: 'shuriken', s: 'shadowdash', u: 'smokeleap', d: 'substitute' },
    blurb: 'Swift and silent, with three jumps. Shuriken, a shadow dash and a log-swap counter.',
    quote: '...You never saw me.' }),
  defChar({ id: 'knight', name: 'Knight Toad', look: { cap: '#ffffff', spot: '#2f6bd8', vest: '#a9b2c0', trim: '#f4c430', hat: 'plume', armor: true, prop: 'sword', shield: true },
    weight: 1.3, run: 5.4, air: 4.4, jump: 13, djump: 11.5, pow: 1.18, reach: 1.15, swoosh: '#dff0ff', sp: { n: 'shieldbash', s: 'lance', u: 'swordspin', d: 'swordplant' },
    blurb: 'A heavy, honorable guard. Sword and shield, a spinning slash and an unstoppable charge.',
    quote: 'For the Princess and for Toad Town!' }),
  defChar({ id: 'chef', name: 'Chef Toad', look: { cap: '#ffffff', spot: '#e8262b', vest: '#f6f1e6', trim: '#e8262b', hat: 'toque', apron: true, prop: 'pan' },
    weight: 1.1, run: 5.8, pow: 1.08, swoosh: '#ffe9c2', sp: { n: 'pancake', s: 'panswing', u: 'souffle', d: 'soup' },
    blurb: 'Head chef of the Mushroom Castle. Flips pancakes, swings a mean frying pan, spills hot soup.',
    quote: 'Order up! A fresh plate of defeat!' }),
  defChar({ id: 'wizard', name: 'Wizard Toad', look: { cap: '#ffffff', spot: '#6a3fd0', vest: '#4a2a9a', trim: '#ffd23a', hat: 'wizard', robe: true, prop: 'wand' },
    weight: 0.85, run: 5.8, air: 5.2, swoosh: '#e2c8ff', sp: { n: 'starbolt', s: 'blink', u: 'levitate', d: 'rune' },
    blurb: 'Studied magic in the Star Haven. Homing star bolts, blink teleports and booby-trapped runes.',
    quote: 'Abraca-Toad-bra! You vanish!' }),
  defChar({ id: 'astro', name: 'Astro Toad', look: { cap: '#ffffff', spot: '#ff8a1f', vest: '#eeeeee', trim: '#ff8a1f', hat: 'dome', jetpack: true, prop: 'raygun' },
    weight: 0.95, run: 6.0, air: 5.6, jump: 14, fall: 0.85, swoosh: '#c8f4ff', sp: { n: 'raygun', s: 'jetdash', u: 'jetlift', d: 'gravwell' },
    blurb: 'Back from the Comet Observatory. Ray gun, a jetpack and a pocket gravity well.',
    quote: 'One small step for Toad, one giant KO!' }),
  defChar({ id: 'doctor', name: 'Doctor Toad', look: { cap: '#ffffff', spot: '#2bb5a6', vest: '#ffffff', trim: '#2bb5a6', hat: 'mirror', coat: true, prop: 'pill' },
    weight: 1.0, run: 6.0, sp: { n: 'vitamin', s: 'bandage', u: 'pulsehop', d: 'checkup' },
    blurb: 'The castle physician. Bouncing megavitamins, bandage wraps, and a check-up that heals.',
    quote: 'Take two of these and call me in the morning!' }),
  defChar({ id: 'rocker', name: 'Rocker Toad', look: { cap: '#26262e', spot: '#e8262b', vest: '#2b2b2b', trim: '#c0c6d0', hat: 'shades', prop: 'guitar' },
    weight: 1.0, run: 6.6, pow: 1.05, swoosh: '#ff7088', sp: { n: 'powerchord', s: 'stagedive', u: 'ampblast', d: 'feedback' },
    blurb: 'Lead guitar of the Toad Tones. Power chords, stage dives and an amp that never quits.',
    quote: 'Thank you, Toad Town! Good night!' }),
  defChar({ id: 'cowboy', name: 'Cowboy Toad', look: { cap: '#ffffff', spot: '#a0602a', vest: '#c8853a', trim: '#ffd23a', hat: 'cowboy', scarf: true, prop: 'lasso' },
    weight: 1.05, run: 6.6, swoosh: '#ffe0a8', sp: { n: 'cork', s: 'lasso', u: 'lassoswing', d: 'tumbleweed' },
    blurb: 'Sheriff of Dry Dry Desert. A cork pistol, a trusty lasso and rolling tumbleweeds.',
    quote: "This mushroom kingdom ain't big enough for the both of us." }),
  defChar({ id: 'ghost', name: 'Ghost Toad', look: { cap: '#e4eeff', spot: '#8aa0d8', vest: '#c4d4f0', trim: '#ffffff', ghost: true },
    weight: 0.75, run: 6.0, air: 6.0, jumps: 4, djump: 11.5, fall: 0.72, sp: { n: 'boo', s: 'phase', u: 'spiritfloat', d: 'haunt' },
    blurb: 'A spooky Toad from the Boo Mansion. Floaty, four jumps, phases through attacks and haunts foes.',
    quote: 'Boo! ...Did I scare you? Please say yes.' }),
  defChar({ id: 'robo', name: 'Robo Toad', look: { cap: '#b6bfcc', spot: '#e8262b', vest: '#727c8c', trim: '#ffd23a', robo: true, hat: 'antenna' },
    weight: 1.35, run: 5.6, air: 4.6, jump: 13.5, djump: 12, pow: 1.15, swoosh: '#9ff0ff', sp: { n: 'rocketfist', s: 'turbo', u: 'jetboots', d: 'steam' },
    blurb: 'Built by Professor E. Gadd. Rocket fists, an armored turbo dash and a scalding steam vent.',
    quote: 'BEEP BOOP. OPPONENT: DEFEATED.' }),
];
const CH = {};
for (const c of CHARS) CH[c.id] = c;

const SPNAME = {
  turnip: 'Turnip Pluck', toaddash: 'Toad Dash', sporespin: 'Spore Spin', scream: 'Toad Scream',
  pigspin: 'Pigtail Spin', pigwhip: 'Pigtail Whip', float: 'Toadette Float', crown: 'Super Crown',
  turnips: 'Turnip Toss', headlamp: 'Headlamp Flash', boost: 'Backpack Boost', pickaxe: 'Pickaxe Frenzy',
  scold: '"Oh my!" Scold', canehook: 'Cane Hook', parasol: 'Parasol Glide', brigade: 'Toad Brigade',
  iceball: 'Ice Ball', iceslide: 'Ice Slide', propeller: 'Propeller Mushroom', pound: 'Ground Pound',
  fireball: 'Fireball', firedash: 'Fire Dash', superjump: 'Super Jump',
  boomerang: 'Boomerang Flower', tailwhip: 'Tail Whip', tanooki: 'Tanooki Tail', counter: 'Leaf Counter',
  poison: 'Poison Mushroom', haze: 'Purple Haze', cloud: 'Cloud Flower', pounce: 'Cat Pounce',
  egg: 'Egg Toss', eggroll: 'Egg Roll', flutter: 'Flutter Jump', yoshipound: 'Yoshi Bomb',
  cannon: 'Cannonball', cutlass: 'Cutlass Lunge', parrot: 'Parrot Lift', anchor: 'Anchor Drop',
  shuriken: 'Shuriken Toss', shadowdash: 'Shadow Dash', smokeleap: 'Smoke Leap', substitute: 'Log Substitution',
  shieldbash: 'Shield Bash', lance: 'Valiant Charge', swordspin: 'Spin Slash', swordplant: 'Sword Plant',
  pancake: 'Pancake Flip', panswing: 'Frying Pan', souffle: 'Soufflé Rise', soup: 'Hot Soup',
  starbolt: 'Star Bolt', blink: 'Blink', levitate: 'Levitate', rune: 'Magic Rune',
  raygun: 'Ray Gun', jetdash: 'Jet Dash', jetlift: 'Jetpack Lift', gravwell: 'Gravity Well',
  vitamin: 'Megavitamin', bandage: 'Bandage Wrap', pulsehop: 'Pulse Hop', checkup: 'Check-up',
  powerchord: 'Power Chord', stagedive: 'Stage Dive', ampblast: 'Amp Blast', feedback: 'Feedback Loop',
  cork: 'Cork Shot', lasso: 'Lasso', lassoswing: 'Lasso Swing', tumbleweed: 'Tumbleweed',
  boo: 'Boo Buddy', phase: 'Phase Rush', spiritfloat: 'Spirit Float', haunt: 'Haunt',
  rocketfist: 'Rocket Fist', turbo: 'Turbo Dash', jetboots: 'Jet Boots', steam: 'Steam Vent',
};
// each fighter's Smash Mushroom finale
const FSNAME = {
  toad: 'Toad Brigade Stampede', toadette: 'Peachette Grand Ball', captain: 'Mine Cart Mayhem', toadsworth: 'Royal Guard Charge',
  blue: 'Absolute Zero', yellow: 'Solar Flare', green: 'Leaf Storm', purple: 'Toxic Tide', yoshi: 'Egg Storm',
  pirate: 'Broadside Barrage', ninja: 'Shadow Clone Strike', knight: 'Excalibur Wave', chef: 'Banquet Bonanza',
  wizard: 'Arcane Vortex', astro: 'Orbital Laser', doctor: 'Megavitamin Cascade', rocker: 'Encore Shockwave',
  cowboy: 'High Noon Showdown', ghost: 'Boo Swarm', robo: 'Gigaton Rocket Fist',
};

// Hitboxes: a..b = active frames, x/y offset from feet (x mirrored by facing), r radius,
// d damage, k base knockback, g knockback growth, ang launch angle (0 = forward, 90 = up).
// Smash attacks (smash: 1) scale with how long the attack button was held.
const BASE_ATK = {
  jab:    { dur: 14, hb: [{ a: 3, b: 5, x: 28, y: -30, r: 20, d: 3, k: 3, g: 0.02, ang: 40 }] },
  jab2:   { dur: 15, hb: [{ a: 3, b: 6, x: 30, y: -33, r: 21, d: 3, k: 3, g: 0.02, ang: 45 }] },
  jab3:   { dur: 26, hb: [{ a: 5, b: 9, x: 34, y: -24, r: 26, d: 6, k: 6, g: 0.08, ang: 40 }] },
  side:   { dur: 30, lunge: 3, hb: [{ a: 9, b: 13, x: 42, y: -30, r: 27, d: 10, k: 6, g: 0.13, ang: 38 }] },
  up:     { dur: 28, hb: [{ a: 6, b: 11, x: 6, y: -72, r: 30, d: 8, k: 6, g: 0.13, ang: 88 }] },
  down:   { dur: 22, hb: [{ a: 5, b: 9, x: 36, y: -8, r: 24, d: 6, k: 4, g: 0.09, ang: 28 }] },
  fsmash: { dur: 44, lunge: 4, smash: 1, hb: [{ a: 16, b: 21, x: 46, y: -32, r: 32, d: 16, k: 8, g: 0.2, ang: 38 }] },
  usmash: { dur: 42, smash: 1, hb: [{ a: 13, b: 19, x: 4, y: -78, r: 36, d: 15, k: 8, g: 0.2, ang: 88 }] },
  dsmash: { dur: 40, smash: 1, hb: [{ a: 12, b: 17, x: 38, y: -10, r: 28, d: 13, k: 7, g: 0.18, ang: 30 }, { a: 12, b: 17, x: -38, y: -10, r: 28, d: 13, k: 7, g: 0.18, ang: 150 }] },
  nair:   { dur: 28, hb: [{ a: 5, b: 15, x: 0, y: -30, r: 38, d: 9, k: 4, g: 0.1, ang: 45 }] },
  fair:   { dur: 30, hb: [{ a: 9, b: 13, x: 38, y: -30, r: 28, d: 12, k: 5, g: 0.14, ang: 40 }] },
  bair:   { dur: 28, hb: [{ a: 7, b: 11, x: -36, y: -30, r: 26, d: 12, k: 6, g: 0.15, ang: 145 }] },
  uair:   { dur: 24, hb: [{ a: 5, b: 10, x: 4, y: -70, r: 30, d: 8, k: 5, g: 0.12, ang: 85 }] },
  dair:   { dur: 34, hb: [{ a: 10, b: 15, x: 0, y: 4, r: 26, d: 12, k: 4, g: 0.12, ang: -80 }] },
  pick:   { dur: 24, fx: 'pick', hb: [{ a: 7, b: 11, x: 44, y: -40, r: 34, d: 11, k: 6, g: 0.13, ang: 55 }] },
  getup:  { dur: 24, hb: [{ a: 6, b: 12, x: 30, y: -24, r: 32, d: 7, k: 6, g: 0.05, ang: 30 }] },
  throw:  { dur: 14, hb: [] },
};
const ATK_MODS = {
  yoshi: {
    side: { dur: 32, fx: 'tongue', hb: [{ a: 9, b: 14, x: 84, y: -40, r: 20, d: 11, k: 6, g: 0.14, ang: 35 }] },
    fair: { dur: 34, fx: 'tongue', hb: [{ a: 9, b: 14, x: 80, y: -40, r: 20, d: 10, k: 5, g: 0.13, ang: 40 }] },
  },
  toadsworth: {
    jab: { dur: 18, fx: 'cane', hb: [{ a: 4, b: 7, x: 46, y: -24, r: 18, d: 3, k: 3, g: 0.02, ang: 35 }] },
    side: { dur: 36, lunge: 2, fx: 'cane', hb: [{ a: 12, b: 16, x: 64, y: -26, r: 24, d: 13, k: 7, g: 0.15, ang: 36 }] },
    fair: { dur: 32, fx: 'cane', hb: [{ a: 10, b: 14, x: 56, y: -30, r: 24, d: 12, k: 5, g: 0.14, ang: 40 }] },
  },
  toad: { up: { dur: 28, fx: 'head', hb: [{ a: 6, b: 11, x: 4, y: -70, r: 32, d: 11, k: 6, g: 0.15, ang: 88 }] } },
  toadette: { nair: { dur: 30, fx: 'spin', hb: [{ a: 5, b: 17, x: 0, y: -32, r: 40, d: 9, k: 4, g: 0.1, ang: 45 }] } },
};
const ATK = {};
for (const c of CHARS) {
  ATK[c.id] = {};
  for (const k in BASE_ATK) {
    const mod = ATK_MODS[c.id] && ATK_MODS[c.id][k];
    const a = JSON.parse(JSON.stringify(mod || BASE_ATK[k]));
    if (!mod) for (const h of a.hb) { h.x *= c.reach; h.r *= 1 + (c.reach - 1) * 0.5; }
    if (!a.fx) a.fx = k === 'nair' ? 'spin' : 'swipe';
    ATK[c.id][k] = a;
  }
}

// haz lists each stage's challenges (see hazards() in sim.js)
const STAGES = [
  { id: 'town', name: 'Toad Town', haz: ['chest', 'wiggler'], hazName: 'Wiggler parades through town; Toad House chests drop goodies',
    solids: [{ x: -470, y: 0, w: 940, h: 110 }],
    plats: [{ x: -370, y: -150, w: 200 }, { x: 170, y: -150, w: 200 }, { x: -100, y: -290, w: 200 }],
    spawn: [[-300, -1], [300, -1], [-110, -1], [110, -1]] },
  { id: 'diorama', name: 'Captain Toad Diorama', haz: ['sprouts', 'spikes'], hazName: 'Spike traps pop up; turnip sprouts and moving blocks',
    solids: [{ x: -380, y: 0, w: 760, h: 220 }],
    plats: [
      { x: -620, y: -110, w: 170, move: { ax: 0, ay: 80, per: 360, ph: 0 } },
      { x: 450, y: -110, w: 170, move: { ax: 0, ay: 80, per: 360, ph: Math.PI } },
      { x: -90, y: -240, w: 180, move: { ax: 200, ay: 0, per: 480, ph: 0 } }],
    spikes: [{ x: -300, w: 110 }, { x: 190, w: 110 }],
    spawn: [[-280, -1], [280, -1], [-90, -1], [90, -1]] },
  { id: 'turnpike', name: "Toad's Turnpike", haz: ['kart', 'boost'], hazName: 'Karts race across the road; dash panels launch you',
    solids: [{ x: -540, y: 0, w: 1080, h: 80 }],
    plats: [{ x: -330, y: -170, w: 230 }, { x: 100, y: -170, w: 230 }],
    boost: [{ x: -440, w: 100, dir: 1 }, { x: 340, w: 100, dir: -1 }],
    spawn: [[-320, -1], [320, -1], [-110, -1], [110, -1]] },
  { id: 'gorge', name: 'Mushroom Gorge', haz: ['wind'], hazName: 'Bouncy mushrooms; gusts of wind howl through the gorge',
    solids: [{ x: -290, y: 0, w: 580, h: 140 }],
    plats: [{ x: -580, y: -40, w: 170, bounce: true }, { x: 410, y: -40, w: 170, bounce: true }, { x: -110, y: -210, w: 220 }],
    spawn: [[-200, -1], [200, -1], [-60, -1], [60, -1]] },
];

const ITEMS = {
  mush: { name: 'Super Mushroom!', w: 3 }, mini: { name: 'Mini Mushroom!', w: 2 }, poison: { name: 'Poison Mushroom!', w: 2 },
  oneup: { name: '1-UP!', w: 1 }, gold: { name: 'Golden Mushroom!', w: 2 }, star: { name: 'Super Star!', w: 1 }, turnip: { name: 'Turnip!', w: 4 },
};
