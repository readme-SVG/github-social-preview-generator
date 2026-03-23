import { GITHUB_API_BASE_URL } from './constants.js';

async function getJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(response.status === 404 ? 'Repository not found' : `API error ${response.status}`);
    }

    return response.json();
}

export async function fetchRepository(owner, repo) {
    return getJson(`${GITHUB_API_BASE_URL}/${owner}/${repo}`);
}

export async function fetchLanguages(url) {
    try {
        const languageData = await getJson(url);
        return Object.entries(languageData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);
    } catch {
        return [];
    }
}
