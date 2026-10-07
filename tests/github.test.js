import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRepository } from '../assets/js/github.js';

test('GitHub fetch caches reads and preserves actual counts', async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
        calls++;
        if (url.endsWith('/languages')) return Response.json({ Go: 30, HTML: 10 });
        if (url.endsWith('/releases/latest')) return Response.json({ tag_name: 'v1' });
        if (url.includes('/contributors')) return Response.json([{ login: 'octo', type: 'User' }, { login: 'bot', type: 'Bot' }]);
        return Response.json({ name: 'cache-check', owner: { login: 'test' }, stargazers_count: 12, forks_count: 3 });
    });
    const first = await fetchRepository('test', 'cache-check');
    assert.equal(first.repository.stars, 12); assert.equal(first.repository.languages[0].percent, 75); assert.equal(first.repository.contributors.length, 1);
    await fetchRepository('test', 'cache-check'); assert.equal(calls, 4);
});
test('optional endpoints may fail without losing the card', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => {
        if (url.endsWith('/languages')) return new Response('', { status: 500 });
        if (url.endsWith('/releases/latest')) return new Response('', { status: 404 });
        if (url.includes('/contributors')) throw new TypeError('offline');
        return Response.json({ name: 'partial', owner: { login: 'test' }, language: 'Rust', stargazers_count: 0 });
    });
    const result = await fetchRepository('test', 'partial');
    assert.equal(result.repository.name, 'partial'); assert.equal(result.repository.stars, 0); assert.equal(result.repository.release, null);
    assert.deepEqual(result.repository.languages, [{ name: 'Rust', percent: 100 }]); assert.equal(result.warnings.length, 2);
});
test('404, rate limits and connection failures explain recovery', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => {
        if (url.endsWith('missing')) return new Response('', { status: 404 });
        if (url.endsWith('limited')) return new Response('', { status: 429 });
        throw new TypeError('offline');
    });
    await assert.rejects(fetchRepository('test', 'missing'), /not found/);
    await assert.rejects(fetchRepository('test', 'limited'), /limit reached/);
    await assert.rejects(fetchRepository('test', 'offline'), /connect to GitHub/);
});
