# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Run the app:** `npm start` (or `.\start.cmd` if running from VS Code to clear `ELECTRON_RUN_AS_NODE`)
- **Build installer:** `npm run build`

## Language

- Always respond in **Chinese (中文)**. All explanations, suggestions, and code comments must be in Chinese.

## Project Architecture

A desktop Pomodoro timer built with **Electron** and vanilla JS (no framework). Simple 4-file structure:

### Main Process (`main.js`)
- Creates a frameless, non-resizable `BrowserWindow` (380×600)
- On close, hides to tray instead of quitting
- Generates tray icon programmatically via raw PNG buffer (16×16 RGBA, circular, no external assets)
- IPC handlers: `timer-state` (update tray icon color), `resize-window` (expand for settings), `notify`, `minimize-window`, `close-window`

### Renderer Process (`renderer.js`)
- Timer loop using `setInterval` with 1s ticks
- Modes: `work` (25min), `short-rest` (5min), `long-rest` (15min) — all configurable
- SVG ring progress via `stroke-dashoffset` with 1s CSS transition
- Sounds generated via Web Audio API `OscillatorNode` (no audio files)
- Task list with add/toggle/delete, persisted via `localStorage`
- Daily stats (pomodoro count, focus minutes, tasks done) keyed by date string
- Settings panel expands window height via IPC (`resize-window`)

### IPC Protocol
| Channel | Direction | Payload |
|---|---|---|
| `timer-state` | renderer → main | `"idle"` \| `"work"` \| `"rest"` |
| `resize-window` | renderer → main | `true` (expand) / `false` (collapse) |
| `notify` | renderer → main | `{ title, body }` |
| `minimize-window` | renderer → main | (none) |
| `close-window` | renderer → main | (none) |

### Persistence (localStorage keys)
- `pomodoro_tasks` — `[{ text, done }]`
- `pomodoro_stats` — `{ date, count, minutes, tasksDone }`

### Notable Constraints
- Window height toggles between 600px and 650px when settings panel opens/closes
- Tray icon color: gray (idle), red (work), green (rest)
- Progress ring circumference must remain in sync with SVG `r="88"` (circumference = 2π×88 ≈ 553)
- All text is in Chinese (zh-CN)
