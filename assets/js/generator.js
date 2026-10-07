import { BACKGROUNDS, DECORATIONS, LAYOUTS, THEMES, TEMPLATES, TYPOGRAPHY } from './constants.js';

// Small seeded PRNG: a saved composition always recreates the same geometry.
export function seededRandom(seed) {
    let state = Number(seed) >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let n = state;
        n = Math.imul(n ^ n >>> 15, n | 1);
        n ^= n + Math.imul(n ^ n >>> 7, n | 61);
        return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
}

export function newSeed() {
    if (globalThis.crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    return Math.floor(Math.random() * 4294967294) + 1;
}

export function compositionProfile(design) {
    const preset = TEMPLATES.find((item) => item.id === design.template);
    const legacyLayouts = { aurora: 'orbital', editorial: 'poster', blueprint: 'network', bento: 'quadrant', terminal: 'dossier', release: 'split' };
    return {
        layout: preset?.layout || legacyLayouts[design.template] || design.layout,
        background: preset?.background || design.background,
        decoration: preset?.decoration || design.decoration,
        typography: preset?.typography || design.typography,
    };
}

export function generateDesign(current, seed = newSeed(), { remix = false } = {}) {
    const random = seededRandom(seed), choose = (items) => items[Math.floor(random() * items.length)];
    const profile = compositionProfile(current);
    // Draw all parameters before applying locks, so locking one does not reshuffle the others.
    const generated = {
        layout: choose(LAYOUTS), background: choose(BACKGROUNDS), decoration: choose(DECORATIONS),
        typography: choose(TYPOGRAPHY), theme: choose(Object.keys(THEMES)),
        appearance: random() > .82 ? 'light' : 'dark',
        spacing: choose(['compact', 'balanced', 'airy']), corner: choose([0, 8, 20, 36]),
    };
    return {
        ...current, template: 'generated', seed: Number(seed) >>> 0,
        layout: current.lockLayout || remix ? profile.layout : generated.layout,
        background: current.lockBackground ? profile.background : generated.background,
        decoration: current.lockDecoration ? profile.decoration : generated.decoration,
        typography: current.lockTypography ? profile.typography : generated.typography,
        theme: current.lockPalette ? current.theme : generated.theme,
        accent: current.lockPalette ? current.accent : THEMES[generated.theme].color,
        appearance: current.lockPalette ? current.appearance : generated.appearance,
        spacing: generated.spacing, corner: generated.corner,
    };
}
