// electron-main.js - Electron main process for Windows EXE
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
  });

  // Load the game
  const indexPath = path.join(__dirname, 'client', 'index.html');
  if (fs.existsSync(indexPath)) {
    win.loadFile(indexPath);
  } else {
    console.error('index.html not found at', indexPath);
  }

  // Open devtools in development
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
