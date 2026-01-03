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

    // 方案4: 亚马逊前台页面 (店铺首页、搜索结果页、品牌旗舰店)
    if (results.length === 0) {
        console.log('🛍️ 尝试抓取前台/店铺页面数据...');

        // 1. 尝试抓取店铺导航栏/分类 (Brand Store Categories)
        const categories = new Set();
        // 常见导航选择器
        const navSelectors = [
            'nav a',
            'div[role="navigation"] a',
            '.listings-menu a',
            '.marathon-text-content' // 品牌旗舰店常见文字容器
        ];

        navSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(link => {
                const text = link.innerText.trim();
                // 过滤掉无关的短词和通用词
                if (text && text.length > 2 && text.length < 30 && !['Home', 'Contact', 'Cart', 'Menu', 'Sign in'].includes(text)) {
                    categories.add(text);
                }
            });
        });

        const detectedCategories = [...categories].slice(0, 5).join(', '); // 取前5个作为参考
        console.log('📂 检测到可能的分类:', detectedCategories);

        // 2. 尝试抓取商品列表 (Search Results / Storefront Grid)
        const productSelectors = [
            '.s-result-item[data-asin]',       // 搜索结果标准卡片
            'li.product-grid-item',            // 部分店铺网格
            '.bxc-grid__column',                // 品牌页面网格
            'div[data-component-type="s-search-result"]' // 另一种搜索结果
        ];

        let foundCards = [];
        productSelectors.forEach(sel => {
            if (foundCards.length === 0) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) foundCards = els;
            }
        });

        if (foundCards.length > 0) {
            console.log(`🧩 找到 ${foundCards.length} 个商品卡片`);

            foundCards.forEach(card => {
                // 尝试获取 ASIN
                let asin = card.getAttribute('data-asin');

                // 尝试获取标题
                const titleEl = card.querySelector('h2, .a-size-base-plus, .a-text-normal, [class*="title"], h3');
                let title = titleEl ? titleEl.innerText.trim() : '';

                // 尝试获取价格
                const priceEl = card.querySelector('.a-price .a-offscreen, .a-price-whole');
                const price = priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) : 0;

                // 如果没有直接 ASIN，尝试从链接提取
                if (!asin) {
                    const link = card.querySelector('a');
                    if (link && link.href) {
                        const match = link.href.match(/\/dp\/([A-Z0-9]{10})/);
                        if (match) asin = match[1];
                    }
                }

                if (title && title.length > 3) {
                    // 优化：如果标题太短，可能抓错了，尝试把检测到的分类加进去辅助识别
                    const finalName = (detectedCategories && title.length < 10) ? `${detectedCategories} - ${title}` : title;

                    results.push({
                        sku: asin || 'Unknown-SKU',
                        name: finalName,
                        sales: 0, // 前台看不到具体销售额，置0让用户手动填或按比例
                        price: price,
                        source: 'storefront-scan',
                        category_hint: detectedCategories, // 额外字段供参考
                        note: '前台抓取数据'
                    });
                }
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
