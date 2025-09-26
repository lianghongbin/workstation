const { BrowserView, BrowserWindow } = require('electron');

let mainWindowRef = null;
let loginView = null; // Electron BrowserView 实例

/**
 * 绑定主窗口，用于将 BrowserView 附加到主窗口。
 * @param {BrowserWindow} win Electron 主窗口实例。
 */
function setMainWindow(win) {
    mainWindowRef = win;
    console.log('[login-controller] mainWindow 已绑定。');
}

/**
 * 创建登录视图 (仅创建和加载，不挂载)。
 * @returns {BrowserView} 登录视图实例。
 */
async function createLoginView() {
    if (loginView && !loginView.webContents.isDestroyed()) {
        return loginView; // 已经存在则复用
    }

    loginView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
            // preload: path.join(__dirname, 'preload.js') // 如果需要，可以加 preload
        }
    });

    // 加载登录页面的 URL
    await loginView.webContents.loadURL('https://www.kdocs.cn/l/cr2oJyUr1PbV');
    console.log('[login-controller] BrowserView 登录页面已创建并加载。');

    return loginView;
}

/**
 * 显示登录视图 (挂载到主窗口)。
 */
async function showLoginView() {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
        console.error('[login-controller] 错误: mainWindow 未设置或已销毁');
        throw new Error('Main window not set or destroyed');
    }

    if (!loginView || loginView.webContents.isDestroyed()) {
        // 如果还没有创建，则先创建
        await createLoginView();
    }

    mainWindowRef.setBrowserView(loginView);
    resizeLoginViewIfAny();
    console.log('[login-controller] BrowserView 已显示。');
    return loginView;
}

/**
 * 隐藏登录视图 (从主窗口移除)。
 */
function hideLoginView() {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

    if (mainWindowRef.getBrowserView() === loginView) {
        mainWindowRef.setBrowserView(null);
        console.log('[login-controller] BrowserView 已隐藏。');
    }
}

/**
 * 重新计算并设置 BrowserView 的边界。
 */
function resizeLoginViewIfAny() {
    if (!loginView || loginView.webContents.isDestroyed() || !mainWindowRef) return;

    const bounds = mainWindowRef.getBounds();
    const viewWidth = 800;
    const viewHeight = 600;
    const x = Math.floor((bounds.width - viewWidth) / 2);
    const y = Math.floor((bounds.height - viewHeight) / 2);

    loginView.setBounds({ x: x, y: y, width: viewWidth, height: viewHeight });
}

// 在主窗口 resize 时调用此函数
if (process.type === 'browser') {
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.on('resize', resizeLoginViewIfAny);
        }
    });
}

module.exports = {
    setMainWindow,
    showLoginView,
    hideLoginView,
    createLoginView,
};