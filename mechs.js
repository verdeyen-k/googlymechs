// Googly Mechs: each team builds a robot mech (a body plus power-ups bought with bolts), then the mechs fight
// on their own in an arena. Last mech standing wins.
(() => {
  // ── Parts ────────────────────────────────────────────────────────────────
  const BUDGET = 12;
  const MAX_LEVEL = 3;
  // Going up to level L costs L bolts, so level 1 costs 1, level 2 costs 3 in all, level 3 costs 6 in all.
  const spent = up => UPGRADES.reduce((s, u) => s + (up[u.k] || 0) * ((up[u.k] || 0) + 1) / 2, 0);

  const TEMPLATES = {
    spider:   { name: 'Spider',   icon: '🕷️', hp: 170, speed: 115, r: 16, fast: 1,   mud: 0.35,   desc: 'Fast and small, but fragile' },
    humanoid: { name: 'Humanoid', icon: '🤖', hp: 210, speed: 75,  r: 21, fast: 1.2, mud: 0.6,  desc: 'Its arms shoot and swing 20% faster' },
    fourleg:  { name: '4-Legged', icon: '🐕', hp: 270, speed: 58,  r: 23, fast: 1,   mud: 0.9,    desc: 'Slow, but very tough' },
  };
  const TEMPLATE_KEYS = Object.keys(TEMPLATES);
  const UPGRADES = [
    { k: 'armor', icon: '🛡️', name: 'Armor',  lv: ['No armor', 'Takes 20% less damage', 'Takes 35% less damage', 'Takes 55% less damage'] },
    { k: 'gun',   icon: '🔫', name: 'Gun',    lv: ['Little blaster', 'Faster, stronger gun', 'Rapid-fire gun', 'Double-barrel blaster'] },
    { k: 'melee', icon: '🗡️', name: 'Melee',  lv: ['No sword', 'Giant sword', 'Bigger, faster sword', 'Enormous sword'] },
    { k: 'size',  icon: '📏', name: 'Size',   lv: ['Normal size', 'Bigger: more health, a bit slower', 'Huge', 'Gigantic'] },
    { k: 'aim',   icon: '🎯', name: 'Targeting', lv: ['Shoots where enemies are', 'Aims a bit ahead of moving enemies', 'Aims well ahead, steadier shots', 'Perfect lead, dead-steady shots'] },
  ];
  const ARMOR = [0, 0.2, 0.35, 0.55];
  const GUN = [{ dmg: 4, rate: 1.5 }, { dmg: 6, rate: 2 }, { dmg: 7, rate: 2.8 }, { dmg: 6, rate: 2.5 }];
  // How far ahead of a moving enemy the gun aims: 0 = right at them, 1 = exactly where they'll be when the shot gets there.
  const TARGETING = [0, 0.4, 0.75, 1];
  const SPREAD = [0.16, 0.1, 0.06, 0.03];  // and how wobbly the shots are
  const MELEE = [null, { dmg: 26, every: 1.3, reach: 30 }, { dmg: 36, every: 1.1, reach: 40 }, { dmg: 44, every: 0.9, reach: 52 }];
  const SIZE = [{ s: 1, hp: 1, sp: 1 }, { s: 1.2, hp: 1.35, sp: 0.95 }, { s: 1.4, hp: 1.75, sp: 0.9 }, { s: 1.6, hp: 2.2, sp: 0.85 }];
  const COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b'];
  const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow'];
  const MAX_TEAMS = COLORS.length;

  // Everything a mech can do, worked out from its parts.
  function stats(b) {
    const T = TEMPLATES[b.t] || TEMPLATES.humanoid, up = b.up || {}, sz = SIZE[up.size || 0];
    const gun = GUN[up.gun || 0], melee = MELEE[up.melee || 0];
    return {
      hp: Math.round(T.hp * sz.hp), speed: T.speed * sz.sp, mud: T.mud, r: T.r * sz.s, armor: ARMOR[up.armor || 0],
      gunDmg: gun.dmg, gunEvery: 1 / (gun.rate * T.fast), barrels: (up.gun || 0) === 3 ? 2 : 1,
      melee: melee && { dmg: melee.dmg, every: melee.every / T.fast, reach: melee.reach * sz.s },
    };
  }

  // ── The fight ────────────────────────────────────────────────────────────
  // The fight is worked out the same way on every device from the mechs and a seed, so nothing but those has
  // to be sent. It only uses + − × ÷ and square roots (no sin/cos), which every browser does exactly the same.
  const ARENA = 640, DT = 1 / 30, TIME_LIMIT = 90, GUN_RANGE = 320, BULLET_SPEED = 460;
  const SPAWNS = [[100, 100], [540, 540], [540, 100], [100, 540]];
  // Maps. Each one is picked at random for a fight. Mud slows spiders down the most and 4-legged mechs the least;
  // pillars block bullets, so sword mechs can sneak up; the cage is too small to run away in.
  const MAPS = [
    { name: 'Open Arena', icon: '🏟️' },
    { name: 'Mud Pit', icon: '🟤', mud: [[320, 320, 150], [140, 480, 80], [500, 160, 80], [190, 190, 55], [450, 450, 55]] },
    { name: 'Pillars', icon: '🗿', pillars: [[320, 320, 44], [205, 205, 28], [435, 435, 28], [435, 205, 28], [205, 435, 28], [320, 150, 22], [320, 490, 22], [150, 320, 22], [490, 320, 22]] },
    { name: 'The Cage', icon: '⛓️', lo: 150, hi: 490 },
    // Every mech starts in a small walled-in corner room with a door, and there's mud in the middle: tight spaces
    // where 4-legged mechs do best.
    { name: 'Close Corners', icon: '🧱', mud: [[320, 320, 120]], walls: [] },
  ];
  // Close Corners' walls: an L around each corner, built out of a row of round posts so they work like pillars.
  for (const [cx, cy] of [[0, 0], [ARENA, 0], [0, ARENA], [ARENA, ARENA]]) {
    const sx = cx ? -1 : 1, sy = cy ? -1 : 1, at = v => [cx + sx * v[0], cy + sy * v[1]];
    MAPS[4].walls.push([at([190, 0]), at([190, 130])], [at([0, 190]), at([130, 190])]);
  }
  for (const map of MAPS) for (const [[x1, y1], [x2, y2]] of map.walls || []) {
    const n = Math.round(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / 14);
    for (let k = 0; k <= n; k++) (map.pillars = map.pillars || []).push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n, 13]);
  }
  const mapOf = fight => MAPS[(fight && fight.map) || 0] || MAPS[0];

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  function newSim(fight) {
    const r = rng(fight.seed), mechs = toArr(fight.mechs), map = mapOf(fight), lo = map.lo || 0, hi = map.hi || ARENA;
    return {
      r, time: 0, over: false, winner: -1, bullets: [], events: [], map, lo, hi,
      mechs: mechs.map((m, i) => {
        const s = stats(m), x = lo + SPAWNS[i][0] * (hi - lo) / ARENA, y = lo + SPAWNS[i][1] * (hi - lo) / ARENA;
        return { i, name: m.name, slot: m.slot, b: cleanBuild(m), s, x, y, vx: 0, vy: 0, hp: s.hp, alive: true,
          ax: (ARENA / 2 - x), ay: (ARENA / 2 - y), gunCd: 0.5 + r() * 0.5, meleeCd: 0, strafe: r() < 0.5 ? 1 : -1, swingAt: -9, shotAt: -9 };
      }),
    };
  }
  // Keep a mech inside the walls and out of pillars.
  function keepIn(sim, m) {
    const r = m.s.r;
    for (const [px, py, pr] of sim.map.pillars || []) {
      const [nx, ny, d] = norm(m.x - px, m.y - py);
      if (d < pr + r) { m.x = px + nx * (pr + r); m.y = py + ny * (pr + r); }
    }
    m.x = Math.max(sim.lo + r, Math.min(sim.hi - r, m.x)); m.y = Math.max(sim.lo + r, Math.min(sim.hi - r, m.y));
  }
  const norm = (x, y) => { const d = Math.sqrt(x * x + y * y) || 1; return [x / d, y / d, d]; };

  function hurt(sim, m, amount, by) {
    if (!m.alive) return;
    m.hp -= amount * (1 - m.s.armor);
    m.hurtAt = sim.time;
    if (m.hp <= 0) { m.hp = 0; m.alive = false; sim.events.push({ k: 'die', x: m.x, y: m.y, r: m.s.r, by }); }
  }

  function step(sim) {
    if (sim.over) return;
    sim.time += DT;
    const alive = sim.mechs.filter(m => m.alive);
    for (const m of alive) {
      if (!m.alive) continue;
      // Go after the nearest enemy.
      let tgt = null, best = Infinity;
      for (const o of sim.mechs) if (o !== m && o.alive) { const dx = o.x - m.x, dy = o.y - m.y, d = dx * dx + dy * dy; if (d < best) { best = d; tgt = o; } }
      if (!tgt) continue;
      const [ux, uy, d] = norm(tgt.x - m.x, tgt.y - m.y);
      m.ax = ux; m.ay = uy;
      // Sword mechs charge in; gun mechs keep their distance and circle.
      const s = m.s, wantClose = s.melee && (m.b.up.melee || 0) >= (m.b.up.gun || 0);
      const want = wantClose ? 0 : 200, gap = d - s.r - tgt.s.r;
      let mx = 0, my = 0;
      if (wantClose ? gap > 4 : d > want + 30) { mx += ux; my += uy; }
      else if (!wantClose && d < want - 30) { mx -= ux; my -= uy; }
      const side = wantClose ? 0.35 : 0.8;
      mx += -uy * m.strafe * side; my += ux * m.strafe * side;
      if (sim.r() < DT * 0.4) m.strafe = -m.strafe;
      // Steer around pillars in the way.
      for (const [px, py, pr] of sim.map.pillars || []) {
        const [fx, fy] = norm(mx, my), qx = px - m.x, qy = py - m.y, t = qx * fx + qy * fy;
        if (t <= 0 || t > 90) continue;
        const sx = qx - fx * t, sy = qy - fy * t, off = Math.sqrt(sx * sx + sy * sy);
        if (off > pr + s.r + 6) continue;
        const [ax, ay] = off > 0.5 ? norm(-sx, -sy) : [-fy * m.strafe, fx * m.strafe];
        mx = fx + ax * 1.5; my = fy + ay * 1.5;
      }
      const [nx, ny] = norm(mx, my);
      let speed = s.speed;
      for (const [cx, cy, cr] of sim.map.mud || []) { const dx = m.x - cx, dy = m.y - cy; if (dx * dx + dy * dy < cr * cr) { speed = s.speed * s.mud; break; } }
      m.vx = nx * speed; m.vy = ny * speed;
      m.x += m.vx * DT; m.y += m.vy * DT;
      keepIn(sim, m);
      // Gun.
      m.gunCd -= DT;
      if (m.gunCd <= 0 && d < GUN_RANGE) {
        m.gunCd = s.gunEvery; m.shotAt = sim.time;
        // Targeting: aim ahead of a moving enemy, at where the shot and the enemy would meet.
        let gx = ux, gy = uy;
        const lead = TARGETING[m.b.up.aim || 0];
        if (lead) {
          const px = tgt.x - m.x, py = tgt.y - m.y;
          const a = tgt.vx * tgt.vx + tgt.vy * tgt.vy - BULLET_SPEED * BULLET_SPEED, b = 2 * (px * tgt.vx + py * tgt.vy), c = px * px + py * py;
          const disc = b * b - 4 * a * c;
          if (disc >= 0) { const t = (-b - Math.sqrt(disc)) / (2 * a); if (t > 0) [gx, gy] = norm(px + tgt.vx * t * lead, py + tgt.vy * t * lead); }
        }
        m.gx = gx; m.gy = gy;
        for (let k = 0; k < s.barrels; k++) {
          const off = s.barrels === 2 ? (k ? 1 : -1) * s.r * 0.35 : 0, spread = (sim.r() - 0.5) * SPREAD[m.b.up.aim || 0];
          const [bx, by] = norm(gx - gy * spread, gy + gx * spread);
          sim.bullets.push({ o: m.i, x: m.x + gx * s.r - gy * off, y: m.y + gy * s.r + gx * off, vx: bx * BULLET_SPEED, vy: by * BULLET_SPEED, left: GUN_RANGE, dmg: s.gunDmg });
        }
        sim.events.push({ k: 'shot', i: m.i });
      }
      // Giant sword: hits anyone in reach in front, and knocks them back.
      m.meleeCd -= DT;
      if (s.melee && m.meleeCd <= 0 && gap < s.melee.reach) {
        m.meleeCd = s.melee.every; m.swingAt = sim.time;
        for (const o of sim.mechs) {
          if (o === m || !o.alive) continue;
          const [ox, oy, od] = norm(o.x - m.x, o.y - m.y);
          if (od - s.r - o.s.r < s.melee.reach && ox * ux + oy * uy > 0.3) {
            hurt(sim, o, s.melee.dmg, m.i);
            o.x += ox * 18; o.y += oy * 18; keepIn(sim, o);
            sim.events.push({ k: 'clang', x: o.x - ox * o.s.r, y: o.y - oy * o.s.r });
          }
        }
      }
    }
    // Mechs bump instead of overlapping.
    for (let a = 0; a < sim.mechs.length; a++) for (let b = a + 1; b < sim.mechs.length; b++) {
      const p = sim.mechs[a], q = sim.mechs[b];
      if (!p.alive || !q.alive) continue;
      const [nx, ny, d] = norm(q.x - p.x, q.y - p.y), push = p.s.r + q.s.r - d;
      if (push > 0) { p.x -= nx * push / 2; p.y -= ny * push / 2; q.x += nx * push / 2; q.y += ny * push / 2; keepIn(sim, p); keepIn(sim, q); }
    }
    // Bullets.
    sim.bullets = sim.bullets.filter(bu => {
      bu.x += bu.vx * DT; bu.y += bu.vy * DT; bu.left -= BULLET_SPEED * DT;
      for (const o of sim.mechs) {
        if (o.i === bu.o || !o.alive) continue;
        const dx = o.x - bu.x, dy = o.y - bu.y, rr = o.s.r + 3;
        if (dx * dx + dy * dy < rr * rr) { hurt(sim, o, bu.dmg, bu.o); sim.events.push({ k: 'hit', x: bu.x, y: bu.y }); return false; }
      }
      for (const [px, py, pr] of sim.map.pillars || []) {
        const dx = bu.x - px, dy = bu.y - py;
        if (dx * dx + dy * dy < pr * pr) { sim.events.push({ k: 'hit', x: bu.x, y: bu.y }); return false; }
      }
      return bu.left > 0 && bu.x > sim.lo && bu.y > sim.lo && bu.x < sim.hi && bu.y < sim.hi;
    });
    // The end: one mech left, or time's up (then the most health left wins).
    const left = sim.mechs.filter(m => m.alive);
    if (left.length <= 1) { sim.over = true; sim.winner = left.length ? left[0].i : -1; }
    else if (sim.time >= TIME_LIMIT) {
      sim.over = true;
      const pct = m => m.hp / m.s.hp, top = Math.max(...left.map(pct)), best = left.filter(m => pct(m) === top);
      sim.winner = best.length === 1 ? best[0].i : -1;
      sim.timeUp = true;
    }
  }

  // ── Online rooms ─────────────────────────────────────────────────────────
  // Bump with the ?v= on the script in index.html whenever what goes in the room changes.
  const VERSION = 4;
  const OUTDATED = 'That room is using a different version of Googly Mechs. Everyone needs to refresh the page.';
  const ROOMS = 'googlymechs/rooms';

  const db = window.firebase ? (firebase.initializeApp({
    apiKey:            'AIzaSyAsJboNGVuESMhkivllUD0o8MUB5LUCMRQ',
    authDomain:        'kvgames.firebaseapp.com',
    databaseURL:       'https://kvgames-default-rtdb.firebaseio.com',
    projectId:         'kvgames',
    storageBucket:     'kvgames.firebasestorage.app',
    messagingSenderId: '463308384695',
    appId:             '1:463308384695:web:5d57623ebd52101ad26032',
  }), firebase.database()) : null;
  let clockOffset = 0;  // server clock minus ours, so every device starts the fight together
  if (db) db.ref('.info/serverTimeOffset').on('value', s => { clockOffset = s.val() || 0; });
  const now = () => Date.now() + clockOffset;

  const $ = id => document.getElementById(id);
  const show = id => {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    if (id !== 'fight') { $('over').hidden = true; $('count').hidden = true; }
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Firebase hands arrays back as objects ({0: x, 1: y}) and drops empty ones.
  const toArr = v => !v ? [] : Array.isArray(v) ? v.filter(x => x != null) : Object.keys(v).sort((a, b) => a - b).map(k => v[k]);

  const myId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  // Online: { code, ref, st, listener, joining }. On this device: { local: true, st }. st is the room:
  // { host, phase: 'lobby' | 'build' | 'fight', players: {id: {name, slot}}, builds: {id: {t, up}}, ready: {id: 1},
  //   fight: { seed, startAt, mechs: [{id, name, slot, t, up}] } }
  let room = null;

  const playerList = st => Object.entries((st && st.players) || {}).filter(([, p]) => p && p.name)
    .map(([id, p]) => ({ id, ...p })).sort((a, b) => a.slot - b.slot);

  function genCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }
  function busy(on) { for (const b of document.querySelectorAll('#menu button')) b.disabled = on; }
  function myName() {
    const name = $('name').value.trim().slice(0, 14);
    if (!name) { $('menu-error').textContent = 'Type your team name first.'; $('name').focus(); return null; }
    store.set('googlymechs-name', name);
    return name;
  }
  const NO_SERVER = "Can't reach the game server. Check the internet connection.";

  async function createRoom(name) {
    if (!db) { $('menu-error').textContent = NO_SERVER; return; }
    busy(true);
    $('menu-error').textContent = '';
    try {
      let code, ref;
      for (let i = 0; i < 10; i++) {
        code = genCode();
        ref = db.ref(`${ROOMS}/${code}`);
        if (!(await ref.get()).exists()) break;
      }
      await ref.set({ host: myId, v: VERSION, created: firebase.database.ServerValue.TIMESTAMP, phase: 'lobby',
        players: { [myId]: { name, slot: 0 } } });
      ref.onDisconnect().remove();
      await enterRoom(code, ref);
    } catch (e) {
      $('menu-error').textContent = "Couldn't create a room. Check the internet connection.";
    }
    busy(false);
  }

  async function joinRoom(code, name) {
    if (!db) { $('menu-error').textContent = NO_SERVER; return; }
    busy(true);
    $('menu-error').textContent = '';
    const ref = db.ref(`${ROOMS}/${code}`);
    try {
      const st = await enterRoom(code, ref, true);
      const problem = !st || !st.host ? `There's no room ${code}.` : st.v !== VERSION ? OUTDATED
        : st.phase !== 'lobby' ? 'That game has already started. Wait for it to finish, then join.'
        : playerList(st).length >= MAX_TEAMS ? `That room is full (${MAX_TEAMS} teams).` : null;
      if (problem) throw new Error(problem);
      // A transaction, so two teams joining at once can't take the same color.
      const res = await ref.child('players').transaction(cur => {
        if (!cur) return;
        const taken = new Set(Object.values(cur).filter(p => p && p.name).map(p => p.slot));
        const slot = COLORS.findIndex((_, i) => !taken.has(i));
        if (slot < 0) return;
        cur[myId] = { name, slot };
        return cur;
      });
      if (!res.committed) throw new Error(`That room is full (${MAX_TEAMS} teams).`);
      for (const path of [`players/${myId}`, `builds/${myId}`, `ready/${myId}`]) ref.child(path).onDisconnect().remove();
      room.joining = false;
      render();
    } catch (e) {
      leaveRoom();
      show('menu');
      $('menu-error').textContent = e.message && !/^FIREBASE|permission/i.test(e.message) ? e.message
        : "Couldn't join. Check the code and the internet connection.";
    }
    busy(false);
  }

  // Start listening to the room. Resolves with its first data, so a join can check it before taking a seat.
  function enterRoom(code, ref, joining = false) {
    leaveRoom();
    room = { code, ref, st: null, joining };
    const r = room;
    return new Promise(resolve => {
      r.listener = ref.on('value', snap => {
        if (room !== r) return;
        r.st = snap.val();
        if (resolve) { const f = resolve; resolve = null; f(r.st); if (joining) return; }
        if (!r.joining) render();
      }, () => { if (resolve) { const f = resolve; resolve = null; f(null); } });
    });
  }
  function leaveRoom() {
    const r = room;
    if (!r) return;
    room = null;
    view = null;
    if (r.local) return;
    r.ref.off('value', r.listener);
    if (r.st && r.st.host === myId) { r.ref.onDisconnect().cancel(); r.ref.remove(); }
    else if (!r.joining) {
      for (const path of [`players/${myId}`, `builds/${myId}`, `ready/${myId}`]) { const c = r.ref.child(path); c.onDisconnect().cancel(); c.remove(); }
    }
  }

  // Change the room: online through Firebase, on one device right here.
  function update(changes) {
    if (!room) return;
    if (!room.local) { room.ref.update(changes); return; }
    for (const [path, v] of Object.entries(changes)) {
      const keys = path.split('/'), last = keys.pop();
      let o = room.st;
      for (const k of keys) o = o[k] || (o[k] = {});
      if (v === null) delete o[last]; else o[last] = v;
    }
    render();
  }

  const newFight = mechs => ({ seed: Math.floor(Math.random() * 2 ** 31), map: Math.floor(Math.random() * MAPS.length), startAt: now() + 3500, mechs });
  function startFight() {
    const st = room.st, teams = playerList(st);
    update({ phase: 'fight', fight: newFight(teams.map(p => ({ id: p.id, name: p.name, slot: p.slot, ...cleanBuild(st.builds[p.id]) }))) });
  }
  const isHost = () => room && (room.local || (room.st && room.st.host === myId));
  function rematch() { if (isHost() && room.st.fight) update({ fight: newFight(toArr(room.st.fight.mechs)) }); }
  function rebuild() { if (isHost()) update({ phase: 'build', ready: null, fight: null }); }

  // Everyone on one device: the same room, kept here, and the teams build one after another.
  function startLocal(n) {
    leaveRoom();
    const players = {};
    for (let slot = 0; slot < n; slot++) players['p' + slot] = { name: COLOR_NAMES[slot], slot };
    room = { local: true, st: { phase: 'build', players, builds: {}, ready: {} } };
    render();
  }

  // ── Building ─────────────────────────────────────────────────────────────
  const cleanBuild = b => {
    const t = b && TEMPLATES[b.t] ? b.t : 'humanoid', up = {};
    for (const u of UPGRADES) up[u.k] = Math.max(0, Math.min(MAX_LEVEL, Math.floor((b && b.up && b.up[u.k]) || 0)));
    return spent(up) <= BUDGET ? { t, up } : { t, up: {} };
  };
  let draft = null, draftFor = null;   // the build being edited, and whose it is

  // Whose mech is being built on this screen: online it's mine; on one device, the first team that isn't ready.
  const builder = () => room.local ? playerList(room.st).find(p => !(room.st.ready || {})[p.id]) : playerList(room.st).find(p => p.id === myId);

  function drawBuild() {
    const st = room.st, who = builder();
    if (!who) return;
    if (draftFor !== who.id) {
      draftFor = who.id;
      const saved = (st.builds || {})[who.id] || (room.local ? null : JSON.parse(store.get('googlymechs-build') || 'null'));
      draft = cleanBuild(saved);
    }
    const ready = !!(st.ready || {})[who.id], left = BUDGET - spent(draft.up);
    $('build-title').innerHTML = `<span class="sw" style="background:${COLORS[who.slot]}"></span>${room.local ? esc(who.name) + ' team: build!' : 'Build your mech'}`;
    $('bolts').textContent = `🔩 ${left} left`;
    $('templates').innerHTML = TEMPLATE_KEYS.map(k => `<button type="button" data-t="${k}" class="${draft.t === k ? 'on' : ''}" ${ready ? 'disabled' : ''}>
      <b>${TEMPLATES[k].icon} ${TEMPLATES[k].name}</b><small>${TEMPLATES[k].desc}</small></button>`).join('');
    $('ups').innerHTML = UPGRADES.map(u => {
      const lv = draft.up[u.k] || 0, next = lv + 1;
      return `<div class="up"><span class="ic">${u.icon}</span><span class="txt"><b>${u.name}${lv ? ' ' + lv : ''}</b><small>${u.lv[lv]}${lv < MAX_LEVEL ? ` · next: ${next} 🔩` : ''}</small></span>
        <span class="ctl"><button type="button" data-k="${u.k}" data-d="-1" aria-label="Less ${u.name}" ${ready || !lv ? 'disabled' : ''}>−</button>
        <span class="pips">${[1, 2, 3].map(n => `<i class="${n <= lv ? 'on' : ''}"></i>`).join('')}</span>
        <button type="button" data-k="${u.k}" data-d="1" aria-label="More ${u.name}" ${ready || lv >= MAX_LEVEL || next > left ? 'disabled' : ''}>+</button></span></div>`;
    }).join('');
    const s = stats(draft), melee = s.melee ? ` · 🗡️ ${Math.round(s.melee.dmg / s.melee.every)}/s` : '';
    $('stats').textContent = `❤️ ${s.hp} health · 💨 ${Math.round(s.speed)} speed · 🔫 ${Math.round(s.gunDmg * s.barrels / s.gunEvery)}/s${melee}${s.armor ? ` · 🛡️ −${Math.round(s.armor * 100)}%` : ''}`;
    // Online: who's ready.
    const teams = playerList(st), waiting = teams.filter(p => !(st.ready || {})[p.id]);
    $('ready').textContent = ready ? 'Change my mech' : 'Ready!';
    $('build-wait').textContent = room.local ? (left > 0 ? `You still have ${left} 🔩` : '')
      : ready ? (teams.length < 2 ? 'Waiting for another team to join…' : `Waiting for ${waiting.map(p => p.name).join(', ')}…`) : '';
  }

  $('templates').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]'); if (!b || b.disabled) return;
    draft.t = b.dataset.t; sfx.click(); drawBuild();
  });
  $('ups').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b || b.disabled) return;
    const k = b.dataset.k, lv = Math.max(0, Math.min(MAX_LEVEL, (draft.up[k] || 0) + Number(b.dataset.d)));
    const up = { ...draft.up, [k]: lv };
    if (spent(up) > BUDGET) return;
    draft.up = up; sfx.click(); drawBuild();
  });
  $('ready').onclick = () => {
    const who = builder(); if (!who) return;
    if ((room.st.ready || {})[who.id]) { update({ [`ready/${who.id}`]: null }); return; }
    if (!room.local) store.set('googlymechs-build', JSON.stringify(draft));
    update({ [`builds/${who.id}`]: cleanBuild(draft), [`ready/${who.id}`]: 1 });
    sfx.click();
  };

  // Older iPhones don't have roundRect; plain corners are fine there.
  if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };

  // ── Drawing mechs ────────────────────────────────────────────────────────
  // look: {x, y} pupil wobble (−1..1), aim: [x, y] direction weapons point, walk: step phase, swing: 0..1 or −1.
  function drawMech(g, x, y, b, color, o) {
    const s = stats(b), r = s.r, up = b.up || {}, dead = o.dead;
    const body = dead ? '#555a66' : color, steel = dead ? '#3d414a' : '#9aa5b1', dark = '#2b2e38';
    const w = Math.sin(o.walk || 0), w2 = Math.sin((o.walk || 0) + Math.PI);
    const [ax, ay] = o.aim || [1, 0], aimAng = Math.atan2(ay, ax);
    g.save(); g.translate(x, y);
    if (dead) g.globalAlpha = 0.75;
    g.lineJoin = 'round'; g.lineCap = 'round';
    // Shadow.
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, r * 0.95, r * 1.2, r * 0.32, 0, 0, Math.PI * 2); g.fill();

    // Sword arm goes behind when aiming away... keep it simple: weapons drawn after the body, on top.
    const armor = up.armor || 0;
    const plate = path => {
      g.fillStyle = body; path(); g.fill();
      g.lineWidth = Math.max(1.5, r * (0.07 + armor * 0.06)); g.strokeStyle = armor ? steel : 'rgba(0,0,0,.45)'; path(); g.stroke();
    };
    const rivets = pts => { if (armor < 2) return; g.fillStyle = '#d7dde3'; for (const [px, py] of pts) { g.beginPath(); g.arc(px, py, Math.max(1.2, r * 0.06), 0, Math.PI * 2); g.fill(); } };
    let eyes = [];

    if (b.t === 'spider') {
      // Eight legs, four on each side, stepping in turns.
      g.strokeStyle = dark; g.lineWidth = Math.max(2, r * 0.13);
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        const lift = Math.sin((o.walk || 0) + i * 1.6 + (side > 0 ? 0.8 : 0)) * r * 0.18;
        const hx = side * r * 0.55, hy = (-0.35 + i * 0.25) * r;
        const kx = side * r * (1.25 + 0.05 * i), ky = hy - r * 0.55 + lift;
        const fx = side * r * (1.55 + 0.1 * i), fy = r * (0.25 + 0.22 * i) + lift * 0.5;
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      }
      plate(() => { g.beginPath(); g.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2); });
      rivets([[-r * 0.7, r * 0.3], [r * 0.7, r * 0.3], [0, r * 0.65]]);
      if (armor >= 3) { g.fillStyle = steel; g.beginPath(); g.moveTo(-r * 0.5, -r * 0.7); g.lineTo(0, -r * 1.15); g.lineTo(r * 0.5, -r * 0.7); g.closePath(); g.fill(); }
      eyes = [[-r * 0.36, -r * 0.12, r * 0.3], [r * 0.36, -r * 0.12, r * 0.3], [-r * 0.66, -r * 0.48, r * 0.16], [r * 0.66, -r * 0.48, r * 0.16]];
    } else if (b.t === 'fourleg') {
      // A robot dog: four legs, a long body, a head at the front.
      const face = ax < 0 ? -1 : 1;
      g.strokeStyle = dark; g.lineWidth = Math.max(3, r * 0.22);
      [[-0.75, w], [-0.4, w2], [0.4, w], [0.75, w2]].forEach(([lx, ph]) => {
        g.beginPath(); g.moveTo(lx * r, r * 0.2); g.lineTo(lx * r + ph * r * 0.18, r * 0.95); g.stroke();
      });
      plate(() => { g.beginPath(); g.roundRect(-r * 1.05, -r * 0.45, r * 2.1, r * 0.8, r * 0.3); });
      rivets([[-r * 0.8, -r * 0.1], [-r * 0.3, -r * 0.1], [r * 0.2, -r * 0.1]]);
      g.strokeStyle = dark; g.lineWidth = Math.max(2, r * 0.1); g.beginPath(); g.moveTo(-face * r * 1.0, -r * 0.3); g.lineTo(-face * r * 1.35, -r * 0.75 + w * r * 0.05); g.stroke();
      const hx = face * r * 0.85, hy = -r * 0.75;
      plate(() => { g.beginPath(); g.roundRect(hx - r * 0.5, hy - r * 0.42, r * 1.0, r * 0.8, r * 0.22); });
      if (armor >= 3) { g.fillStyle = steel; g.beginPath(); g.moveTo(hx - r * 0.3, hy - r * 0.4); g.lineTo(hx - r * 0.15, hy - r * 0.75); g.lineTo(hx, hy - r * 0.4); g.moveTo(hx + r * 0.05, hy - r * 0.4); g.lineTo(hx + r * 0.2, hy - r * 0.75); g.lineTo(hx + r * 0.35, hy - r * 0.4); g.fill(); }
      eyes = [[hx - r * 0.2, hy - r * 0.05, r * 0.22], [hx + r * 0.22, hy - r * 0.05, r * 0.22]];
    } else {
      // Humanoid: two legs, a body, and a box head with an antenna.
      g.fillStyle = dark;
      g.fillRect(-r * 0.45, r * 0.3 + w * r * 0.08, r * 0.32, r * 0.7 - w * r * 0.08);
      g.fillRect(r * 0.13, r * 0.3 + w2 * r * 0.08, r * 0.32, r * 0.7 - w2 * r * 0.08);
      plate(() => { g.beginPath(); g.roundRect(-r * 0.7, -r * 0.55, r * 1.4, r * 1.0, r * 0.2); });
      rivets([[-r * 0.5, -r * 0.35], [r * 0.5, -r * 0.35], [-r * 0.5, r * 0.25], [r * 0.5, r * 0.25]]);
      plate(() => { g.beginPath(); g.roundRect(-r * 0.5, -r * 1.3, r * 1.0, r * 0.72, r * 0.18); });
      g.strokeStyle = dark; g.lineWidth = Math.max(1.5, r * 0.07); g.beginPath(); g.moveTo(0, -r * 1.3); g.lineTo(0, -r * 1.6); g.stroke();
      g.fillStyle = dead ? '#666' : '#ff5c5c'; g.beginPath(); g.arc(0, -r * 1.62, r * 0.09, 0, Math.PI * 2); g.fill();
      if (armor >= 3) { g.fillStyle = steel; g.fillRect(-r * 0.58, -r * 1.42, r * 1.16, r * 0.16); }
      eyes = [[-r * 0.2, -r * 0.95, r * 0.22], [r * 0.2, -r * 0.95, r * 0.22]];
    }

    // Googly eyes: big whites, and pupils that slosh around. Dead mechs get X eyes.
    for (const [ex, ey, er] of eyes) {
      g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = Math.max(1, er * 0.14);
      g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill(); g.stroke();
      if (dead) {
        g.lineWidth = Math.max(1.5, er * 0.25); g.beginPath();
        g.moveTo(ex - er * 0.5, ey - er * 0.5); g.lineTo(ex + er * 0.5, ey + er * 0.5); g.moveTo(ex + er * 0.5, ey - er * 0.5); g.lineTo(ex - er * 0.5, ey + er * 0.5); g.stroke();
      } else {
        const l = o.look || { x: 0, y: 0.4 };
        g.fillStyle = '#111'; g.beginPath(); g.arc(ex + l.x * er * 0.45, ey + l.y * er * 0.45, er * 0.52, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + l.x * er * 0.45 - er * 0.18, ey + l.y * er * 0.45 - er * 0.18, er * 0.13, 0, Math.PI * 2); g.fill();
      }
    }

    if (!dead) {
      // Gun, pointing at the target. Bigger and more barrels with each level.
      const gl = up.gun || 0, len = r * (0.75 + 0.22 * gl), wid = r * (0.16 + 0.05 * gl), tl = up.aim || 0;
      g.save(); g.rotate(o.gunAim ? Math.atan2(o.gunAim[1], o.gunAim[0]) : aimAng);
      // Targeting: a laser sight, longer and brighter with each level.
      if (tl) {
        g.strokeStyle = `rgba(255,60,60,${0.25 + 0.15 * tl})`; g.lineWidth = Math.max(1, r * 0.05);
        g.beginPath(); g.moveTo(r * 0.2 + len, 0); g.lineTo(r * 0.2 + len + r * (1.2 + 1.2 * tl), 0); g.stroke();
        g.fillStyle = '#ff3c3c'; g.beginPath(); g.arc(r * 0.2 + len + r * (1.2 + 1.2 * tl), 0, Math.max(1.5, r * 0.07), 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2b2e38'; g.fillRect(r * 0.4, -wid / 2 - r * 0.14, r * 0.35, r * 0.14);
      }
      for (const off of gl === 3 ? [-wid * 0.8, wid * 0.8] : [0]) {
        g.fillStyle = '#4a4f5c'; g.fillRect(r * 0.2, off - wid / 2, len, wid);
        g.fillStyle = '#2b2e38'; g.fillRect(r * 0.2 + len - wid * 0.6, off - wid / 2 - 1, wid * 0.6, wid + 2);
        if (o.flash) { g.fillStyle = '#ffe066'; g.beginPath(); g.arc(r * 0.2 + len + wid * 0.6, off, wid * 0.9, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = '#6b7280'; g.beginPath(); g.arc(r * 0.15, 0, wid * 0.9, 0, Math.PI * 2); g.fill();
      g.restore();
      // Giant sword, held out to the side, swung across when it hits.
      const ml = up.melee || 0;
      if (ml) {
        const reach = MELEE[ml].reach * SIZE[up.size || 0].s, blade = r * 0.6 + reach, bw = r * (0.16 + 0.05 * ml);
        const sw = o.swing >= 0 && o.swing < 1 ? -1.3 + 2.6 * o.swing : -1.3;
        g.save(); g.rotate(aimAng + sw);
        g.fillStyle = '#8a5a32'; g.fillRect(r * 0.3, -bw * 0.35, r * 0.35, bw * 0.7);              // handle
        g.fillStyle = body; g.fillRect(r * 0.62, -bw * 1.1, bw * 0.45, bw * 2.2);                  // guard
        g.fillStyle = '#dfe6ee'; g.strokeStyle = '#7d8a99'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(r * 0.68, -bw / 2); g.lineTo(r * 0.3 + blade, -bw / 2); g.lineTo(r * 0.3 + blade + bw, 0); g.lineTo(r * 0.3 + blade, bw / 2); g.lineTo(r * 0.68, bw / 2); g.closePath(); g.fill(); g.stroke();
        if (o.swing >= 0 && o.swing < 1) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = bw; g.beginPath(); g.arc(0, 0, r * 0.3 + blade * 0.8, -0.8, 0); g.stroke(); }
        g.restore();
      }
    }
    g.restore();
  }

  // Each mech's pupils: they lag behind and slosh about, like real googly eyes.
  function wobble(e, look, dt, kick) {
    e.vx += ((look[0] * 0.5 - e.x) * 30 + kick[0]) * dt; e.vy += ((look[1] * 0.5 - e.y) * 30 + 14 + kick[1]) * dt;
    e.vx *= Math.pow(0.04, dt); e.vy *= Math.pow(0.04, dt);
    e.x += e.vx * dt; e.y += e.vy * dt;
    const d = Math.sqrt(e.x * e.x + e.y * e.y);
    if (d > 1) { e.x /= d; e.y /= d; const vn = e.vx * e.x + e.vy * e.y; if (vn > 0) { e.vx -= 1.6 * vn * e.x; e.vy -= 1.6 * vn * e.y; } }
  }

  // ── The build preview ────────────────────────────────────────────────────
  const pv = $('preview'), pg = pv.getContext('2d');
  const pvEyes = { x: 0, y: 0, vx: 0, vy: 0 };
  function drawPreview(t, dt) {
    const w = pv.clientWidth, h = pv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (pv.width !== Math.round(w * dpr)) { pv.width = Math.round(w * dpr); pv.height = Math.round(h * dpr); }
    pg.setTransform(dpr, 0, 0, dpr, 0, 0); pg.clearRect(0, 0, w, h);
    const who = builder(), s = stats(draft), scale = Math.min(2.2, (h * 0.27) / s.r);
    const aim = [Math.cos(t / 1400), Math.sin(t / 1400) * 0.6];
    wobble(pvEyes, aim, dt, [Math.sin(t / 300) * 30, 0]);
    pg.save(); pg.translate(w / 2, h * 0.55); pg.scale(scale, scale);
    drawMech(pg, 0, 0, draft, COLORS[who ? who.slot : 0], { walk: t / 180, aim, look: pvEyes, swing: (t / 1200) % 2 < 1 ? -1 : ((t / 1200) % 1) * 2, flash: (t % 500) < 60 });
    pg.restore();
  }

  // ── The arena ────────────────────────────────────────────────────────────
  const canvas = $('arena'), g2 = canvas.getContext('2d');
  // view: { sim, key, played: seconds of fight shown so far, eyes, walk, sparks, shownOver }
  let view = null, speed = 1, lastFrame = performance.now(), K = 1;
  const VIS = 1.3;  // mechs are drawn a bit bigger than they really are, so they're easy to see on a phone

  function fit() {
    const wrap = canvas.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.max(100, Math.floor(Math.min(wrap.width - 12, wrap.height - 8)));
    canvas.style.width = canvas.style.height = size + 'px';
    canvas.width = canvas.height = Math.round(size * dpr);
    K = size / ARENA;
    g2.setTransform(dpr * K, 0, 0, dpr * K, 0, 0);
  }
  window.addEventListener('resize', () => { if (!$('fight').hidden) fit(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { if (!$('fight').hidden) fit(); }, 300));

  function drawArena(t, dt) {
    const sim = view.sim, startIn = room.st.fight.startAt - now();
    // Move the fight along, at the chosen speed, once the countdown is done.
    if (startIn <= 0 && !sim.over) {
      view.played += dt * speed;
      let n = 0;
      while (sim.time + DT <= view.played && !sim.over && n++ < 40) { step(sim); handleEvents(); }
      if (n >= 40) view.played = sim.time;
    }
    drawMap(sim.map, sim.lo, sim.hi, t);
    // Mechs, back to front; wrecks underneath.
    const order = sim.mechs.slice().sort((a, b) => (a.alive - b.alive) || (a.y - b.y));
    for (const m of order) {
      const e = view.eyes[m.i], lastV = view.vel[m.i] || [0, 0];
      wobble(e, [m.ax, m.ay], dt, [-(m.vx - lastV[0]) * 4, -(m.vy - lastV[1]) * 4]);
      view.vel[m.i] = [m.vx, m.vy];
      if (m.alive && (m.vx || m.vy)) view.walk[m.i] += dt * (m.s.speed / 8);
      const swing = (sim.time - m.swingAt) / 0.3, flash = sim.time - m.shotAt < 0.06;
      const hurt = m.hurtAt && sim.time - m.hurtAt < 0.1;
      g2.save(); g2.translate(m.x, m.y); g2.scale(VIS, VIS);
      drawMech(g2, 0, 0, m.b, hurt ? '#fff' : COLORS[m.slot], { walk: view.walk[m.i], aim: [m.ax, m.ay], gunAim: m.gx != null ? [m.gx, m.gy] : null, look: e, swing: swing < 1 ? swing : -1, flash, dead: !m.alive });
      g2.restore();
    }
    // Health bars and names on top of everything.
    for (const m of sim.mechs) {
      if (!m.alive) continue;
      const r = m.s.r * VIS, top = Math.max(26, m.y - r * (m.b.t === 'humanoid' ? 1.75 : 1.35) - 10), bw = Math.max(44, r * 2);
      g2.fillStyle = 'rgba(0,0,0,.55)'; g2.fillRect(m.x - bw / 2 - 2, top - 2, bw + 4, 10);
      const pct = m.hp / m.s.hp;
      g2.fillStyle = pct > 0.5 ? '#51cf66' : pct > 0.25 ? '#ffd43b' : '#ff6b6b'; g2.fillRect(m.x - bw / 2, top, bw * pct, 6);
      g2.font = '600 15px Fredoka, system-ui, sans-serif'; g2.textAlign = 'center';
      g2.lineWidth = 4; g2.strokeStyle = 'rgba(0,0,0,.75)'; g2.strokeText(m.name, m.x, top - 6);
      g2.fillStyle = COLORS[m.slot]; g2.fillText(m.name, m.x, top - 6);
    }
    // Bullets and sparks.
    g2.fillStyle = '#ffe066';
    for (const bu of sim.bullets) { g2.beginPath(); g2.arc(bu.x, bu.y, 3.5, 0, Math.PI * 2); g2.fill(); }
    view.sparks = view.sparks.filter(p => (p.life -= dt) > 0);
    for (const p of view.sparks) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
      g2.globalAlpha = Math.min(1, p.life * 2); g2.fillStyle = p.c; g2.beginPath(); g2.arc(p.x, p.y, p.s, 0, Math.PI * 2); g2.fill();
    }
    g2.globalAlpha = 1;

    // Clock and countdown.
    const clock = `${Math.floor(sim.time / 60)}:${String(Math.floor(sim.time) % 60).padStart(2, '0')}`;
    if ($('clock').textContent !== clock) $('clock').textContent = clock;
    $('count').hidden = !(startIn > -700);
    if (!$('count').hidden) {
      const txt = startIn > 0 ? String(Math.ceil(startIn / 1000)) : 'FIGHT!';
      if ($('count').textContent !== txt) { $('count').textContent = txt; sfx.beep(startIn <= 0); }
    }
    if (sim.over && !view.shownOver) { view.shownOver = true; setTimeout(showOver, 1300); }
  }

  function drawMap(map, lo, hi, t) {
    // Floor. Outside the cage is dark.
    g2.fillStyle = '#15131f'; g2.fillRect(0, 0, ARENA, ARENA);
    g2.fillStyle = '#2a2d3a'; g2.fillRect(lo, lo, hi - lo, hi - lo);
    g2.strokeStyle = 'rgba(255,255,255,.05)'; g2.lineWidth = 2;
    for (let k = lo + 40; k < hi; k += 40) { g2.beginPath(); g2.moveTo(k, lo); g2.lineTo(k, hi); g2.moveTo(lo, k); g2.lineTo(hi, k); g2.stroke(); }
    // Mud: brown puddles with bubbles popping.
    for (const [x, y, r] of map.mud || []) {
      g2.fillStyle = '#5a3d22'; g2.beginPath(); g2.arc(x, y, r, 0, Math.PI * 2); g2.fill();
      g2.fillStyle = '#6e4b2a'; g2.beginPath(); g2.arc(x - r * 0.15, y - r * 0.1, r * 0.7, 0, Math.PI * 2); g2.fill();
      g2.fillStyle = 'rgba(160,120,80,.6)';
      for (let k = 0; k < Math.round(r / 18); k++) {
        const a = k * 2.4, d = r * (0.2 + 0.6 * ((k * 0.37) % 1)), ph = (t / 900 + k * 0.31) % 1;
        g2.beginPath(); g2.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + ph * 5, 0, Math.PI * 2); g2.fill();
      }
    }
    // Walls, then stone pillars.
    for (const [[x1, y1], [x2, y2]] of map.walls || []) {
      g2.lineCap = 'round';
      g2.strokeStyle = '#3c3f4d'; g2.lineWidth = 30; g2.beginPath(); g2.moveTo(x1, y1 + 4); g2.lineTo(x2, y2 + 4); g2.stroke();
      g2.strokeStyle = '#8a8fa3'; g2.lineWidth = 26; g2.beginPath(); g2.moveTo(x1, y1); g2.lineTo(x2, y2); g2.stroke();
      g2.strokeStyle = '#a9aec0'; g2.lineWidth = 10; g2.beginPath(); g2.moveTo(x1, y1 - 3); g2.lineTo(x2, y2 - 3); g2.stroke();
    }
    if (!map.walls) for (const [x, y, r] of map.pillars || []) {
      g2.fillStyle = 'rgba(0,0,0,.35)'; g2.beginPath(); g2.ellipse(x, y + r * 0.35, r * 1.05, r * 0.8, 0, 0, Math.PI * 2); g2.fill();
      g2.fillStyle = '#7d8295'; g2.beginPath(); g2.arc(x, y, r, 0, Math.PI * 2); g2.fill();
      g2.fillStyle = '#a3a8ba'; g2.beginPath(); g2.arc(x - r * 0.2, y - r * 0.25, r * 0.65, 0, Math.PI * 2); g2.fill();
    }
    // The edge: striped for an open arena, a glowing fence for the cage.
    if (map.lo) {
      g2.strokeStyle = `rgba(120,200,255,${0.6 + 0.3 * Math.sin(t / 120)})`; g2.lineWidth = 5; g2.strokeRect(lo - 2, lo - 2, hi - lo + 4, hi - lo + 4);
      g2.strokeStyle = 'rgba(120,200,255,.25)'; g2.lineWidth = 14; g2.strokeRect(lo - 6, lo - 6, hi - lo + 12, hi - lo + 12);
    } else { g2.strokeStyle = '#ffb84d'; g2.lineWidth = 6; g2.setLineDash([24, 16]); g2.strokeRect(3, 3, ARENA - 6, ARENA - 6); g2.setLineDash([]); }
  }

  function burst(x, y, n, c, sp, size) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random());
      view.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.4, c: Array.isArray(c) ? c[k % c.length] : c, s: size * (0.5 + Math.random()) });
    }
  }
  function handleEvents() {
    const sim = view.sim;
    let shots = 0;
    for (const e of sim.events) {
      if (e.k === 'shot') shots++;
      if (e.k === 'hit') burst(e.x, e.y, 4, '#ffe066', 120, 2.5);
      if (e.k === 'clang') { burst(e.x, e.y, 10, ['#fff', '#dfe6ee', '#ffe066'], 220, 3); sfx.clang(); }
      if (e.k === 'die') { burst(e.x, e.y, 40, ['#ff922b', '#ffd43b', '#ff6b6b', '#868e96'], 260, e.r * 0.25); sfx.boom(); }
    }
    if (shots) sfx.pew();
    sim.events = [];
  }

  function showOver() {
    if (!room || !view || $('fight').hidden) return;
    const sim = view.sim, w = sim.mechs[sim.winner];
    $('winner').innerHTML = !w ? (sim.timeUp ? "Time's up: it's a tie!" : 'Everyone blew up: a tie!')
      : `<span class="sw" style="background:${COLORS[w.slot]}"></span> ${esc(w.name)} wins!${sim.timeUp ? ' (most health left when time ran out)' : ''} 🏆`;
    const host = isHost();
    $('rematch').hidden = !host; $('rebuild').hidden = !host; $('again-wait').hidden = host;
    $('over').hidden = false;
    if (w) sfx.win();
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - lastFrame) / 1000); lastFrame = t;
    if (!room) return;
    if (!$('build').hidden && draft) drawPreview(t, Math.min(dt, 0.05));
    if (!$('fight').hidden && view) drawArena(t, dt);
  }
  requestAnimationFrame(frame);

  // ── Sounds ───────────────────────────────────────────────────────────────
  // Made on the fly with Web Audio, so there are no sound files. Phones only allow sound after a tap.
  const sfx = (() => {
    let ac = null, muted = store.get('googlymechs-mute') === '1', lastPew = 0;
    function ctx() {
      if (muted) return null;
      if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(f, dur, type = 'square', vol = 0.08, slide = 1) {
      const a = ctx(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
    }
    function noise(dur, vol, freq) {
      const a = ctx(); if (!a) return;
      const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
      s.connect(f).connect(g).connect(a.destination); s.start();
    }
    return {
      click() { tone(660, 0.05, 'triangle', 0.06, 1.3); },
      pew() { const t = performance.now(); if (t - lastPew < 70) return; lastPew = t; tone(1200, 0.08, 'square', 0.025, 0.4); },
      clang() { tone(1500, 0.18, 'triangle', 0.08, 0.95); tone(2300, 0.12, 'triangle', 0.04, 0.9); },
      boom() { noise(0.6, 0.6, 600); tone(110, 0.5, 'sawtooth', 0.08, 0.4); },
      beep(go) { tone(go ? 880 : 440, go ? 0.35 : 0.15, 'square', 0.08); },
      win() { [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => tone(f, 0.25, 'square', 0.09), k * 120)); },
      unlock() { ctx(); },
      get muted() { return muted; },
      toggle() { muted = !muted; store.set('googlymechs-mute', muted ? '1' : '0'); },
    };
  })();

  // ── Screens ──────────────────────────────────────────────────────────────
  function render() {
    if (!room) { show('menu'); return; }
    const st = room.st;
    if (!room.local) {
      if (!st || !st.host) { leaveRoom(); show('menu'); $('menu-error').textContent = 'The host left, so the room closed.'; return; }
      if (!st.players || !st.players[myId]) { leaveRoom(); show('menu'); $('menu-error').textContent = 'You left the room.'; return; }
    }
    const host = isHost(), teams = playerList(st);

    if (st.phase === 'lobby') {
      show('lobby');
      $('code').textContent = room.code;
      $('lobby-players').innerHTML = teams.map(p => `<li><span class="sw" style="background:${COLORS[p.slot]}"></span><span class="pname">${esc(p.name)}</span>
        <span class="muted">${COLOR_NAMES[p.slot]}${p.id === st.host ? ' · host' : ''}${p.id === myId ? ' · you' : ''}</span></li>`).join('');
      $('start').hidden = !host;
      $('start').disabled = teams.length < 2;
      $('start').textContent = teams.length < 2 ? 'Need 2 teams' : `Start building (${teams.length} teams)`;
      $('lobby-wait').hidden = host;
      return;
    }

    if (st.phase === 'build') {
      view = null;
      // Everyone's ready: the host starts the fight.
      const allReady = teams.length >= 2 && teams.every(p => (st.ready || {})[p.id] && (st.builds || {})[p.id]);
      if (host && allReady && !room.fightSent) { room.fightSent = true; startFight(); return; }
      if (!allReady) room.fightSent = false;
      show('build');
      drawBuild();
      return;
    }

    // The fight.
    const f = st.fight;
    if (!f) return;
    if (!view || view.key !== f.seed + ':' + f.startAt) {
      const sim = newSim(f);
      view = { key: f.seed + ':' + f.startAt, sim, played: 0, eyes: sim.mechs.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })), vel: [], walk: sim.mechs.map(() => 0), sparks: [], shownOver: false };
      $('over').hidden = true;
    }
    show('fight');
    fit();
    $('mapname').textContent = `${view.sim.map.icon} ${view.sim.map.name}`;
  }

  // ── Menu and buttons ─────────────────────────────────────────────────────
  let localCount = Math.max(2, Math.min(4, Number(store.get('googlymechs-local')) || 2));
  const drawMenu = () => { for (const b of $('local-count').children) b.classList.toggle('on', Number(b.dataset.n) === localCount); };
  for (const b of $('local-count').children) b.onclick = () => { localCount = Number(b.dataset.n); store.set('googlymechs-local', localCount); drawMenu(); };
  drawMenu();
  $('local').onclick = () => { draftFor = null; startLocal(localCount); };
  $('name').value = store.get('googlymechs-name') || '';
  $('create').onclick = () => { const n = myName(); if (n) { draftFor = null; createRoom(n); } };
  $('join').onclick = () => {
    const n = myName(); if (!n) return;
    const code = $('join-code').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) { $('menu-error').textContent = 'Room codes are 4 letters.'; return; }
    draftFor = null;
    joinRoom(code, n);
  };
  $('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
  $('start').onclick = () => { if (isHost()) update({ phase: 'build', ready: null }); };
  $('rematch').onclick = rematch;
  $('rebuild').onclick = () => { draftFor = null; rebuild(); };
  for (const id of ['lobby-leave', 'build-leave', 'fight-leave', 'over-leave']) $(id).onclick = () => { leaveRoom(); show('menu'); };
  $('speed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('speed').textContent = speed + '×'; };
  const drawMute = () => { $('mute').textContent = sfx.muted ? '🔇' : '🔊'; };
  $('mute').onclick = () => { sfx.toggle(); drawMute(); };
  drawMute();
  window.addEventListener('pagehide', leaveRoom);
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) document.addEventListener(ev, () => sfx.unlock(), { capture: true, passive: true });

  if (!db) $('menu-error').textContent = NO_SERVER;
  show('menu');
})();
