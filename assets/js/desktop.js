import { compositionProfile, seededRandom } from './generator.js';
import { fmt, formatDate } from './utils.js';

// Desktop has a shorter content area, not a scaled copy of the Mobile drawing.
// Keep title typography from Mobile and arrange header, content and footer separately.
export function renderDesktopCard(repo, design, ctx, mobileArtwork) {
    const { H, square, bg, surface, fg, muted, border, ink, accent, onAccent, heading, description,
        text, rect, line, wrapText, github, statRow, languageBar, pills, motif } = ctx;
    const profile = compositionProfile(design);
    const roleTag = (role) => mobileArtwork.match(new RegExp(`<text\\b[^>]*data-role="${role}"[^>]*>`))?.[0] || '';
    const attribute = (tag, key, fallback) => tag.match(new RegExp(`${key}="([^"]+)"`))?.[1] || fallback;
    const titleTag = roleTag('project-title');
    const fontSize = Number(attribute(titleTag, 'font-size', 80));
    const fontWeight = Number(attribute(titleTag, 'font-weight', 800));
    const family = attribute(titleTag, 'font-family', design.template === 'terminal' ? 'Consolas, Courier New, monospace' : 'Manrope, Arial, sans-serif');
    const tracking = attribute(titleTag, 'letter-spacing', '-1.8');
    const mono = family.includes('monospace');
    const bodyTop = 96, footerTop = H - 52, bodyBottom = footerTop - 20;
    const sideKinds = ['split', 'columns', 'quadrant', 'mosaic', 'dossier'];
    const hasSide = !square && (design.template === 'release' || design.template === 'bento' || sideKinds.includes(profile.layout));
    let copyX = 64, copyWidth = 1152, sideX = 888, sideWidth = 328;
    if (!square && design.template === 'bento') { copyWidth = 610; sideX = 720; sideWidth = 492; }
    else if (!square && design.template === 'release') { copyWidth = 760; sideX = 870; sideWidth = 346; }
    else if (hasSide) { copyWidth = 735; sideX = 864; sideWidth = 352; }
    if (profile.layout === 'stacked' || profile.layout === 'capsule' || profile.layout === 'badge') { copyX = 96; copyWidth = square ? 1088 : 760; }
    if (profile.layout === 'frame') { copyX = 92; copyWidth = 1096; }

    let svg = rect(0, 0, 1280, H, bg);
    if (profile.background === 'mesh' || ['aurora', 'release'].includes(design.template)) svg += `<ellipse cx="1120" cy="100" rx="640" ry="370" fill="url(#glow1)"/><ellipse cx="1040" cy="${H}" rx="540" ry="360" fill="url(#glow2)"/>`;
    if (design.texture && (profile.background === 'grid' || design.template === 'blueprint')) svg += rect(0, 70, 1280, H - 122, 'url(#grid)');
    if (design.texture && profile.background === 'dots') svg += rect(0, 70, 1280, H - 122, 'url(#dots)');
    if (design.texture && profile.background === 'diagonal') for (let x = -H; x < 1280; x += 35) svg += line(x, 70, x + H, footerTop, border, .25);
    if (profile.layout === 'frame') svg += rect(24, 82, 1232, H - 148, 'none', design.corner, border);
    if (profile.layout === 'stacked') {
        svg += rect(76, 90, 1128, H - 165, surface, design.corner, border);
        svg += rect(64, 80, 1128, H - 165, bg, design.corner, border);
    }
    if (profile.layout === 'capsule' || profile.layout === 'badge') svg += rect(52, 80, 1176, H - 150, surface, Math.max(36, design.corner), border);
    if (profile.layout === 'stripe') svg += rect(1172, 86, 44, H - 160, accent, design.corner);
    if (profile.layout === 'diagonal') svg += `<path d="M975 70H1280V${footerTop}H855Z" fill="${accent}" fill-opacity=".10"/>`;

    const random = seededRandom(design.seed);
    if (design.texture && !hasSide && profile.decoration !== 'none') {
        const cy = square ? H * .62 : 253;
        svg += `<g opacity=".10">${motif(1080, cy, ink, 176, profile.decoration === 'flower' ? 'flower' : 'orbit')}</g>`;
        if (profile.decoration === 'tiles') {
            svg += '<g opacity=".14">';
            for (let i = 0; i < 12; i++) svg += rect(950 + i % 4 * 62, cy - 86 + Math.floor(i / 4) * 62, 48, 48, random() > .5 ? accent : 'none', design.corner, border);
            svg += '</g>';
        }
    }

    // Full-width header and footer stay inside the content area, including all metadata.
    svg += '<g data-region="header">' + rect(0, 0, 1280, 70, surface) + line(0, 70, 1280, 70, border);
    if (design.showMark) svg += github(28, 20, 30, fg);
    const path = design.showOwner ? repo.fullName : repo.name;
    svg += text(wrapText(path, design.showStats ? 655 : 1060, 21, 1)[0], design.showMark ? 76 : 28, 45, 21, muted);
    if (design.showStats) svg += statRow(repo, 820, 45, fg, muted);
    svg += '</g>';

    let bodySvg = text(design.eyebrow, copyX, bodyTop + 10, 11, ink, 600, 'letter-spacing="2"');
    const titleRows = wrapText(heading, copyWidth - 35, fontSize, 2, fontWeight, mono, family);
    const firstBaseline = bodyTop + 34 + fontSize * .82;
    bodySvg += titleRows.map((row, i) => text(row, copyX, firstBaseline + i * fontSize * 1.12, fontSize, fg, fontWeight, `data-role="project-title" font-family="${family}" letter-spacing="${tracking}"`)).join('');
    let last = firstBaseline + (titleRows.length - 1) * fontSize * 1.12;
    const descSize = Number(attribute(roleTag('repo-description'), 'font-size', 22));
    const descLineHeight = descSize * 1.5;
    const descBaseline = last + 30;
    const descriptionRoom = bodyBottom - descBaseline - (design.showTopics && repo.topics.length ? 48 : 0);
    const maxDescLines = Math.max(1, Math.min(square ? 4 : 3, Math.floor(descriptionRoom / descLineHeight) + 1));
    const descriptionRows = description ? wrapText(description, copyWidth, descSize, maxDescLines, 500, design.template === 'terminal', design.template === 'terminal' ? 'Consolas, Courier New, monospace' : '') : [];
    bodySvg += descriptionRows.map((row, i) => text(row, copyX, descBaseline + i * descLineHeight, descSize, muted, 500, `data-role="repo-description" ${design.template === 'terminal' ? 'font-family="Consolas, Courier New, monospace"' : ''}`)).join('');
    if (descriptionRows.length) last = descBaseline + (descriptionRows.length - 1) * descLineHeight;
    if (design.showTopics && repo.topics.length && last + 51 < footerTop - 10) {
        bodySvg += pills(repo.topics, copyX, last + 45, muted, border, copyWidth);
        last += 51;
    }

    const metrics = (x, y, w, h, solid = false) => {
        let s = rect(x, y, w, h, solid ? accent : surface, design.corner, solid ? 'none' : border);
        const color = solid ? onAccent : fg, sub = solid ? onAccent : muted;
        s += text(design.showStats ? 'STARS / FORKS' : 'DEFAULT BRANCH', x + 22, y + 30, 11, sub, 600, 'letter-spacing="1"');
        s += text(wrapText(design.showStats ? `${fmt(repo.stars)} / ${fmt(repo.forks)}` : repo.branch, w - 44, 32, 1, 700)[0], x + 22, y + 79, 32, color, 700);
        if (design.showLanguages && repo.languages.length) s += languageBar(repo.languages, x + 22, y + h - 60, w - 44, sub);
        return s;
    };
    if (design.template === 'release') {
        const x = square ? 64 : sideX, y = square ? Math.max(last + 55, H * .52) : 100;
        const versionWidth = square ? 1152 : sideWidth, versionHeight = square ? 370 : 272;
        const versionTag = roleTag('release-version');
        const versionSize = Number(attribute(versionTag, 'font-size', 62));
        const version = design.showRelease && repo.release ? repo.release.tag : '{ }';
        svg += rect(x, y, versionWidth, versionHeight, 'url(#releaseGlow)', 24);
        svg += text(design.showRelease && repo.release ? 'LATEST RELEASE' : 'READY TO BUILD', x + 28, y + 47, 13, onAccent, 700, 'letter-spacing="2"');
        svg += wrapText(version, versionWidth - 54, versionSize, 2, 800).map((row, i) => text(row, x + 25, y + (square ? 184 : 145) + i * versionSize * 1.13, versionSize, onAccent, 800, 'data-role="release-version"')).join('');
        svg += text(repo.release && design.showRelease ? formatDate(repo.release.published) : 'Your next great idea starts here.', x + 28, y + versionHeight - 32, 15, onAccent);
    } else if (design.template === 'bento' && !square) {
        const metric = (label, value, x, solid) => rect(x, 92, 238, 155, solid ? accent : surface, 18, border) + text(label, x + 25, 132, 14, solid ? onAccent : muted, 600) + text(value, x + 23, 208, 54, solid ? onAccent : fg, 700);
        if (design.showStats) svg += metric('GITHUB STARS', fmt(repo.stars), 720, true) + metric('FORKS', fmt(repo.forks), 974, false);
        svg += rect(720, design.showStats ? 263 : 92, 492, 148, surface, 18, border);
        const y = design.showStats ? 263 : 92;
        svg += text(design.showLanguages ? 'UNDER THE HOOD' : 'DEFAULT BRANCH', 745, y + 34, 12, muted, 600);
        if (design.showLanguages && repo.languages.length) svg += languageBar(repo.languages, 745, y + 64, 442, muted);
        else svg += text(repo.branch, 745, y + 91, 28, fg, 700);
    } else if (hasSide) {
        svg += metrics(sideX, 96, sideWidth, Math.min(291, H - 174), profile.layout === 'quadrant' || profile.layout === 'mosaic');
    } else {
        const available = footerTop - last - 35;
        if (available >= 95) {
            const y = Math.max(last + 28, footerTop - (square ? 170 : 116));
            const boxes = [
                ['OVERVIEW', `Updated ${formatDate(repo.updated)}`],
                [design.showLanguages ? 'TECH STACK' : 'DEFAULT BRANCH', design.showLanguages && repo.languages.length ? repo.languages.map(l => l.name).join(', ') : repo.branch],
                ['DETAILS', design.showRelease && repo.release ? repo.release.tag : `Branch: ${repo.branch}`],
            ];
            boxes.forEach(([label, value], i) => {
                const x = copyX + i * 365;
                svg += rect(x, y, 345, 82, profile.layout === 'mosaic' || profile.layout === 'stacked' ? surface : 'none', design.corner, border);
                svg += text(label, x + 18, y + 27, 11, ink, 600, 'letter-spacing="1.5"');
                svg += text(wrapText(value, 309, 17, 1)[0], x + 18, y + 57, 17, muted);
            });
        }
    }
    svg += bodySvg;
    svg += '<g data-region="footer">' + rect(0, footerTop, 1280, 52, surface) + line(0, footerTop, 1280, footerTop, border);
    const footer = design.footer.trim() || `github.com/${repo.fullName}`;
    svg += text(wrapText(footer, 740, 16, 1)[0], 32, H - 21, 16, muted);
    if (design.showLanguages && repo.languages.length) svg += text(wrapText(repo.languages[0].name, 200, 15, 1)[0], 830, H - 21, 15, muted);
    if (design.showLicense && repo.license) svg += text(wrapText(repo.license, 200, 13, 1)[0], 1248, H - 21, 13, muted, 500, 'text-anchor="end"');
    svg += '</g>';
    return svg;
}
