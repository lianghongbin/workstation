const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { app } = require('electron');

/**
 * 初始化数据库：创建需要的表（如果不存在）
 * @param {string} dbPath - SQLite 文件路径
 */
async function initDB(dbPath) {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // ✅ 收货表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS receive_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entryDate TEXT NOT NULL,
            customerId TEXT NOT NULL,
            packageNo TEXT NOT NULL UNIQUE,
            packageQty INTEGER NOT NULL,
            remark TEXT,
            synced INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ✅ 出货表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS ship_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT NOT NULL,         -- 产品条码
            cartons INTEGER NOT NULL,      -- 箱数
            qty INTEGER NOT NULL,          -- QTY 数量
            weight REAL NOT NULL,          -- 重量，支持小数
            spec TEXT,                     -- 箱规，可以输入或选择
            remark TEXT,                   -- 备注
            synced INTEGER DEFAULT 0,      -- 是否已同步到 Vika
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log(`[DB] 数据库已初始化 -> ${dbPath}`);
    await db.close();
}

// 如果独立运行这个文件（node initDB.js），自动执行初始化
if (require.main === module) {
    const dbPath = path.join(__dirname, 'db', 'receive.db');
    initDB(dbPath).catch(err => console.error(err));
}

module.exports = initDB;