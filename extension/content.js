// Content Script - 注入到亚马逊页面中
// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        console.log('🔍 CGL: 开始提取数据...');
        const extractedData = extractAmazonData();
        console.log('📊 CGL: 提取结果:', extractedData);
        sendResponse({ success: true, data: extractedData });
    }
    return true; // 保持消息通道开启
});

// 提取亚马逊页面数据的核心函数
function extractAmazonData() {
    const results = [];
    const url = window.location.href;

    console.log('🌐 当前页面:', url);

    // 检测页面类型
    const isSeller = url.includes('sellercentral') || url.includes('seller-central');
    const isBusinessReport = url.includes('business-report') || url.includes('sales-report');

    console.log('📍 页面类型:', { isSeller, isBusinessReport });

    // 方案1: 尝试从表格中提取（适用于 Business Reports 页面）
    const tables = document.querySelectorAll('table');
    console.log(`📋 找到 ${tables.length} 个表格`);

    tables.forEach((table, tableIndex) => {
        const rows = table.querySelectorAll('tr');
        console.log(`  表格 ${tableIndex + 1}: ${rows.length} 行`);

        rows.forEach((row, rowIndex) => {
            if (rowIndex === 0) return; // 跳过表头

            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
                const cellTexts = Array.from(cells).map(c => c.innerText?.trim());

                // 尝试识别 SKU 和销售额
                cellTexts.forEach((text, i) => {
                    // SKU 通常是大写字母+数字组合
                    if (/^[A-Z0-9]{8,}$/.test(text)) {
                        const nextCell = cellTexts[i + 1];
                        const sales = nextCell ? parseFloat(nextCell.replace(/[^0-9.]/g, '')) : 0;

                        if (sales > 0 || true) { // 即使销售额为0也记录
                            results.push({
                                sku: text,
                                sales: sales,
                                source: `table-${tableIndex + 1}-row-${rowIndex + 1}`
                            });
                        }
                    }
                });
            }
        });
    });

    // 方案2: 从页面文本中提取 ASIN/SKU 模式
    if (results.length === 0) {
        console.log('⚠️ 表格中未找到数据，尝试文本提取...');

        const bodyText = document.body.innerText;
        const asinPattern = /\b([B][A-Z0-9]{9})\b/g;
        const asinMatches = [...new Set(bodyText.match(asinPattern) || [])];

        console.log(`🔤 找到 ${asinMatches.length} 个可能的 ASIN`);

        asinMatches.slice(0, 20).forEach(asin => {
            results.push({
                sku: asin,
                sales: 0,
                source: 'text-pattern',
                note: '从页面文本提取，需手动输入销售额'
            });
        });
    }

    // 方案3: 如果是商品详情页，提取当前商品的 ASIN
    if (results.length === 0 && url.includes('/dp/')) {
        const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch) {
            console.log('📦 检测到商品详情页，ASIN:', asinMatch[1]);
            results.push({
                sku: asinMatch[1],
                sales: 0,
                source: 'product-page',
                note: '当前商品页面'
            });
        }
    }

    console.log(`✅ 最终提取到 ${results.length} 条数据`);

    return {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        pageType: isSeller ? 'seller-central' : 'customer-facing',
        itemCount: results.length,
        items: results.slice(0, 50) // 最多返回50条
    };
}

// 页面加载完成后，在控制台显示提示
console.log('🛡️ CGL 智能助手已激活');
console.log('💡 提示: 请在亚马逊卖家中心 (Seller Central) 的业务报告页面使用数据提取功能');
console.log('📍 当前页面:', window.location.href);
