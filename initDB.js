const Database = require("better-sqlite3");
const path = require('path');

function initDB(dbPath) {
    const db = new Database(dbPath);

    // ✅ 收货表
    db.exec(`
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
    db.exec(`
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
    db.close(); // [CHG] better-sqlite3 也是同步 close
}

// 如果独立运行这个文件（node initDB.js），自动执行初始化
if (require.main === module) {
    const dbPath = path.join(__dirname, 'db', 'receive.db');
    initDB(dbPath).catch(err => console.error(err));
}

module.exports = initDB;