# 📖 Markdown Reader

Cliente web local para leer los `.md` generados en las distintas sesiones, renderizados de forma legible: tablas, diagramas **Mermaid**, resaltado de código, tabla de contenidos y estilos personalizables.

No tiene dependencias de npm — sólo necesita **Node.js** (≥ 16) y un browser. Las librerías de frontend (marked, mermaid, highlight.js, DOMPurify) están vendoreadas en `public/vendor/`, así que **funciona offline**.

## Requisito único: Node.js

Verificá si ya lo tenés:

```bash
node --version      # debería imprimir v16 o superior
```

Si no aparece, instalá la versión **LTS** desde <https://nodejs.org>. No hace falta nada más: **no se corre `npm install`** porque el proyecto no tiene dependencias.

## Up & running

### 1. Cloná el repo

```bash
git clone <tu-repo> md-reader
cd md-reader
```

### 2. Arrancá (elegí según tu sistema)

**Windows** — doble-clic en `start.cmd`, o desde la terminal:

```powershell
.\start.cmd                 # cmd
.\start.ps1                 # PowerShell
```

**macOS / Linux:**

```bash
chmod +x start.sh           # sólo la primera vez
./start.sh
```

**Cualquier SO (con npm):**

```bash
npm start
```

Eso es todo: el servidor arranca y **abre el browser solo** en <http://localhost:4321>. Para detenerlo, `Ctrl+C` en la terminal.

### Opciones

Por defecto indexa la **carpeta padre** del proyecto. Para apuntar a otra carpeta o cambiar el puerto:

| Quiero… | Comando |
|---|---|
| Indexar otra carpeta | `node server.js /ruta/a/docs` |
| Cambiar el puerto | `node server.js --port 5000` |
| No abrir el browser | `node server.js --no-open` |
| Vía variables de entorno | `MD_ROOT=/ruta MD_PORT=5000 node server.js` |
| En Windows con el `.ps1` | `.\start.ps1 C:\ruta -Port 5000` |

> Si el puerto está ocupado, el server lo avisa y sugiere otro.

## Cambiar la carpeta raíz desde la UI

Arriba del panel izquierdo hay un campo donde podés escribir cualquier ruta (ej. `C:\dev`) y tocar **Ir** (o Enter). El reader vuelve a indexar **en cascada** todos los `.md` desde esa carpeta hacia abajo. El botón **⟲ Default** vuelve a la carpeta por defecto (la padre del proyecto).

La raíz elegida se guarda en `config.json` (local, no se versiona), así que la próxima vez que arranques abre directo desde esa carpeta. La prioridad es:

1. Arg de CLI / `MD_ROOT` (si lo pasás explícito, gana y no se persiste).
2. Última raíz elegida desde la UI (`config.json`).
3. La carpeta padre del proyecto.

## Página de configuración

El botón **⚙︎** abre `/settings.html`, una página dedicada al fine-tuning con dos paneles:

- **Izquierda** — controles agrupados (Bootstrap): tipografía (familia, tamaño, interlineado, espaciado de letras, ancho de contenido, separación de párrafos, justificado), colores (texto, fondo, acento, títulos, enlaces + subrayado), código y diagramas (tamaño de código, tema de código, tema de Mermaid) y tema de interfaz. Presets: Default, Sepia, Night, Alto contraste.
- **Derecha** — una **vista previa en vivo** con un `.md` mock que muestra todos los componentes (h1–h6, texto enriquecido, listas, tareas, tabla, code snippets, Mermaid, blockquotes).

Los cambios se aplican y guardan automáticamente (`localStorage`) y se reflejan en el lector al volver. El styling se maneja con **variables CSS** centralizadas (`config.js`), no con estilos hardcodeados.

## Características

- **Raíz configurable** desde la UI, con cascada recursiva de `.md` y persistencia.
- **Árbol de archivos** lateral con todos los `.md`/`.markdown`/`.mdx` (ignora `node_modules`, `.git`, `bin`, `obj`, etc.).
- **Buscador** de archivos (`Ctrl/Cmd+K`).
- **Renderizado GFM**: tablas, listas de tareas, citas, código.
- **Mermaid**: los bloques ```` ```mermaid ```` se dibujan como diagramas.
- **Resaltado de sintaxis** (highlight.js) con botón _Copiar_ en cada bloque.
- **Tabla de contenidos** flotante con seguimiento de scroll.
- **Configuración** en página aparte con preview en vivo (ver arriba) + **tema claro/oscuro** rápido desde el lector.
- Preferencias persistidas en `localStorage`.
- **Imprimir / exportar a PDF** (🖨 → "Guardar como PDF").
- **Deep links**: la URL refleja el archivo abierto (`#<ruta>`), se puede compartir/recargar.

## Estructura

```
md-reader/
├─ server.js          # servidor HTTP sin dependencias (índice + lectura + auto-open)
├─ start.cmd          # launcher Windows (doble-clic / cmd)
├─ start.ps1          # launcher Windows (PowerShell)
├─ start.sh           # launcher macOS / Linux
├─ package.json       # `npm start`
├─ public/
│  ├─ index.html      # lector
│  ├─ settings.html   # página de configuración (Bootstrap) + preview en vivo
│  ├─ style.css       # tema del documento vía variables CSS
│  ├─ config.js       # modelo de configuración: defaults, presets, apply()  (compartido)
│  ├─ md-core.js      # núcleo de render: marked + mermaid + hljs + sanitize  (compartido)
│  ├─ app.js          # lógica del lector (árbol, TOC, navegación)
│  └─ vendor/         # librerías locales (Bootstrap, marked, mermaid, highlight.js, DOMPurify) — offline
```

## Stack de frontend

Sin build step y **offline**: todas las librerías están vendoreadas en `public/vendor/` (Bootstrap 5 para el chrome y la página de settings; marked, Mermaid, highlight.js y DOMPurify para el render). El tema del documento se maneja con variables CSS.

## Seguridad

El servidor sólo lee archivos `.md` dentro de la carpeta raíz indicada (validación anti _path-traversal_) y se escucha sólo en `localhost`. El HTML renderizado se sanitiza con DOMPurify.
