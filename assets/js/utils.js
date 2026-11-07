/**
 * Formats numeric values into human-readable strings (k/m notation).
 *
 * @param {number} value - The raw numeric value.
 * @returns {string} Formatted string.
 */
export function fmt(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n >= 1e6) {
        return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
    }
    if (n >= 1e3) {
        return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return String(n);
}

/**
 * Formats file size in kilobytes or megabytes.
 *
 * @param {number} kb - Size in kilobytes.
 * @returns {string} Formatted size string.
 */
export function fmtSize(kb) {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb || 0} KB`;
}

/**
 * Parses a GitHub repository input string into owner/repo components.
 * Supports URLs, owner/repo format, and .git suffixes.
 *
 * @param {string} raw - The raw input string.
 * @returns {{owner: string, repo: string}|null} Parsed components or null if invalid.
 */
export function parseInput(raw) {
    let value = String(raw || '').trim();
    if (!value) {
        return null;
    }

    // Handle URL formats
    if (/^(?:https?:\/\/|github\.com\/)/i.test(value)) {
        try {
            const url = new URL(/^https?:/i.test(value) ? value : `https://${value}`);
            if (
                url.hostname.toLowerCase() !== 'github.com' ||
                !['https:', 'http:'].includes(url.protocol) ||
                url.username ||
                url.password
            ) {
                return null;
            }
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts.length < 2) {
                return null;
            }
            value = parts.slice(0, 2).join('/');
        } catch {
            return null;
        }
    }

    // Clean suffixes and split
    const parts = value.replace(/\.git$/i, '').replace(/\/$/, '').split('/');
    if (parts.length !== 2) {
        return null;
    }

    const [owner, repo] = parts;

    // Validate owner and repo naming conventions
    if (
        !/^[a-z\d][a-z\d-]{0,38}$/i.test(owner) ||
        !/^[\w.-]{1,100}$/.test(repo) ||
        ['.', '..'].includes(repo)
    ) {
        return null;
    }

    return { owner, repo };
}

/**
 * Escapes special characters for safe XML/SVG insertion.
 *
 * @param {any} value - The value to escape.
 * @returns {string} Escaped string.
 */
export function escapeXml(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
        .replace(/[<>&"']/g, (char) => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&apos;'
        })[char]);
}

/**
 * Sanitizes strings for safe filename usage.
 *
 * @param {string} value - The string to sanitize.
 * @returns {string} Sanitized filename.
 */
export function sanitizeFilename(value) {
    return String(value)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 160) || 'repository';
}

/**
 * Validates if a string is a proper hex color code.
 *
 * @param {string} value - The color string.
 * @returns {boolean} True if valid hex color.
 */
export function validHex(value) {
    return /^#[a-f\d]{6}$/i.test(value);
}

/**
 * Calculates relative luminance of a hex color.
 *
 * @param {string} hex - Hex color code.
 * @returns {number} Luminance value (0-1).
 */
export function luminance(hex) {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const normalized = channels.map((n) =>
        n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
    );
    return normalized[0] * 0.2126 + normalized[1] * 0.7152 + normalized[2] * 0.0722;
}

/**
 * Determines the contrasting color (dark/light) for a given hex background.
 *
 * @param {string} hex - Hex color code.
 * @returns {string} Contrast color hex.
 */
export function contrastColor(hex) {
    return luminance(hex) > 0.3 ? '#1d2c42' : '#f4f7fd';
}

/**
 * Generates random showcase statistics for demonstration purposes.
 *
 * @returns {{showcaseStars: number, showcaseForks: number}} Random stats.
 */
export function randomShowcaseStats() {
    return {
        showcaseStars: Math.floor(Math.random() * 1001) + 1000,
        showcaseForks: Math.floor(Math.random() * 401) + 300
    };
}

/**
 * Formats a date string into a localized date format.
 *
 * @param {string} value - ISO date string.
 * @returns {string} Formatted date or 'Not available'.
 */
export function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Not available'
        : date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'
        });
}

/**
 * Mixes two hex colors based on a weight factor.
 *
 * @param {string} hex - Base hex color.
 * @param {string} target - Target hex color.
 * @param {number} amount - Weight factor (0-1).
 * @returns {string} Mixed hex color.
 */
export function mixColor(hex, target, amount) {
    const channels = (value) => [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
    const a = channels(hex);
    const b = channels(target);
    return '#' + a
        .map((n, i) => Math.round(n + (b[i] - n) * amount).toString(16).padStart(2, '0'))
        .join('');
}
