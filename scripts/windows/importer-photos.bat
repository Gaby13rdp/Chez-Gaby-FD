@echo off
rem Importer les photos (secours Windows) : double-cliquez sur ce fichier. Voir docs/03.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0importer-photos.ps1"
echo.
pause
