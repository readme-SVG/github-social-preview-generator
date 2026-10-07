import { GITHUB_API_BASE_URL } from './constants.js';
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
async function getJson(url, signal) {
    const saved = cache.get(url);
    if (saved && Date.now() - saved.time < CACHE_TTL) return saved.data;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 15000);
    try {
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } });
        if (!response.ok) {
            if (response.status === 404) throw new Error('Repository not found. Check the name and make sure it is public.');
            if (response.status === 403 || response.status === 429) {
                const reset = Number(response.headers.get('x-ratelimit-reset'));
                const time = reset ? new Date(reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                throw new Error(`GitHub request limit reached.${time ? ` Try again after ${time}.` : ' Try again later.'} You can still edit and export your current card.`);
            }
            throw new Error(`GitHub returned ${response.status}. Please try again.`);
        }
        const data = await response.json();
        cache.set(url, { data, time: Date.now() });
        return data;
    } catch (error) {
        if (error.name === 'AbortError' && !signal?.aborted) throw new Error('GitHub took too long to respond. Please try again.');
        if (error instanceof TypeError) throw new Error('Could not connect to GitHub. Check your connection; your current card is still available.');
        throw error;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}
export function normalizeRepository(repo, languages = {}, release = null, contributors = []) {
    const total = Object.values(languages).reduce((sum, n) => sum + Math.max(0, Number(n) || 0), 0);
    const list = Object.entries(languages).filter(([, n]) => Number(n) > 0).sort((a, b) => b[1] - a[1]);
    return {
        name: repo.name || 'repository', owner: repo.owner?.login || 'owner',
        fullName: repo.full_name || `${repo.owner?.login}/${repo.name}`,
        description: repo.description || '', stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0, issues: repo.open_issues_count || 0,
        license: repo.license?.spdx_id === 'NOASSERTION' ? 'Custom license' : repo.license?.spdx_id || '',
        branch: repo.default_branch || 'main', homepage: repo.homepage || '',
        topics: (repo.topics || []).slice(0, 8), updated: repo.pushed_at || repo.updated_at || '',
        created: repo.created_at || '', archived: !!repo.archived,
        languages: list.length ? list.slice(0, 5).map(([name, bytes]) => ({ name, percent: bytes / total * 100 })) : repo.language ? [{ name: repo.language, percent: 100 }] : [],
        release: release ? { tag: release.tag_name || '', name: release.name || '', published: release.published_at || '' } : null,
        contributors: (Array.isArray(contributors) ? contributors : []).filter((c) => c.type !== 'Bot').slice(0, 5).map((c) => ({ login: c.login })),
        fetchedAt: new Date().toISOString(),
    };
}
export async function fetchRepository(owner, repo, signal) {
    const base = `${GITHUB_API_BASE_URL}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const repository = await getJson(base, signal);
    const extras = await Promise.allSettled([
        getJson(`${base}/languages`, signal), getJson(`${base}/releases/latest`, signal),
        getJson(`${base}/contributors?per_page=8`, signal),
    ]);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const value = (index, fallback) => extras[index].status === 'fulfilled' ? extras[index].value : fallback;
    const warnings = [];
    if (extras[0].status === 'rejected') warnings.push('Language breakdown unavailable');
    if (extras[1].status === 'rejected' && !extras[1].reason.message.startsWith('Repository not found')) warnings.push('Release data unavailable');
    if (extras[2].status === 'rejected') warnings.push('Contributor data unavailable');
    return { repository: normalizeRepository(repository, value(0, {}), value(1, null), value(2, [])), warnings };
}
export async function loadExample() {
    const files = await Promise.all(['repo', 'languages', 'release'].map(async (part) => {
        const response = await fetch(new URL(`../demo-${part}.json`, import.meta.url));
        if (!response.ok) throw new Error('Could not load the example. Import a public repository to get started.');
        return response.json();
    }));
    return { ...normalizeRepository(...files), fetchedAt: files[0].snapshot_at || '2026-10-07T00:00:00Z' };
}
