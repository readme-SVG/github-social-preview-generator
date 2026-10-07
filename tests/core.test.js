import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DESIGN, FORMATS, TEMPLATES } from '../assets/js/constants.js';
import { normalizeRepository } from '../assets/js/github.js';
import { renderCard, wrapText } from '../assets/js/renderer.js';
import { createDesignLink, readDesignLink, validateDesign, validateProject } from '../assets/js/state.js';
import { contrastColor, escapeXml, fmt, parseInput, randomShowcaseStats, validHex } from '../assets/js/utils.js';

const raw = { name: 'card-studio', full_name: 'octo/card-studio', owner: { login: 'octo' }, description: 'Make something useful.', stargazers_count: 1234, forks_count: 42, open_issues_count: 7, license: { spdx_id: 'MIT' }, default_branch: 'main', topics: ['design', 'svg'] };
const repo = normalizeRepository(raw, { TypeScript: 700, CSS: 200, HTML: 100 }, { tag_name: 'v2.0.0', published_at: '2026-10-01T00:00:00Z' });

test('repository parser accepts real URLs, subpages, shorthand and .git', () => {
    for (const input of ['octo/card-studio', 'https://github.com/octo/card-studio', 'github.com/octo/card-studio/', 'https://github.com/octo/card-studio/tree/main?x=1', 'octo/card-studio.git']) assert.deepEqual(parseInput(input), { owner: 'octo', repo: 'card-studio' });
});
test('repository parser rejects lookalike hosts and ambiguous or unsafe input', () => {
    for (const input of ['', 'octo', 'octo/repo/extra', 'https://evilgithub.com/a/b', 'https://github.com.evil.test/a/b', 'https://user:password@github.com/a/b', 'https://evil.test/github.com/a/b', 'a/..', '../b', 'a/b?x=1', 'a/<script>']) assert.equal(parseInput(input), null, input);
});
test('real metadata is preserved, including zero counts', () => {
    assert.equal(repo.stars, 1234); assert.equal(repo.forks, 42); assert.equal(repo.issues, 7);
    assert.equal(repo.languages[0].percent, 70); assert.equal(repo.release.tag, 'v2.0.0');
    assert.equal(normalizeRepository({ ...raw, stargazers_count: 0, forks_count: 0 }).stars, 0);
});
test('language shares use all code bytes before truncating', () => {
    const r = normalizeRepository(raw, { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 });
    assert.equal(r.languages.length, 5); assert.ok(Math.abs(r.languages[0].percent - 100 / 6) < .00001);
});
test('missing optional metadata has honest fallbacks', () => {
    const r = normalizeRepository({ name: 'x', owner: { login: 'a' }, language: 'Rust' });
    assert.equal(r.release, null); assert.equal(r.license, ''); assert.deepEqual(r.contributors, []);
    assert.deepEqual(r.languages, [{ name: 'Rust', percent: 100 }]);
});
test('text is escaped and counts are compact', () => {
    assert.equal(escapeXml('<script>"&'), '&lt;script&gt;&quot;&amp;');
    assert.equal(fmt(1234), '1.2k'); assert.equal(fmt(1000000), '1m'); assert.equal(fmt(-1), '0');
    assert.equal(validHex('#abcd12'), true); assert.equal(validHex('red;stroke:red'), false);
    assert.equal(escapeXml('a\u0000b\u0007c'), 'abc');
    assert.equal(contrastColor('#000000'), '#f4f7fd'); assert.equal(contrastColor('#ffffff'), '#1d2c42');
});
test('design validation clamps imported fields and excludes prototype properties', () => {
    const d = validateDesign({ template: 'bogus', theme: 'constructor', accent: 'red" onload="alert(1)', titleSize: 9999, format: 'constructor', title: 'x'.repeat(500), showStats: false });
    assert.equal(d.template, 'aurora'); assert.equal(d.theme, 'slate'); assert.equal(d.format, 'github'); assert.equal(d.titleSize, 125); assert.equal(d.title.length, 100); assert.equal(d.showStats, false); assert.equal(d.accent, '#b8c5d8');
});
test('saved projects round trip with repository data', () => {
    const project = validateProject(JSON.parse(JSON.stringify({ version: 1, repository: repo, design: { ...DEFAULT_DESIGN, title: 'Мой проект ✨' } })));
    assert.equal(project.repository.stars, 1234); assert.equal(project.design.title, 'Мой проект ✨');
    assert.throws(() => validateProject({ version: 3, repository: repo }));
    assert.throws(() => validateProject({ version: 1, repository: { fullName: '<bad>' } }));
    const oversized = validateProject({ version: 1, repository: { ...repo, languages: [{ name: 'A', percent: 100 }, { name: 'B', percent: 100 }] } });
    assert.equal(oversized.repository.languages.reduce((sum, lang) => sum + lang.percent, 0), 100);
});
test('Unicode design links round trip and do not include a data snapshot', () => {
    const d = { ...DEFAULT_DESIGN, description: 'Привет, світ! 🚀' };
    const url = createDesignLink('http://localhost:8000/', repo, d);
    const result = readDesignLink(new URL(url).hash);
    assert.equal(result.design.description, d.description); assert.equal(result.repo, repo.fullName);
    assert.equal(readDesignLink('#anything'), null); assert.throws(() => readDesignLink('#design=bad!'));
});
test('all thirty templates render every canvas size with unique SVG references', () => {
    assert.equal(TEMPLATES.length, 30);
    const ids = new Set();
    for (const template of TEMPLATES) for (const [format, size] of Object.entries(FORMATS)) {
        const svg = renderCard(repo, { ...DEFAULT_DESIGN, template: template.id, format });
        assert.ok(svg.includes(`width="${size.width}" height="${size.height}"`));
        assert.ok(!svg.includes('NaN')); assert.ok(!svg.includes('undefined'));
        for (const match of svg.matchAll(/id="([^"]+)"/g)) { assert.ok(!ids.has(match[1])); ids.add(match[1]); }
        for (const match of svg.matchAll(/url\(#([^)]*)\)/g)) assert.ok(svg.includes(`id="${match[1]}"`));
    }
});
test('user text cannot become executable SVG markup', () => {
    const svg = renderCard({ ...repo, topics: ['<script>alert(1)</script>'] }, { ...DEFAULT_DESIGN, title: '<script>alert(1)</script>', description: '<image onload="alert(1)"/>' });
    assert.ok(!svg.includes('<script>')); assert.ok(!svg.includes('<image ')); assert.ok(svg.includes('&lt;script&gt;'));
});
test('content switches remove repository statistics, languages, topics and release', () => {
    for (const template of TEMPLATES) {
        const svg = renderCard(repo, { ...DEFAULT_DESIGN, template: template.id, showStats: false, showLanguages: false, showTopics: false, showRelease: false, showLicense: false });
        assert.ok(!svg.includes('1.5k')); assert.ok(!svg.includes('TypeScript')); assert.ok(!svg.includes('v2.0.0')); assert.ok(!svg.includes('MIT'));
    }
});
test('showcase statistics are random, stable in a design and independent of API counts', () => {
    for (let i = 0; i < 100; i++) {
        const values = randomShowcaseStats();
        assert.ok(values.showcaseStars >= 1000 && values.showcaseStars <= 2000);
        assert.ok(values.showcaseForks >= 300 && values.showcaseForks <= 700);
    }
    const d = { ...DEFAULT_DESIGN, showcaseStars: 1999, showcaseForks: 699 };
    const svg = renderCard(repo, d);
    assert.ok(svg.includes('2k')); assert.ok(svg.includes('699')); assert.equal(repo.stars, 1234);
    const real = renderCard(repo, { ...d, statsMode: 'github' });
    assert.ok(real.includes('1.2k')); assert.ok(real.includes('42'));
    const saved = validateProject({ version: 1, repository: repo, design: d });
    assert.equal(saved.design.showcaseStars, 1999); assert.equal(saved.design.showcaseForks, 699);
});
test('long Unicode text and unbroken words stay bounded', () => {
    const rows = wrapText('оченьдлинноеназваниерепозитория'.repeat(10), 400, 30, 2);
    assert.equal(rows.length, 2); assert.ok(rows[1].endsWith('…'));
    assert.deepEqual(wrapText('', 100, 20), []);
});
