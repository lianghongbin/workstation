const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const fetch = require("node-fetch");

class VikaShipment {
    constructor(table, dbPath) {
        this.table = table;
        this.dbPath = dbPath;

        // 🔒 写死配置
        this.token = "uskI2CEJkCSNZNU2KArVUTU";
        this.datasheetId = "dstl0nkkjrg2hlXfRk"; // 出货表格 ID

        // ⚠️ 字段映射：需要和 Vika 表字段一致
        this.fieldMap = {
            barcode: "产品条码",
            cartons: "箱数",
            qty: "每箱数量",
            weight: "重量",
            spec: "箱规",
            remark: "备注"
        };
    }

    async connectDB() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
    }

    async getUnsynced() {
        return this.db.all(
            `SELECT * FROM ${this.table} WHERE synced = 0 ORDER BY createdAt ASC`
        );
    }

    async markSynced(id) {
        await this.db.run(`UPDATE ${this.table} SET synced = 1 WHERE id = ?`, [id]);
        console.log(`[DB] 标记已同步 id=${id}`);
    }

    async syncToVika() {
        const rows = await this.getUnsynced();
        if (rows.length === 0) {
            console.log(`[Sync:${this.table}] 没有待同步数据`);
            return;
        }

        console.log(`[Sync:${this.table}] 准备同步 ${rows.length} 条出货数据到 Vika...`);

        for (const row of rows) {
            try {
                const fields = {
                    [this.fieldMap.barcode]: row.barcode,
                    [this.fieldMap.cartons]: row.cartons,
                    [this.fieldMap.qty]: row.qty,
                    [this.fieldMap.weight]: row.weight,
                    [this.fieldMap.spec]: row.spec,
                    [this.fieldMap.remark]: row.remark
                };

                const body = JSON.stringify({ records: [{ fields }] });

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
                    console.log(`[Sync:${this.table}] 成功同步 barcode=${row.barcode}`);
                    await this.markSynced(row.id);
                } else {
                    console.error(
                        `[Sync:${this.table}] 写入失败 -> code=${result.code}, msg=${result.message}`
                    );
                }
            } catch (err) {
                console.error(`[Sync:${this.table}] 出错 barcode=${row.barcode}`, err);
            }

            // 限速：1 秒最多 2 次
            await new Promise((r) => setTimeout(r, 500));
        }

        console.log(`[Sync:${this.table}] === 同步任务完成 ===`);
    }

    async saveData(data) {
        try {
            await this.db.run(
                `INSERT INTO ${this.table} 
                (barcode, cartons, qty, weight,spec, remark, synced, createdAt) 
                VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
                [data.barcode, data.cartons, data.qty, data.weight, data.spec, data.remark]
            );
            console.log(`[DB] 插入成功 barcode=${data.barcode}`);
        } catch (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                console.error(`[DB] 插入失败，barcode=${data.barcode} 已存在`);
                throw new Error(`该条码 ${data.barcode} 已存在`);
            } else {
                throw err;
            }
        }
    }
}

module.exports = VikaShipment;