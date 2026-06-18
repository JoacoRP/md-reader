# 📖 Markdown Reader

Cliente web local para leer y editar archivos **Markdown** (y mockups **HTML**) de forma legible: tablas, diagramas **Mermaid**, resaltado de código, tabla de contenidos, mocks embebidos y estilos totalmente personalizables.

Incluye además **Note Taker**: una sub-app para crear y editar notas (`.md`/`.txt`) con plantillas, sobre una carpeta propia. Se cambia desde el selector del logo.

Hay dos formas de usarlo:
- **Como app de Windows** (recomendado para usuarios no técnicos): se instala con un `.exe` y se usa como cualquier programa, **sin Node ni terminal**.
- **Vía CLI / Node** (para desarrolladores): el frontend es **React + TypeScript + MUI** (estado con Zustand), compilado con **Vite** a `web/dist`. El bundle es offline (marked, Mermaid, highlight.js, DOMPurify quedan empaquetadas); el `server.js` sigue sin dependencias de runtime.

---

## Instalar como app de Windows (sin Node)

Para quien sólo quiere usarlo, te van a llegar **3 archivos juntos** (carpeta o zip): el instalador `Markdown Reader Setup x.y.z.exe`, `md-reader.cer` y `Confiar-MarkdownReader.cmd`.

1. **Una sola vez**, doble clic en **`Confiar-MarkdownReader.cmd`**. Confía el editor y desbloquea el instalador (no pide administrador). Esto evita los avisos *"Editor desconocido"* y *"Windows protegió tu PC → Ejecutar de todas formas"*.
2. Te ofrece instalar ahí mismo (o doble clic en el instalador). Se instala **por usuario, sin admin**, con accesos directos en **Escritorio** y **Menú Inicio**.
3. Abrí **Markdown Reader** desde el acceso directo. Es una ventana de app normal; al cerrarla se cierra todo.

> ¿Por qué el paso 1? La app está **firmada** con un certificado propio; `Confiar-MarkdownReader.cmd` agrega ese editor a tus "Editores de confianza" (sólo para tu usuario) y le saca al instalador la "Marca de la Web" (lo que dispara SmartScreen). Es un paso único: futuras versiones ya no piden nada.
>
> Alternativa sin el script: pedí el instalador por **carpeta de red o pendrive** (no traen esa marca) y listo.

La app abre por defecto en tu carpeta **Documentos**. Podés cambiar la carpeta raíz desde el menú **Archivo → Abrir carpeta…** o desde el campo de ruta del panel; la elección se recuerda (se guarda en `%APPDATA%\md-reader\config.json`).

Para desinstalar: *Configuración de Windows → Aplicaciones → Markdown Reader → Desinstalar*.

---

## Requisitos (uso vía CLI / desarrollo)

Lo único necesario es **Node.js ≥ 18** y un browser. Verificá si ya lo tenés:

```bash
node --version      # debería imprimir v18 o superior
```

Si no aparece, instalá la versión **LTS** desde <https://nodejs.org>.

---

## Init (primera vez)

```bash
git clone https://github.com/JoacoRP/md-reader.git
cd md-reader
npm install          # trae el toolchain de frontend (React/Vite/MUI) y Electron
```

En **macOS / Linux**, dale permiso de ejecución al launcher (sólo la primera vez):

```bash
chmod +x start.sh
```

---

## Up & Down (arrancar y detener)

### Desarrollo (con HMR)

```bash
npm run dev
```

Levanta **dos procesos** (vía `concurrently`): el backend Node (`server.js`, puerto 4321) y el **dev server de Vite** (puerto 5173, con recarga en caliente). Abrí <http://localhost:5173>. Vite proxea `/api` y `/mock` al backend.

### Producción / uso real (un solo proceso)

Hay que compilar el frontend una vez y después servirlo con el backend:

```bash
npm run build        # compila web/dist
npm start            # server.js sirve web/dist en http://localhost:4321
```

Los launchers `start.cmd` / `start.ps1` / `start.sh` corren `node server.js` (requieren un `npm run build` previo).

### Detener (down)

El server corre en primer plano: **`Ctrl + C`** en la terminal (o cerrá la ventana). No queda nada en segundo plano.

### Opciones de arranque

| Quiero… | Comando |
|---|---|
| Indexar otra carpeta | `node server.js C:\ruta\a\docs` |
| Cambiar el puerto | `node server.js --port 5000` |
| No abrir el browser | `node server.js --no-open` |
| Vía variables de entorno | `MD_ROOT=/ruta MD_PORT=5000 node server.js` |

> Si el puerto está ocupado, el server lo avisa y sugiere otro. La carpeta raíz también se puede cambiar después desde la UI.

---

## Uso

### Navegar y abrir archivos
- El **panel izquierdo** lista en cascada todos los `.md`/`.markdown`/`.mdx` y `.html`/`.htm` bajo la raíz. Las carpetas arrancan **colapsadas**; los tipos se distinguen por ícono (📄 markdown en azul, `</>` HTML en naranja).
- Click en un **`.md`** → se renderiza formateado. Click en un **`.html`** → se muestra embebido en un **iframe** (con botón para abrirlo en pestaña nueva).

### Buscar
- Buscador con **switch archivos / carpetas**: buscá por nombre de archivo, o cambiá a modo carpeta para encontrar una carpeta puntual (p. ej. su `README`) y verla revelada con su contenido.
- `Ctrl/Cmd + K` enfoca el buscador.

### Cambiar la carpeta raíz
- En el campo de arriba del panel escribí cualquier ruta (ej. `C:\dev`) y tocá **→** (o Enter): re-indexa en cascada desde ahí. El botón **⟲** vuelve al default.
- La raíz elegida se guarda en `config.json` (local, no se versiona) y se reusa en el próximo arranque. Prioridad: CLI/`MD_ROOT` › `config.json` › carpeta padre.

### Ver y editar el código fuente (raw)
- El botón **`</>`** alterna entre la vista **formateada** y el **original (raw)**. Aplica a Markdown (muestra el `.md` crudo) y a los mocks HTML (muestra el HTML en vez del iframe).
- En la vista raw podés **editar**. El guardado es **automático** al volver a la vista formateada, al cambiar de archivo o al cerrar (también con `Ctrl/Cmd + S`). Un indicador en la barra muestra el estado (sin guardar / guardado).

### Personalizar estilos y temas
- El botón **⚙︎** abre la página de **configuración**: panel de controles a la izquierda (tipografía, colores, código y diagramas, tema) y **vista previa en vivo** a la derecha.
- **Temas:** elegí un preset integrado (Default, Sepia, Night, Alto contraste) o **guardá el estado actual como tema propio** con nombre (reutilizable y borrable). **Restablecer** pide confirmación.
- El **🌙 / ☀️** del lector alterna claro/oscuro rápido. Las preferencias se guardan en `localStorage`.

### Note Taker
- El **logo es un selector de apps**: cambiá entre **Markdown Reader** (lectura) y **Note Taker** (notas).
- En Note Taker, **Nueva nota** crea un `.md` (o elegí una **plantilla** desde el caret; las plantillas viven en `<carpeta de notas>/templates/` con placeholders `{{date}}`, `{{time}}`, `{{datetime}}`).
- Las notas se editan al toque con **autosave**; podés **renombrar** y **eliminar** desde el menú contextual (clic derecho).
- La **carpeta de notas** es independiente de la raíz del lector y se configura en **⚙︎ → Carpeta de notas**.

### Otros
- **Tabla de contenidos** flotante con seguimiento de scroll (botón de TOC).
- **Imprimir / exportar a PDF** (🖨 → "Guardar como PDF").
- **Deep links:** la URL refleja el archivo abierto (`#<ruta>`), se puede compartir o recargar.

---

## Build del instalador (desarrolladores)

La app de Windows se empaqueta con **Electron + electron-builder**. Estas son dependencias **sólo de build** (no afectan el uso vía CLI ni el runtime de los compañeros).

```bash
npm install          # una vez: trae electron y electron-builder (~deps de dev)
npm run build:win    # genera dist\Markdown Reader Setup x.y.z.exe (sin firmar)
```

- El instalador queda en `dist/` (gitignored). Para publicar una versión nueva: subí `version` en `package.json`, recompilá y compartí el nuevo `.exe` (se instala encima del anterior y conserva la config del usuario).
- El ícono está en `build/icon.ico`. El instalador es **per-user** (sin admin).
- Modo desarrollo de la ventana de Electron: `npm run app`.

### Build firmado (recomendado para el equipo)

Para que los compañeros no vean *"Editor desconocido"*, la app se firma con un **certificado self-signed** propio (gratis, sin IT). Es un círculo cerrado: sólo confían quienes vos autorizás.

```powershell
# 1) Una sola vez: generar el certificado (elegí tu propia clave secreta)
.\tools\make-cert.ps1 -Password "TU_CLAVE_SECRETA"

# 2) Compilar firmado (misma clave)
.\tools\build-signed.ps1 -Password "TU_CLAVE_SECRETA"
```

Esto deja:
- `build\cert\md-reader.pfx` — **privado**, firma la app. **No compartir, no commitear** (está gitignored).
- `build\cert\md-reader.cer` — **público**, se distribuye al equipo.
- `dist\Markdown Reader Setup x.y.z.exe` — instalador **firmado**.
- **`dist\Markdown-Reader-x.y.z.zip`** — **paquete listo para compartir**: el `build-signed.ps1` arma automáticamente un zip con el Setup + el `.cer` + los scripts de confianza + un `LEEME.txt`. **Eso es lo único que les pasás a los compañeros**; corren `Confiar-MarkdownReader.cmd` una vez (ver [Instalar como app](#instalar-como-app-de-windows-sin-node)).

> El zip también se puede regenerar suelto con `.\tools\package-dist.ps1` (sin recompilar). Si compilaste sin firmar (`npm run build:win`), el zip sale igual pero sin el cert ni el script, con instrucciones de "Desbloquear" en el `LEEME.txt`.

> Seguridad: el `.pfx` es la identidad de firma — guardalo bien. Si se filtra, regenerá el cert (`make-cert.ps1`) y los compañeros vuelven a confiar el nuevo `.cer`. El certificado dura 10 años.

> Arquitectura: Electron corre el mismo `server.js` in-process (puerto efímero en loopback) y muestra el frontend en una ventana. Por eso el CLI y la app comparten exactamente la misma lógica.

## Estructura del proyecto

```
md-reader/
├─ server.js          # servidor HTTP sin dependencias (índice, lectura/escritura, mocks, auto-open)
├─ electron/
│  └─ main.js         # proceso principal de Electron (app de Windows)
├─ build/
│  └─ icon.ico        # ícono de la app / instalador  (build/cert/ es gitignored)
├─ tools/
│  ├─ make-cert.ps1               # genera el certificado self-signed (dev)
│  ├─ build-signed.ps1            # compila el instalador firmado + arma el zip (dev)
│  ├─ package-dist.ps1            # arma el zip de distribución (dev)
│  ├─ Confiar-MarkdownReader.ps1  # el equipo confía el editor + desbloquea
│  └─ Confiar-MarkdownReader.cmd  # wrapper doble-clic del anterior
├─ start.cmd          # launcher Windows (doble-clic / cmd)
├─ start.ps1          # launcher Windows (PowerShell)
├─ start.sh           # launcher macOS / Linux
├─ package.json       # metadatos + scripts + config de electron-builder
├─ vite.config.ts     # config de Vite (root=web, proxy a server.js en dev)
└─ web/               # frontend React + TypeScript (compila a web/dist)
   ├─ index.html
   ├─ tsconfig.json
   └─ src/
      ├─ main.tsx        # boot: ThemeBridge + Router
      ├─ App.tsx         # rutas (/ lector, /settings)
      ├─ theme.ts        # vars --md-* + tema de hljs + createTheme de MUI
      ├─ api/client.ts   # cliente tipado de los endpoints
      ├─ store/          # Zustand: settings, tree, app (documento/notas), ui, dialog
      ├─ lib/            # markdown (marked+purify+hljs+mermaid), formato, mock
      ├─ components/     # Sidebar, Topbar, content, settings, dialogs
      └─ pages/          # SettingsPage
```

`web/dist/` (bundle) y `config.json` (raíz elegida) se generan en runtime y están gitignored.

---

## Endpoints del server

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/tree` | árbol de archivos bajo la raíz |
| GET/POST | `/api/root` | leer / cambiar la carpeta raíz |
| GET | `/api/file?path=` | contenido de un markdown |
| POST | `/api/save` | guardar ediciones (md/html) |
| GET | `/api/raw?path=` | asset crudo (imágenes, etc.) |
| GET | `/mock/<ruta>` | mock HTML servido para iframe (resuelve assets relativos) |

---

## Seguridad

- El server escucha sólo en **`localhost`**.
- Lectura, escritura y serveo de mocks están restringidos a la **carpeta raíz** elegida (validación anti _path-traversal_); el guardado sólo acepta extensiones soportadas (`.md`/`.html`).
- El HTML renderizado desde Markdown se sanitiza con **DOMPurify**. Los mocks HTML se ejecutan tal cual en un iframe (son archivos locales de confianza).
