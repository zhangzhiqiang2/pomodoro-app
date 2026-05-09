---
name: pomodoro-app
description: "Comprehensive guide for the Pomodoro desktop app built with Electron. Use this skill whenever the user asks about the Pomodoro timer app — including modifying features, fixing bugs, understanding the architecture, configuring settings, adding new functionality, debugging issues, or building/installing the app. This covers the timer logic, UI components, task management, statistics, tray integration, and Electron IPC communication."
---

# Pomodoro App — 番茄钟桌面应用

基于 Electron 的桌面番茄钟应用，采用 vanilla JS（无框架），深色主题，中文界面。

## 项目结构

```
pomodoro-app/
├── main.js              # Electron 主进程（窗口管理、托盘、IPC）
├── renderer.js          # 渲染进程（计时器、任务、统计、设置）
├── index.html           # UI 结构
├── style.css            # 全部样式
├── start.cmd            # Windows 启动脚本（清除 ELECTRON_RUN_AS_NODE）
├── package.json         # 依赖与构建配置
└── .claude/skill/       # Claude Code skills
```

## 开发命令

| 命令 | 说明 |
|---|---|
| `npm start` | 启动应用 |
| `.\start.cmd` | 从 VS Code 终端启动（清除 `ELECTRON_RUN_AS_NODE`） |
| `npm run build` | 使用 electron-builder 打包安装包 |

## 主进程 (`main.js`)

### 窗口配置
- `BrowserWindow`：无边框、不可调整大小、380×600
- 关闭时隐藏到托盘而非退出（`mainWindow.hide()`）
- 背景色 `#0f0a1e`
- `nodeIntegration: true`，`contextIsolation: false`

### 托盘图标
- 16×16 RGBA PNG，代码中直接通过 Buffer 生成（圆形）
- 颜色：灰色（空闲）、红色（专注）、绿色（休息）
- 右键菜单：显示窗口 / 退出

### IPC 通道

| Channel | Direction | Payload |
|---|---|---|
| `timer-state` | renderer → main | `"idle"` \| `"work"` \| `"rest"` |
| `resize-window` | renderer → main | `true`（展开设置）/ `false`（收起） |
| `notify` | renderer → main | `{ title, body }` |
| `minimize-window` | renderer → main | 无 |
| `close-window` | renderer → main | 无 |

### 窗口尺寸
- 正常：380×600
- 设置面板展开时：380×650

## 渲染进程 (`renderer.js`)

### 计时器核心逻辑
- 基于 `setInterval`，每秒一次 tick
- 三种模式：`work`（默认25min）、`short-rest`（5min）、`long-rest`（15min），均可配置
- 每完成4个专注时段后，自动进入长休息
- 进度环通过 SVG `stroke-dashoffset` 驱动，CSS transition 1s

### 音效
- 使用 Web Audio API `OscillatorNode`，无外部音频文件
- 开始提示音：660Hz 单音
- 完成提示音：三连音（模式间音高不同）

### 任务管理（`localStorage`）
- 键名：`pomodoro_tasks`
- 格式：`[{ text: string, done: boolean }]`
- 支持添加、切换完成状态、删除

### 每日统计（`localStorage`）
- 键名：`pomodoro_stats`
- 格式：`{ date, count, minutes, tasksDone }`
- 按日期字符串（`Date.toDateString()`）区分每天
- 统计项：今日番茄数、专注分钟数、完成任务数

### 设置面板
- 可调整专注时长（1-90min）、短休息（1-30min）、长休息（1-60min）
- 保存后自动应用并收起面板

## UI 样式 (`style.css`)

### 设计体系
- 深色主题，CSS 自定义属性管理颜色
- 当前配色：炭黑背景 `#0b0b0e`，深灰卡片 `#141418`
- 强调色：专注红 `#ff3344`、休息青 `#00d4aa`、长休息蓝 `#4d7dff`
- 字体：Bebas Neue（计时数字）+ Outfit（界面文字），后备系统字体

### 关键视觉特性
- 背景点阵纹理（24px 间距）
- 环境光晕（`radial-gradient`）
- 进度环带呼吸动画（运行态光晕脉冲）
- 玻璃态卡片（`backdrop-filter: blur`）
- SVG 进度环使用 CSS 纯色（非渐变），`stroke-width: 7`
- 任务列表项入场动画
- 设置面板滑动展开/收起

### CSS 类名约定
- 模式修饰：`.rest-mode`、`.long-rest-mode`
- 运行态：`.running`（在 `.timer-ring-wrap` 上）
- 激活标签：`.tab.active`
- 按钮状态：`.ctrl-btn`、`.ctrl-btn.primary` + 模式修饰

## 重要约束与注意事项

- 进度环周长 = 2π × 88 ≈ 553，与 SVG `r="88"` 对应
- 窗口高度切换：600px ↔ 650px
- `render()` 中通过 `className` 赋值而非 `classList.add/remove`，需要在赋值中保留 `running` 类
- 所有文本为中文（zh-CN）
- 托盘图标的 `state` 参数映射：`idle`/`work`/`rest`

## 常见修改场景

### 调整计时器默认时长
修改 `renderer.js` 中 `config` 对象的初始值，以及 `btnSave` 事件的取值范围。

### 添加新模式
需修改：`renderer.js` 的 `config`、`modeLabels`、`tabs` HTML、`render()` 中的模式判断逻辑、以及 CSS 中的对应颜色变量。

### 修改托盘图标颜色
编辑 `main.js` 中 `createTrayIconBuffer` 函数的 `colors` 映射。

### 打包发布
`npm run build` 使用 electron-builder，配置在 `package.json` 的 `build` 字段中。
