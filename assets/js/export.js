import { FORMATS } from './constants.js';
import { renderCard } from './renderer.js';
import { sanitizeFilename } from './utils.js';

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function createExport(repo, design, type = 'png', scale = 1) {
    const svg = renderCard(repo, design, { embedFont: true });
    if (type === 'svg') return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const format = FORMATS[design.format];
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve; img.onerror = () => reject(new Error('Could not render the image. Try downloading SVG.'));
            img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = format.width * scale; canvas.height = format.height * scale;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image export is not available in this browser. Download SVG instead.');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the image.')), type === 'jpeg' ? 'image/jpeg' : 'image/png', .94));
    } finally { URL.revokeObjectURL(url); }
}

export async function downloadPreview(repo, design, type, scale) {
    const blob = await createExport(repo, design, type, scale);
    const ext = type === 'jpeg' ? 'jpg' : type;
    downloadBlob(blob, `${sanitizeFilename(repo.fullName)}-${design.template}-${FORMATS[design.format].width * (type === 'svg' ? 1 : scale)}.${ext}`);
    return blob;
}
