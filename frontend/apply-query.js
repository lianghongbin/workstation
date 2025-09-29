// apply-query.js （完整替换原有代码，保持原有结构）

document.addEventListener("DOMContentLoaded", () => {
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    const shipmentTableBody = document.querySelector("#shipmentTable tbody");
    const paginationDiv = document.getElementById("pagination");

    let currentPage = 1;
    const pageSize = 10;

    // [MOD] 新增：查询数据的桥接函数（使用 postMessage 到 parent，并等待结果）
    async function queryShipmentData(params) {
        return new Promise((resolve, reject) => {
            const channel = `query-shipment-response-${Math.random().toString(36).slice(2)}`; // 唯一通道，避免冲突

            // 监听返回结果（一次性）
            const listener = (e) => {
                if (e.data?.type === 'query-shipment-result' && e.data.channel === channel) {
                    window.removeEventListener('message', listener);
                    if (e.data.result?.error) {
                        reject(new Error(e.data.result.error));
                    } else {
                        resolve(e.data.result);
                    }
                }
            };
            window.addEventListener('message', listener);

            // 发送查询请求到 parent
            window.parent.postMessage({
                type: 'query-shipment-data',
                params,
                channel  // 带上通道 ID，便于返回匹配
            }, '*');
        });
    }

    async function loadData(page, pageSize = '20', search = "") {
        console.log("[Renderer] loadData called:", {page, pageSize, search});
        try {
            // [MOD] 改为调用桥接函数
            const result = await queryShipmentData({
                page,
                pageSize,
                search,
            });
            console.log("[Renderer] queryShipmentData result:", result);

            shipmentTableBody.innerHTML = "";
            if (result.records && result.records.length > 0) {
                result.records.forEach((r) => {
                    // 拼接多个附件链接
                    const attachments = (r.files && r.files.length > 0)
                        ? r.files.map(file => `<a href="${file.url}" target="_blank">${file.name}</a>`).join("<br>")
                        : "";

                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>${r.barcode || ""}</td>
                        <td>${r.cartons || ""}</td>
                        <td>${r.qty || ""}</td>
                        <td>${r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</td>
                        <td>${attachments}</td>
                        <td>
                            <a href="javascript:void(0)" class="view-label">查看</a>  
                            <a href="javascript:void(0)" class="view-label">打印</a>                        
                      
                        </td>
                    `;
                    shipmentTableBody.appendChild(row);
                    // 动态绑定 click 事件
                    const link = row.querySelector('.view-label');
                    link.addEventListener('click', () => showOverlay(r));
                    shipmentTableBody.appendChild(row);
                });
            } else {
                shipmentTableBody.innerHTML =
                    `<tr><td colspan="4">没有数据</td></tr>`;
            }

            // 分页
            paginationDiv.innerHTML = "";
            for (let i = 1; i <= result.totalPages; i++) {
                const btn = document.createElement("button");
                btn.textContent = i;
                if (i === result.page) btn.disabled = true;
                btn.addEventListener("click", () => {
                    currentPage = i;
                    loadData(currentPage, pageSize, searchInput.value.trim());
                });
                paginationDiv.appendChild(btn);
            }
        } catch (err) {
            console.error("[Renderer] 加载数据失败:", err);
        }
    }

    // 点击搜索
    searchBtn.addEventListener("click", () => {
        currentPage = 1;
        loadData(currentPage, pageSize, searchInput.value.trim());
    });

    // [新增] 页面加载时默认查询
    loadData(currentPage);


    /**
     * 打印相关
     */
    // 打开覆盖层并展示面单
    function showOverlay(record) {
        const overlay = document.getElementById("overlay");
        const overlayContent = document.getElementById("overlay-content");

        overlayContent.innerHTML = `
        <span class="overlay-close" onclick="closeOverlay()">×</span>
        <h3>面单内容</h3>
        <table class="label-table">
            <tr><th>产品条码</th><td>${record.barcode || ""}</td></tr>
            <tr><th>箱数</th><td>${record.cartons || ""}</td></tr>
            <tr><th>数量</th><td>${record.qty || ""}</td></tr>
            <tr><th>重量</th><td>${record.weight || ""} lb</td></tr>
            <tr><th>箱规</th><td>${record.spec || ""}</td></tr>
            <tr><th>备注</th><td>${record.remark || ""}</td></tr>
        </table>
            <button class="print-btn">打印面单</button>    `;

        // 动态绑定点击事件
        // 确保 DOM 更新后绑定事件
        setTimeout(() => {
            const printBtn = overlayContent.querySelector('.print-btn');
            if (printBtn) {
                printBtn.addEventListener('click', () => printLabel(record));
            } else {
                console.error("[Renderer] 打印按钮未找到");
            }
        }, 0);

        overlay.style.display = "flex";
    }
});

function printLabel(record) {
    // 把数据序列化放到 URL 参数
    const data = encodeURIComponent(JSON.stringify(record));
    window.open(`../template/label.html?data=${data}`, "_blank", "width=800,height=600");
}

// 关闭覆盖层
function closeOverlay() {
    document.getElementById("overlay").style.display = "none";
}