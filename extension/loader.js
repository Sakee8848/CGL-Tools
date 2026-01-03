// loader.js - Handle iframe loading with cache busting
document.addEventListener('DOMContentLoaded', function () {
    const iframe = document.getElementById('appFrame');
    if (iframe) {
        // Add timestamp to force reload and avoid cache
        iframe.src = 'app.html?v=' + new Date().getTime();
    }
});
