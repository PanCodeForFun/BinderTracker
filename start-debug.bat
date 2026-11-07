@echo off
cd /d "%~dp0"
python start.py --debug-delay 120 %*
if errorlevel 1 pause
