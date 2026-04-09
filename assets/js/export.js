import { sanitizeFilename } from './utils.js';

export async function downloadGif({ button, captureElement, repoDisplayElement }) {
    const originalMarkup = button.innerHTML;
    button.disabled = true;

    const FRAME_COUNT = 15;
    const gif = new window.GIF({
        width: 1280,
        height: 640,
        quality: 10,
        workers: 2,
        workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
    });

    try {
        for (let i = 0; i < FRAME_COUNT; i++) {
            button.textContent = `Frame ${i + 1}/${FRAME_COUNT}…`;
            const canvas = await window.html2canvas(captureElement, {
                scale: 1,
                backgroundColor: '#0d1117'
            });
            gif.addFrame(canvas, { delay: 100 });
            await new Promise((r) => setTimeout(r, 100));
        }

        button.textContent = 'Assembling GIF…';
        gif.render();

        gif.on('finished', (blob) => {
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
    } catch {
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
