// electron-main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const SyncScheduler = require("./playwright/sync-scheduler");

// [MOD] 新增：引入两个同步器（收货沿用你现有 SyncVika；出货使用 VikaShipment）
const SyncVika = require("./playwright/SyncVika");        // 收货 receive_data -> Vika 收货表
const VikaShipment = require("./playwright/VikaShipment"); // 出货 ship_data   -> Vika 出货表

let mainWindow;
const scheduler = new SyncScheduler();


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    //开启开发工具调试界面
    //mainWindow.webContents.openDevTools();


    // ✅ 启动加载主界面（保持不变）
    const mainHtml = path.join(__dirname, "frontend", "main.html");
    console.log("[Main] loading HTML:", mainHtml);
    mainWindow.loadFile(mainHtml);

    // ✅ 数据库路径（保持不变）
    const dbPath = path.join(__dirname, "db", "receive.db");
    console.log("[Main] DB Path:", dbPath);

    // [MOD] 统一在这里注册“收货 + 出货”两个同步任务到 scheduler.jobs
    (async () => {
        // 收货同步器（保持现有行为）
        const receiveSyncer = new SyncVika("receive_data", dbPath);
        await receiveSyncer.connectDB();
        const recvTimer = setInterval(() => receiveSyncer.syncToVika(), 5 * 60 * 1000);
        scheduler.jobs.push({ syncer: receiveSyncer, timer: recvTimer });

        // 出货同步器（新增）
        const shipmentSyncer = new VikaShipment("ship_data", dbPath);
        await shipmentSyncer.connectDB();
        const shipTimer = setInterval(() => shipmentSyncer.syncToVika(), 5 * 60 * 1000);
        scheduler.jobs.push({ syncer: shipmentSyncer, timer: shipTimer });

        console.log("[Scheduler] 已注册同步任务：receive_data + ship_data");
    })().catch(err => console.error("[Main] 初始化同步器失败：", err));

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

/**
 * IPC 通道：保存【收货】表单数据（保持原样）
 */
ipcMain.on("save-receive", async (event, data) => {
    const syncer = scheduler.jobs.find(j => j.syncer.table === "receive_data")?.syncer;
    if (!syncer) {
        console.error("[IPC] 没有找到 syncer");
        event.sender.send("save-receive-result", { success: false, message: "没有找到同步器" });
        return;
    }

    try {
        await syncer.saveData(data);
        console.log(`[IPC] 保存收货数据成功 packageNo=${data.packageNo}`);
        event.sender.send("save-receive-result", { success: true, message: "保存成功" });
    } catch (err) {
        console.error(`[IPC] 保存收货数据失败 packageNo=${data.packageNo}`, err.message);
        event.sender.send("save-receive-result", { success: false, message: err.message });
    }
});

/**
 * [MOD] IPC 通道：保存【出货】表单数据
 * 渲染层（ship 页面）调用 window.electronAPI.sendShip(data)
 */
ipcMain.on("save-shipment", async (event, data) => {
    const syncer = scheduler.jobs.find(j => j.syncer.table === "ship_data")?.syncer;
    if (!syncer) {
        console.error("[IPC] 没有找到 ship_data 的 syncer");
        event.sender.send("save-shipment-result", { success: false, message: "没有找到同步器" });
        return;
    }

    try {
        await syncer.saveData(data);
        console.log(`[IPC] 保存出货数据成功 barcode=${data.barcode}`);
        event.sender.send("save-shipment-result", { success: true, message: "保存成功" });
    } catch (err) {
        console.error(`[IPC] 保存出货数据失败 barcode=${data.barcode}`, err.message);
        event.sender.send("save-shipment-result", { success: false, message: err.message || "保存失败" });
    }
});

/**
 * IPC 通道：手动触发“立即同步”（保持原样）
 * 注意：scheduler.runAllNow() 内部会遍历 scheduler.jobs，
 *       因此会把所有已注册表（收货 + 出货 …）一起同步。
 */
ipcMain.on("run-sync-now", async (event) => {
    try {
        await scheduler.runAllNow();  // 会对 jobs 里的所有 syncer 逐一调用 syncToVika()
        event.sender.send("sync-result", { success: true, message: "同步完成" });
    } catch (err) {
        console.error("[IPC] 手动同步失败:", err.message);
        event.sender.send("sync-result", { success: false, message: err.message });
    }
});

// 出货申请查询
// 出货申请查询
ipcMain.handle("query-shipment-data", async (event, { page, pageSize, search }) => {
    const syncer = scheduler.jobs.find(j => j.syncer.table === "ship_data")?.syncer;
    if (!syncer) {
        console.error("[IPC] 没有找到 ship_data 的 syncer");
        return { page: 1, totalPages: 0, records: [] };
    }

    try {
        return await syncer.queryShipments(page, pageSize, search);
    } catch (err) {
        console.error("[IPC] 查询出货数据失败:", err.message);
        return { page: 1, totalPages: 0, records: [], error: err.message };
    }
});