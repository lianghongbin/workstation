// File: frontend/renderer.js
const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const loadingDiv = document.getElementById('loading');
    const appContainer = document.getElementById('app-container');
    const welcomeMessage = document.getElementById('welcome-message');

    const contentFrame = document.getElementById('content-frame');
    const breadcrumb = document.querySelector('.breadcrumb');
    const menuItems = document.querySelectorAll('.menu-item');

    // 切换函数：隐藏加载动画，显示主内容
    const showAppContent = () => {
        loadingDiv.style.display = 'none'; // 隐藏全屏加载动画
        appContainer.classList.remove('content-hidden'); // 移除 CSS 类，显示主内容
    };

    // 菜单点击事件：切换 iframe 页面 + 更新面包屑
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('href').replace('#', '');

            // 切换 iframe 页面
            if (contentFrame) {
                contentFrame.src = `${target}.html`;
            }

            // 高亮菜单
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // 更新面包屑
            if (breadcrumb) {
                breadcrumb.textContent = `首页 / ${item.textContent.trim()}`;
            }
        });
    });

    // 监听：主界面检查完成 (未登录)
    ipcRenderer.on('NotLoggedIn', () => {
        loadingDiv.style.display = 'none';
        console.log('[Renderer] 检查完成，未登录。隐藏 Loading，等待登录视图操作。');
    });

    // 监听：处理用户登录 (登录成功)
    ipcRenderer.on('LoggedIn', (event, user) => {
        showAppContent(); // 隐藏加载动画，显示主内容
        if (welcomeMessage) {
            welcomeMessage.textContent = `欢迎 ${user.name || '用户'} 使用仓库工作台`;
        }
        console.log('[Renderer] 登录成功，显示主界面。');
    });

    const syncBtn = document.getElementById('sync-now-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            ipcRenderer.send('sync-now');
        });
    }
});