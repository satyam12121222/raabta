@echo off
cd /d "%~dp0"
node build-preview.mjs
if errorlevel 1 echo Build stopped. Copy the error above for troubleshooting.
pause
