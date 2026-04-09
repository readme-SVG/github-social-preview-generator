import { sanitizeFilename } from './utils.js';

export async function downloadGif({ button, captureElement, repoDisplayElement }) {
    const originalMarkup = button.innerHTML;
    button.disabled = true;

    const FRAME_COUNT = 40;
    const ANIMATION_DURATION = 4000; // ms, must match CSS animation duration

    // Pause all animations so we can scrub them deterministically
    const animations = captureElement.getAnimations({ subtree: true });
    animations.forEach(anim => anim.pause());

    try {
        const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
        const workerBlob = await response.blob();
        const workerUrl = URL.createObjectURL(workerBlob);

        const gif = new window.GIF({
            width: 1280,
            height: 640,
            quality: 10,
            workers: 2,
            workerScript: workerUrl
        });

        for (let i = 0; i < FRAME_COUNT; i++) {
            button.textContent = `Frame ${i + 1}/${FRAME_COUNT}…`;

            // Scrub every animation to the exact timestamp for this frame
            const frameTime = (i / FRAME_COUNT) * ANIMATION_DURATION;
            animations.forEach(anim => { anim.currentTime = frameTime; });

            const canvas = await window.html2canvas(captureElement, {
                scale: 1,
                backgroundColor: '#0d1117'
            });
            gif.addFrame(canvas, { delay: 100 });
        }

        // Restore live preview before rendering
        animations.forEach(anim => anim.play());

        button.textContent = 'Assembling GIF…';
        gif.render();

        gif.on('finished', (blob) => {
            URL.revokeObjectURL(workerUrl);

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeName = sanitizeFilename(repoDisplayElement.textContent);
            link.download = `${safeName}-social-preview.gif`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            button.innerHTML = originalMarkup;
            button.disabled = false;
        });
    } catch (error) {
        // Restore live preview even on failure
        animations.forEach(anim => anim.play());
        console.error(error);
        button.textContent = 'Error';
        setTimeout(() => {
            button.innerHTML = originalMarkup;
            button.disabled = false;
        }, 2000);
    }
}

export async function downloadPreview({ type, button, captureElement, repoDisplayElement }) {
    const originalMarkup = button.innerHTML;
    button.textContent = 'Wait…';
    button.disabled = true;

    try {
        const canvas = await window.html2canvas(captureElement, {
            scale: 1,
            backgroundColor: '#0d1117',
            width: 1280,
            height: 640
        });
        const link = document.createElement('a');
        const safeName = sanitizeFilename(repoDisplayElement.textContent);
        const extension = type === 'jpeg' ? 'jpg' : 'png';
        const mimeType = type === 'jpeg' ? 'image/jpeg' : 'image/png';

        link.download = `${safeName}-social-preview.${extension}`;
        link.href = canvas.toDataURL(mimeType, 0.95);
        link.click();
    } catch {
        button.textContent = 'Error';
        setTimeout(() => {
            button.innerHTML = originalMarkup;
            button.disabled = false;
        }, 2000);
        return;
    }

    button.innerHTML = originalMarkup;
    button.disabled = false;
}
