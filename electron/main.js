const path = require('path');
const { app, BrowserWindow } = require('electron');

// Milestone 1: open Vite dev server in development.
// In production, we will point to the built client directory.
const isDev = process.env.ELECTRON_DEV !== 'false';

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0b0620',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Yuna'
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    const clientBuild = path.join(__dirname, '..', 'yuna', 'dist');
    win.loadFile(path.join(clientBuild, 'index.html'));
  }

  mainWindow = win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

