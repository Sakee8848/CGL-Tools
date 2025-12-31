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
    document.getElementById('extractBtn').addEventListener('click', function () {
        const btn = this;
        const originalText = btn.textContent;
        btn.textContent = '抓取中...';
        btn.disabled = true;

        chrome.runtime.sendMessage({ action: 'getCurrentTabData' }, (response) => {
            btn.textContent = originalText;
            btn.disabled = false;

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

                    // 保存数据到 storage，供完整版工具使用
                    chrome.storage.local.set({
                        extractedData: data,
                        extractedAt: new Date().toISOString()
                    });

                    // 自动变更按钮状态
                    document.getElementById('fullToolBtn').textContent = '打开完整版工具 (已同步数据)';
                    document.getElementById('fullToolBtn').style.background = '#48bb78';
                    document.getElementById('fullToolBtn').style.color = 'white';

                    alert(`✅ 成功抓取 ${data.itemCount} 条数据！\n数据已同步，点击下方按钮打开完整版工具进行分析。`);
                } else {
                    alert('⚠️ 未在当前页面检测到销售数据\n\n请确保您在亚马逊卖家中心的业务报告页面。');
                }
            } else {
                alert(response?.error || '抓取失败，请在亚马逊卖家中心页面使用此功能');
            }
        });
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
