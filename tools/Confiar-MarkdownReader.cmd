@echo off
REM Doble clic para confiar el editor y desbloquear el instalador de Markdown Reader.
REM No requiere administrador.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Confiar-MarkdownReader.ps1"
echo.
pause
