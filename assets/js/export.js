import { sanitizeFilename } from './utils.js';

const GIF_WIDTH = 480;
const GIF_HEIGHT = 240;
const GIF_MAX_BYTES = 1_000_000;
const GIF_FRAME_COUNT = 20;
const GIF_FRAME_DELAY = 100;
const GIF_QUALITY = 20;
const FULL_WIDTH = 1280;
const FULL_HEIGHT = 640;
const GIF_CAPTURE_SCALE = GIF_WIDTH / FULL_WIDTH;

export async function downloadGif({
    button,
    captureElement,
    repoDisplayElement,
    animationDuration,
    setBlobsAtTime,
    pauseBlobAnimation,
    resumeBlobAnimation
}) {
    const originalMarkup = button.innerHTML;
    button.disabled = true;

    try {
        pauseBlobAnimation();

        const gif = new window.GIF({
            width: GIF_WIDTH,
            height: GIF_HEIGHT,
            quality: GIF_QUALITY,
            workers: 2,
            workerScript: './assets/vendor/gif.worker.js',
            repeat: 0
        });

        for (let i = 0; i < GIF_FRAME_COUNT; i++) {
            button.textContent = `Frame ${i + 1}/${GIF_FRAME_COUNT}…`;
            const frameTime = (i / GIF_FRAME_COUNT) * animationDuration;
            setBlobsAtTime(frameTime);

            const canvas = await window.html2canvas(captureElement, {
                scale: GIF_CAPTURE_SCALE,
                backgroundColor: '#0d1117',
                width: FULL_WIDTH,
                height: FULL_HEIGHT
            });

            gif.addFrame(canvas, { delay: GIF_FRAME_DELAY });
        }

        button.textContent = 'Assembling GIF…';

        const blob = await new Promise((resolve, reject) => {
            gif.on('finished', resolve);
            gif.on('abort', () => reject(new Error('GIF rendering was aborted')));
            gif.on('error', reject);
            gif.render();
        });

        if (blob.size >= GIF_MAX_BYTES) {
            console.warn(`Generated GIF is ${blob.size} bytes, which exceeds ${GIF_MAX_BYTES} bytes.`);
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = sanitizeFilename(repoDisplayElement.textContent);
        link.download = `${safeName}-social-preview.gif`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);
        button.textContent = 'Error';
        await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
        resumeBlobAnimation();
        button.innerHTML = originalMarkup;
        button.disabled = false;
    }
}

export async function downloadPreview({ button, captureElement, repoDisplayElement }) {
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

        link.download = `${safeName}-social-preview.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
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
