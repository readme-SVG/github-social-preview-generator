import { sanitizeFilename } from './utils.js';

/**
 * html2canvas (1.4.1) limitations we work around:
 *  1. background-clip: text + -webkit-text-fill-color: transparent
 *     → renders the gradient as a solid rectangle behind invisible text.
 *     Used by .template-spotlight .main-repo-title.
 *  2. backdrop-filter is silently dropped → can leave footer/bento boxes
 *     looking inconsistent vs. the live preview.
 *
 * We patch inline styles with `!important` priority before capture and
 * restore them afterwards. Using priority is required because the light
 * theme's spotlight rule already uses !important in CSS.
 */
function applyExportSafeStyles(captureElement) {
    const restorers = [];

    const isLightTheme = captureElement.classList.contains('card-theme-light');
    const isSpotlight = captureElement.classList.contains('template-spotlight');

    // 1. Spotlight title — replace gradient-clipped text with a solid colour.
    if (isSpotlight) {
        const title = captureElement.querySelector('.main-repo-title');
        if (title) {
            // Save original inline state so we can restore byte-for-byte.
            const original = {
                background: title.style.getPropertyValue('background'),
                backgroundPriority: title.style.getPropertyPriority('background'),
                backgroundClip: title.style.getPropertyValue('background-clip'),
                backgroundClipPriority: title.style.getPropertyPriority('background-clip'),
                webkitBackgroundClip: title.style.getPropertyValue('-webkit-background-clip'),
                webkitBackgroundClipPriority: title.style.getPropertyPriority('-webkit-background-clip'),
                webkitTextFillColor: title.style.getPropertyValue('-webkit-text-fill-color'),
                webkitTextFillColorPriority: title.style.getPropertyPriority('-webkit-text-fill-color'),
                color: title.style.getPropertyValue('color'),
                colorPriority: title.style.getPropertyPriority('color')
            };

            // Solid fallback colour. Light theme = dark text, dark theme = white.
            // (Picking pure white/dark gives the best contrast since the gradient
            //  was always intended as decorative.)
            const fallbackColor = isLightTheme ? '#1f2328' : '#ffffff';

            // Use !important to defeat the light-theme CSS rule that itself uses !important.
            title.style.setProperty('background', 'none', 'important');
            title.style.setProperty('background-clip', 'border-box', 'important');
            title.style.setProperty('-webkit-background-clip', 'border-box', 'important');
            title.style.setProperty('-webkit-text-fill-color', fallbackColor, 'important');
            title.style.setProperty('color', fallbackColor, 'important');

            restorers.push(() => {
                // Clear our overrides first
                title.style.removeProperty('background');
                title.style.removeProperty('background-clip');
                title.style.removeProperty('-webkit-background-clip');
                title.style.removeProperty('-webkit-text-fill-color');
                title.style.removeProperty('color');

                // Restore originals (only if there was something inline before)
                if (original.background) {
                    title.style.setProperty('background', original.background, original.backgroundPriority);
                }
                if (original.backgroundClip) {
                    title.style.setProperty('background-clip', original.backgroundClip, original.backgroundClipPriority);
                }
                if (original.webkitBackgroundClip) {
                    title.style.setProperty('-webkit-background-clip', original.webkitBackgroundClip, original.webkitBackgroundClipPriority);
                }
                if (original.webkitTextFillColor) {
                    title.style.setProperty('-webkit-text-fill-color', original.webkitTextFillColor, original.webkitTextFillColorPriority);
                }
                if (original.color) {
                    title.style.setProperty('color', original.color, original.colorPriority);
                }
            });
        }
    }

    // 2. Disable backdrop-filter on bento boxes / footer.
    captureElement.querySelectorAll('.bento-box, .card-footer').forEach((el) => {
        const orig = {
            backdropFilter: el.style.getPropertyValue('backdrop-filter'),
            backdropFilterPriority: el.style.getPropertyPriority('backdrop-filter'),
            webkitBackdropFilter: el.style.getPropertyValue('-webkit-backdrop-filter'),
            webkitBackdropFilterPriority: el.style.getPropertyPriority('-webkit-backdrop-filter')
        };
        el.style.setProperty('backdrop-filter', 'none', 'important');
        el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        restorers.push(() => {
            el.style.removeProperty('backdrop-filter');
            el.style.removeProperty('-webkit-backdrop-filter');
            if (orig.backdropFilter) {
                el.style.setProperty('backdrop-filter', orig.backdropFilter, orig.backdropFilterPriority);
            }
            if (orig.webkitBackdropFilter) {
                el.style.setProperty('-webkit-backdrop-filter', orig.webkitBackdropFilter, orig.webkitBackdropFilterPriority);
            }
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
