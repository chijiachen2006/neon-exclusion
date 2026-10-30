const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const events = [], stored = new Map();
const gradient = { addColorStop() {} };
const ctx = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  arc(x, y, radius) { assert.ok(radius >= 0, 'Canvas arcs need a nonnegative radius'); } },
  { get(target, name) { return name in target ? target[name] : () => {}; } });
class Canvas { getContext() { return ctx; } getBoundingClientRect() { return { width: 1280, height: 720 }; }
  addEventListener() {} removeEventListener() {} focus() {} }
let seed = 17, frameCallback;
const math = Object.create(Math); math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const env = { HTMLCanvasElement: Canvas, Math: math, console, performance: { now: () => 0 },
  window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} },
  localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
  requestAnimationFrame: (callback) => { frameCallback = callback; return 1; }, cancelAnimationFrame() {} };
let source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8').replace('export function mountGame', 'function mountGame');
source = source.replace('  state.player=playerFresh();', `  globalThis.test = { state, update, beginWave, completeWave, spawnEnemy, damageEnemy, fireBullet,
    projectile, bulletImpact, updateBullets, updatePickups, updateBoss, updateWorld, updateEnemyBullets,
    coverHit, resolveCover, offerChoice, openNextChoice, hurtPlayer, draw, UPGRADES, wavePlan };\n  state.player=playerFresh();`);
vm.createContext(env); vm.runInContext(source + '\nglobalThis.mountGame = mountGame;', env);
const game = env.mountGame(new Canvas(), { onEvent: (event) => events.push(event) }), t = env.test, s = t.state;
assert.equal(Object.keys(t.UPGRADES).length, 16);
assert.equal(game.startEndless(), false);
game.start(); assert.equal(game.getState().wave, 1); assert.ok(s.cover.length >= 2);
env.performance.now = () => 100;
game.start(); frameCallback(0); assert.equal(s.time, 0, 'An older first animation timestamp cannot run the game backwards');
assert.ok(t.wavePlan(8, false).group > t.wavePlan(2, false).group);
assert.ok(t.wavePlan(9, false).cap > t.wavePlan(1, false).cap);
s.pickups = [{ type: 'core', x: s.player.x, y: s.player.y, r: 17, life: 20, phase: 0 }];
t.updatePickups(0); assert.equal(game.getState().phase, 'choosing');
assert.equal(game.getState().choices.length, 3); assert.equal(new Set(game.getState().choices.map((c) => c.id)).size, 3);
assert.equal(game.chooseUpgrade('invalid-upgrade'), false);
const selected = game.getState().choices[0]; game.chooseUpgrade(selected.id);
assert.equal(game.getState().upgrades[selected.id], 1); assert.equal(game.getState().phase, 'playing');
t.offerChoice(true); const rare = game.getState().choices[0]; game.chooseUpgrade(rare.id);
assert.equal(game.getState().upgrades[rare.id], rare.level); assert.ok(rare.level - rare.oldLevel <= 2);
const grant = (id, level) => {
  t.offerChoice(false); s.choices = [{ id, name: t.UPGRADES[id].name, color: t.UPGRADES[id].color, level, description: '' }];
  assert.equal(game.chooseUpgrade(id), true);
};
game.start(); grant('heavy', 3); grant('explosive', 3); assert.ok(s.player.evolutions.includes('siege'));
grant('rapid', 3); grant('chain', 3); assert.ok(s.player.evolutions.includes('storm'));
grant('pierce', 3); grant('ricochet', 3); assert.ok(s.player.evolutions.includes('rail'));
grant('magazine', 2); assert.equal(s.player.maxAmmo, 44); assert.equal(s.player.ammo, 44);
grant('reload', 3); s.player.ammo = 2; game.reload(); assert.ok(s.player.reloadDuration < .6);
t.update(.61); assert.equal(s.player.ammo, 44);
grant('shield', 3); const health = s.player.health; s.player.invulnerable = 0; t.hurtPlayer(20, 640, 360);
assert.equal(s.player.health, health); assert.equal(s.player.shield, 34);
game.start(); s.cover = []; grant('multi', 2); grant('heavy', 1); grant('rapid', 2);
t.fireBullet(); assert.equal(s.bullets.length, 5); assert.equal(s.player.ammo, 27); assert.ok(s.bullets[0].r > 4.5);
assert.ok(s.player.shootCooldown < .105);
game.start(); s.cover = [];
const enemy = (x, y) => { const e = t.spawnEnemy('runner', { x, y }); e.hp = e.maxHp = 1000; return e; };
const near = enemy(230, 300), middle = enemy(260, 300), far = enemy(290, 300);
s.player.upgrades.pierce = 1;
const bullet = t.projectile(200, 300, 0, 28); t.updateBullets(.1);
assert.equal(near.hp, 972); assert.equal(middle.hp, 972); assert.equal(far.hp, 1000);
assert.equal(s.bullets.length, 0);
s.enemies = []; s.bullets = []; const target = enemy(500, 400), neighbor = enemy(530, 425);
s.player.upgrades.explosive = 1; s.player.upgrades.freeze = 2;
t.bulletImpact(t.projectile(450, 400, 0, 20), target);
assert.ok(neighbor.hp < 1000); assert.ok(target.slowTimer > 0 && target.slowFactor < 1);
s.enemies = []; s.bullets = []; s.player.upgrades.explosive = 0; s.player.upgrades.chain = 2;
const a = enemy(500, 400), b = enemy(620, 400), c = enemy(740, 400);
t.bulletImpact(t.projectile(450, 400, 0, 10), a); assert.ok(b.hp < 1000 && c.hp < 1000); assert.equal(s.arcs.length, 2);
s.player.upgrades.ricochet = 1; s.bullets = []; const reflected = t.projectile(20, 200, Math.PI, 10);
t.updateBullets(.02); assert.ok(reflected.vx > 0 && s.bullets.includes(reflected));
s.enemies = []; s.bullets = []; enemy(650, 600); s.player.upgrades.homing = 1;
const homing = t.projectile(600, 400, 0, 10); t.updateBullets(.02); assert.ok(homing.vy > 0);
s.player.upgrades.drone = 3; const ammo = s.player.ammo; t.updateWorld(1);
assert.equal(s.player.ammo, ammo); assert.ok(s.bullets.filter((b) => b.drone).length === 2);
game.start(); s.player.x = 330; s.player.y = 300; t.resolveCover(s.player);
assert.ok(s.player.x <= 280 || s.player.x >= 390 || s.player.y <= 245 || s.player.y >= 410);
assert.ok(t.coverHit(200, 300, 500, 300));
s.enemyBullets = [{ x: 250, y: 300, vx: 1000, vy: 0, r: 5, life: 4, damage: 10 }]; t.updateEnemyBullets(.15);
assert.equal(s.enemyBullets.length, 0);
// Runs inside the deterministic VM harness prepared from verify-v2.cjs.
game.start();
assert.equal(t.wavePlan(6, false).cap < t.wavePlan(4, false).cap, true, 'Wave 6 gives recovery after Boss');
assert.ok(t.wavePlan(9, false).pool.includes('charger') && t.wavePlan(9, false).pool.includes('sniper'));
assert.equal(new Set(Array.from({length:10},(_,i)=>t.wavePlan(i+1,false).name)).size,10);

// Offers help advance a chosen build and never offer capped/conflicting upgrades.
game.start(); s.player.upgrades.heavy=1; t.offerChoice();
assert.ok(game.getState().choices.some(c=>c.id==='heavy'));
assert.ok(game.getState().choices.some(c=>c.id==='explosive'));
const oldCards=game.getState().choices.map(c=>c.id);
assert.equal(game.rerollChoices(),true);assert.equal(game.getState().rerolls,1);
assert.ok(game.getState().choices.some(c=>!oldCards.includes(c.id)));
assert.equal(game.rerollChoices(),true);assert.equal(game.rerollChoices(),false);
s.player.health=50;game.skipChoice();assert.equal(s.player.health,62);
game.start(); grant('overload',1);
for(let i=0;i<30;i++) {
  t.offerChoice();assert.ok(!game.getState().choices.some(c=>c.id==='accelerator'||c.id==='overload'));
  game.skipChoice();
}
t.fireBullet();assert.ok(Math.abs(s.bullets[0].damage-47.6)<1e-8);assert.ok(s.player.shootCooldown>.105);
game.start();grant('accelerator',1);t.fireBullet();assert.ok(s.bullets[0].damage<28 && s.player.shootCooldown<.08);
game.start();grant('freeze',3);grant('homing',2);assert.ok(s.player.evolutions.includes('frost'));
s.cover=[];const chilled=enemy(500,400);
t.bulletImpact(t.projectile(450,400,0,20),chilled);assert.equal(chilled.hp,980);
t.bulletImpact(t.projectile(450,400,0,20),chilled);assert.equal(chilled.hp,954);
grant('drone',3);grant('shield',2);assert.ok(s.player.evolutions.includes('swarm'));
s.bullets=[];s.player.droneTimer=0;t.updateWorld(.01);assert.equal(s.bullets.filter(b=>b.drone).length,3);
for(const id of Object.keys(t.UPGRADES))s.player.upgrades[id]=t.UPGRADES[id].max;
t.offerChoice();assert.equal(game.getState().phase,'playing','Maxed builds cannot softlock');

// Timed optional missions: complete, expire, survive pause, and never block a wave.
game.start();s.wave=1;t.beginWave();s.spawnsLeft=50;t.updateWorld(4.1);
assert.equal(s.mission.status,'active');assert.equal(s.mission.type,'cache');
s.player.x=s.mission.x;s.player.y=s.mission.y;s.player.health=50;s.player.ammo=2;
t.updateWorld(.81);assert.equal(s.mission.status,'complete');assert.equal(s.player.health,65);assert.equal(s.player.ammo,28);
assert.equal(game.getState().phase,'choosing');game.chooseUpgrade(game.getState().choices[0].id);
game.start();s.wave=6;t.beginWave();s.spawnsLeft=50;t.updateWorld(4.1);
assert.equal(s.mission.type,'relay');s.player.x=s.mission.x;s.player.y=s.mission.y;
t.updateWorld(3.01);assert.equal(s.mission.status,'complete');assert.equal(game.getState().choiceRare,true);
game.skipChoice();
game.start();s.wave=3;t.beginWave();s.spawnsLeft=50;t.updateWorld(4.1);
assert.ok(s.mission.target.optional);assert.equal(s.mission.type,'bounty');
t.damageEnemy(s.mission.target,1e9);assert.equal(s.mission.status,'complete');game.skipChoice();
game.start();s.wave=3;t.beginWave();s.spawnsLeft=50;t.updateWorld(4.1);
t.updateWorld(30);assert.equal(s.mission.status,'missed');assert.equal(game.getState().phase,'playing');
s.enemies=s.enemies.filter(e=>e.optional);s.spawnsLeft=0;t.update(.01);
assert.equal(s.waveCleared,true,'Expired optional target does not prevent clear');
while(game.getState().phase==='choosing')game.skipChoice();
assert.equal(s.enemies.length,0);assert.ok(s.waveBreak>=4);

// Boss 5 has fan / charge / slam, telegraphs first and overheats after attacks.
game.start();s.wave=4;t.beginWave();s.spawnsLeft=0;
let boss=t.spawnEnemy('boss');boss.fireTimer=0;t.updateBoss(boss,.01);
assert.equal(boss.attack,'fan');assert.equal(s.enemyBullets.length,0);t.updateBoss(boss,1.1);
assert.equal(s.enemyBullets.length,7);assert.ok(boss.recovery>0);
let hp=boss.hp;t.damageEnemy(boss,100);assert.equal(hp-boss.hp,145);
t.updateBoss(boss,1);boss.fireTimer=0;t.updateBoss(boss,.01);assert.equal(boss.attack,'charge');
t.updateBoss(boss,1.1);assert.ok(boss.dashTime>0);t.updateBoss(boss,.8);assert.ok(boss.recovery>0);
boss.recovery=0;boss.fireTimer=0;boss.telegraph=0;boss.dashTime=0;t.updateBoss(boss,.01);
assert.equal(boss.attack,'slam');assert.ok(s.zones.some(z=>z.warn>0 && z.r===160));
t.draw();

// Boss 10 has destructible defense parts and different attack patterns.
game.start();s.wave=9;t.beginWave();s.spawnsLeft=0;s.cover=[];
boss=t.spawnEnemy('boss');let parts=s.enemies.filter(e=>e.parent===boss);assert.equal(parts.length,2);
hp=boss.hp;t.damageEnemy(boss,100);assert.equal(hp-boss.hp,65);
t.damageEnemy(parts[0],1e6);hp=boss.hp;t.damageEnemy(boss,100);assert.equal(hp-boss.hp,82.5);
t.damageEnemy(parts[1],1e6);hp=boss.hp;t.damageEnemy(boss,100);assert.equal(hp-boss.hp,100);
boss.fireTimer=0;t.updateBoss(boss,.01);assert.equal(boss.attack,'beam');
let beam=s.zones.find(z=>z.kind==='beam');assert.ok(beam.warn>=1.4);
s.player.x=beam.x+Math.cos(boss.attackAngle)*200;s.player.y=beam.y+Math.sin(boss.attackAngle)*200;
s.player.invulnerable=0;hp=s.player.health;t.updateWorld(.4);assert.equal(s.player.health,hp,'Warning does no damage');
beam.warn=0;t.updateWorld(.01);assert.ok(s.player.health<hp);
s.player.health=100;s.player.invulnerable=0;
beam.x=200;beam.y=360;beam.bx=1200;beam.by=360;s.player.x=700;s.player.y=360;
s.cover=[{x:400,y:300,w:40,h:120}];t.updateWorld(.01);assert.equal(s.player.health,100,'Cover blocks laser');
s.zones=[];boss.telegraph=0;boss.recovery=0;boss.fireTimer=0;boss.attackIndex=1;t.updateBoss(boss,.01);
assert.equal(boss.attack,'bombard');assert.equal(s.zones.length,3);assert.ok(s.zones.every(z=>z.warn>1));
boss.hp=boss.maxHp*.4;boss.telegraph=0;boss.recovery=0;boss.fireTimer=0;boss.attackIndex=2;t.updateBoss(boss,.01);
assert.equal(boss.attack,'ring');assert.ok(boss.enraged);assert.ok(Number.isFinite(boss.safeAngle));
t.updateBoss(boss,1.1);assert.ok(s.enemyBullets.length>10 && s.enemyBullets.length<20);
t.draw();
t.damageEnemy(boss,1e9);assert.ok(!s.enemies.some(e=>e.parent===boss));

// Complete campaign, preserve queued cores, unlock endless, reset every new state.
game.start();
for(let wave=1;wave<=10;wave++) {
  assert.equal(s.wave,wave);s.enemies=[];s.spawnsLeft=0;
  if(s.plan.boss||s.plan.elite) { const e=t.spawnEnemy(s.plan.boss?'boss':'elite');t.damageEnemy(e,1e9); }
  t.completeWave();let guard=0;
  while(game.getState().phase==='choosing'&&guard++<100)game.chooseUpgrade(game.getState().choices[0].id);
  assert.ok(guard<100);
  if(wave<10)t.update(s.waveBreak+.01);
}
assert.equal(game.getState().phase,'victory');assert.equal(game.getState().bossesKilled,4);
assert.equal(game.continueEndless(),true);t.update(2.1);assert.equal(s.wave,11);
game.restart();assert.equal(s.wave,1);assert.equal(s.rerolls,2);assert.equal(s.mission,null);
assert.ok(Object.values(s.player.upgrades).every(v=>v===0));
console.log('PASS v3: progression/recovery, 16 upgrades, 5 evolutions, guided choices/reroll/exclusivity, optional missions/rewards/timeout, distinct Bosses/parts/laser cover/overheat, campaign/endless/reset.');

