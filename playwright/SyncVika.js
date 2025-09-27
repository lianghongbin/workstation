const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fetch = require('node-fetch');

class SyncVika {
    constructor({ dbPath, table }) {
        this.dbPath = dbPath;
        this.table = table;
        this.datasheetId = 'dstsnDVylQhjuBiSEo';
        this.apiToken = 'uskI2CEJkCSNZNU2KArVUTU';
        this.db = null;
        this._syncing = false;
    }

    // 连接 SQLite 数据库，并初始化表
    async connectDB() {
        this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });
        console.log(`[DB] 已连接数据库 ${this.dbPath}`);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS ${this.table} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entryDate TEXT,
                customerId TEXT,
                packageNo TEXT UNIQUE,
                packageQty INTEGER,
                remark TEXT,
                synced INTEGER DEFAULT 0,
                createdAt TEXT DEFAULT (datetime('now'))
            );
        `);
    }

    // 保存一条收货数据
    async saveData(row) {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run(
            `INSERT OR IGNORE INTO ${this.table}
            (entryDate, customerId, packageNo, packageQty, remark, synced, createdAt)
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
            [
                row.entryDate || '',
                row.customerId || '',
                row.packageNo || '',
                Number(row.packageQty || 0),
                row.remark || ''
            ]
        );
        console.log(`[DB] 插入收货数据 packageNo=${row.packageNo}, synced=0`);
    }

    // 获取未同步的数据
    async getUnsynced() {
        if (!this.db) throw new Error('Database not connected');
        return this.db.all(
            `SELECT * FROM ${this.table} WHERE synced = 0 ORDER BY createdAt ASC`
        );
    }

    // 标记已同步
    async markSynced(id) {
        if (!this.db) throw new Error('Database not connected');
        await this.db.run(`UPDATE ${this.table} SET synced = 1 WHERE id = ?`, [id]);
        console.log(`[DB] 标记已同步 id=${id}`);
    }

    // 写入 Vika 表格（使用字段 ID）
    async writeOneRow(row) {
        const payload = {
            records: [
                {
                    fields: {
                        "入仓时间": row.entryDate,
                        "客户代码": row.customerId,
                        "入仓包裹单号": row.packageNo,
                        "单个包裹数量": parseInt(row.packageQty, 10),
                        "备注": row.remark || ""
                    }
                }
            ]
        };

        try {
            const res = await fetch(
                `https://api.vika.cn/fusion/v1/datasheets/${this.datasheetId}/records?fieldKey=name`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            const json = await res.json();
            if (json.success) {
                return { ok: true, msg: `写入成功 recordId=${json.data.records[0].recordId}` };
            } else {
                return { ok: false, msg: `写入失败 code=${json.code} message=${json.message}` };
            }
        } catch (e) {
            return { ok: false, msg: e.message };
        }
    }

    // 执行同步任务
    async syncToVika() {
        if (this._syncing) {
            console.log('[Sync] 已有任务在运行，跳过本次');
            return;
        }
        this._syncing = true;

        try {
            const rows = await this.getUnsynced();
            if (!rows.length) {
                console.log(`[Sync:${this.table}] 没有待同步数据`);
                return;
            }

            for (const row of rows) {
                console.log(`[Sync:${this.table}] 尝试写入 packageNo=${row.packageNo}`);
                const result = await this.writeOneRow(row);
                console.log(`[Sync:${this.table}] API 返回结果:`, result);

                if (result.ok) {
                    await this.markSynced(row.id);
                    console.log(`[Sync:${this.table}] 成功同步 packageNo=${row.packageNo}`);
                } else {
                    console.warn(`[Sync:${this.table}] 失败，保留数据 packageNo=${row.packageNo} -> ${result.msg}`);
                }
            }

            console.log(`[Sync:${this.table}] === 同步任务完成 ===`);
        } catch (err) {
            console.error('[Sync] 运行异常：', err);
        } finally {
            this._syncing = false;
        }
    }
}

module.exports = SyncVika;