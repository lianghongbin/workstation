// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    /** 收货保存：子页面或父页面都可以直接调用 */
    sendReceive: (data) => ipcRenderer.send("save-receive", data),

    // 把主进程回传的保存结果事件，交给渲染层回调（renderer.js 会继续转发给 iframe 兜底）
    onSaveReceiveResult: (callback) =>
        ipcRenderer.on("save-receive-result", (_event, result) => callback(result)),

    /** 立即同步：修正为主进程实际监听的 channel 名称 */
    // 之前这里发的是 "manual-sync"，但 electron-main.js 监听的是 "run-sync-now"
    manualSync: () => ipcRenderer.send("run-sync-now"),

    /** 同步结果事件：主进程通过 "sync-result" 回传 */
    onSyncResult: (callback) =>
        ipcRenderer.on("sync-result", (_event, result) => callback(result)),

    // [MOD] ===== 新增：出货 =====
    sendShip: (data) => ipcRenderer.send('save-shipment', data),
    onSaveShipResult: (cb) => ipcRenderer.on('save-shipment-result', (_e, payload) => cb(payload)),

    //申请查询
    queryShipmentData: (params) => ipcRenderer.invoke("query-shipment-data", params),

    //打印接口
    printLabel: (record) => ipcRenderer.send('print-label', record), // 确保打印接口已定义
});