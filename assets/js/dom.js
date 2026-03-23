import { LANG_COLORS } from './constants.js';

export function getElements() {
    return {
        input: document.getElementById('inp'),
        status: document.getElementById('status'),
        loader: document.getElementById('loader'),
        loaderText: document.getElementById('loader-text'),
        generateButton: document.getElementById('btn-go'),
        downloadJpgButton: document.getElementById('btn-jpg'),
        downloadPngButton: document.getElementById('btn-png'),
        capture: document.getElementById('capture'),
        repoDisplay: document.getElementById('o-repo-display'),
        stars: document.getElementById('o-stars'),
        forks: document.getElementById('o-forks'),
        title: document.getElementById('o-title'),
        description: document.getElementById('o-desc'),
        features: document.getElementById('o-features'),
        languages: document.getElementById('o-langs'),
        licenseWrap: document.getElementById('o-lic-wrap'),
        license: document.getElementById('o-lic'),
        size: document.getElementById('o-size'),
        branch: document.getElementById('o-branch'),
        blob1: document.getElementById('blob1'),
        blob2: document.getElementById('blob2'),
        blob3: document.getElementById('blob3'),
        themeDots: Array.from(document.querySelectorAll('.theme-dot')),
        templateButtons: Array.from(document.querySelectorAll('.template-btn'))
    };
}

export function setStatus(elements, message, type = '') {
    elements.status.textContent = message;
    elements.status.className = type ? `status ${type}` : 'status';
}

export function updateLoaderText(elements, text) {
    elements.loaderText.textContent = text;
}

export function setLoading(elements, isLoading) {
    elements.loader.classList.toggle('active', isLoading);
    elements.generateButton.disabled = isLoading;
}

export function renderLanguages(elements, languages) {
    if (!languages.length) {
        elements.languages.innerHTML = `
            <div class="foot-item">
                <span class="foot-dot" style="background:#8b949e"></span>
                <span>Code</span>
            </div>
        `;
        return;
    }

    elements.languages.innerHTML = languages
        .map(
            ([language]) => `
                <div class="foot-item">
                    <span class="foot-dot" style="background:${LANG_COLORS[language] || '#8b949e'}"></span>
                    <span>${language}</span>
                </div>
            `
        )
        .join('');
}

function createFeatureBox(title, lines) {
    const box = document.createElement('div');
    box.className = 'bento-box';

    const heading = document.createElement('div');
    heading.className = 'bento-box-title';
    heading.textContent = title;

    const text = document.createElement('div');
    text.className = 'bento-box-text';
    text.innerHTML = lines.join('<br>');

    box.append(heading, text);
    return box;
}

export function renderFeatures(elements, featureGroups) {
    elements.features.replaceChildren(
        ...featureGroups.map((feature) => createFeatureBox(feature.title, feature.lines))
    );
}
