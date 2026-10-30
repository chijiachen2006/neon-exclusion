import { mountGame } from './game.js?v=3.0';

const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas');
const screens = { idle: $('startScreen'), paused: $('pauseScreen'), choosing: $('upgradeScreen'),
  victory: $('victoryScreen'), gameover: $('gameOverScreen') };
const scoreText = (value) => Math.max(0, Math.floor(value || 0)).toLocaleString('en-US');
const paddedScore = (value) => String(Math.max(0, Math.floor(value || 0))).padStart(6, '0');
const timeText = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
let toastTimer, lastPhase = '', lastBuffs = '', lastChoices = '', lastEvolutionAt = -10000;
let movePointerId = null, firePointerId = null, fireOrigin = null;
const touchQuery = window.matchMedia('(pointer: coarse)');
function syncTouchLayout() {
  const touch = touchQuery.matches || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
  document.documentElement.classList.toggle('touch-device', touch);
}
function resetTouchUI() {
  movePointerId = null; firePointerId = null; fireOrigin = null;
  $('moveStick').classList.remove('is-active'); $('fireBtn').classList.remove('is-active');
  $('moveStick').style.setProperty('--stick-x', '0px'); $('moveStick').style.setProperty('--stick-y', '0px');
  $('fireBtn').style.setProperty('--aim-x', '0px'); $('fireBtn').style.setProperty('--aim-y', '0px');
  $('fireLabel').textContent = '射击';
}
syncTouchLayout();

function showToast(message, duration = 1400) {
  const toast = $('eventToast');
  toast.textContent = message; toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
}

function render(state) {
  for (const [phase, screen] of Object.entries(screens)) screen.hidden = state.phase !== phase;
  $('hudWave').textContent = String(Math.max(1, state.wave)).padStart(2, '0');
  $('hudScore').textContent = paddedScore(state.score);
  $('hudHealth').textContent = String(state.health);
  $('hudAmmo').textContent = `${state.ammo} / ${state.maxAmmo}`;
  $('hudBest').textContent = paddedScore(state.bestScore);
  $('hudShield').textContent = state.shield > 0 ? `护盾 ${state.shield}` : '';
  $('healthFill').style.width = `${Math.max(0, state.health / state.maxHealth * 100)}%`;
  $('healthFill').classList.toggle('is-low', state.health <= 30);
  $('hudReload').textContent = state.reloading ? '正在装填' : state.dash >= 1 ? '闪避已就绪' : '闪避充能中';
  $('hudRemaining').textContent = `敌人 ${state.remaining}`;
  $('missionText').textContent = state.objective;
  $('missionHud').hidden = state.phase === 'idle';
  $('missionDots').hidden = state.endless;
  for (const [index, dot] of [...$('missionDots').children].entries()) {
    dot.classList.toggle('is-complete', index + 1 < state.wave);
    dot.classList.toggle('is-current', index + 1 === state.wave);
  }
  $('hudMode').textContent = state.endless ? '无尽模式' : `${Math.max(1, state.wave)} / 10`;
  $('bossHud').hidden = !state.boss || state.phase === 'idle';
  if (state.boss) {
    $('bossName').textContent = state.boss.name;
    $('bossPhase').textContent = state.boss.phase === 2 ? '狂暴 · 第二阶段' : '第一阶段';
    const fraction = state.boss.health / state.boss.maxHealth;
    $('bossFill').style.width = `${Math.max(0, fraction * 100)}%`;
    $('bossHealth').textContent = state.boss.hint;
    $('bossBar').setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    $('bossHud').classList.toggle('is-enraged', state.boss.phase === 2);
  }

  const side = state.sideMission;
  $('sideMission').hidden = !side || !['playing','paused'].includes(state.phase) || state.breakSeconds > 0;
  if (side) {
    $('sideMission').dataset.status = side.status;
    $('sideTitle').textContent = side.status === 'complete' ? '支线完成' : side.status === 'missed' ? '支线结束' : `${side.name} · ${side.seconds}s`;
    $('sideAction').textContent = side.status === 'active' ? side.action : side.status === 'complete' ? '奖励已领取' : '继续突破主线';
    $('sideReward').textContent = side.status === 'active' ? `可选 · ${side.reward}` : '';
    $('sideProgress').style.width = `${Math.round(Math.max(0, Math.min(1, side.progress)) * 100)}%`;
  }
  const signature = JSON.stringify([state.upgrades, state.evolutions]);
  const strip = $('activeBuffs');
  if (signature !== lastBuffs) {
    lastBuffs = signature;
    const badges = state.upgradeList.map((upgrade) => {
      const badge = document.createElement('span');
      badge.textContent = `${upgrade.name} ${upgrade.level}`;
      badge.style.setProperty('--buff-color', upgrade.color);
      badge.title = `Lv.${upgrade.level}/${upgrade.max} · ${upgrade.description}`;
      return badge;
    });
    for (const evolution of state.evolutions) {
      const badge = document.createElement('span'); badge.className = 'evolution-badge';
      badge.textContent = `✦ ${evolution.name}`; badge.title = evolution.description;
      badge.style.setProperty('--buff-color', evolution.color); badges.unshift(badge);
    }
    strip.replaceChildren(...badges);
  }
  strip.hidden = !strip.children.length || state.phase === 'idle';

  const choiceSignature = JSON.stringify([state.choices, state.choiceRare]);
  if (choiceSignature !== lastChoices) {
    lastChoices = choiceSignature;
    $('upgradeTitle').textContent = state.choiceRare ? '稀有核心 · 火力跃升' : '选择你的强化';
    $('upgradeKicker').textContent = state.choiceRare ? '稀有强化 · 最多升 2 级' : '强化核心 · 三选一';
    const cards = state.choices.map((choice, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'upgrade-choice';
      button.style.setProperty('--choice-color', choice.color);
      button.setAttribute('aria-label', `${choice.name}，升级至 ${choice.level} 级`);
      const top = document.createElement('span'); top.className = 'choice-top';
      const icon = document.createElement('span'); icon.className = 'choice-icon'; icon.textContent = choice.icon;
      const key = document.createElement('kbd'); key.textContent = String(index + 1); top.append(icon, key);
      const title = document.createElement('strong'); title.textContent = choice.name;
      const level = document.createElement('span'); level.className = 'choice-level';
      level.textContent = choice.oldLevel ? `Lv.${choice.oldLevel} → Lv.${choice.level} / ${choice.max}` : `解锁 Lv.${choice.level} / ${choice.max}`;
      const desc = document.createElement('span'); desc.className = 'choice-description'; desc.textContent = choice.description;
      if (choice.tradeoff) { const tag = document.createElement('span'); tag.className = 'choice-tradeoff'; tag.textContent = '收益与代价 · 互斥改装'; button.append(tag); }
      button.classList.toggle('is-ready', !!choice.ready);
      button.append(top, title, level, desc);
      if (choice.recipe) { const recipe = document.createElement('small'); recipe.textContent = choice.recipe; recipe.classList.toggle('recipe-ready', !!choice.ready); button.append(recipe); }
      button.addEventListener('click', () => game.chooseUpgrade(choice.id));
      return button;
    });
    $('upgradeChoices').replaceChildren(...cards);
  }
  $('rerollBtn').textContent = `重抽 · 剩余 ${state.rerolls} 次`;
  $('rerollBtn').disabled = state.rerolls <= 0;
  const routes = state.routes.filter((r) => r.invested > 0).slice(0, 3).map((r) => {
    const item = document.createElement('span'); item.className = r.active ? 'route-active' : '';
    item.textContent = r.active ? `✦ ${r.name} · 已进化` : `${r.name} ${r.invested}/${r.total} · ${r.missing}`;
    return item;
  });
  $('evolutionRoutes').replaceChildren(...routes);
  $('evolutionRoutes').hidden = !routes.length;
  $('upgradeHint').textContent = state.choicesRemaining ? `战斗已暂停 · 还有 ${state.choicesRemaining} 个核心等待选择` : '战斗已暂停 · 本局持续生效 · 按 1 / 2 / 3 选择';

  const labels = { idle: '等待部署', playing: '作战中', paused: '已暂停', choosing: '选择强化', victory: '封锁已突破', gameover: '任务结束' };
  $('statusText').textContent = labels[state.phase];
  $('pauseBtn').disabled = !['playing', 'paused'].includes(state.phase);
  $('pauseBtn').setAttribute('aria-label', state.phase === 'paused' ? '继续游戏' : '暂停游戏');
  $('pauseBtn').title = state.phase === 'paused' ? '继续游戏' : '暂停游戏';
  $('muteBtn').setAttribute('aria-pressed', String(state.muted));
  $('muteBtn').setAttribute('aria-label', state.muted ? '开启音效' : '关闭音效');
  $('muteBtn').title = state.muted ? '开启音效' : '关闭音效';
  $('startEndlessBtn').hidden = !state.endlessUnlocked;
  $('touchControls').hidden = state.phase !== 'playing';
  $('fireBtn').disabled = state.phase !== 'playing';
  $('reloadBtn').disabled = state.phase !== 'playing' || state.reloading || state.ammo === state.maxAmmo;
  $('reloadLabel').textContent = state.reloading ? '装填中' : '换弹';
  $('dashCountdown').textContent = state.dash >= 1 ? '就绪' : `${((1 - state.dash) * 3.4 * (1 - state.upgrades.dash * .15)).toFixed(1)}s`;
  $('dashBtn').disabled = state.phase !== 'playing' || state.dash < 1;
  $('dashBtn').style.setProperty('--dash-progress', `${Math.round(state.dash * 100)}%`);
  $('gameStage').classList.toggle('critical-health', state.phase === 'playing' && state.health <= 30);
  if (state.phase === 'gameover') {
    $('finalScore').textContent = scoreText(state.score); $('finalWave').textContent = String(state.wave);
    $('finalRunInfo').textContent = `击败 ${state.kills} 个敌人 · ${timeText(state.elapsed)} · ${state.evolutions.length} 项武器进化`;
  }
  if (state.phase === 'victory') {
    $('victoryScore').textContent = scoreText(state.score);
    $('victoryInfo').textContent = `用时 ${timeText(state.elapsed)} · 击败 ${state.kills} 个敌人 · ${state.bossesKilled} 位首领`;
  }
  if (state.phase !== lastPhase) {
    if (state.phase !== 'playing') resetTouchUI();
    lastPhase = state.phase;
    const focusTarget = state.phase === 'choosing' ? $('upgradeChoices').firstElementChild :
      state.phase === 'victory' ? $('continueEndlessBtn') : state.phase === 'paused' ? $('resumeBtn') :
      state.phase === 'gameover' ? $('restartBtn') : null;
    focusTarget?.focus({ preventScroll: true });
  }
}

function onEvent(event) {
  switch (event.type) {
    case 'wave': showToast(`第 ${event.wave} 波 · ${event.name}`, event.boss ? 1700 : 1100); break;
    case 'boss': showToast(event.name, 2600); break;
    case 'bossPhase': showToast('首领进入狂暴阶段 · 留意攻击预警', 2600); break;
    case 'bossDefeated': showToast('首领已击败 · 获得稀有强化核心', 2400); break;
    case 'missionStart': showToast(`可选目标 · ${event.name}`, 1600); break;
    case 'missionComplete': showToast(`支线完成 · ${event.rare ? '稀有' : ''}强化核心${event.cache ? ' · 补给恢复' : ''}`, 1800); break;
    case 'missionMissed': showToast('支线时间结束 · 继续突破', 1100); break;
    case 'partBroken': showToast('护卫部件已摧毁 · 首领防御削弱', 1500); break;
    case 'supply': showToast('补给完成 · 生命 +20 · 弹匣补满'); break;
    case 'pickup': showToast('生命已恢复'); break;
    case 'evolution': lastEvolutionAt = performance.now(); showToast(`武器进化 · ${event.name}`, 3500); break;
    case 'upgrade': if (performance.now() - lastEvolutionAt > 100) showToast(`${event.name} Lv.${event.level}`, 1800); break;
    case 'victory': showToast('10 波封锁已突破 · 无尽模式解锁', 3000); break;
    case 'gameover': showToast('任务结束'); break;
  }
}

const game = mountGame(canvas, { onState: render, onEvent });
$('rerollBtn').addEventListener('click', () => game.rerollChoices());
$('skipChoiceBtn').addEventListener('click', () => game.skipChoice());
$('startBtn').addEventListener('click', () => game.start());
$('startEndlessBtn').addEventListener('click', () => game.startEndless());
$('resumeBtn').addEventListener('click', () => game.resume());
$('restartBtn').addEventListener('click', () => game.restart());
$('victoryRestartBtn').addEventListener('click', () => game.restart());
$('continueEndlessBtn').addEventListener('click', () => game.continueEndless());
$('pauseRestartBtn').addEventListener('click', () => game.restart());
$('pauseBtn').addEventListener('click', () => game.togglePause());
$('muteBtn').addEventListener('click', () => game.toggleMute());
const moveStick = $('moveStick'), fireButton = $('fireBtn');
const stopTouchEvent = (event) => { event.preventDefault(); event.stopPropagation(); };
function updateMoveStick(event) {
  const box = moveStick.getBoundingClientRect(), radius = Math.max(1, box.width * .32);
  let x = event.clientX - box.left - box.width / 2, y = event.clientY - box.top - box.height / 2;
  const magnitude = Math.hypot(x, y), limit = magnitude > radius ? radius / magnitude : 1;
  x *= limit; y *= limit;
  moveStick.style.setProperty('--stick-x', `${x}px`); moveStick.style.setProperty('--stick-y', `${y}px`);
  game.setTouchMove(x / radius, y / radius);
}
moveStick.addEventListener('pointerdown', (event) => {
  stopTouchEvent(event);
  if (movePointerId !== null || game.getState().phase !== 'playing') return;
  movePointerId = event.pointerId; moveStick.setPointerCapture(event.pointerId);
  moveStick.classList.add('is-active'); updateMoveStick(event);
});
moveStick.addEventListener('pointermove', (event) => {
  if (event.pointerId !== movePointerId) return; stopTouchEvent(event); updateMoveStick(event);
});
function releaseMove(event) {
  if (event.pointerId !== movePointerId) return;
  movePointerId = null; moveStick.classList.remove('is-active');
  moveStick.style.setProperty('--stick-x', '0px'); moveStick.style.setProperty('--stick-y', '0px');
  game.setTouchMove(0, 0);
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) moveStick.addEventListener(type, releaseMove);
fireButton.addEventListener('pointerdown', (event) => {
  stopTouchEvent(event);
  if (firePointerId !== null || game.getState().phase !== 'playing') return;
  firePointerId = event.pointerId; fireOrigin = { x: event.clientX, y: event.clientY };
  fireButton.setPointerCapture(event.pointerId); fireButton.classList.add('is-active');
  game.setTouchAim(0, 0); game.setTouchFire(true);
});
fireButton.addEventListener('pointermove', (event) => {
  if (event.pointerId !== firePointerId || !fireOrigin) return;
  stopTouchEvent(event);
  const x = event.clientX - fireOrigin.x, y = event.clientY - fireOrigin.y, magnitude = Math.hypot(x, y);
  if (magnitude > 12) {
    game.setTouchAim(x / magnitude, y / magnitude); $('fireLabel').textContent = '瞄准';
    fireButton.style.setProperty('--aim-x', `${x / magnitude * 9}px`);
    fireButton.style.setProperty('--aim-y', `${y / magnitude * 9}px`);
  } else { game.setTouchAim(0, 0); $('fireLabel').textContent = '射击';
    fireButton.style.setProperty('--aim-x', '0px'); fireButton.style.setProperty('--aim-y', '0px'); }
});
function releaseFire(event) {
  if (event.pointerId !== firePointerId) return;
  firePointerId = null; fireOrigin = null; fireButton.classList.remove('is-active');
  fireButton.style.setProperty('--aim-x', '0px'); fireButton.style.setProperty('--aim-y', '0px');
  $('fireLabel').textContent = '射击'; game.setTouchFire(false); game.setTouchAim(0, 0);
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) fireButton.addEventListener(type, releaseFire);
$('dashBtn').addEventListener('pointerdown', (event) => { stopTouchEvent(event); game.dash(); });
$('reloadBtn').addEventListener('pointerdown', (event) => { stopTouchEvent(event); game.reload(); });
$('touchControls').addEventListener('contextmenu', (event) => event.preventDefault());
function releaseTouchControls() {
  for (const [element, id] of [[moveStick, movePointerId], [fireButton, firePointerId]]) {
    if (id !== null && element.hasPointerCapture(id)) element.releasePointerCapture(id);
  }
  resetTouchUI(); game.setTouchMove(0, 0); game.setTouchFire(false); game.setTouchAim(0, 0);
}
window.addEventListener('resize', () => { releaseTouchControls(); syncTouchLayout(); });
touchQuery.addEventListener('change', () => { releaseTouchControls(); syncTouchLayout(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseTouchControls(); game.pause(); } });
window.addEventListener('beforeunload', () => { clearTimeout(toastTimer); game.destroy(); });
