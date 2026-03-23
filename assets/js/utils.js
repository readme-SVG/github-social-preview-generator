export function fmt(n) {
    if (n >= 1e6) {
        return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    }

    if (n >= 1e3) {
        return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
    }

    return String(n);
}

export function fmtSize(kb) {
    if (kb >= 1024) {
        return `${(kb / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
    }

    return `${kb} KB`;
}

export function titleCase(value) {
    return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseInput(raw) {
    const trimmed = raw.trim();

    if (!trimmed) {
        return null;
    }

    try {
        if (trimmed.includes('github.com')) {
            const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
            const parts = new URL(url).pathname.split('/').filter(Boolean);

            if (parts.length >= 2) {
                return { owner: parts[0], repo: parts[1] };
            }
        }
    } catch {
        return null;
    }

    if (trimmed.includes('/')) {
        const [owner, repo] = trimmed.split('/');

        if (owner && repo) {
            return { owner, repo };
        }
    }

    return null;
}

export function sanitizeFilename(value) {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}
