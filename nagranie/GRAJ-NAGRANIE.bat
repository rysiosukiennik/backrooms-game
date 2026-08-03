@echo off
rem ============================================================
rem  LUDZIK W NAGRANIU - uruchamianie gry
rem  Podwojne klikniecie w index.html NIE wystarczy: przegladarka
rem  blokuje wtedy film i moduly. Ten plik wlacza maly serwer
rem  i otwiera gre pod wlasciwym adresem.
rem ============================================================
cd /d "%~dp0"

echo.
echo   Uruchamiam serwer gry...

start "serwer NAGRANIE" /min node "%~dp0serwer.js"

rem serwer potrzebuje chwili, zanim zacznie odpowiadac
timeout /t 3 /nobreak >nul

echo   Otwieram gre w przegladarce...
start "" "http://localhost:8099"

echo.
echo   Gotowe. Okno serwera zostaw otwarte (jest zminimalizowane).
echo   Zamkniecie tego okna serwera konczy gre.
timeout /t 4 /nobreak >nul
exit
