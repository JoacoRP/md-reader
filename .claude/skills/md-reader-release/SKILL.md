---
name: md-reader-release
description: >-
  Guía el flujo de release del instalador FIRMADO de Markdown Reader (la app
  Electron de Windows de este repo): bump de versión, build firmado con el
  certificado self-signed, y armado del zip de distribución para el equipo.
  Usá esta skill SIEMPRE que el usuario quiera "sacar una versión nueva",
  "compilar/buildear el instalador", "firmar la app", "armar el .exe / el zip
  para pasarle a los compañeros", "publicar Markdown Reader" o cualquier
  variante de empaquetar/distribuir la app, aunque no diga la palabra "release".
  Solo aplica a este proyecto en Windows/PowerShell.
---

# Release de Markdown Reader (instalador firmado)

Esta skill encapsula el ritual de release de la app de Windows de **este repo**
(`md-reader`). El proceso tiene varios pasos fáciles de olvidar (versión → firma →
empaquetado), por eso conviene seguirlos en orden y verificar los artefactos al final.

Toda la cadena de firma vive en `tools/` y está documentada en el `README.md` del repo.
Es **solo Windows + PowerShell** (usa `New-SelfSignedCertificate`, `electron-builder --win`,
`Compress-Archive`).

## Antes de empezar: contexto que necesitás del usuario

1. **La clave del certificado (`-Password`)**: la misma con la que se generó el `.pfx`.
   - Pedísela al usuario en el momento. **Nunca** la hardcodees en archivos, ni la escribas
     en mensajes de commit, ni la dejes en el historial. Pasala solo como argumento del script.
2. **El número de versión nuevo** (semver `MAJOR.MINOR.PATCH`): preguntá cuál corresponde
   si no lo dijo. Patch = arreglos, Minor = features compatibles, Major = cambios grandes.

## Prerequisitos (verificá antes de buildear)

- **Dependencias instaladas**: el frontend es React + Vite + MUI (más `electron` +
  `electron-builder` para el instalador). Si no está `node_modules/`, corré:
  ```powershell
  npm install
  ```
- **Certificado de firma presente**: el build firmado requiere `build\cert\md-reader.pfx`.
  Verificá con `Test-Path .\build\cert\md-reader.pfx`.
  - Si **no existe**, generalo una vez (elegí/recuperá la clave secreta con el usuario):
    ```powershell
    .\tools\make-cert.ps1 -Password "<CLAVE_SECRETA>"
    ```
    Esto deja `md-reader.pfx` (privado, NO compartir ni commitear) y `md-reader.cer` (público,
    se distribuye). Si ya existe el `.pfx`, **no lo regeneres**: rotar el cert obliga a todo el
    equipo a confiar el nuevo `.cer`.

## Pasos del release

Corré todo desde la **raíz del repo** (`md-reader/`).

### 1. Subir la versión en `package.json`
Editá el campo `"version"` al número nuevo acordado. Es la fuente de verdad: `package-dist.ps1`
toma de ahí el nombre del `.exe` y del zip, así que tiene que coincidir.

> Tip: confirmá el valor actual antes de cambiarlo para no pisar una versión ya publicada.

### 2. Compilar firmado
```powershell
.\tools\build-signed.ps1 -Password "<CLAVE_SECRETA>"
```
Qué hace por dentro (para que sepas qué esperar / cómo diagnosticar):
- Compila el frontend React con **`npm run build`** (Vite → `web/dist`, que es lo que
  empaqueta Electron) y luego setea `CSC_LINK` / `CSC_KEY_PASSWORD` (las limpia al terminar)
  y corre `npx electron-builder --win`.
- Falla con error claro si no está el `.pfx`, si el build de Vite falla, o si `electron-builder` devuelve error.
- Al terminar OK, **invoca solo** `package-dist.ps1` (no lo corras vos por separado).

### 3. (Automático) Armado del zip de distribución
`build-signed.ps1` ya llama a `tools\package-dist.ps1`, que genera en `dist\` un zip con todo
lo que el equipo necesita:
- `Markdown Reader Setup <version>.exe` (el instalador firmado)
- `md-reader.cer` (certificado público para confiar)
- `Confiar-MarkdownReader.cmd` y `.ps1` (scripts de confianza de un clic)
- `LEEME.txt` (instrucciones para el compañero)

No hay que hacer nada en este paso; solo entender que el zip sale de acá.

### 4. Verificar los artefactos
Confirmá que se generaron y que la versión coincide:
```powershell
Get-ChildItem .\dist\ -Filter "*$( (Get-Content .\package.json -Raw | ConvertFrom-Json).version )*"
```
Tenés que ver al menos:
- `Markdown Reader Setup <version>.exe`
- `Markdown-Reader-<version>.zip`

Si el zip salió **sin** `.cer` ni scripts de confianza, el build fue sin firmar: revisá que el
`.pfx` exista y reintentá el paso 2. (`dist\` está gitignored: los artefactos no se versionan.)

### 5. Notas de versión y entrega
- Resumí los cambios de esta versión en formato breve (bullets de "qué cambió"), pensados para
  el compañero que la instala, no para devs.
- **Lo único que se le pasa al equipo es el zip** `dist\Markdown-Reader-<version>.zip`. Recordales
  que corran `Confiar-MarkdownReader.cmd` una sola vez antes de instalar.
- El instalador se instala **por usuario, sin admin**, encima de la versión anterior y conserva
  la config del usuario.

## Cerrar el release en git (versionado)
El bump de `package.json` conviene quedar commiteado (y opcionalmente un tag `vX.Y.Z`).
**No** manejes vos las cuentas ni el mensaje de commit a mano: delegá en el agente `git-workflow`
(mensaje según convención, y **sin** co-author de Claude/Anthropic). Si hay duda de con qué cuenta
de GitHub se commitea/pushea, eso lo resuelve `git-account-manager`.

> Nunca incluyas la clave del certificado ni el `.pfx` en un commit. El `.pfx` es privado y está gitignored.

## Alternativa sin firmar (solo si el usuario lo pide explícito)
Para una prueba rápida sin certificado:
```powershell
npm run build:win        # genera el Setup SIN firmar
.\tools\package-dist.ps1 # arma el zip (sin .cer ni scripts; el LEEME explica "Desbloquear")
```
Desaconsejado para entregar al equipo: dispara los avisos de "Editor desconocido" / SmartScreen.

## Diagnóstico rápido
- **"No existe ...md-reader.pfx"** → falta el certificado: corré `make-cert.ps1` (paso de prerequisitos).
- **`electron-builder` falla** → revisá que `npm install` se haya corrido y que no haya otra instancia
  de la app/instalador abierta bloqueando `dist\`.
- **El zip salió sin cert** → el build no estaba firmado; confirmá el `.pfx` y la clave correcta.
