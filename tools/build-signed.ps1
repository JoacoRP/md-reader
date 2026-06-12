# Compila el instalador FIRMADO con el cert self-signed (build\cert\md-reader.pfx).
# Si no existe el cert, usa  .\tools\make-cert.ps1  primero.
#
# Uso:  .\tools\build-signed.ps1 -Password "LA_CLAVE_DEL_PFX"
param(
  [Parameter(Mandatory = $true)][string]$Password
)
$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pfx  = Join-Path $root 'build\cert\md-reader.pfx'
if (-not (Test-Path $pfx)) {
  throw "No existe $pfx. Genera el certificado con .\tools\make-cert.ps1 primero."
}

# electron-builder toma estas variables de entorno para firmar exe + instalador.
$env:CSC_LINK         = $pfx
$env:CSC_KEY_PASSWORD = $Password

Push-Location $root
try {
  npx electron-builder --win
} finally {
  Pop-Location
  Remove-Item Env:CSC_LINK         -ErrorAction SilentlyContinue
  Remove-Item Env:CSC_KEY_PASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Instalador firmado en dist\." -ForegroundColor Green
Write-Host "Para el equipo, entregales JUNTOS estos 3 (carpeta o zip):" -ForegroundColor Cyan
Write-Host "  - dist\Markdown Reader Setup x.y.z.exe"
Write-Host "  - build\cert\md-reader.cer"
Write-Host "  - tools\Confiar-MarkdownReader.cmd  (+ Confiar-MarkdownReader.ps1)"
