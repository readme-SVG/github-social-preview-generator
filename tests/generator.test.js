import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DESIGN, FORMATS, LAYOUTS, TEMPLATES } from '../assets/js/constants.js';
import { compositionProfile, generateDesign, seededRandom } from '../assets/js/generator.js';
import { renderCard } from '../assets/js/renderer.js';
import { createDesignLink, readDesignLink, validateDesign, validateProject } from '../assets/js/state.js';

const repo = { name: 'design-studio', fullName: 'octo/design-studio', owner: 'octo', description: 'Create something worth sharing.', stars: 2, forks: 0, issues: 1, branch: 'main', license: 'MIT', languages: [{name:'TypeScript',percent:100}], topics:['design','tools'], contributors:[], release:null };
const normalizedSvg = (svg) => svg.replace(/card\d+-/g, 'card-');

test('same seed produces the same composition and geometry', () => {
    const a = generateDesign(DEFAULT_DESIGN, 98765), b = generateDesign(DEFAULT_DESIGN, 98765);
    assert.deepEqual(a, b);
    assert.equal(normalizedSvg(renderCard(repo, a)), normalizedSvg(renderCard(repo, b)));
    const random = seededRandom(10), again = seededRandom(10);
    assert.deepEqual(Array.from({length:30},random), Array.from({length:30},again));
});
test('generator explores independent layouts, backgrounds, typography and geometry', () => {
    const designs = Array.from({ length: 150 }, (_, i) => generateDesign(DEFAULT_DESIGN, i + 1));
    assert.ok(new Set(designs.map(d => d.layout)).size >= 12);
    assert.ok(new Set(designs.map(d => d.typography)).size === 4);
    assert.ok(new Set(designs.map(d => d.decoration)).size >= 9);
    assert.ok(new Set(designs.map(d => d.background)).size === 6);
    assert.ok(designs.every(d => LAYOUTS.includes(d.layout) && d.template === 'generated'));
});
test('locks preserve chosen parameters while other parameters may change', () => {
    const current = { ...DEFAULT_DESIGN, template:'monolith', theme:'violet', accent:'#c1a3ff', lockLayout:true, lockPalette:true, lockTypography:true, lockDecoration:true, lockBackground:true };
    const profile = compositionProfile(current), next = generateDesign(current, 4321);
    for (const key of ['layout','typography','decoration','background']) assert.equal(next[key], profile[key]);
    assert.equal(next.theme, current.theme); assert.equal(next.accent, current.accent); assert.equal(next.appearance, current.appearance);
});
test('remix keeps layout and generation preserves content, format, platform and counts', () => {
    const current = { ...DEFAULT_DESIGN, template:'mosaic', title:'Мой проект', description:'Useful software', platform:'desktop', format:'square', showcaseStars:1991, showcaseForks:601 };
    const next = generateDesign(current, 55, {remix:true});
    assert.equal(next.layout,'mosaic');
    for (const key of ['title','description','format','platform','showcaseStars','showcaseForks']) assert.equal(next[key],current[key]);
});
test('generated projects and links preserve seed, parameters and platform', () => {
    const design = generateDesign({...DEFAULT_DESIGN,platform:'desktop',lockPalette:true},123456);
    const project = validateProject({version:1,repository:repo,design});
    assert.deepEqual(project.design, design);
    assert.deepEqual(readDesignLink(new URL(createDesignLink('http://localhost:8000/',repo,design)).hash).design, design);
});
test('imported generator options are allowlisted and bounded', () => {
    const design = validateDesign({template:'generated',layout:'constructor',background:'<script>',typography:'url(evil)',seed:-42,corner:1000,platform:'desktop'});
    assert.equal(design.layout,DEFAULT_DESIGN.layout); assert.equal(design.typography,DEFAULT_DESIGN.typography);
    assert.equal(design.seed,1); assert.equal(design.corner,36); assert.equal(design.platform,'desktop');
});
test('Desktop fits a full card between equal 77px bands without scaling its title', () => {
    for (const template of [...TEMPLATES.map(t=>t.id),'generated']) for (const [format, dimensions] of Object.entries(FORMATS)) {
        const mobile = normalizedSvg(renderCard(repo,{...DEFAULT_DESIGN,template,format,platform:'mobile'}));
        const desktop = normalizedSvg(renderCard(repo,{...DEFAULT_DESIGN,template,format,platform:'desktop'}));
        const offset = 77 * 1280 / dimensions.width;
        const contentHeight = 1280 * dimensions.height / dimensions.width - offset * 2;
        assert.ok(desktop.includes(`<g data-platform-inset="77" data-layout-height="${contentHeight}" transform="translate(0 ${offset})"`));
        assert.ok(desktop.includes(`<clipPath id="card-desktopBounds"><rect width="1280" height="${contentHeight}"/>`));
        assert.ok(desktop.includes(`width="${dimensions.width}" height="${dimensions.height}"`));
        const sizes = (svg, role) => [...svg.matchAll(new RegExp(`<text[^>]*data-role="${role}"[^>]*>`, 'g'))].map(m => m[0].match(/font-size="([^"]+)"/)[1]);
        for (const role of ['project-title','repo-description']) assert.deepEqual(new Set(sizes(desktop,role)), new Set(sizes(mobile,role)));
        assert.ok(desktop.includes(repo.license)); assert.ok(desktop.includes(`github.com/${repo.fullName}`));
        assert.ok(!desktop.includes('NaN'));
    }
    assert.ok(!renderCard(repo,DEFAULT_DESIGN).includes('data-platform-inset'));
});
test('each generated layout renders long Unicode titles and optional empty data safely', () => {
    const empty = { ...repo, languages:[],topics:[],description:'',release:null };
    for (const layout of LAYOUTS) for (const format of ['github','square']) {
        const svg=renderCard(empty,{...DEFAULT_DESIGN,template:'generated',layout,format,title:'ДлинноеНазваниеРепозитория'.repeat(4),showStats:false,showLanguages:false});
        assert.ok(!svg.includes('undefined')); assert.ok(!svg.includes('NaN')); assert.ok(!svg.includes('1.5k'));
    }
});
