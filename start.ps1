# Markdown Reader — launcher
# Uso:  .\start.ps1            (sirve C:\dev)
#       .\start.ps1 C:\otra\carpeta
param(
    [string]$Root = "",
    [int]$Port = 4321
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$env:MD_PORT = $Port
if ($Root -ne "") { $argRoot = $Root } else { $argRoot = "" }

$url = "http://localhost:$Port"
Write-Host "Iniciando Markdown Reader en $url ..." -ForegroundColor Cyan

# Abrir el browser tras un breve delay (el server arranca casi instantáneo).
Start-Job -ScriptBlock { param($u) Start-Sleep -Milliseconds 800; Start-Process $u } -ArgumentList $url | Out-Null

if ($argRoot -ne "") {
    node "$scriptDir\server.js" $argRoot
} else {
    node "$scriptDir\server.js"
}
