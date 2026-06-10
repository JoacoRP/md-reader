# 📖 Markdown Reader

Cliente web local para leer los `.md` generados en las distintas sesiones, renderizados de forma legible: tablas, diagramas **Mermaid**, resaltado de código, tabla de contenidos y estilos personalizables.

No tiene dependencias de npm — sólo necesita **Node.js** (ya instalado) y un browser. Las librerías de frontend (marked, mermaid, highlight.js, DOMPurify) están vendoreadas en `public/vendor/`, así que **funciona offline**.

## Uso rápido

```powershell
git clone <tu-repo> md-reader
cd md-reader
.\start.ps1            # abre el browser en http://localhost:4321
```

Por defecto indexa la **carpeta padre** del proyecto. Para leer `.md` de cualquier otra ruta:

```powershell
.\start.ps1 C:\ruta\a\otra\carpeta
.\start.ps1 -Port 5000          # cambiar puerto
```

O directamente con Node / npm (multiplataforma — Windows, macOS, Linux):

```bash
npm start                       # = node server.js (raíz = carpeta padre)
node server.js /ruta/a/docs     # indexar una carpeta puntual
MD_ROOT=/ruta/a/docs MD_PORT=5000 node server.js
```

> No requiere `npm install`: no tiene dependencias. Las librerías de frontend están en `public/vendor/`.

## Características

- **Árbol de archivos** lateral con todos los `.md`/`.markdown`/`.mdx` (ignora `node_modules`, `.git`, `bin`, `obj`, etc.).
- **Buscador** de archivos (`Ctrl/Cmd+K`).
- **Renderizado GFM**: tablas, listas de tareas, citas, código.
- **Mermaid**: los bloques ```` ```mermaid ```` se dibujan como diagramas.
- **Resaltado de sintaxis** (highlight.js) con botón _Copiar_ en cada bloque.
- **Tabla de contenidos** flotante con seguimiento de scroll.
- **Tema claro/oscuro** y **panel de estilos**: familia tipográfica, tamaño de fuente, interlineado, ancho de contenido, color de texto / fondo / acento. Presets: Default, Sepia, Night, Alto contraste.
- Preferencias persistidas en `localStorage`.
- **Imprimir / exportar a PDF** (🖨 → "Guardar como PDF").
- **Deep links**: la URL refleja el archivo abierto (`#<ruta>`), se puede compartir/recargar.

## Estructura

```
md-reader/
├─ server.js          # servidor HTTP sin dependencias (índice + lectura de archivos)
├─ start.ps1          # launcher para Windows
├─ public/
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js          # render markdown, mermaid, TOC, settings
│  └─ vendor/         # librerías locales (offline)
```

## Seguridad

El servidor sólo lee archivos `.md` dentro de la carpeta raíz indicada (validación anti _path-traversal_) y se escucha sólo en `localhost`. El HTML renderizado se sanitiza con DOMPurify.
