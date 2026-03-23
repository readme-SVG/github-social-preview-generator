import { sanitizeFilename } from './utils.js';

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
