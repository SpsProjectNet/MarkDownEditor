@echo off
REM ============================================================
REM  Build dell'installer Windows (.exe NSIS)
REM  Eseguire su Windows con Node.js installato.
REM ============================================================

echo [1/2] Installazione dipendenze...
call npm install
if errorlevel 1 (
  echo Errore durante npm install.
  exit /b 1
)

echo [2/2] Compilazione installer Windows...
call npm run dist:win
if errorlevel 1 (
  echo Errore durante la compilazione.
  exit /b 1
)

echo.
echo Fatto! Trovi l'installer nella cartella "dist".
pause
