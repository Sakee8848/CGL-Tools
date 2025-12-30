// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', function () {

    // 上传按钮点击事件
    document.getElementById('uploadBtn').addEventListener('click', function () {
        document.getElementById('fileInput').click();
    });

    // 打开完整版工具
    document.getElementById('fullToolBtn').addEventListener('click', function () {
        chrome.tabs.create({ url: 'https://spontaneous-bublanina-8201df.netlify.app' });
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

                    alert(`✅ 成功抓取 ${data.itemCount} 条数据！\n点击"打开完整版工具"查看详细分析。`);
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
            let extractedText = '';

            // 根据文件类型进行处理
            if (fileExt === 'txt' || fileExt === 'csv') {
                // 直接读取文本文件
                extractedText = await file.text();
                processTextData(extractedText, fileExt);

            } else if (fileExt === 'xlsx' || fileExt === 'xls') {
                // Excel 文件：提示用户使用完整版工具
                alert('📊 Excel 文件检测成功！\n\n由于浏览器插件环境限制，请点击"打开完整版工具"进行详细分析。\n\n完整版工具支持：\n✓ Excel 完整解析\n✓ 品类智能匹配\n✓ 保费精准计算');

            } else if (fileExt === 'pdf' || fileExt === 'docx' || fileExt === 'doc') {
                // PDF/Word 文件：提示用户使用完整版工具
                alert('📄 文档文件检测成功！\n\n由于浏览器插件环境限制，请点击"打开完整版工具"进行详细分析。\n\n完整版工具支持：\n✓ PDF 文本提取\n✓ Word 文档解析\n✓ 智能数据识别');

            } else {
                alert('⚠️ 不支持的文件格式\n\n请上传以下格式之一：\n• Excel (.xlsx, .xls)\n• 文本 (.txt, .csv)\n• PDF (.pdf)\n• Word (.docx, .doc)');
            }

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

            alert(`✅ 文本解析成功！\n\n检测到 ${skuCount} 个SKU\n总销售额: $${totalSales.toFixed(2)}\n\n💡 点击"打开完整版工具"获取详细分析`);
        } else {
            alert('⚠️ 未能从文件中识别出有效的 SKU 数据\n\n建议：\n1. 确保文件包含 SKU 编码\n2. 或使用完整版工具上传');
        }
    }

});
