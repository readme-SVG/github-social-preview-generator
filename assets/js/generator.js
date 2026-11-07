import { BACKGROUNDS, DECORATIONS, LAYOUTS, THEMES, TEMPLATES, TYPOGRAPHY } from './constants.js';

/**
 * Generates a deterministic pseudo-random number based on a seed.
 *
 * @param {number} seed - Initial seed value (unsigned 32-bit integer).
 * @returns {function(): number} A generator function returning values in [0, 1).
 */
export function seededRandom(seed) {
    let state = Number(seed) >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let n = state;
        n = Math.imul(n ^ (n >>> 15), n | 1);
        n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
        return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Generates a cryptographically secure random seed if available.
 *
 * @returns {number} A 32-bit unsigned integer seed.
 */
export function newSeed() {
    if (globalThis.crypto?.getRandomValues) {
        const arr = new Uint32Array(1);
        globalThis.crypto.getRandomValues(arr);
        return arr[0] || 1;
    }
    return Math.floor(Math.random() * 4294967294) + 1;
}

/**
 * Derives a composition profile from the current design, respecting template presets.
 *
 * @param {Object} design - The current design configuration.
 * @returns {Object} Profile containing layout, background, decoration, and typography.
 */
export function compositionProfile(design) {
    const preset = TEMPLATES.find((item) => item.id === design.template);
    const legacyLayouts = {
        aurora: 'orbital',
        editorial: 'poster',
        blueprint: 'network',
        bento: 'quadrant',
        terminal: 'dossier',
        release: 'split'
    };

    return {
        layout: preset?.layout || legacyLayouts[design.template] || design.layout,
        background: preset?.background || design.background,
        decoration: preset?.decoration || design.decoration,
        typography: preset?.typography || design.typography,
    };
}

/**
 * Generates a new design configuration based on the current state and a seed.
 * Respects lock flags to preserve specific design elements.
 *
 * @param {Object} current - The current design state.
 * @param {number} [seed=newSeed()] - Seed for deterministic generation.
 * @param {Object} [{ remix = false }] - Options for generation (e.g., remix mode).
 * @returns {Object} The newly generated design configuration.
 */
export function generateDesign(current, seed = newSeed(), { remix = false } = {}) {
    const random = seededRandom(seed);
    const choose = (items) => items[Math.floor(random() * items.length)];

    const profile = compositionProfile(current);

    // Pre-calculate all parameters to ensure locking doesn't affect randomness distribution
    const generated = {
        layout: choose(LAYOUTS),
        background: choose(BACKGROUNDS),
        decoration: choose(DECORATIONS),
        typography: choose(TYPOGRAPHY),
        theme: choose(Object.keys(THEMES)),
        appearance: random() > 0.82 ? 'light' : 'dark',
        spacing: choose(['compact', 'balanced', 'airy']),
        corner: choose([0, 8, 20, 36]),
    };

    // Apply locks: if a property is locked, retain the profile/current value; otherwise, use generated
    return {
        ...current,
        template: 'generated',
        seed: Number(seed) >>> 0,
        layout: current.lockLayout || remix ? profile.layout : generated.layout,
        background: current.lockBackground ? profile.background : generated.background,
        decoration: current.lockDecoration ? profile.decoration : generated.decoration,
        typography: current.lockTypography ? profile.typography : generated.typography,
        theme: current.lockPalette ? current.theme : generated.theme,
        accent: current.lockPalette ? current.accent : THEMES[generated.theme].color,
        appearance: current.lockPalette ? current.appearance : generated.appearance,
        spacing: generated.spacing,
        corner: generated.corner,
    };
}
