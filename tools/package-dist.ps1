# Arma el paquete de distribucion para el equipo: un zip en dist\ con el
# instalador, el certificado publico, los scripts de confianza y un LEEME.
# Se ejecuta solo al final de build-signed.ps1, o suelto:  .\tools\package-dist.ps1
$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dist = Join-Path $root 'dist'
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version

# 1) Instalador de la version actual (o el mas nuevo que matchee)
$setup = Get-ChildItem $dist -Filter "Markdown Reader Setup $version.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $setup) {
  $setup = Get-ChildItem $dist -Filter 'Markdown Reader Setup*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $setup) { throw "No encontre el instalador en dist\. Compila primero (tools\build-signed.ps1 o npm run build:win)." }

# 2) Certificado publico (presente solo si el build fue firmado)
$cer = Join-Path $root 'build\cert\md-reader.cer'
$signed = Test-Path $cer
if (-not $signed) {
  Write-Warning "No hay build\cert\md-reader.cer: el instalador parece SIN firmar."
  Write-Warning "El paquete saldra sin el cert ni el script de confianza."
}

# 3) Staging
$stage = Join-Path $dist "Markdown Reader $version"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

Copy-Item $setup.FullName $stage
if ($signed) {
  Copy-Item $cer $stage
  Copy-Item (Join-Path $root 'tools\Confiar-MarkdownReader.cmd') $stage
  Copy-Item (Join-Path $root 'tools\Confiar-MarkdownReader.ps1') $stage
}

# 4) LEEME para el compañero (ASCII, para que se lea en cualquier editor)
$leeme = @()
$leeme += "Markdown Reader $version - Instalacion"
$leeme += "========================================"
$leeme += ""
if ($signed) {
  $leeme += "1) Doble clic en  Confiar-MarkdownReader.cmd   (una sola vez, NO pide administrador)."
  $leeme += "   Confia el editor y desbloquea el instalador para que Windows no muestre avisos."
  $leeme += "   Te ofrece instalar ahi mismo."
} else {
  $leeme += "1) Clic derecho en el instalador -> Propiedades -> Desbloquear -> Aceptar."
  $leeme += "   Luego doble clic. Si aparece SmartScreen: Mas informacion -> Ejecutar de todas formas."
}
$leeme += ""
$leeme += "2) Se instala por usuario (sin administrador), con accesos en Escritorio y Menu Inicio."
$leeme += ""
$leeme += "3) Abri 'Markdown Reader' desde el acceso directo."
$leeme += ""
$leeme += "Para desinstalar: Configuracion de Windows -> Aplicaciones -> Markdown Reader."
Set-Content -Path (Join-Path $stage 'LEEME.txt') -Value $leeme -Encoding ascii

# 5) Zip
$zip = Join-Path $dist "Markdown-Reader-$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host ""
Write-Host "Paquete de distribucion listo:" -ForegroundColor Green
Write-Host "  $zip"
Write-Host ("  Firmado: {0}" -f $(if ($signed) { 'si (incluye cert + script de confianza)' } else { 'NO (sin cert)' }))
Write-Host "  Eso es lo unico que les pasas a los compañeros."
