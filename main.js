const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
    const win = new BrowserWindow({
        width: 900,
        height: 700,
        resizable: false,
        webPreferences: {
          nodeIntegration: true,     // これが true であること
          contextIsolation: false,   // これが false であること
          sandbox: false             // これが false であること
        }
      });

  win.loadFile('index.html');
  // 開発者ツールを開きたい場合はコメントアウトを解除
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});