@echo off
rem ============================================================
rem  E.V. - asystentka glosowa
rem  Mikrofon w przegladarce dziala tylko na stronie otwartej
rem  przez serwer (adres http://...), a nie prosto z dysku.
rem  Ten plik wlacza maly serwer i otwiera E.V. pod adresem.
rem ============================================================
cd /d "%~dp0"

echo.
echo   Uruchamiam serwer...

start "serwer E.V." /min powershell -ExecutionPolicy Bypass -File "%~dp0serwer.ps1"

rem serwer potrzebuje chwili, zanim zacznie odpowiadac
timeout /t 3 /nobreak >nul

echo   Otwieram E.V. w przegladarce...
start "" "http://localhost:8080/ev.html"

echo.
echo   Gotowe. Okno serwera zostaw otwarte (jest zminimalizowane).
echo   Kliknij "Wlacz sluchanie", pozwol na mikrofon i powiedz: E.V. (i-wi).
timeout /t 5 /nobreak >nul
exit
