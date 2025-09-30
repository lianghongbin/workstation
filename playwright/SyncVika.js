const Database = require("better-sqlite3");

class SyncVika {
    constructor(table, dbPath) {
        this.table = table;
        this.dbPath = dbPath;

        // 🔒 写死配置
        this.token = "uskI2CEJkCSNZNU2KArVUTU";
        // ✅ 改成正确的表格 ID
        this.datasheetId = "dstsnDVylQhjuBiSEo";

        this.fieldMap = {
            entryDate: "入仓时间",
            customerId: "客户代码",
            packageNo: "入仓包裹单号",
            packageQty: "单个包裹数量",
            remark: "备注"
        };
    }

    async connectDB() {
        // [ADD] 若已连接则复用，避免重复打开
        if (this.db) return this.db;

        this.db = new Database(this.dbPath);

        return this.db;
    }

    async getUnsynced() {
        return this.db.prepare(`
            SELECT *
            FROM ${this.table}
            WHERE synced = 0
            ORDER BY createdAt ASC
        `).all();
    }

    async markSynced(id) {
        this.db.prepare(`
            UPDATE ${this.table}
            SET synced = 1
            WHERE id = ?
        `).run(id);
        console.log(`[DB] 标记已同步 id=${id}`);
    }

    async syncToVika() {
        const rows = await this.getUnsynced();
        if (rows.length === 0) {
            console.log(`[Sync:${this.table}] 没有待同步数据`);
            return;
        }

        console.log(`[Sync:${this.table}] 准备同步 ${rows.length} 条数据到 Vika...`);

        for (const row of rows) {
            try {
                const fields = {
                    [this.fieldMap.entryDate]: row.entryDate,
                    [this.fieldMap.customerId]: row.customerId,
                    [this.fieldMap.packageNo]: row.packageNo,
                    [this.fieldMap.packageQty]: row.packageQty,
                    [this.fieldMap.remark]: row.remark
                };

                const body = JSON.stringify({records: [{fields}]});

                const res = await fetch(
                    `https://api.vika.cn/fusion/v1/datasheets/${this.datasheetId}/records`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${this.token}`,
                            "Content-Type": "application/json"
                        },
                        body
                    }
                );

                const result = await res.json();
                if (result.success) {
                    console.log(
                        `[Sync:${this.table}] 成功同步 packageNo=${row.packageNo}`
                    );
                    await this.markSynced(row.id);
                } else {
                    console.error(
                        `[Sync:${this.table}] 写入失败 -> code=${result.code}, msg=${result.message}`
                    );
                }
            } catch (err) {
                console.error(`[Sync:${this.table}] 出错 packageNo=${row.packageNo}`, err);
            }

            // 限速：1 秒最多 2 次
            await new Promise((r) => setTimeout(r, 500));
        }

        console.log(`[Sync:${this.table}] === 同步任务完成 ===`);
    }

    async saveData(data) {
        try {
            this.db.prepare(`
                INSERT INTO ${this.table}
                (entryDate, customerId, packageNo, packageQty, remark, synced, createdAt)
                VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
            `).run(
                data.entryDate,
                data.customerId,
                data.packageNo,
                data.packageQty,
                data.remark
            );
            console.log(`[DB] 插入成功 packageNo=${data.packageNo}`);
        } catch (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                console.error(`[DB] 插入失败，packageNo=${data.packageNo} 已存在`);
                throw new Error(`该单号 ${data.packageNo} 已存在`);
            } else {
                throw err;
            }
        }
    }
}

module.exports = SyncVika;