export function fmt(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
    return String(n);
}
export function fmtSize(kb) {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb || 0} KB`;
}
export function parseInput(raw) {
    let value = String(raw || '').trim();
    if (!value) return null;
    if (/^(?:https?:\/\/|github\.com\/)/i.test(value)) {
        try {
            const url = new URL(/^https?:/i.test(value) ? value : `https://${value}`);
            if (url.hostname.toLowerCase() !== 'github.com' || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts.length < 2) return null;
            value = parts.slice(0, 2).join('/');
        } catch { return null; }
    }
    const parts = value.replace(/\.git$/i, '').replace(/\/$/, '').split('/');
    if (parts.length !== 2) return null;
    const [owner, repo] = parts;
    if (!/^[a-z\d][a-z\d-]{0,38}$/i.test(owner) || !/^[\w.-]{1,100}$/.test(repo) || ['.', '..'].includes(repo)) return null;
    return { owner, repo };
}
export function escapeXml(value) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
}
export function sanitizeFilename(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 160) || 'repository';
}
export function validHex(value) { return /^#[a-f\d]{6}$/i.test(value); }
export function luminance(hex) {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
export function contrastColor(hex) { return luminance(hex) > .3 ? '#1d2c42' : '#f4f7fd'; }
export function randomShowcaseStats() {
    return { showcaseStars: Math.floor(Math.random() * 1001) + 1000, showcaseForks: Math.floor(Math.random() * 401) + 300 };
}
export function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
export function mixColor(hex, target, amount) {
    const channels = (value) => [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
    const a = channels(hex), b = channels(target);
    return '#' + a.map((n, i) => Math.round(n + (b[i] - n) * amount).toString(16).padStart(2, '0')).join('');
}
