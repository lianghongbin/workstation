// File: initDB.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { app } = require('electron');

/**
 * 初始化数据库：创建 receive_data 表（如果不存在）
 * @param {string} dbPath - SQLite 文件路径
 */
async function initDB(dbPath) {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

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

    console.log(`[DB] 数据库已初始化 -> ${dbPath}`);
    await db.close();
}

// 如果独立运行这个文件（node initDB.js），自动执行初始化
if (require.main === module) {
    // ⚠️ 注意：如果在 Electron 主进程调用，就传 app.getPath('userData')
    const dbPath = path.join(__dirname, 'db', 'receive.db');
    initDB(dbPath).catch(err => console.error(err));
}

module.exports = initDB;