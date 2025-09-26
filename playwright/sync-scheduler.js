// File: syncScheduler.js
const path = require('path');
const { app } = require('electron');
const SyncKDocs = require('./SyncKDocs');

class SyncScheduler {
    constructor() {
        this.jobs = [];
    }

    async addJob({ dbPath, table, kdocsUrl, interval = 5 * 60 * 1000 }) {
        const syncer = new SyncKDocs({ dbPath, table, kdocsUrl });
        await syncer.connectDB();

        console.log(`[Scheduler] 已添加同步任务: ${table} -> ${kdocsUrl}`);

        // 启动定时任务
        const timer = setInterval(() => {
            syncer.syncToKDocs();
        }, interval);

        this.jobs.push({ syncer, timer });
    }

    stopAll() {
        this.jobs.forEach(job => clearInterval(job.timer));
        console.log('[Scheduler] 所有同步任务已停止');
    }
}

module.exports = SyncScheduler;