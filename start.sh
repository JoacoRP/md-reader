#!/usr/bin/env bash
# Markdown Reader — lanzador para macOS / Linux
# Uso:
#   ./start.sh                  sirve la carpeta padre y abre el browser
#   ./start.sh ~/ruta/a/docs    sirve otra carpeta
#   ./start.sh --port 5000      cambia el puerto
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js no está instalado o no está en el PATH."
  echo "Instalalo desde https://nodejs.org (LTS) y volvé a intentar."
  exit 1
fi

exec node "$SCRIPT_DIR/server.js" "$@"
