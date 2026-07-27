@echo off
rem ============================================================
rem  NAREW - uruchamianie gry
rem  Podwojne klikniecie w narew.html NIE wystarczy: YouTube nie
rem  odtwarza filmow na stronach otwartych z dysku. Ten plik
rem  wlacza maly serwer i otwiera gre pod wlasciwym adresem.
rem ============================================================
cd /d "%~dp0"

echo.
echo   Uruchamiam serwer gry NAREW...

start "serwer NAREW" /min powershell -ExecutionPolicy Bypass -File "%~dp0serwer.ps1"

rem serwer potrzebuje chwili, zanim zacznie odpowiadac
timeout /t 3 /nobreak >nul

echo   Otwieram gre w przegladarce...
start "" "http://localhost:8080/narew.html"

echo.
echo   Gotowe. Okno serwera zostaw otwarte (jest zminimalizowane).
echo   Zamkniecie tego okna serwera konczy gre.
timeout /t 4 /nobreak >nul
exit
