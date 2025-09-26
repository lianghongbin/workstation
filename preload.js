const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 登录状态监听
    onNotLoggedIn: (callback) => ipcRenderer.on('NotLoggedIn', callback),
    onLoggedIn: (callback) => ipcRenderer.on('LoggedIn', callback),

    // 立即同步按钮
    syncNow: () => ipcRenderer.send('sync-now'),

    // 收货表单
    sendReceive: (data) => ipcRenderer.send('save-receive', data)
});