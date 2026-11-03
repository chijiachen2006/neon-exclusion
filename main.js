import { mountGame } from './game.js?v=3.3';

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

function upgradeIcon(id) {
  const paths = {
    heavy: '<path d="M9 20V9l3-6 3 6v11H9Zm0-7h6M9 17h6"/>',
    pierce: '<path d="M3 8h12m-5-4 5 4-5 4M5 17h16m-5-4 5 4-5 4"/>',
    rapid: '<path d="m13 2-8 11h6l-1 9 9-12h-6l1-8Z"/>',
    multi: '<path d="M3 12h17m-5-4 5 4-5 4M3 5h14m-4-3 4 3-4 3M3 19h14m-4-3 4 3-4 3"/>',
    explosive: '<path d="m12 2 2 6 6-2-3 6 5 3-7 1-3 6-2-6-7 1 4-5-4-4 7 1 2-7Z"/>',
    ricochet: '<path d="m3 17 7-7 4 4 7-9m-6 0h6v6"/>',
    chain: '<path d="m8 4 4 6-4 4 8 6M3 7l5-3 4 1m4 15 5-3-1-4"/>',
    freeze: '<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-2-1-4m12 14-1-4 4-2M3 13l4 2-1 4M18 5l-1 4 4 2"/>',
    homing: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
    drone: '<circle cx="5" cy="5" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="m6 6 12 12M18 6 6 18"/><circle cx="12" cy="12" r="3"/>',
    shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm0 4v11"/>',
    reload: '<path d="M20 10a8 8 0 1 0-2 8m2-15v7h-7"/>',
    magazine: '<rect x="7" y="3" width="10" height="18" rx="1"/><path d="M6 3h12M6 21h12M10 8h4m-4 4h4m-4 4h4"/>',
    dash: '<path d="m4 5 8 7-8 7m8-14 8 7-8 7"/>',
    overload: '<path d="m12 2 9 10-9 10L3 12l9-10Zm0 5v7m0 3v1"/>',
    accelerator: '<path d="m4 17 7-11 2 7 7-7M3 21h18"/>',
    evolution: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[id] || paths.evolution}</svg>`;
}

function render(state) {
  document.documentElement.dataset.phase = state.phase;
  $('startBtn').disabled = !state.assetsReady;
  $('startEndlessBtn').disabled = !state.assetsReady;
  $('artStatus').hidden = state.assetsReady;
  $('artStatus').textContent = state.assetsError ? '素材加载失败，请重新加载后开始作战。' : '正在加载场景和角色素材…';
  $('retryAssetsBtn').hidden = !state.assetsError;
  for (const [phase, screen] of Object.entries(screens)) screen.hidden = state.phase !== phase;
  $('hudWave').textContent = String(Math.max(1, state.wave)).padStart(2, '0');
  $('hudScore').textContent = paddedScore(state.score);
  $('hudHealth').textContent = `${state.health} / ${state.maxHealth}`;
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
      badge.className = 'buff-badge';
      badge.innerHTML = upgradeIcon(upgrade.id);
      const name = document.createElement('strong');
      name.textContent = upgrade.name;
      const levels = document.createElement('span');
      levels.className = 'buff-level';
      for (let level = 1; level <= upgrade.max; level++) {
        const pip = document.createElement('i');
        pip.classList.toggle('is-filled', level <= upgrade.level);
        levels.append(pip);
      }
      badge.append(name, levels);
      badge.title = `${upgrade.name} Lv.${upgrade.level}/${upgrade.max} · ${upgrade.description}`;
      badge.setAttribute('aria-label', badge.title);
      return badge;
    });
    for (const evolution of state.evolutions) {
      const badge = document.createElement('span'); badge.className = 'buff-badge evolution-badge';
      badge.innerHTML = upgradeIcon('evolution'); const name = document.createElement('strong'); name.textContent = evolution.name; badge.append(name); badge.title = evolution.description;
      badge.style.setProperty('--buff-color', evolution.color); badges.unshift(badge);
    }
    strip.replaceChildren(...badges);
  }
  strip.hidden = !strip.children.length || state.phase === 'idle';
  $('buildEmpty').hidden = !strip.hidden;
  $('desktopDash').style.setProperty('--dash-progress', `${Math.round(state.dash * 100)}%`);

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
  $('rerollBtn').textContent = state.rerolls > 0 && !state.canReroll && state.phase === 'choosing' ? '已无其他可选强化' : `重抽 · 剩余 ${state.rerolls} 次`;
  $('rerollBtn').disabled = !state.canReroll;
  const routes = state.routes.filter((r) => r.invested > 0).slice(0, 3).map((r) => {
    const item = document.createElement('span'); item.className = r.active ? 'route-active' : '';
    item.textContent = r.active ? `✦ ${r.name} · 已进化` : `${r.name} ${r.invested}/${r.total} · ${r.missing}`;
    return item;
  });
  $('evolutionRoutes').replaceChildren(...routes);
  $('evolutionRoutes').hidden = !routes.length;
  $('upgradeHint').textContent = state.choicesRemaining ? `战斗已暂停 · 还有 ${state.choicesRemaining} 个核心等待选择` : '战斗已暂停 · 本局持续生效 · 按 1 / 2 / 3 选择';

  const labels = { idle: '准备作战', playing: '作战中', paused: '已暂停', choosing: '选择强化', victory: '封锁已突破', gameover: '任务结束' };
  $('statusText').textContent = labels[state.phase];
  $('pauseBtn').disabled = !['playing', 'paused'].includes(state.phase);
  $('pauseBtn').setAttribute('aria-label', state.phase === 'paused' ? '继续游戏' : '暂停游戏');
  $('pauseBtn').title = state.phase === 'paused' ? '继续游戏' : '暂停游戏';
  $('muteBtn').setAttribute('aria-pressed', String(state.muted));
  $('muteBtn').setAttribute('aria-label', state.muted ? '开启音效' : '关闭音效');
  $('muteBtn').title = state.muted ? '开启音效' : '关闭音效';
  $('muteBtn').classList.toggle('is-muted', state.muted);
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
    $('restartConfirm').hidden = true;
    $('pauseRestartBtn').hidden = false;
    if (state.phase === 'paused') {
      const items = [...state.upgradeList.map((u) => `${u.name} Lv.${u.level}：${u.description}`),
        ...state.evolutions.map((u) => `${u.name}：${u.description}`)].map((text) => {
          const item = document.createElement('li'); item.textContent = text; return item;
        });
      if (!items.length) { const item = document.createElement('li'); item.textContent = '尚未获得强化，击败敌人拾取核心即可选择。'; items.push(item); }
      $('ownedBuildList').replaceChildren(...items);
      $('ownedBuild').open = false;
    }
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
$('retryAssetsBtn').addEventListener('click', () => game.retryAssets());
$('startBtn').addEventListener('click', () => game.start());
$('startEndlessBtn').addEventListener('click', () => game.startEndless());
$('resumeBtn').addEventListener('click', () => game.resume());
$('restartBtn').addEventListener('click', () => game.restart());
$('victoryRestartBtn').addEventListener('click', () => game.restart());
$('continueEndlessBtn').addEventListener('click', () => game.continueEndless());
$('pauseRestartBtn').addEventListener('click', () => {
  $('restartConfirm').hidden = false; $('pauseRestartBtn').hidden = true;
  $('cancelRestartBtn').focus({ preventScroll: true });
});
$('confirmRestartBtn').addEventListener('click', () => game.restart());
$('cancelRestartBtn').addEventListener('click', () => {
  $('restartConfirm').hidden = true; $('pauseRestartBtn').hidden = false;
  $('pauseRestartBtn').focus({ preventScroll: true });
});
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
