# Markdown Reader — launcher (Windows / PowerShell)
# Uso:
#   .\start.ps1                       sirve la carpeta padre (build compilado) y abre el browser
#   .\start.ps1 C:\ruta\a\docs        sirve otra carpeta
#   .\start.ps1 -Port 5000            cambia el puerto (modo compilado)
#   .\start.ps1 -ForceBuild           recompila web/dist aunque esté al día
#   .\start.ps1 -Dev                  modo desarrollo con Vite (HMR, recarga en vivo)
#
# Por defecto sirve web/dist (como en producción), pero PRIMERO valida si el build
# quedó viejo respecto al código fuente y lo recompila si hace falta — así nunca se
# sirve un bundle desactualizado. Con -Dev levanta Vite (HMR) para ver los cambios
# al instante sin recompilar.
param(
    [string]$Root = "",
    [int]$Port = 4321,
    [switch]$Dev,
    [switch]$ForceBuild
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Verificar que Node esté instalado.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js no está instalado o no está en el PATH." -ForegroundColor Red
    Write-Host "Instalalo desde https://nodejs.org (LTS) y volvé a intentar." -ForegroundColor Yellow
    exit 1
}

# ----------------------------------------------------------------- modo dev (HMR)
if ($Dev.IsPresent) {
    if ($Root -ne "" -or $Port -ne 4321) {
        Write-Host "Nota: en -Dev se ignoran -Root/-Port. Vite proxea al backend fijo http://127.0.0.1:4321 y sirve la UI en http://localhost:5173." -ForegroundColor Yellow
    }
    Write-Host "Modo desarrollo (Vite + HMR). UI en http://localhost:5173 — Ctrl+C para cortar." -ForegroundColor Cyan
    # `npm run dev` levanta server.js + vite (concurrently) con --no-open; abrimos el
    # puerto de Vite nosotros tras un breve delay para darle tiempo a arrancar.
    Start-Job { Start-Sleep -Seconds 3; Start-Process "http://localhost:5173" } | Out-Null
    Set-Location $scriptDir
    npm run dev
    exit $LASTEXITCODE
}

# --------------------------------------------------- modo compilado (producción)
# Rebuild de web/dist si falta o quedó viejo respecto al código fuente, para no
# servir nunca un bundle desactualizado (ese era el bug de arrancar y ver lo viejo).
$distDir   = Join-Path $scriptDir "web\dist"
$distIndex = Join-Path $distDir "index.html"

# Fecha de modificación más reciente entre un conjunto de archivos/carpetas.
function Get-MaxWrite {
    param([string[]]$Paths)
    $max = [datetime]::MinValue
    foreach ($p in $Paths) {
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $item = Get-Item -LiteralPath $p
        if ($item.PSIsContainer) {
            Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
                if ($_.LastWriteTime -gt $max) { $max = $_.LastWriteTime }
            }
        } elseif ($item.LastWriteTime -gt $max) {
            $max = $item.LastWriteTime
        }
    }
    return $max
}

$needBuild = $ForceBuild.IsPresent -or (-not (Test-Path -LiteralPath $distIndex))
if (-not $needBuild) {
    # Fuentes que afectan el bundle. Si la más nueva supera al dist, recompilamos.
    $srcPaths = @(
        (Join-Path $scriptDir "web\src"),
        (Join-Path $scriptDir "web\index.html"),
        (Join-Path $scriptDir "web\public"),
        (Join-Path $scriptDir "vite.config.ts"),
        (Join-Path $scriptDir "package.json")
    )
    if ((Get-MaxWrite $srcPaths) -gt (Get-MaxWrite @($distDir))) { $needBuild = $true }
}

if ($needBuild) {
    Write-Host "Recompilando web/dist (el build estaba desactualizado)…" -ForegroundColor Cyan
    Set-Location $scriptDir
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: la compilación falló. No se sirve un build viejo." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "web/dist al día; sirviendo sin recompilar." -ForegroundColor DarkGray
}

$serverArgs = @("$scriptDir\server.js")
if ($Root -ne "") { $serverArgs += $Root }
$serverArgs += @("--port", $Port)

# El server abre el browser solo; acá únicamente lo arrancamos.
node @serverArgs
