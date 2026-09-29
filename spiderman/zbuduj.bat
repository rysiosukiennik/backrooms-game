@echo off
rem Pakuje pliki z js\ w jeden gra.js (potrzebny Node.js). Uruchom po kazdej zmianie w js\.
cd /d "%~dp0"
npx --yes esbuild js/main.js --bundle --format=iife --outfile=gra.js
