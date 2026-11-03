// NEON SIEGE — self-contained, zero-dependency Canvas arena shooter.
const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const UPGRADES = {
  heavy: { name: '大口径', icon: '●', color: '#ffce75', max: 3 },
  pierce: { name: '穿透', icon: '»', color: '#68e6ff', max: 3 },
  rapid: { name: '极速射击', icon: 'ϟ', color: '#c99aff', max: 4 },
  multi: { name: '多重弹道', icon: '⋔', color: '#ff92ba', max: 2 },
  explosive: { name: '爆炸弹', icon: '✹', color: '#ffab6e', max: 3 },
  ricochet: { name: '弹射', icon: '↗', color: '#95e7a8', max: 3 },
  chain: { name: '电弧', icon: 'ϟ', color: '#83b8ff', max: 3 },
  freeze: { name: '冰冻弹', icon: '❄', color: '#b0edff', max: 3 },
  homing: { name: '追踪弹', icon: '◎', color: '#e5a0ff', max: 3 },
  drone: { name: '无人机', icon: '◇', color: '#a4ffe6', max: 3 },
  shield: { name: '能量护盾', icon: '⬡', color: '#80d6ff', max: 3 },
  reload: { name: '快速装填', icon: '↻', color: '#e8e59b', max: 3 },
  magazine: { name: '扩容弹匣', icon: '▥', color: '#ffd69a', max: 3 },
  overload: { name: '重载机匣', icon: '◆', color: '#ffc17e', max: 1, excludes: 'accelerator', tradeoff: true },
  accelerator: { name: '轻量枪机', icon: '↯', color: '#b9adff', max: 1, excludes: 'overload', tradeoff: true },
  dash: { name: '闪避强化', icon: '»', color: '#c0b0ff', max: 3 },
};
const EVOLUTIONS = {
  frost: { name: '极寒追猎', color: '#b0edff', needs: { freeze: 3, homing: 2 }, description: '命中已减速敌人时伤害提高 30%，追踪转向更快' },
  swarm: { name: '蜂群卫队', color: '#a4ffe6', needs: { drone: 3, shield: 2 }, description: '增加一架无人机，无人机攻击间隔缩短 25%' },
  siege: { name: '榴弹炮', color: '#ffb06d', needs: { heavy: 3, explosive: 3 }, description: '大范围爆炸，爆炸伤害与范围显著提升' },
  storm: { name: '雷暴机枪', color: '#9bbcff', needs: { rapid: 3, chain: 3 }, description: '电弧额外连锁 2 个目标，连锁范围扩大' },
  rail: { name: '连锁穿甲弹', color: '#a3ffe3', needs: { pierce: 3, ricochet: 3 }, description: '额外穿透 2 个目标，并额外弹射 2 次' },
};
function upgradeDescription(type, level) {
  return ({
    overload: '伤害 ×1.70，射击间隔 ×1.28；与轻量枪机互斥',
    accelerator: '射击间隔 ×0.70，伤害 ×0.84；与重载机匣互斥',
    heavy: `弹体增大 ${level * 30}%，伤害增加 ${level * 18}%`,
    pierce: `每颗子弹最多命中 ${level + 1} 个敌人`,
    rapid: `射速提高 ${Math.round((Math.pow(.89, -level) - 1) * 100)}%`,
    multi: `每轮 ${level * 2 + 1} 条弹道，只消耗 1 发弹药；单弹伤害随散射略降`,
    explosive: `命中产生半径 ${50 + level * 18} 的爆炸`,
    ricochet: `子弹遇到墙壁或掩体可弹射 ${level} 次`,
    chain: `命中后电弧连锁 ${level} 个附近敌人`,
    freeze: `命中减速 ${level * 15}%，持续 ${(1 + level * .4).toFixed(1)} 秒`,
    homing: `子弹自动转向敌人，追踪强度 ${level} 级`,
    drone: `${level >= 3 ? 2 : 1} 架环绕无人机自动攻击，单发伤害 ${14 + level * 6}`,
    shield: `获得 ${level * 18} 点护盾，脱离受伤 8 秒后恢复`,
    reload: `装填时间缩短 ${level * 18}%`,
    magazine: `弹匣容量增加至 ${28 + level * 8} 发`,
    dash: `闪避冷却缩短 ${level * 15}%，无敌时间延长`,
  })[type];
}
const CAMPAIGN = [
  { name: '接敌训练', count: 12, cap: 7, group: 1, interval: 1.1, pool: ['runner'] },
  { name: '交叉火力', count: 18, cap: 10, group: 2, interval: 1.0, pool: ['runner','runner','gunner'], mission: 'cache' },
  { name: '精英试炼', count: 20, cap: 12, group: 2, interval: .9, pool: ['runner','gunner','brute'], elite: true },
  { name: '突袭封锁', count: 28, cap: 15, group: 3, interval: .88, pool: ['charger','runner','gunner','charger'], mission: 'bounty' },
  { name: '钢铁暴君', count: 1, cap: 12, group: 1, interval: 1, pool: [], boss: true },
  { name: '重整防线', count: 26, cap: 13, group: 2, interval: .95, pool: ['splitter','runner','gunner'] },
  { name: '猎杀阵列', count: 38, cap: 19, group: 3, interval: .78, pool: ['charger','sniper','runner','splitter'], mission: 'relay' },
  { name: '精英围剿', count: 40, cap: 22, group: 4, interval: .78, pool: ['brute','gunner','charger','sniper'], elite: true },
  { name: '最后防线', count: 50, cap: 26, group: 4, interval: .69, pool: ['charger','sniper','splitter','gunner','runner'], mission: 'bounty' },
  { name: '封锁主宰', count: 1, cap: 18, group: 1, interval: 1, pool: [], boss: true },
];
function wavePlan(wave, endless) {
  if (wave <= 10) return { ...CAMPAIGN[Math.max(0, wave - 1)] };
  const boss = endless && wave % 5 === 0;
  return { name: boss ? '深层主宰' : '无尽封锁', boss, elite: !boss && wave % 4 === 0,
    count: boss ? 1 : Math.min(48 + (wave - 10) * 3, 78), cap: Math.min(26 + wave - 10, 36),
    group: boss ? 1 : 5, interval: Math.max(.38, .7 - (wave - 10) * .025),
    pool: ['charger','sniper','splitter','gunner','brute','runner'],
    mission: !boss && wave % 3 === 0 ? (wave % 2 ? 'bounty' : 'cache') : null };
}
const ART_SOURCES = {
  floor: './assets/arena-ice.png?v=3.4',
  units: './assets/units-ice.png?v=3.4',
  rover: './assets/rover-layered.png?v=3.4',
};
// Source rectangles include a small transparent margin around each rendered object.
const ART_FRAMES = {
  player: { x: 57, y: 107, w: 289, h: 194, pivot: .4 },
  runner: { x: 396, y: 84, w: 307, h: 243, pivot: .44 },
  gunner: { x: 803, y: 56, w: 246, h: 263, pivot: .4 },
  brute: { x: 1118, y: 50, w: 302, h: 300, pivot: .43 },
  charger: { x: 43, y: 403, w: 302, h: 252, pivot: .43 },
  splitter: { x: 413, y: 437, w: 274, h: 220, pivot: .43 },
  sniper: { x: 755, y: 414, w: 315, h: 235, pivot: .36 },
  boss: { x: 1084, y: 420, w: 355, h: 250, pivot: .4 },
  finalBoss: { x: 14, y: 684, w: 373, h: 361, pivot: .5 },
  pylon: { x: 443, y: 733, w: 233, h: 261, pivot: .5 },
  coverWide: { x: 723, y: 791, w: 371, h: 198, pivot: .5 },
  coverTall: { x: 1179, y: 730, w: 180, h: 301, pivot: .5 },
};
// These footprints match the permanent buildings painted into the arena background.
const PERIMETER_COVER = [
  { x: 174, y: 0, w: 194, h: 118 },
  { x: 958, y: 0, w: 238, h: 170 },
  { x: 0, y: 239, w: 78, h: 191 },
  { x: 0, y: 517, w: 282, h: 180 },
  { x: 74, y: 481, w: 90, h: 46 },
  { x: 223, y: 627, w: 175, h: 93 },
  { x: 1185, y: 196, w: 95, h: 117 },
  { x: 1233, y: 313, w: 47, h: 118 },
  { x: 990, y: 501, w: 205, h: 192 },
  { x: 940, y: 574, w: 58, h: 92 },
  { x: 1165, y: 651, w: 115, h: 69 },
];
const segmentDistanceSquared = (ax, ay, bx, by, px, py) => {
  const dx = bx - ax, dy = by - ay;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  const x = ax + dx * t - px, y = ay + dy * t - py;
  return x * x + y * y;
};

export function mountGame(canvas, { onState = () => {}, onEvent = () => {} } = {}) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('mountGame requires a canvas element');
  const ctx = canvas.getContext('2d', { alpha: false });
  // Move keyboard focus away from start/pause buttons when play resumes.
  canvas.tabIndex = -1;
  const keys = new Set();
  const pointers = new Map();
  let raf = 0;
  let lastTime = 0;
  let drawScale = 1;
  const art = { ready: typeof Image === 'undefined', error: false, floor: null, units: null, rover: null };
  let artBatch = 0;
  let drawOffsetX = 0;
  let drawOffsetY = 0;
  let dpr = 1;
  let mouseDown = false;
  let mouseX = W / 2 + 120;
  let mouseY = H / 2;
  let leftTouch = null;
  let rightTouch = null;
  let virtualMove = { x: 0, y: 0 };
  let virtualFire = false;
  let virtualAim = null;
  let virtualTouchMode = window.matchMedia?.('(pointer: coarse)')?.matches || false;
  let touchTarget = null;
  let audioContext = null;
  let lastHud = 0;
  let muted = false;
  let disposed = false;
  let phase = 'idle';

  const state = {
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    pickups: [],
    rings: [],
    texts: [],
    wave: 0,
    score: 0,
    kills: 0,
    spawnsLeft: 0,
    spawnTimer: 0,
    waveBreak: 0,
    waveIntro: 0,
    shake: 0,
    flash: 0,
    time: 0,
    bestScore: readBest(),
    endless: false, endlessUnlocked: readUnlock(), campaignWon: false,
    plan: wavePlan(1, false), waveCleared: false, waveTotal: 0,
    choices: [], choiceQueue: [], choiceRare: false, afterChoices: 'playing',
    cover: [], zones: [], arcs: [], supply: null, hazardTimer: 8, bossesKilled: 0, mission: null, waveTime: 0, rerolls: 2,
  };

  function loadArt() {
    if (typeof Image === 'undefined') return;
    const batch = ++artBatch;
    art.ready = false;
    art.error = false;
    for (const [key, source] of Object.entries(ART_SOURCES)) {
      const resource = new Image();
      art[key] = resource;
      resource.onload = () => {
        if (disposed || batch !== artBatch) return;
        art.ready = Object.keys(ART_SOURCES).every((id) => art[id]?.complete && art[id].naturalWidth > 0);
        emitState();
      };
      resource.onerror = () => {
        if (disposed || batch !== artBatch) return;
        art.error = true;
        emitState();
      };
      resource.src = source;
    }
    emitState();
  }

  function readBest() {
    try { return Number(localStorage.getItem('neon-siege-best') || 0) || 0; }
    catch { return 0; }
  }
  function readUnlock() {
    try { return localStorage.getItem('neon-exclusion-endless') === '1'; } catch { return false; }
  }

  function saveBest(value) {
    if (value <= state.bestScore) return;
    state.bestScore = value;
    try { localStorage.setItem('neon-siege-best', String(value)); } catch { /* storage optional */ }
  }

  function playerFresh() {
    return {
      x: W / 2, y: H / 2, r: 20, angle: 0,
      health: 100, maxHealth: 100,
      ammo: 28, maxAmmo: 28, reload: 0,
      shootCooldown: 0, dashCooldown: 0, dashTime: 0,
      dashX: 0, dashY: 0, invulnerable: 0, step: 0,
      upgrades: Object.fromEntries(Object.keys(UPGRADES).map((key) => [key, 0])),
      evolutions: [], shield: 0, shieldDelay: 0, droneTimer: 0, reloadDuration: 1.25,
    };
  }

  function reset() {
    state.player = playerFresh();
    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.particles = [];
    state.pickups = [];
    state.rings = [];
    state.texts = [];
    state.wave = 0;
    state.score = 0;
    state.kills = 0;
    state.spawnsLeft = 0;
    state.spawnTimer = 0;
    state.waveBreak = 0;
    state.waveIntro = 0;
    state.shake = 0;
    state.flash = 0;
    state.time = 0;
    state.waveCleared = false;
    state.campaignWon = false;
    state.choices = []; state.choiceQueue = []; state.afterChoices = 'playing';
    state.zones = []; state.arcs = []; state.bossesKilled = 0;
    state.mission = null; state.waveTime = 0; state.rerolls = 2;
    clearInputs();
    beginWave();
    emitState();
  }

  function clearInputs() {
    keys.clear(); mouseDown = false; leftTouch = null; rightTouch = null; pointers.clear();
    virtualMove = { x: 0, y: 0 }; virtualFire = false; virtualAim = null; touchTarget = null;
  }

  function setTouchMove(x, y) {
    if (x || y) virtualTouchMode = true;
    const magnitude = Math.max(1, Math.hypot(x, y));
    virtualMove = phase === 'playing' ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 0 };
  }

  function setTouchFire(active) {
    if (active) virtualTouchMode = true;
    virtualFire = phase === 'playing' && !!active;
    if (!virtualFire) touchTarget = null;
    else { unlockAudio(); aimTouchWeapon(state.player); fireBullet(); }
  }

  function setTouchAim(x, y) {
    if (Math.hypot(x, y) > .15) virtualTouchMode = true;
    virtualAim = Math.hypot(x, y) > .15 ? { x, y } : null;
  }

  function aimTouchWeapon(player) {
    if (virtualAim) { touchTarget = null; player.angle = Math.atan2(virtualAim.y, virtualAim.x); return; }
    const visible = (enemy) => enemy.hp > 0 && enemy.x >= 0 && enemy.x <= W && enemy.y >= 90 && enemy.y <= H &&
      !coverHit(player.x, player.y, enemy.x, enemy.y, 1);
    const distance = (enemy) => Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const nearest = state.enemies.filter(visible).sort((a, b) => distance(a) - distance(b))[0] || null;
    if (!touchTarget || !state.enemies.includes(touchTarget) || !visible(touchTarget) ||
      (nearest && distance(nearest) < distance(touchTarget) * .72)) touchTarget = nearest;
    if (touchTarget) player.angle = Math.atan2(touchTarget.y - player.y, touchTarget.x - player.x);
  }

  function beginWave() {
    state.wave++;
    state.plan = wavePlan(state.wave, state.endless);
    state.waveTotal = state.plan.count + (state.plan.elite ? 1 : 0);
    state.spawnsLeft = state.waveTotal;
    state.spawnTimer = state.plan.boss ? 2.3 : .9;
    state.waveIntro = state.plan.boss ? 2.6 : 1.25;
    state.waveBreak = 0; state.waveCleared = false; state.waveTime = 0;
    state.mission = state.plan.mission ? { type: state.plan.mission, status: 'pending', time: 26, charge: 0 } : null;
    state.enemyBullets = []; state.bullets = []; state.zones = [];
    setupArena();
    state.hazardTimer = 7;
    state.supply = { x: W / 2, y: H - 95, used: false, charge: 0 };
    state.player.invulnerable = Math.max(state.player.invulnerable, 1.1);
    state.rings.push({ x: W / 2, y: H / 2, r: 30, max: 400, life: 1.4, total: 1.4, color: '#46f0e5' });
    sound('wave');
    onEvent({ type: 'wave', wave: state.wave, boss: state.plan.boss, elite: state.plan.elite, name: state.plan.name });
    emitState();
  }

  function snapshot() {
    const p = state.player || playerFresh();
    const boss = state.enemies.find((enemy) => enemy.isBoss);
    const nextBoss = state.wave < 5 ? 5 : state.wave < 10 ? 10 : (Math.floor(state.wave / 5) + 1) * 5;
    return {
      assetsReady: art.ready, assetsError: art.error,
      phase, health: Math.ceil(p.health), maxHealth: p.maxHealth, shield: Math.ceil(p.shield),
      ammo: p.ammo, maxAmmo: p.maxAmmo, wave: state.wave, score: state.score, kills: state.kills,
      dash: clamp(1 - p.dashCooldown / dashDuration(), 0, 1), reloading: p.reload > 0,
      reloadProgress: p.reload > 0 ? 1 - p.reload / p.reloadDuration : 1,
      muted, bestScore: state.bestScore, upgrades: { ...p.upgrades },
      upgradeList: Object.entries(p.upgrades).filter(([, level]) => level > 0).map(([id, level]) =>
        ({ id, ...UPGRADES[id], level, description: upgradeDescription(id, level) })),
      evolutions: p.evolutions.map((id) => ({ id, ...EVOLUTIONS[id] })),
      choices: state.choices.map((choice) => ({ ...choice })), choiceRare: state.choiceRare,
      choicesRemaining: state.choiceQueue.length, endless: state.endless,
      endlessUnlocked: state.endlessUnlocked, elapsed: Math.floor(state.time), bossesKilled: state.bossesKilled,
      boss: boss ? { name: boss.name, health: Math.max(0, boss.hp), maxHealth: boss.maxHp, phase: boss.enraged ? 2 : 1,
        hint: bossHint(boss), parts: state.enemies.filter((e) => e.parent === boss).length } : null,
      rerolls: state.rerolls, canReroll: canReroll(), routes: recipeProgress(), sideMission: missionSnapshot(),
      waveName: state.plan.name, breakSeconds: Math.ceil(state.waveBreak),
      objective: state.waveCleared ? `补给休整 ${Math.ceil(state.waveBreak)} 秒 · 下一波 ${wavePlan(state.wave + 1, true).name}` :
        `${state.plan.name} · ${state.plan.boss ? 'Boss 战' : `距 Boss ${Math.max(0, nextBoss - state.wave)} 波`}`,
      remaining: state.spawnsLeft + state.enemies.filter((e) => !e.optional).length,
    };
  }

  function emitState() { onState(snapshot()); }

  function offerChoice(rare = false) {
    state.choiceQueue.push(rare);
    if (phase === 'playing') openNextChoice();
  }

  function recipeProgress(proposed = null) {
    const upgrades = { ...state.player.upgrades, ...proposed };
    return Object.entries(EVOLUTIONS).map(([id, recipe]) => {
      const requirements = Object.entries(recipe.needs).map(([key, level]) =>
        ({ name: UPGRADES[key].name, current: Math.min(upgrades[key], level), required: level }));
      const missing = requirements.filter((r) => r.current < r.required).map((r) => `${r.name}还差 ${r.required - r.current} 级`);
      return { id, name: recipe.name, color: recipe.color, active: state.player.evolutions.includes(id),
        invested: requirements.reduce((sum, r) => sum + r.current, 0),
        total: requirements.reduce((sum, r) => sum + r.required, 0),
        missing: missing.join(' · ') || '本次选择即可进化', requirements };
    }).sort((a, b) => Number(b.active) - Number(a.active) || b.invested / b.total - a.invested / a.total);
  }

  function generateChoices(rare, excluded = []) {
    const u = state.player.upgrades;
    const available = Object.keys(UPGRADES).filter((id) => u[id] < UPGRADES[id].max && !u[UPGRADES[id].excludes]);
    // Weighted sampling favors completing a build while preserving new options.
    const shuffled = available.map((id) => ({ id, rank: Math.random() })).sort((a, b) => a.rank - b.rank).map((e) => e.id);
    const pool = shuffled.filter((id) => !excluded.includes(id));
    for (const id of shuffled) if (!pool.includes(id)) pool.push(id);
    const selected = [];
    const take = (id) => { if (id && !selected.includes(id)) selected.push(id); };
    const progressing = pool.find((id) => u[id] > 0 && !excluded.includes(id));
    take(progressing);
    const route = recipeProgress().find((r) => !r.active && r.invested > 0 &&
      pool.some((id) => id in EVOLUTIONS[r.id].needs && u[id] < EVOLUTIONS[r.id].needs[id] && !excluded.includes(id)));
    if (route) take(pool.find((id) => id in EVOLUTIONS[route.id].needs &&
      u[id] < EVOLUTIONS[route.id].needs[id] && !selected.includes(id) && !excluded.includes(id)));
    for (const id of pool) { if (selected.length >= 3) break; take(id); }
    return selected.map((id) => {
      const meta = UPGRADES[id], oldLevel = u[id], level = Math.min(meta.max, oldLevel + (rare ? 2 : 1));
      const route = recipeProgress({ [id]: level }).find((r) => id in EVOLUTIONS[r.id].needs && !r.active);
      return { id, name: meta.name, icon: meta.icon, color: meta.color, oldLevel, level, max: meta.max,
        tradeoff: !!meta.tradeoff, description: upgradeDescription(id, level),
        previous: oldLevel ? upgradeDescription(id, oldLevel) : '',
        recipe: route ? `${route.name} · ${route.missing}` : '',
        ready: route && route.invested === route.total };
    });
  }

  function openNextChoice() {
    if (!state.choiceQueue.length) {
      state.choices = []; phase = state.afterChoices;
      if (phase === 'playing') { state.player.invulnerable = Math.max(state.player.invulnerable, .9); canvas.focus({ preventScroll: true }); }
      emitState(); return;
    }
    state.choiceRare = state.choiceQueue.shift();
    state.choices = generateChoices(state.choiceRare);
    if (!state.choices.length) {
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 20);
      state.score += state.choiceRare ? 500 : 150;
      saveBest(state.score); openNextChoice(); return;
    }
    phase = 'choosing'; clearInputs(); emitState();
  }

  function canReroll() {
    const u = state.player.upgrades;
    return phase === 'choosing' && state.rerolls > 0 && Object.keys(UPGRADES).some((id) =>
      u[id] < UPGRADES[id].max && !u[UPGRADES[id].excludes] && !state.choices.some((c) => c.id === id));
  }

  function rerollChoices() {
    if (!canReroll()) return false;
    const old = state.choices.map((c) => c.id);
    const options = generateChoices(state.choiceRare, old);
    if (!options.some((c) => !old.includes(c.id))) return false;
    state.rerolls--; state.choices = options; emitState(); return true;
  }

  function skipChoice() {
    if (phase !== 'choosing') return false;
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 12);
    state.choices = []; clearInputs(); openNextChoice(); return true;
  }

  function chooseUpgrade(id) {
    if (phase !== 'choosing') return false;
    const choice = state.choices.find((option) => option.id === id);
    if (!choice) return false;
    const p = state.player;
    p.upgrades[id] = choice.level;
    if (id === 'magazine') { const capacity = 28 + choice.level * 8; p.ammo += capacity - p.maxAmmo; p.maxAmmo = capacity; }
    if (id === 'shield') p.shield = choice.level * 18;
    for (const [key, recipe] of Object.entries(EVOLUTIONS)) {
      if (!p.evolutions.includes(key) && Object.entries(recipe.needs).every(([type, level]) => p.upgrades[type] >= level)) {
        p.evolutions.push(key);
        onEvent({ type: 'evolution', name: recipe.name, description: recipe.description });
      }
    }
    sound('pickup');
    burst(p.x, p.y, choice.color, 24, 180, 4);
    onEvent({ type: 'upgrade', name: choice.name, level: choice.level, description: choice.description });
    state.choices = []; clearInputs(); lastTime = performance.now();
    openNextChoice(); return true;
  }

  function completeWave() {
    if (state.waveCleared) return;
    state.waveCleared = true; state.waveBreak = state.plan.boss ? 6 : 5;
    state.enemyBullets = []; state.bullets = []; state.zones = [];
    state.enemies = state.enemies.filter((e) => !e.optional);
    if (state.mission && ['active', 'pending'].includes(state.mission.status)) state.mission.status = 'missed';
    state.supply = { x: W / 2, y: H - 95, used: false, charge: 0 };
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 8);
    // Clear rewards and uncollected cores survive the transition into the next wave.
    for (const item of state.pickups) if (item.type === 'core') state.choiceQueue.push(!!item.rare);
    state.pickups = [];
    if (!state.plan.boss && !state.plan.elite) state.choiceQueue.push(false);
    if (!state.endless && state.wave === 10) {
      state.campaignWon = true; state.endlessUnlocked = true; state.afterChoices = 'victory';
      try { localStorage.setItem('neon-exclusion-endless', '1'); } catch { /* storage optional */ }
      saveBest(state.score); onEvent({ type: 'victory' });
    } else state.afterChoices = 'playing';
    clearInputs(); openNextChoice();
  }

  function continueEndless() {
    if (phase !== 'victory') return false;
    state.endless = true; state.afterChoices = 'playing'; state.waveBreak = 2;
    phase = 'playing'; lastTime = performance.now(); canvas.focus({ preventScroll: true }); emitState(); return true;
  }

  function startEndless() { if (!state.endlessUnlocked) return false; start(true); return true; }
  function dashDuration() { return 3.4 * (1 - state.player.upgrades.dash * .15); }

  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || W);
    const cssH = Math.max(1, rect.height || H);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.round(cssW * dpr);
    const nextH = Math.round(cssH * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    drawScale = Math.min(cssW / W, cssH / H);
    drawOffsetX = (cssW - W * drawScale) / 2;
    drawOffsetY = (cssH - H * drawScale) / 2;
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', resize);
  resize();

  function screenPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left - drawOffsetX) / drawScale, 0, W),
      y: clamp((e.clientY - rect.top - drawOffsetY) / drawScale, 0, H),
    };
  }

  function unlockAudio() {
    if (muted) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch { /* browser may disallow sound */ }
  }

  function chirp(freq, duration, type, volume, endFreq = freq) {
    if (muted || !audioContext) return;
    try {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch { /* audio is decorative */ }
  }

  function sound(kind) {
    if (kind === 'shoot') chirp(470, 0.075, 'square', 0.035, 155);
    if (kind === 'hit') chirp(110, 0.16, 'sawtooth', 0.09, 43);
    if (kind === 'enemy') chirp(145, 0.09, 'triangle', 0.045, 60);
    if (kind === 'kill') chirp(270, 0.19, 'sawtooth', 0.045, 65);
    if (kind === 'reload') chirp(320, 0.11, 'triangle', 0.035, 520);
    if (kind === 'dash') chirp(190, 0.2, 'sawtooth', 0.055, 760);
    if (kind === 'wave') { chirp(310, 0.4, 'sine', 0.06, 610); chirp(620, 0.38, 'sine', 0.025, 900); }
    if (kind === 'pickup') chirp(650, 0.2, 'sine', 0.055, 1100);
    if (kind === 'gameover') chirp(260, 0.65, 'sawtooth', 0.07, 55);
  }

  function burst(x, y, color, count = 10, speed = 150, radius = 3) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.22, speed);
      const life = rand(0.18, 0.55);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: rand(radius * 0.4, radius), color, life, total: life });
    }
  }

  function floatText(x, y, value, color = '#f9efac') {
    for (let i = 0; i < 6 && state.texts.some((text) => Math.abs(text.x - x) < 100 && Math.abs(text.y - y) < 20); i++) y -= 20;
    state.texts.push({ x, y, value, color, life: 0.85, total: 0.85 });
  }

  function beginReload() {
    const p = state.player;
    if (!p || p.reload > 0 || p.ammo >= p.maxAmmo || phase !== 'playing') return;
    p.reloadDuration = 1.25 * (1 - p.upgrades.reload * .18);
    p.reload = p.reloadDuration;
    sound('reload');
    onEvent({ type: 'reload' });
    emitState();
  }

  function dash() {
    const p = state.player;
    if (!p || phase !== 'playing' || p.dashCooldown > 0) return;
    let dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    let dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    if (leftTouch) { dx += leftTouch.dx; dy += leftTouch.dy; }
    dx += virtualMove.x; dy += virtualMove.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.15) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    else { dx /= mag; dy /= mag; }
    p.dashX = dx;
    p.dashY = dy;
    p.dashTime = 0.19;
    p.dashCooldown = dashDuration();
    p.invulnerable = Math.max(p.invulnerable, 0.29 + p.upgrades.dash * .03);
    state.rings.push({ x: p.x, y: p.y, r: 12, max: 90, life: 0.35, total: 0.35, color: '#38f8ed' });
    burst(p.x, p.y, '#38f8ed', 16, 230, 4);
    sound('dash');
    onEvent({ type: 'dash' });
    emitState();
  }

  function start(endless = false) {
    if (!art.ready) return false;
    unlockAudio();
    state.endless = endless === true;
    phase = 'playing';
    reset();
    canvas.focus({ preventScroll: true });
    lastTime = performance.now();
    emitState();
  }

  function pause() {
    if (phase !== 'playing') return;
    phase = 'paused';
    clearInputs();
    emitState();
  }

  function resume() {
    if (phase !== 'paused') return;
    phase = 'playing';
    state.player.invulnerable = Math.max(state.player.invulnerable, .9);
    canvas.focus({ preventScroll: true });
    lastTime = performance.now();
    emitState();
  }

  function restart() { start(); }
  function togglePause() { if (phase === 'playing') pause(); else if (phase === 'paused') resume(); }
  function toggleMute() { muted = !muted; if (!muted) unlockAudio(); emitState(); return muted; }

  function onKeyDown(e) {
    if (['Space','Enter'].includes(e.code) && e.target?.closest?.('button,summary,input,textarea,select,a')) return;
    virtualTouchMode = false;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (phase === 'choosing' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      e.preventDefault(); if (!e.repeat) chooseUpgrade(state.choices[Number(e.code.slice(-1)) - 1]?.id); return;
    }
    keys.add(e.code);
    if (e.repeat) return;
    unlockAudio();
    if (e.code === 'Space') dash();
    if (e.code === 'KeyR') beginReload();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'Enter' && (phase === 'idle' || phase === 'gameover')) { e.preventDefault(); start(); }
  }

  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); if (phase === 'playing') pause(); }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      virtualTouchMode = false;
      const pos = screenPos(e);
      mouseX = pos.x; mouseY = pos.y; mouseDown = true;
      state.player.angle = Math.atan2(mouseY - state.player.y, mouseX - state.player.x);
      fireBullet();
    } else {
      virtualTouchMode = true;
      const pos = screenPos(e);
      canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { startX: pos.x, startY: pos.y, x: pos.x, y: pos.y });
      if (pos.x < W * 0.48 && !leftTouch) leftTouch = { id: e.pointerId, x: pos.x, y: pos.y, startX: pos.x, startY: pos.y, dx: 0, dy: 0 };
      else if (!rightTouch) rightTouch = { id: e.pointerId, x: pos.x, y: pos.y, startX: pos.x, startY: pos.y };
    }
    unlockAudio();
    e.preventDefault();
  }

  function onPointerMove(e) {
    const pos = screenPos(e);
    if (e.pointerType === 'mouse') { mouseX = pos.x; mouseY = pos.y; virtualTouchMode = false; }
    const touch = pointers.get(e.pointerId);
    if (!touch) return;
    touch.x = pos.x; touch.y = pos.y;
    if (leftTouch?.id === e.pointerId) {
      leftTouch.x = pos.x; leftTouch.y = pos.y;
      const dx = pos.x - leftTouch.startX;
      const dy = pos.y - leftTouch.startY;
      const mag = Math.max(1, Math.hypot(dx, dy));
      const power = Math.min(mag / 58, 1);
      leftTouch.dx = dx / mag * power;
      leftTouch.dy = dy / mag * power;
    }
    if (rightTouch?.id === e.pointerId) { rightTouch.x = pos.x; rightTouch.y = pos.y; }
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (e.pointerType === 'mouse') mouseDown = false;
    else {
      pointers.delete(e.pointerId);
      if (leftTouch?.id === e.pointerId) leftTouch = null;
      if (rightTouch?.id === e.pointerId) rightTouch = null;
    }
  }

  function onContextMenu(e) { e.preventDefault(); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouseDown = false; });
  canvas.addEventListener('contextmenu', onContextMenu);

  function spawnEnemy(forcedType, options = {}) {
    const side = options.side ?? Math.floor(rand(0, 4));
    let type = forcedType || 'runner';
    if (!forcedType) {
      const pool = state.plan.pool;
      type = pool[Math.floor(Math.random() * pool.length)] || 'runner';
    }
    const isBoss = type === 'boss' || type === 'elite';
    const stats = {
      runner: { r: 21, hp: 36, speed: 103, color: '#f6577b', worth: 100 },
      gunner: { r: 25, hp: 55, speed: 74, color: '#bd81ff', worth: 160 },
      brute: { r: 33, hp: 120, speed: 56, color: '#ffae62', worth: 260 },
      charger: { r: 22, hp: 60, speed: 115, color: '#ff7b5d', worth: 180 },
      splitter: { r: 26, hp: 75, speed: 80, color: '#95e88c', worth: 200 },
      sniper: { r: 23, hp: 52, speed: 65, color: '#ed92d5', worth: 220 },
      pylon: { r: 19, hp: 380 + Math.max(0, state.wave - 10) * 65, speed: 0, color: '#b7afff', worth: 250 },
      elite: { r: 40, hp: 850 + Math.max(0, state.wave - 3) * 240, speed: 65, color: '#ffcc78', worth: 1000 },
      boss: { r: state.wave >= 10 ? 65 : 54, hp: state.wave === 5 ? 4200 : 10000 + Math.max(0, state.wave - 10) * 2000,
        speed: 47, color: state.wave >= 10 ? '#ff94ac' : '#ffdf87', worth: state.wave >= 10 ? 5000 : 2500 },
    }[type];
    const scale = 1 + (state.wave - 1) * .10 + Math.max(0, state.wave - 6) * .055;
    const hp = isBoss ? stats.hp : stats.hp * scale;
    const e = { ...stats, type, isBoss, hp, maxHp: hp,
      x: options.x ?? (isBoss ? W / 2 : side === 0 ? 140 : side === 1 ? W - 140 : [480, 640, 820][Math.floor(rand(0, 3))]),
      y: options.y ?? (isBoss ? 230 : side === 2 ? 130 : side === 3 ? H - 70 : [240, 360, 460][Math.floor(rand(0, 3))]),
      speed: stats.speed * (1 + Math.min(.025 * state.wave, .28)), fireTimer: isBoss ? 1.7 : rand(.8, 2.2),
      phase: rand(0, TAU), spin: rand(-2, 2), hitFlash: 0, contactTimer: 0,
      telegraph: 0, dashTime: 0, slowTimer: 0, slowFactor: 1, attackIndex: 0, enraged: false, recovery: 0, parent: options.parent || null, orbit: options.orbit || 0, detour: Math.random() < .5 ? -1 : 1,
      name: type === 'elite' ? '哨戒先驱 · 精英' : state.wave >= 10 ? '封锁主宰 · 终局 Boss' : '钢铁暴君 · Boss',
    };
    if (options.small) { e.r = 12; e.hp = e.maxHp = 22 * scale; e.speed = 160; e.worth = 40; }
    state.enemies.push(e);
    if (type === 'boss' && state.wave >= 10) {
      for (let i = 0; i < 2; i++) spawnEnemy('pylon', { x: e.x + (i ? -110 : 110), y: e.y, parent: e, orbit: i * Math.PI });
    }
    if (isBoss) onEvent({ type: 'boss', name: e.name });
    return e;
  }

  function projectile(x, y, angle, damage, options = {}) {
    const u = state.player.upgrades;
    const drone = options.drone;
    const b = { x, y, vx: Math.cos(angle) * 950, vy: Math.sin(angle) * 950,
      r: drone ? 3.3 : 4.5 * (1 + u.heavy * .3), life: 1.2, damage,
      trail: [], piercesLeft: drone ? 0 : u.pierce + (state.player.evolutions.includes('rail') ? 2 : 0),
      bounces: drone ? 0 : u.ricochet + (state.player.evolutions.includes('rail') ? 2 : 0),
      hitEnemies: new Set(), drone, exploded: false,
      color: drone ? '#a4ffe6' : state.player.evolutions.includes('siege') ? '#ffb06d' :
        state.player.evolutions.includes('storm') ? '#a8bfff' : u.pierce ? '#9bf1ff' : u.heavy ? '#ffd177' : '#c6eaff' };
    state.bullets.push(b); return b;
  }

  function fireBullet() {
    const p = state.player, u = p.upgrades;
    if (phase !== 'playing' || p.shootCooldown > 0 || p.reload > 0) return;
    if (p.ammo <= 0) { beginReload(); return; }
    p.shootCooldown = .105 * Math.pow(.89, u.rapid) * (u.overload ? 1.28 : 1) * (u.accelerator ? .70 : 1); p.ammo--;
    const spread = rand(-.02, .02), damage = 28 * (1 + u.heavy * .18) / (1 + u.multi * .25) * (u.overload ? 1.7 : 1) * (u.accelerator ? .84 : 1);
    for (let shot = -u.multi; shot <= u.multi; shot++) {
      const angle = p.angle + spread + shot * .14;
      const bullet = projectile(p.x + Math.cos(angle) * 49, p.y + Math.sin(angle) * 49, angle, damage);
      // Trace the barrel as well as the flight on the first frame.
      bullet.origin = { x: p.x, y: p.y };
    }
    burst(p.x + Math.cos(p.angle) * 52, p.y + Math.sin(p.angle) * 52, '#ffe6a4', 4, 85, 2.5);
    state.shake = Math.max(state.shake, 1.5); sound('shoot');
    if (p.ammo <= 0) beginReload();
  }

  function fireEnemyBullet(enemy, angle, speed = 265) {
    state.enemyBullets.push({ x: enemy.x + Math.cos(angle) * enemy.r,
      y: enemy.y + Math.sin(angle) * enemy.r,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: enemy.type === 'boss' ? 7 : 5.5, life: 4,
      damage: enemy.type === 'boss' ? 16 : 12,
      color: enemy.type === 'boss' ? '#ffe287' : '#c388ff' });
  }

  function hurtPlayer(amount, x, y) {
    const p = state.player;
    if (!p || p.invulnerable > 0 || phase !== 'playing') return;
    p.shieldDelay = 8;
    const absorbed = Math.min(p.shield, amount);
    p.shield -= absorbed;
    p.health = Math.max(0, p.health - (amount - absorbed));
    p.invulnerable = 0.65;
    state.flash = 0.34;
    state.shake = Math.max(state.shake, 8);
    burst(x, y, '#ff627e', 18, 220, 4);
    state.rings.push({ x: p.x, y: p.y, r: 20, max: 85, life: 0.35, total: 0.35, color: '#ff627e' });
    sound('hit');
    onEvent({ type: 'hit', health: p.health });
    emitState();
    if (p.health <= 0) {
      phase = 'gameover';
      clearInputs();
      saveBest(state.score);
      sound('gameover');
      onEvent({ type: 'gameover', score: state.score, wave: state.wave, kills: state.kills, bestScore: state.bestScore });
      emitState();
    }
  }

  function damageEnemy(enemy, damage) {
    if (enemy.hp <= 0 || !state.enemies.includes(enemy)) return;
    if (enemy.type === 'boss') {
      if (enemy.recovery > 0) damage *= 1.45;
      else damage *= 1 - state.enemies.filter((e) => e.parent === enemy).length * .175;
    }
    enemy.hp -= damage; enemy.hitFlash = .11;
    if (enemy.hp <= 0) killEnemy(enemy, state.enemies.indexOf(enemy));
  }

  function killEnemy(enemy, index) {
    if (index < 0) return;
    state.enemies.splice(index, 1); state.score += enemy.worth; state.kills++;
    saveBest(state.score);
    burst(enemy.x, enemy.y, enemy.color, enemy.isBoss ? 50 : 18, enemy.isBoss ? 270 : 180, enemy.isBoss ? 6 : 4);
    state.rings.push({ x: enemy.x, y: enemy.y, r: enemy.r, max: enemy.isBoss ? 220 : 85,
      life: .47, total: .47, color: enemy.color });
    floatText(enemy.x, enemy.y - enemy.r, `+${enemy.worth}`);
    state.shake = Math.max(state.shake, enemy.isBoss ? 12 : 3);
    if (enemy.type === 'splitter' && state.enemies.length < state.plan.cap - 1) {
      for (const offset of [-20, 20]) spawnEnemy('runner', { x: enemy.x + offset, y: enemy.y, small: true });
    }
    if (Math.random() < (state.player.health < 50 ? .16 : .055) || enemy.isBoss) {
      state.pickups.push({ type: 'health', x: clamp(enemy.x - 18, 45, W - 45), y: clamp(enemy.y, 95, H - 45), r: 12, life: 16, phase: 0 });
    }
    if (enemy.type !== 'pylon' && (enemy.isBoss || Math.random() < .12)) {
      state.pickups.push({ type: 'core', rare: enemy.isBoss, x: clamp(enemy.x + 18, 45, W - 45),
        y: clamp(enemy.y, 95, H - 45), r: 17, life: enemy.isBoss ? Infinity : 25, phase: 0 });
    }
    if (enemy.parent) { onEvent({ type: 'partBroken' }); floatText(enemy.x, enemy.y - 35, '部件摧毁', '#b7afff'); }
    if (state.mission?.target === enemy && state.mission.status === 'active') rewardMission();
    if (enemy.isBoss) {
      state.enemies = state.enemies.filter((e) => e.parent !== enemy);
      state.bossesKilled++; onEvent({ type: 'bossDefeated', name: enemy.name }); }
    sound('kill'); onEvent({ type: 'kill', score: state.score, kills: state.kills, enemy: enemy.type });
    emitState();
  }

  function setupArena() {
    const layout = state.wave % 3;
    state.cover = layout === 1 ? [{ x: 300, y: 265, w: 70, h: 125 }, { x: 910, y: 335, w: 70, h: 125 }] :
      layout === 2 ? [{ x: 350, y: 225, w: 130, h: 55 }, { x: 800, y: 440, w: 130, h: 55 }] :
      [{ x: 260, y: 330, w: 110, h: 60 }, { x: 910, y: 330, w: 110, h: 60 }, { x: 590, y: 220, w: 100, h: 45 }];
    state.cover.push(...PERIMETER_COVER.map((rect) => ({ ...rect, scenery: true })));
    resolveCover(state.player);
  }

  function resolveCover(entity) {
    let collided = false;
    for (const rect of state.cover) {
      const nx = clamp(entity.x, rect.x, rect.x + rect.w), ny = clamp(entity.y, rect.y, rect.y + rect.h);
      let dx = entity.x - nx, dy = entity.y - ny, distance = Math.hypot(dx, dy);
      if (distance >= entity.r) continue;
      collided = true;
      if (distance < .001) {
        const exits = [
          { d: Math.abs(entity.x - rect.x), x: rect.x - entity.r, y: entity.y },
          { d: Math.abs(entity.x - rect.x - rect.w), x: rect.x + rect.w + entity.r, y: entity.y },
          { d: Math.abs(entity.y - rect.y), x: entity.x, y: rect.y - entity.r },
          { d: Math.abs(entity.y - rect.y - rect.h), x: entity.x, y: rect.y + rect.h + entity.r },
        ].sort((a, b) => a.d - b.d);
        entity.x = exits[0].x; entity.y = exits[0].y;
      } else { entity.x += dx / distance * (entity.r - distance); entity.y += dy / distance * (entity.r - distance); }
    }
    return collided;
  }

  function coverHit(ax, ay, bx, by, radius = 0) {
    let nearest = null;
    for (const rect of state.cover) {
      // Slab intersection catches fast projectiles crossing the whole cover in one frame.
      const dx = bx - ax, dy = by - ay;
      let enter = 0, exit = 1;
      for (const [origin, delta, min, max] of [[ax, dx, rect.x - radius, rect.x + rect.w + radius], [ay, dy, rect.y - radius, rect.y + rect.h + radius]]) {
        if (Math.abs(delta) < .00001) { if (origin < min || origin > max) { enter = 2; break; } }
        else { const a = (min - origin) / delta, b = (max - origin) / delta; enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b)); }
      }
      if (enter <= exit && enter >= 0 && enter <= 1 && (!nearest || enter < nearest.t)) nearest = { rect, t: enter };
    }
    return nearest;
  }

  let navigationCover = null;
  const navigationGraphs = new Map();
  function navigationPath(enemy) {
    // Reuse cover-corner visibility graphs per body size; only endpoints move.
    if (navigationCover !== state.cover) { navigationCover = state.cover; navigationGraphs.clear(); }
    const radius = enemy.r + 2;
    let graph = navigationGraphs.get(radius);
    const clear = (a,b) => !coverHit(a.x,a.y,b.x,b.y,radius);
    if (!graph) {
      const nodes = state.cover.flatMap((rect) => {
        const margin = radius + 3;
        return [[rect.x-margin,rect.y-margin],[rect.x+rect.w+margin,rect.y-margin],
          [rect.x-margin,rect.y+rect.h+margin],[rect.x+rect.w+margin,rect.y+rect.h+margin]]
          .map(([x,y])=>({x,y}));
      }).filter((node)=>node.x>=24 && node.x<=W-24 && node.y>=100 && node.y<=H-24 && clear(node,node));
      const edges=nodes.map(()=>[]);
      for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)if(clear(nodes[i],nodes[j])) {
        const cost=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);
        edges[i].push([j,cost]);edges[j].push([i,cost]);
      }
      graph={nodes,edges};navigationGraphs.set(radius,graph);
    }
    const anchor=(point)=> {
      if(clear(point,point))return {x:point.x,y:point.y};
      const candidates=state.cover.flatMap((rect)=>[
        {x:rect.x-radius-3,y:point.y},{x:rect.x+rect.w+radius+3,y:point.y},
        {x:point.x,y:rect.y-radius-3},{x:point.x,y:rect.y+rect.h+radius+3},
      ]).concat(graph.nodes).filter((node)=>node.x>=24 && node.x<=W-24 && node.y>=100 && node.y<=H-24 && clear(node,node));
      return candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0] || point;
    };
    const goal=anchor(state.player), origin=anchor(enemy);
    const nodes=[...graph.nodes,origin,goal], start=nodes.length-2, end=nodes.length-1;
    const edges=graph.edges.map((edge)=>[...edge]);edges.push([],[]);
    for(const index of [start,end])for(let i=0;i<index;i++)if(clear(nodes[index],nodes[i])) {
      const cost=Math.hypot(nodes[index].x-nodes[i].x,nodes[index].y-nodes[i].y);
      edges[index].push([i,cost]);edges[i].push([index,cost]);
    }
    const costs=nodes.map(()=>Infinity),previous=[],visited=new Set();costs[start]=0;
    while(visited.size<nodes.length) {
      let current=-1;
      for(let i=0;i<nodes.length;i++)if(!visited.has(i) && (current<0 || costs[i]<costs[current]))current=i;
      if(current<0 || !Number.isFinite(costs[current]) || current===end)break;
      visited.add(current);
      for(const [next,cost] of edges[current])if(costs[current]+cost<costs[next]){costs[next]=costs[current]+cost;previous[next]=current;}
    }
    if(!Number.isFinite(costs[end]))return [];
    const route=[];let current=end;
    while(current!==start){route.unshift({x:nodes[current].x,y:nodes[current].y});current=previous[current];}
    if(Math.hypot(origin.x-enemy.x,origin.y-enemy.y)>1)route.unshift({x:origin.x,y:origin.y});
    return route;
  }

  function moveEnemy(enemy, vx, vy, dt) {
    const p=state.player;
    const approaching=vx*(p.x-enemy.x)+vy*(p.y-enemy.y)>0;
    enemy.navTimer=Math.max(0,(enemy.navTimer||0)-dt);
    if(approaching && !(enemy.dashTime>0) && coverHit(enemy.x,enemy.y,p.x,p.y,enemy.r+2)) {
      if(!enemy.navTimer || !enemy.navPath){enemy.navPath=navigationPath(enemy);enemy.navTimer=.65;}
      while(enemy.navPath.length && Math.hypot(enemy.navPath[0].x-enemy.x,enemy.navPath[0].y-enemy.y)<9)enemy.navPath.shift();
      const waypoint=enemy.navPath[0];
      if(waypoint){const dx=waypoint.x-enemy.x,dy=waypoint.y-enemy.y,d=Math.hypot(dx,dy)||1,speed=Math.hypot(vx,vy);vx=dx/d*speed;vy=dy/d*speed;}
    } else enemy.navPath=null;
    const slow = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
    enemy.x += vx * dt * slow; enemy.y += vy * dt * slow;
    if (resolveCover(enemy)) {
      if (enemy.dashTime > 0) { enemy.dashTime = 0; enemy.fireTimer = 1; }
      else if (Math.abs(vx) >= Math.abs(vy)) enemy.y += enemy.detour * enemy.speed * dt;
      else enemy.x += enemy.detour * enemy.speed * dt;
      resolveCover(enemy);
    }
    enemy.x = clamp(enemy.x, 24, W - 24);
    enemy.y = clamp(enemy.y, 100, H - 24);
  }

  function missionSnapshot() {
    const m = state.mission;
    if (!m || m.status === 'pending') return null;
    const names = { cache: '限时补给箱', bounty: '悬赏精英', relay: '重启中继站' };
    return { type: m.type, status: m.status, name: names[m.type], seconds: Math.ceil(m.time),
      progress: m.type === 'bounty' ? 1 - (m.target?.hp || 0) / (m.target?.maxHp || 1) : m.charge / (m.type === 'relay' ? 3 : .8),
      action: m.type === 'bounty' ? '击败金色标记目标' : `靠近并停留 ${m.type === 'relay' ? '3' : '0.8'} 秒`,
      reward: m.type === 'relay' || m.type === 'bounty' && state.wave >= 9 ? '稀有核心 + 600 分' : '强化核心 + 300 分' };
  }

  function rewardMission() {
    const m = state.mission;
    if (!m || m.status !== 'active') return;
    m.status = 'complete';
    const rare = m.type === 'relay' || m.type === 'bounty' && state.wave >= 9;
    state.score += rare ? 600 : 300;
    if (m.type === 'cache') {
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 15);
      state.player.ammo = state.player.maxAmmo; state.player.reload = 0;
    }
    state.player.invulnerable = Math.max(state.player.invulnerable, 1);
    saveBest(state.score); sound('pickup');
    onEvent({ type: 'missionComplete', rare, cache: m.type === 'cache' });
    state.afterChoices = 'playing'; offerChoice(rare);
  }

  function updateMission(dt) {
    if (state.waveCleared) return;
    state.waveTime += dt;
    const m = state.mission;
    if (!m || !['pending', 'active'].includes(m.status)) return;
    if (m.status === 'pending') {
      if (state.waveTime < 4) return;
      const p = state.player;
      const spots = [{ x: 210, y: 205 }, { x: 1070, y: 240 }, { x: 470, y: 570 }, { x: 850, y: 570 }]
        .sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y));
      Object.assign(m, spots[0], { status: 'active' });
      if (m.type === 'bounty') {
        m.target = spawnEnemy(state.wave >= 9 ? 'charger' : 'brute', { x: m.x, y: m.y });
        m.target.hp *= 1.6; m.target.maxHp = m.target.hp; m.target.optional = true;
        m.target.color = '#ffe094'; m.target.speed *= 1.12;
      }
      onEvent({ type: 'missionStart', name: missionSnapshot().name });
    }
    m.time = Math.max(0, m.time - dt);
    if (m.time <= 0) { m.status = 'missed'; onEvent({ type: 'missionMissed' }); return; }
    if (m.type !== 'bounty') {
      const close = Math.hypot(state.player.x - m.x, state.player.y - m.y) < 47;
      m.charge = close ? m.charge + dt : Math.max(0, m.charge - dt * .4);
      if (m.charge >= (m.type === 'relay' ? 3 : .8)) rewardMission();
    }
  }

  function updateWorld(dt) {
    const p = state.player;
    p.shieldDelay = Math.max(0, p.shieldDelay - dt);
    if (p.upgrades.shield && p.shieldDelay <= 0) p.shield = Math.min(p.upgrades.shield * 18, p.shield + dt * 7);
    updateMission(dt);
    if (phase !== 'playing') return;
    if (state.wave >= 4 && !state.waveCleared && !state.plan.boss) {
      state.hazardTimer -= dt;
      if (state.hazardTimer <= 0) {
        state.zones.push({ x: clamp(p.x, 100, W - 100), y: clamp(p.y, 155, H - 100), r: 62 + Math.min(25, state.wave * 2), warn: 1.3, life: 2, damage: 10 });
        state.hazardTimer = Math.max(4.5, 10 - state.wave * .4);
      }
    }
    for (let i = state.zones.length - 1; i >= 0; i--) {
      const zone = state.zones[i];
      if (zone.warn > 0) zone.warn -= dt;
      else {
        zone.life -= dt;
        const hit = zone.kind === 'beam' ? segmentDistanceSquared(zone.x, zone.y, zone.bx, zone.by, p.x, p.y) < (zone.r + p.r - 3) ** 2 &&
          !coverHit(zone.x, zone.y, p.x, p.y, 0) : Math.hypot(zone.x - p.x, zone.y - p.y) < zone.r + p.r;
        if (hit) hurtPlayer(zone.damage, p.x, p.y);
      }
      if (zone.life <= 0) state.zones.splice(i, 1);
    }
    const supply = state.supply;
    if (supply && !supply.used) {
      const needed = p.health < p.maxHealth || p.ammo < p.maxAmmo;
      if (needed && Math.hypot(supply.x - p.x, supply.y - p.y) < 40) {
        supply.charge += dt;
        if (supply.charge >= 1.2) { supply.used = true; p.health = Math.min(p.maxHealth, p.health + 20); p.ammo = p.maxAmmo; p.reload = 0;
          onEvent({ type: 'supply' }); sound('pickup'); emitState(); }
      } else supply.charge = 0;
    }
    if (p.upgrades.drone) {
      p.droneTimer -= dt;
      if (p.droneTimer <= 0 && state.enemies.length) {
        const count = (p.upgrades.drone >= 3 ? 2 : 1) + (p.evolutions.includes('swarm') ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const x = p.x + Math.cos(state.time * 1.8 + i * Math.PI) * 48;
          const y = p.y + Math.sin(state.time * 1.8 + i * Math.PI) * 48;
          if (coverHit(p.x, p.y, x, y, 3.3)) continue;
          const target = state.enemies.filter((e) => e.hp > 0 && !coverHit(x, y, e.x, e.y, 3.3))
            .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
          if (target) projectile(x, y, Math.atan2(target.y - y, target.x - x), 14 + p.upgrades.drone * 6, { drone: true });
        }
        p.droneTimer = .9 / (1 + p.upgrades.drone * .3) * (p.evolutions.includes('swarm') ? .75 : 1);
      }
    }
    for (let i = state.arcs.length - 1; i >= 0; i--) { state.arcs[i].life -= dt; if (state.arcs[i].life <= 0) state.arcs.splice(i, 1); }
  }

  function update(dt) {
    const p = state.player;
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 30);
    state.flash = Math.max(0, state.flash - dt);
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) { p.reload = 0; p.ammo = p.maxAmmo; sound('reload'); emitState(); }
    }

    let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    let my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    if (leftTouch) { mx += leftTouch.dx; my += leftTouch.dy; }
    mx += virtualMove.x; my += virtualMove.y;
    const moveMag = Math.hypot(mx, my);
    if (moveMag > 1) { mx /= moveMag; my /= moveMag; }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashX * 970 * dt;
      p.y += p.dashY * 970 * dt;
      if (Math.random() < 0.75) burst(p.x - p.dashX * 14, p.y - p.dashY * 14, '#37e9e6', 2, 85, 4);
    } else {
      p.x += mx * 260 * dt;
      p.y += my * 260 * dt;
    }
    resolveCover(p);
    p.x = clamp(p.x, 35, W - 35);
    p.y = clamp(p.y, 95, H - 35);
    if (moveMag > 0.05) p.step += dt * 15;

    if (virtualFire) {
      aimTouchWeapon(p);
    } else if (rightTouch) {
      const stickX = rightTouch.x - rightTouch.startX;
      const stickY = rightTouch.y - rightTouch.startY;
      if (Math.hypot(stickX, stickY) > 10) p.angle = Math.atan2(stickY, stickX);
      else p.angle = Math.atan2(rightTouch.y - p.y, rightTouch.x - p.x);
    } else if (virtualTouchMode) {
      if (Math.hypot(virtualMove.x, virtualMove.y) > .1) p.angle = Math.atan2(virtualMove.y, virtualMove.x);
    } else {
      p.angle = Math.atan2(mouseY - p.y, mouseX - p.x);
    }
    if (mouseDown || rightTouch || virtualFire || keys.has('KeyJ')) fireBullet();

    if (state.waveIntro > 0) state.waveIntro -= dt;
    if (state.waveCleared) {
      state.waveBreak -= dt;
      if (state.waveBreak <= 0) beginWave();
    } else if (state.spawnsLeft > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const side = Math.floor(Math.random() * 4);
        const slots = Math.max(0, state.plan.cap - state.enemies.length);
        const count = Math.min(state.plan.group, state.spawnsLeft, slots);
        for (let i = 0; i < count; i++) {
          const type = state.plan.boss ? 'boss' : state.plan.elite && state.spawnsLeft === 1 ? 'elite' :
            state.plan.pool[(state.waveTotal - state.spawnsLeft) % state.plan.pool.length];
          spawnEnemy(type, { side });
          state.spawnsLeft--;
        }
        state.spawnTimer = count ? state.plan.interval * rand(.85, 1.15) : .25;
      }
    }
    updateBullets(dt);
    if (phase !== 'playing') return;
    updateEnemies(dt);
    if (phase !== 'playing') return;
    updateEnemyBullets(dt);
    if (phase !== 'playing') return;
    updateWorld(dt);
    if (phase !== 'playing') return;
    updatePickups(dt);
    updateEffects(dt);
    if (phase !== 'playing') return;
    if (!state.waveCleared && state.spawnsLeft === 0 && state.enemies.every((e) => e.optional)) completeWave();
    lastHud += dt;
    if (lastHud >= .08) { emitState(); lastHud = 0; }
  }

  function bulletImpact(b, enemy) {
    const p = state.player, u = p.upgrades;
    const wasFrozen = enemy.slowTimer > 0;
    if (!b.drone && u.freeze) { enemy.slowTimer = 1 + u.freeze * .4; enemy.slowFactor = 1 - u.freeze * .15; }
    const frostBonus = !b.drone && p.evolutions.includes('frost') && wasFrozen ? 1.3 : 1;
    damageEnemy(enemy, b.damage * frostBonus);
    if (!b.drone && u.explosive && !b.exploded) {
      b.exploded = true;
      const evolved = p.evolutions.includes('siege'), radius = evolved ? 145 : 50 + u.explosive * 18;
      const amount = b.damage * (evolved ? .95 : .4 + u.explosive * .12);
      state.rings.push({ x: enemy.x, y: enemy.y, r: 8, max: radius, life: .3, total: .3, color: '#ffb06d' });
      for (const target of [...state.enemies]) if (target !== enemy && Math.hypot(target.x - enemy.x, target.y - enemy.y) < radius + target.r) damageEnemy(target, amount);
    }
    if (!b.drone && u.chain) {
      const evolved = p.evolutions.includes('storm'), used = new Set([enemy]);
      let from = enemy;
      for (let i = 0; i < u.chain + (evolved ? 2 : 0); i++) {
        const target = state.enemies.filter((e) => !used.has(e) && Math.hypot(e.x - from.x, e.y - from.y) < (evolved ? 220 : 145))
          .sort((a, e) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(e.x - from.x, e.y - from.y))[0];
        if (!target) break;
        state.arcs.push({ ax: from.x, ay: from.y, bx: target.x, by: target.y, life: .16 });
        used.add(target); damageEnemy(target, b.damage * (.36 + u.chain * .1)); from = target;
      }
    }
    burst(enemy.x, enemy.y, enemy.color, 4, 95, 3); sound('enemy');
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i], oldX = b.origin?.x ?? b.x, oldY = b.origin?.y ?? b.y;
      b.origin = null;
      if (!b.drone && state.player.upgrades.homing && state.enemies.length) {
        const target = state.enemies.filter((e) => e.hp > 0 && !b.hitEnemies.has(e) && !coverHit(b.x, b.y, e.x, e.y, b.r))
          .sort((a, e) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(e.x - b.x, e.y - b.y))[0];
        if (target) {
          const angle = Math.atan2(b.vy, b.vx), desired = Math.atan2(target.y - b.y, target.x - b.x);
          const difference = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
          const maxTurn = dt * (2 + state.player.upgrades.homing + (state.player.evolutions.includes('frost') ? 2 : 0));
          const turn = clamp(difference, -maxTurn, maxTurn);
          b.vx = Math.cos(angle + turn) * 950; b.vy = Math.sin(angle + turn) * 950;
        }
      }
      b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 4) b.trail.shift();
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { state.bullets.splice(i, 1); continue; }
      const dx = b.x - oldX, dy = b.y - oldY;
      const cover = coverHit(oldX, oldY, b.x, b.y, b.r);
      let stop = cover ? { t: cover.t, rect: cover.rect } : null;
      for (const [origin, delta, min, max, axis] of [[oldX, dx, 18, W-18, 'x'], [oldY, dy, 85, H-18, 'y']]) {
        const end = origin + delta;
        if ((end < min || end > max) && Math.abs(delta) > .00001) {
          const time = clamp(((end < min ? min : max) - origin) / delta, 0, 1);
          if (!stop || time < stop.t) stop = { t: time, axis };
        }
      }
      const lengthSquared = dx * dx + dy * dy;
      const hits = state.enemies.filter((e) => e.hp > 0 && !b.hitEnemies.has(e)).map((enemy) => {
        const ex = oldX - enemy.x, ey = oldY - enemy.y, radius = b.r + enemy.r;
        const c = ex*ex + ey*ey - radius*radius, dot = ex*dx + ey*dy;
        const discriminant = dot*dot - lengthSquared*c;
        const time = c <= 0 ? 0 : lengthSquared > 0 && discriminant >= 0 ? (-dot-Math.sqrt(discriminant))/lengthSquared : Infinity;
        return { enemy, t: time };
      }).filter((hit) => hit.t >= 0 && hit.t <= 1 && (!stop || hit.t < stop.t)).sort((a,b) => a.t-b.t);
      let consumed = false;
      for (const {enemy} of hits) {
        if (!state.enemies.includes(enemy)) continue;
        b.hitEnemies.add(enemy); bulletImpact(b, enemy);
        if (b.piercesLeft <= 0) { state.bullets.splice(i, 1); consumed = true; break; }
        b.piercesLeft--;
      }
      if (consumed || !stop) continue;
      if (b.bounces <= 0) { state.bullets.splice(i, 1); continue; }
      b.bounces--;
      const impactX=oldX+dx*stop.t, impactY=oldY+dy*stop.t;
      let axis=stop.axis;
      if (stop.rect) {
        const rect=stop.rect;
        const xEdge=Math.min(Math.abs(impactX-rect.x+b.r),Math.abs(impactX-rect.x-rect.w-b.r));
        const yEdge=Math.min(Math.abs(impactY-rect.y+b.r),Math.abs(impactY-rect.y-rect.h-b.r));
        axis=xEdge<yEdge?'x':'y';
      }
      if (axis==='x') b.vx*=-1; else b.vy*=-1;
      b.x=impactX-dx*.0001;b.y=impactY-dy*.0001;
    }
  }

  function bossHint(enemy) {
    if (enemy.type === 'elite') return '精英 · 留意冲锋路线';
    if (enemy.recovery > 0) return '装甲过热 · 受到伤害 +45%';
    const parts = state.enemies.filter((e) => e.parent === enemy).length;
    if (parts) return `护卫部件 ${parts}/2 · 当前减伤 ${parts * 17.5}%`;
    return state.wave >= 10 ? '激光可借掩体躲避 · 警戒圈内会轰炸' : '横向闪避冲撞 · 过热时集中攻击';
  }

  function updateBoss(enemy, dt) {
    const p = state.player, final = enemy.type === 'boss' && state.wave >= 10;
    if (!enemy.enraged && enemy.hp <= enemy.maxHp * .5) {
      enemy.enraged = true;
      state.rings.push({ x: enemy.x, y: enemy.y, r: enemy.r, max: 260, life: .8, total: .8, color: enemy.color });
      onEvent({ type: 'bossPhase', name: enemy.name }); emitState();
    }
    if (enemy.recovery > 0) { enemy.recovery = Math.max(0, enemy.recovery - dt); return; }
    if (enemy.dashTime > 0) {
      enemy.dashTime -= dt;
      moveEnemy(enemy, Math.cos(enemy.attackAngle) * 640, Math.sin(enemy.attackAngle) * 640, dt);
      const boundary = enemy.x <= enemy.r + 20 || enemy.x >= W - enemy.r - 20 || enemy.y <= 105 || enemy.y >= H - enemy.r - 20;
      enemy.x = clamp(enemy.x, enemy.r + 20, W - enemy.r - 20); enemy.y = clamp(enemy.y, 105, H - enemy.r - 20);
      if (boundary || enemy.dashTime <= 0) { enemy.dashTime = 0; enemy.recovery = 1.8; }
      return;
    }
    if (enemy.telegraph > 0) {
      enemy.telegraph -= dt;
      if (enemy.telegraph <= 0) {
        if (enemy.attack === 'charge') enemy.dashTime = .7;
        else if (enemy.attack === 'summon') {
          const count = enemy.enraged ? 4 : 2;
          for (let i = 0; i < count && state.enemies.length < state.plan.cap; i++) {
            const angle = i * TAU / count;
            spawnEnemy(i % 2 ? 'gunner' : 'runner', { x: clamp(enemy.x + Math.cos(angle) * 110, 60, W - 60), y: clamp(enemy.y + Math.sin(angle) * 110, 110, H - 60) });
          }
          enemy.recovery = 1.2;
        } else if (enemy.attack === 'ring') {
          // A visible safe wedge remains between the two marked radial boundaries.
          for (let i = 0; i < 20; i++) {
            const a = enemy.attackAngle + i * TAU / 20;
            const difference = Math.atan2(Math.sin(a - enemy.safeAngle), Math.cos(a - enemy.safeAngle));
            if (Math.abs(difference) > .42) fireEnemyBullet(enemy, a, 210);
          }
          enemy.recovery = 1.5;
        } else if (!['beam', 'bombard', 'slam'].includes(enemy.attack)) {
          const half = enemy.enraged ? 4 : 3;
          for (let i = -half; i <= half; i++) fireEnemyBullet(enemy, enemy.attackAngle + i * .17, enemy.enraged ? 320 : 265);
          enemy.recovery = .9;
        } else enemy.recovery = enemy.attack === 'beam' ? 2.3 : 1.6;
        enemy.fireTimer = enemy.enraged ? .85 : 1.35;
      }
      return;
    }
    const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
    if (Math.hypot(p.x - enemy.x, p.y - enemy.y) > 280) moveEnemy(enemy, Math.cos(angle) * enemy.speed, Math.sin(angle) * enemy.speed, dt);
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0) {
      const attacks = final ? (enemy.enraged ? ['beam','bombard','ring','summon'] : ['beam','bombard','summon']) :
        enemy.type === 'elite' ? ['fan','charge'] : ['fan','charge','slam','charge'];
      enemy.attack = attacks[enemy.attackIndex++ % attacks.length];
      enemy.attackAngle = angle;
      enemy.telegraph = enemy.attack === 'beam' ? 1.45 : enemy.attack === 'bombard' ? 1.4 : 1.05;
      if (enemy.attack === 'beam') {
        state.zones.push({ kind: 'beam', x: enemy.x, y: enemy.y,
          bx: enemy.x + Math.cos(angle) * 1500, by: enemy.y + Math.sin(angle) * 1500,
          r: enemy.enraged ? 30 : 23, warn: 1.45, totalWarn: 1.45, life: .8, damage: 23 });
      } else if (enemy.attack === 'bombard') {
        for (let i = 0; i < (enemy.enraged ? 4 : 3); i++) {
          state.zones.push({ x: clamp(p.x + (i - 1) * 140, 90, W - 90), y: clamp(p.y + (i % 2) * 95, 170, H - 80),
            r: 72, warn: 1.4, totalWarn: 1.4, life: 1.1, damage: 20 });
        }
      } else if (enemy.attack === 'slam') {
        state.zones.push({ x: enemy.x, y: enemy.y, r: 160, warn: 1.05, totalWarn: 1.05, life: .45, damage: 22 });
      } else if (enemy.attack === 'ring') enemy.safeAngle = angle + Math.PI / 2;
    }
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of [...state.enemies]) {
      if (!state.enemies.includes(e)) continue;
      e.phase += dt * (e.spin || 1); e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.contactTimer = Math.max(0, e.contactTimer - dt); e.slowTimer = Math.max(0, e.slowTimer - dt);
      const dx = p.x - e.x, dy = p.y - e.y, distance = Math.max(1, Math.hypot(dx, dy)), nx = dx / distance, ny = dy / distance;
      if (e.type === 'pylon') {
        if (!state.enemies.includes(e.parent)) continue;
        const orbit = state.time * .65 + e.orbit;
        e.x = clamp(e.parent.x + Math.cos(orbit) * 115, 40, W - 40);
        e.y = clamp(e.parent.y + Math.sin(orbit) * 85, 110, H - 40);
        continue;
      }
      if (e.isBoss) updateBoss(e, dt);
      else if (e.type === 'charger') {
        if (e.dashTime > 0) { e.dashTime -= dt; moveEnemy(e, Math.cos(e.attackAngle) * 460, Math.sin(e.attackAngle) * 460, dt); }
        else if (e.telegraph > 0) { e.telegraph -= dt; if (e.telegraph <= 0) e.dashTime = .45; }
        else { moveEnemy(e, nx * e.speed, ny * e.speed, dt); e.fireTimer -= dt;
          if (e.fireTimer <= 0 && distance < 460) { e.telegraph = .75; e.attack = 'charge'; e.attackAngle = Math.atan2(dy, dx); e.fireTimer = 3; } }
      } else if (e.type === 'gunner' || e.type === 'sniper') {
        const sniper = e.type === 'sniper', preferred = sniper ? 410 : 260;
        const direction = distance > preferred + 20 ? 1 : distance < preferred - 45 ? -.65 : 0;
        moveEnemy(e, (nx * direction - ny * .15) * e.speed, (ny * direction + nx * .15) * e.speed, dt);
        if (e.telegraph > 0) { e.telegraph -= dt; if (e.telegraph <= 0) fireEnemyBullet(e, e.attackAngle, 550); }
        else { e.fireTimer -= dt; if (e.fireTimer <= 0 && distance < 700) {
          if (sniper) { e.telegraph = .8; e.attack = 'snipe'; e.attackAngle = Math.atan2(dy, dx); }
          else fireEnemyBullet(e, Math.atan2(dy, dx), 290 + Math.min(60, state.wave * 4));
          e.fireTimer = sniper ? 2.8 : Math.max(1, 2 - state.wave * .06);
        } }
      } else moveEnemy(e, nx * e.speed, ny * e.speed, dt);
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r - 4 && e.contactTimer <= 0) {
        hurtPlayer((e.isBoss ? 24 : e.type === 'brute' ? 18 : 10) * (1 + state.wave * .025), p.x, p.y); e.contactTimer = .9;
      }
    }
    for (let i = 0; i < state.enemies.length; i++) for (let j = i + 1; j < state.enemies.length; j++) {
      const a = state.enemies[i], b = state.enemies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const overlap = a.r + b.r + 3 - d;
      if (overlap > 0) { const push = Math.min(overlap * .2, 3); a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; resolveCover(a); resolveCover(b); }
    }
    for (const e of state.enemies) { e.x = clamp(e.x, 24, W - 24); e.y = clamp(e.y, 100, H - 24); }
  }

  function updateEnemyBullets(dt) {
    const p = state.player;
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
      const b = state.enemyBullets[i];
      const oldX = b.x, oldY = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (coverHit(oldX, oldY, b.x, b.y, b.r) || b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) {
        state.enemyBullets.splice(i, 1); continue;
      }
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r - 3) {
        state.enemyBullets.splice(i, 1);
        hurtPlayer(b.damage, b.x, b.y);
      }
    }
  }

  function updatePickups(dt) {
    const p = state.player;
    let pickedCore = false;
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const item = state.pickups[i]; item.life -= dt; item.phase += dt * 3;
      if (item.life <= 0) { state.pickups.splice(i, 1); continue; }
      const distance = Math.hypot(item.x - p.x, item.y - p.y);
      if (distance < 95 && distance > 1) { const step = Math.min(distance, dt * 175); item.x += (p.x - item.x) / distance * step; item.y += (p.y - item.y) / distance * step; }
      if (distance < p.r + item.r + 8) {
        state.pickups.splice(i, 1);
        if (item.type === 'core') { state.choiceQueue.push(!!item.rare); pickedCore = true; }
        else { const restored = Math.min(25, p.maxHealth - p.health); p.health += restored;
          floatText(item.x, item.y - 20, `+${restored} HP`, '#7dffbc'); onEvent({ type: 'pickup', health: p.health }); }
        sound('pickup'); burst(item.x, item.y, item.rare ? '#ffcf7d' : '#a9a4ff', 16, 155, 3);
      }
    }
    if (pickedCore) { state.afterChoices = 'playing'; openNextChoice(); }
  }

  function updateEffects(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const q = state.particles[i];
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= Math.pow(0.04, dt); q.vy *= Math.pow(0.04, dt);
      q.life -= dt;
      if (q.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.rings.length - 1; i >= 0; i--) {
      state.rings[i].life -= dt;
      if (state.rings[i].life <= 0) state.rings.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i--) {
      state.texts[i].y -= 34 * dt;
      state.texts[i].life -= dt;
      if (state.texts[i].life <= 0) state.texts.splice(i, 1);
    }
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function drawFloor() {
    if (art.floor?.complete && art.floor.naturalWidth > 0) {
      ctx.drawImage(art.floor, 0, 0, W, H);
      return;
    }
    ctx.fillStyle = '#4b607a';
    ctx.fillRect(0, 0, W, H);
  }

  function drawUnitSprite(id, x, y, angle, width, opacity = 1) {
    if (!art.units?.complete || !art.units.naturalWidth) return false;
    const frame = ART_FRAMES[id];
    const height = width * frame.h / frame.w;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = opacity;
    ctx.drawImage(art.units, frame.x, frame.y, frame.w, frame.h,
      -width * frame.pivot, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  function drawPlayer(p, time) {
    const blink = p.invulnerable > 0 && !reducedMotion?.matches && Math.floor(time * 17) % 2 === 0;
    if (art.rover?.complete && art.rover.naturalWidth > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = blink ? .7 : 1;
      // The chassis mount (530, 367) and turret pivot (1190, 423) share the player origin.
      // Chassis orientation stays fixed; aim rotates only the separate turret/barrel layer.
      ctx.drawImage(art.rover, 120, 180, 630, 530, -41, -18.7, 63, 53);
      ctx.rotate(p.angle);
      ctx.drawImage(art.rover, 1020, 315, 660, 215, -17, -10.8, 66, 21.5);
      ctx.restore();
    }
    if (p.reload > 0) {
      ctx.strokeStyle = '#a6ddff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 35, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.reload / p.reloadDuration));
      ctx.stroke();
    }
  }

  function drawEnemy(enemy) {
    const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
    let sprite = enemy.type;
    if (enemy.type === 'elite') sprite = 'brute';
    if (enemy.type === 'boss' && state.wave >= 10) sprite = 'finalBoss';
    drawUnitSprite(sprite, enemy.x, enemy.y, angle, enemy.r * 3.15);
    if (enemy.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = enemy.hitFlash / .11 * .2;
      ctx.fillStyle = '#f4faff';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (enemy.slowTimer > 0 || enemy.enraged) {
      ctx.strokeStyle = enemy.enraged ? '#ff7799' : '#a3eaff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r + 5, 0, TAU);
      ctx.stroke();
    }
    if (enemy.recovery > 0 && enemy.type === 'boss') {
      ctx.fillStyle = '#ffcf87';
      ctx.font = '600 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('过热 · 易伤', enemy.x, enemy.y - enemy.r - 15);
    }
    if (enemy.optional && state.mission?.status === 'active') {
      ctx.strokeStyle = '#ffe094';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r + 9, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ffe094';
      ctx.font = '600 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('悬赏目标', enemy.x, enemy.y - enemy.r - 20);
    }
    if (!enemy.isBoss) {
      const width = enemy.r * 1.8;
      roundRect(enemy.x - width / 2, enemy.y - enemy.r - 13, width, 3, 1, 'rgba(8,18,31,.7)');
      roundRect(enemy.x - width / 2, enemy.y - enemy.r - 13,
        width * clamp(enemy.hp / enemy.maxHp, 0, 1), 3, 1, enemy.color);
    }
  }

  function drawPlayerAmmo(p) {
    if (phase === 'idle') return;
    const iconScale = clamp(0.48 / drawScale, 0.65, 1.1);
    const x = p.x + 40 + 25 * iconScale < W - 14 ? p.x + 40 : p.x - 40 - 25 * iconScale;
    const y = clamp(p.y + 12, 92, H - 48 * iconScale - 18);
    const remaining = clamp(p.ammo / p.maxAmmo, 0, 1);
    const magazinePath = () => {
      ctx.beginPath(); ctx.roundRect(1, 3, 13, 38, 1.5);
    };
    ctx.save();
    ctx.translate(x, y); ctx.scale(iconScale, iconScale);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    magazinePath(); ctx.fillStyle = '#08151feb'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = p.ammo <= 7 ? '#efa275' : '#83cdff';
    ctx.fillRect(1, 3 + 38 * (1 - remaining), 13, 38 * remaining);
    ctx.strokeStyle = 'rgba(222,246,240,.4)'; ctx.lineWidth = 1.3;
    for (const rib of [12, 20, 28, 36]) {
      ctx.beginPath(); ctx.moveTo(4, rib); ctx.lineTo(11, rib); ctx.stroke();
    }
    ctx.restore();
    magazinePath(); ctx.strokeStyle = p.reload > 0 ? '#78e6f0' : '#d2e7fa'; ctx.lineWidth = 1.8; ctx.stroke();
    roundRect(0, 0, 15, 4, 1, '#354e69', ctx.strokeStyle);
    roundRect(0, 40, 15, 3, 1, '#354e69', ctx.strokeStyle);
    ctx.restore();
  }

  function drawEffects() {
    ctx.save();
    ctx.lineCap = 'round';
    for (const bullet of [...state.bullets, ...state.enemyBullets]) {
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const length = 10 + bullet.r * 1.4;
      const tailX = bullet.x - bullet.vx / speed * length;
      const tailY = bullet.y - bullet.vy / speed * length;
      ctx.strokeStyle = bullet.color;
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 6;
      ctx.lineWidth = Math.max(1.8, bullet.r * .55);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#f2fbff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    for (const q of state.particles) {
      ctx.globalAlpha = clamp(q.life / q.total, 0, 1);
      ctx.fillStyle=q.color; ctx.fillRect(q.x-q.r/2,q.y-q.r/2,q.r,q.r);
    }
    ctx.globalAlpha=1;
    for (const ring of state.rings) {
      const progress = clamp(1-ring.life/ring.total, 0, 1);
      const r=ring.r+(ring.max-ring.r)*progress;
      ctx.globalAlpha=(1-progress)*.7; ctx.strokeStyle=ring.color; ctx.lineWidth=3*(1-progress)+.5;
      ctx.beginPath(); ctx.arc(ring.x,ring.y,r,0,TAU); ctx.stroke();
    }
    ctx.globalAlpha=1;
    for (const item of state.pickups) {
      const bob=Math.sin(item.phase)*4;
      const upgrade = item.type === 'core' ? { name: item.rare ? '稀有强化核心' : '强化核心', icon: '✦', color: item.rare ? '#ffcf7d' : '#b4a3ff' } : UPGRADES[item.type];
      const color = upgrade ? upgrade.color : '#a4ffdc';
      const size = upgrade ? 15 : 11;
      ctx.save(); ctx.translate(item.x,item.y+bob); ctx.rotate(Math.PI/4);
      ctx.globalAlpha = item.life < 3 ? .45 + .55 * Math.abs(Math.sin(item.life * 7)) : 1;
      ctx.shadowColor=color;ctx.shadowBlur=18;
      ctx.lineWidth=2;
      roundRect(-size,-size,size*2,size*2,5,'#142c3b',color);
      ctx.shadowBlur=0;ctx.rotate(-Math.PI/4);
      ctx.fillStyle=color;
      if (upgrade) {
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 25px system-ui, sans-serif';
        ctx.fillText(upgrade.icon,0,0);
        ctx.font='700 12px system-ui, sans-serif';ctx.textBaseline='alphabetic';
        ctx.lineWidth=4;ctx.strokeStyle='#07121c';ctx.strokeText(upgrade.name,0,35);ctx.fillText(upgrade.name,0,35);
      } else { ctx.fillRect(-2,-7,4,14);ctx.fillRect(-7,-2,14,4); }
      ctx.restore();
    }
    for (const q of state.texts) {
      ctx.globalAlpha=clamp(q.life/q.total,0,1);
      ctx.font='700 16px Inter, system-ui, sans-serif';ctx.textAlign='center';ctx.fillStyle=q.color;
      ctx.shadowColor=q.color;ctx.shadowBlur=12;ctx.fillText(q.value,q.x,q.y);ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;
  }

  function drawCrosshair() {
    if (!state.player || rightTouch || virtualTouchMode) return;
    const x=mouseX, y=mouseY;
    ctx.save();ctx.translate(x,y);ctx.rotate(state.time*.4);
    ctx.strokeStyle='rgba(190,225,255,.8)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(0,0,13,0,TAU);ctx.stroke();
    for (let i=0;i<4;i++) { ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(26,0);ctx.stroke(); }
    ctx.fillStyle='#e3fff7';ctx.beginPath();ctx.arc(0,0,2,0,TAU);ctx.fill();ctx.restore();
  }

  function drawTouch() {
    if (virtualFire && touchTarget && !virtualAim && state.enemies.includes(touchTarget)) {
      ctx.save(); ctx.strokeStyle = '#ffd391bb'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(touchTarget.x, touchTarget.y, touchTarget.r + 9, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (leftTouch) {
      ctx.strokeStyle='rgba(99,249,229,.45)';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(leftTouch.startX,leftTouch.startY,58,0,TAU);ctx.stroke();
      ctx.fillStyle='rgba(99,249,229,.25)';ctx.beginPath();
      ctx.arc(leftTouch.startX+leftTouch.dx*45,leftTouch.startY+leftTouch.dy*45,25,0,TAU);ctx.fill();
    }
    if (rightTouch) {
      ctx.strokeStyle='rgba(255,205,128,.65)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(rightTouch.x,rightTouch.y,23,0,TAU);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rightTouch.x-30,rightTouch.y);ctx.lineTo(rightTouch.x-16,rightTouch.y);
      ctx.moveTo(rightTouch.x+16,rightTouch.y);ctx.lineTo(rightTouch.x+30,rightTouch.y);ctx.stroke();
    }
  }

  function drawAnnouncements() {
    if (phase !== 'playing') return;
    const boss = state.enemies.find((enemy) => enemy.isBoss);
    if (state.waveIntro > 0 && !boss && state.plan.boss) {
      const duration = 2.6;
      ctx.globalAlpha = clamp(Math.min(state.waveIntro, duration - state.waveIntro) * 2, 0, .8);
      ctx.textAlign='center'; ctx.fillStyle='#ffad9c';
      ctx.font='800 11px system-ui, sans-serif';
      ctx.fillText('BOSS INCOMING · 首领正在接近', W/2, 130);
      ctx.font='900 28px system-ui, sans-serif';
      ctx.fillText(state.wave >= 10 ? '终局封锁' : '钢铁暴君', W/2, 166);
      ctx.globalAlpha=1;
    } else if (state.waveCleared && state.waveBreak > 0) {
      ctx.textAlign='center'; ctx.font='700 13px system-ui, sans-serif'; ctx.fillStyle='#89f5e4';
      ctx.fillText(`战场肃清 · ${Math.ceil(state.waveBreak)} 秒后进入下一波`,W/2,155);
    }
  }

  function drawWorldFeatures() {
    ctx.save();
    for (const zone of state.zones) {
      const warning = zone.warn > 0;
      ctx.fillStyle = warning ? 'rgba(255,180,93,.08)' : 'rgba(255,76,101,.24)';
      ctx.strokeStyle = warning ? '#ffca7c' : '#ff6e88'; ctx.lineWidth = warning ? 2 : 3;
      if (zone.kind === 'beam') {
        const angle = Math.atan2(zone.by-zone.y,zone.bx-zone.x);
        ctx.save();ctx.translate(zone.x,zone.y);ctx.rotate(angle);
        ctx.fillRect(0,-zone.r,1500,zone.r*2);ctx.strokeRect(0,-zone.r,1500,zone.r*2);
        ctx.font='700 12px system-ui';ctx.fillStyle=ctx.strokeStyle;ctx.fillText(warning?'激光预警 · 借掩体躲避':'激光',120,-zone.r-8);
        ctx.restore();continue;
      }
      ctx.beginPath(); ctx.arc(zone.x,zone.y,zone.r,0,TAU); ctx.fill(); ctx.stroke();
      ctx.font='700 12px system-ui, sans-serif';ctx.textAlign='center';ctx.fillStyle=ctx.strokeStyle;
      ctx.fillText(warning ? '轰炸预警' : '危险区域',zone.x,zone.y+4);
      if (warning) { ctx.beginPath();ctx.arc(zone.x,zone.y,zone.r*.7,0,TAU*clamp(1-zone.warn/(zone.totalWarn || 1.3),0,1));ctx.stroke(); }
    }
    if (art.units?.complete && art.units.naturalWidth) {
      for (const rect of state.cover) {
        if (rect.scenery) continue;
        const frame = ART_FRAMES[rect.w >= rect.h ? 'coverWide' : 'coverTall'];
        ctx.drawImage(art.units, frame.x, frame.y, frame.w, frame.h,
          rect.x - 5, rect.y - 8, rect.w + 10, rect.h + 17);
      }
    }
    const mission=state.mission;
    if (mission?.status === 'active' && mission.type !== 'bounty') {
      ctx.strokeStyle='#ffd890';ctx.lineWidth=2;
      roundRect(mission.x-21,mission.y-18,42,36,4,'#3a3220','#ffd890');
      ctx.fillStyle='#ffe5b1';ctx.font='800 18px system-ui';ctx.textAlign='center';ctx.fillText(mission.type==='relay'?'ϟ':'✦',mission.x,mission.y+6);
      ctx.font='700 12px system-ui';ctx.fillText(`${mission.type==='relay'?'中继站':'补给箱'} · ${Math.ceil(mission.time)}s`,mission.x,mission.y+40);
      ctx.beginPath();ctx.arc(mission.x,mission.y,31,-Math.PI/2,-Math.PI/2+TAU*clamp(mission.charge/(mission.type==='relay'?3:.8),0,1));ctx.stroke();
    }
    const supply = state.supply;
    if (supply) {
      if (art.units?.complete && art.units.naturalWidth) {
        const frame = ART_FRAMES.coverWide;
        ctx.save();
        ctx.globalAlpha = supply.used ? .5 : 1;
        ctx.drawImage(art.units, frame.x, frame.y, frame.w, frame.h,
          supply.x - 27, supply.y - 19, 54, 36);
        ctx.restore();
      }
      ctx.fillStyle = supply.used ? '#8a9db0' : '#ccecff';
      ctx.fillRect(supply.x - 2, supply.y - 10, 4, 15);
      ctx.fillRect(supply.x - 7, supply.y - 5, 14, 4);
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(supply.used ? '补给耗尽' : '补给 · 停留 1.2 秒', supply.x, supply.y + 34);
      if (supply.charge > 0 && !supply.used) {
        ctx.strokeStyle = '#b9e7ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(supply.x, supply.y, 31, -Math.PI / 2, -Math.PI / 2 + TAU * supply.charge / 1.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTelegraphs() {
    ctx.save();
    for (const e of state.enemies) {
      if (e.telegraph <= 0) continue;
      const angle=e.attackAngle;
      ctx.strokeStyle=e.type==='sniper' ? '#ff8ed5' : '#ffce84';ctx.lineWidth=2;ctx.fillStyle='rgba(255,185,92,.09)';
      if(e.attack==='charge') {
        ctx.save();ctx.translate(e.x,e.y);ctx.rotate(angle);
        ctx.fillRect(0,-e.r,560,e.r*2);ctx.strokeRect(0,-e.r,560,e.r*2);
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(560,0);ctx.stroke();ctx.restore();
      } else if(e.attack==='snipe') {
        ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(angle)*1000,e.y+Math.sin(angle)*1000);ctx.stroke();
      } else if(e.attack==='ring') {
        ctx.fillStyle='rgba(115,240,181,.12)';ctx.strokeStyle='#83edb1';
        ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,420,e.safeAngle-.42,e.safeAngle+.42);ctx.closePath();ctx.fill();ctx.stroke();
      } else if(e.attack==='fan') {
        ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,220,angle-.65,angle+.65);ctx.closePath();ctx.fill();ctx.stroke();
      } else if(e.attack==='summon') {ctx.beginPath();ctx.arc(e.x,e.y,100,0,TAU);ctx.stroke();}
    }
    ctx.restore();
  }

  function drawCompanions() {
    const p=state.player;
    ctx.save();
    if(p.shield>0) {
      ctx.strokeStyle='#82d9ff';ctx.lineWidth=2.5;ctx.globalAlpha=.35+.5*p.shield/(p.upgrades.shield*18);
      ctx.beginPath();ctx.arc(p.x,p.y,37,0,TAU);ctx.stroke();ctx.globalAlpha=1;
    }
    if(p.upgrades.drone) {
      const count=(p.upgrades.drone>=3?2:1)+(p.evolutions.includes('swarm')?1:0);
      for(let i=0;i<count;i++) {
        const x=p.x+Math.cos(state.time*1.8+i*Math.PI)*48,y=p.y+Math.sin(state.time*1.8+i*Math.PI)*48;
        polygon([[x-8,y],[x,y-7],[x+8,y],[x,y+7]],'#2d527e','#bde4ff',1.5);
        ctx.fillStyle='#e2f4ff';ctx.fillRect(x-2,y-2,4,4);
      }
    }
    for(const arc of state.arcs) {
      ctx.strokeStyle='#bdd7ff';ctx.lineWidth=2;ctx.globalAlpha=clamp(arc.life/.16,0,1);
      ctx.beginPath();ctx.moveTo(arc.ax,arc.ay);ctx.lineTo((arc.ax+arc.bx)/2+7,(arc.ay+arc.by)/2-9);ctx.lineTo(arc.bx,arc.by);ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    resize();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#33465d';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(dpr*drawScale,0,0,dpr*drawScale,dpr*drawOffsetX,dpr*drawOffsetY);
    ctx.save();
    if (state.shake>0 && phase==='playing' && !reducedMotion?.matches) ctx.translate(rand(-state.shake,state.shake),rand(-state.shake,state.shake));
    drawFloor(state.time);
    drawWorldFeatures();
    drawTelegraphs();
    if (state.player) {
      for (const enemy of state.enemies) drawEnemy(enemy);
      drawPlayer(state.player,state.time);
      drawEffects();
      drawCompanions();
      drawCrosshair();
      drawTouch();
      drawAnnouncements();
    }
    ctx.restore();
    if (state.flash>0) {ctx.fillStyle=`rgba(255,64,89,${state.flash*.23})`;ctx.fillRect(0,0,W,H);}
    const vignette=ctx.createRadialGradient(W/2,H/2,200,W/2,H/2,750);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(8,21,39,.045)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    if (state.player) drawPlayerAmmo(state.player);
  }

  function frame(time) {
    if (disposed) return;
    const dt=clamp((time-lastTime)/1000||0,0,0.033);
    lastTime=time;
    if (phase==='playing') update(dt);
    else if (phase==='idle') state.time+=dt*.5;
    draw();
    raf=requestAnimationFrame(frame);
  }

  function destroy() {
    if (disposed) return;
    disposed=true;
    cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    window.removeEventListener('resize',resize);
    window.removeEventListener('keydown',onKeyDown);
    window.removeEventListener('keyup',onKeyUp);
    window.removeEventListener('blur',onBlur);
    canvas.removeEventListener('pointerdown',onPointerDown);
    canvas.removeEventListener('pointermove',onPointerMove);
    canvas.removeEventListener('pointerup',onPointerUp);
    canvas.removeEventListener('pointercancel',onPointerUp);
    canvas.removeEventListener('contextmenu',onContextMenu);
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  }

  state.player=playerFresh();
  loadArt();
  emitState();
  raf=requestAnimationFrame(frame);
  return { start, startEndless, continueEndless, chooseUpgrade, rerollChoices, skipChoice, pause, resume, restart, dash, reload: beginReload,
    setTouchMove, setTouchFire, setTouchAim, togglePause, toggleMute, destroy,
    retryAssets: loadArt, getState: snapshot };
}
