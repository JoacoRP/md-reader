@echo off
REM Markdown Reader - lanzador para Windows (doble-clic o desde cmd)
REM Uso:  start.cmd  [carpeta]
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en el PATH.
  echo Instalalo desde https://nodejs.org ^(LTS^) y volve a intentar.
  pause
  exit /b 1
)

node "%~dp0server.js" %*

REM Si el server termina por error, dejar la ventana abierta para ver el mensaje.
if errorlevel 1 pause
endlocal
