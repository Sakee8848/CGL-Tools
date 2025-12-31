const iframe = document.getElementById('appFrame');

// Listen for messages from the sandboxed app
window.addEventListener('message', function (event) {
    // Validate origin if needed, but app.html is local (null origin in sandbox)

    if (event.data && event.data.action === 'clearStorage') {
        chrome.storage.local.remove(event.data.key);
    }
    else if (event.data && event.data.action === 'saveState') {
        // Persist state from sandbox to chrome.storage
        chrome.storage.local.set(event.data.payload);
    }
    else if (event.data && event.data.action === 'appReady') {
        console.log("App inside sandbox is ready. Sending data...");
        sendDataToApp();
    }
});

function sendDataToApp() {
    // Read both pending uploads and persisted state
    const keys = ['pendingUpload', 'extractedData', 'cgl_db_v2', 'cgl_audit_logs', 'cgl_ex_rate', 'cgl_coi_rules'];

    chrome.storage.local.get(keys, (result) => {
        // 1. Send Hydration Data
        const hydrationPayload = {
            cgl_db_v2: result.cgl_db_v2,
            cgl_audit_logs: result.cgl_audit_logs,
            cgl_ex_rate: result.cgl_ex_rate,
            cgl_coi_rules: result.cgl_coi_rules
        };
        // Only send if there is data to hydrate
        if (Object.values(hydrationPayload).some(v => v !== undefined)) {
            iframe.contentWindow.postMessage({
                type: 'hydrateState',
                payload: hydrationPayload
            }, '*');
            console.log("Sent hydration state to sandbox");
        }

        // 2. Send Pending Uploads with a small delay to ensure React is ready
        setTimeout(() => {
            if (result.pendingUpload) {
                const msg = {
                    type: 'pendingUpload',
                    payload: result.pendingUpload
                };
                iframe.contentWindow.postMessage(msg, '*');
                console.log("Sent pendingUpload to sandbox:", result.pendingUpload.name);
            }
            if (result.extractedData) {
                const msg = {
                    type: 'extractedData',
                    payload: result.extractedData
                };
                iframe.contentWindow.postMessage(msg, '*');
                console.log("Sent extractedData to sandbox");
            }
        }, 500);
    });
}
