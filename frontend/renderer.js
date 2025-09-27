document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('login-overlay');
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('login-username');
    const passInput = document.getElementById('login-password');

    if (!overlay || !form) return; // 找不到就什么都不做，避免影响现有逻辑

    // （可选）记住登录状态：如需每次都登录，可删除这两行
    if (localStorage.getItem('__logged_in__') === '1') {
        overlay.setAttribute('aria-hidden', 'true');
        return;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = (userInput?.value || '').trim();
        const p = (passInput?.value || '').trim();
        if (u === '810' && p === '5188') {
            localStorage.setItem('__logged_in__', '1'); // 如不需要记住，删掉
            overlay.setAttribute('aria-hidden', 'true'); // 隐藏登录浮层
            // 不做任何路由或布局修改，主界面继续照你现有逻辑工作
        } else {
            alert('账号或密码错误');
        }
    });

    // 手动同步逻辑
    const syncBtn = document.getElementById('syncNowBtn');
    if (syncBtn && window.electronAPI?.manualSync) {
        syncBtn.addEventListener('click', () => {
            console.log('[Renderer] 点击立即同步');
            window.electronAPI.manualSync();
        });
    }

    // 接收主进程返回的同步结果
    if (window.electronAPI?.onSyncResult) {
        window.electronAPI.onSyncResult((res) => {
            console.log('[Renderer] 收到同步结果:', res);
            alert(res?.message || (res?.success ? '同步完成' : '同步失败'));
        });
    }
});