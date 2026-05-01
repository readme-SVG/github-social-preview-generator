import { sanitizeFilename } from './utils.js';

/**
 * html2canvas (1.4.1) limitations we work around:
 *  1. background-clip: text + -webkit-text-fill-color: transparent
 *     → renders the gradient as a solid rectangle behind invisible text.
 *     Used by .template-spotlight .main-repo-title.
 *  2. backdrop-filter is silently dropped.
 *  3. filter: blur() on background blobs is not respected → blobs render
 *     as hard ellipses, leaking through translucent bento-box backgrounds
 *     and producing grey rectangles with broken corners.
 *  4. mix-blend-mode: overlay (grain layer) is dropped → grain renders
 *     as opaque noise on top.
 *
 * Strategy: temporarily hide blur/blend layers and make translucent
 * card surfaces opaque so the rasterizer has clean inputs.
 */
function applyExportSafeStyles(captureElement) {
    const restorers = [];

    const isLightTheme = captureElement.classList.contains('card-theme-light');
    const isSpotlight = captureElement.classList.contains('template-spotlight');

    /** Helper: set a style with !important and remember how to restore it. */
    const overrideStyle = (el, prop, value) => {
        const orig = {
            value: el.style.getPropertyValue(prop),
            priority: el.style.getPropertyPriority(prop)
        };
        el.style.setProperty(prop, value, 'important');
        restorers.push(() => {
            el.style.removeProperty(prop);
            if (orig.value) {
                el.style.setProperty(prop, orig.value, orig.priority);
            }
        });
    };

    // 1. Spotlight title — replace gradient-clipped text with a solid colour.
    if (isSpotlight) {
        const title = captureElement.querySelector('.main-repo-title');
        if (title) {
            const fallbackColor = isLightTheme ? '#1f2328' : '#ffffff';
            overrideStyle(title, 'background', 'none');
            overrideStyle(title, 'background-clip', 'border-box');
            overrideStyle(title, '-webkit-background-clip', 'border-box');
            overrideStyle(title, '-webkit-text-fill-color', fallbackColor);
            overrideStyle(title, 'color', fallbackColor);
        }
    }

    // 2. Disable backdrop-filter (html2canvas drops it anyway).
    captureElement.querySelectorAll('.bento-box, .card-footer').forEach((el) => {
        overrideStyle(el, 'backdrop-filter', 'none');
        overrideStyle(el, '-webkit-backdrop-filter', 'none');
    });

    // 3. Hide background blobs and grain layer entirely during export.
    //    They depend on filter: blur() and mix-blend-mode: overlay which
    //    html2canvas does not implement; leaving them in produces hard
    //    ellipses and an opaque grain layer that bleed through translucent
    //    surfaces above (Grid bento boxes most notably).
    captureElement
        .querySelectorAll('.card-bg-blob1, .card-bg-blob2, .card-bg-blob3, .card-bg-grain')
        .forEach((el) => {
            overrideStyle(el, 'display', 'none');
        });

    // 4. Make translucent surfaces opaque. With blobs hidden the canvas
    //    background is a flat colour, so we can pick a solid tone that
    //    matches the original frosted-glass look without transparency
    //    artefacts.
    //
    //    Dark theme: bento-box was rgba(255,255,255,0.03) on #0d1117
    //                → ≈ #11161e
    //    Light theme: bento-box was rgba(31,35,40,0.04) on #ffffff
    //                → ≈ #f5f5f6
    const bentoBg = isLightTheme ? '#f5f5f6' : '#11161e';
    const bentoBorder = isLightTheme ? '#e1e4e8' : '#1d242e';

    captureElement.querySelectorAll('.bento-box').forEach((el) => {
        // Skip templates that intentionally have transparent boxes
        // (timeline, minimal, terminal). Detect by computed background
        // — those rules set background: transparent.
        const computedBg = getComputedStyle(el).backgroundColor;
        const isTransparent = computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent';
        if (isTransparent) return;

        overrideStyle(el, 'background', bentoBg);
        overrideStyle(el, 'background-color', bentoBg);
        overrideStyle(el, 'border-color', bentoBorder);
    });

    // 5. Footer also has a translucent background — make it opaque too.
    const footer = captureElement.querySelector('.card-footer');
    if (footer) {
        const footerBg = isLightTheme ? '#f6f8fa' : '#161b22';
        const footerBorder = isLightTheme ? '#d0d7de' : '#21262d';
        overrideStyle(footer, 'background', footerBg);
        overrideStyle(footer, 'background-color', footerBg);
        overrideStyle(footer, 'border-top-color', footerBorder);
    }

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
