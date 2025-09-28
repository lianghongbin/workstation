const sqlite3 = require("sqlite3");
const {open} = require("sqlite");
const fetch = require("node-fetch");

class VikaShipment {
    constructor(table, dbPath) {
        this.table = table;      // 例如 'ship_data'
        this.dbPath = dbPath;

        // 🔒 写死配置（按你现有保持不变）
        this.token = "uskI2CEJkCSNZNU2KArVUTU";
        this.datasheetId = "dstl0nkkjrg2hlXfRk"; // 出货表格 ID

        // ⚠️ 显示名映射（与 Vika 表头一致）
        this.fieldMap = {
            barcode: "产品条码",
            cartons: "箱数",
            qty: "每箱数量",
            weight: "重量",
            spec: "箱规",
            remark: "备注",
            createdAt: "提交时间",
            files: "标签文件"   // ✅ [FIX] 补充附件字段
        };
    }

    async connectDB() {
        // [ADD] 若已连接则复用，避免重复打开
        if (this.db) return this.db;
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
        return this.db;
    }

    async getUnsynced() {
        return this.db.all(
            `SELECT *
             FROM ${this.table}
             WHERE synced = 0
             ORDER BY createdAt ASC`
        );
    }

    async markSynced(id) {
        await this.db.run(`UPDATE ${this.table}
                           SET synced = 1
                           WHERE id = ?`, [id]);
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

            // 限速：1 秒最多 2 次（维持你之前策略）
            await new Promise((r) => setTimeout(r, 500));
        }

        console.log(`[Sync:${this.table}] === 同步任务完成 ===`);
    }

    async saveData(data) {
        try {
            await this.db.run(
                `INSERT INTO ${this.table}
                     (barcode, cartons, qty, weight, spec, remark, synced, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
                // [NOTE] 这里包含 remark，保证能保存备注
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

    /**
     * 从 Vika API 查询记录（支持分页 + 模糊搜索）
     * @param {number} page - 页码（从 1 开始）
     * @param {number} pageSize - 每页数量
     * @param {string} search - 模糊搜索字段值（产品条码）
     */
    async queryShipments(page = 1, pageSize = 20, search = "") {
        const params = new URLSearchParams();
        params.append("pageNum", page);
        params.append("pageSize", pageSize);
        params.append("fieldKey", "name"); // 返回中文字段名

        const sort = '{"field": "提交时间", "order": "desc"}'
        params.set("sort", sort);

        // ✅ 搜索条件（如果有的话）
        if (search && search.trim() !== "") {
            params.append("filterByFormula", `find("${search}", {${this.fieldMap.barcode}}) > 0`);
        }

        const url = `https://api.vika.cn/fusion/v1/datasheets/${this.datasheetId}/records?${params.toString()}`;
        console.log("[Query] 请求 URL:", url);

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {Authorization: `Bearer ${this.token}`},
                redirect: "follow"
            });
            const result = await response.json();

            console.log("[Query] 返回结果:", result);

            if (!result.success) {
                throw new Error(`Vika API 查询失败: code=${result.code}, msg=${result.message}`);
            }

            // ✅ 提取 fields 中的值
            const records = (result.data.records || []).map((rec) => ({
                recordId: rec.recordId,
                barcode: rec.fields[this.fieldMap.barcode] || "",
                cartons: rec.fields[this.fieldMap.cartons] || "",
                qty: rec.fields[this.fieldMap.qty] || "",
                weight: rec.fields[this.fieldMap.weight] || "",
                spec: rec.fields[this.fieldMap.spec] || "",
                remark: rec.fields[this.fieldMap.remark] || "",
                createdAt: rec.fields["提交时间"] || rec.createdAt,

                // ✅ 提取附件
                files: (rec.fields[this.fieldMap.files] || []).map(f => ({
                    id: f.id,
                    name: f.name,
                    url: f.url,
                    preview: f.preview,
                    mimeType: f.mimeType,
                    size: f.size
                }))
            }));


            return {
                page,
                totalPages: Math.ceil((result.data.total || 0) / pageSize),
                records
            };
        } catch (error) {
            console.error("[Query] 调用出错:", error);
            throw error;
        }
    }
}

// [FIX] 仅导出类本身。外部通过实例方法调用 queryShipments(...)
module.exports = VikaShipment;