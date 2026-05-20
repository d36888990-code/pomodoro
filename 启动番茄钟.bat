@echo off
cd /d D:\firstcc\firstcc\pomodoro
set ELECTRON_OVERRIDE_DIST_PATH=C:\electron
echo 正在启动番茄钟...
call npm run dev
pause
