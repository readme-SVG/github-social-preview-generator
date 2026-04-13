import { DEFAULT_THEME, THEMES } from './constants.js';
import { getElements, renderFeatures, renderLanguages, setLoading, setStatus, updateLoaderText } from './dom.js';
import { downloadPreview } from './export.js';
import { fetchLanguages, fetchRepository } from './github.js';
import { fmt, fmtSize, parseInput, titleCase } from './utils.js';

const elements = getElements();
let currentTheme = DEFAULT_THEME;
let currentTemplate = 'grid';
let customThemeHex = '#58a6ff';

const ANIMATION_DURATION = 4000;
const TAU = Math.PI * 2;
let blobAnimationFrameId = null;
let blobAnimationStart = performance.now();
let isBlobAnimationRunning = false;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function setBlobsAtTime(t) {
    const p = (t % ANIMATION_DURATION) / ANIMATION_DURATION;

    const b1x = Math.sin(p * TAU) * 40;
    const b1y = Math.cos(p * TAU * 0.7 + 0.6) * 30;
    const b1s = 1 + Math.sin(p * TAU * 1.3 + 0.8) * 0.05;
    const b1o = 0.2 + Math.sin(p * TAU * 1.1) * 0.04;
    elements.blob1.style.transform = `translate(${b1x}px, ${b1y}px) scale(${b1s})`;
    elements.blob1.style.opacity = `${b1o}`;

    const b2x = Math.cos(p * TAU * 0.8 + 1.2) * 35;
    const b2y = Math.sin(p * TAU * 1.2 + 0.3) * 25;
    const b2s = 1 + Math.cos(p * TAU + 0.7) * 0.06;
    const b2o = 0.17 + Math.cos(p * TAU * 0.9 + 0.5) * 0.035;
    elements.blob2.style.transform = `translate(${b2x}px, ${b2y}px) scale(${b2s})`;
    elements.blob2.style.opacity = `${b2o}`;

    const b3x = Math.sin(p * TAU * 1.1 + 2.1) * 22;
    const b3y = Math.cos(p * TAU * 0.9 + 0.2) * 28;
    const b3s = 1 + Math.sin(p * TAU * 0.8 + 1.3) * 0.04;
    const b3o = 0.12 + Math.sin(p * TAU * 1.4 + 1.9) * 0.025;
    elements.blob3.style.transform = `translate(-50%, -50%) translate(${b3x}px, ${b3y}px) scale(${b3s})`;
    elements.blob3.style.opacity = `${b3o}`;
}

function animateBlobs(now) {
    setBlobsAtTime(now - blobAnimationStart);
    blobAnimationFrameId = window.requestAnimationFrame(animateBlobs);
}

function startBlobAnimation() {
    if (isBlobAnimationRunning) {
        return;
    }

    blobAnimationStart = performance.now();
    isBlobAnimationRunning = true;
    blobAnimationFrameId = window.requestAnimationFrame(animateBlobs);
}

function applyTemplate(templateName) {
    currentTemplate = templateName;
    const card = elements.capture;
    card.className = 'card';
    if (templateName !== 'grid') {
        card.classList.add(`template-${templateName}`);
    }
    elements.templateButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.template === templateName);
    });
}

function applyTheme(themeName) {
    if (themeName === 'custom') {
        applyCustomTheme(customThemeHex);
        return;
    }

    currentTheme = themeName;
    const theme = THEMES[themeName];

    elements.blob1.style.background = `radial-gradient(ellipse, ${theme.b1}, transparent 70%)`;
    elements.blob2.style.background = `radial-gradient(ellipse, ${theme.b2}, transparent 70%)`;
    elements.blob3.style.background = `radial-gradient(ellipse, ${theme.b3}, transparent 70%)`;
    document.documentElement.style.setProperty('--tc', theme.tc);

    elements.themeDots.forEach((dot) => {
        dot.classList.toggle('active', dot.dataset.theme === themeName);
    });

    const customColorPicker = document.getElementById('custom-color-picker');
    if (customColorPicker) {
        customColorPicker.classList.remove('active');
    }
}

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const fullHex = clean.length === 3
        ? clean.split('').map((char) => char + char).join('')
        : clean;
    const value = Number.parseInt(fullHex, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

function rgbToHex(r, g, b) {
    return `#${[r, g, b]
        .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
        .join('')}`;
}

function mixWith(colorHex, targetHex, amount) {
    const color = hexToRgb(colorHex);
    const target = hexToRgb(targetHex);
    const mix = (source, destination) => source + (destination - source) * amount;
    return rgbToHex(mix(color.r, target.r), mix(color.g, target.g), mix(color.b, target.b));
}

function generateCustomTheme(baseHex) {
    return {
        b1: mixWith(baseHex, '#0d1117', 0.4),
        b2: mixWith(baseHex, '#0d1117', 0.58),
        b3: mixWith(baseHex, '#ffffff', 0.08),
        tc: mixWith(baseHex, '#ffffff', 0.1)
    };
}

function applyCustomTheme(hex) {
    customThemeHex = hex;
    currentTheme = 'custom';
    const theme = generateCustomTheme(hex);

    elements.blob1.style.background = `radial-gradient(ellipse, ${theme.b1}, transparent 70%)`;
    elements.blob2.style.background = `radial-gradient(ellipse, ${theme.b2}, transparent 70%)`;
    elements.blob3.style.background = `radial-gradient(ellipse, ${theme.b3}, transparent 70%)`;
    document.documentElement.style.setProperty('--tc', theme.tc);

    elements.themeDots.forEach((dot) => {
        dot.classList.remove('active');
    });

    const customColorPicker = document.getElementById('custom-color-picker');
    if (customColorPicker) {
        customColorPicker.classList.add('active');
        customColorPicker.value = hex;
    }
}

function updateRepositoryMetadata(repository, topLanguages) {
    const licenseId = repository.license?.spdx_id ?? null;
    const displayLicense = licenseId === 'NOASSERTION' ? 'Custom' : licenseId ?? '—';
    const mainLanguage = topLanguages.length ? topLanguages[0][0] : 'Not specified';

    elements.repoDisplay.textContent = `${repository.owner.login}/${repository.name}`;
    elements.stars.textContent = fmt(randomInt(1000, 2000));
    elements.forks.textContent = fmt(randomInt(300, 700));
    elements.title.textContent = titleCase(repository.name);
    elements.description.textContent = repository.description || 'No description provided for this repository.';
    elements.license.textContent = licenseId || '—';
    elements.licenseWrap.style.display = licenseId && licenseId !== 'NOASSERTION' ? 'flex' : 'none';
    elements.size.textContent = fmtSize(repository.size);
    elements.branch.textContent = repository.default_branch || 'main';

    const createdYear = repository.created_at ? new Date(repository.created_at).getFullYear() : '—';
    const updatedDate = repository.updated_at
        ? new Date(repository.updated_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—';
    const topLangs = topLanguages.slice(0, 3).map(([l]) => l).join(', ') || 'Not specified';

    renderFeatures(elements, [
        {
            title: 'Overview',
            lines: [
                `Created in ${createdYear}`,
                `Last updated: ${updatedDate}`
            ]
        },
        {
            title: 'Tech Stack',
            lines: [`${topLangs}`, `Size: ${fmtSize(repository.size)}`]
        },
        {
            title: 'Details',
            lines: [`Branch: ${repository.default_branch || 'main'}`, `License: ${displayLicense}`]
        }
    ]);
}

async function generatePreview() {
    const parsed = parseInput(elements.input.value);

    if (!parsed) {
        setStatus(elements, 'Enter a valid GitHub URL or owner/repo', 'error');
        return;
    }

    setStatus(elements, 'Fetching data...');
    updateLoaderText(elements, 'Fetching GitHub data...');
    setLoading(elements, true);

    try {
        const repository = await fetchRepository(parsed.owner, parsed.repo);
        const topLanguages = await fetchLanguages(repository.languages_url);

        renderLanguages(elements, topLanguages);
        updateRepositoryMetadata(repository, topLanguages);
        applyTheme(currentTheme);
        setStatus(elements, '✓ Done', 'ok');
    } catch (error) {
        setStatus(elements, error.message, 'error');
    } finally {
        setLoading(elements, false);
    }
}

function bindEvents() {
    elements.generateButton.addEventListener('click', generatePreview);
    elements.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            generatePreview();
        }
    });
    elements.themeDots.forEach((dot) => {
        dot.addEventListener('click', () => applyTheme(dot.dataset.theme));
    });
    const customColorPicker = document.getElementById('custom-color-picker');
    if (customColorPicker) {
        customColorPicker.addEventListener('input', (event) => {
            applyCustomTheme(event.target.value);
        });
    }
    elements.downloadJpgButton.addEventListener('click', () => {
        downloadPreview({
            button: elements.downloadJpgButton,
            captureElement: elements.capture,
            repoDisplayElement: elements.repoDisplay
        });
    });
    elements.templateButtons.forEach((btn) => {
        btn.addEventListener('click', () => applyTemplate(btn.dataset.template));
    });
}

bindEvents();
applyTheme(DEFAULT_THEME);
applyTemplate('grid');
startBlobAnimation();
