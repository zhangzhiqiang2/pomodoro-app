@echo off
REM 清除 ELECTRON_RUN_AS_NODE 环境变量（VS Code 终端会设置此变量导致 Electron 无法加载内置模块）
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" .
