# Confiar Markdown Reader (correr UNA vez, NO requiere administrador).
# Importa el certificado del editor y desbloquea el instalador, para que
# Windows no muestre "Editor desconocido" ni el "Ejecutar de todas formas".
#
# Poné este script en la MISMA carpeta que "md-reader.cer" y el instalador.
# Lo más simple: doble clic en  Confiar-MarkdownReader.cmd
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$cer = Get-ChildItem -Path $here -Filter '*.cer' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $cer) {
  Write-Host "No encontre el certificado (.cer) junto a este script." -ForegroundColor Red
  Write-Host "Asegurate de tener 'md-reader.cer' en esta carpeta." -ForegroundColor Red
  return
}

function Add-CertTo([string]$storeName, [string]$path) {
  $c = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $path
  $s = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, 'CurrentUser')
  $s.Open('ReadWrite'); $s.Add($c); $s.Close()
}

Write-Host "Agregando la confianza en el editor (solo para tu usuario, sin admin)..."
Add-CertTo 'Root'             $cer.FullName   # para que la firma sea valida
Add-CertTo 'TrustedPublisher' $cer.FullName   # para marcar al editor como confiable
Write-Host "  OK: editor de confianza agregado." -ForegroundColor Green

$setup = Get-ChildItem -Path $here -Filter 'Markdown Reader Setup*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($setup) {
  Unblock-File -Path $setup.FullName
  Write-Host "  OK: instalador desbloqueado -> $($setup.Name)" -ForegroundColor Green
  Write-Host ""
  $r = Read-Host "Instalar Markdown Reader ahora? (s/N)"
  if ($r -match '^[sS]') { Start-Process $setup.FullName }
} else {
  Write-Host "  (No vi el instalador en esta carpeta; si lo descargas aparte, hacele clic derecho -> Propiedades -> Desbloquear.)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Listo. Ya podes instalar y abrir Markdown Reader sin avisos." -ForegroundColor Green
