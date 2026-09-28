'use strict';
/* Proceso principal de Electron.
   Arranca el server HTTP existente (in-process, puerto efímero, sin abrir
   browser) y muestra el frontend en una ventana propia. Puede haber varias
   ventanas: un documento se puede abrir "aparte" para compararlo con otro. */

const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const { startServer } = require('../server.js');
const pkg = require('../package.json');

let serverInfo = null;

const WINDOW_OPTIONS = {
  width: 1280,
  height: 860,
  minWidth: 800,
  minHeight: 600,
  title: 'Markdown Reader',
  icon: path.join(__dirname, '..', 'build', 'icon.ico'),
  backgroundColor: '#ffffff',
  show: false
};

// 127.0.0.1 explícito: el server bindea IPv4 loopback y "localhost" en
// Chromium puede resolver a ::1 (IPv6) y fallar la conexión.
function baseUrl() {
  return `http://127.0.0.1:${serverInfo.port}`;
}

// Ventana sobre la que actúan el menú y los diálogos: la que tiene el foco y, si
// no hay ninguna enfocada, la primera abierta.
function targetWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

// Instancia única: si abren la app dos veces, enfocamos la ventana existente.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = targetWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // Todo lo que pida abrirse aparte (window.open, target=_blank, Ctrl/rueda sobre
  // un link) pasa por acá. Lo del propio origen —otro documento, un diagrama
  // Mermaid, un mock— se abre como VENTANA DE LA APP en vez de saltar al browser
  // del sistema apuntando a un puerto efímero que muere al cerrarla; lo externo
  // sigue yendo al browser. Se registra por web-contents para que las ventanas
  // nuevas hereden la misma política.
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (serverInfo && url.startsWith(baseUrl())) {
        return { action: 'allow', overrideBrowserWindowOptions: WINDOW_OPTIONS };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    });

    contents.on('did-create-window', (win, { disposition }) => {
      // El click de rueda pide una pestaña "de fondo": esa no roba el foco.
      const background = disposition === 'background-tab';
      win.once('ready-to-show', () => (background ? win.showInactive() : win.show()));
      trackWindow(win);
    });
  });

  app.whenReady().then(async () => {
    serverInfo = await startServer({
      port: 0,                                 // el SO asigna un puerto libre
      open: false,                             // la ventana de Electron es la UI
      configDir: app.getPath('userData'),      // %APPDATA%\Markdown Reader
      defaultRoot: app.getPath('documents')    // raíz por defecto = Documentos
    });
    createWindow();
    buildMenu();
  });

  app.on('window-all-closed', () => app.quit());
}

function createWindow() {
  const win = new BrowserWindow(WINDOW_OPTIONS);
  win.loadURL(baseUrl());
  win.once('ready-to-show', () => win.show());
  trackWindow(win);
  return win;
}

function trackWindow(win) {
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[md-reader] no se pudo cargar la app:', code, desc);
  });
}

// Corre código en el frontend de una ventana. El front expone los puentes
// window.__mdChangeRoot y window.__mdTabs (ver AppShell).
function callRenderer(win, js) {
  if (!win) return Promise.resolve(null);
  return win.webContents.executeJavaScript(js).catch(() => null);
}

// "Abrir carpeta…": dialog nativo → reusa changeRoot() del cliente.
async function pickFolder() {
  const win = targetWindow();
  if (!win) return;
  const res = await dialog.showOpenDialog(win, {
    title: 'Elegí la carpeta raíz',
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths.length) return;
  callRenderer(win, `window.__mdChangeRoot && window.__mdChangeRoot(${JSON.stringify(res.filePaths[0])})`);
}

// Ctrl+W cierra la pestaña activa; si no hay ninguna (o la ventana muestra
// Ajustes o un diagrama), cierra la ventana, que es lo que uno espera.
async function closeTabOrWindow() {
  const win = targetWindow();
  if (!win) return;
  const closed = await callRenderer(win, '!!(window.__mdTabs && window.__mdTabs.close())');
  if (!closed) win.close();
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Abrir carpeta…', accelerator: 'CmdOrCtrl+O', click: pickFolder },
        { type: 'separator' },
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => targetWindow() && targetWindow().reload() },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      // Los atajos de siempre viven acá porque el browser se reserva Ctrl+Tab y
      // Ctrl+W y una página web no los puede interceptar; el frontend ofrece
      // Ctrl+Alt+Flechas / Ctrl+Alt+W, que funcionan en los dos lados.
      label: 'Pestañas',
      submenu: [
        {
          label: 'Siguiente',
          accelerator: 'Control+Tab',
          click: () => callRenderer(targetWindow(), 'window.__mdTabs && window.__mdTabs.next()')
        },
        {
          label: 'Anterior',
          accelerator: 'Control+Shift+Tab',
          click: () => callRenderer(targetWindow(), 'window.__mdTabs && window.__mdTabs.prev()')
        },
        { type: 'separator' },
        { label: 'Cerrar pestaña', accelerator: 'CmdOrCtrl+W', click: closeTabOrWindow }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => dialog.showMessageBox(targetWindow(), {
            type: 'info',
            title: 'Acerca de Markdown Reader',
            message: 'Markdown Reader',
            detail: `Versión ${pkg.version}\n\nLector local de Markdown y mocks HTML.`,
            buttons: ['OK']
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
