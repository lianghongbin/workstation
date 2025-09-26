// File: electron/session-checker.js
const { showLoginView, createLoginView, hideLoginView } = require('./login-controller');
const { isUserLoggedIn } = require('./user-service');

let mainWindowRef = null;
let pollingTimer = null;
let notifiedNotLogged = false; // 确保“未登录”只通知一次

function setMainWindow(win) {
    mainWindowRef = win;
    console.log('[session-checker] mainWindow 已设置。');
}

async function startSessionWatcher() {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
        console.error('[session-checker] 错误: mainWindow 未设置或已销毁');
        throw new Error('Main window not set or destroyed');
    }

    // 如果没有登录，展示登录界面
    let view = await createLoginView();

    // 如果已经登录，隐藏登录页面
    try {
        const firstLogged = await isUserLoggedIn(view);
        if (firstLogged) {
            // 登录状态：关掉 BrowserView，通知前端进入主界面
            try {
                await hideLoginView(); // 关键：把覆盖在上面的在线文档移除
                mainWindowRef.webContents.send('LoggedIn');
                console.log('[session-checker] 首次即已登录 -> 已发送 LoggedIn，软件主界面转到软件操作视图');
            } catch (e) {
                console.error('[session-checker] 首次登录后处理失败：', e);
            }
            return;
        }
    } catch (err) {
        console.error('[session-checker] 首次登录检查异常：', err);
    }

    if (!notifiedNotLogged) {
        notifiedNotLogged = true;
        try {
            await showLoginView();
            mainWindowRef.webContents.send('NotLoggedIn');
            console.log('[session-checker] 未登录 -> 已发送 NotLoggedIn');
        } catch (err) {
            console.error('[session-checker] 失败：', err);
        }
    }

    // 4) 轮询检测是否登录成功
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(async () => {
        try {
            const ok = await isUserLoggedIn(view);
            if (!ok) {
                // 仍未登录，不再向前端发送任何状态，避免“正在检查登录状态”再次出现
                return;
            }

            // 检测到已登录：拿用户信息 → 隐藏 BrowserView → 通知前端
            await hideLoginView();
            mainWindowRef.webContents.send('LoggedIn');
            console.log('[session-checker] 轮询检测到登录成功 -> 已发送 LoggedIn，并隐藏登录视图');

            clearInterval(pollingTimer);
            pollingTimer = null;
        } catch (err) {
            console.error('[session-checker] 轮询检查异常：', err);
        }
    }, 1500);
}

module.exports = {
    setMainWindow,
    startSessionWatcher
};