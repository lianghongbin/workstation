// print-service.js
const { BrowserWindow } = require("electron");
const path = require("path");

class PrintService {
    constructor() {
        this.printWindow = null;
    }

    async printLabel(record) {
        return new Promise((resolve, reject) => {
            try {
                // 创建一个隐藏的打印窗口
                this.printWindow = new BrowserWindow({
                    width: 4 * 96, // 4 inches in pixels (96 DPI)
                    height: 6 * 96, // 6 inches in pixels
                    show: false, // 不显示窗口
                    webPreferences: {
                        preload: path.join(__dirname, "preload.js"),
                        nodeIntegration: false,
                        contextIsolation: true,
                    },
                });

                // 准备数据参数
                const data = encodeURIComponent(JSON.stringify(record));
                const labelUrl = `file://${path.join(__dirname, "../template", "label.html")}?data=${data}`;

                this.printWindow.loadURL(labelUrl);
                this.printWindow.webContents.on('did-finish-load', () => {
                    this.printWindow.webContents.print({
                        silent: true, // 尝试静默打印
                        printBackground: true,
                    }, (success, failureReason) => {
                        if (success) {
                            console.log("[PrintService] 打印成功");
                            resolve(true);
                        } else {
                            console.error("[PrintService] 打印失败:", failureReason);
                            reject(new Error(failureReason));
                        }
                        this.printWindow.close();
                    });
                });

                this.printWindow.on('closed', () => {
                    this.printWindow = null;
                });
            } catch (error) {
                console.error("[PrintService] 打印错误:", error);
                reject(error);
                if (this.printWindow) this.printWindow.close();
            }
        });
    }
}

module.exports = new PrintService();