'use strict';
// ===== Super Smash Toads: shared data =====
// The page and the code have to come from the same update. build.ps1 stamps both with this mark (and the page's
// script links too). If a browser still serves an old copy of one of them from its cache, reload once from the server.
const GAME_BUILD = '202611091927';
(() => {
  const m = document.querySelector('meta[name="sst-build"]');
  if ((m && m.content) === GAME_BUILD || /[?&]fresh=/.test(location.search)) return;
  location.replace(location.pathname + '?fresh=' + Date.now());
})();
const W = 1280, H = 720;
// blast lines: cross one and you lose a stock (there's plenty of room below the stages to recover)
const BLAST = { l: -1150, r: 1150, t: -800, b: 760 };
const GRAV = 0.62, MAXFALL = 11, FASTFALL = 16;
// buttons: move, jump, down/crouch, attack (Q), special (E), guard (F) and the four taunts
// B_U is the up direction (it also jumps, "tap jump"); B_J is a jump-only button (Space, gamepad Y) that never aims moves up
const B_L = 1, B_R = 2, B_U = 4, B_D = 8, B_A = 16, B_B = 32, B_S = 64, B_T1 = 128, B_T2 = 256, B_T3 = 512, B_T4 = 1024, B_G = 2048, B_J = 4096;
const B_TAUNTS = [B_T1, B_T2, B_T3, B_T4], B_ALL = 8191;
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
  // rides Buttercup the cow: h is the whole pair's height, drawH sizes the Toad on top
  defChar({ id: 'cowtoad', name: 'Moo Toad', look: { cap: '#ffffff', spot: '#2b2b2b', vest: '#8a5a2b', trim: '#ffd23a', mount: 'cow' },
    weight: 1.4, run: 7.4, air: 4.6, jump: 13.5, djump: 12, h: 90, drawH: 46, wide: 1.55, pow: 1.12, swoosh: '#fff6e0',
    sp: { n: 'milkshot', s: 'cowcharge', u: 'moonjump', d: 'cowbell' },
    blurb: 'Rides Buttercup the cow into battle. Milk splashes, an armored cattle charge, and a jump over the moon.',
    quote: 'Moooove over, the champ is here!' }),
  // ---- warriors from around the world and through history ----
  defChar({ id: 'samurai', name: 'Samurai Toad', look: { cap: '#ffffff', spot: '#c8202a', vest: '#b8202a', trim: '#2b2b3a', shirt: '#2b2b3a', pants: '#2b2b3a', stripes: true, hat: 'kabuto', sode: true, prop: 'katana' },
    weight: 1.05, run: 6.8, air: 5.0, pow: 1.07, reach: 1.12, swoosh: '#ffe6f0', sp: { n: 'windslash', s: 'quickdraw', u: 'cranerise', d: 'iaicounter' },
    blurb: 'A calm, disciplined swordsman. Wind slashes, a lightning quick-draw, and a counter that cuts the moment you swing.',
    quote: 'My blade was drawn before you blinked.' }),
  defChar({ id: 'viking', name: 'Viking Toad', look: { cap: '#ffffff', spot: '#d8343c', vest: '#7a4a24', trim: '#c8d0dc', hat: 'horned', beard: '#e0782a', prop: 'axe', shield: 'round' },
    weight: 1.27, run: 5.8, air: 4.6, jump: 13.5, djump: 12, pow: 1.06, reach: 1.05, wide: 1.08, swoosh: '#fff0d0', sp: { n: 'axethrow', s: 'shieldrush', u: 'berserk', d: 'warhorn' },
    blurb: 'A bearded raider from the frozen north. Throwing axes, a shield rush, and a war horn that blows foes away.',
    quote: 'To the longships! Glory awaits!' }),
  defChar({ id: 'pharaoh', name: 'Pharaoh Toad', look: { cap: '#ffffff', spot: null, capBands: ['#ffd23a', '#2f6bd8'], vest: '#f6f1e6', trim: '#ffd23a', shirt: '#f6f1e6', hat: 'nemes', collar: true, prop: 'sunstaff' },
    weight: 1.08, run: 6.2, air: 5.2, pow: 1.1, reach: 1.12, swoosh: '#fff3c0', sp: { n: 'scarab', s: 'sandsurge', u: 'sunrise', d: 'sarcophagus' },
    blurb: 'Boy-king of the dunes. Homing golden scarabs, a surging wave of sand, and a sarcophagus that bites back.',
    quote: 'Bow before the ruler of the dunes!' }),
  defChar({ id: 'gladiator', name: 'Gladiator Toad', look: { cap: '#ffffff', spot: '#c0392b', vest: '#b5442b', trim: '#d8a040', hat: 'galea', belt: true, galerus: true, prop: 'trident' },
    weight: 1.15, run: 6.4, air: 5.0, pow: 1.08, reach: 1.2, swoosh: '#ffe8c8', sp: { n: 'tridenttoss', s: 'tridentlunge', u: 'polevault', d: 'nettrap' },
    blurb: 'Champion of the arena. A thrown trident, a long lunge, a pole vault and a net that tangles anyone who steps in it.',
    quote: 'The crowd roars, and so do I!' }),
  // ---- Toads of many faiths (made with the players who asked for them): celebrations, food and music, never sacred objects ----
  defChar({ id: 'buddhist', name: 'Buddhist Toad', look: { cap: '#ffffff', spot: '#f08a1f', vest: '#f08a1f', trim: '#8a2a2a', robe: true, sash: '#8a2a2a', prop: 'bostaff' },
    weight: 1.02, run: 6.6, air: 5.4, jump: 15.5, pow: 1.07, reach: 1.12, swoosh: '#fff0c8', sp: { n: 'chipalm', s: 'staffwhirl', u: 'lotusfloat', d: 'stillmind' },
    blurb: 'A peaceful kung fu monk. Chi palms, a whirling staff, a floating lotus, and a counter born of a still mind.',
    quote: 'Breathe in... breathe out... and fly far away.' }),
  defChar({ id: 'muslim', name: 'Muslim Toad', look: { cap: '#ffffff', spot: '#2fa86a', vest: '#2fa86a', trim: '#ffd23a', robe: true, robeCol: '#fbfbf6', shirt: '#fbfbf6', hat: 'kufi' },
    weight: 1.04, run: 6.4, air: 5.2, pow: 1.06, swoosh: '#fff6d8', sp: { n: 'datetoss', s: 'lantern', u: 'lanternlift', d: 'eidsweets' },
    blurb: 'All dressed up for Eid. Tosses dates, sends glowing lanterns drifting, and shares sweets to feel better.',
    quote: 'Eid Mubarak! Sweets for everyone!' }),
  defChar({ id: 'mormon', name: 'Mormon Toad', look: { cap: '#ffffff', spot: '#2557d6', vest: '#fbfbf8', trim: '#fbfbf8', shirt: '#fbfbf8', pants: '#2b2b34', tie: '#1f2a4a' },
    weight: 1.04, run: 6.6, air: 5.2, pow: 1.05, swoosh: '#eef4ff', sp: { n: 'jelly', s: 'bikeride', u: 'highnote', d: 'potluck' },
    blurb: 'A friendly missionary on a bicycle. Bouncy green jelly, a bike ride, a choir-sized high note and a hot potluck dish.',
    quote: 'Hi there! Got a minute? This will only take one.' }),
  defChar({ id: 'hasidic', name: 'Hasidic Toad', look: { cap: '#ffffff', spot: '#2b2b34', vest: '#1d1d24', trim: '#34343e', robe: true, robeCol: '#1d1d24', hat: 'blackhat', beard: '#6a4630', payot: '#6a4630' },
    weight: 1.05, run: 6.2, air: 5.0, pow: 1.0, swoosh: '#fff6d8', sp: { n: 'latke', s: 'dreidel', u: 'chairlift', d: 'klezmer' },
    blurb: 'Full of joy and always ready to dance. Latke tosses, a spinning dreidel, the wedding-chair lift and a klezmer tune.',
    quote: 'Mazel tov! Now everybody dance!' }),
  defChar({ id: 'catholic', name: 'Catholic Toad', look: { cap: '#ffffff', spot: '#2f6bd8', vest: '#fbfbf8', trim: '#fbfbf8', robe: true, robeCol: '#c8202a', shirt: '#c8202a', cross: true },
    weight: 1.0, run: 6.4, air: 5.2, pow: 1.04, swoosh: '#fff2c8', sp: { n: 'kingsgift', s: 'bellring', u: 'partypopper', d: 'pinata' },
    blurb: 'In his Sunday-best choir robes and always ready to celebrate: Three Kings gift boxes, a ringing bell, a party-popper jump and a candy piñata.',
    quote: 'Ring the bells, it\'s time for a fiesta!' }),
  defChar({ id: 'hindu', name: 'Hindu Toad', look: { cap: '#ffffff', spotCols: ['#ff4fa0', '#3fbf4a', '#ffd23a', '#2f7cf6'], vest: '#fbfbf6', trim: '#ffd23a', robe: true, robeCol: '#fbfbf6', shirt: '#fbfbf6', pants: '#fbfbf6', holi: true },
    weight: 0.98, run: 6.8, air: 5.4, jump: 15.5, pow: 1.02, swoosh: '#ffe0f0', sp: { n: 'colorthrow', s: 'dandiya', u: 'kitefly', d: 'pichkari' },
    blurb: 'Celebrating Holi, the festival of colors! Clouds of bright powder, the dandiya stick dance, a festival kite to fly home on and a squirt of colored water.',
    quote: 'Happy Holi! Hold still... this color looks great on you!' }),
  // Ice Climbers style: Beatrice rides in a backpack and casts his specials; her little spark follows his attacks
  defChar({ id: 'subaru', name: 'Subaru Toad', look: { cap: '#2a2a33', spot: '#ffffff', vest: '#ececf0', trim: '#ff8a1f', shirt: '#ececf0', pants: '#2b2b34', sleeves: '#3a3a44', zip: true, eyes: 'sharp', beako: true },
    weight: 0.96, run: 6.6, air: 5.4, jump: 15, djump: 13.5, pow: 1.0, duo: true, swoosh: '#e8d8ff', sp: { n: 'minya', s: 'shamac', u: 'murak', d: 'unseenhand' },
    blurb: 'A stubborn kid in a tracksuit, with the tiny spirit Beatrice riding on his back. He hits softly; her magic does the rest.',
    quote: 'Starting from zero... and winning! Right, Beako? ("Obviously, I suppose.")' }),
  // an ice mage with the great spirit Puck floating behind her. Her Attack button fires a homing volley of ice
  // pellets instead of normal attacks (`volley`), and Puck shoots ice of his own every 7 seconds (`puck`)
  defChar({ id: 'emilia', name: 'Emilia Toad', look: { cap: '#fbfaff', spot: '#cdb8f4', vest: '#8a5ad0', trim: '#c9aaf4', shirt: '#8a5ad0', pants: '#7a4ac4', sleeves: '#f7f5fc', cuff: '#ff9cc8',
    hat: 'hood', braid: '#ebe6f6', eyes: 'violet', bigEyes: 1.15, cape: '#f7f5fc', capeIn: '#d9cdf3', brooch: true, shoe: '#f7f5fc', sole: '#a477e0', puck: true },
    weight: 0.9, run: 6.3, air: 5.3, jump: 15, djump: 13.5, pow: 1.0, volley: true, puck: true, swoosh: '#dff4ff', sp: { n: 'icesoldiers', s: 'icebrand', u: 'icepillar', d: 'icebarrier' },
    elemInfo: 'Ice: her weapons chill foes, her spear can freeze them',
    blurb: 'An ice mage with the great spirit Puck floating behind her. Homing ice pellets, ice weapons made on the spot, ice soldiers, and pillars and walls of ice.',
    quote: 'I\'m Emilia. Just Emilia! (Puck: "That\'s my girl!")' }),
  // ---- the Yoshi clan ----
  defChar({ id: 'yoshi', name: 'Yoshi', yoshi: true, look: { body: '#3dbb3d', saddle: '#e8262b', shoe: '#ff8a1f' },
    weight: 1.05, run: 7.0, air: 5.4, jump: 15.5, djump: 16.5, h: 66, sp: { n: 'egg', s: 'eggroll', u: 'flutter', d: 'yoshipound' },
    blurb: "Toad's dino pal. Egg tosses, an Egg Roll, flutter jumps, and a starry Yoshi Bomb.",
    quote: 'Yoshi! (He says Toads are the best.)' }),
  defChar({ id: 'redyoshi', name: 'Red Yoshi', yoshi: true, look: { body: '#e83a32', saddle: '#ffd23a', shoe: '#7a3a1a', spines: '#ffb02e' },
    weight: 1.05, run: 7.0, air: 5.4, jump: 15.5, djump: 16.5, h: 66, pow: 1.08, sp: { n: 'firespit', s: 'flamerush', u: 'blazejump', d: 'magmapound' },
    blurb: 'A hot-tempered Yoshi. Spits fireballs, charges in a blaze and pounds the ground into magma.',
    quote: 'Yoshi! (That means "too hot for you.")' }),
  defChar({ id: 'blueyoshi', name: 'Blue Yoshi', yoshi: true, look: { body: '#2f7cf6', saddle: '#e8262b', shoe: '#ff8a1f', wings: true },
    weight: 0.95, run: 7.0, air: 6.0, jump: 15.5, djump: 17, h: 66, fall: 0.85, sp: { n: 'gust', s: 'swoop', u: 'wingflight', d: 'divebomb' },
    blurb: 'This Yoshi sprouted wings! Blows foes away with gusts, swoops in, and flies home from anywhere.',
    quote: 'Yoshi! (Catch me if you can... from up here.)' }),
  defChar({ id: 'yellowyoshi', name: 'Yellow Yoshi', yoshi: true, look: { body: '#ffc81a', saddle: '#2fb24a', shoe: '#8a5a2b', boots: true },
    weight: 1.25, run: 6.2, air: 5.0, jump: 14.5, djump: 15.5, h: 66, pow: 1.12, sp: { n: 'rockspit', s: 'stampede', u: 'springjump', d: 'quakestomp' },
    blurb: 'A heavy stomper in big boots. Spits rocks, charges like a rhino and shakes the whole stage.',
    quote: 'YOSHI! (The ground agrees.)' }),
  defChar({ id: 'pinkyoshi', name: 'Pink Yoshi', yoshi: true, look: { body: '#ff8cc6', saddle: '#e8262b', shoe: '#ffffff', bow: true },
    weight: 0.95, run: 7.2, air: 5.6, jump: 15.5, djump: 16.5, h: 66, sp: { n: 'heartkiss', s: 'cartwheel', u: 'heartfloat', d: 'sweetcounter' },
    blurb: 'Sweet but sneaky. Blown kisses leave foes dizzy with love, and she counters any cheap shot.',
    quote: 'Yoshi! (Love wins. Also, I win.)' }),
  defChar({ id: 'iceyoshi', name: 'Light Blue Yoshi', yoshi: true, look: { body: '#7fd3ff', saddle: '#2f6bd8', shoe: '#f6f6fb', scarf: true },
    weight: 1.0, run: 7.4, air: 5.2, jump: 15.5, djump: 16, h: 66, sp: { n: 'frostbreath', s: 'iceskate', u: 'snowtwirl', d: 'frostpatch' },
    blurb: 'Bundled up and cool as ice. Freezing breath, an ice-skate dash and frosty floor traps.',
    quote: 'Yoshi... (Stay frosty.)' }),
  defChar({ id: 'purpleyoshi', name: 'Purple Yoshi', yoshi: true, look: { body: '#9b4fd6', saddle: '#ffd23a', shoe: '#ff8a1f', spots: '#f1ddff' },
    weight: 1.0, run: 6.8, air: 5.4, jump: 15.5, djump: 16.5, h: 66, sp: { n: 'sporespit', s: 'venomlash', u: 'bubblelift', d: 'toxicpuddle' },
    blurb: 'A spotted trickster. Poison bubbles, a venomous tongue that can grab ledges, and toxic puddles.',
    quote: 'Yoshi~ (You look a little green. Purple, actually.)' }),
  defChar({ id: 'blackyoshi', name: 'Black Yoshi', yoshi: true, look: { body: '#34343e', saddle: '#e8262b', shoe: '#e8262b', shades: true, spines: '#a02030' },
    weight: 1.2, run: 6.6, air: 5.2, jump: 15, djump: 16, h: 66, pow: 1.15, sp: { n: 'shadowball', s: 'nightdash', u: 'shadowleap', d: 'heavystomp' },
    blurb: 'The strongest Yoshi, and the coolest. Homing shadow orbs, a phantom dash and crushing stomps.',
    quote: 'Yoshi. (The shades stay on.)' }),
  defChar({ id: 'whiteyoshi', name: 'White Yoshi', yoshi: true, look: { body: '#f6f6fb', saddle: '#3f8cff', shoe: '#ffd23a', halo: true },
    weight: 0.95, run: 7.0, air: 5.8, jump: 15.5, djump: 16.5, h: 66, fall: 0.9, sp: { n: 'lightbolt', s: 'angeldash', u: 'halorise', d: 'holyshine' },
    blurb: 'A gentle Yoshi with a halo. Light bolts, a reflecting angel dash and a shining shield.',
    quote: 'Yoshi! (Bless your heart. Now fly.)' }),
  defChar({ id: 'orangeyoshi', name: 'Orange Yoshi', yoshi: true, look: { body: '#ff8a1f', saddle: '#3fae3a', shoe: '#ffd23a', sprout: true },
    weight: 1.05, run: 7.0, air: 5.4, jump: 15.5, djump: 16.5, h: 66, sp: { n: 'seedspit', s: 'fruitroll', u: 'melonhop', d: 'fruitbomb' },
    blurb: 'Always snacking. Machine-gun melon seeds, a fruit roll and exploding watermelons.',
    quote: 'Yoshi! (Is that a melon? Can I have it?)' }),
  defChar({ id: 'babyyoshi', name: 'Baby Yoshi', yoshi: true, look: { body: '#7ad36b', saddle: '#ff8cc6', shoe: '#ffb36b', baby: true },
    weight: 0.7, run: 7.6, air: 5.8, jump: 14, djump: 15, jumps: 3, h: 50, pow: 0.9, sp: { n: 'gobble', s: 'babyroll', u: 'babyflutter', d: 'tantrum' },
    blurb: 'Tiny, speedy and always hungry. Gobbles foes up, rolls around and throws real tantrums.',
    quote: 'Yoshi! Yoshi! (Snack time!)' }),
  defChar({ id: 'dashyoshi', name: 'Dash Yoshi', yoshi: true, look: { body: '#ff5a26', saddle: '#ffd23a', shoe: '#ffe066', spines: '#ffe066', belly: '#ffe2b8', dash: true },
    weight: 1.05, run: 11.5, air: 7.2, jump: 16, djump: 16.5, h: 66, pow: 1.12, fall: 1.12, sp: { n: 'boomkick', s: 'blitzdash', u: 'cycloneclimb', d: 'afterimage' },
    blurb: 'The fastest fighter there is. Blurring kicks, a sonic-boom kick, a blitz dash, a cyclone climb and an afterimage that strikes from behind.',
    quote: 'Yoshi! (Blink and you\'ll miss me!)' }),
  // a Yoshi in a battle-robot suit, styled after Ray MK III: white armour, blue parts, a gold V-fin, green energy shots
  defChar({ id: 'mechyoshi', name: 'Mech Yoshi', yoshi: true, look: { body: '#eef2f8', saddle: '#2f6bd8', shoe: '#2f6bd8', spines: '#ffd23a', belly: '#c8d0dc', mech: true },
    weight: 1.25, run: 6.6, air: 5.6, jump: 14.5, djump: 15, h: 66, pow: 1.06, sp: { n: 'blaster', s: 'airdash', u: 'booster', d: 'bomblob' },
    blurb: 'Yoshi inside a battle robot. A rapid blaster, air dashes, a booster jump and lobbed bombs, like a real robo battle.',
    quote: 'Yoshi. (Systems online. Robo battle... GO!)' }),
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
  firespit: 'Fire Spit', flamerush: 'Flame Rush', blazejump: 'Blaze Jump', magmapound: 'Magma Pound',
  gust: 'Wing Gust', swoop: 'Sky Swoop', wingflight: 'Wing Flight', divebomb: 'Dive Bomb',
  rockspit: 'Rock Spit', stampede: 'Stampede', springjump: 'Spring Jump', quakestomp: 'Earthquake Stomp',
  heartkiss: 'Heart Kiss', cartwheel: 'Cartwheel', heartfloat: 'Heart Balloon', sweetcounter: 'Sweet Counter',
  frostbreath: 'Frost Breath', iceskate: 'Ice Skate', snowtwirl: 'Snow Twirl', frostpatch: 'Frost Patch',
  sporespit: 'Spore Bubble', venomlash: 'Venom Lash', bubblelift: 'Bubble Lift', toxicpuddle: 'Toxic Puddle',
  shadowball: 'Shadow Orb', nightdash: 'Night Dash', shadowleap: 'Shadow Leap', heavystomp: 'Heavy Stomp',
  lightbolt: 'Light Bolt', angeldash: 'Angel Dash', halorise: 'Halo Rise', holyshine: 'Holy Shine',
  seedspit: 'Melon Seeds', fruitroll: 'Fruit Roll', melonhop: 'Melon Bounce', fruitbomb: 'Fruit Bomb',
  gobble: 'Gobble Up', babyroll: 'Tumble Roll', babyflutter: 'Baby Flutter', tantrum: 'Tantrum',
  milkshot: 'Milk Splash', cowcharge: 'Cattle Charge', moonjump: 'Over the Moon', cowbell: 'Cowbell Clang',
  windslash: 'Wind Slash', quickdraw: 'Quick Draw', cranerise: 'Rising Crane', iaicounter: 'Iai Counter',
  axethrow: 'Axe Throw', shieldrush: 'Shield Rush', berserk: 'Berserker Leap', warhorn: 'War Horn',
  scarab: 'Scarab Swarm', sandsurge: 'Sand Surge', sunrise: 'Rising Sun', sarcophagus: 'Sarcophagus',
  tridenttoss: 'Trident Toss', tridentlunge: 'Trident Lunge', polevault: 'Pole Vault', nettrap: 'Net Trap',
  chipalm: 'Chi Palm', staffwhirl: 'Staff Whirl', lotusfloat: 'Lotus Float', stillmind: 'Still Mind',
  datetoss: 'Date Toss', lantern: 'Lantern Light', lanternlift: 'Lantern Lift', eidsweets: 'Eid Sweets',
  jelly: 'Green Jelly', bikeride: 'Bike Ride', highnote: 'High Note', potluck: 'Potluck Potatoes',
  latke: 'Latke Toss', dreidel: 'Dreidel Spin', chairlift: 'Chair Lift', klezmer: 'Klezmer Tune',
  minya: 'Minya', shamac: 'Shamac', murak: 'Murak', unseenhand: 'Unseen Hand',
  icesoldiers: 'Ice Soldiers', icebrand: 'Ice Brand Arts', icepillar: 'Ice Pillar', icebarrier: 'Ice Barrier',
  boomkick: 'Boom Kick', blitzdash: 'Blitz Dash', cycloneclimb: 'Cyclone Climb', afterimage: 'Afterimage',
  blaster: 'Ray Blaster', airdash: 'Air Dash', booster: 'Booster Jump', bomblob: 'Bomb Lob',
  kingsgift: "Three Kings' Gift", bellring: 'Bell Ring', partypopper: 'Party Popper', pinata: 'Piñata',
  colorthrow: 'Color Throw', dandiya: 'Dandiya Dance', kitefly: 'Kite Flight', pichkari: 'Pichkari Splash',
};
// each fighter's Smash Mushroom finale
const FSNAME = {
  toad: 'Toad Brigade Stampede', toadette: 'Peachette Grand Ball', captain: 'Mine Cart Mayhem', toadsworth: 'Royal Guard Charge',
  blue: 'Absolute Zero', yellow: 'Solar Flare', green: 'Leaf Storm', purple: 'Toxic Tide', yoshi: 'Egg Storm',
  pirate: 'Broadside Barrage', ninja: 'Shadow Clone Strike', knight: 'Excalibur Wave', chef: 'Banquet Bonanza',
  wizard: 'Arcane Vortex', astro: 'Orbital Laser', doctor: 'Megavitamin Cascade', rocker: 'Encore Shockwave',
  cowboy: 'High Noon Showdown', ghost: 'Boo Swarm', robo: 'Gigaton Rocket Fist',
  redyoshi: 'Volcano Rain', blueyoshi: 'Feather Cyclone', yellowyoshi: 'Mega Quake', pinkyoshi: 'Heartbreaker',
  iceyoshi: 'Blizzard', purpleyoshi: 'Bubble Flood', blackyoshi: 'Shadow Pack', whiteyoshi: 'Sacred Light',
  orangeyoshi: 'Fruit Frenzy', babyyoshi: 'Yoshi Stampede', cowtoad: 'Cattle Stampede',
  samurai: 'Cherry Blossom Storm', viking: 'Longship Raid', pharaoh: 'Great Pyramid', gladiator: 'Legion March',
  buddhist: 'Lotus Bloom', muslim: 'Lantern Night', mormon: 'Grand Choir', hasidic: 'Mazel Tov!', subaru: 'El Minya', emilia: 'Absolute Zero',
  catholic: 'Christmas Parranda', hindu: 'Festival of Colors',
  dashyoshi: 'Supersonic Lap', mechyoshi: 'Full Burst',
};
// how each fighter sounds: a voice kind (toad, yoshi, girl, old, ghost, robot) and a pitch (1 = normal)
const VOICE = {
  toadette: { k: 'girl', p: 1.12 }, captain: { p: 0.94 }, toadsworth: { k: 'old', p: 0.62 }, yellow: { p: 1.04 }, purple: { p: 1.06 },
  pirate: { p: 0.9 }, ninja: { p: 0.95 }, knight: { p: 0.84 }, chef: { p: 0.88 }, wizard: { p: 0.96 }, doctor: { p: 0.96 }, rocker: { p: 0.9 },
  cowboy: { p: 0.88 }, ghost: { k: 'ghost' }, robo: { k: 'robot', p: 0.8 }, cowtoad: { p: 0.92 },
  samurai: { p: 0.86 }, viking: { p: 0.72 }, pharaoh: { p: 0.95 }, gladiator: { p: 0.8 }, buddhist: { p: 0.9 }, muslim: { p: 0.96 },
  mormon: { p: 1.02 }, hasidic: { p: 0.84 }, catholic: { p: 0.98 }, hindu: { p: 1.04 }, subaru: { p: 0.92 }, emilia: { k: 'girl', p: 1.06 },
  redyoshi: { p: 0.95 }, blueyoshi: { p: 1.05 }, yellowyoshi: { p: 0.85 }, pinkyoshi: { p: 1.12 }, blackyoshi: { p: 0.8 }, whiteyoshi: { p: 1.08 },
  orangeyoshi: { p: 1.02 }, babyyoshi: { p: 1.35 }, dashyoshi: { p: 1.06 }, mechyoshi: { k: 'robot', p: 0.95 },
};
function voiceOf(id) { const C = CH[id] || {}, V = VOICE[id] || {}; return { k: V.k || (C.yoshi ? 'yoshi' : 'toad'), p: V.p || 1, yo: !!C.yoshi }; }

// ---------- Normal attacks ----------
// Hitboxes: a..b = active frames, x/y offset from feet (x mirrored by facing), r radius, d damage, k base knockback,
// g knockback growth, ang launch angle (0 = forward, 90 = up, negative = down). `every` re-hits the same foe after that
// many frames; `sep` gives a hitbox its own hit list (a finisher after a flurry). Every template has its own
// animation (models3d.js) and swoosh style `fx`. Moves in the smash slots charge while attack is held.
const MOVE_T = {
  // jab combos
  punch:      { dur: 14, hb: [{ a: 3, b: 5, x: 28, y: -30, r: 20, d: 3, k: 3, g: 0.02, ang: 40 }] },
  punch2:     { dur: 15, hb: [{ a: 3, b: 6, x: 30, y: -33, r: 21, d: 3, k: 3, g: 0.02, ang: 45 }] },
  kick3:      { dur: 26, fx: 'kick', hb: [{ a: 5, b: 9, x: 34, y: -24, r: 26, d: 6, k: 6, g: 0.08, ang: 40 }] },
  flurry:     { dur: 34, fx: 'flurry', hb: [{ a: 4, b: 22, x: 34, y: -30, r: 24, d: 1.2, k: 1, g: 0, ang: 60, every: 3 }, { a: 25, b: 27, x: 38, y: -30, r: 28, d: 3, k: 6, g: 0.08, ang: 40, sep: 1 }] },
  palm3:      { dur: 26, fx: 'burst', hb: [{ a: 6, b: 9, x: 38, y: -32, r: 30, d: 6, k: 7, g: 0.08, ang: 35 }] },
  uppercut3:  { dur: 28, hb: [{ a: 6, b: 10, x: 24, y: -48, r: 26, d: 6, k: 7, g: 0.07, ang: 80 }] },
  chop:       { dur: 12, hb: [{ a: 2, b: 4, x: 26, y: -32, r: 18, d: 2.5, k: 3, g: 0.02, ang: 45 }] },
  slash1:     { dur: 14, hb: [{ a: 3, b: 6, x: 34, y: -32, r: 22, d: 3.5, k: 3, g: 0.02, ang: 40 }] },
  slash2:     { dur: 15, hb: [{ a: 3, b: 6, x: 36, y: -30, r: 22, d: 3.5, k: 3, g: 0.02, ang: 45 }] },
  slash3:     { dur: 28, hb: [{ a: 6, b: 10, x: 42, y: -30, r: 30, d: 7, k: 7, g: 0.09, ang: 38 }] },
  bite:       { dur: 14, fx: 'chomp', hb: [{ a: 4, b: 6, x: 30, y: -42, r: 20, d: 3, k: 3, g: 0.02, ang: 40 }] },
  tailjab:    { dur: 16, fx: 'spin', hb: [{ a: 4, b: 7, x: 26, y: -22, r: 24, d: 3, k: 3, g: 0.02, ang: 45 }] },
  headbutt3:  { dur: 26, hb: [{ a: 6, b: 9, x: 32, y: -40, r: 26, d: 6, k: 6, g: 0.08, ang: 40 }] },
  // side tilts
  shove:      { dur: 30, lunge: 3, hb: [{ a: 9, b: 13, x: 42, y: -30, r: 27, d: 10, k: 6, g: 0.13, ang: 38 }] },
  roundhouse: { dur: 30, fx: 'spin', hb: [{ a: 8, b: 12, x: 40, y: -34, r: 28, d: 10, k: 7, g: 0.12, ang: 40 }] },
  dropkick:   { dur: 34, lunge: 7, fx: 'kick', hb: [{ a: 10, b: 15, x: 44, y: -22, r: 26, d: 11, k: 7, g: 0.12, ang: 32 }] },
  swing:      { dur: 30, hb: [{ a: 8, b: 12, x: 48, y: -34, r: 30, d: 11, k: 6, g: 0.13, ang: 40 }] },
  thrust:     { dur: 28, lunge: 2, fx: 'stab', hb: [{ a: 9, b: 12, x: 60, y: -32, r: 18, d: 10, k: 6, g: 0.12, ang: 30 }] },
  tailwhip:   { dur: 30, fx: 'spin', hb: [{ a: 8, b: 12, x: 40, y: -20, r: 30, d: 10, k: 6, g: 0.13, ang: 35 }] },
  tongue:     { dur: 32, fx: 'tongue', hb: [{ a: 9, b: 14, x: 84, y: -40, r: 20, d: 11, k: 6, g: 0.14, ang: 35 }] },
  zapside:    { dur: 30, fx: 'burst', hb: [{ a: 7, b: 16, x: 38, y: -32, r: 26, d: 2, k: 1, g: 0, ang: 50, every: 3 }, { a: 18, b: 19, x: 42, y: -32, r: 30, d: 5, k: 7, g: 0.11, ang: 38, sep: 1 }] },
  // up tilts
  headbutt:   { dur: 28, hb: [{ a: 6, b: 11, x: 4, y: -70, r: 32, d: 11, k: 6, g: 0.15, ang: 88 }] },
  antiair:    { dur: 26, hb: [{ a: 6, b: 10, x: 10, y: -72, r: 28, d: 8, k: 6, g: 0.13, ang: 86 }] },
  flipup:     { dur: 30, fx: 'spin', hb: [{ a: 6, b: 12, x: 10, y: -60, r: 30, d: 9, k: 6, g: 0.13, ang: 80 }] },
  upslash:    { dur: 28, hb: [{ a: 6, b: 12, x: 0, y: -76, r: 34, d: 9, k: 6, g: 0.13, ang: 85 }] },
  tongueup:   { dur: 30, fx: 'tongue', hb: [{ a: 8, b: 13, x: 8, y: -98, r: 20, d: 9, k: 6, g: 0.13, ang: 88 }] },
  // down tilts
  sweep:      { dur: 22, hb: [{ a: 5, b: 9, x: 36, y: -8, r: 24, d: 6, k: 4, g: 0.09, ang: 28 }] },
  lowpoke:    { dur: 22, fx: 'stab', hb: [{ a: 5, b: 8, x: 52, y: -10, r: 20, d: 7, k: 5, g: 0.09, ang: 20 }] },
  tailsweep:  { dur: 24, fx: 'spin', hb: [{ a: 5, b: 10, x: 30, y: -10, r: 28, d: 7, k: 5, g: 0.09, ang: 30 }, { a: 5, b: 10, x: -30, y: -10, r: 26, d: 6, k: 5, g: 0.09, ang: 150 }] },
  crouchjab:  { dur: 14, hb: [{ a: 3, b: 5, x: 30, y: -14, r: 18, d: 4, k: 3, g: 0.03, ang: 20 }] },
  // forward smashes
  haymaker:   { dur: 44, lunge: 4, hb: [{ a: 16, b: 21, x: 46, y: -32, r: 32, d: 16, k: 8, g: 0.2, ang: 38 }] },
  bigslash:   { dur: 46, hb: [{ a: 17, b: 22, x: 52, y: -34, r: 36, d: 17, k: 8, g: 0.2, ang: 36 }] },
  lungethrust:{ dur: 44, lunge: 9, fx: 'stab', hb: [{ a: 15, b: 20, x: 66, y: -32, r: 24, d: 16, k: 8, g: 0.2, ang: 30 }] },
  capslam:    { dur: 44, lunge: 3, hb: [{ a: 16, b: 21, x: 42, y: -36, r: 34, d: 17, k: 8, g: 0.2, ang: 40 }] },
  energypalm: { dur: 46, fx: 'burst', hb: [{ a: 17, b: 22, x: 54, y: -34, r: 34, d: 15, k: 8, g: 0.2, ang: 36 }] },
  headbonk:   { dur: 44, lunge: 5, hb: [{ a: 16, b: 21, x: 44, y: -42, r: 32, d: 16, k: 8, g: 0.2, ang: 38 }] },
  // up smashes
  rising:     { dur: 42, hb: [{ a: 13, b: 19, x: 4, y: -78, r: 36, d: 15, k: 8, g: 0.2, ang: 88 }] },
  skyslash:   { dur: 44, hb: [{ a: 13, b: 20, x: 0, y: -84, r: 40, d: 16, k: 8, g: 0.2, ang: 88 }] },
  geyser:     { dur: 46, fx: 'ring', hb: [{ a: 14, b: 22, x: 0, y: -90, r: 34, d: 14, k: 8, g: 0.19, ang: 90 }] },
  capbounce:  { dur: 42, hb: [{ a: 12, b: 18, x: 0, y: -80, r: 40, d: 15, k: 8, g: 0.2, ang: 88 }] },
  tailflip:   { dur: 42, fx: 'spin', hb: [{ a: 12, b: 18, x: 0, y: -76, r: 38, d: 15, k: 8, g: 0.2, ang: 86 }] },
  // down smashes
  splitkick:  { dur: 40, fx: 'kick', hb: [{ a: 12, b: 17, x: 38, y: -10, r: 28, d: 13, k: 7, g: 0.18, ang: 30 }, { a: 12, b: 17, x: -38, y: -10, r: 28, d: 13, k: 7, g: 0.18, ang: 150 }] },
  spinsweep:  { dur: 42, fx: 'spin', hb: [{ a: 12, b: 21, x: 0, y: -14, r: 50, d: 3, k: 2, g: 0, ang: 60, every: 5 }, { a: 22, b: 24, x: 0, y: -14, r: 54, d: 8, k: 8, g: 0.17, ang: 35, sep: 1 }] },
  groundslam: { dur: 44, fx: 'ring', hb: [{ a: 14, b: 18, x: 0, y: -6, r: 62, d: 13, k: 7, g: 0.18, ang: 40 }] },
  tailspin:   { dur: 40, fx: 'spin', hb: [{ a: 12, b: 17, x: 36, y: -12, r: 30, d: 13, k: 7, g: 0.18, ang: 32 }, { a: 12, b: 17, x: -36, y: -12, r: 30, d: 13, k: 7, g: 0.18, ang: 148 }] },
  // aerials
  spin:       { dur: 28, fx: 'spin', hb: [{ a: 5, b: 15, x: 0, y: -30, r: 38, d: 9, k: 4, g: 0.1, ang: 45 }] },
  sexkick:    { dur: 30, fx: 'kick', hb: [{ a: 4, b: 8, x: 24, y: -28, r: 28, d: 10, k: 5, g: 0.11, ang: 40 }, { a: 9, b: 20, x: 24, y: -28, r: 26, d: 6, k: 4, g: 0.07, ang: 40 }] },
  aura:       { dur: 30, fx: 'ring', hb: [{ a: 6, b: 14, x: 0, y: -30, r: 44, d: 8, k: 5, g: 0.1, ang: 50 }] },
  flutterkick:{ dur: 34, fx: 'kick', hb: [{ a: 5, b: 22, x: 14, y: -10, r: 28, d: 1.5, k: 1, g: 0, ang: 70, every: 4 }, { a: 24, b: 26, x: 14, y: -12, r: 30, d: 4, k: 6, g: 0.08, ang: 45, sep: 1 }] },
  axe:        { dur: 30, hb: [{ a: 9, b: 13, x: 38, y: -30, r: 28, d: 12, k: 5, g: 0.14, ang: 40 }] },
  meteoraxe:  { dur: 34, hb: [{ a: 10, b: 13, x: 34, y: -24, r: 28, d: 12, k: 5, g: 0.12, ang: -60 }] },
  drill:      { dur: 34, fx: 'spin', hb: [{ a: 6, b: 22, x: 30, y: -26, r: 26, d: 1.6, k: 1, g: 0, ang: 30, every: 4 }, { a: 24, b: 26, x: 32, y: -26, r: 28, d: 4, k: 6, g: 0.09, ang: 40, sep: 1 }] },
  airslash:   { dur: 30, hb: [{ a: 9, b: 13, x: 42, y: -30, r: 30, d: 12, k: 5, g: 0.14, ang: 40 }] },
  headbonkair:{ dur: 30, hb: [{ a: 8, b: 12, x: 36, y: -40, r: 28, d: 12, k: 5, g: 0.13, ang: 40 }] },
  backkick:   { dur: 28, fx: 'kick', hb: [{ a: 7, b: 11, x: -36, y: -30, r: 26, d: 12, k: 6, g: 0.15, ang: 145 }] },
  tailbair:   { dur: 28, fx: 'spin', hb: [{ a: 6, b: 11, x: -38, y: -24, r: 30, d: 12, k: 6, g: 0.14, ang: 145 }] },
  backslash:  { dur: 30, hb: [{ a: 8, b: 12, x: -42, y: -30, r: 30, d: 12, k: 6, g: 0.15, ang: 145 }] },
  flipkick:   { dur: 24, fx: 'spin', hb: [{ a: 5, b: 10, x: 4, y: -70, r: 30, d: 8, k: 5, g: 0.12, ang: 85 }] },
  scissor:    { dur: 30, fx: 'kick', hb: [{ a: 5, b: 8, x: 4, y: -66, r: 28, d: 4, k: 3, g: 0.03, ang: 85 }, { a: 12, b: 15, x: 4, y: -68, r: 30, d: 7, k: 6, g: 0.11, ang: 85, sep: 1 }] },
  upslashair: { dur: 26, hb: [{ a: 5, b: 11, x: 0, y: -74, r: 34, d: 9, k: 5, g: 0.12, ang: 85 }] },
  headbuttup: { dur: 24, hb: [{ a: 5, b: 10, x: 2, y: -72, r: 30, d: 9, k: 5, g: 0.12, ang: 88 }] },
  stomp:      { dur: 34, fx: 'stomp', hb: [{ a: 10, b: 15, x: 0, y: 4, r: 26, d: 12, k: 4, g: 0.12, ang: -80 }] },
  drilldown:  { dur: 36, fx: 'stomp', hb: [{ a: 8, b: 24, x: 0, y: 2, r: 26, d: 1.6, k: 1, g: 0, ang: -70, every: 4 }, { a: 26, b: 28, x: 0, y: 0, r: 30, d: 4, k: 6, g: 0.08, ang: 60, sep: 1 }] },
  plunge:     { dur: 36, fx: 'stomp', hb: [{ a: 10, b: 16, x: 4, y: 8, r: 24, d: 13, k: 4, g: 0.12, ang: -85 }] },
  // ---- the Yoshi clan's own moves (v1.9): each Yoshi mixes these into its set ----
  eggshell:   { dur: 46, lunge: 3, fx: 'burst', hb: [{ a: 16, b: 21, x: 46, y: -36, r: 34, d: 16, k: 8, g: 0.2, ang: 38 }] },
  // `drop` throws a projectile at frame `at` (an egg, a Bob-omb)
  eggdrop:    { dur: 30, drop: { at: 8, p: { k: 'egg', vy: 3, grav: 0.5, d: 6, kb: 5, gr: 0.08, ang: -60, r: 14, life: 90 } }, fx: 'stomp', hb: [{ a: 4, b: 8, x: 0, y: 2, r: 22, d: 4, k: 3, g: 0.04, ang: -70 }] },
  firebreath: { dur: 32, fx: 'breath', hb: [{ a: 7, b: 18, x: 46, y: -40, r: 26, d: 2.2, k: 1.5, g: 0, ang: 40, every: 4 }, { a: 20, b: 22, x: 52, y: -40, r: 30, d: 5, k: 7, g: 0.1, ang: 38, sep: 1 }] },
  wingslap:   { dur: 28, hb: [{ a: 7, b: 11, x: 38, y: -34, r: 32, d: 10, k: 7, g: 0.12, ang: 40 }] },
  bootstomp:  { dur: 26, fx: 'stomp', hb: [{ a: 7, b: 10, x: 30, y: -6, r: 30, d: 8, k: 5, g: 0.1, ang: 75 }] },
  bootkick:   { dur: 48, lunge: 4, fx: 'kick', hb: [{ a: 17, b: 22, x: 42, y: -20, r: 34, d: 18, k: 8, g: 0.21, ang: 36 }] },
  heartslap:  { dur: 13, hb: [{ a: 3, b: 5, x: 28, y: -34, r: 21, d: 3, k: 3, g: 0.02, ang: 45 }] },
  cartkick:   { dur: 30, lunge: 4, fx: 'spin', hb: [{ a: 8, b: 13, x: 34, y: -30, r: 30, d: 10, k: 7, g: 0.12, ang: 42 }] },
  skatekick:  { dur: 30, lunge: 8, fx: 'kick', hb: [{ a: 8, b: 14, x: 36, y: -14, r: 26, d: 9, k: 6, g: 0.11, ang: 28 }] },
  airkick:    { dur: 24, fx: 'kick', hb: [{ a: 4, b: 9, x: 32, y: -26, r: 26, d: 9, k: 6, g: 0.12, ang: 40 }] },
  tonguewhip: { dur: 46, fx: 'tongue', hb: [{ a: 16, b: 22, x: 96, y: -40, r: 24, d: 15, k: 8, g: 0.2, ang: 35 }] },
  clawswipe:  { dur: 26, hb: [{ a: 6, b: 9, x: 36, y: -34, r: 28, d: 7, k: 7, g: 0.09, ang: 40 }] },
  bigbite:    { dur: 30, lunge: 3, fx: 'chomp', hb: [{ a: 8, b: 11, x: 36, y: -40, r: 30, d: 8, k: 7, g: 0.1, ang: 40 }] },
  gulp:       { dur: 44, lunge: 5, fx: 'chomp', hb: [{ a: 15, b: 20, x: 44, y: -40, r: 34, d: 16, k: 8, g: 0.2, ang: 38 }] },
  bellyflop:  { dur: 34, fx: 'stomp', hb: [{ a: 8, b: 16, x: 0, y: 0, r: 34, d: 11, k: 6, g: 0.12, ang: -70 }] },
  tantrumsmash: { dur: 44, fx: 'flurry', hb: [{ a: 14, b: 26, x: 26, y: -26, r: 30, d: 2.5, k: 2, g: 0.01, ang: 60, every: 4 }, { a: 28, b: 30, x: 30, y: -26, r: 34, d: 7, k: 8, g: 0.17, ang: 40, sep: 1 }] },
  // Dash Yoshi: kicks so fast they blur
  rapidkick:  { dur: 30, fx: 'kick', hb: [{ a: 3, b: 16, x: 30, y: -24, r: 24, d: 1.4, k: 1, g: 0, ang: 60, every: 3 }, { a: 18, b: 20, x: 34, y: -26, r: 28, d: 4, k: 6, g: 0.09, ang: 40, sep: 1 }] },
  blitzkick:  { dur: 26, lunge: 9, fx: 'kick', hb: [{ a: 5, b: 10, x: 38, y: -22, r: 26, d: 10, k: 7, g: 0.12, ang: 35 }] },
  jetkick:    { dur: 38, lunge: 12, fx: 'kick', hb: [{ a: 12, b: 17, x: 42, y: -24, r: 30, d: 16, k: 8, g: 0.2, ang: 34 }] },
  cyclone:    { dur: 40, fx: 'spin', hb: [{ a: 8, b: 20, x: 0, y: -40, r: 40, d: 2, k: 2, g: 0.01, ang: 88, every: 4 }, { a: 22, b: 24, x: 0, y: -60, r: 44, d: 6, k: 8, g: 0.17, ang: 88, sep: 1 }] },
  // Hasidic Toad: `dig` burrows forward underground (can't be hit) and pops up under foes; `rise` blasts the user upward (on a burst of Hanukkah gelt)
  burrow:     { dur: 52, dig: { a: 8, b: 34, speed: 6.5 }, fx: 'stomp', hb: [{ a: 36, b: 41, x: 0, y: -24, r: 46, d: 15, k: 8, g: 0.19, ang: 85 }] },
  gelt:       { dur: 46, rise: { at: 13, vy: 15 }, fx: 'ring', hb: [{ a: 13, b: 22, x: 0, y: -60, r: 40, d: 14, k: 8, g: 0.19, ang: 88 }, { a: 13, b: 18, x: 0, y: 10, r: 36, d: 6, k: 6, g: 0.1, ang: 80, sep: 1 }] },
  bombdrop:   { dur: 32, drop: { at: 9, p: { k: 'dbomb', vy: 4, grav: 0.55, d: 4, kb: 4, gr: 0.05, ang: -70, r: 14, life: 90, explode: { r: 56, d: 10, k: 7, g: 0.12 } } }, fx: 'stomp', hb: [] },
  // the same for everyone
  pick:       { dur: 24, fx: 'pick', hb: [{ a: 7, b: 11, x: 44, y: -40, r: 34, d: 11, k: 6, g: 0.13, ang: 55 }] },
  getup:      { dur: 24, hb: [{ a: 6, b: 12, x: 30, y: -24, r: 32, d: 7, k: 6, g: 0.05, ang: 30 }] },
  throw:      { dur: 14, hb: [] },
  // Emilia Toad's Attack: she throws out her hands and nine homing ice pellets fly (on frame `volley`)
  icevolley:  { dur: 18, volley: 6, hb: [] },
};
const SLOTS = ['jab', 'jab2', 'jab3', 'side', 'up', 'down', 'fsmash', 'usmash', 'dsmash', 'nair', 'fair', 'bair', 'uair', 'dair'];
// base movesets; each fighter swaps in a few signature moves (FIGHT below)
const MOVESETS = {
  toad:  { jab: 'punch', jab2: 'punch2', jab3: 'kick3', side: 'shove', up: 'headbutt', down: 'sweep', fsmash: 'capslam', usmash: 'capbounce', dsmash: 'splitkick',
    nair: 'spin', fair: 'axe', bair: 'backkick', uair: 'headbuttup', dair: 'stomp' },
  blade: { jab: 'slash1', jab2: 'slash2', jab3: 'slash3', side: 'swing', up: 'upslash', down: 'lowpoke', fsmash: 'bigslash', usmash: 'skyslash', dsmash: 'spinsweep',
    nair: 'spin', fair: 'airslash', bair: 'backslash', uair: 'upslashair', dair: 'plunge' },
  mage:  { jab: 'chop', jab2: 'punch2', jab3: 'palm3', side: 'zapside', up: 'antiair', down: 'crouchjab', fsmash: 'energypalm', usmash: 'geyser', dsmash: 'groundslam',
    nair: 'aura', fair: 'axe', bair: 'backkick', uair: 'scissor', dair: 'stomp' },
  yoshi: { jab: 'bite', jab2: 'tailjab', jab3: 'headbutt3', side: 'tongue', up: 'tongueup', down: 'tailsweep', fsmash: 'headbonk', usmash: 'tailflip', dsmash: 'tailspin',
    nair: 'flutterkick', fair: 'headbonkair', bair: 'tailbair', uair: 'flipkick', dair: 'drilldown' },
};
// How each fighter fights: base moveset, signature swaps, an element that colours (and flavours) every hit,
// and how they stand around and run (gait).
const FIGHT = {
  toad:        { style: 'toad', elem: 'spore', idle: 'fight' },
  toadette:    { style: 'toad', elem: 'heart', idle: 'cheer', moves: { jab3: 'flurry', side: 'roundhouse', usmash: 'rising', fair: 'drill' } },
  captain:     { style: 'toad', elem: 'gold', gait: 'heavy', moves: { jab3: 'palm3', fsmash: 'haymaker', dsmash: 'groundslam', uair: 'flipkick' } },
  toadsworth:  { style: 'blade', elem: 'none', idle: 'elder', gait: 'heavy', moves: { side: 'thrust', fsmash: 'lungethrust' } },
  blue:        { style: 'toad', elem: 'ice', idle: 'fight', moves: { side: 'dropkick', usmash: 'geyser', dsmash: 'spinsweep', dair: 'drilldown' } },
  yellow:      { style: 'toad', elem: 'fire', idle: 'fight', moves: { jab3: 'uppercut3', side: 'roundhouse', fsmash: 'haymaker', usmash: 'geyser', fair: 'meteoraxe' } },
  green:       { style: 'toad', elem: 'leaf', moves: { side: 'roundhouse', up: 'flipup', nair: 'sexkick', bair: 'tailbair' } },
  purple:      { style: 'toad', elem: 'poison', idle: 'cheer', moves: { jab3: 'flurry', up: 'antiair', fsmash: 'haymaker', nair: 'sexkick', dair: 'drilldown' } },
  pirate:      { style: 'blade', elem: 'water', idle: 'proud' },
  ninja:       { style: 'toad', elem: 'shadow', idle: 'ninja', gait: 'ninja', moves: { jab: 'chop', jab2: 'chop', jab3: 'flurry', side: 'dropkick', up: 'flipup', down: 'crouchjab',
    fsmash: 'haymaker', usmash: 'rising', dsmash: 'spinsweep', nair: 'sexkick', fair: 'drill', uair: 'scissor' } },
  knight:      { style: 'blade', elem: 'steel', idle: 'blade', gait: 'heavy', moves: { side: 'thrust' } },
  chef:        { style: 'blade', elem: 'heat', idle: 'proud', moves: { down: 'sweep', dsmash: 'groundslam' } },
  wizard:      { style: 'mage', elem: 'magic', idle: 'mage' },
  astro:       { style: 'mage', elem: 'cosmic', moves: { jab: 'punch', fair: 'drill' } },
  doctor:      { style: 'toad', elem: 'electric', moves: { jab3: 'palm3', side: 'zapside', up: 'antiair', fsmash: 'energypalm' } },
  rocker:      { style: 'blade', elem: 'music', idle: 'groove', moves: { usmash: 'geyser', dsmash: 'groundslam', nair: 'aura' } },
  cowboy:      { style: 'toad', elem: 'dust', idle: 'proud', moves: { side: 'roundhouse', up: 'flipup', fsmash: 'haymaker', nair: 'sexkick' } },
  ghost:       { style: 'mage', elem: 'spirit', idle: 'float', gait: 'float', moves: { jab: 'punch', side: 'shove', fair: 'drill', dair: 'drilldown' } },
  robo:        { style: 'toad', elem: 'spark', idle: 'robot', gait: 'heavy', moves: { jab3: 'flurry', side: 'thrust', up: 'antiair', fsmash: 'haymaker', usmash: 'rising', dsmash: 'groundslam', fair: 'drill' } },
  // every Yoshi fights its own way (v1.9): the classic egg-layer, a fire-breather, a winged kicker, a heavy stomper...
  yoshi:       { style: 'yoshi', elem: 'egg', moves: { fsmash: 'eggshell', dair: 'eggdrop' } },
  redyoshi:    { style: 'yoshi', elem: 'fire', moves: { jab3: 'uppercut3', side: 'firebreath', up: 'flipup', usmash: 'geyser', dsmash: 'groundslam', nair: 'spin', fair: 'meteoraxe', dair: 'stomp' } },
  blueyoshi:   { style: 'yoshi', elem: 'wind', moves: { jab: 'tailjab', jab3: 'kick3', side: 'wingslap', up: 'flipup', fsmash: 'energypalm', nair: 'spin', fair: 'drill', bair: 'backkick', uair: 'scissor' } },
  yellowyoshi: { style: 'yoshi', elem: 'rock', gait: 'heavy', moves: { jab3: 'kick3', side: 'shove', down: 'bootstomp', fsmash: 'bootkick', usmash: 'rising', dsmash: 'groundslam', nair: 'sexkick', fair: 'meteoraxe', dair: 'stomp' } },
  pinkyoshi:   { style: 'yoshi', elem: 'heart', idle: 'cheer', moves: { jab: 'heartslap', jab2: 'heartslap', jab3: 'flurry', side: 'cartkick', up: 'flipup', nair: 'sexkick', uair: 'flipkick' } },
  iceyoshi:    { style: 'yoshi', elem: 'ice', moves: { jab3: 'kick3', side: 'skatekick', down: 'sweep', usmash: 'geyser', dsmash: 'splitkick', nair: 'spin', fair: 'airkick', dair: 'stomp' } },
  purpleyoshi: { style: 'yoshi', elem: 'poison', moves: { jab3: 'flurry', fsmash: 'tonguewhip', usmash: 'geyser', nair: 'aura', bair: 'backkick' } },
  blackyoshi:  { style: 'yoshi', elem: 'shadow', moves: { jab3: 'clawswipe', side: 'shove', fsmash: 'haymaker', usmash: 'rising', dsmash: 'groundslam', nair: 'sexkick', fair: 'meteoraxe', bair: 'backkick', dair: 'stomp' } },
  whiteyoshi:  { style: 'yoshi', elem: 'light', moves: { jab3: 'palm3', side: 'zapside', up: 'antiair', fsmash: 'energypalm', usmash: 'geyser', dsmash: 'splitkick', nair: 'aura', fair: 'drill', uair: 'scissor' } },
  orangeyoshi: { style: 'yoshi', elem: 'fruit', moves: { jab2: 'bite', jab3: 'bigbite', fsmash: 'gulp', nair: 'flutterkick', fair: 'drill', dair: 'bellyflop' } },
  babyyoshi:   { style: 'yoshi', elem: 'none', idle: 'cheer', moves: { jab3: 'flurry', side: 'tailwhip', up: 'headbutt', fsmash: 'tantrumsmash', usmash: 'capbounce', dsmash: 'spinsweep', nair: 'spin', dair: 'stomp' } },
  cowtoad:     { style: 'toad', elem: 'milk', moves: { jab3: 'kick3', side: 'shove', dsmash: 'splitkick', dair: 'stomp' } },
  samurai:     { style: 'blade', elem: 'sakura', idle: 'blade', moves: { side: 'thrust', fsmash: 'bigslash', dsmash: 'spinsweep' } },
  viking:      { style: 'blade', elem: 'storm', idle: 'blade', gait: 'heavy', moves: { jab3: 'slash3', fsmash: 'capslam', dsmash: 'groundslam', dair: 'stomp' } },
  pharaoh:     { style: 'mage', elem: 'sand', idle: 'proud', moves: { side: 'thrust', fsmash: 'lungethrust', up: 'upslash' } },
  gladiator:   { style: 'blade', elem: 'bronze', idle: 'proud', moves: { side: 'thrust', down: 'lowpoke', fsmash: 'lungethrust', nair: 'spin' } },
  buddhist:    { style: 'toad', elem: 'chi', idle: 'fight', moves: { jab: 'chop', jab3: 'palm3', side: 'roundhouse', up: 'flipup', fsmash: 'energypalm', usmash: 'rising', dsmash: 'spinsweep', nair: 'sexkick', uair: 'scissor' } },
  muslim:      { style: 'toad', elem: 'lantern', idle: 'cheer', moves: { side: 'roundhouse', usmash: 'geyser', nair: 'aura' } },
  mormon:      { style: 'toad', elem: 'hymn', idle: 'cheer', moves: { jab3: 'palm3', side: 'dropkick', usmash: 'geyser' } },
  hasidic:     { style: 'toad', elem: 'joy', idle: 'groove', moves: { jab3: 'kick3', side: 'roundhouse', up: 'flipup', usmash: 'gelt', dsmash: 'burrow', nair: 'sexkick', dair: 'bombdrop' } },
  catholic:    { style: 'toad', elem: 'fiesta', idle: 'cheer', moves: { jab3: 'palm3', side: 'shove', usmash: 'geyser', nair: 'aura' } },
  hindu:       { style: 'toad', elem: 'holi', idle: 'groove', moves: { jab3: 'flurry', side: 'roundhouse', usmash: 'geyser', nair: 'spin', fair: 'drill' } },
  subaru:      { style: 'toad', elem: 'yin', moves: { jab3: 'kick3', fsmash: 'energypalm', usmash: 'geyser', dsmash: 'groundslam', nair: 'aura' } },
  emilia:      { style: 'toad', elem: 'ice', idle: 'grace' },
  // Dash Yoshi: all speed. Blurring kicks, and every attack plays out a quarter faster (aspd)
  dashyoshi:   { style: 'yoshi', elem: 'speed', gait: 'ninja', aspd: 1.25, moves: { jab3: 'rapidkick', side: 'blitzkick', up: 'flipup', fsmash: 'jetkick', usmash: 'cyclone', dsmash: 'spinsweep', nair: 'spin', fair: 'airkick', bair: 'backkick', dair: 'stomp' } },
  mechyoshi:   { style: 'yoshi', elem: 'plasma', idle: 'robot', gait: 'heavy', moves: { jab: 'punch', jab2: 'punch2', jab3: 'flurry', side: 'zapside', up: 'antiair', fsmash: 'haymaker', usmash: 'geyser', dsmash: 'groundslam', nair: 'aura', fair: 'drill', bair: 'backkick', uair: 'scissor', dair: 'stomp' } },
};
for (const c of CHARS) Object.assign(c, { style: c.yoshi ? 'yoshi' : 'toad', elem: 'none', idle: c.yoshi ? 'dino' : 'calm', gait: c.yoshi ? 'dino' : 'normal' }, FIGHT[c.id] || {});
// what an element does to normal attacks (the rest only change the look of the hits)
const ELEM = {
  fire: { kb: 1.1 }, ice: { frz: 1 }, poison: { psn: 1 }, electric: { stun: 6 }, wind: { kb: 1.06, flat: 10 },
  rock: { kb: 1.12, smashOnly: 1 }, music: { reach: 1.12 }, shadow: { dmg: 1 }, light: { dmg: 1 }, steel: { dmg: 0.5, kb: 1.04 },
};
// hit colours per element: [main, accent]
const ELEM_COL = {
  fire: ['#ff8a1f', '#ffd23a'], ice: ['#bff0ff', '#7fd3ff'], poison: ['#c07ae8', '#7a2aa8'], electric: ['#fff36a', '#ffffff'],
  cosmic: ['#7dfcff', '#d8b0ff'], heart: ['#ff8cc6', '#ff5aa8'], leaf: ['#8fdc6a', '#3fae3a'], spore: ['#ff6a5a', '#fbf8f1'],
  water: ['#8fd0ff', '#ffffff'], shadow: ['#8a7ad8', '#2b2440'], steel: ['#e6eef8', '#ffd23a'], heat: ['#ffb347', '#ffffff'],
  magic: ['#e2c8ff', '#ffe066'], music: ['#ff7088', '#ffe066'], dust: ['#e6d2a8', '#c8a060'], spirit: ['#cfe0ff', '#ffffff'],
  spark: ['#ffb02e', '#fff6a0'], wind: ['#eaf6ff', '#bfe6ff'], rock: ['#c0a882', '#8a7a60'], light: ['#fff6c8', '#ffffff'],
  fruit: ['#ff5a5a', '#5fd04a'], gold: ['#ffd23a', '#fff6a0'], egg: ['#ffffff', '#5fd04a'], milk: ['#ffffff', '#f2e6c8'],
  sakura: ['#ffc0d8', '#ffffff'], storm: ['#bfe0ff', '#fff36a'], sand: ['#f0d290', '#ffd23a'], bronze: ['#e0a050', '#fff0c8'],
  chi: ['#ffe28a', '#ffffff'], lantern: ['#ffcf5a', '#fff6c8'], hymn: ['#9fc8ff', '#ffffff'], joy: ['#ffe066', '#7dbbff'],
  yin: ['#b07dff', '#ff9cd0'], speed: ['#ff8a1f', '#ffe066'], plasma: ['#7dff9a', '#d8fff0'],
  fiesta: ['#ff4fa0', '#ffd23a'], holi: ['#ff4fa0', '#3fbf4a'],
};
const ATK = {};
for (const c of CHARS) {
  const ms = Object.assign({}, MOVESETS[c.style] || MOVESETS.toad, c.moves || {}), E = ELEM[c.elem] || {};
  ATK[c.id] = {};
  for (const slot of [...SLOTS, 'pick', 'getup', 'throw']) {
    const tpl = ms[slot] || slot, a = JSON.parse(JSON.stringify(MOVE_T[tpl]));
    const smash = slot === 'fsmash' || slot === 'usmash' || slot === 'dsmash';
    a.tpl = tpl; a.fx = a.fx || 'arc'; if (smash) a.smash = 1;
    for (const h of a.hb) {
      h.x *= c.reach; h.r *= 1 + (c.reach - 1) * 0.5;
      if (E.reach) h.r *= E.reach;
      if (E.kb && (!E.smashOnly || smash)) h.k *= E.kb;
      if (E.flat && h.ang > 0 && h.ang < 80) h.ang = Math.max(5, h.ang - E.flat);
      if (E.dmg) h.d += E.dmg * (h.every ? 0.25 : 1);
      if (E.frz && smash && !h.every) h.frz = 1;
      if (E.psn && (smash || slot === 'jab3') && !h.every) h.psn = 1;
      if (E.stun) h.stun = E.stun;
    }
    ATK[c.id][slot] = a;
  }
  // a fighter whose Attack button fires a volley (Emilia Toad) uses this one move for every attack
  if (c.volley) ATK[c.id].volley = Object.assign(JSON.parse(JSON.stringify(MOVE_T.icevolley)), { tpl: 'icevolley', fx: 'none' });
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
  // ---- v1.9 stages ----
  { id: 'island', name: "Yoshi's Island", haz: ['rock'], hazName: 'A giant boulder rolls across the island now and then: jump over it!',
    solids: [{ x: -520, y: 0, w: 1040, h: 150 }],
    plats: [{ x: -400, y: -140, w: 180 }, { x: 220, y: -140, w: 180 }, { x: -90, y: -270, w: 180, move: { ax: 0, ay: 50, per: 300, ph: 0 } }],
    spawn: [[-320, -1], [320, -1], [-110, -1], [110, -1]] },
  { id: 'rainbow', name: 'Rainbow Road', haz: ['boost'], hazName: 'A road through space: dash panels and drifting rainbow platforms',
    solids: [{ x: -380, y: 0, w: 760, h: 36 }],
    plats: [{ x: -600, y: -110, w: 170, move: { ax: 0, ay: 70, per: 400, ph: 0 } }, { x: 430, y: -110, w: 170, move: { ax: 0, ay: 70, per: 400, ph: Math.PI } },
      { x: -100, y: -250, w: 200, move: { ax: 170, ay: 0, per: 520, ph: 0 } }],
    boost: [{ x: -330, w: 90, dir: 1 }, { x: 240, w: 90, dir: -1 }],
    spawn: [[-280, -1], [280, -1], [-90, -1], [90, -1]] },
  { id: 'mansion', name: 'Boo Mansion', haz: ['dark'], hazName: 'The lights go out and Boos swoop through the dark',
    solids: [{ x: -460, y: 0, w: 920, h: 170 }],
    plats: [{ x: -360, y: -150, w: 180 }, { x: 180, y: -150, w: 180 }, { x: -100, y: -285, w: 200, move: { ax: 90, ay: 0, per: 420, ph: 0 } }],
    spawn: [[-300, -1], [300, -1], [-100, -1], [100, -1]] },
  { id: 'castle', name: "Bowser's Castle", haz: ['lava'], hazName: 'The lava rises over the floor: get up on the platforms!',
    solids: [{ x: -480, y: 0, w: 960, h: 210 }],
    plats: [{ x: -380, y: -150, w: 190 }, { x: 190, y: -150, w: 190 }, { x: -95, y: -290, w: 190 }],
    spawn: [[-300, -1], [300, -1], [-110, -1], [110, -1]] },
];
// the stage theme each newer stage plays when the music is set to "Stage theme"
const STAGE_SONG = { island: 'hop', rainbow: 'turbo', mansion: 'jazz', castle: 'funk' };

const ITEMS = {
  mush: { name: 'Super Mushroom!', w: 3 }, mini: { name: 'Mini Mushroom!', w: 2 }, poison: { name: 'Poison Mushroom!', w: 2 },
  oneup: { name: '1-UP!', w: 1 }, gold: { name: 'Golden Mushroom!', w: 2 }, star: { name: 'Super Star!', w: 1 }, turnip: { name: 'Turnip!', w: 4 },
};
