import { BACKGROUNDS, DECORATIONS, DEFAULT_DESIGN, FORMATS, LAYOUTS, THEMES, TEMPLATES, TYPOGRAPHY } from './constants.js';
import { parseInput, validHex } from './utils.js';

export function validateDesign(input = {}) {
    const result = { ...DEFAULT_DESIGN };
    if (!input || typeof input !== 'object') return result;
    for (const key of Object.keys(result)) {
        if (typeof result[key] === 'boolean' && typeof input[key] === 'boolean') result[key] = input[key];
    }
    for (const [key, limit] of Object.entries({ title: 100, description: 500, eyebrow: 65, footer: 80 })) {
        if (typeof input[key] === 'string') result[key] = input[key].slice(0, limit);
    }
    if (input.template === 'generated' || TEMPLATES.some((item) => item.id === input.template)) result.template = input.template;
    if (Object.hasOwn(THEMES, input.theme)) result.theme = input.theme;
    if (validHex(input.accent)) result.accent = input.accent;
    if (input.appearance === 'light') result.appearance = 'light';
    if (input.platform === 'desktop') result.platform = 'desktop';
    if (Object.hasOwn(FORMATS, input.format)) result.format = input.format;
    if (Number.isFinite(Number(input.titleSize))) result.titleSize = Math.max(65, Math.min(125, Number(input.titleSize)));
    if (input.statsMode === 'github') result.statsMode = 'github';
    for (const [key, choices] of Object.entries({ layout: LAYOUTS, background: BACKGROUNDS, decoration: DECORATIONS, typography: TYPOGRAPHY, spacing: ['compact', 'balanced', 'airy'] })) {
        if (choices.includes(input[key])) result[key] = input[key];
    }
    if (Number.isFinite(Number(input.seed))) result.seed = Math.max(1, Math.min(4294967295, Math.round(Number(input.seed))));
    if (Number.isFinite(Number(input.corner))) result.corner = Math.max(0, Math.min(36, Number(input.corner)));
    for (const key of ['showcaseStars', 'showcaseForks']) {
        if (Number.isFinite(Number(input[key]))) result[key] = Math.max(0, Math.min(1e12, Math.round(Number(input[key]))));
    }
    return result;
}

export function validateProject(input) {
    if (!input || input.version !== 1 || !input.repository || !parseInput(input.repository.fullName)) throw new Error('This is not a valid RepoCard project. Open a project saved from this editor.');
    const src = input.repository;
    const parsed = parseInput(src.fullName);
    const string = (value, limit = 500) => typeof value === 'string' ? value.slice(0, limit) : '';
    const count = (value) => Math.max(0, Math.min(1e12, Number(value) || 0));
    const languages = Array.isArray(src.languages) ? src.languages.filter((x) => x && typeof x.name === 'string').slice(0, 5).map((x) => ({ name: x.name.slice(0, 40), percent: Math.max(0, Math.min(100, Number(x.percent) || 0)) })).filter((x) => x.percent > 0) : [];
    const total = languages.reduce((sum, lang) => sum + lang.percent, 0);
    if (total > 100) languages.forEach((lang) => { lang.percent = lang.percent / total * 100; });
    return {
        version: 1, design: validateDesign(input.design), source: 'saved',
        repository: {
            name: string(src.name, 100) || parsed.repo, owner: parsed.owner, fullName: `${parsed.owner}/${parsed.repo}`,
            description: string(src.description), stars: count(src.stars), forks: count(src.forks), issues: count(src.issues),
            license: string(src.license, 50), branch: string(src.branch, 100), homepage: string(src.homepage),
            topics: Array.isArray(src.topics) ? src.topics.filter((x) => typeof x === 'string').slice(0, 8).map((x) => x.slice(0, 50)) : [],
            languages,
            release: src.release && typeof src.release === 'object' ? { tag: string(src.release.tag, 80), name: string(src.release.name, 200), published: string(src.release.published, 50) } : null,
            contributors: Array.isArray(src.contributors) ? src.contributors.filter((x) => x && typeof x.login === 'string').slice(0, 5).map((x) => ({ login: x.login.slice(0, 40) })) : [],
            fetchedAt: string(src.fetchedAt, 50), updated: string(src.updated, 50), created: string(src.created, 50), archived: !!src.archived,
        },
    };
}

export function createDesignLink(base, repository, design) {
    const url = new URL(base);
    const payload = JSON.stringify({ version: 1, repo: repository.fullName, design });
    const bytes = new TextEncoder().encode(payload);
    const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    url.hash = `design=${encoded}`;
    return url.href;
}

export function readDesignLink(hash) {
    if (!hash.startsWith('#design=')) return null;
    const value = hash.slice(8);
    if (value.length > 12000) throw new Error('This design link is too long.');
    let encoded = value.replace(/-/g, '+').replace(/_/g, '/');
    encoded += '='.repeat((4 - encoded.length % 4) % 4);
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data.version !== 1 || !parseInput(data.repo)) throw new Error('Invalid design link.');
    return { repo: data.repo, design: validateDesign(data.design) };
}
