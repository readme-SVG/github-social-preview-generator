import { BACKGROUNDS, DECORATIONS, DEFAULT_DESIGN, FORMATS, GENERATED_TEMPLATE, LAYOUTS, STORAGE_KEY, TEMPLATES, THEMES, TYPOGRAPHY } from './constants.js';
import { hydrateIcons, icon, toast } from './dom.js';
import { downloadBlob, downloadPreview } from './export.js';
import { fetchRepository, loadExample } from './github.js';
import { compositionProfile, generateDesign, newSeed } from './generator.js';
import { prepareFont, renderCard } from './renderer.js';
import { createDesignLink, readDesignLink, validateDesign, validateProject } from './state.js';
import { escapeXml, formatDate, parseInput, randomShowcaseStats, sanitizeFilename, validHex } from './utils.js';

const $ = (id) => document.getElementById(id);
let state = { version: 1, design: { ...DEFAULT_DESIGN, seed: newSeed(), ...randomShowcaseStats() }, repository: null, source: 'example' };
let undo = [], redo = [], editStart = null;
let variations = [];
let requestController, requestId = 0, galleryTimer, exporting = false;
hydrateIcons();

function repoStatus(message, type = '') {
    $('repo-status').className = `repo-message ${type}`;
    $('repo-status').replaceChildren();
    const dot = document.createElement('span'); dot.className = 'status-dot';
    $('repo-status').append(dot, document.createTextNode(message));
}
function historyButtons() { $('undo-button').disabled = !undo.length; $('redo-button').disabled = !redo.length; }
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $('save-status').textContent = 'Saved on this device'; }
    catch { $('save-status').textContent = 'Use Save project to keep edits'; }
}
function checkpoint(previous = state.design) {
    undo.push(structuredClone(previous)); if (undo.length > 40) undo.shift(); redo = []; historyButtons();
}
function changeDesign(patch) {
    editStart = null;
    const next = validateDesign({ ...state.design, ...patch });
    if (JSON.stringify(next) === JSON.stringify(state.design)) return;
    checkpoint(); state.design = next; syncControls(); render();
}

function syncControls() {
    const d = state.design;
    document.querySelectorAll('[data-design]').forEach((el) => {
        const key = el.dataset.design;
        if (el.type === 'checkbox') el.checked = d[key];
        else el.value = d[key];
    });
    $('title-input').placeholder = state.repository?.name || 'Repository name';
    $('description-input').placeholder = state.repository?.description || 'What makes your project special?';
    $('accent-picker').value = d.accent; $('accent-input').value = d.accent.toUpperCase();
    $('title-size-output').textContent = `${d.titleSize}%`;
    $('palette-name').textContent = d.accent.toLowerCase() === THEMES[d.theme].color ? THEMES[d.theme].name : 'Custom';
    document.querySelectorAll('[data-theme]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === d.theme && d.accent.toLowerCase() === THEMES[d.theme].color)));
    document.querySelectorAll('[data-appearance]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.appearance === d.appearance)));
    document.querySelectorAll('[data-stats-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.statsMode === d.statsMode)));
    $('stats-mode-label').textContent = d.statsMode === 'showcase' ? 'Showcase' : 'Real counts';
    $('reshuffle-stats').hidden = d.statsMode !== 'showcase';
    $('stats-description').textContent = d.statsMode === 'showcase' ? 'Randomized counts for a little extra impact. Saved with your design.' : 'Actual stars and forks from the repository snapshot.';
    const item = TEMPLATES.find((item) => item.id === d.template) || GENERATED_TEMPLATE, index = TEMPLATES.indexOf(item);
    $('template-count').textContent = index < 0 ? 'Generated / ∞' : `${String(index + 1).padStart(2, '0')} / ${TEMPLATES.length}`;
    $('template-indicator').textContent = index < 0 ? '∞' : String(index + 1).padStart(2, '0');
    $('active-template-name').textContent = item.name; $('active-template-description').textContent = item.description;
    const format = FORMATS[d.format];
    $('canvas-size').textContent = `${format.width} × ${format.height}`;
    $('canvas-caption').textContent = format.name;
    const profile = compositionProfile(d);
    document.querySelectorAll('[data-generator]').forEach((el) => { el.value = profile[el.dataset.generator] ?? d[el.dataset.generator]; });
    $('seed-input').value = d.seed; $('corner-output').textContent = d.corner;
    document.querySelectorAll('[data-lock]').forEach((button) => { const locked = d[button.dataset.lock]; button.setAttribute('aria-pressed', String(locked)); button.innerHTML = icon(locked ? 'lock' : 'unlock'); });
    document.querySelectorAll('[data-platform]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.platform === d.platform)));
    $('platform-note').textContent = d.platform === 'desktop' ? '77 px above & below · full card' : 'Full-height card';
    const type = $('file-type').value, scale = type === 'svg' ? 1 : Number($('export-scale').value);
    $('export-scale').disabled = type === 'svg';
    $('download-type').textContent = type === 'jpeg' ? 'JPG' : type.toUpperCase();
    $('export-note').textContent = `${format.width * scale} × ${format.height * scale} ${type === 'svg' ? 'viewBox. Editable vector with embedded font.' : 'px.'} ${d.format === 'github' && scale === 1 && type !== 'svg' ? 'Ready for your GitHub social preview.' : ''}`;
    if (state.repository) $('data-note').textContent = `Data snapshot: ${formatDate(state.repository.fetchedAt)}. GitHub open issues include pull requests. Language percentages are based on code bytes.`;
    document.querySelectorAll('[data-template]').forEach((button) => {
        const selected = button.dataset.template === d.template;
        button.setAttribute('aria-pressed', String(selected));
        const check = button.querySelector('.selected-check'); if (check) check.hidden = !selected;
    });
}

function renderGallery() {
    if (!state.repository) return;
    const d = state.design;
    for (const item of TEMPLATES) {
        const appearance = item.appearance || (item.id === 'editorial' ? 'light' : d.appearance);
        const svg = renderCard(state.repository, { ...d, template: item.id, format: 'github', appearance }, { thumbnail: true });
        document.querySelectorAll(`[data-preview="${item.id}"]`).forEach((el) => { el.innerHTML = svg; });
    }
    renderVariations();
}

function renderVariations() {
    if (!state.repository) return;
    variations = Array.from({ length: 4 }, (_, i) => generateDesign(state.design, (state.design.seed + (i + 1) * 7919) >>> 0 || 1));
    $('generator-variations').innerHTML = variations.map((d, i) => `<button data-variation="${i}" aria-label="Use generated variation ${i + 1}"><div class="mini-card">${renderCard(state.repository, { ...d, format: 'github' }, { thumbnail: true })}</div><span>${d.layout}</span></button>`).join('');
}
function render(immediateGallery = false) {
    if (!state.repository) return;
    const format = FORMATS[state.design.format];
    $('preview-card').style.aspectRatio = `${format.width}/${format.height}`;
    $('preview-card').style.maxWidth = state.design.format === 'square' ? '560px' : '1100px';
    $('preview-card').innerHTML = renderCard(state.repository, state.design);
    clearTimeout(galleryTimer);
    if (immediateGallery) renderGallery(); else galleryTimer = setTimeout(renderGallery, 200);
    save();
}

function buildGallery() {
    $('template-grid').innerHTML = TEMPLATES.map((item) => `<button class="template-option" data-template="${item.id}" aria-label="${item.name} template" aria-pressed="false" title="${escapeXml(item.description)}"><div class="mini-card" data-preview="${item.id}"></div><div class="template-option-label">${item.name}<span class="selected-check" hidden>${icon('check')}</span></div></button>`).join('');
    $('collection-grid').innerHTML = TEMPLATES.map((item) => `<button class="collection-card" data-template="${item.id}" aria-label="${item.name} layout" aria-pressed="false"><div class="collection-preview" data-preview="${item.id}"></div><div class="collection-card-label">${item.name}<span>${item.category}</span></div></button>`).join('');
    $('palette-row').innerHTML = Object.entries(THEMES).map(([key, theme]) => `<button class="swatch" style="--swatch:${theme.color}" data-theme="${key}" aria-label="${theme.name} palette" aria-pressed="false" title="${theme.name}"></button>`).join('');
    document.querySelectorAll('[data-template]').forEach((button) => button.addEventListener('click', () => {
        const item = TEMPLATES.find((item) => item.id === button.dataset.template);
        changeDesign({ template: item.id, ...(item.appearance ? { appearance: item.appearance } : item.id === 'editorial' ? { appearance: 'light' } : {}) });
    }));
    document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => { changeDesign({ theme: button.dataset.theme, accent: THEMES[button.dataset.theme].color }); }));
    const label = (value) => ({ sans: 'Sans serif', serif: 'Editorial serif', mono: 'Monospace', wide: 'Bold & wide', mesh: 'Soft gradients', diagonal: 'Diagonal lines', halftone: 'Halftone dots', none: 'No decoration' })[value] || value[0].toUpperCase() + value.slice(1);
    for (const [key, choices] of Object.entries({ layout: LAYOUTS, background: BACKGROUNDS, decoration: DECORATIONS, typography: TYPOGRAPHY })) {
        $(`${key}-select`).innerHTML = choices.map((value) => `<option value="${value}">${label(value)}</option>`).join('');
    }
}

function switchTab(name, focus = false) {
    document.querySelectorAll('[data-tab]').forEach((button) => {
        const selected = button.dataset.tab === name;
        button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
        $(`panel-${button.dataset.tab}`).hidden = !selected;
        if (selected && focus) button.focus();
    });
}

async function importRepository({ preserveText = false } = {}) {
    const parsed = parseInput($('repo-input').value);
    if (!parsed) { repoStatus('Use a GitHub URL or owner/repository.', 'error'); $('repo-input').focus(); return; }
    requestController?.abort(); requestController = new AbortController();
    const id = ++requestId;
    $('import-button').disabled = true; $('import-button').firstChild.textContent = 'Importing…';
    $('import-button').classList.add('busy'); repoStatus('Reading your repository…', 'loading');
    try {
        const result = await fetchRepository(parsed.owner, parsed.repo, requestController.signal);
        if (id !== requestId) return;
        if (!preserveText) { checkpoint(); state.design = { ...state.design, title: '', description: '', footer: '', ...randomShowcaseStats() }; }
        state.repository = result.repository; state.source = 'github';
        $('repo-input').value = state.repository.fullName;
        repoStatus(result.warnings.length ? `Imported · ${result.warnings.join('. ')}` : `Live GitHub data · ${formatDate(state.repository.fetchedAt)}`);
        syncControls(); render(true); toast('Repository imported. Make it yours.');
    } catch (error) {
        if (error.name !== 'AbortError' && id === requestId) repoStatus(error.message, 'error');
    } finally {
        if (id === requestId) { $('import-button').disabled = false; $('import-button').firstChild.textContent = 'Import repository'; $('import-button').classList.remove('busy'); }
    }
}

async function exportCard() {
    if (exporting || !state.repository) return;
    exporting = true;
    const buttons = [$('download-button'), $('export-panel-button')];
    buttons.forEach((button) => { button.disabled = true; button.classList.add('busy'); });
    try {
        const repo = structuredClone(state.repository), design = structuredClone(state.design);
        const type = $('file-type').value;
        await downloadPreview(repo, design, type, Number($('export-scale').value));
        toast(`${type.toUpperCase()} ready. Go make a good impression.`);
    } catch (error) { toast(error.message || 'Export failed. Please try SVG.', true); }
    finally { exporting = false; buttons.forEach((button) => { button.disabled = false; button.classList.remove('busy'); }); }
}

buildGallery();
$('repo-form').addEventListener('submit', (event) => { event.preventDefault(); importRepository(); });
$('load-example').addEventListener('click', async () => {
    requestController?.abort(); ++requestId; $('import-button').disabled = false; $('import-button').classList.remove('busy'); $('import-button').firstChild.textContent = 'Import repository';
    try { state.repository = await loadExample(); state.source = 'example'; changeDesign({ title: '', description: '', footer: '', ...randomShowcaseStats() }); $('repo-input').value = state.repository.fullName; syncControls(); render(true); repoStatus(`Example snapshot · ${formatDate(state.repository.fetchedAt)}`); }
    catch (error) { toast(error.message, true); }
});
document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
    button.addEventListener('keydown', (event) => {
        const tabs = ['design', 'content', 'export']; let i = tabs.indexOf(button.dataset.tab);
        if (event.key === 'ArrowRight') i = (i + 1) % 3; else if (event.key === 'ArrowLeft') i = (i + 2) % 3; else if (event.key === 'Home') i = 0; else if (event.key === 'End') i = 2; else return;
        event.preventDefault(); switchTab(tabs[i], true);
    });
});
document.querySelectorAll('[data-design]').forEach((el) => {
    if (el.type === 'checkbox' || el.tagName === 'SELECT') el.addEventListener('change', () => { changeDesign({ [el.dataset.design]: el.type === 'checkbox' ? el.checked : el.value }); });
    else {
        el.addEventListener('focus', () => { editStart = structuredClone(state.design); });
        el.addEventListener('input', () => {
            editStart ||= structuredClone(state.design);
            state.design = validateDesign({ ...state.design, [el.dataset.design]: el.type === 'range' ? Number(el.value) : el.value });
            $('title-size-output').textContent = `${state.design.titleSize}%`; render();
        });
        const commit = () => { if (editStart && JSON.stringify(editStart) !== JSON.stringify(state.design)) checkpoint(editStart); editStart = null; };
        el.addEventListener('blur', commit); el.addEventListener('change', commit);
    }
});
document.querySelectorAll('[data-appearance]').forEach((button) => button.addEventListener('click', () => changeDesign({ appearance: button.dataset.appearance })));
document.querySelectorAll('[data-stats-mode]').forEach((button) => button.addEventListener('click', () => changeDesign({ statsMode: button.dataset.statsMode })));
$('reshuffle-stats').addEventListener('click', () => changeDesign(randomShowcaseStats()));
let colorStart;
$('accent-picker').addEventListener('input', () => { colorStart ||= structuredClone(state.design); state.design.accent = $('accent-picker').value; syncControls(); render(); });
$('accent-picker').addEventListener('change', () => { if (colorStart) checkpoint(colorStart); colorStart = null; });
$('accent-input').addEventListener('change', () => { const value = $('accent-input').value; if (validHex(value)) changeDesign({ accent: value }); else { syncControls(); toast('Use a six-digit hex color, for example #B5F5C4.', true); } });
$('reset-text').addEventListener('click', () => changeDesign({ title: '', description: '', eyebrow: DEFAULT_DESIGN.eyebrow, footer: '' }));
for (const id of ['file-type', 'export-scale']) $(id).addEventListener('change', syncControls);
$('download-button').addEventListener('click', exportCard); $('export-panel-button').addEventListener('click', exportCard);
function undoDesign() { if (!undo.length) return; redo.push(structuredClone(state.design)); state.design = undo.pop(); editStart = null; historyButtons(); syncControls(); render(); }
function redoDesign() { if (!redo.length) return; undo.push(structuredClone(state.design)); state.design = redo.pop(); editStart = null; historyButtons(); syncControls(); render(); }
$('undo-button').addEventListener('click', undoDesign); $('redo-button').addEventListener('click', redoDesign);
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); event.shiftKey ? redoDesign() : undoDesign(); } });
function generateComposition(remix = false) { changeDesign(generateDesign(state.design, newSeed(), { remix })); }
$('shuffle-button').addEventListener('click', () => generateComposition());
$('generate-composition').addEventListener('click', () => generateComposition());
$('remix-composition').addEventListener('click', () => generateComposition(true));
document.querySelectorAll('[data-lock]').forEach((button) => button.addEventListener('click', () => changeDesign({ [button.dataset.lock]: !state.design[button.dataset.lock] })));
document.querySelectorAll('[data-generator]').forEach((el) => el.addEventListener('change', () => {
    changeDesign({ ...compositionProfile(state.design), template: 'generated', [el.dataset.generator]: el.type === 'range' ? Number(el.value) : el.value });
}));
$('seed-input').addEventListener('change', () => {
    const seed = Number($('seed-input').value);
    if (Number.isInteger(seed) && seed > 0 && seed <= 4294967295) changeDesign(generateDesign(state.design, seed));
    else { syncControls(); toast('Enter a whole seed between 1 and 4294967295.', true); }
});
$('generator-variations').addEventListener('click', (event) => {
    const button = event.target.closest('[data-variation]'), variant = button && variations[button.dataset.variation];
    if (!variant) return;
    const visualKeys = ['template', 'seed', 'layout', 'background', 'decoration', 'typography', 'theme', 'accent', 'appearance', 'spacing', 'corner'];
    changeDesign(Object.fromEntries(visualKeys.map((key) => [key, variant[key]])));
});
document.querySelectorAll('[data-platform]').forEach((button) => button.addEventListener('click', () => changeDesign({ platform: button.dataset.platform })));
$('fullscreen-button').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('canvas-stage').requestFullscreen(); } catch { toast('Fullscreen is not available in this browser.', true); } });
$('save-project').addEventListener('click', () => { if (!state.repository) return; downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `${sanitizeFilename(state.repository.fullName)}.repocard.json`); toast('Editable project saved.'); });
$('open-project').addEventListener('click', () => $('project-file').click());
$('project-file').addEventListener('change', async () => {
    const file = $('project-file').files[0]; if (!file) return;
    try { if (file.size > 1000000) throw new Error('Project files must be smaller than 1 MB.'); const project = validateProject(JSON.parse(await file.text())); requestController?.abort(); ++requestId; state = project; undo = []; redo = []; historyButtons(); $('repo-input').value = state.repository.fullName; syncControls(); render(true); repoStatus(`Saved data · ${formatDate(state.repository.fetchedAt)}`); toast('Project opened. Pick up where you left off.'); }
    catch (error) { toast(error.message || 'Could not read that project file.', true); }
    finally { $('project-file').value = ''; $('import-button').disabled = false; $('import-button').classList.remove('busy'); $('import-button').firstChild.textContent = 'Import repository'; }
});
$('share-button').addEventListener('click', async () => { try { if (!state.repository) return; await navigator.clipboard.writeText(createDesignLink(location.href, state.repository, state.design)); toast('Design link copied. It loads fresh GitHub data when opened.'); } catch { toast('Clipboard unavailable. Use Save project to share your design.', true); } });
$('browse-templates').addEventListener('click', () => $('collection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
function filterTemplates() {
    const query = $('template-search').value.trim().toLowerCase(), category = $('category-filter').value;
    let count = 0;
    document.querySelectorAll('.collection-card').forEach((button) => {
        const item = TEMPLATES.find((item) => item.id === button.dataset.template);
        const visible = (category === 'all' || item.category === category) && `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query);
        button.hidden = !visible; if (visible) count++;
    });
    $('filter-count').textContent = `${count} ${count === 1 ? 'design' : 'designs'}`; $('no-templates').hidden = count !== 0;
}
$('template-search').addEventListener('input', filterTemplates);
$('category-filter').addEventListener('change', filterTemplates);
$('open-help').addEventListener('click', () => $('help-dialog').showModal());
for (const id of ['close-help', 'help-done']) $(id).addEventListener('click', () => $('help-dialog').close());

async function initialize() {
    let link;
    try { link = readDesignLink(location.hash); } catch { toast('That design link could not be read. The editor is still ready to use.', true); }
    try {
        await prepareFont();
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const old = JSON.parse(saved), project = validateProject(old);
                state = { ...project, source: old.source === 'example' ? 'example' : 'saved' };
                if (!Object.hasOwn(old.design || {}, 'seed') && old.design?.theme === 'mint' && old.design.accent?.toLowerCase() === '#b5f5c4') state.design = { ...state.design, theme: 'slate', accent: THEMES.slate.color };
            } catch { /* Ignore obsolete or damaged local saves. */ }
        }
    } catch { /* Local storage may be disabled. */ }
    try {
        if (!state.repository) state.repository = await loadExample();
        if (link) state.design = link.design;
        $('repo-input').value = state.repository.fullName; syncControls(); render(true);
        repoStatus(`${state.source === 'example' ? 'Example snapshot' : 'Saved data'} · ${formatDate(state.repository.fetchedAt)}`);
        if (link) { $('repo-input').value = link.repo; await importRepository({ preserveText: true }); }
    } catch (error) { repoStatus(error.message, 'error'); }
}
initialize();
