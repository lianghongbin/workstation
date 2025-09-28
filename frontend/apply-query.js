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
                        <td>查看</td>
                    `;
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
});