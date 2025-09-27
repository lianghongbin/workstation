// File: sync-scheduler.js  (建议统一这个名字)
const SyncVika = require('./SyncVika');

class SyncScheduler {
    constructor() {
        this.jobs = [];
    }

    async addJob({ dbPath, table, datasheetId, apiToken, interval = 5 * 60 * 1000 }) {
        const syncer = new SyncVika({ dbPath, table });
        await syncer.connectDB();
        console.log(`[Scheduler] 已添加同步任务`);

        const timer = setInterval(() => {
            syncer.syncToVika();
        }, interval);

        this.jobs.push({ syncer, timer });
    }

    stopAll() {
        this.jobs.forEach(job => clearInterval(job.timer));
        console.log('[Scheduler] 所有同步任务已停止');
    }

    async runAllNow() {
        for (const job of this.jobs) {
            if (job.syncer) {
                await job.syncer.syncToVika();
            }
        }
        console.log('[Scheduler] 手动执行所有同步任务完成');
    }
}

module.exports = SyncScheduler;