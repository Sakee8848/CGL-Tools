// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', function () {

    // 上传按钮点击事件
    document.getElementById('uploadBtn').addEventListener('click', function () {
        document.getElementById('fileInput').click();
    });

    // 打开完整版工具 (改为打开插件内的 index.html 以实现数据互通)
    document.getElementById('fullToolBtn').addEventListener('click', function () {
        chrome.tabs.create({ url: 'index.html' });
    });

    // 🆕 抓取当前页面数据
    // 🆕 抓取当前页面数据
    document.getElementById('extractBtn').addEventListener('click', function () {
        const btn = this;
        const originalText = btn.textContent;
        const loadingText = '⏳ 正在抓取...';

        if (btn.textContent === loadingText) return; // Prevent double click

        btn.textContent = loadingText;
        btn.disabled = true;
        document.getElementById('extractResult').style.display = 'none';

        // 1. 获取当前活跃的 Tab
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || tabs.length === 0) {
                alert('无法获取当前页面信息');
                resetBtn();
                return;
            }

            const activeTab = tabs[0];

            // 2. 发送消息给 Content Script
            // 注意：必须使用 tabs.sendMessage 才能发送给特定页面的 content.js
            chrome.tabs.sendMessage(activeTab.id, { action: 'extract' }, (response) => {
                // 检查 runtime.lastError (如 content script 未加载)
                if (chrome.runtime.lastError) {
                    console.error("Communication Error:", chrome.runtime.lastError);
                    alert('连接由于页面刷新而断开，或者插件未在当前页面加载。\n\n请尝试刷新亚马逊页面后再点击。');
                    resetBtn();
                    return;
                }

                resetBtn();

                if (response && response.success && response.data) {
                    const data = response.data;

                    if (data.itemCount > 0) {
                        // 显示抓取结果
                        document.getElementById('extractResult').style.display = 'block';
                        document.getElementById('extractCount').textContent = data.itemCount;

                        // 计算总销售额
                        const totalSales = data.items.reduce((sum, item) => sum + (item.sales || 0), 0);
                        document.getElementById('extractSales').textContent =
                            '$' + new Intl.NumberFormat('en-US').format(totalSales.toFixed(2));

                        // 存储到本地存储，供 full tool 使用 (如果 full tool 有权限)
                        chrome.storage.local.set({
                            extractedData: data,
                            extractedAt: new Date().toISOString()
                        });

                        // 动态添加下载按钮
                        const resultDiv = document.getElementById('extractResult');
                        // Remove any existing download button
                        const oldBtn = document.getElementById('dl-btn');
                        if (oldBtn) oldBtn.remove();

                        const dlBtn = document.createElement('button');
                        dlBtn.id = 'dl-btn';
                        dlBtn.textContent = '📥 下载抓取结果 (.json)';
                        dlBtn.style.cssText = 'margin-top:10px; width:100%; background:#48bb78; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;';
                        dlBtn.onclick = () => {
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `amazon_scrape_${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                        };
                        resultDiv.appendChild(dlBtn);

                        // 自动变更按钮状态
                        document.getElementById('fullToolBtn').textContent = '打开完整版工具 (数据已就绪)';
                        document.getElementById('fullToolBtn').style.background = 'linear-gradient(90deg, #48bb78 0%, #38a169 100%)';
                        document.getElementById('fullToolBtn').style.color = 'white';
                        document.getElementById('fullToolBtn').style.fontWeight = 'bold';
                        document.getElementById('fullToolBtn').style.boxShadow = '0 4px 6px rgba(72, 187, 120, 0.3)';

                        // 简短提示
                        // alert(`✅ 成功抓取 ${data.itemCount} 条数据！\n\n点击"打开完整版工具"即可生成报告。`);
                    } else {
                        // 没抓到数据，但在 Search/Store 页面可能是正常的 (如果还没加载完)，但如果是详情页...
                        alert('⚠️ 未能提取到 SKU 数据。\n\n请确认：\n1. 您在亚马逊【搜索结果页】或【品牌旗舰店】\n2. 页面已加载完毕\n\n建议尝试刷新页面重试。');
                    }
                } else {
                    const errorMsg = response?.error || '未知错误';
                    alert(`❌ 抓取失败: ${errorMsg}`);
                }
            });
        });

        function resetBtn() {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // 文件选择事件 - 支持多种格式
    document.getElementById('fileInput').addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name;
        const fileExt = fileName.split('.').pop().toLowerCase();

        try {
            // 读取文件为 Base64 以便存储
            const reader = new FileReader();
            reader.onload = async function (evt) {
                const base64Data = evt.target.result; // Data URL

                // 存入 chrome.storage.local
                await chrome.storage.local.set({
                    pendingUpload: {
                        name: fileName,
                        type: fileExt,
                        data: base64Data,
                        timestamp: Date.now()
                    }
                });

                // UI 反馈：改为“已同步”
                console.log("File stored in pendingUpload:", fileName);
                document.getElementById('fullToolBtn').textContent = '打开完整工具 (文件已就绪)';
                document.getElementById('fullToolBtn').style.background = '#48bb78'; // Green
                document.getElementById('fullToolBtn').style.color = 'white';

                // 针对不同文件类型的处理
                if (fileExt === 'txt' || fileExt === 'csv') {
                    // 文本文件：尝试直接解析并展示预览
                    const textContent = atob(base64Data.split(',')[1]); // Decode base64
                    processTextData(textContent, fileExt);
                } else {
                    // Excel/PDF: 仅展示就绪状态
                    document.getElementById('result').style.display = 'block';
                    document.getElementById('premium').innerHTML = '<span style="font-size:14px; color:#4a5568;">数据已同步</span>';

                    // 修改显示的提示文字
                    const resultDiv = document.getElementById('result');
                    const span = resultDiv.querySelector('span');
                    if (span) span.textContent = "待完整版工具分析";

                    alert('📊 文件已同步！\n\n点击下方 "打开完整版工具" 即可自动加载该文件并开始分析。');
                }
            };
            reader.readAsDataURL(file);

        } catch (err) {
            console.error('文件处理失败:', err);
            alert('文件处理失败，请尝试使用完整版工具');
        }
    });

    // 处理文本数据（TXT/CSV）
    function processTextData(text, fileType) {
        // 尝试从文本中提取 SKU 和销售数据
        const lines = text.split('\n').filter(line => line.trim());
        let skuCount = 0;
        let totalSales = 0;

        lines.forEach(line => {
            // 尝试匹配 SKU 模式（大写字母+数字）
            const skuMatch = line.match(/\b([A-Z0-9]{8,})\b/);
            // 尝试匹配金额（数字）
            const salesMatch = line.match(/[\$¥]?\s?([0-9,]+\.?\d*)/);

            if (skuMatch) {
                skuCount++;
                if (salesMatch) {
                    const sales = parseFloat(salesMatch[1].replace(/,/g, ''));
                    if (!isNaN(sales)) {
                        totalSales += sales;
                    }
                }
            }
        });

        if (skuCount > 0) {
            // 显示简易结果
            document.getElementById('result').style.display = 'block';
            const mockPremium = totalSales * 0.00065 * 7.2; // 简化计算
            document.getElementById('premium').textContent =
                '¥' + new Intl.NumberFormat('zh-CN').format(mockPremium.toFixed(2));

            // 修改显示的提示文字
            const resultDiv = document.getElementById('result');
            const span = resultDiv.querySelector('span');
            if (span) span.textContent = `预估总保费 (基于 ${skuCount} 个SKU)`;

        } else {
            alert('⚠️ 未能从文件中识别出有效的 SKU 数据\n\n建议直接打开完整版工具进行更深度解析。');
        }
    }

});
