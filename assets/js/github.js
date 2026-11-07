import { GITHUB_API_BASE_URL } from './constants.js';

// Global cache configuration
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Prevent memory leak in long-running sessions

/**
 * Fetches JSON data from the specified URL with caching and timeout mechanisms.
 *
 * @param {string} url - The endpoint URL to fetch.
 * @param {AbortSignal|undefined} signal - Optional signal to abort the request.
 * @returns {Promise<any>} The parsed JSON response.
 * @throws {Error} If the request fails, times out, or encounters network issues.
 */
async function getJson(url, signal) {
    // Cache lookup with TTL validation
    const saved = cache.get(url);
    if (saved && Date.now() - saved.time < CACHE_TTL_MS) {
        return saved.data;
    }

    // Cleanup cache if exceeding size limit (LRU-like eviction)
    if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }

    const controller = new AbortController();
    const abort = () => controller.abort();

    // Register external signal listener
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
        controller.abort();
    }

    // Timeout mechanism: 15 seconds
    const timer = setTimeout(abort, 15000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28' // Explicit API versioning
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Repository not found. Check the name and ensure it is public.');
            }
            if (response.status === 403 || response.status === 429) {
                const resetHeader = response.headers.get('x-ratelimit-reset');
                const resetTime = resetHeader ? new Date(Number(resetHeader) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                throw new Error(`GitHub rate limit reached. Retry later. Existing card remains editable.`);
            }
            throw new Error(`GitHub API returned ${response.status}. Please retry.`);
        }

        const data = await response.json();
        cache.set(url, { data, time: Date.now() });
        return data;
    } catch (error) {
        // Handle specific error cases with user-friendly messages
        if (error.name === 'AbortError' && !signal?.aborted) {
            throw new Error('GitHub request timed out. Please try again.');
        }
        if (error instanceof TypeError) {
            throw new Error('Network connection failed. Connect to GitHub; existing card remains available.');
        }
        throw error;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}

/**
 * Normalizes raw GitHub repository data into the internal model structure.
 *
 * @param {Object} repo - Raw repository object from GitHub API.
 * @param {Object} languages - Language breakdown data.
 * @param {Object|null} release - Latest release data.
 * @param {Array} contributors - List of contributor objects.
 * @returns {Object} Normalized repository data.
 */
export function normalizeRepository(repo, languages = {}, release = null, contributors = []) {
    const totalBytes = Object.values(languages).reduce((sum, n) => sum + Math.max(0, Number(n) || 0), 0);
    const languageList = Object.entries(languages)
        .filter(([, n]) => Number(n) > 0)
        .sort((a, b) => b[1] - a[1]);

    return {
        name: repo.name || 'repository',
        owner: repo.owner?.login || 'owner',
        fullName: repo.full_name || `${repo.owner?.login}/${repo.name}`,
        description: repo.description || '',
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        issues: repo.open_issues_count || 0,
        license: repo.license?.spdx_id === 'NOASSERTION' ? 'Custom license' : repo.license?.spdx_id || '',
        branch: repo.default_branch || 'main',
        homepage: repo.homepage || '',
        topics: (repo.topics || []).slice(0, 8),
        updated: repo.pushed_at || repo.updated_at || '',
        created: repo.created_at || '',
        archived: !!repo.archived,
        languages: languageList.length
            ? languageList.slice(0, 5).map(([name, bytes]) => ({
                name,
                percent: (bytes / totalBytes) * 100
            }))
            : repo.language
                ? [{ name: repo.language, percent: 100 }]
                : [],
        release: release
            ? {
                tag: release.tag_name || '',
                name: release.name || '',
                published: release.published_at || ''
            }
            : null,
        contributors: (Array.isArray(contributors) ? contributors : [])
            .filter((c) => c.type !== 'Bot')
            .slice(0, 5)
            .map((c) => ({ login: c.login })),
        fetchedAt: new Date().toISOString(),
    };
}

/**
 * Fetches repository metadata and associated data (languages, release, contributors).
 *
 * @param {string} owner - GitHub owner/organization name.
 * @param {string} repo - Repository name.
 * @param {AbortSignal|undefined} signal - Signal to abort requests.
 * @returns {Promise<{repository: Object, warnings: string[]}>} Normalized data and fetch warnings.
 */
export async function fetchRepository(owner, repo, signal) {
    const base = `${GITHUB_API_BASE_URL}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const repository = await getJson(base, signal);

    // Parallel fetching with graceful degradation
    const extras = await Promise.allSettled([
        getJson(`${base}/languages`, signal),
        getJson(`${base}/releases/latest`, signal),
        getJson(`${base}/contributors?per_page=8`, signal),
    ]);

    if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
    }

    // Helper to extract fulfilled values or fallbacks
    const getValue = (index, fallback) =>
        extras[index].status === 'fulfilled' ? extras[index].value : fallback;

    const warnings = [];
    if (extras[0].status === 'rejected') {
        warnings.push('Language breakdown unavailable');
    }
    if (extras[1].status === 'rejected' && !extras[1].reason?.message?.startsWith('Repository not found')) {
        warnings.push('Release data unavailable');
    }
    if (extras[2].status === 'rejected') {
        warnings.push('Contributor data unavailable');
    }

    return {
        repository: normalizeRepository(
            repository,
            getValue(0, {}),
            getValue(1, null),
            getValue(2, [])
        ),
        warnings,
    };
}

/**
 * Loads example data from local JSON assets.
 *
 * @returns {Promise<Object>} Example repository data structure.
 */
export async function loadExample() {
    const parts = ['repo', 'languages', 'release'];
    const files = await Promise.all(
        parts.map(async (part) => {
            const response = await fetch(new URL(`../demo-${part}.json`, import.meta.url));
            if (!response.ok) {
                throw new Error('Failed to load example data. Import a public repository to begin.');
            }
            return response.json();
        })
    );

    return {
        ...normalizeRepository(...files),
        fetchedAt: files[0].snapshot_at || '2026-10-07T00:00:00Z',
    };
}
