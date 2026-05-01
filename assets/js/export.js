import { sanitizeFilename } from './utils.js';

/**
 * html2canvas has known issues with:
 *  - background-clip: text + -webkit-text-fill-color: transparent (Spotlight)
 *  - heavy backdrop-filter / blur stacks
 * 
 * We temporarily replace these styles with rasterization-safe equivalents,
 * capture the canvas, then restore everything.
 */
function applyExportSafeStyles(captureElement) {
    const restorers = [];

    // 1. Spotlight title: replace gradient-clipped text with a solid color
    //    that visually matches the gradient's mid-tone.
    const spotlightTitle = captureElement.querySelector(
        '.template-spotlight .main-repo-title'
    );
    if (spotlightTitle) {
        const computed = getComputedStyle(spotlightTitle);
        const original = {
            background: spotlightTitle.style.background,
            webkitBackgroundClip: spotlightTitle.style.webkitBackgroundClip,
            backgroundClip: spotlightTitle.style.backgroundClip,
            webkitTextFillColor: spotlightTitle.style.webkitTextFillColor,
            color: spotlightTitle.style.color
        };

        // Pick a fallback color: theme color (var --tc) for visibility.
        // On light theme, prefer the theme color directly; on dark, use white-ish.
        const isLightTheme = captureElement.classList.contains('card-theme-light');
        const themeColor = computed.getPropertyValue('--tc').trim()
            || getComputedStyle(document.documentElement).getPropertyValue('--tc').trim()
            || '#58a6ff';

        spotlightTitle.style.background = 'none';
        spotlightTitle.style.webkitBackgroundClip = 'border-box';
        spotlightTitle.style.backgroundClip = 'border-box';
        spotlightTitle.style.webkitTextFillColor = isLightTheme ? '#1f2328' : '#ffffff';
        spotlightTitle.style.color = isLightTheme ? '#1f2328' : '#ffffff';

        // Optional: keep accent on part of the title would be complex; solid color
        // is the cleanest fallback. If you want a two-tone effect, split into spans.

        restorers.push(() => {
            spotlightTitle.style.background = original.background;
            spotlightTitle.style.webkitBackgroundClip = original.webkitBackgroundClip;
            spotlightTitle.style.backgroundClip = original.backgroundClip;
            spotlightTitle.style.webkitTextFillColor = original.webkitTextFillColor;
            spotlightTitle.style.color = original.color;
        });

        // Same for light + spotlight override
        const lightSpotlight = captureElement.querySelector(
            '.card-theme-light.template-spotlight .main-repo-title'
        );
        if (lightSpotlight && lightSpotlight !== spotlightTitle) {
            // already handled above by single querySelector path
        }
    }

    // 2. Disable backdrop-filter on bento boxes / footer (html2canvas ignores
    //    it and can produce inconsistent rendering)
    const blurredEls = captureElement.querySelectorAll(
        '.bento-box, .card-footer'
    );
    blurredEls.forEach((el) => {
        const orig = {
            backdropFilter: el.style.backdropFilter,
            webkitBackdropFilter: el.style.webkitBackdropFilter
        };
        el.style.backdropFilter = 'none';
        el.style.webkitBackdropFilter = 'none';
        restorers.push(() => {
            el.style.backdropFilter = orig.backdropFilter;
            el.style.webkitBackdropFilter = orig.webkitBackdropFilter;
        });
    });

    return () => restorers.forEach((restore) => restore());
}

export async function downloadPreview({ button, captureElement, repoDisplayElement }) {
    const originalMarkup = button.innerHTML;
    button.textContent = 'Wait…';
    button.disabled = true;

    const restoreStyles = applyExportSafeStyles(captureElement);

    try {
        // Determine background color based on card theme
        const isLight = captureElement.classList.contains('card-theme-light');
        const bgColor = isLight ? '#ffffff' : '#0d1117';

        const canvas = await window.html2canvas(captureElement, {
            scale: 1,
            backgroundColor: bgColor,
            width: 1280,
            height: 640,
            windowWidth: 1280,
            windowHeight: 640,
            logging: false,
            useCORS: true
        });

        const link = document.createElement('a');
        const safeName = sanitizeFilename(repoDisplayElement.textContent);

        link.download = `${safeName}-social-preview.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
    } catch (err) {
        console.error('Export failed:', err);
        button.textContent = 'Error';
        setTimeout(() => {
            button.innerHTML = originalMarkup;
            button.disabled = false;
        }, 2000);
        restoreStyles();
        return;
    }

    restoreStyles();
    button.innerHTML = originalMarkup;
    button.disabled = false;
}
