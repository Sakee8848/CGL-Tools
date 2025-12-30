// Background Service Worker
// 处理插件的后台逻辑和消息转发

chrome.runtime.onInstalled.addListener(() => {
    console.log('CGL 智能助手已安装');
});

// 监听来自 popup 的消息，转发给 content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentTabData') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'extractData' }, (response) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({
                            success: false,
                            error: '请在亚马逊卖家中心页面使用此功能'
                        });
                    } else {
                        sendResponse(response);
                    }
                });
            }
        });
        return true; // 保持消息通道开启
    }
});
