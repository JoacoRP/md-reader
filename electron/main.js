'use strict';
/* Proceso principal de Electron.
   Arranca el server HTTP existente (in-process, puerto efímero, sin abrir
   browser) y muestra el frontend en una ventana propia. */

const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const { startServer } = require('../server.js');
const pkg = require('../package.json');

let mainWindow = null;
let serverInfo = null;

// Instancia única: si abren la app dos veces, enfocamos la ventana existente.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: 'Markdown Reader',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#ffffff',
    show: false
  });

  // 127.0.0.1 explícito: el server bindea IPv4 loopback y "localhost" en
  // Chromium puede resolver a ::1 (IPv6) y fallar la conexión.
  mainWindow.loadURL(`http://127.0.0.1:${serverInfo.port}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[md-reader] no se pudo cargar la app:', code, desc);
  });

  // Links externos y "abrir mock en pestaña nueva" → browser por defecto.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// "Abrir carpeta…": dialog nativo → reusa changeRoot() del cliente.
async function pickFolder() {
  if (!mainWindow) return;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Elegí la carpeta raíz',
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths.length) return;
  const folder = res.filePaths[0];
  // El front React expone window.__mdChangeRoot (ver AppShell) para cambiar la
  // raíz del lector desde el menú nativo.
  mainWindow.webContents
    .executeJavaScript(`window.__mdChangeRoot && window.__mdChangeRoot(${JSON.stringify(folder)})`)
    .catch(() => {});
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Abrir carpeta…', accelerator: 'CmdOrCtrl+O', click: pickFolder },
        { type: 'separator' },
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => dialog.showMessageBox(mainWindow, {
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
