// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onLoginStatus: (callback) => ipcRenderer.on('login-status', callback),
    requestLogin: () => ipcRenderer.send('request-login')
});