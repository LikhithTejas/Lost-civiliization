/* LOST CIVILIZATION — Secrets Beneath the Ruins
   Systems: Save, World, Player, Interaction, Artifact, Puzzle, Quest, Journal, Map, DayNight, Weather, Audio, Camera */
const THREE = AFRAME.THREE;
const $ = id => document.getElementById(id);
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); // seeded random: same world every time
const P = (x, y, z) => `${x} ${y} ${z}`;
const QUALITY = localStorage.getItem('lc_q') || 'MEDIUM';
const REDUCED = localStorage.getItem('lc_fx') === '1';
const GLYPHS = ['☉', '△', '♛', '≈'];
const MEANING = { '☉': 'SUN', '△': 'MOUNTAIN', '♛': 'KING', '≈': 'WATER' };
const TARGET = ['△', '♛', '☉'];

/* ---------- SaveSystem ---------- */
const DEFAULT = () => ({ art: [], ins: [], puz: false, sym: [3, 3, 3], visited: {}, journal: [], temple: false, chamber: false, machine: false, done: false });
let S = DEFAULT();
try { S = Object.assign(DEFAULT(), JSON.parse(localStorage.getItem('lc_save') || '{}')); } catch (e) { S = DEFAULT(); }
const save = () => { try { localStorage.setItem('lc_save', JSON.stringify(S)); } catch (e) {} };

/* ---------- Helpers ---------- */
const world = $('world');
function E(tag, attrs, parent) { // create an A-Frame entity
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  (parent || world).appendChild(e);
  return e;
}
function stoneTex(base, speck) { // procedural texture fallback: never needs an external file
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${speck},${rnd() * .25})`; g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 4, 1 + rnd() * 4); }
  g.strokeStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  return c.toDataURL();
}
const TEX_STONE = stoneTex('#a58f68', '60,45,25'), TEX_GROUND = stoneTex('#7a6742', '40,30,15'), TEX_DARK = stoneTex('#5b4d38', '20,15,10');

/* ---------- Collision data ---------- */
const circles = [], boxes = []; // circles: [x,z,r]; boxes: [x,z,halfW,halfD]
const solid = (x, z, r) => circles.push([x, z, r]);
const wall = (x, z, hw, hd) => boxes.push([x, z, hw, hd]);

/* ---------- World builder ---------- */
function pillar(x, z, h, broken) {
  const hh = broken ? h * (0.3 + rnd() * .4) : h;
  const p = E('a-cylinder', { position: P(x, hh / 2, z), radius: .6, height: hh, src: TEX_STONE, repeat: '1 3', roughness: 1, rotation: P(0, 0, broken ? (rnd() - .5) * 8 : 0), shadow: 'cast:true' });
  E('a-box', { position: P(x, hh + .1, z), width: 1.5, height: .25, depth: 1.5, src: TEX_STONE, color: '#c9b890' });
  if (rnd() > .5) E('a-cylinder', { position: P(x, hh / 2 - .3, z), radius: .65, height: hh * .6, color: '#4c6b30', opacity: .55, roughness: 1 }); // moss/vines
  solid(x, z, .8);
}
function block(x, y, z, w, h, d, tex) { E('a-box', { position: P(x, y, z), width: w, height: h, depth: d, src: tex || TEX_STONE, repeat: `${Math.ceil(w / 3)} ${Math.ceil(h / 3)}`, roughness: 1, shadow: 'cast:true;receive:true' }); }
function torch(x, y, z) {
  E('a-cylinder', { position: P(x, y, z), radius: .06, height: 1, color: '#3a2512' });
  const f = E('a-sphere', { position: P(x, y + .6, z), radius: .14, color: '#ff8a1e', material: 'shader:flat;color:#ff9a30' });
  f.setAttribute('animation', 'property:scale;dir:alternate;dur:180;loop:true;from:0.8 1 0.8;to:1.2 1.5 1.2');
  E('a-light', { type: 'point', color: '#ff8a2a', intensity: 1.1, distance: 14, decay: 2, position: P(x, y + .8, z) });
}
function statue(x, z, s) {
  const g = E('a-entity', { position: P(x, 0, z), scale: P(s, s, s) });
  E('a-box', { position: '0 .5 0', width: 4, height: 1, depth: 4, src: TEX_STONE }, g);
  E('a-box', { position: '0 1.5 0', width: 3, height: 1, depth: 3, src: TEX_STONE }, g);
  E('a-cylinder', { position: '0 4 0', radius: .8, height: 4, src: TEX_STONE, roughness: 1 }, g);
  E('a-sphere', { position: '0 6.4 0', radius: .75, src: TEX_STONE }, g);
  E('a-box', { position: '0 5 0', width: 3.6, height: .5, depth: .6, src: TEX_STONE }, g);
  E('a-cone', { position: '0 7.6 0', radius_bottom: .8, radius_top: .2, height: 1.2, color: '#c9a24a', metalness: .6 }, g);
  solid(x, z, 2.2 * s);
}
function house(x, z, w, d, ruined) {
  const h = 3 + rnd() * 1.5;
  block(x, h / 2, z - d / 2, w, ruined ? h * .5 : h, .5, TEX_STONE);
  block(x - w / 2, h / 2, z, .5, ruined ? h * .7 : h, d, TEX_STONE);
  block(x + w / 2, h / 2, z, .5, h * (ruined ? .4 : 1), d, TEX_STONE);
  block(x - w / 4, h / 2, z + d / 2, w / 2 - 1, h * .8, .5, TEX_STONE); // front wall with doorway
  if (!ruined) block(x, h + .2, z, w + .6, .4, d + .6, TEX_DARK);
  wall(x, z - d / 2, w / 2, .5); wall(x - w / 2, z, .5, d / 2); wall(x + w / 2, z, .5, d / 2); wall(x - w / 4, z + d / 2, w / 4, .5);
  E('a-box', { position: P(x + w / 4, .3, z - d / 3), width: 1.6, height: .5, depth: .9, color: '#5a3d22' }); // bed
  E('a-cylinder', { position: P(x - w / 4, .35, z - d / 3), radius: .3, height: .7, color: '#a0522d' }); // pottery
}
function tree(x, z) {
  const h = 3 + rnd() * 3;
  E('a-cylinder', { position: P(x, h / 2, z), radius: .22, height: h, color: '#4a3220' });
  E('a-sphere', { position: P(x, h + 1, z), radius: 1.6 + rnd(), color: rnd() > .5 ? '#2f5a2a' : '#3d6b2a', roughness: 1 });
  solid(x, z, .5);
}
const items = []; // interactables
function interactable(x, y, z, r, label, fn, el) { const it = { x, y, z, r, label, fn, el, on: true }; items.push(it); return it; }
function glyphTablet(x, z, g, ry, name, fn) {
  const t = E('a-box', { position: P(x, 1.2, z), width: 1.2, height: 1.6, depth: .25, src: TEX_DARK, rotation: P(0, ry, 0) });
  E('a-text', { value: g, align: 'center', width: 9, color: '#5fe0d6', position: '0 0 .14', shader: 'msdf' }, t);
  E('a-light', { type: 'point', color: '#5fe0d6', intensity: .5, distance: 5, position: P(x, 1.8, z) });
  interactable(x, 1.2, z, 3.2, '[E] EXAMINE TABLET', fn, t);
}

function buildWorld(onStep) {
  const steps = [];
  const step = f => steps.push(f);
  step(() => { // ground, mountains
    E('a-plane', { rotation: '-90 0 0', width: 400, height: 400, src: TEX_GROUND, repeat: '80 80', roughness: 1, shadow: 'receive:true' });
    for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283, d = 170 + rnd() * 30, h = 40 + rnd() * 50; E('a-cone', { position: P(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d), radius_bottom: 30 + rnd() * 20, radius_top: rnd() * 5, height: h, color: '#5c4c3a', roughness: 1, 'segments-radial': 6 }); }
    for (let i = 0; i < 18; i++) E('a-dodecahedron', { position: P((rnd() - .5) * 200, .8, (rnd() - .5) * 200), radius: .8 + rnd() * 1.5, color: '#6e6150', roughness: 1 }); // rocks
  });
  step(() => { // central plaza
    E('a-circle', { position: '0 .03 0', rotation: '-90 0 0', radius: 18, src: TEX_STONE, repeat: '6 6', roughness: 1 });
    statue(0, 0, 1.4);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; pillar(Math.cos(a) * 14, Math.sin(a) * 14, 6, i % 3 === 0); }
    torch(5, 0, 5); torch(-5, 0, 5);
    glyphTablet(0, 8, '☉', 0, 'sun', () => inscription('☉', 'THE FIRST CLUE', '"WHEN THE SUN DIES, THE CITY REMEMBERS."', 'Plaza of the Forgotten City'));
    for (let i = 0; i < 6; i++) E('a-cylinder', { position: P(20 + rnd() * 6, 0.1, 10 + rnd() * 6), radius: .3, height: .2, color: '#9a6a3a' }); // potsherds
    block(0, .1, 60, 6, .2, 60, TEX_STONE); // stone road to plaza
  });
  step(() => { // temple
    const z0 = -45;
    for (let i = 0; i < 6; i++) block(0, .2 + i * .35, z0 + 3 - i * .8, 22 - i, .4, 2, TEX_STONE); // stairs
    block(0, 2.4, z0 - 15, 22, .4, 32, TEX_DARK); // floor deck
    block(-11, 4, z0 - 15, 1, 8, 32); block(11, 4, z0 - 15, 1, 8, 32); wall(-11, z0 - 15, 1, 16); wall(11, z0 - 15, 1, 16);
    block(-7, 4, -75, 8, 8, 1); block(7, 4, -75, 8, 8, 1); block(0, 6.5, -75, 6, 3, 1); wall(-7, -75, 4, .8); wall(7, -75, 4, .8); // back wall with door gap
    block(-6, 7.4, z0 - 4, 10, .5, 14, TEX_DARK); // broken roof
    for (let i = 0; i < 5; i++) { pillar(-7, z0 - 6 - i * 6, 8, i === 3); pillar(7, z0 - 6 - i * 6, 8, i === 1); }
    for (const x of [-9, 9]) { torch(x, 2.6, z0 - 8); torch(x, 2.6, z0 - 22); }
    E('a-box', { position: '0 3.2 -66', width: 3, height: 1.5, depth: 1.4, src: TEX_STONE }); wall(0, -66, 1.6, .8); // altar
    E('a-light', { type: 'point', color: '#ff9a40', intensity: .8, distance: 25, position: '0 6 -60' });
    // murals
    const mur = [['The Founding', 'Figures kneel at a river, raising a first stone.'], ['The Golden Age', 'Markets, harvests and astronomers crowd the walls.'], ['The Great Disaster', 'Waters rise while the mountain burns above the city.'], ['The Disappearance', 'A long line of people walks out through the valley gates.'], ['The Final Prophecy', 'A circle of rings beneath the temple, and a closed door.']];
    mur.forEach((m, i) => {
      const side = i % 2 ? 1 : -1, z = -52 - i * 4.5;
      const p = E('a-plane', { position: P(side * 10.4, 4, z), rotation: P(0, -side * 90, 0), width: 4, height: 3, color: ['#8a4f2a', '#b8892f', '#6b3326', '#5a6a4a', '#3d6a6a'][i] });
      E('a-text', { value: m[0].toUpperCase(), align: 'center', width: 5, color: '#f2e2b0', position: '0 -1.1 .01' }, p);
      interactable(side * 9.2, 3, z, 3.2, '[E] EXAMINE MURAL', () => discover(`MURAL: ${m[0]}`, m[1], 'History'), p);
    });
    // sun medallion
    const med = E('a-torus', { position: '0 4.2 -66', radius: .35, 'radius-tubular': .07, color: '#d4a62a', metalness: .9, roughness: .3 });
    med.setAttribute('animation', 'property:rotation;to:0 360 0;dur:6000;loop:true;easing:linear');
    interactable(0, 4.2, -66, 3.5, '[E] INSPECT ANCIENT SUN MEDALLION', () => inspect('sun'), med).art = 'sun';
    // puzzle: three rotating stone symbols + hint wall + door
    E('a-text', { value: TARGET.join('   '), align: 'center', width: 12, color: '#5fe0d6', position: '0 5.5 -74.4' });
    [-4, 0, 4].forEach((x, i) => {
      const st = E('a-box', { position: P(x, 1.9, -69), width: 1.4, height: 1.6, depth: 1.4, src: TEX_DARK });
      const tx = E('a-text', { value: GLYPHS[S.sym[i]], align: 'center', width: 10, color: '#5fe0d6', position: '0 .9 0', rotation: '-90 0 0' }, st);
      st.tx = tx; stones[i] = st;
      interactable(x, 2, -69, 2.6, '[E] INTERACT — ROTATE SYMBOL', () => rotateStone(i), st);
      wall(x, -69, .7, .7);
    });
    door = E('a-box', { position: '0 3.5 -75', width: 6, height: 7, depth: 1, src: TEX_DARK, color: '#9a8a6a' });
    doorWall = [0, -75, 3, .8]; boxes.push(doorWall);
    if (S.puz) openDoor(true);
  });
  step(() => { // secret chamber
    E('a-cylinder', { position: '0 4 -91', radius: 16, height: 8, 'open-ended': true, side: 'double', 'theta-start': 15, 'theta-length': 330, src: TEX_DARK, repeat: '8 2', roughness: 1 });
    E('a-circle', { position: '0 .05 -91', rotation: '-90 0 0', radius: 16, color: '#3a2e20' });
    E('a-circle', { position: '0 8 -91', rotation: '90 0 0', radius: 16, color: '#14100a' });
    E('a-cylinder', { position: '0 .6 -91', radius: 3, height: 1.2, src: TEX_STONE });
    core = E('a-sphere', { position: '0 2.4 -91', radius: .8, color: '#103a3a', material: 'shader:flat;color:#103a3a' });
    rings = [2.4, 3.4, 4.4].map((r, i) => E('a-torus', { position: '0 2.6 -91', radius: r, 'radius-tubular': .15, color: '#8a6a30', metalness: .8, roughness: .5, rotation: P(90 * (i + 1) % 180, 0, 0) }));
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; const gl = E('a-text', { value: GLYPHS[i % 4], align: 'center', width: 14, color: '#3a5a58', position: P(Math.sin(a) * 15.3, 3.5, -91 + Math.cos(a) * 15.3), rotation: P(0, a * 57.3 + 180, 0) }); glyphs.push(gl); }
    E('a-light', { type: 'point', color: '#5fe0d6', intensity: 0, distance: 30, position: '0 4 -91', id: 'chamberlight' });
    interactable(0, 2.4, -91, 6, '[E] ACTIVATE THE ANCIENT MACHINE', activateMachine, core);
    const cr = E('a-octahedron', { position: '5 1.2 -96', radius: .35, color: '#5fe0d6', material: 'shader:flat;color:#5fe0d6' });
    cr.setAttribute('animation', 'property:rotation;to:0 360 0;dur:4000;loop:true;easing:linear');
    interactable(5, 1.2, -96, 3.5, '[E] INSPECT MYSTERIOUS CRYSTAL', () => inspect('crystal'), cr).art = 'crystal';
    solid(0, -91, 3.2);
  });
  step(() => { // marketplace
    for (let i = 0; i < 6; i++) { const x = -48 + (i % 3) * 8, z = 2 + Math.floor(i / 3) * 10; block(x, .6, z, 4, 1.2, 1.5, TEX_DARK); block(x, 2.6, z - .6, 4.4, .2, 2.4, TEX_STONE); E('a-cylinder', { position: P(x - 1, 1.5, z), radius: .3, height: .6, color: '#a0522d' }); E('a-box', { position: P(x + 1, 1.45, z), width: .7, height: .5, depth: .6, color: '#6b4a2a' }); wall(x, z, 2.2, 1); }
    glyphTablet(-40, 22, '△', 90, 'mtn', () => inscription('△', 'MARKET INSCRIPTION', 'Carved above the stalls: the symbol for MOUNTAIN. Traders measured distance by the peaks.', 'Marketplace'));
    const bowl = E('a-cylinder', { position: '-44 1.3 -5', radius: .4, height: .3, color: '#b0623a', roughness: .8 });
    interactable(-44, 1.3, -5, 3.5, '[E] INSPECT CERAMIC BOWL', () => inspect('bowl'), bowl).art = 'bowl';
  });
  step(() => { // residential
    [[40, 15, 9, 7, 0], [52, 5, 7, 6, 1], [40, -8, 10, 8, 0], [58, 22, 6, 6, 1], [30, 35, 8, 7, 1], [-30, 40, 9, 8, 0], [-55, 25, 7, 7, 1]].forEach(h => house(...h));
  });
  step(() => { // royal hall + tablet
    const x = 60, z = -40;
    block(x, .3, z, 24, .6, 24, TEX_DARK);
    block(x - 12, 3, z, 1, 6, 24); block(x + 12, 3, z, 1, 6, 24); block(x, 3, z - 12, 24, 6, 1);
    wall(x - 12, z, 1, 12); wall(x + 12, z, 1, 12); wall(x, z - 12, 12, 1);
    for (let i = 0; i < 4; i++) { pillar(x - 6, z - 6 + i * 4, 6, false); pillar(x + 6, z - 6 + i * 4, 6, i === 2); }
    block(x, 1, z - 9, 5, 2, 3, TEX_STONE); E('a-box', { position: P(x, 3, z - 10.5), width: 3, height: 3, depth: .6, color: '#b8892f', metalness: .6 }); // throne
    torch(x - 3, 0, z + 2); torch(x + 3, 0, z + 2);
    glyphTablet(x, z - 4, '♛', 0, 'king', () => inscription('♛', 'THE THRONE TABLET', '"The civilization did not simply disappear."', 'Royal Hall'));
  });
  step(() => { // vegetation
    const n = { HIGH: 130, MEDIUM: 70, LOW: 30 }[QUALITY];
    for (let i = 0; i < n; i++) { let x = (rnd() - .5) * 280, z = (rnd() - .5) * 280; if (Math.hypot(x, z) < 22 || Math.abs(x) < 6) continue; tree(x, z); }
    for (let i = 0; i < n; i++) E('a-sphere', { position: P((rnd() - .5) * 200, .3, (rnd() - .5) * 200), radius: .5 + rnd() * .5, color: '#3a5a28', roughness: 1, scale: '1 .6 1' });
    for (let i = 0; i < 12; i++) { const x = (rnd() - .5) * 60, z = (rnd() - .5) * 60; E('a-cone', { position: P(x, .2, z), radius_bottom: .6, radius_top: .1, height: .4, color: '#3a2a1a' }); E('a-sphere', { position: P(x, .45, z), radius: .12, color: '#ff8a1e', material: 'shader:flat;color:#ff8a1e' }); } // old campfires
    // ruined pillars scattered around
    for (let i = 0; i < 14; i++) pillar((rnd() - .5) * 120, 20 + rnd() * 50, 5, true);
    // lost artifacts for excavation feel
    for (let i = 0; i < 8; i++) E('a-box', { position: P(-20 + i * 2, .15, 28 + rnd() * 3), width: .25, height: .3, depth: .25, color: '#ffcc00', scale: '1 .1 1' }); // excavation markers
  });
  step(() => { buildSky(); });
  let i = 0;
  (function run() { if (i < steps.length) { steps[i++](); onStep(i / steps.length); setTimeout(run, 60); } else onStep(1, true); })();
}
let door, doorWall, core, rings = [], glyphs = [], stones = [];

/* ---------- Lights, sky, stars, rain, dust ---------- */
let sun, amb, stars, rain, dust, moonL;
function buildSky() {
  amb = E('a-light', { type: 'ambient', color: '#ffd9a0', intensity: .55 });
  sun = E('a-light', { type: 'directional', color: '#ffb060', intensity: 1.1, position: '-30 25 20', castShadow: QUALITY !== 'LOW', 'shadow-camera-left': -40, 'shadow-camera-right': 40, 'shadow-camera-top': 40, 'shadow-camera-bottom': -40, 'shadow-map-width': QUALITY === 'HIGH' ? 2048 : 1024, 'shadow-map-height': QUALITY === 'HIGH' ? 2048 : 1024 });
  const mk = (n, f) => { const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) f(a, i); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g; };
  stars = new THREE.Points(mk(300, (a, i) => { const t = rnd() * 6.283, u = rnd() * 1.4 + .1, r = 300; a[i * 3] = Math.cos(t) * r; a[i * 3 + 1] = u * 150; a[i * 3 + 2] = Math.sin(t) * r; }), new THREE.PointsMaterial({ size: 1.6, color: 0xffffff, transparent: true, opacity: 0, fog: false }));
  rain = new THREE.Points(mk(1200, (a, i) => { a[i * 3] = (rnd() - .5) * 40; a[i * 3 + 1] = rnd() * 20; a[i * 3 + 2] = (rnd() - .5) * 40; }), new THREE.PointsMaterial({ size: .08, color: 0xaaccff, transparent: true, opacity: .6 }));
  rain.visible = false;
  const dn = { HIGH: 250, MEDIUM: 120, LOW: 50 }[QUALITY] * (REDUCED ? .4 : 1);
  dust = new THREE.Points(mk(dn, (a, i) => { a[i * 3] = (rnd() - .5) * 30; a[i * 3 + 1] = rnd() * 6; a[i * 3 + 2] = (rnd() - .5) * 30; }), new THREE.PointsMaterial({ size: .07, color: 0xffd9a0, transparent: true, opacity: .6 }));
  $('scene').object3D.add(stars, rain, dust);
}
const SKY = [ // [skyColor, fogColor, sunColor, sunInt, ambColor, ambInt, stars]
  ['#d9a76a', '#c9a066', '#ffb060', 1.1, '#ffd9a0', .55, 0],
  ['#c0562a', '#8a4a30', '#ff6a30', .7, '#a06050', .45, 0],
  ['#070b1a', '#0a1020', '#5a70b0', .25, '#2a3a6a', .4, 1]];
let tod = 0, todTarget = 0, weather = 'clear';
const col = new THREE.Color(), col2 = new THREE.Color();
function updateSky(dt) {
  tod += (todTarget - tod) * Math.min(1, dt * .6); // smooth transition
  const i = Math.min(1, Math.floor(tod)), t = tod - i, a = SKY[i], b = SKY[Math.min(2, i + 1)];
  const mix = (c1, c2) => col.set(c1).lerp(col2.set(c2), t).getStyle();
  const dark = weather === 'rain' ? .65 : 1;
  $('sky').setAttribute('color', mix(a[0], b[0]));
  $('scene').setAttribute('fog', `type:exponential;color:${mix(a[1], b[1])};density:${weather === 'fog' ? .05 : weather === 'rain' ? .03 : .012}`);
  sun.setAttribute('light', { color: mix(a[2], b[2]), intensity: (a[3] + (b[3] - a[3]) * t) * dark });
  amb.setAttribute('light', { color: mix(a[4], b[4]), intensity: (a[5] + (b[5] - a[5]) * t) * dark });
  stars.material.opacity = (a[6] + (b[6] - a[6]) * t) * (weather === 'clear' ? 1 : .2);
  const n = tod / 2; // lower sun as time advances
  sun.object3D.position.set(-30 + n * 60, 25 - n * 20, 20);
  dust.material.color.set(tod > 1.5 ? '#d8ff7a' : '#ffd9a0'); // dust becomes fireflies at night
  dust.material.size = tod > 1.5 ? .15 : .07;
}

/* ---------- Audio (optional, procedural wind, no files) ---------- */
let actx, windGain;
function setSound(on) {
  $('snd').textContent = on ? 'ON' : 'OFF';
  try {
    if (on && !actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const b = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = actx.createBufferSource(); s.buffer = b; s.loop = true;
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      windGain = actx.createGain(); windGain.gain.value = .05;
      s.connect(f); f.connect(windGain); windGain.connect(actx.destination); s.start();
    }
    if (windGain) windGain.gain.value = on ? .05 : 0;
    if (on && actx.state === 'suspended') actx.resume();
  } catch (e) {}
}

/* ---------- UI: notifications, panels, subtitles ---------- */
function notify(title, text) {
  const n = document.createElement('div'); n.className = 'note'; n.innerHTML = `<b>+ ${title}</b><br>${text}`;
  $('notes').appendChild(n); setTimeout(() => n.remove(), 4300);
}
function subtitle(t) { const s = $('subtitle'); s.textContent = t; s.classList.remove('hidden'); clearTimeout(subtitle.t); subtitle.t = setTimeout(() => s.classList.add('hidden'), 4500); }
let busy = false, onPanelClose = null;
function showPanel(title, html, after) {
  $('ptitle').textContent = title; $('pbody').innerHTML = html; $('panel').classList.remove('hidden');
  busy = true; onPanelClose = after || null; unlock();
}
function closePanel() {
  if ($('panel').classList.contains('hidden')) return;
  $('panel').classList.add('hidden'); busy = false; endInspect();
  if (onPanelClose) { const f = onPanelClose; onPanelClose = null; f(); }
  lock();
}
$('pclose').onclick = closePanel;
function lock() { try { document.querySelector('canvas').requestPointerLock(); } catch (e) {} $('cam').setAttribute('look-controls', 'enabled', true); }
function unlock() { try { document.exitPointerLock(); } catch (e) {} }

/* ---------- JournalSystem ---------- */
function addJ(sec, title, body) { if (!S.journal.find(j => j.title === title)) { S.journal.push({ sec, title, body }); save(); return true; } return false; }
function discover(title, body, sec) {
  const first = addJ(sec, title, body);
  showPanel(title, `<p>${body}</p>`);
  if (first) notify('DISCOVERY', title);
  quests();
}
function showJournal() {
  const secs = ['DISCOVERIES', 'ARTIFACTS', 'INSCRIPTIONS', 'HISTORY', 'CLUES'];
  const map = { Discoveries: 'DISCOVERIES', Artifacts: 'ARTIFACTS', Inscriptions: 'INSCRIPTIONS', History: 'HISTORY', Clues: 'CLUES' };
  let h = '<h4>INSCRIPTION TRANSLATOR</h4><p>' + (S.ins.map(g => `<span class="glyph">${g}</span> = ${MEANING[g]}`).join(' &nbsp; ') || 'No symbols translated yet.') + '</p>';
  secs.forEach(s => {
    const list = S.journal.filter(j => (map[j.sec] || 'DISCOVERIES') === s);
    h += `<h4>${s}</h4>` + (list.map((j, i) => `<p><b>#${i + 1} ${j.title}</b><br>${j.body}</p>`).join('') || '<p><i>Nothing yet.</i></p>');
  });
  showPanel('EXPEDITION JOURNAL', h);
}

/* ---------- Inscriptions / Artifacts ---------- */
function inscription(g, title, text, where) {
  if (!S.ins.includes(g)) { S.ins.push(g); notify('INSCRIPTION', `${g} translated: ${MEANING[g]}`); save(); }
  addJ('Inscriptions', title, text); addJ('Clues', title, text);
  showPanel(title, `<div class="glyph">${g}</div><p>${text}</p><p><i>Symbol ${g} = ${MEANING[g]}</i><br>Found at: ${where}</p>`);
  subtitle(text); quests();
}
const ARTS = {
  sun: { name: 'ANCIENT SUN MEDALLION', era: 'Unknown', mat: 'Gold / Bronze', use: 'Ceremonial', where: 'Temple Chamber', desc: 'A ring engraved with rays. Worn by those who kept the calendar of the city.', color: '#d4a62a', geo: 'torus' },
  bowl: { name: 'CEREMONIAL CERAMIC BOWL', era: 'Unknown', mat: 'Fired clay', use: 'Offerings', where: 'Marketplace', desc: 'Painted with river patterns. Residue suggests grain or oil.', color: '#b0623a', geo: 'cylinder' },
  crystal: { name: 'MYSTERIOUS CRYSTAL', era: 'Unknown', mat: 'Unidentified crystal', use: 'Unknown', where: 'Secret Chamber', desc: 'It hums faintly near the machine. No known source in the valley.', color: '#5fe0d6', geo: 'octahedron' }
};
let invEl = null, drag = null;
function inspect(id) {
  const a = ARTS[id];
  invEl = E('a-entity', { position: '0 0 -.9' }, $('cam'));
  const g = a.geo === 'torus' ? { primitive: 'torus', radius: .2, radiusTubular: .05 } : a.geo === 'cylinder' ? { primitive: 'cylinder', radius: .2, height: .15 } : { primitive: 'octahedron', radius: .2 };
  E('a-entity', { geometry: g, material: `color:${a.color};metalness:.8;roughness:.3`, animation: 'property:rotation;to:0 360 0;dur:7000;loop:true;easing:linear' }, invEl);
  E('a-light', { type: 'point', intensity: 1.2, distance: 3, position: '0 0 .6' }, invEl);
  invEl.setAttribute('scale', '1.5 1.5 1.5');
  if (!S.art.includes(id)) { S.art.push(id); notify('DISCOVERY', a.name + '<br><i>Artifact recovered.</i>'); addJ('Artifacts', a.name, a.desc); save(); }
  showPanel('ARTIFACT', `<b>${a.name}</b><p>ERA: ${a.era}<br>MATERIAL: ${a.mat}<br>PURPOSE: ${a.use}<br>DISCOVERY: ${a.where}</p><p>${a.desc}</p><small>Drag to rotate · scroll to zoom</small>`);
  $('panel').style.top = '78%'; $('panel').style.maxHeight = '40vh';
  items.filter(i => i.art === id).forEach(i => { i.on = false; if (i.el) i.el.setAttribute('visible', false); });
  quests();
}
function endInspect() { if (invEl) { invEl.remove(); invEl = null; } $('panel').style.top = '50%'; $('panel').style.maxHeight = '84vh'; }
addEventListener('mousemove', e => { if (invEl && drag) { invEl.object3D.rotation.y += e.movementX * .01; invEl.object3D.rotation.x += e.movementY * .01; } });
addEventListener('mousedown', () => drag = true); addEventListener('mouseup', () => drag = false);
addEventListener('wheel', e => { if (invEl) { const s = Math.max(.8, Math.min(3, invEl.object3D.scale.x - e.deltaY * .002)); invEl.object3D.scale.set(s, s, s); } });

/* ---------- PuzzleSystem ---------- */
function rotateStone(i) {
  if (S.puz) return;
  S.sym[i] = (S.sym[i] + 1) % 4; stones[i].tx.setAttribute('value', GLYPHS[S.sym[i]]); save();
  if (S.sym.every((v, k) => GLYPHS[v] === TARGET[k])) { S.puz = true; save(); notify('PUZZLE', 'THE ANCIENT MECHANISM RESPONDS.'); subtitle('THE ANCIENT MECHANISM RESPONDS.'); openDoor(); quests(); }
  else notify('PUZZLE', 'THE SYMBOLS DO NOT ALIGN.');
}
function openDoor(instant) {
  boxes.splice(boxes.indexOf(doorWall), 1);
  if (instant) door.setAttribute('position', '0 -3.6 -75');
  else door.setAttribute('animation', 'property:position;to:0 -3.6 -75;dur:4000;easing:easeInOutQuad');
}
function activateMachine() {
  if (S.machine) return;
  S.machine = true; save();
  $('chamberlight').setAttribute('light', 'intensity', 2);
  glyphs.forEach(g => g.setAttribute('color', '#5fe0d6'));
  core.setAttribute('material', 'shader:flat;color:#5fe0d6');
  shake = 3; notify('THE MACHINE AWAKENS', 'Rings rotate. Symbols illuminate.');
  setTimeout(() => {
    addJ('Discoveries', 'THE FINAL DISCOVERY', 'Evidence points to drought, flooding and volcanic activity forcing migration and political collapse. One mystery remains unexplained.');
    showPanel('THE FINAL INSCRIPTION', '<p>Layers of drought, flood and ash are recorded in the machine\'s rings.</p><h3>"WE LEFT THE CITY.<br>WE DID NOT LEAVE THE WORLD."</h3>', () => { S.done = true; save(); quests(); setTimeout(() => $('end').classList.remove('hidden'), 800); unlock(); });
  }, 2500);
}

/* ---------- QuestSystem ---------- */
const OBJ = [
  ['Find the Ancient Temple', () => S.temple],
  ['Discover 3 inscriptions', () => S.ins.length >= 3],
  ['Recover the Sun Medallion', () => S.art.includes('sun')],
  ['Solve the stone puzzle', () => S.puz],
  ['Enter the secret chamber', () => S.chamber],
  ['Discover the truth', () => S.done]
];
let lastDone = -1;
function quests() {
  const done = OBJ.filter(o => o[1]()).length;
  $('objective').innerHTML = '<b>CURRENT OBJECTIVE</b><br>' + OBJ.map(o => (o[1]() ? '✓ ' : '☐ ') + o[0]).join('<br>');
  if (lastDone >= 0 && done > lastDone) notify('OBJECTIVE', 'Objective updated');
  lastDone = done;
}

/* ---------- MapSystem ---------- */
const PLACES = [['TEMPLE', 0, -60], ['PLAZA', 0, 0], ['MARKET', -42, 8], ['HOMES', 45, 12], ['ROYAL HALL', 60, -40], ['SECRET CHAMBER', 0, -91]];
function showMap() {
  showPanel('EXPEDITION MAP', '<canvas id="mc" width="380" height="380"></canvas>');
  const c = $('mc'), g = c.getContext('2d'), sc = 380 / 240, wx = x => (x + 120) * sc, wz = z => (z + 120) * sc;
  g.fillStyle = '#120c06'; g.fillRect(0, 0, 380, 380);
  for (let gx = 0; gx < 24; gx++) for (let gz = 0; gz < 24; gz++) {
    const seen = S.visited[gx + ',' + gz];
    g.fillStyle = seen ? '#4a3a22' : '#0a0603'; g.fillRect(gx * 10 * sc, gz * 10 * sc, 10 * sc, 10 * sc);
  }
  g.font = '10px Georgia';
  PLACES.forEach(p => { const seen = S.visited[Math.floor((p[1] + 120) / 10) + ',' + Math.floor((p[2] + 120) / 10)]; if (seen) { g.fillStyle = '#c9a24a'; g.fillRect(wx(p[1]) - 3, wz(p[2]) - 3, 6, 6); g.fillText(p[0], wx(p[1]) + 6, wz(p[2]) + 3); } });
  const pp = $('rig').object3D.position; g.fillStyle = '#5fe0d6'; g.beginPath(); g.arc(wx(pp.x), wz(pp.z), 5, 0, 7); g.fill();
}

/* ---------- Player + Interaction + main loop (A-Frame component) ---------- */
const keys = {}; let joy = { x: 0, y: 0 }, shake = 0, started = false, current = null, flashOn = false, battery = 100, cine = null;
addEventListener('keydown', e => {
  if (!started) return;
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === 'e') { if (busy) closePanel(); else if (current) current.fn(); }
  if (k === 'f' && !busy) toggleFlash();
  if (k === 'm' && !busy) showMap(); else if (k === 'm') closePanel();
  if (k === 'j' && !busy) showJournal(); else if (k === 'j') closePanel();
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
function toggleFlash() { flashOn = !flashOn && battery > 0; $('flash').setAttribute('light', 'intensity', flashOn ? 2.5 : 0); }
function collide(x, z) {
  for (const c of circles) if (Math.hypot(x - c[0], z - c[1]) < c[2] + .4) return true;
  for (const b of boxes) if (Math.abs(x - b[0]) < b[2] + .4 && Math.abs(z - b[1]) < b[3] + .4) return true;
  if (z < -76) { const d = Math.hypot(x, z + 91); if (d > 15.4) return true; } else if (z < -45 && Math.abs(x) > 10.4) return true;
  return Math.abs(x) > 115 || Math.abs(z) > 115;
}
AFRAME.registerComponent('game', {
  tick(time, dtMs) {
    if (!started) return;
    const dt = Math.min(dtMs / 1000, .05), rig = $('rig').object3D, cam = $('cam').object3D;
    if (cine) { cine(dt); return; }
    if (sun) updateSky(dt);
    if (!busy) { // PlayerController
      const yaw = cam.rotation.y, run = keys.shift ? 8 : 4.5;
      let f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0) - joy.y, r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + joy.x;
      const mx = (-Math.sin(yaw) * f + Math.cos(yaw) * r) * run * dt, mz = (-Math.cos(yaw) * f - Math.sin(yaw) * r) * run * dt;
      if (!collide(rig.position.x + mx, rig.position.z)) rig.position.x += mx;
      if (!collide(rig.position.x, rig.position.z + mz)) rig.position.z += mz;
      rig.position.y = shake > 0 ? Math.sin(time * .08) * .03 * shake : 0;
    }
    shake = Math.max(0, shake - dt * .5);
    const px = rig.position.x, pz = rig.position.z;
    // map reveal
    const key = Math.floor((px + 120) / 10) + ',' + Math.floor((pz + 120) / 10);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) S.visited[(Math.floor((px + 120) / 10) + dx) + ',' + (Math.floor((pz + 120) / 10) + dz)] = 1;
    // story triggers
    if (!S.temple && pz < -46 && pz > -74 && Math.abs(px) < 10) { S.temple = true; save(); subtitle('The temple air is cold and still. Torches flicker as you step inside.'); quests(); }
    if (!S.chamber && pz < -78) { S.chamber = true; save(); subtitle('The Secret Chamber. Something enormous waits at the center.'); notify('THE TRUTH', 'You entered the Secret Chamber'); quests(); }
    // Interaction system: nearest item within range and roughly in view
    current = null; let best = 99;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const cp = new THREE.Vector3(); cam.getWorldPosition(cp);
    for (const it of items) {
      if (!it.on) continue;
      const dx = it.x - px, dz = it.z - pz, d = Math.hypot(dx, dz);
      if (d < it.r && d < best && (dx * fwd.x + dz * fwd.z) / (d || 1) < -0.001 + 1) {
        const dot = (dx * fwd.x + dz * fwd.z) / (d || 1);
        if (dot > .3) { best = d; current = it; }
      }
    }
    const pr = $('prompt');
    if (current && !busy) { pr.textContent = current.label; pr.classList.remove('hidden'); } else pr.classList.add('hidden');
    // glow on target
    items.forEach(it => { if (it.el && it.on && it.el.getAttribute('material')) it.el.setAttribute('material', 'emissive', it === current && !busy ? '#5fe0d6' : '#000000'); });
    // effects
    if (rings.length && S.machine) { rings[0].object3D.rotation.z += dt; rings[1].object3D.rotation.x += dt * .7; rings[2].object3D.rotation.y += dt * 1.2; }
    if (flashOn) { battery = Math.max(0, battery - (pz < -76 ? dt * .6 : dt * .15)); if (battery <= 0) toggleFlash(); }
    $('batt').textContent = '█'.repeat(Math.round(battery / 10)) + ' ' + Math.round(battery) + '%';
    if (dust) { dust.position.set(px, 0, pz); const a = dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { a.array[i * 3] += Math.sin(time * .0005 + i) * dt * .2; a.array[i * 3 + 1] += dt * .1; if (a.array[i * 3 + 1] > 6) a.array[i * 3 + 1] = 0; } a.needsUpdate = true; }
    if (rain && weather === 'rain') { rain.position.set(px, 0, pz); const a = rain.geometry.attributes.position; for (let i = 0; i < a.count; i++) { a.array[i * 3 + 1] -= dt * 14; if (a.array[i * 3 + 1] < 0) a.array[i * 3 + 1] = 20; } a.needsUpdate = true; }
    if (sun) { sun.object3D.position.x += px - (sun._lx || 0); sun._lx = px; }
  }
});

/* ---------- Cinematic camera (intro walk) ---------- */
function intro() {
  const rig = $('rig').object3D; let t = 0; rig.position.set(0, 0, 70);
  $('hud').classList.add('hidden');
  cine = dt => { t += dt; rig.position.z = 70 - Math.min(t / 4, 1) * 10; if (t > 4) endCine(); };
  const skip = document.createElement('button'); skip.textContent = 'SKIP'; skip.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:60';
  skip.onclick = () => endCine(); document.body.appendChild(skip); intro.skip = skip;
  function endCine() { cine = null; skip.remove(); $('hud').classList.remove('hidden'); subtitle('You have found the Forgotten City. Walk to the plaza, then seek the temple to the north.'); lock(); }
}

/* ---------- Start-up / menus ---------- */
$('begin').onclick = () => {
  $('title').classList.add('hidden'); $('loader').classList.remove('hidden');
  const txt = ['Preparing expedition...', 'Mapping ruins...', 'Recovering artifacts...', 'Translating inscriptions...', 'Opening ancient gates...', 'Entering the civilization...'];
  const go = () => buildWorld((p, finished) => {
    $('barfill').style.width = p * 100 + '%'; $('loadpct').textContent = Math.round(p * 100) + '%'; $('loadtext').textContent = txt[Math.min(5, Math.floor(p * 6))];
    if (finished) setTimeout(() => { $('loader').classList.add('hidden'); started = true; quests(); intro(); }, 500);
  });
  const sc = $('scene'); if (sc.hasLoaded) go(); else sc.addEventListener('loaded', go);
};
document.addEventListener('pointerlockchange', () => { // Esc releases the mouse: show the pause menu
  if (!document.pointerLockElement && started && !busy && !cine && $('end').classList.contains('hidden') && $('pause').classList.contains('hidden') && !matchMedia('(pointer:coarse)').matches) { $('pause').classList.remove('hidden'); busy = true; }
});
$('resume').onclick = () => { $('pause').classList.add('hidden'); busy = false; lock(); };
$('save').onclick = () => { save(); notify('SAVED', 'Progress saved'); };
$('reset').onclick = () => { if (confirm('Erase all progress?')) { localStorage.removeItem('lc_save'); location.reload(); } };
document.querySelectorAll('[data-time]').forEach(b => b.onclick = () => todTarget = +b.dataset.time);
document.querySelectorAll('[data-wx]').forEach(b => b.onclick = () => { weather = b.dataset.wx; rain.visible = weather === 'rain'; });
document.querySelectorAll('[data-q]').forEach(b => { if (b.dataset.q === QUALITY) b.classList.add('on'); b.onclick = () => { localStorage.setItem('lc_q', b.dataset.q); save(); location.reload(); }; });
$('snd').onclick = () => setSound($('snd').textContent === 'OFF');
$('fx').textContent = 'REDUCED EFFECTS: ' + (REDUCED ? 'ON' : 'OFF');
$('fx').onclick = () => { localStorage.setItem('lc_fx', REDUCED ? '0' : '1'); location.reload(); };
$('again').onclick = () => { localStorage.removeItem('lc_save'); location.reload(); };
$('endj').onclick = () => { $('end').classList.add('hidden'); showJournal(); };
$('city').onclick = () => { $('end').classList.add('hidden'); $('rig').object3D.position.set(0, 0, 30); busy = false; lock(); };
// Mobile controls
(() => {
  const j = $('joy'), k = $('knob'); let id = null;
  const mv = t => { const r = j.getBoundingClientRect(), x = (t.clientX - r.left - 60) / 60, y = (t.clientY - r.top - 60) / 60, m = Math.min(1, Math.hypot(x, y)), a = Math.atan2(y, x); joy = { x: Math.cos(a) * m, y: Math.sin(a) * m * -1 * -1 }; joy.y = -Math.sin(a) * m * -1; k.style.transform = `translate(${joy.x * 35}px,${joy.y * 35}px)`; };
  j.addEventListener('touchstart', e => { id = e.changedTouches[0].identifier; mv(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
  j.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === id) mv(t); e.preventDefault(); }, { passive: false });
  j.addEventListener('touchend', () => { joy = { x: 0, y: 0 }; k.style.transform = ''; });
  const fire = key => () => dispatchEvent(new KeyboardEvent('keydown', { key }));
  $('tE').onclick = fire('e'); $('tM').onclick = fire('m'); $('tJ').onclick = fire('j'); $('tF').onclick = fire('f');
})();
