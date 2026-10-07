export const GITHUB_API_BASE_URL = 'https://api.github.com/repos';
export const STORAGE_KEY = 'repocard-studio:v1';
export const DEFAULT_THEME = 'slate';
export const THEMES = {
    slate: { name: 'Slate', color: '#b8c5d8', secondary: '#6a7f9d' },
    mint: { name: 'Mint', color: '#b5f5c4', secondary: '#8b7cf8' },
    violet: { name: 'Violet', color: '#c1a3ff', secondary: '#5edfc0' },
    blue: { name: 'Sky', color: '#8bc7ff', secondary: '#a487ff' },
    peach: { name: 'Peach', color: '#ffbd98', secondary: '#ff82b0' },
    rose: { name: 'Rose', color: '#ff9ebc', secondary: '#b0a2ff' },
    amber: { name: 'Amber', color: '#f9d879', secondary: '#f49d82' },
};
export const TEMPLATES = [
    { id: 'aurora', name: 'Aurora', description: 'A little atmosphere. A big impression.', category: 'Showcase' },
    { id: 'editorial', name: 'Editorial', description: 'Bold type, warm paper, quiet confidence.', category: 'Minimal' },
    { id: 'blueprint', name: 'Blueprint', description: 'Built for the things you’re building.', category: 'Technical' },
    { id: 'bento', name: 'Bento', description: 'Your project, by the numbers.', category: 'Insights' },
    { id: 'terminal', name: 'Terminal', description: 'Straight from your natural habitat.', category: 'Technical' },
    { id: 'release', name: 'Release', description: 'Give your next version a proper debut.', category: 'Announcement' },
    { id: 'monolith', name: 'Monolith', description: 'Oversized type and a sculptural corner.', category: 'Minimal', layout: 'poster', background: 'solid', decoration: 'arcs', typography: 'wide' },
    { id: 'obsidian', name: 'Obsidian', description: 'Two worlds, one project.', category: 'Showcase', layout: 'split', background: 'mesh', decoration: 'rings', typography: 'serif' },
    { id: 'signal', name: 'Signal', description: 'A broadcast from your next big thing.', category: 'Technical', layout: 'stacked', background: 'diagonal', decoration: 'wave', typography: 'mono' },
    { id: 'orbit', name: 'Orbit', description: 'A project with its own gravitational pull.', category: 'Showcase', layout: 'orbital', background: 'grid', decoration: 'orbit', typography: 'sans' },
    { id: 'noir', name: 'Noir', description: 'A precise frame. Nothing extra.', category: 'Minimal', layout: 'frame', background: 'solid', decoration: 'none', typography: 'serif' },
    { id: 'neon', name: 'Neon', description: 'A luminous geometric split.', category: 'Showcase', layout: 'split', background: 'solid', decoration: 'prism', typography: 'wide' },
    { id: 'paper', name: 'Paper', description: 'A printed poster for a digital project.', category: 'Minimal', layout: 'poster', background: 'dots', decoration: 'rings', typography: 'serif', appearance: 'light' },
    { id: 'swiss', name: 'Swiss', description: 'Sharp columns and strong hierarchy.', category: 'Minimal', layout: 'columns', background: 'solid', decoration: 'tiles', typography: 'wide' },
    { id: 'prism', name: 'Prism', description: 'A diagonal cut with a glassy centerpiece.', category: 'Showcase', layout: 'diagonal', background: 'mesh', decoration: 'prism', typography: 'sans' },
    { id: 'circuit', name: 'Circuit', description: 'Connections, coordinates, code.', category: 'Technical', layout: 'network', background: 'grid', decoration: 'orbit', typography: 'mono' },
    { id: 'schematic', name: 'Schematic', description: 'A library laid out like a technical drawing.', category: 'Technical', layout: 'dossier', background: 'grid', decoration: 'arcs', typography: 'mono' },
    { id: 'capsule', name: 'Capsule', description: 'An inset canvas with a soft, rounded edge.', category: 'Minimal', layout: 'capsule', background: 'mesh', decoration: 'rings', typography: 'sans' },
    { id: 'horizon', name: 'Horizon', description: 'A broad header above a landscape of detail.', category: 'Showcase', layout: 'banner', background: 'mesh', decoration: 'wave', typography: 'sans' },
    { id: 'waveform', name: 'Waveform', description: 'A visual frequency for your repository.', category: 'Technical', layout: 'wave', background: 'solid', decoration: 'wave', typography: 'mono' },
    { id: 'gridline', name: 'Gridline', description: 'Four spaces, one clear story.', category: 'Insights', layout: 'quadrant', background: 'grid', decoration: 'tiles', typography: 'wide' },
    { id: 'gallery', name: 'Gallery', description: 'A title card with an art-print finish.', category: 'Minimal', layout: 'poster', background: 'halftone', decoration: 'flower', typography: 'serif', appearance: 'light' },
    { id: 'spectrum', name: 'Spectrum', description: 'A bold side stripe and stacked typography.', category: 'Showcase', layout: 'stripe', background: 'diagonal', decoration: 'arcs', typography: 'wide' },
    { id: 'mosaic', name: 'Mosaic', description: 'A colorful mosaic of project details.', category: 'Insights', layout: 'mosaic', background: 'solid', decoration: 'tiles', typography: 'sans' },
    { id: 'dossier', name: 'Dossier', description: 'The repository, filed and beautifully indexed.', category: 'Technical', layout: 'dossier', background: 'solid', decoration: 'none', typography: 'mono' },
    { id: 'folio', name: 'Folio', description: 'An elegant border with a botanical signature.', category: 'Minimal', layout: 'frame', background: 'dots', decoration: 'flower', typography: 'serif', appearance: 'light' },
    { id: 'eclipse', name: 'Eclipse', description: 'A quiet moon behind a powerful headline.', category: 'Showcase', layout: 'orbital', background: 'mesh', decoration: 'eclipse', typography: 'serif' },
    { id: 'badge', name: 'Badge', description: 'A collector’s edition of your project.', category: 'Announcement', layout: 'badge', background: 'solid', decoration: 'rings', typography: 'wide' },
    { id: 'chromatic', name: 'Chromatic', description: 'A flowing ribbon across a slanted canvas.', category: 'Showcase', layout: 'diagonal', background: 'mesh', decoration: 'ribbon', typography: 'sans' },
    { id: 'stack', name: 'Stack', description: 'Layered panels, deliberate proportions.', category: 'Insights', layout: 'stacked', background: 'solid', decoration: 'tiles', typography: 'mono' },
];
export const GENERATED_TEMPLATE = { id: 'generated', name: 'Generated composition', description: 'A unique layout, built from your choices.', category: 'Generator' };
export const LAYOUTS = ['poster', 'split', 'stacked', 'orbital', 'frame', 'columns', 'diagonal', 'network', 'dossier', 'capsule', 'banner', 'wave', 'quadrant', 'stripe', 'mosaic', 'badge'];
export const BACKGROUNDS = ['solid', 'mesh', 'grid', 'dots', 'diagonal', 'halftone'];
export const DECORATIONS = ['none', 'arcs', 'rings', 'wave', 'orbit', 'prism', 'tiles', 'flower', 'eclipse', 'ribbon', 'contour'];
export const TYPOGRAPHY = ['sans', 'serif', 'mono', 'wide'];
export const FORMATS = {
    github: { name: 'GitHub social preview', width: 1280, height: 640 },
    social: { name: 'Open Graph / LinkedIn', width: 1200, height: 630 },
    square: { name: 'Square post', width: 1080, height: 1080 },
};
export const DEFAULT_DESIGN = {
    template: 'aurora', theme: 'slate', accent: '#b8c5d8', appearance: 'dark',
    format: 'github', platform: 'mobile', title: '', description: '', eyebrow: 'OPEN SOURCE, OPEN POSSIBILITIES',
    footer: '', showStats: true, showLanguages: true, showTopics: true, showOwner: true,
    showLicense: true, showMark: true, showRelease: true, texture: true, titleSize: 100,
    statsMode: 'showcase', showcaseStars: 1500, showcaseForks: 500,
    layout: 'split', background: 'mesh', decoration: 'rings', typography: 'sans', seed: 314159,
    spacing: 'balanced', corner: 20, lockLayout: false, lockPalette: false,
    lockTypography: false, lockBackground: false, lockDecoration: false,
};
export const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#5c9cfa', Python: '#6fa5d7', Java: '#b07219',
    'C++': '#f34b7d', 'C#': '#63ba53', C: '#aaa', Go: '#00ADD8', Rust: '#dea584',
    Ruby: '#cc526d', PHP: '#959bd3', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
    Shell: '#89e051', HTML: '#e34c26', CSS: '#b595f5', SCSS: '#c6538c', Vue: '#41b883',
    Svelte: '#ff3e00', 'Jupyter Notebook': '#DA5B0B', Elixir: '#ba91cb', Lua: '#6b84ce',
};
