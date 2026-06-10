# Markdown Reader — launcher (Windows / PowerShell)
# Uso:
#   .\start.ps1                       sirve la carpeta padre y abre el browser
#   .\start.ps1 C:\ruta\a\docs        sirve otra carpeta
#   .\start.ps1 -Port 5000            cambia el puerto
param(
    [string]$Root = "",
    [int]$Port = 4321
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Verificar que Node esté instalado.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js no está instalado o no está en el PATH." -ForegroundColor Red
    Write-Host "Instalalo desde https://nodejs.org (LTS) y volvé a intentar." -ForegroundColor Yellow
    exit 1
}

$serverArgs = @("$scriptDir\server.js")
if ($Root -ne "") { $serverArgs += $Root }
$serverArgs += @("--port", $Port)

# El server abre el browser solo; acá únicamente lo arrancamos.
node @serverArgs
