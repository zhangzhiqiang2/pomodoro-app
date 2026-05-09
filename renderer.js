const { ipcRenderer } = require('electron');

// 默认配置（分钟）
let config = {
  work: 25,
  shortRest: 5,
  longRest: 15,
};

const CIRCUMFERENCE = 2 * Math.PI * 88;

// 状态
let currentMode = 'work';
let totalSeconds = config.work * 60;
let remainingSeconds = totalSeconds;
let running = false;
let timerId = null;
let todayCount = 0;
let todayMinutes = 0;
let tasksDoneToday = 0;
let consecutivePomodoros = 0;

// 任务列表
let tasks = [];

// DOM
const timerTime = document.getElementById('timer-time');
const timerLabel = document.getElementById('timer-label');
const ringProgress = document.getElementById('ring-progress');
const btnStart = document.getElementById('btn-start');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const btnReset = document.getElementById('btn-reset');
const btnSkip = document.getElementById('btn-skip');
const tabs = document.querySelectorAll('.tab');
const timerRingWrap = document.querySelector('.timer-ring-wrap');
const statCount = document.getElementById('stat-count');
const statMinutes = document.getElementById('stat-minutes');
const statTasks = document.getElementById('stat-tasks');
const btnSettings = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const inpWork = document.getElementById('inp-work');
const inpShort = document.getElementById('inp-short');
const inpLong = document.getElementById('inp-long');
const btnSave = document.getElementById('btn-save-settings');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const taskInput = document.getElementById('task-input');
const taskAddBtn = document.getElementById('task-add-btn');
const taskList = document.getElementById('task-list');
const taskCount = document.getElementById('task-count');

const modeLabels = { work: '专注时间', 'short-rest': '短暂休息', 'long-rest': '长时休息' };

// 音效（Web Audio API 生成提示音）
function playBeep(frequency = 880, duration = 0.4, type = 'sine') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playFinishSound(isWork) {
  const freq = isWork ? 660 : 440;
  playBeep(freq, 0.3);
  setTimeout(() => playBeep(freq, 0.3), 380);
  setTimeout(() => playBeep(freq * 1.25, 0.5), 760);
}

// 渲染
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateRing() {
  const progress = remainingSeconds / totalSeconds;
  const offset = CIRCUMFERENCE * (1 - progress);
  ringProgress.style.strokeDashoffset = offset;
}

function render() {
  timerTime.textContent = formatTime(remainingSeconds);
  timerLabel.textContent = modeLabels[currentMode];
  updateRing();

  // 颜色模式
  const isWork = currentMode === 'work';
  const isRest = currentMode === 'short-rest';
  ringProgress.className = 'ring-progress' +
    (isWork ? '' : isRest ? ' rest-mode' : ' long-rest-mode');

  timerRingWrap.className = 'timer-ring-wrap' +
    (isWork ? '' : isRest ? ' rest-mode' : ' long-rest-mode') +
    (running ? ' running' : '');

  btnStart.className = 'ctrl-btn primary' +
    (isWork ? '' : isRest ? ' rest' : ' long-rest');

  if (running) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }

  statCount.textContent = todayCount;
  statMinutes.textContent = todayMinutes;
  statTasks.textContent = tasksDoneToday;
}

// 计时逻辑
function tick() {
  if (remainingSeconds <= 0) {
    clearInterval(timerId);
    timerId = null;
    running = false;
    onTimerEnd();
    return;
  }
  remainingSeconds--;
  render();
}

function onTimerEnd() {
  timerRingWrap.classList.remove('running');
  const wasWork = currentMode === 'work';

  if (wasWork) {
    todayCount++;
    todayMinutes += config.work;
    saveStats();
    playFinishSound(true);
    consecutivePomodoros++;
    const nextMode = (consecutivePomodoros % 4 === 0) ? 'long-rest' : 'short-rest';
    const modeName = nextMode === 'long-rest' ? '长休息' : '短暂休息';
    ipcRenderer.send('notify', {
      title: '专注完成！',
      body: `太棒了！完成第 ${todayCount} 个番茄 🍅，开始${modeName}吧。`,
    });
    switchMode(nextMode);
  } else {
    playFinishSound(false);
    ipcRenderer.send('notify', {
      title: '休息结束！',
      body: '准备好了吗？开始下一个专注时段吧 💪',
    });
    switchMode('work');
  }
}

function startTimer() {
  if (running) {
    clearInterval(timerId);
    timerId = null;
    running = false;
    timerRingWrap.classList.remove('running');
    ipcRenderer.send('timer-state', 'idle');
  } else {
    running = true;
    timerId = setInterval(tick, 1000);
    timerRingWrap.classList.add('running');
    ipcRenderer.send('timer-state', currentMode === 'work' ? 'work' : 'rest');
    playBeep(660, 0.15);
  }
  render();
}

function resetTimer() {
  clearInterval(timerId);
  timerId = null;
  running = false;
  timerRingWrap.classList.remove('running');
  remainingSeconds = totalSeconds;
  ipcRenderer.send('timer-state', 'idle');
  render();
}

function switchMode(mode) {
  currentMode = mode;
  if (mode === 'work') totalSeconds = config.work * 60;
  else if (mode === 'short-rest') totalSeconds = config.shortRest * 60;
  else totalSeconds = config.longRest * 60;

  resetTimer();

  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
}

// 任务管理
function loadTasks() {
  try {
    const saved = localStorage.getItem('pomodoro_tasks');
    if (saved) tasks = JSON.parse(saved);
    else tasks = [];
  } catch (e) { tasks = []; }
  renderTasks();
}

function saveTasks() {
  localStorage.setItem('pomodoro_tasks', JSON.stringify(tasks));
}

function renderTasks() {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  taskCount.textContent = done + '/' + total;

  taskList.innerHTML = '';
  tasks.forEach((task, i) => {
    const item = document.createElement('div');
    item.className = 'task-item';

    const check = document.createElement('div');
    check.className = 'task-check' + (task.done ? ' done' : '');
    check.addEventListener('click', () => toggleTask(i));

    const text = document.createElement('span');
    text.className = 'task-text' + (task.done ? ' done' : '');
    text.textContent = task.text;

    const del = document.createElement('button');
    del.className = 'task-del';
    del.textContent = '×';
    del.addEventListener('click', () => deleteTask(i));

    item.appendChild(check);
    item.appendChild(text);
    item.appendChild(del);
    taskList.appendChild(item);
  });
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.push({ text, done: false });
  saveTasks();
  renderTasks();
  taskInput.value = '';
  taskInput.focus();
}

function toggleTask(i) {
  tasks[i].done = !tasks[i].done;
  if (tasks[i].done) {
    tasksDoneToday++;
    saveStats();
  } else {
    tasksDoneToday = Math.max(0, tasksDoneToday - 1);
    saveStats();
  }
  saveTasks();
  renderTasks();
  render();
}

function deleteTask(i) {
  const wasDone = tasks[i].done;
  tasks.splice(i, 1);
  if (wasDone) {
    tasksDoneToday = Math.max(0, tasksDoneToday - 1);
    saveStats();
  }
  saveTasks();
  renderTasks();
  render();
}

// 统计持久化
function loadStats() {
  try {
    const saved = localStorage.getItem('pomodoro_stats');
    if (saved) {
      const data = JSON.parse(saved);
      const today = new Date().toDateString();
      if (data.date === today) {
        todayCount = data.count || 0;
        todayMinutes = data.minutes || 0;
        tasksDoneToday = data.tasksDone || 0;
      } else {
        todayCount = 0;
        todayMinutes = 0;
        tasksDoneToday = 0;
      }
    }
  } catch (e) {}
}

function saveStats() {
  localStorage.setItem('pomodoro_stats', JSON.stringify({
    date: new Date().toDateString(),
    count: todayCount,
    minutes: todayMinutes,
    tasksDone: tasksDoneToday,
  }));
}

// 事件绑定
btnStart.addEventListener('click', startTimer);
btnReset.addEventListener('click', resetTimer);
btnSkip.addEventListener('click', () => {
  clearInterval(timerId);
  timerId = null;
  running = false;
  onTimerEnd();
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchMode(tab.dataset.mode));
});

btnSettings.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
  ipcRenderer.send('resize-window', settingsPanel.classList.contains('open'));
});

btnSave.addEventListener('click', () => {
  const w = parseInt(inpWork.value) || 25;
  const s = parseInt(inpShort.value) || 5;
  const l = parseInt(inpLong.value) || 15;
  config.work = Math.max(1, Math.min(90, w));
  config.shortRest = Math.max(1, Math.min(30, s));
  config.longRest = Math.max(1, Math.min(60, l));
  inpWork.value = config.work;
  inpShort.value = config.shortRest;
  inpLong.value = config.longRest;
  settingsPanel.classList.remove('open');
  switchMode(currentMode);
  playBeep(880, 0.15);
  ipcRenderer.send('resize-window', false);
});

btnMinimize.addEventListener('click', () => ipcRenderer.send('minimize-window'));
btnClose.addEventListener('click', () => ipcRenderer.send('close-window'));

taskAddBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask();
});

// 初始化
ringProgress.style.strokeDasharray = CIRCUMFERENCE;
ringProgress.style.strokeDashoffset = 0;
loadStats();
loadTasks();
render();
