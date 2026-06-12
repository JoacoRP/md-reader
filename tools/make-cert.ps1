# Genera el certificado self-signed de firma de codigo para Markdown Reader.
# Corre UNA vez (o cuando quieras rotarlo). Deja:
#   build\cert\md-reader.pfx  -> PRIVADO, para firmar (NO compartir, NO commitear)
#   build\cert\md-reader.cer  -> PUBLICO, se distribuye al equipo para confiar
#
# Uso:  .\tools\make-cert.ps1 -Password "TU_CLAVE_SECRETA"
param(
  [string]$Subject = "CN=Joaquin Rodriguez",
  [Parameter(Mandatory = $true)][string]$Password,
  [int]$Years = 10
)
$ErrorActionPreference = 'Stop'

$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\build\cert'))
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -FriendlyName 'Markdown Reader signing' `
  -KeyUsage DigitalSignature `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -HashAlgorithm SHA256 `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears($Years)

$pfx = Join-Path $outDir 'md-reader.pfx'
$cer = Join-Path $outDir 'md-reader.cer'
$sec = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $sec | Out-Null
Export-Certificate   -Cert $cert -FilePath $cer | Out-Null

# No dejamos la clave privada en el almacen personal: queda solo en el .pfx.
Remove-Item ("Cert:\CurrentUser\My\" + $cert.Thumbprint) -Force

Write-Host "Certificado generado:" -ForegroundColor Green
Write-Host "  Subject:    $Subject"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  PFX (privado, NO compartir): $pfx"
Write-Host "  CER (publico, para el equipo): $cer"
Write-Host ""
Write-Host "Siguiente: compila firmado con  .\tools\build-signed.ps1 -Password <la misma clave>" -ForegroundColor Cyan
