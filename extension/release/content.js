// Content Script - 注入到亚马逊页面中
// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract') {
        console.log('🔍 CGL: 开始提取数据...');

        // 由于 extractAmazonData 现在是 async 的，我们需要这样处理
        extractAmazonData().then(data => {
            console.log('✅ CGL: 提取完成', data);
            sendResponse({ success: true, data: data }); // Ensure success: true is included
        }).catch(err => {
            console.error('❌ CGL: 提取出错', err);
            sendResponse({ success: false, error: err.message }); // Ensure success: false for errors
        });

        return true; // 必须返回 true 以保持消息通道开启，等待异步响应
    }
    // If the action is not 'extract', we don't need to keep the message channel open
    // as no async response will be sent.
    return false;
});

// 提取亚马逊页面数据的核心函数
// Helper to trigger lazy loading
async function autoScrollPage() {
    console.log('🔄 开始自动滚动以加载更多内容...');
    return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 800;
        const maxScrolls = 15; // Limit scroll number
        let scrolls = 0;

        const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            scrolls++;

            // Intelligent stop: if height doesn't change much or max scrolls reached
            if (scrolls >= maxScrolls || (document.body.scrollHeight - window.scrollY) < 1000) {
                clearInterval(timer);
                window.scrollTo(0, 0); // Back to top
                setTimeout(resolve, 800); // Wait for React to render
            }
        }, 200); // Faster scroll
    });
}

async function extractAmazonData() {
    // 自动滚动加载
    await autoScrollPage();

    const results = [];
    const url = window.location.href;

    console.log('🌐 当前页面:', url);

    // 检测页面类型
    const isSeller = url.includes('sellercentral') || url.includes('seller-central');
    const isBusinessReport = url.includes('business-report') || url.includes('sales-report');

    console.log('📍 页面类型:', { isSeller, isBusinessReport });

    // 方案1: 尝试从表格中提取（适用于 Business Reports 页面）
    if (isSeller || isBusinessReport) {
        const tables = document.querySelectorAll('table');
        tables.forEach((table, tableIndex) => {
            const rows = table.querySelectorAll('tr');
            rows.forEach((row, rowIndex) => {
                if (rowIndex === 0) return;
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 2) {
                    const cellTexts = Array.from(cells).map(c => c.innerText?.trim());
                    cellTexts.forEach((text, i) => {
                        if (/^[A-Z0-9]{8,}$/.test(text)) { // SKU 格式
                            const nextCell = cellTexts[i + 1];
                            const sales = nextCell ? parseFloat(nextCell.replace(/[^0-9.]/g, '')) : 0;
                            results.push({
                                sku: text,
                                sales: sales,
                                source: `seller - report - table`
                            });
                        }
                    });
                }
            });
        });
    }

    // 方案2: 亚马逊搜索结果页 (Search Results) & 畅销榜 (Best Sellers) - 专用提取器
    // 这是最结构化的数据源，优先处理
    const searchItems = document.querySelectorAll('div[data-component-type="s-search-result"], div[data-asin], div[id^="p13n-asin-index"]');
    if (searchItems.length > 0) {
        console.log(`🔍 检测到搜索结果/榜单列表，共 ${searchItems.length} 个商品`);
        searchItems.forEach(item => {
            const asin = item.getAttribute('data-asin') || item.getAttribute('data-csa-c-item-id')?.split(':').pop();

            // 尝试提取排名 (Best Seller Rank) - 仅在榜单页有效，或搜索页有特殊标记时
            let rank = 0;
            const rankEl = item.querySelector('.zg-bdg-text') || item.querySelector('.zg-rank-number'); // 榜单页排名
            if (rankEl) {
                rank = parseInt(rankEl.innerText.replace(/[^0-9]/g, '')) || 0;
            }

            if (asin && asin.length > 5) {
                // 提取标题
                const titleEl = item.querySelector('h2 a span') || item.querySelector('h2') || item.querySelector('.a-text-normal') || item.querySelector('div[class*="_p13n-zg-list-grid-desktop_truncate"]');
                const title = titleEl ? titleEl.innerText.trim() : '未知商品';

                // 提取价格
                const priceEl = item.querySelector('.a-price .a-offscreen') || item.querySelector('span[class*="_p13n-zg-list-grid-desktop_price"]');
                const price = priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) : 0;

                results.push({
                    sku: asin,
                    name: title,
                    sales: 0,
                    price: price,
                    rank: rank, // 新增 Rank 字段
                    source: rank > 0 ? 'best-seller-list' : 'search-result',
                    note: rank > 0 ? `榜单排名 #${rank}` : '搜索结果页提取'
                });
            }
        });
    }

    // 方案3: 品牌旗舰店 (Storefront) - 深度链接扫描器
    // Storefront 通常是 React 渲染，没有 data-asin 属性，需扫描链接
    if (url.includes('/stores/') || document.querySelector('.listings-layout-grid')) {
        console.log('🛍️ 检测到品牌旗舰店 (Storefront) ...');
        // 查找所有指向产品的链接
        const productLinks = document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]');

        productLinks.forEach(link => {
            // 提取 ASIN
            const match = link.href.match(/\/dp\/([A-Z0-9]{10})/);
            if (!match) return;
            const asin = match[1];

            // 寻找父级容器以获取上下文信息 (Img, Title, Price)
            // 向上遍历3层通常能找到卡片容器
            let card = link.parentElement;
            let title = '';
            let imgAlt = '';
            let price = 0;

            for (let k = 0; k < 4; k++) {
                if (!card) break;

                // 尝试找图片作为备用标题
                if (!imgAlt) {
                    const img = card.querySelector('img');
                    if (img && img.alt && img.alt.length > 3) imgAlt = img.alt;
                }

                // 尝试找标题
                if (!title) {
                    const t = card.innerText.trim();
                    if (t.length > 3 && t.length < 200) title = t.split('\n')[0];
                }

                // 尝试找价格
                if (price === 0) {
                    const pMatch = card.innerText.match(/[\$£€¥]\d+(\.\d{2})?/);
                    if (pMatch) price = parseFloat(pMatch[0].replace(/[^0-9.]/g, ''));
                }

                card = card.parentElement;
            }

            // 避免重复和无效项
            if (!results.some(r => r.sku === asin)) {
                results.push({
                    sku: asin,
                    name: title || imgAlt || 'Storefront Item',
                    sales: 0,
                    price: price,
                    source: 'storefront-scan',
                    note: '品牌店链接扫描'
                });
            }
        });
    }

    // 方案4: 产品详情页 (Product Detail Page) - 单品抓取
    // 始终尝试提取当前主商品 (Main Product)，不应受 listing 提取影响
    if (document.getElementById('dp-container')) {
        console.log('📦 检测到产品详情页 (Detail Page) - 提取主商品...');
        const asin = document.getElementById('ASIN')?.value || window.location.href.match(/\/dp\/([A-Z0-9]{10})/)?.[1];

        if (asin && !results.some(r => r.sku === asin)) {
            const title = document.getElementById('productTitle')?.innerText.trim() || document.title;
            const priceEl = document.querySelector('.a-price .a-offscreen') || document.querySelector('#priceblock_ourprice') || document.querySelector('#priceblock_dealprice');
            const price = priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) : 0;

            // 尝试提取 BSR 排名
            let rank = 0;
            const allText = document.body.innerText;
            // 增强正则：支持换行、支持中文冒号
            const bsrMatch = allText.match(/(?:Best Sellers Rank|排名|Rank|BSR)[\s\S]{0,30}?[#№]\s?([0-9,]+)/i);
            if (bsrMatch) {
                rank = parseInt(bsrMatch[1].replace(/,/g, ''));
            }

            results.unshift({ // 使用 unshift 将主商品排在第一位
                sku: asin,
                name: title,
                sales: 0,
                price: price,
                rank: rank,
                source: 'detail-page-main',
                note: rank > 0 ? `详情页主商品 #${rank}` : '详情页主商品'
            });
        }
    }

    // 方案5: 通用视觉识别 (兜底)
    // 如果上述特定提取器都没抓到，使用通用算法
    if (results.length === 0) {
        console.log('⚠️ 未匹配特定页面模式，启用通用视觉扫描...');
        const pricePattern = /[\$£€¥]\d+([.,]\d{2})?|\d+([.,]\d{2})?\s*[\$£€¥]/;
        const allElements = document.body.getElementsByTagName('*');

        // ... (保留原有的视觉识别逻辑作为最后防线) ...
        // 省略部分重复代码，直接复用原逻辑思路但简化
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            if (el.children.length === 0 && pricePattern.test(el.innerText)) {
                let card = el.parentElement;
                for (let k = 0; k < 5; k++) {
                    if (!card) break;
                    const hasImg = card.querySelector('img');
                    if (hasImg && card.innerText.length > 20) {
                        const link = card.querySelector('a[href*="/dp/"]');
                        if (link) {
                            const m = link.href.match(/\/dp\/([A-Z0-9]{10})/);
                            if (m && !results.some(r => r.sku === m[1])) {
                                results.push({
                                    sku: m[1],
                                    name: card.innerText.split('\n')[0].substring(0, 50),
                                    sales: 0,
                                    price: parseFloat(el.innerText.replace(/[^0-9.]/g, '')),
                                    rank: 0, // 视觉兜底很难抓到准确Rank
                                    source: 'visual-fallback'
                                });
                            }
                        }
                        break;
                    }
                    card = card.parentElement;
                }
            }
            if (results.length > 60) break;
        }
    }

    console.log(`✅ 最终提取到 ${results.length} 条数据`);

    // 去重与清洗 (Deduplication & Cleaning)
    const uniqueResults = [];
    const seen = new Set();
    // 移除 'storefront item' 以防止误删无标题商品
    const invalidTitles = /^(quick look|shop now|see options|add to cart|currently unavailable|business card|amazon business card)$/i;

    results.forEach(r => {
        // 清洗标题
        r.name = r.name ? r.name.trim() : '';

        // 过滤无效数据
        if (!r.name || r.name.length < 3 || invalidTitles.test(r.name)) {
            console.log('🗑️ 丢弃无效数据:', r.name, r.sku);
            return;
        }

        if (!seen.has(r.sku)) {
            seen.add(r.sku);
            uniqueResults.push(r);
        } else {
            console.log('👯‍♂️ 过滤重复 SKU:', r.sku);
        }
    });

    return {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        pageType: isSeller ? 'seller-central' : 'customer-facing',
        itemCount: uniqueResults.length,
        items: uniqueResults
    };
}

// 页面加载完成后，在控制台显示提示
console.log('🛡️ CGL 智能助手已激活');
console.log('💡 提示: 请在亚马逊卖家中心 (Seller Central) 的业务报告页面使用数据提取功能');
console.log('📍 当前页面:', window.location.href);
