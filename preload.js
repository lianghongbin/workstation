console.log('[Preload] preload.js 已加载');
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 登录状态监听
    onNotLoggedIn: (callback) => ipcRenderer.on('NotLoggedIn', callback),
    onLoggedIn: (callback) => ipcRenderer.on('LoggedIn', callback),

    onSaveReceiveResult: (callback) =>
        ipcRenderer.on('save-receive-result', (_event, result) => {
            console.log('[Preload] 收到 save-receive-result', result);
            callback(result);
        }),
    // 立即同步按钮
    syncNow: () => ipcRenderer.send('sync-now'),

    // 收货表单
    sendReceive: (data) => ipcRenderer.send('save-receive', data)
});