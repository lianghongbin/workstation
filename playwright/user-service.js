// File: electron/user-service.js (Electron 版本 - 关键修正)
const { BrowserView } = require('electron');

// --- 1. 定义所需的选择器 ---
// 未登录指示器：使用您提供的更快的选择器
const SIGN_IN_BUTTON_SELECTOR = '.kd-button-secondary:has-text("Sign in Now")';

// 已登录指示器：用于点击触发浮层和提取数据
const AVATAR_SELECTOR = '.avatar-container';
const CARD_SELECTOR = '.personal-user-card';

// --- 2. 定义超时常量 ---
// 在 Electron 中，executeJavaScript 没有内置超时，需要手动实现或依赖 DOM 检查。
const TIMEOUT_GENERAL = 10000;

/**
 * [通用辅助函数] 等待 DOM 元素出现 (通过 JS 轮询实现 Playwright 的 waitFor)
 * @param {BrowserView} view - Electron BrowserView 实例
 * @param {string} selector - CSS 选择器
 */
function waitForElement(view, selector, timeout = TIMEOUT_GENERAL) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = setInterval(async () => {
            if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error(`Timeout waiting for selector: ${selector}`));
                return;
            }

            try {
                // 检查元素是否存在且可见
                const exists = await view.webContents.executeJavaScript(`
                    (() => {
                        const el = document.querySelector('${selector}');
                        if (!el) return false;
                        const style = window.getComputedStyle(el);
                        // 检查元素是否在 DOM 中且可见（非 display:none, 非 visibility:hidden, 尺寸非零）
                        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
                    })();
                `, true); // 第二个参数 true 表示返回 Promise

                if (exists) {
                    clearInterval(interval);
                    resolve(true);
                }
            } catch (error) {
                // 忽略执行 JS 时的暂时性错误
            }
        }, 500); // 每 500ms 检查一次
    });
}


/**
 * [独立方法] 判断用户是否已登录。
 * @param {BrowserView} view - Electron BrowserView 实例。
 */
async function isUserLoggedIn(view) {
    if (!view || view.webContents.isDestroyed()) {
        console.error('[isUserLoggedIn] 无效的 BrowserView');
        return false;
    }

    try {
        // 🌟 关键修正：等待“Sign in Now”按钮出现并可见
        await waitForElement(view, SIGN_IN_BUTTON_SELECTOR, TIMEOUT_GENERAL);

        console.log('[isUserLoggedIn] 发现 "Sign in Now" 按钮，用户未登录。');
        return false;
    } catch (err) {
        // 如果 waitForElement 超时，则认为按钮不存在，已登录。
        console.warn('[isUserLoggedIn] 按钮超时未显示，默认为已登录:');
        return true;
    }
}

module.exports = {
    isUserLoggedIn
};