document.addEventListener('DOMContentLoaded', () => {
    const loadingDiv = document.getElementById('loading');
    const appContainer = document.getElementById('app-container');
    const welcomeMessage = document.getElementById('welcome-message');

    const contentFrame = document.getElementById('content-frame');
    const breadcrumb = document.querySelector('.breadcrumb');
    const menuItems = document.querySelectorAll('.menu-item');

    // 切换函数：显示主界面
    const showAppContent = () => {
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (appContainer) appContainer.classList.remove('content-hidden');
    };

    // 菜单点击事件
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('href').replace('#', '');
            if (contentFrame) {
                contentFrame.src = `${target}.html`;
            }
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (breadcrumb) {
                breadcrumb.textContent = `首页 / ${item.textContent.trim()}`;
            }
        });
    });

    // 监听：未登录
    if (window.electronAPI?.onNotLoggedIn) {
        window.electronAPI.onNotLoggedIn(() => {
            if (loadingDiv) loadingDiv.style.display = 'none';
            console.log('[Renderer] 检查完成，未登录。隐藏 Loading，等待登录视图操作。');
        });
    }

    // 监听：登录成功
    if (window.electronAPI?.onLoggedIn) {
        window.electronAPI.onLoggedIn((event, user) => {
            showAppContent();
            if (welcomeMessage) {
                welcomeMessage.textContent = `欢迎 ${user?.name || '用户'} 使用仓库工作台`;
            }
            console.log('[Renderer] 登录成功，显示主界面。');
        });
    }

    // 立即同步按钮
    const syncBtn = document.getElementById('sync-now-btn');
    if (syncBtn && window.electronAPI?.syncNow) {
        syncBtn.addEventListener('click', () => {
            window.electronAPI.syncNow();
        });
    }
});

// 监听来自 iframe 的提交消息并转发到主进程
window.addEventListener('message', (evt) => {
    const msg = evt.data;
    if (msg && msg.type === 'save-receive' && msg.data) {
        try {
            if (window.electronAPI?.sendReceive) {
                window.electronAPI.sendReceive(msg.data);
                console.log('[Renderer] 已转发 save-receive 到主进程:', msg.data);
            } else {
                console.warn('[Renderer] electronAPI 未注入，无法转发 save-receive');
            }
        } catch (err) {
            console.error('[Renderer] 转发 save-receive 失败:', err);
        }
    }
});