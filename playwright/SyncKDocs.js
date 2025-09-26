// File: SyncKDocs.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { chromium } = require('playwright');

class SyncKDocs {
    /**
     * @param {Object} options
     * @param {string} options.dbPath - SQLite 文件路径
     * @param {string} options.table - 要同步的数据表
     * @param {string} options.kdocsUrl - 金山文档链接
     */
    constructor({ dbPath, table, kdocsUrl }) {
        this.dbPath = dbPath;
        this.table = table;
        this.kdocsUrl = kdocsUrl;
        this.db = null;
    }

    // 连接数据库（外部必须先保证表已存在）
    async connectDB() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
    }

    // 获取未同步的数据
    async getUnsynced() {
        if (!this.db) throw new Error('Database not connected');
        return await this.db.all(`SELECT * FROM ${this.table} WHERE synced = 0 ORDER BY createdAt ASC`);
    }

    // 标记已同步
    async markSynced(id) {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run(`UPDATE ${this.table} SET synced = 1 WHERE id = ?`, [id]);
    }

    // 同步数据到金山文档
    async syncToKDocs() {
        if (!this.db) throw new Error('Database not connected');

        const unsynced = await this.getUnsynced();
        if (unsynced.length === 0) {
            console.log(`[Sync:${this.table}] 没有需要同步的数据`);
            return;
        }

        console.log(`[Sync:${this.table}] 开始同步 ${unsynced.length} 条数据到金山文档...`);

        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        await page.goto(this.kdocsUrl);

        // ⚠️ 要求你提前登录一次金山文档账号
        await page.waitForTimeout(5000); // 等待文档加载

        for (const row of unsynced) {
            // 光标移到最后一行第1列
            await page.keyboard.press('End');
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Home');

            // 输入五列数据 (A=日期, B=客户ID, C=包裹号, D=数量, E=备注)
            await page.keyboard.type(row.entryDate || ''); await page.keyboard.press('Tab');
            await page.keyboard.type(row.customerId || ''); await page.keyboard.press('Tab');
            await page.keyboard.type(row.packageNo || ''); await page.keyboard.press('Tab');
            await page.keyboard.type(String(row.packageQty || '')); await page.keyboard.press('Tab');
            if (row.remark) await page.keyboard.type(row.remark);
            await page.keyboard.press('Enter');

            // 更新数据库
            await this.markSynced(row.id);
            console.log(`[Sync:${this.table}] 已同步 packageNo=${row.packageNo}`);
        }

        await browser.close();
        console.log(`[Sync:${this.table}] 全部数据同步完成`);
    }
}

module.exports = SyncKDocs;