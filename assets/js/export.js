import { sanitizeFilename } from './utils.js';

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
