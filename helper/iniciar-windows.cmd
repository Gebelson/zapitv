@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 20 ou superior e tente novamente.
  pause
  exit /b 1
)
cd /d "%~dp0"
node server.mjs
pause
