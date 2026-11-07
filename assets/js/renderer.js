import { FORMATS, LANG_COLORS, THEMES } from './constants.js';
import { renderComposition } from './compositions.js';
import { renderDesktopCard } from './desktop.js';
import { contrastColor, escapeXml as esc, fmt, formatDate, luminance, mixColor } from './utils.js';

// Global state for font rendering and SVG sequence tracking
export const GITHUB_PATH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';
let fontData = '';
let measureContext;
let svgSequence = 0;

/**
 * Prepares the font for SVG embedding by loading it and converting to base64.
 *
 * @returns {Promise<void>}
 */
export async function prepareFont() {
    try {
        await document.fonts.load('700 60px Manrope');
        const response = await fetch(new URL('../fonts/Manrope.ttf', import.meta.url));
        if (!response.ok) {
            return;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        // Process in chunks to prevent memory spikes
        for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        fontData = btoa(binary);
    } catch (error) {
        // Graceful degradation: system fonts remain available
        console.warn('Failed to load font data:', error);
    }
}

/**
 * Measures text width for SVG layout calculations.
 *
 * @param {string} value - Text content.
 * @param {number} size - Font size in pixels.
 * @param {number} [weight=500] - Font weight.
 * @param {boolean} [mono=false] - Use monospace font.
 * @param {string} [family=''] - Font family override.
 * @returns {number} Calculated width.
 */
function measure(value, size, weight = 500, mono = false, family = '') {
    // Fallback for server-side or non-browser environments
    if (typeof document === 'undefined') {
        return String(value).length * size * 0.58;
    }

    measureContext ||= document.createElement('canvas').getContext('2d');
    const fontFamily = family || (mono ? 'Consolas, monospace' : 'Manrope, Arial, sans-serif');
    measureContext.font = `${weight} ${size}px ${fontFamily}`;
    return measureContext.measureText(String(value)).width;
}

/**
 * Wraps text into lines fitting within a specified width.
 *
 * @param {string} value - Text content.
 * @param {number} width - Maximum width in pixels.
 * @param {number} size - Font size.
 * @param {number} [maxLines=3] - Maximum lines allowed.
 * @param {number} [weight=500] - Font weight.
 * @param {boolean} [mono=false] - Use monospace.
 * @param {string} [family=''] - Font family.
 * @returns {string[]} Array of wrapped lines.
 */
export function wrapText(value, width, size, maxLines = 3, weight = 500, mono = false, family = '') {
    const tokens = String(value).trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    for (const word of tokens) {
        let pieces = [word];
        // Handle words longer than width
        if (measure(word, size, weight, mono, family) > width) {
            pieces = [];
            let chunk = '';
            for (const char of Array.from(word)) {
                if (measure(chunk + char, size, weight, mono, family) > width && chunk) {
                    pieces.push(chunk);
                    chunk = '';
                }
                chunk += char;
            }
            if (chunk) {
                pieces.push(chunk);
            }
        }

        for (const piece of pieces) {
            const next = line ? `${line} ${piece}` : piece;
            if (measure(next, size, weight, mono, family) > width && line) {
                lines.push(line);
                line = piece;
            } else {
                line = next;
            }
        }
    }

    if (line) {
        lines.push(line);
    }

    // Truncate to maxLines with ellipsis
    if (lines.length > maxLines) {
        lines.length = maxLines;
        let last = lines[maxLines - 1];
        while (measure(last + '…', size, weight, mono, family) > width && last) {
            last = Array.from(last).slice(0, -1).join('');
        }
        lines[maxLines - 1] = last + '…';
    }

    return lines;
}

/** SVG element generators **/

function text(value, x, y, size = 24, color = '#fff', weight = 500, extra = '') {
    return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(value)}</text>`;
}

function rect(x, y, w, h, fill, radius = 0, stroke = 'none') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
}

function line(x1, y1, x2, y2, color, opacity = 1) {
    return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" opacity="${opacity}"/>`;
}

function github(x, y, size, color) {
    return `<g data-symbol="github" transform="translate(${x} ${y}) scale(${size / 16})"><path fill="${color}" d="${GITHUB_PATH}"/></g>`;
}

function star(x, y, color, size = 20) {
    return `<path data-symbol="star" transform="translate(${x} ${y}) scale(${size / 24})" d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function fork(x, y, color) {
    return `<g data-symbol="fork" transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.6"><circle cx="5" cy="3" r="2.5"/><circle cx="17" cy="3" r="2.5"/><circle cx="11" cy="19" r="2.5"/><path d="M5 6v3q0 3 6 3m6-6v3q0 3-6 3v4"/></g>`;
}

/**
 * Renders multiple lines of text within SVG.
 *
 * @param {string} value - Content.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} width - Max width.
 * @param {number} size - Font size.
 * @param {string} color - Fill color.
 * @param {number} [max=3] - Max lines.
 * @param {number} [weight=500] - Font weight.
 * @param {boolean} [mono=false] - Monospace flag.
 * @returns {string} SVG markup.
 */
function multiline(value, x, y, width, size, color, max = 3, weight = 500, mono = false) {
    const rows = wrapText(value, width, size, max, weight, mono);
    return rows
        .map((row, i) => text(row, x, y + i * size * 1.5, size, color, weight, 'data-role="repo-description"'))
        .join('');
}

/**
 * Renders the title with dynamic sizing to fit within bounds.
 *
 * @param {string} value - Title text.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} width - Max width.
 * @param {number} base - Base font size.
 * @param {string} color - Fill color.
 * @param {number} factor - Scaling factor.
 * @param {number} [maxLines=2] - Max lines.
 * @param {number} [maxBottom=Infinity] - Max bottom Y limit.
 * @param {string} [role='project-title'] - Data role attribute.
 * @returns {{svg: string, bottom: number, size: number}} Rendering result.
 */
function title(value, x, y, width, base, color, factor, maxLines = 2, maxBottom = Infinity, role = 'project-title') {
    let size = (base * factor) / 100;
    const original = size;

    // Iteratively reduce size until text fits
    while (size > 32) {
        const count = wrapText(value, width, size, 100, 800).length;
        const calculatedBottom = y - (original - size) * 0.7 + (count - 1) * size * 1.13;
        if (count <= maxLines && calculatedBottom <= maxBottom) {
            break;
        }
        size -= 2;
    }

    const startY = y - (original - size) * 0.7;
    const rows = wrapText(value, width, size, maxLines, 800);
    const svg = rows
        .map((row, i) =>
            text(row, x, startY + i * size * 1.13, size, color, 800, `data-role="${role}" letter-spacing="-3"`)
        )
        .join('');

    return {
        svg,
        bottom: startY + (rows.length - 1) * size * 1.13,
        size
    };
}

/**
 * Renders topic pills.
 *
 * @param {string[]} topics - Array of topic strings.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {string} color - Text color.
 * @param {string} border - Border color.
 * @param {number} [maxWidth=900] - Max width constraint.
 * @returns {string} SVG markup.
 */
function pills(topics, x, y, color, border, maxWidth = 900) {
    let cursor = x;
    let svg = '';
    for (const topic of topics.slice(0, 4)) {
        const label = wrapText(topic, 185, 16, 1)[0];
        const width = measure(label, 16) + 30;
        if (cursor + width > x + maxWidth) {
            break;
        }
        svg += rect(cursor, y - 24, width, 35, 'transparent', 18, border);
        svg += text(label, cursor + 15, y - 1, 16, color);
        cursor += width + 9;
    }
    return svg;
}

/**
 * Renders repository statistics row (stars/forks).
 *
 * @param {Object} repo - Repository data.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {string} color - Primary color.
 * @param {string} muted - Muted color.
 * @returns {string} SVG markup.
 */
function statRow(repo, x, y, color, muted) {
    return (
        star(x, y - 19, muted) +
        text(fmt(repo.stars), x + 30, y, 22, color, 700) +
        text('stars', x + 30 + measure(fmt(repo.stars), 22, 700) + 9, y, 17, muted) +
        fork(x + 191, y - 20, muted) +
        text(fmt(repo.forks), x + 223, y, 22, color, 700) +
        text('forks', x + 223 + measure(fmt(repo.forks), 22, 700) + 9, y, 17, muted)
    );
}

/**
 * Renders language bar and labels.
 *
 * @param {Object[]} languages - Language data.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} width - Bar width.
 * @param {string} muted - Muted color.
 * @param {boolean} [labels=true] - Render text labels.
 * @returns {string} SVG markup.
 */
function languageBar(languages, x, y, width, muted, labels = true) {
    const total = languages.reduce((sum, lang) => sum + lang.percent, 0);
    if (!total) {
        return '';
    }

    let cursor = x;
    let svg = rect(x, y, width, 7, muted, 3);

    // Render bar segments
    for (const lang of languages) {
        const w = (width * lang.percent) / 100;
        svg += rect(cursor, y, Math.max(0, w - 2), 7, LANG_COLORS[lang.name] || '#9aa7a5', 3);
        cursor += w;
    }

    // Render labels
    cursor = x;
    if (labels) {
        for (const lang of languages.slice(0, 3)) {
            const label = `${lang.name} ${lang.percent.toFixed(1)}%`;
            const widthLabel = measure(label, 15) + 30;
            if (cursor + widthLabel > x + width + 10) {
                break;
            }
            svg += `<circle cx="${cursor + 4}" cy="${y + 31}" r="4" fill="${LANG_COLORS[lang.name] || '#9aa7a5'}"/>`;
            svg += text(label, cursor + 16, y + 36, 15, muted);
            cursor += widthLabel;
        }
    }
    return svg;
}

/**
 * Renders decorative motifs (flower or orbit patterns).
 *
 * @param {number} cx - Center X.
 * @param {number} cy - Center Y.
 * @param {string} accent - Accent color.
 * @param {number} [size=200] - Pattern size.
 * @param {string} [type='orbit'] - Pattern type.
 * @returns {string} SVG markup.
 */
function motif(cx, cy, accent, size = 200, type = 'orbit') {
    if (type === 'flower') {
        let svg = '';
        for (let i = 0; i < 12; i++) {
            svg += `<ellipse cx="${cx}" cy="${cy - size * 0.38}" rx="${size * 0.16}" ry="${size * 0.4}" fill="none" stroke="${accent}" stroke-width="1.5" transform="rotate(${i * 30} ${cx} ${cy})"/>`;
        }
        return svg;
    }
    return (
        `<g fill="none" stroke="${accent}" stroke-width="1.5">` +
        `<circle cx="${cx}" cy="${cy}" r="${size * 0.7}" opacity=".3"/>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${size}" ry="${size * 0.3}" transform="rotate(-35 ${cx} ${cy})"/>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${size}" ry="${size * 0.3}" transform="rotate(35 ${cx} ${cy})"/>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${size}" ry="${size * 0.3}" transform="rotate(90 ${cx} ${cy})"/>` +
        `<circle cx="${cx}" cy="${cy}" r="9" fill="${accent}"/>` +
        `</g>`
    );
}

/**
 * Main card rendering function.
 *
 * @param {Object} repo - Repository data.
 * @param {Object} design - Design configuration.
 * @param {Object} [{ thumbnail = false, embedFont = false }] - Rendering options.
 * @returns {string} Final SVG markup.
 */
export function renderCard(repo, design, { thumbnail = false, embedFont = false } = {}) {
    // Apply showcase stats if enabled
    const activeRepo = design.statsMode === 'showcase'
        ? { ...repo, stars: design.showcaseStars, forks: design.showcaseForks }
        : repo;

    const { width, height } = FORMATS[design.format] || FORMATS.github;
    const H = (1280 * height) / width;
    const square = H > 900;

    const accent = design.accent;
    const secondary = THEMES[design.theme]?.secondary || '#8b7cf8';
    const light = design.appearance === 'light';

    // Color palette determination
    let bg = light ? '#f1f3f6' : '#111721';
    if (design.template === 'editorial') bg = light ? '#f4f0e8' : '#24241e';
    if (design.template === 'blueprint') bg = light ? '#edf4f6' : '#101d2c';
    if (design.template === 'terminal') bg = light ? '#f0f2f5' : '#131923';

    const fg = light ? '#1b2636' : '#f1f4fa';
    const muted = light ? '#647186' : '#99a7bb';
    const border = light ? '#d4dbe5' : '#344154';
    const ink = light
        ? mixColor(accent, '#1d2a40', 0.65)
        : luminance(accent) < 0.15
            ? mixColor(accent, '#dde8fa', 0.6)
            : accent;
    const onAccent = contrastColor(accent);
    const surface = light ? '#fafbfe' : '#1c2635';

    const heading = design.title.trim() || activeRepo.name;
    const description = design.description.trim() || activeRepo.description;
    const owner = design.showOwner ? `${activeRepo.owner} /` : '';
    const footer = design.footer.trim() || `github.com/${activeRepo.fullName}`;

    // Embed font if requested
    const fontStyle = embedFont && fontData
        ? `<style>@font-face{font-family:Manrope;src:url(data:font/ttf;base64,${fontData}) format('truetype');font-weight:200 800}</style>`
        : '';

    // SVG Definitions (gradients, patterns, clip paths)
    let svg = `<defs>
        <radialGradient id="glow1"><stop stop-color="${accent}" stop-opacity="${light ? '.42' : '.27'}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
        <radialGradient id="glow2"><stop stop-color="${secondary}" stop-opacity="${light ? '.33' : '.32'}"/><stop offset="1" stop-color="${secondary}" stop-opacity="0"/></radialGradient>
        <linearGradient id="releaseGlow" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
        <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="${fg}" opacity=".13"/></pattern>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" stroke="${ink}" stroke-opacity=".12" fill="none"/></pattern>
        <clipPath id="bounds"><rect width="1280" height="${H}"/></clipPath>
    </defs>`;

    // Base background
    svg += rect(0, 0, 1280, H, bg);

    // Template-specific glows
    if (design.template === 'aurora' || design.template === 'release') {
        svg += `<ellipse cx="1120" cy="100" rx="670" ry="500" fill="url(#glow1)"/>`;
        svg += `<ellipse cx="1030" cy="${H - 40}" rx="530" ry="380" fill="url(#glow2)"/>`;
    }

    // Template-specific textures
    if (design.texture && ['aurora', 'editorial', 'blueprint', 'bento', 'terminal', 'release'].includes(design.template)) {
        svg += rect(0, 0, 1280, H, `url(#${design.template === 'blueprint' ? 'grid' : 'dots'})`);
        if (design.template === 'aurora') {
            svg += `<g opacity=".14">${motif(1020, square ? 570 : 315, ink, square ? 240 : 190, 'flower')}</g>`;
        }
        if (design.template === 'blueprint') {
            svg += `<g opacity=".7">${motif(996, square ? 615 : 306, ink, square ? 260 : 178)}</g>`;
            svg += `<path d="M790 306H1220M996 92V480" stroke="${ink}" opacity=".14"/>`;
            svg += `<circle cx="1102" cy="185" r="7" fill="${ink}"/>`;
        }
    }

    // Common layout components
    const identity = (x = 64, y = 70) =>
        (design.showMark ? github(x, y - 25, 30, fg) : '') +
        text(owner, x + (design.showMark ? 44 : 0), y - 2, 21, muted, 500);

    const releaseBadge = () => {
        const label = activeRepo.archived
            ? 'ARCHIVED'
            : design.showRelease && activeRepo.release
                ? `LATEST  ${activeRepo.release.tag}`
                : 'PUBLIC REPOSITORY';
        const safe = wrapText(label, 290, 13, 1, 600)[0];
        const w = measure(safe, 13, 600) + safe.length + 34;
        return (
            rect(1216 - w, 42, w, 35, 'transparent', 18, border) +
            text(safe, 1233 - w, 65, 13, muted, 600, 'letter-spacing="1"')
        );
    };

    const commonFooter = () => {
        let s = line(64, H - 80, 1216, H - 80, border, 0.65);
        s += text(wrapText(footer, 750, 16, 1)[0] || '', 64, H - 40, 16, muted, 500);
        const licenseLabel = /license/i.test(activeRepo.license)
            ? activeRepo.license.toUpperCase()
            : `${activeRepo.license} LICENSE`;
        if (design.showLicense && activeRepo.license) {
            s += text(
                wrapText(licenseLabel, 235, 13, 1)[0],
                1216,
                H - 40,
                13,
                muted,
                500,
                'text-anchor="end" letter-spacing="1"'
            );
        }
        return s;
    };

    // Template-specific layouts
    if (['aurora', 'blueprint'].includes(design.template)) {
        svg += identity() + releaseBadge();
        const top = square ? 228 : 163;
        const titleWidth = 820;
        svg += text(design.eyebrow, 64, top, 13, ink, 700, 'letter-spacing="3"');
        const titleResult = title(heading, 60, top + 110, titleWidth, 105, fg, design.titleSize, 2, square ? top + 245 : 320);
        svg += titleResult.svg;
        const descY = titleResult.bottom + (square ? 78 : 54);
        svg += multiline(description, 64, descY, 800, square ? 30 : 25, muted, 2);
        if (design.showTopics) {
            svg += pills(activeRepo.topics, 64, descY + (square ? 124 : 82), muted, border, 1060);
        }
        if (design.showStats) {
            svg += statRow(activeRepo, 64, H - 128, fg, muted);
        }
        if (design.showLanguages && activeRepo.languages.length) {
            const lang = activeRepo.languages[0];
            svg += `<circle cx="${design.showStats ? 584 : 69}" cy="${H - 135}" r="5" fill="${LANG_COLORS[lang.name] || ink}"/>`;
            svg += text(lang.name, design.showStats ? 600 : 85, H - 128, 17, muted);
        }
        svg += commonFooter();
    } else if (design.template === 'editorial') {
        svg += identity() + releaseBadge();
        const top = square ? 232 : 166;
        svg += text(design.eyebrow, 64, top, 12, muted, 700, 'letter-spacing="2"');
        const result = title(heading, 57, top + 128, square ? 1100 : 850, 139, fg, design.titleSize, 2, square ? 447 : 324);
        svg += result.svg;
        svg += multiline(description, 64, result.bottom + 59, square ? 1100 : 820, 25, muted, 2);
        if (design.showTopics) {
            svg += pills(activeRepo.topics, 64, square ? 582 : 467, muted, border, square ? 1100 : 820);
        }
        if (design.texture) {
            const px = square ? 64 : 974;
            const py = square ? 648 : 157;
            const pw = square ? 1152 : 242;
            const ph = square ? 329 : 315;
            svg += rect(px, py, pw, ph, accent);
            svg += text('BUILT IN THE OPEN', px + 23, py + 34, 11, onAccent, 700, 'letter-spacing="1.5"');
            svg += `<g opacity=".7">${motif(px + pw / 2, py + ph / 2, onAccent, square ? 135 : 104, 'flower')}</g>`;
            svg += text('Ideas become possibilities. ↗', px + 23, py + ph - 22, square ? 17 : 10, onAccent);
        }
        if (design.showStats) {
            svg += statRow(activeRepo, 64, H - 128, fg, muted);
        }
        if (design.showLanguages && activeRepo.languages.length) {
            svg += text(activeRepo.languages[0].name, design.showStats ? 584 : 64, H - 128, 17, muted);
        }
        svg += commonFooter();
    } else if (design.template === 'bento') {
        svg += identity() + releaseBadge();
        const top = square ? 193 : 155;
        const leftWidth = square ? 1090 : 610;
        svg += text(design.eyebrow, 64, top, 12, ink, 700, 'letter-spacing="2"');
        const result = title(heading, 62, top + 92, leftWidth, 83, fg, design.titleSize, 2, square ? 340 : 280);
        svg += result.svg;
        svg += multiline(description, 64, result.bottom + 52, leftWidth - 10, 23, muted, square ? 3 : 2);
        if (design.showTopics) {
            svg += pills(activeRepo.topics, 64, square ? 495 : 423, muted, border, leftWidth);
        }
        const bx = square ? 64 : 720;
        const by = square ? 580 : 139;
        const bw = square ? 546 : 238;
        const bh = square ? 180 : 155;
        if (design.showStats) {
            const metric = (label, value, x, y, fill, main) =>
                rect(x, y, bw, bh, fill, 18, border) +
                text(label, x + 25, y + 40, 14, main ? onAccent : muted, 600, 'letter-spacing="1"') +
                text(value, x + 23, y + (square ? 133 : 116), 54, main ? onAccent : fg, 700, 'letter-spacing="-2"');
            svg += metric('GITHUB STARS', fmt(activeRepo.stars), bx, by, accent, true);
            svg += metric('FORKS', fmt(activeRepo.forks), bx + bw + 16, by, surface, false);
        }
        const detailY = by + (design.showStats ? bh + 16 : 0);
        svg += rect(bx, detailY, bw * 2 + 16, square ? 187 : 148, surface, 18, border);
        if (design.showLanguages && activeRepo.languages.length) {
            svg += text('UNDER THE HOOD', bx + 25, detailY + 34, 12, muted, 600, 'letter-spacing="1.5"');
            svg += languageBar(activeRepo.languages, bx + 25, detailY + 64, bw * 2 - 34, muted);
        } else {
            svg += text('DEFAULT BRANCH', bx + 25, detailY + 38, 12, muted, 600);
            svg += text(activeRepo.branch, bx + 25, detailY + 91, 28, fg, 700);
        }
        if (activeRepo.contributors.length) {
            svg += text(`Made together · ${activeRepo.contributors.slice(0, 3).map((c) => c.login).join(', ')}`, 64, H - 121, 15, muted);
        } else {
            svg += text(`Last push · ${formatDate(activeRepo.updated)}`, 64, H - 121, 15, muted);
        }
        svg += commonFooter();
    } else if (design.template === 'terminal') {
        svg += rect(44, 34, 1192, H - 68, light ? '#fafbff' : '#10151d', 15, border);
        svg += `<circle cx="76" cy="62" r="6" fill="#ff837c"/><circle cx="97" cy="62" r="6" fill="#f5ce72"/><circle cx="118" cy="62" r="6" fill="#91dba2"/>`;
        svg += text(`${design.showOwner ? activeRepo.owner + '/' : ''}${activeRepo.name} — ${activeRepo.branch}`, 640, 68, 15, muted, 500, 'text-anchor="middle"');
        svg += line(45, 90, 1235, 90, border);
        svg += '<g font-family="Consolas, Courier New, monospace">';
        const top = square ? 194 : 143;
        svg += text('❯', 78, top, 24, ink);
        svg += text(wrapText(`git clone https://github.com/${activeRepo.fullName}.git`, 1090, 20, 1, 500, true)[0], 110, top, 20, muted);
        const result = title(heading, 76, top + 94, 1110, 66, ink, design.titleSize, 2, square ? 430 : 285);
        svg += result.svg;
        svg += multiline(description, 78, result.bottom + 47, 1090, 22, muted, 2, 500, true);
        let nextY = result.bottom + (square ? 154 : 120);
        if (design.showStats) {
            svg += text(`★ ${fmt(activeRepo.stars)} stars    ⑂ ${fmt(activeRepo.forks)} forks    ◉ ${fmt(activeRepo.issues)} open issues`, 78, nextY, 20, fg);
            nextY += 40;
        }
        if (design.showLanguages && activeRepo.languages.length) {
            svg += text(wrapText(`stack: ${activeRepo.languages.map((lang) => lang.name).join(' · ')}`, 1070, 18, 1, 500, true)[0], 78, nextY, 18, muted);
            nextY += 36;
        }
        if (design.showTopics && activeRepo.topics.length && (square || nextY < H - 160)) {
            svg += text(wrapText(`topics: ${activeRepo.topics.join(', ')}`, 1070, 17, 1, 500, true)[0], 78, nextY, 17, muted);
        }
        const status = activeRepo.archived
            ? 'archived repository'
            : design.showRelease && activeRepo.release
                ? `latest release: ${activeRepo.release.tag}`
                : 'public repository';
        svg += text(status, 78, H - 129, 16, ink);
        svg += text('❯', 78, H - 77, 23, ink);
        svg += rect(104, H - 94, 11, 22, ink, 1);
        svg += text(wrapText(design.footer || design.eyebrow, 755, 14, 1)[0] || '', 130, H - 79, 14, muted);
        if (design.showLicense && activeRepo.license) {
            svg += text(`${activeRepo.license}`, 1197, H - 78, 14, muted, 500, 'text-anchor="end"');
        }
        svg += '</g>';
        if (design.showMark) {
            svg += github(1170, 47, 22, muted);
        }
    } else if (design.template === 'release') {
        svg += identity() + releaseBadge();
        const top = square ? 193 : 155;
        svg += text(design.eyebrow, 64, top, 13, ink, 700, 'letter-spacing="2.5"');
        const result = title(heading, 60, top + 105, square ? 1100 : 760, 100, fg, design.titleSize, 2, square ? 415 : 315);
        svg += result.svg;
        svg += multiline(description, 64, result.bottom + 56, square ? 1050 : 710, 25, muted, 2);
        const boxX = square ? 64 : 870;
        const boxY = square ? 590 : 176;
        const boxW = square ? 1152 : 346;
        const boxH = square ? 370 : 272;
        svg += rect(boxX, boxY, boxW, boxH, 'url(#releaseGlow)', 24);
        svg += text(design.showRelease && activeRepo.release ? 'LATEST RELEASE' : 'READY TO BUILD', boxX + 28, boxY + 47, 13, onAccent, 700, 'letter-spacing="2"');
        const version = design.showRelease && activeRepo.release ? activeRepo.release.tag : '{ }';
        const versionText = title(version, boxX + 25, boxY + (square ? 184 : 145), boxW - 54, square ? 104 : 62, onAccent, 100, 2, Infinity, 'release-version');
        svg += versionText.svg;
        svg += text(design.showRelease && activeRepo.release ? formatDate(activeRepo.release.published) : 'Your next great idea starts here.', boxX + 28, boxY + boxH - 32, 15, onAccent);
        if (design.showStats) {
            svg += statRow(activeRepo, 64, H - 128, fg, muted);
        }
        if (design.showLanguages && activeRepo.languages.length) {
            svg += text(activeRepo.languages[0].name, design.showStats ? 584 : 64, H - 128, 17, muted);
        }
        if (design.showTopics && activeRepo.topics.length && !square && result.bottom < 310) {
            svg += pills(activeRepo.topics, 64, 426, muted, border, 740);
        }
        if (design.showTopics && activeRepo.topics.length && square) {
            svg += pills(activeRepo.topics, 64, 505, muted, border, 1100);
        }
        svg += commonFooter();
    } else {
        // Fallback to composition rendering
        svg += renderComposition(activeRepo, design, {
            H,
            square,
            accent,
            ink,
            onAccent,
            fg,
            muted,
            border,
            surface,
            bg,
            heading,
            description,
            text,
            rect,
            line,
            wrapText,
            statRow,
            languageBar,
            pills,
            identity,
            releaseBadge,
            commonFooter
        });
    }

    // Sequence prefixing to prevent ID collisions in multiple cards
    const prefix = `card${++svgSequence}-`;
    const offset = (77 * 1280) / width;
    const contentHeight = H - offset * 2;
    let artwork = svg;

    // Desktop platform inset rendering
    if (design.platform === 'desktop') {
        const defs = svg.match(/^<defs>[\s\S]*?<\/defs>/)[0];
        const desktop = renderDesktopCard(activeRepo, design, {
            H: contentHeight,
            square,
            bg,
            surface,
            fg,
            muted,
            border,
            ink,
            accent,
            onAccent,
            heading,
            description,
            text,
            rect,
            line,
            wrapText,
            github,
            statRow,
            languageBar,
            pills,
            motif
        }, svg);
        artwork = `${defs}<defs><clipPath id="desktopBounds"><rect width="1280" height="${contentHeight}"/></clipPath></defs>${rect(0, 0, 1280, H, bg)}<g data-platform-inset="77" data-layout-height="${contentHeight}" transform="translate(0 ${offset})" clip-path="url(#desktopBounds)">${desktop}</g>`;
    }

    // Final assembly with ID prefixing
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1280 ${H}" data-platform="${design.platform || 'mobile'}" ${thumbnail ? 'aria-hidden="true"' : `role="img" aria-label="${esc(activeRepo.fullName)} repository card"`}>
        <title>${esc(heading)} — ${esc(activeRepo.fullName)}</title>
        ${fontStyle}
        <g font-family="Manrope, Arial, sans-serif" clip-path="url(#bounds)">${artwork}</g>
    </svg>`;

    // Replace IDs with prefixed versions for uniqueness
    return markup
        .replace(/id="(\w+)"/g, (_, id) => `id="${prefix}${id}"`)
        .replace(/url\(#(\w+)\)/g, (_, id) => `url(#${prefix}${id})`);
}
