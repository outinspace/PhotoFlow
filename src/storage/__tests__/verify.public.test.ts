import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyConnection } from '../verify';
import { StorageConfig } from '../config';

// The check that refuses a public bucket, and the reason it has to write a probe
// object to do it.
//
// Providers disagree about what an anonymous refusal looks like from a browser. B2
// answers 401 with no CORS headers, so the fetch throws and the status cannot be
// read at all. MinIO answers 403 with them. Both shapes have to read as "private",
// and only a readable success may read as "public" — get that backwards and either
// every B2 user is locked out, or a public bucket is waved through.

const config: StorageConfig = {
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    bucket: 'my-photos',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-west-004'
};

interface Seen {
    method: string;
    url: string;
    signed: boolean;
}

/** Answers the ladder, letting the test decide only what the anonymous read does. */
const installFetch = (anonymousRead: () => Promise<Response>, writeStatus = 200) => {
    const seen: Seen[] = [];

    vi.stubGlobal('fetch', async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = typeof input === 'string' ? (init?.method ?? 'GET') : input.method;
        // A query-string signature is what separates the app's own reads from the
        // deliberately unsigned probe.
        const signed = url.includes('X-Amz-Signature') || typeof input !== 'string';

        seen.push({ method, url, signed });

        if (url.includes('list-type=2')) {
            return new Response('<ListBucketResult/>', { status: 200 });
        }
        if (url.includes('.access-check')) {
            if (method === 'PUT') return new Response('', { status: writeStatus });
            if (method === 'DELETE') return new Response('', { status: 204 });
            return anonymousRead();
        }
        return new Response('{}', { status: 200 });
    });

    return seen;
};

const anonymousProbe = (seen: Seen[]) =>
    seen.find(entry => entry.url.includes('.access-check') && entry.method === 'GET' && !entry.signed);

afterEach(() => vi.unstubAllGlobals());

describe('refusing a bucket that anyone can read', () => {
    it('refuses when an anonymous reader gets the object', async () => {
        installFetch(async () => new Response('x', { status: 200 }));

        const result = await verifyConnection(config);

        expect(result.ok).toBe(false);
        expect(result.failure).toBe('bucket-is-public');
    });

    it('accepts a bucket that answers an anonymous reader 403, as MinIO does', async () => {
        const seen = installFetch(async () => new Response('', { status: 403 }));

        expect((await verifyConnection(config)).ok).toBe(true);
        expect(anonymousProbe(seen)).toBeDefined();
    });

    it('accepts a bucket whose refusal carries no CORS headers, as B2 does', async () => {
        // The browser reports this as an opaque network failure, not a status. It
        // must not be mistaken for a CORS problem: reads were already proven to
        // work two rungs earlier, so the only thing left is the bucket saying no.
        const seen = installFetch(async () => { throw new TypeError('Failed to fetch'); });

        expect((await verifyConnection(config)).ok).toBe(true);
        expect(anonymousProbe(seen)).toBeDefined();
    });

    it('treats a 404 as public, because the object was just written', async () => {
        // Anything other than a refusal means the bucket answered a request with no
        // credentials on it.
        installFetch(async () => new Response('', { status: 404 }));

        expect((await verifyConnection(config)).failure).toBe('bucket-is-public');
    });

    it('probes an object it wrote, rather than the manifest', async () => {
        // A bucket with no photos in it yet has no manifest, and "not found" and
        // "not allowed" are the two things being told apart — so the probe has to
        // be something known to exist.
        const seen = installFetch(async () => new Response('', { status: 403 }));

        await verifyConnection(config);

        const probeWrite = seen.find(e => e.method === 'PUT' && e.url.includes('.access-check'));
        expect(probeWrite).toBeDefined();
        expect(anonymousProbe(seen)!.url).not.toContain('manifest.json');
    });

    it('deletes the probe whether the bucket passes or fails', async () => {
        for (const anonymous of [
            async () => new Response('x', { status: 200 }),   // public
            async () => new Response('', { status: 403 })     // private
        ]) {
            const seen = installFetch(anonymous);
            await verifyConnection(config);

            expect(seen.some(e => e.method === 'DELETE' && e.url.includes('.access-check'))).toBe(true);
            vi.unstubAllGlobals();
        }
    });

    it('reports a key that cannot write, rather than guessing at privacy', async () => {
        installFetch(async () => new Response('', { status: 403 }), 403);

        expect((await verifyConnection(config)).failure).toBe('no-write-permission');
    });

    it('keeps the probe out of every prefix the app lists', async () => {
        // meta/log/ and meta/reprocess/ are both scanned; a stray object in either
        // would be read as a device log or a rebuild request.
        const seen = installFetch(async () => new Response('', { status: 403 }));
        await verifyConnection(config);

        const key = decodeURIComponent(anonymousProbe(seen)!.url);
        expect(key).toContain('meta/.access-check');
        expect(key).not.toContain('meta/log/');
        expect(key).not.toContain('meta/reprocess/');
    });
});
