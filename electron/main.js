const path = require('path');
const { app, BrowserWindow } = require('electron');

// Milestone 1: open CRA dev server in development.
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
    // CRA default dev server port
    win.loadURL('http://localhost:3000');
  } else {
    const clientBuild = path.join(__dirname, '..', 'client', 'build');
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

