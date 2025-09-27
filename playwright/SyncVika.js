// File: SyncVika.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fetch = require('node-fetch');

class SyncVika {
    constructor({ dbPath, table }) {
        this.dbPath = dbPath;
        this.table = table;

        // ✅ 仍然使用你现有的写死配置（如需可改为外部传参）
        this.datasheetId = 'dstsnDVylQhjuBiSEo';
        this.apiToken = 'uskI2CEJkCSNZNU2KArVUTU';

        this.db = null;
        this._syncing = false;

        // ✅ 速率限制：最多 2 次/秒（最小 500ms 间隔）
        this._minIntervalMs = 500;
        this._lastPostAt = 0;
    }

    // --- 工具: 速率限制 ---
    async _throttle() {
        const now = Date.now();
        const wait = this._minIntervalMs - (now - this._lastPostAt);
        if (wait > 0) {
            // 可选：打印等待日志，便于排查
            // console.log(`[RateLimit] 等待 ${wait}ms 再提交...`);
            await new Promise(r => setTimeout(r, wait));
        }
        this._lastPostAt = Date.now();
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

    // 保存一条收货数据（包含本地查重：已同步/未同步都会拦截）
    async saveData(data) {
        try {
            await this.db.run(
                'INSERT INTO receive_data(entryDate, customerId, packageNo, packageQty, remark, synced, createdAt) VALUES(?,?,?,?,?,?,datetime("now"))',
                [data.entryDate, data.customerId, data.packageNo, data.packageQty, data.remark, 0]
            );
            console.log(`[DB] 插入成功 packageNo=${data.packageNo}`);
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                console.error(`[DB] 插入失败，packageNo=${data.packageNo} 已存在`);
                // ✅ 抛出错误，让上层 ipcMain 捕获
                throw new Error(`该单号 ${data.packageNo} 已存在`);
            } else {
                console.error(`[DB] 插入失败 packageNo=${data.packageNo}`, err);
                throw err; // 其他错误继续抛出
            }
        }
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

    // 写入 Vika 表格（当前用字段“名称”，如需更稳可切换 fieldKey=id + 字段ID）
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
            // ✅ 在每次提交前做速率限制（确保 ≤2 次/秒）
            await this._throttle();

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