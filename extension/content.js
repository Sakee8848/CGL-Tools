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
            // 尝试获取标题
            const title = document.getElementById('productTitle')?.innerText.trim() || '当前商品';
            const priceEl = document.querySelector('.a-price .a-offscreen');
            const price = priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) : 0;

            results.push({
                sku: asinMatch[1],
                name: title,
                sales: 0,
                price: price,
                source: 'product-page',
                note: '当前商品页面'
            });
        }
    }

    // 方案4: 亚马逊前台页面 (店铺首页、搜索结果页、品牌旗舰店) - 增强版 V2
    if (results.length === 0) {
        console.log('🛍️ 尝试抓取前台/店铺页面数据 (增强模式)...');

        // --- 1. 抓取分类 (导航) ---
        const categories = new Set();
        // 针对 Storefront 的特殊导航结构
        const navLinks = document.querySelectorAll('ul[class*="navigation"] li a, div[data-testid="navigation-item"] a, .listings-menu a');

        navLinks.forEach(link => {
            const text = link.innerText.trim();
            // 严格过滤：排除短词、全大写通用词、由特殊字符组成的词
            if (text.length > 3 && text.length < 25 &&
                !/^(HOME|CART|SEARCH|MENU|OPT|SHIFT|ALT|CTRL|TAB)$/i.test(text) &&
                !/[{}[\]<>\\]/.test(text)) {
                categories.add(text);
            }
        });

        // 如果上面没抓到，尝试抓取页面所有的 H2 标题作为分类参考
        if (categories.size === 0) {
            document.querySelectorAll('h2').forEach(h => {
                if (h.innerText.length < 20) categories.add(h.innerText.trim());
            });
        }

        const detectedCategories = [...categories].slice(0, 5).join(' / ');
        console.log('📂 检测到可能的分类:', detectedCategories || "未识别到明确分类");


        // --- 2. 抓取商品 (通用视觉识别法) ---
        // 策略：寻找所有包含“价格”特征的容器，然后向上查找其父容器作为商品卡片

        const pricePattern = /[\$£€¥]\d+([.,]\d{2})?|\d+([.,]\d{2})?\s*[\$£€¥]/;
        const allElements = document.body.getElementsByTagName('*');

        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            // 只检查文本节点，且包含价格符号
            if (el.children.length === 0 && pricePattern.test(el.innerText)) {
                // 找到一个价格标签！
                // 向上找 3-5 层父级，判断是否像一个“商品卡片”
                let card = el.parentElement;
                let foundCard = false;

                // 向上遍历，寻找包含图片和标题的容器
                for (let k = 0; k < 5; k++) {
                    if (!card) break;
                    const hasImg = card.querySelector('img');
                    const hasTitle = card.innerText.length > 20; // 整个卡片文字量应该足够多

                    if (hasImg && hasTitle) {
                        // 这是一个合格的商品卡片
                        const rawText = card.innerText;
                        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                        // 提取标题：通常是除了价格之外最长的一行文字
                        let title = lines.sort((a, b) => b.length - a.length)[0];

                        // 提取价格：从当前价格标签提取
                        let priceVal = parseFloat(el.innerText.replace(/[^0-9.]/g, ''));

                        // 提取 ASIN (尝试从链接)
                        let asin = null;
                        const link = card.querySelector('a[href*="/dp/"]');
                        if (link) {
                            const m = link.href.match(/\/dp\/([A-Z0-9]{10})/);
                            if (m) asin = m[1];
                        }

                        // 去重添加
                        if (title && title.length > 5 && !results.some(r => r.name === title)) {
                            results.push({
                                sku: asin || `DETECTED-${results.length + 1}`,
                                name: title,
                                sales: 0,
                                price: priceVal,
                                source: 'visual-scan',
                                category_hint: detectedCategories,
                                note: '视觉识别抓取'
                            });
                        }
                        foundCard = true;
                        break; // 找到父级卡片后，停止向上
                    }
                    card = card.parentElement;
                }
            }
            if (results.length > 50) break; // 限制抓取数量
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
