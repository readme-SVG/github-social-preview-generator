import { GITHUB_PATH } from './renderer.js';
const paths = {
    'arrow-right': '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    'arrow-down': '<path d="m7 10 5 5 5-5"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3 2.5c-.5.2-.5 1.5-.5 1.5M12 16h.01"/>',
    moon: '<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
    frame: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14m8-14v14"/>',
    undo: '<path d="M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12"/>',
    redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    shuffle: '<path d="M3 6h3l12 12h3m-4-4 4 4-4 4M3 18h3l12-12h3m-4-4 4 4-4 4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    link: '<path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m1 3 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 1)"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
    folder: '<path d="M3 7V5h7l2 3h9v11H3V7Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
    unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 7.5-2M12 14v3"/>',
    mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4m-2 14h.01"/>',
    desktop: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 22h8m-4-5v5"/>',
};
export function icon(name) {
    return name === 'github' ? `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="${GITHUB_PATH}"/></svg>` : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
export function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); }); }
let toastTimer;
export function toast(message, error = false) {
    const el = document.getElementById('toast');
    el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, error ? 6500 : 3500);
}
