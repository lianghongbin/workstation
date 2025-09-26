// File: electron-main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { setMainWindow: setLoginMainWindow, resizeLoginViewIfAny } = require('./playwright/login-controller');
const { setMainWindow: setCheckerMainWindow, startSessionWatcher } = require('./playwright/session-checker');
const SyncScheduler = require('./playwright/sync-scheduler');

let mainWindow;
let scheduler;
const db_path = path.join(__dirname, 'db', 'receive.db');
/**
 * 创建主窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 640,
        backgroundColor: '#ffffff',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,   // 必须开
            nodeIntegration: false    // 必须关
        }
    });

    // 加载前端页面
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'main.html'));


    // 绑定到现有逻辑
    setLoginMainWindow(mainWindow);
    setCheckerMainWindow(mainWindow);
    startSessionWatcher();

    mainWindow.on('resize', () => {
        try {
            resizeLoginViewIfAny();
        } catch {}
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * 应用启动
 */
app.whenReady().then(async () => {
    createWindow();

    // 初始化同步调度器
    scheduler = new SyncScheduler();

    // 添加收货表单 → 金山文档任务
    await scheduler.addJob({

        dbPath: db_path,
        table: 'receive_data',
        kdocsUrl: 'https://www.kdocs.cn/l/cr2oJyUr1PbV',
        interval: 5 * 60 * 1000 // 每5分钟执行一次
    });
});

/**
 * 退出应用
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/**
 * IPC 通道：保存表单数据
 * 渲染进程调用 ipcRenderer.send('save-receive', data)
 */
ipcMain.on('save-receive', async (event, data) => {
    const syncer = scheduler.jobs.find(j => j.syncer.table === 'receive_data')?.syncer;
    if (syncer) {
        await syncer.saveData(data);
        console.log(`[IPC] 保存收货数据成功 packageNo=${data.packageNo}`);
    }
});