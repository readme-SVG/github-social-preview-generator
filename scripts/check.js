import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = [...readdirSync('assets/js').filter((file) => file.endsWith('.js')).map((file) => `assets/js/${file}`), ...readdirSync('tests').filter((file) => file.endsWith('.js')).map((file) => `tests/${file}`), 'scripts/check.js'];
let failed = false;
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
console.log(`Syntax valid: ${files.length} JavaScript files.`);
