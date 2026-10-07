import { compositionProfile, seededRandom } from './generator.js';
import { fmt } from './utils.js';

// Shared layout primitives compose real content inside reserved, non-overlapping regions.
export function renderComposition(repo, design, ctx) {
    const { H, square, accent, ink, onAccent, fg, muted, border, surface, bg, heading, description,
        text, rect, line, wrapText, statRow, languageBar, pills, identity, releaseBadge, commonFooter } = ctx;
    const profile = compositionProfile(design);
    const salt = Array.from(design.template).reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0), 0);
    const random = seededRandom(design.seed + (design.template === 'generated' ? 0 : salt));
    const corner = design.corner;
    const font = profile.typography === 'serif' ? 'Georgia, Times New Roman, serif' : profile.typography === 'mono' ? 'Consolas, Courier New, monospace' : 'Manrope, Arial, sans-serif';
    const copy = (x, y, w, h, base = 96, color = fg, center = false) => {
        const hasTopics = design.showTopics && repo.topics.length;
        const available = h - 42 - (description ? 72 : 0) - (hasTopics ? 48 : 0);
        let size = base * design.titleSize / 100;
        if (design.spacing === 'airy') size *= .92;
        if (design.spacing === 'compact') size *= 1.05;
        const width = w - (profile.typography === 'wide' ? 85 : 0);
        const rowsAt = (s) => wrapText(heading, width, s, 100, 800, profile.typography === 'mono', font);
        while (size > 28 && (rowsAt(size).length > 2 || rowsAt(size).length * size * 1.12 > available)) size -= 2;
        const rows = wrapText(heading, width, size, 2, 800, profile.typography === 'mono', font);
        const anchor = center ? x + w / 2 : x;
        const align = center ? 'text-anchor="middle"' : '';
        let s = text(design.eyebrow, anchor, y + 12, 11, ink, 600, `${align} letter-spacing="2"`);
        const firstBaseline = y + 44 + size * .82;
        s += rows.map((row, i) => text(row, anchor, firstBaseline + i * size * 1.12, size, color, profile.typography === 'serif' ? 600 : 800, `${align} font-family="${font}" letter-spacing="${profile.typography === 'wide' ? '1' : '-1.8'}"`)).join('');
        let last = firstBaseline + (rows.length - 1) * size * 1.12;
        if (description) {
            const descRows = wrapText(description, w, 22, 2, 500);
            s += descRows.map((row, i) => text(row, anchor, last + 42 + i * 32, 22, muted, 500, align)).join('');
            last += 42 + (descRows.length - 1) * 32;
        }
        if (hasTopics) s += pills(repo.topics, x, last + 48, muted, border, w);
        return s;
    };
    const stats = (x = 64, y = H - 127) => {
        let s = design.showStats ? statRow(repo, x, y, fg, muted) : '';
        if (design.showLanguages && repo.languages.length) s += text(repo.languages[0].name, x + (design.showStats ? 480 : 0), y, 17, muted);
        return s;
    };
    const info = (x, y, w, h, solid = false) => {
        let s = rect(x, y, w, h, solid ? accent : surface, corner, solid ? 'none' : border);
        const main = solid ? onAccent : fg, sub = solid ? onAccent : muted;
        s += text(design.showStats ? 'STARS / FORKS' : 'REPOSITORY / BRANCH', x + 24, y + 36, 11, sub, 600, 'letter-spacing="1.5"');
        const value = design.showStats ? `${fmt(repo.stars)} / ${fmt(repo.forks)}` : repo.branch;
        let valueSize = 36;
        while (valueSize > 16 && wrapText(value, w - 48, valueSize, 100, 700).length > 1) valueSize -= 2;
        s += text(wrapText(value, w - 48, valueSize, 1, 700)[0] || '', x + 24, y + 96, valueSize, main, 700);
        if (design.showLanguages && repo.languages.length && h >= 160) s += languageBar(repo.languages, x + 24, y + h - 61, w - 48, sub);
        return s;
    };
    const ornament = (cx, cy, r, color = ink, type = profile.decoration) => {
        if (!design.texture || type === 'none') return '';
        const spin = Math.floor(random() * 90), shift = random() * 22 - 11;
        let s = '';
        if (type === 'rings' || type === 'arcs' || type === 'eclipse') {
            const n = type === 'eclipse' ? 2 : 7;
            for (let i = 0; i < n; i++) s += `<circle cx="${cx + (type === 'arcs' ? i * 12 : shift)}" cy="${cy + shift}" r="${r * (1 - i * .1)}" fill="${type === 'eclipse' && i === 0 ? color : 'none'}" fill-opacity=".1" stroke="${color}" stroke-opacity="${.65 - i * .06}" stroke-width="${i === 0 ? 2 : 1}"/>`;
            if (type === 'eclipse') s += `<circle cx="${cx + r * .36}" cy="${cy - r * .15}" r="${r * .85}" fill="${bg}"/>`;
        } else if (type === 'orbit' || type === 'flower') {
            const n = type === 'flower' ? 12 : 4;
            for (let i = 0; i < n; i++) s += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * (type === 'flower' ? .26 : .35)}" fill="none" stroke="${color}" stroke-width="1.5" transform="rotate(${i * 180 / n + spin} ${cx} ${cy})"/>`;
            s += `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}"/>`;
        } else if (type === 'tiles') {
            const gap = 9, size = (r * 2 - gap * 3) / 4;
            for (let i = 0; i < 16; i++) {
                const a = random();
                s += rect(cx - r + (i % 4) * (size + gap), cy - r + Math.floor(i / 4) * (size + gap), size, size, a > .5 ? color : 'none', a > .7 ? size / 2 : corner / 2, color);
            }
        } else if (type === 'prism') {
            for (let i = 0; i < 6; i++) s += `<path d="M${cx - r + i * 15} ${cy + r * .55} ${cx + shift} ${cy - r + i * 11} ${cx + r - i * 13} ${cy + r * .55}Z" fill="${i === 0 ? color : 'none'}" fill-opacity=".08" stroke="${color}" stroke-width="1.5"/>`;
        } else if (type === 'wave' || type === 'ribbon' || type === 'contour') {
            const n = type === 'ribbon' ? 6 : 14;
            for (let i = 0; i < n; i++) {
                const dy = (i - n / 2) * 12;
                s += `<path d="M${cx - r} ${cy + dy}C${cx - r / 2} ${cy - r + dy + shift} ${cx + r / 2} ${cy + r + dy} ${cx + r} ${cy + dy}" fill="none" stroke="${color}" stroke-opacity="${.35 + i / n * .55}" stroke-width="${type === 'ribbon' ? 6 : 1.5}"/>`;
            }
        }
        return `<g>${s}</g>`;
    };
    let svg = '';
    if (profile.background === 'mesh') svg += `<ellipse cx="1080" cy="${H * .28}" rx="640" ry="430" fill="url(#glow1)"/><ellipse cx="150" cy="${H}" rx="590" ry="400" fill="url(#glow2)"/>`;
    if (design.texture && ['grid', 'dots'].includes(profile.background)) svg += rect(0, 0, 1280, H, `url(#${profile.background})`);
    if (design.texture && profile.background === 'diagonal') {
        for (let i = -H; i < 1280; i += 35) svg += line(i, 0, i + H, H, border, .45);
    }
    if (design.texture && profile.background === 'halftone') {
        for (let x = 750; x < 1280; x += 24) for (let y = 100; y < H - 80; y += 24) svg += `<circle cx="${x}" cy="${y}" r="${(x - 730) / 140}" fill="${ink}" opacity=".16"/>`;
    }
    const artX = square ? 640 : 1042, artY = square ? 830 : 302;
    const copyTop = square ? 194 : 138;
    const copyHeight = square ? 360 : H - 300;
    let embeddedStats = false;
    switch (profile.layout) {
        case 'poster':
            svg += copy(64, copyTop, square ? 1152 : 945, copyHeight, 130);
            svg += `<g opacity=".32">${ornament(square ? 640 : 1170, square ? 826 : 285, square ? 224 : 161)}</g>`;
            break;
        case 'split':
            svg += rect(square ? 64 : 844, square ? 620 : 129, square ? 1152 : 372, square ? 370 : H - 241, surface, corner, border);
            svg += copy(64, copyTop, square ? 1152 : 710, copyHeight, 103);
            svg += ornament(square ? 640 : 1030, square ? 788 : H * .46, square ? 148 : 129);
            break;
        case 'stacked':
            svg += rect(76, square ? 185 : 119, 1128, square ? 410 : H - 293, surface, corner, border);
            svg += rect(64, square ? 170 : 105, 1128, square ? 410 : H - 293, bg, corner, border);
            svg += copy(96, square ? 202 : 138, square ? 1058 : 760, square ? 355 : H - 320, 88);
            svg += ornament(square ? 640 : 1064, square ? 823 : 291, square ? 187 : 95);
            if (square) { svg += info(64, 924, 1152, 180); embeddedStats = true; }
            break;
        case 'orbital':
            svg += copy(64, copyTop, square ? 1152 : 740, copyHeight, 108);
            svg += ornament(artX, artY, square ? 221 : 163);
            svg += `<path d="M${artX - 202} ${artY}H${artX + 202}M${artX} ${artY - 210}V${artY + 210}" stroke="${border}" stroke-dasharray="4 8"/>`;
            break;
        case 'frame':
            svg += rect(28, 25, 1224, H - 50, 'none', corner, ink);
            svg += rect(39, 36, 1202, H - 72, 'none', corner, border);
            svg += copy(95, square ? 221 : 143, square ? 1090 : 890, copyHeight - 10, 108);
            svg += ornament(square ? 640 : 1133, square ? 841 : 332, square ? 199 : 74);
            break;
        case 'columns':
            svg += line(square ? 640 : 846, square ? 635 : 138, square ? 640 : 846, H - 105, border);
            svg += copy(64, copyTop, square ? 1152 : 718, copyHeight, 110);
            const columnY = square ? 683 : 164;
            svg += info(square ? 64 : 888, columnY, square ? 548 : 328, square ? 285 : 291, false);
            svg += ornament(square ? 931 : 1052, square ? 822 : columnY + 163, square ? 125 : 37);
            embeddedStats = true;
            break;
        case 'diagonal':
            svg += `<path d="${square ? 'M0 630 1280 530V1110H0Z' : `M902 120H1280V${H - 104}H764Z`}" fill="${accent}" fill-opacity=".13"/>`;
            svg += copy(64, copyTop, square ? 1152 : 719, copyHeight, 101);
            svg += ornament(square ? 640 : 1064, square ? 816 : 306, square ? 236 : 147);
            break;
        case 'network':
            svg += copy(64, copyTop, square ? 1152 : 720, copyHeight, 96);
            const nodes = Array.from({ length: 11 }, () => [artX + (random() - .5) * (square ? 655 : 318), artY + (random() - .5) * 340]);
            if (design.texture) nodes.forEach(([x, y], i) => {
                if (i) svg += line(x, y, nodes[Math.max(0, i - 2)][0], nodes[Math.max(0, i - 2)][1], ink, .4);
                svg += `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 10 : 5}" fill="${i % 3 ? bg : accent}" stroke="${ink}"/>`;
            });
            svg += ornament(artX, artY, 129);
            break;
        case 'dossier':
            svg += line(64, 103, 1216, 103, border);
            svg += text('REPOSITORY / INDEX', 64, 137, 11, ink, 600, 'letter-spacing="2"');
            svg += copy(64, square ? 224 : 171, square ? 1152 : 735, square ? 360 : H - 321, 82);
            svg += info(square ? 64 : 864, square ? 700 : 173, square ? 1152 : 352, square ? 290 : 274);
            embeddedStats = true;
            break;
        case 'capsule':
            svg += rect(52, 119, 1176, H - 224, surface, Math.max(36, corner), border);
            svg += copy(90, square ? 194 : 147, square ? 1095 : 763, square ? 360 : H - 317, 95);
            svg += ornament(square ? 640 : 1073, square ? 858 : 305, square ? 215 : 109);
            break;
        case 'banner':
            svg += rect(0, 100, 1280, square ? 415 : 226, accent);
            // The title-only banner leaves the detailed copy in a separate, quieter area.
            let bannerSize = 74 * design.titleSize / 100;
            const bannerRows = (size) => wrapText(heading, 1090, size, 100, 800, profile.typography === 'mono', font);
            while (bannerSize > 30 && (bannerRows(bannerSize).length > 2 || bannerRows(bannerSize).length * bannerSize * 1.12 > (square ? 350 : 164))) bannerSize -= 2;
            const bannerTitle = wrapText(heading, 1090, bannerSize, 2, 800, profile.typography === 'mono', font);
            svg += bannerTitle.map((row, i) => text(row, 64, 142 + bannerSize * .82 + i * bannerSize * 1.12, bannerSize, onAccent, 800, `font-family="${font}" letter-spacing="-2"`)).join('');
            svg += text(design.eyebrow, 64, square ? 564 : 360, 12, ink, 600, 'letter-spacing="2"');
            svg += wrapText(description, 1050, 22, 2).map((row, i) => text(row, 64, (square ? 621 : 400) + i * 30, 22, muted)).join('');
            if (design.showTopics) svg += pills(repo.topics, 64, square ? 733 : 471, muted, border, 1110);
            if (square) svg += ornament(640, 916, 140);
            break;
        case 'wave':
            svg += copy(64, copyTop, 1152, copyHeight - 18, 103);
            svg += `<g opacity=".22">${ornament(640, square ? 894 : H - 171, square ? 470 : 558, ink, 'wave')}</g>`;
            break;
        case 'quadrant':
            svg += line(64, square ? 603 : 111, 1216, square ? 603 : 111, border);
            svg += line(square ? 640 : 839, square ? 603 : 111, square ? 640 : 839, H - 105, border);
            svg += copy(64, copyTop, square ? 1152 : 705, copyHeight, 93);
            svg += info(square ? 64 : 871, square ? 643 : 144, square ? 548 : 345, square ? 331 : 304, true);
            if (square) svg += ornament(930, 803, 151);
            embeddedStats = true;
            break;
        case 'stripe':
            svg += rect(square ? 0 : 1132, square ? 689 : 109, square ? 1280 : 84, square ? 180 : H - 216, accent);
            svg += copy(64, copyTop, square ? 1152 : 958, copyHeight, 113);
            svg += ornament(square ? 640 : 1158, square ? 785 : 302, square ? 139 : 84, onAccent);
            break;
        case 'mosaic':
            svg += copy(64, copyTop, square ? 1152 : 657, copyHeight, 94);
            const mx = square ? 64 : 798, my = square ? 641 : 137, mw = square ? 565 : 195;
            svg += info(mx, my, mw, 170, true);
            svg += rect(mx + mw + 14, my, mw, 170, surface, corner, border);
            svg += ornament(mx + mw * 1.5 + 14, my + 86, mw * .33);
            svg += rect(mx, my + 185, mw * 2 + 14, 128, surface, corner, border);
            svg += text('BUILT WITH', mx + 23, my + 216, 11, muted, 600, 'letter-spacing="1"');
            if (design.showLanguages && repo.languages.length) svg += languageBar(repo.languages, mx + 23, my + 241, mw * 2 - 31, muted);
            else svg += text(repo.branch, mx + 23, my + 264, 23, fg);
            embeddedStats = true;
            break;
        case 'badge':
            svg += rect(73, 123, 1134, H - 234, surface, Math.max(corner, 32), border);
            svg += copy(115, square ? 205 : 144, square ? 1050 : 740, square ? 360 : H - 319, 93);
            svg += ornament(square ? 640 : 1060, square ? 836 : 309, square ? 206 : 92);
            svg += text('OPEN SOURCE', square ? 640 : 1060, square ? 1100 : 435, 11, ink, 600, 'text-anchor="middle" letter-spacing="3"');
            break;
        default: throw new Error('Unknown composition layout');
    }
    svg += identity() + releaseBadge();
    if (!embeddedStats) svg += stats();
    else if (design.showLanguages && repo.languages.length) svg += text(repo.languages[0].name, 64, H - 127, 17, muted);
    svg += commonFooter();
    return svg;
}
