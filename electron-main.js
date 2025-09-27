const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const SyncScheduler = require("./playwright/sync-scheduler");

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

    // ✅ 启动直接加载 receive.html
    const receiveHtml = path.join(__dirname,'frontend', "main.html");
    console.log("[Main] loading HTML:", receiveHtml);
    mainWindow.loadFile(receiveHtml);

    // ✅ 数据库绝对路径
    const dbPath = path.join(__dirname, "db", "receive.db");
    console.log("[Main] DB Path:", dbPath);

    scheduler.addJob("receive_data", dbPath, "receive_data");

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
 * IPC 通道：保存表单数据
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
 * IPC 通道：手动触发立即同步
 */
ipcMain.on("run-sync-now", async (event) => {
    try {
        await scheduler.runAllNow();
        event.sender.send("sync-result", { success: true, message: "同步完成" });
    } catch (err) {
        console.error("[IPC] 手动同步失败:", err.message);
        event.sender.send("sync-result", { success: false, message: err.message });
    }
});