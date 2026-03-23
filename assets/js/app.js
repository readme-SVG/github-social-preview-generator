import { DEFAULT_THEME, THEMES } from './constants.js';
import { getElements, renderFeatures, renderLanguages, setLoading, setStatus, updateLoaderText } from './dom.js';
import { downloadPreview } from './export.js';
import { fetchLanguages, fetchRepository } from './github.js';
import { fmt, fmtSize, parseInput, titleCase } from './utils.js';

const elements = getElements();
let currentTheme = DEFAULT_THEME;
const TEMPLATE_CLASS_PREFIX = 'template-';

function applyTheme(themeName) {
    currentTheme = themeName;
    const theme = THEMES[themeName];

    elements.blob1.style.background = `radial-gradient(ellipse, ${theme.b1}, transparent 70%)`;
    elements.blob2.style.background = `radial-gradient(ellipse, ${theme.b2}, transparent 70%)`;
    elements.blob3.style.background = `radial-gradient(ellipse, ${theme.b3}, transparent 70%)`;
    document.documentElement.style.setProperty('--tc', theme.tc);

    elements.themeDots.forEach((dot) => {
        dot.classList.toggle('active', dot.dataset.theme === themeName);
    });
}

function applyTemplate(templateName) {
    const templateClasses = elements.capture.classList
        .value
        .split(' ')
        .filter((className) => className.startsWith(TEMPLATE_CLASS_PREFIX));

    templateClasses.forEach((className) => elements.capture.classList.remove(className));
    elements.capture.classList.add(`${TEMPLATE_CLASS_PREFIX}${templateName}`);

    elements.templateButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.template === templateName);
    });
}

function updateRepositoryMetadata(repository, topLanguages) {
    const licenseId = repository.license?.spdx_id ?? null;
    const displayLicense = licenseId === 'NOASSERTION' ? 'Custom' : licenseId ?? '—';
    const mainLanguage = topLanguages.length ? topLanguages[0][0] : 'Not specified';

    elements.repoDisplay.textContent = `${repository.owner.login}/${repository.name}`;
    elements.stars.textContent = fmt(repository.stargazers_count);
    elements.forks.textContent = fmt(repository.forks_count);
    elements.title.textContent = titleCase(repository.name);
    elements.description.textContent = repository.description || 'No description provided for this repository.';
    elements.license.textContent = licenseId || '—';
    elements.licenseWrap.style.display = licenseId && licenseId !== 'NOASSERTION' ? 'flex' : 'none';
    elements.size.textContent = fmtSize(repository.size);
    elements.branch.textContent = repository.default_branch || 'main';

    renderFeatures(elements, [
        {
            title: 'Activity',
            lines: [
                `${fmt(repository.stargazers_count)} Stars • ${fmt(repository.forks_count)} Forks`,
                `${fmt(repository.open_issues_count || 0)} Open Issues`
            ]
        },
        {
            title: 'Tech Stack',
            lines: [`Primary language: ${mainLanguage}`, `Size: ${fmtSize(repository.size)}`]
        },
        {
            title: 'Details',
            lines: [`Default branch: ${repository.default_branch || 'main'}`, `License: ${displayLicense}`]
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
    elements.templateButtons.forEach((button) => {
        button.addEventListener('click', () => applyTemplate(button.dataset.template));
    });
    elements.downloadJpgButton.addEventListener('click', () => {
        downloadPreview({
            type: 'jpeg',
            button: elements.downloadJpgButton,
            captureElement: elements.capture,
            repoDisplayElement: elements.repoDisplay
        });
    });
    elements.downloadPngButton.addEventListener('click', () => {
        downloadPreview({
            type: 'png',
            button: elements.downloadPngButton,
            captureElement: elements.capture,
            repoDisplayElement: elements.repoDisplay
        });
    });
}

bindEvents();
applyTheme(DEFAULT_THEME);
applyTemplate('grid');
