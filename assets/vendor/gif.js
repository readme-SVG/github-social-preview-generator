(function () {
    if (window.GIF) {
        return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
    script.async = false;
    script.onerror = function () {
        console.error('Unable to load gif.js from CDN fallback.');
    };
    document.head.appendChild(script);
})();
